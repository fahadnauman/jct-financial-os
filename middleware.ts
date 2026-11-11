import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const NEXTAUTH_FALLBACK_SECRET =
  process.env.NEXTAUTH_SECRET || "jct-financial-os-rbac-production-secret-2026";

const OWNER_ONLY_PATHS = [
  "/pulse",
  "/monthly-audits",
  "/settings",
  "/suppliers",
  "/audit-library",
  "/nauman-ai",
  "/credit-radar",
  "/payroll",
  "/consolidation",
  "/owner-pocket",
];

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Allow public and PWA assets, API routes, and Next internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/pwa-icon") ||
    pathname.startsWith("/logos") ||
    pathname === "/manifest.json" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/workbox-") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: NEXTAUTH_FALLBACK_SECRET,
  });

  // Allow unauthenticated users on /login; redirect authenticated users away from /login
  if (pathname === "/login") {
    if (token) {
      const target = token.role === "STAFF" ? "/daily-register" : "/";
      return NextResponse.redirect(new URL(target, req.url));
    }
    return NextResponse.next();
  }

  // Redirect unauthenticated users to /login
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  const userRole = String(token.role || "STAFF").toUpperCase();

  // Enforce strict RBAC for STAFF accounts: only /daily-register is accessible
  if (userRole === "STAFF") {
    const isRestrictedPath = OWNER_ONLY_PATHS.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );
    const requestedTab = searchParams.get("tab");
    const isRestrictedTab =
      requestedTab && requestedTab !== "register" && requestedTab !== "daily-register";

    if (isRestrictedPath || isRestrictedTab || pathname !== "/daily-register") {
      return NextResponse.redirect(new URL("/daily-register", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.json|manifest.webmanifest|sw.js|pwa-icon|logos).*)",
  ],
};
