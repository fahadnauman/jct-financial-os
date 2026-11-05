"use client";

import { useCallback, useEffect, useState } from "react";
import { Settings as SettingsIcon, Wallet, Landmark, Save, CheckCircle2, AlertTriangle, Lock } from "lucide-react";
import { saudiDateTimeString } from "../lib/saudi-time";

export interface BranchBaseline {
  openingCashBalance: number;
  openingBankBalance: number;
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

  const load = useCallback(async (b: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/settings?branch=${b}`, { cache: "no-store" });
      const json = await res.json();
      const s = json.settings;
      setCash(s && s.configured ? String(s.openingCashBalance) : "");
      setBank(s && s.configured ? String(s.openingBankBalance) : "");
      setUpdatedAt(s?.updatedAt ?? null);
    } catch {
      setMessage({ kind: "err", text: "Could not load saved settings." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(branch);
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
      setMessage({ kind: "ok", text: "Opening balances saved. The Daily Hub now uses these as the starting baseline." });
      onSaved?.(branch, {
        openingCashBalance: json.settings.openingCashBalance,
        openingBankBalance: json.settings.openingBankBalance,
      });
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-slate-300 dark:border-[#1F1F1F] bg-white dark:bg-black px-3.5 py-2.5 text-sm font-mono font-semibold text-jct-charcoal dark:text-jct-offwhite outline-none focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise disabled:opacity-60";

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 h-full overflow-y-auto w-full">
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display font-extrabold text-2xl text-jct-charcoal dark:text-white tracking-tight flex items-center gap-2">
          <SettingsIcon className="text-jct-turquoise" /> Settings
        </h2>
        <p className="text-slate-500 dark:text-slate-400 font-semibold text-sm">
          One-time business configuration for each branch.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="max-w-2xl bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 flex flex-col gap-5"
      >
        <div>
          <h3 className="font-display font-extrabold text-lg text-jct-charcoal dark:text-jct-offwhite">Initial Setup</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
            The starting baseline for this branch&apos;s cash drawer and bank account. The Daily Hub adds today&apos;s
            inflows on top of these values until the first audit is locked; after that, each day&apos;s closing balance carries forward.
          </p>
        </div>

        {!isOwner && (
          <div className="flex items-center gap-2 rounded-lg bg-jct-yellow/20 text-jct-charcoal dark:text-jct-yellow px-3 py-2 text-xs font-bold">
            <Lock size={13} /> Only the Owner can change these values.
          </div>
        )}

        <div>
          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Branch</label>
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
    </div>
  );
}
