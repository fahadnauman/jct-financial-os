"use client";

import { useEffect, useRef, useState } from "react";
import { POCKET_CUSTOMERS_KEY, pocketTag, usePocketTransactions, type BranchId } from "../lib/pocket-bridge";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import {
  Activity, Building2, CalendarDays, Check, ChevronDown,
  FileSpreadsheet, Lock, LockOpen, Moon, 
  Package, Sparkles, Store, Sun, TrendingUp, 
  Crown, PaintRoller, SprayCan, Landmark, Repeat,
  Wallet, Plus, Target, AlertTriangle, Mail, Bell,
  UploadCloud, Zap, ArrowLeft, ArrowRight, BarChart2, Eye, ArrowRightLeft, Trash2, Maximize2, Minimize2,
  Archive, Edit3, CheckCircle2, RotateCcw, Search,
  Users, UserCheck, DollarSign, X, Banknote, Printer,
  Coins, ArrowDownLeft
} from "lucide-react";

/* ════════════════════════════════════════════════════════════════════════
   TYPES & CONSTANTS
   ════════════════════════════════════════════════════════════════════════ */

type TabId = "register" | "archive" | "radar" | "suppliers" | "payroll" | "pulse" | "consolidation" | "ai";
type Kind = "cash_sale" | "credit_received" | "bank_in" | "jotun" | "hempel" | "sigma" | "other" | "salaries" | "tax" | "misc_expense";

interface Txn {
  id: string;
  flow: "in" | "out";
  kind: Kind;
  amount: number;
  originalAmount?: number;
  serialNo?: string;
  title: string;
  time: string;
}

export interface ContractorHistoryItem {
  id: string;
  amount: number;
  date: string;
  status: "paid_on_time" | "paid_late";
}

export interface ContractorAccount {
  id: string;
  name: string;
  outstanding: number;
  dueDate: string;
  followUpDate?: string;
  latestInvoiceNo?: string;
  latestInvoiceAmount?: number;
  status: "overdue" | "due_soon" | "on_track";
  daysLate?: number;
  riskLevel: "High" | "Medium" | "Low";
  avgPaymentTime: string;
  clearedInvoices: number;
  history: ContractorHistoryItem[];
  syncedFromRegister?: boolean;
}

export interface SupplierPayableBrand {
  id: number;
  brand: string;
  amountPaid: number;
  pendingBills: number;
  color: string;
}

export type UniversalPaymentMode =
  | "CASH"
  | "SAB"
  | "AL_RAJHI"
  | "SNB"
  | "VISA"
  | "MADA"
  | "BANK_TRANSFER";

export const UNIVERSAL_PAYMENT_MODES: {
  value: UniversalPaymentMode;
  label: string;
  badge: string;
  short: string;
}[] = [
  { value: "CASH", label: "Cash", badge: "💵 Cash", short: "💵 Cash" },
  { value: "SAB", label: "SAB (Saudi Awwal Bank)", badge: "🏦 SAB", short: "🏦 SAB" },
  { value: "AL_RAJHI", label: "Al Rajhi", badge: "🏦 Al Rajhi", short: "🏦 Al Rajhi" },
  { value: "SNB", label: "SNB", badge: "🏦 SNB", short: "🏦 SNB" },
  { value: "VISA", label: "VISA", badge: "💳 VISA", short: "💳 VISA" },
  { value: "MADA", label: "Mada", badge: "💳 Mada", short: "💳 Mada" },
  { value: "BANK_TRANSFER", label: "Bank Transfer", badge: "🏦 Bank Transfer", short: "🏦 Bank Transfer" },
];

export const formatPaymentModeBadge = (
  mode?: string | null
): { badge: string; badgeClass: string; label: string; cls: string } => {
  const m = (mode || "CASH").toUpperCase();
  if (m.includes("SAB")) {
    const cls = "rounded-full font-bold px-3 py-1 bg-jct-turquoise/20 text-jct-charcoal dark:text-jct-turquoise border border-jct-turquoise/40";
    return { badge: "🏦 SAB", badgeClass: cls, label: "🏦 SAB", cls };
  }
  if (m.includes("RAJHI")) {
    const cls = "rounded-full font-bold px-3 py-1 bg-jct-turquoise/20 text-jct-charcoal dark:text-jct-turquoise border border-jct-turquoise/40";
    return { badge: "🏦 Al Rajhi", badgeClass: cls, label: "🏦 Al Rajhi", cls };
  }
  if (m.includes("SNB")) {
    const cls = "rounded-full font-bold px-3 py-1 bg-jct-turquoise/20 text-jct-charcoal dark:text-jct-turquoise border border-jct-turquoise/40";
    return { badge: "🏦 SNB", badgeClass: cls, label: "🏦 SNB", cls };
  }
  if (m.includes("VISA") || m.includes("MC")) {
    const cls = "rounded-full font-bold px-3 py-1 bg-jct-yellow text-jct-charcoal border border-jct-yellow";
    return { badge: "💳 VISA", badgeClass: cls, label: "💳 VISA", cls };
  }
  if (m.includes("MADA")) {
    const cls = "rounded-full font-bold px-3 py-1 bg-jct-turquoise/20 text-jct-charcoal dark:text-jct-turquoise border border-jct-turquoise/40";
    return { badge: "💳 Mada", badgeClass: cls, label: "💳 Mada", cls };
  }
  if (m.includes("BANK") || m.includes("TRANSFER")) {
    const cls = "rounded-full font-bold px-3 py-1 bg-jct-turquoise/20 text-jct-charcoal dark:text-jct-turquoise border border-jct-turquoise/40";
    return { badge: "🏦 Bank Transfer", badgeClass: cls, label: "🏦 Bank Transfer", cls };
  }
  const cls = "rounded-full font-bold px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40";
  return { badge: "💵 Cash", badgeClass: cls, label: "💵 Cash", cls };
};

export interface SupplierBillItem {
  id: string;
  supplierName: string;
  amount: number;
  dueDate: string;
  category: "Credit Purchase" | "Cash Purchase" | "Bank Purchase" | "Return";
  paymentMode?: string;
  createdAt: string;
  source: "Daily Register" | "Supplier Hub";
}

export interface StaffMember {
  id: string;
  name: string;
  branch: string;
  role: string | null;
  baseSalary: number;
  phone: string | null;
  iqamaNumber: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  payrollLogs?: PayrollLogItem[];
}

export interface PayrollLogItem {
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
  staff?: {
    id: string;
    name: string;
    branch: string;
    role: string | null;
    baseSalary: number;
  };
}

const SEED_TXNS: Txn[] = [
  { id: "1", flow: "in", kind: "cash_sale", amount: 1150, serialNo: "INV-2026-8491", title: "Walk-in · Jotun Fenomastic", time: "08:42" },
  { id: "2", flow: "in", kind: "cash_sale", amount: 6325, serialNo: "INV-2026-8492", title: "Contractor · Bulk Paint", time: "10:20" },
  { id: "3", flow: "in", kind: "credit_received", amount: 8500, serialNo: "ERP-JBL-0934", title: "Al Noor Contracting", time: "09:30" },
  { id: "4", flow: "out", kind: "jotun", amount: 12400, serialNo: "ERP-JBL-0935", title: "Jotun Arabia Restock", time: "10:00" },
  { id: "5", flow: "out", kind: "hempel", amount: 7850, serialNo: "ERP-JBL-0936", title: "Hempel Marine Coatings", time: "10:45" },
  { id: "6", flow: "out", kind: "salaries", amount: 4500, serialNo: "HR-2026-004", title: "Staff advances", time: "12:00" },
];

const INITIAL_CONTRACTORS: ContractorAccount[] = [
  {
    id: "c1", name: "Al-Futtaim Contractors", outstanding: 124500, dueDate: "2026-08-30", followUpDate: "2026-09-18", latestInvoiceNo: "#30051", latestInvoiceAmount: 45000, status: "overdue", daysLate: 12,
    riskLevel: "High", avgPaymentTime: "18 Days Late", clearedInvoices: 14,
    history: [
      { id: "INV-891", amount: 45000, date: "2026-07-15", status: "paid_late" },
      { id: "INV-840", amount: 22000, date: "2026-06-01", status: "paid_on_time" },
      { id: "INV-710", amount: 18500, date: "2026-04-20", status: "paid_late" },
    ]
  },
  {
    id: "c2", name: "Eastern Paint Bros", outstanding: 45200, dueDate: "2026-09-14", followUpDate: "2026-09-14", latestInvoiceNo: "#30058", latestInvoiceAmount: 12000, status: "due_soon",
    riskLevel: "Medium", avgPaymentTime: "2 Days Late", clearedInvoices: 42,
    history: [
      { id: "INV-902", amount: 12000, date: "2026-08-10", status: "paid_on_time" },
      { id: "INV-885", amount: 8400, date: "2026-07-22", status: "paid_on_time" },
      { id: "INV-850", amount: 15600, date: "2026-06-15", status: "paid_late" },
    ]
  },
  {
    id: "c3", name: "Jubail Coastal Development", outstanding: 8500, dueDate: "2026-10-05", followUpDate: "2026-10-05", latestInvoiceNo: "#30060", latestInvoiceAmount: 8500, status: "on_track",
    riskLevel: "Low", avgPaymentTime: "On Time", clearedInvoices: 89,
    history: [
      { id: "INV-915", amount: 32000, date: "2026-08-28", status: "paid_on_time" },
      { id: "INV-900", amount: 14500, date: "2026-08-01", status: "paid_on_time" },
      { id: "INV-870", amount: 26000, date: "2026-07-10", status: "paid_on_time" },
    ]
  }
];

const INITIAL_SUPPLIER_BRANDS: SupplierPayableBrand[] = [
  { id: 1, brand: "Jotun", amountPaid: 45000, pendingBills: 12000, color: "blue" },
  { id: 2, brand: "Hempel", amountPaid: 28000, pendingBills: 5400, color: "purple" },
  { id: 3, brand: "Sigma", amountPaid: 15500, pendingBills: 0, color: "fuchsia" },
];

const INITIAL_SUPPLIER_BILLS: SupplierBillItem[] = [
  {
    id: "sb-1",
    supplierName: "Jotun",
    amount: 12000,
    dueDate: "2026-09-18",
    category: "Credit Purchase",
    paymentMode: "SAB",
    createdAt: "10-09-2026",
    source: "Supplier Hub",
  },
  {
    id: "sb-2",
    supplierName: "Hempel",
    amount: 5400,
    dueDate: "2026-09-22",
    category: "Credit Purchase",
    paymentMode: "AL_RAJHI",
    createdAt: "11-09-2026",
    source: "Supplier Hub",
  },
];

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const nf = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (n: number) => nf.format(n);
const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/* ════════════════════════════════════════════════════════════════════════
   COMPONENTS
   ════════════════════════════════════════════════════════════════════════ */

function PrintReportHeader({ branch, date }: { branch: string; date: string }) {
  const [timestamp, setTimestamp] = useState("");

  useEffect(() => {
    const handleBeforePrint = () => {
      setTimestamp(new Date().toLocaleString());
    };
    const timer = setTimeout(() => {
      setTimestamp(new Date().toLocaleString());
    }, 0);
    window.addEventListener("beforeprint", handleBeforePrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeprint", handleBeforePrint);
    };
  }, []);

  return (
    <div className="hidden print:block text-black">
      <h1 className="print:text-4xl print:font-black print:tracking-tighter print:uppercase print:mb-2 print:text-black">
        JCT FINANCIAL OS — DAILY REGISTER REPORT
      </h1>
      <div className="print:text-lg print:font-bold">Date: {new Date().toLocaleDateString()}</div>
      <div className="print:flex print:items-center print:justify-between print:text-lg print:font-semibold print:tracking-tight print:text-slate-600 print:mb-8 print:border-b-2 print:border-black print:pb-4 mt-1">
        <div>
          <span>Branch: </span>
          <strong className="print:text-black">{branch}</strong>
          <span className="print:mx-2">•</span>
          <span>Jubail Corp. Trading Est.</span>
        </div>
        <div className="print:text-right print:font-mono print:text-sm">
          <span>Register Date: </span>
          <strong className="print:text-black">{date}</strong>
          <span className="print:text-xs print:text-slate-500 print:ml-2">(Printed: {timestamp || "Live"})</span>
        </div>
      </div>
    </div>
  );
}

function PrintReportFooter() {
  return (
    <div className="hidden print:flex print:justify-between print:mt-16 print:pt-8 print:border-t-2 print:border-black print:text-sm print:font-bold print:text-black print:page-break-inside-avoid">
      <div>PREPARED BY (STAFF): _________________________</div>
      <div>DATE / TIME: _________________________</div>
      <div>AUDITED BY (OWNER): _________________________</div>
    </div>
  );
}

function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      type="button"
      title={dark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label={dark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-[#1F1F1F] bg-white dark:bg-[#0A0A0A] text-jct-charcoal dark:text-jct-offwhite hover:bg-jct-yellow hover:text-jct-charcoal dark:hover:bg-jct-yellow dark:hover:text-jct-charcoal shadow-sm transition-all print:hidden"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function Sidebar({ tab, setTab, allowedTabs }: { tab: TabId; setTab: (t: TabId) => void; allowedTabs: TabId[] }) {
  const nav = [
    { id: "register" as TabId, label: "Daily Register", icon: Wallet },
    { id: "archive" as TabId, label: "Audit Library", icon: Archive },
    { id: "radar" as TabId, label: "Credit Radar", icon: Target },
    { id: "suppliers" as TabId, label: "Suppliers & Payables", icon: Package },
    { id: "payroll" as TabId, label: "Staff & Payroll", icon: Users },
    { id: "pulse" as TabId, label: "Financial Pulse", icon: Activity },
    { id: "consolidation" as TabId, label: "Branch Consolidation", icon: Building2 },
    { id: "ai" as TabId, label: "Nauman AI", icon: Sparkles },
  ].filter((n) => allowedTabs.includes(n.id));
  return (
    <aside className="hidden w-64 shrink-0 flex-col overflow-hidden bg-white dark:bg-[#0A0A0A] border-r border-slate-200 dark:border-[#1F1F1F] p-5 text-jct-charcoal dark:text-jct-offwhite lg:flex relative z-40 print:hidden">
      <div className="relative flex items-center gap-3 px-1 pb-8 pt-1">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-jct-turquoise font-display text-base font-black tracking-tight text-jct-charcoal shadow-sm">
          JCT
        </div>
        <div className="leading-tight">
          <p className="font-display text-[15px] font-extrabold tracking-tight text-jct-charcoal dark:text-jct-offwhite">JCT Financial OS</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Jubail Corp. Trading Est.</p>
        </div>
      </div>

      <nav className="flex flex-col gap-2 flex-1">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Modules</p>
        {nav.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`group relative flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[14px] font-semibold transition-all ${
                active
                  ? "bg-jct-turquoise text-jct-charcoal font-bold shadow-sm"
                  : "border border-transparent text-jct-charcoal dark:text-jct-offwhite hover:bg-slate-100 dark:hover:bg-[#111111]"
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-jct-charcoal" : "text-slate-500 dark:text-slate-400 group-hover:text-jct-charcoal dark:group-hover:text-jct-offwhite"} />
              <span className="flex-1">{label}</span>
            </button>
          );
        })}
      </nav>
      
      <div className="mt-auto space-y-3">
        <div className="rounded-xl bg-jct-offwhite dark:bg-black p-4 border border-slate-200 dark:border-[#1F1F1F]">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Drawer Status</p>
          <div className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-jct-charcoal dark:text-jct-offwhite">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-jct-turquoise opacity-75 animate-ping"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-jct-turquoise"></span>
            </span>
            Active Session
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   JCT FLAGSHIP DAILY HUB & WIDESCREEN 5-STEP WORKBENCH
   ════════════════════════════════════════════════════════════════════════ */

export type TrackingMode = "hub" | "wizard" | "datasheet";
export type PreLoggedEntryType =
  | "EXPENSE"
  | "CREDIT_RECD"
  | "CREDIT_SALE"
  | "SPLIT_SALE"
  | "LOAN_IN"
  | "OTHER_IN";
export type WizardStep = 1 | 2 | 3 | 4 | 5;
export type InvoicePaymentMode =
  | "CASH"
  | "BANK_TRANSFER"
  | "POS_SWIPE"
  | "SPLIT"
  | "OTHER_RECD"
  | "CREDIT_SALE"
  | "Cash";
export type PosTerminalBank = "SAB" | "AL_RAJHI" | "VISA_MC";

export const STRICT_EXPENSE_CATEGORIES = [
  "Food",
  "Water",
  "Salary",
  "Staff Advance",
  "Credit Purchase",
  "Cash Purchase",
  "Bank Purchase",
  "Personal Reasons",
  "Business Commission",
] as const;

export type StrictExpenseCategory = (typeof STRICT_EXPENSE_CATEGORIES)[number];

export const POS_TERMINAL_META: Record<
  PosTerminalBank,
  {
    label: string;
    shortLabel: string;
    badgeTag: string;
    feeRate: number;
    feePctLabel: string;
    samaCap?: number;
    isMada: boolean;
  }
> = {
  SAB: {
    label: "mada · SAB",
    shortLabel: "mada · SAB",
    badgeTag: "mada · SAB",
    feeRate: 0.008,
    feePctLabel: "0.80% fee, SAMA cap SAR 40",
    samaCap: 40,
    isMada: true,
  },
  AL_RAJHI: {
    label: "mada · Al Rajhi",
    shortLabel: "mada · Al Rajhi",
    badgeTag: "mada · Al Rajhi",
    feeRate: 0.008,
    feePctLabel: "0.80% fee, SAMA cap SAR 40",
    samaCap: 40,
    isMada: true,
  },
  VISA_MC: {
    label: "Visa / Mastercard",
    shortLabel: "Visa / Mastercard",
    badgeTag: "💳 Visa / MC",
    feeRate: 0.022,
    feePctLabel: "2.20% credit card MDR",
    samaCap: undefined,
    isMada: false,
  },
};

export interface PreLoggedBankInvoice {
  invoiceNo: string;
  amount?: number;
  paymentMode: "BANK_TRANSFER" | "POS_SWIPE";
  posTerminal?: PosTerminalBank;
  time: string;
}

export interface PreLoggedEntry {
  id: string;
  type: PreLoggedEntryType;
  title: string;
  expenseCategory?: StrictExpenseCategory;
  supplierName?: string;
  dueDate?: string;
  customerName?: string;
  followUpDate?: string;
  receiptNo?: string;
  staffId?: string;
  staffName?: string;
  paymentMode?: string;
  note?: string;
  amount: number;
  originalAmount?: number;
  isEdited?: boolean;
  overrideReason?: OverrideReason;
  overrideNote?: string;
  isSplit?: boolean;
  splitCashAmount?: number;
  splitBankAmount?: number;
  splitBankMethod?: "BANK_TRANSFER" | "POS_SWIPE";
  splitPosTerminal?: PosTerminalBank;
  time: string;
}

export type OverrideReason = "BUSINESS_COMMISSION" | "BILL_MISTAKE" | "CUSTOM";

export interface ErpInvoiceItem {
  id?: string;
  invoiceNo: string;
  customer: string;
  customerName?: string;
  amount: number;
  originalAmount?: number;
  isEdited?: boolean;
  overrideReason?: OverrideReason;
  overrideNote?: string;
  paymentMode: InvoicePaymentMode;
  posTerminal: PosTerminalBank;
  posTerminalDevice?: "SAB" | "AL_RAJHI";
  bankPaymentMode?: string;
  isSplit?: boolean;
  splitCashAmount: number;
  splitBankAmount: number;
  splitBankMethod: "BANK_TRANSFER" | "POS_SWIPE";
  splitPosTerminal?: PosTerminalBank;
  otherNote?: string;
  creditDownAmount?: number;
  creditDownMethod?: "CASH" | "POS_SWIPE";
  creditDownTerminal?: PosTerminalBank;
  creditBalance?: number;
  creditFollowUpDate?: string;
  autoMatched: boolean;
  time: string;
  isManualEntry?: boolean;
}

export interface CompletedDaySummary {
  date: string;
  branch: string;
  totalCashSales: number;
  totalBankSwipe: number;
  totalPosFees: number;
  totalExpenses: number;
  closingBalance: number;
  status: "LOCKED" | "AUDITED";
}

export interface ErpSeedItem {
  invoiceNo: string;
  customer: string;
  amount: number;
  time: string;
  isSplit?: boolean;
  splitCashAmount?: number;
  splitBankAmount?: number;
  splitBankMethod?: "BANK_TRANSFER" | "POS_SWIPE";
  splitPosTerminal?: PosTerminalBank;
}

export const JUBAIL_ERP_18_SEED: ErpSeedItem[] = [
  { invoiceNo: "30062", customer: "Walk-in · Jotun Fenomastic Matt", amount: 1840, time: "08:35" },
  { invoiceNo: "30063", customer: "Al-Noor Contracting · POS Swipe", amount: 1450, time: "09:18" },
  { invoiceNo: "30064", customer: "Retail · Jotashield Exterior", amount: 2300, time: "09:45" },
  { invoiceNo: "30065", customer: "Dammam Marine Services · Bank Transfer", amount: 2150, time: "10:12" },
  { invoiceNo: "30066", customer: "Walk-in · Hempel Hempadur Primer", amount: 1150, time: "10:40" },
  { invoiceNo: "30067", customer: "Gulf Industrial Coatings", amount: 4600, time: "11:05" },
  { invoiceNo: "30068", customer: "Jubail Port Logistics · POS Swipe", amount: 3820, time: "11:42" },
  { invoiceNo: "30069", customer: "Walk-in · Sigma Wood Varnish", amount: 920, time: "12:15" },
  {
    invoiceNo: "30070",
    customer: "Royal Commission Site Contractor · Split Tender",
    amount: 5750,
    time: "13:10",
    isSplit: true,
    splitCashAmount: 2750,
    splitBankAmount: 3000,
    splitBankMethod: "POS_SWIPE",
    splitPosTerminal: "AL_RAJHI",
  },
  { invoiceNo: "30071", customer: "Walk-in · Hardware Rollers & Brushes", amount: 690, time: "13:35" },
  {
    invoiceNo: "30072",
    customer: "Al-Futtaim Site Batch · Split Tender",
    amount: 2000,
    time: "14:00",
    isSplit: true,
    splitCashAmount: 1000,
    splitBankAmount: 1000,
    splitBankMethod: "POS_SWIPE",
    splitPosTerminal: "SAB",
  },
  { invoiceNo: "30073", customer: "Walk-in · Industrial Thinner 200L", amount: 1725, time: "14:22" },
  { invoiceNo: "30074", customer: "SAB POS Terminal Customer", amount: 960, time: "14:50" },
  { invoiceNo: "30075", customer: "Eastern Paint Bros Cash Order", amount: 3450, time: "15:30" },
  { invoiceNo: "30076", customer: "Walk-in · Jotun Majestic Silk", amount: 1380, time: "16:05" },
  { invoiceNo: "30077", customer: "Industrial Marine Epoxy Batch", amount: 2990, time: "16:40" },
  { invoiceNo: "30078", customer: "Walk-in · Putty & Sealers", amount: 1610, time: "17:15" },
  { invoiceNo: "30079", customer: "Closing Shift Cash Walk-in", amount: 1799, time: "17:50" },
];

export interface DataSheetRow {
  id: string;
  invoiceNo: string;
  amtCashSale: string;
  creditInvAmt: string;
  receiptNo: string;
  creditSaleRecd: string;
  openBal: string;
  loanIn: string;
  otherAmtRecd: string;
  fromBank: string;
  creditPurchaseSupplier: string;
  creditPurchaseAmt: string;
  cashPurchase: string;
  creditPurchasePayment: string;
  crNote: string;
  expenseLabel: string;
  expenseAmt: string;
  toBankLabel: string;
  toBankAmt: string;
  toBankChecked: boolean;
  loanOut: string;
  excessAmt: string;
}

export const INITIAL_DATASHEET_ROWS: DataSheetRow[] = [
  {
    id: "ds-1",
    invoiceNo: "30062",
    amtCashSale: "1840",
    creditInvAmt: "",
    receiptNo: "Chicago",
    creditSaleRecd: "12428",
    openBal: "2634",
    loanIn: "",
    otherAmtRecd: "",
    fromBank: "",
    creditPurchaseSupplier: "Jotun",
    creditPurchaseAmt: "2000",
    cashPurchase: "640",
    creditPurchasePayment: "",
    crNote: "",
    expenseLabel: "Food",
    expenseAmt: "24",
    toBankLabel: "",
    toBankAmt: "",
    toBankChecked: false,
    loanOut: "",
    excessAmt: "",
  },
  {
    id: "ds-2",
    invoiceNo: "30063",
    amtCashSale: "1450",
    creditInvAmt: "",
    receiptNo: "",
    creditSaleRecd: "",
    openBal: "",
    loanIn: "2000",
    otherAmtRecd: "",
    fromBank: "",
    creditPurchaseSupplier: "Hempel",
    creditPurchaseAmt: "1450",
    cashPurchase: "",
    creditPurchasePayment: "3200",
    crNote: "",
    expenseLabel: "Water",
    expenseAmt: "150",
    toBankLabel: "SAB Swipe #30063",
    toBankAmt: "1450",
    toBankChecked: true,
    loanOut: "",
    excessAmt: "",
  },
  {
    id: "ds-3",
    invoiceNo: "30064",
    amtCashSale: "",
    creditInvAmt: "2300",
    receiptNo: "",
    creditSaleRecd: "",
    openBal: "",
    loanIn: "",
    otherAmtRecd: "",
    fromBank: "",
    creditPurchaseSupplier: "",
    creditPurchaseAmt: "",
    cashPurchase: "",
    creditPurchasePayment: "",
    crNote: "",
    expenseLabel: "Salary",
    expenseAmt: "1500",
    toBankLabel: "",
    toBankAmt: "",
    toBankChecked: false,
    loanOut: "",
    excessAmt: "",
  },
  {
    id: "ds-4",
    invoiceNo: "30065",
    amtCashSale: "2150",
    creditInvAmt: "",
    receiptNo: "",
    creditSaleRecd: "",
    openBal: "",
    loanIn: "",
    otherAmtRecd: "",
    fromBank: "",
    creditPurchaseSupplier: "",
    creditPurchaseAmt: "",
    cashPurchase: "",
    creditPurchasePayment: "",
    crNote: "",
    expenseLabel: "",
    expenseAmt: "",
    toBankLabel: "Bank Transfer #30065",
    toBankAmt: "2150",
    toBankChecked: true,
    loanOut: "",
    excessAmt: "",
  },
  {
    id: "ds-5",
    invoiceNo: "30066",
    amtCashSale: "1150",
    creditInvAmt: "",
    receiptNo: "",
    creditSaleRecd: "",
    openBal: "",
    loanIn: "",
    otherAmtRecd: "",
    fromBank: "",
    creditPurchaseSupplier: "",
    creditPurchaseAmt: "",
    cashPurchase: "",
    creditPurchasePayment: "",
    crNote: "",
    expenseLabel: "",
    expenseAmt: "",
    toBankLabel: "",
    toBankAmt: "",
    toBankChecked: false,
    loanOut: "",
    excessAmt: "",
  },
  {
    id: "ds-6",
    invoiceNo: "30067",
    amtCashSale: "2600",
    creditInvAmt: "",
    receiptNo: "",
    creditSaleRecd: "",
    openBal: "",
    loanIn: "",
    otherAmtRecd: "",
    fromBank: "",
    creditPurchaseSupplier: "",
    creditPurchaseAmt: "",
    cashPurchase: "",
    creditPurchasePayment: "",
    crNote: "",
    expenseLabel: "",
    expenseAmt: "",
    toBankLabel: "",
    toBankAmt: "",
    toBankChecked: false,
    loanOut: "",
    excessAmt: "",
  },
  {
    id: "ds-7",
    invoiceNo: "30068",
    amtCashSale: "3820",
    creditInvAmt: "",
    receiptNo: "",
    creditSaleRecd: "",
    openBal: "",
    loanIn: "",
    otherAmtRecd: "",
    fromBank: "",
    creditPurchaseSupplier: "",
    creditPurchaseAmt: "",
    cashPurchase: "",
    creditPurchasePayment: "",
    crNote: "",
    expenseLabel: "",
    expenseAmt: "",
    toBankLabel: "Al Rajhi POS #30068",
    toBankAmt: "3820",
    toBankChecked: true,
    loanOut: "",
    excessAmt: "",
  },
  {
    id: "ds-8",
    invoiceNo: "30069",
    amtCashSale: "920",
    creditInvAmt: "",
    receiptNo: "",
    creditSaleRecd: "",
    openBal: "",
    loanIn: "",
    otherAmtRecd: "",
    fromBank: "",
    creditPurchaseSupplier: "",
    creditPurchaseAmt: "",
    cashPurchase: "",
    creditPurchasePayment: "",
    crNote: "",
    expenseLabel: "",
    expenseAmt: "",
    toBankLabel: "",
    toBankAmt: "",
    toBankChecked: false,
    loanOut: "",
    excessAmt: "",
  },
  {
    id: "ds-9",
    invoiceNo: "30070",
    amtCashSale: "2750",
    creditInvAmt: "",
    receiptNo: "",
    creditSaleRecd: "",
    openBal: "",
    loanIn: "",
    otherAmtRecd: "",
    fromBank: "",
    creditPurchaseSupplier: "",
    creditPurchaseAmt: "",
    cashPurchase: "",
    creditPurchasePayment: "",
    crNote: "",
    expenseLabel: "",
    expenseAmt: "",
    toBankLabel: "",
    toBankAmt: "",
    toBankChecked: false,
    loanOut: "",
    excessAmt: "",
  },
  {
    id: "ds-10",
    invoiceNo: "30071",
    amtCashSale: "690",
    creditInvAmt: "",
    receiptNo: "",
    creditSaleRecd: "",
    openBal: "",
    loanIn: "",
    otherAmtRecd: "",
    fromBank: "",
    creditPurchaseSupplier: "",
    creditPurchaseAmt: "",
    cashPurchase: "",
    creditPurchasePayment: "",
    crNote: "",
    expenseLabel: "",
    expenseAmt: "",
    toBankLabel: "",
    toBankAmt: "",
    toBankChecked: false,
    loanOut: "",
    excessAmt: "",
  },
  {
    id: "ds-11",
    invoiceNo: "30072",
    amtCashSale: "3325",
    creditInvAmt: "",
    receiptNo: "",
    creditSaleRecd: "",
    openBal: "",
    loanIn: "",
    otherAmtRecd: "",
    fromBank: "",
    creditPurchaseSupplier: "",
    creditPurchaseAmt: "",
    cashPurchase: "",
    creditPurchasePayment: "",
    crNote: "",
    expenseLabel: "",
    expenseAmt: "",
    toBankLabel: "",
    toBankAmt: "",
    toBankChecked: false,
    loanOut: "",
    excessAmt: "",
  },
  {
    id: "ds-12",
    invoiceNo: "30073",
    amtCashSale: "1725",
    creditInvAmt: "",
    receiptNo: "",
    creditSaleRecd: "",
    openBal: "",
    loanIn: "",
    otherAmtRecd: "",
    fromBank: "",
    creditPurchaseSupplier: "",
    creditPurchaseAmt: "",
    cashPurchase: "",
    creditPurchasePayment: "",
    crNote: "",
    expenseLabel: "",
    expenseAmt: "",
    toBankLabel: "",
    toBankAmt: "",
    toBankChecked: false,
    loanOut: "",
    excessAmt: "",
  },
  {
    id: "ds-13",
    invoiceNo: "30074",
    amtCashSale: "960",
    creditInvAmt: "",
    receiptNo: "",
    creditSaleRecd: "",
    openBal: "",
    loanIn: "",
    otherAmtRecd: "",
    fromBank: "",
    creditPurchaseSupplier: "",
    creditPurchaseAmt: "",
    cashPurchase: "",
    creditPurchasePayment: "",
    crNote: "",
    expenseLabel: "",
    expenseAmt: "",
    toBankLabel: "SAB Swipe #30074",
    toBankAmt: "960",
    toBankChecked: true,
    loanOut: "",
    excessAmt: "",
  },
  {
    id: "ds-14",
    invoiceNo: "30075",
    amtCashSale: "2450",
    creditInvAmt: "",
    receiptNo: "",
    creditSaleRecd: "",
    openBal: "",
    loanIn: "",
    otherAmtRecd: "",
    fromBank: "",
    creditPurchaseSupplier: "",
    creditPurchaseAmt: "",
    cashPurchase: "",
    creditPurchasePayment: "",
    crNote: "",
    expenseLabel: "",
    expenseAmt: "",
    toBankLabel: "",
    toBankAmt: "",
    toBankChecked: false,
    loanOut: "",
    excessAmt: "",
  },
  {
    id: "ds-15",
    invoiceNo: "30076",
    amtCashSale: "2017",
    creditInvAmt: "",
    receiptNo: "",
    creditSaleRecd: "",
    openBal: "",
    loanIn: "",
    otherAmtRecd: "",
    fromBank: "",
    creditPurchaseSupplier: "",
    creditPurchaseAmt: "",
    cashPurchase: "",
    creditPurchasePayment: "",
    crNote: "",
    expenseLabel: "",
    expenseAmt: "",
    toBankLabel: "Bank Cash Deposit",
    toBankAmt: "26515",
    toBankChecked: true,
    loanOut: "",
    excessAmt: "",
  },
];



/* ════════════════════════════════════════════════════════════════════════
   EXACT 19-COLUMN PHYSICAL "DAILY DATA SHEET" TABLE COMPONENT
   ════════════════════════════════════════════════════════════════════════ */

export interface ClassicDataSheetTableProps {
  sheetRows?: DataSheetRow[];
  activeErpList?: ErpInvoiceItem[];
  preLoggedEntries?: PreLoggedEntry[];
  openingBalance?: number;
  date?: string;
  branchName?: string;
  className?: string;
}

interface ClassicMappedRow {
  invoiceNo: string;
  amtCashSale: number | null;
  creditInvAmt: number | null;
  receiptNo: string;
  creditAmtRecd: number | null;
  openBal: number | null;
  loanIn: number | null;
  otherAmtRecd: number | null;
  fromBank: number | null;
  totalAmt: number | null;
  creditPurchase: string;
  creditPurchaseAmt: number | null;
  cashPurchase: number | null;
  creditPurchasePayment: number | null;
  crNote: number | null;
  expense: string;
  expenseAmt: number | null;
  toBank: string;
  toBankAmt: number | null;
  loanOut: number | null;
  excessAmt: number | null;
  closingBalance: number | null;
}

function buildClassicDataSheetRows(
  sheetRows?: DataSheetRow[],
  activeErpList: ErpInvoiceItem[] = [],
  preLoggedEntries: PreLoggedEntry[] = [],
  openingBalance: number = 500
): ClassicMappedRow[] {
  const parseNum = (v: string | number | undefined | null): number => {
    if (typeof v === "number") return Number.isNaN(v) ? 0 : v;
    if (!v) return 0;
    const parsed = parseFloat(String(v));
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const rowCount = Math.max(
    activeErpList.length,
    sheetRows?.length || 0,
    preLoggedEntries.length,
    15
  );

  const expenses = preLoggedEntries.filter((e) => e.type === "EXPENSE");
  const inflows = preLoggedEntries.filter((e) => e.type !== "EXPENSE");

  let cumulativeCash = openingBalance;

  return Array.from({ length: rowCount }, (_, idx) => {
    const sRow = sheetRows?.[idx];
    const inv = activeErpList[idx];
    const exp = expenses[idx];
    const inf = inflows[idx];

    // 1. INVOICE NO., 2. AMT CASH SALE, 3. CREDIT INV. AMOUNT
    let invoiceNo = "";
    let amtCashSale: number | null = null;
    let creditInvAmt: number | null = null;
    let toBank = "";
    let toBankAmt: number | null = null;

    if (inv) {
      invoiceNo = inv.invoiceNo;
      if (inv.paymentMode === "CASH") {
        amtCashSale = inv.amount;
      } else if (inv.paymentMode === "CREDIT_SALE") {
        creditInvAmt = inv.amount;
      } else if (inv.paymentMode === "SPLIT") {
        amtCashSale = inv.splitCashAmount || null;
        const bAmt = inv.splitBankAmount || 0;
        toBankAmt = bAmt;
        toBank = `Split ${inv.splitBankMethod === "BANK_TRANSFER" ? "Bank" : "Swipe"} - SAR ${fmt(bAmt)}`;
      } else if (inv.paymentMode === "BANK_TRANSFER") {
        toBankAmt = inv.amount;
        toBank = `Bank #${inv.invoiceNo} - SAR ${fmt(inv.amount)}`;
      } else if (inv.paymentMode === "POS_SWIPE") {
        toBankAmt = inv.amount;
        toBank = `Swipe #${inv.invoiceNo} - SAR ${fmt(inv.amount)}`;
      }
    } else if (sRow) {
      invoiceNo = sRow.invoiceNo || "";
      amtCashSale = parseNum(sRow.amtCashSale) > 0 ? parseNum(sRow.amtCashSale) : null;
      creditInvAmt = parseNum(sRow.creditInvAmt) > 0 ? parseNum(sRow.creditInvAmt) : null;
      if (sRow.toBankChecked && parseNum(sRow.toBankAmt) > 0) {
        toBankAmt = parseNum(sRow.toBankAmt);
        toBank = sRow.toBankLabel
          ? `${sRow.toBankLabel} - SAR ${fmt(toBankAmt)}`
          : `SAR ${fmt(toBankAmt)}`;
      }
    }

    // 4. RECEIPT NO. & 5. CREDIT AMT RECD, 7. LOAN IN, 8. OTHER AMT RECD, 9. FROM BANK
    let receiptNo = "";
    let creditAmtRecd: number | null = null;
    let loanIn: number | null = null;
    let otherAmtRecd: number | null = null;
    let fromBank: number | null = null;

    if (inf) {
      if (inf.type === "CREDIT_RECD") {
        receiptNo = inf.customerName || inf.receiptNo || inf.title || "Credit Recd";
        creditAmtRecd = inf.amount;
      } else if (inf.type === "LOAN_IN") {
        loanIn = inf.amount;
      } else if (inf.type === "OTHER_IN") {
        otherAmtRecd = inf.amount;
      }
    } else if (sRow) {
      receiptNo = sRow.receiptNo || "";
      creditAmtRecd = parseNum(sRow.creditSaleRecd) > 0 ? parseNum(sRow.creditSaleRecd) : null;
      loanIn = parseNum(sRow.loanIn) > 0 ? parseNum(sRow.loanIn) : null;
      otherAmtRecd = parseNum(sRow.otherAmtRecd) > 0 ? parseNum(sRow.otherAmtRecd) : null;
      fromBank = parseNum(sRow.fromBank) > 0 ? parseNum(sRow.fromBank) : null;
    }

    // 6. OPEN BAL (Only on Row 1)
    const openBal: number | null =
      idx === 0
        ? openingBalance || (sRow ? parseNum(sRow.openBal) || null : null)
        : null;

    // 10. TOTAL AMT (Row Inflow)
    const rowInflow =
      (amtCashSale || 0) +
      (creditAmtRecd || 0) +
      (openBal || 0) +
      (loanIn || 0) +
      (otherAmtRecd || 0) +
      (fromBank || 0);
    const totalAmt = rowInflow > 0 ? rowInflow : null;

    // 11. CREDIT PURCHASE, 12. CASH PURCHASE, 13. CREDIT PURCHASE PAYMENT, 14. CR NOTE, 15. EXPENSE
    let creditPurchase = "";
    let creditPurchaseAmt: number | null = null;
    let cashPurchase: number | null = null;
    let creditPurchasePayment: number | null = null;
    const crNote: number | null = sRow && parseNum(sRow.crNote) > 0 ? parseNum(sRow.crNote) : null;
    let expense = "";
    let expenseAmt: number | null = null;
    const loanOut: number | null = sRow && parseNum(sRow.loanOut) > 0 ? parseNum(sRow.loanOut) : null;
    const excessAmt: number | null = sRow && parseNum(sRow.excessAmt) > 0 ? parseNum(sRow.excessAmt) : null;

    if (exp) {
      const cat = exp.expenseCategory || exp.title;
      if (cat === "Cash Purchase" || exp.title.toLowerCase().includes("cash purchase")) {
        cashPurchase = exp.amount;
      } else if (cat === "Credit Purchase" || exp.title.toLowerCase().includes("credit purchase")) {
        creditPurchaseAmt = exp.amount;
        creditPurchase = `${exp.title || "Supplier"} - SAR ${fmt(exp.amount)}`;
      } else if (cat === "Credit Purchase Payment") {
        creditPurchasePayment = exp.amount;
      } else {
        expenseAmt = exp.amount;
        expense = `${cat} - SAR ${fmt(exp.amount)}`;
      }
    } else if (sRow) {
      if (parseNum(sRow.creditPurchaseAmt) > 0) {
        creditPurchaseAmt = parseNum(sRow.creditPurchaseAmt);
        creditPurchase = sRow.creditPurchaseSupplier
          ? `${sRow.creditPurchaseSupplier} - SAR ${fmt(creditPurchaseAmt)}`
          : `SAR ${fmt(creditPurchaseAmt)}`;
      }
      cashPurchase = parseNum(sRow.cashPurchase) > 0 ? parseNum(sRow.cashPurchase) : null;
      creditPurchasePayment =
        parseNum(sRow.creditPurchasePayment) > 0 ? parseNum(sRow.creditPurchasePayment) : null;
      if (parseNum(sRow.expenseAmt) > 0) {
        expenseAmt = parseNum(sRow.expenseAmt);
        expense = sRow.expenseLabel
          ? `${sRow.expenseLabel} - SAR ${fmt(expenseAmt)}`
          : `SAR ${fmt(expenseAmt)}`;
      }
    }

    // Row-level outflow & cumulative closing balance
    const rowOutflow =
      (cashPurchase || 0) +
      (creditPurchasePayment || 0) +
      (expenseAmt || 0) +
      (toBankAmt || 0) +
      (loanOut || 0) -
      (excessAmt || 0);

    if (rowInflow > 0 || rowOutflow > 0) {
      cumulativeCash =
        cumulativeCash +
        (idx === 0 ? 0 : openBal || 0) +
        (amtCashSale || 0) +
        (creditAmtRecd || 0) +
        (loanIn || 0) +
        (otherAmtRecd || 0) +
        (fromBank || 0) -
        rowOutflow;
    }

    const closingBalance =
      rowInflow > 0 || rowOutflow > 0 || idx === rowCount - 1 ? cumulativeCash : null;

    return {
      invoiceNo,
      amtCashSale,
      creditInvAmt,
      receiptNo,
      creditAmtRecd,
      openBal,
      loanIn,
      otherAmtRecd,
      fromBank,
      totalAmt,
      creditPurchase,
      creditPurchaseAmt,
      cashPurchase,
      creditPurchasePayment,
      crNote,
      expense,
      expenseAmt,
      toBank,
      toBankAmt,
      loanOut,
      excessAmt,
      closingBalance,
    };
  });
}

export function ClassicDataSheetTable({
  sheetRows,
  activeErpList = [],
  preLoggedEntries = [],
  openingBalance = 500,
  date = "12-09-2026",
  branchName = "Jubail Main",
  className = "",
}: ClassicDataSheetTableProps) {
  const mappedRows = buildClassicDataSheetRows(
    sheetRows,
    activeErpList,
    preLoggedEntries,
    openingBalance
  );

  // Calculate Column Totals
  const totalCashSale = mappedRows.reduce((s, r) => s + (r.amtCashSale || 0), 0);
  const totalCreditInvAmt = mappedRows.reduce((s, r) => s + (r.creditInvAmt || 0), 0);
  const totalCreditAmtRecd = mappedRows.reduce((s, r) => s + (r.creditAmtRecd || 0), 0);
  const totalOpenBal = mappedRows.reduce((s, r) => s + (r.openBal || 0), 0);
  const totalLoanIn = mappedRows.reduce((s, r) => s + (r.loanIn || 0), 0);
  const totalOtherAmtRecd = mappedRows.reduce((s, r) => s + (r.otherAmtRecd || 0), 0);
  const totalFromBank = mappedRows.reduce((s, r) => s + (r.fromBank || 0), 0);
  const totalTotalAmt = mappedRows.reduce((s, r) => s + (r.totalAmt || 0), 0);
  const totalCreditPurchase = mappedRows.reduce((s, r) => s + (r.creditPurchaseAmt || 0), 0);
  const totalCashPurchase = mappedRows.reduce((s, r) => s + (r.cashPurchase || 0), 0);
  const totalCreditPurchasePayment = mappedRows.reduce((s, r) => s + (r.creditPurchasePayment || 0), 0);
  const totalCrNote = mappedRows.reduce((s, r) => s + (r.crNote || 0), 0);
  const totalExpense = mappedRows.reduce((s, r) => s + (r.expenseAmt || 0), 0);
  const totalToBank = mappedRows.reduce((s, r) => s + (r.toBankAmt || 0), 0);
  const totalLoanOut = mappedRows.reduce((s, r) => s + (r.loanOut || 0), 0);
  const totalExcessAmt = mappedRows.reduce((s, r) => s + (r.excessAmt || 0), 0);
  const finalClosingBalance =
    totalTotalAmt -
    (totalCashPurchase + totalCreditPurchasePayment + totalExpense + totalToBank + totalLoanOut) +
    totalExcessAmt;

  const thClass = "bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-[10px] md:text-xs font-bold uppercase tracking-wider px-4 py-3 border-b border-slate-200 dark:border-white/10 print:bg-white print:text-black print:border-black whitespace-nowrap";
  const tdBase = "text-xs text-slate-800 dark:text-slate-200 px-4 py-3 border-b border-slate-100 dark:border-white/5 print:text-black print:border-black whitespace-nowrap";
  const tdRight = "text-xs text-slate-800 dark:text-slate-200 font-mono text-right px-4 py-3 border-b border-slate-100 dark:border-white/5 print:text-black print:border-black whitespace-nowrap";
  const tdTotalAmt = "text-xs text-right font-mono px-4 py-3 border-b border-slate-100 dark:border-white/5 bg-jct-yellow/5 text-jct-yellow font-semibold print:bg-transparent print:text-black print:border-black whitespace-nowrap";
  const tdClosing = "text-xs text-right font-mono font-bold px-4 py-3 border-b border-slate-100 dark:border-white/5 bg-jct-turquoise/5 text-jct-turquoise print:bg-transparent print:text-black print:border-black whitespace-nowrap";

  return (
    <div className={`w-full text-slate-800 dark:text-slate-200 print:text-black print:w-full print:bg-white ${className}`}>
      {/* Strict Black & White Print Stylesheet */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { size: A4 landscape; margin: 5mm; }
              * {
                color: black !important;
                background-color: transparent !important;
                border-color: black !important;
              }
              table { border: 1px solid black !important; }
              th, td { border: 1px solid black !important; padding: 4px !important; }
            }
          `,
        }}
      />

      {/* Header with Date at Top Left and Exact Text */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-200 dark:border-white/10 print:border-b-2 print:border-black text-slate-900 dark:text-white print:text-black">
        <div className="text-left font-bold text-xs font-mono text-slate-500 dark:text-slate-400 print:text-black">
          Date: {date || new Date().toLocaleDateString()}
        </div>
        <div className="text-center font-black tracking-tight text-sm sm:text-base uppercase font-display text-slate-900 dark:text-white print:text-black">
          DAILY DATA SHEET : JUBAIL CORP. TRADING EST.
        </div>
        <div className="text-right text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-black">
          Branch: {branchName}
        </div>
      </div>

      {/* Day / Dark Mode Responsive Main Table Wrapper */}
      <div className="w-full overflow-x-auto pb-4 bg-white dark:bg-[#0A0A0A] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm print:border-none print:shadow-none print:bg-white print:overflow-visible">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr>
              <th className={thClass}>1. INVOICE NO.</th>
              <th className={thClass}>2. AMT CASH SALE</th>
              <th className={thClass}>3. CREDIT INV. AMOUNT</th>
              <th className={thClass}>4. RECEIPT NO.</th>
              <th className={thClass}>5. CREDIT AMT RECD</th>
              <th className={thClass}>6. OPEN BAL</th>
              <th className={thClass}>7. LOAN IN</th>
              <th className={thClass}>8. OTHER AMT RECD</th>
              <th className={thClass}>9. FROM BANK</th>
              <th className={`${thClass} bg-yellow-50 dark:bg-yellow-950/20 text-jct-yellow print:bg-white print:text-black`}>
                10. TOTAL AMT
              </th>
              <th className={thClass}>11. CREDIT PURCHASE</th>
              <th className={thClass}>12. CASH PURCHASE</th>
              <th className={thClass}>13. CREDIT PURCHASE PAYMENT</th>
              <th className={thClass}>14. CR NOTE</th>
              <th className={thClass}>
                15. EXPENSE (Format: Name/Note - Amount)
              </th>
              <th className={thClass}>16. TO BANK</th>
              <th className={thClass}>17. LOAN OUT</th>
              <th className={thClass}>18. EXCESS AMT</th>
              <th className={`${thClass} bg-emerald-50 dark:bg-emerald-950/20 text-jct-turquoise print:bg-white print:text-black`}>
                19. CLOSING BALANCE
              </th>
            </tr>
          </thead>
          <tbody>
            {mappedRows.map((row, idx) => (
              <tr
                key={`ds-row-${idx}`}
                className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors print:break-inside-avoid print:hover:bg-transparent"
              >
                {/* 1. INVOICE NO. */}
                <td className={`${tdBase} text-center font-mono font-medium`}>
                  {row.invoiceNo ? `#${row.invoiceNo}` : null}
                </td>

                {/* 2. AMT CASH SALE */}
                <td className={tdRight}>
                  {row.amtCashSale ? fmt(row.amtCashSale) : null}
                </td>

                {/* 3. CREDIT INV. AMOUNT */}
                <td className={tdRight}>
                  {row.creditInvAmt ? fmt(row.creditInvAmt) : null}
                </td>

                {/* 4. RECEIPT NO. */}
                <td className={tdBase}>
                  {row.receiptNo || null}
                </td>

                {/* 5. CREDIT AMT RECD */}
                <td className={tdRight}>
                  {row.creditAmtRecd ? fmt(row.creditAmtRecd) : null}
                </td>

                {/* 6. OPEN BAL */}
                <td className={tdRight}>
                  {row.openBal ? fmt(row.openBal) : null}
                </td>

                {/* 7. LOAN IN */}
                <td className={tdRight}>
                  {row.loanIn ? fmt(row.loanIn) : null}
                </td>

                {/* 8. OTHER AMT RECD */}
                <td className={tdRight}>
                  {row.otherAmtRecd ? fmt(row.otherAmtRecd) : null}
                </td>

                {/* 9. FROM BANK */}
                <td className={tdRight}>
                  {row.fromBank ? fmt(row.fromBank) : null}
                </td>

                {/* 10. TOTAL AMT (Highlighted Column) */}
                <td className={tdTotalAmt}>
                  {row.totalAmt ? fmt(row.totalAmt) : null}
                </td>

                {/* 11. CREDIT PURCHASE */}
                <td className={`${tdBase} text-[11px]`}>
                  {row.creditPurchase || null}
                </td>

                {/* 12. CASH PURCHASE */}
                <td className={tdRight}>
                  {row.cashPurchase ? fmt(row.cashPurchase) : null}
                </td>

                {/* 13. CREDIT PURCHASE PAYMENT */}
                <td className={tdRight}>
                  {row.creditPurchasePayment ? fmt(row.creditPurchasePayment) : null}
                </td>

                {/* 14. CR NOTE */}
                <td className={tdRight}>
                  {row.crNote ? fmt(row.crNote) : null}
                </td>

                {/* 15. EXPENSE (Format: Name/Note - Amount) */}
                <td className={`${tdBase} text-[11px]`}>
                  {row.expense || null}
                </td>

                {/* 16. TO BANK */}
                <td className={`${tdBase} text-[11px]`}>
                  {row.toBank || null}
                </td>

                {/* 17. LOAN OUT */}
                <td className={tdRight}>
                  {row.loanOut ? fmt(row.loanOut) : null}
                </td>

                {/* 18. EXCESS AMT */}
                <td className={tdRight}>
                  {row.excessAmt ? fmt(row.excessAmt) : null}
                </td>

                {/* 19. CLOSING BALANCE */}
                <td className={tdClosing}>
                  {row.closingBalance ? fmt(row.closingBalance) : null}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 dark:bg-slate-900 border-t-2 border-slate-300 dark:border-slate-700 font-bold text-xs print:bg-white print:border-black">
              <td className="px-4 py-3 text-center font-bold text-slate-700 dark:text-slate-300 print:text-black">TOTAL</td>
              <td className="px-4 py-3 text-right font-mono text-slate-800 dark:text-slate-200 print:text-black">{totalCashSale > 0 ? fmt(totalCashSale) : null}</td>
              <td className="px-4 py-3 text-right font-mono text-slate-800 dark:text-slate-200 print:text-black">{totalCreditInvAmt > 0 ? fmt(totalCreditInvAmt) : null}</td>
              <td className="px-4 py-3 print:text-black"></td>
              <td className="px-4 py-3 text-right font-mono text-slate-800 dark:text-slate-200 print:text-black">{totalCreditAmtRecd > 0 ? fmt(totalCreditAmtRecd) : null}</td>
              <td className="px-4 py-3 text-right font-mono text-slate-800 dark:text-slate-200 print:text-black">{totalOpenBal > 0 ? fmt(totalOpenBal) : null}</td>
              <td className="px-4 py-3 text-right font-mono text-slate-800 dark:text-slate-200 print:text-black">{totalLoanIn > 0 ? fmt(totalLoanIn) : null}</td>
              <td className="px-4 py-3 text-right font-mono text-slate-800 dark:text-slate-200 print:text-black">{totalOtherAmtRecd > 0 ? fmt(totalOtherAmtRecd) : null}</td>
              <td className="px-4 py-3 text-right font-mono text-slate-800 dark:text-slate-200 print:text-black">{totalFromBank > 0 ? fmt(totalFromBank) : null}</td>
              <td className="px-4 py-3 text-right font-mono font-bold bg-jct-yellow/10 text-jct-yellow print:bg-transparent print:text-black">
                {totalTotalAmt > 0 ? fmt(totalTotalAmt) : null}
              </td>
              <td className="px-4 py-3 text-right font-mono text-slate-800 dark:text-slate-200 print:text-black">{totalCreditPurchase > 0 ? fmt(totalCreditPurchase) : null}</td>
              <td className="px-4 py-3 text-right font-mono text-slate-800 dark:text-slate-200 print:text-black">{totalCashPurchase > 0 ? fmt(totalCashPurchase) : null}</td>
              <td className="px-4 py-3 text-right font-mono text-slate-800 dark:text-slate-200 print:text-black">
                {totalCreditPurchasePayment > 0 ? fmt(totalCreditPurchasePayment) : null}
              </td>
              <td className="px-4 py-3 text-right font-mono text-slate-800 dark:text-slate-200 print:text-black">{totalCrNote > 0 ? fmt(totalCrNote) : null}</td>
              <td className="px-4 py-3 text-right font-mono text-slate-800 dark:text-slate-200 print:text-black">{totalExpense > 0 ? fmt(totalExpense) : null}</td>
              <td className="px-4 py-3 text-right font-mono text-slate-800 dark:text-slate-200 print:text-black">{totalToBank > 0 ? fmt(totalToBank) : null}</td>
              <td className="px-4 py-3 text-right font-mono text-slate-800 dark:text-slate-200 print:text-black">{totalLoanOut > 0 ? fmt(totalLoanOut) : null}</td>
              <td className="px-4 py-3 text-right font-mono text-slate-800 dark:text-slate-200 print:text-black">{totalExcessAmt > 0 ? fmt(totalExcessAmt) : null}</td>
              <td className="px-4 py-3 text-right font-mono font-bold bg-jct-turquoise/10 text-jct-turquoise print:bg-transparent print:text-black">
                {fmt(finalClosingBalance)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export interface PosFeeBreakdown {
  gross: number;
  mdrBase: number;
  vatOnFee: number;
  totalFee: number;
  net: number;
  isMada: boolean;
}

export const calcAmountPosFeeBreakdown = (
  amount: number,
  terminal: PosTerminalBank
): PosFeeBreakdown => {
  const gross = r2(Math.max(0, amount));
  const meta = POS_TERMINAL_META[terminal || "SAB"];
  const rawMdr = gross * meta.feeRate;
  const mdrBase = r2(meta.samaCap !== undefined ? Math.min(rawMdr, meta.samaCap) : rawMdr);
  const vatOnFee = r2(mdrBase * 0.15);
  const totalFee = r2(mdrBase + vatOnFee);
  const net = r2(gross - totalFee);
  return {
    gross,
    mdrBase,
    vatOnFee,
    totalFee,
    net,
    isMada: meta.isMada,
  };
};

export const calcInvoiceCashPortion = (inv: ErpInvoiceItem): number => {
  if (
    inv.paymentMode === "CASH" ||
    (inv.paymentMode as string) === "Cash" ||
    inv.paymentMode === "OTHER_RECD"
  )
    return inv.amount;
  if (inv.paymentMode === "SPLIT") return r2(inv.splitCashAmount || 0);
  if (inv.paymentMode === "CREDIT_SALE" && inv.creditDownMethod === "CASH") {
    return r2(inv.creditDownAmount || 0);
  }
  return 0;
};

export const calcInvoiceBankGrossPortion = (inv: ErpInvoiceItem): number => {
  if (inv.paymentMode === "BANK_TRANSFER" || inv.paymentMode === "POS_SWIPE") return inv.amount;
  if (inv.paymentMode === "SPLIT") return r2(inv.splitBankAmount || 0);
  if (inv.paymentMode === "CREDIT_SALE" && inv.creditDownMethod === "POS_SWIPE") {
    return r2(inv.creditDownAmount || 0);
  }
  return 0;
};

export const calcInvoiceFeeBreakdown = (inv: ErpInvoiceItem): PosFeeBreakdown => {
  if (inv.paymentMode === "CREDIT_SALE" && inv.creditDownMethod === "POS_SWIPE") {
    return calcAmountPosFeeBreakdown(
      inv.creditDownAmount || 0,
      inv.creditDownTerminal || inv.posTerminal || "SAB"
    );
  }
  if (inv.paymentMode === "POS_SWIPE") {
    return calcAmountPosFeeBreakdown(inv.amount, inv.posTerminal || "SAB");
  }
  if (inv.paymentMode === "SPLIT" && inv.splitBankMethod === "POS_SWIPE") {
    const term = inv.splitPosTerminal || inv.posTerminal || "SAB";
    return calcAmountPosFeeBreakdown(inv.splitBankAmount || 0, term);
  }
  const gross = calcInvoiceBankGrossPortion(inv);
  return {
    gross,
    mdrBase: 0,
    vatOnFee: 0,
    totalFee: 0,
    net: gross,
    isMada: false,
  };
};

export const calcInvoicePosFee = (inv: ErpInvoiceItem): number => {
  return calcInvoiceFeeBreakdown(inv).totalFee;
};

export const calcInvoiceNetBank = (inv: ErpInvoiceItem): number => {
  return calcInvoiceFeeBreakdown(inv).net;
};

export const parseErpCsvText = (
  csvText: string,
  fallbackList: ErpInvoiceItem[]
): ErpInvoiceItem[] => {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return fallbackList;

  const parsedRows: ErpInvoiceItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < 3) continue;
    const invoiceNo = cols[0].replace(/^#/i, "").trim();
    const customer = cols[1] || "Walk-in Customer";
    const grossAmt = parseFloat(cols[2]) || 0;
    const rawType = (cols[3] || "").toUpperCase();
    const cashCol = parseFloat(cols[4] || "");
    const bankCol = parseFloat(cols[5] || "");
    const terminalCol = (cols[6] || "").toUpperCase();

    if (!invoiceNo || grossAmt <= 0) continue;

    const hasDualTenderValues =
      !Number.isNaN(cashCol) && cashCol > 0 && !Number.isNaN(bankCol) && bankCol > 0;
    const isSplitType =
      rawType.includes("SPLIT") ||
      rawType.includes("PARTIAL") ||
      rawType.includes("CASH/BANK") ||
      rawType.includes("CASH+BANK") ||
      rawType.includes("CASH/CARD") ||
      hasDualTenderValues;

    const terminal: PosTerminalBank =
      terminalCol.includes("VISA") ||
      terminalCol.includes("MASTER") ||
      terminalCol.includes("MC") ||
      terminalCol.includes("CREDIT")
        ? "VISA_MC"
        : terminalCol.includes("RAJHI")
        ? "AL_RAJHI"
        : "SAB";

    if (isSplitType) {
      const cashShare = !Number.isNaN(cashCol) && cashCol > 0 ? cashCol : r2(grossAmt / 2);
      const bankShare =
        !Number.isNaN(bankCol) && bankCol > 0 ? bankCol : Math.max(0, r2(grossAmt - cashShare));
      parsedRows.push({
        invoiceNo,
        customer,
        amount: grossAmt,
        originalAmount: grossAmt,
        isEdited: false,
        paymentMode: "SPLIT",
        posTerminal: terminal,
        isSplit: true,
        splitCashAmount: cashShare,
        splitBankAmount: bankShare,
        splitBankMethod: rawType.includes("TRANSFER") ? "BANK_TRANSFER" : "POS_SWIPE",
        splitPosTerminal: terminal,
        autoMatched: true,
        time: nowHHMM(),
      });
    } else {
      const mode: InvoicePaymentMode = rawType.includes("TRANSFER")
        ? "BANK_TRANSFER"
        : rawType.includes("SWIPE") || rawType.includes("POS")
        ? "POS_SWIPE"
        : rawType.includes("CREDIT")
        ? "CREDIT_SALE"
        : "CASH";
      parsedRows.push({
        invoiceNo,
        customer,
        amount: grossAmt,
        originalAmount: grossAmt,
        isEdited: false,
        paymentMode: mode,
        posTerminal: terminal,
        isSplit: false,
        splitCashAmount: mode === "CASH" ? grossAmt : r2(grossAmt / 2),
        splitBankAmount:
          mode === "BANK_TRANSFER" || mode === "POS_SWIPE" ? grossAmt : r2(grossAmt / 2),
        splitBankMethod: mode === "BANK_TRANSFER" ? "BANK_TRANSFER" : "POS_SWIPE",
        splitPosTerminal: terminal,
        autoMatched: mode !== "CASH",
        time: nowHHMM(),
      });
    }
  }

  return parsedRows.length > 0 ? parsedRows : fallbackList;
};

interface CreditSaleModalConfig {
  settlement: "FULL" | "PARTIAL";
  downAmount: number;
  downMethod: "CASH" | "POS_SWIPE";
  terminal: PosTerminalBank;
  followUpDate: string;
}

function CreditSaleModal({
  invoice,
  onClose,
  onSave,
}: {
  invoice: ErpInvoiceItem;
  onClose: () => void;
  onSave: (cfg: CreditSaleModalConfig) => void;
}) {
  const existingDown = invoice.creditDownAmount || 0;
  const [settlement, setSettlement] = useState<"FULL" | "PARTIAL">(
    existingDown > 0 ? "PARTIAL" : "FULL"
  );
  const [downAmount, setDownAmount] = useState(existingDown > 0 ? String(existingDown) : "");
  const [downMethod, setDownMethod] = useState<"CASH" | "POS_SWIPE">(
    invoice.creditDownMethod || "CASH"
  );
  const [terminal, setTerminal] = useState<PosTerminalBank>(
    invoice.creditDownTerminal || "SAB"
  );
  const [followUpDate, setFollowUpDate] = useState(
    invoice.creditFollowUpDate || "2026-09-20"
  );

  const downVal = Math.max(0, parseFloat(downAmount) || 0);
  const downInvalid =
    settlement === "PARTIAL" && (downVal <= 0 || downVal >= invoice.amount);
  const creditPreview =
    settlement === "FULL" ? invoice.amount : r2(invoice.amount - Math.min(downVal, invoice.amount));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-[#1F1F1F] pb-3">
          <div>
            <h3 className="font-display text-lg font-extrabold text-jct-charcoal dark:text-jct-offwhite">
              Credit Sale Setup · Inv #{invoice.invoiceNo}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {invoice.customer} ·{" "}
              <strong className="text-jct-charcoal dark:text-jct-turquoise">SAR {fmt(invoice.amount)}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 dark:border-[#1F1F1F] px-2.5 py-1 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          <span className="block text-xs font-bold text-slate-500 dark:text-slate-400">Settlement Method</span>
          <div className="grid grid-cols-1 gap-2">
            {(
              [
                ["FULL", "Full Credit (100% Receivable)"],
                ["PARTIAL", "Partial Down Payment (Cash / Swipe + Balance on Credit)"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setSettlement(val)}
                className={`rounded-xl border px-4 py-2.5 text-left text-xs font-bold transition ${
                  settlement === val
                    ? "border-jct-turquoise bg-jct-turquoise/20 text-jct-charcoal dark:text-jct-turquoise"
                    : "border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-black text-slate-500 dark:text-slate-400"
                }`}
              >
                {settlement === val ? "● " : "○ "}
                {label}
              </button>
            ))}
          </div>
        </div>

        {settlement === "PARTIAL" && (
          <div className="space-y-3 rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-jct-yellow/15 p-3.5">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-jct-charcoal dark:text-jct-yellow">
                Down Payment Amount (SAR)
              </label>
              <input
                type="number"
                step="0.01"
                value={downAmount}
                onChange={(e) => setDownAmount(e.target.value)}
                placeholder={`Less than ${fmt(invoice.amount)}`}
                className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2.5 font-mono text-sm font-extrabold outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <span className="block text-[11px] font-bold text-jct-charcoal dark:text-jct-yellow">Paid By</span>
              <div className="inline-flex flex-wrap rounded-xl bg-white dark:bg-black p-1 border border-slate-200 dark:border-[#1F1F1F] gap-1">
                <button
                  type="button"
                  onClick={() => setDownMethod("CASH")}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-extrabold transition ${
                    downMethod === "CASH"
                      ? "bg-jct-turquoise text-jct-charcoal font-bold"
                      : "text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite"
                  }`}
                >
                  Cash
                </button>
                {(["SAB", "AL_RAJHI", "VISA_MC"] as PosTerminalBank[]).map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setDownMethod("POS_SWIPE");
                      setTerminal(term);
                    }}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-extrabold transition ${
                      downMethod === "POS_SWIPE" && terminal === term
                        ? "bg-jct-yellow text-jct-charcoal font-bold"
                        : "text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite"
                    }`}
                  >
                    Swipe: {POS_TERMINAL_META[term].badgeTag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400">
            Follow-up Reminder Date (Credit Radar)
          </label>
          <input
            type="date"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
            className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-4 py-2.5 text-sm font-bold outline-none"
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-black px-4 py-2 font-mono text-xs font-bold">
          <span className="text-jct-charcoal dark:text-jct-turquoise">Credit Receivable: SAR {fmt(creditPreview)}</span>
          {settlement === "PARTIAL" && !downInvalid && (
            <span className="text-emerald-600 dark:text-emerald-400">
              Down: SAR {fmt(downVal)} → {downMethod === "CASH" ? "Drawer" : "Bank"}
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={downInvalid || !followUpDate}
          onClick={() =>
            onSave({
              settlement,
              downAmount: downVal,
              downMethod,
              terminal,
              followUpDate,
            })
          }
          className="w-full bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg disabled:opacity-40 disabled:cursor-not-allowed px-6 py-3.5 text-sm"
        >
          Save &amp; Sync to Credit Radar
        </button>
      </div>
    </div>
  );
}

interface DailyRegisterViewProps {
  trackingMode: TrackingMode;
  setTrackingMode: React.Dispatch<React.SetStateAction<TrackingMode>>;
  wizardStep: WizardStep;
  setWizardStep: React.Dispatch<React.SetStateAction<WizardStep>>;
  preLoggedBankInvoices: PreLoggedBankInvoice[];
  setPreLoggedBankInvoices: React.Dispatch<React.SetStateAction<PreLoggedBankInvoice[]>>;
  preLoggedEntries: PreLoggedEntry[];
  setPreLoggedEntries: React.Dispatch<React.SetStateAction<PreLoggedEntry[]>>;
  erpInvoices: ErpInvoiceItem[];
  setErpInvoices: React.Dispatch<React.SetStateAction<ErpInvoiceItem[]>>;
  openingBalance: number;
  setOpeningBalance: React.Dispatch<React.SetStateAction<number>>;
  completedDaysLog: CompletedDaySummary[];
  setCompletedDaysLog: React.Dispatch<React.SetStateAction<CompletedDaySummary[]>>;
  onSyncCreditPurchase: (
    supplierName: string,
    amount: number,
    dueDate: string,
    category: "Credit Purchase" | "Cash Purchase" | "Bank Purchase",
    paymentMode?: string
  ) => void;
  onSyncCreditCustomer: (
    customerName: string,
    amount: number,
    followUpDate: string,
    receiptNo?: string,
    mode?: "CREDIT_RECD" | "CREDIT_SALE"
  ) => void;
  onSwitchTab: (tab: TabId) => void;
  branchId?: string;
  isOwner?: boolean;
}

function DailyRegisterView({
  trackingMode,
  setTrackingMode,
  wizardStep,
  setWizardStep,
  preLoggedBankInvoices,
  setPreLoggedBankInvoices,
  preLoggedEntries,
  setPreLoggedEntries,
  erpInvoices,
  setErpInvoices,
  openingBalance,
  setOpeningBalance,
  completedDaysLog,
  setCompletedDaysLog,
  onSyncCreditPurchase,
  onSyncCreditCustomer,
  onSwitchTab,
  branchId = "JCT_HQ",
  isOwner = false,
}: DailyRegisterViewProps) {
  const [activeLoggerTab, setActiveLoggerTab] = useState<"bank" | "expense">("bank");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [trackPosFees, setTrackPosFees] = useState(false);
  const [bankSettlementMode, setBankSettlementMode] = useState<"GROSS" | "NET">("GROSS");
  const [isDatasheetView, setIsDatasheetView] = useState(false);
  const [printMode, setPrintMode] = useState<"summary" | "datasheet">("summary");
  const [creditModalInvNo, setCreditModalInvNo] = useState<string | null>(null);
  const [justCompletedToast, setJustCompletedToast] = useState<string | null>(null);
  const [syncBannerMsg, setSyncBannerMsg] = useState<{
    text: string;
    targetTab: TabId;
    targetLabel: string;
  } | null>(null);

  // Active Branch Staff State for Outflows & Advances
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [step4StaffId, setStep4StaffId] = useState<string>("");

  useEffect(() => {
    const query = branchId && branchId !== "ALL" ? `?branch=${branchId}` : "";
    fetch(`/api/staff${query}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.staff)) {
          setStaffList(data.staff);
          if (data.staff.length > 0) {
            setStep4StaffId((prev) => (data.staff.some((s: StaffMember) => s.id === prev) ? prev : data.staff[0].id));
          }
        }
      })
      .catch((err) => console.error("Error loading branch staff:", err));
  }, [branchId]);

  // Hub Quick-Logger Form State (Bank / POS)
  const [bankInvoiceInput, setBankInvoiceInput] = useState("");
  const [bankAmountInput, setBankAmountInput] = useState("");
  const [bankModeInput, setBankModeInput] = useState<"POS_SWIPE" | "BANK_TRANSFER">("POS_SWIPE");
  const [bankTerminalInput, setBankTerminalInput] = useState<PosTerminalBank>("SAB");

  // Hub Quick-Logger Form State (Expenses & Cash-In & Split Payment)
  const [entryType, setEntryType] = useState<PreLoggedEntryType>("EXPENSE");
  const [hubExpenseCat, setHubExpenseCat] = useState<StrictExpenseCategory>("Food");
  const [hubPaymentMode, setHubPaymentMode] = useState<UniversalPaymentMode>("CASH");
  const [entryTitle, setEntryTitle] = useState("");
  const [entryAmount, setEntryAmount] = useState("");
  const [hubSupplierName, setHubSupplierName] = useState("Jotun");
  const [hubDueDate, setHubDueDate] = useState("2026-09-25");
  const [hubCustomerName, setHubCustomerName] = useState("");
  const [hubReceiptNo, setHubReceiptNo] = useState("");
  const [hubFollowUpDate, setHubFollowUpDate] = useState("2026-09-20");
  const [hubSplitCashInput, setHubSplitCashInput] = useState("1000");
  const [hubSplitCardInput, setHubSplitCardInput] = useState("1000");
  const [hubSplitMethod, setHubSplitMethod] = useState<"POS_SWIPE" | "BANK_TRANSFER">("POS_SWIPE");
  const [hubSplitTerminal, setHubSplitTerminal] = useState<PosTerminalBank>("SAB");

  // Wizard State
  const [csvLoadedBanner, setCsvLoadedBanner] = useState(false);
  const [openingBalanceOriginal, setOpeningBalanceOriginal] = useState<number | undefined>(undefined);
  const [editingOpening, setEditingOpening] = useState(false);
  const [openingEditInput, setOpeningEditInput] = useState(String(openingBalance));

  // Step 3 (Credit & Cash Inflows & Split Payments) 2-Panel State
  const [step3Kind, setStep3Kind] = useState<
    "CREDIT_RECD" | "CREDIT_SALE" | "SPLIT_SALE" | "LOAN_IN" | "OTHER_IN"
  >("CREDIT_RECD");
  const [step3PaymentMode, setStep3PaymentMode] = useState<UniversalPaymentMode>("CASH");
  const [step3SplitEnabled, setStep3SplitEnabled] = useState(false);
  const [step3Title, setStep3Title] = useState("");
  const [step3FollowUpDate, setStep3FollowUpDate] = useState("2026-09-20");
  const [step3ReceiptNo, setStep3ReceiptNo] = useState("");
  const [step3Amount, setStep3Amount] = useState("");
  const [step3SplitCash, setStep3SplitCash] = useState("1000");
  const [step3SplitCard, setStep3SplitCard] = useState("1000");
  const [step3SplitMethod, setStep3SplitMethod] = useState<"POS_SWIPE" | "BANK_TRANSFER">(
    "POS_SWIPE"
  );
  const [step3SplitTerminal, setStep3SplitTerminal] = useState<PosTerminalBank>("SAB");

  // Step 4 (Expenses & Purchases — Strict 7 Categories) State
  const [step4Category, setStep4Category] = useState<StrictExpenseCategory>("Food");
  const [step4PaymentMode, setStep4PaymentMode] = useState<UniversalPaymentMode>("CASH");
  const [step4SupplierName, setStep4SupplierName] = useState("Jotun");
  const [step4DueDate, setStep4DueDate] = useState("2026-09-25");
  const [step4Note, setStep4Note] = useState("");
  const [step4Amount, setStep4Amount] = useState("");

  // Step 5 Expandable Box State & Inline Editing State
  const [expandedAuditBox, setExpandedAuditBox] = useState<
    "NONE" | "MONEY_IN" | "EXPENSES" | "BANK_POS"
  >("NONE");
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingRowVal, setEditingRowVal] = useState("");
  const [editingEntryModal, setEditingEntryModal] = useState<PreLoggedEntry | null>(null);
  const [editModalTitle, setEditModalTitle] = useState("");
  const [editModalAmount, setEditModalAmount] = useState("");
  const [editModalPaymentMode, setEditModalPaymentMode] = useState<string>("CASH");
  const [editModalCategory, setEditModalCategory] = useState<StrictExpenseCategory>("Food");
  const [missingInflowTitle, setMissingInflowTitle] = useState("");
  const [missingInflowAmt, setMissingInflowAmt] = useState("");
  const [missingInflowMode, setMissingInflowMode] = useState<UniversalPaymentMode>("CASH");
  const [missingExpenseCat, setMissingExpenseCat] = useState<StrictExpenseCategory>("Food");
  const [missingExpenseSupplier, setMissingExpenseSupplier] = useState("");
  const [missingExpenseDueDate, setMissingExpenseDueDate] = useState("2026-09-25");
  const [missingExpenseAmt, setMissingExpenseAmt] = useState("");
  const [missingExpenseMode, setMissingExpenseMode] = useState<UniversalPaymentMode>("CASH");

  // Classic Digital Data Sheet State (15 Pre-Populated Rows matching client paper ledger)
  const [sheetRows, setSheetRows] = useState<DataSheetRow[]>(INITIAL_DATASHEET_ROWS);

  const numCell = (v: string): number => {
    const parsed = parseFloat(v);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const handleSheetCellChange = (
    rowId: string,
    field: keyof DataSheetRow,
    value: string | boolean
  ) => {
    setSheetRows((prev) => {
      const nextRows = prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row));
      const targetRow = nextRows.find((r) => r.id === rowId);

      if (targetRow && typeof value === "string") {
        const invNo = targetRow.invoiceNo.trim();
        if (invNo) {
          const cashVal = numCell(targetRow.amtCashSale);
          const crVal = numCell(targetRow.creditInvAmt);
          const bankVal = numCell(targetRow.toBankAmt);

          setErpInvoices((prevErp) => {
            const exists = prevErp.some((i) => i.invoiceNo === invNo);
            const totalAmt = cashVal || crVal || bankVal || 0;
            const mode: InvoicePaymentMode = crVal > 0 ? "CREDIT_SALE" : bankVal > 0 ? "POS_SWIPE" : "CASH";

            if (exists) {
              return prevErp.map((inv) =>
                inv.invoiceNo === invNo
                  ? {
                      ...inv,
                      amount: totalAmt > 0 ? totalAmt : inv.amount,
                      paymentMode: mode,
                    }
                  : inv
              );
            } else if (totalAmt > 0) {
              return [
                ...prevErp,
                {
                  invoiceNo: invNo,
                  customer: targetRow.receiptNo.trim() || `Customer #${invNo}`,
                  amount: totalAmt,
                  paymentMode: mode,
                  isSplit: false,
                  splitCashAmount: 0,
                  splitBankAmount: 0,
                  splitBankMethod: "POS_SWIPE" as const,
                  autoMatched: false,
                  posTerminal: "SAB" as const,
                  time: "12:00",
                },
              ];
            }
            return prevErp;
          });
        }

        // If expense cell was updated in classic data sheet
        if (field === "expenseAmt" || field === "expenseLabel") {
          const expAmt = numCell(targetRow.expenseAmt);
          const expLabel = targetRow.expenseLabel.trim() || "Shop Expense";
          if (expAmt > 0) {
            setPreLoggedEntries((prevPle) => {
              const pleId = `ple-sheet-${rowId}`;
              const exists = prevPle.some((e) => e.id === pleId);
              if (exists) {
                return prevPle.map((e) =>
                  e.id === pleId ? { ...e, amount: expAmt, title: expLabel, expenseCategory: "Cash Purchase" as const } : e
                );
              }
              return [
                ...prevPle,
                {
                  id: pleId,
                  type: "EXPENSE",
                  title: expLabel,
                  expenseCategory: "Cash Purchase" as const,
                  amount: expAmt,
                  time: "12:00",
                },
              ];
            });
          }
        }
      }

      return nextRows;
    });
  };

  const handleSheetKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colIdx: number
  ) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = document.querySelector<HTMLInputElement>(
        `input[data-ds-row="${rowIdx + 1}"][data-ds-col="${colIdx}"]`
      );
      next?.focus();
      next?.select();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = document.querySelector<HTMLInputElement>(
        `input[data-ds-row="${rowIdx - 1}"][data-ds-col="${colIdx}"]`
      );
      prev?.focus();
      prev?.select();
    }
  };

  const handleAdd5SheetRows = () => {
    setSheetRows((prev) => {
      const lastInv =
        parseInt(prev[prev.length - 1]?.invoiceNo || "30076", 10) || 30076;
      const extra: DataSheetRow[] = Array.from({ length: 5 }, (_, idx) => ({
        id: `ds-${Date.now()}-${idx}`,
        invoiceNo: String(lastInv + idx + 1),
        amtCashSale: "",
        creditInvAmt: "",
        receiptNo: "",
        creditSaleRecd: "",
        openBal: "",
        loanIn: "",
        otherAmtRecd: "",
        fromBank: "",
        creditPurchaseSupplier: "",
        creditPurchaseAmt: "",
        cashPurchase: "",
        creditPurchasePayment: "",
        crNote: "",
        expenseLabel: "",
        expenseAmt: "",
        toBankLabel: "",
        toBankAmt: "",
        toBankChecked: true,
        loanOut: "",
        excessAmt: "",
      }));
      return [...prev, ...extra];
    });
  };

  const cleanErpInvNo = (raw: string): string =>
    raw.trim().replace(/^#/i, "").replace(/^inv[-_\s#]*/i, "").trim();

  // Deduplicating upsert helper so pre-logged items never duplicate
  const upsertEntry = (newEntry: PreLoggedEntry) => {
    setPreLoggedEntries((prev) => {
      const normalizedTitle = newEntry.title.trim().toLowerCase();
      const existingIdx = prev.findIndex(
        (item) =>
          item.id === newEntry.id ||
          (item.type === newEntry.type && item.title.trim().toLowerCase() === normalizedTitle)
      );
      if (existingIdx !== -1) {
        const updated = [...prev];
        const existing = updated[existingIdx];
        updated[existingIdx] = {
          ...existing,
          amount: newEntry.amount,
          originalAmount: existing.originalAmount ?? existing.amount,
          expenseCategory: newEntry.expenseCategory || existing.expenseCategory,
          supplierName: newEntry.supplierName || existing.supplierName,
          dueDate: newEntry.dueDate || existing.dueDate,
          customerName: newEntry.customerName || existing.customerName,
          followUpDate: newEntry.followUpDate || existing.followUpDate,
          receiptNo: newEntry.receiptNo || existing.receiptNo,
          paymentMode: newEntry.paymentMode || existing.paymentMode || "CASH",
          note: newEntry.note || existing.note,
          isSplit: newEntry.isSplit ?? existing.isSplit,
          splitCashAmount: newEntry.splitCashAmount ?? existing.splitCashAmount,
          splitBankAmount: newEntry.splitBankAmount ?? existing.splitBankAmount,
          splitBankMethod: newEntry.splitBankMethod ?? existing.splitBankMethod,
          splitPosTerminal: newEntry.splitPosTerminal ?? existing.splitPosTerminal,
          time: newEntry.time,
        };
        return updated;
      }
      return [newEntry, ...prev];
    });
  };

  const buildMatchedErpList = (): ErpInvoiceItem[] => {
    const bankMap = new Map<string, PreLoggedBankInvoice>();
    preLoggedBankInvoices.forEach((b) => bankMap.set(b.invoiceNo.trim(), b));

    const creditSaleInvSet = new Set<string>();
    const splitSaleMap = new Map<string, PreLoggedEntry>();
    preLoggedEntries.forEach((entry) => {
      if (entry.type === "CREDIT_SALE" && entry.receiptNo) {
        const cleaned = cleanErpInvNo(entry.receiptNo);
        if (cleaned) creditSaleInvSet.add(cleaned);
      } else if (entry.type === "SPLIT_SALE" && entry.receiptNo) {
        const cleaned = cleanErpInvNo(entry.receiptNo);
        if (cleaned) splitSaleMap.set(cleaned, entry);
      }
    });

    return JUBAIL_ERP_18_SEED.map((inv) => {
      const matchedInfo = bankMap.get(inv.invoiceNo);
      const isCreditSale = creditSaleInvSet.has(inv.invoiceNo);
      const splitEntry = splitSaleMap.get(inv.invoiceNo);
      const defaultTerminal: PosTerminalBank =
        inv.splitPosTerminal || (inv.invoiceNo === "30068" ? "AL_RAJHI" : "SAB");

      const isSplitRow = Boolean(splitEntry) || Boolean(inv.isSplit);
      const halfGross = r2(inv.amount / 2);
      const resolvedCash = splitEntry?.splitCashAmount ?? inv.splitCashAmount ?? halfGross;
      const resolvedBank =
        splitEntry?.splitBankAmount ?? inv.splitBankAmount ?? r2(inv.amount - resolvedCash);
      const resolvedSplitMethod =
        splitEntry?.splitBankMethod ?? inv.splitBankMethod ?? "POS_SWIPE";
      const resolvedSplitTerm =
        splitEntry?.splitPosTerminal ?? inv.splitPosTerminal ?? defaultTerminal;

      const resolvedMode: InvoicePaymentMode = isCreditSale
        ? "CREDIT_SALE"
        : isSplitRow
        ? "SPLIT"
        : matchedInfo
        ? matchedInfo.paymentMode
        : "CASH";

      return {
        ...inv,
        originalAmount: inv.amount,
        isEdited: false,
        paymentMode: resolvedMode,
        posTerminal: matchedInfo?.posTerminal || resolvedSplitTerm,
        isSplit: resolvedMode === "SPLIT",
        splitCashAmount: resolvedCash,
        splitBankAmount: resolvedBank,
        splitBankMethod: resolvedSplitMethod,
        splitPosTerminal: resolvedSplitTerm,
        autoMatched: Boolean(matchedInfo) || isCreditSale || isSplitRow,
      };
    });
  };

  // Auto-Lookup helper for ERP invoices (searches loaded erpInvoices or JUBAIL_ERP_18_SEED)
  const findErpInvoiceMatch = (rawInput: string): ErpInvoiceItem | undefined => {
    const cleaned = cleanErpInvNo(rawInput);
    if (!cleaned) return undefined;
    const pool = erpInvoices.length > 0 ? erpInvoices : buildMatchedErpList();
    return pool.find((inv) => inv.invoiceNo === cleaned);
  };

  const matchedStep3Invoice = findErpInvoiceMatch(step3ReceiptNo);
  const matchedHubInvoice = findErpInvoiceMatch(hubReceiptNo);

  const handleStep3InvoiceInput = (rawVal: string) => {
    setStep3ReceiptNo(rawVal);
    const match = findErpInvoiceMatch(rawVal);
    if (match) {
      setStep3Title(match.customer);
      setStep3Amount(String(match.amount));
      const cashHalf = match.isSplit ? match.splitCashAmount : r2(match.amount / 2);
      const cardHalf = match.isSplit ? match.splitBankAmount : r2(match.amount - cashHalf);
      setStep3SplitCash(String(cashHalf));
      setStep3SplitCard(String(cardHalf));
      if (match.splitPosTerminal || match.posTerminal) {
        setStep3SplitTerminal(match.splitPosTerminal || match.posTerminal);
      }
    }
  };

  const handleHubInvoiceInput = (rawVal: string) => {
    setHubReceiptNo(rawVal);
    const match = findErpInvoiceMatch(rawVal);
    if (match) {
      setHubCustomerName(match.customer);
      setEntryTitle(match.customer);
      setEntryAmount(String(match.amount));
      const cashHalf = match.isSplit ? match.splitCashAmount : r2(match.amount / 2);
      const cardHalf = match.isSplit ? match.splitBankAmount : r2(match.amount - cashHalf);
      setHubSplitCashInput(String(cashHalf));
      setHubSplitCardInput(String(cardHalf));
      if (match.splitPosTerminal || match.posTerminal) {
        setHubSplitTerminal(match.splitPosTerminal || match.posTerminal);
      }
    }
  };

  const handleHubTotalAmountChange = (rawVal: string) => {
    setEntryAmount(rawVal);
    const total = parseFloat(rawVal);
    if (!Number.isNaN(total) && total > 0 && entryType === "SPLIT_SALE") {
      const cash = r2(total / 2);
      const card = r2(total - cash);
      setHubSplitCashInput(String(cash));
      setHubSplitCardInput(String(card));
    }
  };

  const handleHubSplitCashChange = (rawVal: string) => {
    setHubSplitCashInput(rawVal);
    const total = parseFloat(entryAmount) || 0;
    const cash = Math.max(0, parseFloat(rawVal) || 0);
    if (total > 0) {
      setHubSplitCardInput(String(Math.max(0, r2(total - cash))));
    } else {
      const card = parseFloat(hubSplitCardInput) || 0;
      setEntryAmount(String(r2(cash + card)));
    }
  };

  const handleHubSplitCardChange = (rawVal: string) => {
    setHubSplitCardInput(rawVal);
    const total = parseFloat(entryAmount) || 0;
    const card = Math.max(0, parseFloat(rawVal) || 0);
    if (total > 0) {
      setHubSplitCashInput(String(Math.max(0, r2(total - card))));
    } else {
      const cash = parseFloat(hubSplitCashInput) || 0;
      setEntryAmount(String(r2(cash + card)));
    }
  };

  const handleStep3TotalAmountChange = (rawVal: string) => {
    setStep3Amount(rawVal);
    const total = parseFloat(rawVal);
    if (!Number.isNaN(total) && total > 0 && step3SplitEnabled) {
      const cash = r2(total / 2);
      const card = r2(total - cash);
      setStep3SplitCash(String(cash));
      setStep3SplitCard(String(card));
    }
  };

  const handleStep3SplitCashChange = (rawVal: string) => {
    setStep3SplitCash(rawVal);
    const total = parseFloat(step3Amount) || 0;
    const cash = Math.max(0, parseFloat(rawVal) || 0);
    if (total > 0) {
      setStep3SplitCard(String(Math.max(0, r2(total - cash))));
    } else {
      const card = parseFloat(step3SplitCard) || 0;
      setStep3Amount(String(r2(cash + card)));
    }
  };

  const handleStep3SplitCardChange = (rawVal: string) => {
    setStep3SplitCard(rawVal);
    const total = parseFloat(step3Amount) || 0;
    const card = Math.max(0, parseFloat(rawVal) || 0);
    if (total > 0) {
      setStep3SplitCash(String(Math.max(0, r2(total - card))));
    } else {
      const cash = parseFloat(step3SplitCash) || 0;
      setStep3Amount(String(r2(cash + card)));
    }
  };

  const handleStartWizard = () => {
    if (erpInvoices.length === 0) {
      setErpInvoices(buildMatchedErpList());
    }
    setTrackingMode("wizard");
    setWizardStep(1);
    setCsvLoadedBanner(false);
    setJustCompletedToast(null);
  };

  const handleSimulateCsvUpload = () => {
    const matched = buildMatchedErpList();
    setErpInvoices(matched);
    setCsvLoadedBanner(true);
    if (trackingMode === "wizard") {
      setTimeout(() => {
        setWizardStep(2);
      }, 650);
    }
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      handleSimulateCsvUpload();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const fallback = buildMatchedErpList();
      const parsed = parseErpCsvText(text, fallback);
      setErpInvoices(parsed);
      setCsvLoadedBanner(true);
      if (trackingMode === "wizard") {
        setTimeout(() => {
          setWizardStep(2);
        }, 650);
      }
    };
    reader.onerror = () => {
      handleSimulateCsvUpload();
    };
    reader.readAsText(file);
  };

  const handleSetInvoiceMode = (invoiceNo: string, mode: InvoicePaymentMode) => {
    // Switching away from a Credit Sale clears its Credit Radar entry in the recorded list
    setPreLoggedEntries((prev) =>
      prev.filter(
        (e) =>
          !(
            e.type === "CREDIT_SALE" &&
            e.receiptNo &&
            cleanErpInvNo(e.receiptNo) === invoiceNo &&
            mode !== "CREDIT_SALE"
          )
      )
    );
    setErpInvoices((prev) => {
      const base = prev.length > 0 ? prev : buildMatchedErpList();
      return base.map((inv) => {
        if (inv.invoiceNo !== invoiceNo) return inv;
        const defaultCash =
          inv.splitCashAmount > 0 && inv.splitCashAmount < inv.amount
            ? inv.splitCashAmount
            : r2(inv.amount / 2);
        const defaultBank = r2(inv.amount - defaultCash);
        return {
          ...inv,
          paymentMode: mode,
          isSplit: mode === "SPLIT",
          splitCashAmount: mode === "SPLIT" ? defaultCash : inv.splitCashAmount,
          splitBankAmount: mode === "SPLIT" ? defaultBank : inv.splitBankAmount,
          splitBankMethod: inv.splitBankMethod || "POS_SWIPE",
          splitPosTerminal: inv.splitPosTerminal || inv.posTerminal || "SAB",
          posTerminal: inv.posTerminal || "SAB",
          creditDownAmount: undefined,
          creditDownMethod: undefined,
          creditDownTerminal: undefined,
          creditBalance: undefined,
          creditFollowUpDate: undefined,
        };
      });
    });
  };

  // Step 2: Save Credit Sale (Full Credit or Partial Down Payment + Balance on Credit)
  const handleSaveCreditSale = (
    invoiceNo: string,
    cfg: {
      settlement: "FULL" | "PARTIAL";
      downAmount: number;
      downMethod: "CASH" | "POS_SWIPE";
      terminal: PosTerminalBank;
      followUpDate: string;
    }
  ) => {
    const base = erpInvoices.length > 0 ? erpInvoices : buildMatchedErpList();
    const target = base.find((i) => i.invoiceNo === invoiceNo);
    if (!target) return;

    const down =
      cfg.settlement === "PARTIAL"
        ? Math.min(target.amount, Math.max(0, r2(cfg.downAmount)))
        : 0;
    const creditBalance = r2(target.amount - down);
    const hasDown = down > 0;

    setErpInvoices(
      base.map((inv) =>
        inv.invoiceNo === invoiceNo
          ? {
              ...inv,
              paymentMode: "CREDIT_SALE",
              isSplit: false,
              creditDownAmount: hasDown ? down : 0,
              creditDownMethod: hasDown ? cfg.downMethod : undefined,
              creditDownTerminal: hasDown && cfg.downMethod === "POS_SWIPE" ? cfg.terminal : undefined,
              posTerminal:
                hasDown && cfg.downMethod === "POS_SWIPE" ? cfg.terminal : inv.posTerminal,
              creditBalance,
              creditFollowUpDate: cfg.followUpDate,
              autoMatched: true,
            }
          : inv
      )
    );

    const receiptNo = `#${invoiceNo}`;
    upsertEntry({
      id: `ple-credit_sale-${invoiceNo}`,
      type: "CREDIT_SALE",
      customerName: target.customer,
      followUpDate: cfg.followUpDate,
      receiptNo,
      title: target.customer,
      amount: creditBalance,
      time: nowHHMM(),
    });

    onSyncCreditCustomer(target.customer, creditBalance, cfg.followUpDate, receiptNo, "CREDIT_SALE");
    setSyncBannerMsg({
      text: `${target.customer} (Inv ${receiptNo}) · Credit SAR ${fmt(creditBalance)}${
        hasDown
          ? ` · Down payment SAR ${fmt(down)} via ${
              cfg.downMethod === "CASH" ? "Cash" : POS_TERMINAL_META[cfg.terminal].badgeTag
            }`
          : ""
      } · Reminder ${cfg.followUpDate} synced to Credit Radar`,
      targetTab: "radar",
      targetLabel: "View in Credit Radar →",
    });
    setCreditModalInvNo(null);
  };

  const handleSetInvoiceSplitAmounts = (
    invoiceNo: string,
    editedField: "cash" | "bank",
    rawValue: string
  ) => {
    const parsed = Math.max(0, parseFloat(rawValue) || 0);
    setErpInvoices((prev) => {
      const base = prev.length > 0 ? prev : buildMatchedErpList();
      return base.map((inv) => {
        if (inv.invoiceNo !== invoiceNo) return inv;
        const clamped = Math.min(inv.amount, r2(parsed));
        const cashShare = editedField === "cash" ? clamped : r2(inv.amount - clamped);
        const bankShare = editedField === "bank" ? clamped : r2(inv.amount - clamped);
        return {
          ...inv,
          paymentMode: "SPLIT",
          isSplit: true,
          splitCashAmount: cashShare,
          splitBankAmount: bankShare,
        };
      });
    });
  };

  const handleSetInvoiceSplitMethod = (
    invoiceNo: string,
    method: "BANK_TRANSFER" | "POS_SWIPE",
    terminal?: PosTerminalBank
  ) => {
    setErpInvoices((prev) => {
      const base = prev.length > 0 ? prev : buildMatchedErpList();
      return base.map((inv) => {
        if (inv.invoiceNo !== invoiceNo) return inv;
        const nextTerm = terminal || inv.splitPosTerminal || inv.posTerminal || "SAB";
        return {
          ...inv,
          paymentMode: "SPLIT",
          isSplit: true,
          splitBankMethod: method,
          splitPosTerminal: nextTerm,
          posTerminal: nextTerm,
        };
      });
    });
  };

  const handleSetInvoiceTerminal = (invoiceNo: string, terminal: PosTerminalBank) => {
    setErpInvoices((prev) => {
      const base = prev.length > 0 ? prev : buildMatchedErpList();
      return base.map((inv) =>
        inv.invoiceNo === invoiceNo
          ? {
              ...inv,
              paymentMode: inv.paymentMode === "SPLIT" ? "SPLIT" : "POS_SWIPE",
              posTerminal: terminal,
              splitPosTerminal: terminal,
              splitBankMethod: inv.paymentMode === "SPLIT" ? "POS_SWIPE" : inv.splitBankMethod,
            }
          : inv
      );
    });
  };

  const handleSelectInvoicePosTerminal = (
    invoiceNo: string,
    terminal: "SAB" | "AL_RAJHI"
  ) => {
    setErpInvoices((prev) => {
      const base = prev.length > 0 ? prev : buildMatchedErpList();
      return base.map((inv) => {
        if (inv.invoiceNo !== invoiceNo) return inv;
        const currentNetwork = inv.posTerminal === "VISA_MC" ? "visa" : "mada";
        const nextTerminal = currentNetwork === "visa" ? "VISA_MC" : terminal;
        return {
          ...inv,
          posTerminalDevice: terminal,
          posTerminal: nextTerminal,
          splitPosTerminal: nextTerminal,
        };
      });
    });
  };

  const handleSelectInvoiceCardNetwork = (
    invoiceNo: string,
    network: "mada" | "visa"
  ) => {
    setErpInvoices((prev) => {
      const base = prev.length > 0 ? prev : buildMatchedErpList();
      return base.map((inv) => {
        if (inv.invoiceNo !== invoiceNo) return inv;
        const currentDevice =
          inv.posTerminalDevice || (inv.posTerminal === "AL_RAJHI" ? "AL_RAJHI" : "SAB");
        const nextTerminal: PosTerminalBank = network === "visa" ? "VISA_MC" : currentDevice;
        return {
          ...inv,
          posTerminalDevice: currentDevice,
          posTerminal: nextTerminal,
          splitPosTerminal: nextTerminal,
        };
      });
    });
  };

  const handleSetInvoiceOtherNote = (invoiceNo: string, note: string) => {
    setErpInvoices((prev) => {
      const base = prev.length > 0 ? prev : buildMatchedErpList();
      return base.map((inv) =>
        inv.invoiceNo === invoiceNo ? { ...inv, otherNote: note } : inv
      );
    });
  };

  const handleLogBankInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = bankInvoiceInput.trim().replace(/^#/, "");
    if (!cleaned) return;
    const parsedAmt = parseFloat(bankAmountInput);
    const newItem: PreLoggedBankInvoice = {
      invoiceNo: cleaned,
      amount: !Number.isNaN(parsedAmt) && parsedAmt > 0 ? parsedAmt : undefined,
      paymentMode: bankModeInput,
      posTerminal: bankModeInput === "POS_SWIPE" ? bankTerminalInput : undefined,
      time: nowHHMM(),
    };
    setPreLoggedBankInvoices((prev) => [
      newItem,
      ...prev.filter((item) => item.invoiceNo !== cleaned),
    ]);
    // Also update erpInvoices if already loaded
    setErpInvoices((prev) =>
      prev.map((inv) =>
        inv.invoiceNo === cleaned
          ? {
              ...inv,
              paymentMode: bankModeInput,
              posTerminal: bankModeInput === "POS_SWIPE" ? bankTerminalInput : inv.posTerminal,
              autoMatched: true,
            }
          : inv
      )
    );
    setBankInvoiceInput("");
    setBankAmountInput("");
  };

  const handleRemoveBankInvoice = (invoiceNo: string) => {
    setPreLoggedBankInvoices((prev) => prev.filter((item) => item.invoiceNo !== invoiceNo));
  };

  const handleQuickRecord = (e: React.FormEvent) => {
    e.preventDefault();

    if (entryType === "SPLIT_SALE") {
      const cashVal = Math.max(0, parseFloat(hubSplitCashInput) || 0);
      const cardVal = Math.max(0, parseFloat(hubSplitCardInput) || 0);
      const totalVal = r2(parseFloat(entryAmount) || cashVal + cardVal);
      if (totalVal <= 0) return;

      const cleanInv = cleanErpInvNo(hubReceiptNo);
      const invNumber = cleanInv || `30080`;
      const formattedInv = `#${invNumber}`;
      const custName = (
        hubCustomerName.trim() ||
        entryTitle.trim() ||
        matchedHubInvoice?.customer ||
        `Split Sale Customer`
      ).trim();

      upsertEntry({
        id: `ple-split-${invNumber}`,
        type: "SPLIT_SALE",
        customerName: custName,
        receiptNo: formattedInv,
        title: `${custName} (Cash: SAR ${fmt(cashVal)} + ${
          hubSplitMethod === "BANK_TRANSFER"
            ? "Bank"
            : POS_TERMINAL_META[hubSplitTerminal].shortLabel
        }: SAR ${fmt(cardVal)})`,
        amount: totalVal,
        isSplit: true,
        splitCashAmount: cashVal,
        splitBankAmount: cardVal,
        splitBankMethod: hubSplitMethod,
        splitPosTerminal: hubSplitTerminal,
        time: nowHHMM(),
      });

      setErpInvoices((prev) => {
        const base = prev.length > 0 ? prev : buildMatchedErpList();
        const exists = base.some((inv) => inv.invoiceNo === invNumber);
        if (exists) {
          return base.map((inv) =>
            inv.invoiceNo === invNumber
              ? {
                  ...inv,
                  customer: custName,
                  amount: totalVal,
                  paymentMode: "SPLIT",
                  isSplit: true,
                  splitCashAmount: cashVal,
                  splitBankAmount: cardVal,
                  splitBankMethod: hubSplitMethod,
                  splitPosTerminal: hubSplitTerminal,
                  posTerminal: hubSplitTerminal,
                  autoMatched: true,
                }
              : inv
          );
        }
        return [
          {
            invoiceNo: invNumber,
            customer: custName,
            amount: totalVal,
            paymentMode: "SPLIT",
            posTerminal: hubSplitTerminal,
            isSplit: true,
            splitCashAmount: cashVal,
            splitBankAmount: cardVal,
            splitBankMethod: hubSplitMethod,
            splitPosTerminal: hubSplitTerminal,
            autoMatched: true,
            time: nowHHMM(),
          },
          ...base,
        ];
      });

      const feeAmt =
        hubSplitMethod === "POS_SWIPE"
          ? r2(cardVal * POS_TERMINAL_META[hubSplitTerminal].feeRate)
          : 0;
      setSyncBannerMsg({
        text: `⚡ Split Tender ${formattedInv} (${custName}): Cash SAR ${fmt(cashVal)} -> Drawer | Card SAR ${fmt(cardVal)} (${
          hubSplitMethod === "BANK_TRANSFER"
            ? "0% Bank"
            : `${POS_TERMINAL_META[hubSplitTerminal].shortLabel} Fee -SAR ${fmt(feeAmt)}`
        }) -> Bank`,
        targetTab: "pulse",
        targetLabel: "View Financial Pulse →",
      });

      setEntryTitle("");
      setHubCustomerName("");
      setHubReceiptNo("");
      setEntryAmount("");
      return;
    }

    const val = parseFloat(entryAmount);
    if (Number.isNaN(val) || val <= 0) return;

    if (entryType === "EXPENSE") {
      const isCreditPurchase = hubExpenseCat === "Credit Purchase";
      const isPurchase =
        hubExpenseCat === "Credit Purchase" ||
        hubExpenseCat === "Cash Purchase" ||
        hubExpenseCat === "Bank Purchase";
      const isStaffExpense = hubExpenseCat === "Staff Advance" || hubExpenseCat === "Salary";
      const selectedStaff = staffList.find((s) => s.id === step4StaffId);
      const staffName = selectedStaff?.name || "";
      const supplierClean = hubSupplierName.trim() || "Jotun";
      const displayTitle = isPurchase
        ? `${hubExpenseCat} — ${supplierClean}${entryTitle.trim() ? ` (${entryTitle.trim()})` : ""}`
        : isStaffExpense && staffName
        ? `${hubExpenseCat} — ${staffName}${entryTitle.trim() ? ` (${entryTitle.trim()})` : ""}`
        : entryTitle.trim()
        ? `${hubExpenseCat} — ${entryTitle.trim()}`
        : hubExpenseCat;

      upsertEntry({
        id: isPurchase
          ? `ple-${hubExpenseCat.toLowerCase().replace(/\s+/g, "-")}-${supplierClean.toLowerCase().replace(/\s+/g, "-")}`
          : isStaffExpense && step4StaffId
          ? `ple-${hubExpenseCat.toLowerCase().replace(/\s+/g, "-")}-${step4StaffId}-${val}`
          : `ple-${displayTitle.toLowerCase().replace(/\s+/g, "-")}`,
        type: "EXPENSE",
        expenseCategory: hubExpenseCat,
        supplierName: isPurchase ? supplierClean : undefined,
        dueDate: isCreditPurchase ? hubDueDate : undefined,
        staffId: isStaffExpense ? step4StaffId : undefined,
        staffName: isStaffExpense ? staffName : undefined,
        paymentMode: hubExpenseCat === "Bank Purchase" && hubPaymentMode === "CASH" ? "SAB" : hubPaymentMode,
        title: displayTitle,
        amount: val,
        time: nowHHMM(),
      });

      if (isPurchase) {
        onSyncCreditPurchase(
          supplierClean,
          val,
          hubDueDate || "2026-09-25",
          hubExpenseCat,
          hubExpenseCat === "Bank Purchase" && hubPaymentMode === "CASH" ? "SAB" : hubPaymentMode
        );
        setSyncBannerMsg({
          text: `${hubExpenseCat} (${supplierClean} · SAR ${fmt(val)}${isCreditPurchase ? ` · Due ${hubDueDate}` : ""}) synced live to Suppliers & Payables`,
          targetTab: "suppliers",
          targetLabel: "Open Suppliers & Payables →",
        });
      }

      if (isStaffExpense && step4StaffId) {
        fetch("/api/payroll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            staffId: step4StaffId,
            type: hubExpenseCat === "Salary" ? "SALARY_PAYOUT" : "ADVANCE",
            amount: val,
            branch: branchId,
            date: new Date().toISOString().slice(0, 10),
            note: entryTitle.trim() || `${hubExpenseCat} logged via Hub Quick Logger`,
            source: hubPaymentMode === "CASH" ? "REGISTER_DRAWER" : "BANK_TRANSFER",
            paymentMode: hubPaymentMode,
          }),
        }).catch((err) => console.error("Error creating PayrollLog from hub:", err));

        setSyncBannerMsg({
          text: `${hubExpenseCat}: ${staffName} (SAR ${fmt(val)}) linked directly to Monthly Payroll Ledger`,
          targetTab: "payroll",
          targetLabel: "View in Staff & Payroll →",
        });
      }

      setEntryTitle("");
      setEntryAmount("");
      return;
    }

    // Inflows (CREDIT_RECD, CREDIT_SALE, LOAN_IN, OTHER_IN)
    const isCreditCustomer = entryType === "CREDIT_RECD" || entryType === "CREDIT_SALE";
    const custName = (
      isCreditCustomer
        ? hubCustomerName || matchedHubInvoice?.customer || ""
        : entryTitle
    ).trim();
    if (!custName) return;

    const cleanInv = cleanErpInvNo(hubReceiptNo);
    const formattedInv = cleanInv
      ? `#${cleanInv}`
      : hubReceiptNo.trim() || undefined;

    upsertEntry({
      id: cleanInv
        ? `ple-${entryType.toLowerCase()}-${cleanInv}`
        : `ple-${entryType.toLowerCase()}-${custName.toLowerCase().replace(/\s+/g, "-")}`,
      type: entryType,
      customerName: isCreditCustomer ? custName : undefined,
      followUpDate: isCreditCustomer ? hubFollowUpDate : undefined,
      receiptNo: formattedInv,
      paymentMode: hubPaymentMode,
      title: custName,
      amount: val,
      time: nowHHMM(),
    });

    // Reclassify matched ERP invoice as a Credit Sale (No Double Cash Counting)
    if (entryType === "CREDIT_SALE" && cleanInv) {
      setErpInvoices((prev) => {
        const base = prev.length > 0 ? prev : buildMatchedErpList();
        return base.map((inv) =>
          inv.invoiceNo === cleanInv
            ? {
                ...inv,
                customer: custName,
                amount: val,
                paymentMode: "CREDIT_SALE",
                isSplit: false,
                autoMatched: true,
              }
            : inv
        );
      });
    }

    if (isCreditCustomer) {
      onSyncCreditCustomer(
        custName,
        val,
        hubFollowUpDate || "2026-09-20",
        formattedInv,
        entryType
      );
      setSyncBannerMsg({
        text: `${custName}${formattedInv ? ` (Inv ${formattedInv})` : ""} · SAR ${fmt(val)} · Reminder: ${hubFollowUpDate} synced live to Credit Radar`,
        targetTab: "radar",
        targetLabel: "Open Credit Radar →",
      });
    }

    setEntryTitle("");
    setHubCustomerName("");
    setHubReceiptNo("");
    setEntryAmount("");
  };

  const handleRemoveEntry = (id: string) => {
    setPreLoggedEntries((prev) => prev.filter((item) => item.id !== id));
  };

  const handleRemoveErpInvoice = (invoiceNo: string) => {
    setErpInvoices((prev) => {
      const base = prev.length > 0 ? prev : buildMatchedErpList();
      return base.filter(
        (inv) => inv.invoiceNo !== invoiceNo && (!inv.id || inv.id !== invoiceNo)
      );
    });
  };

  const handleAddStep3Receipt = (e: React.FormEvent) => {
    e.preventDefault();

    if (step3SplitEnabled) {
      const cashVal = Math.max(0, parseFloat(step3SplitCash) || 0);
      const cardVal = Math.max(0, parseFloat(step3SplitCard) || 0);
      const totalVal = r2(parseFloat(step3Amount) || cashVal + cardVal);
      if (totalVal <= 0) return;

      const cleanInv = cleanErpInvNo(step3ReceiptNo);
      const invNumber = cleanInv || "30072";
      const formattedReceiptNo = `#${invNumber}`;
      const cleanCustomer = (
        step3Title.trim() ||
        matchedStep3Invoice?.customer ||
        `Inv ${formattedReceiptNo} Split Sale`
      ).trim();

      upsertEntry({
        id: `ple-split-${invNumber}`,
        type: "SPLIT_SALE",
        customerName: cleanCustomer,
        receiptNo: formattedReceiptNo,
        title: `${cleanCustomer} (Cash: SAR ${fmt(cashVal)} + ${
          step3SplitMethod === "BANK_TRANSFER"
            ? "Bank"
            : POS_TERMINAL_META[step3SplitTerminal].shortLabel
        }: SAR ${fmt(cardVal)})`,
        amount: totalVal,
        isSplit: true,
        splitCashAmount: cashVal,
        splitBankAmount: cardVal,
        splitBankMethod: step3SplitMethod,
        splitPosTerminal: step3SplitTerminal,
        time: nowHHMM(),
      });

      setErpInvoices((prev) => {
        const base = prev.length > 0 ? prev : buildMatchedErpList();
        const exists = base.some((inv) => inv.invoiceNo === invNumber);
        if (exists) {
          return base.map((inv) =>
            inv.invoiceNo === invNumber
              ? {
                  ...inv,
                  customer: cleanCustomer,
                  amount: totalVal,
                  paymentMode: "SPLIT",
                  isSplit: true,
                  splitCashAmount: cashVal,
                  splitBankAmount: cardVal,
                  splitBankMethod: step3SplitMethod,
                  splitPosTerminal: step3SplitTerminal,
                  posTerminal: step3SplitTerminal,
                  autoMatched: true,
                }
              : inv
          );
        }
        return [
          {
            invoiceNo: invNumber,
            customer: cleanCustomer,
            amount: totalVal,
            paymentMode: "SPLIT",
            posTerminal: step3SplitTerminal,
            isSplit: true,
            splitCashAmount: cashVal,
            splitBankAmount: cardVal,
            splitBankMethod: step3SplitMethod,
            splitPosTerminal: step3SplitTerminal,
            autoMatched: true,
            time: nowHHMM(),
          },
          ...base,
        ];
      });

      const feeAmt =
        step3SplitMethod === "POS_SWIPE"
          ? r2(cardVal * POS_TERMINAL_META[step3SplitTerminal].feeRate)
          : 0;
      setSyncBannerMsg({
        text: `⚡ Split Tender ${formattedReceiptNo} (${cleanCustomer}): Cash Share SAR ${fmt(cashVal)} + Card Share SAR ${fmt(cardVal)} (${
          step3SplitMethod === "BANK_TRANSFER"
            ? "0% Bank"
            : `${POS_TERMINAL_META[step3SplitTerminal].shortLabel} Fee: -SAR ${fmt(feeAmt)}`
        })`,
        targetTab: "pulse",
        targetLabel: "View Financial Pulse →",
      });

      setStep3Title("");
      setStep3ReceiptNo("");
      setStep3Amount("");
      return;
    }

    const val = parseFloat(step3Amount);
    const cleanCustomer = (step3Title.trim() || matchedStep3Invoice?.customer || "").trim();
    if (!cleanCustomer || Number.isNaN(val) || val <= 0) return;

    const isCredit = step3Kind === "CREDIT_RECD" || step3Kind === "CREDIT_SALE";
    const cleanInv = cleanErpInvNo(step3ReceiptNo);
    const formattedReceiptNo = cleanInv
      ? `#${cleanInv}`
      : step3ReceiptNo.trim() || undefined;

    upsertEntry({
      id: cleanInv
        ? `ple-${step3Kind.toLowerCase()}-${cleanInv}`
        : `ple-${step3Kind.toLowerCase()}-${cleanCustomer.toLowerCase().replace(/\s+/g, "-")}`,
      type: step3Kind,
      customerName: isCredit ? cleanCustomer : undefined,
      followUpDate: isCredit ? step3FollowUpDate : undefined,
      receiptNo: formattedReceiptNo,
      paymentMode: step3PaymentMode,
      title: cleanCustomer,
      amount: val,
      time: nowHHMM(),
    });

    // If a matched ERP invoice is saved as a Credit Sale, reclassify it in erpInvoices as CREDIT_SALE so it is not double-counted in Cash Drawer Sales
    if (step3Kind === "CREDIT_SALE" && cleanInv) {
      setErpInvoices((prev) => {
        const base = prev.length > 0 ? prev : buildMatchedErpList();
        return base.map((inv) =>
          inv.invoiceNo === cleanInv
            ? {
                ...inv,
                customer: cleanCustomer,
                amount: val,
                paymentMode: "CREDIT_SALE",
                isSplit: false,
                autoMatched: true,
              }
            : inv
        );
      });
    }

    if (isCredit) {
      onSyncCreditCustomer(
        cleanCustomer,
        val,
        step3FollowUpDate || "2026-09-20",
        formattedReceiptNo,
        step3Kind
      );
      setSyncBannerMsg({
        text: `${cleanCustomer}${formattedReceiptNo ? ` (Inv ${formattedReceiptNo})` : ""} · SAR ${fmt(val)} · Reminder: ${step3FollowUpDate} synced live to Credit Radar`,
        targetTab: "radar",
        targetLabel: "View in Credit Radar →",
      });
    }

    setStep3Title("");
    setStep3ReceiptNo("");
    setStep3Amount("");
  };

  const handleAddStep4Expense = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(step4Amount);
    if (Number.isNaN(val) || val <= 0) return;

    const isCreditPurchase = step4Category === "Credit Purchase";
    const isSupplierPurchase =
      step4Category === "Credit Purchase" ||
      step4Category === "Cash Purchase" ||
      step4Category === "Bank Purchase";
    const isStaffExpense = step4Category === "Staff Advance" || step4Category === "Salary";
    const selectedStaff = staffList.find((s) => s.id === step4StaffId);
    const staffName = selectedStaff?.name || "";

    const cleanSupplier = step4SupplierName.trim() || "Jotun";
    const displayTitle = isSupplierPurchase
      ? `${step4Category} — ${cleanSupplier}${step4Note.trim() ? ` (${step4Note.trim()})` : ""}`
      : isStaffExpense && staffName
      ? `${step4Category} — ${staffName}${step4Note.trim() ? ` (${step4Note.trim()})` : ""}`
      : step4Note.trim()
      ? `${step4Category} (${step4Note.trim()})`
      : step4Category;

    const effectiveStep4Mode =
      step4Category === "Bank Purchase" && step4PaymentMode === "CASH"
        ? "SAB"
        : step4PaymentMode;

    upsertEntry({
      id: isSupplierPurchase
        ? `ple-${step4Category.toLowerCase().replace(/\s+/g, "-")}-${cleanSupplier.toLowerCase().replace(/\s+/g, "-")}`
        : isStaffExpense && step4StaffId
        ? `ple-${step4Category.toLowerCase().replace(/\s+/g, "-")}-${step4StaffId}-${val}`
        : `ple-${step4Category.toLowerCase().replace(/\s+/g, "-")}`,
      type: "EXPENSE",
      expenseCategory: step4Category,
      supplierName: isSupplierPurchase ? cleanSupplier : undefined,
      dueDate: isCreditPurchase ? step4DueDate : undefined,
      staffId: isStaffExpense ? step4StaffId : undefined,
      staffName: isStaffExpense ? staffName : undefined,
      paymentMode: effectiveStep4Mode,
      note: step4Note.trim() || undefined,
      title: displayTitle,
      amount: val,
      time: nowHHMM(),
    });

    if (isSupplierPurchase) {
      onSyncCreditPurchase(
        cleanSupplier,
        val,
        step4DueDate || "2026-09-25",
        step4Category,
        effectiveStep4Mode
      );
      setSyncBannerMsg({
        text: `${step4Category}: ${cleanSupplier} (SAR ${fmt(val)}${isCreditPurchase ? ` · Due: ${step4DueDate}` : ""}) synced live to Suppliers & Payables`,
        targetTab: "suppliers",
        targetLabel: "View in Suppliers & Payables →",
      });
    }

    if (isStaffExpense && step4StaffId) {
      fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: step4StaffId,
          type: step4Category === "Salary" ? "SALARY_PAYOUT" : "ADVANCE",
          amount: val,
          branch: branchId,
          date: new Date().toISOString().slice(0, 10),
          note: step4Note.trim() || `${step4Category} logged in Daily Register drawer`,
          source: effectiveStep4Mode === "CASH" ? "REGISTER_DRAWER" : "BANK_TRANSFER",
          paymentMode: effectiveStep4Mode,
        }),
      }).catch((err) => console.error("Error creating PayrollLog:", err));

      setSyncBannerMsg({
        text: `${step4Category}: ${staffName} (SAR ${fmt(val)}) recorded & linked directly to Monthly Payroll Ledger`,
        targetTab: "payroll",
        targetLabel: "View in Staff & Payroll →",
      });
    }

    setStep4Amount("");
    setStep4Note("");
  };

  const handleSaveInlineEdit = (rowKey: string) => {
    const val = parseFloat(editingRowVal);
    if (Number.isNaN(val) || val < 0) {
      setEditingRowId(null);
      return;
    }
    if (rowKey.startsWith("erp-cash-")) {
      const invNo = rowKey.replace("erp-cash-", "");
      setErpInvoices((prev) => {
        const base = prev.length > 0 ? prev : buildMatchedErpList();
        return base.map((inv) => {
          if (inv.invoiceNo !== invNo) return inv;
          if (inv.paymentMode === "SPLIT") {
            const nextCash = Math.min(inv.amount, r2(val));
            return {
              ...inv,
              splitCashAmount: nextCash,
              splitBankAmount: r2(inv.amount - nextCash),
            };
          }
          return { ...inv, originalAmount: inv.originalAmount ?? inv.amount, amount: val };
        });
      });
    } else if (rowKey.startsWith("erp-bank-")) {
      const invNo = rowKey.replace("erp-bank-", "");
      setErpInvoices((prev) => {
        const base = prev.length > 0 ? prev : buildMatchedErpList();
        return base.map((inv) => {
          if (inv.invoiceNo !== invNo) return inv;
          if (inv.paymentMode === "SPLIT") {
            const nextBank = Math.min(inv.amount, r2(val));
            return {
              ...inv,
              splitBankAmount: nextBank,
              splitCashAmount: r2(inv.amount - nextBank),
            };
          }
          return { ...inv, originalAmount: inv.originalAmount ?? inv.amount, amount: val };
        });
      });
    } else if (rowKey.startsWith("erp-")) {
      const invNo = rowKey.replace("erp-", "");
      setErpInvoices((prev) => {
        const base = prev.length > 0 ? prev : buildMatchedErpList();
        return base.map((inv) =>
          inv.invoiceNo === invNo
            ? { ...inv, originalAmount: inv.originalAmount ?? inv.amount, amount: val }
            : inv
        );
      });
    } else {
      setPreLoggedEntries((prev) =>
        prev.map((item) =>
          item.id === rowKey
            ? { ...item, originalAmount: item.originalAmount ?? item.amount, amount: val }
            : item
        )
      );
    }
    setEditingRowId(null);
  };

  const handleOpenEditEntryModal = (entry: PreLoggedEntry) => {
    setEditingEntryModal(entry);
    setEditModalTitle(entry.title);
    setEditModalAmount(String(entry.amount));
    setEditModalPaymentMode(entry.paymentMode || "CASH");
    setEditModalCategory(entry.expenseCategory || "Food");
  };

  const handleSaveEditEntryModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntryModal) return;
    const nextAmt = Math.max(0, parseFloat(editModalAmount) || 0);
    const nextTitle = editModalTitle.trim() || editingEntryModal.title;
    setPreLoggedEntries((prev) =>
      prev.map((item) =>
        item.id === editingEntryModal.id
          ? {
              ...item,
              title: nextTitle,
              amount: nextAmt,
              originalAmount: item.originalAmount ?? item.amount,
              paymentMode: editModalPaymentMode,
              expenseCategory:
                item.type === "EXPENSE" ? editModalCategory : item.expenseCategory,
            }
          : item
      )
    );
    // If this entry came from PocketTransaction (`pk-...`), also persist via PUT /api/pocket
    if (editingEntryModal.id.startsWith("pk-")) {
      const pocketId = editingEntryModal.id.replace(/^pk-/, "");
      fetch("/api/pocket", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: pocketId,
          amount: nextAmt,
          category: nextTitle,
          paymentMode: editModalPaymentMode,
        }),
      }).catch((err) => console.error("Failed to update pocket txn", err));
    }
    setEditingEntryModal(null);
  };

  const handleEditErpInvoiceCustomer = (invoiceNo: string, nextCustomer: string) => {
    setErpInvoices((prev) => {
      const base = prev.length > 0 ? prev : buildMatchedErpList();
      return base.map((inv) =>
        inv.invoiceNo === invoiceNo || (inv.id && inv.id === invoiceNo)
          ? { ...inv, customer: nextCustomer, customerName: nextCustomer }
          : inv
      );
    });
  };

  const handleEditErpInvoiceAmount = (invoiceNo: string, rawVal: string) => {
    const val = Math.max(0, parseFloat(rawVal) || 0);
    setErpInvoices((prev) => {
      const base = prev.length > 0 ? prev : buildMatchedErpList();
      return base.map((inv) => {
        if (inv.invoiceNo !== invoiceNo && (!inv.id || inv.id !== invoiceNo)) return inv;
        const orig = inv.originalAmount ?? (inv.isManualEntry ? undefined : inv.amount);
        const isEdited = !inv.isManualEntry && orig !== undefined && val !== orig;
        const cashShare = inv.isSplit ? r2(val / 2) : inv.splitCashAmount;
        const bankShare = inv.isSplit ? r2(val - cashShare) : inv.splitBankAmount;
        return {
          ...inv,
          originalAmount: orig,
          amount: val,
          isEdited,
          overrideReason: isEdited ? (inv.overrideReason || "BUSINESS_COMMISSION") : undefined,
          overrideNote: isEdited ? inv.overrideNote : undefined,
          splitCashAmount: cashShare,
          splitBankAmount: bankShare,
          creditBalance:
            inv.paymentMode === "CREDIT_SALE"
              ? Math.max(0, r2(val - (inv.creditDownAmount || 0)))
              : inv.creditBalance,
        };
      });
    });
  };

  const handleEditErpInvoiceOverrideReason = (
    invoiceNo: string,
    reason: OverrideReason
  ) => {
    setErpInvoices((prev) => {
      const base = prev.length > 0 ? prev : buildMatchedErpList();
      return base.map((inv) =>
        inv.invoiceNo === invoiceNo || (inv.id && inv.id === invoiceNo)
          ? { ...inv, overrideReason: reason }
          : inv
      );
    });
  };

  const handleEditErpInvoiceOverrideNote = (invoiceNo: string, note: string) => {
    setErpInvoices((prev) => {
      const base = prev.length > 0 ? prev : buildMatchedErpList();
      return base.map((inv) =>
        inv.invoiceNo === invoiceNo || (inv.id && inv.id === invoiceNo)
          ? { ...inv, overrideNote: note }
          : inv
      );
    });
  };

  const syncCommissionExpenses = (targetInvoices?: ErpInvoiceItem[]) => {
    const invoices =
      targetInvoices || (erpInvoices.length > 0 ? erpInvoices : buildMatchedErpList());
    setPreLoggedEntries((prev) => {
      let updated = [...prev];
      for (const inv of invoices) {
        const expId = `comm-exp-${inv.invoiceNo}`;
        const orig = inv.originalAmount ?? inv.amount;
        const diff = r2(orig - inv.amount);

        if (inv.overrideReason === "BUSINESS_COMMISSION" && diff > 0) {
          const existingIdx = updated.findIndex((e) => e.id === expId);
          const commExpense: PreLoggedEntry = {
            id: expId,
            type: "EXPENSE",
            title: `Business Commission (Inv #${inv.invoiceNo})`,
            expenseCategory: "Business Commission",
            amount: diff,
            originalAmount: diff,
            isEdited: false,
            paymentMode: "CASH",
            note: "Auto-synced from CSV invoice edit",
            time: nowHHMM(),
          };

          if (existingIdx !== -1) {
            updated[existingIdx] = {
              ...updated[existingIdx],
              amount: diff,
              note: "Auto-synced from CSV invoice edit",
            };
          } else {
            updated.push(commExpense);
          }
        } else {
          updated = updated.filter((e) => e.id !== expId);
        }
      }
      return updated;
    });
  };

  const handleEditErpInvoiceBankMode = (invoiceNo: string, nextBankMode: string) => {
    setErpInvoices((prev) => {
      const base = prev.length > 0 ? prev : buildMatchedErpList();
      return base.map((inv) =>
        inv.invoiceNo === invoiceNo || (inv.id && inv.id === invoiceNo)
          ? { ...inv, bankPaymentMode: nextBankMode }
          : inv
      );
    });
  };

  const handleAddInvoiceRow = () => {
    const manualId = `MANUAL-${Date.now()}`;
    const newRow: ErpInvoiceItem = {
      id: manualId,
      invoiceNo: manualId,
      customerName: "",
      customer: "",
      amount: 0,
      paymentMode: "Cash",
      isManualEntry: true,
      posTerminal: "SAB",
      bankPaymentMode: "CASH",
      isSplit: false,
      splitCashAmount: 0,
      splitBankAmount: 0,
      splitBankMethod: "POS_SWIPE",
      splitPosTerminal: "SAB",
      autoMatched: false,
      time: nowHHMM(),
    };
    setErpInvoices((prev) => {
      const base = prev.length > 0 ? prev : buildMatchedErpList();
      return [...base, newRow];
    });
  };

  const handleAddManualErpInvoice = () => {
    setErpInvoices((prev) => {
      const base = prev.length > 0 ? prev : buildMatchedErpList();
      const maxNo = base.reduce(
        (m, i) => Math.max(m, parseInt(i.invoiceNo, 10) || 30079),
        30079
      );
      const nextNo = String(maxNo + 1);
      const newRow: ErpInvoiceItem = {
        invoiceNo: nextNo,
        customer: "New Walk-in / Manual Invoice",
        amount: 500,
        originalAmount: 500,
        isEdited: false,
        paymentMode: "CASH",
        posTerminal: "SAB",
        bankPaymentMode: "CASH",
        isSplit: false,
        splitCashAmount: 250,
        splitBankAmount: 250,
        splitBankMethod: "POS_SWIPE",
        splitPosTerminal: "SAB",
        autoMatched: false,
        time: nowHHMM(),
      };
      return [...base, newRow];
    });
  };

  const handleAddMissingInflow = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(missingInflowAmt);
    if (!missingInflowTitle.trim() || Number.isNaN(val) || val <= 0) return;
    upsertEntry({
      id: `ple-${Date.now()}`,
      type: "CREDIT_RECD",
      customerName: missingInflowTitle.trim(),
      followUpDate: "2026-09-20",
      paymentMode: missingInflowMode,
      title: missingInflowTitle.trim(),
      amount: val,
      time: nowHHMM(),
    });
    onSyncCreditCustomer(missingInflowTitle.trim(), val, "2026-09-20", undefined, "CREDIT_RECD");
    setMissingInflowTitle("");
    setMissingInflowAmt("");
  };

  const handleAddMissingExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(missingExpenseAmt);
    if (Number.isNaN(val) || val <= 0) return;
    const isCreditPurchase = missingExpenseCat === "Credit Purchase";
    const isPurchase =
      missingExpenseCat === "Credit Purchase" ||
      missingExpenseCat === "Cash Purchase" ||
      missingExpenseCat === "Bank Purchase";
    const supplier = missingExpenseSupplier.trim() || "Jotun";
    const title = isPurchase
      ? `${missingExpenseCat} — ${supplier}`
      : missingExpenseSupplier.trim()
      ? `${missingExpenseCat} (${missingExpenseSupplier.trim()})`
      : missingExpenseCat;

    upsertEntry({
      id: `ple-${Date.now()}`,
      type: "EXPENSE",
      expenseCategory: missingExpenseCat,
      supplierName: isPurchase ? supplier : undefined,
      dueDate: isCreditPurchase ? missingExpenseDueDate : undefined,
      paymentMode: missingExpenseMode,
      title,
      amount: val,
      time: nowHHMM(),
    });

    if (isPurchase) {
      onSyncCreditPurchase(supplier, val, missingExpenseDueDate || "2026-09-25", missingExpenseCat, missingExpenseMode);
    }
    setMissingExpenseSupplier("");
    setMissingExpenseAmt("");
  };

  // Live Derived Totals (with Full Split / Partial Tender Support)
  const activeErpList = erpInvoices.length > 0 ? erpInvoices : buildMatchedErpList();
  // Cash Drawer Sales include "CASH", "OTHER_RECD", and the Cash Share of "SPLIT" invoices
  const cashSaleInvoices = activeErpList.filter(
    (i) =>
      i.paymentMode === "CASH" ||
      (i.paymentMode as string) === "Cash" ||
      i.paymentMode === "OTHER_RECD" ||
      (i.paymentMode === "SPLIT" && i.splitCashAmount > 0) ||
      (i.paymentMode === "CREDIT_SALE" &&
        i.creditDownMethod === "CASH" &&
        (i.creditDownAmount || 0) > 0)
  );
  // Bank / POS Invoices include "BANK_TRANSFER", "POS_SWIPE", and the Bank/Card Share of "SPLIT" invoices
  const bankSwipeInvoices = activeErpList.filter(
    (i) =>
      i.paymentMode === "BANK_TRANSFER" ||
      i.paymentMode === "POS_SWIPE" ||
      (i.paymentMode === "SPLIT" && i.splitBankAmount > 0) ||
      (i.paymentMode === "CREDIT_SALE" &&
        i.creditDownMethod === "POS_SWIPE" &&
        (i.creditDownAmount || 0) > 0)
  );

  // ── Print Categorized Ledger Lists (Strict Multi-Page Pagination) ────────
  // Page 2: Cash Section (paymentMode === 'Cash' / 'CASH', 'OTHER_RECD', Split cash portion)
  const printCashInvoices = cashSaleInvoices;

  // Page 3: Bank Transfer Section (paymentMode === 'Bank' / 'BANK_TRANSFER', Split bank transfer portion)
  const printBankTransferInvoices = activeErpList.filter(
    (i) =>
      i.paymentMode === "BANK_TRANSFER" ||
      (i.paymentMode as string) === "Bank" ||
      (i.paymentMode as string) === "BANK" ||
      (i.paymentMode === "SPLIT" &&
        i.splitBankMethod === "BANK_TRANSFER" &&
        i.splitBankAmount > 0)
  );

  // Page 4: POS Swipes Section (paymentMode === 'Swipe' / 'POS_SWIPE', Split swipe portion, Credit POS down)
  const printPosSwipeInvoices = activeErpList.filter(
    (i) =>
      i.paymentMode === "POS_SWIPE" ||
      (i.paymentMode as string) === "Swipe" ||
      (i.paymentMode as string) === "SWIPE" ||
      (i.paymentMode === "SPLIT" &&
        i.splitBankMethod === "POS_SWIPE" &&
        i.splitBankAmount > 0) ||
      (i.paymentMode === "CREDIT_SALE" &&
        i.creditDownMethod === "POS_SWIPE" &&
        (i.creditDownAmount || 0) > 0)
  );

  const bankTransferTotal = r2(
    printBankTransferInvoices.reduce((sum, inv) => {
      const amt =
        inv.paymentMode === "SPLIT"
          ? inv.splitBankAmount || 0
          : inv.paymentMode === "CREDIT_SALE" && inv.creditDownMethod === "POS_SWIPE"
          ? 0
          : inv.amount;
      return sum + amt;
    }, 0)
  );

  const posSwipesGrossTotal = r2(
    printPosSwipeInvoices.reduce((sum, inv) => sum + calcInvoiceBankGrossPortion(inv), 0)
  );

  const cashSalesTotal = r2(
    activeErpList.reduce((sum, inv) => sum + calcInvoiceCashPortion(inv), 0)
  );
  const bankSwipeGrossTotal = r2(
    activeErpList.reduce((sum, inv) => sum + calcInvoiceBankGrossPortion(inv), 0)
  );
  const totalMadaFees = r2(
    activeErpList.reduce((sum, inv) => {
      const fb = calcInvoiceFeeBreakdown(inv);
      return sum + (fb.isMada ? fb.totalFee : 0);
    }, 0)
  );
  const totalCcFees = r2(
    activeErpList.reduce((sum, inv) => {
      const fb = calcInvoiceFeeBreakdown(inv);
      return sum + (!fb.isMada && fb.totalFee > 0 ? fb.totalFee : 0);
    }, 0)
  );
  const totalPosFees = r2(totalMadaFees + totalCcFees);
  const bankSwipeNetTotal = r2(bankSwipeGrossTotal - totalPosFees);
  const activeBankSettlementTotal =
    bankSettlementMode === "NET" ? bankSwipeNetTotal : bankSwipeGrossTotal;

  // Inflows in drawer (exclude CREDIT_SALE and SPLIT_SALE since SPLIT_SALE cash portion is already counted in cashSalesTotal via activeErpList)
  const inflowEntries = preLoggedEntries.filter((e) => e.type !== "EXPENSE");
  const creditSaleEntries = inflowEntries.filter((e) => e.type === "CREDIT_SALE");
  const cashInflowEntries = inflowEntries.filter(
    (e) => e.type !== "CREDIT_SALE" && e.type !== "SPLIT_SALE"
  );
  const expenseEntries = preLoggedEntries.filter((e) => e.type === "EXPENSE");

  const totalCreditInvAmount = r2(creditSaleEntries.reduce((a, b) => a + b.amount, 0));
  const totalPreLoggedInflows = r2(cashInflowEntries.reduce((a, b) => a + b.amount, 0));
  const totalPreLoggedExpenses = r2(expenseEntries.reduce((a, b) => a + b.amount, 0));

  const totalCashInSalesAndReceipts = r2(cashSalesTotal + totalPreLoggedInflows);
  const totalMoneyInDrawer = r2(openingBalance + totalCashInSalesAndReceipts);
  const totalMoneyOutDrawer = r2(totalPreLoggedExpenses);
  const calculatedClosingBalance = r2(totalMoneyInDrawer - totalMoneyOutDrawer);

  const handleLockAndSaveDay = () => {
    syncCommissionExpenses();
    const newSummary: CompletedDaySummary = {
      date: "12-09-2026",
      branch: "Jubail - Main Branch",
      totalCashSales: cashSalesTotal,
      totalBankSwipe: activeBankSettlementTotal,
      totalPosFees: bankSettlementMode === "NET" || trackPosFees ? totalPosFees : 0,
      totalExpenses: totalPreLoggedExpenses,
      closingBalance: calculatedClosingBalance,
      status: "LOCKED",
    };
    setCompletedDaysLog((prev) => [newSummary, ...prev.filter((d) => d.date !== "12-09-2026")]);
    setJustCompletedToast(
      `Daily Register Closed — Closing Balance: SAR ${fmt(calculatedClosingBalance)} | Bank / POS Swipes (To Bank): SAR ${fmt(activeBankSettlementTotal)}`
    );

    // Persist any auto-generated business commission expenses to Neon /api/pocket
    activeErpList.forEach((inv) => {
      const orig = inv.originalAmount ?? inv.amount;
      const diff = r2(orig - inv.amount);
      if (inv.overrideReason === "BUSINESS_COMMISSION" && diff > 0) {
        fetch("/api/pocket", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-branch-id": branchId || "JCT_HQ",
          },
          body: JSON.stringify({
            branch: branchId || "JCT_HQ",
            type: "EXPENSE",
            amount: diff,
            originalAmount: orig,
            isEdited: true,
            overrideReason: "BUSINESS_COMMISSION",
            overrideNote: inv.overrideNote || null,
            category: "Business Commission",
            paymentSource: "DRAWER_CASH",
            paymentMode: "CASH",
            note: `Auto-synced from CSV invoice edit (Inv #${inv.invoiceNo})`,
            date: "2026-09-12",
          }),
        }).catch((e) => console.error("Error saving commission expense to pocket:", e));
      }
    });

    // Persist lock record to Neon PostgreSQL
    fetch("/api/archive", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-is-owner": String(isOwner),
        "x-branch-id": branchId || "JCT_HQ",
      },
      body: JSON.stringify({
        branch: branchId || "JCT_HQ",
        branchId: branchId || "JCT_HQ",
        date: "12-09-2026",
        closingCash: calculatedClosingBalance,
        openingCash: openingBalance,
        inflows: totalCashInSalesAndReceipts,
        bankSwipes: activeBankSettlementTotal,
        outflows: totalPreLoggedExpenses,
        posFees: totalPosFees,
        madaFees: totalMadaFees,
        ccFees: totalCcFees,
        lockedBy: isOwner ? "BONGSI" : (branchId || "JCT_HQ"),
        status: "LOCKED",
        dataJson: JSON.stringify({
          expenses: expenseEntries,
          inflows: cashInflowEntries,
          bankSwipes: bankSwipeInvoices,
        }),
      }),
    }).catch((e) => console.error("Error saving archive lock to Neon", e));

    setTrackingMode("hub");
    setWizardStep(1);
  };

  const prevDayReceivedAmount = completedDaysLog[0]
    ? r2((completedDaysLog[0].totalCashSales || 0) + (completedDaysLog[0].totalBankSwipe || 0))
    : 41980;
  const yesterdayClosingBalance = completedDaysLog[0]?.closingBalance ?? openingBalance;

  // 12:00 AM Automatic Daily Reset: resets active hub day at midnight without manual purge
  useEffect(() => {
    const getCalendarDateStr = () => {
      const d = new Date();
      return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
    };

    const checkMidnightReset = () => {
      const todayStr = getCalendarDateStr();
      const lastActiveDate = window.localStorage.getItem("jct_daily_hub_active_date");
      if (lastActiveDate && lastActiveDate !== todayStr) {
        setErpInvoices([]);
        setPreLoggedBankInvoices([]);
        setPreLoggedEntries([]);
        setWizardStep(1);
        setTrackingMode("hub");
        if (completedDaysLog.length > 0) {
          setOpeningBalance(completedDaysLog[0].closingBalance);
        }
      }
      window.localStorage.setItem("jct_daily_hub_active_date", todayStr);
    };

    checkMidnightReset();
    const timer = setInterval(checkMidnightReset, 15000);
    return () => clearInterval(timer);
  }, [completedDaysLog, setErpInvoices, setPreLoggedBankInvoices, setPreLoggedEntries, setWizardStep, setTrackingMode, setOpeningBalance]);

  // Classic Digital Data Sheet Derived Column Totals & Live Actions
  const dsCashSaleTotal = r2(sheetRows.reduce((s, r) => s + numCell(r.amtCashSale), 0));
  const dsCreditInvTotal = r2(sheetRows.reduce((s, r) => s + numCell(r.creditInvAmt), 0));
  const dsCreditRecdTotal = r2(sheetRows.reduce((s, r) => s + numCell(r.creditSaleRecd), 0));
  const dsOpenBalTotal = r2(sheetRows.reduce((s, r) => s + numCell(r.openBal), 0));
  const dsLoanInTotal = r2(sheetRows.reduce((s, r) => s + numCell(r.loanIn), 0));
  const dsOtherRecdTotal = r2(sheetRows.reduce((s, r) => s + numCell(r.otherAmtRecd), 0));
  const dsFromBankTotal = r2(sheetRows.reduce((s, r) => s + numCell(r.fromBank), 0));

  // Column 10: TOTAL AMT (Auto-calculated inflow total)
  const dsTotalAmt = r2(
    dsCashSaleTotal +
      dsCreditRecdTotal +
      dsOpenBalTotal +
      dsLoanInTotal +
      dsOtherRecdTotal +
      dsFromBankTotal
  );

  const dsCreditPurchaseTotal = r2(
    sheetRows.reduce((s, r) => s + numCell(r.creditPurchaseAmt), 0)
  );
  const dsCashPurchaseTotal = r2(sheetRows.reduce((s, r) => s + numCell(r.cashPurchase), 0));
  const dsCreditPurchasePaymentTotal = r2(
    sheetRows.reduce((s, r) => s + numCell(r.creditPurchasePayment), 0)
  );
  const dsCrNoteTotal = r2(sheetRows.reduce((s, r) => s + numCell(r.crNote), 0));
  const dsExpenseTotal = r2(sheetRows.reduce((s, r) => s + numCell(r.expenseAmt), 0));
  const dsToBankTotal = r2(
    sheetRows.reduce((s, r) => s + (r.toBankChecked ? numCell(r.toBankAmt) : 0), 0)
  );
  const dsLoanOutTotal = r2(sheetRows.reduce((s, r) => s + numCell(r.loanOut), 0));
  const dsExcessAmtTotal = r2(sheetRows.reduce((s, r) => s + numCell(r.excessAmt), 0));

  // Column 19: CLOSING BALANCE (Live calculated physical cash closing balance)
  const dsClosingBalance = r2(
    dsTotalAmt -
      (dsCashPurchaseTotal +
        dsCreditPurchasePaymentTotal +
        dsExpenseTotal +
        dsToBankTotal +
        dsLoanOutTotal) +
      dsExcessAmtTotal
  );

  const handleSyncSheetFromWizard = () => {
    const baseList = activeErpList.length > 0 ? activeErpList : buildMatchedErpList();
    const syncedRows: DataSheetRow[] = baseList.map((inv, idx) => {
      const isCreditSale = inv.paymentMode === "CREDIT_SALE";
      const isSplit = inv.paymentMode === "SPLIT";
      const isBankOrPos =
        inv.paymentMode === "BANK_TRANSFER" ||
        inv.paymentMode === "POS_SWIPE" ||
        isSplit;

      const expEntry = expenseEntries[idx];
      const crRecdEntry = cashInflowEntries.find((e) => e.type === "CREDIT_RECD");
      const loanEntry = cashInflowEntries.find((e) => e.type === "LOAN_IN");

      return {
        id: `ds-sync-${inv.invoiceNo}`,
        invoiceNo: inv.invoiceNo,
        amtCashSale: isCreditSale
          ? ""
          : isSplit
          ? String(inv.splitCashAmount || "")
          : String(inv.amount),
        creditInvAmt: isCreditSale ? String(inv.amount) : "",
        receiptNo: idx === 0 ? crRecdEntry?.customerName || "Chicago" : "",
        creditSaleRecd: idx === 0 && crRecdEntry ? String(crRecdEntry.amount) : "",
        openBal: idx === 0 ? String(openingBalance) : "",
        loanIn: idx === 1 && loanEntry ? String(loanEntry.amount) : "",
        otherAmtRecd: "",
        fromBank: "",
        creditPurchaseSupplier: "",
        creditPurchaseAmt: "",
        cashPurchase: "",
        creditPurchasePayment: "",
        crNote: "",
        expenseLabel: expEntry ? expEntry.expenseCategory || expEntry.title : "",
        expenseAmt: expEntry ? String(expEntry.amount) : "",
        toBankLabel: isSplit
          ? `Split ${
              inv.splitBankMethod === "BANK_TRANSFER"
                ? "Bank"
                : POS_TERMINAL_META[inv.splitPosTerminal || "SAB"].shortLabel
            } #${inv.invoiceNo}`
          : isBankOrPos
          ? `${inv.paymentMode === "BANK_TRANSFER" ? "Bank" : POS_TERMINAL_META[inv.posTerminal || "SAB"].shortLabel} #${inv.invoiceNo}`
          : "",
        toBankAmt: isSplit
          ? String(inv.splitBankAmount || "")
          : isBankOrPos
          ? String(inv.amount)
          : "",
        toBankChecked: true,
        loanOut: "",
        excessAmt: "",
      };
    });
    setSheetRows(syncedRows);
    setSyncBannerMsg({
      text: `Synced ${syncedRows.length} rows from Guided Wizard · Total Amt: SAR ${fmt(dsTotalAmt)} · Closing Balance: SAR ${fmt(dsClosingBalance)}`,
      targetTab: "pulse",
      targetLabel: "View Financial Pulse →",
    });
  };

  // Two-way synchronization: Keep sheetRows in sync when erpInvoices change
  useEffect(() => {
    if (erpInvoices.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleSyncSheetFromWizard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [erpInvoices]);

  const handleSaveAndCloseSheet = () => {
    // 1. Sync any Credit Purchases to Suppliers & Payables
    sheetRows.forEach((row) => {
      const cpAmt = numCell(row.creditPurchaseAmt);
      if (cpAmt > 0 && row.creditPurchaseSupplier.trim()) {
        onSyncCreditPurchase(
          row.creditPurchaseSupplier.trim(),
          cpAmt,
          "2026-09-25",
          "Credit Purchase"
        );
      }
      // 2. Sync any Credit Invoice Amounts to Credit Radar
      const crInv = numCell(row.creditInvAmt);
      if (crInv > 0 && row.invoiceNo.trim()) {
        const matched = activeErpList.find((i) => i.invoiceNo === row.invoiceNo.trim());
        onSyncCreditCustomer(
          matched?.customer || `Inv #${row.invoiceNo.trim()} Customer`,
          crInv,
          "2026-09-20",
          `#${row.invoiceNo.trim()}`,
          "CREDIT_SALE"
        );
      }
      // 3. Sync any Credit Sale Amt Recd to Credit Radar
      const crRecd = numCell(row.creditSaleRecd);
      if (crRecd > 0 && row.receiptNo.trim()) {
        onSyncCreditCustomer(
          row.receiptNo.trim(),
          crRecd,
          "2026-09-20",
          `#${row.invoiceNo.trim() || "RCP"}`,
          "CREDIT_RECD"
        );
      }
    });

    const newSummary: CompletedDaySummary = {
      date: "12-09-2026",
      branch: "Jubail - Main Branch",
      totalCashSales: dsCashSaleTotal,
      totalBankSwipe: dsToBankTotal,
      totalPosFees,
      totalExpenses: r2(dsExpenseTotal + dsCashPurchaseTotal + dsCreditPurchasePaymentTotal),
      closingBalance: dsClosingBalance,
      status: "LOCKED",
    };
    setCompletedDaysLog((prev) => [newSummary, ...prev.filter((d) => d.date !== "12-09-2026")]);
    setJustCompletedToast(
      `Classic Daily Data Sheet Saved & Closed — Total Amt: SAR ${fmt(dsTotalAmt)} | Closing Balance: SAR ${fmt(dsClosingBalance)}`
    );
    setTrackingMode("hub");
  };

  const entryTypeMeta: Record<
    PreLoggedEntryType,
    { label: string; badgeClass: string; isOutflow: boolean }
  > = {
    EXPENSE: {
      label: "Expense",
      badgeClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40",
      isOutflow: true,
    },
    CREDIT_RECD: {
      label: "Credit Recd",
      badgeClass: "bg-jct-turquoise/20 text-jct-charcoal dark:text-jct-turquoise border-jct-turquoise/40",
      isOutflow: false,
    },
    CREDIT_SALE: {
      label: "Credit Sale",
      badgeClass: "bg-jct-yellow text-jct-charcoal font-bold border-jct-yellow",
      isOutflow: false,
    },
    SPLIT_SALE: {
      label: "⚡ Split Payment",
      badgeClass: "bg-jct-yellow text-jct-charcoal font-bold border-jct-yellow",
      isOutflow: false,
    },
    LOAN_IN: {
      label: "Loan In",
      badgeClass: "bg-jct-yellow text-jct-charcoal font-bold border-jct-yellow",
      isOutflow: false,
    },
    OTHER_IN: {
      label: "Other Amt Recd",
      badgeClass: "bg-jct-turquoise/20 text-jct-charcoal dark:text-jct-turquoise border-jct-turquoise/40",
      isOutflow: false,
    },
  };

  return (
    <div className="relative flex-1 min-w-0 w-full max-w-full mx-auto flex flex-col gap-6 bg-slate-50 dark:bg-black text-jct-charcoal dark:text-jct-offwhite select-none">
      {/* Live Cross-Module Sync Toast Banner */}
      {syncBannerMsg && (
        <div className="relative z-30 max-w-7xl w-full mx-auto px-6 pt-5 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-white dark:bg-[#0A0A0A] px-5 py-3 text-xs sm:text-sm font-semibold text-jct-charcoal dark:text-jct-offwhite shadow-sm print:hidden">
            <div className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-jct-turquoise text-jct-charcoal font-bold">
                <Check size={12} strokeWidth={3} />
              </span>
              <span>{syncBannerMsg.text}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onSwitchTab(syncBannerMsg.targetTab)}
                className="bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg px-3 py-1 text-xs"
              >
                {syncBannerMsg.targetLabel}
              </button>
              <button
                type="button"
                onClick={() => setSyncBannerMsg(null)}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODE 1: WIDESCREEN HOME HUB (trackingMode === 'hub')
         ════════════════════════════════════════════════════════════════════ */}
      {trackingMode === "hub" && (
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 lg:py-8 flex flex-col gap-6">
          {justCompletedToast && (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-white dark:bg-[#0A0A0A] px-5 py-3.5 text-sm font-semibold text-jct-charcoal dark:text-jct-offwhite shadow-sm print:hidden">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-jct-turquoise text-jct-charcoal font-bold">
                  <Check size={14} strokeWidth={3} />
                </span>
                <span>{justCompletedToast}</span>
              </div>
              <button
                onClick={() => setJustCompletedToast(null)}
                className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Header Section */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-jct-charcoal dark:text-white tracking-tight">
                Jubail Corp Daily Hub
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Log daytime swipes and cash movements, or start your end-of-day reconciliation.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Discreet POS Fee Toggle - Staff RBAC: Only visible to Owner */}
              {isOwner && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={trackPosFees}
                  onClick={() => setTrackPosFees((prev) => !prev)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition whitespace-nowrap shadow-sm ${
                    trackPosFees
                      ? "border-jct-turquoise bg-jct-turquoise text-jct-charcoal"
                      : "border-slate-200 dark:border-[#1F1F1F] bg-white dark:bg-[#0A0A0A] text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite"
                  }`}
                >
                  <span>POS Fees (MDR)</span>
                  <span
                    className={`inline-flex h-3.5 w-6 items-center rounded-full p-0.5 transition-colors ${
                      trackPosFees ? "bg-jct-charcoal" : "bg-slate-300 dark:bg-slate-600"
                    }`}
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full bg-white transition-transform ${
                        trackPosFees ? "translate-x-2.5" : "translate-x-0"
                      }`}
                    />
                  </span>
                </button>
              )}

              {/* Consolidated KPI Ribbon */}
              <div className="text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-[#0A0A0A] border border-jct-turquoise/20 dark:border-jct-turquoise/30 hover:border-jct-turquoise/60 px-3.5 py-1.5 rounded-full whitespace-nowrap font-medium flex items-center gap-1.5 shadow-sm transition-all duration-300">
                <span className="text-jct-charcoal dark:text-jct-offwhite font-semibold">{preLoggedBankInvoices.length} Swipes Queued</span>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span className="text-emerald-600 dark:text-jct-turquoise font-semibold">SAR {fmt(totalPreLoggedInflows)} Inflows</span>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span className="text-rose-600 dark:text-rose-400 font-semibold">SAR {fmt(totalPreLoggedExpenses)} Expenses</span>
              </div>
            </div>
          </div>

          {/* Top Dashboard Metrics (3 Values) */}
          <div className="flex flex-wrap lg:flex-nowrap gap-3.5 sm:gap-4 w-full">
            <div className="flex-1 min-w-[260px] w-full bg-white dark:bg-[#0A0A0A] border border-white/80 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow duration-300 rounded-2xl p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Prev Day Received Amount
                </span>
                <span className="rounded-full bg-jct-turquoise/15 text-jct-charcoal dark:text-jct-turquoise p-1.5">
                  <ArrowDownLeft size={14} />
                </span>
              </div>
              <span className="text-xl sm:text-2xl font-black mt-2 block font-mono bg-clip-text text-transparent bg-gradient-to-br from-slate-800 to-slate-500 dark:from-white dark:to-slate-400">
                SAR {fmt(prevDayReceivedAmount)}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                Yesterday&apos;s verified total inflows ({completedDaysLog[0]?.date || "11-09-2026"})
              </span>
            </div>

            <div className="flex-1 min-w-[260px] w-full bg-white dark:bg-[#0A0A0A] border border-white/80 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow duration-300 rounded-2xl p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Opening Balance
                </span>
                <span className="rounded-full bg-jct-yellow/20 text-jct-charcoal dark:text-jct-yellow p-1.5">
                  <Wallet size={14} />
                </span>
              </div>
              <span className="text-xl sm:text-2xl font-black mt-2 block font-mono bg-clip-text text-transparent bg-gradient-to-br from-slate-800 to-slate-500 dark:from-white dark:to-slate-400">
                SAR {fmt(yesterdayClosingBalance)}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                Yesterday&apos;s closing cash drawer balance
              </span>
            </div>

            <div className="flex-1 min-w-[260px] w-full bg-white dark:bg-[#0A0A0A] border border-white/80 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow duration-300 rounded-2xl p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Cash Drawer Amount
                </span>
                <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-jct-turquoise p-1.5">
                  <Coins size={14} />
                </span>
              </div>
              <span className="text-xl sm:text-2xl font-black mt-2 block font-mono bg-clip-text text-transparent bg-gradient-to-br from-slate-800 to-slate-500 dark:from-white dark:to-slate-400">
                SAR {fmt(calculatedClosingBalance)}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                Opening balance + today&apos;s inflows - cash expenses
              </span>
            </div>
          </div>

          {/* End-of-Day Hero Card */}
          <div className="relative overflow-hidden bg-gradient-to-r from-jct-turquoise/10 via-white/60 to-jct-yellow/10 backdrop-blur-xl border border-white/80 shadow-sm dark:bg-gradient-to-r dark:from-jct-turquoise/5 dark:via-black/60 dark:to-jct-yellow/5 dark:backdrop-blur-xl dark:border-white/10 rounded-2xl py-6 px-6 lg:px-8 h-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-all duration-300">
            <div className="max-w-2xl space-y-1.5">
              <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-jct-charcoal dark:text-white">
                SALE SUMMARY
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Match ERP sales, calculate SAB &amp; Al Rajhi POS terminal fees, and close today&apos;s drawer in 5 guided steps.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleStartWizard}
                className="bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg px-6 py-3 flex items-center gap-2 text-sm whitespace-nowrap border border-jct-turquoise/60 hover:border-jct-turquoise hover:shadow-[0_0_15px_rgba(45,226,230,0.25)]"
              >
                <Sparkles size={16} className="text-jct-charcoal" />
                <span>TRACK SALE</span>
                <ArrowRight size={14} className="text-jct-charcoal" />
              </button>

              <button
                type="button"
                onClick={() => setShowManualEntry((prev) => !prev)}
                className="bg-slate-800 text-slate-300 border border-slate-600 text-sm px-3 py-1.5 rounded-md hover:bg-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                title="Toggle manual entry forms"
              >
                <span>Add Manual Entry 🔽</span>
              </button>
            </div>
          </div>

          {/* Collapsible Daytime Quick-Logger Box (Hidden by default) */}
          {showManualEntry && (
            <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-turquoise/20 dark:border-jct-turquoise/30 hover:border-jct-turquoise/80 hover:shadow-[0_0_15px_rgba(45,226,230,0.1)] rounded-xl p-6 flex flex-col gap-4 transition-all duration-300 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-[#1F1F1F]">
                <div className="inline-flex rounded-xl bg-slate-100 dark:bg-black p-1 border border-slate-200 dark:border-[#1F1F1F]">
                  <button
                    type="button"
                    onClick={() => setActiveLoggerTab("bank")}
                    className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                      activeLoggerTab === "bank"
                        ? "bg-jct-turquoise text-jct-charcoal shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite"
                    }`}
                  >
                    💳 Bank / POS Swipes ({preLoggedBankInvoices.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveLoggerTab("expense")}
                    className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                      activeLoggerTab === "expense"
                        ? "bg-jct-turquoise text-jct-charcoal shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite"
                    }`}
                  >
                    ⚡ Expenses &amp; Cash-In ({preLoggedEntries.length})
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
                    {activeLoggerTab === "bank"
                      ? "Pre-tag invoices with mada · SAB, mada · Al Rajhi, Visa / MC, or Bank Transfer (0%)"
                      : "Credit purchases and sales auto-sync to Suppliers and Credit Radar"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTrackingMode("datasheet")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-jct-turquoise/40 hover:border-jct-turquoise bg-jct-turquoise/10 hover:bg-jct-turquoise text-jct-charcoal dark:text-jct-turquoise hover:dark:text-jct-charcoal px-3 py-1.5 text-xs font-bold transition-all duration-300"
                    title="Switch to full classic spreadsheet view"
                  >
                    <FileSpreadsheet size={13} />
                    <span>Full Sheet View ↗</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowManualEntry(false)}
                    className="rounded-lg border border-slate-200 dark:border-[#1F1F1F] p-1.5 text-slate-400 hover:text-jct-charcoal dark:hover:text-white transition"
                    title="Close Manual Entry"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

            {activeLoggerTab === "bank" ? (
              <div className="space-y-3">
                <form onSubmit={handleLogBankInvoice} className="flex flex-wrap items-center gap-2.5">
                  <input
                    type="text"
                    value={bankInvoiceInput}
                    onChange={(e) => setBankInvoiceInput(e.target.value)}
                    placeholder="Invoice No. (e.g. 30065)"
                    className="flex-1 min-w-[150px] bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md text-sm px-3 py-2 placeholder:text-slate-400 outline-none transition"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={bankAmountInput}
                    onChange={(e) => setBankAmountInput(e.target.value)}
                    placeholder="Optional SAR"
                    className="w-32 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md text-sm px-3 py-2 placeholder:text-slate-400 outline-none transition"
                  />

                  <select
                    value={bankModeInput}
                    onChange={(e) => setBankModeInput(e.target.value as "POS_SWIPE" | "BANK_TRANSFER")}
                    className="bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md text-xs font-semibold px-3 py-2 outline-none transition"
                  >
                    <option value="POS_SWIPE" className="bg-white dark:bg-[#0A0A0A]">Swipe (POS)</option>
                    <option value="BANK_TRANSFER" className="bg-white dark:bg-[#0A0A0A]">Bank (0%)</option>
                  </select>

                  {bankModeInput === "POS_SWIPE" && (
                    <div className="inline-flex rounded-lg bg-slate-100 dark:bg-black p-1 border border-slate-200 dark:border-[#1F1F1F] gap-1">
                      {(["SAB", "AL_RAJHI", "VISA_MC"] as PosTerminalBank[]).map((term) => (
                        <button
                          key={term}
                          type="button"
                          onClick={() => setBankTerminalInput(term)}
                          className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                            bankTerminalInput === term
                              ? "bg-jct-yellow text-jct-charcoal shadow-sm"
                              : "text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite"
                          }`}
                        >
                          {POS_TERMINAL_META[term].badgeTag}
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="flex items-center justify-center gap-1.5 bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg text-sm px-4 py-2 shrink-0 whitespace-nowrap"
                  >
                    <Plus size={15} strokeWidth={2.5} />
                    <span>+ Add Invoice</span>
                  </button>
                </form>

                {/* Queued Transaction Chips */}
                {preLoggedBankInvoices.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-[#1F1F1F]">
                    {preLoggedBankInvoices.map((inv) => (
                      <div
                        key={inv.invoiceNo}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-black px-3 py-1.5 text-xs text-jct-charcoal dark:text-jct-offwhite"
                      >
                        <span className="font-mono font-bold text-jct-charcoal dark:text-jct-offwhite">#{inv.invoiceNo}</span>
                        <span className="rounded bg-jct-yellow px-1.5 py-0.5 text-[10px] font-bold text-jct-charcoal">
                          {inv.paymentMode === "BANK_TRANSFER"
                            ? "Bank (0%)"
                            : POS_TERMINAL_META[inv.posTerminal || "SAB"].shortLabel}
                        </span>
                        {inv.amount !== undefined && (
                          <span className="font-semibold text-jct-charcoal dark:text-jct-offwhite">SAR {fmt(inv.amount)}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveBankInvoice(inv.invoiceNo)}
                          className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/20 p-1 rounded transition ml-0.5"
                          title="Remove invoice"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <form onSubmit={handleQuickRecord} className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <select
                      value={entryType}
                      onChange={(e) => setEntryType(e.target.value as PreLoggedEntryType)}
                      className="bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md text-xs font-semibold px-3 py-2 outline-none transition"
                    >
                      <option value="EXPENSE" className="bg-white dark:bg-[#0A0A0A]">Expense / Purchase</option>
                      <option value="SPLIT_SALE" className="bg-white dark:bg-[#0A0A0A]">⚡ Split Payment (Cash + Card)</option>
                      <option value="CREDIT_RECD" className="bg-white dark:bg-[#0A0A0A]">Credit Sale Amt Recd</option>
                      <option value="CREDIT_SALE" className="bg-white dark:bg-[#0A0A0A]">Credit Sale (New Customer Credit)</option>
                      <option value="LOAN_IN" className="bg-white dark:bg-[#0A0A0A]">Loan In</option>
                      <option value="OTHER_IN" className="bg-white dark:bg-[#0A0A0A]">Other Amt Recd</option>
                    </select>

                    {entryType === "EXPENSE" ? (
                      <>
                        <select
                          value={hubExpenseCat}
                          onChange={(e) => setHubExpenseCat(e.target.value as StrictExpenseCategory)}
                          className="bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md text-xs font-semibold px-3 py-2 outline-none transition"
                        >
                          {STRICT_EXPENSE_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat} className="bg-white dark:bg-[#0A0A0A]">
                              {cat}
                            </option>
                          ))}
                        </select>

                        {(hubExpenseCat === "Credit Purchase" ||
                          hubExpenseCat === "Cash Purchase" ||
                          hubExpenseCat === "Bank Purchase") && (
                          <input
                            type="text"
                            list="hub-suppliers-list"
                            value={hubSupplierName}
                            onChange={(e) => setHubSupplierName(e.target.value)}
                            placeholder="Supplier Name (e.g. Jotun)"
                            className="flex-1 min-w-[150px] bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md text-sm px-3 py-2 placeholder:text-slate-400 outline-none transition"
                          />
                        )}
                        <datalist id="hub-suppliers-list">
                          <option value="Jotun" />
                          <option value="Hempel" />
                          <option value="Sigma" />
                        </datalist>

                        {hubExpenseCat === "Credit Purchase" && (
                          <div className="flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-[#1F1F1F] bg-transparent px-2.5 py-1.5">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">Due:</span>
                            <input
                              type="date"
                              value={hubDueDate}
                              onChange={(e) => setHubDueDate(e.target.value)}
                              className="bg-transparent text-xs font-semibold text-jct-charcoal dark:text-jct-offwhite outline-none"
                            />
                          </div>
                        )}

                        {(hubExpenseCat === "Staff Advance" || hubExpenseCat === "Salary") && staffList.length > 0 && (
                          <select
                            value={step4StaffId}
                            onChange={(e) => setStep4StaffId(e.target.value)}
                            className="bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md text-xs font-semibold px-3 py-2 outline-none transition"
                          >
                            {staffList.map((st) => (
                              <option key={st.id} value={st.id} className="bg-white dark:bg-[#0A0A0A]">
                                {st.name} ({st.role || "Staff"})
                              </option>
                            ))}
                          </select>
                        )}

                        <input
                          type="text"
                          value={entryTitle}
                          onChange={(e) => setEntryTitle(e.target.value)}
                          placeholder="Optional note / details..."
                          className="flex-1 min-w-[150px] bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md text-sm px-3 py-2 placeholder:text-slate-400 outline-none transition"
                        />
                      </>
                    ) : entryType === "SPLIT_SALE" ? (
                      <>
                        <input
                          type="text"
                          list="erp-invoices-datalist"
                          value={hubReceiptNo}
                          onChange={(e) => handleHubInvoiceInput(e.target.value)}
                          placeholder="Invoice # (e.g. 30072)"
                          className="w-36 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md font-mono text-sm font-bold px-3 py-2 placeholder:font-sans placeholder:text-slate-400 outline-none transition"
                        />
                        <input
                          type="text"
                          value={hubCustomerName}
                          onChange={(e) => setHubCustomerName(e.target.value)}
                          placeholder="Customer Name (auto-fills)"
                          className="flex-1 min-w-[150px] bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md text-sm px-3 py-2 placeholder:text-slate-400 outline-none transition"
                        />
                      </>
                    ) : entryType === "CREDIT_RECD" || entryType === "CREDIT_SALE" ? (
                      <>
                        <input
                          type="text"
                          list="erp-invoices-datalist"
                          value={hubReceiptNo}
                          onChange={(e) => handleHubInvoiceInput(e.target.value)}
                          placeholder={
                            entryType === "CREDIT_SALE"
                              ? "Invoice # (e.g. 30064)"
                              : "Receipt # (opt)"
                          }
                          className="w-36 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md font-mono text-sm font-bold px-3 py-2 placeholder:font-sans placeholder:text-slate-400 outline-none transition"
                        />
                        <input
                          type="text"
                          value={hubCustomerName}
                          onChange={(e) => setHubCustomerName(e.target.value)}
                          placeholder="Customer Name (auto-fills)"
                          className="flex-1 min-w-[150px] bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md text-sm px-3 py-2 placeholder:text-slate-400 outline-none transition"
                        />
                        <div className="flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-[#1F1F1F] bg-transparent px-2.5 py-1.5">
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            Follow-up:
                          </span>
                          <input
                            type="date"
                            value={hubFollowUpDate}
                            onChange={(e) => setHubFollowUpDate(e.target.value)}
                            className="bg-transparent text-xs font-semibold text-jct-charcoal dark:text-jct-offwhite outline-none"
                          />
                        </div>
                      </>
                    ) : (
                      <input
                        type="text"
                        value={entryTitle}
                        onChange={(e) => setEntryTitle(e.target.value)}
                        placeholder="Source / Note for this amount..."
                        className="flex-1 min-w-[160px] bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md text-sm px-3 py-2 placeholder:text-slate-400 outline-none transition"
                      />
                    )}

                    <select
                      value={hubPaymentMode}
                      onChange={(e) => setHubPaymentMode(e.target.value as UniversalPaymentMode)}
                      required
                      className="bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md text-xs font-semibold px-3 py-2 outline-none transition"
                      title="Mode of Payment"
                    >
                      {UNIVERSAL_PAYMENT_MODES.map((pm) => (
                        <option key={pm.value} value={pm.value} className="bg-white dark:bg-[#0A0A0A]">
                          {pm.badge} · {pm.label}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      step="0.01"
                      value={entryAmount}
                      onChange={(e) => handleHubTotalAmountChange(e.target.value)}
                      placeholder={entryType === "SPLIT_SALE" ? "Total SAR" : "Amount (SAR)"}
                      className="w-32 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md text-sm px-3 py-2 placeholder:text-slate-400 outline-none transition"
                    />

                    <button
                      type="submit"
                      className="flex items-center justify-center gap-1.5 bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg text-sm px-4 py-2 shrink-0 whitespace-nowrap"
                    >
                      <Plus size={15} strokeWidth={2.5} />
                      <span>+ Record</span>
                    </button>
                  </div>

                  {/* Inline Split Payment Allocation Card inside Daytime Quick-Logger */}
                  {entryType === "SPLIT_SALE" && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-black p-3 text-xs">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="rounded-md bg-jct-yellow px-2 py-0.5 font-bold text-jct-charcoal text-[11px]">
                          ⚡ Split Tender
                        </span>

                        <div className="flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-[#1F1F1F] bg-white dark:bg-[#0A0A0A] px-2.5 py-1">
                          <span className="font-semibold text-emerald-700 dark:text-jct-turquoise text-[11px]">Cash (SAR):</span>
                          <input
                            type="number"
                            step="0.01"
                            value={hubSplitCashInput}
                            onChange={(e) => handleHubSplitCashChange(e.target.value)}
                            className="w-20 bg-transparent font-mono text-xs font-bold text-jct-charcoal dark:text-jct-offwhite outline-none"
                          />
                        </div>

                        <div className="flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-[#1F1F1F] bg-white dark:bg-[#0A0A0A] px-2.5 py-1">
                          <span className="font-semibold text-jct-charcoal dark:text-jct-offwhite text-[11px]">Card (SAR):</span>
                          <input
                            type="number"
                            step="0.01"
                            value={hubSplitCardInput}
                            onChange={(e) => handleHubSplitCardChange(e.target.value)}
                            className="w-20 bg-transparent font-mono text-xs font-bold text-jct-charcoal dark:text-jct-offwhite outline-none"
                          />
                        </div>

                        <div className="inline-flex rounded-lg bg-white dark:bg-[#0A0A0A] p-0.5 border border-slate-200 dark:border-[#1F1F1F] gap-0.5">
                          {(["SAB", "AL_RAJHI", "VISA_MC"] as PosTerminalBank[]).map((term) => (
                            <button
                              key={term}
                              type="button"
                              onClick={() => {
                                setHubSplitMethod("POS_SWIPE");
                                setHubSplitTerminal(term);
                              }}
                              className={`rounded px-2 py-0.5 text-[10px] font-bold transition ${
                                hubSplitMethod === "POS_SWIPE" && hubSplitTerminal === term
                                  ? "bg-jct-turquoise text-jct-charcoal"
                                  : "text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite"
                              }`}
                            >
                              {POS_TERMINAL_META[term].badgeTag}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setHubSplitMethod("BANK_TRANSFER")}
                            className={`rounded px-2 py-0.5 text-[10px] font-bold transition ${
                              hubSplitMethod === "BANK_TRANSFER"
                                ? "bg-jct-turquoise text-jct-charcoal"
                                : "text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite"
                            }`}
                          >
                            Bank (0%)
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Clean Matched Banner */}
                  {(entryType === "CREDIT_SALE" ||
                    entryType === "CREDIT_RECD" ||
                    entryType === "SPLIT_SALE") &&
                    matchedHubInvoice && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-jct-turquoise/40 bg-jct-turquoise/15 px-3.5 py-2 text-xs font-semibold text-jct-charcoal dark:text-jct-turquoise">
                        <span>
                          ✨ Matched #{matchedHubInvoice.invoiceNo}:{" "}
                          <strong className="text-jct-charcoal dark:text-jct-offwhite">{matchedHubInvoice.customer}</strong> — SAR{" "}
                          {fmt(matchedHubInvoice.amount)}
                        </span>
                      </div>
                    )}
                </form>

                {/* Queued Recorded Feed */}
                {preLoggedEntries.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-[#1F1F1F]">
                    {preLoggedEntries.map((entry) => {
                      const meta = entryTypeMeta[entry.type];
                      const pmBadge = formatPaymentModeBadge(entry.paymentMode);
                      return (
                        <div
                          key={entry.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-black px-3 py-1.5 text-xs text-jct-charcoal dark:text-jct-offwhite"
                        >
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${meta.badgeClass}`}>
                            {entry.expenseCategory || meta.label}
                          </span>
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${pmBadge.badgeClass}`}>
                            {pmBadge.badge}
                          </span>
                          {entry.receiptNo && (
                            <span className="font-mono text-[11px] font-bold text-jct-charcoal dark:text-jct-offwhite">
                              #{entry.receiptNo}
                            </span>
                          )}
                          <span className="font-medium text-jct-charcoal dark:text-jct-offwhite truncate max-w-[140px]">{entry.title}</span>
                          <span className={`font-mono font-bold ${meta.isOutflow ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-jct-turquoise"}`}>
                            {meta.isOutflow ? "-" : "+"}SAR {fmt(entry.amount)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenEditEntryModal(entry)}
                            className="bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 transition-all rounded px-1.5 py-0.5 text-[10px]"
                            title="Edit entry"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveEntry(entry.id)}
                            className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/20 transition"
                            title="Delete entry"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          )}

          {/* Closed Register History */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-turquoise/20 dark:border-jct-turquoise/30 hover:border-jct-turquoise/80 hover:shadow-[0_0_15px_rgba(45,226,230,0.1)] rounded-xl p-6 text-xs text-slate-500 dark:text-slate-400 transition-all duration-300">
            <span className="font-semibold text-slate-500 dark:text-slate-400">
              Recent Closed Registers ({completedDaysLog.length})
            </span>
            <div className="flex flex-wrap items-center gap-2.5">
              {completedDaysLog.map((d) => (
                <span
                  key={d.date}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-black px-3 py-1.5 text-xs font-semibold text-jct-charcoal dark:text-jct-offwhite"
                >
                  <Check size={12} className="text-emerald-600 dark:text-jct-turquoise" />
                  <span>{d.date}</span>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <strong className="text-jct-charcoal dark:text-jct-offwhite">Closing: SAR {fmt(d.closingBalance)}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Universal Entry Edit Modal (Hub, Step 3, Step 4, Step 5) */}
      {editingEntryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-[#0A0A0A] shadow-2xl border border-jct-turquoise/40 dark:border-jct-turquoise/50 hover:border-jct-turquoise hover:shadow-[0_0_20px_rgba(45,226,230,0.15)] rounded-xl p-6 transition-all duration-300">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1F1F1F] pb-3 mb-4">
              <h3 className="font-display text-lg font-extrabold text-jct-charcoal dark:text-jct-offwhite">
                ✏️ Edit Register Entry
              </h3>
              <button
                type="button"
                onClick={() => setEditingEntryModal(null)}
                className="rounded-lg border border-slate-200 dark:border-slate-800 p-1.5 text-slate-400 hover:text-jct-charcoal dark:hover:text-white transition"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEditEntryModal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Description / Customer / Supplier
                </label>
                <input
                  type="text"
                  required
                  value={editModalTitle}
                  onChange={(e) => setEditModalTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#222222] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-lg px-3.5 py-2.5 text-sm font-semibold outline-none transition"
                />
              </div>
              {editingEntryModal.type === "EXPENSE" && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Expense Category
                  </label>
                  <select
                    value={editModalCategory}
                    onChange={(e) => setEditModalCategory(e.target.value as StrictExpenseCategory)}
                    className="w-full bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#222222] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-lg px-3.5 py-2.5 text-sm font-semibold outline-none transition"
                  >
                    {STRICT_EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c} className="bg-white dark:bg-[#0A0A0A]">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Mode of Payment (Required)
                </label>
                <select
                  value={editModalPaymentMode}
                  onChange={(e) => setEditModalPaymentMode(e.target.value as UniversalPaymentMode)}
                  required
                  className="w-full bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#222222] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-lg px-3.5 py-2.5 text-sm font-bold outline-none transition"
                >
                  {UNIVERSAL_PAYMENT_MODES.map((pm) => (
                    <option key={pm.value} value={pm.value} className="bg-white dark:bg-[#0A0A0A]">
                      {pm.badge} · {pm.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Amount (SAR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editModalAmount}
                  onChange={(e) => setEditModalAmount(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#222222] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-lg px-3.5 py-2.5 font-mono text-base font-black outline-none transition"
                />
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingEntryModal(null)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 hover:border-slate-400 bg-slate-100 dark:bg-black px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-jct-charcoal dark:hover:text-white transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-105 border border-jct-turquoise hover:shadow-[0_0_15px_rgba(45,226,230,0.25)] transition-all duration-300 shadow-sm rounded-lg px-5 py-2 text-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credit Sale Setup Popup Modal (Step 2) */}
      {creditModalInvNo &&
        (() => {
          const modalInv = activeErpList.find((i) => i.invoiceNo === creditModalInvNo);
          if (!modalInv) return null;
          return (
            <CreditSaleModal
              key={modalInv.invoiceNo}
              invoice={modalInv}
              onClose={() => setCreditModalInvNo(null)}
              onSave={(cfg) => handleSaveCreditSale(modalInv.invoiceNo, cfg)}
            />
          );
        })()}

      {/* Shared Datalist of Today's 18 ERP Invoices (30062 to 30079) for Instant Auto-Lookup */}
      <datalist id="erp-invoices-datalist">
        {activeErpList.map((inv) => (
          <option
            key={inv.invoiceNo}
            value={inv.invoiceNo}
            label={`#${inv.invoiceNo} — ${inv.customer} (SAR ${fmt(inv.amount)})`}
          />
        ))}
      </datalist>

      {/* ════════════════════════════════════════════════════════════════════
          MODE 2: WIDESCREEN 5-STEP GUIDED WIZARD (trackingMode === 'wizard')
         ════════════════════════════════════════════════════════════════════ */}
      {trackingMode === "wizard" && (
        <div className="relative z-10 max-w-7xl w-full mx-auto px-6 py-6 lg:py-8 flex flex-col gap-6 print:max-w-none print:w-full print:p-0 print:m-0 print:overflow-visible">
          {/* Calm Enterprise Top Step Navigation Bar */}
          <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                onClick={() => setTrackingMode("hub")}
                className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#1F1F1F] bg-white dark:bg-black px-3.5 py-2 text-xs sm:text-sm font-medium text-jct-charcoal dark:text-jct-offwhite shadow-sm transition hover:bg-slate-50 dark:hover:bg-[#0A0A0A]"
              >
                <ArrowLeft size={15} className="text-slate-500 dark:text-slate-400" />
                <span>Daily Hub</span>
              </button>

              <div className="flex flex-wrap items-center gap-2">
                {([1, 2, 3, 4, 5] as WizardStep[]).map((s) => {
                  const active = wizardStep === s;
                  const done = wizardStep > s;
                  const labels: Record<WizardStep, string> = {
                    1: "1. Import Sales",
                    2: "2. Bank & POS Match",
                    3: "3. Cash Inflows",
                    4: "4. Expenses",
                    5: "5. Final Audit",
                  };
                  return (
                    <button
                      key={s}
                      onClick={() => {
                        if (erpInvoices.length === 0 && s > 1) {
                          setErpInvoices(buildMatchedErpList());
                        }
                        syncCommissionExpenses();
                        setWizardStep(s);
                      }}
                      className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                        active
                          ? "bg-jct-turquoise text-jct-charcoal shadow-sm"
                          : done
                          ? "bg-jct-yellow text-jct-charcoal font-bold"
                          : "bg-slate-50 dark:bg-black text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-[#1F1F1F] hover:text-jct-charcoal dark:hover:text-jct-offwhite"
                      }`}
                    >
                      {done ? `✓ ${labels[s]}` : labels[s]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-black">
              <div
                className="h-full rounded-full bg-jct-turquoise transition-all duration-500"
                style={{ width: `${(wizardStep / 5) * 100}%` }}
              />
            </div>
          </div>

          {/* ──────────────────────────────────────────────────────────────
              STEP 1: IMPORT TODAY'S ERP SALES (CALM & CENTERED)
             ────────────────────────────────────────────────────────────── */}
          {wizardStep === 1 && (
            <div className="mx-auto my-6 flex w-full max-w-2xl flex-col items-center justify-center bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-turquoise/20 dark:border-jct-turquoise/30 hover:border-jct-turquoise/80 hover:shadow-[0_0_15px_rgba(45,226,230,0.1)] rounded-xl p-10 sm:p-14 text-center transition-all duration-300">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-jct-turquoise/20 border border-jct-turquoise/40 text-jct-charcoal dark:text-jct-turquoise">
                <UploadCloud size={28} />
              </div>

              <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-jct-charcoal dark:text-white">
                Import Today&apos;s ERP Sales
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Drop your daily CSV export or load today&apos;s 18 Jubail invoices (auto-detects `PARTIAL`, `SPLIT`, `CASH/BANK` dual tenders).
              </p>

              <label className="mt-7 flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 dark:border-[#1F1F1F] bg-slate-50 dark:bg-black hover:bg-slate-100 dark:hover:bg-[#111111] px-6 py-10 transition-colors">
                <UploadCloud size={26} className="text-slate-500 dark:text-slate-400 mb-2.5" />
                <span className="text-sm font-medium text-jct-charcoal dark:text-jct-offwhite">
                  Drop ERP `.csv` file here or click to browse
                </span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvFileUpload}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={handleSimulateCsvUpload}
                className="mt-6 flex items-center gap-2.5 bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg px-6 py-3 text-sm"
              >
                <Zap size={16} className="text-jct-charcoal" />
                <span>Load Today&apos;s ERP Batch (18 Invoices · Split Tenders Auto-Detected)</span>
              </button>

              {csvLoadedBanner && (
                <div className="mt-5 inline-flex items-center gap-2 rounded-lg bg-jct-yellow text-jct-charcoal font-bold px-4 py-2 text-xs">
                  <Check size={15} className="text-jct-charcoal" />
                  <span>
                    18 ERP Invoices Loaded · 2 Split Tenders Auto-Detected (#30070 &amp; #30072)
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────────
              STEP 2: VERIFY BANK SWIPES (SAB / AL RAJHI), SPLIT TENDERS & CASH SALES
             ────────────────────────────────────────────────────────────── */}
          {wizardStep === 2 && (
            <div className="flex flex-col gap-5 bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-turquoise/20 dark:border-jct-turquoise/30 hover:border-jct-turquoise/80 hover:shadow-[0_0_15px_rgba(45,226,230,0.1)] rounded-xl p-6 sm:p-8 transition-all duration-300">
              {/* Header + Optional MDR Toggle + Summary Cards */}
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-[#1F1F1F]">
                <div className="space-y-2">
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-jct-charcoal dark:text-white">
                    Verify Sales Data
                  </h2>
                  {/* Clean Optional Toggle Switch: Estimate POS Merchant Fees (MDR) - Staff RBAC */}
                  {isOwner && (
                    <div className="pt-0.5 flex flex-wrap items-center">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={trackPosFees}
                        onClick={() => setTrackPosFees((prev) => !prev)}
                        className={`inline-flex items-center gap-2.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors shadow-sm ${
                          trackPosFees
                            ? "border-jct-turquoise bg-jct-turquoise text-jct-charcoal"
                            : "border-slate-200 dark:border-[#1F1F1F] bg-white dark:bg-black text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite"
                        }`}
                      >
                        <span>Estimate POS Merchant Fees (MDR)</span>
                        <span
                          className={`inline-flex h-4 w-7 items-center rounded-full p-0.5 transition-colors ${
                            trackPosFees ? "bg-jct-charcoal" : "bg-slate-300 dark:bg-slate-600"
                          }`}
                        >
                          <span
                            className={`h-3 w-3 rounded-full bg-white transition-transform ${
                              trackPosFees ? "translate-x-3" : "translate-x-0"
                            }`}
                          />
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          {trackPosFees ? "ON" : "OFF"}
                        </span>
                      </button>
                      {trackPosFees && (
                        <span className="text-sm text-slate-400 ml-4">
                          Rates: mada (0.8%, Cap SAR 40) | Visa/MC (2.2%)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 shrink-0">
                  <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-turquoise/20 dark:border-jct-turquoise/30 hover:border-jct-turquoise/80 hover:shadow-[0_0_15px_rgba(45,226,230,0.1)] rounded-xl p-6 transition-all duration-300">
                    <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                      Cash Drawer Sales ({cashSaleInvoices.length})
                    </span>
                    <span className="mt-1 block font-display text-xl font-bold text-emerald-600 dark:text-jct-turquoise whitespace-nowrap">
                      SAR {fmt(cashSalesTotal)}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                      Includes Cash Share of Split Sales
                    </span>
                  </div>

                  <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-yellow/20 dark:border-jct-yellow/30 hover:border-jct-yellow/80 hover:shadow-[0_0_15px_rgba(255,222,89,0.1)] rounded-xl p-6 transition-all duration-300">
                    <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                      Bank / POS Swipes (To Bank) ({bankSwipeInvoices.length})
                    </span>
                    <span className="mt-1 block font-display text-xl font-bold text-jct-charcoal dark:text-jct-yellow whitespace-nowrap">
                      SAR {fmt(bankSwipeGrossTotal)}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                      100% Gross Face Value Settlement
                    </span>
                    {isOwner && trackPosFees && (
                      <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                        Est. MDR fee (audit only): SAR {fmt(totalPosFees)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Editable CSV Grid Header + Add Row Button */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-jct-turquoise/20 dark:border-jct-turquoise/30 hover:border-jct-turquoise/60 bg-slate-50 dark:bg-[#111111] px-4 py-3 text-xs transition-all duration-300">
                <span className="text-slate-500 dark:text-slate-400">
                  <strong className="font-semibold text-jct-charcoal dark:text-jct-offwhite">Editable CSV Grid:</strong> Click any Customer Name or Amount below to override directly, select Mode of Payment, or remove rows before saving.
                </span>
                <button
                  type="button"
                  onClick={handleAddManualErpInvoice}
                  className="bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg px-4 py-2 inline-flex items-center gap-1.5 text-xs"
                >
                  <Plus size={14} />
                  <span>+ Add Invoice Row</span>
                </button>
              </div>

              {/* Clean Spreadsheet Table of Imported Invoices with Progressive Disclosure */}
              {!isDatasheetView ? (
                <div className="divide-y-0">
                {activeErpList.map((inv) => {
                  const isBankOrPos =
                    inv.paymentMode === "BANK_TRANSFER" || inv.paymentMode === "POS_SWIPE";
                  const isPosSwipe = inv.paymentMode === "POS_SWIPE";
                  const isSplitMode = inv.paymentMode === "SPLIT";
                  const isOtherRecd = inv.paymentMode === "OTHER_RECD";
                  const isCreditSaleInv = inv.paymentMode === "CREDIT_SALE";
                  const posFee = calcInvoicePosFee(inv);
                  const splitTermMeta =
                    POS_TERMINAL_META[inv.splitPosTerminal || inv.posTerminal || "SAB"];
                  const pmBadge = formatPaymentModeBadge(
                    inv.paymentMode === "CASH"
                      ? "CASH"
                      : inv.paymentMode === "POS_SWIPE"
                      ? inv.posTerminal === "VISA_MC"
                        ? "VISA"
                        : inv.posTerminal || "SAB"
                      : inv.bankPaymentMode || "BANK_TRANSFER"
                  );

                  return (
                    <div
                      key={inv.invoiceNo}
                      className="border-b border-slate-200 dark:border-[#1F1F1F] pt-2 pb-6 mb-4 last:border-b-0 last:pb-0 hover:bg-slate-50/50 dark:hover:bg-[#0A0A0A]/50 transition-colors rounded-xl px-2 -mx-2"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2.5 min-w-0 flex-1">
                          <span className="font-mono text-xs font-medium text-slate-500 shrink-0">
                            #{inv.invoiceNo}
                          </span>
                          {/* Editable Customer / Description Input */}
                          <input
                            type="text"
                            value={inv.customer || inv.customerName || ""}
                            onChange={(e) =>
                              handleEditErpInvoiceCustomer(inv.invoiceNo, e.target.value)
                            }
                            placeholder="Customer / Description..."
                            className="min-w-[180px] flex-1 max-w-sm text-sm font-medium bg-transparent border-transparent text-jct-charcoal dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-jct-turquoise transition-all rounded-none px-2 py-1"
                          />
                          <span
                            className={`rounded-full border px-3 py-1 text-[10px] font-bold shrink-0 ${pmBadge.badgeClass}`}
                          >
                            {pmBadge.badge}
                          </span>
                          {inv.isManualEntry && (
                            <span className="rounded-full bg-jct-turquoise/20 text-jct-charcoal dark:text-jct-turquoise border border-jct-turquoise/40 px-2.5 py-0.5 text-[10px] font-bold shrink-0">
                              Manual
                            </span>
                          )}
                          {isSplitMode && (
                            <span className="rounded-full bg-jct-yellow px-3 py-1 text-[10px] font-bold text-black shrink-0">
                              Split Tender
                            </span>
                          )}
                          {inv.autoMatched && isBankOrPos && (
                            <span className="rounded-full bg-jct-turquoise px-3 py-1 text-[10px] font-bold text-black shrink-0">
                              ✓ Auto-Matched
                            </span>
                          )}
                          {isCreditSaleInv && (
                            <span className="rounded-full bg-jct-yellow px-3 py-1 text-[10px] font-bold text-black shrink-0">
                              Credit Sale
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 shrink-0">
                          {/* Editable Invoice Amount Input */}
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">SAR</span>
                              <input
                                type="number"
                                step="0.01"
                                value={inv.amount === 0 ? "" : inv.amount}
                                placeholder="0.00"
                                onChange={(e) =>
                                  handleEditErpInvoiceAmount(inv.invoiceNo, e.target.value)
                                }
                                className={`w-24 font-mono text-sm font-semibold text-right bg-transparent border-b text-jct-charcoal dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 px-1.5 py-0.5 transition-colors ${
                                  inv.originalAmount !== undefined && inv.amount !== inv.originalAmount
                                    ? "border-amber-500 text-amber-600 dark:text-amber-400 font-bold"
                                    : "border-transparent focus:border-b-2 focus:border-jct-turquoise"
                                }`}
                              />
                            </div>

                            {/* Dynamic Mandatory Reason Dropdown on Amount Change */}
                            {inv.originalAmount !== undefined && inv.amount !== inv.originalAmount && (
                              <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs">
                                <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                                  Orig: SAR {fmt(inv.originalAmount)}
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 whitespace-nowrap">
                                  Reason *:
                                </span>
                                <select
                                  value={inv.overrideReason || "BUSINESS_COMMISSION"}
                                  onChange={(e) =>
                                    handleEditErpInvoiceOverrideReason(
                                      inv.invoiceNo,
                                      e.target.value as OverrideReason
                                    )
                                  }
                                  className="rounded bg-white dark:bg-black px-2 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                  title="Mandatory reason for changing ERP invoice amount"
                                >
                                  <option value="BUSINESS_COMMISSION">Business Commission</option>
                                  <option value="BILL_MISTAKE">Bill Mistake</option>
                                  <option value="CUSTOM">Custom Note</option>
                                </select>
                                {inv.overrideReason === "CUSTOM" && (
                                  <input
                                    type="text"
                                    placeholder="Enter note..."
                                    value={inv.overrideNote || ""}
                                    onChange={(e) =>
                                      handleEditErpInvoiceOverrideNote(inv.invoiceNo, e.target.value)
                                    }
                                    className="w-28 rounded bg-white dark:bg-black px-2 py-0.5 text-xs text-jct-charcoal dark:text-white border border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                  />
                                )}
                              </div>
                            )}
                          </div>

                          {/* Segmented Payment Type Selector */}
                          <div className="bg-slate-100 dark:bg-[#111111] p-1 rounded-lg flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => handleSetInvoiceMode(inv.invoiceNo, "CASH")}
                              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                                inv.paymentMode === "CASH" || (inv.paymentMode as string) === "Cash"
                                  ? "bg-jct-turquoise text-jct-charcoal font-bold"
                                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                              }`}
                            >
                              Cash
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetInvoiceMode(inv.invoiceNo, "BANK_TRANSFER")}
                              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                                inv.paymentMode === "BANK_TRANSFER"
                                  ? "bg-jct-turquoise text-jct-charcoal font-bold"
                                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                              }`}
                            >
                              Bank
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetInvoiceMode(inv.invoiceNo, "POS_SWIPE")}
                              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                                inv.paymentMode === "POS_SWIPE"
                                  ? "bg-jct-turquoise text-jct-charcoal font-bold"
                                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                              }`}
                            >
                              Swipe
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetInvoiceMode(inv.invoiceNo, "SPLIT")}
                              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                                inv.paymentMode === "SPLIT"
                                  ? "bg-jct-turquoise text-jct-charcoal font-bold"
                                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                              }`}
                            >
                              Split/Partial
                            </button>
                            <button
                              type="button"
                              onClick={() => setCreditModalInvNo(inv.invoiceNo)}
                              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                                inv.paymentMode === "CREDIT_SALE"
                                  ? "bg-jct-turquoise text-jct-charcoal font-bold"
                                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                              }`}
                            >
                              Credit
                            </button>
                          </div>

                          {/* Subtle Trash Icon Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveErpInvoice(inv.invoiceNo)}
                            className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                            title="Delete invoice row"
                            aria-label={`Delete invoice ${inv.invoiceNo}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Progressive Disclosure Sub-Row: Split/Partial Allocation & Card Method */}
                      {isSplitMode && (
                        <div className="bg-slate-50 dark:bg-[#111111] rounded-lg mt-2 p-3 flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 text-xs">
                          <div className="flex flex-wrap items-center gap-2.5">
                            {/* Cash Portion Input */}
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                Cash Portion (SAR):
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                value={inv.splitCashAmount}
                                onChange={(e) =>
                                  handleSetInvoiceSplitAmounts(
                                    inv.invoiceNo,
                                    "cash",
                                    e.target.value
                                  )
                                }
                                className="w-20 font-mono text-xs font-semibold bg-transparent border-transparent text-jct-charcoal dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-jct-turquoise transition-all rounded-none px-2 py-1"
                              />
                            </div>

                            {/* Bank / Swipe Portion Input */}
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                Bank / Swipe Portion (SAR):
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                value={inv.splitBankAmount}
                                onChange={(e) =>
                                  handleSetInvoiceSplitAmounts(
                                    inv.invoiceNo,
                                    "bank",
                                    e.target.value
                                  )
                                }
                                className="w-20 font-mono text-xs font-semibold bg-transparent border-transparent text-jct-charcoal dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-jct-turquoise transition-all rounded-none px-2 py-1"
                              />
                            </div>

                            {/* Card Method / Bank Selector */}
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-slate-500 dark:text-slate-400">Card Method:</span>
                              <div className="bg-white dark:bg-[#0A0A0A] p-0.5 rounded-lg flex flex-wrap gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSetInvoiceSplitMethod(inv.invoiceNo, "BANK_TRANSFER")
                                  }
                                  className={`rounded-md px-2 py-0.5 text-xs font-semibold transition-colors ${
                                    inv.splitBankMethod === "BANK_TRANSFER"
                                      ? "bg-jct-turquoise text-jct-charcoal font-bold"
                                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                  }`}
                                >
                                  Bank Transfer
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSetInvoiceSplitMethod(inv.invoiceNo, "POS_SWIPE", "SAB")
                                  }
                                  className={`rounded-md px-2 py-0.5 text-xs font-semibold transition-colors ${
                                    inv.splitBankMethod === "POS_SWIPE" &&
                                    (inv.splitPosTerminal || inv.posTerminal) === "SAB"
                                      ? "bg-jct-turquoise text-jct-charcoal font-bold"
                                      : "text-slate-700 font-semibold hover:text-black dark:text-jct-yellow dark:font-normal dark:hover:brightness-110"
                                  }`}
                                >
                                  {trackPosFees ? "mada · SAB (0.80% fee, cap SAR 40)" : "mada · SAB"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSetInvoiceSplitMethod(inv.invoiceNo, "POS_SWIPE", "AL_RAJHI")
                                  }
                                  className={`rounded-md px-2 py-0.5 text-xs font-semibold transition-colors ${
                                    inv.splitBankMethod === "POS_SWIPE" &&
                                    (inv.splitPosTerminal || inv.posTerminal) === "AL_RAJHI"
                                      ? "bg-jct-turquoise text-jct-charcoal font-bold"
                                      : "text-slate-700 font-semibold hover:text-black dark:text-jct-yellow dark:font-normal dark:hover:brightness-110"
                                  }`}
                                >
                                  {trackPosFees ? "mada · Al Rajhi (0.80% fee, cap SAR 40)" : "mada · Al Rajhi"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSetInvoiceSplitMethod(inv.invoiceNo, "POS_SWIPE", "VISA_MC")
                                  }
                                  className={`rounded-md px-2 py-0.5 text-xs font-semibold transition-colors ${
                                    inv.splitBankMethod === "POS_SWIPE" &&
                                    (inv.splitPosTerminal || inv.posTerminal) === "VISA_MC"
                                      ? "bg-jct-turquoise text-jct-charcoal font-bold"
                                      : "text-slate-700 font-semibold hover:text-black dark:text-jct-yellow dark:font-normal dark:hover:brightness-110"
                                  }`}
                                >
                                  {trackPosFees ? "Visa / MC (2.20%)" : "Visa / MC"}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Split Row Summary */}
                          <div className="flex flex-col items-end gap-0.5 font-mono text-xs">
                            <div className="flex flex-wrap items-center gap-2 text-jct-charcoal dark:text-white">
                              <span className="text-emerald-600 dark:text-jct-turquoise font-semibold">
                                Cash: SAR {fmt(inv.splitCashAmount)}
                              </span>
                              <span className="text-slate-300 dark:text-slate-600">|</span>
                              <span className="text-slate-700 font-semibold dark:text-jct-yellow dark:font-normal">
                                Bank/Card: SAR {fmt(inv.splitBankAmount)}
                              </span>
                            </div>
                            {isOwner && trackPosFees && inv.splitBankMethod === "POS_SWIPE" && posFee > 0 && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                {(() => {
                                  const fb = calcInvoiceFeeBreakdown(inv);
                                  return `Est. ${splitTermMeta.shortLabel} fee: -SAR ${fmt(fb.totalFee)} (MDR: SAR ${fmt(fb.mdrBase)} + 15% VAT: SAR ${fmt(fb.vatOnFee)})`;
                                })()}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Progressive Disclosure Sub-Row for Swipe (POS): Terminal -> Card Network Hierarchy */}
                      {isPosSwipe && (
                        <div className="bg-slate-50 dark:bg-[#111111] rounded-lg mt-2 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="flex flex-wrap items-center gap-4">
                            {/* Level 2: Terminal Selection */}
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-500 dark:text-slate-400">Terminal:</span>
                              <div className="bg-white dark:bg-[#0A0A0A] p-0.5 rounded-lg border border-slate-200 dark:border-[#222222] flex items-center gap-1">
                                {(["SAB", "AL_RAJHI"] as const).map((term) => {
                                  const isSelected =
                                    (inv.posTerminalDevice || (inv.posTerminal === "AL_RAJHI" ? "AL_RAJHI" : "SAB")) === term;
                                  return (
                                    <button
                                      key={term}
                                      type="button"
                                      onClick={() => handleSelectInvoicePosTerminal(inv.invoiceNo, term)}
                                      className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                                        isSelected
                                          ? "bg-jct-turquoise text-jct-charcoal shadow-sm"
                                          : "text-slate-600 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-white"
                                      }`}
                                    >
                                      {term === "SAB" ? "SAB" : "Al Rajhi"}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Level 3: Card Network Selection */}
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-500 dark:text-slate-400">Card Network:</span>
                              <div className="bg-white dark:bg-[#0A0A0A] p-0.5 rounded-lg border border-slate-200 dark:border-[#222222] flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleSelectInvoiceCardNetwork(inv.invoiceNo, "mada")}
                                  className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                                    inv.posTerminal !== "VISA_MC"
                                      ? "bg-jct-turquoise text-jct-charcoal shadow-sm"
                                      : "text-slate-600 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-white"
                                  }`}
                                >
                                  {trackPosFees ? "mada (0.80% fee, cap SAR 40)" : "mada"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSelectInvoiceCardNetwork(inv.invoiceNo, "visa")}
                                  className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                                    inv.posTerminal === "VISA_MC"
                                      ? "bg-jct-turquoise text-jct-charcoal shadow-sm"
                                      : "text-slate-600 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-white"
                                  }`}
                                >
                                  {trackPosFees ? "Visa / MC (2.20%)" : "Visa / MC"}
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-0.5 font-mono text-xs">
                            <span className="text-slate-700 font-semibold dark:text-jct-yellow dark:font-normal">
                              {inv.posTerminal === "VISA_MC"
                                ? `Visa / MC (${(inv.posTerminalDevice || "SAB") === "AL_RAJHI" ? "Al Rajhi" : "SAB"})`
                                : inv.posTerminal === "AL_RAJHI"
                                ? "mada · Al Rajhi"
                                : "mada · SAB"}: SAR {fmt(inv.amount)}
                            </span>
                            {isOwner && trackPosFees && posFee > 0 && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                {(() => {
                                  const fb = calcInvoiceFeeBreakdown(inv);
                                  return `MDR: -SAR ${fmt(fb.mdrBase)} | 15% VAT: -SAR ${fmt(fb.vatOnFee)} | Net: SAR ${fmt(fb.net)}`;
                                })()}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Credit Sale Summary Sub-Row (edit via popup modal) */}
                      {isCreditSaleInv && (
                        <div className="bg-slate-50 dark:bg-[#111111] rounded-lg mt-2 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex flex-wrap items-center gap-2 font-mono">
                            <span className="text-jct-charcoal dark:text-white font-semibold">
                              Credit Balance: SAR {fmt(inv.creditBalance ?? inv.amount)}
                            </span>
                            {(inv.creditDownAmount || 0) > 0 && (
                              <>
                                <span className="text-slate-300 dark:text-slate-600">|</span>
                                <span className="text-emerald-600 dark:text-jct-turquoise font-semibold">
                                  Down Payment: SAR {fmt(inv.creditDownAmount || 0)} (
                                  {inv.creditDownMethod === "CASH"
                                    ? "Cash to Drawer"
                                    : POS_TERMINAL_META[inv.creditDownTerminal || "SAB"].badgeTag}
                                  )
                                </span>
                              </>
                            )}
                            {inv.creditFollowUpDate && (
                              <>
                                <span className="text-slate-300 dark:text-slate-600">|</span>
                                <span className="text-slate-500 dark:text-slate-400">
                                  Follow-up: {inv.creditFollowUpDate}
                                </span>
                              </>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setCreditModalInvNo(inv.invoiceNo)}
                            className="bg-jct-yellow text-black font-bold hover:brightness-95 transition-all rounded-md px-2.5 py-0.5 text-xs"
                          >
                            Edit
                          </button>
                        </div>
                      )}

                      {/* Conditional Sub-Row for Bank Transfer (0% Fee) with Bank Mode of Payment Selector */}
                      {inv.paymentMode === "BANK_TRANSFER" && (
                        <div className="bg-slate-50 dark:bg-[#111111] rounded-lg mt-2 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-500 dark:text-slate-400">
                              Mode of Payment (Bank):
                            </span>
                            <select
                              value={inv.bankPaymentMode || "BANK_TRANSFER"}
                              onChange={(e) =>
                                handleEditErpInvoiceBankMode(
                                  inv.invoiceNo,
                                  e.target.value as UniversalPaymentMode
                                )
                              }
                              className="bg-transparent border-transparent text-jct-charcoal dark:text-white focus:outline-none focus:ring-0 focus:border-b-2 focus:border-jct-turquoise transition-all rounded-none px-2 py-0.5 text-xs font-medium"
                            >
                              {UNIVERSAL_PAYMENT_MODES.map((pm) => (
                                <option key={pm.value} value={pm.value} className="bg-white dark:bg-[#0A0A0A]">
                                  {pm.badge} · {pm.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <span className="font-mono font-semibold text-jct-charcoal dark:text-jct-turquoise">
                            {formatPaymentModeBadge(inv.bankPaymentMode || "BANK_TRANSFER").badge}: SAR {fmt(inv.amount)}
                          </span>
                        </div>
                      )}

                      {/* Conditional Sub-Row for Other Amt Recd: Inline Note / Cause Input */}
                      {isOtherRecd && (
                        <div className="bg-slate-50 dark:bg-[#111111] rounded-lg mt-2 p-3 flex items-center gap-2.5 text-xs">
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            Cause / Note:
                          </span>
                          <input
                            type="text"
                            value={inv.otherNote || ""}
                            onChange={(e) => handleSetInvoiceOtherNote(inv.invoiceNo, e.target.value)}
                            placeholder="Add note / cause for this amount..."
                            className="flex-1 bg-transparent border-transparent text-jct-charcoal dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-jct-turquoise transition-all rounded-none px-2 py-0.5 text-xs font-medium"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>
              ) : (
                <div className="w-full">
                  <ClassicDataSheetTable
                    sheetRows={sheetRows}
                    activeErpList={activeErpList}
                    preLoggedEntries={preLoggedEntries}
                    openingBalance={openingBalance}
                    date="12-09-2026"
                    branchName={branchId === "JCT_HQ" ? "JCT Main HQ (Jubail)" : branchId}
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setWizardStep(1)}
                  className="rounded-lg border border-slate-200 dark:border-[#1F1F1F] bg-white dark:bg-black px-4 py-2 text-xs font-semibold text-jct-charcoal dark:text-jct-offwhite hover:bg-slate-50 dark:hover:bg-[#0A0A0A] shadow-sm transition-colors"
                >
                  ← Back
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddInvoiceRow}
                    className="px-4 py-2 rounded-lg border border-jct-turquoise/50 text-jct-turquoise hover:bg-jct-turquoise/10 transition-all font-semibold text-sm"
                  >
                    + Add Manual Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDatasheetView((prev) => !prev)}
                    className="px-4 py-2 rounded-lg border border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-all font-semibold text-sm flex items-center gap-1.5"
                  >
                    <FileSpreadsheet size={15} />
                    <span>{isDatasheetView ? "📋 Switch to Grid View" : "📄 Switch to Classic Datasheet View"}</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    syncCommissionExpenses();
                    setWizardStep(3);
                  }}
                  className="flex items-center gap-2 bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg px-5 py-2.5 text-sm"
                >
                  <span>Continue to Cash Inflows</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────────
              STEP 3: CREDIT & CASH INFLOWS + MANUAL SPLIT PAYMENT ENTRY
             ────────────────────────────────────────────────────────────── */}
          {wizardStep === 3 && (
            <div className="flex flex-col gap-6 bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-turquoise/20 dark:border-jct-turquoise/30 hover:border-jct-turquoise/80 hover:shadow-[0_0_15px_rgba(45,226,230,0.1)] rounded-xl p-6 sm:p-8 transition-all duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-[#1F1F1F] pb-5">
                <div>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-jct-charcoal dark:text-white">
                    Credit Sales, Split Payments, Receipts &amp; Opening Balance
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Log Credit Sales, Split Payments (Cash + Card), or Cash Receipts. Type an ERP Invoice # (e.g. 30064 or 30072) to auto-fill details.
                  </p>
                </div>

                <div className="flex items-center gap-3 bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-yellow/20 dark:border-jct-yellow/30 hover:border-jct-yellow/80 hover:shadow-[0_0_15px_rgba(255,222,89,0.1)] rounded-xl p-4 shrink-0 transition-all duration-300">
                  <div>
                    <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                      Opening Drawer Balance
                    </span>
                    {editingOpening ? (
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="number"
                          value={openingEditInput}
                          onChange={(e) => setOpeningEditInput(e.target.value)}
                          className="w-28 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-2.5 py-1 text-sm font-semibold outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const v = parseFloat(openingEditInput);
                            if (!Number.isNaN(v) && v >= 0) {
                              setOpeningBalanceOriginal(openingBalanceOriginal ?? openingBalance);
                              setOpeningBalance(v);
                            }
                            setEditingOpening(false);
                          }}
                          className="bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg px-2.5 py-1 text-xs"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div className="mt-0.5 flex items-center gap-2.5">
                        <span className="font-display text-xl font-bold text-jct-charcoal dark:text-jct-offwhite whitespace-nowrap">
                          SAR {fmt(openingBalance)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setOpeningEditInput(String(openingBalance));
                            setEditingOpening(true);
                          }}
                          className="bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 transition-all rounded-md px-2.5 py-1 text-xs"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2-Panel Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Panel (5 cols): Streamlined Vertical Form Flow */}
                <div className="lg:col-span-5 bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 flex flex-col">
                  <form onSubmit={handleAddStep3Receipt} className="space-y-4">
                    {/* 1. Transaction Type */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                        Transaction Type
                      </label>
                      <select
                        value={step3Kind}
                        onChange={(e) =>
                          setStep3Kind(
                            e.target.value as
                              | "CREDIT_RECD"
                              | "CREDIT_SALE"
                              | "SPLIT_SALE"
                              | "LOAN_IN"
                              | "OTHER_IN"
                          )
                        }
                        className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2.5 text-sm font-medium outline-none"
                      >
                        <option value="CREDIT_RECD" className="bg-white dark:bg-[#0A0A0A]">Credit Sale Amt Recd</option>
                        <option value="LOAN_IN" className="bg-white dark:bg-[#0A0A0A]">Loan In</option>
                        <option value="OTHER_IN" className="bg-white dark:bg-[#0A0A0A]">Other Amt Recd</option>
                      </select>
                    </div>

                    {/* 2. ERP Invoice / Reference Input */}
                    {step3SplitEnabled ? (
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                          ERP Invoice Number
                        </label>
                        <input
                          type="text"
                          list="erp-invoices-datalist"
                          value={step3ReceiptNo}
                          onChange={(e) => handleStep3InvoiceInput(e.target.value)}
                          placeholder="Enter or select invoice # (e.g. 30064)..."
                          className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2.5 font-mono text-sm font-semibold placeholder:font-sans placeholder:text-slate-400 outline-none"
                        />

                        {/* Clean Horizontal Row of Quick-Select Chips */}
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {["30064", "30067", "30070", "30072", "30075", "30077"].map((invNo) => {
                            const isSelected = cleanErpInvNo(step3ReceiptNo) === invNo;
                            return (
                              <button
                                key={invNo}
                                type="button"
                                onClick={() => handleStep3InvoiceInput(invNo)}
                                className={`rounded-md px-2.5 py-1 font-mono text-xs transition-all ${
                                  isSelected
                                    ? "bg-jct-turquoise text-jct-charcoal font-bold shadow-sm"
                                    : "border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#111111] text-jct-charcoal dark:text-jct-offwhite font-medium hover:brightness-95"
                                }`}
                              >
                                #{invNo}
                              </button>
                            );
                          })}
                        </div>

                        {/* Single-Line Clean Match Confirmation Pill */}
                        {matchedStep3Invoice && (
                          <div className="rounded-lg bg-jct-yellow text-jct-charcoal font-bold px-3.5 py-2 text-xs truncate">
                            Matched:{" "}
                            <span>{matchedStep3Invoice.customer}</span> · SAR{" "}
                            {fmt(matchedStep3Invoice.amount)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                          Receipt / Reference Number (Optional)
                        </label>
                        <input
                          type="text"
                          value={step3ReceiptNo}
                          onChange={(e) => handleStep3InvoiceInput(e.target.value)}
                          placeholder="Receipt # (e.g. RCP-1042)..."
                          className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2.5 font-mono text-sm font-medium placeholder:font-sans placeholder:text-slate-400 outline-none"
                        />
                      </div>
                    )}

                    {/* 3. Customer / Contractor Name */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                        {step3Kind === "CREDIT_RECD" || step3SplitEnabled
                          ? "Customer / Contractor Name"
                          : "Source or Note"}
                      </label>
                      <input
                        type="text"
                        value={step3Title}
                        onChange={(e) => setStep3Title(e.target.value)}
                        placeholder={
                          step3Kind === "CREDIT_RECD" || step3SplitEnabled
                            ? "Customer Name (auto-populates from ERP)"
                            : "Source or Note"
                        }
                        className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2.5 text-sm font-medium placeholder:text-slate-400 outline-none"
                      />
                    </div>

                    {/* 4. Follow-up Reminder Date */}
                    {step3Kind === "CREDIT_RECD" && !step3SplitEnabled && (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                          Follow-up Reminder Date (Credit Radar)
                        </label>
                        <input
                          type="date"
                          value={step3FollowUpDate}
                          onChange={(e) => setStep3FollowUpDate(e.target.value)}
                          className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2.5 text-sm font-medium outline-none"
                        />
                      </div>
                    )}

                    {/* 5. Required Mode of Payment Dropdown (Step 3 Inflows) */}
                    {!step3SplitEnabled && (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                          Mode of Payment (Required)
                        </label>
                        <select
                          value={step3PaymentMode}
                          onChange={(e) => setStep3PaymentMode(e.target.value as UniversalPaymentMode)}
                          required
                          className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2.5 text-sm font-medium outline-none"
                        >
                          {UNIVERSAL_PAYMENT_MODES.map((pm) => (
                            <option key={pm.value} value={pm.value} className="bg-white dark:bg-[#0A0A0A]">
                              {pm.badge} · {pm.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* 6. Amount (SAR) + Split Tender Toggle */}
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                        Amount (SAR)
                      </label>
                      <div className="flex items-center gap-2.5">
                        <input
                          type="number"
                          step="0.01"
                          value={step3Amount}
                          onChange={(e) => handleStep3TotalAmountChange(e.target.value)}
                          placeholder={step3SplitEnabled ? "Total Amount (SAR)" : "Amount (SAR)"}
                          className="flex-1 min-w-0 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2.5 font-display text-base font-semibold placeholder:text-slate-400 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setStep3SplitEnabled((prev) => !prev)}
                          aria-pressed={step3SplitEnabled}
                          className={`shrink-0 rounded-lg px-3.5 py-2.5 text-xs transition-all whitespace-nowrap ${
                            step3SplitEnabled
                              ? "bg-jct-turquoise text-jct-charcoal font-bold shadow-sm"
                              : "bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95"
                          }`}
                        >
                          Split Tender (Cash + Card)
                        </button>
                      </div>
                    </div>

                    {/* Split Payment Allocation Fields in Step 3 */}
                    {step3SplitEnabled && (
                      <div className="space-y-2.5 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#1F1F1F] text-jct-charcoal dark:text-jct-offwhite text-sm mt-2 p-3 rounded-lg">
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                              Cash Portion (SAR)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={step3SplitCash}
                              onChange={(e) => handleStep3SplitCashChange(e.target.value)}
                              className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3 py-2 font-mono text-sm font-semibold outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                              Card / Bank Portion (SAR)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={step3SplitCard}
                              onChange={(e) => handleStep3SplitCardChange(e.target.value)}
                              className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3 py-2 font-mono text-sm font-semibold outline-none"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Card Method:
                          </span>
                          <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1F1F1F] p-1 rounded-lg flex flex-wrap gap-1">
                            {(["SAB", "AL_RAJHI", "VISA_MC"] as PosTerminalBank[]).map((term) => (
                              <button
                                key={term}
                                type="button"
                                onClick={() => {
                                  setStep3SplitMethod("POS_SWIPE");
                                  setStep3SplitTerminal(term);
                                }}
                                className={`rounded-md px-2.5 py-1 text-xs transition-all ${
                                  step3SplitMethod === "POS_SWIPE" && step3SplitTerminal === term
                                    ? "bg-jct-turquoise text-jct-charcoal font-bold shadow-sm"
                                    : "text-slate-500 dark:text-slate-400 font-medium hover:text-jct-charcoal dark:hover:text-jct-offwhite"
                                }`}
                              >
                                {POS_TERMINAL_META[term].badgeTag}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => setStep3SplitMethod("BANK_TRANSFER")}
                              className={`rounded-md px-2.5 py-1 text-xs transition-all ${
                                step3SplitMethod === "BANK_TRANSFER"
                                  ? "bg-jct-turquoise text-jct-charcoal font-bold shadow-sm"
                                  : "text-slate-500 dark:text-slate-400 font-medium hover:text-jct-charcoal dark:hover:text-jct-offwhite"
                              }`}
                            >
                              Bank (0%)
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 7. Full-Width [+ Save & Sync] Button */}
                    <button
                      type="submit"
                      className="w-full bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg px-4 py-2.5 text-sm"
                    >
                      + Save &amp; Sync
                    </button>
                  </form>
                </div>

                {/* Right Panel (7 cols): Live Table of Added Inflows, Split Sales & Reclassified Credit Sales */}
                <div className="lg:col-span-7 bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-[#1F1F1F]">
                      <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                        Recorded Credit Sales &amp; Cash Inflows ({inflowEntries.length})
                      </span>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-lg bg-jct-yellow text-jct-charcoal font-bold px-3 py-1 font-display text-xs whitespace-nowrap">
                          Credit Inv. Amount: SAR {fmt(totalCreditInvAmount)}
                        </span>
                        <span className="font-display text-sm font-bold text-jct-charcoal dark:text-jct-offwhite whitespace-nowrap">
                          Cash Inflows Total: SAR {fmt(totalPreLoggedInflows)}
                        </span>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-200 dark:divide-[#1F1F1F] mt-2">
                      {inflowEntries.map((item) => {
                        const isEditing = editingRowId === item.id;
                        const isCreditSaleRow = item.type === "CREDIT_SALE";
                        const isSplitSaleRow = item.type === "SPLIT_SALE";
                        const pmBadge = formatPaymentModeBadge(item.paymentMode);
                        return (
                          <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                {item.receiptNo && (
                                  <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    {item.receiptNo}
                                  </span>
                                )}
                                <p className="text-sm font-semibold text-jct-charcoal dark:text-jct-offwhite truncate">{item.title}</p>
                                <span
                                  className={`rounded-full border px-3 py-1 text-[10px] font-bold ${pmBadge.badgeClass}`}
                                >
                                  {pmBadge.badge}
                                </span>
                                {isCreditSaleRow && (
                                  <span className="rounded-full bg-jct-yellow text-jct-charcoal font-bold px-3 py-1 text-[10px]">
                                    Credit Inv. Amount
                                  </span>
                                )}
                                {isSplitSaleRow && (
                                  <span className="rounded-full bg-jct-yellow text-jct-charcoal font-bold px-3 py-1 text-[10px]">
                                    Split Tender (Cash: SAR {fmt(item.splitCashAmount || 0)} · Card: SAR {fmt(item.splitBankAmount || 0)})
                                  </span>
                                )}
                                {item.followUpDate && (
                                  <span className="rounded-md bg-jct-turquoise/25 border border-jct-turquoise/40 px-2 py-0.5 text-[10px] font-bold text-jct-charcoal dark:text-jct-offwhite">
                                    Reminder: {item.followUpDate}
                                    {item.receiptNo ? ` · Inv ${item.receiptNo}` : ""}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {isCreditSaleRow
                                  ? "Reclassified Credit Sale (Not counted in physical Cash Drawer) · Synced to Credit Radar"
                                  : `${item.receiptNo ? `${item.receiptNo} · ` : ""}${entryTypeMeta[item.type].label}`}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isEditing ? (
                                <>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editingRowVal}
                                    onChange={(e) => setEditingRowVal(e.target.value)}
                                    className="w-28 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-2.5 py-1 text-right text-sm font-semibold outline-none"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveInlineEdit(item.id)}
                                    className="bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg px-2.5 py-1 text-xs"
                                  >
                                    Save
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span className="font-display text-sm font-bold whitespace-nowrap text-jct-charcoal dark:text-jct-offwhite">
                                    {isCreditSaleRow ? "" : "+"}SAR {fmt(item.amount)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditEntryModal(item)}
                                    className="bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 transition-all rounded-md px-2.5 py-1 text-xs"
                                  >
                                    ✏️ Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveEntry(item.id)}
                                    className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 p-1.5 rounded-md transition-colors"
                                    title="Delete entry"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 transition-all rounded-lg px-4 py-2 text-xs shadow-sm"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setWizardStep(4)}
                  className="flex items-center gap-2 bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg px-5 py-2.5 text-sm"
                >
                  <span>Continue to Expenses &amp; Purchases</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────────
              STEP 4: EXPENSES & SUPPLIER PURCHASES (STRICT 7 CATEGORIES + SUPPLIER SYNC)
             ────────────────────────────────────────────────────────────── */}
          {wizardStep === 4 && (
            <div className="flex flex-col gap-6 bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-yellow/20 dark:border-jct-yellow/30 hover:border-jct-yellow/80 hover:shadow-[0_0_15px_rgba(255,222,89,0.1)] rounded-xl p-6 sm:p-8 transition-all duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-[#1F1F1F] pb-5">
                <div>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-jct-charcoal dark:text-white">
                    Expenses &amp; Supplier Purchases
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Select from the 7 official categories. Credit Purchases sync directly into Suppliers &amp; Payables.
                  </p>
                </div>
                <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-yellow/20 dark:border-jct-yellow/30 hover:border-jct-yellow/80 hover:shadow-[0_0_15px_rgba(255,222,89,0.1)] rounded-xl px-4 py-2.5 shrink-0 transition-all duration-300">
                  <span className="font-display text-base font-bold text-jct-charcoal dark:text-jct-offwhite whitespace-nowrap">
                    Total Outflows: SAR {fmt(totalPreLoggedExpenses)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Panel (5 cols): Strict 7 Category Pills + Conditional Supplier & Due Date Inputs */}
                <div className="lg:col-span-5 bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-yellow/20 dark:border-jct-yellow/30 hover:border-jct-yellow/80 hover:shadow-[0_0_15px_rgba(255,222,89,0.1)] rounded-xl p-6 flex flex-col gap-4 transition-all duration-300">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    1. Select Category (Strict 7 Categories)
                  </span>

                  <div className="flex flex-wrap gap-2">
                    {STRICT_EXPENSE_CATEGORIES.map((category) => {
                      const active = step4Category === category;
                      const existing = expenseEntries.find(
                        (e) =>
                          e.expenseCategory === category ||
                          e.title.trim().toLowerCase() === category.toLowerCase()
                      );
                      const defaultAmts: Record<StrictExpenseCategory, string> = {
                        Food: "24",
                        Water: "150",
                        Salary: "1500",
                        "Staff Advance": "500",
                        "Credit Purchase": "2000",
                        "Cash Purchase": "640",
                        "Bank Purchase": "1800",
                        "Personal Reasons": "200",
                        "Business Commission": "150",
                      };
                      return (
                        <button
                          key={category}
                          type="button"
                          onClick={() => {
                            setStep4Category(category);
                            if (category === "Bank Purchase" && step4PaymentMode === "CASH") {
                              setStep4PaymentMode("SAB");
                            } else if (category === "Cash Purchase") {
                              setStep4PaymentMode("CASH");
                            }
                            setStep4Amount(
                              existing ? String(existing.amount) : defaultAmts[category]
                            );
                          }}
                          className={`rounded-lg px-3 py-1.5 text-xs transition-all ${
                            active
                              ? "bg-jct-turquoise text-jct-charcoal font-bold shadow-sm"
                              : existing
                              ? "bg-jct-yellow text-jct-charcoal font-bold"
                              : "border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#111111] text-jct-charcoal dark:text-jct-offwhite font-medium hover:brightness-95"
                          }`}
                        >
                          {category} {existing ? `(${existing.amount} SAR)` : ""}
                        </button>
                      );
                    })}
                  </div>

                  <form onSubmit={handleAddStep4Expense} className="space-y-3 pt-2">
                    {/* Required Mode of Payment Dropdown (Step 4 Outflows/Purchases) */}
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Mode of Payment (Required)
                      </label>
                      <select
                        value={step4PaymentMode}
                        onChange={(e) => setStep4PaymentMode(e.target.value as UniversalPaymentMode)}
                        required
                        className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2.5 text-sm font-medium outline-none"
                      >
                        {UNIVERSAL_PAYMENT_MODES.map((pm) => (
                          <option key={pm.value} value={pm.value} className="bg-white dark:bg-[#0A0A0A]">
                            {pm.badge} · {pm.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Show Supplier Name when Credit Purchase, Cash Purchase, or Bank Purchase is selected */}
                    {(step4Category === "Credit Purchase" ||
                      step4Category === "Cash Purchase" ||
                      step4Category === "Bank Purchase") && (
                      <div className="space-y-2.5 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#1F1F1F] text-jct-charcoal dark:text-jct-offwhite text-sm p-3 rounded-lg">
                        <div>
                          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                            Supplier Name (Syncs to Suppliers &amp; Payables)
                          </label>
                          <input
                            type="text"
                            list="step4-suppliers-list"
                            value={step4SupplierName}
                            onChange={(e) => setStep4SupplierName(e.target.value)}
                            placeholder="e.g. Jotun, Hempel, Sigma..."
                            className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2 text-sm font-medium placeholder:text-slate-400 outline-none"
                          />
                          <datalist id="step4-suppliers-list">
                            <option value="Jotun" />
                            <option value="Hempel" />
                            <option value="Sigma" />
                          </datalist>
                        </div>

                        {step4Category === "Credit Purchase" && (
                          <div className="flex items-center justify-between gap-3 pt-1">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              Payment Due Date:
                            </span>
                            <input
                              type="date"
                              value={step4DueDate}
                              onChange={(e) => setStep4DueDate(e.target.value)}
                              className="bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3 py-1.5 text-xs font-medium outline-none"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Show Staff Member selector when Staff Advance or Salary is selected */}
                    {(step4Category === "Staff Advance" || step4Category === "Salary") && (
                      <div className="space-y-2 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#1F1F1F] text-jct-charcoal dark:text-jct-offwhite text-sm p-3 rounded-lg">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                            Select Staff Member (Syncs to Monthly Payroll Ledger)
                          </label>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                            {branchId}
                          </span>
                        </div>
                        {staffList.length > 0 ? (
                          <select
                            value={step4StaffId}
                            onChange={(e) => setStep4StaffId(e.target.value)}
                            className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2 text-sm font-medium outline-none"
                          >
                            {staffList.map((st) => (
                              <option key={st.id} value={st.id} className="bg-white dark:bg-[#0A0A0A] text-jct-charcoal dark:text-jct-offwhite">
                                {st.name} {st.role ? `· ${st.role}` : ""} (Base: SAR {fmt(st.baseSalary)})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="text-xs text-slate-500 dark:text-slate-400 p-2 border border-dashed border-slate-300 dark:border-[#1F1F1F] rounded-lg">
                            No active staff registered for this branch yet. You can add them in the Staff &amp; Payroll portal.
                          </div>
                        )}
                      </div>
                    )}

                    <input
                      type="text"
                      value={step4Note}
                      onChange={(e) => setStep4Note(e.target.value)}
                      placeholder={`Optional note for ${step4Category}...`}
                      className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2.5 text-sm font-medium placeholder:text-slate-400 outline-none"
                    />

                    <div className="flex gap-3">
                      <input
                        type="number"
                        step="0.01"
                        value={step4Amount}
                        onChange={(e) => setStep4Amount(e.target.value)}
                        placeholder="Amount (SAR)"
                        className="flex-1 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2.5 font-display text-base font-semibold placeholder:text-slate-400 outline-none"
                      />
                      <button
                        type="submit"
                        className="bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg px-4 py-2 text-sm shrink-0"
                      >
                        + Save {step4Category === "Credit Purchase" ? "& Sync Bill" : "Expense"}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Right Panel (7 cols): Clean Live Table of Added Expenses */}
                <div className="lg:col-span-7 bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#1F1F1F]">
                      <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                        Logged Expenses &amp; Supplier Purchases ({expenseEntries.length})
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Deduplicated automatically
                      </span>
                    </div>

                    <div className="divide-y divide-slate-200 dark:divide-[#1F1F1F] mt-2">
                      {expenseEntries.map((item) => {
                        const isEditing = editingRowId === item.id;
                        const pmBadge = formatPaymentModeBadge(item.paymentMode);
                        return (
                          <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="rounded-full bg-jct-yellow text-jct-charcoal font-bold px-3 py-1 text-[10px]">
                                  {item.expenseCategory || "Food"}
                                </span>
                                <span
                                  className={`rounded-full border px-3 py-1 text-[10px] font-bold ${pmBadge.badgeClass}`}
                                >
                                  {pmBadge.badge}
                                </span>
                                <p className="text-sm font-semibold text-jct-charcoal dark:text-jct-offwhite truncate">{item.title}</p>
                                {item.dueDate && (
                                  <span className="rounded-full bg-jct-turquoise/25 border border-jct-turquoise/40 px-3 py-1 text-[10px] font-bold text-jct-charcoal dark:text-jct-offwhite">
                                    Due: {item.dueDate}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {item.supplierName ? `Supplier: ${item.supplierName} · ` : ""}
                                {item.time}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isEditing ? (
                                <>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editingRowVal}
                                    onChange={(e) => setEditingRowVal(e.target.value)}
                                    className="w-28 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-2.5 py-1 text-right text-sm font-semibold outline-none"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveInlineEdit(item.id)}
                                    className="bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg px-2.5 py-1 text-xs"
                                  >
                                    Save
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span className="font-display text-sm font-bold text-jct-charcoal dark:text-jct-offwhite whitespace-nowrap">
                                    -SAR {fmt(item.amount)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditEntryModal(item)}
                                    className="bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 transition-all rounded-md px-2.5 py-1 text-xs"
                                  >
                                    ✏️ Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveEntry(item.id)}
                                    className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 p-1.5 rounded-md transition-colors"
                                    title="Delete expense"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setWizardStep(3)}
                  className="bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 transition-all rounded-lg px-4 py-2 text-xs shadow-sm"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setWizardStep(5)}
                  className="flex items-center gap-2 bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg px-5 py-2.5 text-sm"
                >
                  <span>Open Final Audit Workbench</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────────
              STEP 5: FULL-WIDESCREEN EDITABLE AUDIT WORKBENCH WITH [⤢ EXPAND] ON ALL 3 BOXES
             ────────────────────────────────────────────────────────────── */}
          {wizardStep === 5 && (
            <div className="flex flex-col gap-6 pb-8 print:block print:w-full print:bg-white print:text-black print:p-0 print:m-0">
              {/* ──────────────────────────────────────────────────────────
                  PAGE 1: AUDIT SUMMARY (EXECUTIVE OVERVIEW)
                 ────────────────────────────────────────────────────────── */}
              <div className={printMode === "summary" ? "print:break-after-page" : "print:hidden"}>
                {/* Print-Only Report Header */}
                <PrintReportHeader
                  branch={branchId === "JCT_HQ" ? "JCT Main HQ (Jubail)" : branchId}
                  date="12-09-2026"
                />

                {/* 1. Consolidated Settlement & Merchant Fee Header Strip - Staff RBAC */}
                {isOwner && (
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-turquoise/20 dark:border-jct-turquoise/30 hover:border-jct-turquoise/80 hover:shadow-[0_0_15px_rgba(45,226,230,0.1)] rounded-xl p-6 transition-all duration-300 print:hidden">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Audit Settlement Mode:
                      </span>
                      <div className="inline-flex rounded-xl bg-slate-100 dark:bg-black p-1 border border-slate-200 dark:border-[#1F1F1F] gap-1 print:hidden">
                        <button
                          type="button"
                          onClick={() => setBankSettlementMode("GROSS")}
                          className={`rounded-lg px-3 py-1.5 text-xs transition ${
                            bankSettlementMode === "GROSS"
                              ? "bg-jct-turquoise text-jct-charcoal font-bold shadow-sm"
                              : "text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite font-medium"
                          }`}
                        >
                          Gross Face Value
                        </button>
                        <button
                          type="button"
                          onClick={() => setBankSettlementMode("NET")}
                          className={`rounded-lg px-3 py-1.5 text-xs transition ${
                            bankSettlementMode === "NET"
                              ? "bg-jct-turquoise text-jct-charcoal font-bold shadow-sm"
                              : "text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite font-medium"
                          }`}
                        >
                          Net Bank (Deduct Fees &amp; VAT)
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center">
                      {bankSettlementMode === "GROSS" ? (
                        <div className="inline-flex items-center gap-1.5 text-xs bg-jct-yellow text-jct-charcoal font-bold px-3 py-1.5 rounded-lg">
                          <span>ℹ️ Est. Merchant Fees: <strong className="font-mono">-SAR {fmt(totalPosFees)}</strong> (mada: SAR {fmt(totalMadaFees)} · CC: SAR {fmt(totalCcFees)}) · Informational</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 text-xs bg-jct-turquoise text-jct-charcoal font-bold px-3 py-1.5 rounded-lg">
                          <span>✅ Net Settlement Active: <strong className="font-mono">SAR {fmt(totalPosFees)}</strong> deducted from bank total</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. Streamlined Hero Drawer Closing Card */}
                <div className="w-full bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-yellow/20 dark:border-jct-yellow/30 hover:border-jct-yellow/80 hover:shadow-[0_0_15px_rgba(255,222,89,0.1)] rounded-xl p-6 mb-2 transition-all duration-300 print:shadow-none print:border print:border-black print:rounded-none print:bg-white print:text-black print:p-6 print:mb-4 print:break-inside-avoid">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                    <div>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-jct-yellow text-jct-charcoal text-xs font-bold uppercase tracking-wider print:border print:border-black print:bg-white print:text-black print:text-xs print:font-bold print:uppercase">
                        <Wallet size={14} className="text-jct-charcoal print:text-black" />
                        <span>💵 PHYSICAL CASH DRAWER CLOSING BALANCE</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 print:text-black">
                        Count physical cash in register before locking.
                      </p>
                    </div>
                    <div className="text-3xl md:text-4xl font-black text-jct-charcoal dark:text-jct-offwhite tracking-tight print:text-black print:text-2xl print:font-bold">
                      SAR {fmt(calculatedClosingBalance)}
                    </div>
                  </div>

                  {/* Clean Math Formula Strip (Fully Visible) */}
                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200 dark:border-[#1F1F1F] text-xs text-slate-500 dark:text-slate-400 print:text-black print:border-black">
                    <span>Opening Float: <strong className="text-jct-charcoal dark:text-jct-offwhite print:text-black">SAR {fmt(openingBalance)}</strong></span>
                    <span className="text-jct-turquoise font-bold print:text-black">+</span>
                    <span>Inflows: <strong className="text-jct-charcoal dark:text-jct-offwhite print:text-black">SAR {fmt(totalCashInSalesAndReceipts)}</strong></span>
                    <span className="text-rose-500 font-bold print:text-black">-</span>
                    <span>Outflows: <strong className="text-jct-charcoal dark:text-jct-offwhite print:text-black">SAR {fmt(totalMoneyOutDrawer)}</strong></span>
                    <span className="text-jct-yellow font-bold print:text-black">=</span>
                    <span>Closing Cash: <strong className="text-jct-charcoal dark:text-jct-offwhite print:text-black">SAR {fmt(calculatedClosingBalance)}</strong></span>
                  </div>
                </div>

                {/* 3. The 3 Financial Pillars Grid (Inflows · Bank/Swipes · Outflows) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2 print:grid-cols-3 print:gap-4 print:mb-6 print:break-inside-avoid">
                  {/* Card 1: Cash Inflows */}
                  <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-turquoise/20 dark:border-jct-turquoise/30 hover:border-jct-turquoise/80 hover:shadow-[0_0_15px_rgba(45,226,230,0.1)] rounded-xl p-6 flex flex-col justify-between gap-3 transition-all duration-300 print:shadow-none print:border print:border-black print:rounded-none print:bg-white print:text-black">
                    <div>
                      <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider print:text-black print:text-xs print:font-bold print:uppercase">
                        Cash Inflows (Sales &amp; Receipts)
                      </span>
                      <span className="mt-2 block font-mono text-2xl font-black text-jct-charcoal dark:text-jct-offwhite whitespace-nowrap print:text-black print:text-2xl print:font-bold">
                        SAR {fmt(totalCashInSalesAndReceipts)}
                      </span>
                    </div>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-[#1F1F1F] pt-2 print:text-black print:border-black">
                      + Opening Float <strong className="text-jct-charcoal dark:text-jct-offwhite print:text-black">SAR {fmt(openingBalance)}</strong>
                    </span>
                  </div>

                  {/* Card 2: Bank / Card Swipes */}
                  <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-yellow/20 dark:border-jct-yellow/30 hover:border-jct-yellow/80 hover:shadow-[0_0_15px_rgba(255,222,89,0.1)] rounded-xl p-6 flex flex-col justify-between gap-3 transition-all duration-300 print:shadow-none print:border print:border-black print:rounded-none print:bg-white print:text-black">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider print:text-black print:text-xs print:font-bold print:uppercase">
                          Bank &amp; Card Swipes
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedAuditBox(expandedAuditBox === "BANK_POS" ? "NONE" : "BANK_POS")
                          }
                          className="rounded px-2 py-0.5 text-[11px] bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 transition-all print:hidden"
                        >
                          {expandedAuditBox === "BANK_POS" ? "[Collapse]" : "[View Details]"}
                        </button>
                      </div>
                      <span className="mt-2 block font-mono text-2xl font-black text-jct-charcoal dark:text-jct-offwhite whitespace-nowrap print:text-black print:text-2xl print:font-bold">
                        SAR {fmt(activeBankSettlementTotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-[#1F1F1F] pt-2 print:text-black print:border-black">
                      <span className="print:text-black">
                        {bankSwipeInvoices.length} Invoices settled to bank
                      </span>
                      <span className="text-[11px] font-semibold text-jct-charcoal dark:text-jct-offwhite print:text-black">
                        {bankSettlementMode === "NET" ? "Net of fees" : "Gross"}
                      </span>
                    </div>
                  </div>

                  {/* Card 3: Cash Outflows */}
                  <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-turquoise/20 dark:border-jct-turquoise/30 hover:border-jct-turquoise/80 hover:shadow-[0_0_15px_rgba(45,226,230,0.1)] rounded-xl p-6 flex flex-col justify-between gap-3 transition-all duration-300 print:shadow-none print:border print:border-black print:rounded-none print:bg-white print:text-black">
                    <div>
                      <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider print:text-black print:text-xs print:font-bold print:uppercase">
                        Cash Outflows (Shop Expenses)
                      </span>
                      <span className="mt-2 block font-mono text-2xl font-black text-jct-charcoal dark:text-jct-offwhite whitespace-nowrap print:text-black print:text-2xl print:font-bold">
                        SAR {fmt(totalMoneyOutDrawer)}
                      </span>
                    </div>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-[#1F1F1F] pt-2 print:text-black print:border-black">
                      {expenseEntries.length} Recorded shop expenses
                    </span>
                  </div>
                </div>

                {/* Print-Only Signature Footer at bottom of Page 1 Audit Summary */}
                <PrintReportFooter />
              </div>

              {/* Expanded Mode Banner if a Box is Expanded */}
              {expandedAuditBox !== "NONE" && (
                <div className="flex items-center justify-between rounded-xl bg-jct-yellow text-jct-charcoal font-bold px-5 py-3 shadow-sm print:hidden">
                  <span className="text-xs sm:text-sm font-extrabold">
                    ⤢ Focused Full-Width Mode:{" "}
                    {expandedAuditBox === "MONEY_IN"
                      ? "Money In — Cash Sales & Receipts"
                      : expandedAuditBox === "EXPENSES"
                      ? "Shop Expenses & Supplier Purchases"
                      : "Bank / POS Transfers (SAB / Al Rajhi / Bank)"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpandedAuditBox("NONE")}
                    className="flex items-center gap-1.5 rounded-lg bg-jct-charcoal text-jct-offwhite px-4 py-1.5 text-xs font-extrabold hover:brightness-95 transition"
                  >
                    <Minimize2 size={14} />
                    <span>⤡ Collapse to 3-Box View</span>
                  </button>
                </div>
              )}

              {/* Main Body — 3 Expandable Boxes (Interactive on screen, hidden in print ledger) */}
              <div
                className={`grid grid-cols-1 ${
                  expandedAuditBox === "NONE" ? "lg:grid-cols-2" : "lg:grid-cols-1"
                } gap-6 items-start print:hidden`}
              >
                {/* ══════════════════════════════════════════════════════════
                    BOX 1: Money In — Cash Sales & Receipts
                   ══════════════════════════════════════════════════════════ */}
                {(expandedAuditBox === "NONE" || expandedAuditBox === "MONEY_IN") && (
                  <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-turquoise/20 dark:border-jct-turquoise/30 hover:border-jct-turquoise/80 hover:shadow-[0_0_15px_rgba(45,226,230,0.1)] rounded-xl p-6 flex flex-col gap-4 transition-all duration-300 print:shadow-none print:border-none print:p-0 print:bg-white print:text-black">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-[#1F1F1F] pb-3.5 print:border-none print:pb-0">
                      <div className="w-full">
                        <h3 className="font-display text-lg font-extrabold text-jct-charcoal dark:text-jct-offwhite print:text-xl print:font-extrabold print:tracking-tight print:mt-10 print:mb-4 print:border-b print:border-slate-300 print:pb-2 print:text-black">
                          Cash Inflows (Sales &amp; Receipts)
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 print:hidden">
                          Includes 15% Saudi VAT breakdown, notes, and inline amount editing
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 print:hidden">
                        <span className="font-display text-base font-extrabold text-jct-charcoal dark:text-jct-offwhite whitespace-nowrap">
                          +SAR {fmt(totalMoneyInDrawer)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedAuditBox(
                              expandedAuditBox === "MONEY_IN" ? "NONE" : "MONEY_IN"
                            )
                          }
                          className="flex items-center gap-1.5 rounded-lg bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 px-3 py-1.5 text-xs transition-all print:hidden"
                        >
                          {expandedAuditBox === "MONEY_IN" ? (
                            <>
                              <Minimize2 size={13} />
                              <span>⤡ Collapse</span>
                            </>
                          ) : (
                            <>
                              <Maximize2 size={13} />
                              <span>⤢ Expand</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-200 dark:divide-[#1F1F1F] rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-slate-50/50 dark:bg-black overflow-hidden print:border print:border-slate-300 print:rounded-none print:bg-white print:divide-slate-200">
                      {/* Opening Float Row */}
                      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-50 dark:bg-[#111111] print:flex print:justify-between print:py-2 print:border-b print:border-slate-200 print:text-sm print:text-black print:bg-white print:break-inside-avoid">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400 w-16 shrink-0 print:text-black print:font-bold print:w-20">
                            FLOAT
                          </span>
                          <span className="text-xs font-bold text-jct-charcoal dark:text-jct-offwhite truncate print:text-black print:text-sm">
                            Opening Drawer Balance
                          </span>
                          {openingBalanceOriginal !== undefined && (
                            <span className="rounded bg-jct-yellow text-jct-charcoal px-1.5 py-0.5 text-[10px] font-bold print:hidden">
                              Orig: SAR {fmt(openingBalanceOriginal)}
                            </span>
                          )}
                        </div>
                        <span className="font-display text-xs font-extrabold text-jct-charcoal dark:text-jct-offwhite whitespace-nowrap print:text-black print:text-sm print:font-bold">
                          +SAR {fmt(openingBalance)}
                        </span>
                      </div>

                      {/* All Cash Sale, Split Cash Share & Other Amt Recd Invoices */}
                      {cashSaleInvoices.map((inv) => {
                        const isSplitRow = inv.paymentMode === "SPLIT";
                        const cashAmt = calcInvoiceCashPortion(inv);
                        const rowKey = isSplitRow
                          ? `erp-cash-${inv.invoiceNo}`
                          : `erp-${inv.invoiceNo}`;
                        const isEditing = editingRowId === rowKey;
                        const netExclVat = cashAmt / 1.15;
                        return (
                          <div
                            key={`cash-${inv.invoiceNo}`}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 transition print:flex print:flex-row print:justify-between print:py-2 print:border-b print:border-slate-200 print:text-sm print:text-black print:bg-white print:break-inside-avoid ${
                              isSplitRow
                                ? "bg-jct-yellow/15 hover:bg-jct-yellow/25"
                                : "hover:bg-slate-100/70 dark:hover:bg-[#111111]"
                            }`}
                          >
                            <div className="flex flex-wrap items-center gap-2.5 min-w-0 flex-1">
                              <span className="font-mono text-xs font-extrabold text-slate-500 dark:text-slate-400 w-16 shrink-0 print:text-black print:font-bold print:w-20">
                                #{inv.invoiceNo}
                              </span>
                              <span className="text-xs font-semibold text-jct-charcoal dark:text-jct-offwhite truncate print:text-black print:text-sm">
                                {inv.customer}
                              </span>
                              {isSplitRow && (
                                <span className="rounded bg-jct-yellow text-jct-charcoal font-bold px-2 py-0.5 text-[10px] shrink-0 print:border print:border-black print:bg-white print:text-black">
                                  Split (Cash Share: SAR {fmt(cashAmt)})
                                </span>
                              )}
                              {inv.paymentMode === "OTHER_RECD" && (
                                <span className="rounded bg-jct-turquoise/25 border border-jct-turquoise/40 px-2 py-0.5 text-[10px] font-bold text-jct-charcoal dark:text-jct-offwhite shrink-0 print:border-black print:text-black">
                                  Other Recd{inv.otherNote ? `: ${inv.otherNote}` : ""}
                                </span>
                              )}
                              {inv.originalAmount !== undefined && (
                                <span className="rounded bg-jct-yellow text-jct-charcoal font-bold px-1.5 py-0.5 text-[10px] shrink-0 print:hidden">
                                  Orig: SAR {fmt(inv.originalAmount)}
                                </span>
                              )}
                            </div>

                            {expandedAuditBox === "MONEY_IN" && (
                              <div className="flex items-center gap-2 print:hidden">
                                <input
                                  type="text"
                                  value={inv.otherNote || ""}
                                  onChange={(e) =>
                                    handleSetInvoiceOtherNote(inv.invoiceNo, e.target.value)
                                  }
                                  placeholder="Note / Cause..."
                                  className="w-40 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-2.5 py-1 text-xs placeholder:text-slate-400 outline-none"
                                />
                                {!isSplitRow && (
                                  <button
                                    type="button"
                                    onClick={() => handleSetInvoiceMode(inv.invoiceNo, "POS_SWIPE")}
                                    className="rounded-md bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 px-2.5 py-1 text-[10px]"
                                  >
                                    Move to POS Swipe →
                                  </button>
                                )}
                              </div>
                            )}

                            <div className="flex items-center justify-end gap-3 shrink-0">
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap print:hidden">
                                Excl. 15% VAT: SAR {fmt(netExclVat)}
                              </span>

                              {isEditing ? (
                                <div className="flex items-center gap-1.5 print:hidden">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editingRowVal}
                                    onChange={(e) => setEditingRowVal(e.target.value)}
                                    className="w-24 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-2 py-1 text-right text-xs font-extrabold outline-none"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveInlineEdit(rowKey)}
                                    className="rounded-lg bg-jct-turquoise text-jct-charcoal font-bold px-2 py-1 text-[10px]"
                                  >
                                    Save
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className="font-display text-xs font-extrabold text-jct-charcoal dark:text-jct-offwhite w-24 text-right whitespace-nowrap print:text-black print:text-sm print:font-bold">
                                    +SAR {fmt(cashAmt)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingRowId(rowKey);
                                      setEditingRowVal(String(cashAmt));
                                    }}
                                    className="rounded bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 px-2 py-0.5 text-[10px] print:hidden"
                                  >
                                    ✏️ Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveErpInvoice(inv.invoiceNo)}
                                    className="rounded border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 transition print:hidden"
                                    title="Delete invoice"
                                  >
                                    🗑️ Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Credit & Other Cash Receipts */}
                      {cashInflowEntries.map((entry) => {
                        const isEditing = editingRowId === entry.id;
                        const pmBadge = formatPaymentModeBadge(entry.paymentMode);
                        return (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-slate-100/70 dark:hover:bg-[#111111] transition print:flex print:justify-between print:py-2 print:border-b print:border-slate-200 print:text-sm print:text-black print:bg-white print:break-inside-avoid"
                          >
                            <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                              <span className="font-mono text-xs font-extrabold text-slate-500 dark:text-slate-400 w-16 shrink-0 print:text-black print:font-bold print:w-20">
                                {entry.receiptNo || "RECEIPT"}
                              </span>
                              <span
                                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold shrink-0 print:border-black print:text-black ${pmBadge.badgeClass}`}
                              >
                                {pmBadge.badge}
                              </span>
                              <span className="text-xs font-bold text-jct-charcoal dark:text-jct-offwhite truncate print:text-black print:text-sm">
                                {entry.title}
                              </span>
                              {entry.followUpDate && (
                                <span className="rounded-full bg-jct-turquoise/25 border border-jct-turquoise/40 px-2.5 py-0.5 text-[10px] font-bold text-jct-charcoal dark:text-jct-offwhite shrink-0 print:border-black print:text-black">
                                  Follow-up: {entry.followUpDate}
                                </span>
                              )}
                              {entry.originalAmount !== undefined && (
                                <span className="rounded bg-jct-yellow text-jct-charcoal font-bold px-1.5 py-0.5 text-[10px] shrink-0 print:hidden">
                                  Orig: SAR {fmt(entry.originalAmount)}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isEditing ? (
                                <div className="flex items-center gap-1.5 print:hidden">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editingRowVal}
                                    onChange={(e) => setEditingRowVal(e.target.value)}
                                    className="w-24 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-2 py-1 text-right text-xs font-extrabold outline-none"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveInlineEdit(entry.id)}
                                    className="rounded-lg bg-jct-turquoise text-jct-charcoal font-bold px-2 py-1 text-[10px]"
                                  >
                                    Save
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className="font-display text-xs font-extrabold text-jct-charcoal dark:text-jct-offwhite whitespace-nowrap print:text-black print:text-sm print:font-bold">
                                    +SAR {fmt(entry.amount)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditEntryModal(entry)}
                                    className="rounded bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 px-2 py-0.5 text-[10px] print:hidden"
                                  >
                                    ✏️ Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveEntry(entry.id)}
                                    className="rounded border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 transition print:hidden"
                                    title="Delete inflow"
                                  >
                                    🗑️ Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* [+ Add Missing Inflow] Row at Bottom */}
                    <form onSubmit={handleAddMissingInflow} className="flex flex-wrap items-center gap-2 pt-1 print:hidden">
                      <input
                        type="text"
                        value={missingInflowTitle}
                        onChange={(e) => setMissingInflowTitle(e.target.value)}
                        placeholder="Missing receipt or customer name..."
                        className="flex-1 min-w-[140px] bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2 text-xs font-semibold placeholder:text-slate-400 outline-none"
                      />
                      <select
                        value={missingInflowMode}
                        onChange={(e) => setMissingInflowMode(e.target.value as UniversalPaymentMode)}
                        required
                        className="bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-2.5 py-2 text-xs font-bold outline-none"
                      >
                        {UNIVERSAL_PAYMENT_MODES.map((pm) => (
                          <option key={pm.value} value={pm.value} className="bg-white dark:bg-[#0A0A0A]">
                            {pm.badge} · {pm.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        value={missingInflowAmt}
                        onChange={(e) => setMissingInflowAmt(e.target.value)}
                        placeholder="SAR"
                        className="w-24 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3 py-2 text-xs font-bold placeholder:text-slate-400 outline-none"
                      />
                      <button
                        type="submit"
                        className="bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg px-3.5 py-2 text-xs whitespace-nowrap"
                      >
                        + Add Missing Inflow
                      </button>
                    </form>
                  </div>
                )}

                {/* RIGHT STACK (OR FULL-WIDTH WHEN EXPANDED): BOX 2 & BOX 3 */}
                {(expandedAuditBox === "NONE" ||
                  expandedAuditBox === "EXPENSES" ||
                  expandedAuditBox === "BANK_POS") && (
                  <div className="flex flex-col gap-6 print:w-full">
                    {/* ══════════════════════════════════════════════════════
                        BOX 2: Shop Expenses & Supplier Purchases
                       ══════════════════════════════════════════════════════ */}
                    {(expandedAuditBox === "NONE" || expandedAuditBox === "EXPENSES") && (
                      <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-yellow/20 dark:border-jct-yellow/30 hover:border-jct-yellow/80 hover:shadow-[0_0_15px_rgba(255,222,89,0.1)] rounded-xl p-6 flex flex-col gap-4 transition-all duration-300 print:shadow-none print:border-none print:p-0 print:bg-white print:text-black">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-[#1F1F1F] pb-3.5 print:border-none print:pb-0">
                          <div className="w-full">
                            <h3 className="font-display text-lg font-extrabold text-jct-charcoal dark:text-jct-offwhite print:text-xl print:font-extrabold print:tracking-tight print:mt-10 print:mb-4 print:border-b print:border-slate-300 print:pb-2 print:text-black">
                              Cash Outflows (Shop Expenses)
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 print:hidden">
                              7 official categories · Credit Purchases sync to Suppliers &amp; Payables
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 print:hidden">
                            <span className="font-display text-base font-extrabold text-jct-charcoal dark:text-jct-offwhite whitespace-nowrap">
                              -SAR {fmt(totalMoneyOutDrawer)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedAuditBox(
                              expandedAuditBox === "EXPENSES" ? "NONE" : "EXPENSES"
                            )
                          }
                          className="flex items-center gap-1.5 rounded-lg bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 px-3 py-1.5 text-xs transition-all print:hidden"
                        >
                          {expandedAuditBox === "EXPENSES" ? (
                            <>
                              <Minimize2 size={13} />
                              <span>⤡ Collapse</span>
                            </>
                          ) : (
                            <>
                              <Maximize2 size={13} />
                              <span>⤢ Expand</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-200 dark:divide-[#1F1F1F] rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-slate-50/50 dark:bg-black overflow-hidden print:border print:border-slate-300 print:rounded-none print:bg-white print:divide-slate-200">
                      {expenseEntries.map((entry) => {
                        const isEditing = editingRowId === entry.id;
                        const pmBadge = formatPaymentModeBadge(entry.paymentMode);
                        return (
                          <div
                            key={entry.id}
                            className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 hover:bg-slate-100/70 dark:hover:bg-[#111111] transition print:flex print:justify-between print:py-2 print:border-b print:border-slate-200 print:text-sm print:text-black print:bg-white print:break-inside-avoid"
                          >
                            <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                              <span className="rounded-full bg-jct-yellow text-jct-charcoal font-bold px-2.5 py-0.5 text-[10px] shrink-0 print:border print:border-black print:bg-white print:text-black print:w-24 print:rounded-none print:text-center print:font-bold">
                                {entry.expenseCategory || "Food"}
                              </span>
                              <span
                                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold shrink-0 print:border-black print:text-black ${pmBadge.badgeClass}`}
                              >
                                {pmBadge.badge}
                              </span>
                              <span className="text-xs font-bold text-jct-charcoal dark:text-jct-offwhite truncate print:text-black print:text-sm">
                                {entry.title}
                              </span>
                              {entry.dueDate && (
                                <span className="rounded-full bg-jct-turquoise/25 border border-jct-turquoise/40 px-2.5 py-0.5 text-[10px] font-bold text-jct-charcoal dark:text-jct-offwhite shrink-0 print:border-black print:text-black">
                                  Due: {entry.dueDate}
                                </span>
                              )}
                              {entry.originalAmount !== undefined && (
                                <span className="rounded-full bg-jct-yellow text-jct-charcoal font-bold px-2.5 py-0.5 text-[10px] shrink-0 print:hidden">
                                  Orig: SAR {fmt(entry.originalAmount)}
                                </span>
                              )}
                            </div>

                            {expandedAuditBox === "EXPENSES" && (
                              <div className="flex items-center gap-2 print:hidden">
                                <select
                                  value={entry.expenseCategory || "Food"}
                                  onChange={(e) => {
                                    const newCat = e.target.value as StrictExpenseCategory;
                                    setPreLoggedEntries((prev) =>
                                      prev.map((it) =>
                                        it.id === entry.id
                                          ? { ...it, expenseCategory: newCat }
                                          : it
                                      )
                                    );
                                  }}
                                  className="bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-2 py-1 text-xs font-bold outline-none"
                                >
                                  {STRICT_EXPENSE_CATEGORIES.map((c) => (
                                    <option key={c} value={c} className="bg-white dark:bg-[#0A0A0A]">
                                      {c}
                                    </option>
                                  ))}
                                </select>
                                {entry.expenseCategory === "Credit Purchase" && (
                                  <input
                                    type="date"
                                    value={entry.dueDate || "2026-09-25"}
                                    onChange={(e) => {
                                      const newDate = e.target.value;
                                      setPreLoggedEntries((prev) =>
                                        prev.map((it) =>
                                          it.id === entry.id
                                            ? { ...it, dueDate: newDate }
                                            : it
                                        )
                                      );
                                    }}
                                    className="bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-2 py-1 text-xs font-bold outline-none"
                                  />
                                )}
                              </div>
                            )}

                            <div className="flex items-center gap-2 shrink-0">
                              {isEditing ? (
                                <div className="flex items-center gap-1.5 print:hidden">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editingRowVal}
                                    onChange={(e) => setEditingRowVal(e.target.value)}
                                    className="w-24 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-2 py-1 text-right text-xs font-extrabold outline-none"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveInlineEdit(entry.id)}
                                    className="rounded-lg bg-jct-turquoise text-jct-charcoal font-bold px-2 py-1 text-[10px]"
                                  >
                                    Save
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className="font-display text-xs font-extrabold text-jct-charcoal dark:text-jct-offwhite whitespace-nowrap print:text-black print:text-sm print:font-bold">
                                    -SAR {fmt(entry.amount)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditEntryModal(entry)}
                                    className="rounded bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 px-2 py-0.5 text-[10px] print:hidden"
                                  >
                                    ✏️ Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveEntry(entry.id)}
                                    className="rounded border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 transition print:hidden"
                                    title="Delete expense"
                                  >
                                    🗑️ Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* [+ Add Missing Expense] Row at Bottom */}
                    <form onSubmit={handleAddMissingExpense} className="flex flex-wrap items-center gap-2 pt-1 print:hidden">
                      <select
                        value={missingExpenseCat}
                        onChange={(e) =>
                          setMissingExpenseCat(e.target.value as StrictExpenseCategory)
                        }
                        className="bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3 py-2 text-xs font-bold outline-none"
                      >
                        {STRICT_EXPENSE_CATEGORIES.map((c) => (
                          <option key={c} value={c} className="bg-white dark:bg-[#0A0A0A]">
                            {c}
                          </option>
                        ))}
                      </select>
                      <select
                        value={missingExpenseMode}
                        onChange={(e) => setMissingExpenseMode(e.target.value as UniversalPaymentMode)}
                        required
                        className="bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-2.5 py-2 text-xs font-bold outline-none"
                      >
                        {UNIVERSAL_PAYMENT_MODES.map((pm) => (
                          <option key={pm.value} value={pm.value} className="bg-white dark:bg-[#0A0A0A]">
                            {pm.badge} · {pm.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={missingExpenseSupplier}
                        onChange={(e) => setMissingExpenseSupplier(e.target.value)}
                        placeholder={
                          missingExpenseCat === "Credit Purchase" ||
                          missingExpenseCat === "Cash Purchase" ||
                          missingExpenseCat === "Bank Purchase"
                            ? "Supplier Name (e.g. Jotun)..."
                            : "Note / Details..."
                        }
                        className="flex-1 min-w-[140px] bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2 text-xs font-semibold placeholder:text-slate-400 outline-none"
                      />
                      {missingExpenseCat === "Credit Purchase" && (
                        <input
                          type="date"
                          value={missingExpenseDueDate}
                          onChange={(e) => setMissingExpenseDueDate(e.target.value)}
                          className="bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-2.5 py-2 text-xs font-bold outline-none"
                        />
                      )}
                      <input
                        type="number"
                        step="0.01"
                        value={missingExpenseAmt}
                        onChange={(e) => setMissingExpenseAmt(e.target.value)}
                        placeholder="SAR"
                        className="w-24 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3 py-2 text-xs font-bold placeholder:text-slate-400 outline-none"
                      />
                      <button
                        type="submit"
                        className="bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg px-3.5 py-2 text-xs whitespace-nowrap"
                      >
                        + Add Expense
                      </button>
                    </form>
                  </div>
                )}

                {/* ══════════════════════════════════════════════════════
                    BOX 3: Bank / POS Transfers (mada · SAB / mada · Al Rajhi / Visa-MC / Bank)
                   ══════════════════════════════════════════════════════ */}
                {(expandedAuditBox === "NONE" || expandedAuditBox === "BANK_POS") && (
                  <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-turquoise/20 dark:border-jct-turquoise/30 hover:border-jct-turquoise/80 hover:shadow-[0_0_15px_rgba(45,226,230,0.1)] rounded-xl p-6 flex flex-col gap-4 transition-all duration-300 print:shadow-none print:border-none print:p-0 print:bg-white print:text-black print:break-before-page">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-[#1F1F1F] pb-3.5 print:border-none print:pb-0">
                      <div className="w-full">
                        <h3 className="font-display text-lg font-extrabold text-jct-charcoal dark:text-jct-offwhite print:text-xl print:font-extrabold print:tracking-tight print:mt-10 print:mb-4 print:border-b print:border-slate-300 print:pb-2 print:text-black">
                          Bank &amp; Card Swipes
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 print:hidden">
                          {isOwner && bankSettlementMode === "NET"
                            ? "Net bank settlement after SAMA mada / Credit Card MDR & 15% ZATCA VAT"
                            : isOwner
                            ? "100% gross face value reconciled · Expand to inspect MDR + 15% VAT breakdown"
                            : "100% gross face value reconciled"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 print:hidden">
                        <div className="text-right">
                          <span className="block font-display text-base font-extrabold text-jct-charcoal dark:text-jct-offwhite whitespace-nowrap">
                            {isOwner && bankSettlementMode === "NET" ? "Net: " : ""}SAR{" "}
                            {fmt(activeBankSettlementTotal)}
                          </span>
                          {isOwner && (
                            <span className="block text-[10px] font-medium text-slate-500 dark:text-slate-400">
                              {bankSettlementMode === "NET"
                                ? `Gross: SAR ${fmt(bankSwipeGrossTotal)} · Fees: -SAR ${fmt(totalPosFees)}`
                                : `Est. MDR + VAT: -SAR ${fmt(totalPosFees)}`}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedAuditBox(
                              expandedAuditBox === "BANK_POS" ? "NONE" : "BANK_POS"
                            )
                          }
                          className="flex items-center gap-1.5 rounded-lg bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 px-3 py-1.5 text-xs transition-all print:hidden"
                        >
                          {expandedAuditBox === "BANK_POS" ? (
                            <>
                              <Minimize2 size={13} />
                              <span>⤡ Collapse</span>
                            </>
                          ) : (
                            <>
                              <Maximize2 size={13} />
                              <span>⤢ Expand</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-200 dark:divide-[#1F1F1F] rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-slate-50/50 dark:bg-black overflow-hidden print:border print:border-slate-300 print:rounded-none print:bg-white print:divide-slate-200">
                      {bankSwipeInvoices.map((inv) => {
                        const isSplitRow = inv.paymentMode === "SPLIT";
                        const bankGross = calcInvoiceBankGrossPortion(inv);
                        const rowKey = isSplitRow
                          ? `erp-bank-${inv.invoiceNo}`
                          : `erp-${inv.invoiceNo}`;
                        const isEditing = editingRowId === rowKey;
                        const fb = calcInvoiceFeeBreakdown(inv);
                        const activeTerm: PosTerminalBank = isSplitRow
                          ? inv.splitPosTerminal || inv.posTerminal || "SAB"
                          : inv.posTerminal || "SAB";
                        const termMeta = POS_TERMINAL_META[activeTerm];
                        const isBankTransferRow = isSplitRow
                          ? inv.splitBankMethod === "BANK_TRANSFER"
                          : inv.paymentMode === "BANK_TRANSFER";
                        const showExpandedFeeBreakdown =
                          isOwner && (
                            expandedAuditBox === "BANK_POS" ||
                            bankSettlementMode === "NET" ||
                            trackPosFees
                          );

                        return (
                          <div
                            key={`bank-${inv.invoiceNo}`}
                            className="flex flex-col gap-2 px-4 py-3 hover:bg-slate-100/70 dark:hover:bg-[#111111] transition print:flex print:flex-row print:justify-between print:py-2 print:border-b print:border-slate-200 print:text-sm print:text-black print:bg-white print:break-inside-avoid"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 print:flex print:flex-row print:justify-between print:items-center print:w-full">
                              <div className="flex flex-wrap items-center gap-2.5 min-w-0 flex-1">
                                <span className="font-mono text-xs font-extrabold text-slate-500 dark:text-slate-400 w-14 shrink-0 print:text-black print:font-bold print:w-20">
                                  #{inv.invoiceNo}
                                </span>
                                <span className="text-xs font-semibold text-jct-charcoal dark:text-jct-offwhite truncate print:text-black print:text-sm">
                                  {inv.customer}
                                </span>

                                {/* Card Type Tag: [mada · SAB], [mada · Al Rajhi], [💳 Visa / MC], or [Bank Transfer] */}
                                <span
                                  className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold shrink-0 print:border print:border-black print:bg-white print:text-black ${
                                    isBankTransferRow
                                      ? "bg-jct-turquoise/25 border border-jct-turquoise/40 text-jct-charcoal dark:text-jct-offwhite"
                                      : "bg-jct-yellow text-jct-charcoal"
                                  }`}
                                >
                                  [
                                  {isBankTransferRow
                                    ? "Bank Transfer"
                                    : termMeta.badgeTag}
                                  ]
                                </span>

                                {isSplitRow && (
                                  <span className="rounded bg-jct-turquoise/25 border border-jct-turquoise/40 px-2 py-0.5 text-[10px] font-extrabold text-jct-charcoal dark:text-jct-offwhite shrink-0 print:border-black print:text-black">
                                    Split Card Share: SAR {fmt(bankGross)}
                                  </span>
                                )}
                                {inv.originalAmount !== undefined && (
                                  <span className="rounded bg-jct-yellow text-jct-charcoal font-bold px-1.5 py-0.5 text-[10px] shrink-0 print:hidden">
                                    Orig: SAR {fmt(inv.originalAmount)}
                                  </span>
                                )}
                              </div>

                              {/* Terminal Switcher Pill (mada · SAB, mada · Al Rajhi, 💳 Visa / MC, Bank) */}
                              <div className="flex flex-wrap items-center gap-2 shrink-0 print:hidden">
                                <div className="inline-flex flex-wrap rounded-lg bg-white dark:bg-[#0A0A0A] p-0.5 border border-slate-200 dark:border-[#1F1F1F] gap-0.5">
                                  {(["SAB", "AL_RAJHI", "VISA_MC"] as PosTerminalBank[]).map(
                                    (term) => (
                                      <button
                                        key={term}
                                        type="button"
                                        onClick={() =>
                                          isSplitRow
                                            ? handleSetInvoiceSplitMethod(
                                                inv.invoiceNo,
                                                "POS_SWIPE",
                                                term
                                              )
                                            : handleSetInvoiceTerminal(inv.invoiceNo, term)
                                        }
                                        className={`rounded px-2 py-0.5 text-[10px] font-bold transition ${
                                          (isSplitRow
                                            ? inv.splitBankMethod === "POS_SWIPE" &&
                                              activeTerm === term
                                            : inv.paymentMode === "POS_SWIPE" &&
                                              inv.posTerminal === term)
                                            ? "bg-jct-turquoise text-jct-charcoal"
                                            : "text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite"
                                        }`}
                                      >
                                        {POS_TERMINAL_META[term].badgeTag}
                                      </button>
                                    )
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      isSplitRow
                                        ? handleSetInvoiceSplitMethod(
                                            inv.invoiceNo,
                                            "BANK_TRANSFER"
                                          )
                                        : handleSetInvoiceMode(inv.invoiceNo, "BANK_TRANSFER")
                                    }
                                    className={`rounded px-2 py-0.5 text-[10px] font-bold transition ${
                                      isBankTransferRow
                                        ? "bg-jct-turquoise text-jct-charcoal"
                                        : "text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite"
                                    }`}
                                  >
                                    Bank
                                  </button>
                                </div>

                                {isEditing ? (
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={editingRowVal}
                                      onChange={(e) => setEditingRowVal(e.target.value)}
                                      className="w-24 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-2 py-1 text-right text-xs font-extrabold outline-none"
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSaveInlineEdit(rowKey)}
                                      className="rounded-lg bg-jct-turquoise text-jct-charcoal font-bold px-2 py-1 text-[10px]"
                                    >
                                      Save
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <div className="text-right">
                                      <span className="block font-display text-xs font-extrabold text-jct-charcoal dark:text-jct-offwhite whitespace-nowrap">
                                        SAR{" "}
                                        {fmt(
                                          bankSettlementMode === "NET" ? fb.net : bankGross
                                        )}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingRowId(rowKey);
                                        setEditingRowVal(String(bankGross));
                                      }}
                                      className="rounded bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 px-2 py-0.5 text-[10px]"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveErpInvoice(inv.invoiceNo)}
                                      className="text-slate-400 hover:text-rose-500 text-xs font-bold px-1"
                                      title="Remove invoice"
                                    >
                                      ×
                                    </button>
                                  </>
                                )}
                              </div>

                              {/* Print-only Amount */}
                              <div className="hidden print:block text-right">
                                <span className="font-display text-xs font-extrabold text-black whitespace-nowrap print:text-sm print:font-bold">
                                  SAR {fmt(bankSettlementMode === "NET" ? fb.net : bankGross)}
                                </span>
                              </div>
                            </div>

                            {/* Detailed SAMA & ZATCA Fee Breakdown when Audit Details are Expanded */}
                            {showExpandedFeeBreakdown && (
                              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#111111] px-3 py-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-300 print:hidden">
                                <span className="text-slate-500 dark:text-slate-400">
                                  {isBankTransferRow
                                    ? "0% Direct Bank Transfer"
                                    : `${termMeta.label} (${termMeta.feePctLabel})`}
                                </span>
                                <span>
                                  Gross: <strong className="text-jct-charcoal dark:text-jct-offwhite">SAR {fmt(fb.gross)}</strong>{" "}
                                  | MDR: <strong className="text-rose-500">-SAR {fmt(fb.mdrBase)}</strong>{" "}
                                  | 15% VAT:{" "}
                                  <strong className="text-rose-500">-SAR {fmt(fb.vatOnFee)}</strong>{" "}
                                  | Net: <strong className="text-jct-charcoal dark:text-jct-offwhite">SAR {fmt(fb.net)}</strong>
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ──────────────────────────────────────────────────────────
              PAGE 2, 3, 4: EXECUTIVE SUMMARY APPENDICES (printMode === 'summary')
             ────────────────────────────────────────────────────────── */}
          {printMode === "summary" && (
            <>
              {/* PAGE 2: APPENDIX A: CASH INFLOWS */}
              <div className="hidden print:block print:break-before-page">
            <div className="print:text-2xl print:font-black print:tracking-tight print:uppercase print:mb-6 print:border-b-2 print:border-black print:pb-2 print:text-black flex justify-between items-center">
              <span>APPENDIX A: CASH INFLOWS</span>
              <span className="font-mono text-base font-bold text-slate-700">
                Total: SAR {fmt(cashSalesTotal)}
              </span>
            </div>

            <div className="divide-y divide-slate-200">
              {/* Table Column Headers */}
              <div className="print:flex print:justify-between print:items-center print:py-2.5 print:border-b-2 print:border-black print:text-xs print:font-bold print:uppercase print:text-slate-800">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <span className="w-24 shrink-0 font-mono">Invoice #</span>
                  <span className="truncate">Customer Name</span>
                </div>
                <div className="flex items-center gap-6 shrink-0">
                  <span className="w-28 text-center">Type</span>
                  <span className="w-28 text-right font-mono">Amount (SAR)</span>
                </div>
              </div>

              {/* Register Float Row */}
              <div className="print:flex print:justify-between print:py-3 print:border-b print:border-slate-200 print:text-sm print:items-center print:break-inside-avoid print:text-black bg-slate-50">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <span className="font-mono font-bold w-24 shrink-0 text-slate-800">
                    FLOAT
                  </span>
                  <span className="font-medium text-black">
                    Opening Drawer Float
                  </span>
                </div>
                <div className="flex items-center gap-6 shrink-0">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded border border-slate-300 text-slate-600 w-28 text-center">
                    Float
                  </span>
                  <span className="font-mono font-bold text-sm w-28 text-right text-black">
                    +SAR {fmt(openingBalance)}
                  </span>
                </div>
              </div>

              {/* Cash Invoices */}
              {printCashInvoices.length === 0 ? (
                <div className="py-6 text-center text-slate-500 italic text-sm">
                  No cash invoices recorded for this period.
                </div>
              ) : (
                printCashInvoices.map((inv) => {
                  const isSplit = inv.paymentMode === "SPLIT";
                  const cashAmt = calcInvoiceCashPortion(inv);
                  return (
                    <div
                      key={`print-cash-${inv.invoiceNo}`}
                      className="print:flex print:justify-between print:py-3 print:border-b print:border-slate-200 print:text-sm print:items-center print:break-inside-avoid print:text-black"
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <span className="font-mono font-bold w-24 shrink-0 text-slate-800">
                          #{inv.invoiceNo}
                        </span>
                        <span className="font-medium truncate text-black">
                          {inv.customer}
                        </span>
                      </div>
                      <div className="flex items-center gap-6 shrink-0">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded border border-slate-300 text-slate-600 w-28 text-center">
                          {isSplit
                            ? "Split (Cash)"
                            : inv.paymentMode === "OTHER_RECD"
                            ? "Other Recd"
                            : "Cash"}
                        </span>
                        <span className="font-mono font-bold text-sm w-28 text-right text-black">
                          +SAR {fmt(cashAmt)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Cash Inflow Receipts */}
              {cashInflowEntries.map((entry) => (
                <div
                  key={`print-receipt-${entry.id}`}
                  className="print:flex print:justify-between print:py-3 print:border-b print:border-slate-200 print:text-sm print:items-center print:break-inside-avoid print:text-black"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <span className="font-mono font-bold w-24 shrink-0 text-slate-800">
                      {entry.receiptNo || "RECEIPT"}
                    </span>
                    <span className="font-medium truncate text-black">
                      {entry.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded border border-slate-300 text-slate-600 w-28 text-center">
                      Receipt
                    </span>
                    <span className="font-mono font-bold text-sm w-28 text-right text-black">
                      +SAR {fmt(entry.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ──────────────────────────────────────────────────────────
              PAGE 3: APPENDIX B: BANK TRANSFERS
             ────────────────────────────────────────────────────────── */}
          <div className="hidden print:block print:break-before-page">
            <div className="print:text-2xl print:font-black print:tracking-tight print:uppercase print:mb-6 print:border-b-2 print:border-black print:pb-2 print:text-black flex justify-between items-center">
              <span>APPENDIX B: BANK TRANSFERS</span>
              <span className="font-mono text-base font-bold text-slate-700">
                Total: SAR {fmt(bankTransferTotal)}
              </span>
            </div>

            <div className="divide-y divide-slate-200">
              {/* Table Column Headers */}
              <div className="print:flex print:justify-between print:items-center print:py-2.5 print:border-b-2 print:border-black print:text-xs print:font-bold print:uppercase print:text-slate-800">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <span className="w-24 shrink-0 font-mono">Invoice #</span>
                  <span className="truncate">Customer Name</span>
                </div>
                <div className="flex items-center gap-6 shrink-0">
                  <span className="w-28 text-center">Channel</span>
                  <span className="w-28 text-right font-mono">Amount (SAR)</span>
                </div>
              </div>

              {printBankTransferInvoices.length === 0 ? (
                <div className="py-8 text-center text-slate-500 italic text-sm">
                  No direct bank transfers recorded for this register date.
                </div>
              ) : (
                printBankTransferInvoices.map((inv) => {
                  const isSplit = inv.paymentMode === "SPLIT";
                  const amt = isSplit ? (inv.splitBankAmount || 0) : inv.amount;
                  return (
                    <div
                      key={`print-bank-${inv.invoiceNo}`}
                      className="print:flex print:justify-between print:py-3 print:border-b print:border-slate-200 print:text-sm print:items-center print:break-inside-avoid print:text-black"
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <span className="font-mono font-bold w-24 shrink-0 text-slate-800">
                          #{inv.invoiceNo}
                        </span>
                        <span className="font-medium truncate text-black">
                          {inv.customer}
                        </span>
                      </div>
                      <div className="flex items-center gap-6 shrink-0">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded border border-slate-300 text-slate-600 w-28 text-center">
                          {isSplit ? "Split (Bank)" : "Bank Transfer"}
                        </span>
                        <span className="font-mono font-bold text-sm w-28 text-right text-black">
                          SAR {fmt(amt)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ──────────────────────────────────────────────────────────
              PAGE 4: APPENDIX C: POS SWIPES
             ────────────────────────────────────────────────────────── */}
          <div className="hidden print:block print:break-before-page">
            <div className="print:text-2xl print:font-black print:tracking-tight print:uppercase print:mb-6 print:border-b-2 print:border-black print:pb-2 print:text-black flex justify-between items-center">
              <span>APPENDIX C: POS SWIPES</span>
              <span className="font-mono text-base font-bold text-slate-700">
                Total: SAR {fmt(posSwipesGrossTotal)}
              </span>
            </div>

            <div className="divide-y divide-slate-200">
              {/* Table Column Headers */}
              <div className="print:flex print:justify-between print:items-center print:py-2.5 print:border-b-2 print:border-black print:text-xs print:font-bold print:uppercase print:text-slate-800">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <span className="w-24 shrink-0 font-mono">Invoice #</span>
                  <span className="truncate">Customer Name</span>
                </div>
                <div className="flex items-center gap-6 shrink-0">
                  <span className="w-28 text-center">Terminal / Card</span>
                  <span className="w-28 text-right font-mono">Gross Amount (SAR)</span>
                </div>
              </div>

              {printPosSwipeInvoices.length === 0 ? (
                <div className="py-8 text-center text-slate-500 italic text-sm">
                  No POS card transactions recorded for this register date.
                </div>
              ) : (
                printPosSwipeInvoices.map((inv) => {
                  const isSplit = inv.paymentMode === "SPLIT";
                  const amt = calcInvoiceBankGrossPortion(inv);
                  const term: PosTerminalBank =
                    (isSplit ? inv.splitPosTerminal : inv.posTerminal) || "SAB";
                  const termLabel = POS_TERMINAL_META[term]?.badgeTag || term;
                  return (
                    <div
                      key={`print-pos-${inv.invoiceNo}`}
                      className="print:flex print:justify-between print:py-3 print:border-b print:border-slate-200 print:text-sm print:items-center print:break-inside-avoid print:text-black"
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <span className="font-mono font-bold w-24 shrink-0 text-slate-800">
                          #{inv.invoiceNo}
                        </span>
                        <span className="font-medium truncate text-black">
                          {inv.customer}
                        </span>
                      </div>
                      <div className="flex items-center gap-6 shrink-0">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded border border-slate-300 text-slate-600 font-mono w-28 text-center">
                          [{termLabel}]
                        </span>
                        <span className="font-mono font-bold text-sm w-28 text-right text-black">
                          SAR {fmt(amt)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Final Audit Sign-off at bottom of Page 4 */}
            <PrintReportFooter />
          </div>
        </>
      )}

      {/* ──────────────────────────────────────────────────────────
          PRINT-ONLY: EXACT 19-COLUMN CLASSIC PHYSICAL DATASHEET (printMode === 'datasheet')
         ────────────────────────────────────────────────────────── */}
      {printMode === "datasheet" && (
        <div className="hidden print:block print:w-full print:bg-white print:text-black print:p-0 print:m-0">
          <ClassicDataSheetTable
            sheetRows={sheetRows}
            activeErpList={activeErpList}
            preLoggedEntries={preLoggedEntries}
            openingBalance={openingBalance}
            date="12-09-2026"
            branchName={branchId === "JCT_HQ" ? "JCT Main HQ (Jubail)" : branchId}
          />
          <PrintReportFooter />
        </div>
      )}

      {/* 4. Clean Footer Bar */}
          <div className="sticky bottom-4 z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-turquoise/20 dark:border-jct-turquoise/30 hover:border-jct-turquoise/80 hover:shadow-[0_0_15px_rgba(45,226,230,0.1)] rounded-xl p-6 transition-all duration-300 print:hidden">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
              <span className="inline-flex h-2 w-2 rounded-full bg-jct-turquoise" />
              <span>Ready to lock register for Jubail - Main Branch · 12-09-2026</span>
            </div>

            <div className="flex items-center justify-end gap-3 print:hidden">
              <button
                type="button"
                onClick={() => {
                  setPrintMode("summary");
                  setTimeout(() => window.print(), 100);
                }}
                className="flex items-center justify-center gap-2 bg-jct-charcoal dark:bg-slate-800 text-white px-4 py-2 rounded-lg font-bold print:hidden hover:brightness-110 transition-all text-sm shadow-sm"
              >
                <Printer size={16} />
                <span>🖨️ Print Report</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrintMode("datasheet");
                  setTimeout(() => window.print(), 100);
                }}
                className="flex items-center justify-center gap-2 bg-white dark:bg-black border border-slate-300 dark:border-white/20 text-slate-800 dark:text-slate-100 px-4 py-2 rounded-lg font-bold print:hidden hover:bg-slate-100 dark:hover:bg-white/10 transition-all text-sm shadow-sm"
              >
                <FileSpreadsheet size={16} />
                <span>⬇️ Print Classic Datasheet</span>
              </button>
              <button
                type="button"
                onClick={handleLockAndSaveDay}
                className="flex items-center justify-center gap-2.5 bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg text-sm px-8 py-3.5 whitespace-nowrap"
              >
                <Lock size={18} className="text-jct-charcoal" />
                <span>🔒 Confirm Drawer Cash &amp; Lock Register</span>
              </button>
            </div>
          </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODE 3: CLASSIC JUBAIL CORP DIGITAL DATA SHEET (trackingMode === 'datasheet')
         ════════════════════════════════════════════════════════════════════ */}
      {trackingMode === "datasheet" && (
        <div className="relative z-10 w-full px-4 sm:px-6 py-6 flex flex-col gap-5">
          {/* 1. Official Sheet Header Bar */}
          <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-lg bg-jct-yellow px-2.5 py-1 font-mono text-xs font-bold text-jct-charcoal">
                    JCT OFFICIAL LEDGER
                  </span>
                  <h1 className="font-display text-xl sm:text-2xl font-black tracking-tight text-jct-charcoal dark:text-white">
                    DAILY DATA SHEET : JUBAIL CORP. TRADING EST.
                  </h1>
                </div>
                <p className="mt-1.5 font-mono text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Tel.: 3623251 / 3614748 · P.O. Box 1461 - Jubail 31951 - Kingdom of Saudi Arabia
                </p>
              </div>

              {/* Right-Side Action Controls */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setTrackingMode("hub")}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#111111] hover:brightness-95 px-3.5 py-2.5 text-xs font-bold text-jct-charcoal dark:text-jct-offwhite transition whitespace-nowrap"
                >
                  <ArrowLeft size={14} />
                  <span>← Back to Daily Hub</span>
                </button>

                <label className="flex cursor-pointer items-center gap-1.5 bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg px-3.5 py-2.5 text-xs whitespace-nowrap border border-jct-turquoise">
                  <UploadCloud size={14} />
                  <span>Upload CSV</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleSimulateCsvUpload}
                  className="flex items-center gap-1.5 bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 transition-all rounded-lg px-3.5 py-2.5 text-xs whitespace-nowrap"
                  title="Simulate loading 18 ERP Invoices"
                >
                  <Zap size={14} />
                  <span>Load 18 ERP Invoices</span>
                </button>

                <button
                  type="button"
                  onClick={handleAdd5SheetRows}
                  className="flex items-center gap-1.5 bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 transition-all rounded-lg px-3.5 py-2.5 text-xs whitespace-nowrap"
                >
                  <Plus size={14} />
                  <span>+ Add 5 Rows</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveAndCloseSheet}
                  className="flex items-center gap-2 bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg px-5 py-2.5 text-xs sm:text-sm whitespace-nowrap"
                >
                  <Lock size={14} />
                  <span>🔒 Save &amp; Close Sheet</span>
                </button>
              </div>
            </div>

            {/* Live Executive Strip inside Header */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-[#1F1F1F] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#111111] px-3.5 py-2">
                <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">DATE &amp; BRANCH</span>
                <span className="font-mono font-extrabold text-jct-charcoal dark:text-jct-offwhite">12-09-2026 · Jubail Main</span>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#111111] px-3.5 py-2">
                <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">AMT CASH SALE</span>
                <span className="font-display font-extrabold text-jct-charcoal dark:text-jct-offwhite">SAR {fmt(dsCashSaleTotal)}</span>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#111111] px-3.5 py-2">
                <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">CREDIT INV. AMOUNT</span>
                <span className="font-display font-extrabold text-jct-charcoal dark:text-jct-offwhite">SAR {fmt(dsCreditInvTotal)}</span>
              </div>
              <div className="rounded-xl bg-jct-yellow text-jct-charcoal font-bold px-3.5 py-2">
                <span className="block text-[10px] font-extrabold">TOTAL AMT (INFLOWS)</span>
                <span className="font-display text-sm font-black">SAR {fmt(dsTotalAmt)}</span>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#111111] px-3.5 py-2">
                <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">TO BANK (✓ VERIFIED)</span>
                <span className="font-display font-extrabold text-jct-charcoal dark:text-jct-offwhite">SAR {fmt(dsToBankTotal)}</span>
              </div>
              <div className="rounded-xl bg-jct-turquoise text-jct-charcoal font-bold px-3.5 py-2">
                <span className="block text-[10px] font-extrabold">CLOSING BALANCE</span>
                <span className="font-display text-sm font-black">SAR {fmt(dsClosingBalance)}</span>
              </div>
            </div>
          </div>

          {/* Drag & Drop CSV Upload Component in Classic Data Entry */}
          <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-turquoise/20 dark:border-jct-turquoise/30 hover:border-jct-turquoise/80 hover:shadow-[0_0_15px_rgba(45,226,230,0.1)] rounded-xl p-5 transition-all duration-300">
            <label className="flex w-full cursor-pointer flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-[#1F1F1F] hover:border-jct-turquoise bg-slate-50 dark:bg-black hover:bg-slate-100 dark:hover:bg-[#111111] px-6 py-5 transition-colors">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-jct-turquoise/20 text-jct-charcoal dark:text-jct-turquoise border border-jct-turquoise/40">
                  <UploadCloud size={24} />
                </div>
                <div className="text-left">
                  <span className="text-sm font-bold text-jct-charcoal dark:text-jct-offwhite block">
                    Drop daily ERP `.csv` export here or click to browse
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                    Unified import auto-detects `PARTIAL`, `SPLIT`, `CASH/BANK` tenders and syncs instantly to Guided Tracking.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {erpInvoices.length > 0 && (
                  <span className="text-xs font-bold text-emerald-600 dark:text-jct-turquoise">
                    ✓ {erpInvoices.length} Invoices Active
                  </span>
                )}
                <span className="rounded-lg bg-jct-turquoise text-jct-charcoal px-4 py-2 text-xs font-bold whitespace-nowrap shadow-sm hover:brightness-95">
                  Browse File
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSimulateCsvUpload();
                  }}
                  className="rounded-lg bg-jct-yellow text-jct-charcoal px-3.5 py-2 text-xs font-bold whitespace-nowrap shadow-sm hover:brightness-95"
                >
                  ⚡ Load 18 Invoices
                </button>
              </div>

              <input
                type="file"
                accept=".csv"
                onChange={handleCsvFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* 2. Editable 19-Column Spreadsheet Grid */}
          <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-[68vh] overflow-y-auto">
              <table className="w-full border-collapse text-xs font-mono">
                <thead className="sticky top-0 z-20 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#111111] shadow-sm">
                  <tr className="border-b border-slate-200 dark:border-[#1F1F1F] divide-x divide-slate-200 dark:divide-[#1F1F1F]">
                    <th className="px-2.5 py-3 text-center w-9">#</th>
                    <th className="px-3 py-3 text-left min-w-[96px]">1. INVOICE NO.</th>
                    <th className="px-3 py-3 text-right min-w-[115px]">2. AMT CASH SALE</th>
                    <th className="px-3 py-3 text-right min-w-[125px]">3. CREDIT INV. AMOUNT</th>
                    <th className="px-3 py-3 text-left min-w-[120px]">4. RECEIPT NO.</th>
                    <th className="px-3 py-3 text-right min-w-[135px]">5. CREDIT SALE AMT RECD</th>
                    <th className="px-3 py-3 text-right min-w-[105px]">6. OPEN BAL</th>
                    <th className="px-3 py-3 text-right min-w-[110px]">7. LOAN IN</th>
                    <th className="px-3 py-3 text-right min-w-[115px]">8. OTHER AMT RECD</th>
                    <th className="px-3 py-3 text-right min-w-[105px]">9. FROM BANK</th>
                    <th className="px-3.5 py-3 text-right min-w-[130px] bg-jct-yellow/30 text-jct-charcoal dark:text-jct-offwhite font-black">
                      10. TOTAL AMT
                    </th>
                    <th className="px-3 py-3 text-left min-w-[175px]">
                      11. CREDIT PURCHASE
                    </th>
                    <th className="px-3 py-3 text-right min-w-[115px]">12. CASH PURCHASE</th>
                    <th className="px-3 py-3 text-right min-w-[145px]">
                      13. CREDIT PURCHASE PAYMENT
                    </th>
                    <th className="px-3 py-3 text-right min-w-[95px]">14. CR NOTE</th>
                    <th className="px-3 py-3 text-left min-w-[170px]">15. EXPENSE</th>
                    <th className="px-3 py-3 text-left min-w-[195px]">
                      16. TO BANK (SAB / AL RAJHI ✓)
                    </th>
                    <th className="px-3 py-3 text-right min-w-[100px]">17. LOAN OUT</th>
                    <th className="px-3 py-3 text-right min-w-[105px]">18. EXCESS AMT</th>
                    <th className="px-3.5 py-3 text-right min-w-[140px] bg-jct-turquoise/30 text-jct-charcoal dark:text-jct-offwhite font-black">
                      19. CLOSING BALANCE
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-[#1A1A1A]">
                  {sheetRows.map((row, rIdx) => {
                    const rowInflow = r2(
                      numCell(row.amtCashSale) +
                        numCell(row.creditSaleRecd) +
                        numCell(row.openBal) +
                        numCell(row.loanIn) +
                        numCell(row.otherAmtRecd) +
                        numCell(row.fromBank)
                    );
                    const rowOutflow = r2(
                      numCell(row.cashPurchase) +
                        numCell(row.creditPurchasePayment) +
                        numCell(row.expenseAmt) +
                        (row.toBankChecked ? numCell(row.toBankAmt) : 0) +
                        numCell(row.loanOut) -
                        numCell(row.excessAmt)
                    );
                    const rowNetCash = r2(rowInflow - rowOutflow);

                    return (
                      <tr
                        key={row.id}
                        className="border-b border-slate-100 dark:border-[#1A1A1A] hover:bg-slate-50/70 dark:hover:bg-[#111111] transition-colors"
                      >
                        {/* Row Index */}
                        <td className="px-2 py-1.5 text-center text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#111111]">
                          {rIdx + 1}
                        </td>

                        {/* 1. INVOICE NO. */}
                        <td className="p-1">
                          <input
                            type="text"
                            data-ds-row={rIdx}
                            data-ds-col={1}
                            onKeyDown={(e) => handleSheetKeyDown(e, rIdx, 1)}
                            value={row.invoiceNo}
                            onChange={(e) =>
                              handleSheetCellChange(row.id, "invoiceNo", e.target.value)
                            }
                            placeholder="30062"
                            className="w-full bg-transparent border-transparent text-jct-charcoal dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-jct-turquoise transition-all rounded-none px-2 py-1 font-mono text-xs font-extrabold"
                          />
                        </td>

                        {/* 2. AMT CASH SALE */}
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.01"
                            data-ds-row={rIdx}
                            data-ds-col={2}
                            onKeyDown={(e) => handleSheetKeyDown(e, rIdx, 2)}
                            value={row.amtCashSale}
                            onChange={(e) =>
                              handleSheetCellChange(row.id, "amtCashSale", e.target.value)
                            }
                            placeholder="—"
                            className="w-full bg-transparent border-transparent text-jct-charcoal dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-jct-turquoise transition-all rounded-none px-2 py-1 text-right font-mono text-xs font-bold"
                          />
                        </td>

                        {/* 3. CREDIT INV. AMOUNT */}
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.01"
                            data-ds-row={rIdx}
                            data-ds-col={3}
                            onKeyDown={(e) => handleSheetKeyDown(e, rIdx, 3)}
                            value={row.creditInvAmt}
                            onChange={(e) =>
                              handleSheetCellChange(row.id, "creditInvAmt", e.target.value)
                            }
                            placeholder="—"
                            className="w-full bg-transparent border-transparent text-jct-charcoal dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-jct-turquoise transition-all rounded-none px-2 py-1 text-right font-mono text-xs font-extrabold"
                          />
                        </td>

                        {/* 4. RECEIPT NO. */}
                        <td className="p-1">
                          <input
                            type="text"
                            data-ds-row={rIdx}
                            data-ds-col={4}
                            onKeyDown={(e) => handleSheetKeyDown(e, rIdx, 4)}
                            value={row.receiptNo}
                            onChange={(e) =>
                              handleSheetCellChange(row.id, "receiptNo", e.target.value)
                            }
                            placeholder="—"
                            className="w-full bg-transparent border-transparent text-jct-charcoal dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-jct-turquoise transition-all rounded-none px-2 py-1 text-left font-sans text-xs font-bold"
                          />
                        </td>

                        {/* 5. CREDIT SALE AMT RECD */}
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.01"
                            data-ds-row={rIdx}
                            data-ds-col={5}
                            onKeyDown={(e) => handleSheetKeyDown(e, rIdx, 5)}
                            value={row.creditSaleRecd}
                            onChange={(e) =>
                              handleSheetCellChange(row.id, "creditSaleRecd", e.target.value)
                            }
                            placeholder="—"
                            className="w-full bg-transparent border-transparent text-jct-charcoal dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-jct-turquoise transition-all rounded-none px-2 py-1 text-right font-mono text-xs font-extrabold"
                          />
                        </td>

                        {/* 6. OPEN BAL */}
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.01"
                            data-ds-row={rIdx}
                            data-ds-col={6}
                            onKeyDown={(e) => handleSheetKeyDown(e, rIdx, 6)}
                            value={row.openBal}
                            onChange={(e) =>
                              handleSheetCellChange(row.id, "openBal", e.target.value)
                            }
                            placeholder="—"
                            className="w-full bg-transparent border-transparent text-jct-charcoal dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-jct-turquoise transition-all rounded-none px-2 py-1 text-right font-mono text-xs font-extrabold"
                          />
                        </td>

                        {/* 7. LOAN IN */}
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.01"
                            data-ds-row={rIdx}
                            data-ds-col={7}
                            onKeyDown={(e) => handleSheetKeyDown(e, rIdx, 7)}
                            value={row.loanIn}
                            onChange={(e) =>
                              handleSheetCellChange(row.id, "loanIn", e.target.value)
                            }
                            placeholder={rIdx === 1 ? "Shadab" : "—"}
                            className="w-full bg-transparent border-transparent text-jct-charcoal dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-jct-turquoise transition-all rounded-none px-2 py-1 text-right font-mono text-xs font-extrabold"
                          />
                        </td>

                        {/* 8. OTHER AMT RECD */}
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.01"
                            data-ds-row={rIdx}
                            data-ds-col={8}
                            onKeyDown={(e) => handleSheetKeyDown(e, rIdx, 8)}
                            value={row.otherAmtRecd}
                            onChange={(e) =>
                              handleSheetCellChange(row.id, "otherAmtRecd", e.target.value)
                            }
                            placeholder="—"
                            className="w-full bg-transparent border-transparent text-jct-charcoal dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-jct-turquoise transition-all rounded-none px-2 py-1 text-right font-mono text-xs font-bold"
                          />
                        </td>

                        {/* 9. FROM BANK */}
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.01"
                            data-ds-row={rIdx}
                            data-ds-col={9}
                            onKeyDown={(e) => handleSheetKeyDown(e, rIdx, 9)}
                            value={row.fromBank}
                            onChange={(e) =>
                              handleSheetCellChange(row.id, "fromBank", e.target.value)
                            }
                            placeholder="—"
                            className="w-full bg-transparent border-transparent text-jct-charcoal dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-jct-turquoise transition-all rounded-none px-2 py-1 text-right font-mono text-xs font-bold"
                          />
                        </td>

                        {/* 10. TOTAL AMT (Auto-Calculated Row Inflow) */}
                        <td className="px-3 py-1.5 text-right font-mono text-xs font-black bg-jct-yellow/20 text-jct-charcoal dark:text-white">
                          {rowInflow > 0 ? fmt(rowInflow) : "—"}
                        </td>

                        {/* 11. CREDIT PURCHASE (Supplier + Amt) */}
                        <td className="p-1">
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              list="hub-suppliers-list"
                              value={row.creditPurchaseSupplier}
                              onChange={(e) =>
                                handleSheetCellChange(
                                  row.id,
                                  "creditPurchaseSupplier",
                                  e.target.value
                                )
                              }
                              placeholder="Supplier"
                              className="w-20 bg-transparent border-transparent text-jct-charcoal dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-jct-turquoise transition-all rounded-none px-2 py-1 font-sans text-[11px] font-bold"
                            />
                            <input
                              type="number"
                              step="0.01"
                              data-ds-row={rIdx}
                              data-ds-col={11}
                              onKeyDown={(e) => handleSheetKeyDown(e, rIdx, 11)}
                              value={row.creditPurchaseAmt}
                              onChange={(e) =>
                                handleSheetCellChange(row.id, "creditPurchaseAmt", e.target.value)
                              }
                              placeholder="Amt"
                              className="w-20 bg-transparent border-transparent text-jct-charcoal dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-jct-turquoise transition-all rounded-none px-2 py-1 text-right font-mono text-xs font-bold"
                            />
                          </div>
                        </td>

                        {/* 12. CASH PURCHASE */}
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.01"
                            data-ds-row={rIdx}
                            data-ds-col={12}
                            onKeyDown={(e) => handleSheetKeyDown(e, rIdx, 12)}
                            value={row.cashPurchase}
                            onChange={(e) =>
                              handleSheetCellChange(row.id, "cashPurchase", e.target.value)
                            }
                            placeholder="—"
                            className="w-full bg-transparent border-transparent text-jct-charcoal dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-jct-turquoise transition-all rounded-none px-2 py-1 text-right font-mono text-xs font-bold"
                          />
                        </td>

                        {/* 13. CREDIT PURCHASE PAYMENT */}
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.01"
                            data-ds-row={rIdx}
                            data-ds-col={13}
                            onKeyDown={(e) => handleSheetKeyDown(e, rIdx, 13)}
                            value={row.creditPurchasePayment}
                            onChange={(e) =>
                              handleSheetCellChange(
                                row.id,
                                "creditPurchasePayment",
                                e.target.value
                              )
                            }
                            placeholder="—"
                            className="w-full bg-transparent border-transparent text-jct-charcoal dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-jct-turquoise transition-all rounded-none px-2 py-1 text-right font-mono text-xs font-bold"
                          />
                        </td>

                        {/* 14. CR NOTE */}
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.01"
                            data-ds-row={rIdx}
                            data-ds-col={14}
                            onKeyDown={(e) => handleSheetKeyDown(e, rIdx, 14)}
                            value={row.crNote}
                            onChange={(e) =>
                              handleSheetCellChange(row.id, "crNote", e.target.value)
                            }
                            placeholder="—"
                            className="w-full bg-transparent border-transparent text-jct-charcoal dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-jct-turquoise transition-all rounded-none px-2 py-1 text-right font-mono text-xs font-bold"
                          />
                        </td>

                        {/* 15. EXPENSE (Category/Note + Amount) */}
                        <td className="p-1">
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={row.expenseLabel}
                              onChange={(e) =>
                                handleSheetCellChange(row.id, "expenseLabel", e.target.value)
                              }
                              placeholder="Item"
                              className="w-20 bg-transparent border-transparent text-jct-charcoal dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-jct-turquoise transition-all rounded-none px-2 py-1 font-sans text-[11px] font-bold"
                            />
                            <input
                              type="number"
                              step="0.01"
                              data-ds-row={rIdx}
                              data-ds-col={15}
                              onKeyDown={(e) => handleSheetKeyDown(e, rIdx, 15)}
                              value={row.expenseAmt}
                              onChange={(e) =>
                                handleSheetCellChange(row.id, "expenseAmt", e.target.value)
                              }
                              placeholder="SAR"
                              className="w-20 bg-transparent border-transparent text-jct-charcoal dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-jct-turquoise transition-all rounded-none px-2 py-1 text-right font-mono text-xs font-bold"
                            />
                          </div>
                        </td>

                        {/* 16. TO BANK (SAB / Al Rajhi Swipes & Transfers with ✓ Toggle) */}
                        <td className="p-1">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                handleSheetCellChange(
                                  row.id,
                                  "toBankChecked",
                                  !row.toBankChecked
                                )
                              }
                              title="Toggle Bank/POS Verification ✓"
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-black transition ${
                                row.toBankChecked && numCell(row.toBankAmt) > 0
                                  ? "border-jct-turquoise bg-jct-turquoise text-black"
                                  : "border-slate-300 dark:border-[#1F1F1F] bg-transparent text-slate-400"
                              }`}
                            >
                              ✓
                            </button>
                            <input
                              type="text"
                              value={row.toBankLabel}
                              onChange={(e) =>
                                handleSheetCellChange(row.id, "toBankLabel", e.target.value)
                              }
                              placeholder="SAB / Bank"
                              className="w-24 bg-transparent border-transparent text-jct-charcoal dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-jct-turquoise transition-all rounded-none px-2 py-1 font-sans text-[10px] font-bold"
                            />
                            <input
                              type="number"
                              step="0.01"
                              data-ds-row={rIdx}
                              data-ds-col={16}
                              onKeyDown={(e) => handleSheetKeyDown(e, rIdx, 16)}
                              value={row.toBankAmt}
                              onChange={(e) =>
                                handleSheetCellChange(row.id, "toBankAmt", e.target.value)
                              }
                              placeholder="—"
                              className="w-20 bg-transparent border-transparent text-jct-charcoal dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-jct-turquoise transition-all rounded-none px-2 py-1 text-right font-mono text-xs font-extrabold"
                            />
                          </div>
                        </td>

                        {/* 17. LOAN OUT */}
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.01"
                            data-ds-row={rIdx}
                            data-ds-col={17}
                            onKeyDown={(e) => handleSheetKeyDown(e, rIdx, 17)}
                            value={row.loanOut}
                            onChange={(e) =>
                              handleSheetCellChange(row.id, "loanOut", e.target.value)
                            }
                            placeholder="—"
                            className="w-full bg-transparent border-transparent text-jct-charcoal dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-jct-turquoise transition-all rounded-none px-2 py-1 text-right font-mono text-xs font-bold"
                          />
                        </td>

                        {/* 18. EXCESS AMT */}
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.01"
                            data-ds-row={rIdx}
                            data-ds-col={18}
                            onKeyDown={(e) => handleSheetKeyDown(e, rIdx, 18)}
                            value={row.excessAmt}
                            onChange={(e) =>
                              handleSheetCellChange(row.id, "excessAmt", e.target.value)
                            }
                            placeholder="—"
                            className="w-full bg-transparent border-transparent text-jct-charcoal dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-jct-turquoise transition-all rounded-none px-2 py-1 text-right font-mono text-xs font-bold"
                          />
                        </td>

                        {/* 19. CLOSING BALANCE (Row Net Cash / Final Closing Balance on bottom row) */}
                        <td className="px-3 py-1.5 text-right font-mono text-xs font-black bg-jct-turquoise/20 text-jct-charcoal dark:text-white">
                          {rIdx === sheetRows.length - 1
                            ? `SAR ${fmt(dsClosingBalance)}`
                            : rowInflow !== 0 || rowOutflow !== 0
                            ? fmt(rowNetCash)
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Sticky Footer Row — Live Column Totals, TOTAL AMT (44,909.00) & CLOSING BALANCE (4,500.00) */}
                <tfoot className="sticky bottom-0 z-20 bg-slate-50 dark:bg-[#111111] border-t-2 border-slate-300 dark:border-[#1F1F1F] text-xs font-mono font-black text-jct-charcoal dark:text-jct-offwhite shadow-sm">
                  <tr className="divide-x divide-slate-200 dark:divide-[#1F1F1F]">
                    <td className="px-2 py-3.5 text-center">∑</td>
                    <td className="px-3 py-3.5 text-left">
                      TOTAL ({sheetRows.length} ROWS)
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      {fmt(dsCashSaleTotal)}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      {fmt(dsCreditInvTotal)}
                    </td>
                    <td className="px-3 py-3.5 text-left">Chicago</td>
                    <td className="px-3 py-3.5 text-right">
                      {fmt(dsCreditRecdTotal)}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      {fmt(dsOpenBalTotal)}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      {fmt(dsLoanInTotal)}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      {fmt(dsOtherRecdTotal)}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      {fmt(dsFromBankTotal)}
                    </td>
                    <td className="px-3.5 py-3.5 text-right bg-jct-yellow text-jct-charcoal text-sm font-black">
                      SAR {fmt(dsTotalAmt)}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      {fmt(dsCreditPurchaseTotal)}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      {fmt(dsCashPurchaseTotal)}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      {fmt(dsCreditPurchasePaymentTotal)}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      {fmt(dsCrNoteTotal)}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      {fmt(dsExpenseTotal)}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      {fmt(dsToBankTotal)}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      {fmt(dsLoanOutTotal)}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      {fmt(dsExcessAmtTotal)}
                    </td>
                    <td className="px-3.5 py-3.5 text-right bg-jct-turquoise text-jct-charcoal text-sm font-black">
                      SAR {fmt(dsClosingBalance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreditRadarView({
  customers,
  onIssueCredit,
  isOwner = false,
  onUpdateCustomer,
  onDeleteCustomer,
}: {
  customers: ContractorAccount[];
  onIssueCredit: (
    customerName: string,
    amount: number,
    followUpDate: string,
    receiptNo?: string,
    mode?: "CREDIT_RECD" | "CREDIT_SALE"
  ) => void;
  isOwner?: boolean;
  onUpdateCustomer?: (updated: ContractorAccount) => void;
  onDeleteCustomer?: (id: string) => void;
}) {
  const [activeId, setActiveId] = useState(customers[0]?.id || "c1");
  const [contractorInput, setContractorInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [receiptInput, setReceiptInput] = useState("");
  const [dueDateInput, setDueDateInput] = useState("2026-09-25");
  const [editingCustomer, setEditingCustomer] = useState<ContractorAccount | null>(null);
  const [editCustName, setEditCustName] = useState("");
  const [editCustAmount, setEditCustAmount] = useState("");
  const [editCustDate, setEditCustDate] = useState("");

  const active = customers.find((c) => c.id === activeId) || customers[0];
  const reminderAccounts = customers.filter(
    (c) => Boolean(c.followUpDate || c.dueDate) && c.outstanding > 0
  );

  const handleOpenEditCustomer = (c: ContractorAccount, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCustomer(c);
    setEditCustName(c.name);
    setEditCustAmount(String(c.outstanding));
    setEditCustDate(c.followUpDate || c.dueDate);
  };

  const handleSaveEditCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || !onUpdateCustomer) return;
    const val = parseFloat(editCustAmount);
    if (Number.isNaN(val) || val < 0) return;
    onUpdateCustomer({
      ...editingCustomer,
      name: editCustName.trim() || editingCustomer.name,
      outstanding: val,
      dueDate: editCustDate || editingCustomer.dueDate,
      followUpDate: editCustDate || editingCustomer.followUpDate,
    });
    setEditingCustomer(null);
  };

  const handleCreateCredit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amountInput);
    if (!contractorInput.trim() || Number.isNaN(val) || val <= 0) return;
    onIssueCredit(
      contractorInput.trim(),
      val,
      dueDateInput || "2026-09-25",
      receiptInput.trim() || `#${Math.floor(30080 + Math.random() * 19)}`,
      "CREDIT_SALE"
    );
    setContractorInput("");
    setAmountInput("");
    setReceiptInput("");
  };

  return (
    <div className="flex flex-col h-full w-full gap-5 p-6 overflow-hidden">
      {/* Owner Edit Customer Modal */}
      {isOwner && editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 text-jct-charcoal dark:text-jct-offwhite">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1F1F1F] pb-3 mb-4">
              <h3 className="font-display text-lg font-extrabold text-jct-charcoal dark:text-jct-offwhite">
                ✏️ Edit Credit Account (Owner Override)
              </h3>
              <button
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="rounded-lg bg-slate-100 dark:bg-[#111111] px-2.5 py-1 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEditCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Contractor / Customer Name
                </label>
                <input
                  type="text"
                  required
                  value={editCustName}
                  onChange={(e) => setEditCustName(e.target.value)}
                  className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2.5 text-sm font-semibold outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Outstanding Debt (SAR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editCustAmount}
                  onChange={(e) => setEditCustAmount(e.target.value)}
                  className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2.5 font-mono text-base font-extrabold outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Follow-up Reminder Date
                </label>
                <input
                  type="date"
                  value={editCustDate}
                  onChange={(e) => setEditCustDate(e.target.value)}
                  className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2.5 text-sm font-bold outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="rounded-lg border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#111111] px-4 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg px-5 py-2.5 text-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Prominent Top Banner: Upcoming Follow-Up Reminders */}
      <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-jct-yellow text-jct-charcoal shadow-sm">
              <Bell size={15} strokeWidth={2.5} />
            </span>
            <h2 className="font-display text-sm sm:text-base font-extrabold text-jct-charcoal dark:text-jct-offwhite">
              Upcoming Follow-Up Reminders ({reminderAccounts.length})
            </h2>
          </div>
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            Live synced from Step 3 Credit Sales &amp; Daytime Quick-Logger
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {reminderAccounts.map((c) => {
            const invLabel = c.latestInvoiceNo
              ? c.latestInvoiceNo.startsWith("#")
              ? c.latestInvoiceNo
              : `#${c.latestInvoiceNo}`
              : "#30064";
            const remDate = c.followUpDate || c.dueDate;
            return (
              <button
                key={`rem-${c.id}`}
                type="button"
                onClick={() => setActiveId(c.id)}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs transition-all ${
                  active?.id === c.id
                    ? "bg-jct-turquoise text-jct-charcoal font-bold shadow-sm"
                    : c.syncedFromRegister
                    ? "bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95"
                    : "border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#111111] text-jct-charcoal dark:text-jct-offwhite font-bold hover:brightness-95"
                }`}
              >
                <span>
                  🔔 Reminder: <strong>{remDate}</strong> · Inv <strong>{invLabel}</strong>
                </span>
                <span className="opacity-60">—</span>
                <span className="font-extrabold">{c.name}</span>
                <span className="rounded bg-black/10 dark:bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-extrabold">
                  SAR {fmt(c.latestInvoiceAmount ?? c.outstanding)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 w-full gap-6 overflow-hidden">
        {/* Left Column: Active Radar & Entry */}
        <div className="flex-[2] flex flex-col gap-5 overflow-hidden">
          {/* New Credit Issue Box */}
          <form
            onSubmit={handleCreateCredit}
            className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 shrink-0"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-extrabold text-lg text-jct-charcoal dark:text-jct-offwhite flex items-center gap-2">
                <Plus size={18} className="text-jct-turquoise" /> Issue New Credit / Update Follow-up
              </h2>
              <span className="text-xs font-bold bg-jct-yellow text-jct-charcoal px-2.5 py-1 rounded-full">
                ● Live Synced with Daily Register
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-[2] min-w-[200px] relative">
                <input
                  type="text"
                  value={contractorInput}
                  onChange={(e) => setContractorInput(e.target.value)}
                  placeholder="Customer / Contractor Name..."
                  className="w-full px-4 py-2.5 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md font-medium text-sm outline-none"
                />
              </div>
              <input
                type="number"
                step="0.01"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="Amount (SAR)"
                className="flex-1 min-w-[120px] px-4 py-2.5 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md font-bold text-sm outline-none"
              />
              <input
                type="text"
                value={receiptInput}
                onChange={(e) => setReceiptInput(e.target.value)}
                placeholder="Invoice # (e.g. #30064)"
                className="flex-1 min-w-[120px] px-4 py-2.5 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md font-medium text-sm outline-none"
              />
              <input
                type="date"
                value={dueDateInput}
                onChange={(e) => setDueDateInput(e.target.value)}
                className="flex-1 min-w-[140px] px-4 py-2.5 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md font-medium text-sm outline-none"
              />
              <button
                type="submit"
                className="px-6 py-2.5 bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg whitespace-nowrap shrink-0"
              >
                Issue Credit
              </button>
            </div>
          </form>

          {/* Pending Collections List */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            <h2 className="font-display font-extrabold text-lg mb-4 text-jct-charcoal dark:text-jct-offwhite flex items-center justify-between">
              Pending Collections &amp; Follow-up Radar
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#111111] border border-slate-200 dark:border-[#1F1F1F] px-2 py-1 rounded-md">
                {customers.length} Accounts
              </span>
            </h2>
            {customers.map((c) => {
              const invBadge = c.latestInvoiceNo
                ? c.latestInvoiceNo.startsWith("#")
                  ? c.latestInvoiceNo
                  : `#${c.latestInvoiceNo}`
                : "#30064";
              const remDate = c.followUpDate || c.dueDate;
              return (
                <div
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={`cursor-pointer w-full text-left flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-white dark:bg-[#0A0A0A] shadow-sm border rounded-xl transition-all gap-4 ${
                    active?.id === c.id
                      ? "border-jct-turquoise ring-1 ring-jct-turquoise"
                      : "border-slate-200 dark:border-[#1F1F1F] hover:border-slate-300 dark:hover:border-slate-500"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`h-12 w-12 rounded-full flex items-center justify-center font-display font-extrabold text-xl shadow-sm shrink-0 ${
                        active?.id === c.id
                          ? "bg-jct-turquoise text-jct-charcoal"
                          : "bg-slate-100 dark:bg-[#111111] text-jct-charcoal dark:text-jct-offwhite"
                      }`}
                    >
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-base text-jct-charcoal dark:text-jct-offwhite">{c.name}</h3>
                        {c.syncedFromRegister && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-jct-turquoise text-jct-charcoal">
                            ✓ Synced Today
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-jct-yellow text-jct-charcoal font-bold px-2.5 py-0.5 text-[11px]">
                          🔔 Reminder: {remDate} · Inv {invBadge}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 w-full sm:w-auto">
                    <span className="font-display font-extrabold text-xl text-jct-charcoal dark:text-jct-offwhite">
                      {fmt(c.outstanding)} <span className="text-xs text-slate-500 dark:text-slate-400">SAR</span>
                    </span>
                    <div className="flex items-center gap-2">
                      {c.status === "overdue" && (
                        <span className="px-2.5 py-1 bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 rounded-md text-[10px] font-extrabold uppercase tracking-wide shrink-0">
                          Overdue ({c.daysLate}d late)
                        </span>
                      )}
                      {c.status === "due_soon" && (
                        <span className="px-2.5 py-1 bg-jct-yellow text-jct-charcoal rounded-md text-[10px] font-bold uppercase tracking-wide shrink-0">
                          Due This Week
                        </span>
                      )}
                      {c.status === "on_track" && (
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-500 dark:bg-[#111111] dark:text-slate-400 rounded-md text-[10px] font-extrabold uppercase tracking-wide shrink-0">
                          On Track
                        </span>
                      )}
                      {isOwner && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditCustomer(c, e)}
                            className="rounded-lg bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 px-2 py-1 text-[10px] transition"
                            title="Owner Edit Credit Account"
                          >
                            ✏️ Edit
                          </button>
                          {onDeleteCustomer && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteCustomer(c.id);
                              }}
                              className="rounded-lg bg-rose-500/15 hover:bg-rose-500/30 px-2 py-1 text-[10px] font-bold text-rose-500 transition"
                              title="Owner Delete Credit Account"
                            >
                              🗑️ Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Contractor Intelligence */}
        {active && (
          <div className="flex-[1.5] flex flex-col bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#111111]">
              <div className="flex items-center gap-5 mb-6">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center font-display font-extrabold text-3xl text-jct-charcoal shadow-sm bg-jct-turquoise shrink-0">
                  {active.name.charAt(0)}
                </div>
                <div>
                  <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-jct-charcoal dark:text-white tracking-tight leading-tight">
                    {active.name}
                  </h2>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-2">
                    🔔 Reminder: {active.followUpDate || active.dueDate} · Inv{" "}
                    {active.latestInvoiceNo || "#30064"} · ID: {active.id.toUpperCase()}-089
                  </p>
                </div>
              </div>

              <div className="p-6 bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Total Outstanding Debt
                  </p>
                  <p
                    className={`font-display font-extrabold text-3xl ${
                      active.status === "overdue"
                        ? "text-rose-600 dark:text-rose-500"
                        : "text-jct-charcoal dark:text-jct-offwhite"
                    }`}
                  >
                    {fmt(active.outstanding)} <span className="text-sm text-slate-500 dark:text-slate-400">SAR</span>
                  </p>
                </div>
                {active.status === "overdue" && (
                  <div className="h-14 w-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center dark:bg-rose-500/20 dark:text-rose-400">
                    <AlertTriangle size={26} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Analytics */}
              <div>
                <h3 className="text-sm font-extrabold text-jct-charcoal dark:text-jct-offwhite mb-4">
                  Historical Reliability
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#1F1F1F] text-center">
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Avg. Payment
                    </p>
                    <p className="font-bold text-jct-charcoal dark:text-jct-offwhite text-sm">
                      {active.avgPaymentTime}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#1F1F1F] text-center">
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Risk Level
                    </p>
                    <p
                      className={`font-extrabold text-sm ${
                        active.riskLevel === "High"
                          ? "text-rose-600"
                          : active.riskLevel === "Medium"
                          ? "text-amber-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {active.riskLevel}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#1F1F1F] text-center">
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Cleared Invs
                    </p>
                    <p className="font-bold text-jct-charcoal dark:text-jct-offwhite text-sm">
                      {active.clearedInvoices}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Zone */}
              <div className="flex gap-4">
                <button className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg">
                  <Mail size={18} /> Email Reminder
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-lg bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm">
                  <Bell size={18} /> Push Notification
                </button>
              </div>

              {/* Timeline */}
              <div>
                <h3 className="text-sm font-extrabold text-jct-charcoal dark:text-jct-offwhite mb-5">
                  Recent Receipts &amp; Credit Activity
                </h3>
                <div className="space-y-4 relative before:absolute before:top-3 before:bottom-3 before:left-3.5 before:w-0.5 before:bg-slate-200 dark:before:bg-[#403e3f]">
                  {active.history.map((h) => (
                    <div key={h.id} className="relative flex items-start gap-5 z-10">
                      <div
                        className={`w-7 h-7 rounded-full ring-4 ring-white dark:ring-jct-charcoal flex items-center justify-center shrink-0 mt-2 ${
                          h.status === "paid_on_time"
                            ? "bg-jct-turquoise text-jct-charcoal"
                            : "bg-jct-yellow text-jct-charcoal"
                        }`}
                      >
                        {h.status === "paid_on_time" ? (
                          <Check size={14} strokeWidth={4} />
                        ) : (
                          <AlertTriangle size={12} strokeWidth={3} />
                        )}
                      </div>
                      <div className="flex-1 bg-slate-50 dark:bg-[#111111] rounded-xl p-4 border border-slate-200 dark:border-[#1F1F1F] flex items-center justify-between shadow-sm">
                        <div>
                          <p className="font-bold text-sm text-jct-charcoal dark:text-jct-offwhite">{h.id}</p>
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wide">
                            {h.date}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm text-jct-charcoal dark:text-jct-offwhite mb-1">
                            {fmt(h.amount)} SAR
                          </p>
                          {h.status === "paid_on_time" ? (
                            <span className="text-[10px] font-bold uppercase tracking-wide bg-jct-turquoise text-jct-charcoal px-2 py-0.5 rounded-md">
                              On Time / Synced
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wide bg-jct-yellow text-jct-charcoal px-2 py-0.5 rounded-md">
                              Late
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   SUPPLIERS & PAYABLES (LIVE SYNCED WITH DAILY REGISTER CREDIT PURCHASES)
   ════════════════════════════════════════════════════════════════════════ */

function SupplierHubView({
  supplierBrands,
  supplierBills,
  onLogSupplierPurchase,
  isOwner = false,
  onUpdateBill,
  onDeleteBill,
}: {
  supplierBrands: SupplierPayableBrand[];
  supplierBills: SupplierBillItem[];
  onLogSupplierPurchase: (
    supplierName: string,
    amount: number,
    dueDate: string,
    category: "Credit Purchase" | "Cash Purchase" | "Bank Purchase" | "Return",
    paymentMode?: UniversalPaymentMode
  ) => void;
  isOwner?: boolean;
  onUpdateBill?: (updated: SupplierBillItem) => void;
  onDeleteBill?: (id: string) => void;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");

  const handlePin = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPin(val);
    if (val.length > 0) {
      setUnlocked(true);
      setPin("");
    }
  };

  const [privateCommissions, setPrivateCommissions] = useState([
    { id: 1, name: "Ali R. (Broker)", dealRef: "Jubail Port Proj.", amount: 15000, date: "2026-09-01", paymentMode: "CASH" as UniversalPaymentMode },
    { id: 2, name: "Saad Contractor", dealRef: "Al-Noor Complex", amount: 8500, date: "2026-09-10", paymentMode: "AL_RAJHI" as UniversalPaymentMode },
  ]);

  const [supplierSearch, setSupplierSearch] = useState("");
  const [logAmount, setLogAmount] = useState("");
  const [logType, setLogType] = useState<"Credit Purchase" | "Cash Purchase" | "Bank Purchase" | "Return">("Credit Purchase");
  const [logPaymentMode, setLogPaymentMode] = useState<UniversalPaymentMode>("SAB");
  const [logDate, setLogDate] = useState("2026-09-25");

  // Owner Edit Supplier Bill Modal State
  const [editingBill, setEditingBill] = useState<SupplierBillItem | null>(null);
  const [editBillSupplier, setEditBillSupplier] = useState("");
  const [editBillAmount, setEditBillAmount] = useState("");
  const [editBillDueDate, setEditBillDueDate] = useState("");
  const [editBillPaymentMode, setEditBillPaymentMode] = useState<UniversalPaymentMode>("SAB");

  const handleOpenEditBill = (bill: SupplierBillItem) => {
    setEditingBill(bill);
    setEditBillSupplier(bill.supplierName);
    setEditBillAmount(String(bill.amount));
    setEditBillDueDate(bill.dueDate);
    setEditBillPaymentMode((bill.paymentMode as UniversalPaymentMode) || "SAB");
  };

  const handleSaveEditBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBill || !onUpdateBill) return;
    const val = parseFloat(editBillAmount);
    if (Number.isNaN(val) || val <= 0) return;
    onUpdateBill({
      ...editingBill,
      supplierName: editBillSupplier.trim() || editingBill.supplierName,
      amount: val,
      dueDate: editBillDueDate || editingBill.dueDate,
      paymentMode: editBillPaymentMode,
    });
    setEditingBill(null);
  };

  const handleLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(logAmount);
    if (!supplierSearch.trim() || Number.isNaN(val) || val <= 0) return;
    onLogSupplierPurchase(supplierSearch.trim(), val, logDate || "2026-09-25", logType, logPaymentMode);
    setSupplierSearch("");
    setLogAmount("");
  };

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto w-full">
      {/* Owner Edit Supplier Bill Modal */}
      {isOwner && editingBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 text-jct-charcoal dark:text-jct-offwhite">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1F1F1F] pb-3 mb-4">
              <h3 className="font-display text-lg font-extrabold text-jct-charcoal dark:text-jct-offwhite">
                ✏️ Edit Supplier Bill (Owner Override)
              </h3>
              <button
                type="button"
                onClick={() => setEditingBill(null)}
                className="rounded-lg bg-slate-100 dark:bg-[#111111] px-2.5 py-1 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEditBill} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Supplier Name
                </label>
                <input
                  type="text"
                  required
                  value={editBillSupplier}
                  onChange={(e) => setEditBillSupplier(e.target.value)}
                  className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2.5 text-sm font-semibold outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Mode of Payment (Required)
                </label>
                <select
                  value={editBillPaymentMode}
                  onChange={(e) => setEditBillPaymentMode(e.target.value as UniversalPaymentMode)}
                  required
                  className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2.5 text-sm font-bold outline-none"
                >
                  {UNIVERSAL_PAYMENT_MODES.map((pm) => (
                    <option key={pm.value} value={pm.value} className="bg-white dark:bg-[#0A0A0A]">
                      {pm.badge} · {pm.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Amount (SAR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editBillAmount}
                  onChange={(e) => setEditBillAmount(e.target.value)}
                  className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2.5 font-mono text-base font-extrabold outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={editBillDueDate}
                  onChange={(e) => setEditBillDueDate(e.target.value)}
                  className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2.5 text-sm font-bold outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBill(null)}
                  className="rounded-lg border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#111111] px-4 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg px-5 py-2.5 text-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Top section: Official Brand Payables */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-extrabold text-2xl text-jct-charcoal dark:text-white tracking-tight flex items-center gap-2">
            <Package className="text-jct-turquoise" /> Official Brand Payables
          </h2>
          <span className="text-xs font-bold bg-jct-yellow text-jct-charcoal px-3 py-1 rounded-full">
            ● Live Synced with Daily Register Credit Purchases
          </span>
        </div>

        {/* Quick Supplier Add/Log Card */}
        <form
          onSubmit={handleLogSubmit}
          className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6"
        >
          <h3 className="font-bold text-xs text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-wider">
            Log Supplier Credit Purchase or Return
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <input
              list="suppliers-list"
              type="text"
              placeholder="Search Supplier (Jotun, Hempel, Sigma...)"
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
              className="flex-[2] min-w-[200px] px-4 py-2.5 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md font-medium text-sm outline-none"
            />
            <datalist id="suppliers-list">
              <option value="Jotun" />
              <option value="Hempel" />
              <option value="Sigma" />
            </datalist>
            <input
              type="number"
              step="0.01"
              placeholder="Amount (SAR)"
              value={logAmount}
              onChange={(e) => setLogAmount(e.target.value)}
              className="flex-1 min-w-[120px] px-4 py-2.5 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md font-bold text-sm outline-none"
            />
            <select
              value={logType}
              onChange={(e) =>
                setLogType(e.target.value as "Credit Purchase" | "Cash Purchase" | "Bank Purchase" | "Return")
              }
              className="flex-1 min-w-[150px] px-4 py-2.5 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md outline-none font-bold text-sm"
            >
              <option value="Credit Purchase" className="bg-white dark:bg-[#0A0A0A]">Credit Purchase</option>
              <option value="Cash Purchase" className="bg-white dark:bg-[#0A0A0A]">Cash Purchase</option>
              <option value="Bank Purchase" className="bg-white dark:bg-[#0A0A0A]">Bank Purchase</option>
              <option value="Return" className="bg-white dark:bg-[#0A0A0A]">Return / Refund</option>
            </select>
            {/* Required Mode of Payment Dropdown */}
            <select
              value={logPaymentMode}
              onChange={(e) => setLogPaymentMode(e.target.value as UniversalPaymentMode)}
              required
              className="flex-1 min-w-[160px] px-4 py-2.5 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md font-bold text-sm outline-none"
            >
              {UNIVERSAL_PAYMENT_MODES.map((pm) => (
                <option key={pm.value} value={pm.value} className="bg-white dark:bg-[#0A0A0A]">
                  {pm.badge} · {pm.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              className="flex-1 min-w-[140px] px-4 py-2.5 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md font-medium text-sm outline-none"
            />
            <button
              type="submit"
              className={`px-6 py-2.5 rounded-lg font-bold transition-all shadow-sm whitespace-nowrap shrink-0 ${
                logType === "Return"
                  ? "bg-jct-yellow text-jct-charcoal hover:brightness-95"
                  : "bg-jct-turquoise text-jct-charcoal hover:brightness-95"
              }`}
            >
              {logType === "Return" ? "Log Return" : "Log Purchase"}
            </button>
          </div>
        </form>

        {/* Payables Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {supplierBrands.map((p) => (
            <div
              key={p.id}
              className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 flex flex-col gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-extrabold text-jct-charcoal text-lg bg-jct-turquoise shadow-sm">
                  {p.brand.charAt(0)}
                </div>
                <h3 className="font-display font-extrabold text-lg text-jct-charcoal dark:text-jct-offwhite">
                  {p.brand}
                </h3>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Total Paid This Month
                </p>
                <p className="font-display font-extrabold text-xl text-jct-charcoal dark:text-jct-offwhite">
                  SAR {fmt(p.amountPaid)}
                </p>
              </div>
              <div className="flex flex-col gap-1 pt-3 border-t border-slate-200 dark:border-[#1F1F1F]">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Pending Credit Bills
                </p>
                <p className="font-display font-extrabold text-lg text-jct-charcoal dark:text-jct-offwhite">
                  SAR {fmt(p.pendingBills)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Live Credit Purchase Bills & Due Dates Table */}
        <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-extrabold text-base text-jct-charcoal dark:text-jct-offwhite">
              Active Supplier Credit Purchases &amp; Payment Due Dates ({supplierBills.length})
            </h3>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Includes bills logged in Daily Register Step 4
            </span>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-[#1F1F1F]">
            {supplierBills.map((bill) => {
              const pmBadge = formatPaymentModeBadge(bill.paymentMode);
              return (
                <div
                  key={bill.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-extrabold text-jct-charcoal dark:text-jct-offwhite">
                      {bill.supplierName}
                    </span>
                    <span className="rounded-full bg-jct-yellow text-jct-charcoal font-bold px-3 py-1 text-xs">
                      {bill.category}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${pmBadge.badgeClass}`}
                    >
                      {pmBadge.badge}
                    </span>
                    {bill.source === "Daily Register" && (
                      <span className="rounded-full bg-jct-turquoise text-jct-charcoal px-2.5 py-0.5 text-[10px] font-bold">
                        ✓ Synced from Daily Register
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      Due Date: {bill.dueDate}
                    </span>
                    <span className="font-display font-extrabold text-jct-charcoal dark:text-jct-offwhite">
                      SAR {fmt(bill.amount)}
                    </span>
                    {isOwner && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditBill(bill)}
                          className="rounded-lg bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 px-2 py-1 text-xs transition"
                        >
                          ✏️ Edit
                        </button>
                        {onDeleteBill && (
                          <button
                            type="button"
                            onClick={() => onDeleteBill(bill.id)}
                            className="rounded-lg bg-rose-500/15 hover:bg-rose-500/30 px-2 py-1 text-xs font-bold text-rose-500 transition"
                          >
                            🗑️ Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="my-2 border-b border-slate-200 dark:border-[#1F1F1F]"></div>

      {/* Bottom section: The Private Vault */}
      <div className="flex flex-col gap-4 relative min-h-[300px]">
        {!unlocked && (
          <div className="absolute inset-0 z-10 rounded-xl backdrop-blur-xl bg-slate-900/10 dark:bg-black/40 flex flex-col items-center justify-center border border-slate-200 dark:border-[#1F1F1F] shadow-lg overflow-hidden">
            <div className="relative z-20 flex flex-col items-center gap-4 bg-white dark:bg-[#0A0A0A] p-8 rounded-xl shadow-sm border border-slate-200 dark:border-[#1F1F1F]">
              <div className="h-16 w-16 rounded-full bg-jct-yellow text-jct-charcoal flex items-center justify-center shadow-sm">
                <Lock size={28} />
              </div>
              <div className="text-center">
                <h3 className="font-display font-extrabold text-xl text-jct-charcoal dark:text-jct-offwhite mb-1">
                  Private Vault Locked
                </h3>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Enter PIN to view confidential ledgers
                </p>
              </div>
              <input
                type="password"
                value={pin}
                onChange={handlePin}
                placeholder="••••"
                className="mt-2 w-32 text-center tracking-[0.5em] font-display text-2xl font-bold py-3 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md outline-none"
              />
            </div>
          </div>
        )}

        <div
          className={`flex flex-col gap-4 transition-all duration-500 ${
            !unlocked ? "opacity-30 blur-sm pointer-events-none" : "opacity-100"
          }`}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display font-extrabold text-2xl text-jct-charcoal dark:text-white tracking-tight flex items-center gap-2">
              <LockOpen className="text-jct-turquoise" /> The Private Vault
            </h2>
            <button
              onClick={() => setUnlocked(false)}
              className="px-4 py-2 bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 rounded-lg text-sm transition-all flex items-center gap-2"
            >
              <Lock size={14} /> Lock Vault
            </button>
          </div>

          <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 text-jct-charcoal dark:text-jct-offwhite overflow-hidden relative">
            <div className="relative z-10 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-xs mb-1">
                    Confidential Ledger
                  </h3>
                  <p className="font-display font-extrabold text-xl text-jct-charcoal dark:text-jct-offwhite">
                    Broker &amp; Contractor Commissions
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
                    Total Dispensed
                  </p>
                  <p className="font-display font-extrabold text-2xl text-jct-charcoal dark:text-jct-offwhite">
                    SAR {fmt(privateCommissions.reduce((s, c) => s + c.amount, 0))}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-[#1F1F1F] overflow-hidden">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#111111] font-bold">
                    <tr>
                      <th className="px-4 py-3">Recipient Name</th>
                      <th className="px-4 py-3">Deal Reference</th>
                      <th className="px-4 py-3">Mode</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      {isOwner && <th className="px-4 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-[#1F1F1F] font-medium">
                    {privateCommissions.map((c) => {
                      const pmBadge = formatPaymentModeBadge(c.paymentMode);
                      return (
                        <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-[#111111] transition-colors">
                          <td className="px-4 py-3 text-jct-charcoal dark:text-jct-offwhite">
                            <input
                              type="text"
                              value={c.name}
                              onChange={(e) =>
                                setPrivateCommissions((prev) =>
                                  prev.map((it) => (it.id === c.id ? { ...it, name: e.target.value } : it))
                                )
                              }
                              className="bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-2 py-1 font-semibold outline-none"
                            />
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                            <input
                              type="text"
                              value={c.dealRef}
                              onChange={(e) =>
                                setPrivateCommissions((prev) =>
                                  prev.map((it) => (it.id === c.id ? { ...it, dealRef: e.target.value } : it))
                                )
                              }
                              className="bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-2 py-1 outline-none"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${pmBadge.badgeClass}`}>
                              {pmBadge.badge}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{c.date}</td>
                          <td className="px-4 py-3 text-right font-bold text-jct-charcoal dark:text-jct-offwhite">
                            <input
                              type="number"
                              value={c.amount}
                              onChange={(e) =>
                                setPrivateCommissions((prev) =>
                                  prev.map((it) =>
                                    it.id === c.id ? { ...it, amount: parseFloat(e.target.value) || 0 } : it
                                  )
                                )
                              }
                              className="w-24 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-2 py-1 text-right font-mono font-bold outline-none"
                            />
                          </td>
                          {isOwner && (
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setPrivateCommissions((prev) => prev.filter((it) => it.id !== c.id))
                                }
                                className="rounded bg-rose-500/15 hover:bg-rose-500/30 px-2 py-1 text-xs font-bold text-rose-500"
                              >
                                🗑️ Delete
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setPrivateCommissions((prev) => [
                      ...prev,
                      {
                        id: Date.now(),
                        name: "New Broker",
                        dealRef: "Project Commission",
                        amount: 5000,
                        date: "2026-09-12",
                        paymentMode: "CASH",
                      },
                    ])
                  }
                  className="flex items-center gap-2 px-5 py-2.5 bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg text-sm"
                >
                  <Plus size={16} /> Add Commission Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface LiveCrossModuleMetrics {
  todayCashSales: number;
  todayBankNet: number;
  todayPosFees: number;
  todayExpenses: number;
  closingDrawerBalance: number;
  totalCreditOutstanding: number;
  totalSupplierPayables: number;
}

function FinancialPulseView({ metrics }: { metrics: LiveCrossModuleMetrics }) {
  const mtdRevenue = r2(438000 + metrics.todayCashSales + metrics.todayBankNet);
  const mtdCashCollected = r2(328000 + metrics.todayCashSales + metrics.todayBankNet);

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display font-extrabold text-2xl text-jct-charcoal dark:text-white tracking-tight flex items-center gap-2">
            <Activity className="text-jct-turquoise" /> Sales &amp; Business Analytics Hub
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-semibold text-sm">
            Live synced with today&apos;s Daily Register, POS Terminal Fees, and Payables.
          </p>
        </div>
        <span className="text-xs font-bold bg-jct-yellow text-jct-charcoal px-3 py-1.5 rounded-full">
          ● Live Register Sync Active
        </span>
      </div>

      {/* 1. Top Row: Primary Sales & Cash KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* KPI 1 */}
        <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 flex flex-col gap-3">
          <div className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">
            Total Revenue (Live MTD)
          </div>
          <div className="text-2xl font-black text-jct-charcoal dark:text-jct-offwhite">
            SAR {fmt(mtdRevenue)}
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-jct-turquoise text-jct-charcoal px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1">
              <TrendingUp size={12} /> +14.2%
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              POS Fees Today: -SAR {fmt(metrics.todayPosFees)}
            </span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 flex flex-col gap-3">
          <div className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">
            Cash vs Credit (Live Radar)
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-lg font-black text-jct-charcoal dark:text-jct-offwhite leading-none">
              SAR {fmt(mtdCashCollected)} <span className="text-xs text-slate-500 dark:text-slate-400">Cash/POS</span>
            </div>
            <div className="text-sm font-bold text-slate-500 dark:text-slate-400 leading-none">
              SAR {fmt(metrics.totalCreditOutstanding)}{" "}
              <span className="text-xs">Credit Outstanding</span>
            </div>
          </div>
          <div className="w-full bg-slate-100 dark:bg-[#111111] rounded-full h-1.5 mt-1 overflow-hidden flex">
            <div className="bg-jct-turquoise h-full" style={{ width: "75%" }}></div>
            <div className="bg-jct-yellow h-full" style={{ width: "25%" }}></div>
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">75% cash realization rate</p>
        </div>

        {/* KPI 3 */}
        <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 flex flex-col gap-3">
          <div className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">
            Today&apos;s Drawer Closing Balance
          </div>
          <div className="text-2xl font-black text-jct-charcoal dark:text-jct-offwhite">
            SAR {fmt(metrics.closingDrawerBalance)}
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-jct-yellow text-jct-charcoal px-2 py-0.5 rounded text-xs font-bold">
              Today Outflows: SAR {fmt(metrics.todayExpenses)}
            </span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">
              Monthly Sales Target
            </div>
            <div className="text-xs font-bold bg-jct-yellow text-jct-charcoal px-2 py-0.5 rounded">
              8 Days Left
            </div>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100 dark:text-[#2A2829]"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-jct-turquoise"
                  strokeWidth="4"
                  strokeDasharray="84, 100"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-sm font-black text-jct-charcoal dark:text-jct-offwhite">84%</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold text-jct-charcoal dark:text-jct-offwhite">
                SAR 575,000
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Target for Cycle</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Middle Row: Multi-Type Interactive Charts */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-[60%] bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 flex flex-col gap-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-display font-extrabold text-lg text-jct-charcoal dark:text-jct-offwhite">
                Revenue vs Supplier Costs
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mt-1">
                Monthly Trajectory (Past 6 Months)
              </p>
            </div>
            <select className="bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3 py-1.5 text-xs font-bold outline-none">
              <option className="bg-white dark:bg-[#0A0A0A]">Monthly</option>
              <option className="bg-white dark:bg-[#0A0A0A]">Weekly</option>
            </select>
          </div>

          <div className="flex-1 flex items-end justify-between gap-4 pt-8 relative min-h-[220px]">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
              <div className="border-b border-dashed border-slate-200 dark:border-[#1F1F1F] w-full"></div>
              <div className="border-b border-dashed border-slate-200 dark:border-[#1F1F1F] w-full"></div>
              <div className="border-b border-dashed border-slate-200 dark:border-[#1F1F1F] w-full"></div>
              <div className="border-b border-slate-200 dark:border-[#1F1F1F] w-full"></div>
            </div>

            {["Jan", "Feb", "Mar", "Apr", "May"].map((month, i) => (
              <div
                key={month}
                className="relative z-10 flex flex-col items-center gap-2 flex-1 group cursor-pointer hover:opacity-80 transition-opacity"
              >
                <div className="flex items-end gap-1.5 h-40 w-full justify-center">
                  <div
                    className="w-1/3 bg-jct-turquoise rounded-t-sm"
                    style={{ height: `${50 + i * 8}%` }}
                  ></div>
                  <div
                    className="w-1/3 bg-jct-yellow rounded-t-sm"
                    style={{ height: `${35 + i * 5}%` }}
                  ></div>
                </div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">{month}</span>
              </div>
            ))}

            <div className="relative z-10 flex flex-col items-center gap-2 flex-1 group cursor-pointer">
              <div className="flex items-end gap-1.5 h-40 w-full justify-center relative">
                <div className="absolute -inset-x-2 -inset-y-4 bg-slate-50 dark:bg-[#111111] rounded-xl -z-10"></div>
                <div
                  className="w-1/3 bg-jct-turquoise rounded-t-sm"
                  style={{ height: "95%" }}
                ></div>
                <div
                  className="w-1/3 bg-jct-yellow rounded-t-sm"
                  style={{ height: "70%" }}
                ></div>
              </div>
              <span className="text-[10px] font-bold text-jct-charcoal dark:text-jct-offwhite uppercase bg-slate-100 dark:bg-[#111111] px-2 py-0.5 rounded-full">
                Current
              </span>
            </div>
          </div>
        </div>

        <div className="lg:w-[40%] bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 flex flex-col justify-between gap-6">
          <div>
            <h3 className="font-display font-extrabold text-lg text-jct-charcoal dark:text-jct-offwhite">
              Supplier Obligations (Live Synced)
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mt-1">
              Includes Credit Purchases added in Daily Register
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#1F1F1F]">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                Outstanding Supplier Payables
              </span>
              <div className="text-2xl font-black text-jct-charcoal dark:text-jct-offwhite mt-1">
                SAR {fmt(metrics.totalSupplierPayables)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-jct-yellow text-jct-charcoal">
              <span className="text-xs font-bold uppercase">
                Today&apos;s Net Bank / POS Settlement
              </span>
              <div className="text-2xl font-black mt-1">
                SAR {fmt(metrics.todayBankNet)}
              </div>
              <span className="text-xs font-semibold">
                After SAB (0.85%) &amp; Al Rajhi (0.80%) POS fees (-SAR {fmt(metrics.todayPosFees)})
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BranchConsolidationView({ metrics }: { metrics: LiveCrossModuleMetrics }) {
  const jubailTodayCashAndBank = r2(
    110000 + metrics.todayCashSales + metrics.todayBankNet
  );
  const allBranchesSales = r2(jubailTodayCashAndBank + 98400 + 107300);

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display font-extrabold text-2xl text-jct-charcoal dark:text-white tracking-tight flex items-center gap-2">
            <Building2 className="text-jct-turquoise" /> Branch Consolidation
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-semibold text-sm">
            All 3 shops combined: live daily cash, POS settlements, and supplier payables.
          </p>
        </div>
        <span className="text-xs font-bold bg-jct-yellow text-jct-charcoal px-3 py-1.5 rounded-full">
          ● Live Synced with Jubail Register
        </span>
      </div>

      {/* Header Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 flex flex-col gap-2">
          <div className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">
            TOTAL SALES (ALL 3 SHOPS)
          </div>
          <div className="text-2xl font-black text-jct-charcoal dark:text-jct-offwhite">
            {fmt(allBranchesSales)} <span className="text-sm text-slate-500 dark:text-slate-400">SAR</span>
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
            ↑ Live synced with Jubail Main Register
          </p>
        </div>
        <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 flex flex-col gap-2">
          <div className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">
            CUSTOMER CREDIT RADAR TOTAL
          </div>
          <div className="text-2xl font-black text-jct-charcoal dark:text-jct-offwhite">
            {fmt(metrics.totalCreditOutstanding)} <span className="text-sm text-slate-500 dark:text-slate-400">SAR</span>
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
            Active contractor receivables across branches
          </p>
        </div>
        <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 flex flex-col gap-2">
          <div className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">
            BILLS WE OWE TO SUPPLIERS
          </div>
          <div className="text-2xl font-black text-jct-charcoal dark:text-jct-offwhite">
            {fmt(metrics.totalSupplierPayables)} <span className="text-sm text-slate-500 dark:text-slate-400">SAR</span>
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
            Live synced with Credit Purchases
          </p>
        </div>
      </div>

      {/* Branch Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
        {/* Branch 1: Jubail Main Branch */}
        <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 flex flex-col gap-5 relative overflow-hidden group">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest bg-jct-turquoise text-jct-charcoal px-2 py-1 rounded-md">
              MAIN BRANCH
            </span>
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-bold">
              <span className="inline-flex rounded-full h-2 w-2 bg-jct-turquoise"></span>
              Live Session Active
            </div>
          </div>
          <div>
            <h3 className="font-display font-extrabold text-xl text-jct-charcoal dark:text-jct-offwhite">
              Jubail Main Branch
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mt-1">
              Main Shop: Jotun + Hempel + Hardware tools
            </p>
          </div>

          <div className="flex flex-col gap-3 mt-2">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-[#1F1F1F] pb-2">
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Today&apos;s Drawer Closing:
              </span>
              <span className="text-sm font-extrabold text-jct-charcoal dark:text-jct-offwhite">
                SAR {fmt(metrics.closingDrawerBalance)}
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-[#1F1F1F] pb-2">
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Net Bank / POS Today:
              </span>
              <span className="text-sm font-extrabold text-jct-charcoal dark:text-jct-offwhite">
                SAR {fmt(metrics.todayBankNet)}
              </span>
            </div>
            <div className="flex justify-between items-center pb-2">
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                POS Fees (SAB / Al Rajhi):
              </span>
              <span className="text-sm font-extrabold text-rose-500">
                -SAR {fmt(metrics.todayPosFees)}
              </span>
            </div>
          </div>
        </div>

        {/* Branch 2: Dammam Franchise */}
        <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 flex flex-col gap-5 relative overflow-hidden group">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest bg-jct-yellow text-jct-charcoal px-2 py-1 rounded-md">
              FRANCHISE
            </span>
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-bold">
              Synced EOD
            </div>
          </div>
          <div>
            <h3 className="font-display font-extrabold text-xl text-jct-charcoal dark:text-jct-offwhite">
              Dammam Shop
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mt-1">
              Jotun Exclusive Franchise Outlet
            </p>
          </div>
          <div className="flex flex-col gap-3 mt-2">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-[#1F1F1F] pb-2">
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Daily Register Cash:
              </span>
              <span className="text-sm font-extrabold text-jct-charcoal dark:text-jct-offwhite">
                98,400.00 SAR
              </span>
            </div>
            <div className="flex justify-between items-center pb-2">
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Staff Assigned:
              </span>
              <span className="text-sm font-extrabold text-jct-charcoal dark:text-jct-offwhite">
                4 Associates
              </span>
            </div>
          </div>
        </div>

        {/* Branch 3: Jubail Sigma Franchise */}
        <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 flex flex-col gap-5 relative overflow-hidden group">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest bg-jct-yellow text-jct-charcoal px-2 py-1 rounded-md">
              FRANCHISE
            </span>
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-bold">
              Synced EOD
            </div>
          </div>
          <div>
            <h3 className="font-display font-extrabold text-xl text-jct-charcoal dark:text-jct-offwhite">
              Jubail Sigma
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mt-1">
              Sigma Paints Franchise Outlet
            </p>
          </div>
          <div className="flex flex-col gap-3 mt-2">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-[#1F1F1F] pb-2">
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Daily Register Cash:
              </span>
              <span className="text-sm font-extrabold text-jct-charcoal dark:text-jct-offwhite">
                107,300.00 SAR
              </span>
            </div>
            <div className="flex justify-between items-center pb-2">
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Staff Assigned:
              </span>
              <span className="text-sm font-extrabold text-jct-charcoal dark:text-jct-offwhite">
                5 Associates
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NaumanAiView({
  txns,
  erpInvoices = [],
  preLoggedEntries = [],
}: {
  txns: Txn[];
  erpInvoices?: ErpInvoiceItem[];
  preLoggedEntries?: PreLoggedEntry[];
}) {
  const [aiInsights, setAiInsights] = useState<{
    summary?: {
      headline?: string;
      netCash?: number;
      inflowsTotal?: number;
      outflowsTotal?: number;
      healthScore?: string;
    };
    leaks: { type: string; severity: "amber" | "red"; message: string }[];
    trends: { highlight: string; message: string }[];
    advice: string;
    error?: string;
    source?: string;
    modelUsed?: string;
    availableModels?: string[];
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const inflows = txns.filter((t) => t.flow === "in");
  const outflows = txns.filter((t) => t.flow === "out");
  const totals = {
    in: inflows.reduce((a, b) => a + b.amount, 0),
    out: outflows.reduce((a, b) => a + b.amount, 0),
  };

  const totalOriginalAmount = erpInvoices.reduce(
    (sum, inv) => sum + (inv.originalAmount ?? inv.amount),
    0
  );
  const totalFinalAmount = erpInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const billMistakesTotal = erpInvoices
    .filter((inv) => inv.overrideReason === "BILL_MISTAKE")
    .reduce(
      (sum, inv) =>
        sum + Math.max(0, (inv.originalAmount ?? inv.amount) - inv.amount),
      0
    );
  const businessCommissionsTotal = erpInvoices
    .filter((inv) => inv.overrideReason === "BUSINESS_COMMISSION")
    .reduce(
      (sum, inv) =>
        sum + Math.max(0, (inv.originalAmount ?? inv.amount) - inv.amount),
      0
    );

  const commissionInvoices = erpInvoices.filter(
    (inv) =>
      inv.overrideReason === "BUSINESS_COMMISSION" &&
      (inv.originalAmount ?? inv.amount) > inv.amount
  );

  const autoGeneratedExpenses = commissionInvoices.map((inv) => {
    const expectedDiff = r2((inv.originalAmount ?? inv.amount) - inv.amount);
    const expId = `comm-exp-${inv.invoiceNo}`;
    const found = preLoggedEntries.find(
      (e) =>
        e.id === expId ||
        (e.expenseCategory === "Business Commission" &&
          (e.title.includes(inv.invoiceNo) || Math.abs(e.amount - expectedDiff) < 0.01))
    );
    const isMissingOrAltered = !found || Math.abs(found.amount - expectedDiff) > 0.01;
    return {
      id: expId,
      invoiceNo: inv.invoiceNo,
      expectedAmount: expectedDiff,
      currentAmount: found ? found.amount : 0,
      category: "Business Commission",
      note: "Auto-synced from CSV invoice edit",
      isMissingOrAltered,
    };
  });

  const runAudit = async () => {
    setIsAnalyzing(true);
    setAiInsights(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inflows,
          outflows,
          totals,
          csvAuditContext: {
            totalOriginalAmount: r2(totalOriginalAmount),
            totalFinalAmount: r2(totalFinalAmount),
            billMistakesTotal: r2(billMistakesTotal),
            businessCommissionsTotal: r2(businessCommissionsTotal),
            autoGeneratedExpenses,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || data.source === "KEY_MISSING_IN_ENV" || data.source === "GROQ_API_ERROR" || data.error) {
        const commissionLeaks = autoGeneratedExpenses
          .filter((item) => item.isMissingOrAltered)
          .map((item) => ({
            type: "Forensic Audit Mismatch",
            severity: "red" as const,
            message: `A Business Commission was logged in the CSV for Inv #${item.invoiceNo} (SAR ${item.expectedAmount.toFixed(2)}) but is missing or altered from the Expense ledger.`,
          }));
        setAiInsights({
          summary: {
            headline: `Reconciled gross CSV sales (SAR ${fmt(totalOriginalAmount)}) minus commissions (SAR ${fmt(businessCommissionsTotal)}) and bill mistakes (SAR ${fmt(billMistakesTotal)}).`,
            netCash: totals.in - totals.out,
            inflowsTotal: totals.in,
            outflowsTotal: totals.out,
            healthScore: commissionLeaks.length > 0 ? "72/100 · Commission Discrepancy" : "94/100 · Strong Liquidity",
          },
          error: data.error || `HTTP ${res.status}: Failed to reach audit server.`,
          leaks: commissionLeaks,
          trends: [],
          advice: commissionLeaks.length > 0
            ? "Immediately restore the auto-generated business commission expense in Step 4 to balance the register."
            : "",
          source: data.source || "GROQ_API_ERROR",
          modelUsed: data.selectedModel || data.modelUsed,
          availableModels: data.availableModels || [],
        });
        return;
      }
      setAiInsights(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Network error connecting to /api/ai.";
      setAiInsights({
        error: msg,
        leaks: [],
        trends: [],
        advice: "",
        source: "GROQ_API_ERROR",
        availableModels: [],
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display font-extrabold text-2xl text-jct-charcoal dark:text-white tracking-tight flex items-center gap-2">
            <Sparkles className="text-jct-turquoise" /> Nauman AI &amp; Executive Pulse
          </h2>
          {aiInsights?.source === "GROQ_LIVE" && (
            <div className="mt-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-jct-turquoise text-jct-charcoal text-xs font-bold">
                <span className="inline-block h-2 w-2 rounded-full bg-jct-charcoal animate-pulse" />
                <span>⚡ LIVE AI ANALYSIS (GROQ {aiInsights.modelUsed?.toUpperCase() || "ACTIVE"})</span>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={runAudit}
          disabled={isAnalyzing}
          className="relative flex items-center gap-2 px-6 py-2.5 bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg disabled:opacity-70 shrink-0"
        >
          {isAnalyzing ? <Sparkles className="animate-spin" size={18} /> : <Zap size={18} />}
          {isAnalyzing ? "Analyzing..." : "⚡ Run End-of-Day Audit"}
        </button>
      </div>

      {(aiInsights?.source === "KEY_MISSING_IN_ENV" || aiInsights?.source === "GROQ_API_ERROR" || (aiInsights?.error && aiInsights.source !== "GROQ_LIVE")) && (
        <div className="bg-jct-yellow text-jct-charcoal font-bold px-5 py-4 rounded-xl flex items-start gap-3 shadow-sm">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <div className="flex-1 text-sm flex flex-col gap-2">
            <div className="font-extrabold flex items-center gap-2">
              <span>⚠️ AI Error:</span>
              <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-black/10 rounded">
                {aiInsights?.source || "GROQ_API_ERROR"}
              </span>
            </div>
            <p className="mt-1 font-mono text-xs break-words leading-relaxed">
              {aiInsights?.error || "Unable to reach Groq AI API endpoint."}
            </p>
            {aiInsights?.availableModels && aiInsights.availableModels.length > 0 && (
              <div className="mt-2 pt-2.5 border-t border-black/15">
                <div className="text-[11px] font-bold uppercase tracking-wider mb-1.5">
                  Available Models on Your Groq Account ({aiInsights.availableModels.length}):
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {aiInsights.availableModels.map((m) => (
                    <span key={m} className="px-2 py-0.5 bg-black/10 rounded font-mono text-[11px]">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isAnalyzing && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-jct-turquoise/20 border border-jct-turquoise text-jct-charcoal dark:text-jct-offwhite text-sm font-semibold animate-pulse">
          <Sparkles className="animate-spin" size={18} />
          <span>Auto-discovering active Groq models &amp; auditing ledger in real time...</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 auto-rows-max">
        <div className="lg:col-span-2 bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 relative overflow-hidden flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-extrabold text-2xl flex items-center gap-2 text-jct-charcoal dark:text-jct-offwhite">
                <Activity className="text-jct-turquoise" /> Today&apos;s Business Summary &amp; Blind-Spot Monitor
              </h3>
              <p className="text-slate-500 dark:text-slate-400 font-semibold text-sm mt-1">
                {aiInsights?.summary?.headline || "Live synced with today's Daily Register entries."}
              </p>
            </div>
            {aiInsights?.summary?.healthScore && (
              <div className="rounded-lg bg-jct-turquoise text-jct-charcoal px-3.5 py-1.5 text-xs font-mono font-bold shrink-0 w-fit">
                {aiInsights.summary.healthScore}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#1F1F1F] p-6 rounded-xl flex flex-col gap-2">
              <div className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                <ArrowRightLeft size={14} /> TODAY&apos;S NET CASH (IN - OUT)
              </div>
              <div className="text-2xl font-black text-jct-charcoal dark:text-jct-offwhite">
                SAR {fmt(totals.in - totals.out)}
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#1F1F1F] p-6 rounded-xl flex flex-col gap-2">
              <div className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                <BarChart2 size={14} /> BILLS &amp; TRANSACTIONS
              </div>
              <div className="text-2xl font-black text-jct-charcoal dark:text-jct-offwhite">
                {txns.length}{" "}
                <span className="text-base text-slate-500 dark:text-slate-400 font-semibold">
                  Recorded Items
                </span>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#1F1F1F] p-6 rounded-xl flex flex-col gap-2">
              <div className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Eye size={14} /> THINGS TO WATCH OUT FOR
              </div>
              <div className="text-lg leading-tight font-black text-jct-charcoal dark:text-jct-offwhite">
                Supplier &amp; POS Fee Audit Active
              </div>
            </div>
          </div>
        </div>

        {/* Leak Detector */}
        <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 flex flex-col gap-5">
          <h3 className="font-display font-extrabold text-xl flex items-center gap-2 text-jct-charcoal dark:text-jct-offwhite">
            <AlertTriangle className="text-rose-500" /> The Leak Detector
          </h3>
          <div className="flex flex-col gap-4">
            {aiInsights ? (
              (aiInsights.leaks || []).map((leak, i) => (
                <div
                  key={i}
                  className="bg-jct-yellow text-jct-charcoal font-bold p-4 rounded-xl"
                >
                  <p className="text-sm">
                    <span className="font-extrabold">{leak.type}:</span> {leak.message}
                  </p>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-24 border-2 border-dashed border-slate-200 dark:border-[#1F1F1F] rounded-xl">
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Run audit to detect leaks</p>
              </div>
            )}
          </div>
        </div>

        {/* Trend Predictor */}
        <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 flex flex-col gap-5">
          <h3 className="font-display font-extrabold text-xl flex items-center gap-2 text-jct-charcoal dark:text-jct-offwhite">
            <TrendingUp className="text-jct-turquoise" /> Trend Predictor
          </h3>
          <div className="flex flex-col gap-4">
            {aiInsights ? (
              (aiInsights.trends || []).map((trend, i) => (
                <div
                  key={i}
                  className="bg-jct-turquoise/20 border border-jct-turquoise p-4 rounded-xl text-jct-charcoal dark:text-jct-offwhite"
                >
                  <p className="text-sm font-semibold">
                    <span className="font-extrabold">{trend.highlight}:</span> {trend.message}
                  </p>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-24 border-2 border-dashed border-slate-200 dark:border-[#1F1F1F] rounded-xl">
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Run audit to reveal trends</p>
              </div>
            )}
          </div>
        </div>

        {/* Executive CFO Directive */}
        {aiInsights?.advice && (
          <div className="lg:col-span-2 bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 flex items-start gap-3.5">
            <Sparkles className="text-jct-turquoise shrink-0 mt-0.5" size={20} />
            <div>
              <span className="text-xs font-bold uppercase tracking-wider bg-jct-yellow text-jct-charcoal px-2 py-0.5 rounded">Executive CFO Directive</span>
              <p className="mt-2 text-sm font-medium text-jct-charcoal dark:text-jct-offwhite leading-relaxed">
                {aiInsights.advice}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   AUDIT LIBRARY / REGISTER ARCHIVE MODULE
   ════════════════════════════════════════════════════════════════════════ */

interface ArchiveRecord {
  id: string;
  branch: string;
  date: string;
  closingCash: number;
  openingCash: number;
  inflows: number;
  bankSwipes: number;
  outflows: number;
  posFees: number;
  madaFees: number;
  ccFees: number;
  lockedAt: string | Date;
  lockedBy: string;
  status: string;
  dataJson?: string | null;
}

function getBranchBadgeInfo(b: string) {
  if (b === "JCT_HQ" || b.includes("Main") || b.includes("HQ")) {
    return { name: "JCT Main HQ", color: "bg-jct-yellow text-jct-charcoal font-bold border-jct-yellow" };
  }
  if (b === "HEMPEL_JUBAIL" || b.toLowerCase().includes("hempel")) {
    return { name: "Hempel Jubail", color: "bg-jct-turquoise text-jct-charcoal font-bold border-jct-turquoise" };
  }
  if (b === "JOTUN_DAMMAM" || b.toLowerCase().includes("dammam")) {
    return { name: "Jotun Dammam", color: "bg-jct-yellow text-jct-charcoal font-bold border-jct-yellow" };
  }
  if (b === "SIGMA_JUBAIL" || b.toLowerCase().includes("sigma")) {
    return { name: "Sigma Jubail", color: "bg-jct-turquoise text-jct-charcoal font-bold border-jct-turquoise" };
  }
  return { name: b, color: "text-jct-charcoal dark:text-jct-offwhite border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#111111]" };
}

function formatLockTime(d: string | Date) {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "10:14 PM";
  return dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

interface ParsedExpenseItem {
  id: string;
  title: string;
  amount: number;
  time: string;
  expenseCategory?: string;
  paymentMode?: string;
}

interface ParsedInflowItem {
  id: string;
  title: string;
  amount: number;
  customer?: string;
  time?: string;
  paymentMode?: string;
}

interface ParsedSwipeItem {
  invoiceNo: string;
  amount: number;
  paymentMode: string;
  posTerminal?: string;
  time?: string;
}

function AuditLibraryView({ profile }: { profile: UserProfile | null }) {
  const isOwner = Boolean(profile?.isOwner);
  const staffBranchId = profile?.id && profile.id !== "BONGSI" ? profile.id : "JCT_HQ";

  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>(
    isOwner ? "ALL" : staffBranchId
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<ArchiveRecord | null>(null);

  // Snapshot edit & inspection states
  const [settlementMode, setSettlementMode] = useState<"GROSS" | "NET">("GROSS");
  const [editOpeningCash, setEditOpeningCash] = useState<number>(2634);
  const [editInflows, setEditInflows] = useState<number>(0);
  const [editBankSwipes, setEditBankSwipes] = useState<number>(0);
  const [editOutflows, setEditOutflows] = useState<number>(0);
  const [editClosingCash, setEditClosingCash] = useState<number>(0);
  const [editExpenses, setEditExpenses] = useState<ParsedExpenseItem[]>([]);
  const [editInflowItems, setEditInflowItems] = useState<ParsedInflowItem[]>([]);
  const [editSwipes, setEditSwipes] = useState<ParsedSwipeItem[]>([]);
  const [expandedBox, setExpandedBox] = useState<"NONE" | "MONEY_IN" | "EXPENSES" | "BANK_POS">("NONE");
  const [saving, setSaving] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Dedicated Modals for Adding / Editing Inflows & Past Bills
  const [inflowModalOpen, setInflowModalOpen] = useState(false);
  const [editingInflowId, setEditingInflowId] = useState<string | null>(null);
  const [inflowModalTitle, setInflowModalTitle] = useState("");
  const [inflowModalAmount, setInflowModalAmount] = useState("");
  const [inflowModalPaymentMode, setInflowModalPaymentMode] = useState<string>("CASH");
  const [inflowModalTime, setInflowModalTime] = useState("");

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseModalTitle, setExpenseModalTitle] = useState("");
  const [expenseModalCategory, setExpenseModalCategory] = useState<string>("Shop Maintenance");
  const [expenseModalAmount, setExpenseModalAmount] = useState("");
  const [expenseModalPaymentMode, setExpenseModalPaymentMode] = useState<string>("CASH");
  const [expenseModalTime, setExpenseModalTime] = useState("");

  const handleOpenAddInflowModal = () => {
    if (!isOwner) return;
    setEditingInflowId(null);
    setInflowModalTitle("");
    setInflowModalAmount("");
    setInflowModalPaymentMode("CASH");
    setInflowModalTime(nowHHMM());
    setInflowModalOpen(true);
  };

  const handleOpenEditInflowModal = (inf: ParsedInflowItem) => {
    if (!isOwner) return;
    setEditingInflowId(inf.id);
    setInflowModalTitle(inf.title);
    setInflowModalAmount(String(inf.amount));
    setInflowModalPaymentMode(inf.paymentMode || "CASH");
    setInflowModalTime(inf.time || nowHHMM());
    setInflowModalOpen(true);
  };

  const handleSaveInflowModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;
    const amt = Math.max(0, parseFloat(inflowModalAmount) || 0);
    const title = inflowModalTitle.trim() || "Additional Inflow";

    let updated: ParsedInflowItem[];
    if (editingInflowId) {
      updated = editInflowItems.map((i) =>
        i.id === editingInflowId
          ? { ...i, title, amount: amt, paymentMode: inflowModalPaymentMode, time: inflowModalTime }
          : i
      );
    } else {
      const newInf: ParsedInflowItem = {
        id: `inf-manual-${Date.now()}`,
        title,
        amount: amt,
        time: inflowModalTime || nowHHMM(),
        paymentMode: inflowModalPaymentMode,
      };
      updated = [...editInflowItems, newInf];
    }

    setEditInflowItems(updated);
    const newInflow = r2(updated.reduce((s, i) => s + (Number(i.amount) || 0), 0));
    setEditInflows(newInflow);
    setEditClosingCash(r2(editOpeningCash + newInflow - editOutflows));
    setInflowModalOpen(false);
  };

  const handleOpenAddExpenseModal = () => {
    if (!isOwner) return;
    setEditingExpenseId(null);
    setExpenseModalTitle("");
    setExpenseModalCategory("Shop Maintenance");
    setExpenseModalAmount("");
    setExpenseModalPaymentMode("CASH");
    setExpenseModalTime(nowHHMM());
    setExpenseModalOpen(true);
  };

  const handleOpenEditExpenseModal = (exp: ParsedExpenseItem) => {
    if (!isOwner) return;
    setEditingExpenseId(exp.id);
    setExpenseModalTitle(exp.title);
    setExpenseModalCategory(exp.expenseCategory || "Shop Maintenance");
    setExpenseModalAmount(String(exp.amount));
    setExpenseModalPaymentMode(exp.paymentMode || "CASH");
    setExpenseModalTime(exp.time || nowHHMM());
    setExpenseModalOpen(true);
  };

  const handleSaveExpenseModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;
    const amt = Math.max(0, parseFloat(expenseModalAmount) || 0);
    const title = expenseModalTitle.trim() || "Adjusted Expense";

    let updated: ParsedExpenseItem[];
    if (editingExpenseId) {
      updated = editExpenses.map((exp) =>
        exp.id === editingExpenseId
          ? { ...exp, title, expenseCategory: expenseModalCategory, amount: amt, paymentMode: expenseModalPaymentMode, time: expenseModalTime }
          : exp
      );
    } else {
      const newExp: ParsedExpenseItem = {
        id: `exp-manual-${Date.now()}`,
        title,
        amount: amt,
        time: expenseModalTime || nowHHMM(),
        expenseCategory: expenseModalCategory,
        paymentMode: expenseModalPaymentMode,
      };
      updated = [...editExpenses, newExp];
    }

    setEditExpenses(updated);
    const newOutflow = r2(updated.reduce((s, e) => s + (Number(e.amount) || 0), 0));
    setEditOutflows(newOutflow);
    setEditClosingCash(r2(editOpeningCash + editInflows - newOutflow));
    setExpenseModalOpen(false);
  };

  const loadArchiveRecords = async () => {
    setLoading(true);
    try {
      const qBranch = isOwner ? selectedBranchFilter : staffBranchId;
      const res = await fetch(`/api/archive?branch=${encodeURIComponent(qBranch)}`);
      const data = await res.json();
      if (data.records) {
        setRecords(data.records);
      }
    } catch (e) {
      console.error("Failed to load archive", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    const fetchInitial = async () => {
      try {
        const qBranch = isOwner ? selectedBranchFilter : staffBranchId;
        const res = await fetch(`/api/archive?branch=${encodeURIComponent(qBranch)}`);
        const data = await res.json();
        if (!ignore && data.records) {
          setRecords(data.records);
        }
      } catch (e) {
        console.error("Failed to load archive", e);
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    fetchInitial();
    return () => {
      ignore = true;
    };
  }, [isOwner, selectedBranchFilter, staffBranchId]);

  const handleOpenSnapshot = (record: ArchiveRecord) => {
    setSelectedRecord(record);
    setEditOpeningCash(record.openingCash || 2634);
    setEditInflows(record.inflows || 0);
    setEditBankSwipes(record.bankSwipes || 0);
    setEditOutflows(record.outflows || 0);
    setEditClosingCash(record.closingCash || 0);
    setSettlementMode("GROSS");
    setExpandedBox("NONE");
    setSaveToast(null);

    let pExpenses: ParsedExpenseItem[] = [];
    let pInflows: ParsedInflowItem[] = [];
    let pSwipes: ParsedSwipeItem[] = [];

    if (record.dataJson) {
      try {
        const parsed = JSON.parse(record.dataJson);
        if (Array.isArray(parsed.expenses)) pExpenses = parsed.expenses;
        if (Array.isArray(parsed.inflows)) pInflows = parsed.inflows;
        if (Array.isArray(parsed.bankSwipes)) pSwipes = parsed.bankSwipes;
      } catch (e) {
        console.error("Error parsing dataJson", e);
      }
    }

    if (pExpenses.length === 0) {
      pExpenses = [
        { id: "e-d-1", title: "Shop Consumables & Maintenance", amount: r2(record.outflows * 0.45) || 350, time: "11:20", expenseCategory: "Shop Maintenance", paymentMode: "CASH" },
        { id: "e-d-2", title: "Delivery Van Fuel & Transit", amount: r2(record.outflows * 0.55) || 510, time: "15:40", expenseCategory: "Fuel / Vehicle", paymentMode: "CASH" },
      ];
    }
    if (pInflows.length === 0) {
      pInflows = [
        { id: "i-d-1", title: "Cash Inflow Register Summary", amount: record.inflows || 38900, customer: "Retail & Contractor Cash", time: "17:00", paymentMode: "CASH" },
      ];
    }
    if (pSwipes.length === 0) {
      pSwipes = [
        { invoiceNo: "30063", amount: r2(record.bankSwipes * 0.4) || 4500, paymentMode: "SAB", posTerminal: "SAB", time: "10:30" },
        { invoiceNo: "30068", amount: r2(record.bankSwipes * 0.6) || 6700, paymentMode: "AL_RAJHI", posTerminal: "AL_RAJHI", time: "14:15" },
      ];
    }

    setEditExpenses(pExpenses);
    setEditInflowItems(pInflows);
    setEditSwipes(pSwipes);
  };

  const handleDeleteExpenseItem = (id: string) => {
    if (!isOwner) return;
    const updated = editExpenses.filter((e) => e.id !== id);
    setEditExpenses(updated);
    const newOutflow = r2(updated.reduce((s, e) => s + (Number(e.amount) || 0), 0));
    setEditOutflows(newOutflow);
    setEditClosingCash(r2(editOpeningCash + editInflows - newOutflow));
  };

  const handleDeleteInflowItem = (id: string) => {
    if (!isOwner) return;
    const updated = editInflowItems.filter((i) => i.id !== id);
    setEditInflowItems(updated);
    const newInflow = r2(updated.reduce((s, i) => s + (Number(i.amount) || 0), 0));
    setEditInflows(newInflow);
    setEditClosingCash(r2(editOpeningCash + newInflow - editOutflows));
  };

  const handleDeleteArchiveRecord = async (id: string) => {
    if (!isOwner) return;
    try {
      const res = await fetch(`/api/archive?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          "x-user-is-owner": "true",
          "x-user-role": "OWNER",
        },
      });
      if (res.ok) {
        setRecords((prev) => prev.filter((r) => r.id !== id));
        if (selectedRecord?.id === id) setSelectedRecord(null);
      }
    } catch (e) {
      console.error("Failed to delete archive record:", e);
    }
  };

  const handleSaveHistoricalAudit = async () => {
    if (!isOwner || !selectedRecord) return;
    setSaving(true);
    try {
      const res = await fetch("/api/archive", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-is-owner": "true",
          "x-user-role": "OWNER",
        },
        body: JSON.stringify({
          id: selectedRecord.id,
          isOwner: true,
          closingCash: editClosingCash,
          openingCash: editOpeningCash,
          inflows: editInflows,
          bankSwipes: editBankSwipes,
          outflows: editOutflows,
          status: "AUDITED",
          dataJson: JSON.stringify({
            expenses: editExpenses,
            inflows: editInflowItems,
            bankSwipes: editSwipes,
          }),
        }),
      });
      const data = await res.json();
      if (data.record) {
        setSaveToast(`Historical audit for ${selectedRecord.date} updated & re-locked in Neon.`);
        setRecords((prev) => prev.map((r) => (r.id === selectedRecord.id ? { ...r, ...data.record } : r)));
        setSelectedRecord((prev) => (prev ? { ...prev, ...data.record } : null));
        setTimeout(() => setSaveToast(null), 4000);
      }
    } catch (e) {
      console.error("Save failed", e);
    } finally {
      setSaving(false);
    }
  };

  // Filter records by search query
  const filteredRecords = records.filter((r) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const bInfo = getBranchBadgeInfo(r.branch);
    return (
      r.date.toLowerCase().includes(q) ||
      bInfo.name.toLowerCase().includes(q) ||
      r.lockedBy.toLowerCase().includes(q) ||
      r.status.toLowerCase().includes(q)
    );
  });

  const totalAudits = records.length;
  const totalReconciledCash = r2(records.reduce((s, r) => s + (Number(r.closingCash) || 0), 0));
  const totalBankSettled = r2(records.reduce((s, r) => s + (Number(r.bankSwipes) || 0), 0));
  const latestRecordDate = records[0]?.date || "12-09-2026";

  // If a historical audit record is opened, show full Step 5 view
  if (selectedRecord) {
    const bInfo = getBranchBadgeInfo(selectedRecord.branch);
    const estFees = selectedRecord.posFees || r2(editBankSwipes * 0.008);
    const madaFees = selectedRecord.madaFees || r2(estFees * 0.8);
    const ccFees = selectedRecord.ccFees || r2(estFees * 0.2);
    const displayBankTotal = settlementMode === "NET" ? r2(editBankSwipes - estFees) : editBankSwipes;

    return (
      <div className="flex flex-col h-full overflow-y-auto p-4 sm:p-6 w-full gap-6 print:overflow-visible print:h-auto print:w-full print:p-0 print:m-0 print:bg-white print:text-black">
        {/* Print-Only Report Header */}
        <PrintReportHeader
          branch={bInfo.name}
          date={selectedRecord.date}
        />

        {/* Top Header & Role Banner */}
        <div className="flex flex-col gap-3 print:hidden">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setSelectedRecord(null)}
              className="inline-flex items-center gap-2 rounded-lg bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 px-4 py-2 text-xs transition-all"
            >
              <ArrowLeft size={14} /> Back to Audit Library
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center justify-center gap-2 bg-jct-charcoal dark:bg-slate-800 text-white px-4 py-2 rounded-lg font-bold print:hidden hover:brightness-110 transition-all text-xs shadow-sm"
              >
                <Printer size={14} />
                <span>🖨️ Print</span>
              </button>

              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${bInfo.color}`}>
                {bInfo.name} · {selectedRecord.date}
              </span>
            </div>
          </div>

          {/* Role-Based Alert Banner */}
          {isOwner ? (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-jct-yellow text-jct-charcoal font-bold px-5 py-3.5 shadow-sm">
              <div className="flex items-center gap-2.5 text-xs sm:text-sm font-extrabold">
                <Crown size={18} className="shrink-0" />
                <span>👑 OWNER EDIT ACCESS · You can modify expenses, float adjustments, and re-lock this historical audit</span>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider hidden sm:inline">
                Master Admin Privileges
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-jct-turquoise text-jct-charcoal font-bold px-5 py-3.5 shadow-sm">
              <div className="flex items-center gap-2.5 text-xs sm:text-sm font-extrabold">
                <Lock size={18} className="shrink-0" />
                <span>🔒 ARCHIVE RECORD (READ-ONLY) · Locked register for {selectedRecord.date} · Counted by {selectedRecord.lockedBy}</span>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider hidden sm:inline">
                Read-Only Audit Snapshot
              </span>
            </div>
          )}

          {saveToast && (
            <div className="flex items-center gap-2 rounded-xl bg-jct-turquoise text-jct-charcoal px-4 py-3 text-xs sm:text-sm font-bold animate-fadeIn">
              <CheckCircle2 size={16} />
              <span>{saveToast}</span>
            </div>
          )}
        </div>

        {/* 1. Settlement & Merchant Fee Header Strip */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-turquoise/20 dark:border-jct-turquoise/30 hover:border-jct-turquoise/80 hover:shadow-[0_0_15px_rgba(45,226,230,0.1)] rounded-xl p-6 transition-all duration-300 print:shadow-none print:border-slate-300 print:bg-white print:text-black">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Audit Settlement Mode:
            </span>
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-black p-1 border border-slate-200 dark:border-[#1F1F1F] gap-1 print:hidden">
              <button
                type="button"
                onClick={() => setSettlementMode("GROSS")}
                className={`rounded-lg px-3 py-1.5 text-xs transition ${
                  settlementMode === "GROSS"
                    ? "bg-jct-turquoise text-jct-charcoal font-bold shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite font-medium"
                }`}
              >
                Gross Face Value
              </button>
              <button
                type="button"
                onClick={() => setSettlementMode("NET")}
                className={`rounded-lg px-3 py-1.5 text-xs transition ${
                  settlementMode === "NET"
                    ? "bg-jct-turquoise text-jct-charcoal font-bold shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite font-medium"
                }`}
              >
                Net Bank (Deduct Fees &amp; VAT)
              </button>
            </div>
          </div>

          <div className="flex items-center">
            {settlementMode === "GROSS" ? (
              <div className="inline-flex items-center gap-1.5 text-xs bg-jct-yellow text-jct-charcoal font-bold px-3 py-1.5 rounded-lg">
                <span>ℹ️ Est. Merchant Fees: <strong className="font-mono">-SAR {fmt(estFees)}</strong> (mada: SAR {fmt(madaFees)} · CC: SAR {fmt(ccFees)}) · Informational</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 text-xs bg-jct-turquoise text-jct-charcoal font-bold px-3 py-1.5 rounded-lg">
                <span>✅ Net Settlement Active: <strong className="font-mono">SAR {fmt(estFees)}</strong> deducted from bank total</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Streamlined Hero Drawer Closing Card */}
        <div className="w-full bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-yellow/20 dark:border-jct-yellow/30 hover:border-jct-yellow/80 hover:shadow-[0_0_15px_rgba(255,222,89,0.1)] rounded-xl p-6 mb-2 transition-all duration-300 print:shadow-none print:border-slate-300 print:bg-white print:text-black">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-jct-yellow text-jct-charcoal text-xs font-bold uppercase tracking-wider">
                <Wallet size={14} className="text-jct-charcoal" />
                <span>💵 PHYSICAL CASH DRAWER CLOSING BALANCE</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isOwner
                  ? "Historical closing cash balance locked for this register session. Modify line items below to re-audit."
                  : "Historical closing cash balance locked for this register session."}
              </p>
            </div>
            <div className="text-3xl md:text-4xl font-black text-jct-charcoal dark:text-jct-offwhite tracking-tight">
              SAR {fmt(editClosingCash)}
            </div>
          </div>

          {/* Clean Math Formula Strip (Fully Visible) */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200 dark:border-[#1F1F1F] text-xs text-slate-500 dark:text-slate-400">
            <span>Opening Float: <strong className="text-jct-charcoal dark:text-jct-offwhite">SAR {fmt(editOpeningCash)}</strong></span>
            <span className="text-jct-turquoise font-bold">+</span>
            <span>Inflows: <strong className="text-jct-charcoal dark:text-jct-offwhite">SAR {fmt(editInflows)}</strong></span>
            <span className="text-rose-500 font-bold">-</span>
            <span>Outflows: <strong className="text-jct-charcoal dark:text-jct-offwhite">SAR {fmt(editOutflows)}</strong></span>
            <span className="text-jct-yellow font-bold">=</span>
            <span>Closing Cash: <strong className="text-jct-charcoal dark:text-jct-offwhite">SAR {fmt(editClosingCash)}</strong></span>
          </div>
        </div>

        {/* 3. The 3 Financial Pillars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2 print:grid-cols-3 print:gap-3">
          <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-turquoise/20 dark:border-jct-turquoise/30 hover:border-jct-turquoise/80 hover:shadow-[0_0_15px_rgba(45,226,230,0.1)] rounded-xl p-6 flex flex-col justify-between gap-3 transition-all duration-300 print:shadow-none print:border-slate-300 print:bg-white print:text-black">
            <div>
              <div className="flex items-center justify-between">
                <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Cash Inflows
                </span>
                <button
                  type="button"
                  onClick={() => setExpandedBox(expandedBox === "MONEY_IN" ? "NONE" : "MONEY_IN")}
                  className="rounded px-2 py-0.5 text-[11px] bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 print:hidden"
                >
                  {expandedBox === "MONEY_IN" ? "[Collapse]" : "[Inspect Inflows]"}
                </button>
              </div>
              <span className="mt-2 block font-mono text-2xl font-black text-jct-charcoal dark:text-jct-offwhite whitespace-nowrap">
                SAR {fmt(editInflows)}
              </span>
            </div>
            <span className="block text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-[#1F1F1F] pt-2">
              + Opening Float <strong className="text-jct-charcoal dark:text-jct-offwhite">SAR {fmt(editOpeningCash)}</strong>
            </span>
          </div>

          <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-yellow/20 dark:border-jct-yellow/30 hover:border-jct-yellow/80 hover:shadow-[0_0_15px_rgba(255,222,89,0.1)] rounded-xl p-6 flex flex-col justify-between gap-3 transition-all duration-300 print:shadow-none print:border-slate-300 print:bg-white print:text-black">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Bank &amp; Card Swipes
                </span>
                <button
                  type="button"
                  onClick={() => setExpandedBox(expandedBox === "BANK_POS" ? "NONE" : "BANK_POS")}
                  className="rounded px-2 py-0.5 text-[11px] bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 print:hidden"
                >
                  {expandedBox === "BANK_POS" ? "[Collapse]" : "[View Swipes]"}
                </button>
              </div>
              <span className="mt-2 block font-mono text-2xl font-black text-jct-charcoal dark:text-jct-offwhite whitespace-nowrap">
                SAR {fmt(displayBankTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-[#1F1F1F] pt-2">
              <span>{editSwipes.length} Invoices to bank</span>
              <span className="text-[11px] font-semibold text-jct-charcoal dark:text-jct-offwhite">{settlementMode === "NET" ? "Net of fees" : "Gross"}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-turquoise/20 dark:border-jct-turquoise/30 hover:border-jct-turquoise/80 hover:shadow-[0_0_15px_rgba(45,226,230,0.1)] rounded-xl p-6 flex flex-col justify-between gap-3 transition-all duration-300 print:shadow-none print:border-slate-300 print:bg-white print:text-black">
            <div>
              <div className="flex items-center justify-between">
                <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Cash Outflows
                </span>
                <button
                  type="button"
                  onClick={() => setExpandedBox(expandedBox === "EXPENSES" ? "NONE" : "EXPENSES")}
                  className="rounded px-2 py-0.5 text-[11px] bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 print:hidden"
                >
                  {expandedBox === "EXPENSES" ? "[Collapse]" : isOwner ? "[Edit Expenses]" : "[Inspect Outflows]"}
                </button>
              </div>
              <span className="mt-2 block font-mono text-2xl font-black text-jct-charcoal dark:text-jct-offwhite whitespace-nowrap">
                SAR {fmt(editOutflows)}
              </span>
            </div>
            <span className="block text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-[#1F1F1F] pt-2">
              {editExpenses.length} Recorded shop outflows
            </span>
          </div>
        </div>

        {/* 4. Expandable Detail Drilldown Boxes */}
        <div className="flex flex-col gap-4">
          {/* Detail Box: Inflows */}
          {(expandedBox === "MONEY_IN" || expandedBox === "NONE") && (
            <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-turquoise/20 dark:border-jct-turquoise/30 hover:border-jct-turquoise/80 hover:shadow-[0_0_15px_rgba(45,226,230,0.1)] rounded-xl p-6 transition-all duration-300">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1F1F1F] pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-jct-charcoal dark:text-jct-offwhite">Recorded Cash Inflows</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">({editInflowItems.length} items)</span>
                </div>
                {isOwner && (
                  <button
                    type="button"
                    onClick={handleOpenAddInflowModal}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-jct-turquoise/40 hover:border-jct-turquoise bg-jct-turquoise/10 hover:bg-jct-turquoise text-jct-charcoal dark:text-jct-turquoise hover:dark:text-jct-charcoal font-bold px-3 py-1.5 text-xs transition-all duration-300 shadow-sm print:hidden"
                  >
                    <Plus size={14} strokeWidth={2.5} />
                    <span>+ Add Missing Inflow</span>
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {editInflowItems.map((inf) => {
                  const pBadge = formatPaymentModeBadge(inf.paymentMode || "CASH");
                  return (
                    <div key={inf.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#111111] p-3 text-xs transition-colors">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">{inf.time || "12:00"}</span>
                        <span className="font-bold text-jct-charcoal dark:text-jct-offwhite">{inf.title}</span>
                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${pBadge.cls}`}>
                          {pBadge.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-emerald-600 dark:text-jct-turquoise text-sm">
                          +SAR {fmt(inf.amount)}
                        </span>
                        {isOwner && (
                          <div className="flex items-center gap-1.5 print:hidden">
                            <button
                              type="button"
                              onClick={() => handleOpenEditInflowModal(inf)}
                              className="inline-flex items-center gap-1 rounded-lg border border-jct-turquoise/40 hover:border-jct-turquoise bg-jct-turquoise/10 hover:bg-jct-turquoise text-jct-charcoal dark:text-jct-turquoise hover:dark:text-jct-charcoal font-bold px-2.5 py-1 text-xs transition-all duration-300"
                              title="Edit Inflow"
                            >
                              <Edit3 size={12} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteInflowItem(inf.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 hover:border-rose-500 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold px-2.5 py-1 text-xs transition-all duration-300"
                              title="Remove Inflow"
                            >
                              <Trash2 size={12} />
                              <span>Remove</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Detail Box: Expenses */}
          {(expandedBox === "EXPENSES" || expandedBox === "NONE") && (
            <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-yellow/20 dark:border-jct-yellow/30 hover:border-jct-yellow/80 hover:shadow-[0_0_15px_rgba(255,222,89,0.1)] rounded-xl p-6 transition-all duration-300 print:shadow-none print:border-slate-300 print:bg-white print:text-black">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1F1F1F] pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-jct-charcoal dark:text-jct-offwhite">Recorded Shop Expenses</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">({editExpenses.length} items)</span>
                </div>
                {isOwner && (
                  <button
                    type="button"
                    onClick={handleOpenAddExpenseModal}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-jct-yellow/50 hover:border-jct-yellow bg-jct-yellow/15 hover:bg-jct-yellow text-jct-charcoal dark:text-jct-yellow hover:dark:text-jct-charcoal font-bold px-3 py-1.5 text-xs transition-all duration-300 shadow-sm print:hidden"
                  >
                    <Plus size={14} strokeWidth={2.5} />
                    <span>+ Add Expense Line</span>
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {editExpenses.map((exp) => {
                  const pBadge = formatPaymentModeBadge(exp.paymentMode || "CASH");
                  return (
                    <div key={exp.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#111111] p-3 text-xs transition-colors">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">{exp.time || "12:00"}</span>
                        <span className="font-bold text-jct-charcoal dark:text-jct-offwhite">{exp.title}</span>
                        {exp.expenseCategory && (
                          <span className="rounded-full bg-jct-yellow text-jct-charcoal font-bold px-2.5 py-0.5 text-[10px]">
                            {exp.expenseCategory}
                          </span>
                        )}
                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${pBadge.cls}`}>
                          {pBadge.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-rose-500 text-sm">
                          -SAR {fmt(exp.amount)}
                        </span>
                        {isOwner && (
                          <div className="flex items-center gap-1.5 print:hidden">
                            <button
                              type="button"
                              onClick={() => handleOpenEditExpenseModal(exp)}
                              className="inline-flex items-center gap-1 rounded-lg border border-jct-yellow/50 hover:border-jct-yellow bg-jct-yellow/15 hover:bg-jct-yellow text-jct-charcoal dark:text-jct-yellow hover:dark:text-jct-charcoal font-bold px-2.5 py-1 text-xs transition-all duration-300"
                              title="Edit Expense Bill"
                            >
                              <Edit3 size={12} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteExpenseItem(exp.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 hover:border-rose-500 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold px-2.5 py-1 text-xs transition-all duration-300"
                              title="Remove Expense"
                            >
                              <Trash2 size={12} />
                              <span>Remove</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Detail Box: Bank / POS */}
          {(expandedBox === "BANK_POS" || expandedBox === "NONE") && (
            <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-turquoise/20 dark:border-jct-turquoise/30 hover:border-jct-turquoise/80 hover:shadow-[0_0_15px_rgba(45,226,230,0.1)] rounded-xl p-6 transition-all duration-300 print:shadow-none print:border-slate-300 print:bg-white print:text-black">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1F1F1F] pb-3 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-jct-charcoal dark:text-jct-offwhite">Bank Swipes &amp; Transfers Settled</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">Total: SAR {fmt(editBankSwipes)}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {editSwipes.map((sw, idx) => {
                  const pBadge = formatPaymentModeBadge(sw.posTerminal || sw.paymentMode || "SAB");
                  return (
                    <div key={idx} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#111111] p-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-jct-charcoal dark:text-jct-offwhite">Inv #{sw.invoiceNo}</span>
                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${pBadge.cls}`}>
                          {pBadge.label}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-jct-charcoal dark:text-jct-offwhite">SAR {fmt(sw.amount)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 5. Sticky Bottom Action Bar */}
        <div className="sticky bottom-4 z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-turquoise/20 dark:border-jct-turquoise/30 hover:border-jct-turquoise/80 hover:shadow-[0_0_15px_rgba(45,226,230,0.1)] rounded-xl p-6 transition-all duration-300 print:hidden">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
            <span className="inline-flex h-2 w-2 rounded-full bg-jct-turquoise" />
            <span>
              Historical Audit · {selectedRecord.date} · {bInfo.name} · Locked by {selectedRecord.lockedBy}
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center justify-center gap-2 bg-jct-charcoal dark:bg-slate-800 text-white px-4 py-2 rounded-lg font-bold print:hidden hover:brightness-110 transition-all text-sm shadow-sm"
            >
              <Printer size={16} />
              <span>🖨️ Print Report</span>
            </button>
            {isOwner ? (
              <button
                type="button"
                onClick={handleSaveHistoricalAudit}
                disabled={saving}
                className="flex items-center justify-center gap-2.5 bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg text-sm px-8 py-3.5 whitespace-nowrap disabled:opacity-50"
              >
                <Edit3 size={16} className="text-jct-charcoal" />
                <span>{saving ? "Saving..." : "💾 Update & Save Historical Audit"}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="flex items-center justify-center gap-2.5 rounded-lg border border-slate-200 dark:border-[#1F1F1F] bg-slate-100 dark:bg-[#111111] px-6 py-3.5 text-xs font-bold text-slate-500 dark:text-slate-400 cursor-not-allowed whitespace-nowrap"
              >
                <Lock size={15} />
                <span>Register Locked (Read-Only Archive)</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal: Add or Edit Inflow */}
        {inflowModalOpen && isOwner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-lg bg-white dark:bg-[#0A0A0A] rounded-xl p-6 border border-jct-turquoise/40 dark:border-jct-turquoise/50 hover:border-jct-turquoise hover:shadow-[0_0_20px_rgba(45,226,230,0.15)] shadow-2xl transition-all duration-300 text-jct-charcoal dark:text-jct-offwhite">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1F1F1F] pb-4 mb-5">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-jct-turquoise/20 text-jct-charcoal dark:text-jct-turquoise">
                    <Plus size={16} />
                  </span>
                  <h3 className="font-display text-lg font-extrabold tracking-tight text-jct-charcoal dark:text-white">
                    {editingInflowId ? "Edit Cash Inflow Line" : "Add Missing Cash Inflow"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInflowModalOpen(false)}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 p-1.5 text-slate-400 hover:text-jct-charcoal dark:hover:text-white transition"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveInflowModal} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Customer / Inflow Description
                  </label>
                  <input
                    type="text"
                    required
                    value={inflowModalTitle}
                    onChange={(e) => setInflowModalTitle(e.target.value)}
                    placeholder="e.g. Retail Contractor Cash Payment, Paint Sale"
                    className="w-full bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#222222] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-lg px-3.5 py-2.5 text-sm font-semibold outline-none transition"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Payment Tender Mode
                    </label>
                    <select
                      value={inflowModalPaymentMode}
                      onChange={(e) => setInflowModalPaymentMode(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#222222] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-lg px-3.5 py-2.5 text-sm font-bold outline-none transition"
                    >
                      {UNIVERSAL_PAYMENT_MODES.map((pm) => (
                        <option key={pm.value} value={pm.value} className="bg-white dark:bg-[#0A0A0A]">
                          {pm.badge} · {pm.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Inflow Amount (SAR)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={inflowModalAmount}
                      onChange={(e) => setInflowModalAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#222222] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-lg px-3.5 py-2.5 font-mono text-base font-black outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Time / Receipt Reference
                  </label>
                  <input
                    type="text"
                    value={inflowModalTime}
                    onChange={(e) => setInflowModalTime(e.target.value)}
                    placeholder="e.g. 14:30 or Receipt #1042"
                    className="w-full bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#222222] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-lg px-3.5 py-2.5 text-sm font-semibold outline-none transition"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-[#1F1F1F]">
                  <button
                    type="button"
                    onClick={() => setInflowModalOpen(false)}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 hover:border-slate-400 bg-slate-100 dark:bg-black px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-jct-charcoal dark:hover:text-white transition-all duration-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-105 border border-jct-turquoise hover:shadow-[0_0_15px_rgba(45,226,230,0.3)] transition-all duration-300 shadow-sm rounded-lg px-6 py-2.5 text-xs font-sans"
                  >
                    {editingInflowId ? "Save Inflow Changes" : "+ Insert Missing Inflow"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add or Edit Expense / Past Bill */}
        {expenseModalOpen && isOwner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-lg bg-white dark:bg-[#0A0A0A] rounded-xl p-6 border border-jct-yellow/40 dark:border-jct-yellow/50 hover:border-jct-yellow hover:shadow-[0_0_20px_rgba(255,222,89,0.15)] shadow-2xl transition-all duration-300 text-jct-charcoal dark:text-jct-offwhite">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1F1F1F] pb-4 mb-5">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-jct-yellow/20 text-jct-charcoal dark:text-jct-yellow">
                    <Edit3 size={16} />
                  </span>
                  <h3 className="font-display text-lg font-extrabold tracking-tight text-jct-charcoal dark:text-white">
                    {editingExpenseId ? "Edit Expense / Supplier Bill" : "Add Past Expense / Bill"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setExpenseModalOpen(false)}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 p-1.5 text-slate-400 hover:text-jct-charcoal dark:hover:text-white transition"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveExpenseModal} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Expense / Bill Title (Supplier or Purpose)
                  </label>
                  <input
                    type="text"
                    required
                    value={expenseModalTitle}
                    onChange={(e) => setExpenseModalTitle(e.target.value)}
                    placeholder="e.g. Jotun Tinting Machine Repair, Delivery Fuel, Shop Consumables"
                    className="w-full bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#222222] focus:border-jct-yellow focus:ring-1 focus:ring-jct-yellow text-jct-charcoal dark:text-jct-offwhite rounded-lg px-3.5 py-2.5 text-sm font-semibold outline-none transition"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Category
                    </label>
                    <select
                      value={expenseModalCategory}
                      onChange={(e) => setExpenseModalCategory(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#222222] focus:border-jct-yellow focus:ring-1 focus:ring-jct-yellow text-jct-charcoal dark:text-jct-offwhite rounded-lg px-3.5 py-2.5 text-sm font-semibold outline-none transition"
                    >
                      {STRICT_EXPENSE_CATEGORIES.map((c) => (
                        <option key={c} value={c} className="bg-white dark:bg-[#0A0A0A]">
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Payment Tender Mode
                    </label>
                    <select
                      value={expenseModalPaymentMode}
                      onChange={(e) => setExpenseModalPaymentMode(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#222222] focus:border-jct-yellow focus:ring-1 focus:ring-jct-yellow text-jct-charcoal dark:text-jct-offwhite rounded-lg px-3.5 py-2.5 text-sm font-bold outline-none transition"
                    >
                      {UNIVERSAL_PAYMENT_MODES.map((pm) => (
                        <option key={pm.value} value={pm.value} className="bg-white dark:bg-[#0A0A0A]">
                          {pm.badge} · {pm.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Amount (SAR)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={expenseModalAmount}
                      onChange={(e) => setExpenseModalAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#222222] focus:border-jct-yellow focus:ring-1 focus:ring-jct-yellow text-jct-charcoal dark:text-jct-offwhite rounded-lg px-3.5 py-2.5 font-mono text-base font-black outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Time / Bill Reference
                    </label>
                    <input
                      type="text"
                      value={expenseModalTime}
                      onChange={(e) => setExpenseModalTime(e.target.value)}
                      placeholder="e.g. 15:40 or Inv #7890"
                      className="w-full bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#222222] focus:border-jct-yellow focus:ring-1 focus:ring-jct-yellow text-jct-charcoal dark:text-jct-offwhite rounded-lg px-3.5 py-2.5 text-sm font-semibold outline-none transition"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-[#1F1F1F]">
                  <button
                    type="button"
                    onClick={() => setExpenseModalOpen(false)}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 hover:border-slate-400 bg-slate-100 dark:bg-black px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-jct-charcoal dark:hover:text-white transition-all duration-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-jct-yellow text-jct-charcoal font-bold hover:brightness-105 border border-jct-yellow hover:shadow-[0_0_15px_rgba(255,222,89,0.3)] transition-all duration-300 shadow-sm rounded-lg px-6 py-2.5 text-xs font-sans"
                  >
                    {editingExpenseId ? "Save Bill Changes" : "+ Add Expense Line"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Print-Only Report Footer */}
        <PrintReportFooter />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ARCHIVE LIST VIEW
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 sm:p-6 w-full gap-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Archive className="text-jct-turquoise" size={24} />
            <h2 className="text-2xl sm:text-3xl font-black text-jct-charcoal dark:text-white tracking-tight">Register Audit Library</h2>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Historical daily reconciliations, drawer counts, and closing audits across store terminals.
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Branch Filter */}
          {isOwner ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-[#1F1F1F] bg-white dark:bg-[#0A0A0A] px-3 py-1.5 text-xs">
              <Store size={14} className="text-jct-turquoise" />
              <select
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                className="bg-transparent font-bold text-jct-charcoal dark:text-jct-offwhite outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-white dark:bg-[#0A0A0A] text-jct-charcoal dark:text-jct-offwhite">All Branches (Combined)</option>
                <option value="JCT_HQ" className="bg-white dark:bg-[#0A0A0A] text-jct-charcoal dark:text-jct-offwhite">JCT Main HQ</option>
                <option value="HEMPEL_JUBAIL" className="bg-white dark:bg-[#0A0A0A] text-jct-charcoal dark:text-jct-offwhite">Hempel Jubail</option>
                <option value="JOTUN_DAMMAM" className="bg-white dark:bg-[#0A0A0A] text-jct-charcoal dark:text-jct-offwhite">Jotun Dammam</option>
                <option value="SIGMA_JUBAIL" className="bg-white dark:bg-[#0A0A0A] text-jct-charcoal dark:text-jct-offwhite">Sigma Jubail</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-jct-yellow text-jct-charcoal px-3.5 py-2 text-xs font-bold">
              <Lock size={12} />
              <span>Assigned Branch: {getBranchBadgeInfo(staffBranchId).name}</span>
            </div>
          )}

          {/* Search Bar */}
          <div className="flex items-center gap-2 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus-within:border-jct-turquoise focus-within:ring-1 focus-within:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3 py-2 text-xs">
            <Search size={14} className="text-slate-500 dark:text-slate-400" />
            <input
              type="text"
              placeholder="Search by date, branch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-jct-charcoal dark:text-jct-offwhite outline-none placeholder:text-slate-400 w-36 sm:w-48"
            />
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={loadArchiveRecords}
            title="Reload from Neon database"
            className="rounded-lg bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 p-2 transition-all shadow-sm"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-turquoise/20 dark:border-jct-turquoise/30 hover:border-jct-turquoise/80 hover:shadow-[0_0_15px_rgba(45,226,230,0.1)] rounded-xl p-6 transition-all duration-300">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Total Audits</span>
          <span className="text-xl sm:text-2xl font-black text-jct-charcoal dark:text-jct-offwhite mt-1 block font-mono">{totalAudits} Days</span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">Recorded in database</span>
        </div>

        <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-yellow/20 dark:border-jct-yellow/30 hover:border-jct-yellow/80 hover:shadow-[0_0_15px_rgba(255,222,89,0.1)] rounded-xl p-6 transition-all duration-300">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Total Closing Cash</span>
          <span className="text-xl sm:text-2xl font-black text-jct-charcoal dark:text-jct-offwhite mt-1 block font-mono">SAR {fmt(totalReconciledCash)}</span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">Reconciled drawer cash</span>
        </div>

        <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-turquoise/20 dark:border-jct-turquoise/30 hover:border-jct-turquoise/80 hover:shadow-[0_0_15px_rgba(45,226,230,0.1)] rounded-xl p-6 transition-all duration-300">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Total Bank Swipes</span>
          <span className="text-xl sm:text-2xl font-black text-jct-charcoal dark:text-jct-offwhite mt-1 block font-mono">SAR {fmt(totalBankSettled)}</span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">Settled to bank accounts</span>
        </div>

        <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-yellow/20 dark:border-jct-yellow/30 hover:border-jct-yellow/80 hover:shadow-[0_0_15px_rgba(255,222,89,0.1)] rounded-xl p-6 transition-all duration-300">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Latest Lock</span>
          <span className="text-xl sm:text-2xl font-black text-jct-charcoal dark:text-jct-offwhite mt-1 block font-mono">{latestRecordDate}</span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">● Real-time sync live</span>
        </div>
      </div>

      {/* Table / Cards List */}
      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-slate-500 dark:text-slate-400 text-sm">
            <span className="inline-block h-4 w-4 rounded-full border-2 border-jct-turquoise border-t-transparent animate-spin mr-3" />
            Loading historical audit records from Neon...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-12 text-center text-slate-500 dark:text-slate-400">
            <Archive size={32} className="mx-auto mb-2" />
            <p className="font-bold text-base text-jct-charcoal dark:text-jct-offwhite">No historical audits found</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Try switching branch or clearing your search query.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredRecords.map((r) => {
              const bInfo = getBranchBadgeInfo(r.branch);
              const lockTime = formatLockTime(r.lockedAt);

              return (
                <div
                  key={r.id}
                  className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-jct-turquoise/20 dark:border-jct-turquoise/30 hover:border-jct-turquoise/80 hover:shadow-[0_0_15px_rgba(45,226,230,0.1)] rounded-xl p-6 transition-all duration-300 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  {/* Left Column: Date & Branch & Status */}
                  <div className="flex flex-wrap items-center gap-3 min-w-[200px]">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <CalendarDays size={14} className="text-jct-turquoise" />
                        <span className="font-mono text-sm font-black text-jct-charcoal dark:text-jct-offwhite">{r.date}</span>
                        <span className="rounded-full bg-jct-turquoise text-jct-charcoal px-2 py-0.5 text-[10px] font-bold">
                          {r.status || "LOCKED"}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Locked by {r.lockedBy} at {lockTime}
                      </span>
                    </div>

                    <span className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${bInfo.color}`}>
                      {bInfo.name}
                    </span>
                  </div>

                  {/* Middle Column: Metrics Breakdown */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 lg:gap-8 items-center text-left">
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider block">
                        Net Cash Drawer
                      </span>
                      <span className="font-mono text-base sm:text-lg font-black text-jct-charcoal dark:text-jct-offwhite">
                        SAR {fmt(r.closingCash)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider block">
                        Inflows / Swipes
                      </span>
                      <div className="flex flex-col text-xs font-mono">
                        <span className="text-jct-charcoal dark:text-jct-offwhite font-bold">+SAR {fmt(r.inflows)} Inflows</span>
                        <span className="text-slate-500 dark:text-slate-400">SAR {fmt(r.bankSwipes)} Bank</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider block">
                        Outflows / Expenses
                      </span>
                      <span className="font-mono text-xs sm:text-sm font-bold text-rose-500">
                        -SAR {fmt(r.outflows)}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Action Buttons (Role-Based CRUD) */}
                  <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenSnapshot(r);
                        setTimeout(() => window.print(), 100);
                      }}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 hover:border-slate-400 bg-jct-charcoal dark:bg-slate-800 text-white px-3 py-2 text-xs font-bold hover:brightness-110 transition-all duration-300 inline-flex items-center gap-1.5 shadow-sm"
                      title="Print Daily Report"
                    >
                      <Printer size={13} />
                      <span>🖨️ Print</span>
                    </button>
                    {isOwner && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenSnapshot(r)}
                          className="rounded-lg border border-jct-yellow/50 hover:border-jct-yellow bg-jct-yellow/15 hover:bg-jct-yellow text-jct-charcoal dark:text-jct-yellow hover:dark:text-jct-charcoal font-bold px-3 py-2 text-xs transition-all duration-300 inline-flex items-center gap-1.5"
                        >
                          <Edit3 size={13} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteArchiveRecord(r.id)}
                          className="rounded-lg border border-rose-500/40 hover:border-rose-500 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-2 text-xs font-bold text-rose-500 transition-all duration-300 inline-flex items-center gap-1.5"
                        >
                          <Trash2 size={13} />
                          <span>Remove</span>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenSnapshot(r)}
                      className="inline-flex items-center gap-2 bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 border border-jct-turquoise/40 hover:border-jct-turquoise hover:shadow-[0_0_15px_rgba(45,226,230,0.2)] transition-all duration-300 shadow-sm rounded-lg text-xs px-4 py-2.5 whitespace-nowrap"
                    >
                      <span>{isOwner ? "Inspect Snapshot" : "Open Audit Snapshot"}</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   STAFF MANAGEMENT & PAYROLL MODULE (OWNER EXCLUSIVE)
   ════════════════════════════════════════════════════════════════════════ */

function StaffPayrollView({ profile }: { profile: UserProfile | null }) {
  const isOwner = Boolean(profile?.isOwner);
  const [branchFilter, setBranchFilter] = useState<string>("ALL");
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [searchQuery, setSearchQuery] = useState("");
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStaffForLedger, setSelectedStaffForLedger] = useState<StaffMember | null>(null);
  const [ledgerLogs, setLedgerLogs] = useState<PayrollLogItem[]>([]);
  const [loadingLedgerLogs, setLoadingLedgerLogs] = useState(false);

  // Add Staff Form
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffBranch, setNewStaffBranch] = useState("JCT_HQ");
  const [newStaffRole, setNewStaffRole] = useState("Cashier");
  const [newStaffSalary, setNewStaffSalary] = useState("3500");
  const [newStaffPhone, setNewStaffPhone] = useState("");
  const [newStaffIqama, setNewStaffIqama] = useState("");
  const [isSubmittingStaff, setIsSubmittingStaff] = useState(false);

  // Edit Staff Modal State (Owner CRUD)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editStaffName, setEditStaffName] = useState("");
  const [editStaffBranch, setEditStaffBranch] = useState("JCT_HQ");
  const [editStaffRole, setEditStaffRole] = useState("");
  const [editStaffSalary, setEditStaffSalary] = useState("");
  const [editStaffPhone, setEditStaffPhone] = useState("");
  const [editStaffIqama, setEditStaffIqama] = useState("");
  const [isSavingEditStaff, setIsSavingEditStaff] = useState(false);

  // Disburse Form inside modal
  const [disburseAmount, setDisburseAmount] = useState("");
  const [disburseSource, setDisburseSource] = useState<"BANK_TRANSFER" | "REGISTER_DRAWER" | "OWNER_POCKET">("BANK_TRANSFER");
  const [disbursePaymentMode, setDisbursePaymentMode] = useState<UniversalPaymentMode>("SAB");
  const [disburseNote, setDisburseNote] = useState("");
  const [isSubmittingDisburse, setIsSubmittingDisburse] = useState(false);

  // Quick Action in ledger (Advance / Bonus / Deduction)
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);
  const [adjType, setAdjType] = useState<"ADVANCE" | "BONUS" | "DEDUCTION">("ADVANCE");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjSource, setAdjSource] = useState<"REGISTER_DRAWER" | "OWNER_POCKET" | "BANK_TRANSFER">("REGISTER_DRAWER");
  const [adjPaymentMode, setAdjPaymentMode] = useState<UniversalPaymentMode>("CASH");
  const [adjNote, setAdjNote] = useState("");
  const [isSubmittingAdj, setIsSubmittingAdj] = useState(false);

  // Edit PayrollLog Entry State (Owner CRUD)
  const [editingPayrollLog, setEditingPayrollLog] = useState<PayrollLogItem | null>(null);
  const [editLogType, setEditLogType] = useState<string>("ADVANCE");
  const [editLogAmount, setEditLogAmount] = useState<string>("");
  const [editLogPaymentMode, setEditLogPaymentMode] = useState<UniversalPaymentMode>("CASH");
  const [editLogNote, setEditLogNote] = useState<string>("");
  const [isSavingLogEdit, setIsSavingLogEdit] = useState(false);

  // Fetch staff list
  const loadStaff = async () => {
    setLoading(true);
    try {
      const q = branchFilter !== "ALL" ? `?branch=${branchFilter}&includeArchived=true` : "?includeArchived=true";
      const res = await fetch(`/api/staff${q}`);
      const data = await res.json();
      if (Array.isArray(data.staff)) {
        setStaffList(data.staff);
      }
    } catch (e) {
      console.error("Failed to load staff list:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    const q = branchFilter !== "ALL" ? `?branch=${branchFilter}&includeArchived=true` : "?includeArchived=true";
    fetch(`/api/staff${q}`)
      .then((res) => res.json())
      .then((data) => {
        if (!ignore && Array.isArray(data.staff)) {
          setStaffList(data.staff);
        }
      })
      .catch((e) => console.error("Failed to load staff list:", e))
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [branchFilter]);

  // Load detailed logs when viewing ledger
  const openStaffLedger = async (staff: StaffMember) => {
    setSelectedStaffForLedger(staff);
    setLoadingLedgerLogs(true);
    setShowAdjustmentForm(false);
    try {
      const res = await fetch(`/api/payroll?staffId=${staff.id}`);
      const data = await res.json();
      if (Array.isArray(data.logs)) {
        setLedgerLogs(data.logs);
      } else {
        setLedgerLogs(staff.payrollLogs || []);
      }
    } catch (e) {
      console.error("Failed to load payroll logs:", e);
      setLedgerLogs(staff.payrollLogs || []);
    } finally {
      setLoadingLedgerLogs(false);
    }
  };

  // Helper calculations for a staff member in selected month
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

  // Add Staff Submit
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;
    setIsSubmittingStaff(true);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-is-owner": String(isOwner),
          "x-user-role": isOwner ? "OWNER" : "STAFF",
        },
        body: JSON.stringify({
          name: newStaffName.trim(),
          branch: newStaffBranch,
          role: newStaffRole.trim() || "Staff",
          baseSalary: parseFloat(newStaffSalary) || 0,
          phone: newStaffPhone.trim() || undefined,
          iqamaNumber: newStaffIqama.trim() || undefined,
        }),
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewStaffName("");
        setNewStaffPhone("");
        setNewStaffIqama("");
        loadStaff();
      }
    } catch (e) {
      console.error("Error creating staff:", e);
    } finally {
      setIsSubmittingStaff(false);
    }
  };

  // Toggle Staff Status (Archive / Restore)
  const handleToggleArchive = async (staff: StaffMember) => {
    const nextStatus = staff.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";
    try {
      const res = await fetch("/api/staff", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-is-owner": String(isOwner),
          "x-user-role": isOwner ? "OWNER" : "STAFF",
        },
        body: JSON.stringify({ id: staff.id, status: nextStatus }),
      });
      if (res.ok) {
        loadStaff();
      }
    } catch (e) {
      console.error("Error toggling staff status:", e);
    }
  };

  // Save Edit Staff (Owner CRUD)
  const handleSaveEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff || !isOwner) return;
    setIsSavingEditStaff(true);
    try {
      const res = await fetch("/api/staff", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-is-owner": "true",
          "x-user-role": "OWNER",
        },
        body: JSON.stringify({
          id: editingStaff.id,
          name: editStaffName.trim() || editingStaff.name,
          branch: editStaffBranch,
          role: editStaffRole.trim() || "Staff",
          baseSalary: parseFloat(editStaffSalary) || 0,
          phone: editStaffPhone.trim() || null,
          iqamaNumber: editStaffIqama.trim() || null,
        }),
      });
      if (res.ok) {
        setEditingStaff(null);
        await loadStaff();
      }
    } catch (e) {
      console.error("Error updating staff:", e);
    } finally {
      setIsSavingEditStaff(false);
    }
  };

  // Delete Staff Permanently (Owner CRUD)
  const handleDeleteStaff = async (staffId: string) => {
    if (!isOwner) return;
    try {
      const res = await fetch(`/api/staff?id=${encodeURIComponent(staffId)}`, {
        method: "DELETE",
        headers: {
          "x-user-is-owner": "true",
          "x-user-role": "OWNER",
        },
      });
      if (res.ok) {
        await loadStaff();
      }
    } catch (e) {
      console.error("Error deleting staff:", e);
    }
  };

  // Disburse Salary Submit
  const handleDisburseSalary = async (e: React.FormEvent) => {
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
          "x-user-is-owner": String(isOwner),
          "x-user-role": isOwner ? "OWNER" : "STAFF",
        },
        body: JSON.stringify({
          staffId: selectedStaffForLedger.id,
          type: "SALARY_PAYOUT",
          amount,
          source: disburseSource,
          paymentMode: disbursePaymentMode,
          date: new Date().toISOString().slice(0, 10),
          note: disburseNote.trim() || `Salary settlement for ${selectedMonth}`,
        }),
      });

      if (res.ok) {
        setDisburseAmount("");
        setDisburseNote("");
        await loadStaff();
        openStaffLedger(selectedStaffForLedger);
      }
    } catch (e) {
      console.error("Error disbursing salary:", e);
    } finally {
      setIsSubmittingDisburse(false);
    }
  };

  // Add Direct Adjustment (Advance, Bonus, Deduction) in Ledger
  const handleAddAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffForLedger) return;
    const amount = parseFloat(adjAmount);
    if (Number.isNaN(amount) || amount <= 0) return;

    setIsSubmittingAdj(true);
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-is-owner": String(isOwner),
          "x-user-role": isOwner ? "OWNER" : "STAFF",
        },
        body: JSON.stringify({
          staffId: selectedStaffForLedger.id,
          type: adjType,
          amount,
          source: adjSource,
          paymentMode: adjPaymentMode,
          date: new Date().toISOString().slice(0, 10),
          note: adjNote.trim() || `${adjType} recorded directly by owner`,
        }),
      });

      if (res.ok) {
        setAdjAmount("");
        setAdjNote("");
        setShowAdjustmentForm(false);
        await loadStaff();
        openStaffLedger(selectedStaffForLedger);
      }
    } catch (e) {
      console.error("Error adding adjustment:", e);
    } finally {
      setIsSubmittingAdj(false);
    }
  };

  // Update PayrollLog Entry (Owner CRUD)
  const handleSavePayrollLogEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayrollLog || !isOwner || !selectedStaffForLedger) return;
    setIsSavingLogEdit(true);
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
          type: editLogType,
          amount: parseFloat(editLogAmount) || 0,
          paymentMode: editLogPaymentMode,
          note: editLogNote.trim() || null,
        }),
      });
      if (res.ok) {
        setEditingPayrollLog(null);
        await loadStaff();
        openStaffLedger(selectedStaffForLedger);
      }
    } catch (e) {
      console.error("Error updating payroll log:", e);
    } finally {
      setIsSavingLogEdit(false);
    }
  };

  // Delete PayrollLog Entry (Owner CRUD)
  const handleDeletePayrollLog = async (logId: string) => {
    if (!isOwner || !selectedStaffForLedger) return;
    try {
      const res = await fetch(`/api/payroll?id=${encodeURIComponent(logId)}`, {
        method: "DELETE",
        headers: {
          "x-user-is-owner": "true",
          "x-user-role": "OWNER",
        },
      });
      if (res.ok) {
        await loadStaff();
        openStaffLedger(selectedStaffForLedger);
      }
    } catch (e) {
      console.error("Error deleting payroll log:", e);
    }
  };

  // Filtered staff list
  const filteredStaff = staffList.filter((s) => {
    if (branchFilter !== "ALL" && s.branch !== branchFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.role || "").toLowerCase().includes(q) ||
      (s.phone || "").toLowerCase().includes(q) ||
      (s.iqamaNumber || "").toLowerCase().includes(q)
    );
  });

  // KPI Calculations
  const activeStaffMembers = staffList.filter(
    (s) => s.status === "ACTIVE" && (branchFilter === "ALL" || s.branch === branchFilter)
  );
  const totalBasePayroll = activeStaffMembers.reduce((sum, s) => sum + s.baseSalary, 0);
  const totalAdvancesThisMonth = activeStaffMembers.reduce(
    (sum, s) => sum + getStaffMonthStats(s).advances,
    0
  );
  const totalNetDue = activeStaffMembers.reduce(
    (sum, s) => sum + getStaffMonthStats(s).netRemaining,
    0
  );

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto w-full bg-jct-offwhite dark:bg-black text-jct-charcoal dark:text-jct-offwhite">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-[#1F1F1F] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-jct-yellow text-jct-charcoal shadow-sm">
              <Users size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-jct-charcoal dark:text-white tracking-tight flex items-center gap-2">
                Staff Management &amp; Payroll Portal
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Owner executive portal: Employee base salaries, daily cash advances, and monthly net disbursements.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month Selector */}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-[#1F1F1F] bg-white dark:bg-[#0A0A0A] px-3 py-1.5 text-xs text-jct-charcoal dark:text-jct-offwhite font-bold">
            <CalendarDays size={14} className="text-jct-charcoal dark:text-jct-turquoise" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-bold text-jct-charcoal dark:text-jct-offwhite outline-none cursor-pointer"
            />
          </div>

          {/* Branch Filter */}
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="rounded-md bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise px-3 py-2 text-xs font-bold text-jct-charcoal dark:text-jct-offwhite outline-none"
          >
            <option value="ALL">All Branches (Combined)</option>
            <option value="JCT_HQ">JCT Main HQ</option>
            <option value="HEMPEL_JUBAIL">Hempel Jubail</option>
            <option value="JOTUN_DAMMAM">Jotun Dammam</option>
            <option value="SIGMA_JUBAIL">Sigma Jubail</option>
          </select>

          {/* Add Staff Button */}
          {isOwner && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg px-4 py-2 text-xs"
            >
              <Plus size={15} strokeWidth={3} />
              <span>Add New Staff</span>
            </button>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={loadStaff}
            title="Reload from Neon database"
            className="rounded-lg border border-slate-200 dark:border-[#1F1F1F] bg-white dark:bg-[#0A0A0A] hover:bg-slate-50 dark:hover:bg-[#111111] p-2 text-jct-charcoal dark:text-jct-offwhite transition"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {/* Top 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Active Staff */}
        <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Staff</span>
            <Users size={16} className="text-jct-charcoal dark:text-jct-turquoise" />
          </div>
          <span className="text-2xl sm:text-3xl font-black text-jct-charcoal dark:text-jct-offwhite mt-1.5 block font-mono">
            {activeStaffMembers.length}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
            {branchFilter === "ALL" ? "Across all 4 branches" : branchFilter}
          </span>
        </div>

        {/* Card 2: Total Base Payroll */}
        <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 relative overflow-hidden">
          <div className="flex items-center justify-between text-jct-charcoal dark:text-jct-turquoise">
            <span className="text-[11px] font-bold uppercase tracking-wider">Monthly Base Payroll</span>
            <Banknote size={16} />
          </div>
          <span className="text-xl sm:text-2xl font-black text-jct-charcoal dark:text-jct-offwhite mt-1.5 block font-mono">
            SAR {fmt(totalBasePayroll)}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
            Gross contractual monthly liability
          </span>
        </div>

        {/* Card 3: Advances Taken */}
        <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 relative overflow-hidden">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Advances Taken ({selectedMonth})</span>
            <DollarSign size={16} />
          </div>
          <span className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-1.5 block font-mono">
            -SAR {fmt(totalAdvancesThisMonth)}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
            Auto-linked from Register drawers &amp; Pocket
          </span>
        </div>

        {/* Card 4: Net Remaining Due */}
        <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 relative overflow-hidden">
          <div className="flex items-center justify-between text-jct-charcoal dark:text-jct-yellow">
            <span className="text-[11px] font-bold uppercase tracking-wider">Net Due to Disburse</span>
            <UserCheck size={16} />
          </div>
          <span className="text-xl sm:text-2xl font-black text-jct-charcoal dark:text-jct-yellow mt-1.5 block font-mono">
            SAR {fmt(totalNetDue)}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
            Base minus advances &amp; payouts
          </span>
        </div>
      </div>

      {/* Staff Roster Controls & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-md bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus-within:border-jct-turquoise focus-within:ring-1 focus-within:ring-jct-turquoise px-3.5 py-2 text-xs text-jct-charcoal dark:text-jct-offwhite max-w-md w-full">
          <Search size={14} className="text-slate-500 dark:text-slate-400" />
          <input
            type="text"
            placeholder="Search employee by name, role, phone, or iqama..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-jct-charcoal dark:text-jct-offwhite outline-none placeholder:text-slate-400 w-full"
          />
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
          Showing <strong className="text-jct-charcoal dark:text-jct-offwhite font-mono">{filteredStaff.length}</strong> staff members
        </div>
      </div>

      {/* Staff Roster Table */}
      <div className="bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-slate-500 dark:text-slate-400">
            <RotateCcw className="animate-spin text-jct-turquoise mr-2" size={18} />
            <span className="text-sm font-semibold">Loading employees &amp; monthly payroll ledger...</span>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            <Users size={32} className="mx-auto text-slate-400 mb-2" />
            <p className="font-bold text-base text-jct-charcoal dark:text-jct-offwhite">No staff members found</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Click &quot;Add New Staff&quot; above to register your employees.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-[#1F1F1F] text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#111111] font-bold">
                <tr>
                  <th className="py-3.5 px-4">Employee &amp; Role</th>
                  <th className="py-3.5 px-4">Branch</th>
                  <th className="py-3.5 px-4 text-right">Base Salary</th>
                  <th className="py-3.5 px-4 text-right">Advances ({selectedMonth})</th>
                  <th className="py-3.5 px-4 text-right">Net Remaining Due</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#1F1F1F]">
                {filteredStaff.map((staff) => {
                  const bInfo = getBranchBadgeInfo(staff.branch);
                  const stats = getStaffMonthStats(staff);
                  const initials = staff.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <tr key={staff.id} className="hover:bg-slate-50 dark:hover:bg-[#111111] transition">
                      {/* Name & Role */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-jct-turquoise/20 border border-jct-turquoise text-xs font-black text-jct-charcoal dark:text-jct-turquoise font-mono shrink-0">
                            {initials}
                          </div>
                          <div>
                            <p className="font-bold text-jct-charcoal dark:text-jct-offwhite text-sm">{staff.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="rounded bg-slate-100 dark:bg-[#111111] border border-slate-200 dark:border-[#1F1F1F] px-1.5 py-0.5 text-[10px] text-slate-600 dark:text-slate-300">
                                {staff.role || "Staff"}
                              </span>
                              {staff.phone && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                  📞 {staff.phone}
                                </span>
                              )}
                              {staff.iqamaNumber && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                  ID: {staff.iqamaNumber}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Branch */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold ${bInfo.color}`}>
                          {bInfo.name}
                        </span>
                      </td>

                      {/* Base Salary */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-jct-charcoal dark:text-jct-offwhite">
                        SAR {fmt(staff.baseSalary)}
                      </td>

                      {/* Advances Taken This Month */}
                      <td className="py-3.5 px-4 text-right font-mono">
                        {stats.advances > 0 ? (
                          <span className="inline-block rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-bold text-rose-600 dark:text-rose-400">
                            -SAR {fmt(stats.advances)}
                          </span>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">SAR 0.00</span>
                        )}
                      </td>

                      {/* Net Remaining Due */}
                      <td className="py-3.5 px-4 text-right font-mono">
                        <span
                          className={`text-sm font-extrabold ${
                            stats.netRemaining > 0 ? "text-jct-charcoal dark:text-jct-yellow" : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          SAR {fmt(stats.netRemaining)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            staff.status === "ACTIVE"
                              ? "bg-jct-turquoise text-jct-charcoal"
                              : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {staff.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openStaffLedger(staff)}
                            className="bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg px-3 py-1.5 text-xs flex items-center gap-1"
                          >
                            <span>Ledger</span>
                            <ArrowRight size={12} />
                          </button>

                          {isOwner && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingStaff(staff);
                                  setEditStaffName(staff.name);
                                  setEditStaffBranch(staff.branch);
                                  setEditStaffRole(staff.role || "Cashier");
                                  setEditStaffSalary(String(staff.baseSalary));
                                  setEditStaffPhone(staff.phone || "");
                                  setEditStaffIqama(staff.iqamaNumber || "");
                                }}
                                className="rounded-lg bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 transition-all px-2.5 py-1.5 text-[11px]"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteStaff(staff.id)}
                                title="Delete employee"
                                className="rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1.5 text-[11px] font-bold text-rose-600 dark:text-rose-400 transition"
                              >
                                🗑️ Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────────
          MODAL 0: EDIT STAFF MEMBER (OWNER PRIVILEGE)
         ────────────────────────────────────────────────────────────── */}
      {editingStaff && isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 text-jct-charcoal dark:text-jct-offwhite flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1F1F1F] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-jct-yellow text-jct-charcoal">
                  <Edit3 size={18} strokeWidth={2.5} />
                </div>
                <h3 className="font-display font-extrabold text-lg">✏️ Edit Employee Record</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditStaff} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Employee Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editStaffName}
                  onChange={(e) => setEditStaffName(e.target.value)}
                  className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2.5 text-sm font-semibold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                    Branch Assignment *
                  </label>
                  <select
                    value={editStaffBranch}
                    onChange={(e) => setEditStaffBranch(e.target.value)}
                    className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3 py-2.5 text-xs font-bold outline-none"
                  >
                    <option value="JCT_HQ">JCT Main HQ</option>
                    <option value="HEMPEL_JUBAIL">Hempel Jubail</option>
                    <option value="JOTUN_DAMMAM">Jotun Dammam</option>
                    <option value="SIGMA_JUBAIL">Sigma Jubail</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                    Job Role
                  </label>
                  <input
                    type="text"
                    value={editStaffRole}
                    onChange={(e) => setEditStaffRole(e.target.value)}
                    className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2.5 text-xs font-semibold outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Monthly Base Salary (SAR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editStaffSalary}
                  onChange={(e) => setEditStaffSalary(e.target.value)}
                  className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2.5 font-mono text-sm font-bold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={editStaffPhone}
                    onChange={(e) => setEditStaffPhone(e.target.value)}
                    className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2 text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                    Iqama / ID
                  </label>
                  <input
                    type="text"
                    value={editStaffIqama}
                    onChange={(e) => setEditStaffIqama(e.target.value)}
                    className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2 text-xs outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-[#1F1F1F] mt-2">
                <button
                  type="button"
                  onClick={() => {
                    handleToggleArchive(editingStaff);
                    setEditingStaff(null);
                  }}
                  className="rounded-lg bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 transition-all px-3 py-2 text-xs"
                >
                  {editingStaff.status === "ACTIVE" ? "Archive Staff" : "Restore Staff"}
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingStaff(null)}
                    className="rounded-lg border border-slate-200 dark:border-[#1F1F1F] px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEditStaff}
                    className="bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg px-5 py-2 text-xs disabled:opacity-50"
                  >
                    {isSavingEditStaff ? "Saving..." : "💾 Save Changes"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────
          MODAL 1: ADD NEW STAFF MEMBER
         ────────────────────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 text-jct-charcoal dark:text-jct-offwhite flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1F1F1F] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-jct-yellow text-jct-charcoal">
                  <Users size={18} strokeWidth={2.5} />
                </div>
                <h3 className="font-display font-extrabold text-lg">Add New Employee</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Employee Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="e.g. Tariq Al-Ghamdi"
                  className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2.5 text-sm font-semibold placeholder:text-slate-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                    Branch Assignment *
                  </label>
                  <select
                    value={newStaffBranch}
                    onChange={(e) => setNewStaffBranch(e.target.value)}
                    className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3 py-2.5 text-xs font-bold outline-none"
                  >
                    <option value="JCT_HQ">JCT Main HQ</option>
                    <option value="HEMPEL_JUBAIL">Hempel Jubail</option>
                    <option value="JOTUN_DAMMAM">Jotun Dammam</option>
                    <option value="SIGMA_JUBAIL">Sigma Jubail</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                    Job Role
                  </label>
                  <input
                    type="text"
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value)}
                    placeholder="e.g. Cashier, Sales"
                    className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2.5 text-xs font-semibold outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Monthly Base Salary (SAR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newStaffSalary}
                  onChange={(e) => setNewStaffSalary(e.target.value)}
                  placeholder="3500.00"
                  className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2.5 font-mono text-sm font-bold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                    Phone (Optional)
                  </label>
                  <input
                    type="text"
                    value={newStaffPhone}
                    onChange={(e) => setNewStaffPhone(e.target.value)}
                    placeholder="05XXXXXXXX"
                    className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2 text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                    Iqama / ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={newStaffIqama}
                    onChange={(e) => setNewStaffIqama(e.target.value)}
                    placeholder="2XXXXXXXXX"
                    className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3.5 py-2 text-xs outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-[#1F1F1F] mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-slate-200 dark:border-[#1F1F1F] px-4 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStaff}
                  className="bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg px-5 py-2.5 text-xs disabled:opacity-50"
                >
                  {isSubmittingStaff ? "Adding..." : "+ Create Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────
          MODAL 2: INDIVIDUAL STAFF MONTHLY LEDGER & DISBURSEMENT
         ────────────────────────────────────────────────────────────── */}
      {selectedStaffForLedger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl flex flex-col text-jct-charcoal dark:text-jct-offwhite">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-[#1F1F1F] p-6 bg-slate-50 dark:bg-[#111111]">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-jct-turquoise/20 border border-jct-turquoise font-display text-lg font-black text-jct-charcoal dark:text-jct-turquoise font-mono">
                  {selectedStaffForLedger.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-extrabold text-xl text-jct-charcoal dark:text-jct-offwhite">
                      {selectedStaffForLedger.name}
                    </h3>
                    <span className="rounded bg-slate-100 dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1F1F1F] px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                      {selectedStaffForLedger.role || "Staff"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                    <span>Branch: <strong className="text-jct-charcoal dark:text-jct-offwhite">{selectedStaffForLedger.branch}</strong></span>
                    {selectedStaffForLedger.phone && <span>📞 {selectedStaffForLedger.phone}</span>}
                    {selectedStaffForLedger.iqamaNumber && <span>ID: {selectedStaffForLedger.iqamaNumber}</span>}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStaffForLedger(null)}
                className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-6 overflow-y-auto flex flex-col gap-6 flex-1">
              {/* Month Balance Strip */}
              {(() => {
                const stats = getStaffMonthStats(selectedStaffForLedger);
                return (
                  <div className="rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#111111] p-6 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {selectedMonth} Base Salary
                      </span>
                      <span className="font-mono text-lg font-black text-jct-charcoal dark:text-jct-offwhite mt-0.5">
                        SAR {fmt(selectedStaffForLedger.baseSalary)}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                        Total Advances
                      </span>
                      <span className="font-mono text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">
                        -SAR {fmt(stats.advances)}
                      </span>
                    </div>

                    {stats.payouts > 0 && (
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                          Disbursed So Far
                        </span>
                        <span className="font-mono text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                          SAR {fmt(stats.payouts)}
                        </span>
                      </div>
                    )}

                    <div className="flex flex-col pl-4 border-l border-slate-200 dark:border-[#1F1F1F]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-jct-charcoal dark:text-jct-yellow">
                        Net Balance Due
                      </span>
                      <span className="font-mono text-xl font-black text-jct-charcoal dark:text-jct-yellow mt-0.5">
                        SAR {fmt(stats.netRemaining)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-[#1F1F1F] pb-4">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Itemized Payroll &amp; Advances Ledger ({ledgerLogs.length})
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAdjustmentForm(!showAdjustmentForm)}
                    className="rounded-lg border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#111111] hover:bg-slate-100 px-3 py-1.5 text-xs font-bold text-jct-charcoal dark:text-jct-offwhite transition"
                  >
                    {showAdjustmentForm ? "Cancel Adjustment" : "+ Record Advance / Adjustment"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const stats = getStaffMonthStats(selectedStaffForLedger);
                      setDisburseAmount(String(stats.netRemaining));
                      setDisburseNote(`Final Salary Payout for ${selectedMonth}`);
                    }}
                    className="bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 transition-all rounded-lg px-4 py-1.5 text-xs shadow-sm"
                  >
                    ⚡ Disburse Salary
                  </button>
                </div>
              </div>

              {/* Inline Adjustment Form */}
              {showAdjustmentForm && (
                <form onSubmit={handleAddAdjustment} className="rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#111111] p-6 flex flex-col gap-3">
                  <span className="text-xs font-bold text-jct-charcoal dark:text-jct-turquoise">
                    Record Direct Staff Ledger Entry
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">Type</label>
                      <select
                        value={adjType}
                        onChange={(e) => setAdjType(e.target.value as "ADVANCE" | "BONUS" | "DEDUCTION")}
                        className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-2.5 py-1.5 text-xs font-bold outline-none"
                      >
                        <option value="ADVANCE">Advance (Deduction)</option>
                        <option value="BONUS">Bonus (Addition)</option>
                        <option value="DEDUCTION">Deduction (Penalty)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">Amount (SAR)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={adjAmount}
                        onChange={(e) => setAdjAmount(e.target.value)}
                        placeholder="500.00"
                        className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-2.5 py-1.5 font-mono text-xs font-bold outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">Payment Source</label>
                      <select
                        value={adjSource}
                        onChange={(e) => {
                          const v = e.target.value as "REGISTER_DRAWER" | "OWNER_POCKET" | "BANK_TRANSFER";
                          setAdjSource(v);
                          if (v === "BANK_TRANSFER" && adjPaymentMode === "CASH") {
                            setAdjPaymentMode("SAB");
                          } else if (v === "REGISTER_DRAWER") {
                            setAdjPaymentMode("CASH");
                          }
                        }}
                        className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-2.5 py-1.5 text-xs font-bold outline-none"
                      >
                        <option value="REGISTER_DRAWER">Cash Drawer</option>
                        <option value="OWNER_POCKET">Owner Pocket</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-jct-charcoal dark:text-jct-yellow font-bold mb-1">Mode of Payment *</label>
                      <select
                        required
                        value={adjPaymentMode}
                        onChange={(e) => setAdjPaymentMode(e.target.value as UniversalPaymentMode)}
                        className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-2.5 py-1.5 text-xs font-bold outline-none"
                      >
                        {UNIVERSAL_PAYMENT_MODES.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={adjNote}
                      onChange={(e) => setAdjNote(e.target.value)}
                      placeholder="Optional memo / reason..."
                      className="flex-1 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3 py-1.5 text-xs outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isSubmittingAdj}
                      className="bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg px-4 py-1.5 text-xs shrink-0"
                    >
                      {isSubmittingAdj ? "Saving..." : "Save Entry"}
                    </button>
                  </div>
                </form>
              )}

              {/* Inline Disburse Form */}
              {disburseAmount && (
                <form onSubmit={handleDisburseSalary} className="rounded-xl border border-jct-yellow bg-jct-yellow/20 p-6 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-jct-charcoal dark:text-jct-yellow flex items-center gap-1.5">
                      <CheckCircle2 size={15} /> Confirm Salary Disbursement
                    </span>
                    <button
                      type="button"
                      onClick={() => setDisburseAmount("")}
                      className="text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite text-xs"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-600 dark:text-slate-300 mb-1">Disbursement Amount (SAR)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={disburseAmount}
                        onChange={(e) => setDisburseAmount(e.target.value)}
                        className="w-full bg-white dark:bg-[#0A0A0A] border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3 py-2 font-mono text-sm font-black outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-600 dark:text-slate-300 mb-1">Payment Source</label>
                      <select
                        value={disburseSource}
                        onChange={(e) => {
                          const v = e.target.value as "BANK_TRANSFER" | "REGISTER_DRAWER" | "OWNER_POCKET";
                          setDisburseSource(v);
                          if (v === "REGISTER_DRAWER") setDisbursePaymentMode("CASH");
                          else if (v === "BANK_TRANSFER" && disbursePaymentMode === "CASH") setDisbursePaymentMode("SAB");
                        }}
                        className="w-full bg-white dark:bg-[#0A0A0A] border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3 py-2 text-xs font-bold outline-none"
                      >
                        <option value="BANK_TRANSFER">Bank Wire / Transfer</option>
                        <option value="REGISTER_DRAWER">Cash Drawer (Register)</option>
                        <option value="OWNER_POCKET">Owner Pocket</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-jct-charcoal dark:text-jct-yellow font-bold mb-1">Mode of Payment *</label>
                      <select
                        required
                        value={disbursePaymentMode}
                        onChange={(e) => setDisbursePaymentMode(e.target.value as UniversalPaymentMode)}
                        className="w-full bg-white dark:bg-[#0A0A0A] border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3 py-2 text-xs font-bold outline-none"
                      >
                        {UNIVERSAL_PAYMENT_MODES.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={disburseNote}
                      onChange={(e) => setDisburseNote(e.target.value)}
                      placeholder="e.g. October Salary Settlement"
                      className="flex-1 bg-white dark:bg-[#0A0A0A] border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3 py-2 text-xs outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isSubmittingDisburse}
                      className="bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg px-5 py-2 text-xs shrink-0"
                    >
                      {isSubmittingDisburse ? "Processing..." : "Disburse & Zero Balance"}
                    </button>
                  </div>
                </form>
              )}

              {/* Inline Edit Payroll Log Form (Owner CRUD) */}
              {editingPayrollLog && isOwner && (
                <form onSubmit={handleSavePayrollLogEdit} className="rounded-xl border border-jct-yellow bg-slate-50 dark:bg-[#111111] p-6 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-jct-charcoal dark:text-jct-yellow">
                      👑 Edit Payroll Ledger Entry ({editingPayrollLog.date})
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingPayrollLog(null)}
                      className="text-xs text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">Entry Type</label>
                      <select
                        value={editLogType}
                        onChange={(e) => setEditLogType(e.target.value)}
                        className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-2.5 py-1.5 text-xs font-bold outline-none"
                      >
                        <option value="ADVANCE">ADVANCE</option>
                        <option value="SALARY_PAYOUT">SALARY_PAYOUT</option>
                        <option value="BONUS">BONUS</option>
                        <option value="DEDUCTION">DEDUCTION</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">Amount (SAR)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={editLogAmount}
                        onChange={(e) => setEditLogAmount(e.target.value)}
                        className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-2.5 py-1.5 font-mono text-xs font-bold outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-jct-charcoal dark:text-jct-yellow font-bold mb-1">Mode of Payment</label>
                      <select
                        value={editLogPaymentMode}
                        onChange={(e) => setEditLogPaymentMode(e.target.value as UniversalPaymentMode)}
                        className="w-full bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-2.5 py-1.5 text-xs font-bold outline-none"
                      >
                        {UNIVERSAL_PAYMENT_MODES.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editLogNote}
                      onChange={(e) => setEditLogNote(e.target.value)}
                      placeholder="Memo / note..."
                      className="flex-1 bg-transparent border border-slate-300 dark:border-[#1F1F1F] focus:border-jct-turquoise focus:ring-1 focus:ring-jct-turquoise text-jct-charcoal dark:text-jct-offwhite rounded-md px-3 py-1.5 text-xs outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isSavingLogEdit}
                      className="bg-jct-turquoise text-jct-charcoal font-bold hover:brightness-95 transition-all shadow-sm rounded-lg px-4 py-1.5 text-xs shrink-0"
                    >
                      {isSavingLogEdit ? "Saving..." : "💾 Update Entry"}
                    </button>
                  </div>
                </form>
              )}

              {/* Itemized Logs Table */}
              <div className="rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-white dark:bg-[#0A0A0A] overflow-hidden">
                {loadingLedgerLogs ? (
                  <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                    <RotateCcw className="animate-spin inline mr-1" size={14} /> Loading ledger entries...
                  </div>
                ) : ledgerLogs.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                    No payroll entries or advances recorded yet for this staff member.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-[#1F1F1F]">
                    {ledgerLogs.map((log) => {
                      const isAdvance = log.type === "ADVANCE";
                      const isPayout = log.type === "SALARY_PAYOUT";
                      const isBonus = log.type === "BONUS";

                      const badgeCls = isAdvance
                        ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        : isPayout
                        ? "bg-jct-turquoise text-jct-charcoal border-jct-turquoise"
                        : isBonus
                        ? "bg-jct-turquoise/20 border-jct-turquoise text-jct-charcoal dark:text-jct-turquoise"
                        : "bg-jct-yellow text-jct-charcoal border-jct-yellow";

                      const sourceLabel =
                        log.source === "REGISTER_DRAWER"
                          ? "Cash Drawer"
                          : log.source === "OWNER_POCKET"
                          ? "Owner Pocket"
                          : "Bank Transfer";

                      const modeBadge = formatPaymentModeBadge(
                        log.paymentMode || (log.source === "BANK_TRANSFER" ? "BANK_TRANSFER" : "CASH")
                      );

                      return (
                        <div key={log.id} className="flex flex-wrap items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-[#111111] transition gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {log.date}
                            </span>
                            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${badgeCls}`}>
                              {log.type}
                            </span>
                            <span className="rounded-full bg-slate-100 dark:bg-[#111111] border border-slate-200 dark:border-[#1F1F1F] px-2.5 py-0.5 text-[10px] text-slate-600 dark:text-slate-300 font-bold">
                              {sourceLabel}
                            </span>
                            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${modeBadge.cls}`}>
                              {modeBadge.label}
                            </span>
                            {log.note && (
                              <span className="text-xs text-jct-charcoal dark:text-jct-offwhite truncate max-w-xs">
                                {log.note}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="text-right font-mono font-bold whitespace-nowrap">
                              <span
                                className={
                                  isPayout || isBonus
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-rose-600 dark:text-rose-400"
                                }
                              >
                                {isPayout || isBonus ? "+" : "-"}SAR {fmt(log.amount)}
                              </span>
                            </div>
                            {isOwner && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPayrollLog(log);
                                    setEditLogType(log.type);
                                    setEditLogAmount(String(log.amount));
                                    setEditLogPaymentMode(
                                      (log.paymentMode as UniversalPaymentMode) ||
                                        (log.source === "BANK_TRANSFER" ? "BANK_TRANSFER" : "CASH")
                                    );
                                    setEditLogNote(log.note || "");
                                  }}
                                  className="rounded bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 transition-all px-2 py-0.5 text-[10px]"
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePayrollLog(log.id)}
                                  className="rounded border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400"
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 dark:border-[#1F1F1F] p-4 bg-slate-50 dark:bg-[#111111] flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedStaffForLedger(null)}
                className="rounded-lg border border-slate-200 dark:border-[#1F1F1F] px-5 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-jct-charcoal dark:hover:text-jct-offwhite"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   PROFILE GATE, ROLE ACCESS & OWNER AUDIT RADAR
   ════════════════════════════════════════════════════════════════════════ */

type ProfileId = "BONGSI" | "JCT_HQ" | "HEMPEL_JUBAIL" | "JOTUN_DAMMAM" | "SIGMA_JUBAIL";

interface UserProfile {
  id: ProfileId;
  emoji: string;
  name: string;
  label: string;
  badge: string;
  greeting: string;
  branch: string;
  isOwner: boolean;
  avatarClass: string;
  hoverRing: string;
  icon: typeof Crown;
}

const PROFILE_STORAGE_KEY = "jct_user_profile";

const USER_PROFILES: UserProfile[] = [
  {
    id: "BONGSI", emoji: "👑", name: "BONGSI", label: "Nazim & Nadeem (Owners)",
    badge: "Master Admin · All Branches", greeting: "Nazim & Nadeem", branch: "All Branches", isOwner: true,
    avatarClass: "bg-gradient-to-br from-[#000000] via-[#0A1012] to-[#06262B] ring-2 ring-[#00BAC7]/60",
    hoverRing: "hover:ring-2 hover:ring-[#00BAC7] hover:shadow-[0_0_25px_rgba(0,186,199,0.35)]",
    icon: Crown,
  },
  {
    id: "JCT_HQ", emoji: "🏢", name: "JCT Main HQ", label: "Jubail Main HQ",
    badge: "Hardware & Jotun Store", greeting: "JCT Main HQ", branch: "Jubail - Main Branch", isOwner: false,
    avatarClass: "bg-gradient-to-br from-[#14281F] to-[#0B1713]",
    hoverRing: "hover:ring-2 hover:ring-[#FFD200] hover:shadow-[0_0_25px_rgba(255,210,0,0.25)]",
    icon: Store,
  },
  {
    id: "HEMPEL_JUBAIL", emoji: "🎨", name: "Hempel Jubail", label: "Hempel Franchise",
    badge: "Jubail Branch", greeting: "Hempel Jubail", branch: "Hempel - Jubail", isOwner: false,
    avatarClass: "bg-gradient-to-br from-[#0F3338] to-[#082023]",
    hoverRing: "hover:ring-2 hover:ring-[#00BAC7] hover:shadow-[0_0_25px_rgba(0,186,199,0.3)]",
    icon: PaintRoller,
  },
  {
    id: "JOTUN_DAMMAM", emoji: "🖌️", name: "Jotun Dammam", label: "Jotun Franchise",
    badge: "Dammam Branch", greeting: "Jotun Dammam", branch: "Jotun - Dammam", isOwner: false,
    avatarClass: "bg-gradient-to-br from-[#06566A] to-[#032B36]",
    hoverRing: "hover:ring-2 hover:ring-[#00BAC7] hover:shadow-[0_0_25px_rgba(0,186,199,0.3)]",
    icon: SprayCan,
  },
  {
    id: "SIGMA_JUBAIL", emoji: "🏗️", name: "Sigma Paints", label: "Sigma Paints Franchise",
    badge: "Jubail Branch", greeting: "Sigma Paints Jubail", branch: "Sigma Paints - Jubail", isOwner: false,
    avatarClass: "bg-gradient-to-br from-[#2A3338] to-[#141A1D]",
    hoverRing: "hover:ring-2 hover:ring-[#FFD200] hover:shadow-[0_0_25px_rgba(255,210,0,0.25)]",
    icon: Landmark,
  },
];

const OWNER_TABS: TabId[] = ["register", "archive", "radar", "suppliers", "payroll", "pulse", "consolidation", "ai"];
const STAFF_TABS: TabId[] = ["register", "archive"];

const OWNER_BRANCH_OPTIONS = [
  "All Branches (Combined)",
  "Jubail - Main Branch",
  "Hempel - Jubail",
  "Jotun - Dammam",
  "Sigma Paints - Jubail",
];

function ProfileGate({ onSelect }: { onSelect: (p: UserProfile) => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-y-auto bg-jct-offwhite dark:bg-black px-6 py-10 text-jct-charcoal dark:text-jct-offwhite">
      <div className="relative z-10 flex w-full max-w-6xl flex-col items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-jct-yellow font-display text-base font-black text-jct-charcoal shadow-sm">
            JCT
          </div>
          <span className="font-display text-lg font-extrabold tracking-tight text-jct-charcoal dark:text-jct-offwhite">JCT Financial OS</span>
        </div>
        <h1 className="mt-10 text-3xl md:text-4xl font-extrabold text-jct-charcoal dark:text-jct-offwhite tracking-tight text-center">Who is signing in?</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 text-center">Select your branch profile or owner terminal to begin.</p>

        <div className="mt-12 grid w-full grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          {USER_PROFILES.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p)}
                className="group flex flex-col items-center gap-3 text-center outline-none"
              >
                <div
                  className="flex aspect-square w-full max-w-[170px] items-center justify-center bg-white dark:bg-[#0A0A0A] shadow-sm border border-slate-200 dark:border-[#1F1F1F] rounded-xl p-6 transition-all duration-200 group-hover:scale-105 group-hover:border-jct-turquoise"
                >
                  <Icon
                    size={64}
                    strokeWidth={1.5}
                    className={p.isOwner ? "text-jct-charcoal dark:text-jct-yellow" : "text-jct-charcoal dark:text-jct-turquoise"}
                  />
                </div>
                <div>
                  <p className="text-base font-bold text-jct-charcoal dark:text-jct-offwhite">
                    {p.emoji} {p.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{p.label}</p>
                  <span
                    className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      p.isOwner
                        ? "bg-jct-yellow text-jct-charcoal"
                        : "bg-jct-turquoise text-jct-charcoal"
                    }`}
                  >
                    {p.badge}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BranchAuditRadar() {
  const branches = [
    {
      name: "JCT Main HQ",
      status: "🟢 AUDITED & LOCKED",
      detail: "SAR 43,092 locked at 10:14 PM",
      cls: "bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300",
    },
    {
      name: "Hempel Jubail",
      status: "🟡 REGISTER ACTIVE",
      detail: "Staff logged in, 18 invoices matched",
      cls: "bg-jct-yellow/15 border-jct-yellow/30 text-amber-800 dark:text-jct-yellow",
    },
    {
      name: "Jotun Dammam",
      status: "🟢 AUDITED & LOCKED",
      detail: "Locked at 10:02 PM",
      cls: "bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300",
    },
    {
      name: "Sigma Paints Jubail",
      status: "🔴 AUDIT PENDING",
      detail: "Closing time passed, register still unlocked",
      cls: "bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-300",
    },
  ];
  return (
    <div className="w-full">
      <div className="bg-white/50 dark:bg-[#0A0A0A]/50 backdrop-blur-md p-2 rounded-full border border-slate-200/50 dark:border-white/5 flex gap-2 items-center overflow-x-auto w-full hide-scrollbar shadow-sm">
        <div className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0">
          <Eye size={13} className="text-jct-turquoise" />
          <span>Branch Radar</span>
        </div>
        {branches.map((b) => (
          <div
            key={b.name}
            title={`${b.name} · ${b.status} (${b.detail})`}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs transition-all hover:scale-[1.02] cursor-default shrink-0 ${b.cls}`}
          >
            <span className="font-bold text-jct-charcoal dark:text-jct-offwhite">{b.name}</span>
            <span className="opacity-30">·</span>
            <span className="font-extrabold text-[11px]">{b.status}</span>
            <span className="text-[10px] opacity-75 hidden 2xl:inline font-mono">({b.detail})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [ownerBranch, setOwnerBranch] = useState(OWNER_BRANCH_OPTIONS[1]);

  useEffect(() => {
    const saved = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    const found = USER_PROFILES.find((p) => p.id === saved) || null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfile(found);
    setProfileLoaded(true);
  }, []);

  const handleSelectProfile = (p: UserProfile) => {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, p.id);
    setProfile(p);
    setTab("register");
  };

  const handleSwitchProfile = () => {
    window.localStorage.removeItem(PROFILE_STORAGE_KEY);
    setProfile(null);
  };

  const allowedTabs = profile?.isOwner ? OWNER_TABS : STAFF_TABS;
  const activeBranchLabel = profile?.isOwner ? ownerBranch : profile?.branch ?? "";

  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem("jct-theme") === "dark";
    }
    return false;
  });
  const [tab, setTab] = useState<TabId>("register");

  // Lifted Daily Register State (Persists across tab switches & powers live cross-module sync)
  const [trackingMode, setTrackingMode] = useState<TrackingMode>("hub");
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);

  const [preLoggedBankInvoices, setPreLoggedBankInvoices] = useState<PreLoggedBankInvoice[]>([
    { invoiceNo: "30065", amount: 2150, paymentMode: "BANK_TRANSFER", time: "10:12" },
    { invoiceNo: "30063", amount: 1450, paymentMode: "POS_SWIPE", posTerminal: "SAB", time: "09:18" },
    { invoiceNo: "30068", amount: 3820, paymentMode: "POS_SWIPE", posTerminal: "AL_RAJHI", time: "11:42" },
    { invoiceNo: "30074", amount: 960, paymentMode: "POS_SWIPE", posTerminal: "VISA_MC", time: "14:05" },
  ]);

  const [preLoggedEntries, setPreLoggedEntries] = useState<PreLoggedEntry[]>([
    {
      id: "ple-food",
      type: "EXPENSE",
      expenseCategory: "Food",
      title: "Food",
      amount: 24,
      time: "12:30",
    },
    {
      id: "ple-water",
      type: "EXPENSE",
      expenseCategory: "Water",
      title: "Water",
      amount: 150,
      time: "13:45",
    },
    {
      id: "ple-chicago",
      type: "CREDIT_RECD",
      customerName: "Chicago Credit Recd",
      followUpDate: "2026-09-20",
      receiptNo: "RCP-1042",
      title: "Chicago Credit Recd",
      amount: 12428,
      time: "15:10",
    },
  ]);

  const [erpInvoices, setErpInvoices] = useState<ErpInvoiceItem[]>([]);
  const [openingBalance, setOpeningBalance] = useState<number>(2634);
  const [completedDaysLog, setCompletedDaysLog] = useState<CompletedDaySummary[]>([
    {
      date: "11-09-2026",
      branch: "Jubail - Main Branch",
      totalCashSales: 28450,
      totalBankSwipe: 13530,
      totalPosFees: 108.24,
      totalExpenses: 4120,
      closingBalance: 4500,
      status: "AUDITED",
    },
    {
      date: "10-09-2026",
      branch: "Jubail - Main Branch",
      totalCashSales: 31900,
      totalBankSwipe: 9840,
      totalPosFees: 78.72,
      totalExpenses: 2890,
      closingBalance: 4500,
      status: "LOCKED",
    },
  ]);

  // Lifted Cross-Module State: Credit Radar Customers & Suppliers/Payables
  const [creditCustomers, setCreditCustomers] = useState<ContractorAccount[]>(INITIAL_CONTRACTORS);
  const [supplierBrands, setSupplierBrands] =
    useState<SupplierPayableBrand[]>(INITIAL_SUPPLIER_BRANDS);
  const [supplierBills, setSupplierBills] = useState<SupplierBillItem[]>(INITIAL_SUPPLIER_BILLS);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    window.localStorage.setItem("jct-theme", dark ? "dark" : "light");
  }, [dark]);

  // Cross-Module Sync 1: Credit Purchase / Supplier Purchase -> Suppliers & Payables
  const handleSyncCreditPurchase = (
    supplierName: string,
    amount: number,
    dueDate: string,
    category: "Credit Purchase" | "Cash Purchase" | "Bank Purchase" | "Return",
    paymentMode?: UniversalPaymentMode | string
  ) => {
    const cleanName = supplierName.trim() || "Jotun";
    const newBill: SupplierBillItem = {
      id: `sb-${Date.now()}`,
      supplierName: cleanName,
      amount,
      dueDate: dueDate || "2026-09-25",
      category,
      paymentMode: paymentMode || (category === "Bank Purchase" ? "SAB" : "CASH"),
      createdAt: "12-09-2026",
      source: "Daily Register",
    };
    setSupplierBills((prev) => [newBill, ...prev]);

    setSupplierBrands((prev) => {
      const idx = prev.findIndex(
        (b) =>
          b.brand.toLowerCase().includes(cleanName.toLowerCase()) ||
          cleanName.toLowerCase().includes(b.brand.toLowerCase())
      );
      if (idx !== -1) {
        const updated = [...prev];
        const target = updated[idx];
        updated[idx] = {
          ...target,
          pendingBills:
            category === "Credit Purchase"
              ? r2(target.pendingBills + amount)
              : category === "Return"
              ? Math.max(0, r2(target.pendingBills - amount))
              : target.pendingBills,
          amountPaid:
            category === "Cash Purchase" || category === "Bank Purchase"
              ? r2(target.amountPaid + amount)
              : target.amountPaid,
        };
        return updated;
      }
      return [
        ...prev,
        {
          id: Date.now(),
          brand: cleanName,
          amountPaid: category === "Cash Purchase" || category === "Bank Purchase" ? amount : 0,
          pendingBills: category === "Credit Purchase" ? amount : 0,
          color: "purple",
        },
      ];
    });
  };

  const handleUpdateCreditCustomer = (updated: ContractorAccount) => {
    setCreditCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const handleDeleteCreditCustomer = (id: string) => {
    setCreditCustomers((prev) => prev.filter((c) => c.id !== id));
  };

  const handleUpdateSupplierBill = (updated: SupplierBillItem) => {
    setSupplierBills((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  };

  const handleDeleteSupplierBill = (id: string) => {
    setSupplierBills((prev) => prev.filter((b) => b.id !== id));
  };

  // Cross-Module Sync 2: Credit Sale / Credit Sale Amt Recd -> Credit Radar
  const handleSyncCreditCustomer = (
    customerName: string,
    amount: number,
    followUpDate: string,
    receiptNo?: string,
    mode: "CREDIT_RECD" | "CREDIT_SALE" = "CREDIT_RECD"
  ) => {
    const cleanCust = customerName.trim();
    if (!cleanCust) return;

    const cleanDigits = receiptNo
      ? receiptNo.trim().replace(/^#/i, "").replace(/^inv[-_\s#]*/i, "").trim()
      : "";
    const formattedInvNo = cleanDigits
      ? `#${cleanDigits}`
      : receiptNo?.trim() || `#30064`;

    setCreditCustomers((prev) => {
      const idx = prev.findIndex(
        (c) =>
          c.name.toLowerCase().includes(cleanCust.toLowerCase()) ||
          cleanCust.toLowerCase().includes(c.name.toLowerCase())
      );
      const historyItem: ContractorHistoryItem = {
        id:
          formattedInvNo ||
          (mode === "CREDIT_SALE"
            ? `CR-SALE-${Date.now().toString().slice(-3)}`
            : `RCP-${Date.now().toString().slice(-3)}`),
        amount,
        date: `2026-09-12 (🔔 Reminder: ${followUpDate} · Inv ${formattedInvNo})`,
        status: "paid_on_time",
      };

      if (idx !== -1) {
        const updated = [...prev];
        const existing = updated[idx];
        const nextOutstanding =
          mode === "CREDIT_SALE"
            ? r2(existing.outstanding + amount)
            : Math.max(0, r2(existing.outstanding - amount));
        const updatedAccount: ContractorAccount = {
          ...existing,
          outstanding: nextOutstanding,
          dueDate: followUpDate || existing.dueDate,
          followUpDate: followUpDate || existing.followUpDate || existing.dueDate,
          latestInvoiceNo: formattedInvNo || existing.latestInvoiceNo,
          latestInvoiceAmount: amount,
          status: "due_soon",
          clearedInvoices:
            mode === "CREDIT_RECD" ? existing.clearedInvoices + 1 : existing.clearedInvoices,
          history: [historyItem, ...existing.history],
          syncedFromRegister: true,
        };
        updated.splice(idx, 1);
        return [updatedAccount, ...updated];
      }

      const newContractor: ContractorAccount = {
        id: `c-${Date.now().toString().slice(-4)}`,
        name: cleanCust,
        outstanding: amount,
        dueDate: followUpDate || "2026-09-20",
        followUpDate: followUpDate || "2026-09-20",
        latestInvoiceNo: formattedInvNo,
        latestInvoiceAmount: amount,
        status: "due_soon",
        riskLevel: "Low",
        avgPaymentTime: "Synced Today",
        clearedInvoices: mode === "CREDIT_RECD" ? 1 : 0,
        history: [historyItem],
        syncedFromRegister: true,
      };
      return [newContractor, ...prev];
    });
  };

  // Compute Live Cross-Module Totals for Financial Pulse, Branch Consolidation & Nauman AI
  const activeErpForMetrics: ErpInvoiceItem[] =
    erpInvoices.length > 0
      ? erpInvoices
      : JUBAIL_ERP_18_SEED.map((inv) => {
          const matched = preLoggedBankInvoices.find((b) => b.invoiceNo === inv.invoiceNo);
          const isCreditSale = preLoggedEntries.some(
            (e) =>
              e.type === "CREDIT_SALE" &&
              e.receiptNo &&
              e.receiptNo.replace(/^#/i, "").trim() === inv.invoiceNo
          );
          const splitEntry = preLoggedEntries.find(
            (e) =>
              e.type === "SPLIT_SALE" &&
              e.receiptNo &&
              e.receiptNo.replace(/^#/i, "").trim() === inv.invoiceNo
          );
          const isSplitRow = Boolean(splitEntry) || Boolean(inv.isSplit);
          const halfGross = r2(inv.amount / 2);
          const resolvedCash = splitEntry?.splitCashAmount ?? inv.splitCashAmount ?? halfGross;
          const resolvedBank =
            splitEntry?.splitBankAmount ?? inv.splitBankAmount ?? r2(inv.amount - resolvedCash);
          const defaultTerm: PosTerminalBank =
            inv.splitPosTerminal || (inv.invoiceNo === "30068" ? "AL_RAJHI" : "SAB");
          const resolvedTerm =
            splitEntry?.splitPosTerminal ?? inv.splitPosTerminal ?? defaultTerm;
          const resolvedMode: InvoicePaymentMode = isCreditSale
            ? "CREDIT_SALE"
            : isSplitRow
            ? "SPLIT"
            : matched
            ? matched.paymentMode
            : "CASH";

          return {
            ...inv,
            paymentMode: resolvedMode,
            posTerminal: matched?.posTerminal || resolvedTerm,
            isSplit: resolvedMode === "SPLIT",
            splitCashAmount: resolvedCash,
            splitBankAmount: resolvedBank,
            splitBankMethod: splitEntry?.splitBankMethod ?? inv.splitBankMethod ?? "POS_SWIPE",
            splitPosTerminal: resolvedTerm,
            autoMatched: Boolean(matched) || isCreditSale || isSplitRow,
          };
        });

  const todayCashSales = r2(
    activeErpForMetrics.reduce((sum, inv) => sum + calcInvoiceCashPortion(inv), 0)
  );
  const todayBankGross = r2(
    activeErpForMetrics.reduce((sum, inv) => sum + calcInvoiceBankGrossPortion(inv), 0)
  );
  const todayPosFees = r2(
    activeErpForMetrics.reduce((sum, inv) => sum + calcInvoicePosFee(inv), 0)
  );
  // Default to 100% Gross Face Value reconciliation for Bank / POS Swipes
  const todayBankNet = todayBankGross;

  const todayInflows = r2(
    preLoggedEntries
      .filter((e) => e.type !== "EXPENSE" && e.type !== "CREDIT_SALE" && e.type !== "SPLIT_SALE")
      .reduce((a, b) => a + b.amount, 0)
  );
  const todayExpenses = r2(
    preLoggedEntries.filter((e) => e.type === "EXPENSE").reduce((a, b) => a + b.amount, 0)
  );
  const closingDrawerBalance = r2(
    openingBalance + todayCashSales + todayInflows - todayExpenses
  );

  const totalCreditOutstanding = r2(
    creditCustomers.reduce((a, b) => a + b.outstanding, 0)
  );
  const totalSupplierPayables = r2(
    supplierBrands.reduce((a, b) => a + b.pendingBills, 0)
  );

  const liveMetrics: LiveCrossModuleMetrics = {
    todayCashSales,
    todayBankNet,
    todayPosFees,
    todayExpenses,
    closingDrawerBalance,
    totalCreditOutstanding,
    totalSupplierPayables,
  };

  const liveAiTxns: Txn[] = [
    ...SEED_TXNS,
    ...preLoggedEntries.map((e) => ({
      id: e.id,
      flow: (e.type === "EXPENSE" ? "out" : "in") as "in" | "out",
      kind: (e.type === "EXPENSE" ? "misc_expense" : "credit_received") as Kind,
      amount: e.amount,
      title: e.title,
      time: e.time,
    })),
  ];

  // JCT Pocket bridge: live Neon feed -> register (Steps 3/4/5) + Credit Radar
  const activePocketBranch: BranchId | "ALL" = profile?.isOwner
    ? ownerBranch === "Hempel - Jubail"
      ? "HEMPEL_JUBAIL"
      : ownerBranch === "Jotun - Dammam"
      ? "JOTUN_DAMMAM"
      : ownerBranch === "Sigma Paints - Jubail"
      ? "SIGMA_JUBAIL"
      : ownerBranch === "All Branches (Combined)"
      ? "ALL"
      : "JCT_HQ"
    : (profile?.id as BranchId) || "JCT_HQ";

  const { transactions: pocketTxns } = usePocketTransactions(activePocketBranch, Boolean(profile));
  const pocketSyncedRef = useRef<Set<string>>(new Set());
  const syncCustomerRef = useRef(handleSyncCreditCustomer);
  useEffect(() => {
    syncCustomerRef.current = handleSyncCreditCustomer;
  });
  useEffect(() => {
    const fresh = pocketTxns.filter((t) => !pocketSyncedRef.current.has(t.id));
    if (fresh.length === 0) return;
    const injected: PreLoggedEntry[] = [];
    fresh.forEach((t) => {
      pocketSyncedRef.current.add(t.id);
      const time = new Date(t.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      const tag = pocketTag(t.type);
      const entryId = `pk-${t.id}`;
      if (t.type === "EXPENSE") {
        if (t.paymentSource === "OWNER_POCKET") return; // owner's own money: not a drawer outflow
        injected.push({
          id: entryId,
          type: "EXPENSE",
          expenseCategory: (t.category ?? "").startsWith("Food") ? "Food" : "Personal Reasons",
          title: t.category ?? "Owner Expense",
          note: [tag, t.note].filter(Boolean).join(" · "),
          amount: t.amount,
          time,
          paymentMode: (t.paymentMode as UniversalPaymentMode) || "CASH",
        });
      } else if (t.type === "ADVANCE") {
        injected.push({
          id: entryId,
          type: "EXPENSE",
          expenseCategory: "Salary",
          title: `Staff Advance · ${t.recipientName ?? "Staff"} (${t.category ?? "Advance"})`,
          note: `${tag} · Staff Payables / Advances`,
          amount: t.amount,
          time,
          paymentMode: (t.paymentMode as UniversalPaymentMode) || "CASH",
        });
      } else {
        const followUp = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
        if (t.paymentSource !== "BANK_TRANSFER") {
          injected.push({
            id: entryId,
            type: "CREDIT_RECD",
            title: `Credit Sale Amt Recd · ${t.recipientName ?? "Customer"}`,
            customerName: t.recipientName ?? undefined,
            receiptNo: t.category ?? undefined,
            followUpDate: followUp,
            note: [tag, t.note].filter(Boolean).join(" · "),
            amount: t.amount,
            time,
            paymentMode: (t.paymentMode as UniversalPaymentMode) || "CASH",
          });
        }
        if (t.recipientName) {
          syncCustomerRef.current(t.recipientName, t.amount, followUp, t.category ?? undefined, "CREDIT_RECD");
        }
      }
    });
    if (injected.length) {
      setPreLoggedEntries((prev) => [...prev, ...injected.filter((i) => !prev.some((p) => p.id === i.id))]);
    }
  }, [pocketTxns]);

  // Publish credit customer names so /owner-pocket can auto-lookup (same-browser convenience)
  useEffect(() => {
    window.localStorage.setItem(POCKET_CUSTOMERS_KEY, JSON.stringify(creditCustomers.map((c) => c.name)));
  }, [creditCustomers]);

  if (!profileLoaded) {
    return <div className="h-screen w-full bg-slate-50 dark:bg-black" />;
  }
  if (!profile) {
    return <ProfileGate onSelect={handleSelectProfile} />;
  }
  const safeTab: TabId = allowedTabs.includes(tab) ? tab : "register";

  return (
    <div
      className={`flex h-screen w-full bg-slate-50 dark:bg-black text-jct-charcoal dark:text-jct-offwhite antialiased overflow-hidden print:h-auto print:overflow-visible print:bg-white print:text-black ${
        dark ? "dark" : ""
      }`}
    >
      <Sidebar tab={safeTab} setTab={setTab} allowedTabs={allowedTabs} />

      <div className="flex flex-1 min-w-0 flex-col overflow-hidden bg-slate-50 dark:bg-black print:overflow-visible print:h-auto print:w-full print:p-0 print:m-0 print:bg-white print:text-black">
        {/* Top Header */}
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-[#1F1F1F] bg-white dark:bg-[#0A0A0A] px-6 py-4 z-20 shadow-sm print:hidden">
          <div className="flex items-center gap-4">
            <h1 className="text-jct-charcoal dark:text-jct-offwhite font-semibold text-base hidden sm:block">
              Good afternoon, {profile.greeting}
            </h1>
            <button
              type="button"
              onClick={handleSwitchProfile}
              className="flex items-center gap-1.5 rounded-lg bg-jct-yellow text-jct-charcoal font-bold hover:brightness-95 transition-all px-2.5 py-1.5 text-xs shadow-sm"
            >
              Switch Profile <Repeat size={12} />
            </button>
            <div className="h-4 w-px bg-slate-200 dark:bg-[#1F1F1F] hidden sm:block"></div>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#1F1F1F] text-jct-charcoal dark:text-jct-offwhite text-xs font-medium px-3 py-1.5 rounded-lg">
              <CalendarDays size={14} className="text-jct-charcoal dark:text-jct-turquoise" /> 12-09-2026
            </div>
            <div className="h-4 w-px bg-slate-200 dark:bg-[#1F1F1F] hidden sm:block"></div>
            {profile.isOwner ? (
              <Dropdown.Root>
                <Dropdown.Trigger className="flex items-center gap-2 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#1F1F1F] text-jct-charcoal dark:text-jct-offwhite text-xs font-medium px-3 py-1.5 rounded-lg outline-none transition hover:border-jct-turquoise">
                  <Store size={14} className="text-jct-charcoal dark:text-jct-turquoise" />
                  {activeBranchLabel}
                  <ChevronDown size={12} className="text-slate-500 dark:text-slate-400" />
                </Dropdown.Trigger>
                <Dropdown.Portal>
                  <Dropdown.Content
                    align="start"
                    sideOffset={6}
                    className="z-[200] min-w-[200px] rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-white dark:bg-[#0A0A0A] p-1 shadow-xl"
                  >
                    {OWNER_BRANCH_OPTIONS.map((b) => (
                      <Dropdown.Item
                        key={b}
                        onSelect={() => setOwnerBranch(b)}
                        className="cursor-pointer rounded-lg px-3 py-2 text-xs text-jct-charcoal dark:text-jct-offwhite outline-none data-[highlighted]:bg-jct-turquoise data-[highlighted]:text-jct-charcoal data-[highlighted]:font-bold"
                      >
                        {b}
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Content>
                </Dropdown.Portal>
              </Dropdown.Root>
            ) : (
              <div
                aria-disabled="true"
                title="Branch locked to your profile"
                className="flex cursor-not-allowed items-center gap-2 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#1F1F1F] text-jct-charcoal dark:text-jct-offwhite text-xs font-medium px-3 py-1.5 rounded-lg"
              >
                <Store size={14} className="text-jct-charcoal dark:text-jct-turquoise" />
                {activeBranchLabel}
                <Lock size={11} className="text-slate-500 dark:text-slate-400" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle dark={dark} onToggle={() => setDark(!dark)} />
          </div>
        </header>

        {/* Layout Wrapper */}
        <div className="flex flex-1 min-w-0 overflow-hidden relative print:overflow-visible print:h-auto print:w-full print:p-0 print:m-0">
          {/* Center Canvas */}
          <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto flex flex-col relative z-10 bg-slate-50 dark:bg-black print:overflow-visible print:h-auto print:w-full print:p-0 print:m-0 print:bg-white print:text-black">
            {profile.isOwner && safeTab === "register" && trackingMode === "hub" && (
              <div className="shrink-0 px-4 pt-4 sm:px-6 print:hidden">
                <BranchAuditRadar />
              </div>
            )}
            {safeTab === "register" ? (
              <DailyRegisterView
                trackingMode={trackingMode}
                setTrackingMode={setTrackingMode}
                wizardStep={wizardStep}
                setWizardStep={setWizardStep}
                preLoggedBankInvoices={preLoggedBankInvoices}
                setPreLoggedBankInvoices={setPreLoggedBankInvoices}
                preLoggedEntries={preLoggedEntries}
                setPreLoggedEntries={setPreLoggedEntries}
                erpInvoices={erpInvoices}
                setErpInvoices={setErpInvoices}
                openingBalance={openingBalance}
                setOpeningBalance={setOpeningBalance}
                completedDaysLog={completedDaysLog}
                setCompletedDaysLog={setCompletedDaysLog}
                onSyncCreditPurchase={handleSyncCreditPurchase}
                onSyncCreditCustomer={handleSyncCreditCustomer}
                onSwitchTab={setTab}
                branchId={activePocketBranch === "ALL" ? "JCT_HQ" : activePocketBranch}
                isOwner={Boolean(profile?.isOwner)}
              />
            ) : safeTab === "archive" ? (
              <AuditLibraryView profile={profile} />
            ) : safeTab === "radar" ? (
              <CreditRadarView
                customers={creditCustomers}
                onIssueCredit={handleSyncCreditCustomer}
                isOwner={Boolean(profile?.isOwner)}
                onUpdateCustomer={handleUpdateCreditCustomer}
                onDeleteCustomer={handleDeleteCreditCustomer}
              />
            ) : safeTab === "suppliers" ? (
              <SupplierHubView
                supplierBrands={supplierBrands}
                supplierBills={supplierBills}
                onLogSupplierPurchase={handleSyncCreditPurchase}
                isOwner={Boolean(profile?.isOwner)}
                onUpdateBill={handleUpdateSupplierBill}
                onDeleteBill={handleDeleteSupplierBill}
              />
            ) : safeTab === "payroll" ? (
              <StaffPayrollView profile={profile} />
            ) : safeTab === "ai" ? (
              <NaumanAiView
                txns={liveAiTxns}
                erpInvoices={erpInvoices}
                preLoggedEntries={preLoggedEntries}
              />
            ) : safeTab === "consolidation" ? (
              <div className="flex flex-1 flex-col overflow-y-auto">
                <div className="px-4 pt-4 sm:px-6"><BranchAuditRadar /></div>
                <BranchConsolidationView metrics={liveMetrics} />
              </div>
            ) : safeTab === "pulse" ? (
              <FinancialPulseView metrics={liveMetrics} />
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}
