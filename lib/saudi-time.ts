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
