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
import { MedicineEditor } from './medicine-editor';
import { ReferencePicker } from './reference-picker';
import { medicineReferences } from './medicine-form-policy';
import { StockEditor } from './stock-editor';
import { type StockMovement,validStockMovement,movementLabels } from './history-contract';
import { HistoryDetail } from './history-detail';
import { BulkEditor } from './bulk-editor';
import {MasterManager} from './master-manager';

type Tab='medicines'|'stocks'|'history';type Client=ReturnType<typeof createWorkspaceClient>;
const formatMoney=(value:number|string)=>`BDT ${Number(value).toFixed(2)}`;
export function TenantCatalog({context,branch,writesEnabled=false}:{context:ShopContext;branch:WorkspaceBranch;writesEnabled?:boolean}){
 const {t,language}=useLanguage();const defaultTab=context.permissions.includes('medicine:read')?'medicines':'stocks';
 const [tab,setTab]=useState<Tab>(defaultTab),[search,setSearch]=useState(''),[draft,setDraft]=useState<Record<string,string>>({});
 const [bulk,setBulk]=useState<'import'|'prices'|null>(null);
 const [mastersOpen,setMastersOpen]=useState(false);
 const [query,setQuery]=useState<{page:number;filters:Record<string,string>}>({page:1,filters:{}}),[retry,setRetry]=useState(0);
 const [medicines,setMedicines]=useState<CatalogMedicine[]>([]),[stocks,setStocks]=useState<InventoryStock[]>([]),[meta,setMeta]=useState<CatalogMeta|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [detail,setDetail]=useState<CatalogMedicine|null>(null),[detailLoading,setDetailLoading]=useState(false);
 const [editor,setEditor]=useState<{id:string|null}|null>(null),[notice,setNotice]=useState('');
 const [stockEditor,setStockEditor]=useState<{stockId?:string;medicineId?:string;transfer?:boolean}|null>(null);
 const [history,setHistory]=useState<StockMovement[]>([]),[movement,setMovement]=useState<StockMovement|null>(null),[historyStockName,setHistoryStockName]=useState('');
 const client=useRef<Client|null>(null),revision=useRef(0),detailRevision=useRef(0),filter=useRef<HTMLDivElement>(null),filterId=useId();
 const invalidate=useCallback(()=>{revision.current++;detailRevision.current++;},[]);
 useEffect(()=>{
  const transport=createWorkspaceClient(context.tenant.id,sessionBoundary.capture().signal);client.current=transport;const current=++revision.current;let active=true;
  queueMicrotask(()=>{if(!active)return;setLoading(true);setError('');setMedicines([]);setStocks([]);setHistory([]);setMovement(null);setMeta(null);setDetail(null);setDetailLoading(false);
   void transport[tab](branch.id,query.page,query.filters).then(value=>{
    if(current!==revision.current)return;
    if(tab==='medicines'){
     if(!validCatalogPage(value,query.page,(row):row is CatalogMedicine=>validCatalogMedicine(row,context.tenant.id,branch.id)))throw new Error('Invalid catalog response');
     setMedicines(value.data);setMeta(value.meta);
    }else if(tab==='history'){
     if(!validCatalogPage(value,query.page,(row):row is StockMovement=>validStockMovement(row,context.tenant.id,branch.id)))throw new Error('Invalid stock history response');setHistory(value.data);setMeta(value.meta);
    }else{
     if(!validCatalogPage(value,query.page,(row):row is InventoryStock=>validInventoryStock(row,context.tenant.id,branch.id)))throw new Error('Invalid inventory response');
     setStocks(value.data);setMeta(value.meta);
    }
   }).catch(cause=>{if(current===revision.current)setError(cause instanceof WorkspaceError?cause.message:t(tab==='history'?'Stock history could not be loaded. Please try again.':'Medicines could not be loaded. Please try again.'));}).finally(()=>{if(current===revision.current)setLoading(false);});
  });
  return()=>{active=false;invalidate();transport.dispose();client.current=null;};
 },[context,branch.id,tab,query,retry,t,invalidate]);
 function changeTab(next:Tab){if(next===tab)return;setTab(next);setDraft({});setSearch('');setHistoryStockName('');setQuery({page:1,filters:{}});filter.current?.hidePopover();}
 function apply(event:FormEvent){event.preventDefault();const start=draft[tab==='history'?'startDate':'expiryStartDate'],end=draft[tab==='history'?'endDate':'expiryEndDate'];if(start&&end&&start>end){setError(t('Start date must be on or before end date'));return;}setQuery({page:1,filters:{...draft,search}});filter.current?.hidePopover();}
 async function open(id:string){
  const transport=client.current;if(!transport)return;const current=++detailRevision.current;setDetail(null);setDetailLoading(true);setError('');
  try{const row=await transport.medicine(id,branch.id);if(current!==detailRevision.current)return;if(!validCatalogMedicine(row,context.tenant.id,branch.id)||row.id!==id)throw new Error('Invalid medicine response');setDetail(row);}
  catch(cause){if(current===detailRevision.current){setError(cause instanceof WorkspaceError?cause.message:t('Medicine details could not be loaded. Please try again.'));if(cause instanceof WorkspaceError&&(cause.status===401||cause.status===403)){setMedicines([]);setStocks([]);setMeta(null);}}}
  finally{if(current===detailRevision.current)setDetailLoading(false);}
 }
 const fields=tab==='medicines'?[['barcode','Barcode'],['unit','Unit'],['dosageForm','Dosage form'],['strength','Strength']]:tab==='history'?[['batchNumber','Batch number']]:[['batchNumber','Batch number'],['rackNumber','Rack'],['unit','Unit']];
 const available=(['medicines','stocks','history']as const).filter(value=>context.permissions.includes(value==='medicines'?'medicine:read':'stock:read'));
 if(!available.length)return null;
 return <section className="tenant-catalog" aria-label={t('Shop medicines and inventory')}>
  <div className="tenant-catalog-tabs" role="tablist" aria-label={t('Pharmacy views')}>{available.map(value=><button type="button" role="tab" aria-selected={tab===value} aria-controls={`${filterId}-results`} id={`${filterId}-${value}`} key={value} onClick={()=>changeTab(value)}>{t(value==='medicines'?'Medicine catalog':value==='history'?'Stock history':'Inventory')}</button>)}</div>
  {writesEnabled&&context.permissions.includes('medicine:create')&&<button type="button" className="tenant-catalog-add" onClick={()=>{setNotice('');setEditor({id:null});}}>{t('Add medicine')}</button>}
  {writesEnabled&&context.permissions.includes('medicine:create')&&<button type="button" className="tenant-catalog-add" onClick={()=>{setNotice('');setBulk('import');}}>{t('Import medicines')}</button>}
  {writesEnabled&&context.permissions.includes('medicine:update')&&context.permissions.includes('stock:read')&&<button type="button" className="tenant-catalog-add" onClick={()=>{setNotice('');setBulk('prices');}}>{t('Bulk price update')}</button>}
  {writesEnabled&&context.permissions.includes('stock:create')&&context.permissions.includes('medicine:read')&&<button type="button" className="tenant-catalog-add" onClick={()=>{setNotice('');setStockEditor({});}}>{t('Opening stock')}</button>}
  {notice&&<p role="status" className="tenant-save-notice">{t(notice)}</p>}
  <form onSubmit={apply} className="tenant-catalog-search"><label><Search size={17}/><input aria-label={t('Search shop medicines')} value={search} onChange={event=>setSearch(event.target.value)} maxLength={tab==='history'?100:200} placeholder={t('Search name or generic…')}/></label><button type="submit">{t('Search')}</button><button type="button" popoverTarget={filterId}><Filter size={16}/>{t('Filters')}</button></form>
  <div ref={filter} popover="auto" id={filterId} className="tenant-catalog-filter" role="dialog" aria-label={t('Medicine filters')}><form onSubmit={apply}><header><strong>{t('Filters')}</strong><button type="button" aria-label={t('Close filters')} onClick={()=>filter.current?.hidePopover()}><X size={17}/></button></header>
   {fields.map(([key,label])=><label key={key}><span>{t(label)}</span><input value={draft[key]??''} onChange={event=>setDraft(value=>({...value,[key]:event.target.value}))} maxLength={tab==='history'?100:200}/></label>)}
   {tab!=='history'&&<div className="tenant-reference-filters">{medicineReferences.filter(ref=>tab==='medicines'||ref.key==='medicineManufacturerId').map(ref=><div className="tenant-editor-reference" key={ref.key}><span>{t(ref.label)}</span><ReferencePicker tenantId={context.tenant.id} kind={ref.kind} label={ref.label} value={draft[ref.key]??''} canRead={context.permissions.includes(ref.permission)} onChange={id=>setDraft(value=>({...value,[ref.key]:id}))}/></div>)}</div>}
   {tab==='history'&&<><label><span>{t('Direction')}</span><Select aria-label={t('Movement direction')} value={draft.type??''} onChange={event=>setDraft(value=>({...value,type:event.target.value}))}><option value="">{t('All')}</option><option value="in">{t('In')}</option><option value="out">{t('Out')}</option></Select></label><label><span>{t('Change type')}</span><Select aria-label={t('Movement change type')} value={draft.stockChangeType??''} onChange={event=>setDraft(value=>({...value,stockChangeType:event.target.value}))}><option value="">{t('All')}</option>{Object.entries(movementLabels).map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</Select></label><div className="tenant-editor-reference"><span>{t('Medicine')}</span><ReferencePicker tenantId={context.tenant.id} branchId={branch.id} kind="history-medicines" label="History medicine" value={draft.medicineId??''} canRead={context.permissions.includes('medicine:read')} onChange={id=>setDraft(value=>({...value,medicineId:id}))}/></div></>}
   {tab==='medicines'?<><label><span>{t('Status')}</span><Select aria-label={t('Medicine status')} value={draft.isActive??''} onChange={event=>setDraft(value=>({...value,isActive:event.target.value}))}><option value="">{t('All')}</option><option value="true">{t('Active')}</option><option value="false">{t('Inactive')}</option></Select></label><label><span>{t('Stock')}</span><Select aria-label={t('Medicine stock')} value={draft.hasStock??''} onChange={event=>setDraft(value=>({...value,hasStock:event.target.value}))}><option value="">{t('All registered')}</option><option value="true">{t('In stock')}</option><option value="false">{t('No stock')}</option></Select></label></>:<>{(tab==='history'?[['startDate','From date'],['endDate','To date']]:[['expiryStartDate','Expiry from'],['expiryEndDate','Expiry to']]).map(([key,label])=><label key={key}><span>{t(label)}</span><input type="date" value={draft[key]??''} onChange={event=>setDraft(value=>({...value,[key]:event.target.value}))}/></label>)}</>}
   <button type="submit">{t('Apply filters')}</button><button type="button" onClick={()=>{setDraft({});setSearch('');setHistoryStockName('');setQuery({page:1,filters:{}});filter.current?.hidePopover();}}>{t('Clear filters')}</button></form></div>
  <p className="tenant-catalog-context">{branch.name} · {t(tab==='history'?'History dates use Asia/Dhaka. Movement quantity is not a running balance.':'Recorded stock includes expired batches; verify expiry before sale.')}</p>
  {tab==='history'&&historyStockName&&<p className="tenant-history-focus">{historyStockName}<button type="button" onClick={()=>{setHistoryStockName('');setDraft(value=>{const next={...value};delete next.stockId;return next;});setQuery(value=>{const filters={...value.filters};delete filters.stockId;return {page:1,filters};});}}>{t('Clear batch selection')}</button></p>}
  {error&&<div role="alert" className="shop-access-error"><p>{error}</p><button type="button" onClick={()=>setRetry(value=>value+1)}>{t('Retry')}</button></div>}
  <div role="tabpanel" id={`${filterId}-results`} aria-labelledby={`${filterId}-${tab}`} aria-busy={loading||detailLoading}>
   {loading?<DataSkeleton variant={tab==='medicines'?'cards':'table'} rows={4}>{t('Loading…')}</DataSkeleton>:<>
    {tab==='medicines'?<div className="tenant-medicine-grid">{medicines.map(row=><button type="button" className="tenant-medicine" key={row.id} onClick={()=>void open(row.id)}><strong>{row.name}</strong><span>{row.genericName||row.unit}</span><small>{t(row.isActive?'Active':'Inactive')} · {row.stocks.reduce((sum,item)=>sum+item.quantity,0)} {row.unit}</small><b>{formatMoney(row.salePrice)}</b><small>{t('View medicine details')}</small></button>)}</div>:tab==='history'?<HistoryTable rows={history} language={language} t={t} onDetails={setMovement}/>:<InventoryTable rows={stocks} t={t} onHistory={row=>{setTab('history');setSearch('');setHistoryStockName(`${row.medicine.name} · ${row.batchNumber}`);setDraft({stockId:row.id});setQuery({page:1,filters:{stockId:row.id}});}} onAdjust={writesEnabled&&context.permissions.includes('stock:update')?row=>setStockEditor({stockId:row.id}):undefined} onTransfer={writesEnabled&&context.permissions.includes('stock:update')?row=>setStockEditor({stockId:row.id,transfer:true}):undefined}/>}
    {!error&&!(tab==='medicines'?medicines.length:tab==='history'?history.length:stocks.length)&&<p role="status" className="tenant-catalog-empty">{t('No matching records in this branch.')}</p>}
    {meta&&<nav className="tenant-catalog-pages" aria-label={t('Results pages')}><span>{meta.totalItems} {t('records')} · {t('Page')} {meta.page} / {Math.max(1,meta.totalPages)}</span><button type="button" disabled={!meta.hasPreviousPage} onClick={()=>setQuery(value=>({...value,page:value.page-1}))}>{t('Previous')}</button><button type="button" disabled={!meta.hasNextPage} onClick={()=>setQuery(value=>({...value,page:value.page+1}))}>{t('Next')}</button></nav>}
   </>}
  </div>
  {detailLoading&&<p role="status">{t('Loading medicine details…')}</p>}
  {detail&&<MedicineDetails medicine={detail} onOpening={writesEnabled&&detail.isActive&&context.permissions.includes('stock:create')?()=>{setStockEditor({medicineId:detail.id});setDetail(null);}:undefined} onEdit={writesEnabled&&context.permissions.includes('medicine:update')?()=>{setDetail(null);setEditor({id:detail.id});}:undefined} onClose={()=>{detailRevision.current++;setDetail(null);}}/>}
  {editor&&<MedicineEditor context={context} branchId={branch.id} id={editor.id} onClose={()=>setEditor(null)} onSaved={created=>{setEditor(null);setDetail(null);setNotice(created?'Medicine saved. Register opening stock separately to show it in this branch.':'Medicine changes saved.');setRetry(value=>value+1);}}/>}
  {stockEditor&&<StockEditor context={context} branch={branch} stockId={stockEditor.stockId} initialMedicineId={stockEditor.medicineId} transfer={stockEditor.transfer} onClose={()=>setStockEditor(null)} onSaved={()=>{setStockEditor(null);setDetail(null);setNotice(stockEditor.transfer?'Transfer confirmed.':'Stock save confirmed.');setRetry(value=>value+1);}}/>}
  {movement&&<HistoryDetail row={movement} context={context} branch={branch} onClose={()=>setMovement(null)}/>}
  {medicineReferences.some(ref=>context.permissions.includes(ref.permission))&&<button type="button" onClick={()=>setMastersOpen(true)}>{t('Catalog master data')}</button>}
  {mastersOpen&&<MasterManager context={context} writesEnabled={writesEnabled} onClose={()=>setMastersOpen(false)}/>}
  {bulk&&<BulkEditor mode={bulk} context={context} branch={branch} onClose={()=>setBulk(null)} onSaved={()=>{setNotice(bulk==='import'?'Import confirmed. Register opening stock separately to show medicines in this branch.':'Batch price updates confirmed.');setBulk(null);setRetry(value=>value+1);}}/>}
 </section>;
}
function InventoryTable({rows,t,onHistory,onAdjust,onTransfer}:{rows:InventoryStock[];t:(key:string)=>string;onHistory:(row:InventoryStock)=>void;onAdjust?: (row:InventoryStock)=>void;onTransfer?:(row:InventoryStock)=>void}){
 return <div className="tenant-stock-table" tabIndex={0} aria-label={t('Inventory batches')}><table><thead><tr>{['Medicine','Batch number','Expiry','Quantity','Rack','MRP','Actions'].map(label=><th key={label}>{t(label)}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.medicine.name}</td><td>{row.batchNumber}</td><td>{row.expiryDate.slice(0,10)}</td><td>{row.quantity} {row.unit}</td><td>{row.rackNumber||'—'}</td><td>{formatMoney(row.mrp)}</td><td><div className="tenant-stock-actions"><button type="button" aria-label={`${t('View history')} ${row.medicine.name} ${row.batchNumber}`} onClick={()=>onHistory(row)}>{t('View history')}</button>{onAdjust&&<button type="button" aria-label={`${t('Adjust stock')} ${row.medicine.name} ${row.batchNumber}`} onClick={()=>onAdjust(row)}>{t('Adjust stock')}</button>}{onTransfer&&<button type="button" aria-label={`${t('Transfer stock')} ${row.medicine.name} ${row.batchNumber}`} onClick={()=>onTransfer(row)}>{t('Transfer stock')}</button>}</div></td></tr>)}</tbody></table></div>;
}
function HistoryTable({rows,t,language,onDetails}:{rows:StockMovement[];t:(key:string)=>string;language:string;onDetails:(row:StockMovement)=>void}){
 return <div className="tenant-stock-table" tabIndex={0} aria-label={t('Stock movements')}><table><thead><tr>{['Medicine','Movement quantity','Direction','Date','Batch number','Change type','Actions'].map(label=><th key={label}>{t(label)}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.medicine.name}</td><td>{row.type==='in'?'+':'−'}{row.quantity} {row.stock.unit}</td><td><span className={`tenant-movement-${row.type}`}>{t(row.type==='in'?'In':'Out')}</span></td><td>{new Date(row.createdAt).toLocaleString(language==='bn'?'bn-BD':'en-GB',{timeZone:'Asia/Dhaka'})}</td><td>{row.stock.batchNumber}</td><td>{t(movementLabels[row.stockChangeType]??row.stockChangeType)}</td><td><button type="button" aria-label={`${t('Movement details')} ${row.medicine.name} ${row.quantity}`} onClick={()=>onDetails(row)}>{t('Details')}</button></td></tr>)}</tbody></table></div>;
}
function MedicineDetails({medicine,onClose,onEdit,onOpening}:{medicine:CatalogMedicine;onClose:()=>void;onEdit?:()=>void;onOpening?:()=>void}){
 const {t}=useLanguage(),dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>node?.close();},[]);
 return <dialog className="tenant-medicine-dialog workspace-branch-dialog" ref={dialog} aria-labelledby="tenant-medicine-title" onCancel={onClose} onClose={()=>{if(!dialog.current?.open)onClose();}} onClick={event=>{if(event.target!==event.currentTarget)return;const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)onClose();}}><header><h2 id="tenant-medicine-title">{medicine.name}</h2><button type="button" onClick={onClose} aria-label={t('Close medicine details')}><X size={18}/></button></header><dl><dt>{t('Generic')}</dt><dd>{medicine.genericName||'—'}</dd><dt>{t('Barcode')}</dt><dd>{medicine.barcode||'—'}</dd><dt>{t('Sale price')}</dt><dd>{formatMoney(medicine.salePrice)}</dd></dl>{onEdit&&<button type="button" onClick={onEdit}>{t('Edit medicine')}</button>}{onOpening&&<button type="button" onClick={onOpening}>{t('Opening stock')}</button>}<h3>{t('Branch batches')}</h3>{medicine.stocks.map(row=><div className="tenant-medicine-batch" key={row.id}><strong>{row.batchNumber}</strong><span>{row.quantity} {row.unit} · {row.expiryDate.slice(0,10)}</span></div>)}{!medicine.stocks.length&&<p>{t('No stock')}</p>}</dialog>;
}
