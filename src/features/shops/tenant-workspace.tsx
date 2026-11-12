"use client";
import { useCallback,useEffect,useRef,useState } from 'react';
import { Settings2,X } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { DataSkeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/lib/i18n/language-provider';
import { sessionBoundary } from '@/lib/api/session-boundary';
import { type ShopContext } from './shop-contract';
import { createWorkspaceClient,WorkspaceError } from './workspace-client';
import { type WorkspaceBootstrap,type WorkspaceBranch,validWorkspaceBootstrap,validWorkspaceBranch,workspaceBranchKey } from './workspace-contract';
import { TenantCatalog } from './tenant-catalog';
import {RegisterWorkspace} from './register-workspace';
import {TenantPos} from './tenant-pos';
import {CustomerWorkspace} from './customer-workspace';
import {SalesWorkspace} from './sales-workspace';
import {TenantReports} from './tenant-reports';

const accessLabels=[['medicine:read','Medicine catalog'],['stock:read','Inventory'],['sale:read','Sales history'],['report:read','Reports'],['account:read','Finance']] as const;
type Client=ReturnType<typeof createWorkspaceClient>;
export function TenantWorkspace({selected,writesEnabled=false}:{selected:ShopContext;writesEnabled?:boolean}){
 const {t}=useLanguage();
 const [context,setContext]=useState<WorkspaceBootstrap|null>(null),[branches,setBranches]=useState<WorkspaceBranch[]>([]),[cursor,setCursor]=useState<string|null>(null);
 const [branch,setBranch]=useState<WorkspaceBranch|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[settings,setSettings]=useState(false);
 const client=useRef<Client|null>(null),revision=useRef(0),posOpen=useRef(false);
 const invalidate=useCallback(()=>{revision.current++;},[]);
 const forget=useCallback(()=>{try{sessionStorage.removeItem(workspaceBranchKey(selected));}catch{}},[selected]);
 const load=useCallback(async(transport:Client,after?:string)=>{
  const current=++revision.current;setBusy(true);setError('');setBranch(null);setContext(null);
  try{
   const fresh=await transport.bootstrap(after);
   if(current!==revision.current)return;
   if(!validWorkspaceBootstrap(fresh,selected))throw new WorkspaceError(t('Shop access could not be verified. Please try again.'),502);
   setContext(fresh);setCursor(fresh.branches.nextCursor);
   setBranches(old=>after?[...old.filter(row=>validWorkspaceBranch(row,fresh)),...fresh.branches.items.filter(row=>!old.some(item=>item.id===row.id))]:fresh.branches.items);
   let saved='';try{saved=sessionStorage.getItem(workspaceBranchKey(fresh))??'';}catch{}
   const candidate=saved||fresh.homeBranchId;
   if(candidate){
    const checked=await transport.branch(candidate);
    if(current!==revision.current)return;
    if(!validWorkspaceBranch(checked,fresh)||checked.id!==candidate)throw new WorkspaceError(t('Branch is no longer available. Choose another branch in settings.'),404);
    setBranch(checked);
    setBranches(rows=>rows.some(row=>row.id===checked.id)?rows:[checked,...rows]);
    try{sessionStorage.setItem(workspaceBranchKey(fresh),checked.id);}catch{}
   }
  }catch(cause){
   if(current!==revision.current)return;
   forget();setBranch(null);setError(cause instanceof WorkspaceError?cause.message:t('Workspace could not be loaded. Please try again.'));
   if(cause instanceof WorkspaceError&&(cause.status===401||cause.status===403)){setContext(null);setBranches([]);setCursor(null);}
  }finally{if(current===revision.current)setBusy(false);}
 },[selected,t,forget]);
 useEffect(()=>{
  const transport=createWorkspaceClient(selected.tenant.id,sessionBoundary.capture().signal);client.current=transport;
  let active=true;queueMicrotask(()=>{if(active)void load(transport);});
  const refresh=()=>{if(!posOpen.current)void load(transport);};window.addEventListener('focus',refresh);
  return()=>{active=false;invalidate();transport.dispose();client.current=null;window.removeEventListener('focus',refresh);};
 },[selected,load,invalidate]);
 async function choose(id:string){
  const transport=client.current;if(!transport||!context)return;
  const current=++revision.current;setBusy(true);setBranch(null);setError('');forget();
  try{
   const checked=await transport.branch(id);
   if(current!==revision.current)return;
   if(!validWorkspaceBranch(checked,context)||checked.id!==id)throw new WorkspaceError(t('Shop access could not be verified. Please try again.'),502);
   setBranch(checked);try{sessionStorage.setItem(workspaceBranchKey(context),checked.id);}catch{}
  }catch(cause){if(current===revision.current){setError(cause instanceof WorkspaceError?cause.message:t('Branch could not be selected. Please try again.'));if(cause instanceof WorkspaceError&&(cause.status===401||cause.status===403)){setContext(null);setBranches([]);setCursor(null);}}}
  finally{if(current===revision.current)setBusy(false);}
 }
 return <section className="tenant-workspace" aria-label={t('Shop workspace')} aria-busy={busy}>
  <header><div><h2>{t('Shop workspace')}</h2><p>{context?.role.name??t('Verifying access…')}</p></div><button type="button" disabled={!context||busy} onClick={()=>setSettings(true)}><Settings2 size={16}/>{t('Workspace settings')}</button></header>
  {error&&!settings&&<div role="alert" className="shop-access-error"><p>{error}</p><button type="button" disabled={busy} onClick={()=>{if(client.current)void load(client.current);}}>{t('Retry')}</button></div>}
  {busy&&<DataSkeleton variant="form" rows={2}>{t('Loading workspace…')}</DataSkeleton>}
  {!busy&&context&&<><div className="workspace-current-branch"><span>{t('Working branch')}</span><strong>{branch?.name??t('Choose a branch in workspace settings')}</strong></div><div className="workspace-access"><h3>{t('Available access')}</h3><ul>{accessLabels.filter(([key])=>context.permissions.includes(key)).map(([key,label])=><li key={key}>{t(label)}</li>)}</ul>{!accessLabels.some(([key])=>context.permissions.includes(key))&&<p>{t('No operation permissions assigned.')}</p>}</div></>}
  {!busy&&context&&branch&&(context.permissions.includes('medicine:read')||context.permissions.includes('stock:read'))&&<TenantCatalog key={`${branch.id}:${context.permissions.join(',')}`} context={context} branch={branch} writesEnabled={writesEnabled}/>}
  {!busy&&context&&branch&&<TenantPos key={`pos:${branch.id}:${context.permissions.join(',')}`} context={context} branch={branch} writesEnabled={writesEnabled} onOpenChange={open=>{posOpen.current=open;}}/>}
  {!busy&&context&&branch&&context.permissions.includes('customer:read')&&<CustomerWorkspace key={`customers:${branch.id}:${context.permissions.join(',')}`} context={context} branch={branch} writesEnabled={writesEnabled} onOpenChange={open=>{posOpen.current=open;}}/>}
  {!busy&&context&&branch&&context.permissions.includes('sale:read')&&<SalesWorkspace key={`sales:${branch.id}:${context.permissions.join(',')}`} context={context} branch={branch} writesEnabled={writesEnabled} onOpenChange={open=>{posOpen.current=open;}}/>}
  {!busy&&context&&branch&&context.permissions.includes('cash-register:read')&&<RegisterWorkspace key={`register:${branch.id}:${context.permissions.join(',')}`} context={context} branch={branch} writesEnabled={writesEnabled}/>}
  {!busy&&context&&branch&&context.permissions.includes('report:read')&&<TenantReports key={`reports:${branch.id}:${context.permissions.join(',')}`} context={context} branch={branch} onOpenChange={open=>{posOpen.current=open;}}/>}
  {settings&&<BranchSettings error={error} branches={branches} branch={branch} busy={busy} hasMore={!!cursor} canChoose={!!context} onChoose={choose} onMore={()=>{if(client.current&&cursor)void load(client.current,cursor);}} onClose={()=>setSettings(false)}/>}
 </section>;
}
function BranchSettings({error,branches,branch,busy,hasMore,canChoose,onChoose,onMore,onClose}:{error:string;branches:WorkspaceBranch[];branch:WorkspaceBranch|null;busy:boolean;hasMore:boolean;canChoose:boolean;onChoose:(id:string)=>Promise<void>;onMore:()=>void;onClose:()=>void}){
 const {t}=useLanguage(),dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>node?.close();},[]);
 return <dialog ref={dialog} className="workspace-branch-dialog" aria-labelledby="workspace-branch-title" onCancel={onClose} onClose={()=>{if(!dialog.current?.open)onClose();}} onClick={event=>{if(event.target!==event.currentTarget)return;const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)onClose();}}>
  <header><h2 id="workspace-branch-title">{t('Workspace settings')}</h2><button type="button" aria-label={t('Close')} onClick={onClose}><X size={18}/></button></header>
  <label className="workspace-branch-field"><span>{t('Working branch')}</span><Select aria-label={t('Shop working branch')} value={branch?.id??''} disabled={busy||!canChoose||!branches.length} onChange={event=>{if(event.target.value)void onChoose(event.target.value);}}><option value="">{t('Select a branch')}</option>{branches.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</Select></label>
  <p>{t('Only active branches assigned to this shop are available.')}</p>
  {error&&<div className="shop-access-error" role="alert">{error}</div>}
  {!branches.length&&!busy&&<p role="status">{t('No active branches available. Contact your administrator.')}</p>}
  {busy&&<p role="status">{t('Verifying access…')}</p>}
  {hasMore&&<button type="button" disabled={busy} onClick={onMore}>{t('Load more branches')}</button>}
  <button type="button" className="workspace-branch-done" onClick={onClose}>{t('Done')}</button>
 </dialog>;
}
