"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  POCKET_BRANCHES,
  POCKET_CUSTOMERS_KEY,
  postPocketTransaction,
  todayIso,
  usePocketTransactions,
  type BranchId,
  type NewPocketTransaction,
  type PocketTransaction,
  type PocketType,
} from "../../lib/pocket-bridge";
import {
  Users, Plus, X,
  RotateCcw, CheckCircle2,
  CalendarDays, Trash2, Search
} from "lucide-react";

/** Client-side convenience PIN (NOT real security). Override with NEXT_PUBLIC_OWNER_PIN. */
const OWNER_PIN = process.env.NEXT_PUBLIC_OWNER_PIN || "1234";

const EXPENSE_CATEGORIES = ["Fuel / Vehicle", "Shop Maintenance", "Food & Refreshments", "Freight", "Misc"];
const ADVANCE_PURPOSES = ["Salary Advance", "Daily Lunch / Travel Allowance", "Shop Runner Float"];
const FALLBACK_CUSTOMERS = ["Al-Hamad Contracting", "Gulf Coast Painters", "Eastern Province Builders"];

type UniversalPaymentMode = "CASH" | "SAB" | "AL_RAJHI" | "SNB" | "VISA" | "MADA" | "BANK_TRANSFER";

const UNIVERSAL_PAYMENT_MODES: { value: UniversalPaymentMode; label: string; short: string }[] = [
  { value: "CASH", label: "💵 Cash", short: "💵 Cash" },
  { value: "SAB", label: "🏦 SAB (Saudi Awwal Bank)", short: "🏦 SAB" },
  { value: "AL_RAJHI", label: "🏦 Al Rajhi", short: "🏦 Al Rajhi" },
  { value: "SNB", label: "🏦 SNB", short: "🏦 SNB" },
  { value: "VISA", label: "💳 VISA", short: "💳 VISA" },
  { value: "MADA", label: "💳 Mada", short: "💳 Mada" },
  { value: "BANK_TRANSFER", label: "🏦 Bank Transfer", short: "🏦 Bank Transfer" },
];

function formatPaymentModeBadge(mode?: string | null): { label: string; cls: string } {
  const m = (mode || "CASH").toUpperCase();
  if (m === "SAB") return { label: "🏦 SAB", cls: "border-[#00BAC7]/40 bg-[#00BAC7]/15 text-[#22D3EE]" };
  if (m === "AL_RAJHI") return { label: "🏦 Al Rajhi", cls: "border-emerald-400/40 bg-emerald-500/15 text-emerald-300" };
  if (m === "SNB") return { label: "🏦 SNB", cls: "border-teal-400/40 bg-teal-500/15 text-teal-300" };
  if (m === "VISA") return { label: "💳 VISA", cls: "border-purple-400/40 bg-purple-500/15 text-purple-300" };
  if (m === "MADA") return { label: "💳 Mada", cls: "border-sky-400/40 bg-sky-500/15 text-sky-300" };
  if (m === "BANK_TRANSFER") return { label: "🏦 Bank Transfer", cls: "border-[#FFD200]/40 bg-[#FFD200]/15 text-[#FFD200]" };
  return { label: "💵 Cash", cls: "border-white/20 bg-white/10 text-slate-200" };
}

interface StaffMember {
  id: string;
  name: string;
  branch: string;
  role: string | null;
  baseSalary: number;
  phone: string | null;
  iqamaNumber: string | null;
  status: string;
  createdAt: string;
  payrollLogs?: PayrollLogItem[];
}

interface PayrollLogItem {
  id: string;
  staffId: string;
  type: string;
  amount: number;
  date: string;
  branch: string;
  note: string | null;
  source: string;
  paymentMode?: string | null;
  createdAt: string;
}

const subscribeStorage = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function Pills<T extends string>({
  options,
  value,
  onChange,
  render,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  render?: (v: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
            value === o
              ? "border-[#FFD200] bg-[#FFD200] text-black shadow-sm"
              : "border-white/10 bg-[#061416] text-slate-300 hover:border-white/20"
          }`}
        >
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-[#00BAC7]/25 bg-[#061416] px-4 py-3 text-base text-white outline-none placeholder:text-slate-500 focus:border-[#00BAC7]";
const labelCls = "mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400";

function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const press = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError(false);
    if (next.length === 4) {
      if (next === OWNER_PIN) onUnlock();
      else {
        setError(true);
        setTimeout(() => setPin(""), 350);
      }
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center bg-[#040D0E] p-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFD200] to-[#FACC15] text-xl font-black text-black shadow-[0_0_25px_rgba(255,210,0,0.35)]">
        JCT
      </div>
      <h1 className="mt-5 text-2xl font-extrabold text-white">👑 BONGSI Pocket</h1>
      <p className="mt-1 text-sm text-slate-400">Enter Owner PIN · Nazim &amp; Nadeem</p>
      <div className="mt-6 flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full border ${
              error ? "border-rose-400 bg-rose-400" : i < pin.length ? "border-[#00BAC7] bg-[#00BAC7]" : "border-white/30"
            }`}
          />
        ))}
      </div>
      {error && <p className="mt-3 text-xs font-bold text-rose-400">Incorrect PIN</p>}
      <div className="mt-8 grid w-full max-w-[260px] grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) =>
          k === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => (k === "⌫" ? setPin(pin.slice(0, -1)) : press(k))}
              className="h-16 rounded-2xl border border-[#00BAC7]/20 bg-[#0B1E21] text-2xl font-bold text-white active:bg-[#00BAC7]/20"
            >
              {k}
            </button>
          )
        )}
      </div>
    </div>
  );
}

function BranchPicker({ value, onChange }: { value: BranchId; onChange: (b: BranchId) => void }) {
  return (
    <Pills
      options={POCKET_BRANCHES.map((b) => b.id)}
      value={value}
      onChange={onChange}
      render={(id) => POCKET_BRANCHES.find((b) => b.id === id)?.short ?? id}
    />
  );
}

