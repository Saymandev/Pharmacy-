"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {X} from 'lucide-react';
import {useLanguage} from '@/lib/i18n/language-provider';
import {DataSkeleton} from '@/components/ui/skeleton';
import {sessionBoundary} from '@/lib/api/session-boundary';
import {type ShopContext} from './shop-contract';
import {type WorkspaceBranch} from './workspace-contract';
import {validInventoryStock,validCatalogStock,validCatalogPage,type InventoryStock,type CatalogMeta} from './catalog-contract';
import {createWorkspaceClient,WorkspaceError} from './workspace-client';
import {parseImportCsv,priceNumber,validPriceRows,type ImportRow,type PriceRow} from './bulk-policy';
type Batch=InventoryStock&{sku:string;unitPrice:number|string};
type Edit={selected:boolean;cost:string;mrp:string};
const importLabels:Record<string,string>={nameBangla:'Bangla name',genericName:'Generic',genericNameBangla:'Bangla generic name',barcode:'Barcode',unit:'Unit',dosageForm:'Dosage form',strength:'Strength',purchasePrice:'Purchase price',salePrice:'Sale price',mrp:'MRP',reorderLevel:'Reorder level',isActive:'Active'};
function validBatch(value:unknown,tenantId:string,branchId:string):value is Batch{
 if(!validInventoryStock(value,tenantId,branchId)||!('medicineId'in value)||value.medicineId!==value.medicine.id||!('sku'in value)||typeof value.sku!=='string'||!('unitPrice'in value))return false;
 try{priceNumber(value.unitPrice);priceNumber(value.mrp);return /^[0-9a-f-]{36}$/i.test(value.sku);}catch{return false;}
}
export function BulkEditor({mode,context,branch,onClose,onSaved}:{mode:'import'|'prices';context:ShopContext;branch:WorkspaceBranch;onClose:()=>void;onSaved:()=>void}){
 const {t}=useLanguage(),dialog=useRef<HTMLDialogElement>(null),client=useRef<ReturnType<typeof createWorkspaceClient>|null>(null),live=useRef(false),submitting=useRef(false),fileVersion=useRef(0),attempt=useRef<{body:unknown;key:string}|null>(null);
 const [rows,setRows]=useState<ImportRow[]>([]),[batches,setBatches]=useState<Batch[]>([]),[edits,setEdits]=useState<Record<string,Edit>>({}),[search,setSearch]=useState(''),[query,setQuery]=useState({search:'',page:1}),[meta,setMeta]=useState<CatalogMeta|null>(null),[reload,setReload]=useState(0),[loading,setLoading]=useState(mode==='prices'),[saving,setSaving]=useState(false),[uncertain,setUncertain]=useState(false),[conflict,setConflict]=useState(false),[error,setError]=useState('');
 const allowed=context.permissions.includes(mode==='import'?'medicine:create':'medicine:update')&&(mode==='import'||context.permissions.includes('stock:read'));
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>node?.close();},[]);
 useEffect(()=>{const cancelUploads=()=>{fileVersion.current++;};const transport=createWorkspaceClient(context.tenant.id,sessionBoundary.capture().signal);client.current=transport;live.current=true;return()=>{live.current=false;cancelUploads();transport.dispose();client.current=null;};},[context]);
 useEffect(()=>{
  if(mode!=='prices'||!allowed)return;let active=true;
  queueMicrotask(()=>{if(!active)return;setLoading(true);setBatches([]);setEdits({});setMeta(null);setError('');setConflict(false);attempt.current=null;
   void client.current?.stocks(branch.id,query.page,{search:query.search}).then(value=>{
    if(!active)return;if(!validCatalogPage(value,query.page,(row):row is Batch=>validBatch(row,context.tenant.id,branch.id)))throw new Error('Batch prices could not be verified.');
    setBatches(value.data);setMeta(value.meta);setEdits(Object.fromEntries(value.data.map(row=>[row.id,{selected:false,cost:String(row.unitPrice),mrp:String(row.mrp)}])));
   }).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Batch prices could not be loaded.');}).finally(()=>{if(active)setLoading(false);});
  });return()=>{active=false;};
 },[allowed,mode,branch.id,context.tenant.id,query,reload]);
 function close(){if(!submitting.current&&!uncertain)onClose();}
 async function fileChanged(file?:File){
  const version=++fileVersion.current;setRows([]);setError('');attempt.current=null;if(!file)return;
  if(!/\.csv$/i.test(file.name)||file.size>131072){setError('Choose a CSV file up to 128 KB.');return;}
  setLoading(true);try{const buffer=await file.arrayBuffer();const text=new TextDecoder('utf-8',{fatal:true}).decode(buffer),parsed=parseImportCsv(text);if(live.current&&version===fileVersion.current)setRows(parsed);}
  catch(cause){if(live.current&&version===fileVersion.current)setError(cause instanceof Error?cause.message:'CSV could not be read.');}
  finally{if(live.current&&version===fileVersion.current)setLoading(false);}
 }
 function sample(){const blob=new Blob(['name,genericName,barcode,unit,purchasePrice,salePrice,mrp,reorderLevel,isActive\r\nSample Medicine,Sample Generic,SAMPLE-001,Pcs,10,12,15,10,true\r\n'],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='medicine-import-sample.csv';link.click();URL.revokeObjectURL(url);}
 async function save(event:FormEvent){
  event.preventDefault();if(submitting.current||!client.current||!allowed||loading||conflict)return;
  let body:unknown;
  try{if(uncertain&&attempt.current)body=attempt.current.body;
   else if(mode==='import'){if(!rows.length)throw new Error('Choose and review a CSV first.');body={rows};}
   else{const selected:PriceRow[]=batches.filter(row=>edits[row.id]?.selected).map(row=>({medicineId:row.medicine.id,sku:row.sku,unitPrice:priceNumber(edits[row.id].cost),mrp:priceNumber(edits[row.id].mrp),expectedUnitPrice:priceNumber(row.unitPrice),expectedMrp:priceNumber(row.mrp)}));if(!validPriceRows(selected))throw new Error('Select at least one batch and enter valid prices.');if(selected.every(row=>row.unitPrice===row.expectedUnitPrice&&row.mrp===row.expectedMrp))throw new Error('Change at least one selected price.');body=selected;}
   if(!attempt.current||JSON.stringify(attempt.current.body)!==JSON.stringify(body))attempt.current={body,key:crypto.randomUUID()};
  }catch(cause){setError(cause instanceof Error?cause.message:'Invalid bulk form.');return;}
  submitting.current=true;setSaving(true);setError('');const current=attempt.current!;
  try{const result=await(mode==='import'?client.current.importMedicines(current.body,current.key):client.current.updatePrices(current.body,current.key));if(!live.current)return;
   if(!result||typeof result!=='object')throw new Error('Save status could not be verified. Retry the same details.');
   if(mode==='import'){if(!('total'in result)||result.total!==rows.length||!('success'in result)||result.success!==rows.length||!('failed'in result)||result.failed!==0||!('ids'in result)||!Array.isArray(result.ids)||result.ids.length!==rows.length||new Set(result.ids).size!==rows.length||!result.ids.every(id=>typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id)))throw new Error('Save status could not be verified. Retry the same details.');}
   else{const requested=current.body as PriceRow[],stocks='stocks'in result?result.stocks:null;if(!('updated'in result)||result.updated!==requested.length||!Array.isArray(stocks)||stocks.length!==requested.length||!requested.every(row=>{const source=batches.find(item=>item.sku===row.sku);return source&&stocks.filter((item:unknown)=>!!item&&typeof item==='object'&&'sku'in item&&item.sku===row.sku).length===1&&stocks.some((item:unknown)=>validCatalogStock(item,context.tenant.id,branch.id)&&item.id===source.id&&'sku'in item&&item.sku===row.sku&&'medicineId'in item&&item.medicineId===row.medicineId&&'unitPrice'in item&&Number(item.unitPrice)===row.unitPrice&&Number(item.mrp)===row.mrp);} ))throw new Error('Save status could not be verified. Retry the same details.');}
   setUncertain(false);onSaved();
  }catch(cause){if(!live.current)return;setUncertain(!(cause instanceof WorkspaceError)||cause.status===0||cause.status>=500);setError(cause instanceof Error?cause.message:'Bulk save could not be completed.');if(mode==='prices'&&cause instanceof WorkspaceError&&cause.status===409)setConflict(true);}
  finally{submitting.current=false;if(live.current)setSaving(false);}
 }
 const locked=saving||uncertain;
 return <dialog ref={dialog} className="tenant-editor tenant-bulk-editor workspace-branch-dialog" aria-labelledby="tenant-bulk-title" onCancel={event=>{event.preventDefault();close();}} onClose={()=>{if(!dialog.current?.open)close();}} onClick={event=>{if(event.target!==event.currentTarget)return;const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}}>
  <header><div><h2 id="tenant-bulk-title">{t(mode==='import'?'Import medicines':'Bulk price update')}</h2><p>{context.tenant.name}{mode==='prices'?` · ${branch.name}`:''}</p></div><button type="button" disabled={locked} onClick={close} aria-label={t('Close bulk form')}><X size={18}/></button></header>
  <p>{t(mode==='import'?'Create medicines from CSV. Stock and reference masters are added separately.':'Update batch unit cost and MRP. Catalog sale prices and quantities stay unchanged.')}</p>
  {error&&<div role="alert" className="shop-access-error">{t(error)}</div>}
  {uncertain&&<p role="status">{t('Save status is unknown. Retry the same details; do not start another batch.')}</p>}
  {mode==='import'?<><div className="tenant-bulk-toolbar"><button type="button" onClick={sample}>{t('Download sample CSV')}</button><label><span>{t('Choose CSV')} · {t('Up to 100 medicines')}</span><input aria-label={t('Choose CSV')} type="file" accept=".csv,text/csv" disabled={locked||loading} onChange={event=>void fileChanged(event.target.files?.[0])}/></label></div>{!!rows.length&&<><p role="status">{rows.length} {t('medicines ready for review')}</p><div className="tenant-stock-table" tabIndex={0}><table><thead><tr>{['Medicine','Barcode','Sale price','MRP'].map(label=><th key={label}>{t(label)}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={index}><td>{row.name}<small>{row.genericName}</small></td><td>{row.barcode??'—'}</td><td>{row.salePrice??0}</td><td>{row.mrp??0}</td></tr>)}</tbody></table></div><details className="tenant-import-details"><summary>{t('Review all imported fields')}</summary>{rows.map((row,index)=><dl key={index}><dt>{t('Medicine')}</dt><dd>{index+1}. {row.name}</dd>{Object.entries(row).filter(([key])=>key!=='name').map(([key,value])=><div key={key}><dt>{t(importLabels[key]??key)}</dt><dd>{String(value)}</dd></div>)}</dl>)}</details></>}</>:<>
   <form className="tenant-bulk-toolbar" onSubmit={event=>{event.preventDefault();setQuery({search,page:1});}}><label><span>{t('Search batches')}</span><input aria-label={t('Search batches')} maxLength={200} disabled={locked} value={search} onChange={event=>setSearch(event.target.value)}/></label><button disabled={locked} type="submit">{t('Search')}</button></form>
   {!loading&&<div className="tenant-bulk-batches">{batches.map(row=><div className="tenant-bulk-batch" key={row.id}><label className="tenant-bulk-select"><input type="checkbox" disabled={locked||conflict} checked={edits[row.id]?.selected??false} onChange={event=>setEdits(value=>({...value,[row.id]:{...value[row.id],selected:event.target.checked}}))}/><span><strong>{row.medicine.name}</strong><small>{row.batchNumber} · {row.quantity} {row.unit}</small></span></label>{(['cost','mrp']as const).map(key=><label key={key}><span>{t(key==='cost'?'Unit cost':'MRP')}</span><small>{t('Current')}: {String(key==='cost'?row.unitPrice:row.mrp)}</small><input aria-label={`${t(key==='cost'?'New unit cost':'New MRP')} ${row.medicine.name} ${row.batchNumber}`} inputMode="decimal" value={edits[row.id]?.[key]??''} disabled={locked||conflict||!edits[row.id]?.selected} onChange={event=>setEdits(value=>({...value,[row.id]:{...value[row.id],[key]:event.target.value}}))}/></label>)}</div>)}</div>}
   {!loading&&!batches.length&&!error&&<p>{t('No matching records in this branch.')}</p>}
   {meta&&<nav className="tenant-catalog-pages"><span>{t('Page')} {meta.page} / {Math.max(1,meta.totalPages)}</span><button type="button" disabled={locked||!meta.hasPreviousPage} onClick={()=>setQuery(value=>({...value,page:value.page-1}))}>{t('Previous')}</button><button type="button" disabled={locked||!meta.hasNextPage} onClick={()=>setQuery(value=>({...value,page:value.page+1}))}>{t('Next')}</button></nav>}
   <p>{t('Selection applies to this page only. Search or page changes clear selection.')}</p><button type="button" disabled={locked} onClick={()=>setReload(value=>value+1)}>{t('Reload batch prices')}</button>
  </>}
  {loading&&<DataSkeleton variant="form" rows={3}>{t('Loading…')}</DataSkeleton>}
  <form onSubmit={save}><footer><p>{t('All rows save together. Any invalid row cancels the whole batch.')}</p><button type="submit" disabled={!allowed||saving||loading||conflict||mode==='import'&&!rows.length}>{t(saving?'Saving…':uncertain?'Retry same save':mode==='import'?'Confirm import':'Confirm price updates')}</button><button type="button" disabled={locked} onClick={close}>{t('Cancel')}</button></footer></form>
 </dialog>;
}
