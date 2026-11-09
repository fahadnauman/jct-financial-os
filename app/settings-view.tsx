"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  Wallet,
  Landmark,
  Save,
  CheckCircle2,
  AlertTriangle,
  Lock,
  PlusCircle,
  Trash2,
  ArrowDownToLine,
} from "lucide-react";
import { saudiDateTimeString, saudiTodayIso } from "../lib/saudi-time";

export interface BranchBaseline {
  openingCashBalance: number;
  openingBankBalance: number;
  manualCashDeposits?: number;
  manualBankDeposits?: number;
}

export interface CapitalDepositItem {
  id: string;
  branch: string;
  targetAccount: "CASH" | "BANK";
  amount: number;
  date: string;
  notes: string;
  createdBy: string | null;
  createdAt: string;
}

const BRANCH_CHOICES: { id: string; label: string }[] = [
  { id: "JCT_HARDWARE_JOTUN", label: "JCT Hardware + Jotun" },
  { id: "HEMPEL", label: "Hempel" },
  { id: "DAMMAM_JOTUN", label: "Dammam Jotun" },
  { id: "SIGMA", label: "Sigma" },
];

export default function SettingsView({
  defaultBranch,
  isOwner,
  onSaved,
}: {
  defaultBranch: string;
  isOwner: boolean;
  onSaved?: (branch: string, baseline: BranchBaseline) => void;
}) {
  const [branch, setBranch] = useState<string>(defaultBranch);
  const [cash, setCash] = useState("");
  const [bank, setBank] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  // Manual Cash & Bank Deposits state
  const [depositBranch, setDepositBranch] = useState<string>(defaultBranch);
  const [depositTarget, setDepositTarget] = useState<"CASH" | "BANK">("CASH");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositDate, setDepositDate] = useState<string>(() => saudiTodayIso());
  const [depositNotes, setDepositNotes] = useState("");
  const [deposits, setDeposits] = useState<CapitalDepositItem[]>([]);
  const [addingDeposit, setAddingDeposit] = useState(false);
  const [deletingDepositId, setDeletingDepositId] = useState<string | null>(null);
  const [depositMessage, setDepositMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async (b: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/settings?branch=${b}`, { cache: "no-store" });
      const json = await res.json();
      const s = json.settings;
      setCash(s && s.configured ? String(s.openingCashBalance) : "");
      setBank(s && s.configured ? String(s.openingBankBalance) : "");
      setUpdatedAt(s?.updatedAt ?? null);
      if (Array.isArray(json.capitalDeposits)) {
        setDeposits(json.capitalDeposits);
      }
    } catch {
      setMessage({ kind: "err", text: "Could not load saved settings." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(branch);
    setDepositBranch(branch);
  }, [branch, load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const cashVal = cash.trim() === "" ? 0 : Number(cash);
    const bankVal = bank.trim() === "" ? 0 : Number(bank);
    if (!Number.isFinite(cashVal) || !Number.isFinite(bankVal)) {
      setMessage({ kind: "err", text: "Enter valid numbers for both balances." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-is-owner": String(isOwner),
          "x-user-role": isOwner ? "OWNER" : "STAFF",
        },
        body: JSON.stringify({
          branch,
          openingCashBalance: cashVal,
          openingBankBalance: bankVal,
          isOwner,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setCash(String(json.settings.openingCashBalance));
      setBank(String(json.settings.openingBankBalance));
      setUpdatedAt(json.settings.updatedAt);
      setMessage({
        kind: "ok",
        text: "Opening balances saved. The Daily Hub now uses these as the starting baseline.",
      });
      onSaved?.(branch, {
        openingCashBalance: json.settings.openingCashBalance,
        openingBankBalance: json.settings.openingBankBalance,
        manualCashDeposits: json.settings.manualCashDeposits ?? 0,
        manualBankDeposits: json.settings.manualBankDeposits ?? 0,
      });
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const handleAddDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepositMessage(null);
    const amt = Number(depositAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setDepositMessage({ kind: "err", text: "Please enter a deposit amount greater than SAR 0." });
      return;
    }
    setAddingDeposit(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-is-owner": String(isOwner),
          "x-user-role": isOwner ? "OWNER" : "STAFF",
        },
        body: JSON.stringify({
          branch: depositBranch,
          targetAccount: depositTarget,
          amount: amt,
          date: depositDate || saudiTodayIso(),
          notes:
            depositNotes.trim() ||
            (depositTarget === "CASH" ? "Owner Cash Injection" : "Manual Bank Deposit"),
          isOwner,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add manual deposit");
      setDepositAmount("");
      setDepositNotes("");
      setDepositDate(saudiTodayIso());
      if (depositBranch === branch && Array.isArray(json.capitalDeposits)) {
        setDeposits(json.capitalDeposits);
      } else {
        await load(branch);
      }
      setDepositMessage({
        kind: "ok",
        text: `Injected SAR ${amt.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} into ${depositTarget === "CASH" ? "Cash in Business Drawer" : "Bank Account"}.`,
      });
      if (json.settings) {
        onSaved?.(depositBranch, {
          openingCashBalance: json.settings.openingCashBalance ?? 0,
          openingBankBalance: json.settings.openingBankBalance ?? 0,
          manualCashDeposits: json.settings.manualCashDeposits ?? 0,
          manualBankDeposits: json.settings.manualBankDeposits ?? 0,
        });
      }
    } catch (err) {
      setDepositMessage({
        kind: "err",
        text: err instanceof Error ? err.message : "Failed to add manual deposit",
      });
    } finally {
      setAddingDeposit(false);
    }
  };

  const handleDeleteDeposit = async (depositId: string) => {
    setDepositMessage(null);
    setDeletingDepositId(depositId);
    try {
      const res = await fetch(`/api/settings?depositId=${encodeURIComponent(depositId)}&isOwner=${isOwner}`, {
        method: "DELETE",
        headers: {
          "x-user-is-owner": String(isOwner),
          "x-user-role": isOwner ? "OWNER" : "STAFF",
        },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete deposit");
      if (Array.isArray(json.capitalDeposits)) {
        setDeposits(json.capitalDeposits);
      } else {
        setDeposits((prev) => prev.filter((d) => d.id !== depositId));
      }
      setDepositMessage({ kind: "ok", text: "Manual deposit entry removed." });
      if (json.settings) {
        onSaved?.(json.settings.branch || branch, {
          openingCashBalance: json.settings.openingCashBalance ?? 0,
          openingBankBalance: json.settings.openingBankBalance ?? 0,
          manualCashDeposits: json.settings.manualCashDeposits ?? 0,
          manualBankDeposits: json.settings.manualBankDeposits ?? 0,
        });
      }
    } catch (err) {
      setDepositMessage({
        kind: "err",
        text: err instanceof Error ? err.message : "Failed to delete deposit",
      });
    } finally {
      setDeletingDepositId(null);
    }
  };

  const totalManualCash = deposits
    .filter((d) => d.targetAccount === "CASH")
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const totalManualBank = deposits
    .filter((d) => d.targetAccount === "BANK")
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  const inputCls =
    "w-full rounded-lg border border-slate-300 dark:border-[#1F1F1F] bg-white dark:bg-black px-3.5 py-2.5 text-sm font-mono font-semibold text-jct-charcoal dark:text-jct-offwhite outline-none focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise disabled:opacity-60";

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 h-full overflow-y-auto w-full">
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display font-extrabold text-2xl text-jct-charcoal dark:text-white tracking-tight flex items-center gap-2">
          <SettingsIcon className="text-jct-turquoise" /> Settings
        </h2>
        <p className="text-slate-500 dark:text-slate-400 font-semibold text-sm">
          Baseline configuration and manual capital / cash-bank injections for each branch.
        </p>
      </div>

      {/* CARD 1: Initial Opening Balances */}
      <form
        onSubmit={handleSave}
        className="max-w-3xl bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 flex flex-col gap-5"
      >
        <div>
          <h3 className="font-display font-extrabold text-lg text-jct-charcoal dark:text-jct-offwhite">
            Initial Setup — Opening Baseline
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
            The starting baseline for this branch&apos;s cash drawer and bank account. The Daily Hub adds today&apos;s
            inflows on top of these values until the first audit is locked; after that, each day&apos;s closing balance
            carries forward.
          </p>
        </div>

        {!isOwner && (
          <div className="flex items-center gap-2 rounded-lg bg-jct-yellow/20 text-jct-charcoal dark:text-jct-yellow px-3 py-2 text-xs font-bold">
            <Lock size={13} /> Only the Owner can change these values.
          </div>
        )}

        <div>
          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
            Branch
          </label>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            disabled={!isOwner}
            className={inputCls}
          >
            {BRANCH_CHOICES.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
              <Wallet size={13} className="text-jct-yellow" /> Opening Cash Balance (SAR)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="0.00"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              disabled={!isOwner || loading}
              className={inputCls}
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
              <Landmark size={13} className="text-jct-turquoise" /> Opening Bank Balance (SAR)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="0.00"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              disabled={!isOwner || loading}
              className={inputCls}
            />
          </div>
        </div>

        {message && (
          <div
            className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs font-bold ${
              message.kind === "ok"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-300"
            }`}
          >
            {message.kind === "ok" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            <span>{message.text}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
            {updatedAt ? `Last saved ${saudiDateTimeString(updatedAt)}` : "Not configured yet (using SAR 0.00)"}
          </span>
          {isOwner && (
            <button
              type="submit"
              disabled={saving || loading}
              className="flex items-center gap-2 bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 disabled:opacity-60 transition-all shadow-sm rounded-lg px-5 py-2.5 text-sm"
            >
              <Save size={15} /> {saving ? "Saving…" : "Save Opening Balances"}
            </button>
          )}
        </div>
      </form>

      {/* CARD 2: Manual Cash & Bank Deposits (Capital Injections) */}
      <div className="max-w-3xl bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-extrabold text-lg text-jct-charcoal dark:text-jct-offwhite flex items-center gap-2">
              <ArrowDownToLine size={18} className="text-emerald-500" />
              Manual Cash &amp; Bank Deposits
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
              Inject additional capital or deposit funds directly into the branch&apos;s Cash Drawer or Bank Account at
              any time. These injections immediately add to your live Cash Drawer, Closing Audit, and Financial Pulse.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-right">
              <div className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-300">
                Injected Cash
              </div>
              <div className="font-mono text-xs font-extrabold text-amber-700 dark:text-amber-200">
                +SAR {totalManualCash.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-right">
              <div className="text-[10px] font-bold uppercase text-cyan-600 dark:text-cyan-300">
                Injected Bank
              </div>
              <div className="font-mono text-xs font-extrabold text-cyan-700 dark:text-cyan-200">
                +SAR {totalManualBank.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleAddDeposit} className="flex flex-col gap-4 border-t border-slate-100 dark:border-[#1A1A1A] pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                Branch
              </label>
              <select
                value={depositBranch}
                onChange={(e) => {
                  setDepositBranch(e.target.value);
                  setBranch(e.target.value);
                }}
                disabled={!isOwner}
                className={inputCls}
              >
                {BRANCH_CHOICES.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                Deposit Target
              </label>
              <select
                value={depositTarget}
                onChange={(e) => setDepositTarget(e.target.value === "BANK" ? "BANK" : "CASH")}
                disabled={!isOwner}
                className={inputCls}
              >
                <option value="CASH">💵 Cash in Business Drawer (CASH)</option>
                <option value="BANK">🏦 Bank Account (BANK)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                Amount (SAR)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                placeholder="e.g. 5000.00"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                disabled={!isOwner || addingDeposit}
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                Date (Saudi AST)
              </label>
              <input
                type="date"
                value={depositDate}
                onChange={(e) => setDepositDate(e.target.value)}
                disabled={!isOwner || addingDeposit}
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                Reason / Reference Note
              </label>
              <input
                type="text"
                placeholder={
                  depositTarget === "CASH"
                    ? "e.g. Owner Cash Injection"
                    : "e.g. Nov 5 Manual Bank Deposit"
                }
                value={depositNotes}
                onChange={(e) => setDepositNotes(e.target.value)}
                disabled={!isOwner || addingDeposit}
                className={inputCls}
              />
            </div>
          </div>

          {depositMessage && (
            <div
              className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs font-bold ${
                depositMessage.kind === "ok"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-300"
              }`}
            >
              {depositMessage.kind === "ok" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              <span>{depositMessage.text}</span>
            </div>
          )}

          {isOwner && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={addingDeposit || loading}
                className="flex items-center gap-2 bg-emerald-500 text-black font-bold hover:brightness-95 disabled:opacity-60 transition-all shadow-sm rounded-lg px-5 py-2.5 text-sm"
              >
                <PlusCircle size={15} /> {addingDeposit ? "Adding Deposit…" : "Add Deposit"}
              </button>
            </div>
          )}
        </form>

        {/* Mini History Table of Recent Manual Deposits */}
        <div className="border-t border-slate-100 dark:border-[#1A1A1A] pt-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Recent Manual Deposits ({BRANCH_CHOICES.find((b) => b.id === branch)?.label || branch})
          </div>
          {deposits.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 dark:border-[#1F1F1F] p-4 text-center text-xs text-slate-400 font-semibold">
              No manual cash or bank deposits recorded for this branch yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#1F1F1F]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-[#121212] text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-[#1F1F1F]">
                  <tr>
                    <th className="px-3 py-2">Date (AST)</th>
                    <th className="px-3 py-2">Target Account</th>
                    <th className="px-3 py-2">Reason / Reference Note</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    {isOwner && <th className="px-3 py-2 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1A1A1A]">
                  {deposits.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5 font-mono font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {d.date}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {d.targetAccount === "CASH" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[10px] font-extrabold">
                            💵 Cash Drawer
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-extrabold">
                            🏦 Bank Account
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-700 dark:text-slate-200">
                        {d.notes || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        +SAR {Number(d.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      {isOwner && (
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleDeleteDeposit(d.id)}
                            disabled={deletingDepositId === d.id}
                            title="Delete accidental deposit entry"
                            className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[10px] font-bold text-rose-600 dark:text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
                          >
                            <Trash2 size={12} />
                            {deletingDepositId === d.id ? "…" : "Delete"}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
