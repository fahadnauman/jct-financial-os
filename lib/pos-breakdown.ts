/**
 * POS & Bank Settlement Breakdown Aggregator
 * Groups active session non-cash transactions by:
 * 1. Terminal / Bank (SAB, Al Rajhi, SNB, Bank Transfer)
 * 2. Card Type (mada, Visa, Mastercard, Direct Transfer)
 */

export interface CardBreakdownItem {
  cardType: string; // "mada", "Visa", "Mastercard", "Direct Transfer"
  amount: number;
  count: number;
}

export interface TerminalBreakdownItem {
  terminalKey: string; // "SAB", "AL_RAJHI", "SNB", "BANK_TRANSFER"
  terminalName: string; // "SAB", "Al Rajhi", "SNB", "Bank Transfer"
  totalAmount: number;
  transactionCount: number;
  cards: Record<string, CardBreakdownItem>;
  cardList: CardBreakdownItem[];
}

export interface PosSessionBreakdown {
  totalNonCashAmount: number;
  totalTransactions: number;
  terminals: Record<string, TerminalBreakdownItem>;
  terminalList: TerminalBreakdownItem[];
  cardsOverall: Record<string, CardBreakdownItem>;
  cardList: CardBreakdownItem[];
}

const r2 = (val: number): number => Math.round((val + Number.EPSILON) * 100) / 100;

export const TERMINAL_NAMES: Record<string, string> = {
  SAB: "SAB",
  AL_RAJHI: "Al Rajhi",
  SNB: "SNB",
  BANK_TRANSFER: "Bank Transfer",
};

export const normalizeTerminalKey = (raw?: string | null): string => {
  if (!raw) return "SAB";
  const upper = raw.toUpperCase().replace(/\s+/g, "_");
  if (upper.includes("RAJHI")) return "AL_RAJHI";
  if (upper.includes("SNB") || upper.includes("NCB") || upper.includes("AHLI")) return "SNB";
  if (upper.includes("TRANSFER") || upper.includes("WIRE")) return "BANK_TRANSFER";
  if (upper.includes("VISA") || upper.includes("MC")) return "SAB";
  if (upper.includes("SAB") || upper.includes("AWWAL") || upper.includes("BRITISH")) return "SAB";
  return upper;
};

export const normalizeCardType = (raw?: string | null): string => {
  if (!raw) return "mada";
  const lower = raw.toLowerCase().trim();
  if (lower.includes("master")) return "Mastercard";
  if (lower.includes("visa")) return "Visa";
  if (lower.includes("transfer") || lower.includes("wire")) return "Direct Transfer";
  return "mada";
};

export interface GenericInvoiceLike {
  invoiceNo?: string;
  referenceId?: string;
  amount: number;
  paymentMode?: string;
  posTerminal?: string;
  posTerminalDevice?: string;
  terminal?: string;
  cardNetwork?: string;
  network?: string;
  isSplit?: boolean;
  splitCashAmount?: number;
  splitBankAmount?: number;
  splitBankMethod?: string;
  splitPosTerminal?: string;
  splitBankChoice?: string;
  splitCardBrand?: string;
  creditDownAmount?: number;
  creditDownMethod?: string;
  creditDownTerminal?: string;
}

export interface GenericPreLoggedBankLike {
  invoiceNo: string;
  amount?: number;
  paymentMode?: string;
  posTerminal?: string;
  cardNetwork?: string;
}

export interface GenericPreLoggedEntryLike {
  id: string;
  type: string;
  amount: number;
  paymentMode?: string;
  terminal?: string;
  network?: string;
  isSplit?: boolean;
  splitBankAmount?: number;
  splitBankMethod?: string;
  splitPosTerminal?: string;
}

/**
 * Aggregates all non-cash (POS/Bank) transactions for the active session.
 * Group the totals first by Terminal/Bank (SAB, Al Rajhi, etc.) and then by Card Type (mada, Visa, Mastercard).
 */
