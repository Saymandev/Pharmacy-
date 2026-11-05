"use client";
import { DataSkeleton } from "@/components/ui/skeleton";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Edit3, Plus, Search, Trash2, X } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/components/providers/auth-provider";
import { useLanguage } from "@/lib/i18n/language-provider";

type Entity = "categories" | "generics" | "manufacturers" | "groups" | "units";
type Item = { id: string; name: string; nameBangla?: string; medicineCount?: number; _count?: Record<string, number> };
type ApiEnvelope = { data?: unknown; meta?: { totalItems?: number; totalPages?: number } };

const tabs: { id: Entity; label: string; singular: string; permission: string }[] = [
  { id: "categories", label: "Categories", singular: "Category", permission: "medicine-category" },
  { id: "generics", label: "Generics", singular: "Generic", permission: "medicine-generic" },
  { id: "manufacturers", label: "Manufacturers", singular: "Manufacturer", permission: "medicine-manufacturer" },
  { id: "groups", label: "Medicine groups", singular: "Medicine group", permission: "medicine-group" },
  { id: "units", label: "Units", singular: "Unit", permission: "medicine-unit" },
];

function asItems(value: unknown): Item[] {
  if (Array.isArray(value)) return value as Item[];
  if (value && typeof value === "object" && Array.isArray((value as ApiEnvelope).data)) {
    return (value as { data: Item[] }).data;
  }
  return [];
}

function errorMessage(error: unknown) {
  return error instanceof ApiClientError ? error.message : "Could not save this catalog setting.";
}

