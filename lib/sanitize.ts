/**
 * Strict Input Sanitization & Financial Amount Validation Helpers
 * Prevents Stored XSS, HTML/script injection, payload bloating, and NaN/Infinity injection.
 */

const MAX_DEFAULT_STRING_LENGTH = 240;

/**
 * Strips script tags, HTML tags, inline event handlers, and javascript: URIs,
 * trims whitespace, and caps string length.
 */
export function sanitizeString(
  raw: unknown,
  maxLength: number = MAX_DEFAULT_STRING_LENGTH
): string {
  if (typeof raw !== "string") return "";
  const cleaned = raw
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/on\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/on\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();

  if (cleaned.length > maxLength) {
    return cleaned.slice(0, maxLength);
  }
  return cleaned;
}

export function sanitizeOptionalString(
  raw: unknown,
  maxLength: number = MAX_DEFAULT_STRING_LENGTH
): string | null {
  if (raw === null || raw === undefined) return null;
  const s = sanitizeString(String(raw), maxLength);
  return s.length > 0 ? s : null;
}

/**
 * Validates that a financial amount is finite and within [0, 10_000_000].
 * Returns rounded 2-decimal number or null if invalid.
 */
export function validateAmount(raw: unknown, allowZero = true): number | null {
  const num = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(num)) return null;
  if (allowZero ? num < 0 : num <= 0) return null;
  if (num > 10_000_000) return null;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}
