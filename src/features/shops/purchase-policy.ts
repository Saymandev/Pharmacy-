const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const limit=BigInt(9999999999);
export type PurchaseLine={medicineId:string;unit:string;price:number;salePrice:number;mrp:number;quantity:number;batchNumber:string;expiryDate:string;rackNumber:string;discountAmount:number};
export type PurchaseBody={branchId:string;supplierId:string;type:'pharmacy';status:'pending'|'completed';discountAmount:number;payments:never[];note:string;purchaseItems:PurchaseLine[]};
function object(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function keys(value:Record<string,unknown>,allowed:string[]){return Object.keys(value).length===allowed.length&&Object.keys(value).every(key=>allowed.includes(key));}
function text(value:unknown,max:number,required=false):value is string{return typeof value==='string'&&value.length<=max&&(!required||!!value.trim());}
export function purchaseCents(value:unknown):bigint{
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>99999999.99||Math.abs(value*100-Math.round(value*100))>0.00001)throw new Error('Use non-negative prices with at most two decimals.');
 return BigInt(Math.round(value*100));
}
export function purchaseTotals(body:PurchaseBody){
 let subtotal=BigInt(0);
 for(const line of body.purchaseItems){const gross=purchaseCents(line.price)*BigInt(line.quantity),discount=purchaseCents(line.discountAmount);if(gross>limit||discount>gross)throw new Error('Line discount or amount is outside the supported range.');subtotal+=gross-discount;}
 const discount=purchaseCents(body.discountAmount);if(subtotal>limit||discount>=subtotal)throw new Error('Purchase net amount must be positive and within the supported range.');
 return {subtotal:Number(subtotal)/100,discount:Number(discount)/100,net:Number(subtotal-discount)/100};
}
export function validPurchaseBody(value:unknown):value is PurchaseBody{
 if(!object(value)||!keys(value,['branchId','supplierId','type','status','discountAmount','payments','note','purchaseItems'])||typeof value.branchId!=='string'||!uuid.test(value.branchId)||typeof value.supplierId!=='string'||!uuid.test(value.supplierId)||value.type!=='pharmacy'||!['pending','completed'].includes(String(value.status))||!text(value.note,2000)||!Array.isArray(value.payments)||value.payments.length||!Array.isArray(value.purchaseItems)||!value.purchaseItems.length||value.purchaseItems.length>50)return false;
 const tuples=new Set<string>();try{for(const line of value.purchaseItems){
  if(!object(line)||!keys(line,['medicineId','unit','price','salePrice','mrp','quantity','batchNumber','expiryDate','rackNumber','discountAmount'])||typeof line.medicineId!=='string'||!uuid.test(line.medicineId)||!text(line.unit,50,true)||!text(line.batchNumber,100,true)||!text(line.rackNumber,100)||!Number.isInteger(line.quantity)||Number(line.quantity)<1||Number(line.quantity)>99999999||typeof line.expiryDate!=='string')return false;
  const date=new Date(line.expiryDate);if(!Number.isFinite(date.getTime())||date.toISOString()!==line.expiryDate||!line.expiryDate.endsWith('T00:00:00.000Z'))return false;
  for(const field of ['price','salePrice','mrp','discountAmount'])purchaseCents(line[field]);
  const tuple=JSON.stringify([line.medicineId,line.batchNumber.trim()]);if(tuples.has(tuple))return false;tuples.add(tuple);
 }purchaseTotals(value as PurchaseBody);}catch{return false;}return true;
}
export function validPurchaseResult(value:unknown,tenantId:string,body:PurchaseBody):boolean{
 if(!object(value)||value.tenantId!==tenantId||value.branchId!==body.branchId||value.supplierId!==body.supplierId||value.status!==body.status||typeof value.id!=='string'||!uuid.test(value.id)||typeof value.poNumber!=='string'||!Array.isArray(value.purchaseItems)||value.purchaseItems.length!==body.purchaseItems.length)return false;
 const total=purchaseTotals(body);if(Number(value.totalPrice)!==total.subtotal||Number(value.discountAmount)!==total.discount||Number(value.dueAmount)!==total.net||Number(value.paidAmount)!==0||value.paymentStatus!=='due')return false;
 const seen=new Set<string>();return value.purchaseItems.every(row=>{if(!object(row)||row.tenantId!==tenantId||row.purchaseId!==value.id)return false;const tuple=JSON.stringify([row.medicineId,row.batchNumber]);if(seen.has(tuple))return false;seen.add(tuple);const line=body.purchaseItems.find(item=>item.medicineId===row.medicineId&&item.batchNumber===row.batchNumber);return !!line&&['number','string'].includes(typeof row.quantity)&&Number(row.quantity)===line.quantity&&row.unit===line.unit&&Number(row.price)===line.price&&Number(row.salePrice)===line.salePrice&&Number(row.mrp)===line.mrp&&Number(row.discountAmount)===line.discountAmount&&typeof row.expiryDate==='string'&&new Date(row.expiryDate).getTime()===new Date(line.expiryDate).getTime();});
}
