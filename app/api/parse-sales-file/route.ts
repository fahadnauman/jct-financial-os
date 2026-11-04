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

const detectPaymentAndTerminal = (rawText: string): {
  mode: InvoicePaymentMode;
  isSplit: boolean;
  terminal: PosTerminalBank;
  splitBankMethod: "BANK_TRANSFER" | "POS_SWIPE";
} => {
  const upper = rawText.toUpperCase();
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
    upper.includes("CASH/CARD") ||
    upper.includes("CASH +");

  if (isSplit) {
    return {
      mode: "SPLIT",
      isSplit: true,
      terminal,
      splitBankMethod: upper.includes("TRANSFER") ? "BANK_TRANSFER" : "POS_SWIPE",
    };
  }

  const mode: InvoicePaymentMode = upper.includes("TRANSFER") || upper.includes("BANK_TRANSFER") || upper.includes("IBAN")
    ? "BANK_TRANSFER"
    : upper.includes("CARD") ||
      upper.includes("SWIPE") ||
      upper.includes("POS") ||
      upper.includes("MADA") ||
      upper.includes("VISA") ||
      upper.includes("MASTER")
    ? "POS_SWIPE"
    : upper.includes("CREDIT")
    ? "CREDIT_SALE"
    : "CASH";

  return {
    mode,
    isSplit: false,
    terminal,
    splitBankMethod: mode === "BANK_TRANSFER" ? "BANK_TRANSFER" : "POS_SWIPE",
  };
};

