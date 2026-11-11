"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Select} from '@/components/ui/select';
import {DataSkeleton} from '@/components/ui/skeleton';
import {useLanguage} from '@/lib/i18n/language-provider';
import {sessionBoundary} from '@/lib/api/session-boundary';
import {type ShopContext} from './shop-contract';
import {type PurchaseDetail} from './purchase-read-policy';
import {createWorkspaceClient,WorkspaceError} from './workspace-client';
import {validReturnDetail,validRefundResult,type ReturnDetail} from './purchase-return-policy';
import {purchaseCents} from './purchase-policy';
import {supplierPaymentMethods,paymentAccountType,validSupplierPayment,type SupplierPayment,type PaymentAccount} from './purchase-payment-policy';
import {RefundAccountPicker} from './refund-account-picker';
export function SupplierRefundForm({context,purchase,returnId,onClose,onSaved}:{context:ShopContext;purchase:PurchaseDetail;returnId:string;onClose:()=>void;onSaved:(value:ReturnDetail)=>void|Promise<void>}){
 const {t}=useLanguage(),client=useRef<ReturnType<typeof createWorkspaceClient>|null>(null),active=useRef(false),submitting=useRef(false),full=useRef<HTMLButtonElement>(null),attempt=useRef<{body:SupplierPayment;key:string}|null>(null);
 const [record,setRecord]=useState<ReturnDetail|null>(null),[reload,setReload]=useState(0),[loading,setLoading]=useState(true),[method,setMethod]=useState<SupplierPayment['paymentMethod']>('cash'),[account,setAccount]=useState<PaymentAccount|null>(null),[amount,setAmount]=useState(''),[note,setNote]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false),[uncertain,setUncertain]=useState(false),[conflict,setConflict]=useState(false);
 const locked=saving||uncertain,allowed=['purchase:update','account:read'].every(permission=>context.permissions.includes(permission));
 useEffect(()=>{const transport=createWorkspaceClient(context.tenant.id,sessionBoundary.capture().signal);client.current=transport;active.current=true;return()=>{active.current=false;transport.dispose();};},[context]);
 useEffect(()=>{let current=true;queueMicrotask(()=>{if(!current)return;setLoading(true);setRecord(null);setError('');setConflict(false);attempt.current=null;void client.current?.purchaseReturn(returnId).then(value=>{if(!current)return;if(!validReturnDetail(value,purchase)||value.id!==returnId||value.status!=='completed')throw new Error('Completed owned return required for a refund.');setRecord(value);setAmount('');}).catch(cause=>{if(current)setError(cause instanceof Error?cause.message:'Return could not be loaded.');}).finally(()=>{if(current)setLoading(false);});});return()=>{current=false;};},[purchase,returnId,reload]);
 useEffect(()=>{if(record)full.current?.focus();},[record]);
 async function save(event:FormEvent){event.preventDefault();if(!allowed||!record||!client.current||submitting.current||conflict)return;let body:SupplierPayment;
  try{if(uncertain&&attempt.current)body=attempt.current.body;else{if(!account||account.tenantId!==context.tenant.id||account.type!==paymentAccountType(method))throw new Error('Choose an active account matching the payment method.');if(!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(amount))throw new Error('Enter a positive refund amount with at most two decimals.');body={accountId:account.id,amount:Number(amount),paymentMethod:method,note:note.trim()};if(!validSupplierPayment(body)||purchaseCents(body.amount)>purchaseCents(Number(record.refundableCredit)))throw new Error('Refund cannot exceed the remaining supplier credit.');}if(!attempt.current||JSON.stringify(attempt.current.body)!==JSON.stringify(body))attempt.current={body,key:crypto.randomUUID()};}
  catch(cause){setError(t(cause instanceof Error?cause.message:'Invalid supplier refund.'));return;}
  const current=attempt.current!;submitting.current=true;setSaving(true);setError('');
  try{const value=await client.current.refundSupplier(record.id,current.body,current.key);if(!active.current)return;if(!validRefundResult(value,record,purchase,current.body))throw new Error('Refund status could not be verified. Retry the same details.');setUncertain(false);await onSaved(value);}
  catch(cause){if(!active.current)return;const unknown=!(cause instanceof WorkspaceError)||cause.status>=500;setUncertain(unknown);setError(t(cause instanceof Error?cause.message:'Refund could not be recorded.'));if(!unknown){attempt.current=null;setConflict(true);}}
  finally{submitting.current=false;if(active.current)setSaving(false);}
 }
 return <section className="tenant-supplier-payment" aria-label={t('Receive supplier refund')}><h3>{t('Receive supplier refund')}</h3>{error&&<div role="alert" className="shop-access-error">{error}</div>}{uncertain&&<p role="status">{t('Refund status is unknown. Retry the same details.')}</p>}
 {loading?<DataSkeleton variant="form" rows={2}>{t('Loading…')}</DataSkeleton>:record&&<div className="tenant-stock-summary"><strong>{record.poNumber}</strong><strong>{t('Refundable credit')}: BDT {Number(record.refundableCredit).toFixed(2)}</strong><span>{t('Already refunded')}: BDT {Number(record.refundedAmount).toFixed(2)}</span></div>}
 <button type="button" disabled={locked} onClick={()=>{setAccount(null);setReload(value=>value+1);}}>{t('Reload refund and accounts')}</button>
 <form onSubmit={save}><fieldset disabled={locked||conflict||loading||!record||!allowed}><legend>{t('Money received from supplier')}</legend><div className="tenant-editor-grid"><label><span>{t('Payment method')}</span><Select aria-label={t('Supplier refund method')} value={method} onChange={event=>{setAccount(null);setMethod(event.target.value as SupplierPayment['paymentMethod']);}}>{supplierPaymentMethods.map(value=><option key={value} value={value}>{t(value)}</option>)}</Select></label><label><span>{t('Refund amount')}</span><input required aria-label={t('Supplier refund amount')} inputMode="decimal" value={amount} onChange={event=>setAmount(event.target.value)}/></label></div>
 <button type="button" ref={full} disabled={!record||Number(record.refundableCredit)<=0} onClick={()=>setAmount(Number(record!.refundableCredit).toFixed(2))}>{t('Receive full supplier credit')}</button>
 {method==='cash'&&<p>{t('Receiving cash requires your open register in this branch.')}</p>}
 <RefundAccountPicker key={`${method}:${reload}`} tenantId={context.tenant.id} branchId={purchase.branchId} type={paymentAccountType(method)} value={account?.id??''} disabled={locked||conflict} onChange={setAccount}/>
 <label><span>{t('Note')}</span><input maxLength={2000} value={note} onChange={event=>setNote(event.target.value)}/></label><p>{t('Record only money actually received. Due reduction is already recorded when the return is completed.')}</p></fieldset>
 <footer><button type="button" disabled={locked} onClick={onClose}>{t('Cancel')}</button><button type="submit" disabled={saving||loading||conflict||!record||Number(record.refundableCredit)<=0||!allowed}>{t(saving?'Saving…':uncertain?'Retry same save':'Confirm supplier refund')}</button></footer></form></section>;
}
