import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";

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

interface ParsedErpInvoiceItem {
  invoiceNo: string;
  customer: string;
  amount: number;
  originalAmount: number;
  isEdited: boolean;
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
    upper.includes("SPLIT") ||
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
  bankCol = NaN
): ParsedErpInvoiceItem => {
  const { mode, isSplit, terminal, splitBankMethod } = mapJctPayTypeToMode(rawPayType);
  const hasDualTenderValues = cashCol > 0 && bankCol > 0;
  const finalIsSplit = isSplit || hasDualTenderValues;

  if (finalIsSplit) {
    const cashShare = cashCol > 0 ? cashCol : r2(grossAmt / 2);
    const bankShare = bankCol > 0 ? bankCol : Math.max(0, r2(grossAmt - cashShare));
    return {
      invoiceNo,
      customer: customer || "Walk-in Customer",
      amount: grossAmt,
      originalAmount: grossAmt,
      isEdited: false,
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
    invoiceNo,
    customer: customer || "Walk-in Customer",
    amount: grossAmt,
    originalAmount: grossAmt,
    isEdited: false,
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
 * Header-aware table row parser for Excel (.xls, .xlsx) and structured tables.
 * Specifically maps:
 * - "Invoice No" or "Branch Inv No." -> Reference ID (invoiceNo)
 * - "Inv. Amount" -> Amount (amount)
 * - "Pay. Type" -> Payment Method (paymentMode)
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

    if (headerIdx !== -1 && (colMap.inv !== -1 || colMap.branchInv !== -1 || amountColIdx !== -1)) {
      const primaryInv = colMap.inv !== -1 ? cols[colMap.inv] || "" : "";
      const branchInv = colMap.branchInv !== -1 ? cols[colMap.branchInv] || "" : "";
      // Prefer whichever holds the 5-digit JCT invoice number, or fallback to primary/branch
      if (/^\d{5}$/.test(branchInv.trim())) {
        invoiceNo = branchInv.trim();
      } else if (/^\d{5}$/.test(primaryInv.trim())) {
        invoiceNo = primaryInv.trim();
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
      buildInvoiceItem(invoiceNo, customer, grossAmt, rawModeText, timeVal, cashCol, bankCol)
    );
  }

  return result;
};

/**
 * Dedicated JCT Sales Summary PDF Parser.
 * Handles pdf-parse raw text where columns merge or wrap across line breaks.
 *
 * Rules:
 * 1. Header Mapping:
 *    - "Invoice No" / "Branch Inv No." -> Reference ID (5-digit invoice number, e.g., 39915)
 *    - "Inv. Amount" -> Amount (e.g., 347.15)
 *    - "Pay. Type" -> Payment Method (Cash, Card, Bank, or Credit)
 * 2. Regex Extraction:
 *    - Scans normalized text for the JCT transaction row pattern:
 *      5-digit invoice number + Pay. Type (Cash | Card | Bank | Credit) + numeric amount
 * 3. Validation:
 *    - Ignores document summary headers/footers and extracts only the actual transaction rows.
 */
export const parseJctPdfTextToInvoices = (rawText: string): ParsedErpInvoiceItem[] => {
  if (!rawText || !rawText.trim()) return [];

  // 1. Strip page markers and isolate the transaction table body from document summary headers/footers
  let cleanedText = rawText
    .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "\n")
    .replace(/Page\s+\d+\s+of\s+\d+/gi, "\n");

  // If the table header ("Invoice No" / "Branch Inv No." / "Pay. Type" / "Inv. Amount") appears after
  // a top document summary block, slice from the first table header onward so summary numbers are ignored.
  const tableHeaderMatch = cleanedText.match(
    /(?:Invoice\s*No\.?|Branch\s*Inv\s*No\.?|Inv\.?\s*Amount|Pay\.?\s*Type)/i
  );
  if (tableHeaderMatch && tableHeaderMatch.index !== undefined) {
    cleanedText = cleanedText.slice(tableHeaderMatch.index);
  }

  // Remove repeated column header lines and explicit summary/total lines
  const filteredLines = cleanedText
    .split(/\r?\n/)
    .filter((line) => {
      const l = line.trim().toLowerCase();
      if (!l) return false;
      // Ignore table column header rows
      if (
        (l.includes("invoice no") || l.includes("branch inv")) &&
        (l.includes("pay. type") || l.includes("pay type") || l.includes("inv. amount") || l.includes("inv amount"))
      ) {
        return false;
      }
      // Ignore document summary headers and grand total footers that lack a 5-digit invoice number
      const has5DigitInv = /(?<!\d|[.,/])\d{5}(?!\d|[.,/])/.test(line);
      if (
        !has5DigitInv &&
        (l.includes("grand total") ||
          l.includes("sub total") ||
          l.includes("total :") ||
          l.includes("total:") ||
          l.includes("sales summary") ||
          l.includes("payment summary") ||
          l.includes("cash sales") ||
          l.includes("card sales") ||
          l.includes("credit sales") ||
          l.includes("bank transfer") ||
          l.includes("net amount") ||
          l.includes("p.o. box") ||
          l.includes("jubail 31951"))
      ) {
        return false;
      }
      return true;
    });

  // 2. Normalize merged columns caused by pdf-parse line breaks / missing spaces
  let normalized = filteredLines
    .join(" ")
    .replace(/\t+/g, " ")
    // Separate 2-decimal currency amounts merged directly into the next row's number (e.g. "347.1539916" -> "347.15 39916")
    .replace(/(\d+\.\d{2})(?=\d)/g, "$1 ")
    // Separate 5-digit invoice numbers merged directly into a date (e.g. "3991504/11/2026" -> "39915 04/11/2026")
    .replace(/(\b\d{5})(?=\d{2}[/-]\d{2}[/-]\d{2,4}|\d{4}[/-]\d{2}[/-]\d{2})/g, "$1 ")
    // Separate dates merged directly into a following number
    .replace(/(\d{2}[/-]\d{2}[/-]\d{2,4}|\d{4}[/-]\d{2}[/-]\d{2})(?=\d)/g, "$1 ")
    // Separate letters and digits that got glued together (e.g. "Cash347.15" -> "Cash 347.15", "39915Cash" -> "39915 Cash")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    // Separate customer text glued directly to Pay. Type keywords (e.g. "CUSTOMERCash 347.15" -> "CUSTOMER Cash 347.15")
    .replace(/([A-Za-z])(Cash|Card|Bank|Credit)(?=\s+[\d,]+(?:\.\d{1,2})?)/gi, "$1 $2 ")
    .replace(/\s+/g, " ")
    .trim();

  // Neutralize "CASH CUSTOMER" / "CASH SALE" in customer names so "CASH" inside a customer name
  // is never mistaken for the Pay. Type column
  normalized = normalized
    .replace(/\bJubail\s+31951\b/gi, "Jubail")
    .replace(/\bCASH\s+(CUSTOMER|CUST|SALE|SALES|A\/C|ACCOUNT|PARTY|CLIENT)\b/gi, "WALKIN_$1");

  // Check header order in rawText to know if Inv. Amount is the first or last amount column after Pay. Type
  const headerLine =
    rawText
      .split(/\r?\n/)
      .find(
        (l) =>
          /pay\.?\s*type/i.test(l) &&
          (/inv\.?\s*amount/i.test(l) || /amount/i.test(l))
      ) || "";
  const invAmtPos = headerLine.search(/inv\.?\s*amount/i);
  const grossPos = headerLine.search(/gross|sub\s*total|tax|vat|disc/i);
  const preferFirstAmount = invAmtPos !== -1 && grossPos !== -1 && invAmtPos < grossPos;

  // 3. Pattern A: 5-digit Invoice No / Branch Inv No. -> (optional Branch Inv No. / Date / Customer) -> Pay. Type (Cash|Card|Bank|Credit) -> numeric Inv. Amount(s)
  // Using a tempered token `(?:(?!\b\d{5}\b).)*?` ensures we never jump across another 5-digit invoice row.
  const patternA =
    /(?<!\d|[.,/])(\d{5})(?!\d|[.,/])(?:\s+(?<!\d|[.,/])(\d{5})(?!\d|[.,/]))?((?:(?!\b\d{5}\b).){0,220}?)\b(Cash|Card|Bank(?:\s*Transfer)?|Credit(?:\s*Sale)?)\b((?:(?!\b\d{5}\b|\b(?:Cash|Card|Bank|Credit)\b).){0,80}?)((?:\d{1,3}(?:,\d{3})*\.\d{1,2}|\d+\.\d{1,2})(?:\s+(?:\d{1,3}(?:,\d{3})*\.\d{1,2}|\d+\.\d{1,2}))*)/gi;

  // Pattern B (in case Inv. Amount precedes Pay. Type in the PDF column order):
  // 5-digit Invoice No -> (optional Date / Customer / cols) -> numeric Inv. Amount -> Pay. Type (Cash|Card|Bank|Credit)
  const patternB =
    /(?<!\d|[.,/])(\d{5})(?!\d|[.,/])(?:\s+(?<!\d|[.,/])(\d{5})(?!\d|[.,/]))?((?:(?!\b\d{5}\b).){0,220}?)((?:\d{1,3}(?:,\d{3})*\.\d{1,2}|\d+\.\d{1,2})(?:\s+(?:\d{1,3}(?:,\d{3})*\.\d{1,2}|\d+\.\d{1,2}))*)\s+\b(Cash|Card|Bank(?:\s*Transfer)?|Credit(?:\s*Sale)?)\b/gi;

  const extractWithPattern = (regex: RegExp, modeFirst: boolean): ParsedErpInvoiceItem[] => {
    const items: ParsedErpInvoiceItem[] = [];
    const seenInv = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = regex.exec(normalized)) !== null) {
      const inv1 = match[1];
      const inv2 = match[2];
      const middleText = ((match[3] || "") + " " + (modeFirst ? match[5] || "" : "")).trim();
      const rawPayType = modeFirst ? match[4] : match[5];
      const rawAmountsBlock = modeFirst ? match[6] : match[4];

      // Map Invoice No or Branch Inv No. to Reference ID
      const invoiceNo = (inv2 || inv1 || "").trim();
      if (!invoiceNo || invoiceNo === "31951") continue;

      // Reject if middleText contains summary/total keywords
      if (/\b(grand\s+total|sub\s+total|sales\s+summary|payment\s+summary|total\s+sales)\b/i.test(middleText)) {
        continue;
      }

      // Extract numeric amounts from the row's amount block
      const amountTokens = (rawAmountsBlock.match(/\d{1,3}(?:,\d{3})*\.\d{1,2}|\d+\.\d{1,2}/g) || [])
        .map((t) => cleanNum(t))
        .filter((n) => n > 0);

      if (amountTokens.length === 0) continue;

      const invAmount = preferFirstAmount
        ? amountTokens[0]
        : amountTokens[amountTokens.length - 1];

      if (invAmount <= 0) continue;

      // Avoid duplicate invoice rows if header/footer echoed a number
      if (seenInv.has(invoiceNo)) continue;
      seenInv.add(invoiceNo);

      // Clean customer name from middleText (strip dates, times, serial numbers, and currency symbols)
      const timeMatch = middleText.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/);
      const timeVal = timeMatch ? timeMatch[0] : nowHHMM();

      let customer = middleText
        .replace(/\bWALKIN_/g, "Cash ")
        .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, " ")
        .replace(/\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b/g, " ")
        .replace(/\b([01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\s*(?:AM|PM)?\b/gi, " ")
        .replace(/\b\d{1,3}(?:,\d{3})*\.\d{1,2}\b/g, " ")
        .replace(/\bSAR\b/gi, " ")
        .replace(/^[\d\s/|-]+/, "")
        .replace(/\s+/g, " ")
        .trim();

      if (!customer || customer.length < 2 || /^\d+$/.test(customer)) {
        customer = "Walk-in Customer";
      }

      items.push(buildInvoiceItem(invoiceNo, customer, invAmount, rawPayType, timeVal));
    }

    return items;
  };

  const resultsA = extractWithPattern(patternA, true);
  const resultsB = extractWithPattern(patternB, false);

  return resultsA.length >= resultsB.length ? resultsA : resultsB;
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

    if (fileName.endsWith(".pdf") || file.type === "application/pdf") {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        // 1. Primary: Extract raw text via pdf-parse and run the JCT regex row extractor
        const textResult = await parser.getText();
        const fullText = textResult?.text || "";
        if (fullText) {
          invoices = parseJctPdfTextToInvoices(fullText);
        }

        // 2. Fallback: If regex extraction found 0 rows, try vector table extraction
        if (invoices.length === 0) {
          try {
            const tableResult = await parser.getTable();
            if (tableResult?.pages) {
              const allTableRows: unknown[][] = [];
              for (const page of tableResult.pages) {
                if (Array.isArray(page.tables)) {
                  for (const tbl of page.tables) {
                    if (Array.isArray(tbl)) {
                      allTableRows.push(...tbl);
                    }
                  }
                }
              }
              if (allTableRows.length > 0) {
                invoices = parseTableRowsToInvoices(allTableRows);
              }
            }
          } catch {
            // Ignore vector table fallback errors
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
        const parsed = parseTableRowsToInvoices(rows);
        if (parsed.length > 0) {
          invoices.push(...parsed);
        }
      }
    }

    return NextResponse.json({ invoices });
  } catch (err) {
    console.error("Error parsing uploaded sales file:", err);
    return NextResponse.json(
      { error: "Failed to parse sales file", invoices: [] },
      { status: 500 }
    );
  }
}
