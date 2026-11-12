import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

export interface InvoiceSearchResult {
  id: string;
  source: "INVOICE" | "ARCHIVE_SESSION" | "SUPPLIER_BILL" | "POCKET" | "PURCHASE" | "EXPENSE" | "CREDIT_RADAR";
  invoiceNo: string;
  branchInvNo: string;
  date: string;
  partyName: string;
  partyType: "CUSTOMER" | "SUPPLIER" | "OTHER";
  amount: number;
  originalAmount?: number;
  paymentMode: string;
  isReturned: boolean;
  branch?: string;
  description?: string;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const branch = searchParams.get("branch");

  if (!q && !branch) {
    return NextResponse.json({ results: [] });
  }

  const results: InvoiceSearchResult[] = [];
  const seenKeys = new Set<string>();

  const addResult = (res: InvoiceSearchResult) => {
    const key = `${res.invoiceNo}|${res.branchInvNo}|${res.date}|${res.amount}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      results.push(res);
    }
  };

  try {
    const queryTerm = q.toLowerCase();

    // 1. Query Invoice table
    const invoices = await prisma.invoice.findMany({
      where: {
        OR: [
          { invoiceNo: { contains: q, mode: "insensitive" } },
          { customer: { contains: q, mode: "insensitive" } },
        ],
        ...(branch && branch !== "ALL" ? { branch } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    for (const inv of invoices) {
      addResult({
        id: inv.id,
        source: "INVOICE",
        invoiceNo: inv.invoiceNo,
        branchInvNo: inv.invoiceNo,
        date: inv.date || inv.createdAt.toISOString().slice(0, 10),
        partyName: inv.customer || "Walk-in Customer",
        partyType: "CUSTOMER",
        amount: inv.amount,
        originalAmount: inv.originalAmount || inv.amount,
        paymentMode: inv.paymentMode || "CASH",
        isReturned: Boolean(inv.isReturned),
        branch: inv.branch || undefined,
      });
    }

    // 2. Query SupplierBill table
    const bills = await prisma.supplierBill.findMany({
      where: {
        OR: [
          { invoiceNo: { contains: q, mode: "insensitive" } },
          { supplierInvoiceNum: { contains: q, mode: "insensitive" } },
          { supplier: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    for (const b of bills) {
      addResult({
        id: b.id,
        source: "SUPPLIER_BILL",
        invoiceNo: b.invoiceNo,
        branchInvNo: b.supplierInvoiceNum || b.invoiceNo,
        date: b.dueDate.toISOString().slice(0, 10),
        partyName: b.supplier,
        partyType: "SUPPLIER",
        amount: b.amount,
        originalAmount: b.originalAmount || b.amount,
        paymentMode: b.paymentMode || "CREDIT",
        isReturned: Boolean(b.isReturned),
      });
    }

    // 3. Query PocketTransaction table (for POS, expenses, credit collections)
    const pocketTxns = await prisma.pocketTransaction.findMany({
      where: {
        OR: [
          { supplierInvoiceNum: { contains: q, mode: "insensitive" } },
          { note: { contains: q, mode: "insensitive" } },
          { category: { contains: q, mode: "insensitive" } },
          { recipientName: { contains: q, mode: "insensitive" } },
        ],
        ...(branch && branch !== "ALL" ? { branch } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    for (const pt of pocketTxns) {
      const invRef = pt.supplierInvoiceNum || `PK-${pt.id.slice(-6).toUpperCase()}`;
      addResult({
        id: pt.id,
        source: "POCKET",
        invoiceNo: invRef,
        branchInvNo: invRef,
        date: pt.date,
        partyName: pt.recipientName || pt.category || "Pocket Entry",
        partyType: pt.type === "PURCHASE" || pt.type === "SUPPLIER_ADVANCE" ? "SUPPLIER" : "CUSTOMER",
        amount: pt.amount,
        originalAmount: pt.originalAmount || pt.amount,
        paymentMode: pt.paymentMode || "CASH",
        isReturned: Boolean(pt.isReturned),
        branch: pt.branch,
        description: pt.note || undefined,
      });
    }

    // 4. Query DailyRegisterLock dataJson archives (searches embedded invoice arrays from closed days)
    const archives = await prisma.dailyRegisterLock.findMany({
      where: {
        ...(branch && branch !== "ALL" ? { branch } : {}),
        dataJson: { not: null },
      },
      orderBy: { lockedAt: "desc" },
      take: 30,
    });

    for (const arch of archives) {
      if (!arch.dataJson) continue;
      try {
        const parsed = JSON.parse(arch.dataJson);
        const erpInvoices = Array.isArray(parsed?.erpInvoices) ? parsed.erpInvoices : [];
        for (const inv of erpInvoices) {
          const invNo = String(inv.invoiceNo || "").toLowerCase();
          const branchInv = String(inv.branchInvNo || "").toLowerCase();
          const cust = String(inv.customer || inv.customerName || "").toLowerCase();
          if (
            invNo.includes(queryTerm) ||
            branchInv.includes(queryTerm) ||
            cust.includes(queryTerm)
          ) {
            addResult({
              id: `arch-${arch.id}-${inv.invoiceNo || inv.branchInvNo}`,
              source: "ARCHIVE_SESSION",
              invoiceNo: inv.invoiceNo || inv.branchInvNo,
              branchInvNo: inv.branchInvNo || inv.invoiceNo,
              date: arch.date,
              partyName: inv.customer || inv.customerName || "Customer",
              partyType: "CUSTOMER",
              amount: Number(inv.amount) || 0,
              originalAmount: Number(inv.originalAmount ?? inv.amount) || 0,
              paymentMode: inv.paymentMode || "CASH",
              isReturned: Boolean(inv.isReturned),
              branch: arch.branch,
            });
          }
        }
      } catch {
        // ignore parse error on corrupted json
      }
    }

    return NextResponse.json({ results: results.slice(0, 100) });
  } catch (err) {
    console.error("GET /api/invoices/search error:", err);
    return NextResponse.json({ error: "Failed to search invoices", results: [] }, { status: 500 });
  }
}
