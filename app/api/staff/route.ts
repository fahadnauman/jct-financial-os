import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { checkIsOwner, normalizeBranch } from "../../../lib/auth-audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawBranch = searchParams.get("branch") || searchParams.get("branchId");
  const branch = rawBranch && rawBranch !== "ALL" ? normalizeBranch(rawBranch) : rawBranch;
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

  if (!checkIsOwner(req, body)) {
    return NextResponse.json({ error: "Owner authorization required to create staff members" }, { status: 403 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const rawBranch = body.branch || body.branchId || req.headers.get("x-branch-id");
  const branch = normalizeBranch(rawBranch);
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

  // Modifying salary or editing core staff profile requires Owner privileges
  if (body.baseSalary !== undefined && !checkIsOwner(req, body)) {
    return NextResponse.json({ error: "Owner authorization required to adjust base salary" }, { status: 403 });
  }

  const updateData: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) updateData.name = body.name.trim();
  if (body.branch || body.branchId) updateData.branch = normalizeBranch(body.branch || body.branchId);
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
    return NextResponse.json({ error: "Owner authorization required to delete staff records" }, { status: 403 });
  }

  if (!id) {
    return NextResponse.json({ error: "Staff ID is required" }, { status: 400 });
  }

  try {
    await prisma.staff.delete({ where: { id } });
    return NextResponse.json({ deleted: true, id });
  } catch (err) {
    console.error("DELETE /api/staff failed", err);
    return NextResponse.json({ error: "Failed to delete staff member" }, { status: 500 });
  }
}
