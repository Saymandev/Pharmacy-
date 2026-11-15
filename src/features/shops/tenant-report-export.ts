import type {ReportModel} from '../reports/report-model';
import {reportCsvDocument,reportColumns,reportLabels,reportTitles,type ReportDataset,type ReportDocument,type TenantSummary} from './report-policy';
export function saveReportBlob(blob:Blob,filename:string){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
export function summaryMetrics(value:TenantSummary,t:(s:string)=>string=s=>s){const s=value.summary;return [
 ...(['sales','purchases'] as const).flatMap(group=>Object.entries(s[group]).map(([key,value])=>({label:`${group==='sales'?'Sales':'Purchases'} · ${reportLabels[key]??key}`,key,value}))),
 ...Object.entries(s.collections).map(([key,value])=>({label:key==='net'?'Net sales collections':reportLabels[key],key,value})),
 {label:'Operational income',key:'net',value:s.income.net},{label:'Operational expenses',key:'net',value:s.expense.net},{label:'Advance applied (no new receipt)',key:'advanceApplied',value:s.advanceApplied},
 ].map(metric=>({...metric,label:metric.label.split(' · ').map(part=>t(part)).join(' · ')}));}
export async function exportTenantReport(kind:'summary'|ReportDataset,value:TenantSummary|ReportDocument,format:'csv'|'pdf',context:{tenantName:string;branchName:string;startDate:string;endDate:string;search:string;language:string},t:(s:string)=>string,signal:AbortSignal){
 const appearance=(value.meta as unknown as {documentAppearance?:{tenantId?:string;name?:string;schemaVersion?:number;templateVersion?:number;template?:string}}).documentAppearance;
 if(appearance){if(appearance.tenantId!==value.meta.tenantId||appearance.schemaVersion!==1||typeof appearance.name!=='string'||appearance.name.length>150||!Number.isInteger(appearance.templateVersion)||!['standard','dense'].includes(appearance.template??''))throw new Error('Report branding could not be verified.');context={...context,tenantName:appearance.name};}
 const title=kind==='summary'?'Pharmacy summary':reportTitles[kind],filename=`${kind}-${context.startDate}-${context.endDate}.${format}`;
 const rows:Record<string,string|null>[]=kind==='summary'?summaryMetrics(value as TenantSummary,t).map(r=>({metric:r.label,value:String(r.value)})):(value as ReportDocument).data;
 const columns=kind==='summary'?['metric','value']:reportColumns[kind];
 if(format==='csv'){if(signal.aborted)throw new Error('Shop selection changed.');const scope={shop:context.tenantName,branch:context.branchName,startDate:context.startDate,endDate:context.endDate,asOf:value.meta.asOf,search:context.search};saveReportBlob(new Blob([reportCsvDocument(rows.map(r=>({...scope,...r})),[...Object.keys(scope),...columns])],{type:'text/csv;charset=utf-8'}),filename);return;}
 const [{reportPdfDefinition},{default:pdfMake},{default:fonts}]=await Promise.all([import('../reports/report-pdf'),import('pdfmake/build/pdfmake'),import('pdfmake/build/vfs_fonts')]);
 const displayColumns=columns.map(k=>reportLabels[k]??k);
 const model:ReportModel={metrics:[],tables:[{id:kind,name:`${context.tenantName} · ${t(title)} · BDT`,columns:displayColumns,rows:rows.map(row=>Object.fromEntries(columns.map((k,i)=>[displayColumns[i],row[k]]))),totals:[]}]};
 pdfMake.addVirtualFileSystem(fonts);pdfMake.addFonts({Bengali:{normal:new URL('/fonts/NotoSansBengali-Regular.ttf',location.origin).href,bold:new URL('/fonts/NotoSansBengali-Bold.ttf',location.origin).href,italics:new URL('/fonts/NotoSansBengali-Regular.ttf',location.origin).href,bolditalics:new URL('/fonts/NotoSansBengali-Bold.ttf',location.origin).href}});
 const blob=await pdfMake.createPdf(reportPdfDefinition(model,{title:t(title),branch:`${context.tenantName} / ${context.branchName}`,startDate:context.startDate,endDate:context.endDate,generated:value.meta.asOf,search:context.search,language:context.language,density:appearance?.template==='dense'?'dense':'standard'},s=>t(s==='Generated'?'As of':s))).getBlob();
 if(signal.aborted)throw new Error('Shop selection changed.');saveReportBlob(blob,filename);
}
