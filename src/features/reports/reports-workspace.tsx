"use client";
import { DataSkeleton } from "@/components/ui/skeleton";

import { FilterPopover } from "@/components/ui/filter-popover";
import { Select } from "@/components/ui/select";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowDownToLine, CalendarDays, FileBarChart2, Printer, RefreshCw } from "lucide-react";
import { ApiClientError } from "@/lib/api/client";
import { getReport, type ReportKey, type ReportParams } from "./report-service";
import { buildReportModel, formatReportValue, isMoneyColumn, reportCsv, reportDateError, reportDateRange, reportLabel, type DatePreset, type ReportModel, type ReportMetric, type ReportTable } from "./report-model";
import { useActiveBranch } from "@/components/providers/active-branch-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { useLanguage } from "@/lib/i18n/language-provider";

import { downloadReportPdf } from "./report-pdf";

const tabs: { key: ReportKey; label: string; group: string; note: string }[] = [
 {key:"pharmacy-summary",label:"Pharmacy summary",group:"Summary",note:"Completed/returned POS sales, purchases, expenses and cost of goods for this selection. Invoice Paid/Due is measured at period end. Collections follow receipt dates; applying advance is not a new receipt."},
 {key:"overall",label:"All operations overview",group:"Summary",note:"Account movements include recorded advances and supplier refunds. Branch views exclude unassigned manual movements. Sales less purchases and invoice payment surplus are not accounting profit. Cash follows transaction dates; invoice totals follow creation dates."},
 {key:"sales",label:"Sales detail",group:"Pharmacy",note:"POS sales by invoice date. Paid/Due is measured at period end. Collections include receipts against older invoices, by payment date; refunds use the actual money refunded."},
 {key:"purchases",label:"Purchase detail",group:"Pharmacy",note:"Pharmacy purchases with their return and payment totals."},
 {key:"dues",label:"Due collection",group:"Pharmacy",note:"Payments collected on a later Dhaka calendar day than the original sale. Filter dates refer to the collection, not the sale."},
 {key:"income",label:"Income",group:"Finance",note:"Completed/returned POS invoices with Paid/Due at period end. Collections follow payment dates and include older invoice receipts."},
 {key:"expense",label:"Expenses",group:"Finance",note:"Expenses grouped by category and filtered by expense date."},
 {key:"pharmacy-collection",label:"Pharmacy collection",group:"Finance",note:"POS receipts and refunds grouped by invoice. Dates refer to payment transactions."},
];
const searchable=new Set<ReportKey>(["dues","pharmacy-collection","hospital-collection"]);
type Filters={startDate:string;endDate:string;scope:string;search:string;type:string};
const initialFilters=():Filters=>({...reportDateRange("today"),scope:"active",search:"",type:"pos"});

