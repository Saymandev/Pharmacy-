import { cookies } from 'next/headers';
import { tenantWorkspaceTarget } from '@/lib/server/tenant-workspace-policy';

type Context={params:Promise<{tenantId:string;path:string[]}>};
const noStore={'Cache-Control':'no-store'};
export async function GET(request:Request,context:Context){
  const {tenantId,path}=await context.params,target=tenantWorkspaceTarget(tenantId,path,request.method);
  if(!target)return Response.json({success:false,message:'Shop workspace is not available.'},{status:404,headers:noStore});
  const token=(await cookies()).get('pharmacy_access')?.value;
  if(!token)return Response.json({success:false,message:'Sign in to open your shop.'},{status:401,headers:noStore});
  try{
    const upstream=await fetch(target.url+new URL(request.url).search,{
      headers:{Authorization:`Bearer ${token}`,'X-Tenant-Id':target.tenantId,Accept:'application/json'},
      cache:'no-store',redirect:'error',signal:AbortSignal.any([request.signal,AbortSignal.timeout(15000)]),
    });
    return new Response(upstream.body,{status:upstream.status,headers:{...noStore,'Content-Type':upstream.headers.get('content-type')??'application/json'}});
  }catch{return Response.json({success:false,message:'Shop workspace could not be reached.'},{status:502,headers:noStore});}
}
