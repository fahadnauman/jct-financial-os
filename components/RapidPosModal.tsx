"use client";

import React, { useEffect, useRef, useState } from "react";
import { CreditCard, X, Zap } from "lucide-react";

export type RapidPosTerminal = "SAB" | "AL_RAJHI" | "SNB" | "BANK_TRANSFER";
export type RapidPosCardNetwork = "mada" | "visa" | "mastercard";

export interface RapidPosSubmitPayload {
  amount: number;
  terminal: RapidPosTerminal;
  cardNetwork: RapidPosCardNetwork;
  invoiceNo: string;
  isManualPos: true;
  paymentMode: "CARD";
}

interface RapidPosModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: RapidPosSubmitPayload) => Promise<void> | void;
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

export function RapidPosModal({
  open,
  onClose,
  onSubmit,
  branchLabel,
  sessionDate,
  submitting = false,
}: RapidPosModalProps) {
  const [amount, setAmount] = useState("");
  const [terminal, setTerminal] = useState<RapidPosTerminal>("SAB");
  const [cardNetwork, setCardNetwork] = useState<RapidPosCardNetwork>("mada");
  const [slipNo, setSlipNo] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setTerminal("SAB");
    setCardNetwork("mada");
    setSlipNo("");
    setErrorMsg(null);
    const timer = window.setTimeout(() => {
      amountRef.current?.focus();
    }, 20);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const val = parseFloat(amount);
    if (!Number.isFinite(val) || val <= 0) {
      setErrorMsg("Enter a valid SAR amount greater than 0.");
      amountRef.current?.focus();
      return;
    }
    const cleanRef = slipNo.trim() || `POS-${Date.now().toString().slice(-6)}`;
    setErrorMsg(null);
    await onSubmit({
      amount: r2(val),
      terminal,
      cardNetwork,
      invoiceNo: cleanRef,
      isManualPos: true,
      paymentMode: "CARD",
    });
    onClose();
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
        className="w-full max-w-md rounded-2xl border border-jct-turquoise/50 bg-white dark:bg-[#0A0A0A] p-5 sm:p-6 shadow-[0_0_40px_rgba(45,226,230,0.2)] space-y-5 text-jct-charcoal dark:text-jct-offwhite"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-jct-yellow px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-jct-charcoal">
              <Zap size={11} className="fill-current" />
              Rapid Manual POS Entry
            </div>
            <h2 className="mt-2 font-display text-lg sm:text-xl font-extrabold text-jct-charcoal dark:text-white tracking-tight">
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

        {/* Amount Input (Auto-Focused) */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Amount (SAR) *
          </label>
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
              placeholder="0.00"
              className="w-full bg-transparent font-mono text-3xl font-black text-jct-charcoal dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700 outline-none"
            />
          </div>
        </div>

        {/* Bank / Terminal Selector */}
        <div>
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Bank / Terminal
          </span>
          <div className="grid grid-cols-2 gap-2">
            {TERMINAL_OPTIONS.map((t) => {
              const active = terminal === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTerminal(t.id)}
                  className={`rounded-xl px-3 py-2.5 text-xs font-extrabold border transition-all text-center ${
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

        {/* Card Network Selector */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Card Network
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
                  className={`rounded-xl px-3 py-2.5 text-xs font-extrabold border transition-all text-center ${
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
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Invoice / Slip No (Optional)
          </label>
          <input
            type="text"
            value={slipNo}
            onChange={(e) => setSlipNo(e.target.value)}
            placeholder="W#JB... or Slip / RRN (Optional)"
            className="w-full rounded-xl border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise bg-slate-50 dark:bg-black px-3.5 py-2.5 text-sm font-mono font-semibold text-jct-charcoal dark:text-white placeholder:text-slate-400 outline-none transition"
          />
        </div>

        {hasValidAmount && (
          <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#111111] px-3.5 py-2 text-xs font-mono">
            <span className="text-slate-500 dark:text-slate-400">
              {isBankTransfer ? "Bank Transfer Fee:" : `Est. ${cardNetwork} Fee (+VAT):`}
            </span>
            <span className="font-bold text-amber-600 dark:text-jct-yellow">
              -SAR {estTotalFee.toFixed(2)}
            </span>
          </div>
        )}

        {errorMsg && (
          <p className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs font-semibold text-rose-500">
            {errorMsg}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Press <kbd className="rounded bg-slate-100 dark:bg-[#1F1F1F] px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd> to log
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-[#1F1F1F] px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#111111] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-jct-turquoise px-5 py-2.5 text-xs sm:text-sm font-black text-jct-charcoal shadow-sm hover:brightness-95 disabled:opacity-60 transition"
            >
              <CreditCard size={15} />
              <span>{submitting ? "Saving..." : "⚡ Add POS Entry"}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
