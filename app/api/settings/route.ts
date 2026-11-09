import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { checkIsOwner, normalizeBranch } from "../../../lib/auth-audit";
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
  try {
    if (rawBranch === "ALL") {
      const [rows, allDeposits] = await Promise.all([
        prisma.branchSettings.findMany(),
        prisma.capitalDeposit.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
      ]);
      const serializedDeposits = allDeposits.map(serializeDeposit);
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
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    const branch = normalizeBranch(rawBranch);
    const [row, deposits] = await Promise.all([
      prisma.branchSettings.findUnique({ where: { branch } }),
      prisma.capitalDeposit.findMany({
        where: { branch },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    const serializedDeposits = deposits.map(serializeDeposit);
    return NextResponse.json(
      {
        settings: serialize(branch, row, serializedDeposits),
        capitalDeposits: serializedDeposits,
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
 * PUT /api/settings  (Owner only)
 * Body: { branch, openingCashBalance, openingBankBalance }
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    if (!checkIsOwner(req, body)) {
      return NextResponse.json({ error: "Only the Owner can change settings" }, { status: 403 });
    }
    const branch = normalizeBranch(body.branch || req.headers.get("x-branch-id"));
    const cash = Number(body.openingCashBalance);
    const bank = Number(body.openingBankBalance);
    if (!Number.isFinite(cash) || !Number.isFinite(bank)) {
      return NextResponse.json({ error: "Balances must be valid numbers" }, { status: 400 });
    }
    const round = (n: number) => Math.round(n * 100) / 100;
    const [row, deposits] = await Promise.all([
      prisma.branchSettings.upsert({
        where: { branch },
        create: {
          branch,
          openingCashBalance: round(cash),
          openingBankBalance: round(bank),
          updatedBy: "OWNER",
        },
        update: {
          openingCashBalance: round(cash),
          openingBankBalance: round(bank),
          updatedBy: "OWNER",
        },
      }),
      prisma.capitalDeposit.findMany({
        where: { branch },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    const serializedDeposits = deposits.map(serializeDeposit);
    return NextResponse.json({
      settings: serialize(branch, row, serializedDeposits),
      capitalDeposits: serializedDeposits,
    });
  } catch (err) {
    console.error("PUT /api/settings error:", err);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}

/**
 * POST /api/settings  (Owner only)
 * Creates a Manual Cash or Bank Deposit (CapitalDeposit)
 * Body: { branch, targetAccount: "CASH" | "BANK", amount, date?, notes }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!checkIsOwner(req, body)) {
      return NextResponse.json({ error: "Only the Owner can add manual deposits" }, { status: 403 });
    }
    const branch = normalizeBranch(body.branch || req.headers.get("x-branch-id"));
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
        notes: notes || (targetAccount === "CASH" ? "Owner Cash Injection" : "Manual Bank Deposit"),
        createdBy: "OWNER",
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
    const isOwnerHeader = checkIsOwner(req, { isOwner: searchParams.get("isOwner") === "true" });
    if (!isOwnerHeader) {
      return NextResponse.json({ error: "Only the Owner can delete manual deposits" }, { status: 403 });
    }
    if (!depositId) {
      return NextResponse.json({ error: "depositId is required" }, { status: 400 });
    }

    const existing = await prisma.capitalDeposit.findUnique({ where: { id: depositId } });
    if (!existing) {
      return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
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
