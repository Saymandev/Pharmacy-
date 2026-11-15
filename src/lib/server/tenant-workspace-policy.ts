import {validateImportRows,validPriceRows} from '../../features/shops/bulk-policy.ts';
export {validRegisterBody} from '../../features/shops/register-policy.ts';
export {validPosBody} from '../../features/shops/tenant-pos-policy.ts';
export {validPendingSaleBody} from '../../features/shops/pending-sale-policy.ts';
export {validPurchaseBody} from '../../features/shops/purchase-policy.ts';
export {validPurchaseStatusBody} from '../../features/shops/purchase-read-policy.ts';
export {validSupplierPayment} from '../../features/shops/purchase-payment-policy.ts';
export {validReturnBody} from '../../features/shops/purchase-return-policy.ts';
export function tenantWorkspaceTarget(tenantId:string,path:string[],method:string,config={
  session:process.env.TENANT_SESSION_PREVIEW_ENABLED,workspace:process.env.TENANT_WORKSPACE_PREVIEW_ENABLED,base:process.env.TENANT_BACKEND_API_URL,
  writes:process.env.TENANT_CATALOG_WRITES_ENABLED,
}):{url:string;tenantId:string}|null{
  if(config.session!=='true'||config.workspace!=='true'||!config.base)return null;
  if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(tenantId))return null;
  const read=path.length===3&&path[0]==='settings'&&path[1]==='customization'&&path[2]==='active'||
    path.length===2&&path[0]==='workspace'&&path[1]==='bootstrap'||
    path.length===3&&path[0]==='workspace'&&path[1]==='branches'&&/^[0-9a-f-]{36}$/i.test(path[2])||
    path.length===2&&path[0]==='pharmacy'&&['medicines','stocks'].includes(path[1])||
    path.length===3&&path[0]==='pharmacy'&&path[1]==='medicines'&&/^[0-9a-f-]{36}$/i.test(path[2])||
    path.length===3&&path[0]==='pharmacy'&&path[1]==='stocks'&&/^[0-9a-f-]{36}$/i.test(path[2])||
    path.length===3&&path[0]==='pharmacy'&&path[1]==='stocks'&&path[2]==='history'||
    path.length===2&&path[0]==='pharmacy'&&['categories','generics','groups','manufacturers','units'].includes(path[1]);
  const write=config.writes==='true'&&path[0]==='pharmacy'&&(path[1]==='medicines'&&(method==='POST'&&path.length===2||method==='PATCH'&&path.length===3&&/^[0-9a-f-]{36}$/i.test(path[2]))||path[1]==='stocks'&&method==='POST'&&path.length===3&&['opening','adjust','transfer'].includes(path[2]));
  const bulk=config.writes==='true'&&path.length===3&&path[0]==='pharmacy'&&(path[1]==='medicines'&&['import','import-preview'].includes(path[2])&&method==='POST'||path[1]==='stocks'&&path[2]==='bulk-price-update'&&method==='PATCH');
  const master=config.writes==='true'&&path[0]==='pharmacy'&&['categories','generics','groups','manufacturers','units'].includes(path[1])&&(path.length===2&&method==='POST'||path.length===3&&/^[0-9a-f-]{36}$/i.test(path[2])&&['PATCH','DELETE'].includes(method));
  const supplier=path[0]==='pharmacy'&&path[1]==='suppliers'&&(path.length===2||path.length===3&&/^[0-9a-f-]{36}$/i.test(path[2]))&&(method==='GET'||config.writes==='true'&&(path.length===2&&method==='POST'||path.length===3&&['PATCH','DELETE'].includes(method)));
  const purchase=path[0]==='pharmacy'&&path[1]==='purchases'&&(method==='GET'&&(path.length===2||path.length===3&&/^[0-9a-f-]{36}$/i.test(path[2]))||config.writes==='true'&&(method==='POST'&&path.length===2||method==='PATCH'&&path.length===4&&/^[0-9a-f-]{36}$/i.test(path[2])&&path[3]==='status'||method==='POST'&&path.length===4&&/^[0-9a-f-]{36}$/i.test(path[2])&&path[3]==='payments'));
  const paymentOptions=method==='GET'&&path.length===3&&path[0]==='finance'&&path[1]==='accounts'&&path[2]==='payment-options';
  const returnable=method==='GET'&&path.length===4&&path[0]==='pharmacy'&&path[1]==='purchases'&&/^[0-9a-f-]{36}$/i.test(path[2])&&path[3]==='returnable-items';
  const returns=path[0]==='pharmacy'&&path[1]==='purchase-returns'&&(method==='GET'&&(path.length===2||path.length===3&&/^[0-9a-f-]{36}$/i.test(path[2]))||config.writes==='true'&&(method==='POST'&&path.length===2||path.length===4&&/^[0-9a-f-]{36}$/i.test(path[2])&&(method==='PATCH'&&path[3]==='status'||method==='POST'&&path[3]==='refunds')));
  const register=path[0]==='pharmacy'&&path[1]==='cash-register'&&(method==='GET'&&(path.length===2||path.length===3&&(path[2]==='active'||/^[0-9a-f-]{36}$/i.test(path[2]))||path.length===4&&/^[0-9a-f-]{36}$/i.test(path[2])&&path[3]==='movements')||method==='POST'&&config.writes==='true'&&(path.length===3&&path[2]==='open'||path.length===4&&/^[0-9a-f-]{36}$/i.test(path[2])&&path[3]==='close'));
  const sale=path[0]==='sales'&&(method==='GET'&&(path.length===1||path.length===2&&/^[0-9a-f-]{36}$/i.test(path[1]))||config.writes==='true'&&(method==='POST'&&(path.length===1||path.length===3&&/^[0-9a-f-]{36}$/i.test(path[1])&&path[2]==='payments')||method==='PATCH'&&path.length===3&&/^[0-9a-f-]{36}$/i.test(path[1])&&path[2]==='status'));
  const customer=path[0]==='customers'&&(method==='GET'&&(path.length===1||path.length===2&&/^[0-9a-f-]{36}$/i.test(path[1])||path.length===3&&/^[0-9a-f-]{36}$/i.test(path[1])&&path[2]==='ledger')||config.writes==='true'&&(method==='POST'&&path.length===1||method==='PATCH'&&path.length===2&&/^[0-9a-f-]{36}$/i.test(path[1])||method==='POST'&&path.length===3&&/^[0-9a-f-]{36}$/i.test(path[1])&&['advances','advance-refunds'].includes(path[2])));
  const saleAllowance=method==='GET'&&path.length===3&&path[0]==='sales'&&/^[0-9a-f-]{36}$/i.test(path[1])&&path[2]==='returnable-items';
  const saleReturns=path[0]==='sale-returns'&&(method==='GET'&&(path.length===1||path.length===2&&/^[0-9a-f-]{36}$/i.test(path[1]))||config.writes==='true'&&(method==='POST'&&path.length===1||path.length===3&&/^[0-9a-f-]{36}$/i.test(path[1])&&(method==='PATCH'&&path[2]==='status'||method==='POST'&&path[2]==='refunds')));
  const report=method==='GET'&&path[0]==='reports'&&(path.length===3&&(path[1]==='pharmacy'&&['summary','sales-report','purchase-report','due-collection'].includes(path[2])||path[1]==='finance'&&['income','expense','movements'].includes(path[2]))||path.length===4&&path[1]==='exports'&&['summary','sales','purchases','collections','income','expense','movements'].includes(path[2])&&path[3]==='document');
  if(!(method==='GET'&&read)&&!write&&!bulk&&!master&&!supplier&&!purchase&&!paymentOptions&&!returnable&&!returns&&!register&&!sale&&!customer&&!saleAllowance&&!saleReturns&&!report)return null;
  try{
    const base=new URL(config.base);
    if(!['https:','http:'].includes(base.protocol)||base.username||base.password||base.search||base.hash)return null;
    return {url:`${base.toString().replace(/\/$/,'')}/${path.map(encodeURIComponent).join('/')}`,tenantId};
  }catch{return null;}
}
export function validSupplierBody(value:unknown,method:string):boolean{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 if(method==='DELETE')return Object.keys(value).length===0;
 const row=value as Record<string,unknown>;
 return Object.keys(row).every(key=>['name','nameBangla','address','phone','email'].includes(key))&&[['name',200],['address',500],['phone',30]].every(([key,max])=>typeof row[key]==='string'&&!!(row[key] as string).trim()&&(row[key] as string).trim().length<=Number(max))&&(!('nameBangla'in row)||row.nameBangla===null||typeof row.nameBangla==='string'&&row.nameBangla.length<=300)&&(!('email'in row)||row.email===null||typeof row.email==='string'&&(row.email===''||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)));
}
export function validMasterBody(value:unknown,method:string):boolean{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 if(method==='DELETE')return Object.keys(value).length===0;
 return Object.keys(value).every(key=>['name','nameBangla'].includes(key))&&'name'in value&&typeof value.name==='string'&&!!value.name.trim()&&value.name.trim().length<=100&&(!('nameBangla'in value)||value.nameBangla===null||typeof value.nameBangla==='string'&&value.nameBangla.trim().length<=150);
}
export function validBulkProxyBody(value:unknown,kind:string):boolean{
 if(kind==='bulk-price-update')return validPriceRows(value);
 return kind==='import'&&!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===1&&'rows'in value&&validateImportRows(value.rows);
}
export function validStockProxyBody(value:unknown,kind:string):boolean{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const allowed=kind==='opening'?['medicineId','branchId','batchNumber','expiryDate','quantity','unitPrice','mrp','unit','rackNumber','note']:kind==='adjust'?['stockId','quantity','type','note','expectedQuantity']:kind==='transfer'?['stockId','toBranchId','quantity','note','expectedQuantity']:[];
  if(['adjust','transfer'].includes(kind)&&(!('expectedQuantity'in value)||!Number.isInteger(value.expectedQuantity)||Number(value.expectedQuantity)<0||!('note'in value)||typeof value.note!=='string'||!value.note.trim()))return false;
  return Object.keys(value).length>0&&Object.keys(value).every(key=>allowed.includes(key));
}
export function validMedicineProxyBody(value:unknown,method:string):boolean{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  if(method==='PATCH'&&(!('expectedUpdatedAt'in value)||typeof value.expectedUpdatedAt!=='string'||!Number.isFinite(Date.parse(value.expectedUpdatedAt))))return false;
  const allowed=['name','nameBangla','genericName','genericNameBangla','barcode','unit','dosageForm','strength','categoryId','genericId','groupId','medicineManufacturerId','medicineUnitId','purchasePrice','salePrice','mrp','reorderLevel','isActive',...(method==='PATCH'?['expectedUpdatedAt']:[])];
  return Object.keys(value).length>0&&Object.keys(value).every(key=>allowed.includes(key));
}
