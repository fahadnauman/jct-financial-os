"use client";

import React, { useState, useEffect } from "react";
import {
  RotateCcw,
  Search,
  Printer,
  Calendar,
  Store,
  DollarSign,
  FileText,
  Trash2,
  RefreshCw,
  AlertCircle,
  Filter,
} from "lucide-react";
import { getBranchBadgeInfo } from "../lib/pos-breakdown";

export interface SalesReturnItem {
  id: string;
  clientTxnId?: string | null;
  branch: string;
  returnDate: string;
  returnTime?: string | null;
  invoiceNo: string;
  salesNo?: string | null;
  customerName?: string | null;
  returnedAmount: number;
  originalAmount?: number | null;
  refundMode: string;
  reason: string;
  notes?: string | null;
  loggedBy: string;
  createdAt: string;
}

interface SalesReturnAuditViewProps {
  isOwner?: boolean;
  staffBranchId?: string;
}

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function SalesReturnAuditView({
  isOwner = false,
  staffBranchId = "JCT_HARDWARE_JOTUN",
}: SalesReturnAuditViewProps) {
  const [records, setRecords] = useState<SalesReturnItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState(isOwner ? "ALL" : staffBranchId);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRefundFilter, setSelectedRefundFilter] = useState<string>("ALL");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const qBranch = isOwner ? selectedBranch : staffBranchId;
      const res = await fetch(`/api/sales-returns?branch=${encodeURIComponent(qBranch)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.records)) {
          setRecords(data.records);
        }
      }
    } catch (err) {
      console.error("Failed to fetch sales returns:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReturns();
  }, [selectedBranch, isOwner, staffBranchId]);

  const handleDelete = async (id: string) => {
    if (!isOwner) return;
    if (!window.confirm("Are you sure you want to delete this sales return record from the audit archive?")) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/sales-returns?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          "x-user-is-owner": "true",
          "x-user-role": "OWNER",
        },
      });
      if (res.ok) {
        setRecords((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete sales return:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredRecords = records.filter((r) => {
    if (selectedRefundFilter !== "ALL" && r.refundMode !== selectedRefundFilter) {
      return false;
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      r.invoiceNo.toLowerCase().includes(q) ||
      (r.salesNo || "").toLowerCase().includes(q) ||
      (r.customerName || "").toLowerCase().includes(q) ||
      r.reason.toLowerCase().includes(q) ||
      (r.notes || "").toLowerCase().includes(q) ||
      r.returnDate.includes(q)
    );
  });

  // Calculate KPIs
  const totalCount = filteredRecords.length;
  const totalAmount = filteredRecords.reduce((sum, r) => sum + (Number(r.returnedAmount) || 0), 0);
  const totalCashRefunds = filteredRecords
    .filter((r) => r.refundMode === "CASH_REFUND")
    .reduce((sum, r) => sum + (Number(r.returnedAmount) || 0), 0);
  const totalCardReversals = filteredRecords
    .filter((r) => r.refundMode === "CARD_BANK_REVERSAL")
    .reduce((sum, r) => sum + (Number(r.returnedAmount) || 0), 0);
  const totalCreditNotes = filteredRecords
    .filter((r) => r.refundMode === "CREDIT_NOTE")
    .reduce((sum, r) => sum + (Number(r.returnedAmount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Folder Header & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-rose-500/20 p-2 text-rose-500 border border-rose-500/40">
              <RotateCcw size={20} />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-jct-charcoal dark:text-white tracking-tight flex items-center gap-2">
                <span>Sales Return Bills Archive</span>
                <span className="rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-500 px-2.5 py-0.5 text-xs font-mono font-bold">
                  {totalCount} Bills
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Permanent audit ledger of all customer bill returns, sequence numbers, and drawer refund adjustments.
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Branch Selector */}
          {isOwner ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-[#1F1F1F] bg-white dark:bg-[#0A0A0A] px-3 py-1.5 text-xs">
              <Store size={14} className="text-rose-500" />
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="bg-transparent font-bold text-jct-charcoal dark:text-jct-offwhite outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-white dark:bg-[#0A0A0A]">All Branches</option>
                <option value="JCT_HARDWARE_JOTUN" className="bg-white dark:bg-[#0A0A0A]">JCT Hardware + Jotun</option>
                <option value="HEMPEL" className="bg-white dark:bg-[#0A0A0A]">Hempel</option>
                <option value="DAMMAM_JOTUN" className="bg-white dark:bg-[#0A0A0A]">Dammam Jotun</option>
                <option value="SIGMA" className="bg-white dark:bg-[#0A0A0A]">Sigma</option>
              </select>
            </div>
          ) : (
            <span className="rounded-lg bg-rose-500/15 border border-rose-500/30 px-3 py-1.5 text-xs font-bold text-rose-400">
              {getBranchBadgeInfo(staffBranchId).name}
            </span>
          )}

          {/* Refund Mode Filter */}
          <select
            value={selectedRefundFilter}
            onChange={(e) => setSelectedRefundFilter(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-[#1F1F1F] bg-white dark:bg-[#0A0A0A] px-3 py-1.5 text-xs font-bold text-jct-charcoal dark:text-jct-offwhite outline-none"
          >
            <option value="ALL">All Refund Modes</option>
            <option value="CASH_REFUND">💵 Cash Refund</option>
            <option value="CARD_BANK_REVERSAL">💳 Card/Bank Reversal</option>
            <option value="CREDIT_NOTE">📝 Credit Note</option>
          </select>

          {/* Search Input */}
          <div className="flex items-center gap-2 bg-transparent border border-slate-300 dark:border-[#1F1F1F] rounded-lg px-3 py-1.5 text-xs">
            <Search size={14} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice, sales #, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent outline-none w-36 sm:w-44 text-xs"
            />
          </div>

          <button
            type="button"
            onClick={fetchReturns}
            className="p-2 rounded-lg bg-rose-500/15 text-rose-500 hover:bg-rose-500/25 transition"
            title="Refresh returns"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-jct-charcoal dark:bg-white text-white dark:text-black px-3 py-1.5 text-xs font-bold shadow-sm transition hover:brightness-110"
          >
            <Printer size={13} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#0A0A0A] border border-rose-500/30 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Total Returned Bills
          </span>
          <span className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono mt-1 block">
            SAR {fmt(totalAmount)}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">{totalCount} Return Records</span>
        </div>

        <div className="bg-white dark:bg-[#0A0A0A] border border-amber-500/30 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Drawer Cash Refunds
          </span>
          <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1 block">
            SAR {fmt(totalCashRefunds)}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Deducted from Register Cash</span>
        </div>

        <div className="bg-white dark:bg-[#0A0A0A] border border-jct-turquoise/30 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Card / Bank Reversals
          </span>
          <span className="text-2xl font-black text-jct-turquoise font-mono mt-1 block">
            SAR {fmt(totalCardReversals)}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Reconciled in Bank Settlement</span>
        </div>

        <div className="bg-white dark:bg-[#0A0A0A] border border-purple-500/30 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Credit Note Adjustments
          </span>
          <span className="text-2xl font-black text-purple-400 font-mono mt-1 block">
            SAR {fmt(totalCreditNotes)}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Subtracted from Customer Due</span>
        </div>
      </div>

      {/* Returns Data Table */}
      <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1F1F1F] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#111] text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Date / Time (AST)</th>
                <th className="py-3 px-4">Branch</th>
                <th className="py-3 px-4">Invoice # (W#JB...)</th>
                <th className="py-3 px-4">Sales / Seq #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Refund Mode</th>
                <th className="py-3 px-4">Reason & Notes</th>
                <th className="py-3 px-4 text-right">Returned Amount</th>
                {isOwner && <th className="py-3 px-4 text-center print:hidden">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#1F1F1F]">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={isOwner ? 9 : 8} className="py-12 text-center text-slate-400">
                    <RotateCcw size={28} className="mx-auto text-slate-500 mb-2 opacity-40" />
                    <p className="font-semibold">No sales return records found.</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Returns logged via the &quot;↩ Sales Return&quot; button will archive here permanently.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const bInfo = getBranchBadgeInfo(r.branch);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-[#111]/50 transition">
                      <td className="py-3 px-4 font-mono font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <div>{r.returnDate}</div>
                        {r.returnTime && (
                          <div className="text-[10px] text-slate-400">{r.returnTime} AST</div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${bInfo.color}`}>
                          {bInfo.name}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-extrabold text-jct-turquoise whitespace-nowrap">
                        {r.invoiceNo}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {r.salesNo ? `#${r.salesNo.replace(/^#/, "")}` : "—"}
                      </td>
                      <td className="py-3 px-4 font-bold text-jct-charcoal dark:text-white max-w-[160px] truncate">
                        {r.customerName || "Customer"}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {r.refundMode === "CASH_REFUND" ? (
                          <span className="rounded bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-[10px] font-bold">
                            💵 Cash Refund
                          </span>
                        ) : r.refundMode === "CARD_BANK_REVERSAL" ? (
                          <span className="rounded bg-jct-turquoise/15 border border-jct-turquoise/30 text-jct-turquoise px-2 py-0.5 text-[10px] font-bold">
                            💳 Card Reversal
                          </span>
                        ) : (
                          <span className="rounded bg-purple-500/15 border border-purple-500/30 text-purple-400 px-2 py-0.5 text-[10px] font-bold">
                            📝 Credit Note
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 max-w-[220px]">
                        <div className="font-semibold text-jct-charcoal dark:text-slate-200 truncate">
                          {r.reason}
                        </div>
                        {r.notes && (
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">
                            {r.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        SAR {fmt(r.returnedAmount)}
                      </td>
                      {isOwner && (
                        <td className="py-3 px-4 text-center print:hidden whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleDelete(r.id)}
                            disabled={deletingId === r.id}
                            className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
                            title="Delete this return record"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
