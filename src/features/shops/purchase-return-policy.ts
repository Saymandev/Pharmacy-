import {purchaseCents} from './purchase-policy.ts';
import {type PurchaseDetail} from './purchase-read-policy.ts';
import {supplierPaymentMethods,type SupplierPayment} from './purchase-payment-policy.ts';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
function cents(value:unknown){if(!['number','string'].includes(typeof value)||typeof value==='string'&&!/^\d+(\.\d+)?$/.test(value))throw new Error('Invalid return amount.');return purchaseCents(Number(value));}
function integer(value:unknown){return ['number','string'].includes(typeof value)&&Number.isInteger(Number(value))&&Number(value)>=1&&Number(value)<=99999999;}
export type ReturnableItem={id:string;tenantId:string;purchaseId:string;medicineId:string;itemName:string;batchNumber:string;unit:string;quantity:number|string;availableStock:number;remainingAllowance:number;stockId:string|null};
export type Returnable={purchaseId:string;branchId:string;supplierId:string;items:ReturnableItem[]};
export type ReturnRecord={id:string;tenantId:string;branchId:string;supplierId:string;purchaseId:string;poNumber:string;status:'pending'|'completed'|'rejected';reason:string;note?:string|null;createdAt:string;totalPrice:number|string;dueReduction:number|string;supplierCredit:number|string;refundedAmount:number|string};
export type ReturnItem={id:string;tenantId:string;purchaseReturnId:string;sourcePurchaseId:string;purchaseItemId:string;medicineId:string;itemName:string;unit:string;batchNumber:string;quantity:number|string;totalPrice:number|string};
export type ReturnDetail=ReturnRecord&{refundableCredit:number|string;purchaseReturnItems:ReturnItem[];transactions:RefundTransaction[]};
export type ReturnBody={purchaseId:string;branchId:string;supplierId:string;reason:string;note:string;items:{purchaseItemId:string;quantity:number}[]};
export type RefundTransaction={id:string;txnId:string;accountId:string;amount:number|string;flowType:'in';paymentMethod:string;createdAt:string};
export function validReturnable(value:unknown,purchase:PurchaseDetail):value is Returnable{
 if(!object(value)||value.purchaseId!==purchase.id||value.branchId!==purchase.branchId||value.supplierId!==purchase.supplierId||!Array.isArray(value.items)||value.items.length!==purchase.purchaseItems.length)return false;
 const seen=new Set<string>();return value.items.every(row=>{if(!object(row)||typeof row.id!=='string'||seen.has(row.id)||row.tenantId!==purchase.tenantId||row.purchaseId!==purchase.id)return false;seen.add(row.id);const source=purchase.purchaseItems.find(item=>item.id===row.id);return !!source&&row.medicineId===source.medicineId&&row.batchNumber===source.batchNumber&&row.unit===source.unit&&row.itemName===source.itemName&&integer(row.quantity)&&Number(row.quantity)===Number(source.quantity)&&Number.isInteger(row.availableStock)&&Number(row.availableStock)>=0&&Number.isInteger(row.remainingAllowance)&&Number(row.remainingAllowance)>=0&&Number(row.remainingAllowance)<=Math.min(Number(row.quantity),Number(row.availableStock))&&(row.stockId===null||typeof row.stockId==='string'&&uuid.test(row.stockId));});
}
export function validReturnBody(value:unknown):value is ReturnBody{
 if(!object(value)||Object.keys(value).length!==6||!Object.keys(value).every(key=>['purchaseId','branchId','supplierId','reason','note','items'].includes(key))||!['purchaseId','branchId','supplierId'].every(key=>typeof value[key]==='string'&&uuid.test(value[key] as string))||typeof value.reason!=='string'||!value.reason.trim()||value.reason.length>500||typeof value.note!=='string'||value.note.length>2000||!Array.isArray(value.items)||!value.items.length||value.items.length>50)return false;
 const seen=new Set<string>();return value.items.every(row=>{if(!object(row)||Object.keys(row).length!==2||typeof row.purchaseItemId!=='string'||!uuid.test(row.purchaseItemId)||seen.has(row.purchaseItemId)||typeof row.quantity!=='number'||!integer(row.quantity))return false;seen.add(row.purchaseItemId);return true;});
}
export function returnPayload(source:Returnable,quantities:Record<string,string>,reason:string,note:string):ReturnBody{
 const items=source.items.flatMap(item=>{const raw=quantities[item.id]?.trim()??'';if(!raw||raw==='0')return [];if(!/^\d+$/.test(raw)||Number(raw)>item.remainingAllowance)throw new Error('Return quantity exceeds the current return allowance.');return [{purchaseItemId:item.id,quantity:Number(raw)}];});
 const body={purchaseId:source.purchaseId,branchId:source.branchId,supplierId:source.supplierId,reason:reason.trim(),note:note.trim(),items};if(!validReturnBody(body))throw new Error('Choose return quantities and enter a reason.');return body;
}
export function validReturnRecord(value:unknown,purchase:PurchaseDetail):value is ReturnRecord{
 if(!object(value)||value.tenantId!==purchase.tenantId||value.branchId!==purchase.branchId||value.purchaseId!==purchase.id||value.supplierId!==purchase.supplierId||typeof value.id!=='string'||!uuid.test(value.id)||typeof value.poNumber!=='string'||!['pending','completed','rejected'].includes(String(value.status))||typeof value.reason!=='string'||typeof value.createdAt!=='string'||!Number.isFinite(Date.parse(value.createdAt))||(value.note!=null&&typeof value.note!=='string'))return false;
 try{const total=cents(value.totalPrice),reduction=cents(value.dueReduction),credit=cents(value.supplierCredit),refunded=cents(value.refundedAmount);return refunded<=credit&&(value.status!=='completed'||total===reduction+credit);}catch{return false;}
}
export function validReturnDetail(value:unknown,purchase:PurchaseDetail):value is ReturnDetail{
 if(!validReturnRecord(value,purchase)||!('refundableCredit'in value)||!('purchaseReturnItems'in value)||!Array.isArray(value.purchaseReturnItems)||!value.purchaseReturnItems.length||value.purchaseReturnItems.length>50||!('transactions'in value)||!Array.isArray(value.transactions))return false;
 try{if(cents(value.refundableCredit)!==cents(value.supplierCredit)-cents(value.refundedAmount))return false;
  const seen=new Set<string>();for(const item of value.purchaseReturnItems){if(!object(item)||typeof item.id!=='string'||!uuid.test(item.id)||seen.has(String(item.purchaseItemId))||item.tenantId!==purchase.tenantId||item.purchaseReturnId!==value.id||item.sourcePurchaseId!==purchase.id||typeof item.purchaseItemId!=='string')return false;seen.add(item.purchaseItemId);const source=purchase.purchaseItems.find(row=>row.id===item.purchaseItemId);if(!source||item.medicineId!==source.medicineId||item.batchNumber!==source.batchNumber||item.unit!==source.unit||typeof item.itemName!=='string'||!integer(item.quantity)||Number(item.quantity)>Number(source.quantity))return false;cents(item.totalPrice);}
  const txIds=new Set<string>();for(const row of value.transactions){if(!object(row)||typeof row.id!=='string'||!uuid.test(row.id)||txIds.has(row.id)||typeof row.txnId!=='string'||typeof row.accountId!=='string'||!uuid.test(row.accountId)||row.flowType!=='in'||!supplierPaymentMethods.includes(row.paymentMethod as SupplierPayment['paymentMethod'])||typeof row.createdAt!=='string'||!Number.isFinite(Date.parse(row.createdAt))||cents(row.amount)<=BigInt(0))return false;txIds.add(row.id);}return true;
 }catch{return false;}
}
export function validRefundResult(value:unknown,before:ReturnDetail,purchase:PurchaseDetail,body:SupplierPayment):value is ReturnDetail{
 if(!validReturnDetail(value,purchase)||value.id!==before.id||value.status!=='completed')return false;
 try{const previous=new Set(before.transactions.map(row=>row.id)),amount=cents(body.amount);return cents(value.supplierCredit)===cents(before.supplierCredit)&&cents(value.dueReduction)===cents(before.dueReduction)&&cents(value.refundedAmount)>=cents(before.refundedAmount)+amount&&cents(value.refundableCredit)<=cents(before.refundableCredit)-amount&&value.transactions.some(row=>!previous.has(row.id)&&row.accountId===body.accountId&&row.paymentMethod===body.paymentMethod&&cents(row.amount)===amount);}catch{return false;}
}
