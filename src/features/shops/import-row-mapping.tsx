"use client";
import {useState,useEffect,useRef} from 'react';
import {ReferencePicker} from './reference-picker';
import {medicineReferences} from './medicine-form-policy';
import {type ImportRow} from './bulk-policy';
import {type ShopContext} from './shop-contract';
import {useLanguage} from '@/lib/i18n/language-provider';
import {createWorkspaceClient} from './workspace-client';
import {sessionBoundary} from '@/lib/api/session-boundary';
import {matchImportName} from './import-name-match';

export function ImportRowMapping({rows,context,disabled,onChange,onBlocked}:{rows:ImportRow[];context:ShopContext;disabled:boolean;onChange:(value:Record<number,Record<string,string>>)=>void;onBlocked:(blocked:boolean)=>void}){
 const {t}=useLanguage(),problems=useRef(new Set<string>());
 const [mapping,setMapping]=useState<Record<number,Record<string,string>>>({});
 return <details className="tenant-import-details"><summary>{t('Map individual medicine rows')}</summary><p>{t('Row selections override the file and all-row defaults. Clear a selection to use the default.')}</p>
 {rows.map((row,index)=><section className="tenant-import-masters" key={index}><h3>{index+1}. {row.name}</h3>{medicineReferences.map(ref=><RowMaster key={ref.key} tenantId={context.tenant.id} kind={ref.kind} label={`${t(ref.label)} ${index+1}`} initialName={ref.key==='genericId'?String(row.genericName??''):''} value={mapping[index]?.[ref.key]??''} canRead={context.permissions.includes(ref.permission)} disabled={disabled}
 onBlocked={blocked=>{const key=`${index}:${ref.key}`;if(blocked)problems.current.add(key);else problems.current.delete(key);onBlocked(problems.current.size>0);}}
 onChange={id=>{const next={...mapping,[index]:{...mapping[index],[ref.key]:id}};setMapping(next);onChange(next);}}/>)}</section>)}</details>;
}
type Props={tenantId:string;kind:string;label:string;initialName:string;value:string;canRead:boolean;disabled:boolean;onChange:(id:string)=>void;onBlocked:(blocked:boolean)=>void};
function RowMaster({tenantId,kind,label,initialName,value,canRead,disabled,onChange,onBlocked}:Props){
 const {t}=useLanguage(),[name,setName]=useState(initialName),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[chosenName,setChosenName]=useState('');
 const transport=useRef<ReturnType<typeof createWorkspaceClient>|null>(null),revision=useRef(0),active=useRef(true);
 useEffect(()=>{const invalidate=()=>{revision.current++;};active.current=true;const client=createWorkspaceClient(tenantId,sessionBoundary.capture().signal);transport.current=client;return()=>{active.current=false;invalidate();client.dispose();};},[tenantId]);
 async function match(){
  if(disabled||!canRead||busy||!transport.current)return;
  const current=++revision.current;setBusy(true);setStatus('');onBlocked(true);
  try{
   const result=await matchImportName(tenantId,name,page=>transport.current!.references(kind,page,name.trim()));
   if(!active.current||current!==revision.current)return;
   if(result){setChosenName(result.name);setStatus('Exact match found. Review before confirming import.');onChange(result.id);onBlocked(false);}
   else setStatus('No exact match. Select an existing master.');
  }catch(error){if(active.current&&current===revision.current)setStatus(error instanceof Error?error.message:'Master search could not be verified.');}
  finally{if(active.current&&current===revision.current)setBusy(false);}
 }
 return <div className="tenant-editor-reference"><span>{label}</span>
  <input aria-label={`${label} ${t('Master name')}`} maxLength={100} value={name} disabled={disabled||busy||!canRead} onChange={event=>{revision.current++;setName(event.target.value);setStatus('');}}/>
  <button type="button" disabled={disabled||busy||!canRead||!name.trim()} onClick={()=>void match()}>{t(busy?'Matching…':'Match name')}</button>
  {status&&<p role="status">{t(status)}</p>}
  <ReferencePicker tenantId={tenantId} kind={kind} label={label} initialSearch={name} currentLabel={chosenName} value={value} canRead={canRead} disabled={disabled||busy} onChange={id=>{revision.current++;setStatus('');setChosenName('');onBlocked(false);onChange(id);}}/>
 </div>;
}
