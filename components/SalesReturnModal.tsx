"use client";

import React, { useState, useEffect } from "react";
import { RotateCcw, Search, X, Check, AlertCircle, DollarSign, Tag, FileText } from "lucide-react";
import type { InvoiceSearchResult } from "../app/api/invoices/search/route";

export type RefundMode = "CASH_REFUND" | "CARD_BANK_REVERSAL" | "CREDIT_NOTE";

export interface SalesReturnSubmitPayload {
  clientTxnId: string;
  invoiceNo: string;
  salesNo?: string;
  customerName?: string;
  returnedAmount: number;
  originalAmount?: number;
  refundMode: RefundMode;
  reason: string;
  notes?: string;
  isTodaySessionInvoice: boolean;
  sessionInvoiceRowKey?: string;
  isPastDayReturn: boolean;
  pastDayDate?: string;
}

interface ReturnSearchCandidate {
  id: string;
  source: "CURRENT_SESSION" | "HISTORICAL_DB";
  invoiceNo: string;
  salesNo?: string;
  customerName: string;
  amount: number;
  originalAmount?: number;
  paymentMode: string;
  date: string;
  isReturned?: boolean;
}

interface SalesReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  branch: string;
  currentErpInvoices?: Array<{
    internalId?: string;
    id?: string;
    invoiceNo: string;
    branchInvNo?: string;
    seqInvoiceNo?: string;
    customer?: string;
    customerName?: string;
    amount: number;
    originalAmount?: number;
    paymentMode?: string;
    isReturned?: boolean;
  }>;
  onSubmitReturn: (payload: SalesReturnSubmitPayload) => Promise<void> | void;
}

const REASONS = [
  "Defective / Damaged Goods",
  "Wrong Item Supplied",
  "Customer Cancelled",
  "Billing Error",
  "Other",
];

const REFUND_MODES: { id: RefundMode; label: string; desc: string }[] = [
  { id: "CASH_REFUND", label: "💵 Cash Refund", desc: "Deduct cash immediately from Drawer" },
  { id: "CARD_BANK_REVERSAL", label: "💳 Card / Bank Reversal", desc: "Revert bank/card POS deposit balance" },
  { id: "CREDIT_NOTE", label: "📝 Credit Note Adjustment", desc: "Reduce customer credit/receivable due" },
];

