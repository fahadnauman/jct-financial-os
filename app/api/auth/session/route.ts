import { NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json(
      { authenticated: false, session: null },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      session: {
        role: session.role,
        branch: session.branch,
        profileId: session.profileId,
        issuedAt: session.issuedAt,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
