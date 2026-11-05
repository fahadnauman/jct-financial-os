"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Calendar,
  Building2,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Wallet,
  CreditCard,
  AlertTriangle,
  Lock,
  ArrowLeft,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Layers,
} from "lucide-react";
import { getSaudiMonthGroup, saudiTime12 } from "../lib/saudi-time";

export interface MonthlyAuditRecord {
  id: string;
  branch: string;
  date: string;
  closingCash: number;
  openingCash?: number;
  inflows: number;
  bankSwipes: number;
  outflows: number;
  posFees?: number;
  madaFees?: number;
  ccFees?: number;
  lockedAt: string;
  lockedBy: string;
  status: string;
  auditStatus?: string;
  hasDiscrepancy?: boolean;
  varianceAmount?: number | null;
  varianceType?: string | null;
  dataJson?: string | null;
}

export interface MonthGroupAggregate {
  key: string; // e.g. "2026-11"
  label: string; // e.g. "November 2026"
  year: number;
  month: number;
  totalSales: number;
  totalCash: number;
  totalPos: number;
  totalOutflows: number;
  totalPosFees: number;
  auditCount: number;
  hasAnyDiscrepancy: boolean;
  records: MonthlyAuditRecord[];
}

const r2 = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;

const fmt = (n?: number | null): string => {
  if (n === undefined || n === null || Number.isNaN(n)) return "0.00";
  return Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const BRANCH_OPTIONS = [
  { id: "ALL", label: "All Branches (Combined)" },
  { id: "JCT_HARDWARE_JOTUN", label: "JCT Hardware + Jotun" },
  { id: "HEMPEL", label: "Hempel" },
  { id: "DAMMAM_JOTUN", label: "Dammam Jotun" },
  { id: "SIGMA", label: "Sigma" },
];

const getBranchBadge = (rawBranch?: string) => {
  const b = (rawBranch || "").toUpperCase();
  if (b.includes("HEMPEL")) {
    return { name: "Hempel", bg: "bg-blue-500/10 border-blue-500/30 text-blue-400" };
  }
  if (b.includes("DAMMAM")) {
    return { name: "Dammam Jotun", bg: "bg-purple-500/10 border-purple-500/30 text-purple-400" };
  }
  if (b.includes("SIGMA")) {
    return { name: "Sigma", bg: "bg-orange-500/10 border-orange-500/30 text-orange-400" };
  }
  return { name: "JCT Hardware + Jotun", bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" };
};

export default function MonthlyAuditsView({
  isOwner = true,
  staffBranch = "JCT_HARDWARE_JOTUN",
  onBackToPulse,
}: {
  isOwner?: boolean;
  staffBranch?: string;
  onBackToPulse?: () => void;
}) {
  const [selectedBranch, setSelectedBranch] = useState<string>(isOwner ? "ALL" : staffBranch);
  const [records, setRecords] = useState<MonthlyAuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const [clockAst, setClockAst] = useState<string>("");

  // Live Saudi Clock
  useEffect(() => {
    const update = () => setClockAst(saudiTime12(new Date(), true));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch audits from /api/archive
  useEffect(() => {
    let ignore = false;
    const fetchAudits = async () => {
      setLoading(true);
      try {
        const branchParam = isOwner ? selectedBranch : staffBranch;
        const url = `/api/archive?branch=${encodeURIComponent(branchParam)}&limit=1000`;
        const res = await fetch(url);
        const data = await res.json();
        if (!ignore && Array.isArray(data.records)) {
          setRecords(data.records);
        }
      } catch (err) {
        console.error("Failed to fetch monthly audits archive:", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchAudits();
    return () => {
      ignore = true;
    };
  }, [isOwner, selectedBranch, staffBranch, refreshIndex]);

  // Group records strictly using Saudi timezone
  const monthGroups = useMemo<MonthGroupAggregate[]>(() => {
    const groups: Record<string, MonthGroupAggregate> = {};

    for (const r of records) {
      // Date from DB could be "2026-11-05" or "05-November-2026" or ISO
      const dateVal = r.date || r.lockedAt;
      const mg = getSaudiMonthGroup(dateVal);

      if (!groups[mg.key]) {
        groups[mg.key] = {
          key: mg.key,
          label: mg.label,
          year: mg.year,
          month: mg.month,
          totalSales: 0,
          totalCash: 0,
          totalPos: 0,
          totalOutflows: 0,
          totalPosFees: 0,
          auditCount: 0,
          hasAnyDiscrepancy: false,
          records: [],
        };
      }

      const inflows = Number(r.inflows) || 0;
      const bankSwipes = Number(r.bankSwipes) || 0;
      const outflows = Number(r.outflows) || 0;
      const posFees = Number(r.posFees) || 0;

      const sales = r2(inflows + bankSwipes);
      groups[mg.key].totalSales = r2(groups[mg.key].totalSales + sales);
      groups[mg.key].totalCash = r2(groups[mg.key].totalCash + inflows);
      groups[mg.key].totalPos = r2(groups[mg.key].totalPos + bankSwipes);
      groups[mg.key].totalOutflows = r2(groups[mg.key].totalOutflows + outflows);
      groups[mg.key].totalPosFees = r2(groups[mg.key].totalPosFees + posFees);
      groups[mg.key].auditCount += 1;

      if (r.hasDiscrepancy || r.auditStatus === "PENDING_AUDIT") {
        groups[mg.key].hasAnyDiscrepancy = true;
      }

      groups[mg.key].records.push(r);
    }

    // Sort months descending (most recent first)
    const list = Object.values(groups).sort((a, b) => b.key.localeCompare(a.key));

    // Sort records within each month by date descending
    list.forEach((g) => {
      g.records.sort((a, b) => {
        const da = a.date || a.lockedAt;
        const db = b.date || b.lockedAt;
        return String(db).localeCompare(String(da));
      });
    });

    return list;
  }, [records]);

  // Auto-expand the most recent month by default
  useEffect(() => {
    if (monthGroups.length > 0) {
      setExpandedMonths((prev) => {
        if (Object.keys(prev).length === 0) {
          return { [monthGroups[0].key]: true };
        }
        return prev;
      });
    }
  }, [monthGroups]);

  const toggleMonth = (key: string) => {
    setExpandedMonths((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Grand summary across all loaded months
  const grandTotals = useMemo(() => {
    let sales = 0;
    let cash = 0;
    let pos = 0;
    let outflows = 0;
    let days = 0;
    for (const g of monthGroups) {
      sales = r2(sales + g.totalSales);
      cash = r2(cash + g.totalCash);
      pos = r2(pos + g.totalPos);
      outflows = r2(outflows + g.totalOutflows);
      days += g.auditCount;
    }
    return { sales, cash, pos, outflows, days };
  }, [monthGroups]);

  // Filter months by search query
  const filteredMonthGroups = useMemo(() => {
    if (!searchQuery.trim()) return monthGroups;
    const q = searchQuery.toLowerCase().trim();
    return monthGroups
      .map((g) => {
        const matchesMonth = g.label.toLowerCase().includes(q) || g.key.includes(q);
        const matchingDays = g.records.filter(
          (r) =>
            r.date?.toLowerCase().includes(q) ||
            r.branch?.toLowerCase().includes(q) ||
            r.lockedBy?.toLowerCase().includes(q)
        );
        if (matchesMonth) return g;
        if (matchingDays.length > 0) {
          return {
            ...g,
            records: matchingDays,
          };
        }
        return null;
      })
      .filter((g): g is MonthGroupAggregate => g !== null);
  }, [monthGroups, searchQuery]);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 h-full overflow-y-auto w-full text-jct-charcoal dark:text-jct-offwhite">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-4">
        <div className="flex items-center gap-3">
          {onBackToPulse && (
            <button
              type="button"
              onClick={onBackToPulse}
              className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition"
              title="Back to Financial Pulse"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-2xl text-jct-charcoal dark:text-white tracking-tight flex items-center gap-2">
                <Calendar className="text-jct-turquoise" /> Monthly Audits Archive
              </h1>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-jct-turquoise/20 text-jct-turquoise border border-jct-turquoise/30">
                Saudi Time (AST)
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Historical monthly registers, locked drawer cash, and POS settlement aggregates.
            </p>
          </div>
        </div>

        {/* Live AST Clock & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
            <Clock size={14} className="text-jct-turquoise" />
            <span>AST: {clockAst || "--:--:--"}</span>
          </div>

          <button
            type="button"
            onClick={() => setRefreshIndex((n) => n + 1)}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Control Bar: Branch Switcher & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-[#0D0D0D] p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
        {/* Branch Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
            <Building2 size={15} className="text-jct-turquoise" />
            <span>Branch View:</span>
          </div>

          {isOwner ? (
            <div className="flex flex-wrap gap-1.5">
              {BRANCH_OPTIONS.map((b) => {
                const active = selectedBranch === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBranch(b.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      active
                        ? "bg-jct-turquoise text-jct-charcoal shadow-sm"
                        : "bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {b.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <span className="px-3 py-1.5 rounded-xl bg-jct-turquoise/20 text-jct-turquoise font-bold text-xs border border-jct-turquoise/30">
              {BRANCH_OPTIONS.find((b) => b.id === staffBranch)?.label || staffBranch}
            </span>
          )}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search month, date..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-white/10 text-jct-charcoal dark:text-white focus:outline-none focus:border-jct-turquoise"
          />
        </div>
      </div>

      {/* Grand Aggregates KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0D0D] border border-slate-200 dark:border-white/10 shadow-sm flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Cumulative Revenue
          </span>
          <div className="font-mono text-xl sm:text-2xl font-black text-jct-charcoal dark:text-white">
            SAR {fmt(grandTotals.sales)}
          </div>
          <span className="text-[10px] text-slate-400 font-semibold">
            Across {grandTotals.days} audited session{grandTotals.days === 1 ? "" : "s"}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0D0D] border border-slate-200 dark:border-white/10 shadow-sm flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Wallet size={13} className="text-emerald-400" /> Total Cash Inflows
          </span>
          <div className="font-mono text-xl sm:text-2xl font-black text-emerald-500">
            SAR {fmt(grandTotals.cash)}
          </div>
          <span className="text-[10px] text-slate-400 font-semibold">
            {grandTotals.sales > 0 ? `${Math.round((grandTotals.cash / grandTotals.sales) * 100)}% of total sales` : "Cash collected"}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0D0D] border border-slate-200 dark:border-white/10 shadow-sm flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <CreditCard size={13} className="text-jct-turquoise" /> Total POS &amp; Bank
          </span>
          <div className="font-mono text-xl sm:text-2xl font-black text-jct-turquoise">
            SAR {fmt(grandTotals.pos)}
          </div>
          <span className="text-[10px] text-slate-400 font-semibold">
            {grandTotals.sales > 0 ? `${Math.round((grandTotals.pos / grandTotals.sales) * 100)}% of total sales` : "Card settlements"}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0D0D] border border-slate-200 dark:border-white/10 shadow-sm flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Outflows / Expenses
          </span>
          <div className="font-mono text-xl sm:text-2xl font-black text-rose-500">
            SAR {fmt(grandTotals.outflows)}
          </div>
          <span className="text-[10px] text-slate-400 font-semibold">
            Net Cash: SAR {fmt(grandTotals.cash - grandTotals.outflows)}
          </span>
        </div>
      </div>

      {/* Month-by-Month Collapsible Accordion List */}
      <div className="flex flex-col gap-4">
        {loading && (
          <div className="flex items-center justify-center p-12 text-slate-400 gap-2">
            <RefreshCw size={18} className="animate-spin text-jct-turquoise" />
            <span className="text-sm font-semibold">Loading historical locked audits...</span>
          </div>
        )}

        {!loading && filteredMonthGroups.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/15 p-12 text-center flex flex-col items-center justify-center gap-3">
            <Layers size={36} className="text-slate-400" />
            <p className="font-bold text-base text-slate-600 dark:text-slate-300">
              No locked audits found for {selectedBranch === "ALL" ? "any branch" : selectedBranch}.
            </p>
            <p className="text-xs text-slate-400 max-w-md">
              Complete and lock a Daily Register session to generate official monthly records.
            </p>
          </div>
        )}

        {!loading &&
          filteredMonthGroups.map((month) => {
            const isExpanded = Boolean(expandedMonths[month.key]);
            return (
              <div
                key={month.key}
                className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0D0D] overflow-hidden shadow-sm transition-all"
              >
                {/* Month Group Header (Clickable Accordion) */}
                <div
                  onClick={() => toggleMonth(month.key)}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.02] transition"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-xl bg-jct-turquoise/20 text-jct-turquoise flex items-center justify-center font-black shrink-0">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-display font-extrabold text-lg text-jct-charcoal dark:text-white">
                          {month.label}
                        </h2>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                          {month.auditCount} day{month.auditCount === 1 ? "" : "s"} audited
                        </span>
                        {month.hasAnyDiscrepancy && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 flex items-center gap-1">
                            <AlertTriangle size={11} /> Discrepancy Flagged
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono text-slate-400">
                        {month.key} · Saudi Arabian Standard Time (AST)
                      </span>
                    </div>
                  </div>

                  {/* Monthly Summary Badges */}
                  <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-between md:justify-end">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Total Sales</span>
                      <span className="font-mono text-sm sm:text-base font-black text-jct-charcoal dark:text-white">
                        SAR {fmt(month.totalSales)}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Cash Inflows</span>
                      <span className="font-mono text-sm sm:text-base font-black text-emerald-500">
                        SAR {fmt(month.totalCash)}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-slate-400">POS / Bank</span>
                      <span className="font-mono text-sm sm:text-base font-black text-jct-turquoise">
                        SAR {fmt(month.totalPos)}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Expenses</span>
                      <span className="font-mono text-sm sm:text-base font-black text-rose-500">
                        -SAR {fmt(month.totalOutflows)}
                      </span>
                    </div>

                    <div className="p-1 rounded-lg text-slate-400 hover:text-white transition">
                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Itemized Daily Audits Table */}
                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#070707] p-3 sm:p-5">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-white/10 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                            <th className="py-2.5 px-3">Date (AST)</th>
                            <th className="py-2.5 px-3">Branch</th>
                            <th className="py-2.5 px-3 text-right">Daily Sales</th>
                            <th className="py-2.5 px-3 text-right">Cash Inflows</th>
                            <th className="py-2.5 px-3 text-right">POS / Card</th>
                            <th className="py-2.5 px-3 text-right">Expenses</th>
                            <th className="py-2.5 px-3 text-right">Drawer Closing</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                          {month.records.map((r) => {
                            const badge = getBranchBadge(r.branch);
                            const sales = r2((Number(r.inflows) || 0) + (Number(r.bankSwipes) || 0));
                            const isPending =
                              r.auditStatus === "PENDING_AUDIT" || r.status === "PENDING_AUDIT";
                            return (
                              <tr
                                key={r.id}
                                className="hover:bg-white dark:hover:bg-white/[0.03] transition-colors"
                              >
                                <td className="py-3 px-3 font-mono font-bold text-jct-charcoal dark:text-white whitespace-nowrap">
                                  {r.date}
                                </td>
                                <td className="py-3 px-3 whitespace-nowrap">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.bg}`}
                                  >
                                    {badge.name}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-black text-jct-charcoal dark:text-white whitespace-nowrap">
                                  SAR {fmt(sales)}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-bold text-emerald-500 whitespace-nowrap">
                                  SAR {fmt(r.inflows)}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-bold text-jct-turquoise whitespace-nowrap">
                                  SAR {fmt(r.bankSwipes)}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-bold text-rose-500 whitespace-nowrap">
                                  {r.outflows > 0 ? `-SAR ${fmt(r.outflows)}` : "SAR 0.00"}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-black text-jct-charcoal dark:text-white whitespace-nowrap">
                                  SAR {fmt(r.closingCash)}
                                </td>
                                <td className="py-3 px-3 text-center whitespace-nowrap">
                                  {isPending ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                      PENDING DRAFT
                                    </span>
                                  ) : r.hasDiscrepancy ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                      {r.varianceType === "EXCESS" ? "+Excess" : "-Shortage"}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center gap-1">
                                      <CheckCircle2 size={11} /> LOCKED
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
