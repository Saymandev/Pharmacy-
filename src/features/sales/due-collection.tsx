"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Banknote, ChevronRight, Search, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { readPagination } from "@/lib/api/pagination";
import { useAuth } from "@/components/providers/auth-provider";
import { useActiveBranch } from "@/components/providers/active-branch-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import { CollectDueDialog, collectionRows, type DueInvoice } from "./collect-due-dialog";
import { finiteAmount } from "./sales-policy";

type CollectionContext = { allowed: boolean; open: () => void; close: () => void; visible: boolean; invoice: DueInvoice | null; select: (invoice: DueInvoice | null) => void; query: string; search: (value: string) => void; page: number; setPage: (page: number) => void; notice: string; saved: (invoice: DueInvoice) => void };
const Collection = createContext<CollectionContext | null>(null);
function blocked() { return !!document.querySelector("dialog[open],.ui-select-popup:popover-open") || [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')].some(node => node.getClientRects().length); }

export function DueCollectionProvider({ children }: { children: ReactNode }) {
  const { hasPermission } = useAuth(), { t, language } = useLanguage();
  const allowed = hasPermission("sale:read") && hasPermission("sale:update") && hasPermission("account:read");
  const [visible, setVisible] = useState(false), [invoice, select] = useState<DueInvoice | null>(null), [query, setQuery] = useState(""), [page, setPage] = useState(1), [notice, setNotice] = useState("");
  const open = useCallback(() => { if (!allowed || blocked()) return; select(null); setQuery(""); setPage(1); setNotice(""); setVisible(true); }, [allowed]);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) { if (allowed && event.key === "F8" && !event.altKey && !event.ctrlKey && !event.metaKey && !event.isComposing && !event.repeat && !blocked()) { event.preventDefault(); open(); } }
    window.addEventListener("keydown", shortcut); return () => window.removeEventListener("keydown", shortcut);
  }, [allowed, open]);
  function saved(updated: DueInvoice) {
    const number = updated.invoiceNumber || invoice?.invoiceNumber || "";
    const due = finiteAmount(updated.dueAmount);
    setNotice(t("Payment recorded for {invoice}. Remaining due: {due}.", { invoice: number, due: due === null ? "—" : new Intl.NumberFormat(language === "bn" ? "bn-BD" : "en-BD", { style: "currency", currency: "BDT" }).format(due) }));
    select(null);

  }
  return <Collection.Provider value={{ allowed, open, close: () => setVisible(false), visible, invoice, select, query, search: value => { setQuery(value); setPage(1); }, page, setPage, notice, saved }}>{children}</Collection.Provider>;
}

export function DueCollectionTrigger({ className = "" }: { className?: string }) {
  const context = useContext(Collection), { t } = useLanguage();
  if (!context?.allowed) return null;
  return <button type="button" className={`due-collection-trigger ${className}`} aria-label={t("Collect due")} title={`${t("Collect due")} (F8)`} aria-keyshortcuts="F8" onClick={context.open}><Banknote size={17}/><span>{t("Collect due")}</span></button>;
}

export function DueCollectionOverlay() {
  const context = useContext(Collection);
  if (!context?.visible || !context.allowed) return null;
  return context.invoice ? <CollectDueDialog key={context.invoice.id} invoice={context.invoice} onClose={context.close} onBack={() => context.select(null)} onSaved={context.saved}/> : <DueSearch context={context}/>;
}

