import {posSaleItems,posTotals,validPosFields,validPosCustomer,type PosBody,type PosLine,type PosCustomer} from './tenant-pos-policy.ts';
import {validSaleDetail,type SaleDetail} from './sales-policy.ts';
export type PosDraftBody=Omit<PosBody,'status'|'payments'|'advanceAmount'>&{status:'pending';payments:never[];advanceAmount:0};
export function validPosDraftBody(v:unknown):v is PosDraftBody{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;const row=v as Record<string,unknown>;
 if(Object.keys(row).length!==('customerId'in row?10:9)||!Object.keys(row).every(k=>['branchId','customerId','type','status','discountAmount','taxPercentage','note','advanceAmount','saleItems','payments'].includes(k)))return false;
 return validPosFields(row,'pending');
}
export function buildPosDraft(tenantId:string,branchId:string,lines:PosLine[],discount:number,taxPercentage:number,note:string,customer:PosCustomer|null):PosDraftBody{
 if(customer&&(!validPosCustomer(customer,tenantId)||customer.isWalkIn))throw new Error('Customer could not be verified.');
 if(lines.some(l=>l.medicine.tenantId!==tenantId||l.stock.tenantId!==tenantId))throw new Error('Draft scope could not be verified.');
 const saleItems=posSaleItems(branchId,lines);posTotals(saleItems,discount,taxPercentage);const body:PosDraftBody={branchId,...(customer?{customerId:customer.id}:{}),type:'pos',status:'pending',discountAmount:discount,taxPercentage,note:note.trim(),advanceAmount:0,payments:[],saleItems};if(!validPosDraftBody(body))throw new Error('Check the draft medicines, quantities and totals.');return body;
}
export function validPosDraftResult(v:unknown,tenantId:string,userId:string,body:PosDraftBody):v is SaleDetail{
 if(!validSaleDetail(v,tenantId,body.branchId)||v.status!=='pending'||!('userId'in v)||v.userId!==userId||body.customerId&&v.customerId!==body.customerId||Number(v.paidAmount)!==0||v.transactions.length||Number(v.advanceApplied)!==0||Number(v.returnTotal)!==0||v.saleItems.length!==body.saleItems.length||new Set(v.saleItems.map(l=>l.stockId)).size!==body.saleItems.length)return false;
 const totals=posTotals(body.saleItems,body.discountAmount,body.taxPercentage);return Number(v.totalPrice)===totals.subtotal&&Number(v.discountAmount)===totals.discount&&Number(v.taxAmount)===totals.tax&&Number(v.netPrice)===totals.total&&Number(v.dueAmount)===totals.total&&v.saleItems.every(l=>body.saleItems.some(s=>s.stockId===l.stockId&&s.quantity===Number(l.quantity)&&s.price===Number(l.price)&&Number(l.discountAmount)===0));
}
