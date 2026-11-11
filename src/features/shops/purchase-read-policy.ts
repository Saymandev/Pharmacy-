const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
function money(value:unknown){return (typeof value==='number'||typeof value==='string'&&/^\d+(\.\d+)?$/.test(value))&&Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=99999999.99;}
export type PurchaseRecord={id:string;tenantId:string;branchId:string;supplierId:string;poNumber:string;type:string;status:'pending'|'completed'|'rejected';paymentStatus:'paid'|'partial'|'due';totalPrice:number|string;discountAmount:number|string;paidAmount:number|string;dueAmount:number|string;createdAt:string;note?:string|null};
export type PurchaseItem={id:string;tenantId:string;purchaseId:string;medicineId:string;itemName:string;batchNumber:string;expiryDate:string;unit:string;quantity:number;price:number|string;totalPrice:number|string};
export type PurchaseDetail=PurchaseRecord&{purchaseItems:PurchaseItem[]};
export function validPurchaseRecord(value:unknown,tenantId:string,branchId:string):value is PurchaseRecord{
 return object(value)&&value.tenantId===tenantId&&value.branchId===branchId&&typeof value.id==='string'&&uuid.test(value.id)&&typeof value.supplierId==='string'&&uuid.test(value.supplierId)&&typeof value.poNumber==='string'&&value.type==='pharmacy'&&['pending','completed','rejected'].includes(String(value.status))&&['paid','partial','due'].includes(String(value.paymentStatus))&&['totalPrice','discountAmount','paidAmount','dueAmount'].every(key=>money(value[key]))&&typeof value.createdAt==='string'&&Number.isFinite(Date.parse(value.createdAt))&&(value.note==null||typeof value.note==='string');
}
export function validPurchaseDetail(value:unknown,tenantId:string,branchId:string):value is PurchaseDetail{
 if(!validPurchaseRecord(value,tenantId,branchId)||!('purchaseItems'in value)||!Array.isArray(value.purchaseItems)||!value.purchaseItems.length||value.purchaseItems.length>50)return false;
 const seen=new Set<string>();return value.purchaseItems.every(row=>{if(!object(row)||row.tenantId!==tenantId||row.purchaseId!==value.id||typeof row.id!=='string'||!uuid.test(row.id)||seen.has(row.id)||typeof row.medicineId!=='string'||!uuid.test(row.medicineId)||typeof row.itemName!=='string'||typeof row.batchNumber!=='string'||typeof row.unit!=='string'||!Number.isInteger(row.quantity)||Number(row.quantity)<1||Number(row.quantity)>2147483647||!money(row.price)||!money(row.totalPrice)||typeof row.expiryDate!=='string'||!Number.isFinite(Date.parse(row.expiryDate)))return false;seen.add(row.id);return true;});
}
export function validPurchaseStatusBody(value:unknown):boolean{
 return object(value)&&Object.keys(value).every(key=>['status','note'].includes(key))&&['completed','rejected'].includes(String(value.status))&&(!('note'in value)||typeof value.note==='string'&&value.note.trim().length<=2000);
}