function DueSearch({ context }: { context: CollectionContext }) {
  const { t, language } = useLanguage(), { activeBranchId, activeBranch } = useActiveBranch();
  const [rows, setRows] = useState<DueInvoice[]>([]), [pages, setPages] = useState(1), [total, setTotal] = useState(0), [loading, setLoading] = useState(true), [error, setError] = useState(""), [retry, setRetry] = useState(0);
  const request = useRef(0);
  useEffect(() => {
    const id = ++request.current; let live = true;
    const timer = setTimeout(() => {
      if (!activeBranchId) { setRows([]); setLoading(false); return; }
      setLoading(true); setError("");
      // Both existing server-side status filters are searched. We never filter only a generic first page.
      void Promise.all(["due", "partial"].map(paymentStatus => api.getWithMeta<unknown>(`/sales?${new URLSearchParams({ branchId: activeBranchId, type: "pos", paymentStatus, page: String(context.page), limit: "10", ...(context.query.trim() ? { search: context.query.trim() } : {}) })}`))).then(results => {
        if (!live || id !== request.current) return;
        const merged = new Map<string, DueInvoice>(); let count = 0, last = 1;
        for (const result of results) {
          const invoices = collectionRows<DueInvoice>(result), meta = readPagination(result, invoices.length, context.page, 10);
          count += meta.total; last = Math.max(last, meta.totalPages);
          for (const invoice of invoices) if ((finiteAmount(invoice.dueAmount) ?? 0) > 0 && invoice.status !== "rejected") merged.set(invoice.id, invoice);
        }
        setRows([...merged.values()].sort((a, b) => (Date.parse(b.createdAt || "") || 0) - (Date.parse(a.createdAt || "") || 0))); setTotal(count); setPages(last);
      }).catch(cause => { if (live && id === request.current) { setRows([]); setError(cause instanceof Error ? cause.message : "Could not load outstanding invoices."); } }).finally(() => { if (live && id === request.current) setLoading(false); });
    }, 180);
    return () => { clearTimeout(timer); live = false; };
  }, [activeBranchId, context.query, context.page, retry]);
  const money = (value: unknown) => new Intl.NumberFormat(language === "bn" ? "bn-BD" : "en-BD", { style: "currency", currency: "BDT" }).format(Number(value));
  return <div className="sales-backdrop due-collection-backdrop" role="presentation" onClick={context.close}><section className="supplier-dialog panel due-search-dialog" role="dialog" aria-modal="true" aria-label={t("Quick due collection")} onClick={event => event.stopPropagation()}>
    <header className="due-dialog-heading"><Banknote size={23}/><div><h2>{t("Collect due")}</h2><p>{activeBranch?.name || t("Choose a branch in Settings.")} · F8</p></div><button type="button" className="purchase-close" onClick={context.close} aria-label={t("Close")}><X size={18}/></button></header>
    <div className="due-search-input"><Search size={18}/><input aria-label={t("Search outstanding invoices")} placeholder={t("Invoice, customer name or phone…")} value={context.query} onChange={event => { setLoading(true); context.search(event.target.value); }} onKeyDown={event => { if (event.key === "Enter" && !loading && rows.length === 1) { event.preventDefault(); context.select(rows[0]); } }}/></div>
    {context.notice && <p role="status" className="due-success">{context.notice}</p>}
    <div className="due-search-results" aria-busy={loading}>
      {loading ? <p role="status">{t("Searching outstanding invoices…")}</p> : error ? <><p role="alert">{t(error)}</p><button type="button" onClick={() => setRetry(value => value + 1)}>{t("Retry")}</button></> : !rows.length ? <p>{t("No outstanding invoices match this search.")}</p> : rows.map(invoice => <button type="button" className="due-search-row" key={invoice.id} onClick={() => context.select(invoice)}><span><strong>{invoice.invoiceNumber}</strong><small>{invoice.customer?.name || t("Customer")} {invoice.customer?.phone ? ` · ${invoice.customer.phone}` : ""}</small></span><b>{money(invoice.dueAmount)}</b><ChevronRight size={17}/></button>)}
    </div>
    <footer className="due-dialog-footer"><small>{total} {t("outstanding invoices")} · {context.page}/{pages}</small><button type="button" disabled={loading || context.page <= 1} onClick={() => context.setPage(context.page - 1)}>{t("Previous")}</button><button type="button" disabled={loading || context.page >= pages} onClick={() => context.setPage(context.page + 1)}>{t("Next")}</button></footer>
  </section></div>;
}
