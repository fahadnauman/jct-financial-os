import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { JCT_SESSION_COOKIE, verifySessionToken } from "./lib/session-auth";
import { normalizeBranch } from "./lib/auth-audit";
import { checkApiRateLimit, getClientIp } from "./lib/rate-limit";

const NEXTAUTH_FALLBACK_SECRET =
  process.env.NEXTAUTH_SECRET || "jct-financial-os-rbac-production-secret-2026";

const OWNER_ONLY_PATHS = [
  "/pulse",
  "/monthly-audits",
  "/audit-library",
  "/nauman-ai",
  "/payroll",
  "/consolidation",
  "/owner-pocket",
];

const PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session",
  "/api/auth/",
  "/api/time",
];

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // ── 1. API ROUTE AUTHORIZATION & RATE LIMITING ──────────────────────────
  if (pathname.startsWith("/api/")) {
    const ip = getClientIp(req);
    const rate = checkApiRateLimit(ip);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many API requests. Please slow down." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        }
      );
    }

    const isPublicApi = PUBLIC_API_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix)
    );
    if (isPublicApi) {
      return NextResponse.next();
    }

    const sessionCookie = req.cookies.get(JCT_SESSION_COOKIE)?.value;
    const session = await verifySessionToken(sessionCookie);

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized: Valid signed session required" },
        { status: 401 }
      );
    }

    // Enforce strict STAFF isolation & owner-only mutations
    if (session.role === "STAFF") {
      const staffBranch = normalizeBranch(session.branch);
      const queryBranch = searchParams.get("branch");
      const headerBranch = req.headers.get("x-branch-id");

      if (queryBranch) {
        if (
          queryBranch.trim().toUpperCase() === "ALL" ||
          normalizeBranch(queryBranch) !== staffBranch
        ) {
          return NextResponse.json(
            { error: "Forbidden: Cross-branch access denied for Staff profile" },
            { status: 403 }
          );
        }
      }

      if (headerBranch) {
        if (
          headerBranch.trim().toUpperCase() === "ALL" ||
          normalizeBranch(headerBranch) !== staffBranch
        ) {
          return NextResponse.json(
            { error: "Forbidden: Cross-branch header denied for Staff profile" },
            { status: 403 }
          );
        }
      }

      const method = req.method.toUpperCase();
      const isMutation = method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";

      // Protect Owner-only endpoints (STAFF can read/update /api/settings for their own verified branch only)
      if (pathname.startsWith("/api/ai")) {
        return NextResponse.json(
          { error: "Forbidden: Nauman AI is restricted to Owner" },
          { status: 403 }
        );
      }

      if (
        (pathname.startsWith("/api/staff") || pathname.startsWith("/api/payroll")) &&
        isMutation
      ) {
        return NextResponse.json(
          { error: "Forbidden: Staff & Payroll mutations are Owner-only" },
          { status: 403 }
        );
      }
    }

    // Attach authoritative verified session headers (strip any spoofed client headers)
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-verified-role", session.role);
    requestHeaders.set("x-verified-branch", session.branch);
    requestHeaders.set("x-verified-profile", session.profileId);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // ── 2. STATIC / PWA ASSETS EXEMPTION ────────────────────────────────────
  if (
    pathname.startsWith("/_next") ||
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

  // ── 3. NEXTAUTH PAGE PROTECTION ─────────────────────────────────────────
  const token = await getToken({
    req,
    secret: NEXTAUTH_FALLBACK_SECRET,
  });

  if (pathname === "/login") {
    if (token) {
      const target = token.role === "STAFF" ? "/daily-register" : "/";
      return NextResponse.redirect(new URL(target, req.url));
    }
    return NextResponse.next();
  }

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  const userRole = String(token.role || "STAFF").toUpperCase();

  if (userRole === "STAFF") {
    const isRestrictedPath = OWNER_ONLY_PATHS.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );
    const requestedTab = searchParams.get("tab");
    const allowedStaffTabs = new Set([
      "register",
      "daily-register",
      "settings",
      "quick-log",
      "archive",
      "suppliers",
      "supplier-advances",
      "radar",
    ]);
    const isRestrictedTab =
      requestedTab && !allowedStaffTabs.has(requestedTab);
    const allowedStaffPaths = new Set([
      "/daily-register",
      "/settings",
      "/suppliers",
      "/credit-radar",
    ]);

    if (isRestrictedPath || isRestrictedTab || !allowedStaffPaths.has(pathname)) {
      return NextResponse.redirect(new URL("/daily-register", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|manifest.webmanifest|sw.js|pwa-icon|logos).*)",
  ],
};
