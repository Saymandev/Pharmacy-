import {cookies} from 'next/headers';
import {platformTarget} from '@/lib/server/platform-policy';
import {isSameOriginRequest} from '@/lib/server/request-security';
import {validPlatformCommand,validShopIntake} from '@/features/platform/platform-policy';
import {validIssueOwnerInvite} from '@/features/platform/owner-invitation-policy';
import {validCommercialBody} from '@/features/platform/commercial-policy';
const validProvision=(value:unknown)=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===1&&'reason'in value&&typeof value.reason==='string'&&value.reason.trim().length>=5&&value.reason.trim().length<=1000;
type Context={params:Promise<{path?:string[]}>};const noStore={'Cache-Control':'no-store'};
async function proxy(request:Request,context:Context){
 const {path=[]}=await context.params,target=platformTarget(path,request.method),mutating=request.method!=='GET';
 if(!target)return Response.json({success:false,message:'Platform preview unavailable'},{status:404,headers:noStore});
 if(mutating&&!isSameOriginRequest(request))return Response.json({success:false,message:'Request origin could not be verified.'},{status:403,headers:noStore});
 const token=(await cookies()).get('pharmacy_access')?.value;if(!token)return Response.json({success:false,message:'Sign in to continue.'},{status:401,headers:noStore});
 const headers:Record<string,string>={Authorization:`Bearer ${token}`,Accept:'application/json'};let body:string|undefined;
 if(mutating){const key=request.headers.get('idempotency-key');if(!key||!/^[A-Za-z0-9_-]{16,128}$/.test(key)||new URL(request.url).search||request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return Response.json({success:false,message:'A JSON body and valid save key are required.'},{status:422,headers:noStore});try{body=await request.text();const value=JSON.parse(body);if(new TextEncoder().encode(body).byteLength>8192||!(path[0]==='plans'||path[2]==='subscription'?validCommercialBody(path,value):path[2]==='provision'?validProvision(value):path[2]==='owner-invitations'?validIssueOwnerInvite(value):request.method==='POST'?validShopIntake(value):validPlatformCommand(value)))throw new Error('Invalid command');}catch{return Response.json({success:false,message:'Check the shop details and reason.'},{status:422,headers:noStore});}headers['Content-Type']='application/json';headers['Idempotency-Key']=key;}
 try{const upstream=await fetch(target+new URL(request.url).search,{method:request.method,headers,body,cache:'no-store',redirect:'error',signal:AbortSignal.any([request.signal,AbortSignal.timeout(15000)])});return new Response(upstream.body,{status:upstream.status,headers:{...noStore,'Content-Type':upstream.headers.get('content-type')??'application/json'}});}catch{return Response.json({success:false,message:'Platform server is unavailable.'},{status:502,headers:noStore});}
}
export const GET=proxy;export const PATCH=proxy;export const POST=proxy;export const DELETE=proxy;
