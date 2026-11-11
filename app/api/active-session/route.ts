import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { normalizeBranch } from "../../../lib/auth-audit";

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set(["DRAFT", "IN_PROGRESS", "CLEARED", "COMPLETED"]);

const makeSessionKey = (branch: string, date: string | null) =>
  date ? `${branch}::${date}` : `${branch}::DEFAULT`;

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
 * GET /api/active-session?branch=JCT_HARDWARE_JOTUN&date=2026-11-11 (or ?branch=ALL)
 * Returns the live shared Daily Register session scoped by (branch, date).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawBranch = searchParams.get("branch") || req.headers.get("x-branch-id");
  const dateParam = searchParams.get("date")?.trim() || null;
  try {
    if (rawBranch === "ALL") {
      const rows = await prisma.activeRegisterSession.findMany({
        where: dateParam ? { reportDate: dateParam } : undefined,
      });
      return NextResponse.json(
        { sessions: rows.map((r) => serialize(r)).filter(Boolean) },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    const branch = normalizeBranch(rawBranch);
    const sessionKey = makeSessionKey(branch, dateParam);
    let row = await prisma.activeRegisterSession.findFirst({
      where: { sessionKey },
      orderBy: { updatedAt: "desc" },
    });
    if (!row && dateParam) {
      row = await prisma.activeRegisterSession.findFirst({
        where: { branch, reportDate: dateParam },
        orderBy: { updatedAt: "desc" },
      });
    } else if (!row && !dateParam) {
      row = await prisma.activeRegisterSession.findFirst({
        where: { branch },
        orderBy: { updatedAt: "desc" },
      });
    }
    return NextResponse.json(
      { session: serialize(row) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("GET /api/active-session error:", err);
    return NextResponse.json({ session: null, sessions: [], error: "Failed to load active session" }, { status: 500 });
  }
}

/**
 * PUT /api/active-session
 * Body: { branch, clientId, status?, reportDate?, data }
 * Persists the active register snapshot scoped by (branch, reportDate) and bumps revision.
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const branch = normalizeBranch(body.branch || req.headers.get("x-branch-id"));
    const status =
      typeof body.status === "string" && ALLOWED_STATUSES.has(body.status) ? body.status : "IN_PROGRESS";
    const reportDate =
      typeof body.reportDate === "string" && body.reportDate.trim() ? body.reportDate.trim() : null;
    const sessionKey = makeSessionKey(branch, reportDate);
    const clientId = typeof body.clientId === "string" ? body.clientId.slice(0, 80) : null;
    const dataJson =
      body.data === null || body.data === undefined
        ? null
        : typeof body.data === "string"
        ? body.data
        : JSON.stringify(body.data);

    let existing = await prisma.activeRegisterSession.findFirst({
      where: { sessionKey },
      orderBy: { updatedAt: "desc" },
    });
    if (!existing && reportDate) {
      existing = await prisma.activeRegisterSession.findFirst({
        where: { branch, reportDate, sessionKey: null },
        orderBy: { updatedAt: "desc" },
      });
    } else if (!existing && !reportDate) {
      existing = await prisma.activeRegisterSession.findFirst({
        where: { branch, sessionKey: null },
        orderBy: { updatedAt: "desc" },
      });
    }

    const row = existing
      ? await prisma.activeRegisterSession.update({
          where: { id: existing.id },
          data: { sessionKey, status, reportDate, dataJson, updatedBy: clientId, revision: { increment: 1 } },
        })
      : await prisma.activeRegisterSession.create({
          data: { sessionKey, branch, status, reportDate, dataJson, revision: 1, updatedBy: clientId },
        });

    return NextResponse.json({ session: serialize(row) });
  } catch (err) {
    console.error("PUT /api/active-session error:", err);
    return NextResponse.json({ error: "Failed to save active session" }, { status: 500 });
  }
}

/**
 * DELETE /api/active-session?branch=JCT_HARDWARE_JOTUN&date=2026-11-11&clientId=...
 * "Clear / Start Over": wipes the shared draft for every device on that (branch, date).
 */
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const branch = normalizeBranch(searchParams.get("branch") || req.headers.get("x-branch-id"));
  const dateParam = searchParams.get("date")?.trim() || null;
  const sessionKey = makeSessionKey(branch, dateParam);
  const clientId = searchParams.get("clientId")?.slice(0, 80) || null;
  try {
    let existing = await prisma.activeRegisterSession.findFirst({
      where: { sessionKey },
      orderBy: { updatedAt: "desc" },
    });
    if (!existing && dateParam) {
      existing = await prisma.activeRegisterSession.findFirst({
        where: { branch, reportDate: dateParam, sessionKey: null },
        orderBy: { updatedAt: "desc" },
      });
    } else if (!existing && !dateParam) {
      existing = await prisma.activeRegisterSession.findFirst({
        where: { branch, sessionKey: null },
        orderBy: { updatedAt: "desc" },
      });
    }

    const row = existing
      ? await prisma.activeRegisterSession.update({
          where: { id: existing.id },
          data: {
            sessionKey,
            status: "CLEARED",
            reportDate: dateParam,
            dataJson: null,
            updatedBy: clientId,
            revision: { increment: 1 },
          },
        })
      : await prisma.activeRegisterSession.create({
          data: { sessionKey, branch, status: "CLEARED", reportDate: dateParam, dataJson: null, revision: 1, updatedBy: clientId },
        });
    return NextResponse.json({ session: serialize(row) });
  } catch (err) {
    console.error("DELETE /api/active-session error:", err);
    return NextResponse.json({ error: "Failed to clear active session" }, { status: 500 });
  }
}
