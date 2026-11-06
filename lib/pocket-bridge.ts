/**
 * JCT Pocket ⇄ Desktop Register bridge, backed by Neon PostgreSQL via /api/pocket.
 *
 * Phone (/owner-pocket) POSTs transactions; every client polls GET /api/pocket so the
 * desktop register and the phone feed stay in sync across devices.
 */

import { useCallback, useEffect, useState } from "react";
import { saudiTodayIso } from "./saudi-time";

export type BranchId =
  | "JCT_HARDWARE_JOTUN"
  | "HEMPEL"
  | "DAMMAM_JOTUN"
  | "SIGMA"
  | "JCT_HQ"
  | "HARDWARE_HQ"
  | "HEMPEL_JUBAIL"
  | "JOTUN_DAMMAM"
  | "SIGMA_JUBAIL";
export type PocketType = "EXPENSE" | "ADVANCE" | "CREDIT_COLLECTION" | "PURCHASE";
export type PaymentSource = "DRAWER_CASH" | "OWNER_POCKET" | "BANK_TRANSFER" | "SUPPLIER_CREDIT";

export const POCKET_BRANCHES: { id: BranchId; short: string; full: string }[] = [
  { id: "JCT_HARDWARE_JOTUN", short: "JCT", full: "JCT Hardware + Jotun" },
  { id: "HEMPEL", short: "Hempel", full: "Hempel" },
  { id: "DAMMAM_JOTUN", short: "Dammam", full: "Dammam Jotun" },
  { id: "SIGMA", short: "Sigma", full: "Sigma" },
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
  receiptUrl?: string | null;
  billPdfUrl?: string | null;
  note: string | null;
  date: string;
  createdAt: string;
}

export type NewPocketTransaction = Omit<PocketTransaction, "id" | "createdAt">;

export const POCKET_CUSTOMERS_KEY = "jct_credit_customers";
export const POCKET_POLL_MS = 5000;

export const pocketTag = (type: PocketType): string =>
  type === "CREDIT_COLLECTION"
    ? "⚡ Collected by Owner (On-Road)"
    : type === "PURCHASE"
    ? "⚡ Logged by Owner (Purchase)"
    : "⚡ Logged by Owner (Mobile)";

/** Today's date (YYYY-MM-DD) in Saudi time (Asia/Riyadh), regardless of device timezone. */
export const todayIso = (): string => saudiTodayIso();

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
