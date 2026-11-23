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
    const day = datePart(b.createdAt);

    // Only collapse by content signature when an explicit invoice/ref exists (or same clientTxnId)
    // Note: auto-generated `CP-xxxxxx` refs are unique per submission unless identical within same day+amount+supplier
    const sigKey =
      sup && inv
        ? `${branch}::${sup}::${inv}::${origAmt.toFixed(2)}::${day}`
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
