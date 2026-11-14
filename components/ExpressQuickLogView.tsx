"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Zap,
  Receipt,
  ShoppingCart,
  CreditCard,
  RotateCcw,
  FileText,
  Check,
  Trash2,
  Eye,
  Upload,
  Calendar,
  Clock,
  Store,
  DollarSign,
  AlertCircle,
  Smartphone,
  Monitor,
  RefreshCw,
  Search,
} from "lucide-react";
import { PartyDropdownSelector } from "./PartyDropdownSelector";
import { saudiTodayIso, saudiParts, addSaudiDays, saudiTime12 } from "../lib/saudi-time";
import type { BranchId, PocketTransaction, PocketType } from "../lib/pocket-bridge";

export type QuickLogType = "EXPENSE" | "PURCHASE" | "SALES_BILL" | "POS_SWIPE" | "SALES_RETURN";

interface ExpressQuickLogViewProps {
  branchId: string;
  branchName: string;
  isOwner?: boolean;
  currentUserRole?: string;
  activeSessionDate?: string;
  onSyncWithRegister?: (entry: {
    type: QuickLogType;
    payload: Record<string, unknown>;
  }) => void;
  onPreviewBill?: (url: string) => void;
}

const EXPENSE_CATEGORIES = [
  "Food",
  "Water",
  "Salary",
  "Staff Advance",
  "Supplier Advance",
  "Medical Expenses",
  "Staff Expenses",
  "Business Commission",
  "Shop Maintenance",
  "Fuel / Vehicle",
  "Freight",
  "Other Expenses",
];

const TERMINALS = [
  { id: "SAB", label: "SAB" },
  { id: "AL_RAJHI", label: "Al Rajhi" },
  { id: "SNB", label: "SNB" },
  { id: "BANK_TRANSFER", label: "Bank Transfer" },
];

const NETWORKS = [
  { id: "mada", label: "mada" },
  { id: "visa", label: "Visa" },
  { id: "mastercard", label: "Mastercard" },
];

