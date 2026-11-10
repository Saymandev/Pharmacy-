export class WorkspaceError extends Error{
  readonly status:number;
  constructor(message:string,status:number){super(message);this.name='WorkspaceError';this.status=status;}
}
/** One short-lived read-only transport per mounted shop. Never falls back to the
 * legacy API or accepts caller-provided tenant/auth headers. */
export function createWorkspaceClient(tenantId:string,sessionSignal:AbortSignal,fetcher:typeof fetch=fetch){
  if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(tenantId))throw new WorkspaceError('Invalid shop.',400);
  const controller=new AbortController();let disposed=false;
  async function get(path:string,withMeta=false){
    if(disposed||sessionSignal.aborted)throw new WorkspaceError('Shop selection changed.',409);
    const response=await fetcher(`/api/backend/tenant-workspace/${encodeURIComponent(tenantId)}/${path}`,{
      method:'GET',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.any([controller.signal,sessionSignal]),
    });
    const payload=await response.json();
    if(disposed||sessionSignal.aborted)throw new WorkspaceError('Shop selection changed.',409);
    if(!response.ok)throw new WorkspaceError(typeof payload?.message==='string'?payload.message:'Shop access could not be verified.',response.status);
    if(payload?.success!==true||!('data' in payload))throw new WorkspaceError('Invalid shop response.',502);
    return (withMeta?payload:payload.data) as unknown;
  }
  return {
    bootstrap:(after?:string)=>get(`workspace/bootstrap${after?`?after=${encodeURIComponent(after)}`:''}`),
    branch:(id:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id))throw new WorkspaceError('Invalid branch.',400);return get(`workspace/branches/${encodeURIComponent(id)}`);},
    medicines:(branchId:string,page:number,filters:Record<string,string>={})=>get(`pharmacy/medicines?${resourceQuery(branchId,page,filters,['search','isActive','hasStock','barcode','unit','dosageForm','strength'])}`,true),
    stocks:(branchId:string,page:number,filters:Record<string,string>={})=>get(`pharmacy/stocks?${resourceQuery(branchId,page,filters,['search','batchNumber','rackNumber','unit','expiryStartDate','expiryEndDate'])}`,true),
    medicine:(id:string,branchId:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id))throw new WorkspaceError('Invalid medicine.',400);const query=new URLSearchParams(resourceQuery(branchId,1,{},[]));query.delete('page');query.delete('limit');return get(`pharmacy/medicines/${id}?${query}`);},
    dispose(){disposed=true;controller.abort();},
  };
}
function resourceQuery(branchId:string,page:number,filters:Record<string,string>,allowed:string[]){
  if(!/^[0-9a-f-]{36}$/i.test(branchId)||!Number.isInteger(page)||page<1||page>1000000)throw new WorkspaceError('Invalid branch or page.',400);
  const query=new URLSearchParams({branchId,page:String(page),limit:'20'});
  for(const [key,value]of Object.entries(filters)){if(!allowed.includes(key))throw new WorkspaceError('Invalid filter.',400);if(value.trim())query.set(key,value.trim());}
  return query.toString();
}
