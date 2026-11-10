"use client";
import { useCallback,useEffect,useId,useRef,useState,type FormEvent } from 'react';
import { Filter,Search,X } from 'lucide-react';
import { DataSkeleton } from '@/components/ui/skeleton';
import { Select } from '@/components/ui/select';
import { useLanguage } from '@/lib/i18n/language-provider';
import { sessionBoundary } from '@/lib/api/session-boundary';
import { type ShopContext } from './shop-contract';
import { type WorkspaceBranch } from './workspace-contract';
import { createWorkspaceClient,WorkspaceError } from './workspace-client';
import { type CatalogMedicine,type InventoryStock,type CatalogMeta,validCatalogMedicine,validInventoryStock,validCatalogPage } from './catalog-contract';

type Tab='medicines'|'stocks';type Client=ReturnType<typeof createWorkspaceClient>;
const formatMoney=(value:number|string)=>`BDT ${Number(value).toFixed(2)}`;
export function TenantCatalog({context,branch}:{context:ShopContext;branch:WorkspaceBranch}){
 const {t}=useLanguage();const defaultTab=context.permissions.includes('medicine:read')?'medicines':'stocks';
 const [tab,setTab]=useState<Tab>(defaultTab),[search,setSearch]=useState(''),[draft,setDraft]=useState<Record<string,string>>({});
 const [query,setQuery]=useState<{page:number;filters:Record<string,string>}>({page:1,filters:{}}),[retry,setRetry]=useState(0);
 const [medicines,setMedicines]=useState<CatalogMedicine[]>([]),[stocks,setStocks]=useState<InventoryStock[]>([]),[meta,setMeta]=useState<CatalogMeta|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [detail,setDetail]=useState<CatalogMedicine|null>(null),[detailLoading,setDetailLoading]=useState(false);
 const client=useRef<Client|null>(null),revision=useRef(0),detailRevision=useRef(0),filter=useRef<HTMLDivElement>(null),filterId=useId();
 const invalidate=useCallback(()=>{revision.current++;detailRevision.current++;},[]);
 useEffect(()=>{
  const transport=createWorkspaceClient(context.tenant.id,sessionBoundary.capture().signal);client.current=transport;const current=++revision.current;let active=true;
  queueMicrotask(()=>{if(!active)return;setLoading(true);setError('');setMedicines([]);setStocks([]);setMeta(null);setDetail(null);setDetailLoading(false);
   void transport[tab](branch.id,query.page,query.filters).then(value=>{
    if(current!==revision.current)return;
    if(tab==='medicines'){
     if(!validCatalogPage(value,query.page,(row):row is CatalogMedicine=>validCatalogMedicine(row,context.tenant.id,branch.id)))throw new Error('Invalid catalog response');
     setMedicines(value.data);setMeta(value.meta);
    }else{
     if(!validCatalogPage(value,query.page,(row):row is InventoryStock=>validInventoryStock(row,context.tenant.id,branch.id)))throw new Error('Invalid inventory response');
     setStocks(value.data);setMeta(value.meta);
    }
   }).catch(cause=>{if(current===revision.current)setError(cause instanceof WorkspaceError?cause.message:t('Medicines could not be loaded. Please try again.'));}).finally(()=>{if(current===revision.current)setLoading(false);});
  });
  return()=>{active=false;invalidate();transport.dispose();client.current=null;};
 },[context,branch.id,tab,query,retry,t,invalidate]);
 function changeTab(next:Tab){if(next===tab)return;setTab(next);setDraft({});setSearch('');setQuery({page:1,filters:{}});filter.current?.hidePopover();}
 function apply(event:FormEvent){event.preventDefault();if(draft.expiryStartDate&&draft.expiryEndDate&&draft.expiryStartDate>draft.expiryEndDate){setError(t('Start date must be on or before end date'));return;}setQuery({page:1,filters:{...draft,search}});filter.current?.hidePopover();}
 async function open(id:string){
  const transport=client.current;if(!transport)return;const current=++detailRevision.current;setDetail(null);setDetailLoading(true);setError('');
  try{const row=await transport.medicine(id,branch.id);if(current!==detailRevision.current)return;if(!validCatalogMedicine(row,context.tenant.id,branch.id)||row.id!==id)throw new Error('Invalid medicine response');setDetail(row);}
  catch(cause){if(current===detailRevision.current){setError(cause instanceof WorkspaceError?cause.message:t('Medicine details could not be loaded. Please try again.'));if(cause instanceof WorkspaceError&&(cause.status===401||cause.status===403)){setMedicines([]);setStocks([]);setMeta(null);}}}
  finally{if(current===detailRevision.current)setDetailLoading(false);}
 }
 const fields=tab==='medicines'?[['barcode','Barcode'],['unit','Unit'],['dosageForm','Dosage form'],['strength','Strength']]:[['batchNumber','Batch number'],['rackNumber','Rack'],['unit','Unit']];
 const available=(['medicines','stocks']as const).filter(value=>context.permissions.includes(value==='medicines'?'medicine:read':'stock:read'));
 if(!available.length)return null;
 return <section className="tenant-catalog" aria-label={t('Shop medicines and inventory')}>
  <div className="tenant-catalog-tabs" role="tablist" aria-label={t('Pharmacy views')}>{available.map(value=><button type="button" role="tab" aria-selected={tab===value} aria-controls={`${filterId}-results`} id={`${filterId}-${value}`} key={value} onClick={()=>changeTab(value)}>{t(value==='medicines'?'Medicine catalog':'Inventory')}</button>)}</div>
  <form onSubmit={apply} className="tenant-catalog-search"><label><Search size={17}/><input aria-label={t('Search shop medicines')} value={search} onChange={event=>setSearch(event.target.value)} maxLength={200} placeholder={t('Search name or generic…')}/></label><button type="submit">{t('Search')}</button><button type="button" popoverTarget={filterId}><Filter size={16}/>{t('Filters')}</button></form>
  <div ref={filter} popover="auto" id={filterId} className="tenant-catalog-filter" role="dialog" aria-label={t('Medicine filters')}><form onSubmit={apply}><header><strong>{t('Filters')}</strong><button type="button" aria-label={t('Close filters')} onClick={()=>filter.current?.hidePopover()}><X size={17}/></button></header>
   {fields.map(([key,label])=><label key={key}><span>{t(label)}</span><input value={draft[key]??''} onChange={event=>setDraft(value=>({...value,[key]:event.target.value}))} maxLength={200}/></label>)}
   {tab==='medicines'?<><label><span>{t('Status')}</span><Select aria-label={t('Medicine status')} value={draft.isActive??''} onChange={event=>setDraft(value=>({...value,isActive:event.target.value}))}><option value="">{t('All')}</option><option value="true">{t('Active')}</option><option value="false">{t('Inactive')}</option></Select></label><label><span>{t('Stock')}</span><Select aria-label={t('Medicine stock')} value={draft.hasStock??''} onChange={event=>setDraft(value=>({...value,hasStock:event.target.value}))}><option value="">{t('All registered')}</option><option value="true">{t('In stock')}</option><option value="false">{t('No stock')}</option></Select></label></>:<>{[['expiryStartDate','Expiry from'],['expiryEndDate','Expiry to']].map(([key,label])=><label key={key}><span>{t(label)}</span><input type="date" value={draft[key]??''} onChange={event=>setDraft(value=>({...value,[key]:event.target.value}))}/></label>)}</>}
   <button type="submit">{t('Apply filters')}</button><button type="button" onClick={()=>{setDraft({});setSearch('');setQuery({page:1,filters:{}});filter.current?.hidePopover();}}>{t('Clear filters')}</button></form></div>
  <p className="tenant-catalog-context">{branch.name} · {t('Recorded stock includes expired batches; verify expiry before sale.')}</p>
  {error&&<div role="alert" className="shop-access-error"><p>{error}</p><button type="button" onClick={()=>setRetry(value=>value+1)}>{t('Retry')}</button></div>}
  <div role="tabpanel" id={`${filterId}-results`} aria-labelledby={`${filterId}-${tab}`} aria-busy={loading||detailLoading}>
   {loading?<DataSkeleton variant={tab==='medicines'?'cards':'table'} rows={4}>{t('Loading…')}</DataSkeleton>:<>
    {tab==='medicines'?<div className="tenant-medicine-grid">{medicines.map(row=><button type="button" className="tenant-medicine" key={row.id} onClick={()=>void open(row.id)}><strong>{row.name}</strong><span>{row.genericName||row.unit}</span><small>{t(row.isActive?'Active':'Inactive')} · {row.stocks.reduce((sum,item)=>sum+item.quantity,0)} {row.unit}</small><b>{formatMoney(row.salePrice)}</b><small>{t('View medicine details')}</small></button>)}</div>:<div className="tenant-stock-table"><table><thead><tr>{['Medicine','Batch number','Expiry','Quantity','Rack','MRP'].map(label=><th key={label}>{t(label)}</th>)}</tr></thead><tbody>{stocks.map(row=><tr key={row.id}><td>{row.medicine.name}</td><td>{row.batchNumber}</td><td>{row.expiryDate.slice(0,10)}</td><td>{row.quantity} {row.unit}</td><td>{row.rackNumber||'—'}</td><td>{formatMoney(row.mrp)}</td></tr>)}</tbody></table></div>}
    {!error&&!(tab==='medicines'?medicines.length:stocks.length)&&<p role="status" className="tenant-catalog-empty">{t('No matching records in this branch.')}</p>}
    {meta&&<nav className="tenant-catalog-pages" aria-label={t('Results pages')}><span>{meta.totalItems} {t('records')} · {t('Page')} {meta.page} / {Math.max(1,meta.totalPages)}</span><button type="button" disabled={!meta.hasPreviousPage} onClick={()=>setQuery(value=>({...value,page:value.page-1}))}>{t('Previous')}</button><button type="button" disabled={!meta.hasNextPage} onClick={()=>setQuery(value=>({...value,page:value.page+1}))}>{t('Next')}</button></nav>}
   </>}
  </div>
  {detailLoading&&<p role="status">{t('Loading medicine details…')}</p>}
  {detail&&<MedicineDetails medicine={detail} onClose={()=>{detailRevision.current++;setDetail(null);}}/>}
 </section>;
}
function MedicineDetails({medicine,onClose}:{medicine:CatalogMedicine;onClose:()=>void}){
 const {t}=useLanguage(),dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>node?.close();},[]);
 return <dialog className="tenant-medicine-dialog workspace-branch-dialog" ref={dialog} aria-labelledby="tenant-medicine-title" onCancel={onClose} onClose={()=>{if(!dialog.current?.open)onClose();}} onClick={event=>{if(event.target!==event.currentTarget)return;const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)onClose();}}><header><h2 id="tenant-medicine-title">{medicine.name}</h2><button type="button" onClick={onClose} aria-label={t('Close medicine details')}><X size={18}/></button></header><dl><dt>{t('Generic')}</dt><dd>{medicine.genericName||'—'}</dd><dt>{t('Barcode')}</dt><dd>{medicine.barcode||'—'}</dd><dt>{t('Sale price')}</dt><dd>{formatMoney(medicine.salePrice)}</dd></dl><h3>{t('Branch batches')}</h3>{medicine.stocks.map(row=><div className="tenant-medicine-batch" key={row.id}><strong>{row.batchNumber}</strong><span>{row.quantity} {row.unit} · {row.expiryDate.slice(0,10)}</span></div>)}{!medicine.stocks.length&&<p>{t('No stock')}</p>}</dialog>;
}
