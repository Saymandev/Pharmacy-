export type CatalogStock={id:string;tenantId:string;branchId:string;quantity:number;batchNumber:string;expiryDate:string;unit:string;mrp:number|string;rackNumber?:string|null};
export type CatalogMedicine={id:string;tenantId:string;name:string;genericName?:string|null;barcode?:string|null;unit:string;salePrice:number|string;isActive:boolean;stocks:CatalogStock[]};
export type InventoryStock=CatalogStock&{medicine:{id:string;tenantId:string;name:string};branch:{id:string;tenantId:string;name:string}};
export type CatalogMeta={page:number;pageSize:number;totalItems:number;totalPages:number;hasNextPage:boolean;hasPreviousPage:boolean};
export type CatalogPage<T>={data:T[];meta:CatalogMeta};
function object(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function money(value:unknown){return (typeof value==='number'||typeof value==='string'&&/^\d+(\.\d+)?$/.test(value))&&Number.isFinite(Number(value))&&Number(value)>=0;}
export function validCatalogStock(value:unknown,tenantId:string,branchId:string):value is CatalogStock{
 return object(value)&&typeof value.id==='string'&&value.tenantId===tenantId&&value.branchId===branchId&&Number.isInteger(value.quantity)&&Number(value.quantity)>=0&&typeof value.batchNumber==='string'&&typeof value.unit==='string'&&typeof value.expiryDate==='string'&&Number.isFinite(Date.parse(value.expiryDate))&&money(value.mrp)&&(value.rackNumber==null||typeof value.rackNumber==='string');
}
export function validCatalogMedicine(value:unknown,tenantId:string,branchId:string):value is CatalogMedicine{
 return object(value)&&typeof value.id==='string'&&value.tenantId===tenantId&&typeof value.name==='string'&&typeof value.unit==='string'&&money(value.salePrice)&&typeof value.isActive==='boolean'&&Array.isArray(value.stocks)&&value.stocks.every(row=>validCatalogStock(row,tenantId,branchId))&&
  (value.genericName==null||typeof value.genericName==='string')&&(value.barcode==null||typeof value.barcode==='string');
}
export function validCatalogPage<T>(value:unknown,page:number,validate:(row:unknown)=>row is T):value is CatalogPage<T>{
 if(!object(value)||!Array.isArray(value.data)||!object(value.meta)||!value.data.every(validate))return false;
 const meta=value.meta;
 return meta.page===page&&Number.isInteger(meta.pageSize)&&Number(meta.pageSize)>0&&Number(meta.pageSize)<=100&&value.data.length<=Number(meta.pageSize)&&Number.isInteger(meta.totalItems)&&Number(meta.totalItems)>=0&&Number.isInteger(meta.totalPages)&&Number(meta.totalPages)===Math.ceil(Number(meta.totalItems)/Number(meta.pageSize))&&meta.hasNextPage===(page<Number(meta.totalPages))&&meta.hasPreviousPage===(page>1);
}
export function validInventoryStock(value:unknown,tenantId:string,branchId:string):value is InventoryStock{
 return validCatalogStock(value,tenantId,branchId)&&'medicine'in value&&object(value.medicine)&&typeof value.medicine.id==='string'&&value.medicine.tenantId===tenantId&&typeof value.medicine.name==='string'&&'branch'in value&&object(value.branch)&&value.branch.id===branchId&&value.branch.tenantId===tenantId&&typeof value.branch.name==='string';
}
