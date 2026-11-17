import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { checkIsOwner, checkStaffBranchAccess, normalizeBranch } from "../../../lib/auth-audit";
import { sanitizeOptionalString, sanitizeString, validateAmount } from "../../../lib/sanitize";
import { saudiTodayIso, saudiParts } from "../../../lib/saudi-time";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawBranch = searchParams.get("branch") || searchParams.get("branchId");
  const branch = rawBranch && rawBranch !== "ALL" ? normalizeBranch(rawBranch) : rawBranch;
  const date = searchParams.get("date");
  const search = searchParams.get("q") || searchParams.get("search");
  const limitParam = searchParams.get("limit") || searchParams.get("take");
  const limit = Math.min(Math.max(1, Number(limitParam) || 500), 1000);

  try {
    const records = await prisma.salesReturnRecord.findMany({
      where: {
        ...(branch && branch !== "ALL" ? { branch } : {}),
        ...(date ? { returnDate: date } : {}),
        ...(search
          ? {
              OR: [
                { invoiceNo: { contains: search, mode: "insensitive" } },
                { salesNo: { contains: search, mode: "insensitive" } },
                { customerName: { contains: search, mode: "insensitive" } },
                { reason: { contains: search, mode: "insensitive" } },
                { notes: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ records }, { status: 200 });
  } catch (err) {
    console.error("GET /api/sales-returns error:", err);
    return NextResponse.json({ records: [], error: "Failed to load sales returns" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawBranch = body.branch || body.branchId || req.headers.get("x-branch-id");
    const branchErr = checkStaffBranchAccess(req, rawBranch);
    if (branchErr) {
      return NextResponse.json({ error: branchErr }, { status: 403 });
    }
    const branch = normalizeBranch(rawBranch || "JCT_HARDWARE_JOTUN");

    const invoiceNo = sanitizeString(body.invoiceNo || "", 64);
    const returnedAmount = validateAmount(body.returnedAmount ?? body.amount ?? 0, false);

    if (!invoiceNo || returnedAmount === null) {
      return NextResponse.json(
        { error: "Invoice number and a valid returned amount (> 0) are required." },
        { status: 400 }
      );
    }

    const clientTxnId = body.clientTxnId ? String(body.clientTxnId).trim() : undefined;
    if (clientTxnId) {
      const existing = await prisma.salesReturnRecord.findFirst({
        where: { clientTxnId },
      });
      if (existing) {
        return NextResponse.json({ record: existing, duplicate: true }, { status: 200 });
      }
    }

    const now = new Date();
    const parts = saudiParts(now);
    const returnDate = body.returnDate && /^\d{4}-\d{2}-\d{2}$/.test(body.returnDate)
      ? body.returnDate
      : saudiTodayIso(now);
    const returnTime = body.returnTime || `${parts.hour}:${parts.minute}:${parts.second}`;

    const record = await prisma.salesReturnRecord.create({
      data: {
        clientTxnId,
        branch,
        returnDate,
        returnTime,
        invoiceNo,
        salesNo: sanitizeOptionalString(body.salesNo, 64),
        customerName: sanitizeOptionalString(body.customerName, 160),
        returnedAmount,
        originalAmount: validateAmount(body.originalAmount, true) ?? returnedAmount,
        refundMode: sanitizeString(body.refundMode || "CASH_REFUND", 48),
        reason: sanitizeString(body.reason || "Customer Cancelled", 120),
        notes: sanitizeOptionalString(body.notes, 300),
        loggedBy: sanitizeString(body.loggedBy || "Staff", 64),
        isPastDayReturn: Boolean(body.isPastDayReturn),
        pastDayDate: body.pastDayDate ? String(body.pastDayDate).trim() : null,
      },
    });

    return NextResponse.json({ record }, { status: 201 });
  } catch (err) {
    console.error("POST /api/sales-returns error:", err);
    return NextResponse.json({ error: "Failed to create sales return record" }, { status: 500 });
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
    return NextResponse.json({ error: "Owner authorization required to delete return records" }, { status: 403 });
  }

  if (!id) {
    return NextResponse.json({ error: "Return record ID is required" }, { status: 400 });
  }

  try {
    await prisma.salesReturnRecord.delete({
      where: { id: String(id) },
    });
    return NextResponse.json({ deleted: true, id });
  } catch (err) {
    console.error("DELETE /api/sales-returns error:", err);
    return NextResponse.json({ error: "Failed to delete return record" }, { status: 500 });
  }
}
