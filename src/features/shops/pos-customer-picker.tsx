"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {Select} from '@/components/ui/select';
import {useLanguage} from '@/lib/i18n/language-provider';
import {sessionBoundary} from '@/lib/api/session-boundary';
import {createWorkspaceClient} from './workspace-client';
import {validCatalogPage,type CatalogMeta} from './catalog-contract';
import {validPosCustomer,type PosCustomer} from './tenant-pos-policy';
export function PosCustomerPicker({tenantId,value,disabled,onChange,onBusyChange}:{tenantId:string;value:PosCustomer|null;disabled:boolean;onChange:(v:PosCustomer|null)=>void;onBusyChange:(v:boolean)=>void}){
 const {t}=useLanguage(),client=useRef<ReturnType<typeof createWorkspaceClient>|null>(null),revision=useRef(0);
 const [rows,setRows]=useState<PosCustomer[]>([]),[search,setSearch]=useState(''),[query,setQuery]=useState({page:1,search:''}),[meta,setMeta]=useState<CatalogMeta|null>(null),[loading,setLoading]=useState(true),[selecting,setSelecting]=useState(false),[error,setError]=useState('');
 const invalidate=useCallback(()=>{revision.current++;},[]);
 useEffect(()=>{const transport=createWorkspaceClient(tenantId,sessionBoundary.capture().signal);client.current=transport;return()=>{invalidate();transport.dispose();onBusyChange(false);};},[tenantId,invalidate,onBusyChange]);
 useEffect(()=>{let active=true;queueMicrotask(()=>{if(!active)return;setLoading(true);setRows([]);setMeta(null);setError('');void client.current!.posCustomers(query.page,query.search).then(value=>{if(!active)return;if(!validCatalogPage(value,query.page,(row):row is PosCustomer=>validPosCustomer(row,tenantId)))throw new Error('Customers could not be verified.');setRows(value.data.filter(row=>!row.isWalkIn));setMeta(value.meta);}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Customers could not be loaded.');}).finally(()=>{if(active)setLoading(false);});});return()=>{active=false;};},[tenantId,query]);
 async function choose(id:string){if(disabled||selecting)return;const current=++revision.current;onChange(null);if(!id)return;setSelecting(true);onBusyChange(true);setError('');try{const value=await client.current!.posCustomer(id);if(current!==revision.current)return;if(!validPosCustomer(value,tenantId)||value.id!==id||value.isWalkIn)throw new Error('Customer could not be verified.');onChange(value);}catch(cause){if(current===revision.current)setError(cause instanceof Error?cause.message:'Customer could not be loaded.');}finally{if(current===revision.current){setSelecting(false);onBusyChange(false);}}}
 return <div className="pos-customer-picker"><div className="tenant-pos-account-search"><label>{t('Search customers by name or phone')}<input maxLength={200} disabled={disabled||selecting} value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();setQuery({page:1,search});}}}/></label><button type="button" disabled={disabled||selecting} onClick={()=>setQuery({page:1,search})}>{t('Search customers')}</button></div>
  <label>{t('Sale customer')}<Select aria-label={t('Sale customer')} value={value?.id??''} disabled={disabled||selecting||loading} onChange={e=>void choose(e.target.value)}><option value="">{t('Walk-in Customer')}</option>{value&&!rows.some(r=>r.id===value.id)&&<option value={value.id}>{value.name} · {value.phone}</option>}{rows.map(row=><option key={row.id} value={row.id}>{row.name} · {row.phone}</option>)}</Select></label>
  {value&&<div className="pos-customer-summary"><strong>{value.name}</strong><span>{value.phone} · {value.customerNumber}</span><span>{t('Available advance')}: BDT {Number(value.balance).toFixed(2)}</span></div>}{error&&<p role="alert">{t(error)}</p>}
  {meta&&<nav aria-label={t('Customer pages')}><button type="button" disabled={disabled||loading||selecting||!meta.hasPreviousPage} onClick={()=>setQuery(q=>({...q,page:q.page-1}))}>{t('Previous')}</button><span>{meta.page} / {Math.max(1,meta.totalPages)}</span><button type="button" disabled={disabled||loading||selecting||!meta.hasNextPage} onClick={()=>setQuery(q=>({...q,page:q.page+1}))}>{t('Next')}</button></nav>}
 </div>;
}
