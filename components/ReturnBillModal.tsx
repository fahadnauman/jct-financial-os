"use client";

import React, { useState } from "react";
import { Search, RotateCcw, AlertTriangle, X, Check, FileText } from "lucide-react";
import type { InvoiceSearchResult } from "../app/api/invoices/search/route";

interface ReturnBillCandidate {
  id: string;
  source: "CURRENT_SESSION_INVOICE" | "CURRENT_SESSION_ENTRY" | "HISTORICAL_DB";
  invoiceNo: string;
  branchInvNo: string;
  date: string;
  partyName: string;
  amount: number;
  originalAmount?: number;
  paymentMode: string;
  isReturned: boolean;
  rawItem?: unknown;
}

interface ReturnBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  branch: string;
  currentErpInvoices: Array<{
    internalId?: string;
    id?: string;
    invoiceNo: string;
    branchInvNo?: string;
    customer?: string;
    customerName?: string;
    amount: number;
    originalAmount?: number;
    paymentMode?: string;
    isReturned?: boolean;
    time?: string;
  }>;
  currentPreLoggedEntries: Array<{
    id: string;
    title: string;
    type: string;
    amount: number;
    originalAmount?: number;
    paymentMode?: string;
    isReturned?: boolean;
    supplierName?: string;
    customerName?: string;
    supplierInvoiceNum?: string;
    invoiceNumber?: string;
    time?: string;
  }>;
  onConfirmReturn: (item: ReturnBillCandidate) => void;
}

