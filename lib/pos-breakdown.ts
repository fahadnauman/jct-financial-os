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

export interface BankTransferGroupItem {
  bankName: string;
  amount: number;
  count: number;
}

export interface PosSessionBreakdown {
  totalNonCashAmount: number;
  totalTransactions: number;
  posSwipesTotal: number;
  posSwipesCount: number;
  posTerminalList: TerminalBreakdownItem[];
  posCardList: CardBreakdownItem[];
  bankTransferTotal: number;
  bankTransferCount: number;
  bankTransferBanks: BankTransferGroupItem[];
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
  ALINMA: "Alinma Bank",
  RIYAD_BANK: "Riyad Bank",
  UNSPECIFIED_POS: "Unspecified POS",
  BANK_TRANSFER: "Bank Transfer",
};

export const normalizeTerminalKey = (raw?: string | null): string => {
  if (!raw || !raw.trim()) return "UNSPECIFIED_POS";
  const upper = raw.trim().toUpperCase().replace(/\s+/g, "_");
  if (upper.includes("RAJHI")) return "AL_RAJHI";
  if (upper.includes("SNB") || upper.includes("NCB") || upper.includes("AHLI")) return "SNB";
  if (upper.includes("ALINMA")) return "ALINMA";
  if (upper.includes("RIYAD")) return "RIYAD_BANK";
  if (upper.includes("TRANSFER") || upper.includes("WIRE") || upper.includes("IBAN")) return "BANK_TRANSFER";
  if (upper.includes("VISA") || upper.includes("MC")) return "SAB";
  if (upper.includes("SAB") || upper.includes("AWWAL") || upper.includes("BRITISH")) return "SAB";
  if (upper === "UNSPECIFIED_POS" || upper === "POS" || upper === "CARD") return "UNSPECIFIED_POS";
  return upper;
};

export const normalizeBankDisplayName = (raw?: string | null): string => {
  if (!raw || !raw.trim()) return "Direct Bank Transfer";
  const upper = raw.trim().toUpperCase();
  if (upper.includes("RAJHI")) return "Al Rajhi Bank";
  if (upper.includes("SNB") || upper.includes("NCB") || upper.includes("AHLI")) return "SNB (Saudi National Bank)";
  if (upper.includes("ALINMA")) return "Alinma Bank";
  if (upper.includes("RIYAD")) return "Riyad Bank";
  if (upper.includes("SAB") || upper.includes("AWWAL") || upper.includes("BRITISH")) return "SAB (Saudi Awwal Bank)";
  if (upper === "BANK_TRANSFER" || upper === "BANK" || upper === "TRANSFER") return "Direct Bank Transfer";
  return raw.trim();
};

export const normalizeCardType = (raw?: string | null): string => {
  if (!raw) return "mada";
  const lower = raw.toLowerCase().trim();
  if (lower.includes("amex") || lower.includes("american")) return "AMEX";
  if (lower.includes("master")) return "Mastercard";
  if (lower.includes("visa")) return "Visa";
  if (lower.includes("transfer") || lower.includes("wire")) return "Direct Transfer";
  return "mada";
};

export interface GenericInvoiceLike {
  id?: string;
  internalId?: string;
  clientTxnId?: string;
  invoiceNo?: string;
  branchInvNo?: string;
  referenceId?: string;
  amount: number;
  originalAmount?: number;
  roundOffAmount?: number;
  discountAmount?: number;
  cashCommissionAmount?: number;
  cashCommissionPaidFrom?: "CASH" | "BANK";
  cashCommissionRecipient?: string;
  netPayableAmount?: number;
  isReturned?: boolean;
  isManual?: boolean;
  isManualPos?: boolean;
  source?: string;
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
  id?: string;
  clientTxnId?: string;
  invoiceNo: string;
  amount?: number;
  paymentMode?: string;
  posTerminal?: string;
  cardNetwork?: string;
}

export interface GenericPreLoggedEntryLike {
  id: string;
  clientTxnId?: string;
  sourcePocketId?: string;
  type: string;
  amount: number;
  receiptNo?: string;
  invoiceNumber?: string;
  isReturned?: boolean;
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
  const posCardsOverall: Record<string, CardBreakdownItem> = {};
  const bankTransferMap: Record<string, BankTransferGroupItem> = {};
  let totalNonCashAmount = 0;
  let totalTransactions = 0;
  let posSwipesTotal = 0;
  let posSwipesCount = 0;
  let bankTransferTotal = 0;
  let bankTransferCount = 0;

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

