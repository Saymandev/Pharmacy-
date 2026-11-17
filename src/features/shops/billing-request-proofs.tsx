"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {sessionBoundary} from '@/lib/api/session-boundary';
import {DataSkeleton} from '@/components/ui/skeleton';
import {useLanguage} from '@/lib/i18n/language-provider';
import {createRequestProofClient} from './billing-request-proof-client';
import {validProofFile,validRequestProof,validRequestProofList,type RequestProof} from './billing-request-proof-policy';
import {WorkspaceError} from './workspace-client';
import './billing-request-proofs.css';
export function BillingRequestProofs({target,requestId,platform=false,canUpload=false,blocked,onLock}:{target:string;requestId:string;platform?:boolean;canUpload?:boolean;blocked:boolean;onLock:(value:boolean)=>void}){
 const {t}=useLanguage(),[open,setOpen]=useState(false),[rows,setRows]=useState<RequestProof[]|null>(null),[revision,setRevision]=useState(0),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[pending,setPending]=useState<{file:File;key:string}|null>(null);
 const client=useRef<ReturnType<typeof createRequestProofClient>|null>(null),live=useRef(false),guard=useRef(false),fileInput=useRef<HTMLInputElement>(null),container=useRef<HTMLDivElement>(null);
 useEffect(()=>{live.current=true;const c=createRequestProofClient(target,requestId,platform,sessionBoundary.capture().signal);client.current=c;return()=>{live.current=false;c.dispose();};},[target,requestId,platform]);
 useEffect(()=>{if(!open)return;let active=true;client.current!.list().then(v=>{if(!active)return;if(!validRequestProofList(v,target,requestId))throw new WorkspaceError('Proof list could not be verified.',502);setRows(v.items);}).catch(e=>{if(active){setRows(null);setError(e instanceof Error?e.message:'Proof list could not be loaded.');}});return()=>{active=false;};},[open,revision,target,requestId]);
 async function upload(attempt:{file:File;key:string}){
  if(guard.current||blocked)return;guard.current=true;setBusy(true);setPending(attempt);onLock(true);setError('');setNotice('');
  try{const value=await client.current!.upload(attempt.file,attempt.key);if(!live.current)return;if(!validRequestProof(value,requestId))throw new WorkspaceError('Proof result could not be verified.',502);setPending(null);setFile(null);if(fileInput.current)fileInput.current.value='';setRows(null);setRevision(v=>v+1);setNotice('Proof attached. Payment verification is still required.');onLock(false);}
  catch(e){if(!live.current)return;setError(e instanceof Error?e.message:'Upload result is unknown.');if(e instanceof WorkspaceError&&e.status>=400&&e.status<500&&e.status!==408){setPending(null);onLock(false);}}
  finally{guard.current=false;if(live.current)setBusy(false);}
 }
 function submit(e:FormEvent){e.preventDefault();if(!canUpload||busy||pending||blocked)return;if(!file||!validProofFile(file)){setError('Attach a PDF, PNG or JPEG of at most 1 MB');return;}void upload({file,key:crypto.randomUUID()});}
 async function download(proof:RequestProof){if(guard.current||blocked)return;guard.current=true;setBusy(true);setError('');try{const blob=await client.current!.download(proof);if(!live.current)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='billing-proof.'+(proof.mime==='application/pdf'?'pdf':proof.mime==='image/png'?'png':'jpg');container.current?.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){if(live.current)setError(e instanceof Error?e.message:'Private proof is unavailable.');}finally{guard.current=false;if(live.current)setBusy(false);}}
 const locked=busy||!!pending;
 return <div ref={container} className="billing-request-proofs"><button type="button" disabled={blocked||locked} aria-expanded={open} onClick={()=>{setRows(null);setError('');setNotice('');setOpen(v=>!v);}}>{t('Payment proof attachments')}</button>{open&&<div className="billing-request-proof-content">
  <p>{t('Private PDF, PNG or JPEG · 1 MB per file · up to 3 files per request.')}</p>{error&&<p role="alert">{t(error)}{!pending&&<button type="button" disabled={blocked||busy} onClick={()=>{setError('');setRows(null);setRevision(v=>v+1);}}>{t('Retry')}</button>}</p>}{notice&&<p role="status">{t(notice)}</p>}
  {!rows&&!error&&<DataSkeleton variant="form" rows={1}>{t('Loading proofs…')}</DataSkeleton>}{rows?.length===0&&<p>{t('No payment proof attached.')}</p>}
  {rows?.map(proof=><div key={proof.id} className="billing-request-proof-file"><div><strong>{proof.name}</strong><small>{Math.ceil(proof.size/1024)} KB · {new Date(proof.createdAt).toLocaleString()}</small></div><button type="button" disabled={blocked||locked} onClick={()=>void download(proof)}>{t('Download proof')}</button></div>)}
  {canUpload&&rows&&rows.length<3&&<form onSubmit={submit}><label>{t('Choose payment proof')}<input ref={fileInput} type="file" accept="application/pdf,image/png,image/jpeg" disabled={blocked||locked} onChange={e=>setFile(e.target.files?.[0]??null)}/></label><button type="submit" disabled={blocked||locked||!file}>{t('Attach proof')}</button></form>}
  {pending&&<div role="status"><p>{t('Keep this file unchanged until its upload result is confirmed.')}</p><button type="button" disabled={busy||blocked} onClick={()=>void upload(pending)}>{t(busy?'Uploading…':'Retry same upload')}</button></div>}
 </div>}</div>;
}
