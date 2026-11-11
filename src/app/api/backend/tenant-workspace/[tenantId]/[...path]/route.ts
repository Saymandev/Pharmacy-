import { cookies } from 'next/headers';
import { tenantWorkspaceTarget,validMedicineProxyBody,validStockProxyBody,validBulkProxyBody } from '@/lib/server/tenant-workspace-policy';
import { isSameOriginRequest } from '@/lib/server/request-security';

type Context={params:Promise<{tenantId:string;path:string[]}>};
const noStore={'Cache-Control':'no-store'};
async function proxy(request:Request,context:Context){
  const mutating=request.method==='POST'||request.method==='PATCH';
  if(mutating&&!isSameOriginRequest(request))return Response.json({success:false,message:'Request origin could not be verified.'},{status:403,headers:noStore});
  const {tenantId,path}=await context.params,target=tenantWorkspaceTarget(tenantId,path,request.method);
  if(!target)return Response.json({success:false,message:'Shop workspace is not available.'},{status:404,headers:noStore});
  const token=(await cookies()).get('pharmacy_access')?.value;
  if(!token)return Response.json({success:false,message:'Sign in to open your shop.'},{status:401,headers:noStore});
  let body:string|undefined;
  const headers:Record<string,string>={Authorization:`Bearer ${token}`,'X-Tenant-Id':target.tenantId,Accept:'application/json'};
  if(mutating){
    const key=request.headers.get('idempotency-key');
    if(!key||!/^[A-Za-z0-9_-]{16,128}$/.test(key)||new URL(request.url).search||request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return Response.json({success:false,message:'A JSON body and valid save key are required.'},{status:422,headers:noStore});
    const bulk=['import','bulk-price-update'].includes(path[2]),limit=bulk?262144:32768;
    if(Number(request.headers.get('content-length')??0)>limit)return Response.json({success:false,message:'Form is too large.'},{status:413,headers:noStore});
    try{body=await request.text();if(new TextEncoder().encode(body).byteLength>limit)return Response.json({success:false,message:'Form is too large.'},{status:413,headers:noStore});const value=JSON.parse(body);if(!(bulk?validBulkProxyBody(value,path[2]):path[1]==='stocks'?validStockProxyBody(value,path[2]):validMedicineProxyBody(value,request.method)))throw new Error('Invalid fields');}
    catch{return Response.json({success:false,message:'Invalid form fields.'},{status:422,headers:noStore});}
    headers['Content-Type']='application/json';headers['Idempotency-Key']=key;
  }
  try{
    const upstream=await fetch(target.url+new URL(request.url).search,{
      method:request.method,headers,body,
      cache:'no-store',redirect:'error',signal:AbortSignal.any([request.signal,AbortSignal.timeout(15000)]),
    });
    return new Response(upstream.body,{status:upstream.status,headers:{...noStore,'Content-Type':upstream.headers.get('content-type')??'application/json'}});
  }catch{return Response.json({success:false,message:'Shop workspace could not be reached.'},{status:502,headers:noStore});}
}
export const GET=proxy;
export const POST=proxy;
export const PATCH=proxy;