const RETURN_REASONS = [
  "Defective / Damaged Goods",
  "Wrong Item Supplied",
  "Customer Cancelled",
  "Billing Error",
  "Other",
];

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function ExpressQuickLogView({
  branchId,
  branchName,
  isOwner = false,
  currentUserRole = "STAFF",
  activeSessionDate,
  onSyncWithRegister,
  onPreviewBill,
}: ExpressQuickLogViewProps) {
  const [activeType, setActiveType] = useState<QuickLogType>("EXPENSE");

  // Common Form States
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [hasBill, setHasBill] = useState(false);
  const [billFile, setBillFile] = useState<File | null>(null);
  const [billPdfUrl, setBillPdfUrl] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Expense specific
  const [expenseCategory, setExpenseCategory] = useState("Food");
  const [expensePaymentMode, setExpensePaymentMode] = useState<"CASH" | "CARD" | "BANK_TRANSFER">("CASH");

  // Purchase specific
  const [purchaseSupplier, setPurchaseSupplier] = useState("");
  const [purchaseInvoiceRef, setPurchaseInvoiceRef] = useState("");
  const [purchasePaymentMode, setPurchasePaymentMode] = useState<"CASH" | "CARD" | "BANK_TRANSFER" | "CREDIT">("CASH");
  const [purchaseFollowUpDate, setPurchaseFollowUpDate] = useState<string | null>(null);

  // Sales Bill specific
  const [salesInvoiceNo, setSalesInvoiceNo] = useState("");
  const [salesSeqNo, setSalesSeqNo] = useState("");
  const [salesCustomer, setSalesCustomer] = useState("");
  const [salesPaymentMode, setSalesPaymentMode] = useState<"CASH" | "CARD" | "SPLIT" | "CREDIT_SALE">("CASH");
  const [salesTerminal, setSalesTerminal] = useState("SAB");
  const [salesNetwork, setSalesNetwork] = useState("mada");

  // POS Swipe specific
  const [posTerminal, setPosTerminal] = useState("SAB");
  const [posNetwork, setPosNetwork] = useState("mada");
  const [posSlipNo, setPosSlipNo] = useState("");

  // Sales Return specific
  const [returnInvoiceNo, setReturnInvoiceNo] = useState("");
  const [returnSalesNo, setReturnSalesNo] = useState("");
  const [returnCustomer, setReturnCustomer] = useState("");
  const [returnRefundMode, setReturnRefundMode] = useState<"CASH_REFUND" | "CARD_BANK_REVERSAL" | "CREDIT_NOTE">("CASH_REFUND");
  const [returnReason, setReturnReason] = useState(RETURN_REASONS[0]);

  // Live Activity Feed
  const [activityFeed, setActivityFeed] = useState<PocketTransaction[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);

  const effectiveDate = activeSessionDate && /^\d{4}-\d{2}-\d{2}$/.test(activeSessionDate)
    ? activeSessionDate
    : saudiTodayIso();

  // Load today's activity feed from /api/pocket
  const loadFeed = async () => {
    setFeedLoading(true);
    try {
      const qBranch = branchId && branchId !== "ALL" ? branchId : "JCT_HARDWARE_JOTUN";
      const res = await fetch(`/api/pocket?branch=${encodeURIComponent(qBranch)}&date=${encodeURIComponent(effectiveDate)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.transactions)) {
          setActivityFeed(data.transactions.reverse());
        }
      }
    } catch (err) {
      console.warn("Express feed fetch error:", err);
    } finally {
      setFeedLoading(false);
    }
  };

  useEffect(() => {
    void loadFeed();
    const interval = setInterval(loadFeed, 6000);
    return () => clearInterval(interval);
  }, [branchId, effectiveDate]);

  // Auto focus amount input on tab switch
  useEffect(() => {
    setAmount("");
    setErrorMsg(null);
    setTimeout(() => {
      amountInputRef.current?.focus();
    }, 50);
  }, [activeType]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Upload bill / receipt
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBillFile(file);
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("branch", branchId);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setBillPdfUrl(data.url);
        setHasBill(true);
        showToast("📎 Bill file attached successfully");
      }
    } catch (err) {
      console.error("Bill upload failed:", err);
      setErrorMsg("Failed to upload bill receipt");
    } finally {
      setUploadingFile(false);
    }
  };

  // Instant Round Off for Sales Bill
  const handleRoundOffAmount = () => {
    const val = parseFloat(amount);
    if (Number.isFinite(val) && val > 0) {
      const floored = Math.floor(val);
      setAmount(String(floored));
      showToast(`✂️ Rounded down to SAR ${floored}.00`);
    }
  };

  // Submit Handler
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const numAmt = parseFloat(amount);
    if (!Number.isFinite(numAmt) || numAmt <= 0) {
      setErrorMsg("Please enter a valid SAR amount greater than 0.");
      amountInputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const clientTxnId = `expr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const nowTime = saudiTime12(new Date(), true);

    try {
      let pocketType: PocketType = "EXPENSE";
      let category = "";
      let recipientName = "";
      let paymentSource = "DRAWER_CASH";
      let paymentMode = "CASH";
      let supplierInvoiceNum: string | null = null;
      let finalNote = notes.trim();

      if (activeType === "EXPENSE") {
        pocketType = "EXPENSE";
        category = expenseCategory;
        recipientName = "Express Logger";
        paymentSource = expensePaymentMode === "BANK_TRANSFER" ? "BANK_TRANSFER" : "DRAWER_CASH";
        paymentMode = expensePaymentMode;
      } else if (activeType === "PURCHASE") {
        pocketType = "PURCHASE";
        category = purchasePaymentMode === "CREDIT" ? "Credit Purchase" : "Cash Purchase";
        recipientName = purchaseSupplier.trim() || "Supplier Purchase";
        paymentSource = purchasePaymentMode === "CREDIT" ? "SUPPLIER_CREDIT" : purchasePaymentMode === "BANK_TRANSFER" ? "BANK_TRANSFER" : "DRAWER_CASH";
        paymentMode = purchasePaymentMode;
        supplierInvoiceNum = purchaseInvoiceRef.trim() || null;
      } else if (activeType === "SALES_BILL") {
        pocketType = "POS_SALE"; // Mapped into pocket
        category = "Sales Invoice";
        recipientName = salesCustomer.trim() || "Retail Customer";
        paymentSource = salesPaymentMode === "CASH" ? "DRAWER_CASH" : "BANK_TRANSFER";
        paymentMode = salesPaymentMode;
        supplierInvoiceNum = salesInvoiceNo.trim() || `W#JB-${Date.now().toString().slice(-6)}`;
        if (salesSeqNo.trim()) {
          finalNote = `Seq #${salesSeqNo.trim()} · ${finalNote}`.trim();
        }
      } else if (activeType === "POS_SWIPE") {
        pocketType = "POS_SALE";
        category = `${posTerminal} · ${posNetwork}`;
        recipientName = "Manual POS Entry";
        paymentSource = posTerminal === "BANK_TRANSFER" ? "BANK_TRANSFER" : "BANK_TRANSFER";
        paymentMode = "CARD";
        supplierInvoiceNum = posSlipNo.trim() || `POS-${Date.now().toString().slice(-6)}`;
      } else if (activeType === "SALES_RETURN") {
        pocketType = "EXPENSE"; // Mapped for outflow ledger
        category = `Sales Return (${returnRefundMode})`;
        recipientName = returnCustomer.trim() || "Customer Return";
        paymentSource = returnRefundMode === "CASH_REFUND" ? "DRAWER_CASH" : "BANK_TRANSFER";
        paymentMode = returnRefundMode === "CASH_REFUND" ? "CASH" : returnRefundMode === "CARD_BANK_REVERSAL" ? "CARD" : "CREDIT";
        supplierInvoiceNum = returnInvoiceNo.trim() || `RET-${Date.now().toString().slice(-6)}`;
        finalNote = `Return Reason: ${returnReason}${returnSalesNo.trim() ? ` · Seq #${returnSalesNo.trim()}` : ""}${notes.trim() ? ` · Note: ${notes.trim()}` : ""}`;

        // Also save to dedicated SalesReturnRecord model
        void fetch("/api/sales-returns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientTxnId,
            branch: branchId,
            invoiceNo: supplierInvoiceNum,
            salesNo: returnSalesNo.trim() || null,
            customerName: returnCustomer.trim() || null,
            returnedAmount: numAmt,
            originalAmount: numAmt,
            refundMode: returnRefundMode,
            reason: returnReason,
            notes: notes.trim() || null,
            returnDate: effectiveDate,
          }),
        });
      }

      // Post to /api/pocket (authoritative real-time sync with mobile PWA)
      const res = await fetch("/api/pocket", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-branch-id": branchId,
          "x-user-is-owner": isOwner ? "true" : "false",
          "x-user-role": currentUserRole,
        },
        body: JSON.stringify({
          clientTxnId,
          branch: branchId,
          type: pocketType,
          amount: numAmt,
          category,
          recipientName,
          paymentSource,
          paymentMode,
          terminal: activeType === "POS_SWIPE" ? posTerminal : activeType === "SALES_BILL" && salesPaymentMode === "CARD" ? salesTerminal : undefined,
          cardNetwork: activeType === "POS_SWIPE" ? posNetwork : activeType === "SALES_BILL" && salesPaymentMode === "CARD" ? salesNetwork : undefined,
          isManualPos: activeType === "POS_SWIPE",
          supplierInvoiceNum,
          hasBill,
          billPdfUrl,
          billFileName: billFile?.name,
          followUpDate: purchaseFollowUpDate,
          note: `[Desktop Express] ${finalNote}`,
          date: effectiveDate,
        }),
      });

      if (res.ok) {
        showToast(`⚡ Logged ${activeType.replace("_", " ")}: SAR ${fmt(numAmt)}`);

        // Notify parent register session
        if (onSyncWithRegister) {
          onSyncWithRegister({
            type: activeType,
            payload: {
              clientTxnId,
              amount: numAmt,
              category,
              recipientName,
              paymentMode,
              invoiceNo: supplierInvoiceNum,
              salesNo: activeType === "SALES_BILL" ? salesSeqNo : activeType === "SALES_RETURN" ? returnSalesNo : undefined,
              time: nowTime,
              hasBill,
              billPdfUrl,
            },
          });
        }

        // Reset fields
        setAmount("");
        setNotes("");
        setHasBill(false);
        setBillFile(null);
        setBillPdfUrl(null);
        if (activeType === "SALES_BILL") {
          setSalesInvoiceNo("");
          setSalesSeqNo("");
        } else if (activeType === "POS_SWIPE") {
          setPosSlipNo("");
        } else if (activeType === "SALES_RETURN") {
          setReturnInvoiceNo("");
          setReturnSalesNo("");
        }

        // Refresh live activity feed
        void loadFeed();

        // Re-focus amount for continuous speed
        setTimeout(() => {
          amountInputRef.current?.focus();
        }, 30);
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrorMsg(errData.error || "Failed to log entry to server.");
      }
    } catch (err) {
      console.error("Express log error:", err);
      setErrorMsg("Network error. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  // Undo / Delete entry
  const handleDeleteFeedItem = async (id: string) => {
    try {
      const res = await fetch(`/api/pocket?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          "x-user-is-owner": isOwner ? "true" : "false",
          "x-user-role": currentUserRole,
        },
      });
      if (res.ok) {
        setActivityFeed((prev) => prev.filter((item) => item.id !== id));
        showToast("↩ Entry undone and removed from register.");
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 lg:p-8 w-full gap-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-jct-yellow p-2 text-jct-charcoal shadow-sm">
              <Zap size={22} className="fill-current" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-jct-charcoal dark:text-white tracking-tight">
              Express Quick-Log
            </h2>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Rapid, unified data entry for {branchName} · Instant real-time two-way sync with Mobile PWA.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 font-mono">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Sync Active
          </span>
          <button
            type="button"
            onClick={loadFeed}
            disabled={feedLoading}
            className="p-2 rounded-lg border border-slate-200 dark:border-[#1F1F1F] bg-white dark:bg-[#111] text-slate-400 hover:text-white transition"
            title="Refresh feed"
          >
            <RefreshCw size={14} className={feedLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Main Grid: Form on Left, Live Feed on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Panel: Fast-Entry Form (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1F1F1F] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
          {/* Top Transaction Type Switcher */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Select Transaction Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              <button
                type="button"
                onClick={() => setActiveType("EXPENSE")}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all ${
                  activeType === "EXPENSE"
                    ? "bg-rose-500 text-white border-rose-500 shadow-sm"
                    : "bg-slate-50 dark:bg-[#121212] border-slate-200 dark:border-[#222] text-slate-600 dark:text-slate-300 hover:border-rose-400"
                }`}
              >
                <span className="text-sm">💸</span>
                <span className="mt-1">Expense</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveType("PURCHASE")}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all ${
                  activeType === "PURCHASE"
                    ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                    : "bg-slate-50 dark:bg-[#121212] border-slate-200 dark:border-[#222] text-slate-600 dark:text-slate-300 hover:border-amber-400"
                }`}
              >
                <span className="text-sm">🛒</span>
                <span className="mt-1">Purchase</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveType("SALES_BILL")}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all ${
                  activeType === "SALES_BILL"
                    ? "bg-jct-turquoise text-jct-charcoal border-jct-turquoise shadow-sm font-extrabold"
                    : "bg-slate-50 dark:bg-[#121212] border-slate-200 dark:border-[#222] text-slate-600 dark:text-slate-300 hover:border-jct-turquoise"
                }`}
              >
                <span className="text-sm">🧾</span>
                <span className="mt-1">Sales Bill</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveType("POS_SWIPE")}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all ${
                  activeType === "POS_SWIPE"
                    ? "bg-jct-yellow text-jct-charcoal border-jct-yellow shadow-sm font-extrabold"
                    : "bg-slate-50 dark:bg-[#121212] border-slate-200 dark:border-[#222] text-slate-600 dark:text-slate-300 hover:border-jct-yellow"
                }`}
              >
                <span className="text-sm">💳</span>
                <span className="mt-1">POS Swipe</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveType("SALES_RETURN")}
                className={`col-span-2 sm:col-span-1 flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all ${
                  activeType === "SALES_RETURN"
                    ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                    : "bg-slate-50 dark:bg-[#121212] border-slate-200 dark:border-[#222] text-slate-600 dark:text-slate-300 hover:border-rose-400"
                }`}
              >
                <span className="text-sm">↩</span>
                <span className="mt-1">Return</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount Input with Large Display */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Amount (SAR) *
                </label>
                {activeType === "SALES_BILL" && (
                  <button
                    type="button"
                    onClick={handleRoundOffAmount}
                    className="text-[10px] font-bold text-jct-turquoise hover:underline flex items-center gap-1"
                  >
                    ✂️ Auto Round-Off
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 rounded-2xl border-2 border-jct-turquoise/60 focus-within:border-jct-turquoise bg-slate-50 dark:bg-black px-4 py-3 transition">
                <span className="text-base font-black text-slate-400">SAR</span>
                <input
                  ref={amountInputRef}
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="0.00"
                  className="w-full bg-transparent font-mono text-3xl sm:text-4xl font-black text-jct-charcoal dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700 outline-none"
                />
              </div>
            </div>

            {/* 1. Contextual Fields: EXPENSE */}
            {activeType === "EXPENSE" && (
              <div className="space-y-3 animate-in fade-in">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Category *
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50 dark:bg-black rounded-xl border border-slate-200 dark:border-[#222]">
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setExpenseCategory(cat)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                          expenseCategory === cat
                            ? "bg-rose-500 text-white shadow-sm"
                            : "bg-white dark:bg-[#1A1A1A] text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Mode of Payment
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["CASH", "CARD", "BANK_TRANSFER"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setExpensePaymentMode(mode)}
                        className={`py-2 rounded-xl text-xs font-bold border text-center transition ${
                          expensePaymentMode === mode
                            ? "bg-jct-turquoise text-jct-charcoal border-jct-turquoise font-black"
                            : "bg-slate-50 dark:bg-[#111] border-slate-200 dark:border-[#222] text-slate-400"
                        }`}
                      >
                        {mode === "CASH" ? "💵 Cash" : mode === "CARD" ? "💳 Card" : "🏦 Bank"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 2. Contextual Fields: PURCHASE */}
            {activeType === "PURCHASE" && (
              <div className="space-y-3 animate-in fade-in">
                <PartyDropdownSelector
                  label="Supplier / Creditor *"
                  partyType="SUPPLIER"
                  branch={branchId}
                  value={purchaseSupplier}
                  onChange={(val) => setPurchaseSupplier(val)}
                  placeholder="Select or enter supplier name..."
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Supplier Invoice No.
                    </label>
                    <input
                      type="text"
                      value={purchaseInvoiceRef}
                      onChange={(e) => setPurchaseInvoiceRef(e.target.value)}
                      placeholder="e.g. INV-98745"
                      className="w-full rounded-xl border border-slate-300 dark:border-[#222] bg-slate-50 dark:bg-black px-3.5 py-2 text-xs font-mono font-bold text-white outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Payment Mode
                    </label>
                    <select
                      value={purchasePaymentMode}
                      onChange={(e) => setPurchasePaymentMode(e.target.value as any)}
                      className="w-full rounded-xl border border-slate-300 dark:border-[#222] bg-slate-50 dark:bg-black px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-500"
                    >
                      <option value="CASH">Cash Purchase</option>
                      <option value="CARD">Card Purchase</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CREDIT">Credit / Pay Later</option>
                    </select>
                  </div>
                </div>

                {purchasePaymentMode === "CREDIT" && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 block">
                      Quick Follow-Up Due Date:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setPurchaseFollowUpDate(addSaudiDays(3))}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold border transition ${
                          purchaseFollowUpDate === addSaudiDays(3)
                            ? "bg-amber-500 text-black border-amber-500"
                            : "bg-black/40 border-amber-500/40 text-amber-300"
                        }`}
                      >
                        +3 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => setPurchaseFollowUpDate(addSaudiDays(7))}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold border transition ${
                          purchaseFollowUpDate === addSaudiDays(7)
                            ? "bg-amber-500 text-black border-amber-500"
                            : "bg-black/40 border-amber-500/40 text-amber-300"
                        }`}
                      >
                        +1 Week
                      </button>
                      <button
                        type="button"
                        onClick={() => setPurchaseFollowUpDate(addSaudiDays(14))}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold border transition ${
                          purchaseFollowUpDate === addSaudiDays(14)
                            ? "bg-amber-500 text-black border-amber-500"
                            : "bg-black/40 border-amber-500/40 text-amber-300"
                        }`}
                      >
                        +2 Weeks
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. Contextual Fields: SALES BILL */}
            {activeType === "SALES_BILL" && (
              <div className="space-y-3 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Invoice No. (W#JB...)
                    </label>
                    <input
                      type="text"
                      value={salesInvoiceNo}
                      onChange={(e) => setSalesInvoiceNo(e.target.value)}
                      placeholder="e.g. W#JB006597"
                      className="w-full rounded-xl border border-slate-300 dark:border-[#222] bg-slate-50 dark:bg-black px-3.5 py-2 text-xs font-mono font-bold text-jct-turquoise outline-none focus:border-jct-turquoise"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Sales / Seq No. (#...)
                    </label>
                    <input
                      type="text"
                      value={salesSeqNo}
                      onChange={(e) => setSalesSeqNo(e.target.value)}
                      placeholder="e.g. #40759"
                      className="w-full rounded-xl border border-slate-300 dark:border-[#222] bg-slate-50 dark:bg-black px-3.5 py-2 text-xs font-mono font-bold text-white outline-none focus:border-jct-turquoise"
                    />
                  </div>
                </div>

                <PartyDropdownSelector
                  label="Customer / Buyer"
                  partyType="CUSTOMER"
                  branch={branchId}
                  value={salesCustomer}
                  onChange={(val) => setSalesCustomer(val)}
                  placeholder="Select or enter customer name..."
                />

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(["CASH", "CARD", "SPLIT", "CREDIT_SALE"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setSalesPaymentMode(mode)}
                        className={`py-2 rounded-xl text-xs font-bold border text-center transition ${
                          salesPaymentMode === mode
                            ? "bg-jct-turquoise text-jct-charcoal border-jct-turquoise font-black"
                            : "bg-slate-50 dark:bg-[#111] border-slate-200 dark:border-[#222] text-slate-400"
                        }`}
                      >
                        {mode === "CASH" ? "💵 Cash" : mode === "CARD" ? "💳 Card" : mode === "SPLIT" ? "⚡ Split" : "📝 Credit"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 4. Contextual Fields: POS SWIPE */}
            {activeType === "POS_SWIPE" && (
              <div className="space-y-3 animate-in fade-in">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Bank / Terminal
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {TERMINALS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setPosTerminal(t.id)}
                        className={`py-2 rounded-xl text-xs font-extrabold border transition ${
                          posTerminal === t.id
                            ? "bg-jct-turquoise text-jct-charcoal border-jct-turquoise"
                            : "bg-slate-50 dark:bg-[#111] border-slate-200 dark:border-[#222] text-slate-400"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Card Network
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {NETWORKS.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => setPosNetwork(n.id)}
                        className={`py-2 rounded-xl text-xs font-extrabold border transition ${
                          posNetwork === n.id
                            ? "bg-jct-yellow text-jct-charcoal border-jct-yellow"
                            : "bg-slate-50 dark:bg-[#111] border-slate-200 dark:border-[#222] text-slate-400"
                        }`}
                      >
                        {n.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Card Slip / RRN No. (Optional)
                  </label>
                  <input
                    type="text"
                    value={posSlipNo}
                    onChange={(e) => setPosSlipNo(e.target.value)}
                    placeholder="Slip / RRN / Ref (Optional)"
                    className="w-full rounded-xl border border-slate-300 dark:border-[#222] bg-slate-50 dark:bg-black px-3.5 py-2 text-xs font-mono font-bold text-white outline-none focus:border-jct-yellow"
                  />
                </div>
              </div>
            )}

            {/* 5. Contextual Fields: SALES RETURN */}
            {activeType === "SALES_RETURN" && (
              <div className="space-y-3 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Invoice No. (W#JB...) *
                    </label>
                    <input
                      type="text"
                      value={returnInvoiceNo}
                      onChange={(e) => setReturnInvoiceNo(e.target.value)}
                      placeholder="e.g. W#JB006597"
                      className="w-full rounded-xl border border-slate-300 dark:border-[#222] bg-slate-50 dark:bg-black px-3.5 py-2 text-xs font-mono font-bold text-rose-400 outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Sales / Seq No. (#...)
                    </label>
                    <input
                      type="text"
                      value={returnSalesNo}
                      onChange={(e) => setReturnSalesNo(e.target.value)}
                      placeholder="e.g. #40759"
                      className="w-full rounded-xl border border-slate-300 dark:border-[#222] bg-slate-50 dark:bg-black px-3.5 py-2 text-xs font-mono font-bold text-white outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      value={returnCustomer}
                      onChange={(e) => setReturnCustomer(e.target.value)}
                      placeholder="Customer Name..."
                      className="w-full rounded-xl border border-slate-300 dark:border-[#222] bg-slate-50 dark:bg-black px-3.5 py-2 text-xs font-semibold text-white outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Return Reason
                    </label>
                    <select
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-[#222] bg-slate-50 dark:bg-black px-3 py-2 text-xs font-semibold text-white outline-none focus:border-rose-500"
                    >
                      {RETURN_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Refund Mode
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setReturnRefundMode("CASH_REFUND")}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        returnRefundMode === "CASH_REFUND"
                          ? "bg-rose-500 text-white border-rose-500"
                          : "bg-slate-50 dark:bg-[#111] border-slate-200 dark:border-[#222] text-slate-400"
                      }`}
                    >
                      💵 Cash Refund
                    </button>
                    <button
                      type="button"
                      onClick={() => setReturnRefundMode("CARD_BANK_REVERSAL")}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        returnRefundMode === "CARD_BANK_REVERSAL"
                          ? "bg-rose-500 text-white border-rose-500"
                          : "bg-slate-50 dark:bg-[#111] border-slate-200 dark:border-[#222] text-slate-400"
                      }`}
                    >
                      💳 Card Reversal
                    </button>
                    <button
                      type="button"
                      onClick={() => setReturnRefundMode("CREDIT_NOTE")}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        returnRefundMode === "CREDIT_NOTE"
                          ? "bg-rose-500 text-white border-rose-500"
                          : "bg-slate-50 dark:bg-[#111] border-slate-200 dark:border-[#222] text-slate-400"
                      }`}
                    >
                      📝 Credit Note
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Description & Bill Attachment */}
            <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-[#1F1F1F]">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Description / Audit Notes
                </label>
                <label className="cursor-pointer text-[11px] font-bold text-jct-turquoise hover:underline flex items-center gap-1">
                  <Upload size={12} />
                  <span>{uploadingFile ? "Uploading..." : billPdfUrl ? "✓ Bill Attached" : "Attach Bill/Photo"}</span>
                  <input type="file" accept="image/*,application/pdf" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Remarks / Item detail / Customer reference..."
                className="w-full rounded-xl border border-slate-300 dark:border-[#222] bg-slate-50 dark:bg-black px-3.5 py-2 text-xs font-semibold text-jct-charcoal dark:text-white outline-none focus:border-jct-turquoise"
              />
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-500/15 border border-rose-500/40 p-3 text-xs text-rose-500 font-semibold">
                <AlertCircle size={15} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {toastMsg && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 p-3 text-xs text-emerald-400 font-semibold animate-in fade-in">
                <Check size={15} className="shrink-0" />
                <span>{toastMsg}</span>
              </div>
            )}

            {/* Submit Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-jct-turquoise hover:brightness-95 disabled:opacity-60 text-jct-charcoal font-black py-3 text-sm shadow-md transition"
              >
                <Zap size={16} className="fill-current" />
                <span>{submitting ? "Logging & Syncing..." : `⚡ Express Log ${activeType.replace("_", " ")}`}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Panel: Live Branch Activity Stream (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1F1F1F] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1F1F1F] pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-jct-charcoal dark:text-white flex items-center gap-2">
                <span>Today&apos;s Live Branch Feed</span>
              </h3>
              <p className="text-[11px] text-slate-400">Desktop & Mobile PWA entries synced in real time</p>
            </div>
            <span className="rounded-full bg-slate-100 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 px-2.5 py-0.5 text-[10px] font-mono font-bold text-jct-turquoise">
              {activityFeed.length} logged
            </span>
          </div>

          <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
            {activityFeed.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                <Receipt size={28} className="mx-auto text-slate-600 mb-2 opacity-50" />
                <p>No transactions logged yet today.</p>
                <p className="text-[10px] text-slate-600 mt-1">Entries logged here or in /owner-pocket show up live.</p>
              </div>
            ) : (
              activityFeed.map((item) => {
                const isMobile = (item.note || "").toLowerCase().includes("mobile") || !item.note?.includes("[Desktop Express]");
                return (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-[#111111] p-3 text-xs transition hover:border-slate-300 dark:hover:border-white/15"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isMobile ? (
                          <span className="inline-flex items-center gap-1 rounded bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.5 text-[9px] font-bold text-purple-400">
                            <Smartphone size={10} /> Mobile
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-jct-turquoise/15 border border-jct-turquoise/30 px-1.5 py-0.5 text-[9px] font-bold text-jct-turquoise">
                            <Monitor size={10} /> Desktop
                          </span>
                        )}

                        <span className="font-mono text-[10px] font-bold text-slate-400">
                          {item.type}
                        </span>

                        <span className="rounded bg-slate-200 dark:bg-white/10 px-1.5 py-0.2 text-[9px] font-semibold text-slate-400">
                          {item.paymentMode || "CASH"}
                        </span>
                      </div>

                      <div className="font-bold text-jct-charcoal dark:text-white truncate">
                        {item.recipientName || item.category || "Transaction"}
                      </div>

                      {item.note && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                          {item.note.replace(/^\[Desktop Express\]\s*/i, "")}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="font-mono text-xs font-black text-jct-charcoal dark:text-white">
                        SAR {fmt(item.amount)}
                      </span>

                      <div className="flex items-center gap-1">
                        {item.billPdfUrl && onPreviewBill && (
                          <button
                            type="button"
                            onClick={() => onPreviewBill(item.billPdfUrl!)}
                            className="p-1 rounded text-jct-turquoise hover:bg-jct-turquoise/20 transition"
                            title="View Attached Bill Receipt"
                          >
                            <Eye size={12} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteFeedItem(item.id)}
                          className="p-1 rounded text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition"
                          title="Undo this entry"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
