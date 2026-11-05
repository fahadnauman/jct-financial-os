/**
 * Saudi Arabia Standard Time (AST, UTC+3, Asia/Riyadh) helpers.
 * Every date/time in the app is derived from these so the user's device timezone is ignored.
 */

export const SAUDI_TZ = "Asia/Riyadh";

export const SAUDI_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: SAUDI_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export interface SaudiParts {
  year: string;
  month: string; // 01-12
  day: string; // 01-31
  hour: string; // 00-23
  minute: string;
  second: string;
}

/** Wall-clock components in Riyadh for the given instant (default: now). */
export function saudiParts(input: Date | string | number = new Date()): SaudiParts {
  const d = input instanceof Date ? input : new Date(input);
  const out: Record<string, string> = {};
  for (const p of partsFormatter.formatToParts(d)) {
    if (p.type !== "literal") out[p.type] = p.value;
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour === "24" ? "00" : out.hour,
    minute: out.minute,
    second: out.second,
  };
}

/** YYYY-MM-DD in Saudi time (used for DB `date` columns). */
export const saudiTodayIso = (input?: Date | string | number): string => {
  const p = saudiParts(input);
  return `${p.year}-${p.month}-${p.day}`;
};

/** YYYY-MM in Saudi time. */
export const saudiMonthIso = (input?: Date | string | number): string => {
  const p = saudiParts(input);
  return `${p.year}-${p.month}`;
};

/** "05-November-2026" session label in Saudi time. */
export const saudiSessionDate = (input?: Date | string | number): string => {
  const p = saudiParts(input);
  return `${p.day}-${SAUDI_MONTHS[Number(p.month) - 1]}-${p.year}`;
};

/** "05-11-2026" in Saudi time. */
export const saudiCalendarDateStr = (input?: Date | string | number): string => {
  const p = saudiParts(input);
  return `${p.day}-${p.month}-${p.year}`;
};

/** "HH:mm" 24h in Saudi time. */
export const saudiHHMM = (input?: Date | string | number): string => {
  const p = saudiParts(input);
  return `${p.hour}:${p.minute}`;
};

/** "01:45 PM" in Saudi time. */
export const saudiTime12 = (input?: Date | string | number, withSeconds = false): string => {
  const d = input === undefined ? new Date() : input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    timeZone: SAUDI_TZ,
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
    hour12: true,
  });
};

/** Full locale date + time in Saudi time. */
export const saudiDateTimeString = (input?: Date | string | number): string => {
  const d = input === undefined ? new Date() : input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString("en-GB", { timeZone: SAUDI_TZ })} ${saudiTime12(d, true)} (AST)`;
};

/** Locale date (dd/mm/yyyy) in Saudi time. */
export const saudiDateString = (input?: Date | string | number): string => {
  const d = input === undefined ? new Date() : input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { timeZone: SAUDI_TZ });
};

export interface SaudiMonthGroup {
  key: string; // "2026-11"
  label: string; // "November 2026"
  year: number;
  month: number;
}

/**
 * Resolves any date string or Date into a Saudi Arabia AST month grouping key and label.
 *
 * Example:
 *   getSaudiMonthGroup("2026-11-05") -> { key: "2026-11", label: "November 2026", year: 2026, month: 11 }
 *   getSaudiMonthGroup("05-November-2026") -> { key: "2026-11", label: "November 2026", year: 2026, month: 11 }
 */
export function getSaudiMonthGroup(input: string | Date | number | null | undefined): SaudiMonthGroup {
  if (!input) {
    const p = saudiParts(new Date());
    const m = Number(p.month);
    const y = Number(p.year);
    return { key: `${y}-${String(m).padStart(2, "0")}`, label: `${SAUDI_MONTHS[m - 1]} ${y}`, year: y, month: m };
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    // Pattern: "YYYY-MM-DD" or "YYYY-MM"
    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?/);
    if (isoMatch) {
      const y = Number(isoMatch[1]);
      const m = Number(isoMatch[2]);
      if (m >= 1 && m <= 12) {
        return {
          key: `${y}-${String(m).padStart(2, "0")}`,
          label: `${SAUDI_MONTHS[m - 1]} ${y}`,
          year: y,
          month: m,
        };
      }
    }

    // Pattern: "DD-MonthName-YYYY" e.g. "05-November-2026"
    const textDateMatch = trimmed.match(/^(\d{1,2})-([A-Za-z]+)-(\d{4})/);
    if (textDateMatch) {
      const monthStr = textDateMatch[2].toLowerCase();
      const y = Number(textDateMatch[3]);
      const mIndex = SAUDI_MONTHS.findIndex((m) => m.toLowerCase() === monthStr);
      if (mIndex >= 0) {
        const m = mIndex + 1;
        return {
          key: `${y}-${String(m).padStart(2, "0")}`,
          label: `${SAUDI_MONTHS[mIndex]} ${y}`,
          year: y,
          month: m,
        };
      }
    }
  }

  // Fallback to partsFormatter with Saudi Timezone
  const d = input instanceof Date ? input : new Date(input);
  if (!isNaN(d.getTime())) {
    const p = saudiParts(d);
    const m = Number(p.month);
    const y = Number(p.year);
    return {
      key: `${y}-${String(m).padStart(2, "0")}`,
      label: `${SAUDI_MONTHS[m - 1]} ${y}`,
      year: y,
      month: m,
    };
  }

  // Ultimate fallback to current Saudi month
  const p = saudiParts(new Date());
  const m = Number(p.month);
  const y = Number(p.year);
  return { key: `${y}-${String(m).padStart(2, "0")}`, label: `${SAUDI_MONTHS[m - 1]} ${y}`, year: y, month: m };
}

