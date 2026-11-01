"use client";
import {useEffect,useRef,useState} from 'react';
import {Barcode,X} from 'lucide-react';
import {api} from '@/lib/api/client';
import {useLanguage} from '@/lib/i18n/language-provider';
import {barcodeError,barcodeValue,exactBarcodeMatch} from './barcode-policy';
import type {Medicine} from './pos-types';
function medicines(value:unknown):Medicine[]{if(Array.isArray(value))return value;if(value&&typeof value==='object'){const row=value as Record<string,unknown>;for(const key of ['data','medicines'])if(key in row)return medicines(row[key]);}return [];}
export function BarcodeScanner({branchId,onMedicine,onPendingChange,onClose}:{branchId:string;onMedicine:(medicine:Medicine)=>boolean|undefined;onPendingChange:(count:number)=>void;onClose:()=>void}){
 const {t}=useLanguage();const input=useRef<HTMLInputElement>(null),queue=useRef<string[]>([]),running=useRef(false),active=useRef(true),controller=useRef<AbortController|null>(null),add=useRef(onMedicine),pending=useRef(onPendingChange);
 const [failures,setFailures]=useState<{id:string;code:string;message:string}[]>([]);
 const [value,setValue]=useState(''),[count,setCount]=useState(0),[status,setStatus]=useState(''),[error,setError]=useState('');
 useEffect(()=>{add.current=onMedicine;pending.current=onPendingChange;},[onMedicine,onPendingChange]);
 useEffect(()=>{active.current=true;input.current?.focus();return()=>{active.current=false;queue.current=[];controller.current?.abort();pending.current(0);};},[]);
 function failed(code:string,message:string){setFailures(rows=>[...rows,{id:crypto.randomUUID(),code,message}]);setStatus('');}
 function progress(){const next=queue.current.length+(running.current?1:0);setCount(next);pending.current(next);}
 async function drain(){
  if(running.current)return;
  while(queue.current.length&&active.current){const code=queue.current.shift()!;running.current=true;progress();controller.current=new AbortController();
   try{const params=new URLSearchParams({barcode:code,branchId,isActive:'true',hasStock:'true',page:'1',limit:'10'});const result=await api.getWithMeta<unknown>(`/pharmacy/medicines?${params}`,{signal:controller.current.signal});if(!active.current)return;const match=exactBarcodeMatch(medicines(result),code);if(!match){failed(code,t('No exact in-stock barcode match'));}else if(add.current(match)){setStatus(`${t('Added from barcode')}: ${match.name} · ${code}`);setError('');}else{failed(code,t('Barcode matched, but stock could not be added. Review the cart.'));}}
   catch(cause){if(active.current){failed(code,cause instanceof Error?cause.message:t('Barcode lookup failed. Please scan again.'));}}
   finally{running.current=false;if(active.current)progress();}
  }
 }
 function enqueue(code:string){if(queue.current.length+(running.current?1:0)>=50){setError(t('Scan queue is full. Wait, then scan this item again.'));return false;}queue.current.push(code);setError('');progress();void drain();return true;}
 function submit(){const problem=barcodeError(value);if(problem){setError(t(problem));return;}if(enqueue(barcodeValue(value))){setValue('');if(input.current){input.current.value='';input.current.focus();}}}

 return <section id="pos-barcode-panel" className="pos-barcode-panel" aria-label={t('Barcode scanner')}><div className="pos-barcode-heading"><span><Barcode size={18}/><strong>{t('Barcode scanner')}</strong></span><button type="button" onClick={onClose} aria-label={t('Close barcode scanner')}><X size={17}/></button></div><p>{t('Scan with an Enter-suffix scanner, or type a barcode and press Enter. Each scan adds one unit using the earliest available batch.')}</p><div className="pos-barcode-entry"><input ref={input} className="pos-barcode-input" aria-label={t('Scan barcode')} placeholder={t('Ready to scan…')} autoComplete="off" spellCheck={false} value={value} onChange={e=>setValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.repeat&&!e.nativeEvent.isComposing){e.preventDefault();submit();}}}/><button type="button" onClick={submit} disabled={!value.trim()}>{t('Add item')}</button></div><div className="pos-barcode-feedback"><span role="status" aria-live="polite">{count?`${count} ${t('scans pending')}`:t('Ready for the next barcode')}{status&&` · ${status}`}</span>{error&&<p role="alert">{error}</p>}</div>{failures.length>0&&<div className="pos-scan-failures"><strong>{t('Scans needing attention')} · {failures.length}</strong>{failures.map(item=><div key={item.id}><span><code>{item.code}</code><small>{item.message}</small></span><button type="button" onClick={()=>{if(enqueue(item.code))setFailures(rows=>rows.filter(row=>row.id!==item.id));}}>{t('Retry scan')}</button><button type="button" aria-label={`${t('Dismiss failed scan')} ${item.code}`} onClick={()=>setFailures(rows=>rows.filter(row=>row.id!==item.id))}><X size={14}/></button></div>)}</div>}<small>{t('Stopping the scanner cancels pending lookups. Added items stay in the cart.')}</small></section>;
}
