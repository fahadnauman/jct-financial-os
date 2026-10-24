import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

const BRANCHES = ["JCT_HQ", "HEMPEL_JUBAIL", "JOTUN_DAMMAM", "SIGMA_JUBAIL"];
const TYPES = ["EXPENSE", "ADVANCE", "CREDIT_COLLECTION"];
const SOURCES = ["DRAWER_CASH", "OWNER_POCKET", "BANK_TRANSFER"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const branch = searchParams.get("branch");
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
  const amount = Number(body.amount);
  if (
    !BRANCHES.includes(String(body.branch)) ||
    !TYPES.includes(String(body.type)) ||
    !SOURCES.includes(String(body.paymentSource)) ||
    !(amount > 0) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(String(body.date))
  ) {
    return NextResponse.json({ error: "Invalid transaction" }, { status: 400 });
  }
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : null);
  try {
    const row = await prisma.pocketTransaction.create({
      data: {
        branch: String(body.branch),
        type: String(body.type),
        amount,
        category: str(body.category),
        recipientName: str(body.recipientName),
        paymentSource: String(body.paymentSource),
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
