export type ReceiptMoney=number|null;
export type ReceiptPayment={method:string;account?:string;amount:ReceiptMoney;date?:string;reference?:string};
export type ReceiptDocument={invoice:string;date:string;status:string;branch:string;branchAddress?:string;branchPhone?:string;branchEmail?:string;cashier?:string;customer:{id?:string;name:string;nameBangla?:string;phone?:string};items:{name:string;description?:string;unit:string;quantity:ReceiptMoney;price:ReceiptMoney;discount:ReceiptMoney;total:ReceiptMoney;batch?:string}[];subtotal:ReceiptMoney;itemDiscount:ReceiptMoney;saleDiscount:ReceiptMoney;taxAmount:ReceiptMoney;taxPercent?:ReceiptMoney;total:ReceiptMoney;paid:ReceiptMoney;due:ReceiptMoney;payments:ReceiptPayment[];refunds?:ReceiptPayment[];tendered?:ReceiptMoney;change?:ReceiptMoney;reprint?:boolean};
type MoneyInput=number|string|null|undefined;
export type SavedReceiptSale={id:string;invoiceNumber:string;status:string;createdAt:string;createdBy?:string;cashierName?:string;branchId?:string;branch?:{name:string;address?:string;phone?:string;email?:string};customer?:{name:string;nameBangla?:string;phone?:string};totalPrice:MoneyInput;netPrice:MoneyInput;paidAmount:MoneyInput;dueAmount:MoneyInput;discountAmount:MoneyInput;taxAmount:MoneyInput;taxPercentage?:MoneyInput;saleItems:{id:string;itemName:string;itemDescription?:string|null;unit:string;price:MoneyInput;quantity:MoneyInput;totalPrice?:MoneyInput;discountAmount?:MoneyInput;batchNumber?:string|null}[];transactions?:{id:string;txnId?:string;flowType:string;txnType?:string;amount:MoneyInput;paymentMethod?:string|null;createdAt?:string;account?:{name:string}}[]};
export function receiptNumber(value:unknown):ReceiptMoney{if(value==null||typeof value!=='string'&&typeof value!=='number'||String(value).trim()==='')return null;const amount=Number(value);return Number.isFinite(amount)&&amount>=0?amount:null;}
export function receiptLineTotal(item:{totalPrice?:MoneyInput;price:MoneyInput;quantity:MoneyInput;discountAmount?:MoneyInput}):ReceiptMoney{const saved=receiptNumber(item.totalPrice);if(saved!==null)return saved;const price=receiptNumber(item.price),quantity=receiptNumber(item.quantity),discount=item.discountAmount==null?0:receiptNumber(item.discountAmount);return price===null||quantity===null||discount===null?null:Math.max(0,Math.round((price*quantity-discount)*100)/100);}
export function savedReceipt(sale:SavedReceiptSale):ReceiptDocument{
 const items=(sale.saleItems||[]).map(item=>({name:item.itemName,description:item.itemDescription||undefined,unit:item.unit,quantity:receiptNumber(item.quantity),price:receiptNumber(item.price),discount:item.discountAmount==null?0:receiptNumber(item.discountAmount),total:receiptLineTotal(item),batch:item.batchNumber||undefined}));
 const seen=new Set<string>();const payments:ReceiptPayment[]=[],refunds:ReceiptPayment[]=[];
 for(const tx of sale.transactions||[]){if(seen.has(tx.id))continue;seen.add(tx.id);const entry={method:tx.paymentMethod||'Method unavailable',account:tx.account?.name,amount:receiptNumber(tx.amount),date:tx.createdAt,reference:tx.txnId};if(tx.flowType==='in'&&(!tx.txnType||tx.txnType==='sale'))payments.push(entry);else if(tx.flowType==='out'&&tx.txnType==='sale-return')refunds.push(entry);}
 return {invoice:sale.invoiceNumber||sale.id,date:sale.createdAt,status:sale.status,branch:sale.branch?.name||'Pharmacy',branchAddress:sale.branch?.address,branchPhone:sale.branch?.phone,branchEmail:sale.branch?.email,cashier:sale.cashierName,customer:sale.customer||{name:'Customer'},items,subtotal:receiptNumber(sale.totalPrice),itemDiscount:items.some(i=>i.discount===null)?null:items.reduce((sum,item)=>sum+Math.round((item.discount||0)*100),0)/100,saleDiscount:receiptNumber(sale.discountAmount),taxAmount:receiptNumber(sale.taxAmount),taxPercent:receiptNumber(sale.taxPercentage),total:receiptNumber(sale.netPrice),paid:receiptNumber(sale.paidAmount),due:receiptNumber(sale.dueAmount),payments,refunds,reprint:true};
}
export function consistentTender(receipt:Pick<ReceiptDocument,'paid'|'payments'|'tendered'|'change'|'reprint'>){
 if(receipt.reprint)return false;
 if(receipt.paid===null||receipt.tendered==null||receipt.change==null||receipt.payments.some(p=>p.amount===null))return false;
 const paid=Math.round(receipt.paid*100),payments=receipt.payments.reduce((sum,p)=>sum+Math.round(p.amount!*100),0);
 return paid===payments&&Math.round(receipt.tendered*100)-paid===Math.round(receipt.change*100);
}

/** A debt indicator follows known saved balances, never guesses missing values. */
export function receiptSettlement(receipt: Pick<ReceiptDocument, 'status' | 'paid' | 'due'>): 'paid' | 'partial' | 'due' | 'pending' | 'unknown' {
 if(receipt.status==='pending')return 'pending';
 if(receipt.due===null||!Number.isFinite(receipt.due)||receipt.due<0)return 'unknown';
 if(receipt.due>0)return receipt.paid!==null&&receipt.paid>0?'partial':'due';
 return 'paid';
}
