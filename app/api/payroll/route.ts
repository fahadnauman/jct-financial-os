import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

const VALID_TYPES = ["SALARY_PAYOUT", "ADVANCE", "BONUS", "DEDUCTION"];
const VALID_SOURCES = ["REGISTER_DRAWER", "BANK_TRANSFER", "OWNER_POCKET"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const staffId = searchParams.get("staffId");
  const month = searchParams.get("month"); // e.g. "2026-10"
  const branch = searchParams.get("branch");

  try {
    const logs = await prisma.payrollLog.findMany({
      where: {
        ...(staffId ? { staffId } : {}),
        ...(branch && branch !== "ALL" ? { branch } : {}),
        ...(month ? { date: { startsWith: month } } : {}),
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            branch: true,
            role: true,
            baseSalary: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return NextResponse.json({ logs });
  } catch (err) {
    console.error("GET /api/payroll failed", err);
    return NextResponse.json({ error: "Failed to fetch payroll logs" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const staffId = typeof body.staffId === "string" ? body.staffId.trim() : "";
  const type = typeof body.type === "string" ? body.type.trim() : "";
  const amount = Number(body.amount) || 0;
  const note = typeof body.note === "string" ? body.note.trim() : null;
  const source = typeof body.source === "string" && VALID_SOURCES.includes(body.source.trim())
    ? body.source.trim()
    : "REGISTER_DRAWER";
  const date = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date.trim())
    ? body.date.trim()
    : new Date().toISOString().slice(0, 10);

  if (!staffId) {
    return NextResponse.json({ error: "staffId is required" }, { status: 400 });
  }
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: `type must be one of: ${VALID_TYPES.join(", ")}` }, { status: 400 });
  }
  if (amount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
  }

  try {
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
    });

    if (!staff) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }

    const branch = typeof body.branch === "string" && body.branch.trim() ? body.branch.trim() : staff.branch;

    const log = await prisma.payrollLog.create({
      data: {
        staffId,
        type,
        amount,
        date,
        branch,
        note,
        source,
      },
      include: {
        staff: true,
      },
    });

    return NextResponse.json({ log }, { status: 201 });
  } catch (err) {
    console.error("POST /api/payroll failed", err);
    return NextResponse.json({ error: "Failed to create payroll log" }, { status: 500 });
  }
}