  const addRecord = (
    terminalKey: string,
    cardType: string,
    amount: number,
    explicitBankName?: string | null
  ) => {
    const validAmount = r2(Number(amount) || 0);
    if (validAmount <= 0) return;

    totalNonCashAmount = r2(totalNonCashAmount + validAmount);
    totalTransactions += 1;

    if (terminalKey === "BANK_TRANSFER" || cardType === "Direct Transfer") {
      bankTransferTotal = r2(bankTransferTotal + validAmount);
      bankTransferCount += 1;
      const bName = normalizeBankDisplayName(explicitBankName);
      if (!bankTransferMap[bName]) {
        bankTransferMap[bName] = { bankName: bName, amount: 0, count: 0 };
      }
      bankTransferMap[bName].amount = r2(bankTransferMap[bName].amount + validAmount);
      bankTransferMap[bName].count += 1;
    } else {
      posSwipesTotal = r2(posSwipesTotal + validAmount);
      posSwipesCount += 1;
      if (!posCardsOverall[cardType]) {
        posCardsOverall[cardType] = { cardType, amount: 0, count: 0 };
      }
      posCardsOverall[cardType].amount = r2(posCardsOverall[cardType].amount + validAmount);
      posCardsOverall[cardType].count += 1;
    }

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
  const processedClientIds = new Set<string>();

  // 1. Process active ERP invoices (including legacy and new Manual POS entries)
  for (const inv of erpInvoices) {
    if (inv.isReturned) continue;
    if (inv.invoiceNo) processedInvoices.add(inv.invoiceNo.trim().replace(/^#/, ""));
    if (inv.branchInvNo) processedInvoices.add(inv.branchInvNo.trim().replace(/^#/, ""));
    if (inv.clientTxnId) processedClientIds.add(inv.clientTxnId);
    if (inv.id) processedClientIds.add(inv.id);
    if (inv.internalId) processedClientIds.add(inv.internalId);

    // When Cross-Tender Cash Commission is logged (inv.cashCommissionAmount > 0),
    // keep the Card/Bank gross settlement 100% intact (only net of any roundOff or discount)
    // because the commission is recorded as a separate linked Cash/Bank outflow.
    const effectiveInvAmount =
      (inv.cashCommissionAmount || 0) > 0
        ? r2(
            Math.max(
              0,
              (inv.originalAmount ?? inv.amount) -
                (inv.roundOffAmount || 0) -
                (inv.discountAmount || 0)
            )
          )
        : inv.netPayableAmount !== undefined && inv.netPayableAmount >= 0
        ? inv.netPayableAmount
        : inv.amount;
    const mode = (inv.paymentMode || "").toUpperCase();

    if (mode === "POS_SWIPE" || mode === "SWIPE" || mode === "CARD") {
      const rawTerm = inv.posTerminalDevice || inv.terminal || inv.posTerminal;
      const termKey = normalizeTerminalKey(rawTerm === "VISA_MC" ? "SAB" : rawTerm);
      const cardType =
        termKey === "BANK_TRANSFER"
          ? "Direct Transfer"
          : inv.posTerminal === "VISA_MC" && inv.cardNetwork !== "mada"
          ? "Visa"
          : normalizeCardType(inv.splitCardBrand || inv.cardNetwork || inv.network);
      addRecord(termKey, cardType, effectiveInvAmount, rawTerm);
    } else if (mode === "BANK_TRANSFER" || mode === "BANK") {
      const rawBank = inv.posTerminalDevice || inv.terminal || inv.posTerminal;
      addRecord("BANK_TRANSFER", "Direct Transfer", effectiveInvAmount, rawBank);
    } else if (mode === "SPLIT") {
      const bankPortion = Number(inv.splitBankAmount) || 0;
      if (bankPortion > 0) {
        const isTransfer =
          inv.splitBankMethod === "BANK_TRANSFER" || inv.splitBankChoice === "BANK_TRANSFER";
        if (isTransfer) {
          addRecord("BANK_TRANSFER", "Direct Transfer", bankPortion, inv.splitPosTerminal || inv.terminal);
        } else {
          const termKey = normalizeTerminalKey(
            inv.splitBankChoice || inv.posTerminalDevice || inv.terminal || inv.splitPosTerminal
          );
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
    if (b.clientTxnId && processedClientIds.has(b.clientTxnId)) continue;
    if (b.id && processedClientIds.has(b.id)) continue;
    const cleanNo = (b.invoiceNo || "").trim().replace(/^#/, "");
    if (cleanNo && processedInvoices.has(cleanNo)) continue;
    const amt = Number(b.amount) || 0;
    if (amt <= 0) continue;

    const mode = (b.paymentMode || "").toUpperCase();
    if (mode === "BANK_TRANSFER") {
      addRecord("BANK_TRANSFER", "Direct Transfer", amt, b.posTerminal);
    } else {
      const termKey = normalizeTerminalKey(b.posTerminal);
      const cardType = normalizeCardType(b.cardNetwork);
      addRecord(termKey, cardType, amt);
    }
  }

  // 3. Process any non-cash pre-logged inflow entries (including legacy/unlinked POS_SWIPE entries)
  for (const entry of preLoggedEntries) {
    if (entry.isReturned) continue;
    if (entry.type === "EXPENSE" || entry.type === "CREDIT_SALE") continue;
    if (entry.clientTxnId && processedClientIds.has(entry.clientTxnId)) continue;
    if (entry.sourcePocketId && processedClientIds.has(entry.sourcePocketId)) continue;
    if (entry.id && processedClientIds.has(entry.id)) continue;
    const cleanEntryInv = (entry.invoiceNumber || entry.receiptNo || "").trim().replace(/^#/, "");
    if ((entry.type === "SPLIT_SALE" || entry.type === "POS_SWIPE") && cleanEntryInv && processedInvoices.has(cleanEntryInv)) {
      continue;
    }
    const mode = (entry.paymentMode || "").toUpperCase();
    const amt = Number(entry.amount) || 0;

    if (entry.isSplit && (entry.splitBankAmount || 0) > 0) {
      const bankAmt = Number(entry.splitBankAmount) || 0;
      const isTransfer = entry.splitBankMethod === "BANK_TRANSFER";
      if (isTransfer) {
        addRecord("BANK_TRANSFER", "Direct Transfer", bankAmt, entry.splitPosTerminal || entry.terminal);
      } else {
        const termKey = normalizeTerminalKey(entry.splitPosTerminal || entry.terminal);
        const cardType = normalizeCardType(entry.network);
        addRecord(termKey, cardType, bankAmt);
      }
    } else if (mode === "BANK_TRANSFER" || mode === "BANK") {
      addRecord("BANK_TRANSFER", "Direct Transfer", amt, entry.terminal);
    } else if (
      entry.type === "POS_SWIPE" ||
      mode === "POS_SWIPE" ||
      mode === "CARD" ||
      mode === "MADA" ||
      mode === "VISA" ||
      mode === "SAB" ||
      mode === "AL_RAJHI" ||
      mode === "SNB"
    ) {
      const termKey = normalizeTerminalKey(entry.terminal || mode);
      const cardType = normalizeCardType(entry.network || mode);
      addRecord(termKey, cardType, amt);
    }
  }

  // Convert map to sorted arrays
  const terminalList = Object.values(terminals).map((t) => ({
    ...t,
    cardList: Object.values(t.cards).sort((a, b) => b.amount - a.amount),
  })).sort((a, b) => b.totalAmount - a.totalAmount);

  const posTerminalList = terminalList.filter((t) => t.terminalKey !== "BANK_TRANSFER");
  const posCardList = Object.values(posCardsOverall).sort((a, b) => b.amount - a.amount);
  const cardList = Object.values(cardsOverall).sort((a, b) => b.amount - a.amount);
  const bankTransferBanks = Object.values(bankTransferMap).sort((a, b) => b.amount - a.amount);

  return {
    totalNonCashAmount,
    totalTransactions,
    posSwipesTotal,
    posSwipesCount,
    posTerminalList,
    posCardList,
    bankTransferTotal,
    bankTransferCount,
    bankTransferBanks,
    terminals,
    terminalList,
    cardsOverall,
    cardList,
  };
}

export function getBranchBadgeInfo(b: string) {
  const clean = (b || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (clean.includes("HEMPEL")) {
    return { name: "Hempel", color: "bg-jct-turquoise text-jct-charcoal font-bold border-jct-turquoise" };
  }
  if (clean.includes("DAMMAM")) {
    return { name: "Dammam Jotun", color: "bg-jct-yellow text-jct-charcoal font-bold border-jct-yellow" };
  }
  if (clean.includes("SIGMA")) {
    return { name: "Sigma", color: "bg-jct-turquoise text-jct-charcoal font-bold border-jct-turquoise" };
  }
  return { name: "JCT Hardware + Jotun", color: "bg-jct-yellow text-jct-charcoal font-bold border-jct-yellow" };
}
