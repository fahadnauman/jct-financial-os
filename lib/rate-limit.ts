/**
 * Anti-Brute-Force PIN Lockout & API Sliding-Window Rate Limiter
 * Edge-compatible in-memory store (zero external dependencies).
 */

const MAX_FAILED_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

const API_RATE_WINDOW_MS = 60 * 1000; // 1 minute
const API_MAX_REQUESTS_PER_WINDOW = 120;

interface PinFailureRecord {
  count: number;
  lockedUntil: number | null;
  lastAttemptAt: number;
}

interface ApiRateRecord {
  count: number;
  windowStart: number;
}

const globalForRateLimit = globalThis as unknown as {
  __jctPinFailures?: Map<string, PinFailureRecord>;
  __jctApiRates?: Map<string, ApiRateRecord>;
};

const pinFailures = globalForRateLimit.__jctPinFailures ?? new Map<string, PinFailureRecord>();
const apiRates = globalForRateLimit.__jctApiRates ?? new Map<string, ApiRateRecord>();

if (!globalForRateLimit.__jctPinFailures) {
  globalForRateLimit.__jctPinFailures = pinFailures;
}
if (!globalForRateLimit.__jctApiRates) {
  globalForRateLimit.__jctApiRates = apiRates;
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown-ip";
}

export function checkPinLockout(
  ip: string,
  profileId: string
): { locked: boolean; remainingSeconds: number; remainingMinutes: number } {
  const key = `${ip}::${profileId.toUpperCase()}`;
  const rec = pinFailures.get(key);
  if (!rec || !rec.lockedUntil) {
    return { locked: false, remainingSeconds: 0, remainingMinutes: 0 };
  }
  const now = Date.now();
  if (now >= rec.lockedUntil) {
    pinFailures.delete(key);
    return { locked: false, remainingSeconds: 0, remainingMinutes: 0 };
  }
  const remainingSeconds = Math.ceil((rec.lockedUntil - now) / 1000);
  const remainingMinutes = Math.max(1, Math.ceil(remainingSeconds / 60));
  return { locked: true, remainingSeconds, remainingMinutes };
}

export function recordPinFailure(
  ip: string,
  profileId: string
): {
  attempts: number;
  lockedNow: boolean;
  remainingAttempts: number;
  remainingSeconds: number;
  remainingMinutes: number;
} {
  const key = `${ip}::${profileId.toUpperCase()}`;
  const now = Date.now();
  const prev = pinFailures.get(key);

  // Reset stale attempt counter if older than lockout window and not locked
  const baseCount =
    prev && !prev.lockedUntil && now - prev.lastAttemptAt < PIN_LOCKOUT_MS ? prev.count : 0;
  const nextCount = baseCount + 1;

  if (nextCount >= MAX_FAILED_PIN_ATTEMPTS) {
    const lockedUntil = now + PIN_LOCKOUT_MS;
    pinFailures.set(key, {
      count: nextCount,
      lockedUntil,
      lastAttemptAt: now,
    });
    const remainingSeconds = Math.ceil(PIN_LOCKOUT_MS / 1000);
    return {
      attempts: nextCount,
      lockedNow: true,
      remainingAttempts: 0,
      remainingSeconds,
      remainingMinutes: 15,
    };
  }

  pinFailures.set(key, {
    count: nextCount,
    lockedUntil: null,
    lastAttemptAt: now,
  });

  return {
    attempts: nextCount,
    lockedNow: false,
    remainingAttempts: MAX_FAILED_PIN_ATTEMPTS - nextCount,
    remainingSeconds: 0,
    remainingMinutes: 0,
  };
}

export function clearPinFailures(ip: string, profileId: string): void {
  const key = `${ip}::${profileId.toUpperCase()}`;
  pinFailures.delete(key);
}

export function checkApiRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const prev = apiRates.get(ip);

  if (!prev || now - prev.windowStart >= API_RATE_WINDOW_MS) {
    apiRates.set(ip, { count: 1, windowStart: now });
    // Occasional lightweight cleanup to keep map bounded
    if (apiRates.size > 5000) {
      for (const [k, v] of apiRates.entries()) {
        if (now - v.windowStart >= API_RATE_WINDOW_MS) {
          apiRates.delete(k);
        }
      }
    }
    return {
      allowed: true,
      remaining: API_MAX_REQUESTS_PER_WINDOW - 1,
      retryAfterSeconds: 0,
    };
  }

  if (prev.count >= API_MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((prev.windowStart + API_RATE_WINDOW_MS - now) / 1000)
    );
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  prev.count += 1;
  apiRates.set(ip, prev);
  return {
    allowed: true,
    remaining: Math.max(0, API_MAX_REQUESTS_PER_WINDOW - prev.count),
    retryAfterSeconds: 0,
  };
}
