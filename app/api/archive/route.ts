import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { checkIsOwner, normalizeBranch, normalizePaymentMode } from "../../../lib/auth-audit";

export const dynamic = "force-dynamic";

// Default historical seed records if Neon DB has no past locks yet
const SEED_LOCKS = [
  {
    branch: "JCT_HQ",
    date: "11-09-2026",
    closingCash: 41180,
    openingCash: 2500,
    inflows: 39800,
    bankSwipes: 14500,
    outflows: 1120,
    posFees: 116.0,
    madaFees: 90.0,
    ccFees: 26.0,
    lockedBy: "JCT_HQ",
    status: "AUDITED",
    lockedAt: new Date("2026-09-11T22:14:00Z"),
    dataJson: JSON.stringify({
      notes: "Audited closing drawer balance - match with cash drawer physical count",
      expenses: [
        { id: "e-seed-1", title: "Shop Cleaning & Supplies", amount: 120, time: "11:20", expenseCategory: "Shop Maintenance" },
        { id: "e-seed-2", title: "Delivery Fuel - Jubail Route", amount: 450, time: "14:10", expenseCategory: "Fuel / Vehicle" },
        { id: "e-seed-3", title: "Staff Lunch Refreshments", amount: 550, time: "13:30", expenseCategory: "Food" },
      ],
      inflows: [
        { id: "i-seed-1", title: "Cash Sale - Fenomastic Matt", amount: 18400, customer: "Walk-in Contractors", time: "10:15" },
        { id: "i-seed-2", title: "Credit Recd - Chicago Maint.", amount: 21400, customer: "Chicago Maintenance Est", time: "16:45" },
      ],
      bankSwipes: [
        { invoiceNo: "30050", amount: 5400, paymentMode: "POS_SWIPE", posTerminal: "SAB", time: "11:00" },
        { invoiceNo: "30052", amount: 4800, paymentMode: "POS_SWIPE", posTerminal: "AL_RAJHI", time: "14:30" },
        { invoiceNo: "30055", amount: 4300, paymentMode: "BANK_TRANSFER", time: "16:15" },
      ],
    }),
  },
  {
    branch: "JCT_HQ",
    date: "10-09-2026",
    closingCash: 38940,
    openingCash: 2400,
    inflows: 37400,
    bankSwipes: 11200,
    outflows: 860,
    posFees: 89.6,
    madaFees: 72.0,
    ccFees: 17.6,
    lockedBy: "JCT_HQ",
    status: "LOCKED",
    lockedAt: new Date("2026-09-10T22:05:00Z"),
    dataJson: JSON.stringify({
      notes: "Standard Thursday closing count verified",
      expenses: [
        { id: "e-seed-4", title: "Forklift Hydraulic Fluid", amount: 360, time: "12:15", expenseCategory: "Shop Maintenance" },
        { id: "e-seed-5", title: "Branch Drinking Water 5 Gallons", amount: 100, time: "09:30", expenseCategory: "Water" },
        { id: "e-seed-6", title: "Emergency Courier Freight", amount: 400, time: "15:40", expenseCategory: "Freight" },
      ],
      inflows: [
        { id: "i-seed-3", title: "Cash Sale - Jotashield Clean", amount: 22400, customer: "Retail & Contractors", time: "11:30" },
        { id: "i-seed-4", title: "Credit Recd - Al-Bilad", amount: 15000, customer: "Al-Bilad Contracting", time: "17:00" },
      ],
      bankSwipes: [
        { invoiceNo: "30041", amount: 6200, paymentMode: "POS_SWIPE", posTerminal: "SAB", time: "10:30" },
        { invoiceNo: "30044", amount: 5000, paymentMode: "POS_SWIPE", posTerminal: "AL_RAJHI", time: "15:10" },
      ],
    }),
  },
  {
    branch: "HEMPEL_JUBAIL",
    date: "11-09-2026",
    closingCash: 29500,
    openingCash: 1800,
    inflows: 28200,
    bankSwipes: 9400,
    outflows: 500,
    posFees: 75.2,
    madaFees: 60.0,
    ccFees: 15.2,
    lockedBy: "HEMPEL_JUBAIL",
    status: "AUDITED",
    lockedAt: new Date("2026-09-11T21:45:00Z"),
    dataJson: JSON.stringify({
      notes: "Hempel Jubail daily register closed without discrepancy",
      expenses: [
        { id: "e-seed-7", title: "Store Packing Tape & Rolls", amount: 150, time: "13:00", expenseCategory: "Shop Maintenance" },
        { id: "e-seed-8", title: "Van Fuel", amount: 350, time: "16:20", expenseCategory: "Fuel / Vehicle" },
      ],
      inflows: [
        { id: "i-seed-5", title: "Cash Sale - Hempadur Primer", amount: 28200, customer: "Eastern Marine Supply", time: "11:00" },
      ],
      bankSwipes: [
        { invoiceNo: "H-8812", amount: 9400, paymentMode: "POS_SWIPE", posTerminal: "SAB", time: "14:00" },
      ],
    }),
  },
  {
    branch: "JOTUN_DAMMAM",
    date: "11-09-2026",
    closingCash: 34200,
    openingCash: 2000,
    inflows: 33100,
    bankSwipes: 12800,
    outflows: 900,
    posFees: 102.4,
    madaFees: 85.0,
    ccFees: 17.4,
    lockedBy: "JOTUN_DAMMAM",
    status: "AUDITED",
    lockedAt: new Date("2026-09-11T22:02:00Z"),
    dataJson: JSON.stringify({
      notes: "Dammam Jotun store closing audited by Branch Manager",
      expenses: [
        { id: "e-seed-9", title: "Local Freight Dammam Port", amount: 600, time: "10:45", expenseCategory: "Freight" },
        { id: "e-seed-10", title: "Tinting Machine Calibration", amount: 300, time: "14:15", expenseCategory: "Shop Maintenance" },
      ],
      inflows: [
        { id: "i-seed-6", title: "Jotun Paints Retail & Wholesale", amount: 33100, customer: "Dammam Residential Painters", time: "12:00" },
      ],
      bankSwipes: [
        { invoiceNo: "JD-4011", amount: 7200, paymentMode: "POS_SWIPE", posTerminal: "SAB", time: "11:30" },
        { invoiceNo: "JD-4015", amount: 5600, paymentMode: "POS_SWIPE", posTerminal: "AL_RAJHI", time: "15:45" },
      ],
    }),
  },
  {
    branch: "SIGMA_JUBAIL",
    date: "10-09-2026",
    closingCash: 21600,
    openingCash: 1500,
    inflows: 20800,
    bankSwipes: 7100,
    outflows: 700,
    posFees: 56.8,
    madaFees: 45.0,
    ccFees: 11.8,
    lockedBy: "SIGMA_JUBAIL",
    status: "LOCKED",
    lockedAt: new Date("2026-09-10T21:30:00Z"),
    dataJson: JSON.stringify({
      notes: "Sigma franchise register locked",
      expenses: [
        { id: "e-seed-11", title: "Delivery Diesel", amount: 400, time: "11:00", expenseCategory: "Fuel / Vehicle" },
        { id: "e-seed-12", title: "Tea & Water Supply", amount: 300, time: "13:30", expenseCategory: "Food" },
      ],
      inflows: [
        { id: "i-seed-7", title: "Sigma Protective Coatings", amount: 20800, customer: "Royal Commission Subcontractors", time: "12:30" },
      ],
      bankSwipes: [
        { invoiceNo: "SG-209", amount: 7100, paymentMode: "POS_SWIPE", posTerminal: "SAB", time: "13:00" },
      ],
    }),
  },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawBranch = searchParams.get("branch") || searchParams.get("branchId");
  const branch = rawBranch && rawBranch !== "ALL" ? normalizeBranch(rawBranch) : rawBranch;

  try {
    // Check if table has rows, if completely empty, seed initial historical locks
    const count = await prisma.dailyRegisterLock.count();
    if (count === 0) {
      for (const s of SEED_LOCKS) {
        await prisma.dailyRegisterLock.create({
          data: s,
        });
      }
    }

    const rows = await prisma.dailyRegisterLock.findMany({
      where: {
        ...(branch && branch !== "ALL" ? { branch } : {}),
      },
      orderBy: { lockedAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ records: rows });
  } catch (err) {
    console.error("GET /api/archive error:", err);
    // If database unavailable, return seed locks filtered
    const filtered = branch && branch !== "ALL" ? SEED_LOCKS.filter((s) => s.branch === branch) : SEED_LOCKS;
    return NextResponse.json({ records: filtered });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawBranch = body.branch || body.branchId || req.headers.get("x-branch-id");
    const branch = rawBranch ? normalizeBranch(rawBranch) : null;

    const {
      date,
      closingCash,
      openingCash = 2634,
      inflows = 0,
      bankSwipes = 0,
      outflows = 0,
      posFees = 0,
      madaFees = 0,
      ccFees = 0,
      lockedBy = "Staff",
      status = "LOCKED",
      dataJson,
      takeHomeAmount: rawTakeHome,
      nextDayOpeningCash: rawNextDayOpening,
    } = body;

    const takeHomeAmount =
      rawTakeHome !== undefined && rawTakeHome !== null ? Number(rawTakeHome) : null;
    const nextDayOpeningCash =
      rawNextDayOpening !== undefined && rawNextDayOpening !== null ? Number(rawNextDayOpening) : null;

    if (!branch || !date) {
      return NextResponse.json({ error: "Branch and date are required" }, { status: 400 });
    }

    let sanitizedDataJson = dataJson ? String(dataJson) : null;
    if (sanitizedDataJson) {
      try {
        const parsed = JSON.parse(sanitizedDataJson);
        if (Array.isArray(parsed.bankSwipes)) {
          parsed.bankSwipes = parsed.bankSwipes.map((s: Record<string, unknown>) => ({
            ...s,
            paymentMode: normalizePaymentMode(s.paymentMode, "POS_SWIPE"),
          }));
        }
        if (Array.isArray(parsed.inflows)) {
          parsed.inflows = parsed.inflows.map((i: Record<string, unknown>) => ({
            ...i,
            paymentMode: normalizePaymentMode(i.paymentMode, "CASH"),
          }));
        }
        if (Array.isArray(parsed.expenses)) {
          parsed.expenses = parsed.expenses.map((e: Record<string, unknown>) => ({
            ...e,
            paymentMode: normalizePaymentMode(e.paymentMode, "CASH"),
          }));
        }
        sanitizedDataJson = JSON.stringify(parsed);
      } catch {
        // preserve original string if parse fails
      }
    }

    // Upsert lock record
    const existing = await prisma.dailyRegisterLock.findFirst({
      where: { branch, date },
    });

    let saved;
    if (existing) {
      saved = await prisma.dailyRegisterLock.update({
        where: { id: existing.id },
        data: {
          closingCash: Number(closingCash),
          openingCash: Number(openingCash),
          takeHomeAmount: takeHomeAmount !== null ? Number(takeHomeAmount) : null,
          nextDayOpeningCash: nextDayOpeningCash !== null ? Number(nextDayOpeningCash) : null,
          inflows: Number(inflows),
          bankSwipes: Number(bankSwipes),
          outflows: Number(outflows),
          posFees: Number(posFees),
          madaFees: Number(madaFees),
          ccFees: Number(ccFees),
          lockedBy: String(lockedBy),
          status: String(status),
          dataJson: sanitizedDataJson !== null ? sanitizedDataJson : existing.dataJson,
          lockedAt: new Date(),
        },
      });
    } else {
      saved = await prisma.dailyRegisterLock.create({
        data: {
          branch: String(branch),
          date: String(date),
          closingCash: Number(closingCash),
          openingCash: Number(openingCash),
          takeHomeAmount: takeHomeAmount !== null ? Number(takeHomeAmount) : null,
          nextDayOpeningCash: nextDayOpeningCash !== null ? Number(nextDayOpeningCash) : null,
          inflows: Number(inflows),
          bankSwipes: Number(bankSwipes),
          outflows: Number(outflows),
          posFees: Number(posFees),
          madaFees: Number(madaFees),
          ccFees: Number(ccFees),
          lockedBy: String(lockedBy),
          status: String(status),
          dataJson: sanitizedDataJson,
        },
      });
    }

    return NextResponse.json({ record: saved }, { status: 200 });
  } catch (err) {
    console.error("POST /api/archive error:", err);
    return NextResponse.json({ error: "Failed to save archive record" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    if (!checkIsOwner(req, body)) {
      return NextResponse.json({ error: "Owner authorization required to update historical audit records" }, { status: 403 });
    }

    const { id, closingCash, openingCash, inflows, bankSwipes, outflows, posFees, madaFees, ccFees, status, dataJson } = body;

    if (!id) {
      return NextResponse.json({ error: "Record ID required" }, { status: 400 });
    }

    let sanitizedDataJson = dataJson !== undefined ? String(dataJson) : undefined;
    if (sanitizedDataJson) {
      try {
        const parsed = JSON.parse(sanitizedDataJson);
        if (Array.isArray(parsed.bankSwipes)) {
          parsed.bankSwipes = parsed.bankSwipes.map((s: Record<string, unknown>) => ({
            ...s,
            paymentMode: normalizePaymentMode(s.paymentMode, "POS_SWIPE"),
          }));
        }
        if (Array.isArray(parsed.inflows)) {
          parsed.inflows = parsed.inflows.map((i: Record<string, unknown>) => ({
            ...i,
            paymentMode: normalizePaymentMode(i.paymentMode, "CASH"),
          }));
        }
        if (Array.isArray(parsed.expenses)) {
          parsed.expenses = parsed.expenses.map((e: Record<string, unknown>) => ({
            ...e,
            paymentMode: normalizePaymentMode(e.paymentMode, "CASH"),
          }));
        }
        sanitizedDataJson = JSON.stringify(parsed);
      } catch {
        // preserve original
      }
    }

    const updated = await prisma.dailyRegisterLock.update({
      where: { id: String(id) },
      data: {
        ...(closingCash !== undefined ? { closingCash: Number(closingCash) } : {}),
        ...(openingCash !== undefined ? { openingCash: Number(openingCash) } : {}),
        ...(inflows !== undefined ? { inflows: Number(inflows) } : {}),
        ...(bankSwipes !== undefined ? { bankSwipes: Number(bankSwipes) } : {}),
        ...(outflows !== undefined ? { outflows: Number(outflows) } : {}),
        ...(posFees !== undefined ? { posFees: Number(posFees) } : {}),
        ...(madaFees !== undefined ? { madaFees: Number(madaFees) } : {}),
        ...(ccFees !== undefined ? { ccFees: Number(ccFees) } : {}),
        ...(status ? { status: String(status) } : {}),
        ...(sanitizedDataJson !== undefined ? { dataJson: sanitizedDataJson } : {}),
      },
    });

    return NextResponse.json({ record: updated });
  } catch (err) {
    console.error("PUT /api/archive error:", err);
    return NextResponse.json({ error: "Failed to update archive record" }, { status: 500 });
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
    return NextResponse.json({ error: "Owner authorization required to delete archive records" }, { status: 403 });
  }

  if (!id) {
    return NextResponse.json({ error: "Record ID is required" }, { status: 400 });
  }

  try {
    await prisma.dailyRegisterLock.delete({
      where: { id: String(id) },
    });
    return NextResponse.json({ deleted: true, id });
  } catch (err) {
    console.error("DELETE /api/archive error:", err);
    return NextResponse.json({ error: "Failed to delete archive record" }, { status: 500 });
  }
}
