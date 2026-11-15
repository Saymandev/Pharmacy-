"use client";
import {useEffect,useState} from 'react';
import {sessionBoundary} from '@/lib/api/session-boundary';
export function ReceiptLogo({tenantId,saleId}:{tenantId:string;saleId:string}){
 const [url,setUrl]=useState('');
 useEffect(()=>{let active=true,objectUrl='';const controller=new AbortController(),session=sessionBoundary.capture().signal;
  void fetch(`/api/backend/tenant-workspace/${encodeURIComponent(tenantId)}/sales/${encodeURIComponent(saleId)}/receipt-logo`,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.any([session,controller.signal])}).then(async response=>{if(!response.ok||!['image/png','image/jpeg','image/webp','image/gif'].includes(response.headers.get('content-type')?.split(';')[0]??''))return;const blob=await response.blob();if(!active||session.aborted)return;objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}).catch(()=>{});
  return()=>{active=false;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[tenantId,saleId]);
 // The private, authenticated image is represented by a short-lived local Blob URL.
 // eslint-disable-next-line @next/next/no-img-element
 return url?<img src={url} alt="" width={72} height={72} style={{objectFit:'contain'}}/>:null;
}
