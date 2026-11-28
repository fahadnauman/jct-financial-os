export interface DeduplicatableSupplierBill {
  id: string;
  clientTxnId?: string | null;
  branch?: string | null;
  supplier?: string;
  supplierName?: string;
  invoiceNo?: string | null;
  supplierInvoiceNum?: string | null;
  amount: number;
  originalAmount?: number | null;
  remainingAmount?: number | null;
  isPaid?: boolean;
  paymentMode?: string | null;
  createdAt?: string | Date | null;
}

const normStr = (s?: string | null) =>
  (s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const normInv = (s?: string | null) =>
  (s || "")
    .trim()
    .replace(/^#/, "")
    .toUpperCase();

const datePart = (d?: string | Date | null): string => {
  if (!d) return "";
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
};

function billPriorityScore(b: DeduplicatableSupplierBill): number {
  let score = 0;
  // Prefer persisted DB cuid over optimistic `sb-...` id
  if (b.id && !String(b.id).startsWith("sb-")) score += 100;
  if (b.isPaid || b.paymentMode === "SETTLED") score += 50;
  if (b.clientTxnId) score += 10;
  return score;
}

export function deduplicateSupplierBillsWithRemoved<T extends DeduplicatableSupplierBill>(
  bills: T[]
): { unique: T[]; duplicateIds: string[] } {
  const byKey = new Map<string, T>();
  const duplicateIds: string[] = [];
  const seenIds = new Set<string>();
  const seenClientTxns = new Set<string>();

  for (const b of bills) {
    if (b.id && seenIds.has(b.id)) {
      continue;
    }
    if (b.clientTxnId && seenClientTxns.has(b.clientTxnId)) {
      if (b.id && !String(b.id).startsWith("sb-")) {
        duplicateIds.push(b.id);
      }
      continue;
    }

    const sup = normStr(b.supplierName || b.supplier);
    const inv = normInv(b.supplierInvoiceNum || b.invoiceNo);
    const origAmt = Number(b.originalAmount ?? b.amount) || 0;
    const branch = normStr(b.branch || "ALL");
    const createdMs = b.createdAt ? new Date(b.createdAt).getTime() : NaN;

    // Only collapse by content signature when an explicit invoice/ref exists AND created within 15 seconds
    // (Never merge two distinct legitimate purchases with the same description or amount!)
    const timeBucket = Number.isFinite(createdMs) ? Math.floor(createdMs / 15000) : datePart(b.createdAt);
    const sigKey =
      sup && inv
        ? `${branch}::${sup}::${inv}::${origAmt.toFixed(2)}::${timeBucket}`
        : `id::${b.id}`;

    const existing = byKey.get(sigKey);
    if (!existing) {
      byKey.set(sigKey, b);
      if (b.id) seenIds.add(b.id);
      if (b.clientTxnId) seenClientTxns.add(b.clientTxnId);
    } else {
      const existingScore = billPriorityScore(existing);
      const currentScore = billPriorityScore(b);
      if (currentScore > existingScore) {
        if (existing.id && !String(existing.id).startsWith("sb-")) {
          duplicateIds.push(existing.id);
        }
        byKey.set(sigKey, b);
      } else {
        if (b.id && !String(b.id).startsWith("sb-")) {
          duplicateIds.push(b.id);
        }
      }
    }
  }

  return { unique: Array.from(byKey.values()), duplicateIds };
}

export function deduplicateSupplierBills<T extends DeduplicatableSupplierBill>(bills: T[]): T[] {
  return deduplicateSupplierBillsWithRemoved(bills).unique;
}

export function deduplicateByIdOrClientTxnId<
  T extends { id?: string; internalId?: string; clientTxnId?: string | null }
>(items: T[]): T[] {
  const seenIds = new Set<string>();
  const seenClientTxns = new Set<string>();
  const out: T[] = [];

  for (const item of items) {
    const itemId = item.internalId || item.id;
    if (item.clientTxnId) {
      if (seenClientTxns.has(item.clientTxnId)) continue;
      seenClientTxns.add(item.clientTxnId);
    }
    if (itemId) {
      if (seenIds.has(itemId)) continue;
      seenIds.add(itemId);
    }
    out.push(item);
  }

  return out;
}

export interface DeduplicatableInvoice {
  id?: string;
  internalId?: string;
  clientTxnId?: string | null;
  sourcePocketId?: string | null;
  invoiceNo?: string;
  branchInvNo?: string;
  amount: number;
  paymentMode?: string;
  posTerminal?: string;
  posTerminalDevice?: string;
  terminal?: string;
  isManual?: boolean;
  isManualPos?: boolean;
}

export function deduplicateInvoices<T extends DeduplicatableInvoice>(invoices: T[]): T[] {
  const seenIds = new Set<string>();
  const seenClientTxns = new Set<string>();
  const seenPocketIds = new Set<string>();
  const seenErpSigs = new Set<string>();
  const out: T[] = [];

  for (const inv of invoices) {
    if (!inv || typeof inv !== "object") continue;
    if (inv.clientTxnId) {
      if (seenClientTxns.has(inv.clientTxnId)) continue;
      seenClientTxns.add(inv.clientTxnId);
    }
    if (inv.sourcePocketId) {
      if (seenPocketIds.has(inv.sourcePocketId)) continue;
      seenPocketIds.add(inv.sourcePocketId);
    }
    const primaryId = inv.internalId || inv.id;
    if (primaryId) {
      if (seenIds.has(primaryId)) continue;
      seenIds.add(primaryId);
    }

    const invNo = normInv(inv.branchInvNo || inv.invoiceNo);
    const isManual = Boolean(inv.isManual || inv.isManualPos);
    if (!isManual && invNo) {
      const amt = (Number(inv.amount) || 0).toFixed(2);
      const mode = (inv.paymentMode || "").trim().toUpperCase();
      const bank = (inv.posTerminalDevice || inv.terminal || inv.posTerminal || "").trim().toUpperCase();
      const sig = `${invNo}::${amt}::${mode}::${bank}`;
      if (seenErpSigs.has(sig)) continue;
      seenErpSigs.add(sig);
    }

    out.push(inv);
  }

  return out;
}

export function filterRedundantBankInvoices<
  B extends { id?: string; clientTxnId?: string | null; invoiceNo?: string; amount?: number },
  I extends DeduplicatableInvoice
>(bankInvoices: B[], erpInvoices: I[]): B[] {
  const erpIds = new Set<string>();
  const erpClients = new Set<string>();
  const erpInvAmts = new Set<string>();

  for (const inv of erpInvoices) {
    if (inv.id) erpIds.add(inv.id);
    if (inv.internalId) erpIds.add(inv.internalId);
    if (inv.clientTxnId) erpClients.add(inv.clientTxnId);
    const invNo = normInv(inv.branchInvNo || inv.invoiceNo);
    if (invNo) {
      erpInvAmts.add(`${invNo}::${(Number(inv.amount) || 0).toFixed(2)}`);
    }
  }

  return bankInvoices.filter((b) => {
    if (b.clientTxnId && erpClients.has(b.clientTxnId)) return false;
    if (b.id && erpIds.has(b.id)) return false;
    const bInv = normInv(b.invoiceNo);
    if (bInv && b.amount !== undefined && erpInvAmts.has(`${bInv}::${(Number(b.amount) || 0).toFixed(2)}`)) {
      return false;
    }
    return true;
  });
}
