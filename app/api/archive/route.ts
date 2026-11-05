import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { checkIsOwner, normalizeBranch, normalizePaymentMode } from "../../../lib/auth-audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawBranch = searchParams.get("branch") || searchParams.get("branchId");
  const branch = rawBranch && rawBranch !== "ALL" ? normalizeBranch(rawBranch) : rawBranch;
  const limitParam = searchParams.get("limit") || searchParams.get("take");
  const limit = Math.min(Math.max(1, Number(limitParam) || 500), 2000);

  try {
    const rows = await prisma.dailyRegisterLock.findMany({
      where: {
        ...(branch && branch !== "ALL" ? { branch } : {}),
      },
      orderBy: { lockedAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ records: rows });
  } catch (err) {
    console.error("GET /api/archive error:", err);
    return NextResponse.json({ records: [] });
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
      nextDayOpeningCash: rawNextDayOpening,
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

    const takeHomeAmount =
      rawTakeHome !== undefined && rawTakeHome !== null ? Number(rawTakeHome) : null;
    const nextDayOpeningCash =
      rawNextDayOpening !== undefined && rawNextDayOpening !== null ? Number(rawNextDayOpening) : null;

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
          nextDayOpeningCash: nextDayOpeningCash !== null ? Number(nextDayOpeningCash) : null,
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
          nextDayOpeningCash: nextDayOpeningCash !== null ? Number(nextDayOpeningCash) : null,
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
      return NextResponse.json({ error: "Owner authorization required to update historical audit records" }, { status: 403 });
    }

    const {
      id,
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
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Record ID required" }, { status: 400 });
    }

    let sanitizedDataJson = dataJson !== undefined ? String(dataJson) : undefined;
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
        // preserve original
      }
    }

    const updated = await prisma.dailyRegisterLock.update({
      where: { id: String(id) },
      data: {
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
        ...(sanitizedDataJson !== undefined ? { dataJson: sanitizedDataJson } : {}),
      },
    });

    return NextResponse.json({ record: updated });
  } catch (err) {
    console.error("PUT /api/archive error:", err);
    return NextResponse.json({ error: "Failed to update archive record" }, { status: 500 });
  }
}

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
    await prisma.dailyRegisterLock.delete({
      where: { id: String(id) },
    });
    return NextResponse.json({ deleted: true, id });
  } catch (err) {
    console.error("DELETE /api/archive error:", err);
    return NextResponse.json({ error: "Failed to delete archive record" }, { status: 500 });
  }
}
