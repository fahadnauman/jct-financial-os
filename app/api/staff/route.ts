import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const branch = searchParams.get("branch");
  const includeArchived = searchParams.get("includeArchived") === "true";

  try {
    const staffList = await prisma.staff.findMany({
      where: {
        ...(includeArchived ? {} : { status: "ACTIVE" }),
        ...(branch && branch !== "ALL" ? { branch } : {}),
      },
      include: {
        payrollLogs: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ staff: staffList });
  } catch (err) {
    console.error("GET /api/staff failed", err);
    return NextResponse.json({ error: "Failed to fetch staff" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const branch = typeof body.branch === "string" ? body.branch.trim() : "";
  const role = typeof body.role === "string" ? body.role.trim() : null;
  const baseSalary = typeof body.baseSalary === "number" ? body.baseSalary : Number(body.baseSalary) || 0;
  const phone = typeof body.phone === "string" ? body.phone.trim() : null;
  const iqamaNumber = typeof body.iqamaNumber === "string" ? body.iqamaNumber.trim() : null;

  if (!name || !branch) {
    return NextResponse.json({ error: "Name and Branch are required" }, { status: 400 });
  }

  try {
    const newStaff = await prisma.staff.create({
      data: {
        name,
        branch,
        role,
        baseSalary: Math.max(0, baseSalary),
        phone,
        iqamaNumber,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({ staff: newStaff }, { status: 201 });
  } catch (err) {
    console.error("POST /api/staff failed", err);
    return NextResponse.json({ error: "Failed to create staff member" }, { status: 500 });
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
    return NextResponse.json({ error: "Staff ID is required" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) updateData.name = body.name.trim();
  if (typeof body.branch === "string" && body.branch.trim()) updateData.branch = body.branch.trim();
  if (body.role !== undefined) updateData.role = typeof body.role === "string" && body.role.trim() ? body.role.trim() : null;
  if (body.baseSalary !== undefined) updateData.baseSalary = Math.max(0, Number(body.baseSalary) || 0);
  if (body.phone !== undefined) updateData.phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  if (body.iqamaNumber !== undefined) updateData.iqamaNumber = typeof body.iqamaNumber === "string" && body.iqamaNumber.trim() ? body.iqamaNumber.trim() : null;
  if (typeof body.status === "string" && ["ACTIVE", "ARCHIVED"].includes(body.status.trim())) {
    updateData.status = body.status.trim();
  }

  try {
    const updated = await prisma.staff.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ staff: updated });
  } catch (err) {
    console.error("PUT /api/staff failed", err);
    return NextResponse.json({ error: "Failed to update staff member" }, { status: 500 });
  }
}
