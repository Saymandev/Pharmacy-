"use client";
import {useEffect,useRef,useState} from 'react';
import {Select} from '@/components/ui/select';
import {useLanguage} from '@/lib/i18n/language-provider';
import {sessionBoundary} from '@/lib/api/session-boundary';
import {createWorkspaceClient} from './workspace-client';
import {validCatalogPage,type CatalogMeta} from './catalog-contract';
import {validPaymentAccount,type PaymentAccount} from './purchase-payment-policy';
export function RefundAccountPicker({tenantId,branchId,type,disabled,value,onChange,label='Supplier refund account'}:{tenantId:string;branchId:string;type:string;disabled:boolean;value:string;onChange:(account:PaymentAccount|null)=>void;label?:string}){
 const {t}=useLanguage(),client=useRef<ReturnType<typeof createWorkspaceClient>|null>(null);
 const [rows,setRows]=useState<PaymentAccount[]>([]),[query,setQuery]=useState({page:1,search:''}),[search,setSearch]=useState(''),[meta,setMeta]=useState<CatalogMeta|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{const transport=createWorkspaceClient(tenantId,sessionBoundary.capture().signal);client.current=transport;return()=>transport.dispose();},[tenantId]);
 useEffect(()=>{let current=true;queueMicrotask(()=>{if(!current)return;setLoading(true);setRows([]);setMeta(null);setError('');onChange(null);void client.current?.paymentAccounts(branchId,query.page,query.search,type).then(result=>{if(!current)return;if(!validCatalogPage(result,query.page,(row):row is PaymentAccount=>validPaymentAccount(row,tenantId,type)))throw new Error('Refund accounts could not be verified.');setRows(result.data);setMeta(result.meta);}).catch(cause=>{if(current)setError(cause instanceof Error?cause.message:'Refund accounts could not be loaded.');}).finally(()=>{if(current)setLoading(false);});});return()=>{current=false;};},[tenantId,branchId,type,query,onChange]);
 return <div><div className="tenant-bulk-toolbar"><label><span>{t('Search refund accounts')}</span><input maxLength={200} disabled={disabled} value={search} onChange={event=>setSearch(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();setQuery({page:1,search});}}}/></label><button type="button" disabled={disabled} onClick={()=>setQuery({page:1,search})}>{t('Search accounts')}</button></div>{error&&<p role="alert">{error}</p>}
 <label><span>{t('Refund account')}</span><Select aria-label={t(label)} disabled={disabled||loading} value={value} onChange={event=>onChange(rows.find(row=>row.id===event.target.value)??null)}><option value="">{t(loading?'Loading…':'Select an account')}</option>{rows.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</Select></label>
 {meta&&<nav className="tenant-catalog-pages"><span>{t('Page')} {meta.page} / {Math.max(1,meta.totalPages)}</span><button type="button" disabled={disabled||loading||!meta.hasPreviousPage} onClick={()=>setQuery(value=>({...value,page:value.page-1}))}>{t('Previous')}</button><button type="button" disabled={disabled||loading||!meta.hasNextPage} onClick={()=>setQuery(value=>({...value,page:value.page+1}))}>{t('Next')}</button></nav>}</div>;
}
