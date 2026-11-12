"use client";

import React, { useEffect, useRef, useState } from "react";
import { CreditCard, X, Zap, RotateCcw, Check, Clock } from "lucide-react";

export type RapidPosTerminal = "SAB" | "AL_RAJHI" | "SNB" | "BANK_TRANSFER";
export type RapidPosCardNetwork = "mada" | "visa" | "mastercard";

export interface RapidPosSubmitPayload {
  amount: number;
  terminal: RapidPosTerminal;
  cardNetwork: RapidPosCardNetwork;
  invoiceNo: string;
  isManualPos: true;
  paymentMode: "CARD";
  clientTxnId: string;
  time?: string;
}

export interface RapidPosBatchEntry {
  id: string;
  clientTxnId: string;
  amount: number;
  terminal: RapidPosTerminal;
  cardNetwork: RapidPosCardNetwork;
  slipNo: string;
  time: string;
}

interface RapidPosModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: RapidPosSubmitPayload) => Promise<void> | void;
  onUndoLast?: (lastEntry: RapidPosBatchEntry) => Promise<void> | void;
  branchLabel?: string;
  sessionDate?: string;
  submitting?: boolean;
}

const TERMINAL_OPTIONS: { id: RapidPosTerminal; label: string }[] = [
  { id: "SAB", label: "SAB" },
  { id: "AL_RAJHI", label: "Al Rajhi" },
  { id: "SNB", label: "SNB" },
  { id: "BANK_TRANSFER", label: "Bank Transfer / Other" },
];

