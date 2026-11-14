import { NextResponse } from "next/server";
import { getAuthoritativeSaudiTime } from "../../../lib/saudi-time";

export const dynamic = "force-dynamic";

export async function GET() {
  const timeInfo = getAuthoritativeSaudiTime();
  return NextResponse.json(timeInfo, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}
