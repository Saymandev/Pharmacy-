export type PurchaseLineInput={medicineId:string;itemName:string;unit:string;price:number;salePrice:number;mrp:number;quantity:number;batchNumber:string;expiryDate:string};
export const roundPurchaseMoney=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;
const validMoney=(value:number)=>Number.isFinite(value)&&value>=0&&value<=99999999.99&&Math.abs(value*100-Math.round(value*100))<1e-6;
export function purchaseTotals(items:Pick<PurchaseLineInput,'price'|'quantity'>[],mode:'fixed'|'percent',value:number,paid:number){
 const subtotal=roundPurchaseMoney(items.reduce((sum,item)=>sum+(Number.isFinite(item.price*item.quantity)?item.price*item.quantity:0),0));
 const discount=roundPurchaseMoney(mode==='percent'?subtotal*Math.min(100,Math.max(0,value))/100:Math.min(subtotal,Math.max(0,value)));
 const total=roundPurchaseMoney(Math.max(0,subtotal-discount));
 return {subtotal,discount,total,paid:Number.isFinite(paid)?Math.max(0,paid):0,due:roundPurchaseMoney(Math.max(0,total-(Number.isFinite(paid)?Math.max(0,paid):0)))};
}
export function purchaseDraftError(items:PurchaseLineInput[],mode:'fixed'|'percent',discount:number,paid:number,account:string){
 if(!items.length)return 'Add at least one medicine.';
 const seen=new Set<string>();
 for(const item of items){
  if(!item.medicineId||!item.itemName.trim()||!item.unit.trim()||!item.batchNumber.trim())return 'Complete the medicine, unit and batch for every line.';
  if(!Number.isSafeInteger(item.quantity)||item.quantity<1||item.quantity>2147483647)return 'Purchase quantities must be positive whole numbers.';
  if(![item.price,item.salePrice,item.mrp].every(validMoney))return 'Item prices must be valid nonnegative amounts with at most two decimal places.';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(item.expiryDate)||!Number.isFinite(Date.parse(item.expiryDate))||new Date(item.expiryDate).toISOString().slice(0,10)!==item.expiryDate)return 'Enter a valid expiry date for every batch.';
  const key=JSON.stringify([item.medicineId,item.batchNumber.trim()]);if(seen.has(key))return 'Use one line per medicine and batch. Combine duplicate batch quantities.';seen.add(key);
 }
 const totals=purchaseTotals(items,mode,discount,paid);
 if(!validMoney(discount)||(mode==='percent'&&discount>100)||(mode==='fixed'&&discount>totals.subtotal))return 'Discount must be within the purchase subtotal or 0–100 percent.';
 if(!validMoney(paid)||paid>totals.total)return 'Supplier payment cannot exceed the purchase total and must use at most two decimal places.';
 if(paid>0&&!account)return 'Choose an account for the supplier payment.';
 return '';
}
export function purchasePaymentError(record:{status:string;dueAmount:unknown},value:string,account:string){
 if(record.status==='rejected')return 'Payments cannot be added to a rejected purchase.';
 const due=Number(record.dueAmount);
 if(record.dueAmount==null||!Number.isFinite(due)||due<=0)return 'This purchase has no valid outstanding due.';
 if(!/^\d+(?:\.\d{1,2})?$/.test(value.trim())||!validMoney(Number(value))||Number(value)<.01)return 'Enter a positive payment with at most two decimal places.';
 if(Math.round(Number(value)*100)>Math.round(due*100))return 'Payment exceeds the current supplier due.';
 if(!account)return 'Choose a payment account.';return '';
}
export function supplierFormError(form:{name:string;address:string;phone:string;email:string}){
 if(form.name.trim().length<3||form.address.trim().length<5||form.phone.trim().length<10)return 'Supplier name, address and phone do not meet the minimum lengths.';
 if(form.email.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))return 'Enter a valid email address or leave it blank.';
 return '';
}
