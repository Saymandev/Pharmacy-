"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CreditCard, X } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { readPagination } from "@/lib/api/pagination";
import { useAuth } from "@/components/providers/auth-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import { Select } from "@/components/ui/select";
import { duePaymentError, finiteAmount } from "./sales-policy";

export type DueInvoice = { id: string; invoiceNumber: string; status: string; dueAmount: unknown; paidAmount?: unknown; branchId?: string; branch?: { name?: string }; customer?: { name?: string; phone?: string }; createdAt?: string };
type Account = { id: string; name: string; type: string; isActive?: boolean };
export function collectionRows<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") { const row = value as Record<string, unknown>; for (const key of ["data", "sales", "accounts"]) if (key in row) return collectionRows<T>(row[key]); }
  return [];
}
async function activeAccounts() {
  const result = new Map<string, Account>();
  for (let page = 1; page <= 20; page++) {
    const response = await api.getWithMeta<unknown>(`/finance/accounts?isActive=true&page=${page}&limit=100`), batch = collectionRows<Account>(response);
    const before = result.size; batch.filter(row => row.isActive !== false).forEach(row => result.set(row.id, row));
    if (!readPagination(response, batch.length, page, 100).hasNextPage || !batch.length || (page > 1 && result.size === before)) break;
  }
  return [...result.values()];
}

