/**
 * Edge-Compatible Cryptographic Session Utility (Web Crypto HMAC-SHA256)
 * Works identically in Next.js Edge Middleware and Node.js API routes.
 */

export const JCT_SESSION_COOKIE = "jct_session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours

export type SessionRole = "OWNER" | "STAFF";

export interface JctSessionPayload {
  role: SessionRole;
  branch: string; // "ALL" for OWNER or canonical branch ID for STAFF
  profileId: string;
  issuedAt: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array | null {
  try {
    const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function getSigningKey(): Promise<CryptoKey> {
  const rawSecret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    (process.env.DATABASE_URL ? `jct-derived::${process.env.DATABASE_URL}` : "jct-financial-os-enterprise-hmac-fallback-2026");

  // Always derive a uniform 256-bit key material via SHA-256
  const keyMaterial = await crypto.subtle.digest("SHA-256", encoder.encode(rawSecret));
  return crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signSessionToken(payload: JctSessionPayload): Promise<string> {
  const payloadBytes = encoder.encode(JSON.stringify(payload));
  const payloadB64 = toBase64Url(payloadBytes);
  const key = await getSigningKey();
  const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  const sigB64 = toBase64Url(new Uint8Array(sigBuf));
  return `${payloadB64}.${sigB64}`;
}

export async function verifySessionToken(token?: string | null): Promise<JctSessionPayload | null> {
  if (!token || typeof token !== "string") return null;
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0 || dotIdx === token.length - 1) return null;

  const payloadB64 = token.slice(0, dotIdx);
  const sigB64 = token.slice(dotIdx + 1);
  const sigBytes = fromBase64Url(sigB64);
  if (!sigBytes) return null;

  try {
    const key = await getSigningKey();
    const sigArrayBuffer = new ArrayBuffer(sigBytes.byteLength);
    new Uint8Array(sigArrayBuffer).set(sigBytes);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigArrayBuffer,
      encoder.encode(payloadB64)
    );
    if (!valid) return null;

    const payloadBytes = fromBase64Url(payloadB64);
    if (!payloadBytes) return null;

    const parsed = JSON.parse(decoder.decode(payloadBytes)) as Partial<JctSessionPayload>;
    if (
      !parsed ||
      (parsed.role !== "OWNER" && parsed.role !== "STAFF") ||
      typeof parsed.branch !== "string" ||
      typeof parsed.profileId !== "string" ||
      typeof parsed.issuedAt !== "number"
    ) {
      return null;
    }

    const expiresAt = parsed.issuedAt + SESSION_TTL_SECONDS * 1000;
    if (Date.now() > expiresAt) {
      return null;
    }

    return {
      role: parsed.role,
      branch: parsed.branch,
      profileId: parsed.profileId,
      issuedAt: parsed.issuedAt,
    };
  } catch {
    return null;
  }
}

export function extractSessionCookieFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") || "";
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    const name = part.slice(0, eqIdx).trim();
    if (name === JCT_SESSION_COOKIE) {
      return decodeURIComponent(part.slice(eqIdx + 1).trim());
    }
  }
  return null;
}

export async function getSessionFromRequest(req: Request): Promise<JctSessionPayload | null> {
  const rawToken = extractSessionCookieFromRequest(req);
  return verifySessionToken(rawToken);
}

export function buildSessionCookieOptions(maxAgeSeconds = SESSION_TTL_SECONDS) {
  return {
    name: JCT_SESSION_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
