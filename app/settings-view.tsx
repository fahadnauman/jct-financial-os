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

  // Profile Security & Access PINs state
  const [profilePins, setProfilePins] = useState<Record<string, string>>({
    OWNER: "2026",
    JCT_HARDWARE_JOTUN: "1111",
    HEMPEL: "2222",
    DAMMAM_JOTUN: "3333",
    SIGMA: "4444",
  });
  const [securityLogs, setSecurityLogs] = useState<
    Array<{
      id: string;
      event: string;
      profileId: string | null;
      branch: string | null;
      ipAddress: string | null;
      details: string | null;
      createdAt: string;
    }>
  >([]);
  const [showPins, setShowPins] = useState(false);
  const [savingPins, setSavingPins] = useState(false);
  const [pinMessage, setPinMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Branch Operational & POS Preferences (stored per branch)
  const [defaultPosTerminal, setDefaultPosTerminal] = useState<"SAB" | "AL_RAJHI" | "SNB">("SAB");
  const [receiptHeaderNote, setReceiptHeaderNote] = useState("");
  const [autoDeductPosDefault, setAutoDeductPosDefault] = useState(true);
  const [prefsSavedMsg, setPrefsSavedMsg] = useState<string | null>(null);

  // Account for the Owners (Historical Cash Taken Home Ledger)
  const [ownerArchives, setOwnerArchives] = useState<
    Array<{
      id: string;
      branch: string;
      date: string;
      closingCash: number;
      takeHomeAmount?: number | null;
      ownerTakeHomeAmount?: number | null;
      nextDayOpeningCash?: number | null;
      remainingFloatForTomorrow?: number | null;
    }>
  >([]);
  const [loadingOwnerArchives, setLoadingOwnerArchives] = useState(false);
  const [editingOwnerRecId, setEditingOwnerRecId] = useState<string | null>(null);
  const [editOwnerTakeHomeVal, setEditOwnerTakeHomeVal] = useState("");
  const [editOwnerPinVal, setEditOwnerPinVal] = useState("");
  const [savingOwnerEdit, setSavingOwnerEdit] = useState(false);
  const [ownerAccountMsg, setOwnerAccountMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const loadOwnerArchives = useCallback(async () => {
    setLoadingOwnerArchives(true);
    try {
      const res = await fetch(`/api/archive?branch=${encodeURIComponent(isOwner ? "ALL" : branch)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (Array.isArray(data?.records)) {
        setOwnerArchives(data.records);
      }
    } catch {
      // ignore
    } finally {
      setLoadingOwnerArchives(false);
    }
  }, [isOwner, branch]);

  useEffect(() => {
    void loadOwnerArchives();
  }, [loadOwnerArchives]);

  useEffect(() => {
    setBranch(defaultBranch);
    setDepositBranch(defaultBranch);
  }, [defaultBranch]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(`jct_branch_prefs_${branch}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        setDefaultPosTerminal(parsed.defaultPosTerminal || "SAB");
        setReceiptHeaderNote(parsed.receiptHeaderNote || "");
        setAutoDeductPosDefault(parsed.autoDeductPosDefault !== false);
      } else {
        setDefaultPosTerminal("SAB");
        setReceiptHeaderNote("");
        setAutoDeductPosDefault(true);
      }
    } catch {
      // ignore
    }
  }, [branch]);

  const load = useCallback(async (b: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/settings?branch=${b}&includeSecurity=1`, {
        cache: "no-store",
      });
      const json = await res.json();
      const s = json.settings;
      setCash(s && s.configured ? String(s.openingCashBalance) : "");
      setBank(s && s.configured ? String(s.openingBankBalance) : "");
      setUpdatedAt(s?.updatedAt ?? null);
      if (Array.isArray(json.capitalDeposits)) {
        setDeposits(json.capitalDeposits);
      }
      if (Array.isArray(json.securityLogs)) {
        setSecurityLogs(json.securityLogs);
      }
      if (json.profilePins && typeof json.profilePins === "object") {
        setProfilePins((prev) => ({
          ...prev,
          ...(isOwner
            ? {
                OWNER: json.profilePins.OWNER || json.profilePins.BONGSI || "2026",
                JCT_HARDWARE_JOTUN: json.profilePins.JCT_HARDWARE_JOTUN || "1111",
                HEMPEL: json.profilePins.HEMPEL || "2222",
                DAMMAM_JOTUN: json.profilePins.DAMMAM_JOTUN || "3333",
                SIGMA: json.profilePins.SIGMA || "4444",
              }
            : {
                [b]: json.profilePins[b] || prev[b] || "1111",
              }),
        }));
      }
    } catch {
      setMessage({ kind: "err", text: "Could not load saved settings." });
    } finally {
      setLoading(false);
    }
  }, [isOwner]);

  const handleSavePins = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMessage(null);
    const targetEntries = isOwner
      ? Object.entries(profilePins)
      : [[branch, profilePins[branch] || ""]];
    for (const [k, v] of targetEntries) {
      if (!v || v.trim().length < 4) {
        setPinMessage({
          kind: "err",
          text: `PIN / Password for ${k} must be at least 4 characters.`,
        });
        return;
      }
    }
    setSavingPins(true);
    try {
      const payloadPins = isOwner
        ? profilePins
        : { [branch]: profilePins[branch] };
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-branch-id": branch,
          "x-user-is-owner": String(isOwner),
          "x-user-role": isOwner ? "OWNER" : "STAFF",
        },
        body: JSON.stringify({
          action: "UPDATE_PINS",
          branch,
          profilePins: payloadPins,
          isOwner,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update security PINs");
      if (json.profilePins) {
        setProfilePins((prev) => ({
          ...prev,
          ...json.profilePins,
        }));
        if (typeof window !== "undefined") {
          window.localStorage.setItem("jct_cached_profile_pins", JSON.stringify(json.profilePins));
        }
      }
      setPinMessage({
        kind: "ok",
        text: isOwner
          ? "Security PINs & Passwords updated across Desktop & Mobile PWA!"
          : `Access PIN updated for ${BRANCH_CHOICES.find((b) => b.id === branch)?.label || branch}!`,
      });
    } catch (err) {
      setPinMessage({
        kind: "err",
        text: err instanceof Error ? err.message : "Failed to save PINs",
      });
    } finally {
      setSavingPins(false);
    }
  };

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
          <div className="flex items-center gap-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 px-3 py-2 text-xs font-bold">
            <SettingsIcon size={13} /> Branch-Scoped Settings: Changes apply directly to{" "}
            {BRANCH_CHOICES.find((b) => b.id === branch)?.label || branch}.
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
            <div className="flex items-center overflow-hidden rounded-xl border-2 border-cyan-400/70 focus-within:border-cyan-300 focus-within:ring-4 focus-within:ring-cyan-500/25 bg-slate-950/95 shadow-inner">
              <span className="px-3 py-2.5 bg-cyan-500/15 border-r border-cyan-400/30 text-xs font-black tracking-wider text-cyan-300 shrink-0">
                SAR
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="0.00"
                value={cash}
                onChange={(e) => setCash(e.target.value)}
                disabled={loading}
                className="w-full bg-transparent px-3 py-2 text-xl font-bold tabular-nums text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
              <Landmark size={13} className="text-jct-turquoise" /> Opening Bank Balance (SAR)
            </label>
            <div className="flex items-center overflow-hidden rounded-xl border-2 border-cyan-400/70 focus-within:border-cyan-300 focus-within:ring-4 focus-within:ring-cyan-500/25 bg-slate-950/95 shadow-inner">
              <span className="px-3 py-2.5 bg-cyan-500/15 border-r border-cyan-400/30 text-xs font-black tracking-wider text-cyan-300 shrink-0">
                SAR
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="0.00"
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                disabled={loading}
                className="w-full bg-transparent px-3 py-2 text-xl font-bold tabular-nums text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>
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
          <button
            type="submit"
            disabled={saving || loading}
            className="flex items-center gap-2 bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 disabled:opacity-60 transition-all shadow-sm rounded-lg px-5 py-2.5 text-sm"
          >
            <Save size={15} /> {saving ? "Saving…" : "Save Opening Balances"}
          </button>
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
              <div className="flex items-center overflow-hidden rounded-xl border-2 border-cyan-400/70 focus-within:border-cyan-300 focus-within:ring-4 focus-within:ring-cyan-500/25 bg-slate-950/95 shadow-inner">
                <span className="px-2.5 py-2.5 bg-cyan-500/15 border-r border-cyan-400/30 text-[11px] font-black tracking-wider text-cyan-300 shrink-0">
                  SAR
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  disabled={addingDeposit}
                  className="w-full bg-transparent px-3 py-2 text-lg font-bold tabular-nums text-white placeholder:text-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                Date (Saudi AST)
              </label>
              <input
                type="date"
                value={depositDate}
                onChange={(e) => setDepositDate(e.target.value)}
                disabled={addingDeposit}
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
                    ? "e.g. Opening Cash Injection"
                    : "e.g. Nov 5 Manual Bank Deposit"
                }
                value={depositNotes}
                onChange={(e) => setDepositNotes(e.target.value)}
                disabled={addingDeposit}
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

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={addingDeposit || loading}
              className="flex items-center gap-2 bg-emerald-500 text-black font-bold hover:brightness-95 disabled:opacity-60 transition-all shadow-sm rounded-lg px-5 py-2.5 text-sm"
            >
              <PlusCircle size={15} /> {addingDeposit ? "Adding Entry…" : "Add Manual Entry / Deposit"}
            </button>
          </div>
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
                    <th className="px-3 py-2 text-right">Action</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* CARD 2B: Branch Operational & POS Preferences */}
      <div className="max-w-3xl bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-display font-extrabold text-lg text-jct-charcoal dark:text-jct-offwhite flex items-center gap-2">
              <SettingsIcon size={18} className="text-jct-turquoise" />
              Branch Operational &amp; POS Preferences ({BRANCH_CHOICES.find((b) => b.id === branch)?.label || branch})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
              Configure default POS terminal, receipt footer note, and branch-specific POS offset rules.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
              Default POS Terminal
            </label>
            <select
              value={defaultPosTerminal}
              onChange={(e) => setDefaultPosTerminal(e.target.value as "SAB" | "AL_RAJHI" | "SNB")}
              className={inputCls}
            >
              <option value="SAB">SAB Terminal</option>
              <option value="AL_RAJHI">Al Rajhi Terminal</option>
              <option value="SNB">SNB Terminal</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
              Receipt / Report Header Note
            </label>
            <input
              type="text"
              value={receiptHeaderNote}
              onChange={(e) => setReceiptHeaderNote(e.target.value)}
              placeholder="e.g. Jubail Main Branch · VAT #..."
              className={inputCls}
            />
          </div>
        </div>
        {branch === "JCT_HARDWARE_JOTUN" && (
          <label className="inline-flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300 cursor-pointer">
            <input
              type="checkbox"
              checked={autoDeductPosDefault}
              onChange={(e) => setAutoDeductPosDefault(e.target.checked)}
            />
            <span>Auto-Deduct Manual POS Swipes from Uploaded Cash-Billed ERP Summary (Default ON)</span>
          </label>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-300">
            {prefsSavedMsg || ""}
          </span>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.localStorage.setItem(
                  `jct_branch_prefs_${branch}`,
                  JSON.stringify({
                    defaultPosTerminal,
                    receiptHeaderNote,
                    autoDeductPosDefault,
                  })
                );
              }
              setPrefsSavedMsg(`✓ Operational preferences saved for ${BRANCH_CHOICES.find((b) => b.id === branch)?.label || branch}`);
            }}
            className="flex items-center gap-2 bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg px-4 py-2 text-xs"
          >
            <Save size={14} /> Save Branch Preferences
          </button>
        </div>
      </div>

      {/* CARD 3: Profile Security & Access PINs */}
      <form
        onSubmit={handleSavePins}
        className="max-w-3xl bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-turquoise/30 dark:border-jct-turquoise/30 rounded-xl p-6 flex flex-col gap-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-extrabold text-lg text-jct-charcoal dark:text-jct-offwhite flex items-center gap-2">
              <Lock size={18} className="text-jct-yellow" />
              {isOwner ? "Profile Security & Access PINs" : "Branch Access PIN"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
              {isOwner
                ? "Protect the Owner portal, Mobile PWA (/owner-pocket), and all 4 Branch Staff profiles with a mandatory PIN or password."
                : `Manage the access PIN for ${BRANCH_CHOICES.find((b) => b.id === branch)?.label || branch}. Other branches and Owner Master PIN remain protected.`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowPins((s) => !s)}
              className="rounded-lg border border-slate-300 dark:border-[#262626] bg-slate-50 dark:bg-[#141414] px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-jct-turquoise transition"
            >
              {showPins ? "🙈 Hide PINs" : "👁️ Show PINs"}
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={() =>
                  setProfilePins({
                    OWNER: "2026",
                    JCT_HARDWARE_JOTUN: "1111",
                    HEMPEL: "2222",
                    DAMMAM_JOTUN: "3333",
                    SIGMA: "4444",
                  })
                }
                className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition"
              >
                ↺ Reset Defaults
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              key: "OWNER",
              title: "👑 Owner (Nazim & Nadeem)",
              sub: "Unlocks Executive Dashboard, Payroll, Radar & /owner-pocket",
              defaultPin: "2026",
              highlight: true,
            },
            {
              key: "JCT_HARDWARE_JOTUN",
              title: "🏪 JCT Hardware + Jotun Staff",
              sub: "Branch Daily Register, Quick-Log, Settings & Archives",
              defaultPin: "1111",
            },
            {
              key: "HEMPEL",
              title: "🎨 Hempel Staff",
              sub: "Branch Daily Register, Quick-Log, Settings & Archives",
              defaultPin: "2222",
            },
            {
              key: "DAMMAM_JOTUN",
              title: "🌊 Dammam Jotun Staff",
              sub: "Branch Daily Register, Quick-Log, Settings & Archives",
              defaultPin: "3333",
            },
            {
              key: "SIGMA",
              title: "⚡ Sigma Staff",
              sub: "Branch Daily Register, Quick-Log, Settings & Archives",
              defaultPin: "4444",
            },
          ]
            .filter((item) => isOwner || item.key === branch)
            .map((item) => (
            <div
              key={item.key}
              className={`rounded-xl border p-3.5 flex flex-col gap-2 ${
                item.highlight
                  ? "sm:col-span-2 border-jct-yellow/50 bg-jct-yellow/5"
                  : "border-slate-200 dark:border-[#1F1F1F] bg-slate-50/50 dark:bg-[#111111]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-extrabold text-jct-charcoal dark:text-white">
                    {item.title}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {item.sub}
                  </div>
                </div>
                <span className="rounded bg-slate-200 dark:bg-white/10 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300">
                  Default: {item.defaultPin}
                </span>
              </div>
              <input
                type={showPins ? "text" : "password"}
                value={profilePins[item.key] || ""}
                onChange={(e) =>
                  setProfilePins((prev) => ({
                    ...prev,
                    [item.key]: e.target.value,
                  }))
                }
                disabled={savingPins}
                placeholder={`Enter PIN (default ${item.defaultPin})`}
                className={`${inputCls} tracking-widest`}
              />
            </div>
          ))}
        </div>

        {pinMessage && (
          <div
            className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs font-bold ${
              pinMessage.kind === "ok"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-300"
            }`}
          >
            {pinMessage.kind === "ok" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            <span>{pinMessage.text}</span>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingPins || loading}
            className="flex items-center gap-2 bg-jct-yellow text-jct-charcoal font-extrabold hover:brightness-95 disabled:opacity-60 transition-all shadow-sm rounded-lg px-5 py-2.5 text-sm"
          >
            <Save size={15} /> {savingPins ? "Saving PINs…" : isOwner ? "Save Security PINs" : "Save Branch PIN"}
          </button>
        </div>

        {/* Recent Security & Login Audit Events (Last 10) */}
        {isOwner && (
          <div className="mt-2 pt-4 border-t border-slate-200 dark:border-[#1F1F1F] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                🛡️ Recent Security &amp; Login Events (Last 10)
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                HMAC-SHA256 HttpOnly Session · 5-Try Lockout Active
              </span>
            </div>
            {securityLogs.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 rounded-lg border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#111111] px-3 py-2.5">
                No security events recorded yet. Logins, failed PINs, lockouts, and PIN updates appear here automatically.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-[#1F1F1F] rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-slate-50/70 dark:bg-[#111111] overflow-hidden">
                {securityLogs.map((log) => {
                  const isAlert = log.event === "LOGIN_FAILED" || log.event === "BRUTE_FORCE_LOCKOUT";
                  const isPinChange = log.event === "PIN_CHANGED";
                  return (
                    <div
                      key={log.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                            isAlert
                              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                              : isPinChange
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                              : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                          }`}
                        >
                          {log.event}
                        </span>
                        <span className="font-bold text-jct-charcoal dark:text-white">
                          {log.profileId || "SYSTEM"}
                        </span>
                        {log.details && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[260px]">
                            {log.details}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                        {log.ipAddress && <span>{log.ipAddress}</span>}
                        <span>·</span>
                        <span>{saudiDateTimeString(new Date(log.createdAt))}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </form>

      {/* CARD 4: 👑 Account for the Owners (Past Take-Home History & Backfill) */}
      <div className="max-w-4xl bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-yellow/30 rounded-xl p-6 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-extrabold text-lg text-jct-charcoal dark:text-jct-offwhite flex items-center gap-2">
              <span>👑 Account for the Owners</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
              Historical ledger of Owner Cash Taken Home / Receiving Amounts across closed days.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadOwnerArchives()}
            className="rounded-lg border border-slate-300 dark:border-[#262626] px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-jct-turquoise transition self-start"
          >
            ↻ Refresh History
          </button>
        </div>

        {(() => {
          const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
          const fmtSar = (n: number) =>
            Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const currentMonthPrefix = saudiTodayIso().slice(0, 7);
          const sortedRecs = [...ownerArchives].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
          const getTakeHome = (rec: (typeof ownerArchives)[number]) =>
            Number(rec.ownerTakeHomeAmount ?? rec.takeHomeAmount ?? 0) || 0;
          const getLeftInDrawer = (rec: (typeof ownerArchives)[number]) => {
            if (rec.remainingFloatForTomorrow !== null && rec.remainingFloatForTomorrow !== undefined) {
              return Number(rec.remainingFloatForTomorrow) || 0;
            }
            if (rec.nextDayOpeningCash !== null && rec.nextDayOpeningCash !== undefined) {
              return Number(rec.nextDayOpeningCash) || 0;
            }
            return Math.max(0, r2((Number(rec.closingCash) || 0) - getTakeHome(rec)));
          };
          const totalAllTime = r2(sortedRecs.reduce((s, r) => s + getTakeHome(r), 0));
          const totalThisMonth = r2(
            sortedRecs
              .filter((r) => (r.date || "").startsWith(currentMonthPrefix))
              .reduce((s, r) => s + getTakeHome(r), 0)
          );
          const avgDaily = sortedRecs.length > 0 ? r2(totalAllTime / sortedRecs.length) : 0;

          const handleSaveOwnerTakeHome = async (rec: (typeof ownerArchives)[number]) => {
            setOwnerAccountMsg(null);
            const newTakeHome = Math.max(0, r2(parseFloat(editOwnerTakeHomeVal) || 0));
            if (newTakeHome > (Number(rec.closingCash) || 0)) {
              setOwnerAccountMsg({
                kind: "err",
                text: `Take-Home (SAR ${fmtSar(newTakeHome)}) cannot exceed Closing Cash in Drawer (SAR ${fmtSar(rec.closingCash)}).`,
              });
              return;
            }
            setSavingOwnerEdit(true);
            try {
              if (!isOwner) {
                const pinRes = await fetch("/api/settings", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "VERIFY_PIN", profileId: "OWNER", pin: editOwnerPinVal.trim() }),
                });
                const pinJson = await pinRes.json();
                if (!pinJson?.verified) {
                  setOwnerAccountMsg({ kind: "err", text: "Invalid Owner Master PIN." });
                  setSavingOwnerEdit(false);
                  return;
                }
              }
              const nextFloat = Math.max(0, r2((Number(rec.closingCash) || 0) - newTakeHome));
              const res = await fetch("/api/archive", {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  "x-user-is-owner": "true",
                },
                body: JSON.stringify({
                  id: rec.id,
                  takeHomeAmount: newTakeHome,
                  ownerTakeHomeAmount: newTakeHome,
                  nextDayOpeningCash: nextFloat,
                  remainingFloatForTomorrow: nextFloat,
                  isOwner: true,
                }),
              });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error || "Failed to update Take-Home amount");
              }
              setOwnerArchives((prev) =>
                prev.map((item) =>
                  item.id === rec.id
                    ? {
                        ...item,
                        takeHomeAmount: newTakeHome,
                        ownerTakeHomeAmount: newTakeHome,
                        nextDayOpeningCash: nextFloat,
                        remainingFloatForTomorrow: nextFloat,
                      }
                    : item
                )
              );
              setEditingOwnerRecId(null);
              setEditOwnerPinVal("");
              setOwnerAccountMsg({ kind: "ok", text: `✓ Updated Owner Cash Taken Home for ${rec.date} to SAR ${fmtSar(newTakeHome)}.` });
            } catch (err) {
              setOwnerAccountMsg({
                kind: "err",
                text: err instanceof Error ? err.message : "Failed to save update.",
              });
            } finally {
              setSavingOwnerEdit(false);
            }
          };

          return (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    Total Cash Taken Home (All Time)
                  </div>
                  <div className="font-mono text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                    SAR {fmtSar(totalAllTime)}
                  </div>
                </div>
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                    This Month&apos;s Owner Receiving Total
                  </div>
                  <div className="font-mono text-xl font-black text-cyan-700 dark:text-cyan-300 mt-1">
                    SAR {fmtSar(totalThisMonth)}
                  </div>
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    Average Daily Take-Home
                  </div>
                  <div className="font-mono text-xl font-black text-amber-700 dark:text-amber-300 mt-1">
                    SAR {fmtSar(avgDaily)}
                  </div>
                </div>
              </div>

              {ownerAccountMsg && (
                <div
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${
                    ownerAccountMsg.kind === "ok"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-300"
                  }`}
                >
                  <span>{ownerAccountMsg.text}</span>
                </div>
              )}

              {loadingOwnerArchives ? (
                <div className="text-xs text-slate-400 py-6 text-center">Loading historical owner take-home records...</div>
              ) : sortedRecs.length === 0 ? (
                <div className="text-xs text-slate-400 py-6 text-center border border-dashed border-slate-200 dark:border-[#1F1F1F] rounded-xl">
                  No closed daily register records found yet.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-[#1F1F1F] rounded-xl">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-50 dark:bg-[#141414] text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="px-3 py-2.5">Date (AST)</th>
                        <th className="px-3 py-2.5">Branch</th>
                        <th className="px-3 py-2.5 text-right">Closing Cash</th>
                        <th className="px-3 py-2.5 text-right">Cash Taken Home (SAR)</th>
                        <th className="px-3 py-2.5 text-right">Left in Drawer</th>
                        <th className="px-3 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#1A1A1A]">
                      {sortedRecs.slice(0, 60).map((rec) => {
                        const tHome = getTakeHome(rec);
                        const leftFloat = getLeftInDrawer(rec);
                        const isEditing = editingOwnerRecId === rec.id;
                        return (
                          <tr key={rec.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
                            <td className="px-3 py-2.5 font-mono font-bold text-jct-charcoal dark:text-white">{rec.date}</td>
                            <td className="px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">
                              {BRANCH_CHOICES.find((b) => b.id === rec.branch)?.label || rec.branch}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold">SAR {fmtSar(rec.closingCash)}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-300">
                              {isEditing ? (
                                <div className="inline-flex items-center overflow-hidden rounded-lg border-2 border-cyan-400/70 bg-slate-950/95">
                                  <span className="px-2 py-1 bg-cyan-500/15 text-[10px] font-black text-cyan-300">SAR</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editOwnerTakeHomeVal}
                                    onChange={(e) => setEditOwnerTakeHomeVal(e.target.value)}
                                    className="w-24 bg-transparent px-2 py-1 text-xs font-bold text-white text-right focus:outline-none"
                                  />
                                </div>
                              ) : (
                                `SAR ${fmtSar(tHome)}`
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-amber-600 dark:text-amber-300">
                              SAR {fmtSar(leftFloat)}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {isEditing ? (
                                <div className="inline-flex items-center gap-1.5">
                                  {!isOwner && (
                                    <input
                                      type="password"
                                      value={editOwnerPinVal}
                                      onChange={(e) => setEditOwnerPinVal(e.target.value)}
                                      placeholder="Owner PIN"
                                      className="w-20 rounded border border-amber-500/40 bg-black px-2 py-1 text-[10px] text-white outline-none"
                                    />
                                  )}
                                  <button
                                    type="button"
                                    disabled={savingOwnerEdit}
                                    onClick={() => void handleSaveOwnerTakeHome(rec)}
                                    className="rounded bg-jct-turquoise text-jct-charcoal px-2.5 py-1 text-[10px] font-black"
                                  >
                                    {savingOwnerEdit ? "…" : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingOwnerRecId(null);
                                      setEditOwnerPinVal("");
                                    }}
                                    className="rounded border border-slate-300 dark:border-white/15 px-2 py-1 text-[10px] font-bold text-slate-500"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingOwnerRecId(rec.id);
                                    setEditOwnerTakeHomeVal(String(tHome));
                                    setEditOwnerPinVal("");
                                  }}
                                  className="rounded-md border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 px-2.5 py-1 text-[10px] font-bold text-cyan-700 dark:text-cyan-300 transition"
                                >
                                  ✏️ Edit / Update Take-Home
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}