export function SalesReturnModal({
  isOpen,
  onClose,
  branch,
  currentErpInvoices = [],
  onSubmitReturn,
}: SalesReturnModalProps) {
  const [invoiceNo, setInvoiceNo] = useState("");
  const [salesNo, setSalesNo] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [returnedAmount, setReturnedAmount] = useState("");
  const [originalAmount, setOriginalAmount] = useState<number | undefined>(undefined);
  const [refundMode, setRefundMode] = useState<RefundMode>("CASH_REFUND");
  const [reason, setReason] = useState(REASONS[0]);
  const [notes, setNotes] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ReturnSearchCandidate[]>([]);
  const [matchedCandidate, setMatchedCandidate] = useState<ReturnSearchCandidate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setInvoiceNo("");
      setSalesNo("");
      setCustomerName("");
      setReturnedAmount("");
      setOriginalAmount(undefined);
      setRefundMode("CASH_REFUND");
      setReason(REASONS[0]);
      setNotes("");
      setSearchResults([]);
      setMatchedCandidate(null);
      setErrorMsg(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Search across today's live session and historical database
  const handleLiveSearch = async (query: string) => {
    setInvoiceNo(query);
    setErrorMsg(null);
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const candidates: ReturnSearchCandidate[] = [];
    const seen = new Set<string>();

    // 1. Search current live session invoices
    for (const inv of currentErpInvoices) {
      const bInv = (inv.branchInvNo || inv.invoiceNo || "").toLowerCase();
      const seq = (inv.seqInvoiceNo || "").toLowerCase();
      const cust = (inv.customerName || inv.customer || "").toLowerCase();
      const amtStr = String(inv.amount || "");
      if (bInv.includes(q) || seq.includes(q) || cust.includes(q) || amtStr.includes(q)) {
        const id = inv.internalId || inv.id || inv.invoiceNo;
        if (!seen.has(id)) {
          seen.add(id);
          candidates.push({
            id,
            source: "CURRENT_SESSION",
            invoiceNo: inv.branchInvNo || inv.invoiceNo,
            salesNo: inv.seqInvoiceNo || undefined,
            customerName: inv.customerName || inv.customer || "Customer",
            amount: inv.amount,
            originalAmount: inv.originalAmount ?? inv.amount,
            paymentMode: inv.paymentMode || "CASH",
            date: "Today's Active Session",
            isReturned: Boolean(inv.isReturned),
          });
        }
      }
    }

    // 2. Search database history via /api/invoices/search
    try {
      const res = await fetch(`/api/invoices/search?q=${encodeURIComponent(q)}&branch=${encodeURIComponent(branch)}`);
      if (res.ok) {
        const data = await res.json();
        const dbRows: InvoiceSearchResult[] = Array.isArray(data?.results) ? data.results : [];
        for (const row of dbRows) {
          const key = `db-${row.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            candidates.push({
              id: key,
              source: "HISTORICAL_DB",
              invoiceNo: row.branchInvNo || row.invoiceNo,
              salesNo: undefined,
              customerName: row.partyName,
              amount: row.amount,
              originalAmount: row.originalAmount ?? row.amount,
              paymentMode: row.paymentMode,
              date: row.date,
              isReturned: Boolean(row.isReturned),
            });
          }
        }
      }
    } catch (err) {
      console.warn("Historical invoice search warning:", err);
    } finally {
      setIsSearching(false);
      setSearchResults(candidates);
    }
  };

  const handleSelectCandidate = (c: ReturnSearchCandidate) => {
    setMatchedCandidate(c);
    setInvoiceNo(c.invoiceNo);
    if (c.salesNo) setSalesNo(c.salesNo);
    setCustomerName(c.customerName);
    setReturnedAmount(String(c.amount));
    setOriginalAmount(c.originalAmount ?? c.amount);
    if (c.paymentMode === "BANK_TRANSFER" || c.paymentMode === "POS_SWIPE" || c.paymentMode === "CARD") {
      setRefundMode("CARD_BANK_REVERSAL");
    } else if (c.paymentMode === "CREDIT" || c.paymentMode === "CREDIT_SALE") {
      setRefundMode("CREDIT_NOTE");
    } else {
      setRefundMode("CASH_REFUND");
    }
    setSearchResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInv = invoiceNo.trim();
    const numAmt = parseFloat(returnedAmount);

    if (!cleanInv) {
      setErrorMsg("Please enter or select a valid Invoice Number (W#JB...).");
      return;
    }
    if (!Number.isFinite(numAmt) || numAmt <= 0) {
      setErrorMsg("Please enter a valid returned amount greater than SAR 0.00.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const isToday = matchedCandidate?.source === "CURRENT_SESSION";
    const clientTxnId = `ret-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const payload: SalesReturnSubmitPayload = {
      clientTxnId,
      invoiceNo: cleanInv,
      salesNo: salesNo.trim() || undefined,
      customerName: customerName.trim() || undefined,
      returnedAmount: numAmt,
      originalAmount: originalAmount !== undefined ? originalAmount : numAmt,
      refundMode,
      reason,
      notes: notes.trim() || undefined,
      isTodaySessionInvoice: isToday,
      sessionInvoiceRowKey: isToday ? matchedCandidate?.id : undefined,
      isPastDayReturn: !isToday,
      pastDayDate: !isToday && matchedCandidate ? matchedCandidate.date : undefined,
    };

    try {
      // 1. Save to dedicated SalesReturnRecord model via /api/sales-returns
      await fetch("/api/sales-returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientTxnId,
          branch,
          invoiceNo: payload.invoiceNo,
          salesNo: payload.salesNo,
          customerName: payload.customerName,
          returnedAmount: payload.returnedAmount,
          originalAmount: payload.originalAmount,
          refundMode: payload.refundMode,
          reason: payload.reason,
          notes: payload.notes,
          isPastDayReturn: payload.isPastDayReturn,
          pastDayDate: payload.pastDayDate,
        }),
      });

      // 2. Trigger parent session state update (deducts from drawer/sales/bank accurately)
      await onSubmitReturn(payload);
      onClose();
    } catch (err) {
      console.error("Failed to process sales return:", err);
      setErrorMsg("Failed to record return. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md transition-opacity duration-200"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="animate-modal-scale-in w-full max-w-xl rounded-2xl border border-rose-500/50 bg-white dark:bg-[#0A0A0A] shadow-[0_0_50px_rgba(244,63,94,0.25)] overflow-hidden flex flex-col max-h-[92vh] scrollbar-thin">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rose-500/30 px-6 py-4 bg-rose-500/10">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-rose-600 p-2.5 text-white shadow-md">
              <RotateCcw size={20} />
            </div>
            <div>
              <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Audit Archive Workflow
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-jct-charcoal dark:text-white tracking-tight">
                Log Sales Return Bill
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1A1A1A] hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Invoice No. & Sales No. Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Invoice Number Input with Live Lookup */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Invoice No. (W#JB...) *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={invoiceNo}
                  onChange={(e) => handleLiveSearch(e.target.value)}
                  placeholder="e.g. W#JB006597"
                  className="w-full rounded-xl border border-slate-300 dark:border-[#222222] bg-slate-50 dark:bg-black px-3.5 py-2.5 text-xs font-mono font-bold text-jct-turquoise focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 transition"
                  autoFocus
                />
                {isSearching && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 animate-pulse font-mono">
                    Searching...
                  </span>
                )}
              </div>
            </div>

            {/* Sales Number / Doc No. */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Sales / Seq No. (#...)
              </label>
              <input
                type="text"
                value={salesNo}
                onChange={(e) => setSalesNo(e.target.value)}
                placeholder="e.g. #40759 or Doc No."
                className="w-full rounded-xl border border-slate-300 dark:border-[#222222] bg-slate-50 dark:bg-black px-3.5 py-2.5 text-xs font-mono font-bold text-jct-charcoal dark:text-white focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 transition"
              />
            </div>
          </div>

          {/* Autocomplete Search Dropdown */}
          {searchResults.length > 0 && (
            <div className="rounded-xl border border-rose-500/40 bg-slate-50 dark:bg-[#121212] p-2.5 space-y-1 max-h-48 overflow-y-auto shadow-lg animate-in fade-in">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 block px-1">
                Matching Invoices Found (Tap to Auto-Fill):
              </span>
              {searchResults.map((cand) => (
                <div
                  key={cand.id}
                  onClick={() => handleSelectCandidate(cand)}
                  className="cursor-pointer rounded-lg p-2 text-xs flex items-center justify-between hover:bg-rose-500/15 transition border border-transparent hover:border-rose-500/30"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-jct-turquoise">{cand.invoiceNo}</span>
                      {cand.salesNo && (
                        <span className="text-[10px] font-mono text-slate-400">(#{cand.salesNo})</span>
                      )}
                      <span className="text-[10px] rounded px-1.5 py-0.5 bg-slate-200 dark:bg-[#222] text-slate-600 dark:text-slate-300 font-semibold">
                        {cand.source === "CURRENT_SESSION" ? "Today's Session" : cand.date}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">{cand.customerName}</div>
                  </div>
                  <span className="font-mono font-extrabold text-jct-charcoal dark:text-white whitespace-nowrap">
                    SAR {cand.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Matched Candidate Indicator */}
          {matchedCandidate && (
            <div className="flex items-center justify-between rounded-xl bg-rose-500/10 border border-rose-500/30 p-2.5 text-xs">
              <div className="flex items-center gap-2">
                <Check size={14} className="text-rose-500 shrink-0" />
                <span className="text-slate-700 dark:text-slate-300">
                  Matched: <strong className="text-jct-charcoal dark:text-white">{matchedCandidate.invoiceNo}</strong> ({matchedCandidate.customerName})
                </span>
              </div>
              <span className="text-[10px] font-bold rounded px-2 py-0.5 bg-rose-500 text-white">
                {matchedCandidate.source === "CURRENT_SESSION" ? "Live Today" : "Historical"}
              </span>
            </div>
          )}

          {/* Customer Name & Return Amount Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Customer Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer Name..."
                className="w-full rounded-xl border border-slate-300 dark:border-[#222222] bg-slate-50 dark:bg-black px-3.5 py-2.5 text-xs font-semibold text-jct-charcoal dark:text-white focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Returned Amount (SAR) *
              </label>
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-[#222222] bg-slate-50 dark:bg-black px-3 py-2.5 focus-within:border-rose-500 transition">
                <span className="text-xs font-black text-slate-400">SAR</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={returnedAmount}
                  onChange={(e) => setReturnedAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-transparent font-mono text-base font-black text-rose-600 dark:text-rose-400 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Refund Payment Mode Selector */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Refund Payment Mode *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {REFUND_MODES.map((m) => {
                const active = refundMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setRefundMode(m.id)}
                    className={`rounded-xl p-3 text-left border transition-all ${
                      active
                        ? "bg-rose-500 text-white border-rose-500 shadow-md font-bold"
                        : "bg-slate-50 dark:bg-[#111111] border-slate-200 dark:border-[#1F1F1F] text-jct-charcoal dark:text-slate-300 hover:border-rose-500/50"
                    }`}
                  >
                    <div className="text-xs font-extrabold">{m.label}</div>
                    <div className={`text-[10px] mt-0.5 line-clamp-1 ${active ? "text-white/80" : "text-slate-400"}`}>
                      {m.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Return Reason Dropdown & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Return Reason *
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-[#222222] bg-slate-50 dark:bg-black px-3.5 py-2.5 text-xs font-semibold text-jct-charcoal dark:text-white focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 transition"
              >
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Audit Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Customer remarks / condition of item..."
                className="w-full rounded-xl border border-slate-300 dark:border-[#222222] bg-slate-50 dark:bg-black px-3.5 py-2.5 text-xs font-semibold text-jct-charcoal dark:text-white focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 transition"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-500/15 border border-rose-500/40 p-3 text-xs text-rose-500 font-semibold">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </form>

        {/* Footer Actions */}
        <div className="border-t border-slate-200 dark:border-[#1F1F1F] p-4 bg-slate-50 dark:bg-[#0E0E0E] flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
            Files into <strong className="text-rose-500">📁 Sales Return Bills</strong> audit folder
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-slate-300 dark:border-[#222222] px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A1A1A] transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !invoiceNo.trim() || !returnedAmount}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-extrabold px-5 py-2 text-xs shadow-md transition"
            >
              <RotateCcw size={14} />
              <span>{submitting ? "Logging Return..." : "✓ Confirm Sales Return"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