export function CatalogSetupWorkspace() {
  const { hasPermission } = useAuth();
  const { t } = useLanguage();
  const [entity, setEntity] = useState<Entity>("categories");
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalItems: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState(false);
  const [formEntity,setFormEntity]=useState<Entity>("categories");
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", nameBangla: "" });
  const readableTabs=useMemo(()=>tabs.filter(tab=>hasPermission(`${tab.permission}:read`)),[hasPermission]);
  const activeTab=useMemo(()=>readableTabs.find(tab=>tab.id===entity)??readableTabs[0]??tabs[0],[readableTabs,entity]);
  const activeEntity=activeTab.id;
  const canRead=readableTabs.length>0;
  const mutationLock=useRef(false),requestId=useRef(0);

  const load = useCallback(async (targetPage = page) => {
    if(!canRead){setLoading(false);return;}
    const request=++requestId.current;
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ page: String(targetPage), limit: "20" });
    if (search.trim()) query.set("search", search.trim());
    try {
      const response = await api.getWithMeta<unknown>(`/pharmacy/${activeEntity}?${query.toString()}`);
      if(request!==requestId.current)return;
      const nextItems = asItems(response);
      setItems(nextItems);
      const meta = response && typeof response === "object" ? (response as ApiEnvelope).meta : undefined;
      const totalItems = Math.max(Number(meta?.totalItems) || 0, nextItems.length);
      setPagination({ totalItems, totalPages: Math.max(1, Number(meta?.totalPages) || Math.ceil(totalItems / 20) || 1) });
    } catch (cause) {
      if(request!==requestId.current)return;
      setItems([]);
      setPagination({ totalItems: 0, totalPages: 1 });
      setError(errorMessage(cause));
    } finally {
      if(request===requestId.current)setLoading(false);
    }
  }, [activeEntity,canRead, page, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [load]);

  function open(item?: Item) {
    setError("");
    setFormEntity(activeEntity);
    setEditing(item?.id ?? null);
    setForm({ name: item?.name ?? "", nameBangla: item?.nameBangla ?? "" });
    setDialog(true);
  }

  async function save() {
    if(mutationLock.current||!canRead||!hasPermission(`${activeTab.permission}:${editing?"update":"create"}`))return;
    if(formEntity!==activeEntity){setError(t("The settings tab changed. Close and reopen this form."));return;}
    const name = form.name.trim();
    const nameBangla = form.nameBangla.trim();
    if (!name) { setError(t("Name is required.")); return; }
    if (name.length > 100 || nameBangla.length > 150) { setError(t("Name must be at most 100 characters; Bangla name can be at most 150.")); return; }

    mutationLock.current=true;setSaving(true);
    setError("");
    try {
      const body = { name, nameBangla: nameBangla || undefined };
      if (editing) await api.patch(`/pharmacy/${activeEntity}/${editing}`, body);
      else await api.post(`/pharmacy/${activeEntity}`, body);
      setDialog(false);
      setNotice(`${t(activeTab.singular)} ${t(editing ? "updated" : "created")}.`);
      if (page === 1) await load(1);
      else setPage(1);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      mutationLock.current=false;setSaving(false);
    }
  }

  async function remove(item: Item) {
    if(mutationLock.current||!canRead||!hasPermission(`${activeTab.permission}:delete`))return;
    if (!window.confirm(`${t("Delete")} “${item.name}”? ${t("The server may block removal if medicines reference it.")}`)) return;
    mutationLock.current=true;setSaving(true);
    setError("");
    try {
      await api.delete(`/pharmacy/${activeEntity}/${item.id}`);
      const targetPage = items.length === 1 && page > 1 ? page - 1 : page;
      setNotice(`${item.name} ${t("deleted")}.`);
      if (targetPage === page) await load(targetPage);
      else setPage(targetPage);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      mutationLock.current=false;setSaving(false);
    }
  }

  if(!canRead)return <section className="data-empty"><p>{t("Your role cannot view this page.")}</p></section>;
  return (
    <section className="data-page catalog-setup-page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">{t("PHARMACY")} · {t("CATALOG CONFIGURATION")}</p>
          <h1>{t("Catalog settings")}</h1>
          <p className="page-subtitle">{t("Keep medicine classification and units consistent for search, purchasing and point of sale.")}</p>
        </div>
        {hasPermission(`${activeTab.permission}:create`) && (
          <button className="purchase-primary-action" onClick={() => open()}><Plus size={15}/>{t("Add")} {t(activeTab.singular)}</button>
        )}
      </div>

      {(error || notice) && <div className={`sales-alert ${error ? "error" : "success"}`} role={error ? "alert" : "status"}>
        {error ? <AlertCircle size={15}/> : <Check size={15}/>}<span>{t(error || notice)}</span>
        <button type="button" onClick={() => { setError(""); setNotice(""); }} aria-label={t("Dismiss")}><X size={14}/></button>
      </div>}

      <div className="hr-card panel">
        <nav className="data-tabs hr-tabs catalog-setup-tabs" aria-label={t("Catalog configuration sections")}>
          {readableTabs.map((tab) => <button type="button" key={tab.id} className={activeEntity === tab.id ? "selected" : ""} aria-current={activeEntity === tab.id ? "page" : undefined} disabled={saving} onClick={() => { if(tab.id===activeEntity)return;requestId.current++;setItems([]);setLoading(true);setDialog(false);setError("");setNotice("");setPage(1); setEntity(tab.id); setSearch(""); }}>
            {t(tab.label)}
          </button>)}
        </nav>
        <div className="hr-toolbar">
          <div className="sales-search"><Search size={15}/><input aria-label={t("Search catalog settings")} value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder={`${t("Search")} ${t(activeTab.label)}…`}/></div>
          {search && <button type="button" className="purchase-save-pending" onClick={() => { setPage(1); setSearch(""); }}>{t("Clear search")}</button>}
          <span className="catalog-setup-total">{pagination.totalItems.toLocaleString("en-BD")} {t(activeTab.label)}</span>
        </div>

        <div className="hr-table-wrap">
          <table className="hr-table">
            <thead><tr><th>{t("Name")}</th><th>{t("Bangla name")}</th><th>{t("Linked medicines")}</th><th>{t("Actions")}</th></tr></thead>
            <tbody>{items.map((item) => <tr key={item.id}>
              <td><strong>{item.name}</strong></td>
              <td>{item.nameBangla || "—"}</td>
              <td>{item.medicineCount ?? (item._count ? Object.values(item._count).reduce((sum, count) => sum + Number(count || 0), 0) : "—")}</td>
              <td><div className="hr-row-actions">
                {hasPermission(`${activeTab.permission}:update`) && <button type="button" onClick={() => open(item)} aria-label={`${t("Edit")} ${item.name}`}><Edit3 size={13}/>{t("Edit")}</button>}
                {hasPermission(`${activeTab.permission}:delete`) && <button type="button" onClick={() => void remove(item)} disabled={saving} aria-label={`${t("Delete")} ${item.name}`}><Trash2 size={13}/>{t("Delete")}</button>}
              </div></td>
            </tr>)}</tbody>
          </table>
          {loading && <DataSkeleton variant="table">{t("Loading")} {t(activeTab.label)}…</DataSkeleton>}
          {!loading && !items.length && <div className="data-empty"><Search size={22}/><strong>{t("No matching catalog settings")}</strong><span>{t("Create an entry or adjust your search.")}</span></div>}
          {pagination.totalPages > 1 && <div className="data-pagination"><span>{t("Showing page")} {page} {t("of")} {pagination.totalPages} · {pagination.totalItems.toLocaleString("en-BD")} {t("records")}</span><div>
            <button type="button" disabled={loading || page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>{t("Previous")}</button>
            <button type="button" disabled={loading || page >= pagination.totalPages} onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}>{t("Next")}</button>
          </div></div>}
        </div>
      </div>

      {dialog && <div className="sales-backdrop" role="presentation" onClick={() => !saving && setDialog(false)}>
        <div className="supplier-dialog panel hr-dialog" role="dialog" aria-modal="true" aria-labelledby="catalog-setting-title" onClick={(event) => event.stopPropagation()}>
          <button className="purchase-close" type="button" onClick={() => !saving && setDialog(false)} aria-label={t("Close")}><X size={18}/></button>
          <h2 id="catalog-setting-title">{t(editing ? "Edit" : "Add")} {t(activeTab.singular)}</h2>
          <p>{t("Changes to these shared values affect the entire medicine catalog.")}</p>
          <label>{t("Name")}<input autoFocus maxLength={100} required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/></label>
          <label>{t("Bangla name")} <span className="form-optional">{t("Optional")}</span><input maxLength={150} value={form.nameBangla} onChange={(event) => setForm({ ...form, nameBangla: event.target.value })}/></label>
          {error && <div className="data-alert" role="alert"><AlertCircle size={15}/><span>{t(error)}</span></div>}
          <button className="purchase-primary-action full" type="button" disabled={saving || !hasPermission(`${activeTab.permission}:${editing ? "update" : "create"}`)} onClick={() => void save()}>
            {saving ? t("Saving…") : t(editing ? "Save changes" : "Create entry")}
          </button>
        </div>
      </div>}
    </section>
  );
}
