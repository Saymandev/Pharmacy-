"use client";
import { useEffect,useRef,useState } from 'react';
import { Select } from '@/components/ui/select';
import { useLanguage } from '@/lib/i18n/language-provider';
import { sessionBoundary } from '@/lib/api/session-boundary';
import { type ShopContext } from './shop-contract';
import { type WorkspaceBranch,validWorkspaceBootstrap } from './workspace-contract';
import { createWorkspaceClient } from './workspace-client';

export function TransferDestination({context,sourceId,value,onChange}:{context:ShopContext;sourceId:string;value:string;onChange:(id:string)=>void}){
 const {t}=useLanguage(),revision=useRef(0);
 const [query,setQuery]=useState<{search:string;after?:string}>({search:''}),[rows,setRows]=useState<WorkspaceBranch[]>([]),[more,setMore]=useState<string|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const client=createWorkspaceClient(context.tenant.id,sessionBoundary.capture().signal),current=++revision.current;let active=true;
  const timer=setTimeout(()=>{setLoading(true);setError('');void client.bootstrap(query.after,query.search).then(result=>{
   if(!active||current!==revision.current)return;
   if(!validWorkspaceBootstrap(result,context))throw new Error(t('Destination access could not be verified.'));
   const next=result.branches.items.filter(row=>row.id!==sourceId);setRows(old=>query.after?[...old.filter(row=>result.allBranches||result.branchIds.includes(row.id)),...next.filter(row=>!old.some(item=>item.id===row.id))]:next);setMore(result.branches.nextCursor);
  }).catch(cause=>{if(active&&current===revision.current){setRows([]);setMore(null);setError(cause instanceof Error?cause.message:t('Branches could not be loaded.'));}}).finally(()=>{if(active&&current===revision.current)setLoading(false);});},query.search?250:0);
  return()=>{active=false;clearTimeout(timer);client.dispose();};
 },[context,sourceId,query,retry,t]);
 return <div className="tenant-destination"><label><span>{t('Search destination branches')}</span><input value={query.search} maxLength={200} onKeyDown={event=>{if(event.key==='Enter')event.preventDefault();}} onChange={event=>{revision.current++;onChange('');setRows([]);setQuery({search:event.target.value});}}/></label><label><span>{t('Destination branch')} *</span><Select aria-label={t('Destination branch')} disabled={loading||!!error} value={value} onChange={event=>onChange(event.target.value)}><option value="">{t('Select destination branch')}</option>{rows.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</Select></label>{loading&&<p role="status">{t('Loading…')}</p>}{error&&<div role="alert"><p>{error}</p><button type="button" onClick={()=>setRetry(value=>value+1)}>{t('Retry')}</button></div>}{!loading&&!error&&!rows.length&&!more&&<p role="status">{t('No other active assigned branch is available.')}</p>}{more&&<button type="button" disabled={loading} onClick={()=>setQuery(old=>({...old,after:more}))}>{t('Load more branches')}</button>}</div>;
}
