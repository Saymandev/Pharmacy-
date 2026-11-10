"use client";
import { useEffect,useRef,useState,type FormEvent } from 'react';
import { X,Save } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { DataSkeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/lib/i18n/language-provider';
import { sessionBoundary } from '@/lib/api/session-boundary';
import { type ShopContext } from './shop-contract';
import { type WorkspaceBranch } from './workspace-contract';
import { type InventoryStock,validInventoryStock,validCatalogStock } from './catalog-contract';
import { createWorkspaceClient,WorkspaceError } from './workspace-client';
import { editMedicineDraft } from './medicine-form-policy';
import { ReferencePicker } from './reference-picker';
import { emptyStock,openingStockPayload,adjustmentPayload,type StockDraft } from './stock-form-policy';

export function StockEditor({context,branch,stockId,initialMedicineId='',onClose,onSaved}:{context:ShopContext;branch:WorkspaceBranch;stockId?:string;initialMedicineId?:string;onClose:()=>void;onSaved:(quantity:number)=>void}){
 const {t}=useLanguage(),dialog=useRef<HTMLDialogElement>(null),client=useRef<ReturnType<typeof createWorkspaceClient>|null>(null),revision=useRef(0),submitting=useRef(false),live=useRef(false),attempt=useRef<{fingerprint:string;key:string;body:Record<string,unknown>}|null>(null);
 const [medicineId,setMedicineId]=useState(initialMedicineId),[medicineName,setMedicineName]=useState(''),[draft,setDraft]=useState<StockDraft>({...emptyStock}),[stock,setStock]=useState<InventoryStock|null>(null),[loading,setLoading]=useState(!!stockId||!!initialMedicineId),[ready,setReady]=useState(false),[saving,setSaving]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState(''),[conflict,setConflict]=useState(false),[reload,setReload]=useState(0);
 const adjustment=!!stockId,canSave=context.permissions.includes(adjustment?'stock:update':'stock:create')&&context.permissions.includes(adjustment?'stock:read':'medicine:read');
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>node?.close();},[]);
 useEffect(()=>{
  const transport=createWorkspaceClient(context.tenant.id,sessionBoundary.capture().signal),current=++revision.current;client.current=transport;live.current=true;let active=true;
  queueMicrotask(()=>{if(!active)return;setReady(false);setError('');setConflict(false);setStock(null);attempt.current=null;
   if(!stockId&&!medicineId){setLoading(false);return;}
   setLoading(true);
   void (stockId?transport.stock(stockId,branch.id):transport.medicine(medicineId,branch.id)).then(value=>{
    if(!active||current!==revision.current)return;
    if(stockId){if(!validInventoryStock(value,context.tenant.id,branch.id)||value.id!==stockId||!('medicineId'in value)||value.medicineId!==value.medicine.id)throw new Error('Stock access could not be verified.');setStock(value);setMedicineName(value.medicine.name);setDraft({...emptyStock,unit:value.unit,batchNumber:value.batchNumber});}
    else{const med=editMedicineDraft(value,context.tenant.id);if(med.id!==medicineId||med.draft.isActive!=='true')throw new Error('Choose an active medicine.');setMedicineName(med.draft.name);setDraft({...emptyStock,unit:med.draft.unit,unitPrice:med.draft.purchasePrice,mrp:med.draft.mrp});}
    setReady(true);
   }).catch(cause=>{if(active&&current===revision.current)setError(cause instanceof Error?cause.message:t('Stock could not be loaded. Please try again.'));}).finally(()=>{if(active&&current===revision.current)setLoading(false);});
  });
  return()=>{active=false;live.current=false;transport.dispose();client.current=null;};
 },[context,branch.id,stockId,medicineId,t,reload]);
 function close(){if(!submitting.current&&!uncertain)onClose();}
 async function save(event:FormEvent){
  event.preventDefault();if(submitting.current||!client.current||!canSave||!ready||conflict||loading)return;
  let body:Record<string,unknown>;
  try{body=stockId?adjustmentPayload(stockId,stock!.quantity,draft):openingStockPayload(medicineId,branch.id,draft);}catch(cause){setError(t(cause instanceof Error?cause.message:'Invalid stock form.'));return;}
  const fingerprint=JSON.stringify(body);if(!attempt.current||attempt.current.fingerprint!==fingerprint)attempt.current={fingerprint,key:crypto.randomUUID(),body};
  submitting.current=true;setSaving(true);setError('');
  try{
   const result=await client.current.saveStock(stockId?'adjust':'opening',attempt.current.body,attempt.current.key);
   if(!live.current)return;
   if(!validCatalogStock(result,context.tenant.id,branch.id)||stockId&&result.id!==stockId||!stockId&&(!('medicineId'in result)||result.medicineId!==medicineId))throw new Error('Save status could not be verified. Retry the same details.');
   setUncertain(false);onSaved(result.quantity);
  }catch(cause){if(!live.current)return;setUncertain(!(cause instanceof WorkspaceError)||cause.status===0||cause.status>=500);setError(cause instanceof Error?cause.message:t('Stock could not be saved. Please try again.'));if(stockId&&cause instanceof WorkspaceError&&cause.status===409)setConflict(true);}
  finally{submitting.current=false;if(live.current)setSaving(false);}
 }
 const preview=stock&&/^\d+$/.test(draft.quantity)&&Number(draft.quantity)>=1&&Number(draft.quantity)<=2147483647?stock.quantity+(draft.type==='increase'?1:-1)*Number(draft.quantity):null;
 return <dialog ref={dialog} className="tenant-editor tenant-stock-editor workspace-branch-dialog" aria-labelledby="tenant-stock-editor-title" onCancel={event=>{event.preventDefault();close();}} onClose={()=>{if(!dialog.current?.open&&!submitting.current&&!uncertain)onClose();}} onClick={event=>{if(event.target!==event.currentTarget)return;const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}}>
  <form onSubmit={save} onChange={()=>{if(!conflict&&!uncertain)setError('');}}><header><div><h2 id="tenant-stock-editor-title">{t(adjustment?'Adjust stock':'Opening stock')}</h2><p>{t('Working branch')}: <strong>{branch.name}</strong></p><p>{t(adjustment?'Record a quantity correction with a reason.':'Register a new batch. Existing batches cannot be opened again.')}</p></div><button type="button" aria-label={t('Close stock form')} disabled={saving||uncertain} onClick={close}><X size={18}/></button></header>
   {error&&<div className="shop-access-error" role="alert">{t(error)}</div>}
   {uncertain&&<p role="status">{t('Stock save status is unknown. Retry the same details to check.')}</p>}
   {conflict&&<button type="button" className="tenant-stock-reload" onClick={()=>setReload(value=>value+1)}>{t('Reload stock')}</button>}
   {!adjustment&&<div className="tenant-stock-medicine"><span>{t('Medicine')} *</span><ReferencePicker tenantId={context.tenant.id} kind="stock-medicines" branchId={branch.id} label="Stock medicine" value={medicineId} currentLabel={medicineName} canRead={context.permissions.includes('medicine:read')} disabled={saving||uncertain} onChange={id=>{if(id===medicineId)return;setReady(false);setDraft({...emptyStock});setMedicineName('');setMedicineId(id);}}/><small>{t('For initial inventory. Use Purchases for supplier deliveries.')}</small></div>}
   {loading&&<DataSkeleton variant="form" rows={3}>{t('Loading stock…')}</DataSkeleton>}
   <fieldset disabled={saving||uncertain||conflict||!ready||!canSave}><legend>{t(adjustment?'Stock correction':'Batch details')}</legend>
    {adjustment&&stock&&<div className="tenant-stock-summary"><strong>{medicineName}</strong><span>{stock.batchNumber} · {stock.expiryDate.slice(0,10)}</span><span>{t('Current quantity')}: <b>{stock.quantity} {stock.unit}</b></span></div>}
    <div className="tenant-editor-grid">
     {!adjustment&&<><label><span>{t('Batch number')} *</span><input required maxLength={100} value={draft.batchNumber} onChange={event=>setDraft(value=>({...value,batchNumber:event.target.value}))}/></label><label><span>{t('Expiry date')} *</span><input required type="date" value={draft.expiryDate} onChange={event=>setDraft(value=>({...value,expiryDate:event.target.value}))}/></label></>}
     {adjustment&&<label><span>{t('Correction direction')}</span><Select aria-label={t('Correction direction')} value={draft.type} onChange={event=>setDraft(value=>({...value,type:event.target.value as StockDraft['type']}))}><option value="increase">{t('Increase')}</option><option value="decrease">{t('Decrease')}</option></Select></label>}
     <label><span>{t('Quantity')} *</span><input required inputMode="numeric" value={draft.quantity} onChange={event=>setDraft(value=>({...value,quantity:event.target.value}))}/></label>
     <label><span>{t('Unit')}</span><input readOnly value={draft.unit}/></label>
     {!adjustment&&<><label><span>{t('Unit cost')} *</span><input required inputMode="decimal" value={draft.unitPrice} onChange={event=>setDraft(value=>({...value,unitPrice:event.target.value}))}/></label><label><span>{t('MRP')} *</span><input required inputMode="decimal" value={draft.mrp} onChange={event=>setDraft(value=>({...value,mrp:event.target.value}))}/></label><label><span>{t('Rack')}</span><input maxLength={100} value={draft.rackNumber} onChange={event=>setDraft(value=>({...value,rackNumber:event.target.value}))}/></label></>}
     <label className="tenant-stock-note"><span>{t(adjustment?'Adjustment reason':'Note')}{adjustment?' *':''}</span><input required={adjustment} maxLength={255} value={draft.note} onChange={event=>setDraft(value=>({...value,note:event.target.value}))}/></label>
    </div>
    {adjustment&&preview!==null&&<p className="tenant-stock-preview" data-invalid={preview<0||preview>2147483647}>{t('Expected quantity after correction')}: <strong>{preview} {draft.unit}</strong></p>}
   </fieldset>
   <footer><button type="button" disabled={saving||uncertain} onClick={close}>{t('Cancel')}</button><button type="submit" disabled={saving||loading||conflict||!ready||!canSave}><Save size={16}/>{t(saving?'Saving…':uncertain?'Retry stock save':adjustment?'Save adjustment':'Save opening stock')}</button></footer>
  </form>
 </dialog>;
}
