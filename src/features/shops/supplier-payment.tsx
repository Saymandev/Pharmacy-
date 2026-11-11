"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Select} from '@/components/ui/select';
import {DataSkeleton} from '@/components/ui/skeleton';
import {sessionBoundary} from '@/lib/api/session-boundary';
import {useLanguage} from '@/lib/i18n/language-provider';
import {type ShopContext} from './shop-contract';
import {type WorkspaceBranch} from './workspace-contract';
import {createWorkspaceClient,WorkspaceError} from './workspace-client';
import {validPurchaseDetail,type PurchaseDetail} from './purchase-read-policy';
import {validCatalogPage,type CatalogMeta} from './catalog-contract';
import {supplierPaymentMethods,paymentAccountType,validPaymentAccount,supplierPaymentPayload,validSupplierPaymentResult,purchasePaymentTransactions,type PaymentAccount,type SupplierPayment} from './purchase-payment-policy';
export function SupplierPaymentForm({context,branch,purchaseId,onClose,onSaved}:{context:ShopContext;branch:WorkspaceBranch;purchaseId:string;onClose:()=>void;onSaved:(result:PurchaseDetail)=>void}){
 const {t}=useLanguage(),client=useRef<ReturnType<typeof createWorkspaceClient>|null>(null),active=useRef(false),submitting=useRef(false),fullDue=useRef<HTMLButtonElement>(null),attempt=useRef<{body:SupplierPayment;key:string}|null>(null);
 const [purchase,setPurchase]=useState<PurchaseDetail|null>(null),[reload,setReload]=useState(0),[loading,setLoading]=useState(true),[accounts,setAccounts]=useState<PaymentAccount[]>([]),[meta,setMeta]=useState<CatalogMeta|null>(null),[accountsLoading,setAccountsLoading]=useState(true),[search,setSearch]=useState(''),[query,setQuery]=useState({page:1,search:''}),[method,setMethod]=useState<SupplierPayment['paymentMethod']>('cash'),[account,setAccount]=useState<PaymentAccount|null>(null),[amount,setAmount]=useState(''),[note,setNote]=useState(''),[saving,setSaving]=useState(false),[uncertain,setUncertain]=useState(false),[conflict,setConflict]=useState(false),[error,setError]=useState(''),[accountError,setAccountError]=useState('');
 const type=paymentAccountType(method),locked=saving||uncertain,allowed=['purchase:update','account:read'].every(permission=>context.permissions.includes(permission));
 useEffect(()=>{const transport=createWorkspaceClient(context.tenant.id,sessionBoundary.capture().signal);client.current=transport;active.current=true;return()=>{active.current=false;transport.dispose();};},[context]);
 useEffect(()=>{let current=true;queueMicrotask(()=>{if(!current)return;setLoading(true);setPurchase(null);setError('');setConflict(false);attempt.current=null;
  void client.current?.purchase(purchaseId).then(value=>{if(!current)return;if(!validPurchaseDetail(value,context.tenant.id,branch.id)||value.id!==purchaseId||value.status!=='completed')throw new Error('A completed purchase in this branch is required.');purchasePaymentTransactions(value);setPurchase(value);setAmount('');}).catch(cause=>{if(current)setError(cause instanceof Error?cause.message:'Purchase could not be loaded.');}).finally(()=>{if(current)setLoading(false);});});return()=>{current=false;};},[context.tenant.id,branch.id,purchaseId,reload]);
 useEffect(()=>{if(purchase)fullDue.current?.focus();},[purchase]);
 useEffect(()=>{let current=true;queueMicrotask(()=>{if(!current)return;setAccountsLoading(true);setAccounts([]);setMeta(null);setAccountError('');setAccount(null);
  void client.current?.paymentAccounts(branch.id,query.page,query.search,type).then(value=>{if(!current)return;if(!validCatalogPage(value,query.page,(row):row is PaymentAccount=>validPaymentAccount(row,context.tenant.id,type)))throw new Error('Payment accounts could not be verified.');setAccounts(value.data);setMeta(value.meta);}).catch(cause=>{if(current)setAccountError(cause instanceof Error?cause.message:'Payment accounts could not be loaded.');}).finally(()=>{if(current)setAccountsLoading(false);});});return()=>{current=false;};},[context.tenant.id,branch.id,query,type,reload]);
 async function save(event:FormEvent){event.preventDefault();if(!purchase||!allowed||!client.current||submitting.current||loading||accountsLoading||conflict)return;let body:SupplierPayment;
  try{body=uncertain&&attempt.current?attempt.current.body:supplierPaymentPayload(purchase,account,amount,method,note);if(!attempt.current||JSON.stringify(attempt.current.body)!==JSON.stringify(body))attempt.current={body,key:crypto.randomUUID()};}catch(cause){setError(t(cause instanceof Error?cause.message:'Invalid supplier payment.'));return;}
  const current=attempt.current!;submitting.current=true;setSaving(true);setError('');
  try{const value=await client.current.payPurchase(purchase.id,current.body,current.key);if(!active.current)return;if(!validSupplierPaymentResult(value,purchase,current.body))throw new Error('Supplier payment status could not be verified. Retry the same details.');setUncertain(false);onSaved(value);}
  catch(cause){if(!active.current)return;const unknown=!(cause instanceof WorkspaceError)||cause.status>=500;setUncertain(unknown);setError(t(cause instanceof Error?cause.message:'Supplier payment could not be saved.'));if(!unknown){attempt.current=null;setConflict(true);}}
  finally{submitting.current=false;if(active.current)setSaving(false);}
 }
 return <section className="tenant-supplier-payment" aria-label={t('Pay supplier')}><h3>{t('Pay supplier')}</h3>
  {error&&<div role="alert" className="shop-access-error">{error}</div>}{uncertain&&<p role="status">{t('Payment status is unknown. Retry the same details to avoid paying twice.')}</p>}
  {loading?<DataSkeleton variant="form" rows={2}>{t('Loading current purchase due…')}</DataSkeleton>:purchase&&<div className="tenant-stock-summary"><strong>{purchase.poNumber}</strong><strong>{t('Outstanding due')}: BDT {Number(purchase.dueAmount).toFixed(2)}</strong><span>{t('Paid')}: BDT {Number(purchase.paidAmount).toFixed(2)}</span></div>}
  <button type="button" disabled={locked} onClick={()=>setReload(value=>value+1)}>{t('Reload purchase and accounts')}</button>
  <form onSubmit={save}>
   <fieldset disabled={locked||conflict||loading||!purchase||!allowed}><legend>{t('Supplier payment details')}</legend>
    <div className="tenant-editor-grid"><label><span>{t('Payment method')}</span><Select aria-label={t('Supplier payment method')} value={method} onChange={event=>{setMethod(event.target.value as SupplierPayment['paymentMethod']);setAccount(null);setSearch('');setQuery({page:1,search:''});}}>{supplierPaymentMethods.map(value=><option key={value} value={value}>{t(value)}</option>)}</Select></label>
     <label><span>{t('Payment amount')} *</span><input required aria-label={t('Supplier payment amount')} inputMode="decimal" value={amount} onChange={event=>setAmount(event.target.value)}/></label></div>
    <button ref={fullDue} type="button" disabled={!purchase||Number(purchase.dueAmount)<=0} onClick={()=>setAmount(Number(purchase!.dueAmount).toFixed(2))}>{t('Pay full supplier due')}</button>
    {method==='cash'&&<p>{t('Cash payments require exactly one open register for this branch and sufficient cash balance.')}</p>}
    <div className="tenant-bulk-toolbar"><label><span>{t('Search payment accounts')}</span><input aria-label={t('Search payment accounts')} maxLength={200} value={search} onChange={event=>setSearch(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();setAccount(null);setQuery({page:1,search});}}}/></label><button type="button" onClick={()=>{setAccount(null);setQuery({page:1,search});}}>{t('Search accounts')}</button></div>
    {accountError&&<div role="alert" className="shop-access-error">{accountError}</div>}
    {accountsLoading?<DataSkeleton variant="form" rows={1}>{t('Loading payment accounts…')}</DataSkeleton>:<label><span>{t('Payment account')} *</span><Select aria-label={t('Supplier payment account')} value={account?.id??''} onChange={event=>setAccount(accounts.find(row=>row.id===event.target.value)??null)}><option value="">{t('Select an account')}</option>{accounts.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</Select></label>}
    {!accountsLoading&&!accountError&&!accounts.length&&<p>{t('No matching payment accounts.')}</p>}
    {meta&&<nav className="tenant-catalog-pages"><span>{t('Page')} {meta.page} / {Math.max(1,meta.totalPages)}</span><button type="button" disabled={!meta.hasPreviousPage||accountsLoading} onClick={()=>{setAccount(null);setQuery(value=>({...value,page:value.page-1}));}}>{t('Previous')}</button><button type="button" disabled={!meta.hasNextPage||accountsLoading} onClick={()=>{setAccount(null);setQuery(value=>({...value,page:value.page+1}));}}>{t('Next')}</button></nav>}
    <p>{t('Searching or changing page/method clears account selection.')}</p>
    <label><span>{t('Payment note (optional)')}</span><input maxLength={2000} value={note} onChange={event=>setNote(event.target.value)}/></label>
   </fieldset>
   <footer><button type="button" disabled={locked} onClick={onClose}>{t('Cancel')}</button><button type="submit" disabled={saving||loading||accountsLoading||conflict||!purchase||Number(purchase.dueAmount)<=0||!allowed}>{t(saving?'Saving…':uncertain?'Retry same save':'Confirm supplier payment')}</button></footer>
  </form>
 </section>;
}
