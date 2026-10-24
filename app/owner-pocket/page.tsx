"use client";

import { useState, useSyncExternalStore } from "react";
import {
  POCKET_BRANCHES,
  POCKET_CUSTOMERS_KEY,
  postPocketTransaction,
  todayIso,
  usePocketTransactions,
  type BranchId,
  type NewPocketTransaction,
  type PocketTransaction,
  type PocketType,
} from "../../lib/pocket-bridge";

/** Client-side convenience PIN (NOT real security). Override with NEXT_PUBLIC_OWNER_PIN. */
const OWNER_PIN = process.env.NEXT_PUBLIC_OWNER_PIN || "1234";

const EXPENSE_CATEGORIES = ["Fuel / Vehicle", "Shop Maintenance", "Food & Refreshments", "Freight", "Misc"];
const ADVANCE_PURPOSES = ["Salary Advance", "Daily Lunch / Travel Allowance", "Shop Runner Float"];
const FALLBACK_CUSTOMERS = ["Al-Hamad Contracting", "Gulf Coast Painters", "Eastern Province Builders"];

const subscribeStorage = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function Pills<T extends string>({
  options,
  value,
  onChange,
  render,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  render?: (v: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
            value === o
              ? "border-[#FFD200] bg-[#FFD200] text-black"
              : "border-white/10 bg-[#061416] text-slate-300"
          }`}
        >
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-[#00BAC7]/25 bg-[#061416] px-4 py-3 text-base text-white outline-none placeholder:text-slate-500 focus:border-[#00BAC7]";
const labelCls = "mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400";

function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const press = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError(false);
    if (next.length === 4) {
      if (next === OWNER_PIN) onUnlock();
      else {
        setError(true);
        setTimeout(() => setPin(""), 350);
      }
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center bg-[#040D0E] p-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFD200] to-[#FACC15] text-xl font-black text-black shadow-[0_0_25px_rgba(255,210,0,0.35)]">
        JCT
      </div>
      <h1 className="mt-5 text-2xl font-extrabold text-white">👑 BONGSI Pocket</h1>
      <p className="mt-1 text-sm text-slate-400">Enter Owner PIN · Nazim &amp; Nadeem</p>
      <div className="mt-6 flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full border ${
              error ? "border-rose-400 bg-rose-400" : i < pin.length ? "border-[#00BAC7] bg-[#00BAC7]" : "border-white/30"
            }`}
          />
        ))}
      </div>
      {error && <p className="mt-3 text-xs font-bold text-rose-400">Incorrect PIN</p>}
      <div className="mt-8 grid w-full max-w-[260px] grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) =>
          k === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => (k === "⌫" ? setPin(pin.slice(0, -1)) : press(k))}
              className="h-16 rounded-2xl border border-[#00BAC7]/20 bg-[#0B1E21] text-2xl font-bold text-white active:bg-[#00BAC7]/20"
            >
              {k}
            </button>
          )
        )}
      </div>
    </div>
  );
}

function BranchPicker({ value, onChange }: { value: BranchId; onChange: (b: BranchId) => void }) {
  return (
    <Pills
      options={POCKET_BRANCHES.map((b) => b.id)}
      value={value}
      onChange={onChange}
      render={(id) => POCKET_BRANCHES.find((b) => b.id === id)?.short ?? id}
    />
  );
}

