/**
 * Shared Authorization & Validation Helper for JCT Financial OS
 * Universally enforces paymentMode, branchId, and isOwner checks across API routes.
 */

export const VALID_BRANCHES = [
  "JCT_HQ",
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
] as const;

export type ValidPaymentMode = (typeof VALID_PAYMENT_MODES)[number];

/**
 * Universal check for Owner permissions.
 * Inspects headers (x-user-is-owner, x-user-role), URL searchParams, and optional request body.
 */
export function checkIsOwner(req: Request, body?: Record<string, unknown> | null): boolean {
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
 * Universally normalizes branch identifier.
 */
export function normalizeBranch(
  branchOrBranchId?: unknown,
  fallback: ValidBranch = "JCT_HQ"
): ValidBranch {
  if (typeof branchOrBranchId !== "string") return fallback;
  const trimmed = branchOrBranchId.trim();
  if (trimmed === "Jubail - Main Branch" || trimmed === "HQ" || trimmed === "JCT Main HQ") return "JCT_HQ";
  if (trimmed === "Hempel - Jubail" || trimmed === "Hempel Jubail") return "HEMPEL_JUBAIL";
  if (trimmed === "Jotun - Dammam" || trimmed === "Jotun Dammam") return "JOTUN_DAMMAM";
  if (trimmed === "Sigma Paints - Jubail" || trimmed === "Sigma Jubail") return "SIGMA_JUBAIL";
  if (VALID_BRANCHES.includes(trimmed as ValidBranch)) return trimmed as ValidBranch;
  return fallback;
}
