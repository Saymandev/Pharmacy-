import {purchaseCents} from './purchase-policy.ts';
import {validSupplierPayment,type SupplierPayment,supplierPaymentMethods} from './purchase-payment-policy.ts';
import type {SaleDetail} from './sales-policy.ts';
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const qty=(v:unknown)=>['string','number'].includes(typeof v)&&String(v).trim()!==''&&Number.isInteger(Number(v))&&Number(v)>=0&&Number(v)<=99999999;
function cents(v:unknown){if(!['number','string'].includes(typeof v)||!String(v).trim())throw new Error('Invalid money');return purchaseCents(Number(v));}
const amount=(v:unknown)=>{try{cents(v);return true;}catch{return false;}};
export type SaleReturnBody={saleId:string;note:string;items:{saleItemId:string;quantity:number}[]};
export type SaleAllowance={tenantId:string;branchId:string;saleId:string;customerId:string;isWalkIn:boolean;status:string;items:{saleItemId:string;itemName:string;unit:string;quantity:number|string;pendingQuantity:number|string;completedQuantity:number|string;remainingQuantity:number|string}[]};
export type SaleReturnRecord={id:string;tenantId:string;branchId:string;customerId:string;saleId:string;invoiceNumber:string;type:'pos';status:'pending'|'completed'|'rejected';totalPrice:number|string;dueReduction:number|string;advanceCredit:number|string;cashCredit:number|string;refundedAmount:number|string;createdAt:string;note:string|null};
export type SaleReturnDetail=SaleReturnRecord&{customer:SaleDetail['customer'];refundableCredit:number|string;saleReturnItems:{id:string;tenantId:string;branchId:string;saleReturnId:string;saleItemId:string;sourceSaleId:string;stockId:string;itemName:string;unit:string;quantity:number|string;totalPrice:number|string}[];transactions:{id:string;tenantId:string;branchId:string;saleReturnId:string;accountId:string;txnId:string;flowType:'out';paymentMethod:string;amount:number|string;createdAt:string}[]};
export function validSaleReturnBody(v:unknown):v is SaleReturnBody{
 if(!obj(v)||Object.keys(v).some(k=>!['saleId','note','items'].includes(k))||!uuid(v.saleId)||typeof v.note!=='string'||v.note.length>2000||!Array.isArray(v.items)||!v.items.length||v.items.length>50)return false;
 const seen=new Set();return v.items.every(i=>{if(!obj(i)||Object.keys(i).length!==2||!uuid(i.saleItemId)||seen.has(i.saleItemId)||typeof i.quantity!=='number'||!qty(i.quantity)||i.quantity<1)return false;seen.add(i.saleItemId);return true;});
}
export function validSaleReturnStatus(v:unknown):v is {status:'completed'|'rejected'}{return obj(v)&&Object.keys(v).length===1&&['completed','rejected'].includes(String(v.status));}
export function validSaleAllowance(v:unknown,sale:SaleDetail):v is SaleAllowance{
 if(!obj(v)||v.tenantId!==sale.tenantId||v.branchId!==sale.branchId||v.saleId!==sale.id||v.customerId!==sale.customerId||v.isWalkIn!==sale.customer.isWalkIn||!['completed','returned'].includes(String(v.status))||!Array.isArray(v.items)||v.items.length!==sale.saleItems.length)return false;
 const seen=new Set();return v.items.every(i=>{if(!obj(i)||!uuid(i.saleItemId)||seen.has(i.saleItemId))return false;const source=sale.saleItems.find(l=>l.id===i.saleItemId);if(!source||i.itemName!==source.itemName||i.unit!==source.unit||Number(i.quantity)!==Number(source.quantity)||!['quantity','pendingQuantity','completedQuantity','remainingQuantity'].every(k=>qty(i[k]))||Number(i.pendingQuantity)+Number(i.completedQuantity)+Number(i.remainingQuantity)!==Number(i.quantity))return false;seen.add(i.saleItemId);return true;});
}
export function saleReturnPayload(source:SaleAllowance,quantities:Record<string,string>,note:string):SaleReturnBody{
 const items=source.items.flatMap(i=>{const raw=(quantities[i.saleItemId]??'').trim();if(!raw||raw==='0')return [];if(!/^\d+$/.test(raw)||!qty(raw)||Number(raw)<1||Number(raw)>Number(i.remainingQuantity))throw new Error('Return quantity exceeds the available allowance.');return [{saleItemId:i.saleItemId,quantity:Number(raw)}];});
 const body={saleId:source.saleId,note:note.trim(),items};if(!validSaleReturnBody(body)||source.status!=='completed')throw new Error('Choose at least one available item to return.');return body;
}
export function validSaleReturnRecord(v:unknown,sale:SaleDetail):v is SaleReturnRecord{
 if(!obj(v)||!uuid(v.id)||v.tenantId!==sale.tenantId||v.branchId!==sale.branchId||v.saleId!==sale.id||v.customerId!==sale.customerId||v.type!=='pos'||typeof v.invoiceNumber!=='string'||!['pending','completed','rejected'].includes(String(v.status))||typeof v.createdAt!=='string'||!Number.isFinite(Date.parse(v.createdAt))||(v.note!=null&&typeof v.note!=='string')||!['totalPrice','dueReduction','advanceCredit','cashCredit','refundedAmount'].every(k=>amount(v[k])))return false;
 try{const credit=cents(v.advanceCredit)+cents(v.cashCredit);return cents(v.totalPrice)<=cents(sale.netPrice)&&cents(v.refundedAmount)<=cents(v.cashCredit)&&(v.status==='completed'?cents(v.dueReduction)+credit===cents(v.totalPrice):cents(v.dueReduction)+credit+cents(v.refundedAmount)===BigInt(0))&&(sale.customer.isWalkIn?cents(v.advanceCredit)===BigInt(0):cents(v.cashCredit)===BigInt(0));}catch{return false;}
}
export function validSaleReturnDetail(v:unknown,sale:SaleDetail):v is SaleReturnDetail{
 if(!validSaleReturnRecord(v,sale)||!('customer'in v)||!obj(v.customer)||v.customer.id!==sale.customerId||v.customer.tenantId!==sale.tenantId||v.customer.isWalkIn!==sale.customer.isWalkIn||typeof v.customer.name!=='string'||typeof v.customer.phone!=='string'||!('refundableCredit'in v)||!amount(v.refundableCredit)||!('saleReturnItems'in v)||!Array.isArray(v.saleReturnItems)||!v.saleReturnItems.length||v.saleReturnItems.length>50||!('transactions'in v)||!Array.isArray(v.transactions))return false;
 try{if(cents(v.refundableCredit)!==(v.status==='completed'?cents(v.cashCredit)-cents(v.refundedAmount):BigInt(0)))return false;
 const seen=new Set();for(const i of v.saleReturnItems){if(!obj(i)||!uuid(i.id)||!uuid(i.saleItemId)||seen.has(i.saleItemId)||i.tenantId!==sale.tenantId||i.branchId!==sale.branchId||i.saleReturnId!==v.id||i.sourceSaleId!==sale.id||!qty(i.quantity)||Number(i.quantity)<1||!amount(i.totalPrice))return false;const source=sale.saleItems.find(l=>l.id===i.saleItemId);if(!source||i.stockId!==source.stockId||i.itemName!==source.itemName||i.unit!==source.unit||Number(i.quantity)>Number(source.quantity))return false;seen.add(i.saleItemId);}
 const txids=new Set();let refunded=BigInt(0);for(const r of v.transactions){if(!obj(r)||!uuid(r.id)||txids.has(r.id)||r.tenantId!==sale.tenantId||r.branchId!==sale.branchId||r.saleReturnId!==v.id||!uuid(r.accountId)||typeof r.txnId!=='string'||r.flowType!=='out'||!supplierPaymentMethods.includes(r.paymentMethod as SupplierPayment['paymentMethod'])||!amount(r.amount)||cents(r.amount)<=BigInt(0)||typeof r.createdAt!=='string'||!Number.isFinite(Date.parse(r.createdAt)))return false;txids.add(r.id);refunded+=cents(r.amount);}return refunded===cents(v.refundedAmount);
 }catch{return false;}
}
export function validSaleRefundResult(v:unknown,before:SaleReturnDetail,sale:SaleDetail,body:SupplierPayment):v is SaleReturnDetail{
 if(!validSupplierPayment(body)||!validSaleReturnDetail(v,sale)||v.id!==before.id||v.status!=='completed'||cents(v.totalPrice)!==cents(before.totalPrice)||cents(v.cashCredit)!==cents(before.cashCredit))return false;
 const ids=new Set(before.transactions.map(r=>r.id));return cents(v.refundedAmount)>=cents(before.refundedAmount)+cents(body.amount)&&v.transactions.some(r=>!ids.has(r.id)&&r.accountId===body.accountId&&r.paymentMethod===body.paymentMethod&&cents(r.amount)===cents(body.amount));
}
