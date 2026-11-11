"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {X} from 'lucide-react';
import {type ShopContext} from './shop-contract';
import {createWorkspaceClient,WorkspaceError} from './workspace-client';
import {validCatalogPage,type CatalogMeta} from './catalog-contract';
import {sessionBoundary} from '@/lib/api/session-boundary';
import {useLanguage} from '@/lib/i18n/language-provider';
import {DataSkeleton} from '@/components/ui/skeleton';
type Supplier={id:string;tenantId:string;name:string;nameBangla?:string|null;address:string;phone:string;email?:string|null};
type Draft={id:string|null;remove:boolean;name:string;nameBangla:string;address:string;phone:string;email:string};
const empty:Draft={id:null,remove:false,name:'',nameBangla:'',address:'',phone:'',email:''};
export function validSupplier(value:unknown,tenantId:string):value is Supplier{
 if(!value||typeof value!=='object')return false;const row=value as Record<string,unknown>;
 return row.tenantId===tenantId&&typeof row.id==='string'&&/^[0-9a-f-]{36}$/i.test(row.id)&&['name','address','phone'].every(key=>typeof row[key]==='string')&&(row.nameBangla==null||typeof row.nameBangla==='string')&&(row.email==null||typeof row.email==='string');
}
export function SupplierManager({context,writesEnabled,onClose}:{context:ShopContext;writesEnabled:boolean;onClose:()=>void}){
 const {t}=useLanguage(),dialog=useRef<HTMLDialogElement>(null),client=useRef<ReturnType<typeof createWorkspaceClient>|null>(null),active=useRef(false),submitting=useRef(false),attempt=useRef<{body:unknown;key:string}|null>(null);
 const [rows,setRows]=useState<Supplier[]>([]),[meta,setMeta]=useState<CatalogMeta|null>(null),[search,setSearch]=useState(''),[query,setQuery]=useState({page:1,search:''}),[reload,setReload]=useState(0),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[edit,setEdit]=useState<Draft|null>(null);
 const can=(action:string)=>writesEnabled&&context.permissions.includes(`supplier:${action}`);
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>node?.close();},[]);
 useEffect(()=>{const transport=createWorkspaceClient(context.tenant.id,sessionBoundary.capture().signal);client.current=transport;active.current=true;return()=>{active.current=false;transport.dispose();};},[context]);
 useEffect(()=>{let current=true;queueMicrotask(()=>{if(!current)return;setLoading(true);setRows([]);setMeta(null);setError('');void client.current?.suppliers(query.page,query.search).then(value=>{if(!current)return;if(!validCatalogPage(value,query.page,(row):row is Supplier=>validSupplier(row,context.tenant.id)))throw new Error('Supplier data could not be verified.');setRows(value.data);setMeta(value.meta);}).catch(cause=>{if(current)setError(cause instanceof Error?cause.message:'Suppliers could not be loaded.');}).finally(()=>{if(current)setLoading(false);});});return()=>{current=false;};},[context.tenant.id,query,reload]);
 function choose(value:Draft|null){attempt.current=null;setUncertain(false);setError('');setEdit(value);}
 function refresh(){choose(null);setReload(value=>value+1);}
 async function save(event:FormEvent){event.preventDefault();if(!edit||!client.current||submitting.current||!can(edit.remove?'delete':edit.id?'update':'create')||uncertain&&!!edit.id)return;
  const body=edit.remove?{}:{name:edit.name.trim(),nameBangla:edit.nameBangla.trim()||null,address:edit.address.trim(),phone:edit.phone.trim(),email:edit.email.trim()||null};
  if(!attempt.current||JSON.stringify(attempt.current.body)!==JSON.stringify(body))attempt.current={body,key:crypto.randomUUID()};
  submitting.current=true;setSaving(true);setError('');
  try{const result=await client.current.saveSupplier(edit.id,attempt.current.body,attempt.current.key,edit.remove);if(!active.current)return;if(edit.remove){if(!result||typeof result!=='object'||!('message'in result)||typeof result.message!=='string')throw new Error('Supplier delete status could not be verified.');}else if(!validSupplier(result,context.tenant.id)||edit.id&&result.id!==edit.id)throw new Error('Supplier save status could not be verified.');choose(null);setNotice(t(edit.remove?'Supplier deleted.':'Supplier saved.'));setReload(value=>value+1);}
  catch(cause){if(!active.current)return;const unknown=!(cause instanceof WorkspaceError)||cause.status>=500;setUncertain(unknown);setError(unknown?t(edit.id?'Save status is unknown. Reload the list and verify before trying again.':'Supplier create status is unknown. Retry the same details.'):cause.message);if(cause instanceof WorkspaceError&&[401,403].includes(cause.status)){setRows([]);setMeta(null);setEdit(null);}}
  finally{submitting.current=false;if(active.current)setSaving(false);}
 }
 function close(){if(!submitting.current&&!(uncertain&&edit&&!edit.id))onClose();}
 return <dialog ref={dialog} className="tenant-editor tenant-bulk-editor workspace-branch-dialog" aria-labelledby="tenant-suppliers-title" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target!==event.currentTarget)return;const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}}>
  <header><div><h2 id="tenant-suppliers-title">{t('Shop suppliers')}</h2><p>{context.tenant.name}</p></div><button type="button" aria-label={t('Close suppliers')} disabled={saving||uncertain&&!!edit&&!edit.id} onClick={close}><X size={18}/></button></header>
  {error&&<div role="alert" className="shop-access-error">{error}</div>}{notice&&<p role="status">{notice}</p>}
  <form className="tenant-bulk-toolbar" onSubmit={event=>{event.preventDefault();choose(null);setQuery({page:1,search});}}><label><span>{t('Search suppliers')}</span><input maxLength={200} disabled={saving||uncertain} value={search} onChange={event=>setSearch(event.target.value)}/></label><button type="submit" disabled={saving||uncertain}>{t('Search')}</button><button type="button" disabled={saving||uncertain&&!!edit&&!edit.id} onClick={refresh}>{t('Reload list')}</button></form>
  {can('create')&&<button type="button" disabled={saving||uncertain} onClick={()=>choose({...empty})}>{t('Add supplier')}</button>}
  {edit&&<form className="tenant-import-masters" onSubmit={save}><h3>{t(edit.remove?'Confirm deletion':edit.id?'Edit supplier':'Add supplier')}</h3>{edit.remove?<p>{edit.name} — {t('Suppliers linked to purchases cannot be deleted.')}</p>:<>{(['name','nameBangla','phone','email','address']as const).map(key=><label key={key}><span>{t({name:'Supplier name',nameBangla:'Bangla name',phone:'Phone',email:'Email',address:'Address'}[key])}{['name','phone','address'].includes(key)?' *':''}</span><input required={['name','phone','address'].includes(key)} type={key==='email'?'email':'text'} maxLength={{name:200,nameBangla:300,phone:30,email:254,address:500}[key]} value={edit[key]} disabled={saving||uncertain} onChange={event=>setEdit({...edit,[key]:event.target.value})}/></label>)}</>}
  <button type="submit" disabled={saving||uncertain&&!!edit.id}>{t(saving?'Saving…':uncertain?'Retry same save':edit.remove?'Delete supplier':'Save supplier')}</button><button type="button" disabled={saving||uncertain} onClick={()=>choose(null)}>{t('Cancel')}</button></form>}
  {loading?<DataSkeleton variant="table" rows={3}>{t('Loading…')}</DataSkeleton>:<div className="tenant-stock-table" tabIndex={0}><table><thead><tr>{['Supplier name','Phone','Address','Actions'].map(label=><th key={label}>{t(label)}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.name}<small>{row.nameBangla}</small></td><td>{row.phone}<small>{row.email}</small></td><td>{row.address}</td><td><div className="tenant-stock-actions">{can('update')&&<button type="button" disabled={saving||uncertain} onClick={()=>choose({...row,nameBangla:row.nameBangla??'',email:row.email??'',remove:false})}>{t('Edit supplier')}</button>}{can('delete')&&<button type="button" disabled={saving||uncertain} onClick={()=>choose({...row,nameBangla:row.nameBangla??'',email:row.email??'',remove:true})}>{t('Delete supplier')}</button>}</div></td></tr>)}</tbody></table>{!rows.length&&!error&&<p>{t('No matching options')}</p>}</div>}
  {meta&&<nav className="tenant-catalog-pages"><span>{t('Page')} {meta.page} / {Math.max(1,meta.totalPages)}</span><button type="button" disabled={saving||uncertain||!meta.hasPreviousPage} onClick={()=>{choose(null);setQuery(value=>({...value,page:value.page-1}));}}>{t('Previous')}</button><button type="button" disabled={saving||uncertain||!meta.hasNextPage} onClick={()=>{choose(null);setQuery(value=>({...value,page:value.page+1}));}}>{t('Next')}</button></nav>}
 </dialog>;
}
