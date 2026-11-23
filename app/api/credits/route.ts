import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { normalizeBranch } from "../../../lib/auth-audit";
import { saudiTodayIso } from "../../../lib/saudi-time";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawBranch = searchParams.get("branch");
    const branch = rawBranch && rawBranch !== "ALL" ? normalizeBranch(rawBranch) : null;

    const where: Record<string, unknown> = {};
    if (branch) {
      where.OR = [{ branch }, { branch: null }];
    }

    const records = await prisma.creditRadar.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ records });
  } catch (err) {
    console.error("[GET /api/credits] Error:", err);
    return NextResponse.json(
      { error: "Failed to load credit radar records" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Collection settlement on an existing CreditRadar record (by id or FIFO by customerName)
    if (body.action === "COLLECT") {
      const id = String(body.id || "").trim();
      const customerName = String(body.customerName || "").trim();
      const rawBranch = body.branch;
      const branch = rawBranch && rawBranch !== "ALL" ? normalizeBranch(rawBranch) : null;
      const collectedAmount = Math.max(0, Number(body.collectedAmount) || 0);
      if ((!id && !customerName) || collectedAmount <= 0) {
        return NextResponse.json(
          { error: "Valid record id or customerName and positive collectedAmount are required" },
          { status: 400 }
        );
      }

      if (id) {
        const existing = await prisma.creditRadar.findUnique({ where: { id } });
        if (existing) {
          const currentRem = existing.remainingAmount ?? existing.outstandingBalance;
          const newBalance = Math.max(
            0,
            Number((currentRem - collectedAmount).toFixed(2))
          );
          const newStatus = newBalance <= 0.01 ? "SETTLED" : existing.status;

          const updated = await prisma.creditRadar.update({
            where: { id },
            data: {
              outstandingBalance: newBalance,
              remainingAmount: newBalance,
              status: newStatus,
              notes: body.notes
                ? `${existing.notes ? existing.notes + " | " : ""}Collected ${collectedAmount} SAR (${body.paymentMode || "CASH"})`
                : existing.notes,
            },
          });

          return NextResponse.json({ ok: true, record: updated });
        }
      }

      // Fallback: FIFO match open CreditRadar records by customerName (and branch if provided)
      if (customerName) {
        const whereOpen: Record<string, unknown> = {
          customerName: { equals: customerName, mode: "insensitive" },
          outstandingBalance: { gt: 0 },
        };
        if (branch) {
          whereOpen.OR = [{ branch }, { branch: null }];
        }
        const matches = await prisma.creditRadar.findMany({
          where: whereOpen,
          orderBy: { createdAt: "asc" },
        });
        let remainingToCollect = collectedAmount;
        const updatedRecords: unknown[] = [];
        for (const rec of matches) {
          if (remainingToCollect <= 0.01) break;
          const currentRem = rec.remainingAmount ?? rec.outstandingBalance;
          const applied = Math.min(currentRem, remainingToCollect);
          const nextBal = Math.max(0, Number((currentRem - applied).toFixed(2)));
          remainingToCollect = Number((remainingToCollect - applied).toFixed(2));
          const updated = await prisma.creditRadar.update({
            where: { id: rec.id },
            data: {
              outstandingBalance: nextBal,
              remainingAmount: nextBal,
              status: nextBal <= 0.01 ? "SETTLED" : rec.status,
            },
          });
          updatedRecords.push(updated);
        }
        return NextResponse.json({ ok: true, records: updatedRecords });
      }

      return NextResponse.json({ error: "Credit record not found" }, { status: 404 });
    }

    // Create a new CreditRadar receivable (Idempotent via clientTxnId or 60s signature)
    const rawBranch = body.branch;
    const branch = rawBranch && rawBranch !== "ALL" ? normalizeBranch(rawBranch) : null;
    const customerName = String(body.customerName || "").trim();
    const clientTxnId = body.clientTxnId ? String(body.clientTxnId).trim() : null;
    const amount = Math.max(0, Number(body.amount) || 0);
    const originalSaleAmount =
      body.originalSaleAmount !== undefined
        ? Math.max(0, Number(body.originalSaleAmount) || 0)
        : amount;
    const advanceReceived = Math.max(0, Number(body.advanceReceived) || 0);
    const computedRemaining =
      body.remainingAmount !== undefined
        ? Math.max(0, Number(body.remainingAmount) || 0)
        : Math.max(0, Number((originalSaleAmount - advanceReceived).toFixed(2)));
    const linkedInvoiceNum = body.linkedInvoiceNum
      ? String(body.linkedInvoiceNum).trim()
      : null;

    if (!customerName || originalSaleAmount <= 0) {
      return NextResponse.json(
        { error: "Customer name and positive amount are required" },
        { status: 400 }
      );
    }

    if (clientTxnId) {
      const existingByTxn = await prisma.creditRadar.findFirst({
        where: { clientTxnId },
      });
      if (existingByTxn) {
        return NextResponse.json({ record: existingByTxn, deduplicated: true });
      }
    }

    const sixtySecondsAgo = new Date(Date.now() - 60_000);
    const recentMatch = await prisma.creditRadar.findFirst({
      where: {
        branch,
        customerName: { equals: customerName, mode: "insensitive" },
        linkedInvoiceNum,
        amount: originalSaleAmount,
        createdAt: { gte: sixtySecondsAgo },
      },
    });
    if (recentMatch) {
      return NextResponse.json({ record: recentMatch, deduplicated: true });
    }

    const created = await prisma.creditRadar.create({
      data: {
        clientTxnId,
        branch,
        customerName,
        phone: body.phone ? String(body.phone).trim() : null,
        linkedInvoiceNum,
        invoiceNo: body.invoiceNo ? String(body.invoiceNo).trim() : linkedInvoiceNum,
        originalDate: body.originalDate || saudiTodayIso(),
        followUpDate: body.followUpDate || null,
        followUpStatus: body.followUpStatus || "SCHEDULED",
        amount: originalSaleAmount,
        originalSaleAmount,
        advanceReceived,
        remainingAmount: computedRemaining,
        outstandingBalance:
          body.outstandingBalance !== undefined
            ? Math.max(0, Number(body.outstandingBalance) || 0)
            : computedRemaining,
        status: computedRemaining <= 0.01 ? "SETTLED" : body.status || "CURRENT",
        notes: body.notes ? String(body.notes).trim() : null,
      },
    });

    return NextResponse.json({ record: created }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/credits] Error:", err);
    return NextResponse.json(
      { error: "Failed to save credit radar record" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const id = String(body.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "Record id is required" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (body.outstandingBalance !== undefined)
      data.outstandingBalance = Math.max(0, Number(body.outstandingBalance) || 0);
    if (body.status !== undefined) data.status = String(body.status);
    if (body.followUpDate !== undefined) data.followUpDate = body.followUpDate;
    if (body.followUpStatus !== undefined)
      data.followUpStatus = body.followUpStatus;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.phone !== undefined) data.phone = body.phone;

    const updated = await prisma.creditRadar.update({
      where: { id },
      data,
    });

    return NextResponse.json({ record: updated });
  } catch (err) {
    console.error("[PATCH /api/credits] Error:", err);
    return NextResponse.json(
      { error: "Failed to update credit radar record" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Record id is required" }, { status: 400 });
    }
    await prisma.creditRadar.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/credits] Error:", err);
    return NextResponse.json(
      { error: "Failed to delete credit radar record" },
      { status: 500 }
    );
  }
}
