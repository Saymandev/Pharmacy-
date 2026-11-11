import {purchaseCents} from './purchase-policy.ts';
import {validPurchaseDetail,type PurchaseDetail} from './purchase-read-policy.ts';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const supplierPaymentMethods=['cash','card','online','cheque','bKash','Nagad','Rocket','Bank Transfer'] as const;
export type SupplierPayment={accountId:string;amount:number;paymentMethod:typeof supplierPaymentMethods[number];note:string};
export type PaymentAccount={id:string;tenantId:string;name:string;type:'cash'|'bank'|'mfs';group?:string|null};
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export function validPaymentAccount(value:unknown,tenantId:string,type:string):value is PaymentAccount{
 return object(value)&&Object.keys(value).every(key=>['id','tenantId','name','type','group'].includes(key))&&value.tenantId===tenantId&&typeof value.id==='string'&&uuid.test(value.id)&&typeof value.name==='string'&&value.type===type&&['cash','bank','mfs'].includes(type)&&(value.group==null||typeof value.group==='string');
}
export function paymentAccountType(method:string):'cash'|'bank'|'mfs'{return method==='cash'?'cash':['bKash','Nagad','Rocket'].includes(method)?'mfs':'bank';}
export function validSupplierPayment(value:unknown):value is SupplierPayment{
 if(!object(value)||Object.keys(value).length!==4||!Object.keys(value).every(key=>['accountId','amount','paymentMethod','note'].includes(key))||typeof value.accountId!=='string'||!uuid.test(value.accountId)||!supplierPaymentMethods.includes(value.paymentMethod as SupplierPayment['paymentMethod'])||typeof value.note!=='string'||value.note.length>2000)return false;
 try{return purchaseCents(value.amount)>BigInt(0);}catch{return false;}
}
export function supplierPaymentPayload(purchase:PurchaseDetail,account:PaymentAccount|null,amount:string,method:SupplierPayment['paymentMethod'],note:string):SupplierPayment{
 if(purchase.status!=='completed'||!account||account.type!==paymentAccountType(method)||account.tenantId!==purchase.tenantId)throw new Error('Choose an active account matching the payment method.');
 if(!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(amount))throw new Error('Enter a positive amount with at most two decimals.');
 const body={accountId:account.id,amount:Number(amount),paymentMethod:method,note:note.trim()};
 if(!validSupplierPayment(body)||purchaseCents(body.amount)>purchaseCents(Number(purchase.dueAmount)))throw new Error('Payment must be positive and cannot exceed outstanding due.');return body;
}
export type PurchasePaymentTransaction={id:string;txnId:string;accountId:string;amount:number|string;paymentMethod:string;flowType:'out';createdAt:string};
export function purchasePaymentTransactions(value:unknown):PurchasePaymentTransaction[]{
 if(!object(value)||!Array.isArray(value.transactions))throw new Error('Purchase payments could not be verified.');
 const seen=new Set<string>();for(const row of value.transactions){if(!object(row)||typeof row.id!=='string'||!uuid.test(row.id)||seen.has(row.id)||typeof row.txnId!=='string'||typeof row.accountId!=='string'||!uuid.test(row.accountId)||row.flowType!=='out'||!supplierPaymentMethods.includes(row.paymentMethod as SupplierPayment['paymentMethod'])||typeof row.createdAt!=='string'||!Number.isFinite(Date.parse(row.createdAt))||purchaseCents(Number(row.amount))<=BigInt(0))throw new Error('Purchase payments could not be verified.');seen.add(row.id);}return value.transactions as PurchasePaymentTransaction[];
}
export function validSupplierPaymentResult(value:unknown,before:PurchaseDetail,body:SupplierPayment):value is PurchaseDetail{
 if(!validPurchaseDetail(value,before.tenantId,before.branchId)||value.id!==before.id||value.supplierId!==before.supplierId||value.status!=='completed')return false;
 try{const previous=new Set(purchasePaymentTransactions(before).map(row=>row.id)),current=purchasePaymentTransactions(value),amount=purchaseCents(body.amount);
  return value.paymentStatus===(Number(value.dueAmount)===0?'paid':'partial')&&purchaseCents(Number(value.paidAmount))>=purchaseCents(Number(before.paidAmount))+amount&&purchaseCents(Number(value.dueAmount))<=purchaseCents(Number(before.dueAmount))-amount&&current.some(row=>!previous.has(row.id)&&row.accountId===body.accountId&&purchaseCents(Number(row.amount))===amount&&row.paymentMethod===body.paymentMethod);
 }catch{return false;}
}
