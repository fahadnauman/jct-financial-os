import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { normalizeBranch } from "../../../lib/auth-audit";
import { deduplicateSupplierBillsWithRemoved } from "../../../lib/deduplicate-records";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawBranch = searchParams.get("branch");
    const branch = rawBranch && rawBranch !== "ALL" ? normalizeBranch(rawBranch) : null;
    const supplier = searchParams.get("supplier");

    const where: Record<string, unknown> = {};
    if (branch) {
      where.OR = [{ branch }, { branch: null }];
    }
    if (supplier) {
      where.supplier = { equals: supplier, mode: "insensitive" };
    }

    const bills = await prisma.supplierBill.findMany({
      where,
      orderBy: [{ isPaid: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    });

    const { unique, duplicateIds } = deduplicateSupplierBillsWithRemoved(bills);
    if (duplicateIds.length > 0) {
      await prisma.supplierBill
        .deleteMany({ where: { id: { in: duplicateIds } } })
        .catch(() => {});
    }

    return NextResponse.json({ bills: unique });
  } catch (err) {
    console.error("[GET /api/suppliers] Error:", err);
    return NextResponse.json(
      { error: "Failed to load supplier bills" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Two-way Settlement Engine (used by both Supplier Hub "Payment Done" and Express Quick-Log "Credit Purchase Payment")
    if (body.action === "SETTLE") {
      const rawBranch = body.branch;
      const branch = rawBranch && rawBranch !== "ALL" ? normalizeBranch(rawBranch) : null;
      const supplier = String(body.supplier || "").trim();
      const billId = body.billId ? String(body.billId) : null;
      const paymentAmount = Math.max(0, Number(body.paymentAmount) || 0);
      const paymentMode = String(body.paymentMode || "CASH").trim();
      const notes = body.notes ? String(body.notes).trim() : null;
      const autoApplyAdvance = body.autoApplyAdvance !== false;

      if (!supplier && !billId) {
        return NextResponse.json(
          { error: "Supplier or billId is required for settlement" },
          { status: 400 }
        );
      }

      // 1. Find open bills to settle (target billId first if given, then FIFO by dueDate/createdAt)
      const openBillsWhere: Record<string, unknown> = {
        isPaid: false,
        isReturned: false,
      };
      if (branch) {
        openBillsWhere.OR = [{ branch }, { branch: null }];
      }
      if (supplier) {
        openBillsWhere.supplier = { equals: supplier, mode: "insensitive" };
      }

      const candidateBills = await prisma.supplierBill.findMany({
        where: openBillsWhere,
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      });

      const orderedBills = billId
        ? [
            ...candidateBills.filter((b) => b.id === billId),
            ...candidateBills.filter((b) => b.id !== billId),
          ]
        : candidateBills;

      // 2. Auto-detect and apply active SUPPLIER_ADVANCE_OUT advances if requested
      let totalAdvanceApplied = 0;
      const adjustedAdvances: unknown[] = [];

      if (autoApplyAdvance && supplier) {
        const advWhere: Record<string, unknown> = {
          direction: "SUPPLIER_ADVANCE_OUT",
          status: "ACTIVE",
          remainingBalance: { gt: 0 },
          partyName: { equals: supplier, mode: "insensitive" },
        };
        if (branch) {
          advWhere.branch = branch;
        }

        const activeAdvances = await prisma.advanceRecord.findMany({
          where: advWhere,
          orderBy: { createdAt: "asc" },
        });

        const totalOpenRemaining = orderedBills.reduce((sum, b) => {
          const rem = b.remainingAmount ?? b.amount;
          return sum + Math.max(0, rem);
        }, 0);

        let advanceBudget = totalOpenRemaining;
        for (const adv of activeAdvances) {
          if (advanceBudget <= 0.01) break;
          const applyAmt = Math.min(adv.remainingBalance, advanceBudget);
          if (applyAmt <= 0.01) continue;

          const newUtilized = Number((adv.utilizedAmount + applyAmt).toFixed(2));
          const newRem = Math.max(
            0,
            Number((adv.totalAdvanceAmount - newUtilized).toFixed(2))
          );
          const newStatus = newRem <= 0.01 ? "ADJUSTED" : "ACTIVE";

          const updatedAdv = await prisma.advanceRecord.update({
            where: { id: adv.id },
            data: {
              utilizedAmount: newUtilized,
              remainingBalance: newRem,
              status: newStatus,
              notes: notes
                ? `${adv.notes ? adv.notes + " | " : ""}Settled: ${notes}`
                : adv.notes,
            },
          });
          adjustedAdvances.push(updatedAdv);
          totalAdvanceApplied = Number((totalAdvanceApplied + applyAmt).toFixed(2));
          advanceBudget = Number((advanceBudget - applyAmt).toFixed(2));
        }
      }

      // 3. Apply (totalAdvanceApplied + paymentAmount) across ordered open bills
      let remainingAdvanceToDistribute = totalAdvanceApplied;
      let remainingCashToDistribute = paymentAmount;
      const settledBills: unknown[] = [];

      for (const bill of orderedBills) {
        if (
          remainingAdvanceToDistribute <= 0.01 &&
          remainingCashToDistribute <= 0.01
        ) {
          break;
        }
        const currentRem = Math.max(0, bill.remainingAmount ?? bill.amount);
        if (currentRem <= 0.01) continue;

        let billRem = currentRem;
        let advUsedOnBill = 0;

        if (remainingAdvanceToDistribute > 0.01) {
          advUsedOnBill = Math.min(billRem, remainingAdvanceToDistribute);
          billRem = Number((billRem - advUsedOnBill).toFixed(2));
          remainingAdvanceToDistribute = Number(
            (remainingAdvanceToDistribute - advUsedOnBill).toFixed(2)
          );
        }

        let cashUsedOnBill = 0;
        if (billRem > 0.01 && remainingCashToDistribute > 0.01) {
          cashUsedOnBill = Math.min(billRem, remainingCashToDistribute);
          billRem = Number((billRem - cashUsedOnBill).toFixed(2));
          remainingCashToDistribute = Number(
            (remainingCashToDistribute - cashUsedOnBill).toFixed(2)
          );
        }

        const isNowPaid = billRem <= 0.01;
        const newAdvancePaid = Number(
          ((bill.advancePaid || 0) + advUsedOnBill).toFixed(2)
        );
        const updatedBill = await prisma.supplierBill.update({
          where: { id: bill.id },
          data: {
            branch: bill.branch || branch || undefined,
            originalAmount: bill.originalAmount ?? bill.amount,
            advancePaid: newAdvancePaid,
            remainingAmount: isNowPaid ? 0 : billRem,
            isPaid: isNowPaid,
            status: isNowPaid ? "PAID" : "PARTIALLY_PAID",
            paymentMode,
            paidAt: isNowPaid ? new Date() : bill.paidAt,
            notes: notes
              ? `${bill.notes ? bill.notes + " | " : ""}${notes}`
              : bill.notes,
          },
        });
        settledBills.push(updatedBill);
      }

      return NextResponse.json({
        ok: true,
        settledBills,
        adjustedAdvances,
        totalCashBankPaid: paymentAmount,
        totalAdvanceApplied,
        totalSettled: Number((paymentAmount + totalAdvanceApplied).toFixed(2)),
      });
    }

    // Standard Create Credit Purchase / Supplier Bill (Idempotent via clientTxnId or 60s signature)
    const rawBranch = body.branch;
    const branch = rawBranch && rawBranch !== "ALL" ? normalizeBranch(rawBranch) : null;
    const supplier = String(body.supplier || "").trim();
    const invoiceNo = String(body.invoiceNo || `CP-${Date.now()}`).trim();
    const clientTxnId = body.clientTxnId ? String(body.clientTxnId).trim() : null;
    const amount = Math.max(0, Number(body.amount) || 0);

    if (!supplier || amount <= 0) {
      return NextResponse.json(
        { error: "Supplier name and positive amount are required" },
        { status: 400 }
      );
    }

    if (clientTxnId) {
      const existingByTxn = await prisma.supplierBill.findFirst({
        where: { clientTxnId },
      });
      if (existingByTxn) {
        return NextResponse.json({ bill: existingByTxn, deduplicated: true });
      }
    }

    const sixtySecondsAgo = new Date(Date.now() - 60_000);
    const recentMatch = await prisma.supplierBill.findFirst({
      where: {
        branch,
        supplier: { equals: supplier, mode: "insensitive" },
        invoiceNo,
        amount,
        createdAt: { gte: sixtySecondsAgo },
      },
    });
    if (recentMatch) {
      return NextResponse.json({ bill: recentMatch, deduplicated: true });
    }

    const dueDate = body.dueDate
      ? new Date(body.dueDate)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const created = await prisma.supplierBill.create({
      data: {
        clientTxnId,
        branch,
        supplier,
        invoiceNo,
        supplierInvoiceNum: body.supplierInvoiceNum || invoiceNo,
        billPdfUrl: body.billPdfUrl || null,
        receiptUrl: body.receiptUrl || null,
        amount,
        originalAmount: Number(body.originalAmount) || amount,
        advancePaid: Number(body.advancePaid) || 0,
        remainingAmount:
          body.remainingAmount !== undefined
            ? Number(body.remainingAmount)
            : amount,
        status: body.isPaid ? "PAID" : "UNPAID",
        notes: body.notes || null,
        isReturned: Boolean(body.isReturned),
        dueDate: isNaN(dueDate.getTime()) ? new Date() : dueDate,
        followUpDate: body.followUpDate || null,
        followUpStatus: body.followUpStatus || "SCHEDULED",
        isPaid: Boolean(body.isPaid),
        paymentMode: body.paymentMode || null,
      },
    });

    return NextResponse.json({ bill: created }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/suppliers] Error:", err);
    return NextResponse.json(
      { error: "Failed to save supplier bill" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const id = String(body.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "Bill id is required" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (body.isPaid !== undefined) {
      data.isPaid = Boolean(body.isPaid);
      if (data.isPaid) {
        data.status = "PAID";
        data.remainingAmount = 0;
        data.paidAt = new Date();
      }
    }
    if (body.status !== undefined) data.status = String(body.status);
    if (body.remainingAmount !== undefined)
      data.remainingAmount = Math.max(0, Number(body.remainingAmount) || 0);
    if (body.advancePaid !== undefined)
      data.advancePaid = Math.max(0, Number(body.advancePaid) || 0);
    if (body.paymentMode !== undefined) data.paymentMode = body.paymentMode;
    if (body.isReturned !== undefined) data.isReturned = Boolean(body.isReturned);
    if (body.followUpDate !== undefined) data.followUpDate = body.followUpDate;
    if (body.followUpStatus !== undefined)
      data.followUpStatus = body.followUpStatus;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.receiptUrl !== undefined) data.receiptUrl = body.receiptUrl;

    const updated = await prisma.supplierBill.update({
      where: { id },
      data,
    });

    return NextResponse.json({ bill: updated });
  } catch (err) {
    console.error("[PATCH /api/suppliers] Error:", err);
    return NextResponse.json(
      { error: "Failed to update supplier bill" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Bill id is required" }, { status: 400 });
    }
    await prisma.supplierBill.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/suppliers] Error:", err);
    return NextResponse.json(
      { error: "Failed to delete supplier bill" },
      { status: 500 }
    );
  }
}
