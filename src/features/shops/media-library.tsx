"use client";
import {useEffect,useId,useRef,useState,type FormEvent} from 'react';
import {FileImage,FileText,Upload,Search,Filter,X,Download,Trash2,RotateCcw,Pencil} from 'lucide-react';
import {Select} from '@/components/ui/select';
import {DataSkeleton} from '@/components/ui/skeleton';
import {useLanguage} from '@/lib/i18n/language-provider';
import {sessionBoundary} from '@/lib/api/session-boundary';
import {createWorkspaceClient,WorkspaceError} from './workspace-client';
import {mediaDownloadName,validMedia,validMediaPage,validMediaFiles,validMediaMutation,validUploadResult,validUploadReservations,type MediaRow,type MediaPage,type UploadReservation} from './media-policy';
import type {WorkspaceBootstrap,WorkspaceBranch} from './workspace-contract';
import './media-library.css';
type Attempt={kind:'upload';key:string;files:File[]}|{kind:'rename'|'trash'|'restore';key:string;row:MediaRow;body:object}|{kind:'reconcile';key:string;id:string};
const size=(n:number)=>n>=1048576?`${(n/1048576).toFixed(1)} MB`:`${Math.max(1,Math.ceil(n/1024))} KB`;
export function MediaLibrary({context,branch,writesEnabled,recoveryEnabled,onClose}:{context:WorkspaceBootstrap;branch:WorkspaceBranch;writesEnabled:boolean;recoveryEnabled:boolean;onClose:()=>void}){
 const {t}=useLanguage(),filterId=useId(),title=useId(),dialog=useRef<HTMLDialogElement>(null),client=useRef<ReturnType<typeof createWorkspaceClient>|null>(null),alive=useRef(false),urls=useRef(new Set<string>());
 const [query,setQuery]=useState({page:1,search:'',type:'',state:'READY'}),[search,setSearch]=useState(''),[filterType,setFilterType]=useState(''),[filterState,setFilterState]=useState('READY'),[data,setData]=useState<MediaPage|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[loadVersion,setLoadVersion]=useState(0);
 const [files,setFiles]=useState<File[]>([]),[fileInputVersion,setFileInputVersion]=useState(0),[busy,setBusy]=useState(false),[pending,setPending]=useState<Attempt|null>(null),[reservations,setReservations]=useState<UploadReservation[]>([]),[reservationError,setReservationError]=useState('');
 const [edit,setEdit]=useState<MediaRow|null>(null),[name,setName]=useState(''),[alt,setAlt]=useState(''),[caption,setCaption]=useState(''),[tags,setTags]=useState(''),[confirm,setConfirm]=useState<{kind:'trash'|'restore';row:MediaRow}|null>(null),[preview,setPreview]=useState<{row:MediaRow;url:string}|null>(null);
 const editorRef=useRef<HTMLFormElement>(null),previewRef=useRef<HTMLElement>(null),confirmRef=useRef<HTMLElement>(null);
 const can=(permission:string)=>writesEnabled&&context.permissions.includes(permission),canUpload=can('media:create'),canEdit=can('media:update'),canDelete=can('media:delete'),canReconcile=recoveryEnabled&&context.permissions.includes('media:create'),locked=busy||!!pending;
 useEffect(()=>{
  alive.current=true;const c=createWorkspaceClient(context.tenant.id,sessionBoundary.capture().signal);client.current=c;const node=dialog.current;node?.showModal();const allocated=urls.current;
  return()=>{alive.current=false;c.dispose();node?.close();for(const url of allocated)URL.revokeObjectURL(url);allocated.clear();};
 },[context.tenant.id,branch.id]);
 useEffect(()=>{const node=edit?editorRef.current:preview?previewRef.current:confirm?confirmRef.current:null;node?.scrollIntoView({block:'nearest'});if(edit)editorRef.current?.querySelector('input')?.focus();},[edit,preview,confirm]);
 useEffect(()=>{
  let current=true;
  client.current?.mediaList(branch.id,query.page,{search:query.search,type:query.type,state:query.state,purpose:'library'}).then(value=>{
   if(!current)return;if(!validMediaPage(value,context.tenant.id,branch.id,query.page)||value.data.some(row=>row.state!==query.state||query.type&&row.type!==query.type))throw new WorkspaceError('Media list could not be verified.',502);setData(value);
  }).catch(cause=>{if(current)setError(cause instanceof Error?cause.message:'Media could not be loaded.');});
  if(context.permissions.includes('media:create'))client.current?.mediaReservations().then(value=>{if(!current)return;if(!validUploadReservations(value))throw new WorkspaceError('Upload reservations could not be verified.',502);setReservations(value);}).catch(cause=>{if(current)setReservationError(cause instanceof Error?cause.message:'Upload recovery is unavailable.');});
  return()=>{current=false;};
 },[context.tenant.id,context.permissions,branch.id,query,loadVersion]);
 function reload(){setData(null);setError('');setReservationError('');setReservations([]);setLoadVersion(v=>v+1);}
 function closePreview(){if(preview){URL.revokeObjectURL(preview.url);urls.current.delete(preview.url);}setPreview(null);}
 function apply(e:FormEvent){e.preventDefault();closePreview();setData(null);setError('');setQuery({page:1,search:search.trim(),type:filterType,state:filterState});document.getElementById(filterId)?.hidePopover();}
 function complete(message:string){setPending(null);setBusy(false);setEdit(null);setConfirm(null);setFiles([]);setFileInputVersion(v=>v+1);setNotice(message);reload();}
 async function send(attempt:Attempt){
  setBusy(true);setPending(attempt);setError('');setNotice('');
  try{
   let value:unknown;
   if(attempt.kind==='upload'){
    value=await client.current!.mediaUpload(branch.id,attempt.files,attempt.key);if(!alive.current)return;
    if(!validUploadResult(value,context.tenant.id,branch.id)||value.length!==attempt.files.length||value.some(row=>row.state!=='READY'))throw new WorkspaceError('Upload result could not be verified.',502);
   }else if(attempt.kind==='reconcile'){
    value=await client.current!.reconcileMedia(attempt.id,attempt.key);if(!alive.current)return;
    if(!value||typeof value!=='object'||!('id'in value)||value.id!==attempt.id||!('released'in value)||value.released!==true)throw new WorkspaceError('Upload recovery result could not be verified.',502);
   }else{
    value=await client.current!.mediaSave(attempt.row.id,attempt.kind,attempt.body,attempt.key);if(!alive.current)return;
    if(!validMedia(value,context.tenant.id,branch.id)||value.id!==attempt.row.id||value.state!==(attempt.kind==='trash'?'DELETED':'READY'))throw new WorkspaceError('Media save result could not be verified.',502);
   }
   if(attempt.kind==='upload'){setSearch('');setFilterType('');setFilterState('READY');setQuery({page:1,search:'',type:'',state:'READY'});}
   complete(attempt.kind==='upload'?'Upload completed.':attempt.kind==='reconcile'?'Uncommitted upload storage released.':'Media changes saved.');
  }catch(cause){
   if(!alive.current)return;setError(cause instanceof Error?cause.message:'Media result is unknown.');
   if(cause instanceof WorkspaceError&&cause.status>=400&&cause.status<500&&cause.status!==408){setPending(null);if(cause.status===409&&attempt.kind!=='upload'){setEdit(null);setConfirm(null);setData(null);setLoadVersion(v=>v+1);}}
  }finally{if(alive.current)setBusy(false);}
 }
 async function checkUpload(){
  if(pending?.kind!=='upload')return;setBusy(true);setError('');
  try{const value=await client.current!.mediaUploadStatus(pending.key);if(!alive.current)return;if(!value||typeof value!=='object'||!('status'in value)||!('files'in value))throw new WorkspaceError('Upload result could not be verified.',502);
   if(value.status==='COMMITTED'&&validUploadResult(value.files,context.tenant.id,branch.id)&&value.files.length===pending.files.length)complete('Upload completed.');
   else if(value.status==='UNCONFIRMED'&&Array.isArray(value.files)&&value.files.length===0)setError('Upload is not confirmed yet. Retry the same upload; do not select new files.');
   else throw new WorkspaceError('Upload result could not be verified.',502);
  }catch(cause){if(alive.current)setError(cause instanceof Error?cause.message:'Upload result could not be verified.');}finally{if(alive.current)setBusy(false);}
 }
 async function openFile(row:MediaRow,download=false){
  setBusy(true);setError('');try{const blob=await client.current!.mediaContent(row.id,row.mimeType,row.size);if(!alive.current)return;
   const url=URL.createObjectURL(blob);urls.current.add(url);
   if(download){const link=document.createElement('a');link.href=url;link.download=mediaDownloadName(row.fileName,row.mimeType);link.click();setTimeout(()=>{URL.revokeObjectURL(url);urls.current.delete(url);},1000);}
   else{closePreview();setPreview({row,url});}
  }catch(cause){if(alive.current)setError(cause instanceof Error?cause.message:'Private file is unavailable.');}finally{if(alive.current)setBusy(false);}
 }
 function upload(e:FormEvent){e.preventDefault();if(!validMediaFiles(files)){setError('Choose 1–5 PNG, JPEG, GIF, WebP or PDF files. Maximum 5 MB each and 10 MB total.');return;}void send({kind:'upload',files:[...files],key:crypto.randomUUID()});}
 function saveEdit(e:FormEvent){e.preventDefault();if(!edit)return;const body={expectedUpdatedAt:edit.updatedAt,fileName:name.trim(),metadata:{altText:alt.trim(),caption:caption.trim(),tags:[...new Set(tags.split(',').map(v=>v.trim()).filter(Boolean))]}};if(!validMediaMutation(body,'rename')){setError('Check the file name, caption and tags.');return;}void send({kind:'rename',row:edit,body,key:crypto.randomUUID()});}
 return <dialog ref={dialog} className="tenant-media-dialog" aria-labelledby={title} onCancel={e=>{if(locked)e.preventDefault();else onClose();}}>
  <header><div><h2 id={title}>{t('Media library')}</h2><p>{branch.name} · {t('Private branch files')}</p></div><button type="button" disabled={locked} aria-label={t('Close media library')} onClick={onClose}><X size={18}/></button></header>
  <main>{error&&<div className="tenant-media-error" role="alert">{t(error)} {!pending&&<button type="button" disabled={busy} onClick={reload}>{t('Reload media')}</button>}</div>}{notice&&<p role="status">{t(notice)}</p>}
   {pending&&<aside className="tenant-media-recovery" role="status"><p>{t('Keep this request unchanged until its result is confirmed.')}</p><button type="button" disabled={busy} onClick={()=>void send(pending)}>{t(busy?'Saving…':'Retry same request')}</button>{pending.kind==='upload'&&<button type="button" disabled={busy} onClick={()=>void checkUpload()}>{t('Check upload result')}</button>}</aside>}
   <form className="tenant-media-toolbar" onSubmit={apply}><label><span className="sr-only">{t('Search file name')}</span><Search size={17}/><input disabled={locked} type="search" placeholder={t('Search file name')} maxLength={200} value={search} onChange={e=>setSearch(e.target.value)}/></label><button disabled={locked} type="submit">{t('Search')}</button><button disabled={locked} type="button" popoverTarget={filterId}><Filter size={16}/>{t('Filters')}</button></form>
   <div id={filterId} popover="auto" className="tenant-media-filter"><h3>{t('Media filters')}</h3><label>{t('File type')}<Select disabled={locked} value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="">{t('All file types')}</option><option value="image">{t('Images')}</option><option value="document">{t('PDF documents')}</option></Select></label><label>{t('File status')}<Select disabled={locked} value={filterState} onChange={e=>setFilterState(e.target.value)}><option value="READY">{t('Available files')}</option><option value="DELETED">{t('Trash')}</option></Select></label><button type="button" disabled={locked} onClick={()=>{closePreview();setData(null);setError('');setQuery({page:1,search:search.trim(),type:filterType,state:filterState});document.getElementById(filterId)?.hidePopover();}}>{t('Apply filters')}</button></div>
   {canUpload&&<form className="tenant-media-upload" onSubmit={upload}><label><Upload size={18}/><strong>{t('Upload private files')}</strong><input key={fileInputVersion} disabled={locked} type="file" multiple accept="image/png,image/jpeg,image/gif,image/webp,application/pdf" aria-label={t('Choose private files')} onChange={e=>{const selected=Array.from(e.target.files??[]);if(selected.length&&!validMediaFiles(selected)){setFiles([]);setError('Choose 1–5 PNG, JPEG, GIF, WebP or PDF files. Maximum 5 MB each and 10 MB total.');return;}setFiles(selected);setError('');}}/><small>{t('PNG, JPEG, GIF, WebP or PDF. Maximum 5 MB each, 5 files and 10 MB total.')}</small></label><button type="submit" disabled={locked||!files.length}>{t('Upload files')}{files.length?` (${files.length})`:''}</button></form>}
   {edit&&<form ref={editorRef} className="tenant-media-editor" aria-label={t('Edit private file')} onSubmit={saveEdit}><h3>{t('Edit file details')}</h3><fieldset disabled={locked}><label>{t('File name')}<input required maxLength={150} value={name} onChange={e=>setName(e.target.value)}/></label><label>{t('Image description')}<input maxLength={300} value={alt} onChange={e=>setAlt(e.target.value)}/></label><label>{t('Caption')}<textarea maxLength={500} value={caption} onChange={e=>setCaption(e.target.value)}/></label><label>{t('Tags separated by commas')}<input value={tags} onChange={e=>setTags(e.target.value)}/><small>{t('Up to 10 tags, 32 characters each.')}</small></label><div><button type="submit">{t('Save file details')}</button><button type="button" onClick={()=>setEdit(null)}>{t('Cancel')}</button></div></fieldset></form>}
   {confirm&&<section ref={confirmRef} className="tenant-media-confirm" aria-label={t('Confirm file change')}><h3>{t(confirm.kind==='trash'?'Move file to trash?':'Restore this file?')}</h3><p>{confirm.row.fileName}</p><p>{t('Trash keeps the file recoverable and still counts toward storage usage.')}</p><button type="button" disabled={locked} onClick={()=>void send({kind:confirm.kind,row:confirm.row,body:{expectedUpdatedAt:confirm.row.updatedAt},key:crypto.randomUUID()})}>{t(confirm.kind==='trash'?'Confirm move to trash':'Confirm restore')}</button><button type="button" disabled={locked} onClick={()=>setConfirm(null)}>{t('Cancel')}</button></section>}
   {preview&&<section ref={previewRef} className="tenant-media-preview" aria-label={t('Private image preview')}><header><strong>{preview.row.fileName}</strong><button type="button" disabled={locked} onClick={closePreview}>{t('Close preview')}</button></header>{/* eslint-disable-next-line @next/next/no-img-element */}
<img src={preview.url} alt={preview.row.metadata?.altText??preview.row.fileName}/></section>}
   {!data&&!error&&<DataSkeleton variant="cards" rows={6}>{t('Loading private files…')}</DataSkeleton>}
   {data&&<><p className="tenant-media-count">{data.pagination.totalItems} {t(query.state==='DELETED'?'files in trash':'available files')}</p>{!data.data.length?<section className="tenant-media-empty" role="status"><FileImage size={36}/><h3>{t(query.search||query.type?'No files match these filters.':query.state==='DELETED'?'Trash is empty.':'Media library is empty.')}</h3><p>{t('Files stay private to this shop and their assigned branch.')}</p></section>:<div className="tenant-media-grid">{data.data.map(row=><article key={row.id}><div className="tenant-media-symbol">{row.type==='image'?<FileImage size={30}/>:<FileText size={30}/>}<span>{row.type==='image'?t('Image'):t('PDF')}</span></div><h3>{row.fileName}</h3><p>{size(row.size)} · {new Date(row.createdAt).toLocaleDateString()}</p>{row.metadata?.caption&&<p>{row.metadata.caption}</p>}<div className="tenant-media-card-actions">{row.state==='READY'?<>{row.type==='image'&&<button type="button" disabled={locked} onClick={()=>void openFile(row)}>{t('Preview')}</button>}<button type="button" disabled={locked} onClick={()=>void openFile(row,true)}><Download size={15}/>{t('Download')}</button>{canEdit&&<button type="button" disabled={locked} onClick={()=>{setEdit(row);setConfirm(null);setName(row.fileName);setAlt(row.metadata?.altText??'');setCaption(row.metadata?.caption??'');setTags(row.metadata?.tags?.join(', ')??'');}}><Pencil size={15}/>{t('Edit')}</button>}{canDelete&&<button type="button" disabled={locked} onClick={()=>{closePreview();setEdit(null);setConfirm({kind:'trash',row});}}><Trash2 size={15}/>{t('Trash')}</button>}</>:canEdit&&<button type="button" disabled={locked} onClick={()=>{setEdit(null);setConfirm({kind:'restore',row});}}><RotateCcw size={15}/>{t('Restore')}</button>}</div></article>)}</div>}<nav aria-label={t('Media pages')}><button type="button" disabled={locked||!data.pagination.hasPreviousPage} onClick={()=>{setData(null);setQuery(q=>({...q,page:q.page-1}));}}>{t('Previous')}</button><span>{data.pagination.page} / {Math.max(1,data.pagination.totalPages)}</span><button type="button" disabled={locked||!data.pagination.hasNextPage} onClick={()=>{setData(null);setQuery(q=>({...q,page:q.page+1}));}}>{t('Next')}</button></nav></>}
   {reservationError&&<p role="alert">{t(reservationError)}</p>}{reservations.length>0&&<details className="tenant-media-reservations"><summary>{t('Unfinished uploads')} ({reservations.length})</summary><p>{t('Only your uncommitted uploads can be cleaned up. Committed files are protected.')}</p>{reservations.map(row=><div key={row.id}><span>{size(row.remainingBytes)} · {t(row.expired?'Expired upload':'Pending upload')}</span><button type="button" disabled={locked||!canReconcile} onClick={()=>void send({kind:'reconcile',id:row.id,key:crypto.randomUUID()})}>{t('Release unfinished upload')}</button></div>)}</details>}
  </main>
 </dialog>;
}
