"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Building2, CircleAlert, Mail, MapPin, Pencil, Phone, Plus, Search, Trash2, Truck, X } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { ApiClientError, api } from "@/lib/api/client";
import { useLanguage } from "@/lib/i18n/language-provider";

type Supplier = { id: string; name: string; nameBangla?: string | null; address: string; phone: string; email?: string | null; createdAt?: string };
type SupplierForm = { name: string; nameBangla: string; address: string; phone: string; email: string };
type SupplierListEnvelope = { data?: unknown; meta?: { total?: number; totalItems?: number; page?: number; pageSize?: number; totalPages?: number } };
const emptyForm: SupplierForm = { name: "", nameBangla: "", address: "", phone: "", email: "" };
const pageSize = 10;

function message(error: unknown) { return error instanceof ApiClientError ? error.message : "The supplier request could not be completed."; }

export function SupplierWorkspace() {
  const { hasPermission } = useAuth();
  const { t } = useLanguage();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<"create" | "edit" | "delete" | null>(null);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const canCreate = hasPermission("supplier:create");
  const canUpdate = hasPermission("supplier:update");
  const canDelete = hasPermission("supplier:delete");

  const loadSuppliers = useCallback(async (requestedPage: number, term: string) => {
    setLoading(true); setError("");
    const params = new URLSearchParams({ page: String(requestedPage), limit: String(pageSize) });
    if (term.trim()) params.set("search", term.trim());
    try {
      const result = await api.getWithMeta<SupplierListEnvelope | Supplier[]>(`/pharmacy/suppliers?${params}`);
      const envelope = Array.isArray(result) ? undefined : result;
      const rows = Array.isArray(result) ? result : Array.isArray(envelope?.data) ? envelope.data as Supplier[] : [];
      setSuppliers(rows);
      setTotal(envelope?.meta?.totalItems ?? envelope?.meta?.total ?? rows.length);
    } catch (cause) { setError(message(cause)); setSuppliers([]); setTotal(0); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void loadSuppliers(page, query); }, 0); return () => window.clearTimeout(timer); }, [loadSuppliers, page, query]);

  function openCreate() { setSelected(null); setForm(emptyForm); setError(""); setDialog("create"); }
  function openEdit(supplier: Supplier) {
    setSelected(supplier); setForm({ name: supplier.name, nameBangla: supplier.nameBangla ?? "", address: supplier.address, phone: supplier.phone, email: supplier.email ?? "" }); setError(""); setDialog("edit");
  }
  function updateForm(key: keyof SupplierForm, value: string) { setForm((current) => ({ ...current, [key]: value })); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (form.name.trim().length < 3 || form.address.trim().length < 5 || form.phone.trim().length < 10) { setError("Name, address and phone must meet the minimum lengths shown in the form."); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError("Enter a valid email address or leave it blank."); return; }
    setSaving(true);
    const payload = { ...form, name: form.name.trim(), address: form.address.trim(), phone: form.phone.trim(), email: form.email.trim() };
    try {
      if (dialog === "edit" && selected) await api.put(`/pharmacy/suppliers/${encodeURIComponent(selected.id)}`, payload);
      else await api.post("/pharmacy/suppliers", payload);
      const nextPage = dialog === "create" ? 1 : page;
      setDialog(null); setSelected(null); setPage(nextPage); await loadSuppliers(nextPage, query);
    } catch (cause) { setError(message(cause)); }
    finally { setSaving(false); }
  }

  async function removeSupplier() {
    if (!selected) return;
    setSaving(true); setError("");
    try {
      await api.delete(`/pharmacy/suppliers/${encodeURIComponent(selected.id)}`);
      setDialog(null); setSelected(null);
      const nextPage = suppliers.length === 1 && page > 1 ? page - 1 : page;
      setPage(nextPage); await loadSuppliers(nextPage, query);
    } catch (cause) { setError(message(cause)); }
    finally { setSaving(false); }
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return <section className="supplier-page data-page">
    <div className="page-heading-row"><div><p className="eyebrow">{t("PROCUREMENT · DIRECTORY")}</p><h1>{t("Suppliers")}</h1><p className="page-subtitle">{t("Keep supplier contacts up to date for purchasing and stock replenishment.")}</p></div>{canCreate && <button className="purchase-primary-action" type="button" onClick={openCreate}><Plus size={15}/> {t("Add supplier")}</button>}</div>
    <div className="supplier-summary"><article><i><Truck size={17}/></i><span><small>{t("Suppliers shown")}</small><strong>{loading ? "—" : total.toLocaleString("en-BD")}</strong></span></article><article><i><Building2 size={17}/></i><span><small>{t("Current page")}</small><strong>{t("Page")} {page} / {pageCount}</strong></span></article></div>
    <section className="panel supplier-card"><form className="supplier-toolbar" onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery(search); }}><div><Search size={16}/><input aria-label={t("Search suppliers")} placeholder={t("Search name, address or phone")} value={search} onChange={(event) => setSearch(event.target.value)}/>{search && <button type="button" aria-label={t("Clear search")} onClick={() => { setSearch(""); setQuery(""); setPage(1); }}><X size={14}/></button>}</div><button type="submit">{t("Search")}</button></form>
      {error && !dialog && <div className="data-error"><CircleAlert size={16}/><span>{error}</span><button type="button" onClick={() => void loadSuppliers(page, query)}>Retry</button></div>}
      <div className="supplier-table-wrap"><table className="supplier-table"><thead><tr><th>{t("Supplier")}</th><th>{t("Contact")}</th><th>{t("Address")}</th><th>{t("Added")}</th><th><span className="sr-only">{t("Actions")}</span></th></tr></thead><tbody>{suppliers.map((supplier) => <tr key={supplier.id}><td data-label={t("Supplier")}><span className="supplier-name-cell"><i><Building2 size={15}/></i><span><strong>{supplier.name}</strong>{supplier.nameBangla && <small>{supplier.nameBangla}</small>}</span></span></td><td data-label={t("Contact")}><span className="supplier-contact"><a href={`tel:${supplier.phone}`}><Phone size={13}/>{supplier.phone}</a>{supplier.email && <a href={`mailto:${supplier.email}`}><Mail size={13}/>{supplier.email}</a>}</span></td><td data-label={t("Address")}><span className="supplier-address"><MapPin size={13}/>{supplier.address}</span></td><td data-label={t("Added")}>{supplier.createdAt ? new Date(supplier.createdAt).toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td><td data-label={t("Actions")}><span className="supplier-actions">{canUpdate && <button type="button" aria-label={`${t("Edit")} ${supplier.name}`} onClick={() => openEdit(supplier)}><Pencil size={14}/></button>}{canDelete && <button type="button" aria-label={`${t("Delete")} ${supplier.name}`} onClick={() => { setSelected(supplier); setError(""); setDialog("delete"); }}><Trash2 size={14}/></button>}</span></td></tr>)}</tbody></table>
        {!loading && suppliers.length === 0 && <div className="supplier-empty"><Building2 size={22}/><strong>{t(query ? "No suppliers found" : "No suppliers yet")}</strong><span>{t(query ? "Try a different search." : "Add your first supplier to use it in purchase entries.")}</span>{!query && canCreate && <button type="button" className="purchase-primary-action" onClick={openCreate}><Plus size={14}/> {t("Add supplier")}</button>}</div>}
        {loading && <div className="supplier-loading">{t("Loading supplier directory…")}</div>}</div>
      <div className="supplier-pagination"><span>{total ? `${Math.min((page - 1) * pageSize + 1, total)}–${Math.min(page * pageSize, total)} / ${total}` : t("0 suppliers")}</span><div><button type="button" disabled={loading || page <= 1} onClick={() => setPage((current) => current - 1)}>{t("Previous")}</button><span>{t("Page")} {page} {t("of")} {pageCount}</span><button type="button" disabled={loading || page >= pageCount} onClick={() => setPage((current) => current + 1)}>{t("Next")}</button></div></div>
    </section>
    {dialog && <div className="pos-dialog-backdrop" role="presentation" onClick={() => !saving && setDialog(null)}><section className="supplier-dialog" role="dialog" aria-modal="true" aria-labelledby="supplier-dialog-title" onClick={(event) => event.stopPropagation()}><div className="supplier-dialog-heading"><span className="supplier-dialog-icon"><Building2 size={18}/></span><button type="button" className="pos-icon-action" onClick={() => setDialog(null)} aria-label={t("Close dialog")}><X size={16}/></button></div>{dialog === "delete" ? <><h2 id="supplier-dialog-title">{t("Delete supplier?")}</h2><p>{t("Delete")} <strong>{selected?.name}</strong> {t("from the supplier directory. The backend may reject deletion when purchase records reference this supplier.")}</p>{error && <div className="pos-dialog-error" role="alert">{error}</div>}<div className="supplier-dialog-actions"><button type="button" className="supplier-cancel" onClick={() => setDialog(null)}>{t("Cancel")}</button><button type="button" className="supplier-delete-confirm" disabled={saving} onClick={() => void removeSupplier()}>{saving ? t("Deleting…") : t("Delete supplier")}</button></div></> : <><h2 id="supplier-dialog-title">{t(dialog === "edit" ? "Edit supplier" : "Add supplier")}</h2><p>{t("Supplier name, address and phone are required by the pharmacy backend.")}</p><form className="supplier-form" onSubmit={(event) => void submit(event)}><label>{t("Supplier name")} <span>*</span><input autoFocus minLength={3} required value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder={t("Company or distributor")}/></label><label>{t("Supplier name in Bangla")} <small>{t("Optional")}</small><input value={form.nameBangla} onChange={(event) => updateForm("nameBangla", event.target.value)} placeholder="বাংলায় নাম"/></label><label className="supplier-form-wide">{t("Address")} <span>*</span><textarea required minLength={5} rows={2} value={form.address} onChange={(event) => updateForm("address", event.target.value)} placeholder={t("Street, area, district")}/></label><label>{t("Phone")} <span>*</span><input required minLength={10} type="tel" value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} placeholder="+880 1XXXXXXXXX"/></label><label>{t("Email")} <small>{t("Optional")}</small><input type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} placeholder="sales@supplier.com"/></label>{error && <div className="pos-dialog-error supplier-form-wide" role="alert">{error}</div>}<div className="supplier-dialog-actions supplier-form-wide"><button type="button" className="supplier-cancel" onClick={() => setDialog(null)}>{t("Cancel")}</button><button type="submit" className="purchase-primary-action" disabled={saving}>{saving ? t("Saving…") : t(dialog === "edit" ? "Save changes" : "Create supplier")}</button></div></form></>}</section></div>}
  </section>;
}
