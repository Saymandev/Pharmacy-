"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { useLanguage } from "@/lib/i18n/language-provider";

type Account = { id: string; name: string; type: string };
type Branch = { id: string; name: string };
type Invoice = { id: string; invoiceNumber: string; branchId: string; dueAmount: number; status: string };
type Event = { id: string; kind: string; amount: string; balanceAfter: string; createdAt: string; note?: string; paymentMethod?: string; branch: Branch; account?: Account; sale?: { invoiceNumber: string }; transaction?: { txnId: string } };
type Ledger = { events: Event[]; currentAdvance: string; pagination: { total: number; totalPages: number }; scope: { historicalCoverage: string; balanceScope: string } };
const errorMessage = (cause: unknown) => cause instanceof Error ? cause.message : "Request failed. Try again.";

export function CustomerAdvancePanel({ customerId, branches, accounts, invoices, canManage, onChange }: { customerId: string; branches: Branch[]; accounts: Account[]; invoices: Invoice[]; canManage: boolean; onChange: () => void }) {
  const { t, language } = useLanguage();
  const [branchId, setBranchId] = useState(""), [filterBranch, setFilterBranch] = useState(""), [start, setStart] = useState(""), [end, setEnd] = useState("");
  const [page, setPage] = useState(1), [ledger, setLedger] = useState<Ledger | null>(null), [loading, setLoading] = useState(false), [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<"received" | "applied" | "refunded">("received"), [amount, setAmount] = useState(""), [accountId, setAccountId] = useState(""), [saleId, setSaleId] = useState(""), [method, setMethod] = useState("cash"), [note, setNote] = useState("");
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const lock = useRef(false), keys = useRef(new Map<string, string>());
  const money = (value: unknown) => new Intl.NumberFormat(language === "bn" ? "bn-BD" : "en-BD", { style: "currency", currency: "BDT" }).format(Number(value) || 0);
  useEffect(() => { setBranchId(branches[0]?.id || ""); setFilterBranch(""); setPage(1); }, [branches]);
  useEffect(() => { setAccountId(accounts[0]?.id || ""); setMethod(accounts[0]?.type === "cash" ? "cash" : accounts[0]?.type === "mfs" ? "bKash" : "Bank Transfer"); }, [accounts]);
  const load = useCallback(async () => {
    const query = new URLSearchParams({ page: String(page), limit: "25" });
    if (filterBranch) query.set("branchId", filterBranch);
    if (start) query.set("startDate", start);
    if (end) query.set("endDate", end);
    setLoading(true);
    try { setLedger(await api.get<Ledger>(`/customers/${customerId}/ledger?${query}`)); setError(""); }
    catch (cause) { setError(errorMessage(cause)); setLedger(null); }
    finally { setLoading(false); }
  }, [customerId, filterBranch, start, end, page]);
  useEffect(() => { void load(); }, [load]);
  async function submit() {
    if (lock.current || !canManage) return;
    if (!branchId || !/^\d+(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) { setError("Choose a branch and enter a positive amount with at most two decimal places."); return; }
    const numericAmount = Number(amount);
    if (kind !== "received" && numericAmount > Number(ledger?.currentAdvance ?? 0)) { setError("Amount exceeds available customer advance."); return; }
    const invoice = invoices.find(row => row.id === saleId);
    if (kind === "applied" && (!invoice || invoice.branchId !== branchId || invoice.status !== "completed" || numericAmount > Number(invoice.dueAmount))) { setError("Select a completed invoice in this branch with enough outstanding due."); return; }
    if (kind !== "applied" && !accountId) { setError("Select a financial account."); return; }
    const body = kind === "applied" ? { branchId, saleId, amount: numericAmount, note: note.trim() || undefined } : { branchId, accountId, amount: numericAmount, paymentMethod: method, note: note.trim() || undefined };
    const path = kind === "received" ? "advances" : kind === "applied" ? "advance-allocations" : "advance-refunds";
    const fingerprint = `${kind}:${customerId}:${JSON.stringify(body)}`;
    let key = keys.current.get(fingerprint); if (!key) { key = crypto.randomUUID(); keys.current.set(fingerprint, key); }
    lock.current = true; setSaving(true); setError("");
    try { await api.post(`/customers/${customerId}/${path}`, body, { headers: { "Idempotency-Key": key } }); keys.current.delete(fingerprint); setAmount(""); setNote(""); setSaleId(""); setNotice(kind === "received" ? "Advance received and posted to account." : kind === "applied" ? "Advance applied to invoice without another cash movement." : "Unused advance refunded and posted to account."); await load(); onChange(); }
    catch (cause) { setError(errorMessage(cause)); } finally { lock.current = false; setSaving(false); }
  }
  const availableInvoices = invoices.filter(row => row.branchId === branchId && row.status === "completed" && Number(row.dueAmount) > 0);
  return <section className="ca-panel" aria-label={t("Customer advance ledger")}>
    <div className="ca-head"><div><h3>{t("Customer advance ledger")}</h3><p>{t("Advance receipts, invoice use and refunds are recorded separately from invoice payments.")}</p></div><strong>{ledger ? money(ledger.currentAdvance) : "—"}<small>{t("Current advance · all branches")}</small></strong></div>
    <p className="ca-coverage" role="note">{t("History starts with newly recorded advances. Older customer balance has no verified advance classification and is excluded.")}</p>
    {error && <p className="purchase-alert error" role="alert">{t(error)} <button onClick={() => void load()}>{t("Retry")}</button></p>}{notice && <p className="purchase-alert success" role="status">{t(notice)}</p>}
    {canManage && <div className="ca-form"><h4>{t("Record advance movement")}</h4><div className="ca-options">{(["received", "applied", "refunded"] as const).map(value => <button key={value} className={kind === value ? "selected" : ""} onClick={() => { setKind(value); setError(""); }}>{t(value === "received" ? "Receive" : value === "applied" ? "Apply to invoice" : "Refund")}</button>)}</div><div className="ca-fields"><label>{t("Branch")}<select value={branchId} onChange={e => { setBranchId(e.target.value); setSaleId(""); }}><option value="">{t("Choose branch")}</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label>{t("Amount")}<input type="number" min="0.01" step="0.01" max={kind === "received" ? undefined : ledger?.currentAdvance} value={amount} onChange={e => setAmount(e.target.value)} /></label>{kind === "applied" ? <label>{t("Invoice")}<select value={saleId} onChange={e => setSaleId(e.target.value)}><option value="">{t("Choose outstanding invoice")}</option>{availableInvoices.map(row => <option key={row.id} value={row.id}>{row.invoiceNumber} · {money(row.dueAmount)} {t("due")}</option>)}</select></label> : <><label>{t("Account")}<select value={accountId} onChange={e => { setAccountId(e.target.value); const account = accounts.find(a => a.id === e.target.value); setMethod(account?.type === "cash" ? "cash" : account?.type === "mfs" ? "bKash" : "Bank Transfer"); }}><option value="">{t("Select account")}</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name} · {a.type}</option>)}</select></label><label>{t("Method")}<select value={method} onChange={e => setMethod(e.target.value)}>{["cash", "card", "online", "cheque", "bKash", "Nagad", "Rocket", "Bank Transfer"].map(m => <option key={m}>{m}</option>)}</select></label></>}<label className="ca-note">{t("Note")}<textarea value={note} onChange={e => setNote(e.target.value)} /></label></div><button className="purchase-primary-action" disabled={saving} onClick={() => void submit()}>{saving ? t("Saving…") : t(kind === "received" ? "Receive advance" : kind === "applied" ? "Apply advance" : "Refund advance")}</button></div>}
    <div className="ca-head"><h4>{t("Advance activity")}</h4><button onClick={() => void load()} disabled={loading}>{t("Refresh")}</button></div><div className="ca-filters"><label>{t("Branch")}<select value={filterBranch} onChange={e => { setFilterBranch(e.target.value); setPage(1); }}><option value="">{t("All branches")}</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label>{t("From")}<input type="date" value={start} onChange={e => { setStart(e.target.value); setPage(1); }} /></label><label>{t("To")}<input type="date" value={end} onChange={e => { setEnd(e.target.value); setPage(1); }} /></label></div>
    {loading && <p role="status">{t("Loading advance activity…")}</p>}<div className="ca-events">{ledger?.events.map(event => <div className="ca-event" key={event.id}><span><strong>{t(event.kind)}</strong><small>{new Date(event.createdAt).toLocaleString(language === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka" })} · {event.branch?.name}</small><small>{event.sale?.invoiceNumber || event.transaction?.txnId || event.note || "—"}</small></span><span><b>{event.kind === "received" ? "+" : "−"}{money(event.amount)}</b><small>{t("Balance")}: {money(event.balanceAfter)}</small></span></div>)}{!loading && !ledger?.events.length && <p>{t("No advance events match these filters.")}</p>}</div><div className="sales-pagination"><span>{ledger?.pagination.total ?? 0} {t("events")}</span><button disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>{t("Previous")}</button><span>{page} / {Math.max(1, ledger?.pagination.totalPages ?? 1)}</span><button disabled={page >= (ledger?.pagination.totalPages ?? 1) || loading} onClick={() => setPage(p => p + 1)}>{t("Next")}</button></div>
  </section>;
}
