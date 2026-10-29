import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { checkIsOwner, normalizeBranch, normalizePaymentMode } from "../../../lib/auth-audit";

export const dynamic = "force-dynamic";

const VALID_TYPES = ["SALARY_PAYOUT", "ADVANCE", "BONUS", "DEDUCTION"];
const VALID_SOURCES = ["REGISTER_DRAWER", "BANK_TRANSFER", "OWNER_POCKET"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const staffId = searchParams.get("staffId");
  const month = searchParams.get("month"); // e.g. "2026-10"
  const rawBranch = searchParams.get("branch") || searchParams.get("branchId");
  const branch = rawBranch && rawBranch !== "ALL" ? normalizeBranch(rawBranch) : rawBranch;

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

  const paymentMode = normalizePaymentMode(
    body.paymentMode,
    source === "BANK_TRANSFER" ? "SAB" : "CASH"
  );

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

    const rawBranch = body.branch || body.branchId || req.headers.get("x-branch-id") || staff.branch;
    const branch = normalizeBranch(rawBranch, normalizeBranch(staff.branch));
    const effectiveNote = note || (type === "SALARY_PAYOUT" ? `Salary Payment - ${staff.name}` : undefined);

    // Dual-write atomic transaction: Staff & Payroll Ledger + Daily Register Expense
    const [log, pocketTx] = await prisma.$transaction(async (tx) => {
      const createdLog = await tx.payrollLog.create({
        data: {
          staffId,
          type,
          amount,
          date,
          branch,
          note: effectiveNote,
          source,
          paymentMode,
        },
        include: {
          staff: true,
        },
      });

      let createdPocket = null;
      if (type === "SALARY_PAYOUT") {
        createdPocket = await tx.pocketTransaction.create({
          data: {
            branch,
            type: "EXPENSE",
            category: "Salary",
            amount,
            recipientName: staff.name,
            paymentSource:
              source === "REGISTER_DRAWER"
                ? "DRAWER_CASH"
                : source === "OWNER_POCKET"
                ? "OWNER_POCKET"
                : "BANK_TRANSFER",
            paymentMode,
            note: effectiveNote || `Salary Payment - ${staff.name}`,
            date,
          },
        });
      }

      return [createdLog, createdPocket];
    });

    return NextResponse.json({ log, pocketTx }, { status: 201 });
  } catch (err) {
    console.error("POST /api/payroll failed", err);
    return NextResponse.json({ error: "Failed to create payroll log" }, { status: 500 });
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
    return NextResponse.json({ error: "PayrollLog ID is required" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (typeof body.type === "string" && VALID_TYPES.includes(body.type.trim())) {
    updateData.type = body.type.trim();
  }
  if (body.amount !== undefined) {
    updateData.amount = Math.max(0, Number(body.amount) || 0);
  }
  if (body.note !== undefined) {
    updateData.note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
  }
  if (typeof body.source === "string" && VALID_SOURCES.includes(body.source.trim())) {
    updateData.source = body.source.trim();
  }
  if (body.paymentMode !== undefined) {
    updateData.paymentMode = normalizePaymentMode(body.paymentMode);
  }
  if (typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date.trim())) {
    updateData.date = body.date.trim();
  }
  if (body.branch || body.branchId) {
    updateData.branch = normalizeBranch(body.branch || body.branchId);
  }

  try {
    const updated = await prisma.payrollLog.update({
      where: { id },
      data: updateData,
      include: { staff: true },
    });
    return NextResponse.json({ log: updated });
  } catch (err) {
    console.error("PUT /api/payroll failed", err);
    return NextResponse.json({ error: "Failed to update payroll log" }, { status: 500 });
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
    return NextResponse.json({ error: "Owner authorization required to delete payroll records" }, { status: 403 });
  }

  if (!id) {
    return NextResponse.json({ error: "PayrollLog ID is required" }, { status: 400 });
  }

  try {
    await prisma.payrollLog.delete({ where: { id } });
    return NextResponse.json({ deleted: true, id });
  } catch (err) {
    console.error("DELETE /api/payroll failed", err);
    return NextResponse.json({ error: "Failed to delete payroll log" }, { status: 500 });
  }
}
