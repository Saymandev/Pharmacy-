import {WorkspaceError} from './workspace-client.ts';
import {validRegistrationBody,type RegistrationAction} from './member-registration-policy.ts';
export function createRegistrationClient(signal:AbortSignal,fetcher:typeof fetch=fetch){const controller=new AbortController();let disposed=false;return {async request(action:RegistrationAction,body:unknown){
 if(disposed||signal.aborted)throw new WorkspaceError('Session changed.',409);if(!validRegistrationBody(body,action))throw new WorkspaceError('Check the account registration fields',422);
 const r=await fetcher(`/api/backend/member-invitations/registration/${action}`,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.any([signal,controller.signal])});
 const v=await r.json();if(disposed||signal.aborted)throw new WorkspaceError('Session changed.',409);if(!r.ok||v?.success!==true||!('data'in v))throw new WorkspaceError(typeof v?.message==='string'?v.message:'Registration response could not be verified.',r.ok?502:r.status);return v.data as unknown;
 },dispose(){disposed=true;controller.abort();}};}
