export class WorkspaceError extends Error{
  readonly status:number;
  constructor(message:string,status:number){super(message);this.name='WorkspaceError';this.status=status;}
}
/** One short-lived read-only transport per mounted shop. Never falls back to the
 * legacy API or accepts caller-provided tenant/auth headers. */
export function createWorkspaceClient(tenantId:string,sessionSignal:AbortSignal,fetcher:typeof fetch=fetch){
  if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(tenantId))throw new WorkspaceError('Invalid shop.',400);
  const controller=new AbortController();let disposed=false;
  async function get(path:string){
    if(disposed||sessionSignal.aborted)throw new WorkspaceError('Shop selection changed.',409);
    const response=await fetcher(`/api/backend/tenant-workspace/${encodeURIComponent(tenantId)}/workspace/${path}`,{
      method:'GET',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.any([controller.signal,sessionSignal]),
    });
    const payload=await response.json();
    if(disposed||sessionSignal.aborted)throw new WorkspaceError('Shop selection changed.',409);
    if(!response.ok)throw new WorkspaceError(typeof payload?.message==='string'?payload.message:'Shop access could not be verified.',response.status);
    if(payload?.success!==true||!('data' in payload))throw new WorkspaceError('Invalid shop response.',502);
    return payload.data as unknown;
  }
  return {
    bootstrap:(after?:string)=>get(`bootstrap${after?`?after=${encodeURIComponent(after)}`:''}`),
    branch:(id:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id))throw new WorkspaceError('Invalid branch.',400);return get(`branches/${encodeURIComponent(id)}`);},
    dispose(){disposed=true;controller.abort();},
  };
}
