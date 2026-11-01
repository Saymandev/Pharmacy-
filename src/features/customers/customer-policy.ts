export type CustomerInvoice={id:string;customerId?:string;branchId:string;status:string;type:string;dueAmount:unknown};
export function collectionAmount(value:string):number|null{if(!/^\d+(?:\.\d{1,2})?$/.test(value.trim()))return null;const n=Number(value);return Number.isFinite(n)&&n>0&&n<=99999999.99?n:null;}
export function invoiceCollectionError(invoice:CustomerInvoice|undefined,customerId:string,branchId:string,value:string){
 if(!invoice||invoice.customerId!==customerId||invoice.branchId!==branchId)return 'The invoice no longer matches this customer and branch. Refresh dues.';
 if(invoice.status!=='completed')return 'Only completed invoices can receive due collection.';
 const amount=collectionAmount(value),due=Number(invoice.dueAmount);
 if(amount===null)return 'Enter a positive amount with at most two decimal places.';
 if(invoice.dueAmount==null||!Number.isFinite(due)||Math.round(amount*100)>Math.round(due*100))return 'Payment exceeds the latest invoice due. Review the updated amounts.';
 return '';
}
export function autoCollectionError(invoices:CustomerInvoice[],customerId:string,branchId:string,value:string){
 const amount=collectionAmount(value);if(!branchId||amount===null)return 'Choose a branch and a positive amount with at most two decimal places.';
 const matching=invoices.filter(s=>s.customerId===customerId&&s.branchId===branchId&&s.type==='pos'&&s.status!=='rejected');
 if(matching.some(s=>s.dueAmount==null||!Number.isFinite(Number(s.dueAmount))))return 'Some invoice dues are unavailable. Refresh before collecting.';
 const due=matching.filter(s=>Number(s.dueAmount)>0);
 if(due.some(s=>s.status!=='completed'))return 'Auto-allocation is unavailable while non-completed POS dues exist.';
 const cents=due.reduce((sum,s)=>sum+Math.round(Number(s.dueAmount)*100),0);
 return Math.round(amount*100)>cents?'Payment exceeds the latest POS due. Review the updated amounts.':'';
}
