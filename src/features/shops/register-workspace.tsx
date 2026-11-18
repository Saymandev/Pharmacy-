"use client";
import {useEffect,useRef,useState,useId} from 'react';
import {Select} from '@/components/ui/select';
import {DataSkeleton} from '@/components/ui/skeleton';
import {useLanguage} from '@/lib/i18n/language-provider';
import {sessionBoundary} from '@/lib/api/session-boundary';
import {type ShopContext} from './shop-contract';
import {type WorkspaceBranch} from './workspace-contract';
import {createWorkspaceClient,WorkspaceError} from './workspace-client';
import {validCatalogPage,type CatalogMeta} from './catalog-contract';
import {validRegister,validRegisterBody,type RegisterSession} from './register-policy';
import './register-workspace.css';
type Client=ReturnType<typeof createWorkspaceClient>;
const money=(v:number|string|null)=>`BDT ${Number(v??0).toFixed(2)}`;
export function RegisterWorkspace(props:{context:ShopContext;branch:WorkspaceBranch;writesEnabled:boolean}){
 const {t}=useLanguage(),[open,setOpen]=useState(false);
 return <><button type="button" onClick={()=>setOpen(true)}>{t('My cash register')}</button>{open&&<RegisterDialog {...props} onClose={()=>setOpen(false)}/>}</>;
}
function RegisterDialog({context,branch,writesEnabled,onClose}:{context:ShopContext;branch:WorkspaceBranch;writesEnabled:boolean;onClose:()=>void}){
 const {t}=useLanguage(),dialog=useRef<HTMLDialogElement>(null),client=useRef<Client|null>(null),alive=useRef(false),guard=useRef(false),filterId=useId();
 const pending=useRef<{id:string|null;body:Record<string,unknown>;key:string}|null>(null);
 const [current,setCurrent]=useState<RegisterSession|null>(null),[rows,setRows]=useState<RegisterSession[]>([]),[meta,setMeta]=useState<CatalogMeta|null>(null),[page,setPage]=useState(1),[filters,setFilters]=useState<Record<string,string>>({}),[draft,setDraft]=useState<Record<string,string>>({}),[revision,setRevision]=useState(0),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[form,setForm]=useState<'open'|'close'|null>(null),[count,setCount]=useState(''),[note,setNote]=useState(''),[confirmed,setConfirmed]=useState(false);
 const verify=(v:unknown):v is RegisterSession=>validRegister(v,context.tenant.id,branch.id,context.userId);
 const locked=saving||uncertain;
 useEffect(()=>{const node=dialog.current;node?.showModal();const transport=createWorkspaceClient(context.tenant.id,sessionBoundary.capture().signal);client.current=transport;alive.current=true;return()=>{alive.current=false;transport.dispose();node?.close();};},[context.tenant.id]);
 useEffect(()=>{let active=true;queueMicrotask(()=>{if(!active)return;setLoading(true);setError('');setCurrent(null);setRows([]);setMeta(null);
  void Promise.all([client.current!.activeRegister(branch.id),client.current!.registerSessions(branch.id,page,filters)]).then(([value,list])=>{
   if(!active)return;const r=value as {tenantId?:string;branchId?:string;userId?:string;session?:unknown};
   if(!r||r.tenantId!==context.tenant.id||r.branchId!==branch.id||r.userId!==context.userId||r.session!==null&&!verify(r.session)||!validCatalogPage(list,page,verify))throw new Error('Register data could not be verified.');
   setCurrent(r.session as RegisterSession|null);setRows(list.data);setMeta(list.meta);
  }).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Register could not be loaded.');}).finally(()=>{if(active)setLoading(false);});});return()=>{active=false;};
 // Context is frozen for this keyed workspace instance.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[branch.id,context.tenant.id,context.userId,page,filters,revision]);
 function close(){if(!guard.current&&!locked)onClose();}
 async function save(){
  if(guard.current||!client.current)return;
  const attempt=pending.current??{id:form==='close'?current?.id??null:null,body:form==='close'?{branchId:branch.id,expectedBalance:Number(current?.closingBalance),actualBalance:Number(count),closingNote:note.trim()}:{branchId:branch.id,openingBalance:Number(count),openingNote:note.trim()},key:crypto.randomUUID()};
  if(!pending.current&&(!count.trim()||!validRegisterBody(attempt.body,form==='close')||form==='close'&&!confirmed)){setError('Check the cash count and explain any difference. Confirm before closing.');return;}
  pending.current=attempt;guard.current=true;setSaving(true);setError('');
  try{const value=await client.current.saveRegister(attempt.id,attempt.body,attempt.key);if(!alive.current)return;if(!verify(value)||value.status!==(attempt.id?'closed':'open')||attempt.id&&value.id!==attempt.id||Number(attempt.id?value.actualBalance:value.openingBalance)!==Number(attempt.id?attempt.body.actualBalance:attempt.body.openingBalance))throw new WorkspaceError('Register save response could not be verified.',502);
   pending.current=null;setUncertain(false);setForm(null);setCount('');setNote('');setConfirmed(false);setNotice(attempt.id?'Register closed.':'Register opened.');setRevision(r=>r+1);
  }catch(cause){if(!alive.current)return;const unknown=!(cause instanceof WorkspaceError)||cause.status>=500;setUncertain(unknown);if(!unknown){pending.current=null;if(cause instanceof WorkspaceError&&cause.status===409){setForm(null);setRevision(r=>r+1);}}setError(cause instanceof Error?cause.message:'Register could not be saved.');}
  finally{guard.current=false;if(alive.current)setSaving(false);}
 }
 const canOpen=writesEnabled&&context.permissions.includes('cash-register:create'),canClose=writesEnabled&&context.permissions.includes('cash-register:update');
 return <dialog ref={dialog} className="tenant-register-dialog" aria-label={t('My cash register')} onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}}}>
  <header><div><h2>{t('My cash register')}</h2><p>{branch.name} · {t('Your drawer and session history')}</p></div><button type="button" aria-label={t('Close')} disabled={locked} onClick={close}>×</button></header>
  <div className="tenant-register-body">
  {error&&<p role="alert">{t(error)}</p>}{notice&&<p role="status">{t(notice)}</p>}
  {uncertain&&<div role="alert"><p>{t('Save result is unknown. Retry the same request before continuing.')}</p><button type="button" disabled={saving} onClick={()=>void save()}>{t('Retry same request')}</button></div>}
  {loading?<DataSkeleton variant="form" rows={3}>{t('Loading…')}</DataSkeleton>:<>
   <section><h3>{t(current?'Register open':'No open register')}</h3>{current&&<dl><div><dt>{t('Opening cash')}</dt><dd>{money(current.openingBalance)}</dd></div><div><dt>{t('Expected cash')}</dt><dd>{money(current.closingBalance)}</dd></div></dl>}
    {current&&Number(current.closingBalance)<0&&<p role="status">{t('This register has an inherited book deficit. Enter the cash counted and explain the difference. Closing does not adjust account funds.')}</p>}
    <p>{t('Opening and closing count physical drawer cash. Account balances are not adjusted.')}</p>
    {!error&&!form&&<button type="button" disabled={locked||!(current?canClose:canOpen)} onClick={()=>{setForm(current?'close':'open');setCount('');setNote('');setConfirmed(false);setNotice('');}}>{t(current?'Close register':'Open register')}</button>}
   </section>
   {form&&<form onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={locked}><legend>{t(form==='close'?'Count cash and close':'Opening cash count')}</legend><label><span>{t('Counted cash')}</span><input autoFocus type="number" min="0" max="99999999.99" step="0.01" required value={count} onChange={e=>setCount(e.target.value)}/></label>
    {form==='close'&&<p>{t('Difference')}: <strong>{money(Number(count)-Number(current?.closingBalance))}</strong></p>}
    <label><span>{t(form==='close'?'Closing note':'Opening note')}</span><textarea maxLength={2000} required={form==='close'&&Number(count)!==Number(current?.closingBalance)} value={note} onChange={e=>setNote(e.target.value)}/></label>
    {form==='close'&&<label className="register-confirm"><input type="checkbox" checked={confirmed} required onChange={e=>setConfirmed(e.target.checked)}/><span>{t('I checked the cash count. Close this register session.')}</span></label>}
    <div><button type="button" onClick={()=>setForm(null)}>{t('Cancel')}</button><button type="submit">{t(form==='close'?'Confirm close register':'Confirm open register')}</button></div></fieldset></form>}
   {!form&&<><div className="register-history-heading"><h3>{t('Session history')}</h3><button type="button" disabled={locked} popoverTarget={filterId}>{t('Filters')}</button><button type="button" disabled={locked} onClick={()=>setRevision(r=>r+1)}>{t('Reload register')}</button></div>
    <div id={filterId} popover="auto" className="register-filter"><form onSubmit={e=>{e.preventDefault();setFilters({...draft});setPage(1);document.getElementById(filterId)?.hidePopover();}}><label>{t('Search notes')}<input value={draft.search??''} maxLength={200} onChange={e=>setDraft({...draft,search:e.target.value})}/></label><label>{t('Status')}<Select value={draft.status??''} onChange={e=>setDraft({...draft,status:e.target.value})}><option value="">{t('All')}</option><option value="open">{t('Open')}</option><option value="closed">{t('Closed')}</option></Select></label>{['startDate','endDate'].map((key,i)=><label key={key}>{t(i?'To date':'From date')}<input type="date" value={draft[key]??''} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>)}<button type="submit">{t('Apply filters')}</button><button type="button" onClick={()=>{setDraft({});setFilters({});setPage(1);document.getElementById(filterId)?.hidePopover();}}>{t('Clear filters')}</button></form></div>
    {!rows.length&&<p>{t('No register sessions found.')}</p>}<ul className="register-session-list">{rows.map(row=><li key={row.id}><div><strong>{t(row.status==='open'?'Open':'Closed')}</strong><time>{new Date(row.openedAt).toLocaleString()}</time></div><dl><div><dt>{t('Opening cash')}</dt><dd>{money(row.openingBalance)}</dd></div><div><dt>{t('Expected cash')}</dt><dd>{money(row.closingBalance)}</dd></div>{row.status==='closed'&&<><div><dt>{t('Counted cash')}</dt><dd>{money(row.actualBalance)}</dd></div><div><dt>{t('Difference')}</dt><dd>{money(row.difference)}</dd></div></>}</dl>{row.openingNote&&<p>{row.openingNote}</p>}{row.closingNote&&<p>{row.closingNote}</p>}</li>)}</ul><nav aria-label={t('Register pages')}><button type="button" disabled={locked||!meta?.hasPreviousPage} onClick={()=>setPage(p=>p-1)}>{t('Previous')}</button><span>{page} / {meta?.totalPages||1}</span><button type="button" disabled={locked||!meta?.hasNextPage} onClick={()=>setPage(p=>p+1)}>{t('Next')}</button></nav>
   </>}
  </>}
  {!loading&&!form&&rows.map(row=><RegisterMovements key={row.id} session={row} context={context} branch={branch}/>)}
  </div>
 </dialog>;
}
function RegisterMovements({session,context,branch}:{session:RegisterSession;context:ShopContext;branch:WorkspaceBranch}){
 const {t}=useLanguage(),[show,setShow]=useState(false),[page,setPage]=useState(1),[rows,setRows]=useState<{id:string;txnId:string;amount:string|number;flowType:string;createdAt:string}[]>([]),[meta,setMeta]=useState<CatalogMeta|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(!show)return;let active=true;const client=createWorkspaceClient(context.tenant.id,sessionBoundary.capture().signal);queueMicrotask(()=>{if(!active)return;setBusy(true);setRows([]);setError('');void client.registerMovements(session.id,branch.id,page).then(value=>{if(!active)return;if(!validCatalogPage(value,page,(r):r is typeof rows[number]=>{if(!r||typeof r!=='object')return false;const v=r as Record<string,unknown>;return typeof v.id==='string'&&v.tenantId===context.tenant.id&&v.branchId===branch.id&&v.cashRegisterSessionId===session.id&&v.paymentMethod==='cash'&&['in','out'].includes(String(v.flowType))&&typeof v.txnId==='string'&&(typeof v.amount==='string'||typeof v.amount==='number')&&Number.isFinite(Number(v.amount))&&Number(v.amount)>0&&typeof v.createdAt==='string'&&Number.isFinite(Date.parse(v.createdAt));}))throw new Error('Cash movements could not be verified.');setRows(value.data);setMeta(value.meta);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Cash movements could not be loaded.');}).finally(()=>{if(active)setBusy(false);});});return()=>{active=false;client.dispose();};
 },[show,page,session.id,context.tenant.id,branch.id]);
 return <section className="register-movements"><button type="button" aria-expanded={show} onClick={()=>setShow(v=>!v)}>{t('Cash movements')} · {new Date(session.openedAt).toLocaleString()}</button>{show&&<>{error&&<p role="alert">{t(error)}</p>}{busy?<DataSkeleton rows={2}>{t('Loading…')}</DataSkeleton>:<><ul>{rows.map(row=><li key={row.id}><strong>{t(row.flowType==='in'?'IN':'OUT')} · {money(row.amount)}</strong> · {row.txnId}<time>{new Date(row.createdAt).toLocaleString()}</time></li>)}</ul>{!rows.length&&!error&&<p>{t('No cash movements found.')}</p>}<nav><button disabled={!meta?.hasPreviousPage} onClick={()=>setPage(p=>p-1)}>{t('Previous')}</button><span>{page}</span><button disabled={!meta?.hasNextPage} onClick={()=>setPage(p=>p+1)}>{t('Next')}</button></nav></>}</>}</section>;
}
