import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { checkIsOwner, normalizeBranch } from "../../../lib/auth-audit";
import { saudiTodayIso, addSaudiDays } from "../../../lib/saudi-time";

export const dynamic = "force-dynamic";

export interface AdvanceRecordDTO {
  id: string;
  branch: string;
  direction: "CUSTOMER_ADVANCE_IN" | "SUPPLIER_ADVANCE_OUT";
  partyName: string;
  phoneOrRef: string | null;
  branchInvNo: string | null;
  totalAdvanceAmount: number;
  utilizedAmount: number;
  remainingBalance: number;
  paymentMode: string;
  date: string;
  followUpDate: string | null;
  followUpStatus: string | null;
  notes: string;
  status: "ACTIVE" | "ADJUSTED" | "REFUNDED";
  createdAt: string;
  updatedAt: string;
}

const serializeAdvance = (row: {
  id: string;
  branch: string;
  direction: string;
  partyName: string;
  phoneOrRef: string | null;
  branchInvNo: string | null;
  totalAdvanceAmount: number;
  utilizedAmount: number;
  remainingBalance: number;
  paymentMode: string;
  date: string;
  followUpDate: string | null;
  followUpStatus: string | null;
  notes: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): AdvanceRecordDTO => ({
  id: row.id,
  branch: row.branch,
  direction:
    row.direction === "SUPPLIER_ADVANCE_OUT" ? "SUPPLIER_ADVANCE_OUT" : "CUSTOMER_ADVANCE_IN",
  partyName: row.partyName,
  phoneOrRef: row.phoneOrRef,
  branchInvNo: row.branchInvNo,
  totalAdvanceAmount: row.totalAdvanceAmount,
  utilizedAmount: row.utilizedAmount,
  remainingBalance: row.remainingBalance,
  paymentMode: row.paymentMode,
  date: row.date,
  followUpDate: row.followUpDate,
  followUpStatus: row.followUpStatus,
  notes: row.notes || "",
  status:
    row.status === "ADJUSTED"
      ? "ADJUSTED"
      : row.status === "REFUNDED"
      ? "REFUNDED"
      : "ACTIVE",
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/**
 * GET /api/advances?branch=JCT_HARDWARE_JOTUN&direction=SUPPLIER_ADVANCE_OUT
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawBranch = searchParams.get("branch") || req.headers.get("x-branch-id");
  const direction = searchParams.get("direction");
  const status = searchParams.get("status");
  try {
    const where: Record<string, unknown> = {};
    if (rawBranch && rawBranch !== "ALL") {
      where.branch = normalizeBranch(rawBranch);
    }
    if (direction === "CUSTOMER_ADVANCE_IN" || direction === "SUPPLIER_ADVANCE_OUT") {
      where.direction = direction;
    }
    if (status) {
      where.status = status;
    }

    const rows = await prisma.advanceRecord.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 300,
    });
    return NextResponse.json(
      { advances: rows.map(serializeAdvance) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("GET /api/advances error:", err);
    return NextResponse.json({ advances: [] }, { status: 500 });
  }
}

/**
 * POST /api/advances
 * Body: {
 *   branch,
 *   direction: "CUSTOMER_ADVANCE_IN" | "SUPPLIER_ADVANCE_OUT",
 *   partyName,
 *   phoneOrRef?,
 *   branchInvNo?,
 *   totalAdvanceAmount,
 *   paymentMode,
 *   date?,
 *   followUpDate?,
 *   notes?
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const branch = normalizeBranch(body.branch || req.headers.get("x-branch-id"));
    const direction =
      body.direction === "SUPPLIER_ADVANCE_OUT" ? "SUPPLIER_ADVANCE_OUT" : "CUSTOMER_ADVANCE_IN";
    const partyName = typeof body.partyName === "string" ? body.partyName.trim() : "";
    if (!partyName) {
      return NextResponse.json({ error: "Customer or Supplier name is required" }, { status: 400 });
    }
    const rawAmount = Number(body.totalAdvanceAmount ?? body.amount ?? 0);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      return NextResponse.json({ error: "Advance amount must be greater than 0" }, { status: 400 });
    }
    const round = (n: number) => Math.round(n * 100) / 100;
    const totalAdvanceAmount = round(rawAmount);
    const paymentMode = typeof body.paymentMode === "string" && body.paymentMode ? body.paymentMode : "CASH";
    const date = typeof body.date === "string" && body.date.trim() ? body.date.trim() : saudiTodayIso();
    const followUpDate =
      typeof body.followUpDate === "string" && body.followUpDate.trim()
        ? body.followUpDate.trim()
        : addSaudiDays(7);
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    const phoneOrRef = typeof body.phoneOrRef === "string" && body.phoneOrRef.trim() ? body.phoneOrRef.trim() : null;
    const branchInvNo = typeof body.branchInvNo === "string" && body.branchInvNo.trim() ? body.branchInvNo.trim() : null;

    const created = await prisma.advanceRecord.create({
      data: {
        branch,
        direction,
        partyName,
        phoneOrRef,
        branchInvNo,
        totalAdvanceAmount,
        utilizedAmount: 0,
        remainingBalance: totalAdvanceAmount,
        paymentMode,
        date,
        followUpDate,
        followUpStatus: "SCHEDULED",
        notes,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({ advance: serializeAdvance(created) });
  } catch (err) {
    console.error("POST /api/advances error:", err);
    return NextResponse.json({ error: "Failed to create advance record" }, { status: 500 });
  }
}

/**
 * PUT /api/advances
 * Supports:
 * 1) Adjusting/applying advance against a bill/invoice:
 *    Body: { id, deductAmount, adjustmentNote?, invoiceRef? }
 * 2) Updating follow-up date / status / notes:
 *    Body: { id, followUpDate?, followUpStatus?, notes?, status? }
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) {
      return NextResponse.json({ error: "Advance id is required" }, { status: 400 });
    }

    const existing = await prisma.advanceRecord.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Advance record not found" }, { status: 404 });
    }

    const round = (n: number) => Math.round(n * 100) / 100;
    const deductAmount = Number(body.deductAmount ?? 0);

    let nextUtilized = existing.utilizedAmount;
    let nextRemaining = existing.remainingBalance;
    let nextStatus = existing.status;
    let nextNotes = existing.notes || "";

    if (Number.isFinite(deductAmount) && deductAmount > 0) {
      const actualDeduct = Math.min(existing.remainingBalance, round(deductAmount));
      nextUtilized = round(existing.utilizedAmount + actualDeduct);
      nextRemaining = Math.max(0, round(existing.totalAdvanceAmount - nextUtilized));
      if (nextRemaining <= 0.009) {
        nextRemaining = 0;
        nextStatus = "ADJUSTED";
      }
      const refLabel = body.invoiceRef ? ` (${body.invoiceRef})` : "";
      const adjStamp = `[Adjusted SAR ${actualDeduct.toLocaleString()}${refLabel} on ${saudiTodayIso()}]`;
      nextNotes = nextNotes ? `${nextNotes} · ${adjStamp}` : adjStamp;
    }

    if (typeof body.status === "string" && ["ACTIVE", "ADJUSTED", "REFUNDED"].includes(body.status)) {
      nextStatus = body.status;
    }
    if (typeof body.notes === "string" && !body.deductAmount) {
      nextNotes = body.notes;
    }

    const updated = await prisma.advanceRecord.update({
      where: { id },
      data: {
        utilizedAmount: nextUtilized,
        remainingBalance: nextRemaining,
        status: nextStatus,
        notes: nextNotes,
        followUpDate:
          body.followUpDate !== undefined ? body.followUpDate : existing.followUpDate,
        followUpStatus:
          body.followUpStatus !== undefined ? body.followUpStatus : existing.followUpStatus,
      },
    });

    return NextResponse.json({ advance: serializeAdvance(updated) });
  } catch (err) {
    console.error("PUT /api/advances error:", err);
    return NextResponse.json({ error: "Failed to update advance record" }, { status: 500 });
  }
}

/**
 * DELETE /api/advances?id=...
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    if (!checkIsOwner(req, { isOwner: searchParams.get("isOwner") === "true" })) {
      return NextResponse.json({ error: "Only the Owner can delete advance records" }, { status: 403 });
    }
    await prisma.advanceRecord.delete({ where: { id } });
    return NextResponse.json({ deletedId: id });
  } catch (err) {
    console.error("DELETE /api/advances error:", err);
    return NextResponse.json({ error: "Failed to delete advance record" }, { status: 500 });
  }
}
