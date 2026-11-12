import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { PDFParse } from "pdf-parse";
import { getData as getPdfWorkerData } from "pdf-parse/worker";
import { prisma } from "../../../lib/prisma";

export const runtime = "nodejs";

// Ensure pdfjs worker is configured inline so serverless / Edge-like Node environments never fail to locate pdf.worker.mjs
try {
  PDFParse.setWorker(getPdfWorkerData());
} catch {
  // Ignore if already initialized
}

type PosTerminalBank = "SAB" | "AL_RAJHI" | "SNB" | "VISA_MC";
type InvoicePaymentMode =
  | "CASH"
  | "BANK_TRANSFER"
  | "POS_SWIPE"
  | "SPLIT"
  | "CREDIT_SALE"
  | "OTHER_RECD"
  | "Cash"
  | "Credit Received";

export interface ParsedErpInvoiceItem {
  id: string;
  referenceId: string;
  invoiceNo: string;
  branchInvNo?: string;
  seqInvoiceNo?: string;
  customer: string;
  customerName: string;
  amount: number;
  originalAmount: number;
  isEdited: boolean;
  paymentMethod: InvoicePaymentMode;
  paymentMode: InvoicePaymentMode;
  posTerminal: PosTerminalBank;
  isSplit: boolean;
  splitCashAmount: number;
  splitBankAmount: number;
  splitBankMethod: "BANK_TRANSFER" | "POS_SWIPE";
  splitPosTerminal: PosTerminalBank;
  autoMatched: boolean;
  time: string;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const cleanNum = (val: unknown): number => {
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  const s = String(val ?? "")
    .replace(/SAR/gi, "")
    .replace(/,/g, "")
    .trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

const mapJctPayTypeToMode = (rawPayType: string): {
  mode: InvoicePaymentMode;
  isSplit: boolean;
  terminal: PosTerminalBank;
  splitBankMethod: "BANK_TRANSFER" | "POS_SWIPE";
} => {
  const upper = rawPayType.trim().toUpperCase();
  const terminal: PosTerminalBank =
    upper.includes("VISA") || upper.includes("MASTER") || upper.includes("MC")
      ? "VISA_MC"
      : upper.includes("RAJHI")
      ? "AL_RAJHI"
      : upper.includes("SNB") || upper.includes("AHLI")
      ? "SNB"
      : "SAB";

  const isSplit =
    /\b(SPLIT|PARTIAL|MULTI|MULTI[- ]?BILL|MULTI[- ]?PAY|MULTI[- ]?PAYMENT|CASH\/BANK|CASH\+BANK|CASH\/CARD)\b/i.test(upper) ||
    upper.includes("SPLIT") ||
    upper.includes("MULTI") ||
    upper.includes("PARTIAL") ||
    upper.includes("CASH/BANK") ||
    upper.includes("CASH+BANK") ||
    upper.includes("CASH/CARD");

  if (isSplit) {
    return {
      mode: "SPLIT",
      isSplit: true,
      terminal,
      splitBankMethod: upper.includes("BANK") || upper.includes("TRANSFER") ? "BANK_TRANSFER" : "POS_SWIPE",
    };
  }

  if (upper.includes("BANK") || upper.includes("TRANSFER") || upper.includes("IBAN")) {
    return {
      mode: "BANK_TRANSFER",
      isSplit: false,
      terminal,
      splitBankMethod: "BANK_TRANSFER",
    };
  }

  if (
    upper.includes("CARD") ||
    upper.includes("POS") ||
    upper.includes("SWIPE") ||
    upper.includes("MADA") ||
    upper.includes("VISA") ||
    upper.includes("MASTER")
  ) {
    return {
      mode: "POS_SWIPE",
      isSplit: false,
      terminal,
      splitBankMethod: "POS_SWIPE",
    };
  }

  if (upper.includes("CREDIT")) {
    return {
      mode: "CREDIT_SALE",
      isSplit: false,
      terminal,
      splitBankMethod: "POS_SWIPE",
    };
  }

  return {
    mode: "CASH",
    isSplit: false,
    terminal,
    splitBankMethod: "POS_SWIPE",
  };
};

const buildInvoiceItem = (
  invoiceNo: string,
  customer: string,
  grossAmt: number,
  rawPayType: string,
  timeVal: string,
  cashCol = NaN,
  bankCol = NaN,
  branchInvNo?: string,
  seqInvoiceNo?: string
): ParsedErpInvoiceItem => {
  const cleanId = invoiceNo.replace(/^#/i, "").trim();
  const cleanCustomer = (customer || "Walk-in Customer").trim();
  const { mode, isSplit, terminal, splitBankMethod } = mapJctPayTypeToMode(rawPayType);
  const hasDualTenderValues = cashCol > 0 && bankCol > 0;
  const finalIsSplit = isSplit || hasDualTenderValues;
  const branchInv = branchInvNo ? branchInvNo.replace(/^#/i, "").trim() : cleanId;
  const seqInv = seqInvoiceNo ? seqInvoiceNo.replace(/^#/i, "").trim() : undefined;

  if (finalIsSplit) {
    const cashShare = cashCol > 0 ? cashCol : r2(grossAmt / 2);
    const bankShare = bankCol > 0 ? bankCol : Math.max(0, r2(grossAmt - cashShare));
    return {
      id: cleanId,
      referenceId: cleanId,
      invoiceNo: cleanId,
      branchInvNo: branchInv,
      seqInvoiceNo: seqInv,
      customer: cleanCustomer,
      customerName: cleanCustomer,
      amount: grossAmt,
      originalAmount: grossAmt,
      isEdited: false,
      paymentMethod: "SPLIT",
      paymentMode: "SPLIT",
      posTerminal: terminal,
      isSplit: true,
      splitCashAmount: cashShare,
      splitBankAmount: bankShare,
      splitBankMethod,
      splitPosTerminal: terminal,
      autoMatched: true,
      time: timeVal,
    };
  }

  return {
    id: cleanId,
    referenceId: cleanId,
    invoiceNo: cleanId,
    branchInvNo: branchInv,
    seqInvoiceNo: seqInv,
    customer: cleanCustomer,
    customerName: cleanCustomer,
    amount: grossAmt,
    originalAmount: grossAmt,
    isEdited: false,
    paymentMethod: mode,
    paymentMode: mode,
    posTerminal: terminal,
    isSplit: false,
    splitCashAmount: mode === "CASH" ? grossAmt : r2(grossAmt / 2),
    splitBankAmount:
      mode === "BANK_TRANSFER" || mode === "POS_SWIPE" ? grossAmt : r2(grossAmt / 2),
    splitBankMethod,
    splitPosTerminal: terminal,
    autoMatched: mode !== "CASH",
    time: timeVal,
  };
};

/**
 * Extracts the official business date from the JCT Sales Summary PDF "Duration" line
 * (e.g. "Duration : 01-November-2026 To 01-November-2026" -> "01-November-2026").
 */
export const extractJctReportDate = (rawText: string): string | null => {
  if (!rawText || !rawText.trim()) return null;

  const flat = rawText
    .replace(/[|\t\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // 1. Match "Duration : 01-November-2026..." (handles spaces or pipes around colons/hyphens)
  const durationAlphaMatch = flat.match(
    /Duration\s*[:=-]?\s*(\d{1,2})\s*[-/\s]\s*([A-Za-z]{3,9})\s*[-/\s]\s*(\d{2,4})/i
  );
  if (durationAlphaMatch) {
    const day = durationAlphaMatch[1].padStart(2, "0");
    const month = durationAlphaMatch[2];
    const year = durationAlphaMatch[3];
    return `${day}-${month}-${year}`;
  }

  // 2. Match numeric date after "Duration" (e.g. "Duration : 01-11-2026" or "Duration : 01/11/2026" or "Duration : 2026-11-01")
  const durationNumMatch = flat.match(
    /Duration\s*[:=-]?\s*(\d{1,4})\s*[-/]\s*(\d{1,2})\s*[-/]\s*(\d{2,4})/i
  );
  if (durationNumMatch) {
    return `${durationNumMatch[1]}-${durationNumMatch[2]}-${durationNumMatch[3]}`;
  }

  // 3. Fallback: standalone DD-MonthName-YYYY pattern in header
  const standaloneMonthMatch = flat.match(
    /\b(\d{1,2})\s*[-/\s]\s*(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s*[-/\s]\s*(\d{4})\b/i
  );
  if (standaloneMonthMatch) {
    const day = standaloneMonthMatch[1].padStart(2, "0");
    const month = standaloneMonthMatch[2];
    const year = standaloneMonthMatch[3];
    return `${day}-${month}-${year}`;
  }

  return null;
};

/**
 * Multi-line Token State Machine Parser for fragmented JCT Sales Summary PDFs.
 *
 * Handles raw pdf-parse output where columns are broken across newlines and pipe `|` characters:
 * Example:
 * 1
 *  | 39915
 * KHAMIS AL BUANAIN
 *  |  | Cash
 *  | 347.15
 *  |  | 0.0
 *  | 45.28
 *  | W#JB033431
 */
export const parseJctPdfTextToInvoices = (rawText: string): ParsedErpInvoiceItem[] => {
  if (!rawText || !rawText.trim()) return [];

  // 1. Normalize the fragmented text:
  // - Strip page boundary markers ("-- 1 of 3 --", "Page 1 of 3")
  // - Neutralize "CASH CUSTOMER" / "CASH SALE" in customer names so "CASH" inside a customer name
  //   is not mistaken for the Payment Type token
  // - Separate Payment Type keywords if glued to adjacent text/numbers
  // - Replace all pipes (`|`), tabs, newlines, and multiple spaces with single spaces to form a clean token stream
  const normalized = rawText
    .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, " ")
    .replace(/Page\s+\d+\s+of\s+\d+/gi, " ")
    .replace(/\bJubail\s+31951\b/gi, "Jubail")
    .replace(/\bCASH\s+(CUSTOMER|CUST|SALE|SALES|A\/C|ACCOUNT|PARTY|CLIENT)\b/gi, "WALKIN_$1")
    // Normalize branch invoice numbers like "W # JB 033431" or "W #JB 033431" to "W#JB033431"
    .replace(/\bW\s*#\s*([A-Za-z0-9_-]+)\b/gi, "W#$1")
    // Separate 2-decimal currency amounts glued to a following digit
    .replace(/(\d+\.\d{1,2})(?=\d)/g, "$1 ")
    // Separate standalone 5-digit invoice numbers glued to a Payment Type or Date
    .replace(/(\b\d{5})(?=(?:Cash|Card|Bank|Credit|Multi|Split|\d{2}[/-]\d{2}[/-]\d{2,4}))/gi, "$1 ")
    // Separate Payment Type keywords glued to a number (e.g. "Cash347.15" -> "Cash 347.15")
    .replace(/\b(Cash|Card|Bank|Credit|Multi|Split)(?=\d)/gi, "$1 ")
    // Separate customer text glued to a Payment Type when followed by pipe/space and a number
    .replace(/([A-Za-z])(Cash|Card|Bank|Credit|Multi|Split)(?=[\s|]+\d)/gi, "$1 $2 ")
    // Replace pipes, tabs, and newlines with spaces
    .replace(/[|\t\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = normalized.split(" ").filter(Boolean);
  const results: ParsedErpInvoiceItem[] = [];
  const seenInvoices = new Set<string>();
  const timeNow = nowHHMM();

  const isFiveDigitInv = (tok: string): boolean => /^\d{5}$/.test(tok) && tok !== "31951";
  const isPayTypeToken = (tok: string): boolean =>
    /^(Cash|Card|Bank|Credit|POS|Mada|Visa|Split|Multi)$/i.test(tok.replace(/^[:|]+|[:|]+$/g, ""));
  const isNumericAmountToken = (tok: string): boolean =>
    /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/.test(tok);
  const isBranchInvToken = (tok: string): boolean =>
    /^W#(?:[A-Za-z0-9_-]+)$/i.test(tok.replace(/^[:|]+|[:|]+$/g, ""));

  // 2. Scan the token stream sequentially with a state machine:
  // Look for a 5-digit Invoice No (e.g. 39915), followed shortly by Payment Type (Cash, Card, Bank, Credit),
  // followed immediately by the numeric Inv. Amount (e.g. 347.15).
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (!isFiveDigitInv(tok)) {
      i++;
      continue;
    }

    let currentInvNo = tok;
    let currentInvIdx = i;
    let matchedRow = false;

    // Scan forward up to 25 tokens for the Payment Type + Amount pair belonging to this 5-digit Invoice No
    const maxLookahead = Math.min(i + 25, tokens.length);
    for (let j = i + 1; j < maxLookahead; j++) {
      const candidate = tokens[j];

      // If another 5-digit number appears before Payment Type + Amount, update the anchor to the newer 5-digit number
      // (handles cases where both Invoice No and Branch Inv No. are 5-digit numbers, or skips stray header numbers)
      if (isFiveDigitInv(candidate)) {
        currentInvNo = candidate;
        currentInvIdx = j;
        continue;
      }

      if (isPayTypeToken(candidate)) {
        // Check the token immediately after Payment Type for the numeric Inv. Amount
        // (Also handle two-word payment types like "Bank Transfer", "Credit Sale", "Multi Bill", "Multi Payment", or optional "SAR" prefix)
        let amtIdx = j + 1;
        if (
          amtIdx < tokens.length &&
          /^(Transfer|Sale|Sales|SAR|Bill|Payment|Pay)$/i.test(tokens[amtIdx])
        ) {
          amtIdx++;
        }
        if (amtIdx < tokens.length && /^SAR$/i.test(tokens[amtIdx])) {
          amtIdx++;
        }

        if (amtIdx < tokens.length && isNumericAmountToken(tokens[amtIdx])) {
          const amountVal = cleanNum(tokens[amtIdx]);
          if (amountVal > 0 && !seenInvoices.has(currentInvNo)) {
            // Reconstruct customer name from tokens between currentInvIdx and j
            const rawCustomerTokens = tokens.slice(currentInvIdx + 1, j);
            const rawCustomerJoined = rawCustomerTokens.join(" ");

            // Ensure this isn't a document summary block
            if (
              !/\b(grand\s+total|sub\s+total|sales\s+summary|payment\s+summary)\b/i.test(
                rawCustomerJoined
              )
            ) {
              let customerName = rawCustomerJoined
                .replace(/\bWALKIN_/g, "Cash ")
                .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, " ")
                .replace(/\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b/g, " ")
                .replace(/\b([01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\s*(?:AM|PM)?\b/gi, " ")
                .replace(/\bW#[A-Za-z0-9_-]+\b/gi, " ")
                .replace(/^[\d\s/|-]+/, "")
                .replace(/\s+/g, " ")
                .trim();

              if (!customerName || customerName.length < 2 || /^\d+$/.test(customerName)) {
                customerName = "Walk-in Customer";
              }

              // Scan trailing tokens after the amount for the Branch Inv No. (e.g. W#JB033431)
              let foundBranchInv: string | null = null;
              let branchInvIdx = -1;
              const maxTrailing = Math.min(amtIdx + 15, tokens.length);
              for (let k = amtIdx + 1; k < maxTrailing; k++) {
                const t = tokens[k].replace(/^[:|]+|[:|]+$/g, "");
                if (isFiveDigitInv(t) || /^(grand|sub|summary|duration|report)$/i.test(t)) {
                  break;
                }
                if (isBranchInvToken(t)) {
                  foundBranchInv = t;
                  branchInvIdx = k;
                  break;
                }
              }

              // Fallback: check if the branch inv token appeared earlier in the row (e.g. within rawCustomerTokens)
              if (!foundBranchInv) {
                for (let c = 0; c < rawCustomerTokens.length; c++) {
                  const ct = rawCustomerTokens[c].replace(/^[:|]+|[:|]+$/g, "");
                  if (isBranchInvToken(ct)) {
                    foundBranchInv = ct;
                    break;
                  }
                }
              }

              // Priority rule: Use extracted Branch Inv No. (e.g. W#JB033431) as the primary identifier,
              // overriding standard sequential 5-digit invoice number (e.g. 39915)
              const primaryId = foundBranchInv || currentInvNo;

              seenInvoices.add(currentInvNo);
              seenInvoices.add(primaryId);
              if (foundBranchInv) {
                seenInvoices.add(foundBranchInv);
              }

              results.push(
                buildInvoiceItem(
                  primaryId,
                  customerName,
                  amountVal,
                  candidate,
                  timeNow,
                  NaN,
                  NaN,
                  foundBranchInv || primaryId,
                  currentInvNo
                )
              );

              // Advance outer cursor past the branch invoice index if present, or past amount token
              i = branchInvIdx !== -1 ? Math.max(amtIdx + 1, branchInvIdx + 1) : amtIdx + 1;
              matchedRow = true;
              break;
            }
          }
        }
      }
    }

    if (!matchedRow) {
      i++;
    }
  }

  return results;
};

/**
 * Header-aware table row parser for Excel (.xls, .xlsx) and structured tables.
 * Maps:
 * - "Invoice No" or "Branch Inv No." -> Reference ID (invoiceNo / referenceId)
 * - "Inv. Amount" -> Amount (amount)
 * - "Pay. Type" -> Payment Method (paymentMode / paymentMethod)
 */
const parseTableRowsToInvoices = (rows: unknown[][]): ParsedErpInvoiceItem[] => {
  const result: ParsedErpInvoiceItem[] = [];
  if (!Array.isArray(rows) || rows.length === 0) return result;

  let headerIdx = -1;
  const colMap = {
    inv: -1,
    branchInv: -1,
    customer: -1,
    invAmount: -1,
    fallbackAmount: -1,
    payType: -1,
    cash: -1,
    bank: -1,
    terminal: -1,
    time: -1,
  };

  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const r = (rows[i] || []).map((c) => String(c ?? "").trim().toLowerCase());
    const hasInvHeader = r.some(
      (c) =>
        c.includes("branch inv") ||
        c.includes("invoice no") ||
        c.includes("inv no") ||
        c.includes("inv. no") ||
        c.includes("reference id")
    );
    const hasPayOrAmtHeader = r.some(
      (c) =>
        c.includes("inv. amount") ||
        c.includes("inv amount") ||
        c.includes("pay. type") ||
        c.includes("pay type") ||
        c.includes("payment") ||
        c.includes("amount")
    );

    if (hasInvHeader && hasPayOrAmtHeader) {
      headerIdx = i;
      r.forEach((cell, idx) => {
        if (cell.includes("branch inv")) {
          colMap.branchInv = idx;
        } else if (
          colMap.inv === -1 &&
          (cell.includes("invoice no") ||
            cell.includes("inv no") ||
            cell.includes("inv. no") ||
            cell.includes("reference") ||
            cell === "inv" ||
            cell === "invoice")
        ) {
          colMap.inv = idx;
        } else if (
          colMap.payType === -1 &&
          (cell.includes("pay. type") ||
            cell.includes("pay type") ||
            cell.includes("payment type") ||
            cell.includes("pay. mode") ||
            cell.includes("payment method") ||
            cell.includes("mode") ||
            cell.includes("tender"))
        ) {
          colMap.payType = idx;
        } else if (
          colMap.invAmount === -1 &&
          (cell.includes("inv. amount") ||
            cell.includes("inv amount") ||
            cell.includes("invoice amount") ||
            cell.includes("net amount"))
        ) {
          colMap.invAmount = idx;
        } else if (
          colMap.fallbackAmount === -1 &&
          (cell === "amount" ||
            cell.includes("amount (sar)") ||
            cell.includes("total amount") ||
            cell === "total")
        ) {
          colMap.fallbackAmount = idx;
        } else if (
          colMap.customer === -1 &&
          (cell.includes("customer") ||
            cell.includes("client") ||
            cell.includes("particular") ||
            cell.includes("description") ||
            cell.includes("name") ||
            cell.includes("party"))
        ) {
          colMap.customer = idx;
        } else if (colMap.time === -1 && (cell === "time" || cell.includes("time"))) {
          colMap.time = idx;
        } else if (colMap.cash === -1 && cell.includes("cash")) {
          colMap.cash = idx;
        } else if (colMap.bank === -1 && (cell.includes("bank") || cell.includes("card") || cell.includes("pos"))) {
          colMap.bank = idx;
        } else if (colMap.terminal === -1 && (cell.includes("terminal") || cell.includes("device"))) {
          colMap.terminal = idx;
        }
      });
      break;
    }
  }

  const startRow = headerIdx !== -1 ? headerIdx + 1 : 0;
  const amountColIdx = colMap.invAmount !== -1 ? colMap.invAmount : colMap.fallbackAmount;

  for (let i = startRow; i < rows.length; i++) {
    const rawRow = rows[i];
    if (!Array.isArray(rawRow)) continue;
    const cols = rawRow.map((c) => String(c ?? "").trim());
    if (cols.every((c) => !c)) continue;

    const joinedLower = cols.join(" ").toLowerCase();
    if (
      joinedLower.includes("opening cash") ||
      joinedLower.includes("total sales") ||
      joinedLower.includes("total inflows") ||
      joinedLower.includes("total expenses") ||
      joinedLower.includes("closing cash") ||
      joinedLower.includes("closing drawer") ||
      joinedLower.includes("grand total") ||
      joinedLower.includes("sub total") ||
      joinedLower.includes("summary") ||
      joinedLower.includes("empty_register") ||
      joinedLower.includes("no entries recorded")
    ) {
      continue;
    }

    let invoiceNo = "";
    let customer = "Walk-in Customer";
    let grossAmt = 0;
    let rawModeText = "";
    let cashCol = NaN;
    let bankCol = NaN;
    let timeVal = nowHHMM();

    let detectedBranch = "";
    let detectedSeq = "";

    if (headerIdx !== -1 && (colMap.inv !== -1 || colMap.branchInv !== -1 || amountColIdx !== -1)) {
      const primaryInv = colMap.inv !== -1 ? cols[colMap.inv] || "" : "";
      const branchInv = colMap.branchInv !== -1 ? cols[colMap.branchInv] || "" : "";

      // Scan row cols for branch invoice pattern (e.g. W#JB033431)
      let foundBranch = branchInv;
      if (!foundBranch || !/^W#[A-Za-z0-9_-]+$/i.test(foundBranch.trim())) {
        for (const col of cols) {
          const m = col.match(/\bW#[A-Za-z0-9_-]+\b/i);
          if (m) {
            foundBranch = m[0];
            break;
          }
        }
      }

      if (foundBranch && foundBranch.trim()) {
        invoiceNo = foundBranch.trim();
        detectedBranch = foundBranch.trim();
        detectedSeq = primaryInv.trim();
      } else if (branchInv && branchInv.trim()) {
        invoiceNo = branchInv.trim();
        detectedBranch = branchInv.trim();
        detectedSeq = primaryInv.trim();
      } else if (primaryInv && primaryInv.trim()) {
        invoiceNo = primaryInv.trim();
        detectedSeq = primaryInv.trim();
      } else {
        invoiceNo = (primaryInv || branchInv).trim();
      }

      if (colMap.customer !== -1 && cols[colMap.customer]) {
        customer = cols[colMap.customer];
      }
      if (amountColIdx !== -1) {
        grossAmt = cleanNum(cols[amountColIdx]);
      }
      if (colMap.payType !== -1) {
        rawModeText = cols[colMap.payType] || "";
      }
      if (colMap.cash !== -1) cashCol = cleanNum(cols[colMap.cash]);
      if (colMap.bank !== -1) bankCol = cleanNum(cols[colMap.bank]);
      if (colMap.terminal !== -1) rawModeText += " " + (cols[colMap.terminal] || "");
      if (colMap.time !== -1 && cols[colMap.time]) timeVal = cols[colMap.time];
    } else {
      if (cols.length >= 3) {
        const secondAsNum = cleanNum(cols[1]);
        const thirdAsNum = cleanNum(cols[2]);
        if (thirdAsNum > 0) {
          invoiceNo = cols[0];
          customer = cols[1] || "Walk-in Customer";
          grossAmt = thirdAsNum;
          rawModeText = `${cols[3] || ""} ${cols[6] || ""}`;
          cashCol = cleanNum(cols[4]);
          bankCol = cleanNum(cols[5]);
        } else if (secondAsNum > 0) {
          invoiceNo = cols[0];
          grossAmt = secondAsNum;
          rawModeText = cols[2] || "Cash";
          customer = cols[3] || "Walk-in Customer";
        }
      }
    }

    invoiceNo = invoiceNo.replace(/^#/i, "").replace(/^inv[-_\s#]*/i, "").trim();
    if (!invoiceNo || invoiceNo === "--" || grossAmt <= 0) continue;

    result.push(
      buildInvoiceItem(
        invoiceNo,
        customer,
        grossAmt,
        rawModeText,
        timeVal,
        cashCol,
        bankCol,
        detectedBranch || invoiceNo,
        detectedSeq || undefined
      )
    );
  }

  return result;
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded", invoices: [] }, { status: 400 });
    }

    const fileName = (file.name || "").toLowerCase();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let invoices: ParsedErpInvoiceItem[] = [];
    let reportDate: string | null = null;

    if (fileName.endsWith(".pdf") || file.type === "application/pdf") {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        // Extract raw text (with pipe cellSeparator to match JCT PDF layout) and run the multi-line token state machine
        const textResult = await parser.getText({ cellSeparator: " | " });
        const fullText = textResult?.text || "";
        if (fullText) {
          reportDate = extractJctReportDate(fullText);
          invoices = parseJctPdfTextToInvoices(fullText);
        }

        // Fallback: if 0 rows matched or reportDate not yet extracted, also try default getText()
        if (invoices.length === 0 || !reportDate) {
          const fallbackTextResult = await parser.getText();
          if (fallbackTextResult?.text) {
            if (!reportDate) {
              reportDate = extractJctReportDate(fallbackTextResult.text);
            }
            if (invoices.length === 0) {
              invoices = parseJctPdfTextToInvoices(fallbackTextResult.text);
            }
          }
        }
      } finally {
        await parser.destroy().catch(() => {});
      }
    } else {
      // Excel (.xls, .xlsx) or .csv via SheetJS (xlsx)
      const workbook = XLSX.read(buffer, { type: "buffer" });
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
        const flatText = rows.map((r) => (Array.isArray(r) ? r.join(" | ") : "")).join("\n");
        if (!reportDate && flatText) {
          reportDate = extractJctReportDate(flatText);
        }
        const parsed = parseTableRowsToInvoices(rows);
        if (parsed.length > 0) {
          invoices.push(...parsed);
        } else {
          // If the Excel sheet also has fragmented multi-line cells, run the token state machine on its flattened text
          const fallbackParsed = parseJctPdfTextToInvoices(flatText);
          if (fallbackParsed.length > 0) {
            invoices.push(...fallbackParsed);
          }
        }
      }
    }

    // Instant Auto-Harvesting of parsed customer names into PartyDirectory
    if (invoices.length > 0) {
      const rawBranch = req.headers.get("x-branch-id") || "ALL";
      const uniqueCusts = Array.from(
        new Set(
          invoices
            .map((inv) => (inv.customer || inv.customerName || "").trim())
            .filter(
              (c) =>
                c &&
                c.length >= 2 &&
                !c.toLowerCase().includes("walkin") &&
                !c.toLowerCase().includes("walk-in")
            )
        )
      );

      // Async upsert to party directory without delaying response
      (async () => {
        for (const cust of uniqueCusts) {
          const norm = cust.replace(/\s+/g, " ").toUpperCase();
          await prisma.partyDirectory
            .upsert({
              where: { name_partyType: { name: norm, partyType: "CUSTOMER" } },
              update: {
                branch: rawBranch !== "ALL" ? rawBranch : undefined,
              },
              create: {
                name: norm,
                partyType: "CUSTOMER",
                branch: rawBranch,
              },
            })
            .catch(() => {});
        }
      })().catch(() => {});
    }

    return NextResponse.json({ invoices, reportDate });
  } catch (err) {
    console.error("Error parsing uploaded sales file:", err);
    return NextResponse.json(
      { error: "Failed to parse sales file", invoices: [] },
      { status: 500 }
    );
  }
}
