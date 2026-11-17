import { NextResponse } from "next/server";
import { buildSessionCookieOptions, getSessionFromRequest } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { getClientIp } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await getSessionFromRequest(req);
    if (session) {
      await prisma.securityAuditLog
        .create({
          data: {
            event: "LOGOUT",
            profileId: session.profileId,
            branch: session.branch,
            ipAddress: getClientIp(req),
            userAgent: (req.headers.get("user-agent") || "").slice(0, 240),
            details: "Session locked / switched profile",
          },
        })
        .catch(() => {});
    }
  } catch {
    /* ignore audit failure on logout */
  }

  const res = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
  res.cookies.set(buildSessionCookieOptions(0).name, "", buildSessionCookieOptions(0));
  return res;
}
