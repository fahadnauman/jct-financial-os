"use client";

import { useEffect, useState } from "react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import {
  Activity, Building2, CalendarDays, Check, ChevronDown, 
  DollarSign, HandCoins, Landmark, Lock, LockOpen, Moon, 
  Package, Sparkles, Store, Sun, TrendingDown, TrendingUp, 
  Wallet, Search, Plus, Target, AlertTriangle, Mail, Bell,
  FileDown, UploadCloud, Flame, Zap, ArrowRight, MessageSquare, Database, RefreshCw, BarChart2, Eye, ArrowRightLeft
} from "lucide-react";

/* ════════════════════════════════════════════════════════════════════════
   TYPES & CONSTANTS
   ════════════════════════════════════════════════════════════════════════ */

type ViewMode = "detailed" | "quick";
type BranchId = "jubail" | "dammam";
type TabId = "register" | "radar" | "suppliers" | "pulse" | "consolidation" | "ai";
type Kind = "cash_sale" | "credit_received" | "bank_in" | "jotun" | "hempel" | "sigma" | "other" | "salaries" | "tax" | "misc_expense";

interface Txn {
  id: string;
  flow: "in" | "out";
  kind: Kind;
  amount: number;
  title: string;
  time: string;
}

const SEED_TXNS: Txn[] = [
  { id: "1", flow: "in", kind: "cash_sale", amount: 1150, title: "Walk-in · Jotun Fenomastic", time: "08:42" },
  { id: "2", flow: "in", kind: "cash_sale", amount: 6325, title: "Contractor · Bulk Paint", time: "10:20" },
  { id: "3", flow: "in", kind: "credit_received", amount: 8500, title: "Al Noor Contracting", time: "09:30" },
  { id: "4", flow: "out", kind: "jotun", amount: 12400, title: "Jotun Arabia Restock", time: "10:00" },
  { id: "5", flow: "out", kind: "hempel", amount: 7850, title: "Hempel Marine Coatings", time: "10:45" },
  { id: "6", flow: "out", kind: "salaries", amount: 4500, title: "Staff advances", time: "12:00" },
];

const CONTRACTORS = [
  {
    id: "c1", name: "Al-Futtaim Contractors", outstanding: 124500, dueDate: "2026-08-30", status: "overdue", daysLate: 12,
    riskLevel: "High", avgPaymentTime: "18 Days Late", clearedInvoices: 14,
    history: [
      { id: "INV-891", amount: 45000, date: "2026-07-15", status: "paid_late" },
      { id: "INV-840", amount: 22000, date: "2026-06-01", status: "paid_on_time" },
      { id: "INV-710", amount: 18500, date: "2026-04-20", status: "paid_late" },
    ]
  },
  {
    id: "c2", name: "Eastern Paint Bros", outstanding: 45200, dueDate: "2026-09-14", status: "due_soon",
    riskLevel: "Medium", avgPaymentTime: "2 Days Late", clearedInvoices: 42,
    history: [
      { id: "INV-902", amount: 12000, date: "2026-08-10", status: "paid_on_time" },
      { id: "INV-885", amount: 8400, date: "2026-07-22", status: "paid_on_time" },
      { id: "INV-850", amount: 15600, date: "2026-06-15", status: "paid_late" },
    ]
  },
  {
    id: "c3", name: "Jubail Coastal Development", outstanding: 8500, dueDate: "2026-10-05", status: "on_track",
    riskLevel: "Low", avgPaymentTime: "On Time", clearedInvoices: 89,
    history: [
      { id: "INV-915", amount: 32000, date: "2026-08-28", status: "paid_on_time" },
      { id: "INV-900", amount: 14500, date: "2026-08-01", status: "paid_on_time" },
      { id: "INV-870", amount: 26000, date: "2026-07-10", status: "paid_on_time" },
    ]
  }
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

function Pill({ kind }: { kind: Kind }) {
  const map: Record<Kind, string> = {
    cash_sale: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    credit_received: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
    bank_in: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
    jotun: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
    hempel: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
    sigma: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-300",
    other: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
    salaries: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
    tax: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
    misc_expense: "bg-stone-100 text-stone-700 dark:bg-stone-500/20 dark:text-stone-300",
  };
  const labelMap: Record<Kind, string> = {
    cash_sale: "Cash Sale", credit_received: "Credit In", bank_in: "Bank In",
    jotun: "Jotun", hempel: "Hempel", sigma: "Sigma", other: "Other Paint",
    salaries: "Salaries", tax: "Tax", misc_expense: "Expense"
  };
  return (
    <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wide uppercase ${map[kind]}`}>
      {labelMap[kind]}
    </span>
  );
}

function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={dark}
      className="relative flex h-10 w-[72px] shrink-0 items-center rounded-full bg-slate-100 px-1 shadow-inner ring-1 ring-slate-900/5 transition-colors dark:bg-[#171b28] dark:ring-white/10"
    >
      <span className="absolute left-2.5 text-slate-400"><Sun size={14} /></span>
      <span className="absolute right-2.5 text-slate-400"><Moon size={14} /></span>
      <span
        className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-800 shadow-sm transition-transform duration-500 ease-[cubic-bezier(0.34,1.4,0.5,1)] dark:bg-slate-800 dark:text-white ${dark ? "translate-x-[32px]" : "translate-x-0"}`}
      >
        {dark ? <Moon size={14} /> : <Sun size={14} />}
      </span>
    </button>
  );
}

function Sidebar({ tab, setTab }: { tab: TabId; setTab: (t: TabId) => void }) {
  const nav = [
    { id: "register" as TabId, label: "Daily Register", icon: Wallet },
    { id: "radar" as TabId, label: "Credit Radar", icon: Target },
    { id: "suppliers" as TabId, label: "Suppliers & Payables", icon: Package },
    { id: "pulse" as TabId, label: "Financial Pulse", icon: Activity },
    { id: "consolidation" as TabId, label: "Branch Consolidation", icon: Building2 },
    { id: "ai" as TabId, label: "Nauman AI", icon: Sparkles },
  ];
  return (
    <aside className="hidden w-64 shrink-0 flex-col overflow-hidden bg-gradient-to-b from-purple-700 to-indigo-900 p-5 text-white lg:flex relative z-40">
      <div className="relative flex items-center gap-3 px-1 pb-8 pt-1">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 font-display text-base font-extrabold tracking-tight shadow-sm ring-1 ring-white/20 backdrop-blur-md">
          JCT
        </div>
        <div className="leading-tight">
          <p className="font-display text-[15px] font-extrabold tracking-tight">JCT Financial OS</p>
          <p className="text-[11px] text-white/60">Jubail Corp. Trading Est.</p>
        </div>
      </div>

      <nav className="flex flex-col gap-2 flex-1">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">Modules</p>
        {nav.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`group relative flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[14px] font-semibold transition-all ${
                active
                  ? "border border-white/40 bg-white/20 text-white shadow-sm backdrop-blur-md"
                  : "border border-transparent text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.2 : 1.8} className={id === "ai" && active ? "text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.8)]" : ""} />
              <span className="flex-1">{label}</span>
            </button>
          );
        })}
      </nav>
      
      <div className="mt-auto space-y-3">
        <div className="rounded-xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur-md">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/50">Drawer Status</p>
          <div className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-white">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            </span>
            Active Session
          </div>
        </div>
      </div>
    </aside>
  );
}

function Column({ title, type, txns, onAdd }: { title: string; type: "in" | "out"; txns: Txn[]; onAdd: (t: Omit<Txn, "id" | "time">) => void }) {
  const [amt, setAmt] = useState("");
  const [kind, setKind] = useState<Kind>(type === "in" ? "cash_sale" : "jotun");
  const [note, setNote] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amt);
    if (Number.isNaN(val) || val <= 0) return;
    onAdd({ amount: val, kind, flow: type, title: note || (type === "in" ? "Walk-in Sale" : "Standard Expense") });
    setAmt("");
    setNote("");
  };

  const options: {v: Kind; l: string}[] = type === "in" 
    ? [{v: "cash_sale", l: "Cash Sale"}, {v: "credit_received", l: "Credit In"}, {v: "bank_in", l: "Bank In"}]
    : [{v: "jotun", l: "Jotun"}, {v: "hempel", l: "Hempel"}, {v: "sigma", l: "Sigma"}, {v: "other", l: "Other Paint"}, {v: "salaries", l: "Salaries"}, {v: "tax", l: "Tax"}, {v: "misc_expense", l: "Expense"}];

  const total = r2(txns.reduce((a, b) => a + b.amount, 0));

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/5 dark:bg-[#121620] dark:ring-white/10">
      <div className="p-4 border-b border-slate-100 dark:border-white/5 shrink-0 space-y-4">
        <h2 className="font-bold text-lg flex items-center gap-2">
          {type === 'in' ? <TrendingUp className="text-emerald-500" /> : <TrendingDown className="text-rose-500" />}
          {title}
          <span className="ml-auto text-xs font-bold text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-md">{txns.length}</span>
        </h2>
        
        <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2 bg-slate-50 p-2.5 rounded-xl ring-1 ring-slate-200 dark:bg-white/5 dark:ring-white/10">
          <input type="number" step="0.01" value={amt} onChange={e => setAmt(e.target.value)} placeholder="0.00" className="w-24 px-3 py-2 bg-white rounded-lg ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-purple-500 font-bold dark:bg-[#171b28] dark:ring-white/20" />
          <select value={kind} onChange={e => setKind(e.target.value as Kind)} className="px-3 py-2 bg-white rounded-lg ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-purple-500 font-bold text-sm dark:bg-[#171b28] dark:ring-white/20">
            {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Note..." className="flex-1 min-w-[100px] px-3 py-2 bg-white rounded-lg ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-purple-500 text-sm font-medium dark:bg-[#171b28] dark:ring-white/20" />
          <button type="submit" className="flex items-center gap-1 px-3 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition text-sm shrink-0">
            <Plus size={16} /> Add
          </button>
        </form>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {txns.map(t => (
          <div key={t.id} className="flex items-center justify-between p-3.5 bg-white rounded-xl ring-1 ring-slate-100 shadow-sm hover:shadow-md transition-shadow dark:bg-[#171b28] dark:ring-white/5">
            <div className="flex flex-col gap-1.5 min-w-0 pr-4">
              <div className="flex items-center gap-2.5">
                <Pill kind={t.kind} />
                <span className="text-[11px] text-slate-400 font-bold tracking-wider">{t.time}</span>
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{t.title}</span>
            </div>
            <div className={`font-display font-extrabold text-lg whitespace-nowrap ${type === 'in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>
              {type === 'in' ? '+' : '-'}{fmt(t.amount)}
            </div>
          </div>
        ))}
        {txns.length === 0 && (
          <div className="flex items-center justify-center h-full text-sm font-bold text-slate-400">No entries yet.</div>
        )}
      </div>

      <div className="p-4 border-t border-slate-100 dark:border-white/5 shrink-0 bg-slate-50 dark:bg-white/[0.02]">
        <div className="flex justify-between items-center">
          <span className="font-bold text-sm uppercase tracking-wider text-slate-500">Total {title}</span>
          <span className={`font-display text-2xl font-extrabold ${type === 'in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-white'}`}>{fmt(total)}</span>
        </div>
      </div>
    </div>
  );
}

