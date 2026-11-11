import {validPosCustomer,type PosCustomer} from './tenant-pos-policy.ts';
import {validCatalogPage,type CatalogMeta} from './catalog-contract.ts';
import {purchaseCents} from './purchase-policy.ts';
import {validSupplierPayment} from './purchase-payment-policy.ts';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f-]{36}$/i.test(v);
const date=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const cash=(v:unknown)=>{try{return (typeof v==='number'||typeof v==='string'&&!!v.trim())&&purchaseCents(Number(v))>=BigInt(0);}catch{return false;}};
export type CustomerRecord=PosCustomer&{nameBangla:string|null;address:string|null;age:number;gender:string;updatedAt:string};
export type CustomerProfile={name:string;nameBangla:string|null;phone:string;address:string|null;age:number;gender:string;expectedUpdatedAt?:string};
export function validCustomerRecord(v:unknown,tenantId:string):v is CustomerRecord{return validPosCustomer(v,tenantId)&&'updatedAt'in v&&date(v.updatedAt)&&'age'in v&&Number.isInteger(v.age)&&Number(v.age)>=0&&Number(v.age)<=150&&'gender'in v&&['male','female','other','unknown'].includes(String(v.gender))&&'nameBangla'in v&&(v.nameBangla===null||typeof v.nameBangla==='string')&&'address'in v&&(v.address===null||typeof v.address==='string');}
export function validCustomerProfile(v:unknown,editing=false):v is CustomerProfile{
 if(!object(v)||Object.keys(v).length!==(editing?7:6)||!Object.keys(v).every(k=>['name','nameBangla','phone','address','age','gender',...(editing?['expectedUpdatedAt']:[])].includes(k)))return false;
 return typeof v.name==='string'&&!!v.name.trim()&&v.name.trim().length<=200&&typeof v.phone==='string'&&!!v.phone.trim()&&v.phone.trim().length<=30&&(v.nameBangla===null||typeof v.nameBangla==='string'&&v.nameBangla.length<=300)&&(v.address===null||typeof v.address==='string'&&v.address.length<=500)&&Number.isInteger(v.age)&&Number(v.age)>=0&&Number(v.age)<=150&&['male','female','other','unknown'].includes(String(v.gender))&&(!editing||date(v.expectedUpdatedAt));
}
export type AdvanceBody={branchId:string;accountId:string;amount:number;paymentMethod:string;note:string};
export function validAdvanceBody(v:unknown):v is AdvanceBody{if(!object(v)||Object.keys(v).length!==5||!Object.keys(v).every(k=>['branchId','accountId','amount','paymentMethod','note'].includes(k))||!uuid(v.branchId))return false;const {branchId,...payment}=v;void branchId;return validSupplierPayment(payment);}
export type AdvanceEvent={id:string;tenantId:string;customerId:string;branchId:string;kind:'received'|'applied'|'refunded'|'returned';sequence:number;amount:string|number;balanceAfter:string|number;createdAt:string;createdById:string|null;accountId:string|null;transactionId:string|null;paymentMethod:string|null;note:string|null;saleId:string|null;saleReturnId:string|null};
export function validAdvanceEvent(v:unknown,tenantId:string,customerId:string,branchId:string):v is AdvanceEvent{
 return object(v)&&uuid(v.id)&&v.tenantId===tenantId&&v.customerId===customerId&&v.branchId===branchId&&['received','applied','refunded','returned'].includes(String(v.kind))&&Number.isSafeInteger(v.sequence)&&Number(v.sequence)>0&&cash(v.amount)&&Number(v.amount)>0&&cash(v.balanceAfter)&&date(v.createdAt)&&['accountId','transactionId','saleId','saleReturnId'].every(k=>v[k]==null||uuid(v[k]))&&(v.note==null||typeof v.note==='string')&&(v.paymentMethod==null||typeof v.paymentMethod==='string');
}
export type AdvanceLedger={tenantId:string;customerId:string;branchId:string;balance:string|number;data:AdvanceEvent[];pagination:CatalogMeta};
export function validAdvanceLedger(v:unknown,tenantId:string,customerId:string,branchId:string,page:number):v is AdvanceLedger{
 if(!object(v)||v.tenantId!==tenantId||v.customerId!==customerId||v.branchId!==branchId||!cash(v.balance)||!validCatalogPage({data:v.data,meta:v.pagination},page,(r):r is AdvanceEvent=>validAdvanceEvent(r,tenantId,customerId,branchId)))return false;
 const rows=v.data as AdvanceEvent[];return new Set(rows.map(r=>r.id)).size===rows.length&&new Set(rows.map(r=>r.sequence)).size===rows.length&&rows.every((r,i)=>i===0||r.sequence<rows[i-1].sequence);
}
export function validAdvanceResult(v:unknown,tenantId:string,customerId:string,userId:string,kind:'received'|'refunded',body:AdvanceBody):v is AdvanceEvent{
 return validAdvanceEvent(v,tenantId,customerId,body.branchId)&&v.kind===kind&&v.createdById===userId&&v.accountId===body.accountId&&uuid(v.transactionId)&&v.paymentMethod===body.paymentMethod&&Number(v.amount)===body.amount;
}
