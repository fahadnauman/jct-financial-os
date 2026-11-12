import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Normalizes party names for consistent indexing and deduplication.
 */
function normalizePartyName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/**
 * Helper to bootstrap initial parties if PartyDirectory is empty.
 */
async function autoBootstrapPartiesIfNeeded() {
  const count = await prisma.partyDirectory.count();
  if (count > 0) return;

  const recordsToInsert = new Map<string, {
    name: string;
    partyType: "SUPPLIER" | "CUSTOMER" | "CREDITOR" | "BOTH";
    branch?: string;
    phone?: string;
    lastAmount?: number;
    lastInvoiceNo?: string;
  }>();

  try {
    // 1. Harvest from CreditCustomer
    const custs = await prisma.creditCustomer.findMany({ take: 200 });
    for (const c of custs) {
      const norm = normalizePartyName(c.name);
      if (!norm) continue;
      recordsToInsert.set(`${norm}|CUSTOMER`, {
        name: norm,
        partyType: "CUSTOMER",
        phone: c.phone || undefined,
        lastAmount: c.outstandingBalance || c.totalDue || undefined,
        lastInvoiceNo: c.linkedInvoiceNum || undefined,
      });
    }

    // 2. Harvest from CreditRadar
    const radars = await prisma.creditRadar.findMany({ take: 200 });
    for (const r of radars) {
      const norm = normalizePartyName(r.customerName);
      if (!norm) continue;
      const key = `${norm}|CUSTOMER`;
      if (!recordsToInsert.has(key)) {
        recordsToInsert.set(key, {
          name: norm,
          partyType: "CUSTOMER",
          lastAmount: r.outstandingBalance || r.amount || undefined,
          lastInvoiceNo: r.invoiceNo || r.linkedInvoiceNum || undefined,
        });
      }
    }

    // 3. Harvest from SupplierBill
    const bills = await prisma.supplierBill.findMany({ take: 200 });
    for (const b of bills) {
      const norm = normalizePartyName(b.supplier);
      if (!norm) continue;
      const key = `${norm}|SUPPLIER`;
      recordsToInsert.set(key, {
        name: norm,
        partyType: "SUPPLIER",
        lastAmount: b.amount,
        lastInvoiceNo: b.supplierInvoiceNum || b.invoiceNo || undefined,
      });
    }

    // 4. Harvest from Purchase
    const purchases = await prisma.purchase.findMany({ take: 200 });
    for (const p of purchases) {
      const norm = normalizePartyName(p.supplier);
      if (!norm) continue;
      const key = `${norm}|SUPPLIER`;
      if (!recordsToInsert.has(key)) {
        recordsToInsert.set(key, {
          name: norm,
          partyType: "SUPPLIER",
          branch: p.branch,
          lastAmount: p.amount,
          lastInvoiceNo: p.supplierInvoiceNum || undefined,
        });
      }
    }

    // 5. Harvest from AdvanceRecord
    const advances = await prisma.advanceRecord.findMany({ take: 200 });
    for (const a of advances) {
      const norm = normalizePartyName(a.partyName);
      if (!norm) continue;
      const pType = a.direction === "CUSTOMER_ADVANCE_IN" ? "CUSTOMER" : "SUPPLIER";
      const key = `${norm}|${pType}`;
      if (!recordsToInsert.has(key)) {
        recordsToInsert.set(key, {
          name: norm,
          partyType: pType,
          branch: a.branch,
          phone: a.phoneOrRef || undefined,
          lastAmount: a.totalAdvanceAmount,
          lastInvoiceNo: a.branchInvNo || undefined,
        });
      }
    }

    // Upsert in batches
    for (const item of Array.from(recordsToInsert.values())) {
      await prisma.partyDirectory.upsert({
        where: {
          name_partyType: {
            name: item.name,
            partyType: item.partyType,
          },
        },
        update: {
          phone: item.phone,
          lastAmount: item.lastAmount,
          lastInvoiceNo: item.lastInvoiceNo,
        },
        create: {
          name: item.name,
          partyType: item.partyType,
          branch: item.branch || "ALL",
          phone: item.phone,
          lastAmount: item.lastAmount,
          lastInvoiceNo: item.lastInvoiceNo,
        },
      });
    }
  } catch (err) {
    console.error("Auto bootstrap party directory error (ignored):", err);
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const partyType = searchParams.get("type"); // "SUPPLIER" | "CUSTOMER" | "CREDITOR" | "BOTH"
  const branch = searchParams.get("branch");

  try {
    await autoBootstrapPartiesIfNeeded();

    const whereClause: Record<string, unknown> = {};
    if (q) {
      whereClause.name = { contains: q, mode: "insensitive" };
    }
    if (partyType && partyType !== "ALL") {
      if (partyType === "SUPPLIER") {
        whereClause.partyType = { in: ["SUPPLIER", "BOTH"] };
      } else if (partyType === "CUSTOMER") {
        whereClause.partyType = { in: ["CUSTOMER", "BOTH"] };
      } else {
        whereClause.partyType = partyType;
      }
    }
    if (branch && branch !== "ALL") {
      whereClause.OR = [
        { branch },
        { branch: "ALL" },
        { branch: null },
      ];
    }

    const parties = await prisma.partyDirectory.findMany({
      where: whereClause,
      orderBy: { updatedAt: "desc" },
      take: 150,
    });

    return NextResponse.json({ parties });
  } catch (err) {
    console.error("GET /api/parties error:", err);
    return NextResponse.json({ error: "Failed to fetch party directory", parties: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawList = Array.isArray(body.parties)
      ? body.parties
      : body.name
      ? [body]
      : [];

    if (rawList.length === 0) {
      return NextResponse.json({ error: "No parties provided" }, { status: 400 });
    }

    const saved = [];
    for (const item of rawList) {
      const name = normalizePartyName(String(item.name || ""));
      if (!name) continue;
      const partyType: "SUPPLIER" | "CUSTOMER" | "CREDITOR" | "BOTH" =
        item.partyType === "SUPPLIER" ||
        item.partyType === "CUSTOMER" ||
        item.partyType === "CREDITOR" ||
        item.partyType === "BOTH"
          ? item.partyType
          : "CUSTOMER";

      const branch = typeof item.branch === "string" ? item.branch : "ALL";
      const phone = typeof item.phone === "string" ? item.phone : null;
      const lastAmount = typeof item.lastAmount === "number" ? item.lastAmount : null;
      const lastInvoiceNo = typeof item.lastInvoiceNo === "string" ? item.lastInvoiceNo : null;

      const row = await prisma.partyDirectory.upsert({
        where: {
          name_partyType: {
            name,
            partyType,
          },
        },
        update: {
          branch: branch !== "ALL" ? branch : undefined,
          phone: phone || undefined,
          lastAmount: lastAmount !== null ? lastAmount : undefined,
          lastInvoiceNo: lastInvoiceNo || undefined,
        },
        create: {
          name,
          partyType,
          branch,
          phone,
          lastAmount,
          lastInvoiceNo,
        },
      });
      saved.push(row);
    }

    return NextResponse.json({ success: true, count: saved.length, parties: saved });
  } catch (err) {
    console.error("POST /api/parties error:", err);
    return NextResponse.json({ error: "Failed to save party" }, { status: 500 });
  }
}
