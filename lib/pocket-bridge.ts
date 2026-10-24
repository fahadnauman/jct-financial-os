/**
 * JCT Pocket ⇄ Desktop Register bridge.
 *
 * Entries logged on /owner-pocket are written to a shared queue (localStorage, same origin).
 * The desktop register (app/page.tsx) consumes the queue and injects entries into the branch
 * register. This module is the single seam to swap for a Neon/Prisma API later for cross-device sync.
 */

export type BranchId = "JCT_HQ" | "HEMPEL_JUBAIL" | "JOTUN_DAMMAM" | "SIGMA_JUBAIL";

export const POCKET_BRANCHES: { id: BranchId; short: string; full: string }[] = [
  { id: "JCT_HQ", short: "HQ", full: "Jubail Main HQ" },
  { id: "HEMPEL_JUBAIL", short: "Hempel", full: "Hempel Jubail" },
  { id: "JOTUN_DAMMAM", short: "Jotun", full: "Jotun Dammam" },
  { id: "SIGMA_JUBAIL", short: "Sigma", full: "Sigma Jubail" },
];

export type PocketKind = "EXPENSE" | "ADVANCE" | "COLLECTION";

export interface PocketEntry {
  id: string;
  kind: PocketKind;
  branchId: BranchId;
  amount: number;
  /** Expense category, advance purpose or collection tender summary */
  category: string;
  /** Recipient (advance) or customer (collection) */
  party?: string;
  reference?: string;
  note?: string;
  /** EXPENSE only: true when paid from the owner's personal pocket (does NOT reduce drawer cash) */
  paidFromOwnerPocket?: boolean;
  /** COLLECTION only */
  tender?: "CASH_TO_OWNER" | "BANK_TRANSFER";
  followUpDate?: string;
  tag: string;
  createdAt: number;
}

export const POCKET_QUEUE_KEY = "jct_pocket_queue";
export const POCKET_APPLIED_KEY = "jct_pocket_applied";
export const POCKET_CUSTOMERS_KEY = "jct_credit_customers";
export const POCKET_EVENT = "jct-pocket-change";

export function readRaw(key: string): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(key) ?? "";
}

export function parseQueue(raw: string): PocketEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PocketEntry[]) : [];
  } catch {
    return [];
  }
}

export function appendPocketEntry(entry: PocketEntry): void {
  const queue = parseQueue(readRaw(POCKET_QUEUE_KEY));
  queue.push(entry);
  window.localStorage.setItem(POCKET_QUEUE_KEY, JSON.stringify(queue.slice(-200)));
  window.dispatchEvent(new Event(POCKET_EVENT));
}

export function readAppliedIds(): string[] {
  try {
    const parsed = JSON.parse(readRaw(POCKET_APPLIED_KEY) || "[]");
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function markApplied(ids: string[]): void {
  const next = Array.from(new Set([...readAppliedIds(), ...ids])).slice(-400);
  window.localStorage.setItem(POCKET_APPLIED_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(POCKET_EVENT));
}

export function subscribePocket(cb: () => void): () => void {
  window.addEventListener("storage", cb);
  window.addEventListener(POCKET_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(POCKET_EVENT, cb);
  };
}
