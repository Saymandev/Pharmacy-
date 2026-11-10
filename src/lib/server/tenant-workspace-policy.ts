export function tenantWorkspaceTarget(tenantId:string,path:string[],method:string,config={
  session:process.env.TENANT_SESSION_PREVIEW_ENABLED,workspace:process.env.TENANT_WORKSPACE_PREVIEW_ENABLED,base:process.env.TENANT_BACKEND_API_URL,
  writes:process.env.TENANT_CATALOG_WRITES_ENABLED,
}):{url:string;tenantId:string}|null{
  if(config.session!=='true'||config.workspace!=='true'||!config.base)return null;
  if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(tenantId))return null;
  const read=path.length===2&&path[0]==='workspace'&&path[1]==='bootstrap'||
    path.length===3&&path[0]==='workspace'&&path[1]==='branches'&&/^[0-9a-f-]{36}$/i.test(path[2])||
    path.length===2&&path[0]==='pharmacy'&&['medicines','stocks'].includes(path[1])||
    path.length===3&&path[0]==='pharmacy'&&path[1]==='medicines'&&/^[0-9a-f-]{36}$/i.test(path[2])||
    path.length===3&&path[0]==='pharmacy'&&path[1]==='stocks'&&/^[0-9a-f-]{36}$/i.test(path[2])||
    path.length===2&&path[0]==='pharmacy'&&['categories','generics','groups','manufacturers','units'].includes(path[1]);
  const write=config.writes==='true'&&path[0]==='pharmacy'&&(path[1]==='medicines'&&(method==='POST'&&path.length===2||method==='PATCH'&&path.length===3&&/^[0-9a-f-]{36}$/i.test(path[2]))||path[1]==='stocks'&&method==='POST'&&path.length===3&&['opening','adjust'].includes(path[2]));
  if(!(method==='GET'&&read)&&!write)return null;
  try{
    const base=new URL(config.base);
    if(!['https:','http:'].includes(base.protocol)||base.username||base.password||base.search||base.hash)return null;
    return {url:`${base.toString().replace(/\/$/,'')}/${path.map(encodeURIComponent).join('/')}`,tenantId};
  }catch{return null;}
}
export function validStockProxyBody(value:unknown,kind:string):boolean{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const allowed=kind==='opening'?['medicineId','branchId','batchNumber','expiryDate','quantity','unitPrice','mrp','unit','rackNumber','note']:kind==='adjust'?['stockId','quantity','type','note','expectedQuantity']:[];
  if(kind==='adjust'&&(!('expectedQuantity'in value)||!Number.isInteger(value.expectedQuantity)||Number(value.expectedQuantity)<0||!('note'in value)||typeof value.note!=='string'||!value.note.trim()))return false;
  return Object.keys(value).length>0&&Object.keys(value).every(key=>allowed.includes(key));
}
export function validMedicineProxyBody(value:unknown,method:string):boolean{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  if(method==='PATCH'&&(!('expectedUpdatedAt'in value)||typeof value.expectedUpdatedAt!=='string'||!Number.isFinite(Date.parse(value.expectedUpdatedAt))))return false;
  const allowed=['name','nameBangla','genericName','genericNameBangla','barcode','unit','dosageForm','strength','categoryId','genericId','groupId','medicineManufacturerId','medicineUnitId','purchasePrice','salePrice','mrp','reorderLevel','isActive',...(method==='PATCH'?['expectedUpdatedAt']:[])];
  return Object.keys(value).length>0&&Object.keys(value).every(key=>allowed.includes(key));
}
