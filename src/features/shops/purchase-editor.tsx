"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {X} from 'lucide-react';
import {ReferencePicker} from './reference-picker';
import {Select} from '@/components/ui/select';
import {useLanguage} from '@/lib/i18n/language-provider';
import {sessionBoundary} from '@/lib/api/session-boundary';
import {type ShopContext} from './shop-contract';
import {type WorkspaceBranch} from './workspace-contract';
import {createWorkspaceClient,WorkspaceError} from './workspace-client';
import {validPurchaseBody,validPurchaseResult,purchaseTotals,type PurchaseBody} from './purchase-policy';
type Line={key:string;medicineId:string;unit:string;price:string;salePrice:string;mrp:string;quantity:string;batchNumber:string;expiryDate:string;rackNumber:string;discountAmount:string};
const newLine=():Line=>({key:crypto.randomUUID(),medicineId:'',unit:'Pcs',price:'0',salePrice:'0',mrp:'0',quantity:'1',batchNumber:'',expiryDate:'',rackNumber:'',discountAmount:'0'});
const fields=[['batchNumber','Batch number'],['expiryDate','Expiry date'],['quantity','Quantity'],['unit','Unit'],['price','Unit cost'],['salePrice','Sale price'],['mrp','MRP'],['discountAmount','Line discount'],['rackNumber','Rack']] as const;
export function PurchaseEditor({context,branch,onClose,onSaved}:{context:ShopContext;branch:WorkspaceBranch;onClose:()=>void;onSaved:(reference:string)=>void}){
 const {t}=useLanguage(),dialog=useRef<HTMLDialogElement>(null),client=useRef<ReturnType<typeof createWorkspaceClient>|null>(null),active=useRef(false),submitting=useRef(false),attempt=useRef<{body:PurchaseBody;key:string}|null>(null);
 const [supplierId,setSupplierId]=useState(''),[lines,setLines]=useState<Line[]>([]),[status,setStatus]=useState<'pending'|'completed'>('pending'),[discount,setDiscount]=useState('0'),[note,setNote]=useState(''),[review,setReview]=useState<PurchaseBody|null>(null),[saving,setSaving]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState('');
 const allowed=['purchase:create','medicine:read','supplier:read'].every(permission=>context.permissions.includes(permission));
 useEffect(()=>{const node=dialog.current;node?.showModal();queueMicrotask(()=>setLines([newLine()]));return()=>node?.close();},[]);
 useEffect(()=>{const transport=createWorkspaceClient(context.tenant.id,sessionBoundary.capture().signal);client.current=transport;active.current=true;return()=>{active.current=false;transport.dispose();};},[context]);
 function close(){if(!submitting.current&&!uncertain)onClose();}
 function build():PurchaseBody{
  const amount=(value:string)=>{if(!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value))throw new Error('Use non-negative prices with at most two decimals.');return Number(value);};
  const body:PurchaseBody={branchId:branch.id,supplierId,type:'pharmacy',status,discountAmount:amount(discount),payments:[],note:note.trim(),purchaseItems:lines.map(line=>{if(!/^\d+$/.test(line.quantity))throw new Error('Quantity must be a positive whole number.');const date=new Date(`${line.expiryDate}T00:00:00.000Z`);if(!/^\d{4}-\d{2}-\d{2}$/.test(line.expiryDate)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==line.expiryDate)throw new Error('Enter a valid expiry date.');return {medicineId:line.medicineId,unit:line.unit.trim(),price:amount(line.price),salePrice:amount(line.salePrice),mrp:amount(line.mrp),quantity:Number(line.quantity),batchNumber:line.batchNumber.trim(),expiryDate:date.toISOString(),rackNumber:line.rackNumber.trim(),discountAmount:amount(line.discountAmount)};})};
  if(!validPurchaseBody(body))throw new Error('Check supplier, medicines, batches, quantities, dates and discounts. Duplicate medicine/batch lines are not allowed.');return body;
 }
 async function submit(event:FormEvent){event.preventDefault();if(!allowed||submitting.current||!client.current)return;setError('');
  if(!review){try{setReview(build());}catch(cause){setError(t(cause instanceof Error?cause.message:'Invalid purchase.'));}return;}
  if(!attempt.current)attempt.current={body:review,key:crypto.randomUUID()};const current=attempt.current;submitting.current=true;setSaving(true);
  try{const result=await client.current.createPurchase(current.body,current.key);if(!active.current)return;if(!validPurchaseResult(result,context.tenant.id,current.body))throw new Error('Purchase save status could not be verified. Retry the same details.');setUncertain(false);onSaved((result as {poNumber:string}).poNumber);}
  catch(cause){if(!active.current)return;setUncertain(!(cause instanceof WorkspaceError)||cause.status>=500);setError(cause instanceof Error?t(cause.message):t('Purchase could not be saved.'));}
  finally{submitting.current=false;if(active.current)setSaving(false);}
 }
 const totals=review?purchaseTotals(review):null;
 return <dialog ref={dialog} className="tenant-editor tenant-bulk-editor workspace-branch-dialog" aria-labelledby="tenant-purchase-title" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target!==event.currentTarget)return;const box=event.currentTarget.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)close();}}>
  <header><div><h2 id="tenant-purchase-title">{t(review?'Review purchase':'New purchase')}</h2><p>{context.tenant.name} · {branch.name}</p></div><button type="button" aria-label={t('Close purchase')} disabled={saving||uncertain} onClick={close}><X size={18}/></button></header>
  {error&&<div role="alert" className="shop-access-error">{error}</div>}
  {uncertain&&<p role="status">{t('Purchase save status is unknown. Retry the same details.')}</p>}
  <form onSubmit={submit}>
   <fieldset disabled={!!review||saving||!allowed}><legend>{t('Purchase details')}</legend><div className="tenant-editor-grid">
    <div className="tenant-editor-reference"><span>{t('Supplier')} *</span><ReferencePicker tenantId={context.tenant.id} kind="suppliers" label="Purchase supplier" value={supplierId} canRead={context.permissions.includes('supplier:read')} disabled={!!review} onChange={setSupplierId}/></div>
    <label><span>{t('Purchase status')}</span><Select aria-label={t('Purchase status')} value={status} onChange={event=>setStatus(event.target.value as 'pending'|'completed')}><option value="pending">{t('Pending')}</option><option value="completed">{t('Completed')}</option></Select></label>
   </div><p>{t(status==='pending'?'Pending saves a draft without adding stock.':'Completed receives stock immediately. Verify batch cost, unit, MRP and expiry.')}</p>
   {lines.map((line,index)=><section className="tenant-purchase-line" key={line.key}><h3>{t('Purchase line')} {index+1}</h3><ReferencePicker tenantId={context.tenant.id} branchId={branch.id} kind="stock-medicines" label={`Purchase medicine ${index+1}`} value={line.medicineId} canRead={context.permissions.includes('medicine:read')} disabled={!!review} onChange={id=>setLines(value=>value.map(item=>item.key===line.key?{...item,medicineId:id}:item))}/>
    <div className="tenant-editor-grid">{fields.map(([key,label])=><label key={key}><span>{t(label)}{key==='rackNumber'?'':' *'}</span><input aria-label={`${t(label)} ${index+1}`} required={key!=='rackNumber'} type={key==='expiryDate'?'date':'text'} inputMode={['price','salePrice','mrp','discountAmount'].includes(key)?'decimal':key==='quantity'?'numeric':undefined} maxLength={key==='unit'?50:100} value={line[key]} onChange={event=>setLines(value=>value.map(item=>item.key===line.key?{...item,[key]:event.target.value}:item))}/></label>)}</div>
    <button type="button" disabled={lines.length===1} onClick={()=>setLines(value=>value.filter(item=>item.key!==line.key))}>{t('Remove line')} {index+1}</button>
   </section>)}
   <button type="button" disabled={lines.length>=50} onClick={()=>setLines(value=>[...value,newLine()])}>{t('Add purchase line')}</button>
   <div className="tenant-editor-grid"><label><span>{t('Purchase discount')}</span><input required inputMode="decimal" value={discount} onChange={event=>setDiscount(event.target.value)}/></label><label><span>{t('Note')}</span><input maxLength={2000} value={note} onChange={event=>setNote(event.target.value)}/></label></div>
   </fieldset>
   {totals&&<section className="tenant-stock-summary" aria-label={t('Purchase totals')}><strong>{t('Subtotal')}: BDT {totals.subtotal.toFixed(2)}</strong><span>{t('Discount')}: BDT {totals.discount.toFixed(2)}</span><strong>{t('Net payable')}: BDT {totals.net.toFixed(2)}</strong><span>{t('Outstanding due')}: BDT {totals.net.toFixed(2)}</span></section>}
   <p>{t('This purchase is saved on credit. Supplier payment is recorded separately.')}</p>
   <footer>{review&&<button type="button" disabled={saving||uncertain} onClick={()=>{attempt.current=null;setReview(null);setError('');}}>{t('Back to edit')}</button>}<button type="submit" disabled={!allowed||saving}>{t(saving?'Saving…':uncertain?'Retry same save':review?'Confirm purchase':'Review purchase')}</button></footer>
  </form>
 </dialog>;
}