export function calcSessionPosBreakdown(
  erpInvoices: GenericInvoiceLike[] = [],
  preLoggedBankInvoices: GenericPreLoggedBankLike[] = [],
  preLoggedEntries: GenericPreLoggedEntryLike[] = []
): PosSessionBreakdown {
  const terminals: Record<string, TerminalBreakdownItem> = {};
  const cardsOverall: Record<string, CardBreakdownItem> = {};
  let totalNonCashAmount = 0;
  let totalTransactions = 0;

  const ensureTerminal = (key: string): TerminalBreakdownItem => {
    if (!terminals[key]) {
      terminals[key] = {
        terminalKey: key,
        terminalName: TERMINAL_NAMES[key] || key,
        totalAmount: 0,
        transactionCount: 0,
        cards: {},
        cardList: [],
      };
    }
    return terminals[key];
  };

  const addRecord = (terminalKey: string, cardType: string, amount: number) => {
    const validAmount = r2(Number(amount) || 0);
    if (validAmount <= 0) return;

    totalNonCashAmount = r2(totalNonCashAmount + validAmount);
    totalTransactions += 1;

    const term = ensureTerminal(terminalKey);
    term.totalAmount = r2(term.totalAmount + validAmount);
    term.transactionCount += 1;

    if (!term.cards[cardType]) {
      term.cards[cardType] = { cardType, amount: 0, count: 0 };
    }
    term.cards[cardType].amount = r2(term.cards[cardType].amount + validAmount);
    term.cards[cardType].count += 1;

    // Grand totals across all terminals
    if (!cardsOverall[cardType]) {
      cardsOverall[cardType] = { cardType, amount: 0, count: 0 };
    }
    cardsOverall[cardType].amount = r2(cardsOverall[cardType].amount + validAmount);
    cardsOverall[cardType].count += 1;
  };

  const processedInvoices = new Set<string>();

  // 1. Process active ERP invoices
  for (const inv of erpInvoices) {
    if (inv.invoiceNo) processedInvoices.add(inv.invoiceNo.trim());

    const mode = (inv.paymentMode || "").toUpperCase();

    if (mode === "POS_SWIPE" || mode === "SWIPE") {
      const termKey = normalizeTerminalKey(
        inv.posTerminalDevice || inv.terminal || (inv.posTerminal === "VISA_MC" ? "SAB" : inv.posTerminal)
      );
      const cardType =
        inv.posTerminal === "VISA_MC" && inv.cardNetwork !== "mada"
          ? "Visa"
          : normalizeCardType(inv.cardNetwork || inv.network);
      addRecord(termKey, cardType, inv.amount);
    } else if (mode === "BANK_TRANSFER" || mode === "BANK") {
      addRecord("BANK_TRANSFER", "Direct Transfer", inv.amount);
    } else if (mode === "SPLIT") {
      const bankPortion = Number(inv.splitBankAmount) || 0;
      if (bankPortion > 0) {
        const isTransfer =
          inv.splitBankMethod === "BANK_TRANSFER" || inv.splitBankChoice === "BANK_TRANSFER";
        if (isTransfer) {
          addRecord("BANK_TRANSFER", "Direct Transfer", bankPortion);
        } else {
          const termKey = normalizeTerminalKey(inv.splitBankChoice || inv.splitPosTerminal);
          const cardType = normalizeCardType(inv.splitCardBrand || inv.cardNetwork || inv.network);
          addRecord(termKey, cardType, bankPortion);
        }
      }
    } else if (mode === "CREDIT_SALE") {
      const downMethod = (inv.creditDownMethod || "").toUpperCase();
      const downAmt = Number(inv.creditDownAmount) || 0;
      if (downMethod === "POS_SWIPE" && downAmt > 0) {
        const termKey = normalizeTerminalKey(inv.creditDownTerminal);
        const cardType = normalizeCardType(inv.cardNetwork || inv.network);
        addRecord(termKey, cardType, downAmt);
      }
    }
  }

  // 2. Process any unmatched pre-logged bank invoices
  for (const b of preLoggedBankInvoices) {
    if (b.invoiceNo && processedInvoices.has(b.invoiceNo.trim())) continue;
    const amt = Number(b.amount) || 0;
    if (amt <= 0) continue;

    const mode = (b.paymentMode || "").toUpperCase();
    if (mode === "BANK_TRANSFER") {
      addRecord("BANK_TRANSFER", "Direct Transfer", amt);
    } else {
      const termKey = normalizeTerminalKey(b.posTerminal);
      const cardType = normalizeCardType(b.cardNetwork);
      addRecord(termKey, cardType, amt);
    }
  }

  // 3. Process any non-cash pre-logged inflow entries (e.g. OTHER_IN, CREDIT_RECD via card)
  for (const entry of preLoggedEntries) {
    if (entry.type === "EXPENSE") continue; // Keep expenses separate from settlements
    const mode = (entry.paymentMode || "").toUpperCase();
    const amt = Number(entry.amount) || 0;

    if (entry.isSplit && (entry.splitBankAmount || 0) > 0) {
      const bankAmt = Number(entry.splitBankAmount) || 0;
      const isTransfer = entry.splitBankMethod === "BANK_TRANSFER";
      if (isTransfer) {
        addRecord("BANK_TRANSFER", "Direct Transfer", bankAmt);
      } else {
        const termKey = normalizeTerminalKey(entry.splitPosTerminal || entry.terminal);
        const cardType = normalizeCardType(entry.network);
        addRecord(termKey, cardType, bankAmt);
      }
    } else if (mode === "BANK_TRANSFER" || mode === "BANK") {
      addRecord("BANK_TRANSFER", "Direct Transfer", amt);
    } else if (mode === "POS_SWIPE" || mode === "CARD" || mode === "MADA" || mode === "VISA") {
      const termKey = normalizeTerminalKey(entry.terminal);
      const cardType = normalizeCardType(entry.network || mode);
      addRecord(termKey, cardType, amt);
    }
  }

  // Convert map to sorted arrays
  const terminalList = Object.values(terminals).map((t) => ({
    ...t,
    cardList: Object.values(t.cards).sort((a, b) => b.amount - a.amount),
  })).sort((a, b) => b.totalAmount - a.totalAmount);

  const cardList = Object.values(cardsOverall).sort((a, b) => b.amount - a.amount);

  return {
    totalNonCashAmount,
    totalTransactions,
    terminals,
    terminalList,
    cardsOverall,
    cardList,
  };
}
