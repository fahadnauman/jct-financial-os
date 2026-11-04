import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { normalizeBranch } from "../../../lib/auth-audit";

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set(["DRAFT", "IN_PROGRESS", "CLEARED", "COMPLETED"]);

const serialize = (row: {
  branch: string;
  status: string;
  reportDate: string | null;
  dataJson: string | null;
  revision: number;
  updatedBy: string | null;
  updatedAt: Date;
} | null) =>
  row
    ? {
        branch: row.branch,
        status: row.status,
        reportDate: row.reportDate,
        dataJson: row.dataJson,
        revision: row.revision,
        updatedBy: row.updatedBy,
        updatedAt: row.updatedAt.toISOString(),
      }
    : null;

/**
 * GET /api/active-session?branch=JCT_HQ
 * Returns the live shared Daily Register session for the branch (polled by every device).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const branch = normalizeBranch(searchParams.get("branch") || req.headers.get("x-branch-id"));
  try {
    const row = await prisma.activeRegisterSession.findUnique({ where: { branch } });
    return NextResponse.json(
      { session: serialize(row) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("GET /api/active-session error:", err);
    return NextResponse.json({ session: null, error: "Failed to load active session" }, { status: 500 });
  }
}

/**
 * PUT /api/active-session
 * Body: { branch, clientId, status?, reportDate?, data }
 * Persists the active register snapshot and bumps the revision so other devices pick it up.
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const branch = normalizeBranch(body.branch || req.headers.get("x-branch-id"));
    const status =
      typeof body.status === "string" && ALLOWED_STATUSES.has(body.status) ? body.status : "IN_PROGRESS";
    const reportDate = typeof body.reportDate === "string" ? body.reportDate : null;
    const clientId = typeof body.clientId === "string" ? body.clientId.slice(0, 80) : null;
    const dataJson =
      body.data === null || body.data === undefined
        ? null
        : typeof body.data === "string"
        ? body.data
        : JSON.stringify(body.data);

    const row = await prisma.activeRegisterSession.upsert({
      where: { branch },
      create: { branch, status, reportDate, dataJson, revision: 1, updatedBy: clientId },
      update: { status, reportDate, dataJson, updatedBy: clientId, revision: { increment: 1 } },
    });

    return NextResponse.json({ session: serialize(row) });
  } catch (err) {
    console.error("PUT /api/active-session error:", err);
    return NextResponse.json({ error: "Failed to save active session" }, { status: 500 });
  }
}

/**
 * DELETE /api/active-session?branch=JCT_HQ&clientId=...
 * "Clear / Start Over": wipes the shared draft for every device (status CLEARED, empty data).
 */
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const branch = normalizeBranch(searchParams.get("branch") || req.headers.get("x-branch-id"));
  const clientId = searchParams.get("clientId")?.slice(0, 80) || null;
  try {
    const row = await prisma.activeRegisterSession.upsert({
      where: { branch },
      create: { branch, status: "CLEARED", reportDate: null, dataJson: null, revision: 1, updatedBy: clientId },
      update: {
        status: "CLEARED",
        reportDate: null,
        dataJson: null,
        updatedBy: clientId,
        revision: { increment: 1 },
      },
    });
    return NextResponse.json({ session: serialize(row) });
  } catch (err) {
    console.error("DELETE /api/active-session error:", err);
    return NextResponse.json({ error: "Failed to clear active session" }, { status: 500 });
  }
}
