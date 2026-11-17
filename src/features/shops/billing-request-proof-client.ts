import {proofId,validProofFile,type RequestProof} from './billing-request-proof-policy.ts';
import {WorkspaceError} from './workspace-client.ts';
export function createRequestProofClient(target:string,requestId:string,platform:boolean,signal:AbortSignal,fetcher:typeof fetch=fetch){
 if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(target)||!proofId(requestId))throw new WorkspaceError('Invalid proof request.',422);
 const base=platform?`/api/backend/platform/shops/${encodeURIComponent(target)}`:`/api/backend/tenant-workspace/${encodeURIComponent(target)}/billing`,listPath=`${base}/${platform?'billing-requests':'requests'}/${requestId}/proofs`,controller=new AbortController();let disposed=false;
 const check=()=>{if(disposed||signal.aborted)throw new WorkspaceError('Shop selection changed.',409);};
 async function request(url:string,options:RequestInit={}){check();const r=await fetcher(url,{...options,credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.any([signal,controller.signal])});check();return r;}
 async function json(r:Response){const value=await r.json();check();if(!r.ok||value?.success!==true||!('data'in value))throw new WorkspaceError(typeof value?.message==='string'?value.message:'Proof result could not be verified.',r.ok?502:r.status);return value.data as unknown;}
 return {
  list:async()=>json(await request(listPath,{headers:{Accept:'application/json'}})),
  upload:async(file:File,key:string)=>{check();if(platform||!validProofFile(file)||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new WorkspaceError('Attach a PDF, PNG or JPEG of at most 1 MB',422);return json(await request(listPath,{method:'POST',body:file,headers:{Accept:'application/json','Content-Type':file.type,'X-Proof-Name':encodeURIComponent(file.name),'Idempotency-Key':key}}));},
  download:async(proof:RequestProof)=>{check();if(proof.requestId!==requestId||!proofId(proof.id))throw new WorkspaceError('Invalid proof request.',422);const r=await request(`${base}/${platform?'billing-request-proofs':'request-proofs'}/${proof.id}`);if(!r.ok)throw new WorkspaceError('Private proof is unavailable.',r.status);if(r.headers.get('content-type')?.split(';')[0]!==proof.mime||r.headers.has('content-length')&&Number(r.headers.get('content-length'))!==proof.size)throw new WorkspaceError('Private proof could not be verified.',502);const blob=await r.blob();check();if(blob.size!==proof.size)throw new WorkspaceError('Private proof could not be verified.',502);return blob;},
  dispose:()=>{disposed=true;controller.abort();},
 };
}
