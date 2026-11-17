"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, ChevronDown, Check, User, Building2, CreditCard, Sparkles } from "lucide-react";

export interface PartyItem {
  id?: string;
  name: string;
  partyType: "SUPPLIER" | "CUSTOMER" | "CREDITOR" | "BOTH";
  branch?: string;
  phone?: string;
  lastAmount?: number;
  lastInvoiceNo?: string;
  sourceTag?: "Today's Sale" | "Today's Entry" | "History";
}

interface PartyDropdownSelectorProps {
  value: string;
  onChange: (partyName: string, party?: PartyItem) => void;
  partyType?: "SUPPLIER" | "CUSTOMER" | "CREDITOR" | "ALL";
  branch?: string;
  placeholder?: string;
  label?: string;
  required?: boolean;
  extraParties?: string[]; // e.g., today's uploaded CSV customer list
  liveParties?: PartyItem[]; // Instant in-memory merge from Bank/POS Match & active entries
  className?: string;
  id?: string;
}

export function PartyDropdownSelector({
  value,
  onChange,
  partyType = "ALL",
  branch,
  placeholder = "Select or type party name...",
  label,
  required = false,
  extraParties = [],
  liveParties = [],
  className = "",
  id = "party-dropdown",
}: PartyDropdownSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dbParties, setDbParties] = useState<PartyItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync searchTerm when parent resets value to ""
  useEffect(() => {
    if (!value) {
      setSearchTerm("");
    }
  }, [value]);

  // Fetch full directory from /api/parties once per partyType/branch so client filtering is 0ms
  useEffect(() => {
    let ignore = false;
    const fetchParties = async () => {
      setIsLoading(true);
      try {
        const typeParam = partyType && partyType !== "ALL" ? `&type=${partyType}` : "";
        const branchParam = branch && branch !== "ALL" ? `&branch=${branch}` : "";
        const res = await fetch(`/api/parties?limit=300${typeParam}${branchParam}`);
        if (!res.ok) throw new Error("Failed to load parties");
        const data = await res.json();
        if (!ignore && Array.isArray(data?.parties)) {
          setDbParties(
            data.parties.map((p: PartyItem) => ({
              ...p,
              sourceTag: p.sourceTag || "History",
            }))
          );
        }
      } catch (err) {
        console.error("Party fetch error:", err);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    };

    void fetchParties();
    return () => {
      ignore = true;
    };
  }, [partyType, branch]);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Instant 0ms in-memory merge: Today's Live Bank/POS Match + Today's Entries + Extra + DB History
  const combinedParties = useMemo(() => {
    const list: PartyItem[] = [];
    const seen = new Set<string>();

    const pushUnique = (item: PartyItem) => {
      const clean = (item.name || "").trim();
      if (!clean || clean.length < 2) return;
      const upper = clean.toUpperCase();
      if (seen.has(upper)) return;
      seen.add(upper);
      list.push({
        ...item,
        name: clean,
      });
    };

    // 1. Today's Live Parties (Bank/POS Match PDF/CSV + active register entries)
    for (const lp of liveParties) {
      pushUnique(lp);
    }

    // 2. Legacy extraParties strings
    for (const raw of extraParties) {
      pushUnique({
        name: raw,
        partyType: partyType === "SUPPLIER" ? "SUPPLIER" : "CUSTOMER",
      });
    }

    // 3. Historical Database Parties
    for (const dp of dbParties) {
      pushUnique({
        ...dp,
        sourceTag: dp.sourceTag || "History",
      });
    }

    const activeQuery = (searchTerm || "").trim().toLowerCase();
    if (activeQuery) {
      const tokens = activeQuery.split(/\s+/).filter(Boolean);
      return list.filter((p) => {
        const hay = p.name.toLowerCase();
        return tokens.every((tok) => hay.includes(tok));
      });
    }
    return list;
  }, [dbParties, extraParties, liveParties, searchTerm, partyType]);

  const handleSelect = (party: PartyItem) => {
    onChange(party.name, party);
    setSearchTerm("");
    setIsOpen(false);
  };

  const handleDirectInput = (text: string) => {
    onChange(text);
    setSearchTerm(text);
    if (text.trim().length > 0) {
      setIsOpen(true);
    }
  };

  const renderBadge = (type: string) => {
    switch (type) {
      case "SUPPLIER":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 px-1.5 py-0.5 text-[9px] font-extrabold uppercase shrink-0">
            <Building2 size={10} />
            <span>Supplier</span>
          </span>
        );
      case "CUSTOMER":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-jct-turquoise/20 text-jct-charcoal dark:text-jct-turquoise border border-jct-turquoise/40 px-1.5 py-0.5 text-[9px] font-extrabold uppercase shrink-0">
            <User size={10} />
            <span>Customer</span>
          </span>
        );
      case "CREDITOR":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/40 px-1.5 py-0.5 text-[9px] font-extrabold uppercase shrink-0">
            <CreditCard size={10} />
            <span>Creditor</span>
          </span>
        );
      case "BOTH":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-extrabold uppercase shrink-0">
            <Sparkles size={10} />
            <span>Both</span>
          </span>
        );
      default:
        return null;
    }
  };

  const renderSourceTag = (tag?: PartyItem["sourceTag"]) => {
    if (!tag) return null;
    if (tag === "Today's Sale") {
      return (
        <span className="rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-black uppercase shrink-0">
          Today&apos;s Sale
        </span>
      );
    }
    if (tag === "Today's Entry") {
      return (
        <span className="rounded bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40 px-1.5 py-0.5 text-[9px] font-black uppercase shrink-0">
          Today&apos;s Entry
        </span>
      );
    }
    return (
      <span className="rounded bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30 px-1.5 py-0.5 text-[9px] font-bold uppercase shrink-0">
        History
      </span>
    );
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Input / Trigger */}
      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleDirectInput(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          className="w-full rounded-lg border border-slate-300 dark:border-[#222222] bg-white dark:bg-[#0E0E0E] text-jct-charcoal dark:text-white px-3 py-2 text-xs font-semibold focus:border-jct-turquoise focus:outline-none focus:ring-1 focus:ring-jct-turquoise transition-all pr-8"
        />
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) {
              inputRef.current?.focus();
            }
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-jct-charcoal dark:hover:text-white p-1"
          title="Toggle party directory"
        >
          <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto scrollbar-thin rounded-xl border border-slate-200 dark:border-[#2A2A2A] bg-white dark:bg-[#111111] shadow-xl p-1.5 text-xs divide-y divide-slate-100 dark:divide-[#1C1C1C] animate-fade-slide-up">
          {/* Quick Search Header */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 mb-1 bg-slate-50 dark:bg-[#181818] rounded-lg">
            <Search size={12} className="text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by name (0ms instant)..."
              className="w-full bg-transparent text-[11px] font-medium text-jct-charcoal dark:text-white placeholder-slate-400 focus:outline-none"
            />
            {isLoading && (
              <span className="text-[10px] text-slate-400 animate-pulse shrink-0">Syncing...</span>
            )}
          </div>

          {/* Party Options List */}
          <div className="py-1 space-y-0.5">
            {combinedParties.length === 0 ? (
              <div className="p-3 text-center text-slate-400 text-xs">
                No matching parties found.
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      const cleanNew = searchTerm.trim();
                      onChange(cleanNew);
                      setIsOpen(false);
                      if (cleanNew.length >= 2) {
                        void fetch("/api/parties", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            name: cleanNew,
                            partyType: partyType === "SUPPLIER" ? "SUPPLIER" : "CUSTOMER",
                            branch: branch || "ALL",
                          }),
                        }).catch(() => {});
                      }
                    }}
                    className="mt-1.5 block w-full text-center text-jct-turquoise font-bold hover:underline"
                  >
                    + Add &amp; Register &quot;{searchTerm}&quot; as New Party
                  </button>
                )}
              </div>
            ) : (
              combinedParties.slice(0, 80).map((party, idx) => {
                const isSelected = value.trim().toUpperCase() === party.name.trim().toUpperCase();
                return (
                  <button
                    key={`${party.name}-${idx}`}
                    type="button"
                    onClick={() => handleSelect(party)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition-all ${
                      isSelected
                        ? "bg-jct-turquoise/15 text-jct-charcoal dark:text-jct-turquoise font-extrabold"
                        : "hover:bg-slate-100 dark:hover:bg-[#1A1A1A] text-jct-charcoal dark:text-slate-200"
                    }`}
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-1.5 flex-wrap">
                      <span className="truncate font-semibold">{party.name}</span>
                      {renderSourceTag(party.sourceTag)}
                      {renderBadge(party.partyType)}
                    </div>
                    {isSelected && (
                      <Check size={14} className="text-jct-turquoise shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
