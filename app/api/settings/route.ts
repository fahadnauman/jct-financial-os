import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { checkIsOwner, normalizeBranch } from "../../../lib/auth-audit";

export const dynamic = "force-dynamic";

const serialize = (
  branch: string,
  row: { openingCashBalance: number; openingBankBalance: number; updatedAt: Date } | null
) => ({
  branch,
  openingCashBalance: row?.openingCashBalance ?? 0,
  openingBankBalance: row?.openingBankBalance ?? 0,
  updatedAt: row ? row.updatedAt.toISOString() : null,
  configured: Boolean(row),
});

/**
 * GET /api/settings?branch=HEMPEL            -> baseline for one branch
 * GET /api/settings?branch=ALL               -> baselines for all branches
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawBranch = searchParams.get("branch") || req.headers.get("x-branch-id");
  try {
    if (rawBranch === "ALL") {
      const rows = await prisma.branchSettings.findMany();
      return NextResponse.json(
        { settings: rows.map((r) => serialize(r.branch, r)) },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    const branch = normalizeBranch(rawBranch);
    const row = await prisma.branchSettings.findUnique({ where: { branch } });
    return NextResponse.json(
      { settings: serialize(branch, row) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("GET /api/settings error:", err);
    return NextResponse.json({ settings: serialize(normalizeBranch(rawBranch), null) });
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
    const row = await prisma.branchSettings.upsert({
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
    });
    return NextResponse.json({ settings: serialize(branch, row) });
  } catch (err) {
    console.error("PUT /api/settings error:", err);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
