"use client";
import { useEffect,useId,useRef,useState } from 'react';
import { ChevronDown,Check,Search } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/language-provider';
import { sessionBoundary } from '@/lib/api/session-boundary';
import { createWorkspaceClient,WorkspaceError } from './workspace-client';
import { validCatalogPage,validCatalogMedicine } from './catalog-contract';
import { type ReferenceOption,validReference } from './medicine-form-policy';

export function ReferencePicker({tenantId,kind,label,value,onChange,currentLabel,canRead,disabled=false,branchId,initialSearch=''}:{tenantId:string;kind:string;label:string;value:string;onChange:(id:string)=>void;currentLabel?:string;canRead:boolean;disabled?:boolean;branchId?:string;initialSearch?:string}){
 const {t}=useLanguage(),id=useId(),popup=useRef<HTMLDivElement>(null),search=useRef<HTMLInputElement>(null),revision=useRef(0);
 const [open,setOpen]=useState(false),[query,setQuery]=useState({search:'',page:1}),[rows,setRows]=useState<ReferenceOption[]>([]),[more,setMore]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[chosen,setChosen]=useState<ReferenceOption|null>(null),[retry,setRetry]=useState(0);
 const shown=value?(rows.find(row=>row.id===value)?.name??(chosen?.id===value?chosen.name:currentLabel??t('Assigned reference'))):t('None');
 useEffect(()=>{
  if(!open||!canRead)return;const client=createWorkspaceClient(tenantId,sessionBoundary.capture().signal),current=++revision.current;let active=true;
  const timer=setTimeout(()=>{setLoading(true);setError('');if(query.page===1)setRows([]);
   void (kind==='suppliers'?client.suppliers(query.page,query.search):kind==='stock-medicines'?client.stockMedicines(branchId??'',query.page,query.search):kind==='history-medicines'?client.historyMedicines(branchId??'',query.page,query.search):client.references(kind,query.page,query.search)).then(result=>{
    if(!active||current!==revision.current)return;
    if(!validCatalogPage(result,query.page,(row):row is ReferenceOption=>validReference(row,tenantId)&&(!['stock-medicines','history-medicines'].includes(kind)||validCatalogMedicine(row,tenantId,branchId??''))))throw new Error('Invalid reference response');
    setRows(old=>query.page===1?result.data:[...old,...result.data.filter(row=>!old.some(item=>item.id===row.id))]);setMore(result.meta.hasNextPage);
   }).catch(cause=>{if(active&&current===revision.current){setRows([]);setMore(false);setError(cause instanceof WorkspaceError?cause.message:t('References could not be loaded. Please try again.'));}}).finally(()=>{if(active&&current===revision.current)setLoading(false);});
  },query.search?250:0);
  return()=>{active=false;clearTimeout(timer);client.dispose();};
 },[open,canRead,tenantId,kind,query,retry,t,branchId]);
 return <div className="tenant-reference-picker"><button type="button" className="tenant-reference-trigger" popoverTarget={id} aria-label={t(label)} aria-haspopup="listbox" aria-expanded={open} disabled={disabled||!canRead} onClick={()=>setQuery({search:initialSearch.slice(0,200),page:1})}><span>{shown}</span><ChevronDown size={16}/></button>
  {!canRead&&<small>{t('Reference list permission is not assigned.')}</small>}
  <div id={id} ref={popup} popover="auto" className="tenant-reference-popup" onToggle={event=>{setOpen(event.newState==='open');if(event.newState==='open')queueMicrotask(()=>search.current?.focus());}} onKeyDown={event=>{if(event.key==='Enter'&&event.target===search.current){event.preventDefault();event.stopPropagation();}if(event.key==='Escape'){event.preventDefault();event.stopPropagation();popup.current?.hidePopover();}if(event.key==='ArrowDown'||event.key==='ArrowUp'){const options=Array.from(popup.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')??[]);if(!options.length)return;event.preventDefault();const index=options.indexOf(document.activeElement as HTMLButtonElement);options[(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length]?.focus();}}}>
   {open&&<><label className="tenant-reference-search"><Search size={15}/><input ref={search} role="combobox" aria-label={`${t('Search')} ${t(label)}`} aria-expanded="true" aria-controls={`${id}-options`} value={query.search} maxLength={200} placeholder={t('Search all references…')} onChange={event=>{revision.current++;setRows([]);setQuery({search:event.target.value,page:1});}}/></label>
    <div role="listbox" id={`${id}-options`} aria-label={t(label)}><button role="option" aria-selected={!value} type="button" onClick={()=>{onChange('');popup.current?.hidePopover();}}>{t('None')}</button>{rows.map(row=><button type="button" role="option" aria-selected={row.id===value} key={row.id} onClick={()=>{setChosen(row);onChange(row.id);popup.current?.hidePopover();}}>{row.name}{row.id===value&&<Check size={15}/>}</button>)}</div>
    {loading&&<p role="status">{t('Loading…')}</p>}{error&&<div role="alert"><p>{error}</p><button type="button" onClick={()=>setRetry(value=>value+1)}>{t('Retry')}</button></div>}{!loading&&!error&&!rows.length&&<p role="status">{t('No matching options')}</p>}
    {more&&!error&&<button type="button" disabled={loading} onClick={()=>setQuery(value=>({...value,page:value.page+1}))}>{t('Load more')}</button>}
   </>}
  </div>
 </div>;
}