export default function OwnerPocketPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [activeTab, setActiveTab] = useState<"actions" | "payroll">("actions");
  const [branch, setBranch] = useState<BranchId>("JCT_HQ");
  const [action, setAction] = useState<PocketType | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Expense form
  const [eBranch, setEBranch] = useState<BranchId>("JCT_HQ");
  const [eAmount, setEAmount] = useState("");
  const [eCat, setECat] = useState(EXPENSE_CATEGORIES[0]);
  const [eSource, setESource] = useState<"DRAWER" | "POCKET">("DRAWER");
  const [ePaymentMode, setEPaymentMode] = useState<UniversalPaymentMode>("CASH");
  const [eNote, setENote] = useState("");

  // Advance form
  const [aBranch, setABranch] = useState<BranchId>("JCT_HQ");
  const [aName, setAName] = useState("");
  const [aStaffId, setAStaffId] = useState("");
  const [aAmount, setAAmount] = useState("");
  const [aPurpose, setAPurpose] = useState(ADVANCE_PURPOSES[0]);
  const [aPaymentMode, setAPaymentMode] = useState<UniversalPaymentMode>("CASH");
  const [branchStaffList, setBranchStaffList] = useState<StaffMember[]>([]);

  // Collection form
  const [cBranch, setCBranch] = useState<BranchId>("JCT_HQ");
  const [cName, setCName] = useState("");
  const [cRef, setCRef] = useState("");
  const [cAmount, setCAmount] = useState("");
  const [cTender, setCTender] = useState<"CASH_TO_OWNER" | "BANK_TRANSFER">("CASH_TO_OWNER");
  const [cPaymentMode, setCPaymentMode] = useState<UniversalPaymentMode>("CASH");

  const [saving, setSaving] = useState(false);

  // Edit Pocket Transaction State
  const [editingPocketTx, setEditingPocketTx] = useState<PocketTransaction | null>(null);
  const [editPocketAmt, setEditPocketAmt] = useState("");
  const [editPocketCat, setEditPocketCat] = useState("");
  const [editPocketMode, setEditPocketMode] = useState<UniversalPaymentMode>("CASH");
  const [editPocketNote, setEditPocketNote] = useState("");

  // ────────────────────────────────────────────────────────────────────────
  // PAYROLL PORTAL STATE
  // ────────────────────────────────────────────────────────────────────────
  const [payrollBranch, setPayrollBranch] = useState<BranchId | "ALL">("ALL");
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffSearch, setStaffSearch] = useState("");

  // Modals for Mobile Payroll
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [selectedStaffForLedger, setSelectedStaffForLedger] = useState<StaffMember | null>(null);
  const [ledgerLogs, setLedgerLogs] = useState<PayrollLogItem[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Disburse Form
  const [disburseAmount, setDisburseAmount] = useState("");
  const [disburseSource, setDisburseSource] = useState<"BANK_TRANSFER" | "REGISTER_DRAWER" | "OWNER_POCKET">("BANK_TRANSFER");
  const [disbursePaymentMode, setDisbursePaymentMode] = useState<UniversalPaymentMode>("SAB");
  const [disburseNote, setDisburseNote] = useState("");
  const [isSubmittingDisburse, setIsSubmittingDisburse] = useState(false);

  // Quick Adjustment in Ledger
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [adjType, setAdjType] = useState<"ADVANCE" | "BONUS" | "DEDUCTION">("ADVANCE");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjSource, setAdjSource] = useState<"REGISTER_DRAWER" | "OWNER_POCKET" | "BANK_TRANSFER">("REGISTER_DRAWER");
  const [adjPaymentMode, setAdjPaymentMode] = useState<UniversalPaymentMode>("CASH");
  const [adjNote, setAdjNote] = useState("");
  const [isSavingAdj, setIsSavingAdj] = useState(false);

  // Edit PayrollLog on Mobile
  const [editingPayrollLog, setEditingPayrollLog] = useState<PayrollLogItem | null>(null);
  const [editLogAmt, setEditLogAmt] = useState("");
  const [editLogMode, setEditLogMode] = useState<UniversalPaymentMode>("CASH");
  const [editLogNote, setEditLogNote] = useState("");

  // Add Staff Form
  const [newName, setNewName] = useState("");
  const [newBranch, setNewBranch] = useState<BranchId>("JCT_HQ");
  const [newRole, setNewRole] = useState("Cashier");
  const [newSalary, setNewSalary] = useState("3500");
  const [newPhone, setNewPhone] = useState("");
  const [newIqama, setNewIqama] = useState("");
  const [isAddingStaff, setIsAddingStaff] = useState(false);

  const customersRaw = useSyncExternalStore(
    subscribeStorage,
    () => window.localStorage.getItem(POCKET_CUSTOMERS_KEY) ?? "",
    () => ""
  );

  // Live feed straight from Neon (all branches, today), polled every few seconds
  const { transactions, refresh } = usePocketTransactions("ALL", unlocked);
  const recent = transactions.slice(-5).reverse();

  let customerNames: string[] = FALLBACK_CUSTOMERS;
  try {
    const parsed = JSON.parse(customersRaw || "[]");
    if (Array.isArray(parsed) && parsed.length) customerNames = parsed as string[];
  } catch {
    /* fallback */
  }
  const customerMatches = cName.trim().length >= 2
    ? customerNames.filter((n) => n.toLowerCase().includes(cName.trim().toLowerCase())).slice(0, 4)
    : [];

  const branchFull = (id: BranchId) => POCKET_BRANCHES.find((b) => b.id === id)?.full ?? id;
  const branchShort = (id: BranchId) => POCKET_BRANCHES.find((b) => b.id === id)?.short ?? id;

  // Load all staff for Payroll portal
  const loadAllStaff = async () => {
    setLoadingStaff(true);
    try {
      const q = payrollBranch !== "ALL" ? `?branch=${payrollBranch}&includeArchived=true` : "?includeArchived=true";
      const res = await fetch(`/api/staff${q}`);
      const data = await res.json();
      if (Array.isArray(data.staff)) {
        setAllStaff(data.staff);
      }
    } catch (e) {
      console.error("Failed to load staff in pocket:", e);
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    if (!unlocked || activeTab !== "payroll") return;
    let ignore = false;
    const q = payrollBranch !== "ALL" ? `?branch=${payrollBranch}&includeArchived=true` : "?includeArchived=true";
    fetch(`/api/staff${q}`)
      .then((r) => r.json())
      .then((d) => {
        if (!ignore && Array.isArray(d.staff)) {
          setAllStaff(d.staff);
        }
      })
      .catch((e) => console.error("Failed to load staff in pocket:", e))
      .finally(() => {
        if (!ignore) setLoadingStaff(false);
      });

    return () => {
      ignore = true;
    };
  }, [unlocked, activeTab, payrollBranch]);

  // Load staff options for Advance form when branch changes
  useEffect(() => {
    if (!unlocked) return;
    fetch(`/api/staff?branch=${aBranch}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.staff)) {
          setBranchStaffList(d.staff);
        }
      })
      .catch((e) => console.error("Error loading advance branch staff:", e));
  }, [unlocked, aBranch]);

  const finish = async (tx: NewPocketTransaction, msg: string): Promise<boolean> => {
    setSaving(true);
    try {
      await postPocketTransaction(tx);
      setToast(msg);
      setAction(null);
      refresh();
      setTimeout(() => setToast(null), 3500);
      return true;
    } catch {
      setToast("Could not reach the database. Nothing was saved, please retry.");
      setTimeout(() => setToast(null), 4500);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveExpense = async () => {
    const amount = parseFloat(eAmount);
    if (!(amount > 0) || saving) return;
    const ok = await finish(
      {
        branch: eBranch,
        type: "EXPENSE",
        amount,
        category: eCat,
        recipientName: null,
        paymentSource: eSource === "POCKET" ? "OWNER_POCKET" : "DRAWER_CASH",
        paymentMode: ePaymentMode,
        note: eNote.trim() || null,
        date: todayIso(),
      },
      `Expense SAR ${fmt(amount)} saved · ${branchShort(eBranch)}`
    );
    if (ok) {
      setEAmount("");
      setENote("");
    }
  };

  const saveAdvance = async () => {
    const amount = parseFloat(aAmount);
    if (!(amount > 0) || !aName.trim() || saving) return;

    // 1. Post to PocketTransaction (shared drawer / pocket feed)
    const ok = await finish(
      {
        branch: aBranch,
        type: "ADVANCE",
        amount,
        category: aPurpose,
        recipientName: aName.trim(),
        paymentSource: "DRAWER_CASH",
        paymentMode: aPaymentMode,
        note: null,
        date: todayIso(),
      },
      `Advance SAR ${fmt(amount)} to ${aName.trim()} saved`
    );

    // 2. If a staff was selected, also post directly to /api/payroll
    if (ok && aStaffId) {
      fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: aStaffId,
          type: "ADVANCE",
          amount,
          branch: aBranch,
          date: todayIso(),
          note: `Mobile Owner Pocket: ${aPurpose}`,
          source: "DRAWER_CASH",
          paymentMode: aPaymentMode,
        }),
      }).catch((e) => console.error("Error creating payroll log from pocket:", e));
    }

    if (ok) {
      setAAmount("");
      setAName("");
      setAStaffId("");
    }
  };

  const saveCollection = async () => {
    const amount = parseFloat(cAmount);
    if (!(amount > 0) || !cName.trim() || saving) return;
    const ok = await finish(
      {
        branch: cBranch,
        type: "CREDIT_COLLECTION",
        amount,
        category: cRef.trim() || null,
        recipientName: cName.trim(),
        paymentSource: cTender === "CASH_TO_OWNER" ? "DRAWER_CASH" : "BANK_TRANSFER",
        paymentMode: cPaymentMode,
        note: cTender === "CASH_TO_OWNER" ? "Cash Handed to Owner" : "Bank Transfer to SAB / Rajhi",
        date: todayIso(),
      },
      `Collected SAR ${fmt(amount)} from ${cName.trim()}`
    );
    if (ok) {
      setCAmount("");
      setCName("");
      setCRef("");
    }
  };

  const handleSavePocketTxEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPocketTx) return;
    try {
      const res = await fetch("/api/pocket", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-is-owner": "true",
          "x-user-role": "OWNER",
        },
        body: JSON.stringify({
          id: editingPocketTx.id,
          amount: parseFloat(editPocketAmt) || editingPocketTx.amount,
          category: editPocketCat || editingPocketTx.category,
          paymentMode: editPocketMode,
          note: editPocketNote || null,
        }),
      });
      if (res.ok) {
        setEditingPocketTx(null);
        refresh();
        setToast("Transaction updated!");
        setTimeout(() => setToast(null), 3000);
      }
    } catch {
      /* ignore */
    }
  };

  const handleDeletePocketTx = async (id: string) => {
    try {
      const res = await fetch(`/api/pocket?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          "x-user-is-owner": "true",
          "x-user-role": "OWNER",
        },
      });
      if (res.ok) {
        refresh();
        setToast("Transaction deleted.");
        setTimeout(() => setToast(null), 3000);
      }
    } catch {
      /* ignore */
    }
  };

  // Helper calculations for staff member in selected month
  const getStaffMonthStats = (staff: StaffMember) => {
    const logs = staff.payrollLogs || [];
    const monthLogs = logs.filter((l) => l.date.startsWith(selectedMonth));
    const advances = monthLogs
      .filter((l) => l.type === "ADVANCE")
      .reduce((sum, l) => sum + l.amount, 0);
    const payouts = monthLogs
      .filter((l) => l.type === "SALARY_PAYOUT")
      .reduce((sum, l) => sum + l.amount, 0);
    const bonuses = monthLogs
      .filter((l) => l.type === "BONUS")
      .reduce((sum, l) => sum + l.amount, 0);
    const deductions = monthLogs
      .filter((l) => l.type === "DEDUCTION")
      .reduce((sum, l) => sum + l.amount, 0);

    const netRemaining = Math.max(0, staff.baseSalary + bonuses - advances - deductions - payouts);

    return {
      advances,
      payouts,
      bonuses,
      deductions,
      netRemaining,
    };
  };

  // Load detailed logs for single staff
  const openStaffLedger = async (staff: StaffMember) => {
    setSelectedStaffForLedger(staff);
    setLoadingLedger(true);
    setShowAdjustForm(false);
    setEditingPayrollLog(null);
    try {
      const res = await fetch(`/api/payroll?staffId=${staff.id}`);
      const data = await res.json();
      if (Array.isArray(data.logs)) {
        setLedgerLogs(data.logs);
      } else {
        setLedgerLogs(staff.payrollLogs || []);
      }
    } catch {
      setLedgerLogs(staff.payrollLogs || []);
    } finally {
      setLoadingLedger(false);
    }
  };

  // Handle Disburse Salary from Mobile
  const handleDisburseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffForLedger) return;
    const amount = parseFloat(disburseAmount);
    if (Number.isNaN(amount) || amount <= 0) return;

    setIsSubmittingDisburse(true);
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-is-owner": "true",
          "x-user-role": "OWNER",
        },
        body: JSON.stringify({
          staffId: selectedStaffForLedger.id,
          type: "SALARY_PAYOUT",
          amount,
          source: disburseSource,
          paymentMode: disbursePaymentMode,
          date: todayIso(),
          note: disburseNote.trim() || `Mobile Salary Disbursed (${selectedMonth})`,
        }),
      });

      if (res.ok) {
        setDisburseAmount("");
        setDisburseNote("");
        setToast(`Disbursed SAR ${fmt(amount)} to ${selectedStaffForLedger.name}!`);
        await loadAllStaff();
        openStaffLedger(selectedStaffForLedger);
        setTimeout(() => setToast(null), 3500);
      }
    } catch {
      setToast("Failed to record salary payout.");
      setTimeout(() => setToast(null), 3500);
    } finally {
      setIsSubmittingDisburse(false);
    }
  };

  // Handle Add Adjustment from Mobile
  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffForLedger) return;
    const amount = parseFloat(adjAmount);
    if (Number.isNaN(amount) || amount <= 0) return;

    setIsSavingAdj(true);
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-is-owner": "true",
          "x-user-role": "OWNER",
        },
        body: JSON.stringify({
          staffId: selectedStaffForLedger.id,
          type: adjType,
          amount,
          source: adjSource,
          paymentMode: adjPaymentMode,
          date: todayIso(),
          note: adjNote.trim() || `${adjType} recorded from mobile portal`,
        }),
      });

      if (res.ok) {
        setAdjAmount("");
        setAdjNote("");
        setShowAdjustForm(false);
        setToast(`Recorded ${adjType} of SAR ${fmt(amount)}`);
        await loadAllStaff();
        openStaffLedger(selectedStaffForLedger);
        setTimeout(() => setToast(null), 3500);
      }
    } catch {
      setToast("Failed to record adjustment.");
      setTimeout(() => setToast(null), 3500);
    } finally {
      setIsSavingAdj(false);
    }
  };

  const handleSavePayrollLogEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayrollLog || !selectedStaffForLedger) return;
    try {
      const res = await fetch("/api/payroll", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-is-owner": "true",
          "x-user-role": "OWNER",
        },
        body: JSON.stringify({
          id: editingPayrollLog.id,
          amount: parseFloat(editLogAmt) || editingPayrollLog.amount,
          paymentMode: editLogMode,
          note: editLogNote.trim() || null,
        }),
      });
      if (res.ok) {
        setEditingPayrollLog(null);
        await loadAllStaff();
        openStaffLedger(selectedStaffForLedger);
        setToast("Ledger entry updated!");
        setTimeout(() => setToast(null), 3000);
      }
    } catch {
      /* ignore */
    }
  };

  const handleDeletePayrollLog = async (id: string) => {
    if (!selectedStaffForLedger) return;
    try {
      const res = await fetch(`/api/payroll?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          "x-user-is-owner": "true",
          "x-user-role": "OWNER",
        },
      });
      if (res.ok) {
        await loadAllStaff();
        openStaffLedger(selectedStaffForLedger);
        setToast("Ledger entry deleted.");
        setTimeout(() => setToast(null), 3000);
      }
    } catch {
      /* ignore */
    }
  };

  // Handle Add Staff from Mobile
  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsAddingStaff(true);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-is-owner": "true",
          "x-user-role": "OWNER",
        },
        body: JSON.stringify({
          name: newName.trim(),
          branch: newBranch,
          role: newRole.trim() || "Staff",
          baseSalary: parseFloat(newSalary) || 0,
          phone: newPhone.trim() || undefined,
          iqamaNumber: newIqama.trim() || undefined,
        }),
      });
      if (res.ok) {
        setShowAddStaffModal(false);
        setNewName("");
        setNewPhone("");
        setNewIqama("");
        setToast(`Added employee ${newName.trim()} successfully!`);
        await loadAllStaff();
        setTimeout(() => setToast(null), 3500);
      }
    } catch {
      setToast("Failed to create staff member.");
      setTimeout(() => setToast(null), 3500);
    } finally {
      setIsAddingStaff(false);
    }
  };

  // Archive / Restore Staff Member
  const handleToggleArchive = async (staff: StaffMember) => {
    const nextStatus = staff.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";
    try {
      const res = await fetch("/api/staff", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-is-owner": "true",
          "x-user-role": "OWNER",
        },
        body: JSON.stringify({ id: staff.id, status: nextStatus }),
      });
      if (res.ok) {
        loadAllStaff();
        setToast(`Employee status updated to ${nextStatus}`);
        setTimeout(() => setToast(null), 3000);
      }
    } catch {
      /* ignore */
    }
  };

  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />;

  const statusFor = (e: PocketTransaction) => {
    if (e.type === "EXPENSE" && e.paymentSource === "OWNER_POCKET") return "Recorded · Owner pocket";
    if (e.type === "CREDIT_COLLECTION" && e.paymentSource === "BANK_TRANSFER") return "Synced to Credit Radar";
    if (e.branch !== "JCT_HQ") return "Saved · Branch register";
    return "Synced to Branch Drawer";
  };

  const kindLabel = (k: PocketType) =>
    k === "EXPENSE" ? "💸 Expense" : k === "ADVANCE" ? "🤝 Advance" : "💵 Collection";

  // Filtered staff for mobile list
  const filteredStaff = allStaff.filter((s) => {
    if (payrollBranch !== "ALL" && s.branch !== payrollBranch) return false;
    if (!staffSearch.trim()) return true;
    const q = staffSearch.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.role || "").toLowerCase().includes(q);
  });

  // Payroll KPIs
  const activeStaffList = allStaff.filter(
    (s) => s.status === "ACTIVE" && (payrollBranch === "ALL" || s.branch === payrollBranch)
  );
  const totalBasePayroll = activeStaffList.reduce((acc, s) => acc + s.baseSalary, 0);
  const totalAdvancesThisMonth = activeStaffList.reduce((acc, s) => acc + getStaffMonthStats(s).advances, 0);
  const totalNetDue = activeStaffList.reduce((acc, s) => acc + getStaffMonthStats(s).netRemaining, 0);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-between bg-[#040D0E] p-4 text-white">
      <div className="space-y-4">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-extrabold flex items-center gap-2">
              👑 BONGSI Pocket
              <span className="rounded-full bg-[#FFD200]/15 border border-[#FFD200]/30 px-2 py-0.5 text-[10px] font-bold text-[#FFD200]">
                Owner
              </span>
            </h1>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Neon Live Sync Active
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#FFD200] to-[#FACC15] text-xs font-black text-black shadow-[0_0_15px_rgba(255,210,0,0.3)]">
            JCT
          </div>
        </header>

        {/* Navigation Tabs Switcher */}
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[#061416] p-1 border border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab("actions")}
            className={`rounded-xl py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === "actions"
                ? "bg-[#00BAC7] text-black shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>⚡ Quick Actions</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("payroll")}
            className={`rounded-xl py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === "payroll"
                ? "bg-[#FFD200] text-black shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Users size={14} />
            <span>Staff &amp; Payroll</span>
          </button>
        </div>

        {toast && (
          <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300 animate-fadeIn">
            ✅ {toast}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            VIEW 1: QUICK LEDGER ACTIONS
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === "actions" && (
          <>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {POCKET_BRANCHES.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setBranch(b.id);
                    setEBranch(b.id);
                    setABranch(b.id);
                    setCBranch(b.id);
                  }}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold ${
                    branch === b.id
                      ? "border-[#00BAC7] bg-[#00BAC7]/20 text-[#22D3EE]"
                      : "border-white/10 bg-[#0B1E21] text-slate-400"
                  }`}
                >
                  {b.full}
                </button>
              ))}
            </div>

            {/* Action cards */}
            {action === null && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setAction("EXPENSE")}
                  className="w-full rounded-2xl bg-[#FFD200] p-5 text-left text-black shadow-[0_0_20px_rgba(255,210,0,0.25)] active:scale-[0.98] transition"
                >
                  <span className="block text-xl font-extrabold">💸 Quick Shop / Road Expense</span>
                  <span className="text-xs font-semibold opacity-70">Fuel, maintenance, food, freight</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAction("ADVANCE")}
                  className="w-full rounded-2xl bg-[#00BAC7] p-5 text-left text-black shadow-[0_0_20px_rgba(0,186,199,0.25)] active:scale-[0.98] transition"
                >
                  <span className="block text-xl font-extrabold">🤝 Staff Cash Advance</span>
                  <span className="text-xs font-semibold opacity-70">Tap staff name &amp; auto-link to monthly payroll</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAction("CREDIT_COLLECTION")}
                  className="w-full rounded-2xl bg-emerald-400 p-5 text-left text-black shadow-[0_0_20px_rgba(52,211,153,0.25)] active:scale-[0.98] transition"
                >
                  <span className="block text-xl font-extrabold">💵 Roadside Credit Collection</span>
                  <span className="text-xs font-semibold opacity-70">Collect from a customer or contractor</span>
                </button>
              </div>
            )}

            {/* Expense form */}
            {action === "EXPENSE" && (
              <section className="space-y-4 rounded-2xl border border-[#FFD200]/30 bg-[#081517] p-4">
                <h2 className="text-lg font-extrabold text-[#FFD200]">💸 Quick Shop / Road Expense</h2>
                <div>
                  <span className={labelCls}>Target Branch</span>
                  <BranchPicker value={eBranch} onChange={setEBranch} />
                </div>
                <div>
                  <label className={labelCls}>Amount (SAR)</label>
                  <input
                    inputMode="decimal"
                    value={eAmount}
                    onChange={(e) => setEAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="0.00"
                    className={`${inputCls} text-3xl font-black`}
                  />
                </div>
                <div>
                  <span className={labelCls}>Category</span>
                  <Pills options={EXPENSE_CATEGORIES} value={eCat} onChange={setECat} />
                </div>
                <div>
                  <span className={labelCls}>Payment Source</span>
                  <Pills
                    options={["DRAWER", "POCKET"] as const}
                    value={eSource}
                    onChange={setESource}
                    render={(v) => (v === "DRAWER" ? "Paid from Branch Drawer Cash" : "Paid from Owner Personal Pocket")}
                  />
                  {eSource === "POCKET" && (
                    <p className="mt-2 text-[11px] text-amber-300/80">
                      Owner-pocket expenses are recorded but not deducted from the branch drawer.
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#FFD200]">
                    Mode of Payment *
                  </label>
                  <select
                    required
                    value={ePaymentMode}
                    onChange={(e) => setEPaymentMode(e.target.value as UniversalPaymentMode)}
                    className={`${inputCls} border-[#FFD200]/40 text-[#FFD200] font-bold text-sm`}
                  >
                    {UNIVERSAL_PAYMENT_MODES.map((m) => (
                      <option key={m.value} value={m.value} className="bg-[#0B1E21] text-white">
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Note</label>
                  <input value={eNote} onChange={(e) => setENote(e.target.value)} placeholder="Short remark" className={inputCls} />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setAction(null)} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-300">
                    Cancel
                  </button>
                  <button type="button" onClick={saveExpense} disabled={!(parseFloat(eAmount) > 0)} className="flex-1 rounded-xl bg-[#FFD200] py-3 font-extrabold text-black disabled:opacity-40">
                    Save Expense
                  </button>
                </div>
              </section>
            )}

            {/* Advance form (Now with dynamic branch staff selection & payroll auto-linking!) */}
            {action === "ADVANCE" && (
              <section className="space-y-4 rounded-2xl border border-[#00BAC7]/30 bg-[#081517] p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-extrabold text-[#22D3EE]">🤝 Staff Cash Advance</h2>
                  <span className="text-[10px] text-amber-300 font-bold bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                    Auto-links to Payroll
                  </span>
                </div>

                <div>
                  <span className={labelCls}>Target Branch</span>
                  <BranchPicker value={aBranch} onChange={setABranch} />
                </div>

                {/* Quick Staff Picker Pills */}
                {branchStaffList.length > 0 && (
                  <div>
                    <span className={labelCls}>Select Registered Employee ({branchStaffList.length})</span>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                      {branchStaffList.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => {
                            setAName(st.name);
                            setAStaffId(st.id);
                          }}
                          className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                            aStaffId === st.id
                              ? "border-[#00BAC7] bg-[#00BAC7] text-black"
                              : "border-white/10 bg-[#061416] text-slate-300"
                          }`}
                        >
                          <span>{st.name}</span>
                          <span className="text-[10px] opacity-70">({st.role || "Staff"})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className={labelCls}>Staff / Recipient Name</label>
                  <input
                    value={aName}
                    onChange={(e) => {
                      setAName(e.target.value);
                      const match = branchStaffList.find(
                        (s) => s.name.toLowerCase() === e.target.value.trim().toLowerCase()
                      );
                      setAStaffId(match ? match.id : "");
                    }}
                    placeholder="Select above or type recipient name…"
                    className={inputCls}
                  />
                  {aStaffId && (
                    <p className="mt-1 text-[11px] text-emerald-400 font-medium">
                      ✓ Linked to employee record. Amount will be deducted from their monthly payroll balance.
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelCls}>Amount (SAR)</label>
                  <input
                    inputMode="decimal"
                    value={aAmount}
                    onChange={(e) => setAAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="0.00"
                    className={`${inputCls} text-3xl font-black`}
                  />
                </div>

                <div>
                  <span className={labelCls}>Purpose</span>
                  <Pills options={ADVANCE_PURPOSES} value={aPurpose} onChange={setAPurpose} />
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#FFD200]">
                    Mode of Payment *
                  </label>
                  <select
                    required
                    value={aPaymentMode}
                    onChange={(e) => setAPaymentMode(e.target.value as UniversalPaymentMode)}
                    className={`${inputCls} border-[#FFD200]/40 text-[#FFD200] font-bold text-sm`}
                  >
                    {UNIVERSAL_PAYMENT_MODES.map((m) => (
                      <option key={m.value} value={m.value} className="bg-[#0B1E21] text-white">
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <button type="button" onClick={() => setAction(null)} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-300">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveAdvance}
                    disabled={!(parseFloat(aAmount) > 0) || !aName.trim()}
                    className="flex-1 rounded-xl bg-[#00BAC7] py-3 font-extrabold text-black disabled:opacity-40"
                  >
                    Save Advance
                  </button>
                </div>
              </section>
            )}

            {/* Collection form */}
            {action === "CREDIT_COLLECTION" && (
              <section className="space-y-4 rounded-2xl border border-emerald-400/30 bg-[#081517] p-4">
                <h2 className="text-lg font-extrabold text-emerald-300">💵 Roadside Credit Collection</h2>
                <div>
                  <span className={labelCls}>Target Branch</span>
                  <BranchPicker value={cBranch} onChange={setCBranch} />
                </div>
                <div>
                  <label className={labelCls}>Customer / Contractor</label>
                  <input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Start typing to look up…" className={inputCls} />
                  {customerMatches.length > 0 && !customerNames.includes(cName) && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {customerMatches.map((n) => (
                        <button key={n} type="button" onClick={() => setCName(n)} className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Invoice # / Reference (optional)</label>
                  <input value={cRef} onChange={(e) => setCRef(e.target.value)} placeholder="#30064" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Amount Collected (SAR)</label>
                  <input
                    inputMode="decimal"
                    value={cAmount}
                    onChange={(e) => setCAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="0.00"
                    className={`${inputCls} text-3xl font-black`}
                  />
                </div>
                <div>
                  <span className={labelCls}>Payment Tender</span>
                  <Pills
                    options={["CASH_TO_OWNER", "BANK_TRANSFER"] as const}
                    value={cTender}
                    onChange={(v) => {
                      setCTender(v);
                      if (v === "BANK_TRANSFER" && cPaymentMode === "CASH") setCPaymentMode("SAB");
                      else if (v === "CASH_TO_OWNER") setCPaymentMode("CASH");
                    }}
                    render={(v) => (v === "CASH_TO_OWNER" ? "Cash Handed to Owner" : "Bank Transfer to SAB / Rajhi")}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#FFD200]">
                    Mode of Payment *
                  </label>
                  <select
                    required
                    value={cPaymentMode}
                    onChange={(e) => setCPaymentMode(e.target.value as UniversalPaymentMode)}
                    className={`${inputCls} border-[#FFD200]/40 text-[#FFD200] font-bold text-sm`}
                  >
                    {UNIVERSAL_PAYMENT_MODES.map((m) => (
                      <option key={m.value} value={m.value} className="bg-[#0B1E21] text-white">
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setAction(null)} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-300">
                    Cancel
                  </button>
                  <button type="button" onClick={saveCollection} disabled={!(parseFloat(cAmount) > 0) || !cName.trim()} className="flex-1 rounded-xl bg-emerald-400 py-3 font-extrabold text-black disabled:opacity-40">
                    Save Collection
                  </button>
                </div>
              </section>
            )}

            {/* Edit Pocket Transaction Modal */}
            {editingPocketTx && (
              <form onSubmit={handleSavePocketTxEdit} className="space-y-3 rounded-2xl border border-[#FFD200]/50 bg-[#081517] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#FFD200]">👑 Edit Mobile Entry</span>
                  <button type="button" onClick={() => setEditingPocketTx(null)} className="text-xs text-slate-400">
                    Cancel
                  </button>
                </div>
                <div>
                  <label className={labelCls}>Amount (SAR)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editPocketAmt}
                    onChange={(e) => setEditPocketAmt(e.target.value)}
                    className={`${inputCls} font-mono font-bold`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Mode of Payment</label>
                  <select
                    value={editPocketMode}
                    onChange={(e) => setEditPocketMode(e.target.value as UniversalPaymentMode)}
                    className={`${inputCls} border-[#FFD200]/40 text-[#FFD200] font-bold text-sm`}
                  >
                    {UNIVERSAL_PAYMENT_MODES.map((m) => (
                      <option key={m.value} value={m.value} className="bg-[#0B1E21] text-white">
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Note</label>
                  <input value={editPocketNote} onChange={(e) => setEditPocketNote(e.target.value)} className={inputCls} />
                </div>
                <button type="submit" className="w-full rounded-xl bg-[#FFD200] py-2.5 text-xs font-extrabold text-black">
                  💾 Update Entry
                </button>
              </form>
            )}

            {/* Activity feed */}
            <section className="mt-6 space-y-2 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#00BAC7]/80">Recent Mobile Activity</h3>
              {recent.length === 0 ? (
                <p className="rounded-xl border border-white/5 bg-[#061416] p-3 text-xs text-slate-500">
                  Nothing logged today yet.
                </p>
              ) : (
                recent.map((e) => {
                  const pBadge = formatPaymentModeBadge(e.paymentMode || (e.paymentSource === "BANK_TRANSFER" ? "BANK_TRANSFER" : "CASH"));
                  return (
                    <div key={e.id} className="rounded-xl border border-white/5 bg-[#061416] p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-bold">
                          {kindLabel(e.type)} · SAR {fmt(e.amount)}
                        </span>
                        <span className="text-[11px] text-slate-500">{hhmm(e.createdAt)}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full border border-[#00BAC7]/30 bg-[#00BAC7]/10 px-2 py-0.5 text-[#22D3EE]">
                            {branchFull(e.branch)}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 ${pBadge.cls}`}>
                            {pBadge.label}
                          </span>
                          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                            {statusFor(e)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPocketTx(e);
                              setEditPocketAmt(String(e.amount));
                              setEditPocketCat(e.category || "");
                              setEditPocketMode((e.paymentMode as UniversalPaymentMode) || "CASH");
                              setEditPocketNote(e.note || "");
                            }}
                            className="rounded border border-[#FFD200]/30 bg-[#FFD200]/10 px-2 py-0.5 text-[10px] font-bold text-[#FFD200]"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePocketTx(e.id)}
                            className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-300"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════
            VIEW 2: MOBILE STAFF & PAYROLL PORTAL
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === "payroll" && (
          <div className="space-y-4">
            {/* Top Month & Branch Selectors */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 rounded-xl border border-[#00BAC7]/30 bg-[#0B1E21] px-3 py-1.5 text-xs text-[#22D3EE] font-bold">
                <CalendarDays size={14} className="text-[#00BAC7]" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-xs font-bold text-[#22D3EE] outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowAddStaffModal(true)}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FFD200] to-[#F59E0B] px-3.5 py-1.5 text-xs font-extrabold text-black"
              >
                <Plus size={14} strokeWidth={3} />
                <span>Add Staff</span>
              </button>
            </div>

            {/* Branch Pills */}
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              <button
                type="button"
                onClick={() => setPayrollBranch("ALL")}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${
                  payrollBranch === "ALL"
                    ? "border-[#FFD200] bg-[#FFD200] text-black"
                    : "border-white/10 bg-[#0B1E21] text-slate-400"
                }`}
              >
                All Branches
              </button>
              {POCKET_BRANCHES.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setPayrollBranch(b.id)}
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${
                    payrollBranch === b.id
                      ? "border-[#00BAC7] bg-[#00BAC7]/20 text-[#22D3EE]"
                      : "border-white/10 bg-[#0B1E21] text-slate-400"
                  }`}
                >
                  {b.short}
                </button>
              ))}
            </div>

            {/* 4 Mini KPI Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-white/10 bg-[#061113] p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Staff</span>
                <span className="text-xl font-black text-white block mt-1 font-mono">
                  {activeStaffList.length}
                </span>
                <span className="text-[10px] text-slate-500">Employees</span>
              </div>

              <div className="rounded-2xl border border-[#00BAC7]/25 bg-[#061113] p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#22D3EE]">Monthly Payroll</span>
                <span className="text-base font-black text-white block mt-1 font-mono">
                  SAR {fmt(totalBasePayroll)}
                </span>
                <span className="text-[10px] text-slate-500">Gross contractual</span>
              </div>

              <div className="rounded-2xl border border-rose-500/25 bg-[#061113] p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300">Advances Taken</span>
                <span className="text-base font-black text-rose-400 block mt-1 font-mono">
                  -SAR {fmt(totalAdvancesThisMonth)}
                </span>
                <span className="text-[10px] text-slate-500">This month</span>
              </div>

              <div className="rounded-2xl border border-[#FFD200]/30 bg-gradient-to-br from-[#0B2023] to-[#040E10] p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#FFD200]">Net Due to Pay</span>
                <span className="text-base font-black text-[#FFD200] block mt-1 font-mono">
                  SAR {fmt(totalNetDue)}
                </span>
                <span className="text-[10px] text-amber-200/60">After advances</span>
              </div>
            </div>

            {/* Staff Search */}
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#061416] px-3.5 py-2 text-xs text-white">
              <Search size={14} className="text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search staff by name or role…"
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-500"
              />
            </div>

            {/* Mobile Employee Cards List */}
            <div className="space-y-3 pb-4">
              {loadingStaff ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <RotateCcw className="animate-spin inline mr-1 text-[#00BAC7]" size={15} /> Loading employees…
                </div>
              ) : filteredStaff.length === 0 ? (
                <div className="rounded-2xl border border-white/5 bg-[#061113] p-8 text-center text-slate-500 text-xs">
                  No staff registered for this filter. Tap &quot;Add Staff&quot; above.
                </div>
              ) : (
                filteredStaff.map((staff) => {
                  const stats = getStaffMonthStats(staff);
                  const initials = staff.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();
                  const bShort = POCKET_BRANCHES.find((b) => b.id === staff.branch)?.short || staff.branch;

                  return (
                    <div
                      key={staff.id}
                      className="rounded-2xl border border-white/10 bg-[#081517] p-4 flex flex-col gap-3 shadow-md"
                    >
                      {/* Top Row: Avatar + Name + Badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B1E21] border border-[#00BAC7]/30 font-mono text-xs font-black text-[#22D3EE] shrink-0">
                            {initials}
                          </div>
                          <div>
                            <h4 className="font-extrabold text-white text-sm">{staff.name}</h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="rounded bg-white/5 border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">
                                {staff.role || "Staff"}
                              </span>
                              <span className="rounded bg-[#00BAC7]/10 border border-[#00BAC7]/30 px-1.5 py-0.5 text-[10px] font-bold text-[#22D3EE]">
                                {bShort}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            staff.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                              : "bg-slate-500/10 text-slate-400 border border-slate-500/30"
                          }`}
                        >
                          {staff.status}
                        </span>
                      </div>

                      {/* Middle: Salary & Advances Grid */}
                      <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#040C0E] p-2.5 border border-white/5 text-center">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold">Base</span>
                          <span className="text-xs font-bold text-white font-mono mt-0.5 block">
                            SAR {fmt(staff.baseSalary)}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-rose-300 block font-bold">Advances</span>
                          <span className="text-xs font-bold text-rose-400 font-mono mt-0.5 block">
                            {stats.advances > 0 ? `-SAR ${fmt(stats.advances)}` : "SAR 0"}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-[#FFD200] block font-bold">Net Due</span>
                          <span className="text-xs font-black text-[#FFD200] font-mono mt-0.5 block">
                            SAR {fmt(stats.netRemaining)}
                          </span>
                        </div>
                      </div>

                      {/* Actions: View Ledger & Quick Disburse */}
                      <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                        <button
                          type="button"
                          onClick={() => openStaffLedger(staff)}
                          className="flex-1 rounded-xl border border-[#00BAC7]/30 bg-[#0B1E21] py-2 text-xs font-bold text-[#22D3EE] text-center"
                        >
                          📜 Ledger ({staff.payrollLogs?.length || 0})
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            openStaffLedger(staff);
                            setDisburseAmount(String(stats.netRemaining));
                            setDisburseNote(`Mobile Salary Payout - ${selectedMonth}`);
                          }}
                          className="flex-1 rounded-xl bg-gradient-to-r from-[#FFD200] to-[#F59E0B] py-2 text-xs font-extrabold text-black text-center"
                        >
                          ⚡ Disburse
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleArchive(staff)}
                          title="Archive staff"
                          className="rounded-xl border border-white/10 p-2 text-slate-400 hover:text-rose-400"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────────
          MODAL A: ADD NEW STAFF FROM MOBILE
         ────────────────────────────────────────────────────────────── */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[#FFD200]/40 bg-[#081517] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <Users size={16} className="text-[#FFD200]" /> Add New Employee
              </h3>
              <button
                type="button"
                onClick={() => setShowAddStaffModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddStaffSubmit} className="space-y-3">
              <div>
                <label className={labelCls}>Employee Name *</label>
                <input
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Tariq Al-Ghamdi"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Branch Assignment</label>
                <BranchPicker value={newBranch} onChange={setNewBranch} />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className={labelCls}>Job Role</label>
                  <input
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    placeholder="Cashier, Sales"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Base Salary (SAR)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newSalary}
                    onChange={(e) => setNewSalary(e.target.value)}
                    placeholder="3500.00"
                    className={`${inputCls} font-mono`}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Phone (Optional)</label>
                <input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className={inputCls}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingStaff}
                  className="flex-1 rounded-xl bg-gradient-to-r from-[#FFD200] to-[#F59E0B] py-2.5 text-xs font-extrabold text-black disabled:opacity-40"
                >
                  {isAddingStaff ? "Saving…" : "+ Save Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────
          MODAL B: INDIVIDUAL STAFF LEDGER & DISBURSEMENT
         ────────────────────────────────────────────────────────────── */}
      {selectedStaffForLedger && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 p-2 sm:p-4 backdrop-blur-md">
          <div className="w-full max-w-md max-h-[92vh] overflow-hidden rounded-3xl border border-[#00BAC7]/30 bg-[#061113] shadow-2xl flex flex-col">
            {/* Header */}
            <div className="p-4 bg-[#0B1E21] border-b border-white/10 flex items-start justify-between">
              <div>
                <h3 className="font-extrabold text-lg text-white">
                  {selectedStaffForLedger.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedStaffForLedger.role || "Staff"} · {selectedStaffForLedger.branch}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStaffForLedger(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {/* Month Balance Card */}
              {(() => {
                const stats = getStaffMonthStats(selectedStaffForLedger);
                return (
                  <div className="rounded-2xl border border-[#00BAC7]/25 bg-gradient-to-br from-[#0B2023] to-[#040E10] p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Monthly Base Salary</span>
                      <span className="font-mono font-bold text-white">
                        SAR {fmt(selectedStaffForLedger.baseSalary)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-rose-300">Advances Deducted ({selectedMonth})</span>
                      <span className="font-mono font-bold text-rose-400">
                        -SAR {fmt(stats.advances)}
                      </span>
                    </div>

                    {stats.payouts > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-emerald-300">Disbursed So Far</span>
                        <span className="font-mono font-bold text-emerald-400">
                          +SAR {fmt(stats.payouts)}
                        </span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                      <span className="text-xs font-bold text-[#FFD200]">Net Due to Disburse</span>
                      <span className="font-mono text-lg font-black text-[#FFD200]">
                        SAR {fmt(stats.netRemaining)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const stats = getStaffMonthStats(selectedStaffForLedger);
                    setDisburseAmount(String(stats.netRemaining));
                    setDisburseNote(`Mobile Salary Payout - ${selectedMonth}`);
                  }}
                  className="flex-1 rounded-xl bg-gradient-to-r from-[#FFD200] to-[#F59E0B] py-2.5 text-xs font-extrabold text-black shadow-sm"
                >
                  ⚡ Disburse Salary
                </button>

                <button
                  type="button"
                  onClick={() => setShowAdjustForm(!showAdjustForm)}
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-xs font-bold text-slate-300"
                >
                  {showAdjustForm ? "Cancel" : "+ Advance"}
                </button>
              </div>

              {/* Inline Adjustment Form */}
              {showAdjustForm && (
                <form onSubmit={handleAdjustmentSubmit} className="rounded-xl border border-[#00BAC7]/30 bg-[#0B1E21] p-3 space-y-2.5">
                  <span className="text-xs font-bold text-[#22D3EE] block">Record Direct Adjustment</span>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={adjType}
                      onChange={(e) => setAdjType(e.target.value as "ADVANCE" | "BONUS" | "DEDUCTION")}
                      className="rounded-lg border border-white/15 bg-black/60 px-2 py-1.5 text-xs font-bold text-white"
                    >
                      <option value="ADVANCE">Advance</option>
                      <option value="BONUS">Bonus</option>
                      <option value="DEDUCTION">Deduction</option>
                    </select>

                    <input
                      type="number"
                      step="0.01"
                      required
                      value={adjAmount}
                      onChange={(e) => setAdjAmount(e.target.value)}
                      placeholder="Amount SAR"
                      className="rounded-lg border border-white/15 bg-black/60 px-2 py-1.5 font-mono text-xs font-bold text-white"
                    />
                  </div>

                  <Pills
                    options={["REGISTER_DRAWER", "OWNER_POCKET", "BANK_TRANSFER"] as const}
                    value={adjSource}
                    onChange={(v) => {
                      setAdjSource(v);
                      if (v === "BANK_TRANSFER" && adjPaymentMode === "CASH") setAdjPaymentMode("SAB");
                      else if (v === "REGISTER_DRAWER") setAdjPaymentMode("CASH");
                    }}
                    render={(v) =>
                      v === "REGISTER_DRAWER"
                        ? "Drawer"
                        : v === "OWNER_POCKET"
                        ? "Pocket"
                        : "Bank"
                    }
                  />

                  <select
                    required
                    value={adjPaymentMode}
                    onChange={(e) => setAdjPaymentMode(e.target.value as UniversalPaymentMode)}
                    className="w-full rounded-lg border border-[#FFD200]/40 bg-black/60 px-2.5 py-1.5 text-xs font-bold text-[#FFD200]"
                  >
                    {UNIVERSAL_PAYMENT_MODES.map((m) => (
                      <option key={m.value} value={m.value} className="bg-[#0B1E21] text-white">
                        {m.label}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={adjNote}
                    onChange={(e) => setAdjNote(e.target.value)}
                    placeholder="Short remark…"
                    className="w-full rounded-lg border border-white/15 bg-black/60 px-2.5 py-1.5 text-xs text-white"
                  />

                  <button
                    type="submit"
                    disabled={isSavingAdj}
                    className="w-full rounded-lg bg-[#00BAC7] py-2 text-xs font-bold text-black"
                  >
                    {isSavingAdj ? "Saving…" : "Save to Ledger"}
                  </button>
                </form>
              )}

              {/* Inline Disburse Form */}
              {disburseAmount && (
                <form onSubmit={handleDisburseSubmit} className="rounded-xl border border-[#FFD200]/40 bg-[#FFD200]/10 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[#FFD200] flex items-center gap-1">
                      <CheckCircle2 size={14} /> Disburse &amp; Zero Balance
                    </span>
                    <button
                      type="button"
                      onClick={() => setDisburseAmount("")}
                      className="text-xs text-amber-300/80"
                    >
                      Cancel
                    </button>
                  </div>

                  <input
                    type="number"
                    step="0.01"
                    required
                    value={disburseAmount}
                    onChange={(e) => setDisburseAmount(e.target.value)}
                    className="w-full rounded-lg border border-[#FFD200]/40 bg-black/70 px-3 py-2 font-mono text-lg font-black text-[#FFD200]"
                  />

                  <Pills
                    options={["BANK_TRANSFER", "REGISTER_DRAWER", "OWNER_POCKET"] as const}
                    value={disburseSource}
                    onChange={(v) => {
                      setDisburseSource(v);
                      if (v === "REGISTER_DRAWER") setDisbursePaymentMode("CASH");
                      else if (v === "BANK_TRANSFER" && disbursePaymentMode === "CASH") setDisbursePaymentMode("SAB");
                    }}
                    render={(v) =>
                      v === "BANK_TRANSFER"
                        ? "Bank Wire"
                        : v === "REGISTER_DRAWER"
                        ? "Drawer Cash"
                        : "Owner Pocket"
                    }
                  />

                  <select
                    required
                    value={disbursePaymentMode}
                    onChange={(e) => setDisbursePaymentMode(e.target.value as UniversalPaymentMode)}
                    className="w-full rounded-lg border border-[#FFD200]/60 bg-black/70 px-2.5 py-2 text-xs font-bold text-[#FFD200]"
                  >
                    {UNIVERSAL_PAYMENT_MODES.map((m) => (
                      <option key={m.value} value={m.value} className="bg-[#0B1E21] text-white">
                        {m.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="submit"
                    disabled={isSubmittingDisburse}
                    className="w-full rounded-lg bg-[#FFD200] py-2.5 text-xs font-black text-black"
                  >
                    {isSubmittingDisburse ? "Disbursing…" : "Confirm Disbursement"}
                  </button>
                </form>
              )}

              {/* Inline Edit Payroll Log Form */}
              {editingPayrollLog && (
                <form onSubmit={handleSavePayrollLogEdit} className="rounded-xl border border-[#FFD200]/50 bg-[#0B1E21] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[#FFD200]">👑 Edit Payroll Entry</span>
                    <button type="button" onClick={() => setEditingPayrollLog(null)} className="text-xs text-slate-400">
                      Cancel
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editLogAmt}
                      onChange={(e) => setEditLogAmt(e.target.value)}
                      className="rounded-lg border border-white/15 bg-black/60 px-2.5 py-1.5 font-mono text-xs font-bold text-white"
                    />
                    <select
                      value={editLogMode}
                      onChange={(e) => setEditLogMode(e.target.value as UniversalPaymentMode)}
                      className="rounded-lg border border-[#FFD200]/40 bg-black/60 px-2 py-1.5 text-xs font-bold text-[#FFD200]"
                    >
                      {UNIVERSAL_PAYMENT_MODES.map((m) => (
                        <option key={m.value} value={m.value} className="bg-[#0B1E21] text-white">
                          {m.short}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="text"
                    value={editLogNote}
                    onChange={(e) => setEditLogNote(e.target.value)}
                    placeholder="Memo…"
                    className="w-full rounded-lg border border-white/15 bg-black/60 px-2.5 py-1.5 text-xs text-white"
                  />
                  <button type="submit" className="w-full rounded-lg bg-[#FFD200] py-1.5 text-xs font-extrabold text-black">
                    💾 Save Changes
                  </button>
                </form>
              )}

              {/* Itemized Ledger Entries */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Ledger History ({ledgerLogs.length})
                </span>

                {loadingLedger ? (
                  <div className="p-6 text-center text-xs text-slate-400">Loading ledger…</div>
                ) : ledgerLogs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 rounded-xl bg-white/[0.02]">
                    No transactions recorded for this staff member yet.
                  </div>
                ) : (
                  ledgerLogs.map((log) => {
                    const isAdv = log.type === "ADVANCE";
                    const isPay = log.type === "SALARY_PAYOUT";
                    const isBon = log.type === "BONUS";
                    const mBadge = formatPaymentModeBadge(
                      log.paymentMode || (log.source === "BANK_TRANSFER" ? "BANK_TRANSFER" : "CASH")
                    );

                    return (
                      <div
                        key={log.id}
                        className="rounded-xl border border-white/5 bg-[#040C0E] p-2.5 flex items-center justify-between text-xs gap-2"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[11px] text-slate-400">{log.date}</span>
                            <span
                              className={`rounded px-1.5 py-0.2 text-[9px] font-bold border ${
                                isAdv
                                  ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                                  : isPay
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                  : isBon
                                  ? "border-cyan-500/30 bg-cyan-500/10 text-[#22D3EE]"
                                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                              }`}
                            >
                              {log.type}
                            </span>
                            <span className={`rounded border px-1.5 py-0.2 text-[9px] font-bold ${mBadge.cls}`}>
                              {mBadge.label}
                            </span>
                          </div>
                          {log.note && (
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[180px]">
                              {log.note}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-mono font-bold ${
                              isPay || isBon ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {isPay || isBon ? "+" : "-"}SAR {fmt(log.amount)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPayrollLog(log);
                              setEditLogAmt(String(log.amount));
                              setEditLogMode((log.paymentMode as UniversalPaymentMode) || "CASH");
                              setEditLogNote(log.note || "");
                            }}
                            className="rounded border border-[#FFD200]/30 bg-[#FFD200]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#FFD200]"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePayrollLog(log.id)}
                            className="rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-bold text-rose-300"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-white/10 bg-[#0B1E21]/50 text-right">
              <button
                type="button"
                onClick={() => setSelectedStaffForLedger(null)}
                className="rounded-xl border border-white/15 px-4 py-2 text-xs font-bold text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