function downloadCsv(model:ReportModel,context:Record<string,unknown>,filename:string){
 const csv=reportCsv(model,context);if(!csv)return;
 const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
 const link=document.createElement("a");link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function ReportTableView({table,locale,onExport,canExport}:{table:ReportTable;locale:string;onExport:()=>void;canExport:boolean}){
 const {t}=useLanguage();
 const [page,setPage]=useState(1);const [pageSize,setPageSize]=useState(50);
 const pages=Math.max(1,Math.ceil(table.rows.length/pageSize));const current=Math.min(page,pages);
 const renderRows=(rows:typeof table.rows)=>rows.map((row,index)=><tr key={index}>{table.columns.map(column=><td key={column} className={isMoneyColumn(column)?"report-number":undefined}>{formatReportValue(column,row[column],locale)}</td>)}</tr>);
 const heading=<thead><tr>{table.columns.map(column=><th key={column} scope="col" className={isMoneyColumn(column)?"report-number":undefined}>{t(reportLabel(column))}</th>)}</tr></thead>;
 return <section className="reports-table-card panel" aria-label={t(table.name)}><div className="reports-table-heading"><div><h3>{t(table.name)}</h3><span>{table.rows.length} {t("records")}</span></div><button onClick={onExport} disabled={!canExport} type="button"><ArrowDownToLine size={13}/>{t("Export this table")}</button></div>
  <div className="reports-table-scroll reports-screen-table"><table>{heading}<tbody>{renderRows(table.rows.slice((current-1)*pageSize,current*pageSize))}</tbody></table></div>
  <div className="reports-print-table"><table>{heading}<tbody>{renderRows(table.rows)}</tbody></table></div>
  {table.totals.length>0&&<dl className="reports-subtotals" aria-label={t("Group totals")}>{table.totals.map(metric=><div key={metric.key}><dt>{t(metric.label)}</dt><dd>{formatReportValue(metric.key,metric.value,locale)}</dd></div>)}</dl>}
  <nav className="reports-table-pagination" aria-label={`${t(table.name)} pagination`}><span>{(current-1)*pageSize+1}–{Math.min(current*pageSize,table.rows.length)}{t("of")} {table.rows.length}</span><label>{t("Rows per page")}<Select aria-label={t("Rows per page")} value={pageSize} onChange={event=>{setPageSize(Number(event.target.value));setPage(1);}}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></Select></label><div><button type="button" disabled={current===1} onClick={()=>setPage(current-1)}>{t("Previous")}</button><span>{t("Page")} {current} / {pages}</span><button type="button" disabled={current===pages} onClick={()=>setPage(current+1)}>{t("Next")}</button></div></nav>
 </section>;
}

export function ReportsWorkspace(){
 const {hasPermission}=useAuth();const canRead=hasPermission("report:read");
 const {activeBranchId,activeBranch,branches,branchesLoading}=useActiveBranch();
 const {language,t}=useLanguage();const locale=language==="bn"?"bn-BD":"en-BD";
 const [tab,setTab]=useState<ReportKey>("pharmacy-summary");
 const [draft,setDraft]=useState<Filters>(initialFilters);const [applied,setApplied]=useState<Filters>(initialFilters);
 const [preset,setPreset]=useState("today");const [filterError,setFilterError]=useState("");const [refresh,setRefresh]=useState(0);
 const [result,setResult]=useState<{key:string;data:unknown;at:string}|null>(null);
 const [failure,setFailure]=useState<{key:string;message:string}|null>(null);
 const branchId=applied.scope==="active"?activeBranchId:applied.scope==="all"?"":applied.scope;
 const branchName=applied.scope==="all"?"All available branches":applied.scope==="active"?activeBranch?.name??"Active branch":branches.find(branch=>branch.id===branchId)?.name??"Selected branch";
 const params:ReportParams=useMemo(()=>({branchId:branchId||undefined,startDate:applied.startDate||undefined,endDate:applied.endDate||undefined,searchTerm:searchable.has(tab)?applied.search.trim()||undefined:undefined,type:tab==="income"?applied.type||undefined:undefined}),[applied,branchId,tab]);
 const requestKey=JSON.stringify({tab,params,refresh});
 const ready=canRead&&!branchesLoading&&(applied.scope==="all"||!!branchId);
 useEffect(()=>{
  if(!ready)return;
  const controller=new AbortController();
  const timer=window.setTimeout(()=>{
   void getReport(tab,params,controller.signal).then(data=>{
    if(!controller.signal.aborted)setResult({key:requestKey,data,at:new Date().toISOString()});
   }).catch(cause=>{
    if(!controller.signal.aborted)setFailure({key:requestKey,message:cause instanceof ApiClientError?cause.message:"Unable to load this report. Please retry."});
   });
  },120);
  return ()=>{window.clearTimeout(timer);controller.abort();};
 },[params,ready,requestKey,tab]);
 const current=result?.key===requestKey?result:null;
 const error=failure?.key===requestKey?failure.message:"";
 const loading=ready&&!current&&!error;
 const model=useMemo(()=>buildReportModel(current?.data),[current]);
 const metricGroups=useMemo(()=>{const groups=new Map<string,ReportMetric[]>();for(const metric of model.metrics){const group=metric.key.includes('.')?metric.key.split('.')[0]:'Key figures';groups.set(group,[...(groups.get(group)??[]),metric]);}return [...groups.entries()].sort(([a],[b])=>a==="Key figures"?-1:b==="Key figures"?1:0);},[model]);
 const comparable=(value:Filters)=>({...value,search:searchable.has(tab)?value.search:"",type:tab==="income"?value.type:"pos"});
 const dirty=JSON.stringify(comparable(draft))!==JSON.stringify(comparable(applied));
 const canExport=ready&&!!current&&!error&&!dirty&&(model.metrics.length>0||model.tables.length>0);
 const [pdfBusy,setPdfBusy]=useState(false),[pdfError,setPdfError]=useState("");
 const pdfLock=useRef(false);
 const active=tabs.find(item=>item.key===tab)!;
 const context={Report:active.label,Branch:branchName,From:applied.startDate||"All dates",To:applied.endDate||"All dates",Search:searchable.has(tab)?applied.search:"",Type:tab==="income"?applied.type:"pos",Generated:current?.at??""};
 const filename=`pharmacy-${tab}-${applied.startDate||"all"}-${applied.endDate||"all"}.csv`;
 async function downloadPdf(){if(!canExport||pdfLock.current)return;pdfLock.current=true;setPdfBusy(true);setPdfError("");try{await downloadReportPdf(model,{title:t(active.label),branch:branchName,startDate:applied.startDate,endDate:applied.endDate,generated:current!.at,search:searchable.has(tab)?applied.search:"",type:tab==="income"?applied.type:undefined,language},filename.replace(/\.csv$/,".pdf"),t);}catch{setPdfError(t("PDF could not be created. Please try again."));}finally{pdfLock.current=false;setPdfBusy(false);}}
 function apply(event:React.FormEvent){event.preventDefault();const message=reportDateError(draft.startDate,draft.endDate);setFilterError(message);if(!message){setApplied({...draft});setRefresh(value=>value+1);}}
 function applyQuickPeriod(value:DatePreset){const range=reportDateRange(value);setPreset(value);setDraft(current=>({...current,...range}));setApplied(current=>({...current,...range}));setFilterError("");setRefresh(current=>current+1);}
 function choosePreset(value:string){setPreset(value);if(value!=="custom"){setDraft(current=>({...current,...reportDateRange(value as DatePreset)}));setFilterError("");}}
 if(!canRead)return <section className="reports-page"><h1>{t("Reports")}</h1><div className="data-empty"><AlertCircle/><strong>{t("Your role cannot view reports.")}</strong><span>{t("Ask an administrator for report access.")}</span></div></section>;
 return <section className="reports-page"><div className="page-heading-row"><div><p className="eyebrow">{t("ANALYTICS · OPERATIONS")}</p><h1>{t("Reports")}</h1><p className="page-subtitle">{t("Review saved sales, collections, costs and operational totals.")}</p></div><div className="reports-heading-actions"><FilterPopover><form className="reports-filterbar panel" onSubmit={apply} aria-label={t("Report filters")}>
  <label><CalendarDays size={15}/>{t("Period")}<Select aria-label={t("Period")} value={preset} onChange={event=>choosePreset(event.target.value)}><option value="today">{t("Today")}</option><option value="yesterday">{t("Yesterday")}</option><option value="last7">{t("Last 7 days")}</option><option value="thisMonth">{t("This month")}</option><option value="lastMonth">{t("Last month")}</option><option value="all">{t("All dates")}</option><option value="custom">{t("Custom dates")}</option></Select></label>
  <label>{t("From")}<input type="date" value={draft.startDate} max={draft.endDate||undefined} onChange={event=>{setPreset("custom");setDraft({...draft,startDate:event.target.value});}}/></label>
  <label>{t("To")}<input type="date" value={draft.endDate} min={draft.startDate||undefined} onChange={event=>{setPreset("custom");setDraft({...draft,endDate:event.target.value});}}/></label>
  <label>{t("Branch")}<Select aria-label={t("Branch")} value={draft.scope} onChange={event=>setDraft({...draft,scope:event.target.value})}><option value="active">{t("Active:")} {activeBranch?.name??"Select branch"}</option><option value="all">{t("All available branches")}</option>{branches.map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></label>
  {searchable.has(tab)&&<label className="reports-search">{t("Invoice search")}<input value={draft.search} onChange={event=>setDraft({...draft,search:event.target.value})} placeholder={t("Invoice number")}/></label>}
  {tab==="income"&&<label>{t("Sale type")}<Select aria-label={t("Sale type")} value={draft.type} onChange={event=>setDraft({...draft,type:event.target.value})}>{["pos"].map(type=><option value={type} key={type}>{type}</option>)}</Select></label>}
  <button className="purchase-primary-action" type="submit">{t("Apply filters")}</button><button className="reports-clear" type="button" onClick={()=>{const next=initialFilters();setDraft(next);setApplied(next);setPreset("today");setFilterError("");setRefresh(value=>value+1);}}>{t("Reset to today")}</button>
  {filterError&&<p className="reports-filter-message" role="alert">{filterError}</p>}{dirty&&!filterError&&<p className="reports-filter-message" role="status">{t("Filters changed. Apply them to update the report and export.")}</p>}
 </form></FilterPopover><button type="button" className="purchase-save-pending" onClick={()=>setRefresh(value=>value+1)} disabled={loading||!ready||dirty}><RefreshCw size={14}/>{t("Refresh")}</button><button type="button" className="purchase-primary-action" aria-busy={pdfBusy} onClick={()=>void downloadPdf()} disabled={!canExport||pdfBusy}><ArrowDownToLine size={15}/>{t(pdfBusy?"Preparing PDF…":"Download PDF")}</button><button type="button" className="purchase-save-pending" onClick={()=>window.print()} disabled={!canExport}><Printer size={14}/>{t("Print report")}</button><button type="button" className="purchase-save-pending" onClick={()=>downloadCsv(model,context,filename)} disabled={!canExport}><ArrowDownToLine size={15}/>{t("Export CSV")}</button></div></div>

 {pdfError&&<div className="sales-alert error" role="alert"><AlertCircle size={15}/><span>{pdfError}</span><button type="button" disabled={pdfBusy||!canExport} onClick={()=>void downloadPdf()}>{t("Retry")}</button></div>}
 <section className="reports-selection-bar" aria-label={t("Report selection")}><div className="reports-current-scope"><CalendarDays size={17}/><div><strong>{applied.startDate?`${applied.startDate} — ${applied.endDate}`:t("All available dates")}</strong><span>{t("Branch")}: <b>{t(branchName)}</b></span></div></div><div className="reports-quick-periods" role="group" aria-label={t("Quick period")}>{([{key:"today",label:"Today"},{key:"last7",label:"Last 7 days"},{key:"thisMonth",label:"This month"},{key:"all",label:"All dates"}] as const).map(item=>{const range=reportDateRange(item.key);return <button type="button" key={item.key} aria-pressed={applied.startDate===range.startDate&&applied.endDate===range.endDate} onClick={()=>applyQuickPeriod(item.key)}>{t(item.label)}</button>;})}</div></section>
 <div className="reports-layout"><label className="reports-mobile-type">{t("Report type")}<Select aria-label={t("Report type")} value={tab} onChange={event=>{setTab(event.target.value as ReportKey);setFilterError("");}}>{tabs.map(item=><option key={item.key} value={item.key}>{t(item.label)}</option>)}</Select></label><aside className="reports-nav panel" aria-label={t("Report types")}>{["Summary","Pharmacy","Finance"].map(group=><div className="reports-nav-group" key={t(group)}><span>{t(group)}</span>{tabs.filter(item=>item.group===group).map(item=><button type="button" key={item.key} className={tab===item.key?"selected":""} aria-pressed={tab===item.key} onClick={()=>{setTab(item.key);setFilterError("");}}><FileBarChart2 size={15}/><span>{t(item.label)}</span></button>)}</div>)}</aside>
 <div className="reports-content reports-print-view" aria-busy={loading}><div className="reports-report-title"><div><span className="eyebrow">{t(active.group)} · {t("Report")}</span><h2>{t(active.label)}</h2><p>{applied.startDate?`${applied.startDate} — ${applied.endDate}`:t("All available dates")} · {branchName}</p>{searchable.has(tab)&&applied.search&&<p>{t("Invoice search:")} {applied.search}</p>}{tab==="income"&&applied.type&&<p>{t("Sale type:")} {applied.type}</p>}{current&&<small>{t("Loaded")} {new Date(current.at).toLocaleString(locale,{timeZone:"Asia/Dhaka"})}{t("· Asia/Dhaka")}</small>}</div></div><details className="reports-definition"><summary>{t("How this report is calculated")}</summary><p>{t(active.note)}</p></details>
 {error&&<div className="sales-alert error" role="alert"><AlertCircle size={15}/><span>{error}</span><button type="button" onClick={()=>setRefresh(value=>value+1)}>{t("Retry")}</button></div>}
 {!ready&&<div className="data-empty"><span>{branchesLoading?t("Loading branches…"):t("Select an available branch, or apply All available branches.")}</span></div>}
 {loading&&<DataSkeleton variant="report">{t("Loading")} {active.label.toLowerCase()}…</DataSkeleton>}
 {current&&!error&&<>{model.metrics.length>0&&model.metrics.every(metric=>metric.value===0)&&model.tables.every(table=>table.rows.length===0)&&<div className="reports-no-activity" role="status"><FileBarChart2 size={19}/><div><strong>{t("No activity in this period")}</strong><span>{t("These totals are for the selected dates and branch. Try a wider period to see older activity.")}</span></div>{applied.startDate&&<button type="button" onClick={()=>applyQuickPeriod("all")}>{t("Show all dates")}</button>}</div>}<div className="reports-metrics">{metricGroups.map(([group,metrics])=><section className="reports-metric-group" data-group={group} data-count={metrics.length} key={group}><h3>{t(reportLabel(group))}</h3><div className="reports-metric-grid">{metrics.map(metric=><article className="panel" data-negative={metric.value<0||undefined} key={metric.key}><small>{t(group==="Key figures"?metric.label:metric.label.split(" · ").slice(1).join(" · "))}</small><strong>{formatReportValue(metric.key,metric.value,locale)}</strong></article>)}</div></section>)}</div>
 {model.tables.map(table=><ReportTableView key={`${requestKey}:${table.id}`} table={table} locale={locale} canExport={canExport} onExport={()=>downloadCsv({metrics:[],tables:[table]},context,filename.replace('.csv',`-${table.id.replace(/[^a-z0-9]/gi,'-')}.csv`))}/>)}
 {model.metrics.length===0&&model.tables.length===0&&<div className="data-empty reports-empty"><FileBarChart2 size={23}/><strong>{t("No report data for this selection")}</strong><span>{t("Try another period or branch.")}</span>{applied.startDate&&<button type="button" className="purchase-save-pending" onClick={()=>applyQuickPeriod("all")}>{t("Show all dates")}</button>}</div>}</>}
 </div></div></section>;
}