const NETWORK_OPTIONS: { id: RapidPosCardNetwork; label: string }[] = [
  { id: "mada", label: "mada" },
  { id: "visa", label: "Visa" },
  { id: "mastercard", label: "Mastercard" },
];

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const fmt = (n: number) =>
  Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function RapidPosModal({
  open,
  onClose,
  onSubmit,
  onUndoLast,
  branchLabel,
  sessionDate,
  submitting = false,
}: RapidPosModalProps) {
  const [amount, setAmount] = useState("");
  const [terminal, setTerminal] = useState<RapidPosTerminal>("SAB");
  const [cardNetwork, setCardNetwork] = useState<RapidPosCardNetwork>("mada");
  const [slipNo, setSlipNo] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [batchSlips, setBatchSlips] = useState<RapidPosBatchEntry[]>([]);
  const [isUndoing, setIsUndoing] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  // Initialize or reset when modal opens
  useEffect(() => {
    if (!open) {
      setBatchSlips([]);
      setAmount("");
      setSlipNo("");
      setErrorMsg(null);
      return;
    }

    setAmount("");
    setSlipNo("");
    setErrorMsg(null);
    setBatchSlips([]);

    const timer = window.setTimeout(() => {
      amountRef.current?.focus();
    }, 50);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const numericAmount = parseFloat(amount);
  const hasValidAmount = Number.isFinite(numericAmount) && numericAmount > 0;
  const isBankTransfer = terminal === "BANK_TRANSFER";
  const estMdrBase = isBankTransfer
    ? 0
    : cardNetwork === "mada"
    ? r2(Math.min((hasValidAmount ? numericAmount : 0) * 0.008, 40))
    : r2((hasValidAmount ? numericAmount : 0) * 0.022);
  const estTotalFee = r2(estMdrBase * 1.15);

  const batchCount = batchSlips.length;
  const batchTotal = batchSlips.reduce((sum, s) => sum + s.amount, 0);

  // Submit entry without closing modal (Continuous Rapid Entry)
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (submitting || isUndoing) return;

    // Smart Enter logic: If amount is empty AND user already logged slips in this batch, close cleanly!
    const trimmedAmount = amount.trim();
    if ((!trimmedAmount || trimmedAmount === "") && batchSlips.length > 0) {
      onClose();
      return;
    }

    const val = parseFloat(amount);
    if (!Number.isFinite(val) || val <= 0) {
      setErrorMsg("Enter a valid SAR amount greater than 0.");
      amountRef.current?.focus();
      return;
    }

    const clientTxnId = `pos-fast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const cleanRef = slipNo.trim() || `POS-${Date.now().toString().slice(-6)}`;
    const nowTime = new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    setErrorMsg(null);

    const newBatchEntry: RapidPosBatchEntry = {
      id: clientTxnId,
      clientTxnId,
      amount: r2(val),
      terminal,
      cardNetwork,
      slipNo: cleanRef,
      time: nowTime,
    };

    try {
      await onSubmit({
        amount: r2(val),
        terminal,
        cardNetwork,
        invoiceNo: cleanRef,
        isManualPos: true,
        paymentMode: "CARD",
        clientTxnId,
        time: nowTime,
      });

      // Append to running session mini-feed
      setBatchSlips((prev) => [newBatchEntry, ...prev]);

      // Reset ONLY amount and slipNo, preserve terminal and cardNetwork!
      setAmount("");
      setSlipNo("");

      // Immediately re-focus Amount input for next swipe
      setTimeout(() => {
        amountRef.current?.focus();
      }, 20);
    } catch (err) {
      console.error("Failed to log rapid POS entry:", err);
      setErrorMsg("Failed to log entry. Please try again.");
    }
  };

  // Undo Last Entry of this batch and close modal cleanly
  const handleUndoLastAndClose = async () => {
    if (batchSlips.length === 0) {
      onClose();
      return;
    }
    const lastEntry = batchSlips[0];
    setIsUndoing(true);
    try {
      if (onUndoLast) {
        await onUndoLast(lastEntry);
      }
      setBatchSlips((prev) => prev.slice(1));
    } catch (err) {
      console.error("Failed to undo last POS entry:", err);
    } finally {
      setIsUndoing(false);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Rapid Manual POS Entry"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-2xl border border-jct-turquoise/50 bg-white dark:bg-[#0A0A0A] p-5 sm:p-6 shadow-[0_0_40px_rgba(45,226,230,0.2)] space-y-4 text-jct-charcoal dark:text-jct-offwhite max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-jct-yellow px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-jct-charcoal">
              <Zap size={11} className="fill-current" />
              Rapid Manual POS Entry (Continuous Mode)
            </div>
            <h2 className="mt-1.5 font-display text-lg sm:text-xl font-extrabold text-jct-charcoal dark:text-white tracking-tight">
              Log Card Swipe / Bank Slip
            </h2>
            {(branchLabel || sessionDate) && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                {[branchLabel, sessionDate].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Rapid POS modal"
            className="rounded-lg border border-slate-200 dark:border-[#1F1F1F] p-1.5 text-slate-400 hover:text-jct-charcoal dark:hover:text-white transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Running Session Batch Counter Bar */}
        {batchCount > 0 && (
          <div className="flex items-center justify-between rounded-xl bg-emerald-500/15 border border-emerald-500/40 px-3.5 py-2 transition-all animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                Batch Logged: {batchCount} {batchCount === 1 ? "Slip" : "Slips"}
              </span>
            </div>
            <span className="font-mono text-xs font-black text-emerald-700 dark:text-emerald-200">
              Total: SAR {fmt(batchTotal)}
            </span>
          </div>
        )}

        {/* Amount Input (Auto-Focused & Instant Re-Focus) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Amount (SAR) *
            </label>
            <span className="text-[10px] font-medium text-slate-400">
              Press Enter to log & stay open
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border-2 border-jct-turquoise/50 focus-within:border-jct-turquoise bg-slate-50 dark:bg-black px-3.5 py-2.5 transition">
            <span className="text-sm font-black text-slate-400">SAR</span>
            <input
              ref={amountRef}
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="0.00"
              className="w-full bg-transparent font-mono text-3xl font-black text-jct-charcoal dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700 outline-none"
            />
          </div>
        </div>

        {/* Bank / Terminal Selector (Preserved across entries) */}
        <div>
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Bank / Terminal (Retained)
          </span>
          <div className="grid grid-cols-2 gap-2">
            {TERMINAL_OPTIONS.map((t) => {
              const active = terminal === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTerminal(t.id)}
                  className={`rounded-xl px-3 py-2 text-xs font-extrabold border transition-all text-center ${
                    active
                      ? "bg-jct-turquoise text-jct-charcoal border-jct-turquoise shadow-sm"
                      : "bg-slate-50 dark:bg-[#111111] border-slate-200 dark:border-[#1F1F1F] text-jct-charcoal dark:text-slate-300 hover:border-jct-turquoise/60"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Card Network Selector (Preserved across entries) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Card Network (Retained)
            </span>
            {isBankTransfer && (
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-jct-turquoise">
                Direct Transfer · 0% MDR
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {NETWORK_OPTIONS.map((n) => {
              const active = cardNetwork === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setCardNetwork(n.id)}
                  className={`rounded-xl px-3 py-2 text-xs font-extrabold border transition-all text-center ${
                    active
                      ? "bg-jct-yellow text-jct-charcoal border-jct-yellow shadow-sm"
                      : "bg-slate-50 dark:bg-[#111111] border-slate-200 dark:border-[#1F1F1F] text-jct-charcoal dark:text-slate-300 hover:border-jct-yellow/60"
                  }`}
                >
                  {n.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional Invoice / Slip No */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            Invoice / Slip No (Optional)
          </label>
          <input
            type="text"
            value={slipNo}
            onChange={(e) => setSlipNo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="W#JB... or Slip / RRN (Optional)"
            className="w-full rounded-xl border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise bg-slate-50 dark:bg-black px-3.5 py-2 text-xs font-mono font-semibold text-jct-charcoal dark:text-white placeholder:text-slate-400 outline-none transition"
          />
        </div>

        {hasValidAmount && (
          <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#111111] px-3.5 py-1.5 text-xs font-mono">
            <span className="text-slate-500 dark:text-slate-400">
              {isBankTransfer ? "Bank Transfer Fee:" : `Est. ${cardNetwork} Fee (+VAT):`}
            </span>
            <span className="font-bold text-amber-600 dark:text-jct-yellow">
              -SAR {estTotalFee.toFixed(2)}
            </span>
          </div>
        )}

        {errorMsg && (
          <p className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 text-xs font-semibold text-rose-500">
            {errorMsg}
          </p>
        )}

        {/* Mini-Feed of Logged Slips in this Session */}
        {batchCount > 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#121212] p-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Clock size={11} />
                Recent Slips in this Batch:
              </span>
              <span>Showing last {Math.min(batchCount, 3)}</span>
            </div>
            <div className="space-y-1 text-xs font-mono">
              {batchSlips.slice(0, 3).map((slip, idx) => (
                <div
                  key={slip.id}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1 text-[11px] ${
                    idx === 0
                      ? "bg-jct-turquoise/15 border border-jct-turquoise/30 text-jct-charcoal dark:text-white"
                      : "bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-slate-400 text-[10px]">{slip.time}</span>
                    <span className="font-bold text-jct-turquoise">{slip.terminal}</span>
                    <span className="text-slate-400 text-[10px]">({slip.cardNetwork})</span>
                    <span className="truncate max-w-[120px]">{slip.slipNo}</span>
                  </div>
                  <span className="font-bold whitespace-nowrap ml-2">
                    SAR {fmt(slip.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions & Undo / Close Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-[#1F1F1F]">
          {batchCount > 0 ? (
            <button
              type="button"
              onClick={handleUndoLastAndClose}
              disabled={isUndoing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 transition"
              title="Revert the most recent POS entry of this batch and close modal"
            >
              <RotateCcw size={13} />
              <span>{isUndoing ? "Reverting..." : "↩ Undo Last & Close"}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-[#1F1F1F] px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#111111] transition"
            >
              Cancel / Close
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {batchCount > 0 && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 px-3.5 py-2 text-xs font-bold text-jct-charcoal dark:text-white transition"
              >
                <Check size={13} />
                <span>✓ Done ({batchCount})</span>
              </button>
            )}
            <button
              type="submit"
              disabled={submitting || isUndoing}
              className="inline-flex items-center gap-1.5 rounded-xl bg-jct-turquoise px-4 sm:px-5 py-2 text-xs sm:text-sm font-black text-jct-charcoal shadow-sm hover:brightness-95 disabled:opacity-60 transition"
            >
              <CreditCard size={15} />
              <span>{submitting ? "Logging..." : "⚡ Log POS Swipe"}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