export default function OwnerPocketPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [branch, setBranch] = useState<BranchId>("JCT_HQ");
  const [action, setAction] = useState<PocketType | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Expense form
  const [eBranch, setEBranch] = useState<BranchId>("JCT_HQ");
  const [eAmount, setEAmount] = useState("");
  const [eCat, setECat] = useState(EXPENSE_CATEGORIES[0]);
  const [eSource, setESource] = useState<"DRAWER" | "POCKET">("DRAWER");
  const [eNote, setENote] = useState("");

  // Advance form
  const [aBranch, setABranch] = useState<BranchId>("JCT_HQ");
  const [aName, setAName] = useState("");
  const [aAmount, setAAmount] = useState("");
  const [aPurpose, setAPurpose] = useState(ADVANCE_PURPOSES[0]);

  // Collection form
  const [cBranch, setCBranch] = useState<BranchId>("JCT_HQ");
  const [cName, setCName] = useState("");
  const [cRef, setCRef] = useState("");
  const [cAmount, setCAmount] = useState("");
  const [cTender, setCTender] = useState<"CASH_TO_OWNER" | "BANK_TRANSFER">("CASH_TO_OWNER");

  const [saving, setSaving] = useState(false);

  const customersRaw = useSyncExternalStore(
    subscribeStorage,
    () => window.localStorage.getItem(POCKET_CUSTOMERS_KEY) ?? "",
    () => ""
  );

  // Live feed straight from Neon (all branches, today), polled every few seconds
  const { transactions, refresh } = usePocketTransactions("ALL", unlocked);
  const recent = transactions.slice(-5).reverse();

  let customerNames: string[] = FALLBACK_CUSTOMERS;
  try {
    const parsed = JSON.parse(customersRaw || "[]");
    if (Array.isArray(parsed) && parsed.length) customerNames = parsed as string[];
  } catch {
    /* fallback */
  }
  const customerMatches = cName.trim().length >= 2
    ? customerNames.filter((n) => n.toLowerCase().includes(cName.trim().toLowerCase())).slice(0, 4)
    : [];

  const branchFull = (id: BranchId) => POCKET_BRANCHES.find((b) => b.id === id)?.full ?? id;
  const branchShort = (id: BranchId) => POCKET_BRANCHES.find((b) => b.id === id)?.short ?? id;

  const finish = async (tx: NewPocketTransaction, msg: string): Promise<boolean> => {
    setSaving(true);
    try {
      await postPocketTransaction(tx);
      setToast(msg);
      setAction(null);
      refresh();
      setTimeout(() => setToast(null), 3500);
      return true;
    } catch {
      setToast("Could not reach the database. Nothing was saved, please retry.");
      setTimeout(() => setToast(null), 4500);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveExpense = async () => {
    const amount = parseFloat(eAmount);
    if (!(amount > 0) || saving) return;
    const ok = await finish(
      {
        branch: eBranch,
        type: "EXPENSE",
        amount,
        category: eCat,
        recipientName: null,
        paymentSource: eSource === "POCKET" ? "OWNER_POCKET" : "DRAWER_CASH",
        note: eNote.trim() || null,
        date: todayIso(),
      },
      `Expense SAR ${fmt(amount)} saved · ${branchShort(eBranch)}`
    );
    if (ok) {
      setEAmount("");
      setENote("");
    }
  };

  const saveAdvance = async () => {
    const amount = parseFloat(aAmount);
    if (!(amount > 0) || !aName.trim() || saving) return;
    const ok = await finish(
      {
        branch: aBranch,
        type: "ADVANCE",
        amount,
        category: aPurpose,
        recipientName: aName.trim(),
        paymentSource: "DRAWER_CASH",
        note: null,
        date: todayIso(),
      },
      `Advance SAR ${fmt(amount)} to ${aName.trim()} saved`
    );
    if (ok) {
      setAAmount("");
      setAName("");
    }
  };

  const saveCollection = async () => {
    const amount = parseFloat(cAmount);
    if (!(amount > 0) || !cName.trim() || saving) return;
    const ok = await finish(
      {
        branch: cBranch,
        type: "CREDIT_COLLECTION",
        amount,
        category: cRef.trim() || null,
        recipientName: cName.trim(),
        paymentSource: cTender === "CASH_TO_OWNER" ? "DRAWER_CASH" : "BANK_TRANSFER",
        note: cTender === "CASH_TO_OWNER" ? "Cash Handed to Owner" : "Bank Transfer to SAB / Rajhi",
        date: todayIso(),
      },
      `Collected SAR ${fmt(amount)} from ${cName.trim()}`
    );
    if (ok) {
      setCAmount("");
      setCName("");
      setCRef("");
    }
  };

  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />;

  const statusFor = (e: PocketTransaction) => {
    if (e.type === "EXPENSE" && e.paymentSource === "OWNER_POCKET") return "Recorded · Owner pocket";
    if (e.type === "CREDIT_COLLECTION" && e.paymentSource === "BANK_TRANSFER") return "Synced to Credit Radar";
    if (e.branch !== "JCT_HQ") return "Saved · Branch register";
    return "Synced to Branch Drawer";
  };

  const kindLabel = (k: PocketType) =>
    k === "EXPENSE" ? "💸 Expense" : k === "ADVANCE" ? "🤝 Advance" : "💵 Collection";

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-between bg-[#040D0E] p-4 text-white">
      <div className="space-y-4">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-extrabold">👑 BONGSI Pocket</h1>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Live Sync Active
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#FFD200] to-[#FACC15] text-xs font-black text-black">
            JCT
          </div>
        </header>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {POCKET_BRANCHES.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                setBranch(b.id);
                setEBranch(b.id);
                setABranch(b.id);
                setCBranch(b.id);
              }}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold ${
                branch === b.id
                  ? "border-[#00BAC7] bg-[#00BAC7]/20 text-[#22D3EE]"
                  : "border-white/10 bg-[#0B1E21] text-slate-400"
              }`}
            >
              {b.full}
            </button>
          ))}
        </div>

        {toast && (
          <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">
            ✅ {toast}
          </div>
        )}

        {/* Action cards */}
        {action === null && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setAction("EXPENSE")}
              className="w-full rounded-2xl bg-[#FFD200] p-5 text-left text-black shadow-[0_0_20px_rgba(255,210,0,0.25)] active:scale-[0.98]"
            >
              <span className="block text-xl font-extrabold">💸 Quick Shop / Road Expense</span>
              <span className="text-xs font-semibold opacity-70">Fuel, maintenance, food, freight</span>
            </button>
            <button
              type="button"
              onClick={() => setAction("ADVANCE")}
              className="w-full rounded-2xl bg-[#00BAC7] p-5 text-left text-black shadow-[0_0_20px_rgba(0,186,199,0.25)] active:scale-[0.98]"
            >
              <span className="block text-xl font-extrabold">🤝 Staff Cash Advance</span>
              <span className="text-xs font-semibold opacity-70">Salary advance, allowance, runner float</span>
            </button>
            <button
              type="button"
              onClick={() => setAction("CREDIT_COLLECTION")}
              className="w-full rounded-2xl bg-emerald-400 p-5 text-left text-black shadow-[0_0_20px_rgba(52,211,153,0.25)] active:scale-[0.98]"
            >
              <span className="block text-xl font-extrabold">💵 Roadside Credit Collection</span>
              <span className="text-xs font-semibold opacity-70">Collect from a customer or contractor</span>
            </button>
          </div>
        )}

        {/* Expense form */}
        {action === "EXPENSE" && (
          <section className="space-y-4 rounded-2xl border border-[#FFD200]/30 bg-[#081517] p-4">
            <h2 className="text-lg font-extrabold text-[#FFD200]">💸 Quick Shop / Road Expense</h2>
            <div>
              <span className={labelCls}>Target Branch</span>
              <BranchPicker value={eBranch} onChange={setEBranch} />
            </div>
            <div>
              <label className={labelCls}>Amount (SAR)</label>
              <input
                inputMode="decimal"
                value={eAmount}
                onChange={(e) => setEAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                className={`${inputCls} text-3xl font-black`}
              />
            </div>
            <div>
              <span className={labelCls}>Category</span>
              <Pills options={EXPENSE_CATEGORIES} value={eCat} onChange={setECat} />
            </div>
            <div>
              <span className={labelCls}>Payment Source</span>
              <Pills
                options={["DRAWER", "POCKET"] as const}
                value={eSource}
                onChange={setESource}
                render={(v) => (v === "DRAWER" ? "Paid from Branch Drawer Cash" : "Paid from Owner Personal Pocket")}
              />
              {eSource === "POCKET" && (
                <p className="mt-2 text-[11px] text-amber-300/80">
                  Owner-pocket expenses are recorded but not deducted from the branch drawer.
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>Note</label>
              <input value={eNote} onChange={(e) => setENote(e.target.value)} placeholder="Short remark" className={inputCls} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAction(null)} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-300">
                Cancel
              </button>
              <button type="button" onClick={saveExpense} disabled={!(parseFloat(eAmount) > 0)} className="flex-1 rounded-xl bg-[#FFD200] py-3 font-extrabold text-black disabled:opacity-40">
                Save Expense
              </button>
            </div>
          </section>
        )}

        {/* Advance form */}
        {action === "ADVANCE" && (
          <section className="space-y-4 rounded-2xl border border-[#00BAC7]/30 bg-[#081517] p-4">
            <h2 className="text-lg font-extrabold text-[#22D3EE]">🤝 Staff Cash Advance</h2>
            <div>
              <span className={labelCls}>Target Branch</span>
              <BranchPicker value={aBranch} onChange={setABranch} />
            </div>
            <div>
              <label className={labelCls}>Staff / Recipient Name</label>
              <input value={aName} onChange={(e) => setAName(e.target.value)} placeholder="Cashier, Delivery Driver, Tinting Tech…" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Amount (SAR)</label>
              <input
                inputMode="decimal"
                value={aAmount}
                onChange={(e) => setAAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                className={`${inputCls} text-3xl font-black`}
              />
            </div>
            <div>
              <span className={labelCls}>Purpose</span>
              <Pills options={ADVANCE_PURPOSES} value={aPurpose} onChange={setAPurpose} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAction(null)} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-300">
                Cancel
              </button>
              <button type="button" onClick={saveAdvance} disabled={!(parseFloat(aAmount) > 0) || !aName.trim()} className="flex-1 rounded-xl bg-[#00BAC7] py-3 font-extrabold text-black disabled:opacity-40">
                Save Advance
              </button>
            </div>
          </section>
        )}

        {/* Collection form */}
        {action === "CREDIT_COLLECTION" && (
          <section className="space-y-4 rounded-2xl border border-emerald-400/30 bg-[#081517] p-4">
            <h2 className="text-lg font-extrabold text-emerald-300">💵 Roadside Credit Collection</h2>
            <div>
              <span className={labelCls}>Target Branch</span>
              <BranchPicker value={cBranch} onChange={setCBranch} />
            </div>
            <div>
              <label className={labelCls}>Customer / Contractor</label>
              <input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Start typing to look up…" className={inputCls} />
              {customerMatches.length > 0 && !customerNames.includes(cName) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {customerMatches.map((n) => (
                    <button key={n} type="button" onClick={() => setCName(n)} className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>Invoice # / Reference (optional)</label>
              <input value={cRef} onChange={(e) => setCRef(e.target.value)} placeholder="#30064" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Amount Collected (SAR)</label>
              <input
                inputMode="decimal"
                value={cAmount}
                onChange={(e) => setCAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                className={`${inputCls} text-3xl font-black`}
              />
            </div>
            <div>
              <span className={labelCls}>Payment Tender</span>
              <Pills
                options={["CASH_TO_OWNER", "BANK_TRANSFER"] as const}
                value={cTender}
                onChange={setCTender}
                render={(v) => (v === "CASH_TO_OWNER" ? "Cash Handed to Owner" : "Bank Transfer to SAB / Rajhi")}
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAction(null)} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-300">
                Cancel
              </button>
              <button type="button" onClick={saveCollection} disabled={!(parseFloat(cAmount) > 0) || !cName.trim()} className="flex-1 rounded-xl bg-emerald-400 py-3 font-extrabold text-black disabled:opacity-40">
                Save Collection
              </button>
            </div>
          </section>
        )}
      </div>

      {/* Activity feed */}
      <section className="mt-6 space-y-2 pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#00BAC7]/80">Recent Mobile Activity</h3>
        {recent.length === 0 ? (
          <p className="rounded-xl border border-white/5 bg-[#061416] p-3 text-xs text-slate-500">
            Nothing logged today yet.
          </p>
        ) : (
          recent.map((e) => (
            <div key={e.id} className="rounded-xl border border-white/5 bg-[#061416] p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold">
                  {kindLabel(e.type)} · SAR {fmt(e.amount)}
                </span>
                <span className="text-[11px] text-slate-500">{hhmm(e.createdAt)}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                <span className="rounded-full border border-[#00BAC7]/30 bg-[#00BAC7]/10 px-2 py-0.5 text-[#22D3EE]">
                  {branchFull(e.branch)}
                </span>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                  {statusFor(e)}
                </span>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
