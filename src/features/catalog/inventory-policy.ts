export type StockSnapshot={id:string;medicineId:string;branchId:string;batchNumber:string;quantity:unknown;expiryDate:string};
export function inventoryNumber(value:unknown):number|null{if(typeof value!=='number'&&typeof value!=='string')return null;if(typeof value==='string'&&!/^-?\d+(?:\.\d+)?$/.test(value))return null;const result=Number(value);return Number.isFinite(result)?result:null;}
export function expiryDays(value:string,now=new Date()):number|null{
 const date=value?.slice(0,10);if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)return null;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 return Math.round((Date.parse(date)-Date.parse(today))/86400000);
}
export function stockFlags(stock:StockSnapshot,medicine:{reorderLevel?:unknown;stocks?:StockSnapshot[]}|undefined,now=new Date()){
 const days=expiryDays(stock.expiryDate,now);const quantity=inventoryNumber(stock.quantity);const threshold=inventoryNumber(medicine?.reorderLevel);
 let usable:number|null=null;
 if(threshold!==null&&threshold>=0&&Array.isArray(medicine?.stocks)){
  const branchStocks=medicine.stocks.filter(item=>item.branchId===stock.branchId).map(item=>item.id===stock.id?stock:item);
  if(!branchStocks.some(item=>item.id===stock.id))branchStocks.push(stock);
  if(branchStocks.every(item=>(inventoryNumber(item.quantity)??-1)>=0&&expiryDays(item.expiryDate,now)!==null))usable=branchStocks.reduce((sum,item)=>sum+((expiryDays(item.expiryDate,now)??-1)>=0?Math.max(0,inventoryNumber(item.quantity)??0):0),0);
 }
 const flags={out:quantity===0,expired:quantity!==null&&quantity>0&&days!==null&&days<0,expiring:quantity!==null&&quantity>0&&days!==null&&days>=0&&days<=90,low:usable!==null&&threshold!==null&&usable<=threshold};
 const state=flags.out?'out':flags.expired?'expired':days===null||quantity===null||quantity<0?'unknown':flags.expiring?'expiring':flags.low?'low':usable===null?'unknown':'normal';
 return {...flags,days,state,usable};
}
export function positiveQuantity(value:string){const quantity=inventoryNumber(value);return quantity!==null&&Number.isSafeInteger(quantity)&&quantity>0&&quantity<=2147483647?quantity:null;}
export function positivePrice(value:string){const price=inventoryNumber(value);return price!==null&&price>0&&price<=99999999.99&&/^\d+(?:\.\d{1,2})?$/.test(value)?price:null;}
export function stockOperationError(action:'opening'|'adjust'|'transfer',form:{medicineId:string;stockId:string;toBranchId:string;quantity:string;type:string;batchNumber:string;expiryDate:string;unitPrice:string;mrp:string;recoverAmount:string;accountId:string;note:string},scope:string,currentBranch:string,stock?:StockSnapshot|null,checkAvailable=true){
 if(!scope||scope!==currentBranch)return 'The active branch changed. Reopen the operation in the correct branch.';
 const quantity=positiveQuantity(form.quantity);if(quantity===null)return 'Enter a positive whole-number quantity within the supported stock range.';
 if(form.note.length>255)return 'Notes must be 255 characters or fewer.';
 if(action==='opening'){
  if(!form.medicineId||!form.batchNumber.trim())return 'Choose a medicine and enter a batch number.';
  if(expiryDays(form.expiryDate)===null)return 'Enter a valid expiry date.';
  if(positivePrice(form.unitPrice)===null||positivePrice(form.mrp)===null)return 'Unit cost and MRP must be positive amounts with at most two decimal places.';
  return '';
 }
 if(!stock||stock.id!==form.stockId||stock.branchId!==scope)return 'Choose a batch from the operation branch.';
 const available=inventoryNumber(stock.quantity);if(available===null||available<0)return 'The batch has an invalid available quantity. Refresh it first.';
 if(action==='transfer'){
  if(!form.toBranchId||form.toBranchId===scope)return 'Choose a destination branch different from the source.';
  if(checkAvailable&&quantity>available)return 'Transfer quantity exceeds the current available stock.';
 }else{
  if(!['increase','decrease'].includes(form.type))return 'Choose an adjustment type.';
  if(checkAvailable&&form.type==='decrease'&&quantity>available)return 'Decrease quantity exceeds the current available stock.';
  if(checkAvailable&&form.type==='increase'&&available+quantity>2147483647)return 'Resulting quantity exceeds the supported stock range.';
  const recovery=form.recoverAmount===''?0:inventoryNumber(form.recoverAmount);
  if(recovery===null||recovery<0||Math.abs(recovery*100-Math.round(recovery*100))>1e-7)return 'Enter a recovery amount of zero or more with at most two decimal places.';
  if(recovery>0&&(form.type!=='decrease'||!form.accountId))return 'Recovery requires a decrease and a recovery account.';
 }
 return '';
}
