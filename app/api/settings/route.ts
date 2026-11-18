import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { checkIsOwner, normalizeBranch } from "../../../lib/auth-audit";
import { getClientIp } from "../../../lib/rate-limit";
import { sanitizeString } from "../../../lib/sanitize";
import { saudiTodayIso } from "../../../lib/saudi-time";

export const dynamic = "force-dynamic";

export interface CapitalDepositDTO {
  id: string;
  branch: string;
  targetAccount: "CASH" | "BANK";
  amount: number;
  date: string;
  notes: string;
  createdBy: string | null;
  createdAt: string;
}

export const DEFAULT_PROFILE_PINS: Record<string, string> = {
  OWNER: "2026",
  BONGSI: "2026",
  JCT_HARDWARE_JOTUN: "1111",
  HEMPEL: "2222",
  DAMMAM_JOTUN: "3333",
  SIGMA: "4444",
};

const buildProfilePins = (
  rows: Array<{ branch: string; accessPin?: string | null; ownerPin?: string | null }>
): Record<string, string> => {
  const pins: Record<string, string> = { ...DEFAULT_PROFILE_PINS };
  for (const r of rows) {
    if (r.branch === "OWNER" && r.accessPin && r.accessPin.trim()) {
      pins.OWNER = r.accessPin.trim();
      pins.BONGSI = r.accessPin.trim();
    } else if (r.ownerPin && r.ownerPin.trim() && pins.OWNER === DEFAULT_PROFILE_PINS.OWNER) {
      pins.OWNER = r.ownerPin.trim();
      pins.BONGSI = r.ownerPin.trim();
    }
    if (
      (r.branch === "JCT_HARDWARE_JOTUN" ||
        r.branch === "HEMPEL" ||
        r.branch === "DAMMAM_JOTUN" ||
        r.branch === "SIGMA") &&
      r.accessPin &&
      r.accessPin.trim()
    ) {
      pins[r.branch] = r.accessPin.trim();
    }
  }
  return pins;
};

const serializeDeposit = (d: {
  id: string;
  branch: string;
  targetAccount: string;
  amount: number;
  date: string;
  notes: string | null;
  createdBy: string | null;
  createdAt: Date;
}): CapitalDepositDTO => ({
  id: d.id,
  branch: d.branch,
  targetAccount: d.targetAccount === "BANK" ? "BANK" : "CASH",
  amount: d.amount,
  date: d.date,
  notes: d.notes || "",
  createdBy: d.createdBy,
  createdAt: d.createdAt.toISOString(),
});

const serialize = (
  branch: string,
  row: { openingCashBalance: number; openingBankBalance: number; updatedAt: Date } | null,
  deposits: CapitalDepositDTO[] = []
) => {
  const cashDeposits = deposits
    .filter((d) => d.targetAccount === "CASH")
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const bankDeposits = deposits
    .filter((d) => d.targetAccount === "BANK")
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  return {
    branch,
    openingCashBalance: row?.openingCashBalance ?? 0,
    openingBankBalance: row?.openingBankBalance ?? 0,
    manualCashDeposits: Math.round(cashDeposits * 100) / 100,
    manualBankDeposits: Math.round(bankDeposits * 100) / 100,
    updatedAt: row ? row.updatedAt.toISOString() : null,
    configured: Boolean(row),
  };
};