export function CollectDueDialog({ invoice, onClose, onBack, onSaved }: { invoice: DueInvoice; onClose: () => void; onBack?: () => void; onSaved: (invoice: DueInvoice) => void }) {
  const { hasPermission } = useAuth(), { t, language } = useLanguage();
  const allowed = hasPermission("sale:read") && hasPermission("sale:update") && hasPermission("account:read");
  const [sale, setSale] = useState(invoice), [accounts, setAccounts] = useState<Account[]>([]);
  const [amount, setAmount] = useState(""), [accountId, setAccountId] = useState(""), [method, setMethod] = useState("cash"), [note, setNote] = useState("");
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState(""), [reload, setReload] = useState(0), [uncertain, setUncertain] = useState(false);
  const lock = useRef(false), full = useRef<HTMLButtonElement>(null);
  const due = finiteAmount(sale.dueAmount);
  const money = (value: unknown) => finiteAmount(value) === null ? "—" : new Intl.NumberFormat(language === "bn" ? "bn-BD" : "en-BD", { style: "currency", currency: "BDT" }).format(Number(value));
  useEffect(() => {
    if (!allowed) return;
    let live = true;
    void Promise.all([api.get<DueInvoice>(`/sales/${encodeURIComponent(invoice.id)}`), activeAccounts()]).then(([fresh, choices]) => {
      if (!live) return;
      setSale(fresh); setAccounts(choices); setAmount(""); setUncertain(false);
      const account = choices.find(row => row.type === "cash") ?? choices[0];
      setAccountId(account?.id ?? ""); setMethod(account?.type === "bank" ? "Bank Transfer" : account?.type === "mfs" ? "bKash" : "cash");
      setError("");
    }).catch(cause => { if (live) setError(cause instanceof Error ? cause.message : "Could not load the invoice."); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [allowed, invoice.id, reload]);
  useEffect(() => {
    if (loading) return;
    const frame = requestAnimationFrame(() => full.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [loading]);
  async function submit() {
    if (lock.current || loading || uncertain || !allowed) return;
    const problem = duePaymentError(sale, amount, accountId); if (problem) { setError(problem); return; }
    lock.current = true; setSaving(true); setError("");
    try {
      const fresh = await api.get<DueInvoice>(`/sales/${encodeURIComponent(sale.id)}`); setSale(fresh);
      const changed = duePaymentError(fresh, amount, accountId); if (changed) { setError(changed); return; }
      const updated = await api.post<DueInvoice>(`/sales/${encodeURIComponent(fresh.id)}/payments`, { accountId, amount: Number(amount), paymentMethod: method, ...(note.trim() ? { note: note.trim() } : {}) });
      window.dispatchEvent(new CustomEvent("pharmacy:sale-payment-recorded", { detail: { saleId: fresh.id } }));
      onSaved({...fresh,...updated,dueAmount:updated.dueAmount??null});
    } catch (cause) {
      const ambiguous = cause instanceof ApiClientError && (cause.status === 0 || cause.status >= 500);
      setUncertain(ambiguous); setError(ambiguous ? "Payment response was interrupted. Refresh the invoice and verify its current due before trying again." : cause instanceof Error ? cause.message : "Could not record payment.");
    } finally { lock.current = false; setSaving(false); }
  }
  const payDisabled = loading || saving || sale.status === "rejected" || due === null || due <= 0;
  return <div className="sales-backdrop due-collection-backdrop" role="presentation" onClick={() => { if (!saving) onClose(); }}><section className="supplier-dialog panel due-payment-dialog" role="dialog" aria-modal="true" aria-label={t("Collect sale due")} onClick={event => event.stopPropagation()}>
    <header className="due-dialog-heading"><CreditCard size={22}/><div><h2>{t("Collect outstanding due")}</h2><p>{sale.invoiceNumber} · {sale.customer?.name || t("Customer")}{sale.customer?.phone ? ` · ${sale.customer.phone}` : ""}</p></div><button type="button" className="purchase-close" disabled={saving} onClick={onClose} aria-label={t("Close")}><X size={18}/></button></header>
    <form noValidate onSubmit={event => { event.preventDefault(); void submit(); }}>
      <div className="due-dialog-body">
        {onBack && <button className="due-back" type="button" disabled={saving} onClick={onBack}><ArrowLeft size={15}/>{t("Back to search")}</button>}
        {!allowed ? <p role="alert">{t("Your role cannot collect sale payments.")}</p> : <>
          <div className="due-invoice-balance"><span>{t("Outstanding due")}</span><strong>{money(sale.dueAmount)}</strong></div>
          {loading && <p role="status">{t("Loading invoice and accounts…")}</p>}
          {!loading && (due === null || due <= 0 || sale.status === "rejected") && <p role="status">{t("This invoice has no valid outstanding due. Refresh the invoice.")}</p>}
          <fieldset disabled={loading || saving} className="due-payment-fields">
            <div className="due-amount-row"><label>{t("Amount")}<input type="number" min="0.01" step="0.01" max={due ?? undefined} value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00"/></label><button ref={full} type="button" className="due-pay-full" disabled={payDisabled} onClick={() => setAmount(Number(sale.dueAmount).toFixed(2))}>{t("Pay full due")}</button></div>
            <div className="due-account-row"><label>{t("Account")}<Select aria-label={t("Payment account")} value={accountId} onChange={event => { setAccountId(event.target.value); const account = accounts.find(row => row.id === event.target.value); setMethod(account?.type === "bank" ? "Bank Transfer" : account?.type === "mfs" ? "bKash" : "cash"); }}><option value="">{t("Select account")}</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name} · {account.type}</option>)}</Select></label><label>{t("Method")}<Select aria-label={t("Payment method")} value={method} onChange={event => setMethod(event.target.value)}>{["cash", "card", "online", "cheque", "bKash", "Nagad", "Rocket", "Bank Transfer"].map(value => <option key={value} value={value}>{value}</option>)}</Select></label></div>
            <details><summary>{t("Optional payment note")}</summary><label>{t("Payment note")}<textarea rows={2} value={note} maxLength={500} onChange={event => setNote(event.target.value)}/></label></details>
            {amount && Number.isFinite(Number(amount)) && <p className="due-after">{t("Due after this payment")}: <strong>{money(Math.max(0, Number(sale.dueAmount) - Number(amount)))}</strong></p>}
          </fieldset>
          {!loading && !accounts.length && <p role="alert">{t("No active payment accounts are available.")}</p>}
        </>}
        {error && <p role="alert" className="pos-dialog-error">{t(error)}</p>}
        {(error || uncertain) && <button className="due-back" type="button" disabled={saving} onClick={() => { setLoading(true); setReload(value => value + 1); }}>{t("Refresh invoice")}</button>}
      </div>
      <footer className="due-dialog-footer"><button type="button" disabled={saving} onClick={onClose}>{t("Cancel")}</button><button type="submit" className="purchase-primary-action" disabled={!allowed || payDisabled || uncertain || !accounts.length}>{t(saving ? "Saving…" : "Record payment")}</button></footer>
    </form>
  </section></div>;
}
