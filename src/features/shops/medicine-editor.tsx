"use client";
import { useEffect,useRef,useState,type FormEvent } from 'react';
import { X,Save } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { DataSkeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/lib/i18n/language-provider';
import { sessionBoundary } from '@/lib/api/session-boundary';
import { type ShopContext } from './shop-contract';
import { createWorkspaceClient,WorkspaceError } from './workspace-client';
import { emptyMedicine,editMedicineDraft,medicinePayload,medicineReferences,type MedicineDraft } from './medicine-form-policy';
import { ReferencePicker } from './reference-picker';

export function MedicineEditor({context,branchId,id,onClose,onSaved}:{context:ShopContext;branchId:string;id:string|null;onClose:()=>void;onSaved:(created:boolean)=>void}){
 const {t}=useLanguage(),dialog=useRef<HTMLDialogElement>(null),client=useRef<ReturnType<typeof createWorkspaceClient>|null>(null),alive=useRef(false),submitting=useRef(false),attempt=useRef<{fingerprint:string;key:string;body:Record<string,unknown>}|null>(null);
 const [draft,setDraft]=useState<MedicineDraft>({...emptyMedicine}),[labels,setLabels]=useState<Record<string,string>>({}),[version,setVersion]=useState(''),[loading,setLoading]=useState(!!id),[saving,setSaving]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState(''),[conflict,setConflict]=useState(false),[reload,setReload]=useState(0);
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>node?.close();},[]);
 useEffect(()=>{
  const transport=createWorkspaceClient(context.tenant.id,sessionBoundary.capture().signal);client.current=transport;alive.current=true;let active=true;
  if(id)queueMicrotask(()=>{if(!active)return;setLoading(true);setError('');void transport.medicine(id,branchId).then(value=>{if(!active)return;const current=editMedicineDraft(value,context.tenant.id);if(current.id!==id)throw new Error('Invalid medicine response');setDraft(current.draft);setLabels(current.labels);setVersion(current.updatedAt);setConflict(false);attempt.current=null;}).catch(cause=>{if(active)setError(cause instanceof WorkspaceError?cause.message:t('Medicine details could not be loaded. Please try again.'));}).finally(()=>{if(active)setLoading(false);});});
  return()=>{active=false;alive.current=false;transport.dispose();client.current=null;};
 },[context,id,branchId,t,reload]);
 const canSave=context.permissions.includes(id?'medicine:update':'medicine:create');
 function close(){if(!submitting.current&&!uncertain)onClose();}
 async function save(event:FormEvent){
  event.preventDefault();if(submitting.current||!client.current||!canSave||conflict||loading)return;
  let body:Record<string,unknown>;
  try{body=medicinePayload(draft);if(id){if(!version)throw new Error(t('Reload medicine before editing.'));body.expectedUpdatedAt=version;}}
  catch(cause){setError(t(cause instanceof Error?cause.message:'Invalid medicine form.'));return;}
  const fingerprint=JSON.stringify(body);if(!attempt.current||attempt.current.fingerprint!==fingerprint)attempt.current={fingerprint,key:crypto.randomUUID(),body};
  submitting.current=true;setSaving(true);setError('');
  try{
   const result=await client.current.saveMedicine(id,attempt.current.body,attempt.current.key);
   if(!alive.current)return;
   if(!result||typeof result!=='object'||!('tenantId'in result)||result.tenantId!==context.tenant.id||!('id'in result)||typeof result.id!=='string'||id&&result.id!==id)throw new Error('Save status could not be verified. Retry the same details.');
   setUncertain(false);onSaved(!id);
  }catch(cause){
   if(!alive.current)return;
   const unknown=!(cause instanceof WorkspaceError)||cause.status===0||cause.status>=500;
   setUncertain(unknown);setError(cause instanceof Error?cause.message:t('Medicine could not be saved. Please try again.'));
   if(cause instanceof WorkspaceError&&cause.status===409&&id)setConflict(true);
  }finally{submitting.current=false;if(alive.current)setSaving(false);}
 }
 return <dialog ref={dialog} className="tenant-editor workspace-branch-dialog" aria-labelledby="tenant-editor-title" onCancel={event=>{event.preventDefault();close();}} onClose={()=>{if(!dialog.current?.open&&!submitting.current&&!uncertain)onClose();}} onClick={event=>{if(event.target!==event.currentTarget)return;const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}}>
  <form onSubmit={save} onChange={()=>{if(!conflict&&!uncertain)setError('');}}><header><div><h2 id="tenant-editor-title">{t(id?'Edit medicine':'Add medicine')}</h2><p>{t('Medicine changes apply across this shop. Stock is managed separately.')}</p></div><button type="button" disabled={saving||uncertain} aria-label={t('Close medicine form')} onClick={close}><X size={18}/></button></header>
   {error&&<div role="alert" className="shop-access-error">{t(error)}</div>}
   {uncertain&&<p role="status">{t('Save status is unknown. Retry the same details to check; do not create another medicine.')}</p>}
   {conflict&&<button type="button" onClick={()=>setReload(value=>value+1)}>{t('Reload medicine')}</button>}
   {loading?<DataSkeleton variant="form" rows={4}>{t('Loading medicine details…')}</DataSkeleton>:<fieldset disabled={saving||uncertain||conflict||!canSave||!!id&&!version}>
    <legend>{t('Medicine details')}</legend><div className="tenant-editor-grid">
     {([['name','Medicine name',200,true],['nameBangla','Medicine name (Bangla)',300,false],['genericName','Generic name',200,false],['genericNameBangla','Generic name (Bangla)',300,false],['barcode','Barcode',100,false],['unit','Unit',50,true],['dosageForm','Dosage form',200,false],['strength','Strength',200,false]]as const).map(([key,label,max,required])=><label key={key}><span>{t(label)}{required?' *':''}</span><input required={required} maxLength={max} value={draft[key]??''} onChange={event=>setDraft(value=>({...value,[key]:event.target.value}))}/></label>)}
     {(['purchasePrice','salePrice','mrp','reorderLevel']as const).map(key=><label key={key}><span>{t({purchasePrice:'Purchase price',salePrice:'Sale price',mrp:'MRP',reorderLevel:'Reorder level'}[key])}</span><input required inputMode={key==='reorderLevel'?'numeric':'decimal'} value={draft[key]} onChange={event=>setDraft(value=>({...value,[key]:event.target.value}))}/></label>)}
     <label><span>{t('Status')}</span><Select aria-label={t('Medicine form status')} value={draft.isActive} onChange={event=>setDraft(value=>({...value,isActive:event.target.value}))}><option value="true">{t('Active')}</option><option value="false">{t('Inactive')}</option></Select></label>
    </div><h3>{t('Catalog references')}</h3><div className="tenant-editor-grid">{medicineReferences.map(ref=><div className="tenant-editor-reference" key={ref.key}><span>{t(ref.label)}</span><ReferencePicker tenantId={context.tenant.id} kind={ref.kind} label={ref.label} value={draft[ref.key]??''} currentLabel={labels[ref.key]} canRead={context.permissions.includes(ref.permission)} disabled={saving||uncertain} onChange={selected=>setDraft(value=>({...value,[ref.key]:selected}))}/></div>)}</div>
   </fieldset>}
   <footer><button type="button" disabled={saving||uncertain} onClick={close}>{t('Cancel')}</button><button type="submit" disabled={saving||loading||conflict||!canSave||!!id&&!version}><Save size={16}/>{t(saving?'Saving…':uncertain?'Retry save':'Save medicine')}</button></footer>
  </form>
 </dialog>;
}
