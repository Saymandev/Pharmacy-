"use client";
import {useEffect,useState} from 'react';
import {sessionBoundary} from '@/lib/api/session-boundary';
export function ReceiptLogo({tenantId,saleId,onReady}:{tenantId:string;saleId:string;onReady:()=>void}){
 const [url,setUrl]=useState(''),[failed,setFailed]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{let active=true,objectUrl='';const controller=new AbortController(),session=sessionBoundary.capture().signal;
  void fetch(`/api/backend/tenant-workspace/${encodeURIComponent(tenantId)}/sales/${encodeURIComponent(saleId)}/receipt-logo`,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.any([session,controller.signal])}).then(async response=>{if(!response.ok||!['image/png','image/jpeg','image/webp','image/gif'].includes(response.headers.get('content-type')?.split(';')[0]??''))throw new Error('Logo unavailable');const blob=await response.blob();if(!active||session.aborted)return;objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}).catch(()=>{if(active&&!session.aborted)setFailed(true);});
  return()=>{active=false;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[tenantId,saleId,revision]);
 // The private, authenticated image is represented by a short-lived local Blob URL.
 // eslint-disable-next-line @next/next/no-img-element
 return failed?<button type="button" onClick={()=>{setFailed(false);setUrl('');setRevision(n=>n+1);}}>Retry receipt logo</button>:url?<img src={url} alt="" width={72} height={72} onLoad={onReady} onError={()=>setFailed(true)} style={{objectFit:'contain'}}/>:null;
}
