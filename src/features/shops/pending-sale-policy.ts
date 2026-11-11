import {purchaseCents} from './purchase-policy.ts';
import {validSupplierPayment,type SupplierPayment} from './purchase-payment-policy.ts';
import {validSaleDetail,type SaleDetail} from './sales-policy.ts';
export type PendingSaleBody={status:'completed'|'rejected';payments:SupplierPayment[];advanceAmount:number};
export function validPendingSaleBody(v:unknown):v is PendingSaleBody{
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==3||!Object.keys(v).every(k=>['status','payments','advanceAmount'].includes(k)))return false;
 const r=v as Record<string,unknown>;try{return ['completed','rejected'].includes(String(r.status))&&Array.isArray(r.payments)&&r.payments.length<=10&&r.payments.every(validSupplierPayment)&&purchaseCents(r.advanceAmount)>=BigInt(0)&&(r.status!=='rejected'||r.payments.length===0&&r.advanceAmount===0);}catch{return false;}
}
export function validPendingSaleResult(v:unknown,before:SaleDetail,body:PendingSaleBody):v is SaleDetail{
 if(before.status!=='pending'||Number(before.paidAmount)!==0||before.transactions.length||!validPendingSaleBody(body)||!validSaleDetail(v,before.tenantId,before.branchId)||v.id!==before.id||v.customerId!==before.customerId||v.createdAt!==before.createdAt||v.status!==body.status||Number(v.netPrice)!==Number(before.netPrice)||Number(v.returnTotal)!==0||Number(v.returnDueReduction)!==0||v.saleItems.length!==before.saleItems.length||body.status==='rejected'&&v.transactions.length!==0)return false;
 if(!v.saleItems.every(l=>before.saleItems.some(b=>b.id===l.id&&b.stockId===l.stockId&&Number(b.quantity)===Number(l.quantity)&&Number(b.price)===Number(l.price)&&Number(b.totalPrice)===Number(l.totalPrice))))return false;
 const paid=body.payments.reduce((n,p)=>n+purchaseCents(p.amount),purchaseCents(body.advanceAmount)),due=purchaseCents(Number(before.netPrice))-paid;
 return due>=BigInt(0)&&purchaseCents(Number(v.paidAmount))===paid&&purchaseCents(Number(v.dueAmount))===due&&Number(v.advanceApplied)===body.advanceAmount&&(body.status!=='completed'||!before.customer.isWalkIn||due===BigInt(0)&&body.advanceAmount===0)&&body.payments.every(p=>v.transactions.some(t=>t.accountId===p.accountId&&t.paymentMethod===p.paymentMethod&&Number(t.amount)===p.amount));
}
