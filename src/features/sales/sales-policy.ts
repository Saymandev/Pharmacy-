export type ReturnLine = { id?: string; medicineId?: string | null; serviceId?: string | null; itemName: string; batchNumber?: string | null; quantity: unknown };
export type PreviousReturn = { id: string; saleId?: string; status: string; saleReturnItems?: ReturnLine[] };
export function finiteAmount(value: unknown): number | null {
 if(value===null||value===undefined||value==='')return null;
 if(typeof value!=='string'&&typeof value!=='number')return null;
 const number=Number(value);return Number.isFinite(number)?number:null;
}
export function duePaymentError(sale:{status:string;dueAmount:unknown},value:string,accountId:string){
 if(sale.status==='rejected')return 'Payments cannot be collected for a rejected sale.';
 const due=finiteAmount(sale.dueAmount);
 if(due===null||due<=0)return 'This invoice has no valid outstanding due. Refresh the invoice.';
 if(!/^\d+(?:\.\d{1,2})?$/.test(value.trim()))return 'Enter a valid payment amount with at most two decimal places.';
 const amount=Number(value);if(amount<0.01)return 'Payment must be at least 0.01.';
 if(Math.round(amount*100)>Math.round(due*100))return 'Payment cannot exceed the current outstanding due.';
 if(!accountId)return 'Choose a payment account.';
 return '';
}
export function returnItemKey(line:ReturnLine){return JSON.stringify([line.medicineId?'medicine':line.serviceId?'service':'name',line.medicineId??line.serviceId??line.itemName,line.batchNumber??'']);}
export function priorReturnQuantities(history:PreviousReturn[],excludeId?:string){
 const totals:Record<string,number>={};
 for(const row of history){
  if(row.id===excludeId||row.status==='rejected')continue;
  if(!Array.isArray(row.saleReturnItems))throw new Error('Return history is missing item details. Refresh before continuing.');
  for(const line of row.saleReturnItems??[]){const quantity=finiteAmount(line.quantity);if(quantity===null||quantity<0)throw new Error('Return history contains an invalid quantity. Refresh before continuing.');const key=returnItemKey(line);totals[key]=(totals[key]??0)+quantity;}
 }
 return totals;
}
export function returnQuantityError(original:ReturnLine[],requested:ReturnLine[],previous:Record<string,number>,matchLineIds=false){
 if(!requested.length)return 'Enter a return quantity for at least one sale line.';
 const sold:Record<string,number>={};const wanted:Record<string,number>={};
 for(const line of original){const quantity=finiteAmount(line.quantity);if(quantity===null||quantity<0)return 'The invoice contains an invalid sold quantity.';const key=returnItemKey(line);sold[key]=(sold[key]??0)+quantity;}
 for(const line of requested){
  const quantity=finiteAmount(line.quantity);if(quantity===null||quantity<=0)return 'Each selected return quantity must be greater than zero.';
  if(line.medicineId&&!Number.isSafeInteger(quantity))return 'Medicine returns require whole-number quantities.';
  if(!line.medicineId&&Math.abs(quantity*100-Math.round(quantity*100))>1e-7)return 'Return quantities can have at most two decimal places.';
  if(matchLineIds){const source=original.find(item=>item.id===line.id);if(!source||quantity>(finiteAmount(source.quantity)??0))return 'Return quantity exceeds its original invoice line.';}
  const key=returnItemKey(line);wanted[key]=(wanted[key]??0)+quantity;
 }
 for(const [key,quantity] of Object.entries(wanted))if(!(key in sold)||Math.round((quantity+(previous[key]??0))*100)>Math.round(sold[key]*100))return 'Requested return exceeds the sold quantity remaining after previous requests.';
 return '';
}
export function lineReturnLimit(line:ReturnLine,original:ReturnLine[],previous:Record<string,number>,quantities:Record<string,number>){
 const key=returnItemKey(line);const matching=original.filter(item=>returnItemKey(item)===key);
 const sold=matching.reduce((sum,item)=>sum+(finiteAmount(item.quantity)??0),0);
 const others=matching.filter(item=>item.id!==line.id).reduce((sum,item)=>sum+(item.id?quantities[item.id]??0:0),0);
 return Math.max(0,Math.min(finiteAmount(line.quantity)??0,sold-(previous[key]??0)-others));
}
export function saleFilterError(start:string,end:string,min:string,max:string){
 if(start&&end&&start>end)return 'Start date must be on or before end date.';
 for(const value of [min,max])if(value&&(finiteAmount(value)===null||Number(value)<0))return 'Amount filters must be valid values of zero or more.';
 if(min&&max&&Number(min)>Number(max))return 'Minimum amount cannot exceed maximum amount.';
 return '';
}

export function hasReturnHistoryList(value:unknown):boolean {
 for(let depth=0;depth<6;depth++){
  if(Array.isArray(value))return true;
  if(!value||typeof value!=="object")return false;
  const row=value as Record<string,unknown>;
  if("data" in row)value=row.data;
  else if("returns" in row)value=row.returns;
  else return false;
 }
 return false;
}
