"use client";

import { FilterPopover } from "@/components/ui/filter-popover";
import { Select } from "@/components/ui/select";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { useLanguage } from "@/lib/i18n/language-provider";
import { useAuth } from "@/components/providers/auth-provider";

type Account = { id: string; name: string; type: string };
type Purchase = { id: string; poNumber?: string; supplierId: string; supplier?: { name: string }; branchId: string; status: string };
type SourceLine = { id: string; itemName: string; batchNumber: string; price: string; quantity: string; completedQuantity: number; pendingQuantity: number; availableStock: number; remainingAllowance: number };
type Return = { id: string; purchaseId?: string; poNumber?: string; supplier?: { name: string }; status: string; totalPrice: string; dueReduction: string; supplierCredit: string; refundedAmount: string; refundableCredit: string; reason?: string; createdAt: string; purchaseReturnItems: { id: string; itemName: string; batchNumber: string; quantity: string; price: string }[]; transactions?: { id: string; txnId: string; amount: string; createdAt: string; paymentMethod?: string }[] };
const numeric = (value: unknown) => Number(value) || 0;
const idempotency = () => crypto.randomUUID();
const message = (error: unknown) => error instanceof Error ? error.message : "Request failed. Try again.";

export function PurchaseReturnsPanel({ branchId, accounts }: { branchId: string; accounts: Account[] }) {
  const { t, language } = useLanguage();
  const { hasPermission } = useAuth();
  const [returns, setReturns] = useState<Return[]>([]), [purchases, setPurchases] = useState<Purchase[]>([]);
  const [page, setPage] = useState(1), [totalPages, setTotalPages] = useState(1), [sourceSearch, setSourceSearch] = useState("");
  const [historyStatus,setHistoryStatus]=useState(""), [historyPurchase,setHistoryPurchase]=useState(""), [historySupplier,setHistorySupplier]=useState("");
  const [purchaseId, setPurchaseId] = useState(""), [sourceLines, setSourceLines] = useState<SourceLine[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({}), [reason, setReason] = useState(""), [note, setNote] = useState("");
  const [selected, setSelected] = useState<Return | null>(null), [refundAmount, setRefundAmount] = useState(""), [accountId, setAccountId] = useState(""), [method, setMethod] = useState("cash");
  const [loading, setLoading] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const lock = useRef(false), keys = useRef(new Map<string, string>());
  const money = (v: unknown) => new Intl.NumberFormat(language === "bn" ? "bn-BD" : "en-BD", { style: "currency", currency: "BDT" }).format(numeric(v));
  const requestKey = (action: string, body: unknown) => { const fingerprint = `${action}:${JSON.stringify(body)}`; let key = keys.current.get(fingerprint); if (!key) { key = idempotency(); keys.current.set(fingerprint, key); } return { key, fingerprint }; };
  const loadReturns = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try { const response = await api.get<{ returns: Return[]; pagination: { totalPages: number } }>(`/pharmacy/purchase-returns?${new URLSearchParams({branchId,page:String(page),limit:"25",...(historyStatus?{status:historyStatus}:{}),...(historyPurchase?{purchaseId:historyPurchase}:{}),...(historySupplier?{supplierId:historySupplier}:{})})}`); setReturns(response.returns); setTotalPages(Math.max(1, response.pagination.totalPages)); setError(""); }
    catch (cause) { setError(message(cause)); setReturns([]); }
    finally { setLoading(false); }
  }, [branchId, page, historyStatus, historyPurchase, historySupplier]);
  useEffect(() => { void loadReturns(); }, [loadReturns]);
  useEffect(() => {
    if (!branchId) return;
    const timer = window.setTimeout(() => { const params = new URLSearchParams({ branchId, status: "completed", type: "pharmacy", page: "1", limit: "100" }); if (sourceSearch.trim()) params.set("search", sourceSearch.trim()); void api.get<{ purchases: Purchase[] } | Purchase[]>(`/pharmacy/purchases?${params}`).then(result => setPurchases(Array.isArray(result) ? result.filter(p => p.status === "completed") : result.purchases)).catch(cause => setError(message(cause))); }, 180);
    return () => window.clearTimeout(timer);
  }, [branchId, sourceSearch]);
  useEffect(() => { setPurchaseId(""); setSourceLines([]); setSelected(null); setQuantities({}); setHistoryStatus("");setHistoryPurchase("");setHistorySupplier("");setPage(1); }, [branchId]);
  useEffect(() => { if (!purchaseId) { setSourceLines([]); return; } let live = true; void api.get<{ items: SourceLine[] }>(`/pharmacy/purchases/${purchaseId}/returnable-items`).then(result => { if (live) { setSourceLines(result.items); setQuantities({}); } }).catch(cause => { if (live) setError(message(cause)); }); return () => { live = false; }; }, [purchaseId]);
  async function openReturn(id: string) { try { setSelected(await api.get<Return>(`/pharmacy/purchase-returns/${id}`)); setError(""); } catch (cause) { setError(message(cause)); } }
  async function create() {
    if (lock.current || !hasPermission("purchase:create")) return;
    const purchase = purchases.find(p => p.id === purchaseId);
    const items = sourceLines.map(line => ({ purchaseItemId: line.id, quantity: Number(quantities[line.id] || 0) })).filter(row => row.quantity > 0);
    if (!purchase || !reason.trim() || !items.length || items.some(row => !Number.isInteger(row.quantity) || row.quantity > (sourceLines.find(line => line.id === row.purchaseItemId)?.remainingAllowance ?? 0))) { setError("Choose a purchase, reason and valid whole quantities within the return allowance."); return; }
    const body = { purchaseId, branchId, supplierId: purchase.supplierId, reason: reason.trim(), note: note.trim() || undefined, items };
    const { key, fingerprint } = requestKey("create", body);
    lock.current = true; setSaving(true); setError("");
    try { const result = await api.post<Return>("/pharmacy/purchase-returns", body, { headers: { "Idempotency-Key": key } }); keys.current.delete(fingerprint); setNotice("Supplier return saved as pending. Stock has not moved yet."); setReason(""); setNote(""); setQuantities({}); setSelected(result); setPurchaseId(""); await loadReturns(); }
    catch (cause) { setError(message(cause)); } finally { lock.current = false; setSaving(false); }
  }
  async function status(value: "completed" | "rejected") {
    if (lock.current || !selected || !hasPermission("purchase:update")) return;
    lock.current = true; setSaving(true); setError("");
    try { const result = await api.patch<Return>(`/pharmacy/purchase-returns/${selected.id}/status`, { status: value }); setSelected(result); setNotice(value === "completed" ? "Return approved. Batch stock and supplier due were updated." : "Pending return rejected."); await loadReturns(); }
    catch (cause) { setError(message(cause)); } finally { lock.current = false; setSaving(false); }
  }
  async function refund() {
    if (lock.current || !selected || !hasPermission("purchase:update")) return;
    const amount = Number(refundAmount);
    if (!accountId || !/^\d+(?:\.\d{1,2})?$/.test(refundAmount) || amount <= 0 || amount > numeric(selected.refundableCredit)) { setError("Enter a valid amount within the refundable supplier credit and select an account."); return; }
    const body = { accountId, amount, paymentMethod: method };
    const { key, fingerprint } = requestKey(`refund:${selected.id}`, body);
    lock.current = true; setSaving(true); setError("");
    try { const result = await api.post<Return>(`/pharmacy/purchase-returns/${selected.id}/refunds`, body, { headers: { "Idempotency-Key": key } }); keys.current.delete(fingerprint); setSelected(result); setRefundAmount(""); setNotice("Supplier refund received and posted to the selected account."); await loadReturns(); }
    catch (cause) { setError(message(cause)); } finally { lock.current = false; setSaving(false); }
  }
  return <section className="pr-panel panel" aria-label={t("Supplier returns and refunds")}>
    <div className="pr-head"><div><h2>{t("Supplier returns & refunds")}</h2><p>{t("Review purchased batches, approve stock returns, then record money actually received from the supplier.")}</p></div><button onClick={() => void loadReturns()} disabled={loading}>{t("Refresh")}</button></div>
    {error && <p className="purchase-alert error" role="alert">{t(error)}</p>}{notice && <p className="purchase-alert success" role="status">{t(notice)}</p>}
    {hasPermission("purchase:create") && <div className="pr-create"><h3>{t("New supplier return")}</h3><label>{t("Find completed purchase")}<input value={sourceSearch} onChange={e => setSourceSearch(e.target.value)} placeholder={t("Search PO or supplier")} /></label><label>{t("Source purchase")}<Select value={purchaseId} onChange={e => setPurchaseId(e.target.value)}><option value="">{t("Choose purchase")}</option>{purchases.map(p => <option key={p.id} value={p.id}>{p.poNumber || p.id} · {p.supplier?.name}</option>)}</Select></label>
      {purchaseId && <><div className="pr-lines">{sourceLines.map(line => <label key={line.id}><span><strong>{line.itemName}</strong><small>{t("Batch")}: {line.batchNumber} · {t("Available to return")}: {line.remainingAllowance} · {t("Stock")}: {line.availableStock}</small></span><input aria-label={`${line.itemName} ${line.batchNumber} return quantity`} type="number" min="0" max={line.remainingAllowance} step="1" value={quantities[line.id] ?? ""} onChange={e => setQuantities(q => ({ ...q, [line.id]: e.target.value }))} /></label>)}</div><label>{t("Reason")}<input value={reason} maxLength={500} onChange={e => setReason(e.target.value)} /></label><label>{t("Note")}<textarea value={note} onChange={e => setNote(e.target.value)} /></label><button className="purchase-primary-action" disabled={saving} onClick={() => void create()}>{saving ? t("Saving…") : t("Save pending return")}</button></>}
    </div>}
    <h3>{t("Return history")}</h3><FilterPopover className="ca-fields"><label>{t("Status")}<Select value={historyStatus} onChange={e=>{setHistoryStatus(e.target.value);setPage(1);}}><option value="">{t("All statuses")}</option>{["pending","completed","rejected"].map(value=><option key={value}>{value}</option>)}</Select></label><label>{t("Purchase")}<Select value={historyPurchase} onChange={e=>{setHistoryPurchase(e.target.value);setPage(1);}}><option value="">{t("All")}</option>{purchases.map(row=><option key={row.id} value={row.id}>{row.poNumber||row.id}</option>)}</Select></label><label>{t("Supplier")}<Select value={historySupplier} onChange={e=>{setHistorySupplier(e.target.value);setPage(1);}}><option value="">{t("All suppliers")}</option>{Array.from(new Map(purchases.map(row=>[row.supplierId,row.supplier?.name||row.supplierId])).entries()).map(([id,name])=><option key={id} value={id}>{name}</option>)}</Select></label></FilterPopover>{loading && <p role="status">{t("Loading returns…")}</p>}
    <div className="pr-history">{returns.map(row => <button key={row.id} className="pr-history-row" onClick={() => void openReturn(row.id)}><span><strong>{row.poNumber || row.purchaseId || row.id}</strong><small>{row.supplier?.name} · {new Date(row.createdAt).toLocaleDateString(language === "bn" ? "bn-BD" : "en-GB")}</small></span><span><b>{money(row.totalPrice)}</b><small>{t(row.status)}</small></span></button>)}{!loading && !returns.length && <p>{t("No supplier returns for this branch.")}</p>}</div>
    <div className="sales-pagination"><button disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>{t("Previous")}</button><span>{page} / {totalPages}</span><button disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)}>{t("Next")}</button></div>
    {selected && <div className="pr-detail"><div className="pr-head"><div><h3>{selected.poNumber || selected.id}</h3><p>{selected.reason} · {t(selected.status)}</p></div><button onClick={() => setSelected(null)} aria-label={t("Close")}>×</button></div><div className="pr-totals"><span>{t("Return value")}<strong>{money(selected.totalPrice)}</strong></span><span>{t("Supplier due reduced")}<strong>{money(selected.dueReduction)}</strong></span><span>{t("Supplier credit")}<strong>{money(selected.supplierCredit)}</strong></span><span>{t("Refund received")}<strong>{money(selected.refundedAmount)}</strong></span><span>{t("Refund still due")}<strong>{money(selected.refundableCredit)}</strong></span></div><div className="pr-lines">{selected.purchaseReturnItems.map(line => <p key={line.id}>{line.itemName} · {line.batchNumber} · {line.quantity} × {money(line.price)}</p>)}</div>{selected.status === "pending" && hasPermission("purchase:update") && <div className="pr-actions"><button disabled={saving} className="purchase-primary-action" onClick={() => void status("completed")}>{t("Approve & remove stock")}</button><button disabled={saving} onClick={() => void status("rejected")}>{t("Reject return")}</button></div>}{selected.status === "completed" && numeric(selected.refundableCredit) > 0 && hasPermission("purchase:update") && <div className="pr-refund"><h4>{t("Record supplier refund received")}</h4><label>{t("Amount")}<input type="number" min="0.01" max={selected.refundableCredit} step="0.01" value={refundAmount} onChange={e => setRefundAmount(e.target.value)} /></label><label>{t("Account")}<Select value={accountId} onChange={e => { setAccountId(e.target.value); const account = accounts.find(a => a.id === e.target.value); setMethod(account?.type === "cash" ? "cash" : account?.type === "mfs" ? "bKash" : "Bank Transfer"); }}><option value="">{t("Select account")}</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name} · {a.type}</option>)}</Select></label><label>{t("Method")}<Select value={method} onChange={e => setMethod(e.target.value)}>{["cash", "card", "online", "cheque", "bKash", "Nagad", "Rocket", "Bank Transfer"].map(m => <option key={m}>{m}</option>)}</Select></label><button className="purchase-primary-action" disabled={saving || !hasPermission("account:read")} onClick={() => void refund()}>{t("Post refund received")}</button></div>}{selected.transactions?.length ? <div className="pr-lines"><h4>{t("Refund transactions")}</h4>{selected.transactions.map(row => <p key={row.id}>{row.txnId} · {money(row.amount)} · {row.paymentMethod}</p>)}</div> : null}</div>}
  </section>;
}
