import {hrKinds,validHrBody,type HrKind,type HrAction} from './hr-contract.ts';
import {reportDatasets,reportPaths,reportWindow,type ReportSelection,type ReportDataset} from './report-policy.ts';
import {validMediaFiles,mediaMimes} from './media-policy.ts';
import {validInviteBody} from './team-invitation-policy.ts';
import {validTeamBody,type TeamKind} from './team-policy.ts';
export class WorkspaceError extends Error{
  readonly status:number;
  constructor(message:string,status:number){super(message);this.name='WorkspaceError';this.status=status;}
}
/** One short-lived, allowlisted transport per mounted shop. Never falls back to the
 * legacy API or accepts caller-provided tenant/auth headers. */
export function createWorkspaceClient(tenantId:string,sessionSignal:AbortSignal,fetcher:typeof fetch=fetch){
  if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(tenantId))throw new WorkspaceError('Invalid shop.',400);
  const controller=new AbortController();let disposed=false;
  async function request(path:string,withMeta=false,mutation?:{method:'POST'|'PATCH'|'DELETE';body:unknown;key:string}){
    if(disposed||sessionSignal.aborted)throw new WorkspaceError('Shop selection changed.',409);
    const response=await fetcher(`/api/backend/tenant-workspace/${encodeURIComponent(tenantId)}/${path}`,{
      method:mutation?.method??'GET',body:mutation?JSON.stringify(mutation.body):undefined,credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json',...(mutation?{'Content-Type':'application/json','Idempotency-Key':mutation.key}:{})},signal:AbortSignal.any([controller.signal,sessionSignal]),
    });
    const payload=await response.json();
    if(disposed||sessionSignal.aborted)throw new WorkspaceError('Shop selection changed.',409);
    if(!response.ok){const validation=Array.isArray(payload?.errors)?payload.errors.filter((row:unknown):row is {message:string}=>!!row&&typeof row==='object'&&'message'in row&&typeof row.message==='string').map((row:{message:string})=>row.message).join('; '):'';throw new WorkspaceError((typeof payload?.message==='string'?payload.message:'Shop access could not be verified.')+(validation?` ${validation}`:''),response.status);}
    if(payload?.success!==true||!('data' in payload))throw new WorkspaceError('Invalid shop response.',502);
    return (withMeta?payload:payload.data) as unknown;
  }
  const get=(path:string,withMeta=false)=>request(path,withMeta);
  return {
    hrList:(kind:HrKind,branchId:string,page:number,filters:Record<string,string>={})=>{if(!hrKinds.includes(kind)||!/^[0-9a-f-]{36}$/i.test(branchId)||!Number.isInteger(page)||page<1||page>1000000||Object.keys(filters).some(k=>!['search','status','employeeId','departmentId','from','to'].includes(k)))throw new WorkspaceError('Invalid HR query.',422);return get('hr/'+kind+'?'+new URLSearchParams({branchId,page:String(page),...Object.fromEntries(Object.entries(filters).filter(([,v])=>!!v))}));},
    hrCommand:(kind:HrKind,action:HrAction,id:string|null,body:unknown,key:string)=>{if(!validHrBody(body,kind,action)||action!=='create'&&(!id||!/^[0-9a-f-]{36}$/i.test(id))||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new WorkspaceError('Check the HR fields',422);return request('hr/'+kind+(action==='create'?'':'/'+id)+(['decision','membership'].includes(action)?'/'+action:''),false,{method:action==='create'?'POST':action==='delete'?'DELETE':'PATCH',body,key});},
    hrMembership:(id:string,branchId:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[0-9a-f-]{36}$/i.test(branchId))throw new WorkspaceError('Invalid HR identity link.',422);return get('hr/employees/'+id+'/membership?'+new URLSearchParams({branchId}));},
    teamInvitations:(page:number)=>{if(!Number.isInteger(page)||page<1||page>1000000)throw new WorkspaceError('Invalid invitation page.',422);return get('team/invitations?page='+page);},
    teamInvite:(body:unknown,key:string)=>{if(!validInviteBody(body)||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new WorkspaceError('Check the invitation fields',422);return request('team/invitations',false,{method:'POST',body,key});},
    revokeTeamInvite:(id:string,key:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new WorkspaceError('Invalid invitation.',422);return request('team/invitations/'+id+'/revoke',false,{method:'POST',body:{},key});},
    teamCatalog:()=>get('team/catalog'),
    teamMembers:(page:number,search:string,status:string)=>{if(!Number.isInteger(page)||page<1||page>1000000||search.length>200||!['','ACTIVE','SUSPENDED','REVOKED','INVITED'].includes(status))throw new WorkspaceError('Invalid team query.',422);return get('team/members?'+new URLSearchParams({page:String(page),search,status}));},
    teamCommand:(kind:TeamKind,id:string|null,body:unknown,key:string)=>{if(!validTeamBody(body,kind)||kind!=='role.create'&&(!id||!/^[0-9a-f-]{36}$/i.test(id))||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new WorkspaceError('Invalid team access fields.',422);return request(kind==='role.create'?'team/roles':kind.startsWith('role.')?`team/roles/${id}`:`team/members/${id}/${kind==='member.access'?'access':'status'}`,false,{method:kind==='role.create'?'POST':kind==='role.delete'?'DELETE':'PATCH',body,key});},
    mediaList:(branchId:string,page:number,filters:Record<string,string>)=>get(`media?${resourceQuery(branchId,page,filters,['search','type','state','purpose'])}`.replace('limit=20','limit=24')),
    mediaSave:(id:string,kind:'rename'|'trash'|'restore',body:unknown,key:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new WorkspaceError('Invalid media request.',400);return request(`media/${id}${kind==='restore'?'/restore':''}`,false,{method:kind==='rename'?'PATCH':kind==='trash'?'DELETE':'POST',body,key});},
    mediaUploadStatus:(key:string)=>{if(!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new WorkspaceError('Invalid upload key.',400);return get(`media/upload-status/${key}`);},
    mediaReservations:()=>get('media/uploads'),
    reconcileMedia:(id:string,key:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id))throw new WorkspaceError('Invalid upload reservation.',400);return request(`media/uploads/${id}/reconcile`,false,{method:'POST',body:{},key});},
    mediaUpload:async(branchId:string,files:File[],key:string)=>{
      if(disposed||sessionSignal.aborted)throw new WorkspaceError('Shop selection changed.',409);
      if(!/^[0-9a-f-]{36}$/i.test(branchId)||!/^[A-Za-z0-9_-]{16,128}$/.test(key)||!validMediaFiles(files))throw new WorkspaceError('Choose 1–5 PNG, JPEG, GIF, WebP or PDF files. Maximum 5 MB each and 10 MB total.',422);
      const form=new FormData();for(const file of files)form.append('files',file);
      const response=await fetcher(`/api/backend/tenant-workspace/${encodeURIComponent(tenantId)}/media/upload-multiple?${new URLSearchParams({branchId,purpose:'library'})}`,{method:'POST',body:form,credentials:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json','Idempotency-Key':key},signal:AbortSignal.any([controller.signal,sessionSignal])});
      const payload=await response.json();if(disposed||sessionSignal.aborted)throw new WorkspaceError('Shop selection changed.',409);
      if(!response.ok||payload?.success!==true||!('data'in payload))throw new WorkspaceError(typeof payload?.message==='string'?payload.message:'Upload result could not be verified.',response.ok?502:response.status);return payload.data as unknown;
    },
    mediaContent:async(id:string,mime:string,size:number)=>{
      if(disposed||sessionSignal.aborted)throw new WorkspaceError('Shop selection changed.',409);
      if(!/^[0-9a-f-]{36}$/i.test(id)||!mediaMimes.includes(mime as typeof mediaMimes[number])||!Number.isSafeInteger(size)||size<1||size>5242880)throw new WorkspaceError('Invalid private file.',400);
      const response=await fetcher(`/api/backend/tenant-workspace/${encodeURIComponent(tenantId)}/media/${id}/content`,{credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.any([controller.signal,sessionSignal])});
      if(!response.ok)throw new WorkspaceError('Private file is unavailable.',response.status);
      if(response.headers.get('content-type')?.split(';')[0]!==mime)throw new WorkspaceError('Private file type could not be verified.',502);
      const blob=await response.blob();if(disposed||sessionSignal.aborted)throw new WorkspaceError('Shop selection changed.',409);if(blob.size!==size)throw new WorkspaceError('Private file size could not be verified.',502);return blob;
    },
    billingPortal:(before?:string)=>get('billing/portal'+(before?'?'+new URLSearchParams({before}):'')),
    billingHistory:(kind:'PAYMENTS'|'CREDITS',before?:string)=>{if(!['PAYMENTS','CREDITS'].includes(kind)||before&&!/^[0-9a-f-]{36}$/i.test(before))throw new WorkspaceError('Invalid billing history query.',400);return get('billing/history?'+new URLSearchParams({kind,...(before?{before}:{})}));},
    billingRequest:(body:unknown,key:string)=>request('billing/requests',false,{method:'POST',body,key}),
    activeCustomization:()=>get('settings/customization/active'),
    report:(kind:'summary'|ReportDataset,selection:ReportSelection,page=1,exporting=false)=>{if(kind!=='summary'&&!reportDatasets.includes(kind)||!reportWindow(selection)||!Number.isInteger(page)||page<1||page>1000000)throw new WorkspaceError('Choose a valid report window of at most 366 days ending today or earlier',422);const query=new URLSearchParams({branchId:selection.branchId,startDate:selection.startDate,endDate:selection.endDate});if(kind!=='summary'){query.set('search',selection.search.trim());if(!exporting){query.set('page',String(page));query.set('limit','25');}}return get(`reports/${exporting?`exports/${kind}/document`:kind==='summary'?'pharmacy/summary':reportPaths[kind]}?${query}`);},
    saleReturnable:(id:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id))throw new WorkspaceError('Invalid invoice.',400);return get(`sales/${id}/returnable-items`);},
    saleReturns:(branchId:string,saleId:string,page:number,filters:Record<string,string>={})=>{if(!/^[0-9a-f-]{36}$/i.test(saleId))throw new WorkspaceError('Invalid invoice.',400);return get(`sale-returns?${resourceQuery(branchId,page,filters,['search','status','invoiceNumber','startDate','endDate'])}&${new URLSearchParams({saleId})}`,true);},
    saleReturn:(id:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id))throw new WorkspaceError('Invalid return.',400);return get(`sale-returns/${id}`);},
    saveSaleReturn:(id:string|null,kind:'create'|'status'|'refund',body:unknown,key:string)=>{if(!['create','status','refund'].includes(kind)||kind!=='create'&&(!id||!/^[0-9a-f-]{36}$/i.test(id))||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new WorkspaceError('Invalid sale return request.',400);return request(kind==='create'?'sale-returns':`sale-returns/${id}/${kind==='refund'?'refunds':'status'}`,false,{method:kind==='status'?'PATCH':'POST',body,key});},
    pendingSaleStatus:(id:string,body:unknown,key:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new WorkspaceError('Invalid pending sale.',400);return request(`sales/${id}/status`,false,{method:'PATCH',body,key});},
    sales:(branchId:string,page:number,filters:Record<string,string>={})=>get(`sales?${resourceQuery(branchId,page,filters,['search','status','paymentStatus','hasDue','invoiceNumber','customerId','startDate','endDate'])}`,true),
    sale:(id:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id))throw new WorkspaceError('Invalid invoice.',400);return get(`sales/${id}`);},
    collectDue:(id:string,body:unknown,key:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new WorkspaceError('Invalid collection request.',400);return request(`sales/${id}/payments`,false,{method:'POST',body,key});},
    saveCustomer:(id:string|null,body:unknown,key:string)=>{if(id&&!/^[0-9a-f-]{36}$/i.test(id)||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new WorkspaceError('Invalid customer save.',400);return request(`customers${id?`/${id}`:''}`,false,{method:id?'PATCH':'POST',body,key});},
    customerLedger:(id:string,branchId:string,page:number,filters:Record<string,string>={})=>{if(!/^[0-9a-f-]{36}$/i.test(id))throw new WorkspaceError('Invalid customer.',400);return get(`customers/${id}/ledger?${resourceQuery(branchId,page,filters,['kind','startDate','endDate'])}`);},
    customerAdvance:(id:string,kind:'received'|'refunded',body:unknown,key:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id)||!['received','refunded'].includes(kind)||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new WorkspaceError('Invalid advance request.',400);return request(`customers/${id}/${kind==='received'?'advances':'advance-refunds'}`,false,{method:'POST',body,key});},
    posCustomers:(page:number,search:string)=>{if(!Number.isInteger(page)||page<1||page>1000000||search.length>200)throw new WorkspaceError('Invalid customer search.',400);return get(`customers?${new URLSearchParams({page:String(page),limit:'20',search})}`,true);},
    posCustomer:(id:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id))throw new WorkspaceError('Invalid customer.',400);return get(`customers/${id}`);},
    createSale:(body:unknown,key:string)=>{if(!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new WorkspaceError('Invalid sale key.',400);return request('sales',false,{method:'POST',body,key});},
    activeRegister:(branchId:string)=>get(`pharmacy/cash-register/active?${new URLSearchParams({branchId})}`),
    registerSessions:(branchId:string,page:number,filters:Record<string,string>={})=>get(`pharmacy/cash-register?${resourceQuery(branchId,page,filters,['search','status','startDate','endDate'])}`,true),
    registerMovements:(id:string,branchId:string,page:number)=>{if(!/^[0-9a-f-]{36}$/i.test(id))throw new WorkspaceError('Invalid register.',400);return get(`pharmacy/cash-register/${id}/movements?${resourceQuery(branchId,page,{},[])}`,true);},
    saveRegister:(id:string|null,body:unknown,key:string)=>{if(id&&!/^[0-9a-f-]{36}$/i.test(id)||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new WorkspaceError('Invalid register request.',400);return request(`pharmacy/cash-register/${id?`${id}/close`:'open'}`,false,{method:'POST',body,key});},
    bootstrap:(after?:string,search?:string)=>{const query=new URLSearchParams();if(after)query.set('after',after);if(search)query.set('search',search);return get(`workspace/bootstrap${query.size?`?${query}`:''}`);},
    branch:(id:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id))throw new WorkspaceError('Invalid branch.',400);return get(`workspace/branches/${encodeURIComponent(id)}`);},
    posMedicines:(branchId:string,page:number,search:string)=>get(`pos/medicines?${resourceQuery(branchId,page,{search},['search'])}`,true),
    medicines:(branchId:string,page:number,filters:Record<string,string>={})=>get(`pharmacy/medicines?${resourceQuery(branchId,page,filters,['search','isActive','hasStock','barcode','unit','dosageForm','strength','categoryId','genericId','groupId','medicineManufacturerId','medicineUnitId'])}`,true),
    stocks:(branchId:string,page:number,filters:Record<string,string>={})=>get(`pharmacy/stocks?${resourceQuery(branchId,page,filters,['search','batchNumber','rackNumber','unit','expiryStartDate','expiryEndDate','medicineManufacturerId'])}`,true),
    stock:(id:string,branchId:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[0-9a-f-]{36}$/i.test(branchId))throw new WorkspaceError('Invalid stock selection.',400);return get(`pharmacy/stocks/${id}?${new URLSearchParams({branchId})}`);},
    stockMedicines:(branchId:string,page:number,search:string)=>get(`pharmacy/medicines?${resourceQuery(branchId,page,{search,isActive:'true',registeredOnly:'false'},['search','isActive','registeredOnly'])}`,true),
    historyMedicines:(branchId:string,page:number,search:string)=>get(`pharmacy/medicines?${resourceQuery(branchId,page,{search,registeredOnly:'false'},['search','registeredOnly'])}`,true),
    history:(branchId:string,page:number,filters:Record<string,string>={})=>get(`pharmacy/stocks/history?${resourceQuery(branchId,page,filters,['search','stockId','medicineId','batchNumber','type','stockChangeType','startDate','endDate'])}`,true),
    medicine:(id:string,branchId:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id))throw new WorkspaceError('Invalid medicine.',400);const query=new URLSearchParams(resourceQuery(branchId,1,{},[]));query.delete('page');query.delete('limit');return get(`pharmacy/medicines/${id}?${query}`);},
    references:(kind:string,page:number,search:string)=>{if(!['categories','generics','groups','manufacturers','units'].includes(kind)||!Number.isInteger(page)||page<1)throw new WorkspaceError('Invalid reference query.',400);return get(`pharmacy/${kind}?${new URLSearchParams({page:String(page),limit:'20',search})}`,true);},
    saveMedicine:(id:string|null,body:unknown,key:string)=>{if(id&&!/^[0-9a-f-]{36}$/i.test(id)||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new WorkspaceError('Invalid medicine save request.',400);return request(`pharmacy/medicines${id?`/${id}`:''}`,false,{method:id?'PATCH':'POST',body,key});},
    saveStock:(kind:'opening'|'adjust'|'transfer',body:unknown,key:string)=>{if(!['opening','adjust','transfer'].includes(kind)||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new WorkspaceError('Invalid stock save request.',400);return request(`pharmacy/stocks/${kind}`,false,{method:'POST',body,key});},
    importMedicines:(body:unknown,key:string)=>{if(!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new WorkspaceError('Invalid save key.',400);return request('pharmacy/medicines/import',false,{method:'POST',body,key});},
    async previewImport(file:File){
      if(disposed||sessionSignal.aborted)throw new WorkspaceError('Shop selection changed.',409);
      if(file.size>1024*1024||!/\.csv$|\.xlsx$/i.test(file.name))throw new WorkspaceError('Choose one CSV or XLSX file up to 1 MB.',422);
      const form=new FormData();form.append('file',file,file.name);
      const response=await fetcher(`/api/backend/tenant-workspace/${encodeURIComponent(tenantId)}/pharmacy/medicines/import-preview`,{method:'POST',body:form,credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.any([controller.signal,sessionSignal])});
      const payload=await response.json();if(disposed||sessionSignal.aborted)throw new WorkspaceError('Shop selection changed.',409);
      if(!response.ok||payload?.success!==true||!('data'in payload))throw new WorkspaceError(typeof payload?.message==='string'?payload.message:'Import preview could not be loaded.',response.status);return payload.data as unknown;
    },
    updatePrices:(body:unknown,key:string)=>{if(!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new WorkspaceError('Invalid save key.',400);return request('pharmacy/stocks/bulk-price-update',false,{method:'PATCH',body,key});},
    dispose(){disposed=true;controller.abort();},
    createPurchase:(body:unknown,key:string)=>{if(!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new WorkspaceError('Invalid purchase key.',400);return request('pharmacy/purchases',false,{method:'POST',body,key});},
    purchases:(branchId:string,page:number,filters:Record<string,string>={})=>get(`pharmacy/purchases?${resourceQuery(branchId,page,filters,['search','status','paymentStatus','startDate','endDate','supplierId','poNumber','minAmount','maxAmount','paymentMethod','cashRegisterSessionId'])}`,true),
    purchase:(id:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id))throw new WorkspaceError('Invalid purchase.',400);return get(`pharmacy/purchases/${id}`);},
    purchaseStatus:(id:string,body:unknown,key:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new WorkspaceError('Invalid purchase status request.',400);return request(`pharmacy/purchases/${id}/status`,false,{method:'PATCH',body,key});},
    paymentAccounts:(branchId:string,page:number,search:string,type:string)=>{if(!['cash','bank','mfs'].includes(type)||search.length>200)throw new WorkspaceError('Invalid payment account filter.',400);return get(`finance/accounts/payment-options?${resourceQuery(branchId,page,{search,type},['search','type'])}`,true);},
    payPurchase:(id:string,body:unknown,key:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new WorkspaceError('Invalid purchase payment request.',400);return request(`pharmacy/purchases/${id}/payments`,false,{method:'POST',body,key});},
    returnable:(id:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id))throw new WorkspaceError('Invalid purchase.',400);return get(`pharmacy/purchases/${id}/returnable-items`);},
    purchaseReturns:(branchId:string,purchaseId:string,page:number,filters:Record<string,string>={})=>{if(!/^[0-9a-f-]{36}$/i.test(purchaseId))throw new WorkspaceError('Invalid source purchase.',400);return get(`pharmacy/purchase-returns?${resourceQuery(branchId,page,filters,['search','status','startDate','endDate','minAmount','maxAmount','poNumber'])}&${new URLSearchParams({purchaseId})}`,true);},
    purchaseReturn:(id:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id))throw new WorkspaceError('Invalid return.',400);return get(`pharmacy/purchase-returns/${id}`);},
    createPurchaseReturn:(body:unknown,key:string)=>{if(!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new WorkspaceError('Invalid return key.',400);return request('pharmacy/purchase-returns',false,{method:'POST',body,key});},
    returnStatus:(id:string,body:unknown,key:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new WorkspaceError('Invalid return status.',400);return request(`pharmacy/purchase-returns/${id}/status`,false,{method:'PATCH',body,key});},
    refundSupplier:(id:string,body:unknown,key:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new WorkspaceError('Invalid supplier refund.',400);return request(`pharmacy/purchase-returns/${id}/refunds`,false,{method:'POST',body,key});},
    suppliers:(page:number,search:string)=>{if(!Number.isInteger(page)||page<1||page>1000000||search.length>200)throw new WorkspaceError('Invalid supplier search.',400);return get(`pharmacy/suppliers?${new URLSearchParams({page:String(page),limit:'20',search})}`,true);},
    supplier:(id:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id))throw new WorkspaceError('Invalid supplier.',400);return get(`pharmacy/suppliers/${id}`);},
    saveSupplier:(id:string|null,body:unknown,key:string,remove=false)=>{if(id&&!/^[0-9a-f-]{36}$/i.test(id)||remove&&!id||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new WorkspaceError('Invalid supplier request.',400);return request(`pharmacy/suppliers${id?`/${id}`:''}`,false,{method:remove?'DELETE':id?'PATCH':'POST',body,key});},
    saveMaster:(kind:string,id:string|null,body:unknown,remove=false)=>{if(!['categories','generics','groups','manufacturers','units'].includes(kind)||id&&!/^[0-9a-f-]{36}$/i.test(id)||remove&&!id)throw new WorkspaceError('Invalid master selection.',400);return request(`pharmacy/${kind}${id?`/${id}`:''}`,false,{method:remove?'DELETE':id?'PATCH':'POST',body,key:crypto.randomUUID()});},
  };
}
function resourceQuery(branchId:string,page:number,filters:Record<string,string>,allowed:string[]){
  if(!/^[0-9a-f-]{36}$/i.test(branchId)||!Number.isInteger(page)||page<1||page>1000000)throw new WorkspaceError('Invalid branch or page.',400);
  const query=new URLSearchParams({branchId,page:String(page),limit:'20'});
  for(const [key,value]of Object.entries(filters)){if(!allowed.includes(key))throw new WorkspaceError('Invalid filter.',400);if(value.trim())query.set(key,value.trim());}
  return query.toString();
}