const parseTableRowsToInvoices = (rows: unknown[][]): ParsedErpInvoiceItem[] => {
  const result: ParsedErpInvoiceItem[] = [];
  if (!Array.isArray(rows) || rows.length === 0) return result;

  // Locate header row if present
  let headerIdx = -1;
  const colMap = {
    inv: -1,
    customer: -1,
    amount: -1,
    mode: -1,
    cash: -1,
    bank: -1,
    terminal: -1,
    time: -1,
  };

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = (rows[i] || []).map((c) => String(c ?? "").trim().toLowerCase());
    const hasInvHeader = r.some(
      (c) =>
        c.includes("invoice") ||
        c.includes("inv") ||
        c.includes("reference") ||
        c.includes("ref") ||
        c === "id" ||
        c.includes("bill") ||
        c.includes("receipt")
    );
    const hasAmtHeader = r.some(
      (c) =>
        c.includes("amount") ||
        c.includes("amt") ||
        c.includes("total") ||
        c.includes("gross") ||
        c.includes("sar") ||
        c.includes("value") ||
        c.includes("price")
    );
    if (hasInvHeader || hasAmtHeader) {
      headerIdx = i;
      r.forEach((cell, idx) => {
        if (colMap.time === -1 && (cell === "time" || cell.includes("time") || cell === "date")) {
          colMap.time = idx;
        } else if (
          colMap.inv === -1 &&
          (cell.includes("invoice") ||
            cell.includes("inv") ||
            cell.includes("reference") ||
            cell.includes("ref") ||
            cell === "id" ||
            cell.includes("receipt") ||
            cell.includes("bill"))
        ) {
          colMap.inv = idx;
        } else if (
          colMap.customer === -1 &&
          (cell.includes("customer") ||
            cell.includes("client") ||
            cell.includes("description") ||
            cell.includes("name") ||
            cell.includes("party"))
        ) {
          colMap.customer = idx;
        } else if (
          colMap.mode === -1 &&
          (cell.includes("payment") ||
            cell.includes("method") ||
            cell.includes("mode") ||
            cell.includes("tender") ||
            cell.includes("type"))
        ) {
          colMap.mode = idx;
        } else if (
          colMap.amount === -1 &&
          (cell.includes("amount") ||
            cell.includes("amt") ||
            cell.includes("total") ||
            cell.includes("gross") ||
            cell.includes("value") ||
            cell.includes("sar"))
        ) {
          colMap.amount = idx;
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

    if (headerIdx !== -1 && (colMap.inv !== -1 || colMap.amount !== -1)) {
      if (colMap.inv !== -1) invoiceNo = cols[colMap.inv] || "";
      if (colMap.customer !== -1) customer = cols[colMap.customer] || "Walk-in Customer";
      if (colMap.amount !== -1) grossAmt = cleanNum(cols[colMap.amount]);
      if (colMap.mode !== -1) rawModeText = cols[colMap.mode] || "";
      if (colMap.cash !== -1) cashCol = cleanNum(cols[colMap.cash]);
      if (colMap.bank !== -1) bankCol = cleanNum(cols[colMap.bank]);
      if (colMap.terminal !== -1) rawModeText += " " + (cols[colMap.terminal] || "");
      if (colMap.time !== -1 && cols[colMap.time]) timeVal = cols[colMap.time];
    } else {
      // Positional fallback: support [InvNo, Customer, Amount, Mode, Cash, Bank, Terminal]
      // or [InvNo, Amount, Mode]
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
          rawModeText = cols[2] || "CASH";
          customer = cols[3] || "Walk-in Customer";
        }
      } else if (cols.length === 2) {
        invoiceNo = cols[0];
        grossAmt = cleanNum(cols[1]);
        rawModeText = "CASH";
      }
    }

    invoiceNo = invoiceNo.replace(/^#/i, "").replace(/^inv[-_\s#]*/i, "").trim();
    if (!invoiceNo && grossAmt > 0) {
      invoiceNo = String(30000 + result.length + 1);
    }
    if (!invoiceNo || invoiceNo === "--" || grossAmt <= 0) continue;

    const { mode, isSplit, terminal, splitBankMethod } = detectPaymentAndTerminal(rawModeText);
    const hasDualTenderValues = cashCol > 0 && bankCol > 0;
    const finalIsSplit = isSplit || hasDualTenderValues;

    if (finalIsSplit) {
      const cashShare = cashCol > 0 ? cashCol : r2(grossAmt / 2);
      const bankShare = bankCol > 0 ? bankCol : Math.max(0, r2(grossAmt - cashShare));
      result.push({
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
      });
    } else {
      result.push({
        invoiceNo,
        customer: customer || "Walk-in Customer",
        amount: grossAmt,
        originalAmount: grossAmt,
        isEdited: false,
        paymentMode: mode,
        posTerminal: terminal,
        isSplit: false,
        splitCashAmount: mode === "CASH" ? grossAmt : r2(grossAmt / 2),
        splitBankAmount: mode === "BANK_TRANSFER" || mode === "POS_SWIPE" ? grossAmt : r2(grossAmt / 2),
        splitBankMethod,
        splitPosTerminal: terminal,
        autoMatched: mode !== "CASH",
        time: timeVal,
      });
    }
  }

  return result;
};

const parsePdfTextToInvoices = (text: string): ParsedErpInvoiceItem[] => {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const result: ParsedErpInvoiceItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Skip headers, footers, and summary totals
    if (
      lower.includes("jubail colour town") ||
      lower.includes("official daily sales") ||
      lower.includes("opening cash") ||
      lower.includes("total sales") ||
      lower.includes("total inflows") ||
      lower.includes("total expenses") ||
      lower.includes("closing drawer") ||
      lower.includes("total records") ||
      lower.includes("reference id") ||
      lower.includes("customer / description") ||
      lower.includes("no sales or register entries") ||
      lower.startsWith("branch:") ||
      lower.startsWith("date:") ||
      lower.startsWith("page ")
    ) {
      continue;
    }

    // If line is comma-separated or tab-separated with 3+ parts, delegate to table row parser
    if (line.includes("\t") || (line.split(",").length >= 3 && !/SAR\s+\d+,\d+/i.test(line))) {
      const delimiter = line.includes("\t") ? "\t" : ",";
      const rowParsed = parseTableRowsToInvoices([[...line.split(delimiter)]]);
      if (rowParsed.length > 0) {
        result.push(...rowParsed);
        continue;
      }
    }

    // Extract time if present (e.g. 14:20)
    const timeMatch = line.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/);
    const timeVal = timeMatch ? timeMatch[0] : nowHHMM();

    // Extract invoice / reference ID (e.g. #30062, INV-102, or 4-8 digit invoice number)
    const hashInvMatch = line.match(/#([A-Za-z0-9_-]{2,15})/);
    const invPrefixMatch = line.match(/\bINV[-_#]?([A-Za-z0-9_-]{2,15})\b/i);
    const standaloneInvMatch = line
      .replace(/\b([01]?\d|2[0-3]):[0-5]\d\b/g, "")
      .match(/\b([1-9]\d{3,7})\b/);

    const invoiceNo =
      hashInvMatch?.[1] ||
      invPrefixMatch?.[1] ||
      standaloneInvMatch?.[1] ||
      "";

    // Extract monetary amounts (e.g. SAR 1,250.00 or 1250.00)
    const sarMatch = line.match(/SAR\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i);
    const decimalMatches = Array.from(
      line.matchAll(/\b([0-9]{1,3}(?:,[0-9]{3})+\.[0-9]{2}|[0-9]+\.[0-9]{2})\b/g)
    ).map((m) => cleanNum(m[1]));

    let grossAmt = sarMatch ? cleanNum(sarMatch[1]) : 0;
    if (grossAmt <= 0 && decimalMatches.length > 0) {
      grossAmt = decimalMatches[decimalMatches.length - 1];
    }

    if (!invoiceNo || grossAmt <= 0) continue;

    const { mode, isSplit, terminal, splitBankMethod } = detectPaymentAndTerminal(line);

    // Derive customer / description by stripping time, invoiceNo, amount, and payment tokens
    let customer = line
      .replace(timeMatch?.[0] || "", "")
      .replace(`#${invoiceNo}`, "")
      .replace(invoiceNo, "")
      .replace(/SAR\s*[0-9,]+(\.[0-9]{1,2})?/gi, "")
      .replace(/\b[0-9,]+\.[0-9]{2}\b/g, "")
      .replace(/\b(Sale Invoice|POS_SWIPE|BANK_TRANSFER|CREDIT_SALE|SPLIT|CASH|CARD|SWIPE|MADA|VISA|SAB|AL_RAJHI|SNB)\b/gi, "")
      .replace(/[()|-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!customer || customer.length < 2) {
      customer = "Imported Invoice";
    }

    result.push({
      invoiceNo,
      customer,
      amount: grossAmt,
      originalAmount: grossAmt,
      isEdited: false,
      paymentMode: isSplit ? "SPLIT" : mode,
      posTerminal: terminal,
      isSplit,
      splitCashAmount: isSplit ? r2(grossAmt / 2) : mode === "CASH" ? grossAmt : r2(grossAmt / 2),
      splitBankAmount:
        isSplit
          ? r2(grossAmt - r2(grossAmt / 2))
          : mode === "BANK_TRANSFER" || mode === "POS_SWIPE"
          ? grossAmt
          : r2(grossAmt / 2),
      splitBankMethod,
      splitPosTerminal: terminal,
      autoMatched: isSplit || mode !== "CASH",
      time: timeVal,
    });
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

    if (fileName.endsWith(".pdf") || file.type === "application/pdf") {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        // 1. Try structured PDF table extraction first
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
          // Fallback to text extraction below
        }

        // 2. Fallback to full PDF text extraction if table extraction yielded 0 rows
        if (invoices.length === 0) {
          const textResult = await parser.getText();
          const fullText = textResult?.text || "";
          if (fullText) {
            invoices = parsePdfTextToInvoices(fullText);
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
