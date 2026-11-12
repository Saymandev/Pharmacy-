import { cookies } from 'next/headers';
import { tenantWorkspaceTarget,validMedicineProxyBody,validStockProxyBody,validBulkProxyBody,validMasterBody,validSupplierBody,validPurchaseBody,validPurchaseStatusBody,validSupplierPayment,validReturnBody } from '@/lib/server/tenant-workspace-policy';
import { isSameOriginRequest } from '@/lib/server/request-security';
import {validRegisterBody} from '@/features/shops/register-policy';
import {validPosBody} from '@/features/shops/tenant-pos-policy';
import {validPendingSaleBody} from '@/features/shops/pending-sale-policy';
import {validPosDraftBody} from '@/features/shops/pos-draft-policy';
import {validCustomerProfile,validAdvanceBody} from '@/features/shops/customer-policy';
import {validSaleReturnBody,validSaleReturnStatus} from '@/features/shops/sale-return-policy';

type Context={params:Promise<{tenantId:string;path:string[]}>};
const noStore={'Cache-Control':'no-store'};
async function proxy(request:Request,context:Context){
  const mutating=['POST','PATCH','DELETE'].includes(request.method);
  if(mutating&&!isSameOriginRequest(request))return Response.json({success:false,message:'Request origin could not be verified.'},{status:403,headers:noStore});
  const {tenantId,path}=await context.params,target=tenantWorkspaceTarget(tenantId,path,request.method);
  if(!target)return Response.json({success:false,message:'Shop workspace is not available.'},{status:404,headers:noStore});
  const token=(await cookies()).get('pharmacy_access')?.value;
  if(!token)return Response.json({success:false,message:'Sign in to open your shop.'},{status:401,headers:noStore});
  const preview=path[0]==='pharmacy'&&path[1]==='medicines'&&path[2]==='import-preview';
  let body:string|FormData|undefined;
  const headers:Record<string,string>={Authorization:`Bearer ${token}`,'X-Tenant-Id':target.tenantId,Accept:'application/json'};
  if(mutating){
    if(preview){
      if(new URL(request.url).search)return Response.json({success:false,message:'Invalid preview request.'},{status:422,headers:noStore});
      try{const form=await request.formData(),entries=[...form.entries()];if(entries.length!==1||entries[0][0]!=='file'||!(entries[0][1] instanceof File)||entries[0][1].size>1024*1024||!/\.csv$|\.xlsx$/i.test(entries[0][1].name))throw new Error('Invalid file');body=form;}
      catch{return Response.json({success:false,message:'Choose one CSV or XLSX file up to 1 MB.'},{status:422,headers:noStore});}
    }else{
    const key=request.headers.get('idempotency-key');
    if(!key||!/^[A-Za-z0-9_-]{16,128}$/.test(key)||new URL(request.url).search||request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return Response.json({success:false,message:'A JSON body and valid save key are required.'},{status:422,headers:noStore});
    const bulk=['import','bulk-price-update'].includes(path[2]),limit=bulk?262144:32768;
    if(path[0]==='customers'){
      try{body=await request.text();if(new TextEncoder().encode(body).byteLength>limit||!(path.length===3?validAdvanceBody(JSON.parse(body)):validCustomerProfile(JSON.parse(body),request.method==='PATCH')))throw new Error('Invalid customer');}
      catch{return Response.json({success:false,message:'Invalid customer fields.'},{status:422,headers:noStore});}
      headers['Content-Type']='application/json';headers['Idempotency-Key']=key;
    }else if(path[0]==='sale-returns'){
      try{body=await request.text();const value=JSON.parse(body);if(new TextEncoder().encode(body).byteLength>limit||!(path[2]==='refunds'?validSupplierPayment(value):path[2]==='status'?validSaleReturnStatus(value):validSaleReturnBody(value)))throw new Error('Invalid return');}
      catch{return Response.json({success:false,message:'Invalid sale return fields.'},{status:422,headers:noStore});}
      headers['Content-Type']='application/json';headers['Idempotency-Key']=key;
    }else if(path[0]==='sales'){
      try{body=await request.text();if(new TextEncoder().encode(body).byteLength>limit||!(path[2]==='status'?validPendingSaleBody(JSON.parse(body)):path.length===3?validSupplierPayment(JSON.parse(body)):validPosBody(JSON.parse(body))||validPosDraftBody(JSON.parse(body))))throw new Error('Invalid sale');}
      catch{return Response.json({success:false,message:'Invalid sale fields.'},{status:422,headers:noStore});}
      headers['Content-Type']='application/json';headers['Idempotency-Key']=key;
    }else{
    if(Number(request.headers.get('content-length')??0)>limit)return Response.json({success:false,message:'Form is too large.'},{status:413,headers:noStore});
    try{body=await request.text();if(new TextEncoder().encode(body).byteLength>limit)return Response.json({success:false,message:'Form is too large.'},{status:413,headers:noStore});const value=JSON.parse(body);const master=['categories','generics','groups','manufacturers','units'].includes(path[1]);if(!(path[1]==='cash-register'?validRegisterBody(value,path[3]==='close'):path[1]==='purchase-returns'?(path[3]==='refunds'?validSupplierPayment(value):path[3]==='status'?validPurchaseStatusBody(value):validReturnBody(value)):path[1]==='purchases'?(path[3]==='payments'?validSupplierPayment(value):path[3]==='status'?validPurchaseStatusBody(value):validPurchaseBody(value)):path[1]==='suppliers'?validSupplierBody(value,request.method):master?validMasterBody(value,request.method):bulk?validBulkProxyBody(value,path[2]):path[1]==='stocks'?validStockProxyBody(value,path[2]):validMedicineProxyBody(value,request.method)))throw new Error('Invalid fields');}
    catch{return Response.json({success:false,message:'Invalid form fields.'},{status:422,headers:noStore});}
    headers['Content-Type']='application/json';headers['Idempotency-Key']=key;
    }
    }
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
export const DELETE=proxy;
