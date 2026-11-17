import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import {
  buildSessionCookieOptions,
  signSessionToken,
  type JctSessionPayload,
} from "../../../../lib/auth";
import { normalizeBranch } from "../../../../lib/auth-audit";
import {
  checkPinLockout,
  clearPinFailures,
  getClientIp,
  recordPinFailure,
} from "../../../../lib/rate-limit";
import { sanitizeString } from "../../../../lib/sanitize";

export const dynamic = "force-dynamic";

const DEFAULT_PROFILE_PINS: Record<string, string> = {
  OWNER: "2026",
  BONGSI: "2026",
  JCT_HARDWARE_JOTUN: "1111",
  HEMPEL: "2222",
  DAMMAM_JOTUN: "3333",
  SIGMA: "4444",
};

async function writeSecurityAudit(params: {
  event: string;
  profileId?: string;
  branch?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: string;
}) {
  try {
    await prisma.securityAuditLog.create({
      data: {
        event: params.event,
        profileId: params.profileId || null,
        branch: params.branch || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent ? params.userAgent.slice(0, 240) : null,
        details: params.details ? params.details.slice(0, 240) : null,
      },
    });
  } catch (err) {
    console.error("Failed to write SecurityAuditLog:", err);
  }
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || "";

  try {
    const body = (await req.json().catch(() => null)) as {
      profileId?: string;
      pin?: string;
      role?: string;
      branch?: string;
    } | null;

    const rawProfileId = sanitizeString(body?.profileId || body?.role || "OWNER", 64).toUpperCase();
    const submittedPin = sanitizeString(body?.pin || "", 64);

    if (!rawProfileId || !submittedPin) {
      return NextResponse.json(
        { error: "Profile ID and Security PIN are required." },
        { status: 400 }
      );
    }

    const isOwnerProfile =
      rawProfileId === "OWNER" ||
      rawProfileId === "BONGSI" ||
      rawProfileId === "ADMIN";
    const canonicalBranch = isOwnerProfile
      ? "ALL"
      : normalizeBranch(body?.branch || rawProfileId);
    const lockTargetKey = isOwnerProfile ? "OWNER" : canonicalBranch;

    // 1. Check Brute-Force Lockout
    const lockout = checkPinLockout(ip, lockTargetKey);
    if (lockout.locked) {
      await writeSecurityAudit({
        event: "BRUTE_FORCE_LOCKOUT",
        profileId: lockTargetKey,
        branch: canonicalBranch,
        ipAddress: ip,
        userAgent,
        details: `Blocked login attempt during 15m lockout (${lockout.remainingMinutes}m remaining)`,
      });
      return NextResponse.json(
        {
          error: `Too many failed attempts. Try again in ${lockout.remainingMinutes} minute${
            lockout.remainingMinutes === 1 ? "" : "s"
          }.`,
          retryAfterSeconds: lockout.remainingSeconds,
          remainingMinutes: lockout.remainingMinutes,
        },
        {
          status: 429,
          headers: { "Retry-After": String(lockout.remainingSeconds) },
        }
      );
    }

    // 2. Load authoritative PINs from Neon BranchSettings
    const rows = await prisma.branchSettings.findMany().catch(() => []);
    let ownerPin = DEFAULT_PROFILE_PINS.OWNER;
    const branchPins: Record<string, string> = { ...DEFAULT_PROFILE_PINS };

    for (const r of rows) {
      if (r.branch === "OWNER" && r.accessPin && r.accessPin.trim()) {
        ownerPin = r.accessPin.trim();
        branchPins.OWNER = ownerPin;
        branchPins.BONGSI = ownerPin;
      } else if (r.ownerPin && r.ownerPin.trim() && ownerPin === DEFAULT_PROFILE_PINS.OWNER) {
        ownerPin = r.ownerPin.trim();
        branchPins.OWNER = ownerPin;
        branchPins.BONGSI = ownerPin;
      }
      if (
        (r.branch === "JCT_HARDWARE_JOTUN" ||
          r.branch === "HEMPEL" ||
          r.branch === "DAMMAM_JOTUN" ||
          r.branch === "SIGMA") &&
        r.accessPin &&
        r.accessPin.trim()
      ) {
        branchPins[r.branch] = r.accessPin.trim();
      }
    }

    const expectedBranchPin = branchPins[canonicalBranch] || DEFAULT_PROFILE_PINS[canonicalBranch] || "1111";
    const isValidPin = isOwnerProfile
      ? submittedPin === ownerPin
      : submittedPin === expectedBranchPin || submittedPin === ownerPin;

    if (!isValidPin) {
      const failure = recordPinFailure(ip, lockTargetKey);
      if (failure.lockedNow) {
        await writeSecurityAudit({
          event: "BRUTE_FORCE_LOCKOUT",
          profileId: lockTargetKey,
          branch: canonicalBranch,
          ipAddress: ip,
          userAgent,
          details: "5 consecutive failed PIN attempts — locked for 15 minutes",
        });
        return NextResponse.json(
          {
            error: "Too many failed attempts. Try again in 15 minutes.",
            retryAfterSeconds: failure.remainingSeconds,
            remainingMinutes: 15,
          },
          {
            status: 429,
            headers: { "Retry-After": String(failure.remainingSeconds) },
          }
        );
      }

      await writeSecurityAudit({
        event: "LOGIN_FAILED",
        profileId: lockTargetKey,
        branch: canonicalBranch,
        ipAddress: ip,
        userAgent,
        details: `Invalid PIN (${failure.attempts}/5 attempts used)`,
      });

      return NextResponse.json(
        {
          error: `Incorrect PIN. ${failure.remainingAttempts} attempt${
            failure.remainingAttempts === 1 ? "" : "s"
          } remaining before 15-minute lockout.`,
          remainingAttempts: failure.remainingAttempts,
        },
        { status: 401 }
      );
    }

    // 3. Valid PIN: clear failures, log LOGIN_SUCCESS, and issue signed HttpOnly jct_session cookie
    clearPinFailures(ip, lockTargetKey);

    const sessionPayload: JctSessionPayload = {
      role: isOwnerProfile ? "OWNER" : "STAFF",
      branch: isOwnerProfile ? "ALL" : canonicalBranch,
      profileId: isOwnerProfile ? "BONGSI" : canonicalBranch,
      issuedAt: Date.now(),
    };

    const signedToken = await signSessionToken(sessionPayload);

    await writeSecurityAudit({
      event: "LOGIN_SUCCESS",
      profileId: sessionPayload.profileId,
      branch: sessionPayload.branch,
      ipAddress: ip,
      userAgent,
      details: `${sessionPayload.role} session issued (12h)`,
    });

    const res = NextResponse.json(
      { ok: true, session: sessionPayload },
      { headers: { "Cache-Control": "no-store" } }
    );
    res.cookies.set(buildSessionCookieOptions().name, signedToken, buildSessionCookieOptions());
    return res;
  } catch (err) {
    console.error("POST /api/auth/login error:", err);
    return NextResponse.json({ error: "Authentication error" }, { status: 500 });
  }
}