/**
 * GET /api/settings?branch=HEMPEL            -> baseline + manual deposits for one branch
 * GET /api/settings?branch=ALL               -> baselines + manual deposits for all branches
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawBranch = searchParams.get("branch") || req.headers.get("x-branch-id");
  const includeSecurity = searchParams.get("includeSecurity") === "1";
  const isOwner = checkIsOwner(req);

  try {
    const [rows, allDeposits, securityLogs] = await Promise.all([
      prisma.branchSettings.findMany(),
      rawBranch === "ALL"
        ? prisma.capitalDeposit.findMany({ orderBy: { createdAt: "desc" }, take: 200 })
        : prisma.capitalDeposit.findMany({
            where: { branch: normalizeBranch(rawBranch) },
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
      includeSecurity && isOwner
        ? prisma.securityAuditLog.findMany({
            orderBy: { createdAt: "desc" },
            take: 10,
          })
        : Promise.resolve([]),
    ]);
    const serializedDeposits = allDeposits.map(serializeDeposit);
    const verifiedBranchHeader = req.headers.get("x-verified-branch");
    const allPins = buildProfilePins(rows);
    const staffOwnBranch = verifiedBranchHeader
      ? normalizeBranch(verifiedBranchHeader)
      : normalizeBranch(rawBranch);
    const securityPayload = includeSecurity
      ? isOwner
        ? {
            profilePins: allPins,
            securityLogs: securityLogs.map((l) => ({
              id: l.id,
              event: l.event,
              profileId: l.profileId,
              branch: l.branch,
              ipAddress: l.ipAddress,
              userAgent: l.userAgent,
              details: l.details,
              createdAt: l.createdAt.toISOString(),
            })),
          }
        : {
            profilePins: {
              [staffOwnBranch]: allPins[staffOwnBranch] || DEFAULT_PROFILE_PINS[staffOwnBranch] || "1111",
            },
          }
      : {};

    if (rawBranch === "ALL") {
      const branches = ["JCT_HARDWARE_JOTUN", "HEMPEL", "DAMMAM_JOTUN", "SIGMA"];
      const settingsList = branches.map((b) => {
        const row = rows.find((r) => r.branch === b) || null;
        const bDeposits = serializedDeposits.filter((d) => d.branch === b);
        return serialize(b, row, bDeposits);
      });
      return NextResponse.json(
        {
          settings: settingsList,
          capitalDeposits: serializedDeposits,
          ...securityPayload,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const branch = normalizeBranch(rawBranch);
    const row = rows.find((r) => r.branch === branch) || null;
    return NextResponse.json(
      {
        settings: serialize(branch, row, serializedDeposits),
        capitalDeposits: serializedDeposits,
        ...securityPayload,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("GET /api/settings error:", err);
    return NextResponse.json({
      settings: serialize(normalizeBranch(rawBranch), null, []),
      capitalDeposits: [],
    });
  }
}

/**
 * PUT /api/settings  (Owner: all branches & PINs; Staff: own verified branch & own branch PIN only)
 * Body: { branch, openingCashBalance, openingBankBalance } OR { action: "UPDATE_PINS", profilePins }
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const isOwner = checkIsOwner(req, body);
    const verifiedBranchHeader = req.headers.get("x-verified-branch");
    const staffVerifiedBranch = verifiedBranchHeader ? normalizeBranch(verifiedBranchHeader) : null;

    if (body.action === "UPDATE_PINS" && body.profilePins && typeof body.profilePins === "object") {
      const incoming = body.profilePins as Record<string, string>;

      if (!isOwner) {
        // Staff can ONLY update their own branch's PIN — never OWNER master PIN or other branches
        const targetBranch = staffVerifiedBranch || normalizeBranch(body.branch || req.headers.get("x-branch-id"));
        if (!targetBranch || (targetBranch as string) === "OWNER") {
          return NextResponse.json({ error: "Forbidden: Invalid branch for PIN update" }, { status: 403 });
        }
        const rawPin = incoming[targetBranch];
        const branchPin = sanitizeString(rawPin || "", 32);
        if (!branchPin || branchPin.length < 4) {
          return NextResponse.json({ error: "Branch PIN must be at least 4 characters" }, { status: 400 });
        }
        await prisma.branchSettings.upsert({
          where: { branch: targetBranch },
          create: {
            branch: targetBranch,
            openingCashBalance: 0,
            openingBankBalance: 0,
            accessPin: branchPin,
            updatedBy: "STAFF",
          },
          update: {
            accessPin: branchPin,
            updatedBy: "STAFF",
          },
        });
        await prisma.securityAuditLog
          .create({
            data: {
              event: "PIN_CHANGED",
              profileId: targetBranch,
              branch: targetBranch,
              ipAddress: getClientIp(req),
              userAgent: (req.headers.get("user-agent") || "").slice(0, 240),
              details: `Branch staff updated access PIN for ${targetBranch}`,
            },
          })
          .catch(() => {});
        return NextResponse.json({
          ok: true,
          profilePins: { [targetBranch]: branchPin },
        });
      }

      const ownerPinVal = sanitizeString(incoming.OWNER || incoming.BONGSI || DEFAULT_PROFILE_PINS.OWNER, 32);
      const targets: Array<{ key: string; pin: string }> = [
        { key: "OWNER", pin: ownerPinVal },
        {
          key: "JCT_HARDWARE_JOTUN",
          pin: sanitizeString(incoming.JCT_HARDWARE_JOTUN || DEFAULT_PROFILE_PINS.JCT_HARDWARE_JOTUN, 32),
        },
        { key: "HEMPEL", pin: sanitizeString(incoming.HEMPEL || DEFAULT_PROFILE_PINS.HEMPEL, 32) },
        {
          key: "DAMMAM_JOTUN",
          pin: sanitizeString(incoming.DAMMAM_JOTUN || DEFAULT_PROFILE_PINS.DAMMAM_JOTUN, 32),
        },
        { key: "SIGMA", pin: sanitizeString(incoming.SIGMA || DEFAULT_PROFILE_PINS.SIGMA, 32) },
      ];

      await Promise.all(
        targets.map((t) =>
          prisma.branchSettings.upsert({
            where: { branch: t.key },
            create: {
              branch: t.key,
              openingCashBalance: 0,
              openingBankBalance: 0,
              accessPin: t.pin,
              ownerPin: ownerPinVal,
              updatedBy: "OWNER",
            },
            update: {
              accessPin: t.pin,
              ownerPin: ownerPinVal,
              updatedBy: "OWNER",
            },
          })
        )
      );

      await prisma.securityAuditLog
        .create({
          data: {
            event: "PIN_CHANGED",
            profileId: "OWNER",
            branch: "ALL",
            ipAddress: getClientIp(req),
            userAgent: (req.headers.get("user-agent") || "").slice(0, 240),
            details: "Owner updated profile security access PINs",
          },
        })
        .catch(() => {});

      const allRows = await prisma.branchSettings.findMany();
      return NextResponse.json({
        ok: true,
        profilePins: buildProfilePins(allRows),
      });
    }

    const requestedBranch = normalizeBranch(body.branch || req.headers.get("x-branch-id"));
    if (!isOwner && staffVerifiedBranch && requestedBranch !== staffVerifiedBranch) {
      return NextResponse.json(
        { error: "Forbidden: Staff can only update settings for their own branch" },
        { status: 403 }
      );
    }
    const branch = !isOwner && staffVerifiedBranch ? staffVerifiedBranch : requestedBranch;
    const cash = Number(body.openingCashBalance);
    const bank = Number(body.openingBankBalance);
    if (!Number.isFinite(cash) || !Number.isFinite(bank)) {
      return NextResponse.json({ error: "Balances must be valid numbers" }, { status: 400 });
    }
    const round = (n: number) => Math.round(n * 100) / 100;
    const [row, deposits, allRows] = await Promise.all([
      prisma.branchSettings.upsert({
        where: { branch },
        create: {
          branch,
          openingCashBalance: round(cash),
          openingBankBalance: round(bank),
          updatedBy: isOwner ? "OWNER" : "STAFF",
        },
        update: {
          openingCashBalance: round(cash),
          openingBankBalance: round(bank),
          updatedBy: isOwner ? "OWNER" : "STAFF",
        },
      }),
      prisma.capitalDeposit.findMany({
        where: { branch },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      isOwner ? prisma.branchSettings.findMany() : Promise.resolve([]),
    ]);
    const serializedDeposits = deposits.map(serializeDeposit);
    return NextResponse.json({
      settings: serialize(branch, row, serializedDeposits),
      capitalDeposits: serializedDeposits,
      ...(isOwner ? { profilePins: buildProfilePins(allRows) } : {}),
    });
  } catch (err) {
    console.error("PUT /api/settings error:", err);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}

export const PATCH = PUT;

/**
 * POST /api/settings
 * Supports:
 * 1) { action: "VERIFY_PIN", profileId, pin } -> verifies PIN against DB / default PINs
 * 2) Owner Manual Cash or Bank Deposit (CapitalDeposit)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.action === "VERIFY_PIN") {
      const profileId = String(body.profileId || "OWNER").trim().toUpperCase();
      const enteredPin = String(body.pin || "").trim();
      const rows = await prisma.branchSettings.findMany();
      const pins = buildProfilePins(rows);
      const normalizedKey =
        profileId === "BONGSI" || profileId === "OWNER"
          ? "OWNER"
          : normalizeBranch(profileId);
      const expected = pins[normalizedKey] || DEFAULT_PROFILE_PINS[normalizedKey] || "2026";
      const verified = enteredPin === expected;
      return NextResponse.json({ verified, profileId: normalizedKey });
    }

    const isOwner = checkIsOwner(req, body);
    const verifiedBranchHeader = req.headers.get("x-verified-branch");
    const staffVerifiedBranch = verifiedBranchHeader ? normalizeBranch(verifiedBranchHeader) : null;
    const requestedBranch = normalizeBranch(body.branch || req.headers.get("x-branch-id"));
    if (!isOwner && staffVerifiedBranch && requestedBranch !== staffVerifiedBranch) {
      return NextResponse.json(
        { error: "Forbidden: Staff can only add manual entries for their own branch" },
        { status: 403 }
      );
    }
    const branch = !isOwner && staffVerifiedBranch ? staffVerifiedBranch : requestedBranch;
    const targetAccount: "CASH" | "BANK" = body.targetAccount === "BANK" ? "BANK" : "CASH";
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Deposit amount must be greater than 0" }, { status: 400 });
    }
    const date = typeof body.date === "string" && body.date.trim() ? body.date.trim() : saudiTodayIso();
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";

    const round = (n: number) => Math.round(n * 100) / 100;
    const created = await prisma.capitalDeposit.create({
      data: {
        branch,
        targetAccount,
        amount: round(amount),
        date,
        notes: notes || (targetAccount === "CASH" ? "Branch Cash Injection" : "Manual Bank Deposit"),
        createdBy: isOwner ? "OWNER" : "STAFF",
      },
    });

    const [row, deposits] = await Promise.all([
      prisma.branchSettings.findUnique({ where: { branch } }),
      prisma.capitalDeposit.findMany({
        where: { branch },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    const serializedDeposits = deposits.map(serializeDeposit);

    return NextResponse.json({
      deposit: serializeDeposit(created),
      settings: serialize(branch, row, serializedDeposits),
      capitalDeposits: serializedDeposits,
    });
  } catch (err) {
    console.error("POST /api/settings error:", err);
    return NextResponse.json({ error: "Failed to add manual deposit" }, { status: 500 });
  }
}

/**
 * DELETE /api/settings?depositId=...  (Owner only)
 * Removes an accidental Manual Deposit entry
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const depositId = searchParams.get("depositId");
    const isOwner = checkIsOwner(req, { isOwner: searchParams.get("isOwner") === "true" });
    const verifiedBranchHeader = req.headers.get("x-verified-branch");
    const staffVerifiedBranch = verifiedBranchHeader ? normalizeBranch(verifiedBranchHeader) : null;
    if (!depositId) {
      return NextResponse.json({ error: "depositId is required" }, { status: 400 });
    }

    const existing = await prisma.capitalDeposit.findUnique({ where: { id: depositId } });
    if (!existing) {
      return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
    }
    if (!isOwner && staffVerifiedBranch && existing.branch !== staffVerifiedBranch) {
      return NextResponse.json(
        { error: "Forbidden: Staff can only delete manual entries for their own branch" },
        { status: 403 }
      );
    }

    await prisma.capitalDeposit.delete({ where: { id: depositId } });

    const branch = existing.branch;
    const [row, deposits] = await Promise.all([
      prisma.branchSettings.findUnique({ where: { branch } }),
      prisma.capitalDeposit.findMany({
        where: { branch },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    const serializedDeposits = deposits.map(serializeDeposit);

    return NextResponse.json({
      deletedId: depositId,
      settings: serialize(branch, row, serializedDeposits),
      capitalDeposits: serializedDeposits,
    });
  } catch (err) {
    console.error("DELETE /api/settings error:", err);
    return NextResponse.json({ error: "Failed to delete manual deposit" }, { status: 500 });
  }
}
