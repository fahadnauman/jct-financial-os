import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { checkIsOwner, normalizeBranch, normalizePaymentMode, VALID_BRANCHES } from "../../../lib/auth-audit";

export const dynamic = "force-dynamic";

const TYPES = ["EXPENSE", "ADVANCE", "CREDIT_COLLECTION"];
const SOURCES = ["DRAWER_CASH", "OWNER_POCKET", "BANK_TRANSFER"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawBranch = searchParams.get("branch") || searchParams.get("branchId");
  const branch = rawBranch && rawBranch !== "ALL" ? normalizeBranch(rawBranch) : rawBranch;
  const date = searchParams.get("date");

  try {
    const rows = await prisma.pocketTransaction.findMany({
      where: {
        ...(branch && branch !== "ALL" ? { branch } : {}),
        ...(date ? { date } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: 500,
    });
    return NextResponse.json({ transactions: rows });
  } catch (err) {
    console.error("GET /api/pocket failed", err);
    return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawBranch = body.branch || body.branchId || req.headers.get("x-branch-id");
  const branch = normalizeBranch(rawBranch);
  const amount = Number(body.amount);
  const paymentSource = String(body.paymentSource);

  if (
    !VALID_BRANCHES.includes(branch) ||
    !TYPES.includes(String(body.type)) ||
    !SOURCES.includes(paymentSource) ||
    !(amount > 0) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(String(body.date))
  ) {
    return NextResponse.json({ error: "Invalid transaction parameters or branch" }, { status: 400 });
  }

  const paymentMode = normalizePaymentMode(
    body.paymentMode,
    paymentSource === "BANK_TRANSFER" ? "SAB" : "CASH"
  );

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : null);

  try {
    const row = await prisma.pocketTransaction.create({
      data: {
        branch,
        type: String(body.type),
        amount,
        category: str(body.category),
        recipientName: str(body.recipientName),
        paymentSource,
        paymentMode,
        note: str(body.note),
        date: String(body.date),
      },
    });
    return NextResponse.json({ transaction: row }, { status: 201 });
  } catch (err) {
    console.error("POST /api/pocket failed", err);
    return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "Transaction ID is required" }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : null);
  const updateData: Record<string, unknown> = {};
  if (body.amount !== undefined) updateData.amount = Math.max(0, Number(body.amount) || 0);
  if (body.category !== undefined) updateData.category = str(body.category);
  if (body.recipientName !== undefined) updateData.recipientName = str(body.recipientName);
  if (typeof body.paymentSource === "string" && SOURCES.includes(body.paymentSource)) {
    updateData.paymentSource = body.paymentSource;
  }
  if (body.paymentMode !== undefined) {
    updateData.paymentMode = normalizePaymentMode(body.paymentMode);
  }
  if (body.branch || body.branchId) {
    updateData.branch = normalizeBranch(body.branch || body.branchId);
  }
  if (body.note !== undefined) updateData.note = str(body.note);
  if (typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    updateData.date = body.date;
  }

  try {
    const updated = await prisma.pocketTransaction.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json({ transaction: updated });
  } catch (err) {
    console.error("PUT /api/pocket failed", err);
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
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
    return NextResponse.json({ error: "Owner authorization required to delete pocket transactions" }, { status: 403 });
  }

  if (!id) {
    return NextResponse.json({ error: "Transaction ID is required" }, { status: 400 });
  }

  try {
    await prisma.pocketTransaction.delete({ where: { id } });
    return NextResponse.json({ deleted: true, id });
  } catch (err) {
    console.error("DELETE /api/pocket failed", err);
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
  }
}
