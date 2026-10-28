"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertCircle, ArrowDownToLine, CalendarDays, ChevronDown, CircleDollarSign, FileBarChart2, RefreshCw, Search, TrendingDown, TrendingUp } from "lucide-react";
import { ApiClientError } from "@/lib/api/client";
import { getReport, type ReportKey } from "@/features/reports/report-service";
import { useActiveBranch } from "@/components/providers/active-branch-provider";

type Obj = Record<string, unknown>;
type Tab = { key: ReportKey; label: string; group: string };
const tabs: Tab[] = [
  { key: "overall", label: "Overview", group: "Summary" }, { key: "pharmacy-summary", label: "Pharmacy summary", group: "Summary" },
  { key: "sales", label: "Sales detail", group: "Pharmacy" }, { key: "purchases", label: "Purchase detail", group: "Pharmacy" }, { key: "dues", label: "Due collection", group: "Pharmacy" },
  { key: "income", label: "Income", group: "Finance" }, { key: "expense", label: "Expenses", group: "Finance" }, { key: "pharmacy-collection", label: "Pharmacy collection", group: "Finance" }, { key: "hospital-collection", label: "Hospital collection", group: "Finance" },
  { key: "doctors", label: "Doctors", group: "Clinical" },
];
const labels: Record<string, string> = { totalSales: "Total sales", totalPaid: "Collected", totalDues: "Outstanding dues", totalDiscount: "Discounts", totalReturned: "Returns", totalExpenses: "Expenses", totalPurchases: "Purchases", totalPurchasesPaid: "Purchase payments", grossProfit: "Gross profit", netProfit: "Net profit", totalCollection: "Net collection", totalPurchase: "Total purchases", purchaseDiscount: "Purchase discounts", netAmount: "Net amount", paid: "Paid", due: "Due", totalPatientVisited: "Visits", totalAppointmentSale: "Appointment sales", totalConsultationCharge: "Consultation charges", totalAmountDue: "Due", totalIncome: "Total income", totalExpense: "Total expenses" };
const currencyKeys = /amount|sales|paid|due|discount|profit|purchase|collection|expense|income|charge|return|commission|net/i;
const searchableReports = new Set<ReportKey>(["dues", "pharmacy-collection", "hospital-collection"]);
const reportSearchLabel = "Search invoices";
function record(v: unknown): v is Obj { return !!v && typeof v === "object" && !Array.isArray(v); }
function formatValue(key: string, value: unknown) { if (typeof value === "number" && currencyKeys.test(key)) return new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 2 }).format(value); if (typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value)) return new Date(value).toLocaleDateString("en-GB"); return String(value ?? "—"); }
function title(key: string) { return labels[key] || key.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").replace(/^./, (s) => s.toUpperCase()); }
function metricRows(summary: unknown): [string, unknown][] { if (!record(summary)) return []; const rows: [string, unknown][] = []; for (const [key, value] of Object.entries(summary)) { if (typeof value === "number" && Number.isFinite(value)) rows.push([key, value]); else if (record(value)) for (const [child, amount] of Object.entries(value)) if (typeof amount === "number" && Number.isFinite(amount)) rows.push([child, amount]); } return rows.slice(0, 8); }
function collectTables(value: unknown, path = "", depth = 0, out: { name: string; rows: Obj[] }[] = []): typeof out { if (depth > 5 || value == null) return out; if (Array.isArray(value)) { const rows = value.filter(record); if (rows.length) out.push({ name: path || "Records", rows }); return out; } if (record(value)) for (const [key, child] of Object.entries(value)) collectTables(child, path ? `${path} · ${title(key)}` : title(key), depth + 1, out); return out; }
function flatten(row: Obj): Obj { return Object.fromEntries(Object.entries(row).map(([k,v]) => [k, record(v) ? Object.values(v).filter(x=>typeof x!=="object").join(" · ") || JSON.stringify(v) : Array.isArray(v) ? `${v.length} items` : v])); }
function fail(e: unknown) { return e instanceof ApiClientError ? e.message : "Unable to load this report. Check your access and try again."; }

export function ReportsWorkspace() {
 const { activeBranchId: branchId, activeBranch } = useActiveBranch();
 const [tab,setTab]=useState<ReportKey>("overall"); const [data,setData]=useState<unknown>(null); const [startDate,setStartDate]=useState(""); const [endDate,setEndDate]=useState(""); const [search,setSearch]=useState(""); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
 const load=useCallback(async()=>{setLoading(true);try{setError("");if(tab==="overall"&&Boolean(startDate)!==Boolean(endDate)){setError("Choose both a start and end date for the overall summary report.");return;}setData(await getReport(tab,{branchId,startDate,endDate,searchTerm:searchableReports.has(tab)?search.trim()||undefined:undefined}));}catch(e){setError(fail(e));}finally{setLoading(false);}},[branchId,endDate,search,startDate,tab]);
 useEffect(()=>{const timer=window.setTimeout(()=>{void load();},100);return()=>window.clearTimeout(timer);},[load]);
 const payload=record(data)&&"data" in data?data.data:data; const summary=record(payload)&&"summary" in payload?payload.summary:payload; const metrics=useMemo(()=>metricRows(summary),[summary]); const tables=useMemo(()=>collectTables(payload).filter((t)=>t.rows.length>0),[payload]);
 function exportCsv(){
  const summaryRows:Obj[]=metrics.map(([key,value])=>({Report:"Summary",Metric:title(key),Value:formatValue(key,value)}));
  const rows:Obj[]=[...summaryRows,...tables.flatMap((table)=>table.rows.map((row)=>({Report:table.name,...flatten(row)})))];
  if(!rows.length)return;
  const cols=Array.from(new Set(rows.flatMap((row)=>Object.keys(row))));
  const quote=(value:unknown)=>{
   const text=String(value??"");
   const safeText=/^[\s]*[=+@\-\t\r]/.test(text)?`'${text}`:text;
   return `"${safeText.replaceAll('"','""')}"`;
  };
  const csv="\uFEFF"+[cols.map(quote).join(","),...rows.map((row)=>cols.map((column)=>quote(row[column])).join(","))].join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  const link=document.createElement("a");link.href=url;link.download=`pharmacy-${tab}-${startDate||"all"}.csv`;link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 const active=tabs.find((x)=>x.key===tab)!;
 return <section className="reports-page"><div className="page-heading-row"><div><p className="eyebrow">ANALYTICS · OPERATIONS</p><h1>Reports</h1><p className="page-subtitle">Explore pharmacy performance, collections, expenses and doctor activity.</p></div><div className="reports-heading-actions"><button className="purchase-save-pending" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/> Refresh</button><button className="purchase-primary-action" onClick={exportCsv} disabled={!tables[0]?.rows.length}><ArrowDownToLine size={15}/> Export CSV</button></div></div>
 <div className="reports-filterbar panel"><label><CalendarDays size={15}/><span>From</span><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} max={endDate||undefined}/></label><label><CalendarDays size={15}/><span>To</span><input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} min={startDate||undefined}/></label>{searchableReports.has(tab)&&<label className="reports-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={reportSearchLabel}/></label>}<button className="reports-clear" onClick={()=>{setStartDate("");setEndDate("");setSearch("");}}>Clear</button></div>
 <div className="reports-layout"><aside className="reports-nav panel">{["Summary","Pharmacy","Finance","Clinical"].map(group=><div className="reports-nav-group" key={group}><span>{group}</span>{tabs.filter(t=>t.group===group).map(t=><button key={t.key} className={tab===t.key?"selected":""} onClick={()=>setTab(t.key)}>{t.key==="overall"?<Activity size={15}/>:t.group==="Finance"?<CircleDollarSign size={15}/>:t.group==="Clinical"?<TrendingUp size={15}/>:<FileBarChart2 size={15}/>}<span>{t.label}</span></button>)}</div>)}</aside>
 <div className="reports-content"><div className="reports-report-title"><div><span className="eyebrow">{active.group.toUpperCase()} REPORT</span><h2>{active.label}</h2><p>{startDate||endDate?`${startDate||"Beginning"} — ${endDate||"Today"}`:"All available dates"}{branchId ? ` · ${activeBranch?.name||"Selected branch"}` : " · No branch selected"}</p></div><div className="reports-period-badge"><TrendingUp size={15}/><span>Live report</span></div></div>
 {error&&<div className="sales-alert error"><AlertCircle size={15}/><span>{error}</span><button onClick={()=>void load()}>Retry</button></div>}
 {metrics.length>0&&<div className="reports-metrics">{metrics.map(([key,value],i)=><article className="panel" key={`${key}-${i}`}><span className={`reports-metric-icon tone-${i%4}`}>{i===2?<TrendingDown size={16}/>:<CircleDollarSign size={16}/>}</span><small>{title(key)}</small><strong>{formatValue(key,value)}</strong></article>)}</div>}
 {loading&&<div className="data-loading reports-loading">Loading {active.label.toLowerCase()}…</div>}
 {data!==null&&tables.map((table,i)=>{const rows=table.rows.map(flatten);const columns=Array.from(new Set(rows.flatMap(r=>Object.keys(r)))).slice(0,8);return <section className="reports-table-card panel" key={`${table.name}-${i}`}><div className="reports-table-heading"><div><h3>{table.name}</h3><span>{rows.length} records</span></div>{i===0&&<button onClick={exportCsv}><ArrowDownToLine size={13}/> CSV</button>}</div><div className="reports-table-scroll"><table><thead><tr>{columns.map(c=><th key={c}>{title(c)}</th>)}</tr></thead><tbody>{rows.slice(0,100).map((row,ri)=><tr key={ri}>{columns.map(col=><td key={col}>{formatValue(col,row[col])}</td>)}</tr>)}</tbody></table></div>{rows.length>100&&<p className="reports-truncated">Showing first 100 of {rows.length} records. Narrow the date range to export a smaller report.</p>}</section>;})}
 {!loading&&!error&&metrics.length===0&&tables.length===0&&<div className="data-empty reports-empty"><FileBarChart2 size={23}/><strong>No report data for this selection</strong><span>Try a wider date range or another branch.</span></div>}{loading&&data!==null&&<p className="reports-refreshing" role="status">Updating report…</p>}
 </div></div></section>;
}