export function ReturnBillModal({
  isOpen,
  onClose,
  branch,
  currentErpInvoices,
  currentPreLoggedEntries,
  onConfirmReturn,
}: ReturnBillModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<ReturnBillCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<ReturnBillCandidate | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState("");

  if (!isOpen) return null;

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    setFeedbackMsg("");
    const matchedList: ReturnBillCandidate[] = [];
    const seenIds = new Set<string>();

    // 1. Search in today's local session erpInvoices
    for (const inv of currentErpInvoices) {
      const invNo = (inv.invoiceNo || "").toLowerCase();
      const bInv = (inv.branchInvNo || "").toLowerCase();
      const cust = (inv.customer || inv.customerName || "").toLowerCase();
      if (invNo.includes(query) || bInv.includes(query) || cust.includes(query)) {
        const id = inv.internalId || inv.id || inv.invoiceNo;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          matchedList.push({
            id,
            source: "CURRENT_SESSION_INVOICE",
            invoiceNo: inv.invoiceNo,
            branchInvNo: inv.branchInvNo || inv.invoiceNo,
            date: "Today (Current Session)",
            partyName: inv.customer || inv.customerName || "Customer",
            amount: inv.amount,
            originalAmount: inv.originalAmount ?? inv.amount,
            paymentMode: inv.paymentMode || "CASH",
            isReturned: Boolean(inv.isReturned),
            rawItem: inv,
          });
        }
      }
    }

    // 2. Search in today's local session preLoggedEntries
    for (const entry of currentPreLoggedEntries) {
      const title = (entry.title || "").toLowerCase();
      const sup = (entry.supplierName || entry.customerName || "").toLowerCase();
      const invNum = (entry.supplierInvoiceNum || entry.invoiceNumber || "").toLowerCase();
      if (title.includes(query) || sup.includes(query) || invNum.includes(query)) {
        if (!seenIds.has(entry.id)) {
          seenIds.add(entry.id);
          matchedList.push({
            id: entry.id,
            source: "CURRENT_SESSION_ENTRY",
            invoiceNo: entry.supplierInvoiceNum || entry.invoiceNumber || entry.id,
            branchInvNo: entry.supplierInvoiceNum || entry.invoiceNumber || entry.id,
            date: "Today (Current Session)",
            partyName: entry.supplierName || entry.customerName || entry.title,
            amount: entry.amount,
            originalAmount: entry.originalAmount ?? entry.amount,
            paymentMode: entry.paymentMode || "CASH",
            isReturned: Boolean(entry.isReturned),
            rawItem: entry,
          });
        }
      }
    }

    // 3. Search historical DB via /api/invoices/search
    try {
      const res = await fetch(`/api/invoices/search?q=${encodeURIComponent(query)}&branch=${encodeURIComponent(branch)}`);
      if (res.ok) {
        const data = await res.json();
        const dbRows: InvoiceSearchResult[] = Array.isArray(data?.results) ? data.results : [];
        for (const row of dbRows) {
          const key = `db-${row.source}-${row.id}`;
          if (!seenIds.has(key)) {
            seenIds.add(key);
            matchedList.push({
              id: key,
              source: "HISTORICAL_DB",
              invoiceNo: row.invoiceNo,
              branchInvNo: row.branchInvNo,
              date: row.date,
              partyName: row.partyName,
              amount: row.amount,
              originalAmount: row.originalAmount ?? row.amount,
              paymentMode: row.paymentMode,
              isReturned: Boolean(row.isReturned),
              rawItem: row,
            });
          }
        }
      }
    } catch (err) {
      console.error("Historical invoice search failed:", err);
    } finally {
      setIsSearching(false);
      setResults(matchedList);
      if (matchedList.length === 0) {
        setFeedbackMsg(`No matching bills found for "${searchQuery}".`);
      }
    }
  };

  const handleConfirm = () => {
    if (!selectedCandidate) return;
    onConfirmReturn(selectedCandidate);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl rounded-2xl border border-rose-500/40 bg-white dark:bg-[#0A0A0A] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1F1F1F] px-6 py-4 bg-rose-500/10">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-rose-500 p-2 text-white shadow-sm">
              <RotateCcw size={18} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-jct-charcoal dark:text-white">
                Log Return Bill / Credit Note Reversal
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Search live across today&apos;s uploaded sales, expenses, and historical database records.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1C1C1C] hover:text-jct-charcoal dark:hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar Form */}
        <form onSubmit={handleSearch} className="p-6 border-b border-slate-200 dark:border-[#1F1F1F] bg-slate-50/50 dark:bg-black/50">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Invoice # (e.g. W#JB006597), Customer, or Supplier..."
                className="w-full rounded-xl border border-slate-300 dark:border-[#222222] bg-white dark:bg-[#111111] pl-9 pr-4 py-2.5 text-xs font-semibold text-jct-charcoal dark:text-white focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 transition"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold px-5 py-2.5 text-xs shadow-md transition flex items-center justify-center gap-1.5 shrink-0"
            >
              <Search size={14} />
              <span>{isSearching ? "Searching..." : "🔍 Search Invoice"}</span>
            </button>
          </div>
        </form>

        {/* Results Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {feedbackMsg && (
            <div className="p-4 rounded-xl border border-slate-200 dark:border-[#1F1F1F] text-center text-xs text-slate-400">
              {feedbackMsg}
            </div>
          )}

          {results.map((candidate) => {
            const isSelected = selectedCandidate?.id === candidate.id;
            return (
              <div
                key={candidate.id}
                onClick={() => setSelectedCandidate(candidate)}
                className={`cursor-pointer rounded-xl border p-4 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  isSelected
                    ? "border-rose-500 bg-rose-500/10 shadow-md ring-1 ring-rose-500/50"
                    : "border-slate-200 dark:border-[#1F1F1F] hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-[#0D0D0D]"
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-black text-jct-turquoise">
                      {candidate.branchInvNo || candidate.invoiceNo}
                    </span>
                    <span className="rounded-full bg-slate-100 dark:bg-[#1E1E1E] text-slate-600 dark:text-slate-300 px-2 py-0.5 text-[10px] font-bold">
                      {candidate.date}
                    </span>
                    <span className="rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold">
                      {candidate.paymentMode}
                    </span>
                    {candidate.source === "HISTORICAL_DB" && (
                      <span className="rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30 px-2 py-0.5 text-[10px] font-bold">
                        Historical Archive
                      </span>
                    )}
                    {candidate.isReturned && (
                      <span className="rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40 px-2 py-0.5 text-[10px] font-bold">
                        Already Returned
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-bold text-jct-charcoal dark:text-white truncate">
                    {candidate.partyName}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <div className="text-right">
                    <div className="text-[10px] font-medium text-slate-400 uppercase">Original Amount</div>
                    <div className="font-mono text-sm font-black text-jct-charcoal dark:text-white">
                      SAR {(candidate.originalAmount ?? candidate.amount).toFixed(2)}
                    </div>
                  </div>
                  <div
                    className={`h-5 w-5 rounded-full border flex items-center justify-center transition-colors ${
                      isSelected
                        ? "border-rose-500 bg-rose-500 text-white"
                        : "border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    {isSelected && <Check size={12} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-200 dark:border-[#1F1F1F] p-4 bg-slate-50 dark:bg-[#0E0E0E] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {selectedCandidate ? (
              <span>
                Selected: <strong className="text-rose-500 font-mono">{selectedCandidate.branchInvNo}</strong> ({selectedCandidate.partyName})
              </span>
            ) : (
              <span>Select an invoice above to confirm return.</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 dark:border-[#222222] px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1F1F1F] transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedCandidate}
              onClick={handleConfirm}
              className="rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-extrabold px-5 py-2 text-xs shadow-md transition flex items-center gap-1.5"
            >
              <RotateCcw size={14} />
              <span>Confirm Return Bill</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
