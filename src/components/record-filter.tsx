"use client";
import { Select } from "@/components/ui/select";
import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import { readPagination } from '@/lib/api/pagination';
import { useLanguage } from '@/lib/i18n/language-provider';
type Row = Record<string, unknown> & { id: string };
function rows(value: unknown): Row[] {
  if (Array.isArray(value)) return value as Row[];
  if (value && typeof value === 'object') for (const key of ['data', 'customers', 'sessions', 'users']) if (key in value) return rows((value as Record<string, unknown>)[key]);
  return [];
}
export function RecordFilter({label,endpoint,value,onChange,searchKey='search',session=false}:{label:string;endpoint:string;value:string;onChange:(id:string)=>void;searchKey?:string;session?:boolean}) {
  const {t}=useLanguage();
  const [search,setSearch]=useState(''),[page,setPage]=useState(1),[options,setOptions]=useState<Row[]>([]),[next,setNext]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>{
      setLoading(true);setError('');
      const query=new URLSearchParams({page:String(page),limit:'25'});
      if(searchKey&&search.trim())query.set(searchKey,search.trim());
      void api.getWithMeta<unknown>(`${endpoint}${endpoint.includes('?')?'&':'?'}${query}`,{signal:controller.signal}).then(result=>{
        if(controller.signal.aborted)return;setOptions(rows(result));setNext(readPagination(result,rows(result).length,page,25).hasNextPage);
      }).catch(cause=>{if(!controller.signal.aborted){setOptions([]);setError(cause instanceof Error?cause.message:'Could not load filter options.');}}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    },180);
    return()=>{clearTimeout(timer);controller.abort();};
  },[endpoint,page,search,searchKey]);
  return <fieldset className="record-filter"><legend>{t(label)}</legend>{searchKey&&<input aria-label={`${t(label)} ${t('Search')}`} placeholder={t('Search')} value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>}<Select aria-label={t(label)} value={value} onChange={e=>onChange(e.target.value)}><option value="">{t('All')}</option>{value&&!options.some(row=>row.id===value)&&<option value={value}>{t('Selected')} · {value.slice(0,8)}</option>}{options.map(row=><option key={row.id} value={row.id}>{session?`${String(row.openedAt||row.createdAt||'').slice(0,16).replace('T',' ')} · ${String(row.status||'')} · ${row.id.slice(0,8)}`:`${String(row.name||row.fullName||row.username||row.id)}${row.phone?` · ${String(row.phone)}`:''}`}</option>)}</Select>{loading&&<small role="status">{t('Loading…')}</small>}{error&&<small role="alert">{error}</small>}<div className="record-filter-pages"><button type="button" disabled={page===1||loading} onClick={()=>setPage(p=>p-1)}>{t('Previous')}</button><span>{page}</span><button type="button" disabled={!next||loading} onClick={()=>setPage(p=>p+1)}>{t('Next')}</button></div></fieldset>;
}
