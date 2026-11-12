import {validCatalogPage,type CatalogMeta} from './catalog-contract.ts';
export const reportDatasets=['sales','purchases','collections','income','expense','movements'] as const;
export type ReportDataset=typeof reportDatasets[number];
export type ReportSelection={branchId:string;startDate:string;endDate:string;search:string};
export const reportPaths:Record<ReportDataset,string>={sales:'pharmacy/sales-report',purchases:'pharmacy/purchase-report',collections:'pharmacy/due-collection',income:'finance/income',expense:'finance/expense',movements:'finance/movements'};
export const reportTitles:Record<ReportDataset,string>={sales:'Sales detail',purchases:'Purchase detail',collections:'Due collection',income:'Operational income',expense:'Operational expenses',movements:'Account movements'};
export const reportColumns:Record<ReportDataset,string[]>={sales:['documentNumber','completedAt','net','paidAtEnd','dueReductionAtEnd','dueAtEnd'],purchases:['documentNumber','completedAt','net','paidAtEnd','dueReductionAtEnd','dueAtEnd'],collections:['documentNumber','eventAt','classification','flowType','amount','paymentMethod'],income:['documentNumber','eventAt','documentDate','event','amount','note'],expense:['documentNumber','eventAt','documentDate','event','amount','note'],movements:['documentNumber','eventAt','txnType','flowType','amount','paymentMethod','note']};
export const reportLabels:Record<string,string>={documentNumber:'Reference',createdAt:'Created',completedAt:'Completed at',gross:'Gross',discount:'Discount',tax:'VAT',net:'Net amount',paidAtEnd:'Paid at period end',dueReductionAtEnd:'Due reduced by returns',dueAtEnd:'Due at period end',eventAt:'Collection / movement date',documentDate:'Document date',classification:'Collection type',flowType:'Direction',amount:'Amount',paymentMethod:'Payment method',event:'Event',txnType:'Transaction type',note:'Note',sameDay:'Same-day sale receipts',previousDayDue:'Previous-day dues collected',refunds:'Money refunded',advanceApplied:'Advance applied (no new receipt)',outstandingAtEnd:'All invoice dues at period end',netAfterReturns:'Net after returns',returns:'Returns total',count:'Invoice count'};
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,max=2000)=>typeof v==='string'&&v.length<=max;
const date=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v));
export function reportCents(v:unknown):bigint{if(typeof v!=='string'||!/^[-]?\d{1,15}\.\d{2}$/.test(v))throw new Error('Invalid report money');return BigInt(v.replace('.',''));}
const money=(v:unknown,signed=false)=>{try{const value=reportCents(v);return signed||value>=BigInt(0);}catch{return false;}};
export function reportWindow(selection:ReportSelection,today=new Date(Date.now()+21600000).toISOString().slice(0,10)){
 const {startDate:start,endDate:end}=selection;
 return /^[0-9a-f-]{36}$/i.test(selection.branchId)&&[start,end].every(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d)&&start<=end&&end<=today&&Date.parse(end)-Date.parse(start)<=365*86400000&&selection.search.length<=200;
}
export type ReportMeta={tenantId:string;branchIds:string[];start:string;end:string;asOf:string;timezone:'Asia/Dhaka';dataset?:ReportDataset;recognition?:'completion-date'};
export type InvoiceSummary={count:number;net:string;outstandingAtEnd:string;returns:string;netAfterReturns:string};
export type TenantSummary={meta:ReportMeta;summary:{sales:InvoiceSummary;purchases:InvoiceSummary;income:{net:string};expense:{net:string};collections:{sameDay:string;previousDayDue:string;refunds:string;net:string};advanceApplied:string}};
export type ReportRow=Record<string,string|null>;
export type TenantReport={meta:ReportMeta;data:ReportRow[];pagination:CatalogMeta};
export type ReportDocument={meta:ReportMeta;data:ReportRow[];totalItems:number};
function validMeta(v:unknown,tenant:string,q:ReportSelection,dataset?:ReportDataset):v is ReportMeta{
 return obj(v)&&v.tenantId===tenant&&Array.isArray(v.branchIds)&&v.branchIds.length===1&&v.branchIds[0]===q.branchId&&v.timezone==='Asia/Dhaka'&&date(v.start)&&date(v.end)&&date(v.asOf)&&Date.parse(String(v.start))===Date.parse(q.startDate+'T00:00:00+06:00')&&Date.parse(String(v.end))===Date.parse(q.endDate+'T23:59:59.999+06:00')&&Date.parse(String(v.asOf))>=Date.parse(String(v.start))&&Date.parse(String(v.asOf))<=Date.parse(String(v.end))&&Date.parse(String(v.asOf))<=Date.now()+300000&&(dataset?v.dataset===dataset:v.recognition==='completion-date');
}
export function validTenantSummary(v:unknown,tenant:string,q:ReportSelection):v is TenantSummary{
 if(!obj(v)||!validMeta(v.meta,tenant,q)||!obj(v.summary))return false;const s=v.summary;
 try{for(const key of ['sales','purchases']){const r=s[key];if(!obj(r)||!Number.isSafeInteger(r.count)||Number(r.count)<0||!['net','outstandingAtEnd','returns'].every(k=>money(r[k]))||!money(r.netAfterReturns,true)||reportCents(r.net)-reportCents(r.returns)!==reportCents(r.netAfterReturns))return false;}
 const collections=s.collections;
 if(!['income','expense'].every(k=>obj(s[k])&&money(s[k].net,true))||!money(s.advanceApplied)||!obj(collections)||!['sameDay','previousDayDue','refunds'].every(k=>money(collections[k]))||!money(collections.net,true))return false;
 return reportCents(collections.sameDay)+reportCents(collections.previousDayDue)-reportCents(collections.refunds)===reportCents(collections.net);
 }catch{return false;}
}
function validRow(v:unknown,q:ReportSelection,dataset:ReportDataset):v is ReportRow{
 if(!obj(v)||!text(v.id,128)||!v.id||v.branchId!==q.branchId||v.documentNumber!==null&&!text(v.documentNumber,200))return false;
 const invoice=dataset==='sales'||dataset==='purchases';
 const columns=invoice?['id','branchId','documentNumber','createdAt','completedAt','gross','discount','tax','net','paidAtEnd','dueReductionAtEnd','dueAtEnd']:dataset==='income'||dataset==='expense'?['id','branchId','documentNumber','event','eventAt','documentDate','amount','note']:['id','branchId','documentNumber','eventAt','txnType','flowType','amount','paymentMethod','transferId','note','classification'];
 if(Object.keys(v).some(k=>!columns.includes(k)))return false;
 const at=invoice?v.completedAt:v.eventAt;if(!date(at)||Date.parse(String(at))<Date.parse(q.startDate+'T00:00:00+06:00')||Date.parse(String(at))>Date.parse(q.endDate+'T23:59:59.999+06:00'))return false;
 try{if(invoice)return date(v.createdAt)&&['gross','discount','tax','net','paidAtEnd','dueReductionAtEnd','dueAtEnd'].every(k=>money(v[k]))&&reportCents(v.gross)-reportCents(v.discount)+reportCents(v.tax)===reportCents(v.net)&&reportCents(v.paidAtEnd)+reportCents(v.dueReductionAtEnd)+reportCents(v.dueAtEnd)===reportCents(v.net);
 if(!money(v.amount,dataset==='income'||dataset==='expense')||v.note!==null&&!text(v.note))return false;
 if(dataset==='income'||dataset==='expense')return date(v.documentDate)&&['posting','reversal'].includes(String(v.event))&&(v.event==='posting'?reportCents(v.amount)>=BigInt(0):reportCents(v.amount)<=BigInt(0));
 return ['in','out'].includes(String(v.flowType))&&text(v.txnType,100)&&text(v.paymentMethod,100)&&(v.transferId===null||text(v.transferId,128))&&(dataset==='movements'?v.classification===null:['same-day','previous-day-due','refund'].includes(String(v.classification))&&(v.classification==='refund'?v.flowType==='out':v.flowType==='in'));
 }catch{return false;}
}
function rows(v:unknown,q:ReportSelection,dataset:ReportDataset):v is ReportRow[]{return Array.isArray(v)&&new Set(v.map(r=>obj(r)?r.id:null)).size===v.length&&v.every(r=>validRow(r,q,dataset));}
function withinCutoff(data:ReportRow[],meta:ReportMeta){return data.every(r=>Date.parse(String(r.completedAt??r.eventAt))<=Date.parse(meta.asOf));}
export function validTenantReport(v:unknown,tenant:string,q:ReportSelection,dataset:ReportDataset,page:number):v is TenantReport{
 return obj(v)&&validMeta(v.meta,tenant,q,dataset)&&rows(v.data,q,dataset)&&obj(v.pagination)&&validCatalogPage({data:v.data,meta:v.pagination},page,(r):r is ReportRow=>validRow(r,q,dataset))&&v.data.length===Math.min(Number(v.pagination.pageSize),Math.max(0,Number(v.pagination.totalItems)-(page-1)*Number(v.pagination.pageSize)))&&withinCutoff(v.data,v.meta);
}
export function validReportDocument(v:unknown,tenant:string,q:ReportSelection,dataset:ReportDataset):v is ReportDocument{return obj(v)&&validMeta(v.meta,tenant,q,dataset)&&rows(v.data,q,dataset)&&v.data.length<=5000&&v.totalItems===v.data.length&&withinCutoff(v.data,v.meta);}
export function reportCsvDocument(rows:ReportRow[],columns:string[]){const cell=(v:unknown)=>{let s=String(v??'');if(!/^-?\d+(\.\d+)?$/.test(s)&&/^[\s\u0000-\u001f]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};return '\uFEFF'+[columns.map(cell).join(','),...rows.map(r=>columns.map(k=>cell(r[k])).join(','))].join('\r\n')+'\r\n';}
