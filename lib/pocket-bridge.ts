/**
 * JCT Pocket ⇄ Desktop Register bridge, backed by Neon PostgreSQL via /api/pocket.
 *
 * Phone (/owner-pocket) POSTs transactions; every client polls GET /api/pocket so the
 * desktop register and the phone feed stay in sync across devices.
 */

import { useCallback, useEffect, useState } from "react";

export type BranchId = "JCT_HQ" | "HEMPEL_JUBAIL" | "JOTUN_DAMMAM" | "SIGMA_JUBAIL";
export type PocketType = "EXPENSE" | "ADVANCE" | "CREDIT_COLLECTION";
export type PaymentSource = "DRAWER_CASH" | "OWNER_POCKET" | "BANK_TRANSFER";

export const POCKET_BRANCHES: { id: BranchId; short: string; full: string }[] = [
  { id: "JCT_HQ", short: "HQ", full: "Jubail Main HQ" },
  { id: "HEMPEL_JUBAIL", short: "Hempel", full: "Hempel Jubail" },
  { id: "JOTUN_DAMMAM", short: "Jotun", full: "Jotun Dammam" },
  { id: "SIGMA_JUBAIL", short: "Sigma", full: "Sigma Jubail" },
];

/** Row shape returned by /api/pocket (mirrors the PocketTransaction model). */
export interface PocketTransaction {
  id: string;
  branch: BranchId;
  type: PocketType;
  amount: number;
  /** EXPENSE: category · ADVANCE: purpose · CREDIT_COLLECTION: invoice/reference */
  category: string | null;
  /** ADVANCE: staff name · CREDIT_COLLECTION: customer name */
  recipientName: string | null;
  paymentSource: PaymentSource;
  paymentMode?: string | null;
  note: string | null;
  date: string;
  createdAt: string;
}

export type NewPocketTransaction = Omit<PocketTransaction, "id" | "createdAt">;

export const POCKET_CUSTOMERS_KEY = "jct_credit_customers";
export const POCKET_POLL_MS = 5000;

export const pocketTag = (type: PocketType): string =>
  type === "CREDIT_COLLECTION" ? "⚡ Collected by Owner (On-Road)" : "⚡ Logged by Owner (Mobile)";

export const todayIso = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export async function postPocketTransaction(tx: NewPocketTransaction): Promise<PocketTransaction> {
  const res = await fetch("/api/pocket", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-is-owner": "true",
      "x-user-role": "OWNER",
      "x-branch-id": tx.branch,
    },
    body: JSON.stringify(tx),
  });
  if (!res.ok) throw new Error("Could not save to the database");
  const json = (await res.json()) as { transaction: PocketTransaction };
  return json.transaction;
}

export async function fetchPocketTransactions(
  branch: BranchId | "ALL",
  date: string
): Promise<PocketTransaction[]> {
  const res = await fetch(`/api/pocket?branch=${branch}&date=${date}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load transactions");
  const json = (await res.json()) as { transactions: PocketTransaction[] };
  return json.transactions;
}

/** Polls Neon so every device sees new entries within a few seconds. */
export function usePocketTransactions(branch: BranchId | "ALL", enabled = true) {
  const [transactions, setTransactions] = useState<PocketTransaction[]>([]);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const rows = await fetchPocketTransactions(branch, todayIso());
      setTransactions(rows);
      setError(false);
    } catch {
      setError(true);
    }
  }, [branch]);

  useEffect(() => {
    if (!enabled) return;
    const first = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, POCKET_POLL_MS);
    const onFocus = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh, enabled]);

  return { transactions, error, refresh };
}
