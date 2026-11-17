/**
 * Shared Authorization & Validation Helper for JCT Financial OS
 * Universally enforces paymentMode, branchId, and isOwner checks across API routes.
 */

export const VALID_BRANCHES = [
  "JCT_HARDWARE_JOTUN",
  "HEMPEL",
  "DAMMAM_JOTUN",
  "SIGMA",
  "JCT_HQ",
  "HARDWARE_HQ",
  "HEMPEL_JUBAIL",
  "JOTUN_DAMMAM",
  "SIGMA_JUBAIL",
] as const;

export type ValidBranch = (typeof VALID_BRANCHES)[number];

export const VALID_PAYMENT_MODES = [
  "CASH",
  "SAB",
  "AL_RAJHI",
  "SNB",
  "VISA",
  "MADA",
  "BANK_TRANSFER",
  "POS_SWIPE",
  "CARD",
  "CREDIT",
  "CREDIT_PAY_LATER",
] as const;

export type ValidPaymentMode = (typeof VALID_PAYMENT_MODES)[number];

/**
 * Universal check for Owner permissions.
 * Prefers the cryptographically verified `x-verified-role` header injected by Edge Middleware
 * from the signed `jct_session` cookie so Staff cannot spoof `x-user-is-owner`.
 */
export function checkIsOwner(req: Request, body?: Record<string, unknown> | null): boolean {
  const verifiedRole = req.headers.get("x-verified-role")?.toUpperCase();
  if (verifiedRole === "OWNER") return true;
  if (verifiedRole === "STAFF") return false;

  const headerOwner = req.headers.get("x-user-is-owner");
  if (headerOwner === "true" || headerOwner === "1") return true;

  const userRole = req.headers.get("x-user-role")?.toUpperCase();
  if (userRole === "OWNER" || userRole === "ADMIN" || userRole === "BONGSI") return true;

  try {
    const url = new URL(req.url);
    if (url.searchParams.get("isOwner") === "true") return true;
  } catch {
    // Ignore invalid url parse in testing
  }

  if (body) {
    if (body.isOwner === true) return true;
    const bodyRole = typeof body.role === "string" ? body.role.toUpperCase() : "";
    if (bodyRole === "OWNER" || bodyRole === "ADMIN") return true;
    const lockedBy = typeof body.lockedBy === "string" ? body.lockedBy.toUpperCase() : "";
    if (lockedBy === "BONGSI" || lockedBy === "OWNER") return true;
  }

  return false;
}

/**
 * Enforces Staff branch isolation for JSON body payloads.
 * Returns null if allowed, or an error string if forbidden.
 */
export function checkStaffBranchAccess(req: Request, targetBranch?: unknown): string | null {
  const verifiedRole = req.headers.get("x-verified-role")?.toUpperCase();
  if (verifiedRole !== "STAFF") return null;
  const verifiedBranch = req.headers.get("x-verified-branch");
  if (!verifiedBranch) return "Staff branch session missing";
  if (typeof targetBranch === "string" && targetBranch.trim()) {
    if (
      targetBranch.trim().toUpperCase() === "ALL" ||
      normalizeBranch(targetBranch) !== normalizeBranch(verifiedBranch)
    ) {
      return `Forbidden: Staff session (${verifiedBranch}) cannot access branch (${targetBranch})`;
    }
  }
  return null;
}

/**
 * Universally normalizes and validates paymentMode.
 */
export function normalizePaymentMode(
  rawMode?: unknown,
  fallback: ValidPaymentMode = "CASH"
): ValidPaymentMode {
  if (typeof rawMode !== "string") return fallback;
  const upper = rawMode.trim().toUpperCase() as ValidPaymentMode;
  if (VALID_PAYMENT_MODES.includes(upper)) return upper;
  return fallback;
}

/**
 * Universally normalizes branch identifier to the 4 canonical branches:
 * JCT_HARDWARE_JOTUN | HEMPEL | DAMMAM_JOTUN | SIGMA
 */
export function normalizeBranch(
  branchOrBranchId?: unknown,
  fallback: ValidBranch = "JCT_HARDWARE_JOTUN"
): ValidBranch {
  if (typeof branchOrBranchId !== "string") return fallback;
  const trimmed = branchOrBranchId.trim();
  const lower = trimmed.toLowerCase();

  // 1. JCT Hardware + Jotun
  if (
    trimmed === "JCT_HARDWARE_JOTUN" ||
    trimmed === "JCT_HQ" ||
    trimmed === "HARDWARE_HQ" ||
    trimmed === "JCT" ||
    lower.includes("hardware") ||
    lower.includes("jct") ||
    lower.includes("main") ||
    lower.includes("hq")
  ) {
    return "JCT_HARDWARE_JOTUN";
  }

  // 2. Hempel
  if (
    trimmed === "HEMPEL" ||
    trimmed === "HEMPEL_JUBAIL" ||
    lower.includes("hempel")
  ) {
    return "HEMPEL";
  }

  // 3. Dammam Jotun
  if (
    trimmed === "DAMMAM_JOTUN" ||
    trimmed === "JOTUN_DAMMAM" ||
    lower.includes("dammam")
  ) {
    return "DAMMAM_JOTUN";
  }

  // 4. Sigma
  if (
    trimmed === "SIGMA" ||
    trimmed === "SIGMA_JUBAIL" ||
    lower.includes("sigma")
  ) {
    return "SIGMA";
  }

  if (VALID_BRANCHES.includes(trimmed as ValidBranch)) return trimmed as ValidBranch;
  return fallback;
}