function QuickInput({ label, pill, value, onChange }: { label: string; pill?: Kind; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 mb-5">
      <div className="flex flex-col gap-1.5">
         <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">{label}</span>
         {pill && <div><Pill kind={pill} /></div>}
      </div>
      <div className="relative shrink-0">
         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">SAR</span>
         <input 
           type="number" step="0.01"
           value={value} onChange={e => onChange(e.target.value)}
           className="w-36 lg:w-40 pl-12 pr-4 py-2.5 bg-slate-50 rounded-xl ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-purple-500 font-display font-bold text-right dark:bg-[#171b28] dark:ring-white/20 dark:text-white transition-shadow"
           placeholder="0.00"
         />
      </div>
    </div>
  );
}

function CreditRadarView() {
  const [activeId, setActiveId] = useState(CONTRACTORS[0].id);
  const active = CONTRACTORS.find(c => c.id === activeId)!;

  return (
    <div className="flex h-full w-full gap-6 p-6 overflow-hidden">
      {/* Left Column: Active Radar & Entry */}
      <div className="flex-[2] flex flex-col gap-6 overflow-hidden">
        
        {/* New Credit Issue Box */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/5 p-5 shrink-0 dark:bg-[#121620] dark:ring-white/10">
           <h2 className="font-display font-extrabold text-lg mb-4 text-slate-900 dark:text-white flex items-center gap-2">
              <Plus size={18} className="text-purple-500" /> Issue New Credit
           </h2>
           <div className="flex flex-wrap items-center gap-3">
             <div className="flex-[2] min-w-[200px] relative">
               <input type="text" placeholder="Search Contractor..." className="w-full px-4 py-2.5 bg-slate-50 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-purple-500 font-medium text-sm outline-none dark:bg-[#171b28] dark:ring-white/10 dark:text-white transition-shadow" />
             </div>
             <input type="number" placeholder="Amount (SAR)" className="flex-1 min-w-[120px] px-4 py-2.5 bg-slate-50 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-purple-500 font-bold text-sm outline-none dark:bg-[#171b28] dark:ring-white/10 dark:text-white transition-shadow" />
             <input type="text" placeholder="Receipt #" className="flex-1 min-w-[120px] px-4 py-2.5 bg-slate-50 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-purple-500 font-medium text-sm outline-none dark:bg-[#171b28] dark:ring-white/10 dark:text-white transition-shadow" />
             <input type="date" className="flex-1 min-w-[140px] px-4 py-2.5 bg-slate-50 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-purple-500 font-medium text-sm outline-none dark:bg-[#171b28] dark:ring-white/10 dark:text-white text-slate-500 transition-shadow" />
             <button className="px-6 py-2.5 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition shadow-md shadow-purple-500/20 whitespace-nowrap shrink-0">
               Issue Credit
             </button>
           </div>
        </div>

        {/* Pending Collections List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
           <h2 className="font-display font-extrabold text-lg mb-4 text-slate-900 dark:text-white flex items-center justify-between">
              Pending Collections
              <span className="text-xs font-bold text-slate-500 bg-slate-200 dark:bg-white/10 px-2 py-1 rounded-md">{CONTRACTORS.length} Accounts</span>
           </h2>
           {CONTRACTORS.map(c => (
              <button 
                key={c.id} 
                onClick={() => setActiveId(c.id)}
                className={`w-full text-left flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl ring-1 transition-all gap-4 ${activeId === c.id ? 'bg-white ring-purple-500 shadow-md dark:bg-[#1f2536]' : 'bg-white ring-slate-900/5 hover:shadow-sm dark:bg-[#121620] dark:ring-white/10 hover:dark:bg-[#1a1f2e]'}`}
              >
                 <div className="flex items-center gap-4">
                   <div className={`h-12 w-12 rounded-full flex items-center justify-center font-display font-extrabold text-xl text-white shadow-sm shrink-0 ${activeId === c.id ? 'bg-gradient-to-br from-purple-500 to-indigo-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                     {c.name.charAt(0)}
                   </div>
                   <div>
                     <h3 className="font-bold text-base text-slate-900 dark:text-white">{c.name}</h3>
                     <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1 uppercase tracking-wide">Due: {c.dueDate}</p>
                   </div>
                 </div>
                 <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 w-full sm:w-auto">
                   <span className="font-display font-extrabold text-xl text-slate-900 dark:text-white">{fmt(c.outstanding)} <span className="text-xs text-slate-400">SAR</span></span>
                   {c.status === 'overdue' && <span className="px-2.5 py-1 bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 rounded-md text-[10px] font-extrabold uppercase tracking-wide shrink-0">Overdue ({c.daysLate}d late)</span>}
                   {c.status === 'due_soon' && <span className="px-2.5 py-1 bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 rounded-md text-[10px] font-extrabold uppercase tracking-wide shrink-0">Due This Week</span>}
                   {c.status === 'on_track' && <span className="px-2.5 py-1 bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300 rounded-md text-[10px] font-extrabold uppercase tracking-wide shrink-0">On Track</span>}
                 </div>
              </button>
           ))}
        </div>
      </div>

      {/* Right Column: Contractor Intelligence */}
      <div className="flex-[1.5] flex flex-col bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/5 overflow-hidden dark:bg-[#121620] dark:ring-white/10">
         <div className="p-8 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-5 mb-6">
               <div className="h-16 w-16 rounded-2xl flex items-center justify-center font-display font-extrabold text-3xl text-white shadow-md bg-gradient-to-br from-purple-500 to-indigo-500 shrink-0">
                  {active.name.charAt(0)}
               </div>
               <div>
                  <h2 className="font-display font-extrabold text-2xl text-slate-900 dark:text-white leading-tight">{active.name}</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Contractor ID: {active.id.toUpperCase()}-089</p>
               </div>
            </div>
            
            <div className="p-6 rounded-2xl bg-white dark:bg-[#171b28] ring-1 ring-slate-900/5 dark:ring-white/10 shadow-sm flex items-center justify-between">
               <div>
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Total Outstanding Debt</p>
                 <p className={`font-display font-extrabold text-3xl ${active.status === 'overdue' ? 'text-rose-600 dark:text-rose-500' : 'text-slate-900 dark:text-white'}`}>{fmt(active.outstanding)} <span className="text-sm text-slate-400">SAR</span></p>
               </div>
               {active.status === 'overdue' && (
                 <div className="h-14 w-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center dark:bg-rose-500/20 dark:text-rose-400 ring-4 ring-rose-50 dark:ring-rose-500/10">
                    <AlertTriangle size={26} />
                 </div>
               )}
            </div>
         </div>
         
         <div className="flex-1 overflow-y-auto p-8 space-y-8">
            {/* Analytics */}
            <div>
               <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-4">Historical Reliability</h3>
               <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 ring-1 ring-slate-100 dark:ring-white/5 text-center">
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Avg. Payment</p>
                     <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{active.avgPaymentTime}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 ring-1 ring-slate-100 dark:ring-white/5 text-center">
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Risk Level</p>
                     <p className={`font-extrabold text-sm ${active.riskLevel === 'High' ? 'text-rose-600' : active.riskLevel === 'Medium' ? 'text-amber-600' : 'text-emerald-600'}`}>{active.riskLevel}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 ring-1 ring-slate-100 dark:ring-white/5 text-center">
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Cleared Invs</p>
                     <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{active.clearedInvoices}</p>
                  </div>
               </div>
            </div>
            
            {/* Action Zone */}
            <div className="flex gap-4">
               <button className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 shadow-md">
                 <Mail size={18} /> Email Reminder
               </button>
               <button className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-purple-100 text-purple-700 font-bold hover:bg-purple-200 transition dark:bg-purple-500/20 dark:text-purple-300 shadow-sm ring-1 ring-purple-500/20">
                 <Bell size={18} /> Push Notification
               </button>
            </div>
            
            {/* Timeline */}
            <div>
               <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-5">Recent Receipts</h3>
               <div className="space-y-5 relative before:absolute before:top-3 before:bottom-3 before:left-3.5 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800">
                  {active.history.map(h => (
                    <div key={h.id} className="relative flex items-start gap-5 z-10">
                       <div className={`w-7 h-7 rounded-full ring-4 ring-white dark:ring-[#121620] flex items-center justify-center shrink-0 mt-2 ${h.status === 'paid_on_time' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'}`}>
                          {h.status === 'paid_on_time' ? <Check size={14} strokeWidth={4} /> : <AlertTriangle size={12} strokeWidth={3} />}
                       </div>
                       <div className="flex-1 bg-slate-50 dark:bg-white/5 rounded-xl p-4 ring-1 ring-slate-100 dark:ring-white/5 flex items-center justify-between shadow-sm">
                          <div>
                            <p className="font-bold text-sm text-slate-900 dark:text-white">{h.id}</p>
                            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wide">{h.date}</p>
                          </div>
                          <div className="text-right">
                             <p className="font-bold text-sm text-slate-900 dark:text-white mb-1">{fmt(h.amount)} SAR</p>
                             {h.status === 'paid_on_time' ? (
                               <span className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 rounded-md">On Time</span>
                             ) : (
                               <span className="text-[10px] font-extrabold uppercase tracking-wide text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-500/20 px-2 py-0.5 rounded-md">Late</span>
                             )}
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════════════════════════ */

function SupplierHubView() {
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

  const officialPayables = [
    { id: 1, brand: "Jotun", amountPaid: 45000, pendingBills: 12000, color: "blue" },
    { id: 2, brand: "Hempel", amountPaid: 28000, pendingBills: 5400, color: "purple" },
    { id: 3, brand: "Sigma", amountPaid: 15500, pendingBills: 0, color: "fuchsia" },
  ];

  const privateCommissions = [
    { id: 1, name: "Ali R. (Broker)", dealRef: "Jubail Port Proj.", amount: 15000, date: "2026-09-01" },
    { id: 2, name: "Saad Contractor", dealRef: "Al-Noor Complex", amount: 8500, date: "2026-09-10" },
  ];
  
  const [supplierSearch, setSupplierSearch] = useState("");
  const [logAmount, setLogAmount] = useState("");
  const [logType, setLogType] = useState("purchase");
  const [logDate, setLogDate] = useState("");

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto w-full">
      {/* Top section: Official Brand Payables */}
      <div className="flex flex-col gap-4">
        <h2 className="font-display font-extrabold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
          <Package className="text-purple-500" /> Official Brand Payables
        </h2>
        
        {/* Quick Supplier Add/Log Card */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/5 p-5 dark:bg-[#121620] dark:ring-white/10">
          <h3 className="font-bold text-sm text-slate-500 mb-4 uppercase tracking-wider">Log Purchase or Return</h3>
          <div className="flex flex-wrap items-center gap-3">
             <input list="suppliers-list" type="text" placeholder="Search Supplier (Jotun, Hempel...)" value={supplierSearch} onChange={e=>setSupplierSearch(e.target.value)} className="flex-[2] min-w-[200px] px-4 py-2.5 bg-slate-50 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-purple-500 font-medium text-sm outline-none dark:bg-[#171b28] dark:ring-white/10 dark:text-white transition-shadow" />
             <datalist id="suppliers-list">
               <option value="Jotun Arabia" />
               <option value="Hempel Marine Coatings" />
               <option value="Sigma Paints" />
             </datalist>
             <input type="number" placeholder="Amount (SAR)" value={logAmount} onChange={e=>setLogAmount(e.target.value)} className="flex-1 min-w-[120px] px-4 py-2.5 bg-slate-50 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-purple-500 font-bold text-sm outline-none dark:bg-[#171b28] dark:ring-white/10 dark:text-white transition-shadow" />
             <select value={logType} onChange={e=>setLogType(e.target.value)} className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-xl ring-1 outline-none font-bold text-sm transition-shadow ${logType === 'return' ? 'bg-amber-50 ring-amber-200 text-amber-700 focus:ring-amber-500 dark:bg-amber-500/10 dark:ring-amber-500/30 dark:text-amber-400' : 'bg-slate-50 ring-slate-200 focus:ring-2 focus:ring-purple-500 dark:bg-[#171b28] dark:ring-white/10 dark:text-white text-slate-700'}`}>
               <option value="purchase">Purchase</option>
               <option value="return">Return / Refund</option>
             </select>
             <input type="date" value={logDate} onChange={e=>setLogDate(e.target.value)} className="flex-1 min-w-[140px] px-4 py-2.5 bg-slate-50 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-purple-500 font-medium text-sm outline-none dark:bg-[#171b28] dark:ring-white/10 dark:text-white text-slate-500 transition-shadow" />
             <button className={`px-6 py-2.5 text-white rounded-xl font-bold transition shadow-md whitespace-nowrap shrink-0 ${logType === 'return' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20'}`}>
               {logType === 'return' ? 'Log Return' : 'Log Purchase'}
             </button>
          </div>
        </div>

        {/* Payables Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {officialPayables.map(p => (
            <div key={p.id} className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/5 p-5 dark:bg-[#121620] dark:ring-white/10 flex flex-col gap-4">
               <div className="flex items-center gap-3">
                 <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-display font-extrabold text-white text-lg bg-${p.color}-500 shadow-sm`}>
                   {p.brand.charAt(0)}
                 </div>
                 <h3 className="font-display font-extrabold text-lg text-slate-900 dark:text-white">{p.brand}</h3>
               </div>
               <div className="flex flex-col gap-1">
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Paid This Month</p>
                 <p className="font-display font-extrabold text-xl text-slate-800 dark:text-slate-200">SAR {fmt(p.amountPaid)}</p>
               </div>
               <div className="flex flex-col gap-1 pt-3 border-t border-slate-100 dark:border-white/5">
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Bills</p>
                 <p className={`font-display font-extrabold text-lg ${p.pendingBills > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-emerald-600 dark:text-emerald-500'}`}>SAR {fmt(p.pendingBills)}</p>
               </div>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="my-2 border-b border-slate-200 dark:border-white/10"></div>

      {/* Bottom section: The Private Vault */}
      <div className="flex flex-col gap-4 relative min-h-[300px]">
        
        {!unlocked && (
          <div className="absolute inset-0 z-10 rounded-2xl backdrop-blur-xl bg-slate-900/10 dark:bg-slate-900/40 flex flex-col items-center justify-center ring-1 ring-white/20 shadow-2xl overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-br from-slate-100/40 to-slate-200/40 dark:from-slate-800/60 dark:to-slate-900/60 backdrop-blur-md"></div>
             <div className="relative z-20 flex flex-col items-center gap-4 bg-white/60 dark:bg-[#121620]/80 p-8 rounded-3xl shadow-xl ring-1 ring-white/50 dark:ring-white/10 backdrop-blur-2xl">
                <div className="h-16 w-16 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg dark:bg-black dark:ring-1 dark:ring-white/10">
                   <Lock size={28} />
                </div>
                <div className="text-center">
                  <h3 className="font-display font-extrabold text-xl text-slate-900 dark:text-white mb-1">Private Vault Locked</h3>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Enter PIN to view confidential ledgers</p>
                </div>
                <input 
                  type="password" 
                  value={pin}
                  onChange={handlePin}
                  placeholder="••••"
                  className="mt-2 w-32 text-center tracking-[0.5em] font-display text-2xl font-bold py-3 bg-white/80 dark:bg-black/50 rounded-xl ring-1 ring-slate-900/10 dark:ring-white/20 outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition-shadow text-slate-900 dark:text-white shadow-inner"
                />
             </div>
          </div>
        )}

        <div className={`flex flex-col gap-4 transition-all duration-500 ${!unlocked ? 'opacity-30 blur-sm pointer-events-none' : 'opacity-100'}`}>
           <div className="flex items-center justify-between">
             <h2 className="font-display font-extrabold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
               <LockOpen className="text-slate-700 dark:text-slate-300" /> The Private Vault
             </h2>
             <button onClick={() => setUnlocked(false)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-bold transition flex items-center gap-2">
                <Lock size={14} /> Lock Vault
             </button>
           </div>
           
           <div className="bg-slate-900 rounded-2xl shadow-xl ring-1 ring-slate-800 p-1 sm:p-6 text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 p-32 bg-indigo-500/10 blur-[100px] rounded-full"></div>
              
              <div className="relative z-10 flex flex-col gap-6">
                 <div className="flex items-center justify-between px-4 sm:px-0">
                    <div>
                      <h3 className="font-bold text-slate-400 uppercase tracking-widest text-xs mb-1">Confidential Ledger</h3>
                      <p className="font-display font-extrabold text-xl text-white">Broker & Contractor Commissions</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Dispensed</p>
                      <p className="font-display font-extrabold text-2xl text-emerald-400">SAR 23,500</p>
                    </div>
                 </div>

                 <div className="bg-black/40 rounded-xl ring-1 ring-white/10 overflow-hidden">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                       <thead className="bg-white/5 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                          <tr>
                             <th className="px-4 py-3">Recipient Name</th>
                             <th className="px-4 py-3">Deal Reference</th>
                             <th className="px-4 py-3">Date</th>
                             <th className="px-4 py-3 text-right">Amount</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-white/5 font-medium">
                          {privateCommissions.map(c => (
                             <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                                <td className="px-4 py-3 text-white flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">{c.name.charAt(0)}</div>
                                  {c.name}
                                </td>
                                <td className="px-4 py-3 text-slate-300">{c.dealRef}</td>
                                <td className="px-4 py-3 text-slate-400">{c.date}</td>
                                <td className="px-4 py-3 text-right font-bold text-emerald-400">SAR {fmt(c.amount)}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
                 
                 <div className="flex justify-end px-4 sm:px-0">
                    <button className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-sm transition-colors ring-1 ring-white/20 shadow-lg">
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

function FinancialPulseView() {
  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto w-full">
      <div className="flex items-center justify-between mb-2">
         <div className="flex flex-col gap-1.5">
           <h2 className="font-display font-extrabold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="text-emerald-500 dark:text-emerald-400" /> Sales & Business Analytics Hub
           </h2>
           <p className="text-slate-500 dark:text-slate-400 font-semibold text-sm">Core sales revenue, profit margins, and collections performance.</p>
         </div>
      </div>

      {/* 1. Top Row: Primary Sales & Cash KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* KPI 1 */}
        <div className="bg-white dark:bg-[#121620] rounded-2xl shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10 p-5 flex flex-col gap-3">
          <div className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">Total Revenue (This Month)</div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">SAR 482,900</div>
          <div className="flex items-center gap-2">
             <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1">
               <TrendingUp size={12} /> +14.2%
             </span>
             <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">vs last month</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white dark:bg-[#121620] rounded-2xl shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10 p-5 flex flex-col gap-3">
          <div className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">Cash vs Credit (Collections)</div>
          <div className="flex flex-col gap-1">
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 leading-none">SAR 364,500 <span className="text-xs text-slate-500">Cash</span></div>
            <div className="text-sm font-bold text-slate-400 dark:text-slate-500 leading-none">SAR 118,400 <span className="text-xs">Credit</span></div>
          </div>
          <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-1.5 mt-1 overflow-hidden flex">
             <div className="bg-emerald-500 h-full" style={{ width: '75%' }}></div>
             <div className="bg-slate-300 dark:bg-slate-600 h-full" style={{ width: '25%' }}></div>
          </div>
          <p className="text-xs font-semibold text-slate-500">75% cash realization rate</p>
        </div>

        {/* KPI 3 */}
        <div className="bg-white dark:bg-[#121620] rounded-2xl shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10 p-5 flex flex-col gap-3">
          <div className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">Estimated Gross Profit</div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">SAR 128,400</div>
          <div className="flex items-center gap-2">
             <span className="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 px-2 py-0.5 rounded text-xs font-bold">
               26.6% Margin
             </span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white dark:bg-[#121620] rounded-2xl shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10 p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start">
             <div className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">Monthly Sales Target</div>
             <div className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded">8 Days Left</div>
          </div>
          <div className="flex items-center gap-4 mt-2">
             {/* Radial Progress */}
             <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path className="text-slate-100 dark:text-white/5" strokeWidth="4" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="text-emerald-500" strokeWidth="4" strokeDasharray="84, 100" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <span className="absolute text-sm font-black text-slate-900 dark:text-white">84%</span>
             </div>
             <div className="flex flex-col">
                <span className="text-sm font-extrabold text-slate-900 dark:text-white">SAR 575,000</span>
                <span className="text-xs font-semibold text-slate-500">Target for June</span>
             </div>
          </div>
        </div>
      </div>

      {/* 2. Middle Row: Multi-Type Interactive Charts */}
      <div className="flex flex-col lg:flex-row gap-6">
         {/* Left (60% width): Monthly Revenue & Collection Trajectory */}
         <div className="lg:w-[60%] bg-white dark:bg-[#121620] rounded-3xl p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10 flex flex-col gap-6">
            <div className="flex justify-between items-start">
               <div>
                 <h3 className="font-display font-extrabold text-lg text-slate-900 dark:text-white">Revenue vs Supplier Costs</h3>
                 <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mt-1">Monthly Trajectory (Past 6 Months)</p>
               </div>
               <select className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 outline-none">
                 <option>Monthly</option>
                 <option>Weekly</option>
               </select>
            </div>
            
            <div className="flex-1 flex items-end justify-between gap-4 pt-8 relative min-h-[220px]">
              {/* Tooltip on the highest month (June) */}
              <div className="absolute top-0 right-[15%] z-20 bg-slate-900 dark:bg-slate-800 text-white rounded-xl p-3 shadow-xl transform -translate-x-1/2 -translate-y-4 pointer-events-none animate-fade-in-up">
                 <div className="text-xs font-bold text-slate-300 mb-1">June Analytics</div>
                 <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                       <span className="text-[10px] text-emerald-400 uppercase font-bold">Sales</span>
                       <span className="font-black text-sm">SAR 124,500</span>
                    </div>
                    <div className="w-px h-6 bg-slate-700"></div>
                    <div className="flex flex-col">
                       <span className="text-[10px] text-indigo-300 uppercase font-bold">Costs</span>
                       <span className="font-black text-sm">SAR 88,200</span>
                    </div>
                 </div>
                 <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-slate-900 dark:border-t-slate-800"></div>
              </div>

              {/* Chart grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
                <div className="border-b border-dashed border-slate-200 dark:border-white/5 w-full"></div>
                <div className="border-b border-dashed border-slate-200 dark:border-white/5 w-full"></div>
                <div className="border-b border-dashed border-slate-200 dark:border-white/5 w-full"></div>
                <div className="border-b border-slate-200 dark:border-white/10 w-full"></div>
              </div>

              {/* Month Bars */}
              {['Jan', 'Feb', 'Mar', 'Apr', 'May'].map((month, i) => (
                <div key={month} className="relative z-10 flex flex-col items-center gap-2 flex-1 group cursor-pointer hover:opacity-80 transition-opacity">
                  <div className="flex items-end gap-1.5 h-40 w-full justify-center">
                    <div className="w-1/3 bg-emerald-400 dark:bg-emerald-500 rounded-t-sm" style={{ height: `${50 + (i * 8)}%` }}></div>
                    <div className="w-1/3 bg-slate-300 dark:bg-indigo-400/50 rounded-t-sm" style={{ height: `${35 + (i * 5)}%` }}></div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{month}</span>
                </div>
              ))}
              
              {/* Highlighted Month (June) */}
              <div className="relative z-10 flex flex-col items-center gap-2 flex-1 group cursor-pointer">
                <div className="flex items-end gap-1.5 h-40 w-full justify-center relative">
                  <div className="absolute -inset-x-2 -inset-y-4 bg-slate-50 dark:bg-white/5 rounded-xl -z-10"></div>
                  <div className="w-1/3 bg-emerald-500 dark:bg-emerald-400 rounded-t-sm shadow-[0_0_15px_rgba(16,185,129,0.3)]" style={{ height: '95%' }}></div>
                  <div className="w-1/3 bg-slate-400 dark:bg-indigo-400 rounded-t-sm" style={{ height: '70%' }}></div>
                </div>
                <span className="text-[10px] font-bold text-slate-900 dark:text-white uppercase bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded-full">Jun</span>
              </div>
            </div>

            <div className="flex justify-center gap-6 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Paint Sales</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-slate-300 dark:bg-indigo-400/50"></div>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Supplier Costs</span>
              </div>
            </div>
         </div>

         {/* Right (40% width): Sales by Product Category & Brand */}
         <div className="lg:w-[40%] bg-white dark:bg-[#121620] rounded-3xl p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10 flex flex-col gap-6">
            <div>
              <h3 className="font-display font-extrabold text-lg text-slate-900 dark:text-white">Sales by Category & Brand</h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mt-1">Market share breakdown</p>
            </div>

            <div className="flex-1 flex flex-col justify-center gap-6">
               <div className="flex flex-col gap-4">
                 <div>
                   <div className="flex justify-between text-sm mb-1.5">
                     <span className="font-bold text-slate-700 dark:text-slate-300">Decorative Wall Paint <span className="text-slate-400 font-medium text-xs">(Jotun)</span></span>
                     <span className="font-extrabold text-blue-600 dark:text-blue-400">46%</span>
                   </div>
                   <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                     <div className="h-full bg-blue-500 rounded-full" style={{ width: '46%' }}></div>
                   </div>
                 </div>

                 <div>
                   <div className="flex justify-between text-sm mb-1.5">
                     <span className="font-bold text-slate-700 dark:text-slate-300">Protective & Marine <span className="text-slate-400 font-medium text-xs">(Hempel)</span></span>
                     <span className="font-extrabold text-indigo-600 dark:text-indigo-400">28%</span>
                   </div>
                   <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                     <div className="h-full bg-indigo-500 rounded-full" style={{ width: '28%' }}></div>
                   </div>
                 </div>

                 <div>
                   <div className="flex justify-between text-sm mb-1.5">
                     <span className="font-bold text-slate-700 dark:text-slate-300">Exterior & Enamels <span className="text-slate-400 font-medium text-xs">(Sigma)</span></span>
                     <span className="font-extrabold text-emerald-600 dark:text-emerald-400">16%</span>
                   </div>
                   <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                     <div className="h-full bg-emerald-500 rounded-full" style={{ width: '16%' }}></div>
                   </div>
                 </div>

                 <div>
                   <div className="flex justify-between text-sm mb-1.5">
                     <span className="font-bold text-slate-700 dark:text-slate-300">Hardware, Brushes & Thinners</span>
                     <span className="font-extrabold text-amber-600 dark:text-amber-400">10%</span>
                   </div>
                   <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                     <div className="h-full bg-amber-500 rounded-full" style={{ width: '10%' }}></div>
                   </div>
                 </div>
               </div>

               <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-200 dark:border-white/10 mt-auto">
                 <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 text-center">Customer Conversion Split</div>
                 <div className="flex justify-between items-center text-sm">
                   <div className="flex flex-col items-center">
                     <span className="font-black text-slate-900 dark:text-white text-lg">42%</span>
                     <span className="font-semibold text-slate-500 text-xs text-center">Retail Walk-in</span>
                   </div>
                   <div className="w-px h-8 bg-slate-200 dark:bg-white/10"></div>
                   <div className="flex flex-col items-center">
                     <span className="font-black text-slate-900 dark:text-white text-lg">58%</span>
                     <span className="font-semibold text-slate-500 text-xs text-center">Wholesale Contractor</span>
                   </div>
                 </div>
               </div>
            </div>
         </div>
      </div>

      {/* 3. Bottom Section: Fast-Moving Inventory & Secondary Cash Buffer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Top 5 Fast-Moving Items */}
         <div className="lg:col-span-2 bg-white dark:bg-[#121620] rounded-3xl p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10 flex flex-col gap-4">
            <h3 className="font-display font-extrabold text-lg text-slate-900 dark:text-white">Top 5 Fast-Moving Items (MTD)</h3>
            
            <div className="flex flex-col gap-3">
              {[
                { sku: 'Jotun Fenomastic Pure Matt', units: 342, rev: '41,040' },
                { sku: 'Hempel Hempadur Primer 15570', units: 215, rev: '38,700' },
                { sku: 'Sigma Rust Primer', units: 180, rev: '19,800' },
                { sku: 'Hardware Thinner 200L Drum', units: 45, rev: '15,750' },
                { sku: 'Jotashield Decor High Build', units: 120, rev: '21,600' }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center text-[10px] font-extrabold text-slate-500">
                      {idx + 1}
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{item.sku}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-semibold text-slate-500">Units</span>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{item.units}</span>
                    </div>
                    <div className="flex flex-col items-end w-20">
                      <span className="text-xs font-semibold text-slate-500">Revenue</span>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{item.rev}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
         </div>

         {/* Secondary Cash Health Strip */}
         <div className="lg:col-span-1 flex flex-col gap-4">
           <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 text-white shadow-lg shadow-emerald-500/20 flex flex-col justify-center flex-1 relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
             <div className="text-emerald-100 font-bold text-xs uppercase tracking-wider mb-1">Cash Buffer</div>
             <div className="text-4xl font-black mb-2">42 <span className="text-lg font-bold text-emerald-200">Days</span></div>
             <p className="text-sm font-medium text-emerald-50">Operational runway based on current cash flow and average daily burn.</p>
           </div>
           
           <div className="bg-white dark:bg-[#121620] rounded-3xl p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10 flex flex-col justify-center flex-1">
             <div className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider mb-3">Supplier Obligations</div>
             <div className="flex flex-col gap-4">
               <div>
                 <span className="text-xs font-semibold text-slate-500 block mb-1">Outstanding Payables</span>
                 <span className="text-xl font-black text-rose-500">SAR 84,300</span>
               </div>
               <div className="border-t border-slate-100 dark:border-white/5 pt-4">
                 <span className="text-xs font-semibold text-slate-500 block mb-1">Next Major Due</span>
                 <div className="flex items-center gap-2">
                   <span className="bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 px-2 py-1 rounded text-xs font-bold">
                     In 6 Days
                   </span>
                   <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Jotun KSA</span>
                 </div>
               </div>
             </div>
           </div>
         </div>
      </div>
    </div>
  );
}

function BranchConsolidationView() {
  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto w-full">
      <div className="flex items-center justify-between mb-2">
         <div className="flex flex-col gap-1.5">
           <h2 className="font-display font-extrabold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="text-purple-500 dark:text-purple-400" /> Branch Consolidation
           </h2>
           <p className="text-slate-500 dark:text-slate-400 font-semibold text-sm">All 3 shops combined: daily cash, sales, and stock.</p>
         </div>
      </div>

      {/* Header Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#121620] rounded-2xl shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10 p-5 flex flex-col gap-2">
          <div className="text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">TOTAL SALES (ALL 3 SHOPS)</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">348,200 <span className="text-sm text-slate-500">SAR</span></div>
          <p className="text-xs font-semibold text-emerald-500 mt-1">↑ +12.4% vs last week across all branches</p>
        </div>
        <div className="bg-white dark:bg-[#121620] rounded-2xl shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10 p-5 flex flex-col gap-2">
          <div className="text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">VALUE OF PAINT IN STOCK</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">1,240,500 <span className="text-sm text-slate-500">SAR</span></div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Distributed across 3 regional stockrooms</p>
        </div>
        <div className="bg-white dark:bg-[#121620] rounded-2xl shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10 p-5 flex flex-col gap-2">
          <div className="text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">BILLS WE OWE TO SUPPLIERS</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">84,300 <span className="text-sm text-slate-500">SAR</span></div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Supplier payables due this cycle</p>
        </div>
      </div>

      {/* Branch Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
        {/* Branch 1: Jubail Main Branch */}
        <div className="bg-gradient-to-br from-indigo-50/50 to-white dark:from-[#1A1E29] dark:to-[#121620] rounded-3xl p-6 border-2 border-indigo-400 dark:border-indigo-500/50 shadow-lg shadow-indigo-500/10 flex flex-col gap-5 relative overflow-hidden group">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-500/20 px-2 py-1 rounded-md">MAIN BRANCH</span>
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
              Fully Operational
            </div>
          </div>
          <div>
            <h3 className="font-display font-extrabold text-xl text-slate-900 dark:text-white">Jubail Main Branch</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mt-1">Main Shop: Jotun + Hempel + Hardware tools</p>
          </div>
          
          {/* Side-by-side Showrooms Sub-Split */}
          <div className="flex gap-2">
            <div className="flex-1 bg-white/60 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-sm">
              <img src="/logos/jotun.jpg" alt="Jotun" className="h-7 w-auto object-contain rounded-sm mb-1.5" />
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Decorative & Marine</span>
            </div>
            <div className="flex-1 bg-white/60 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-sm">
              <img src="/logos/hempel.webp" alt="Hempel" className="h-7 w-auto object-contain rounded-sm mb-1.5" />
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Protective Coatings</span>
            </div>
          </div>
          {/* Hardware Tools Section Pill */}
          <div className="bg-slate-100/80 dark:bg-white/5 rounded-lg p-2.5 flex items-center justify-center gap-2 border border-slate-200 dark:border-white/10 shadow-sm">
            <span className="text-sm">🛠️</span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Hardware & Tools Shop</span>
            <span className="text-[9px] bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-extrabold uppercase">Integrated</span>
          </div>

          <div className="flex flex-col gap-3 mt-2">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Daily Register Cash:</span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">142,500 SAR</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Stock Turnover:</span>
              <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">High Volume</span>
            </div>
            <div className="flex justify-between items-center pb-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Staff Assigned:</span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">8 Associates</span>
            </div>
          </div>
          <button className="mt-auto w-full py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-sm hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors flex items-center justify-center gap-2">
            <Search size={16} /> View Main Shop Accounts
          </button>
        </div>

        {/* Branch 2: Dammam Franchise */}
        <div className="bg-white dark:bg-[#121620] rounded-3xl p-6 border-2 border-amber-400 dark:border-amber-500/50 shadow-lg shadow-amber-500/10 flex flex-col gap-5 relative overflow-hidden group">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20 px-2 py-1 rounded-md">FRANCHISE</span>
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
              Synced EOD
            </div>
          </div>
          <div>
            <h3 className="font-display font-extrabold text-xl text-slate-900 dark:text-white">Dammam Shop</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mt-1">Jotun Exclusive Franchise Outlet</p>
          </div>
          
          <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-sm">
            <img src="/logos/jotun.jpg" alt="Jotun" className="h-9 w-auto object-contain rounded-md mb-2" />
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Exclusive Franchise</span>
          </div>

          <div className="flex flex-col gap-3 mt-2">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Daily Register Cash:</span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">98,400 SAR</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Stock Turnover:</span>
              <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400">Moderate</span>
            </div>
            <div className="flex justify-between items-center pb-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Staff Assigned:</span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">4 Associates</span>
            </div>
          </div>
          <button className="mt-auto w-full py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
            <Search size={16} /> View Dammam Shop Accounts
          </button>
        </div>

        {/* Branch 3: Jubail Sigma Franchise */}
        <div className="bg-white dark:bg-[#121620] rounded-3xl p-6 border-2 border-emerald-400 dark:border-emerald-500/50 shadow-lg shadow-emerald-500/10 flex flex-col gap-5 relative overflow-hidden group">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20 px-2 py-1 rounded-md">FRANCHISE</span>
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
              Synced EOD
            </div>
          </div>
          <div>
            <h3 className="font-display font-extrabold text-xl text-slate-900 dark:text-white">Jubail Sigma</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mt-1">Sigma Paints Franchise Outlet</p>
          </div>
          
          <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-sm">
            <img src="/logos/sigma.png" alt="Sigma" className="h-9 w-auto object-contain rounded-md mb-2" />
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Exclusive Franchise</span>
          </div>

          <div className="flex flex-col gap-3 mt-2">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Daily Register Cash:</span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">107,300 SAR</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Stock Turnover:</span>
              <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">High Growth</span>
            </div>
            <div className="flex justify-between items-center pb-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Staff Assigned:</span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">5 Associates</span>
            </div>
          </div>
          <button className="mt-auto w-full py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
            <Search size={16} /> View Sigma Shop Accounts
          </button>
        </div>
      </div>
    </div>
  );
}

function NaumanAiView({ txns }: { txns: Txn[] }) {
  const [aiInsights, setAiInsights] = useState<{
    leaks: { type: string, severity: 'amber' | 'red', message: string }[],
    trends: { highlight: string, message: string }[],
    advice: string,
    error?: string,
    source?: string
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Hoisted computations for Blind-Spot Monitor
  const inflows = txns.filter(t => t.flow === 'in');
  const outflows = txns.filter(t => t.flow === 'out');
  const totals = { 
    in: inflows.reduce((a, b) => a + b.amount, 0),
    out: outflows.reduce((a, b) => a + b.amount, 0)
  };

  const runAudit = async () => {
    setIsAnalyzing(true);
    setAiInsights(null); // Clear previous errors or insights
    try {
      const res = await fetch('/api/ai-pulse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inflows, outflows, totals })
      });
      
      const data = await res.json();
      if (!res.ok) {
        console.error("API returned error:", data);
        setAiInsights({ error: data.error || "An unknown error occurred during audit.", leaks: [], trends: [], advice: "" });
        return;
      }
      setAiInsights(data);
    } catch (e: any) {
      console.error("Audit failed:", e);
      setAiInsights({ error: e.message || "Network error.", leaks: [], trends: [], advice: "" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto w-full">
      <div className="flex items-center justify-between mb-2">
         <div className="flex flex-col gap-1.5">
           <h2 className="font-display font-extrabold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="text-amber-500 animate-pulse" /> Nauman AI & Executive Pulse
           </h2>
           {/* AI Source Telemetry Indicator */}
           {aiInsights?.source && (
             <div className="flex items-center gap-2 text-[10px] font-bold px-2.5 py-1 bg-slate-100 dark:bg-white/5 rounded-md text-slate-500 dark:text-slate-400 w-fit">
               <span className="relative flex h-1.5 w-1.5">
                 <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${aiInsights.source.includes('Fallback') ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                 <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${aiInsights.source.includes('Fallback') ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
               </span>
               <span className="uppercase tracking-wider">Source: {aiInsights.source}</span>
             </div>
           )}
         </div>
         <button 
           onClick={runAudit}
           disabled={isAnalyzing}
           className="relative flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:shadow-[0_0_30px_rgba(245,158,11,0.6)] disabled:opacity-70 disabled:cursor-not-allowed"
         >
           {isAnalyzing ? (
             <Sparkles className="animate-spin" size={18} />
           ) : (
             <Zap size={18} className="animate-pulse" />
           )}
           {isAnalyzing ? "Analyzing..." : "⚡ Run End-of-Day Audit"}
         </button>
      </div>

      {aiInsights?.error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-center gap-3 shadow-sm dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300">
           <AlertTriangle size={20} className="shrink-0" />
           <div className="flex-1 text-sm font-semibold">
              <span className="font-extrabold block mb-0.5">Audit Error</span>
              {aiInsights.error}
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 auto-rows-max">
         {/* Today's Business Summary / Blind-Spot Monitor */}
         <div className="lg:col-span-2 bg-white dark:bg-[#0F1219] rounded-3xl p-6 ring-1 ring-slate-900/5 dark:ring-white/10 relative overflow-hidden group shadow-sm dark:shadow-2xl flex flex-col gap-6">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-amber-500 to-emerald-500"></div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-3xl -mr-20 -mt-20 transition-all group-hover:bg-purple-500/10 dark:group-hover:bg-purple-500/20"></div>
            
            <div className="flex items-center justify-between relative z-10">
               <div>
                 <h3 className="font-display font-extrabold text-2xl flex items-center gap-2 text-slate-900 dark:text-white">
                    <Activity className="text-purple-500 dark:text-purple-400" /> Today's Business Summary & Blind-Spot Monitor
                 </h3>
                 <p className="text-slate-500 dark:text-slate-400 font-semibold text-sm mt-1">Quick daily check on sales, cash spent, and risks.</p>
               </div>
               <div className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-2">
                 <span className="relative flex h-2 w-2">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                 </span>
                 Live Metrics Synced
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
               {/* Metric 1: Inflow vs Outflow Velocity */}
               <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl flex flex-col gap-2">
                 <div className="text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5"><ArrowRightLeft size={14}/> TODAY'S NET CASH (IN - OUT)</div>
                 <div className={`text-2xl font-black ${totals.in - totals.out >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                   {totals.in - totals.out >= 0 ? `+${(totals.in - totals.out).toLocaleString()} SAR` : `${(totals.in - totals.out).toLocaleString()} SAR`}
                 </div>
                 <p className="text-xs font-semibold text-slate-500">{totals.out > totals.in ? "⚠️ Spending more cash than collecting today" : "✨ Positive daily cash accumulation"}</p>
               </div>

               {/* Metric 2: Transaction Volume */}
               <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl flex flex-col gap-2">
                 <div className="text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5"><BarChart2 size={14}/> BILLS & TRANSACTIONS</div>
                 <div className="text-2xl font-black text-amber-500 dark:text-amber-400">{txns.length} <span className="text-base text-slate-500 dark:text-slate-300 font-semibold">Recorded Transactions</span></div>
                 <p className="text-xs font-semibold text-slate-500">{inflows.length} inflows vs {outflows.length} outflows processed</p>
               </div>

               {/* Metric 3: Operational Blind Spot Alert */}
               <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl flex flex-col gap-2">
                 <div className="text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5"><Eye size={14}/> THINGS TO WATCH OUT FOR</div>
                 <div className={`text-lg leading-tight font-black ${outflows.length > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                   {outflows.length > 0 ? "Supplier concentration risk monitored" : "No outgoing spikes detected"}
                 </div>
                 <p className="text-xs font-semibold text-slate-500">Verify payment terms on major wholesale restocking orders before EOD.</p>
               </div>
            </div>
         </div>

         {/* Card 1: The Leak Detector */}
         <div className="bg-white rounded-3xl shadow-sm ring-1 ring-slate-900/5 p-6 dark:bg-[#121620] dark:ring-white/10 flex flex-col gap-5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-rose-500/20"></div>
            <h3 className="font-display font-extrabold text-xl flex items-center gap-2 text-slate-900 dark:text-white relative z-10">
               <AlertTriangle className="text-rose-500 animate-pulse" /> The Leak Detector
            </h3>
            
            <div className="flex flex-col gap-4 relative z-10">
               {isAnalyzing ? (
                 <div className="flex flex-col gap-3">
                   <div className="h-16 bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse"></div>
                   <div className="h-16 bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse delay-75"></div>
                 </div>
               ) : aiInsights ? (
                 (aiInsights?.leaks || []).map((leak, i) => (
                   <div key={i} className={`border-l-4 p-4 rounded-r-xl ${leak.severity === 'red' ? 'bg-rose-50 border-rose-500 dark:bg-rose-500/10' : 'bg-amber-50 border-amber-500 dark:bg-amber-500/10'}`}>
                      <p className={`text-sm font-semibold ${leak.severity === 'red' ? 'text-rose-900 dark:text-rose-200' : 'text-amber-900 dark:text-amber-200'}`}>
                        <span className="font-extrabold">{leak.type}:</span> {leak.message}
                      </p>
                   </div>
                 ))
               ) : (
                 <div className="flex items-center justify-center h-24 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                   <p className="text-sm font-bold text-slate-400">Run audit to detect leaks</p>
                 </div>
               )}
            </div>
         </div>

         {/* Card 2: Trend Predictor & Winning Products */}
         <div className="bg-white rounded-3xl shadow-sm ring-1 ring-slate-900/5 p-6 dark:bg-[#121620] dark:ring-white/10 flex flex-col gap-5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-emerald-500/20"></div>
            <h3 className="font-display font-extrabold text-xl flex items-center gap-2 text-slate-900 dark:text-white relative z-10">
               <TrendingUp className="text-emerald-500" /> Trend Predictor
            </h3>
            
            <div className="flex flex-col gap-4 relative z-10">
               {isAnalyzing ? (
                 <div className="flex flex-col gap-3">
                   <div className="h-16 bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse"></div>
                   <div className="h-16 bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse delay-75"></div>
                 </div>
               ) : aiInsights ? (
                 (aiInsights?.trends || []).map((trend, i) => (
                   <div key={i} className={`border-l-4 p-4 rounded-r-xl ${i % 2 === 0 ? 'bg-emerald-50 border-emerald-500 dark:bg-emerald-500/10' : 'bg-purple-50 border-purple-500 dark:bg-purple-500/10'}`}>
                      <p className={`text-sm font-semibold ${i % 2 === 0 ? 'text-emerald-900 dark:text-emerald-200' : 'text-purple-900 dark:text-purple-200'}`}>
                        <span className="font-extrabold">{trend.highlight}:</span> {trend.message}
                      </p>
                   </div>
                 ))
               ) : (
                 <div className="flex items-center justify-center h-24 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                   <p className="text-sm font-bold text-slate-400">Run audit to reveal trends</p>
                 </div>
               )}
            </div>
         </div>

         {/* Card 3: Live Advice & Strategy */}
         <div className="bg-white rounded-3xl shadow-sm ring-1 ring-slate-900/5 p-6 dark:bg-[#121620] dark:ring-white/10 flex flex-col gap-5 relative overflow-hidden group lg:col-span-1">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500"></div>
            <h3 className="font-display font-extrabold text-xl flex items-center gap-2 text-slate-900 dark:text-white">
               <MessageSquare className="text-orange-500" /> Nauman AI Advisor
            </h3>
            
            <div className="flex-1 flex flex-col gap-4">
               {isAnalyzing ? (
                 <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-white/10 animate-pulse shrink-0"></div>
                    <div className="flex-1 h-20 bg-slate-100 dark:bg-white/5 rounded-2xl rounded-tl-none animate-pulse"></div>
                 </div>
               ) : aiInsights ? (
                 <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-orange-500/30">
                       <Sparkles size={20} />
                    </div>
                    <div className="bg-slate-50 dark:bg-white/5 rounded-2xl rounded-tl-none p-4 ring-1 ring-slate-100 dark:ring-white/5">
                       <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          {aiInsights?.advice || "No advice generated."}
                       </p>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2">Just Now</p>
                    </div>
                 </div>
               ) : (
                 <div className="flex gap-4 opacity-50 grayscale">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-orange-500/30">
                       <Sparkles size={20} />
                    </div>
                    <div className="bg-slate-50 dark:bg-white/5 rounded-2xl rounded-tl-none p-4 ring-1 ring-slate-100 dark:ring-white/5 flex-1">
                       <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          Waiting for your End-of-Day audit...
                       </p>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2">Standby</p>
                    </div>
                 </div>
               )}
            </div>
         </div>

         {/* Card 4: The ERP Bridge */}
         <div className="bg-white rounded-3xl shadow-sm ring-1 ring-slate-900/5 p-6 dark:bg-[#121620] dark:ring-white/10 flex flex-col gap-5 relative overflow-hidden group lg:col-span-1">
            <h3 className="font-display font-extrabold text-xl flex items-center gap-2 text-slate-900 dark:text-white">
               <Database className="text-indigo-500" /> Fujishka ERP Hub
            </h3>
            
            <div className="border-2 border-dashed border-indigo-200 dark:border-indigo-500/30 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3 bg-indigo-50/50 dark:bg-indigo-500/5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors cursor-pointer">
               <UploadCloud size={40} className="text-indigo-400 mb-2" />
               <p className="font-bold text-sm text-indigo-900 dark:text-indigo-300">Drop Fujishka ERP Daily CSV Here</p>
               <p className="text-xs font-medium text-indigo-500/80 dark:text-indigo-400/80">Auto-reconcile transactions in one click.</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mt-auto">
               <button className="flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition shadow-md dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
                  <FileDown size={16} /> ZATCA Tax Report
               </button>
               <button className="flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition shadow-md shadow-indigo-500/20">
                  <RefreshCw size={16} /> Sync to Fujishka
               </button>
            </div>
         </div>
      </div>
    </div>
  );
}

export default function Page() {
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState<TabId>("ai"); // Default to Nauman AI for Module 4
  const [mode, setMode] = useState<ViewMode>("detailed");
  
  const [txns, setTxns] = useState<Txn[]>(SEED_TXNS);
  const [count, setCount] = useState("");
  
  const [q, setQ] = useState<Record<string, string>>({
    cash_sale: "", credit_received: "", bank_in: "",
    jotun: "", hempel: "", sigma: "", other: "",
    salaries: "", tax: "", misc_expense: ""
  });

  useEffect(() => {
    if (dark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [dark]);

  const handleAddTxn = (t: Omit<Txn, "id" | "time">) => {
    setTxns([{ id: `t-${Date.now()}`, time: nowHHMM(), ...t }, ...txns]);
  };

  const detailedIn = r2(txns.filter(t => t.flow === "in").reduce((a, b) => a + b.amount, 0) + 4500);
  const detailedOut = r2(txns.filter(t => t.flow === "out").reduce((a, b) => a + b.amount, 0));
  
  const quickIn = r2((parseFloat(q.cash_sale) || 0) + (parseFloat(q.credit_received) || 0) + (parseFloat(q.bank_in) || 0) + 4500);
  const quickOut = r2((parseFloat(q.jotun) || 0) + (parseFloat(q.hempel) || 0) + (parseFloat(q.sigma) || 0) + (parseFloat(q.other) || 0) + (parseFloat(q.salaries) || 0) + (parseFloat(q.tax) || 0) + (parseFloat(q.misc_expense) || 0));

  const totalIn = mode === "detailed" ? detailedIn : quickIn;
  const totalOut = mode === "detailed" ? detailedOut : quickOut;
  const expectedCash = r2(totalIn - totalOut);

  const physicalCount = parseFloat(count);
  const valid = !Number.isNaN(physicalCount);
  const diffCents = valid ? Math.round(physicalCount * 100) - Math.round(expectedCash * 100) : NaN;
  const diff = diffCents / 100;

  return (
    <div className={`flex h-screen w-full bg-slate-50 text-slate-900 antialiased overflow-hidden dark:bg-[#0B0E14] dark:text-slate-100 ${dark ? "dark" : ""}`}>
      <Sidebar tab={tab} setTab={setTab} />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white/50 px-6 py-4 backdrop-blur-xl dark:border-white/5 dark:bg-[#0B0E14]/50 z-20">
          <div className="flex items-center gap-4">
            <h1 className="font-display text-xl font-extrabold tracking-tight hidden sm:block">Good afternoon, Fahad</h1>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
               <CalendarDays size={16} /> 12-09-2026
            </div>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
            <Dropdown.Root>
              <Dropdown.Trigger className="flex h-10 items-center gap-2 rounded-lg bg-slate-100 px-3 text-sm font-bold hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 outline-none transition">
                <Store size={16} className="text-purple-500" />
                Jubail - Main Branch
                <ChevronDown size={14} className="text-slate-400" />
              </Dropdown.Trigger>
            </Dropdown.Root>
          </div>
          
          <div className="flex items-center gap-4">
            {tab === "register" && (
              <div className="flex p-1 bg-slate-200 rounded-lg ring-1 ring-slate-900/5 dark:bg-white/5 dark:ring-white/10">
                <button 
                  onClick={() => setMode("detailed")}
                  className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${mode === 'detailed' ? 'bg-white shadow-sm text-slate-900 dark:bg-[#1f2536] dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                  Detailed Log
                </button>
                <button 
                  onClick={() => setMode("quick")}
                  className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${mode === 'quick' ? 'bg-white shadow-sm text-slate-900 dark:bg-[#1f2536] dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                  Quick Totals
                </button>
              </div>
            )}
            <ThemeToggle dark={dark} onToggle={() => setDark(!dark)} />
          </div>
        </header>

        {/* Layout Wrapper */}
        <div className="flex flex-1 overflow-hidden relative">
          
          {/* Center Canvas */}
          <main className="flex-1 overflow-hidden flex flex-col relative z-10">
            {tab === "radar" ? (
               <CreditRadarView />
            ) : tab === "suppliers" ? (
               <SupplierHubView />
            ) : tab === "ai" ? (
               <NaumanAiView txns={txns} />
            ) : tab === "consolidation" ? (
               <BranchConsolidationView />
            ) : tab === "pulse" ? (
               <FinancialPulseView />
            ) : tab !== "register" ? (
               <div className="flex h-full flex-col items-center justify-center text-center p-6">
                 <div className="mb-6 rounded-full bg-slate-200 p-6 dark:bg-white/5">
                   <Activity size={48} className="text-slate-400 dark:text-slate-500" />
                 </div>
                 <h2 className="font-display text-2xl font-extrabold">Module in Development</h2>
                 <p className="mt-2 text-slate-500 dark:text-slate-400">This section is currently being built.</p>
               </div>
            ) : mode === "detailed" ? (
               <div className="flex flex-col lg:flex-row gap-6 p-6 h-full overflow-hidden">
                  <Column title="Money In" type="in" txns={txns.filter(t => t.flow === 'in')} onAdd={handleAddTxn} />
                  <Column title="Money Out" type="out" txns={txns.filter(t => t.flow === 'out')} onAdd={handleAddTxn} />
               </div>
            ) : (
               <div className="h-full overflow-y-auto p-6 w-full">
                 <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/5 p-6 sm:p-8 dark:bg-[#121620] dark:ring-white/10">
                    <h2 className="font-display font-extrabold text-2xl mb-8 flex items-center gap-3">
                       <Search className="text-purple-500" /> Quick Totals Entry
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                       <div>
                         <h3 className="font-bold text-slate-400 uppercase tracking-wider mb-6 text-xs flex items-center gap-2"><TrendingUp size={16} className="text-emerald-500"/> INFLOWS</h3>
                         <QuickInput label="Cash Sales" pill="cash_sale" value={q.cash_sale} onChange={v => setQ({...q, cash_sale: v})} />
                         <QuickInput label="Credit Received" pill="credit_received" value={q.credit_received} onChange={v => setQ({...q, credit_received: v})} />
                         <QuickInput label="Bank Transfer In" pill="bank_in" value={q.bank_in} onChange={v => setQ({...q, bank_in: v})} />
                       </div>
                       
                       <div>
                         <h3 className="font-bold text-slate-400 uppercase tracking-wider mb-6 text-xs flex items-center gap-2"><TrendingDown size={16} className="text-rose-500"/> OUTFLOWS</h3>
                         <QuickInput label="Jotun Purchases" pill="jotun" value={q.jotun} onChange={v => setQ({...q, jotun: v})} />
                         <QuickInput label="Hempel Purchases" pill="hempel" value={q.hempel} onChange={v => setQ({...q, hempel: v})} />
                         <QuickInput label="Sigma Purchases" pill="sigma" value={q.sigma} onChange={v => setQ({...q, sigma: v})} />
                         <QuickInput label="Other Paint" pill="other" value={q.other} onChange={v => setQ({...q, other: v})} />
                         <QuickInput label="Staff Salaries/Advance" pill="salaries" value={q.salaries} onChange={v => setQ({...q, salaries: v})} />
                         <QuickInput label="Tax Payments" pill="tax" value={q.tax} onChange={v => setQ({...q, tax: v})} />
                         <QuickInput label="Misc Shop Expense" pill="misc_expense" value={q.misc_expense} onChange={v => setQ({...q, misc_expense: v})} />
                       </div>
                    </div>
                 </div>
               </div>
            )}
          </main>

          {/* Right Utility Panel - Drawer Balancer */}
          {tab === "register" && (
            <aside className="hidden w-[340px] shrink-0 flex-col border-l border-slate-200 bg-white shadow-[-10px_0_40px_rgba(0,0,0,0.03)] dark:border-white/5 dark:bg-[#0B0E14] xl:flex relative z-30">
              <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-8">
                
                <div>
                  <h3 className="font-display text-xl font-extrabold text-slate-900 dark:text-white mb-2">Drawer Balancer</h3>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Zero-error daily closing.</p>
                </div>
                
                {/* Receipt UI */}
                <div className="relative rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-900/5 dark:bg-white/[0.02] dark:ring-white/10 receipt-edge overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500"></div>
                  <div className="space-y-4 font-mono text-[13px] font-medium text-slate-600 dark:text-slate-400">
                    <div className="flex justify-between items-center">
                      <span>Opening Float</span>
                      <span className="text-slate-900 dark:text-white font-bold">4,500.00</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Total Inflows</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">+{fmt(totalIn - 4500)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Total Outflows</span>
                      <span className="text-rose-600 dark:text-rose-400 font-bold">-{fmt(totalOut)}</span>
                    </div>
                    <div className="border-t border-dashed border-slate-300 dark:border-slate-700 pt-4 mt-2">
                      <div className="flex justify-between items-center font-bold text-slate-900 dark:text-white text-base">
                        <span>Expected Cash</span>
                        <span>{fmt(expectedCash)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-center text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Physical Drawer Count (SAR)
                  </label>
                  <input 
                    type="number"
                    value={count}
                    onChange={e => setCount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 dark:bg-white/[0.02] text-center font-display text-4xl font-extrabold py-5 rounded-2xl ring-1 ring-slate-200 dark:ring-white/10 shadow-inner focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700"
                  />
                  
                  {valid && (
                    <div className={`flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-sm transition-colors ${diffCents === 0 ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30" : diff > 0 ? "bg-amber-50 text-amber-600 ring-1 ring-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30" : "bg-rose-50 text-rose-600 ring-1 ring-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/30"}`}>
                      {diffCents === 0 && <span className="relative flex h-3 w-3"><span className="neon-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span></span>}
                      {diffCents === 0 ? "0.00 Perfectly Balanced" : diff > 0 ? `Excess: +${fmt(diff)} SAR` : `Short: ${fmt(diff)} SAR`}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50/80 dark:bg-[#121620]/80 backdrop-blur-xl shrink-0">
                <button 
                  disabled={!(valid && diffCents === 0)}
                  className={`w-full flex items-center justify-center gap-2 h-14 rounded-xl font-bold text-base transition-all duration-300 ${valid && diffCents === 0 ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xl shadow-purple-500/30 hover:shadow-purple-500/50 hover:-translate-y-0.5" : "bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-white/5 dark:text-slate-600"}`}
                >
                  {valid && diffCents === 0 ? <Lock size={20} /> : <LockOpen size={20} />}
                  Lock & Close Day
                </button>
              </div>
            </aside>
          )}

        </div>
      </div>
    </div>
  );
}
