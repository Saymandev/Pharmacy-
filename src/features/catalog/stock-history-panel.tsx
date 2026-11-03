"use client";

import { FilterPopover } from "@/components/ui/filter-popover";
import { Select } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api/client";
import { readPagination } from "@/lib/api/pagination";
import { useLanguage } from "@/lib/i18n/language-provider";

type Movement = {
  id: string; createdAt: string; type: string; stockChangeType: string;
  quantity: number; quantityDelta: number | null; note: string | null;
  medicine?: { name: string }; stock?: { batchNumber: string; unit: string };
  branch?: { name: string }; targetBranch?: { name: string } | null;
};
const initialFilters = { search: "", batchNumber: "", type: "", stockChangeType: "", startDate: "", endDate: "" };

export function StockHistoryPanel({ branchId }: { branchId: string }) {
  const { t, language } = useLanguage();
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [rows, setRows] = useState<Movement[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    if (!branchId) return;
    queueMicrotask(() => {
      if (!controller.signal.aborted) { setRows([]); setError(""); setLoading(true); }
    });
    const query = new URLSearchParams({ branchId, page: String(page), limit: "25" });
    for (const [key, value] of Object.entries(filters)) if (value.trim()) query.set(key, value.trim());
    void api.getWithMeta<{ data: Movement[] }>(`/pharmacy/stocks/history?${query}`, { signal: controller.signal })
      .then(result => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(result.data)) throw new Error("Invalid stock history response");
        const movements = result.data;
        const pagination = readPagination(result, movements.length, page, 25);
        setMeta(pagination);
        if (page > pagination.totalPages) { setPage(pagination.totalPages); return; }
        setRows(movements);
      })
      .catch(cause => {
        if (!controller.signal.aborted) {
          setRows([]); setMeta({ total: 0, totalPages: 1 });
          setError(cause instanceof ApiClientError ? cause.message : "Could not load stock history.");
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [branchId, filters, page, refresh]);

  const field = (key: keyof typeof draft, value: string) => setDraft(current => ({ ...current, [key]: value }));
  const invalidDates = !!(draft.startDate && draft.endDate && draft.startDate > draft.endDate);
  return <section className="data-card panel stock-history-panel" aria-label={t("Stock history")}>
    <div className="panel-heading"><div><h2>{t("Stock history")}</h2><p>{t("Recorded movements for the selected branch. Dates use Asia/Dhaka.")}</p></div></div>
    <FilterPopover><form className="data-filter-drawer" onSubmit={event => { event.preventDefault(); if (!invalidDates) { setPage(1); setFilters({ ...draft }); } }}>
      <label>{t("Medicine")}<input value={draft.search} onChange={event => field("search", event.target.value)} /></label>
      <label>{t("Batch number")}<input value={draft.batchNumber} onChange={event => field("batchNumber", event.target.value)} /></label>
      <label>{t("Direction")}<Select aria-label={t("Direction")} value={draft.type} onChange={event => field("type", event.target.value)}><option value="">{t("All directions")}</option><option value="in">{t("Stock in")}</option><option value="out">{t("Stock out")}</option></Select></label>
      <label>{t("Movement type")}<Select aria-label={t("Movement type")} value={draft.stockChangeType} onChange={event => field("stockChangeType", event.target.value)}><option value="">{t("All movements")}</option>{["opening-stock", "purchase", "sale", "transfer", "adjust", "sale-return", "purchase-return"].map(type => <option key={type} value={type}>{t(type)}</option>)}</Select></label>
      <label>{t("From date")}<input type="date" value={draft.startDate} onChange={event => field("startDate", event.target.value)} /></label>
      <label>{t("To date")}<input type="date" value={draft.endDate} onChange={event => field("endDate", event.target.value)} /></label>
      <button type="submit" disabled={invalidDates || !branchId}>{t("Apply filters")}</button>
      <button type="button" onClick={() => { setDraft(initialFilters); setFilters(initialFilters); setPage(1); }}>{t("Clear filters")}</button>
      <button type="button" disabled={loading || !branchId} onClick={() => setRefresh(current => current + 1)}>{t("Refresh")}</button>
    </form></FilterPopover>
    {invalidDates && <p role="alert">{t("Start date must be on or before end date.")}</p>}
    {error && <div className="data-alert" role="alert"><span>{t(error)}</span><button type="button" onClick={() => setRefresh(current => current + 1)}>{t("Retry")}</button></div>}
    {!branchId ? <div className="data-empty">{t("Select a branch to view stock history.")}</div> : loading ? <div className="data-loading" role="status">{t("Loading stock history…")}</div> : !error && <>
      <div className="data-table-scroll"><table className="data-table"><thead><tr>{["Date", "Medicine", "Batch number", "Movement type", "Quantity change", "Branch", "Other branch", "Note"].map(label => <th key={label}>{t(label)}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id}>
        <td data-label={t("Date")}>{new Date(row.createdAt).toLocaleString(language === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka" })}</td>
        <td data-label={t("Medicine")}>{row.medicine?.name ?? "—"}</td><td data-label={t("Batch number")}>{row.stock?.batchNumber ?? "—"}</td>
        <td data-label={t("Movement type")}><span>{t(row.stockChangeType)}<small>{t(row.type === "in" ? "Stock in" : row.type === "out" ? "Stock out" : row.type)}</small></span></td>
        <td data-label={t("Quantity change")}><span><strong>{row.quantityDelta === null ? "—" : `${row.quantityDelta > 0 ? "+" : ""}${row.quantityDelta}`}</strong> {row.stock?.unit}</span></td>
        <td data-label={t("Branch")}>{row.branch?.name ?? "—"}</td><td data-label={t("Other branch")}>{row.targetBranch?.name ?? "—"}</td><td data-label={t("Note")}>{row.note || "—"}</td>
      </tr>)}</tbody></table></div>
      {!rows.length && <div className="data-empty">{t(branchId ? "No stock movements found." : "Select a branch to view stock history.")}</div>}
      <div className="data-pagination"><span>{t("Showing page")} {page} {t("of")} {meta.totalPages} · {meta.total} {t("records")}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(current => current - 1)}>{t("Previous")}</button><button type="button" disabled={page >= meta.totalPages} onClick={() => setPage(current => current + 1)}>{t("Next")}</button></div></div>
    </>}
    <p className="page-subtitle">{t("Historical balances, actors and document references were not recorded. Batch details reflect the current stock record.")}</p>
  </section>;
}
