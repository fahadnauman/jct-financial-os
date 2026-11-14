"use client";

import React, { useEffect, useState } from "react";
import { Clock, Calendar } from "lucide-react";
import { saudiParts, saudiTime12, SAUDI_TZ } from "../lib/saudi-time";

interface SaudiLiveClockProps {
  compact?: boolean;
  className?: string;
  showFridayBadge?: boolean;
}

export function SaudiLiveClock({
  compact = false,
  className = "",
  showFridayBadge = true,
}: SaudiLiveClockProps) {
  const [mounted, setMounted] = useState(false);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(Date.now());
  const [isServerSynced, setIsServerSynced] = useState(false);

  // 1. Authoritative Server Time Synchronization
  useEffect(() => {
    setMounted(true);
    let isCancelled = false;

    const syncServerTime = async () => {
      try {
        const fetchStart = Date.now();
        const res = await fetch("/api/time", { cache: "no-store" });
        if (res.ok && !isCancelled) {
          const data = await res.json();
          const fetchEnd = Date.now();
          const latency = Math.round((fetchEnd - fetchStart) / 2);
          const serverNow = Number(data.timestamp) + latency;
          const offset = serverNow - Date.now();
          setServerOffsetMs(offset);
          setCurrentTimeMs(Date.now() + offset);
          setIsServerSynced(true);
        }
      } catch (err) {
        console.warn("Server time sync fallback to local AST:", err);
      }
    };

    void syncServerTime();
    // Resync every 10 minutes to prevent long-tab drift
    const syncInterval = setInterval(syncServerTime, 10 * 60 * 1000);

    return () => {
      isCancelled = true;
      clearInterval(syncInterval);
    };
  }, []);

  // 2. High-precision 1-second ticker using synchronized clock
  useEffect(() => {
    if (!mounted) return;
    const ticker = setInterval(() => {
      setCurrentTimeMs(Date.now() + serverOffsetMs);
    }, 1000);
    return () => clearInterval(ticker);
  }, [mounted, serverOffsetMs]);

  if (!mounted) {
    return (
      <div
        className={`flex items-center gap-2 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#1F1F1F] text-slate-400 text-xs font-semibold px-3 py-1.5 rounded-lg font-mono tabular-nums ${className}`}
      >
        <Clock size={13} className="text-slate-400" />
        <span>--:--:-- AST</span>
      </div>
    );
  }

  const currentDateObj = new Date(currentTimeMs);
  const parts = saudiParts(currentDateObj);
  const timeFormatted = saudiTime12(currentDateObj, true);

  // Day of week in Riyadh
  const dayName = new Intl.DateTimeFormat("en-US", {
    timeZone: SAUDI_TZ,
    weekday: "short",
  }).format(currentDateObj);

  const fullDayName = new Intl.DateTimeFormat("en-US", {
    timeZone: SAUDI_TZ,
    weekday: "long",
  }).format(currentDateObj);

  const isFriday = fullDayName.toLowerCase() === "friday";

  const monthShort = new Intl.DateTimeFormat("en-US", {
    timeZone: SAUDI_TZ,
    month: "short",
  }).format(currentDateObj);

  const dateFormatted = `${dayName}, ${parts.day} ${monthShort} ${parts.year}`;

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
        <div
          className="flex items-center gap-1.5 rounded-lg bg-black/40 border border-jct-turquoise/30 px-2 py-1 text-[11px] font-mono font-bold text-white shadow-sm"
          title={`Authoritative Saudi AST (${isServerSynced ? "Server Synced ✓" : "Local Sync"})`}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-jct-turquoise">{timeFormatted}</span>
          <span className="text-[9px] text-slate-400 uppercase font-sans">AST</span>
        </div>
        {showFridayBadge && isFriday && (
          <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-extrabold text-amber-300">
            🕌 Friday Weekly-Off
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {/* Date Pill */}
      <div
        className="hidden md:flex items-center gap-1.5 rounded-lg bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#1F1F1F] px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300"
        title="Official Saudi Arabian Standard Date"
      >
        <Calendar size={13} className="text-jct-turquoise" />
        <span>{dateFormatted}</span>
        <span className="text-[10px] text-slate-400 font-normal">AST</span>
      </div>

      {/* Clock Pill with Live Pulsing Green Dot */}
      <div
        className="flex items-center gap-2 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#1F1F1F] hover:border-jct-turquoise/40 text-jct-charcoal dark:text-jct-offwhite text-xs font-bold px-2.5 py-1 rounded-lg font-mono tabular-nums transition shadow-sm"
        title={`Live Saudi Time (Asia/Riyadh, UTC+3) — ${isServerSynced ? "Authoritative Network Server Clock" : "Local Clock"}`}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-jct-turquoise">{timeFormatted}</span>
        <span className="text-[10px] font-sans font-medium text-slate-400">AST</span>
      </div>

      {/* Friday Weekly-Off Indicator Badge */}
      {showFridayBadge && isFriday && (
        <span
          className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 border border-amber-500/35 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 shadow-sm"
          title="Friday Weekly-Off in Kingdom of Saudi Arabia"
        >
          <span>🕌</span>
          <span>Friday · Weekly Off</span>
        </span>
      )}
    </div>
  );
}
