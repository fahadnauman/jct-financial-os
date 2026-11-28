import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { checkIsOwner, normalizeBranch, normalizePaymentMode } from "../../../lib/auth-audit";
import { backfillHistoricalReceivingAmounts } from "../../../lib/backfill-receiving";
import {
  isoToSessionDisplayDate,
  normalizeSessionDateToIso,
  saudiTodayIso,
} from "../../../lib/saudi-time";
import { deduplicateInvoices } from "../../../lib/deduplicate-records";

export const dynamic = "force-dynamic";

export interface UnclosedDraftDTO {
  id: string;
  sessionKey: string;
  branch: string;
  isoDate: string;
  displayDate: string;
  status: "UNCLOSED_DRAFT";
  erpCount: number;
  entryCount: number;
  creditCount: number;
  totalSales: number;
  totalCredits: number;
  updatedAt: string;
  dataJson: string;
}

function mergeArrayByKey(
  a: Array<Record<string, unknown>> = [],
  b: Array<Record<string, unknown>> = [],
  getKeys: (item: Record<string, unknown>) => string[]
) {
  const seen = new Set<string>();
  const out: Array<Record<string, unknown>> = [];
  for (const item of [...a, ...b]) {
    if (!item || typeof item !== "object") continue;
    const keys = getKeys(item).filter(Boolean);
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    out.push(item);
  }
  return out;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawBranch = searchParams.get("branch") || searchParams.get("branchId");
  const branch = rawBranch && rawBranch !== "ALL" ? normalizeBranch(rawBranch) : rawBranch;
  const limitParam = searchParams.get("limit") || searchParams.get("take");
  const limit = Math.min(Math.max(1, Number(limitParam) || 500), 2000);

  try {
    // Idempotent non-destructive auto-backfill for any past records with missing/zero ownerTakeHomeAmount
    await backfillHistoricalReceivingAmounts(branch).catch((err) => {
      console.warn("backfillHistoricalReceivingAmounts warning:", err);
    });

    const rows = await prisma.dailyRegisterLock.findMany({
      where: {
        ...(branch && branch !== "ALL" ? { branch } : {}),
      },
      orderBy: { lockedAt: "desc" },
      take: limit,
    });

    // Build set of already-closed (branch::isoDate) keys
    const closedKeys = new Set<string>();
    for (const r of rows) {
      const iso = normalizeSessionDateToIso(r.date) || r.date;
      closedKeys.add(`${r.branch}::${iso}`);
    }

    // Surface unclosed / in-progress past ActiveRegisterSession drafts (excluding today)
    const todayIso = saudiTodayIso();
    const activeSessions = await prisma.activeRegisterSession.findMany({
      where: {
        ...(branch && branch !== "ALL" ? { branch } : {}),
        status: { in: ["IN_PROGRESS", "DRAFT"] },
        dataJson: { not: null },
      },
      orderBy: { updatedAt: "desc" },
    });

    const groupedDrafts = new Map<
      string,
      {
        id: string;
        sessionKey: string;
        branch: string;
        isoDate: string;
        displayDate: string;
        erpInvoices: Array<Record<string, unknown>>;
        preLoggedBankInvoices: Array<Record<string, unknown>>;
        preLoggedEntries: Array<Record<string, unknown>>;
        updatedAt: Date;
      }
    >();

    for (const s of activeSessions) {
      const rawDate =
        s.reportDate ||
        (s.sessionKey && s.sessionKey.includes("::") ? s.sessionKey.split("::")[1] : null);
      const iso = normalizeSessionDateToIso(rawDate);
      if (!iso || iso >= todayIso) continue;
      const groupKey = `${s.branch}::${iso}`;
      if (closedKeys.has(groupKey)) continue;
      if (!s.dataJson) continue;

      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(s.dataJson) as Record<string, unknown>;
      } catch {
        continue;
      }
      const erpArr = Array.isArray(parsed.erpInvoices)
        ? (parsed.erpInvoices as Array<Record<string, unknown>>)
        : [];
      const bankArr = Array.isArray(parsed.preLoggedBankInvoices)
        ? (parsed.preLoggedBankInvoices as Array<Record<string, unknown>>)
        : [];
      const entArr = Array.isArray(parsed.preLoggedEntries)
        ? (parsed.preLoggedEntries as Array<Record<string, unknown>>)
        : [];

      if (erpArr.length === 0 && bankArr.length === 0 && entArr.length === 0) continue;

      const existing = groupedDrafts.get(groupKey);
      if (!existing) {
        groupedDrafts.set(groupKey, {
          id: s.id,
          sessionKey: s.sessionKey || groupKey,
          branch: s.branch,
          isoDate: iso,
          displayDate: isoToSessionDisplayDate(iso),
          erpInvoices: erpArr,
          preLoggedBankInvoices: bankArr,
          preLoggedEntries: entArr,
          updatedAt: s.updatedAt,
        });
      } else {
        existing.erpInvoices = deduplicateInvoices(
          [...existing.erpInvoices, ...erpArr] as Array<{ amount: number } & Record<string, unknown>>
        );
        existing.preLoggedBankInvoices = mergeArrayByKey(
          existing.preLoggedBankInvoices,
          bankArr,
          (b) => [
            b.clientTxnId ? `cid:${String(b.clientTxnId)}` : "",
            b.id ? `id:${String(b.id)}` : "",
          ]
        );
        existing.preLoggedEntries = mergeArrayByKey(
          existing.preLoggedEntries,
          entArr,
          (e) => [
            e.clientTxnId ? `cid:${String(e.clientTxnId)}` : "",
            e.id ? `id:${String(e.id)}` : "",
          ]
        );
        if (s.updatedAt > existing.updatedAt) {
          existing.updatedAt = s.updatedAt;
        }
      }
    }

    const unclosedDrafts: UnclosedDraftDTO[] = [];
    for (const draft of groupedDrafts.values()) {
      const creditRows = await prisma.creditRadar.findMany({
        where: {
          branch: draft.branch,
          originalDate: { in: [draft.isoDate, draft.displayDate] },
        },
      });
      const totalSales = draft.erpInvoices.reduce(
        (sum, inv) => (inv.isReturned ? sum : sum + (Number(inv.amount) || 0)),
        0
      );
      const totalCredits = creditRows.reduce(
        (sum, c) => sum + (Number(c.originalSaleAmount ?? c.amount) || 0),
        0
      );
      unclosedDrafts.push({
        id: draft.id,
        sessionKey: draft.sessionKey,
        branch: draft.branch,
        isoDate: draft.isoDate,
        displayDate: draft.displayDate,
        status: "UNCLOSED_DRAFT",
        erpCount: draft.erpInvoices.length,
        entryCount: draft.preLoggedEntries.length,
        creditCount: creditRows.length,
        totalSales: Math.round((totalSales + Number.EPSILON) * 100) / 100,
        totalCredits: Math.round((totalCredits + Number.EPSILON) * 100) / 100,
        updatedAt: draft.updatedAt.toISOString(),
        dataJson: JSON.stringify({
          erpInvoices: draft.erpInvoices,
          preLoggedBankInvoices: draft.preLoggedBankInvoices,
          preLoggedEntries: draft.preLoggedEntries,
          reportDate: draft.isoDate,
        }),
      });
    }

    unclosedDrafts.sort((a, b) => b.isoDate.localeCompare(a.isoDate));

    return NextResponse.json({ records: rows, unclosedDrafts });
  } catch (err) {
    console.error("GET /api/archive error:", err);
    return NextResponse.json({ records: [], unclosedDrafts: [] });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawBranch = body.branch || body.branchId || req.headers.get("x-branch-id");
    const branch = rawBranch ? normalizeBranch(rawBranch) : null;

    const {
      date,
      closingCash,
      openingCash = 0,
      inflows = 0,
      bankSwipes = 0,
      outflows = 0,
      posFees = 0,
      madaFees = 0,
      ccFees = 0,
      lockedBy = "Staff",
      status = "LOCKED",
      auditStatus: rawAuditStatus,
      hasDiscrepancy: rawHasDiscrepancy,
      varianceAmount: rawVarianceAmount,
      varianceType: rawVarianceType,
      dataJson,
      takeHomeAmount: rawTakeHome,
      ownerTakeHomeAmount: rawOwnerTakeHome,
      nextDayOpeningCash: rawNextDayOpening,
      remainingFloatForTomorrow: rawRemainingFloat,
    } = body;

    const resolvedAuditStatus = rawAuditStatus
      ? String(rawAuditStatus)
      : status === "PENDING_AUDIT"
      ? "PENDING_AUDIT"
      : "LOCKED";
    const resolvedStatus =
      resolvedAuditStatus === "PENDING_AUDIT" ? "PENDING_AUDIT" : String(status || "LOCKED");
    const hasDiscrepancy = Boolean(rawHasDiscrepancy);
    const varianceAmount =
      rawVarianceAmount !== undefined && rawVarianceAmount !== null && !Number.isNaN(Number(rawVarianceAmount))
        ? Number(rawVarianceAmount)
        : null;
    const varianceType = rawVarianceType ? String(rawVarianceType) : null;

    const takeHomeResolved =
      rawOwnerTakeHome !== undefined && rawOwnerTakeHome !== null
        ? Number(rawOwnerTakeHome)
        : rawTakeHome !== undefined && rawTakeHome !== null
        ? Number(rawTakeHome)
        : null;
    const takeHomeAmount = takeHomeResolved;
    const ownerTakeHomeAmount = takeHomeResolved ?? 0;
    const nextFloatResolved =
      rawRemainingFloat !== undefined && rawRemainingFloat !== null
        ? Number(rawRemainingFloat)
        : rawNextDayOpening !== undefined && rawNextDayOpening !== null
        ? Number(rawNextDayOpening)
        : null;
    const nextDayOpeningCash = nextFloatResolved;
    const remainingFloatForTomorrow = nextFloatResolved;

    if (!branch || !date) {
      return NextResponse.json({ error: "Branch and date are required" }, { status: 400 });
    }

    let sanitizedDataJson = dataJson ? String(dataJson) : null;
    if (sanitizedDataJson) {
      try {
        const parsed = JSON.parse(sanitizedDataJson);
        if (Array.isArray(parsed.bankSwipes)) {
          parsed.bankSwipes = parsed.bankSwipes.map((s: Record<string, unknown>) => ({
            ...s,
            paymentMode: normalizePaymentMode(s.paymentMode, "POS_SWIPE"),
          }));
        }
        if (Array.isArray(parsed.inflows)) {
          parsed.inflows = parsed.inflows.map((i: Record<string, unknown>) => ({
            ...i,
            paymentMode: normalizePaymentMode(i.paymentMode, "CASH"),
          }));

          // Smart Credit Radar Sync: Deduct received credit amount by linked invoice number
          for (const inflow of parsed.inflows as Record<string, unknown>[]) {
            const isCreditRecd =
              inflow.paymentMode === "Credit Received" ||
              inflow.paymentMode === "CREDIT_RECD" ||
              inflow.type === "CREDIT_RECD";
            const invNum = (inflow.linkedInvoiceNum || inflow.invoiceNumber || inflow.receiptNo) as string | undefined;
            const amt = Number(inflow.amount) || 0;

            if (isCreditRecd && invNum && amt > 0) {
              const cleanInv = String(invNum).replace(/^#/i, "").trim();
              try {
                // 1. Decrement in CreditRadar
                const radarMatches = await prisma.creditRadar.findMany({
                  where: {
                    OR: [
                      { linkedInvoiceNum: invNum },
                      { linkedInvoiceNum: cleanInv },
                      { linkedInvoiceNum: `#${cleanInv}` },
                      { invoiceNo: invNum },
                      { invoiceNo: cleanInv },
                      { invoiceNo: `#${cleanInv}` },
                    ],
                  },
                });

                for (const radar of radarMatches) {
                  await prisma.creditRadar.update({
                    where: { id: radar.id },
                    data: {
                      outstandingBalance: Math.max(0, radar.outstandingBalance - amt),
                    },
                  });
                }

                // 2. Decrement in CreditCustomer
                const custMatches = await prisma.creditCustomer.findMany({
                  where: {
                    OR: [
                      { linkedInvoiceNum: invNum },
                      { linkedInvoiceNum: cleanInv },
                      { linkedInvoiceNum: `#${cleanInv}` },
                      ...(inflow.customer || inflow.customerName || inflow.title
                        ? [{ name: { contains: String(inflow.customer || inflow.customerName || inflow.title), mode: "insensitive" as const } }]
                        : []),
                    ],
                  },
                });

                for (const cust of custMatches) {
                  const currentDue = cust.outstandingBalance ?? cust.totalDue ?? 0;
                  await prisma.creditCustomer.update({
                    where: { id: cust.id },
                    data: {
                      totalDue: Math.max(0, (cust.totalDue || 0) - amt),
                      outstandingBalance: Math.max(0, currentDue - amt),
                    },
                  });
                }
              } catch (dbErr) {
                console.warn("CreditRadar deduction error in /api/archive:", dbErr);
              }
            }
          }
        }
        if (Array.isArray(parsed.expenses)) {
          parsed.expenses = parsed.expenses.map((e: Record<string, unknown>) => ({
            ...e,
            paymentMode: normalizePaymentMode(e.paymentMode, "CASH"),
          }));
        }
        sanitizedDataJson = JSON.stringify(parsed);
      } catch {
        // preserve original string if parse fails
      }
    }

    // Upsert lock record
    const existing = await prisma.dailyRegisterLock.findFirst({
      where: { branch, date },
    });

    let saved;
    if (existing) {
      saved = await prisma.dailyRegisterLock.update({
        where: { id: existing.id },
        data: {
          closingCash: Number(closingCash),
          openingCash: Number(openingCash),
          takeHomeAmount: takeHomeAmount !== null ? Number(takeHomeAmount) : null,
          ownerTakeHomeAmount: ownerTakeHomeAmount !== null ? Number(ownerTakeHomeAmount) : 0,
          nextDayOpeningCash: nextDayOpeningCash !== null ? Number(nextDayOpeningCash) : null,
          remainingFloatForTomorrow: remainingFloatForTomorrow !== null ? Number(remainingFloatForTomorrow) : null,
          inflows: Number(inflows),
          bankSwipes: Number(bankSwipes),
          outflows: Number(outflows),
          posFees: Number(posFees),
          madaFees: Number(madaFees),
          ccFees: Number(ccFees),
          lockedBy: String(lockedBy),
          status: resolvedStatus,
          auditStatus: resolvedAuditStatus,
          hasDiscrepancy,
          varianceAmount,
          varianceType,
          dataJson: sanitizedDataJson !== null ? sanitizedDataJson : existing.dataJson,
          lockedAt: new Date(),
        },
      });
    } else {
      saved = await prisma.dailyRegisterLock.create({
        data: {
          branch: String(branch),
          date: String(date),
          closingCash: Number(closingCash),
          openingCash: Number(openingCash),
          takeHomeAmount: takeHomeAmount !== null ? Number(takeHomeAmount) : null,
          ownerTakeHomeAmount: ownerTakeHomeAmount !== null ? Number(ownerTakeHomeAmount) : 0,
          nextDayOpeningCash: nextDayOpeningCash !== null ? Number(nextDayOpeningCash) : null,
          remainingFloatForTomorrow: remainingFloatForTomorrow !== null ? Number(remainingFloatForTomorrow) : null,
          inflows: Number(inflows),
          bankSwipes: Number(bankSwipes),
          outflows: Number(outflows),
          posFees: Number(posFees),
          madaFees: Number(madaFees),
          ccFees: Number(ccFees),
          lockedBy: String(lockedBy),
          status: resolvedStatus,
          auditStatus: resolvedAuditStatus,
          hasDiscrepancy,
          varianceAmount,
          varianceType,
          dataJson: sanitizedDataJson,
        },
      });
    }

    const closeIso = normalizeSessionDateToIso(String(date));
    const closeDisplay = closeIso ? isoToSessionDisplayDate(closeIso) : String(date);
    const candidateCloseDates = Array.from(
      new Set([String(date), closeIso, closeDisplay].filter((d): d is string => Boolean(d)))
    );
    await prisma.activeRegisterSession
      .updateMany({
        where: {
          branch,
          OR: [
            { reportDate: { in: candidateCloseDates } },
            { sessionKey: { in: candidateCloseDates.map((d) => `${branch}::${d}`) } },
          ],
        },
        data: { status: "COMPLETED" },
      })
      .catch(() => {});

    return NextResponse.json({ record: saved }, { status: 200 });
  } catch (err) {
    console.error("POST /api/archive error:", err);
    return NextResponse.json({ error: "Failed to save archive record" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();

    if (!checkIsOwner(req, body)) {
      return NextResponse.json(
        { error: "Owner authorization required to modify locked archive records" },
        { status: 403 }
      );
    }

    const {
      id,
      newDate,
      replaceTargetDraft = true,
      closingCash,
      openingCash,
      inflows,
      bankSwipes,
      outflows,
      posFees,
      madaFees,
      ccFees,
      status,
      auditStatus,
      hasDiscrepancy,
      varianceAmount,
      varianceType,
      dataJson,
      takeHomeAmount,
      ownerTakeHomeAmount,
      nextDayOpeningCash,
      remainingFloatForTomorrow,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Record ID required" }, { status: 400 });
    }

    const existingRec = await prisma.dailyRegisterLock.findUnique({
      where: { id: String(id) },
    });
    if (!existingRec) {
      return NextResponse.json({ error: "Archive record not found" }, { status: 404 });
    }

    let resolvedNewDisplayDate: string | undefined;
    let resolvedNewIsoDate: string | undefined;
    if (typeof newDate === "string" && newDate.trim()) {
      resolvedNewIsoDate = normalizeSessionDateToIso(newDate.trim()) || newDate.trim();
      resolvedNewDisplayDate = isoToSessionDisplayDate(resolvedNewIsoDate);
    }

    let sanitizedDataJson = dataJson !== undefined ? String(dataJson) : undefined;
    const rawJsonForDate = sanitizedDataJson ?? existingRec.dataJson;
    if (rawJsonForDate && (sanitizedDataJson !== undefined || resolvedNewDisplayDate)) {
      try {
        const parsed = JSON.parse(rawJsonForDate);
        if (resolvedNewDisplayDate) {
          parsed.reportDate = resolvedNewDisplayDate;
        }
        if (Array.isArray(parsed.bankSwipes)) {
          parsed.bankSwipes = parsed.bankSwipes.map((s: Record<string, unknown>) => ({
            ...s,
            paymentMode: normalizePaymentMode(s.paymentMode, "POS_SWIPE"),
          }));
        }
        if (Array.isArray(parsed.inflows)) {
          parsed.inflows = parsed.inflows.map((i: Record<string, unknown>) => ({
            ...i,
            paymentMode: normalizePaymentMode(i.paymentMode, "CASH"),
          }));

          // Smart Credit Radar Sync: Deduct received credit amount by linked invoice number
          for (const inflow of parsed.inflows as Record<string, unknown>[]) {
            const isCreditRecd =
              inflow.paymentMode === "Credit Received" ||
              inflow.paymentMode === "CREDIT_RECD" ||
              inflow.type === "CREDIT_RECD";
            const invNum = (inflow.linkedInvoiceNum || inflow.invoiceNumber || inflow.receiptNo) as string | undefined;
            const amt = Number(inflow.amount) || 0;

            if (isCreditRecd && invNum && amt > 0) {
              const cleanInv = String(invNum).replace(/^#/i, "").trim();
              try {
                // 1. Decrement in CreditRadar
                const radarMatches = await prisma.creditRadar.findMany({
                  where: {
                    OR: [
                      { linkedInvoiceNum: invNum },
                      { linkedInvoiceNum: cleanInv },
                      { linkedInvoiceNum: `#${cleanInv}` },
                      { invoiceNo: invNum },
                      { invoiceNo: cleanInv },
                      { invoiceNo: `#${cleanInv}` },
                    ],
                  },
                });

                for (const radar of radarMatches) {
                  await prisma.creditRadar.update({
                    where: { id: radar.id },
                    data: {
                      outstandingBalance: Math.max(0, radar.outstandingBalance - amt),
                    },
                  });
                }

                // 2. Decrement in CreditCustomer
                const custMatches = await prisma.creditCustomer.findMany({
                  where: {
                    OR: [
                      { linkedInvoiceNum: invNum },
                      { linkedInvoiceNum: cleanInv },
                      { linkedInvoiceNum: `#${cleanInv}` },
                      ...(inflow.customer || inflow.customerName || inflow.title
                        ? [{ name: { contains: String(inflow.customer || inflow.customerName || inflow.title), mode: "insensitive" as const } }]
                        : []),
                    ],
                  },
                });

                for (const cust of custMatches) {
                  const currentDue = cust.outstandingBalance ?? cust.totalDue ?? 0;
                  await prisma.creditCustomer.update({
                    where: { id: cust.id },
                    data: {
                      totalDue: Math.max(0, (cust.totalDue || 0) - amt),
                      outstandingBalance: Math.max(0, currentDue - amt),
                    },
                  });
                }
              } catch (dbErr) {
                console.warn("CreditRadar deduction error in /api/archive:", dbErr);
              }
            }
          }
        }
        if (Array.isArray(parsed.expenses)) {
          parsed.expenses = parsed.expenses.map((e: Record<string, unknown>) => ({
            ...e,
            paymentMode: normalizePaymentMode(e.paymentMode, "CASH"),
          }));
        }
        sanitizedDataJson = JSON.stringify(parsed);
      } catch {
        // preserve original
      }
    }

    const updated = await prisma.dailyRegisterLock.update({
      where: { id: String(id) },
      data: {
        ...(resolvedNewDisplayDate ? { date: resolvedNewDisplayDate } : {}),
        ...(closingCash !== undefined ? { closingCash: Number(closingCash) } : {}),
        ...(openingCash !== undefined ? { openingCash: Number(openingCash) } : {}),
        ...(inflows !== undefined ? { inflows: Number(inflows) } : {}),
        ...(bankSwipes !== undefined ? { bankSwipes: Number(bankSwipes) } : {}),
        ...(outflows !== undefined ? { outflows: Number(outflows) } : {}),
        ...(posFees !== undefined ? { posFees: Number(posFees) } : {}),
        ...(madaFees !== undefined ? { madaFees: Number(madaFees) } : {}),
        ...(ccFees !== undefined ? { ccFees: Number(ccFees) } : {}),
        ...(status ? { status: String(status) } : {}),
        ...(auditStatus ? { auditStatus: String(auditStatus) } : status === "AUDITED" || status === "LOCKED" ? { auditStatus: "LOCKED" } : {}),
        ...(hasDiscrepancy !== undefined ? { hasDiscrepancy: Boolean(hasDiscrepancy) } : {}),
        ...(varianceAmount !== undefined ? { varianceAmount: varianceAmount !== null ? Number(varianceAmount) : null } : {}),
        ...(varianceType !== undefined ? { varianceType: varianceType !== null ? String(varianceType) : null } : {}),
        ...(takeHomeAmount !== undefined || ownerTakeHomeAmount !== undefined
          ? {
              takeHomeAmount: Number(ownerTakeHomeAmount ?? takeHomeAmount ?? 0),
              ownerTakeHomeAmount: Number(ownerTakeHomeAmount ?? takeHomeAmount ?? 0),
            }
          : {}),
        ...(nextDayOpeningCash !== undefined || remainingFloatForTomorrow !== undefined
          ? {
              nextDayOpeningCash: Number(remainingFloatForTomorrow ?? nextDayOpeningCash ?? 0),
              remainingFloatForTomorrow: Number(remainingFloatForTomorrow ?? nextDayOpeningCash ?? 0),
            }
          : {}),
        ...(sanitizedDataJson !== undefined ? { dataJson: sanitizedDataJson } : {}),
      },
    });

    if (resolvedNewDisplayDate && resolvedNewIsoDate) {
      const oldIso = normalizeSessionDateToIso(existingRec.date) || existingRec.date;
      const oldDisplay = isoToSessionDisplayDate(oldIso);
      const oldDates = Array.from(new Set([existingRec.date, oldIso, oldDisplay].filter(Boolean)));
      // Release old date active session status so old date is free if re-entered
      await prisma.activeRegisterSession
        .updateMany({
          where: {
            branch: existingRec.branch,
            OR: [
              { reportDate: { in: oldDates } },
              { sessionKey: { in: oldDates.map((d) => `${existingRec.branch}::${d}`) } },
            ],
          },
          data: { status: "CLEARED" },
        })
        .catch(() => {});

      if (replaceTargetDraft) {
        const newDates = Array.from(
          new Set([resolvedNewDisplayDate, resolvedNewIsoDate].filter(Boolean))
        );
        await prisma.activeRegisterSession
          .updateMany({
            where: {
              branch: existingRec.branch,
              OR: [
                { reportDate: { in: newDates } },
                { sessionKey: { in: newDates.map((d) => `${existingRec.branch}::${d}`) } },
              ],
            },
            data: { status: "COMPLETED" },
          })
          .catch(() => {});
      }
    }

    await prisma.securityAuditLog
      .create({
        data: {
          event: resolvedNewDisplayDate ? "ARCHIVE_DATE_CHANGED" : "ARCHIVE_AUDIT_EDITED",
          profileId: "OWNER",
          branch: updated.branch,
          details: JSON.stringify({
            recordId: updated.id,
            oldDate: existingRec.date,
            newDate: updated.date,
            closingCash: updated.closingCash,
          }),
        },
      })
      .catch(() => {});

    return NextResponse.json({ record: updated });
  } catch (err) {
    console.error("PUT /api/archive error:", err);
    return NextResponse.json({ error: "Failed to update archive record" }, { status: 500 });
  }
}

export const PATCH = PUT;

export async function DELETE(req: Request) {
  let body: Record<string, unknown> | null = null;
  const { searchParams } = new URL(req.url);
  let id = searchParams.get("id") || "";

  if (!id) {
    try {
      body = await req.json();
      if (typeof body?.id === "string") id = body.id.trim();
    } catch {
      // ignore
    }
  }

  if (!checkIsOwner(req, body)) {
    return NextResponse.json({ error: "Owner authorization required to delete archive records" }, { status: 403 });
  }

  if (!id) {
    return NextResponse.json({ error: "Record ID is required" }, { status: 400 });
  }

  try {
    const deleted = await prisma.dailyRegisterLock.delete({
      where: { id: String(id) },
    });
    await prisma.securityAuditLog
      .create({
        data: {
          event: "ARCHIVE_RECORD_DELETED",
          profileId: "OWNER",
          branch: deleted.branch,
          details: JSON.stringify({ recordId: deleted.id, date: deleted.date }),
        },
      })
      .catch(() => {});
    return NextResponse.json({ deleted: true, id });
  } catch (err) {
    console.error("DELETE /api/archive error:", err);
    return NextResponse.json({ error: "Failed to delete archive record" }, { status: 500 });
  }
}
