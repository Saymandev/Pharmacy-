const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type StockDraft={batchNumber:string;expiryDate:string;quantity:string;unitPrice:string;mrp:string;unit:string;rackNumber:string;note:string;type:'increase'|'decrease'};
export const emptyStock:StockDraft={batchNumber:'',expiryDate:'',quantity:'1',unitPrice:'0',mrp:'0',unit:'Pcs',rackNumber:'',note:'',type:'increase'};
function quantity(value:string){if(!/^\d+$/.test(value)||Number(value)<1||Number(value)>2147483647)throw new Error('Quantity must be a positive whole number.');return Number(value);}
function price(value:string){if(!/^\d+(\.\d{1,2})?$/.test(value)||Number(value)>99999999.99)throw new Error('Prices must be non-negative amounts with at most two decimals.');return Number(value);}
export function openingStockPayload(medicineId:string,branchId:string,draft:StockDraft){
 if(!uuid.test(medicineId)||!uuid.test(branchId))throw new Error('Select a medicine and working branch.');
 if(!draft.batchNumber.trim()||draft.batchNumber.trim().length>100)throw new Error('Enter a batch number up to 100 characters.');
 const date=new Date(`${draft.expiryDate}T00:00:00.000Z`);if(!/^\d{4}-\d{2}-\d{2}$/.test(draft.expiryDate)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==draft.expiryDate)throw new Error('Enter a valid expiry date.');
 if(!draft.unit.trim()||draft.unit.trim().length>50||draft.rackNumber.trim().length>100||draft.note.trim().length>255)throw new Error('Check unit, rack and note lengths.');
 return {medicineId,branchId,batchNumber:draft.batchNumber.trim(),expiryDate:date.toISOString(),quantity:quantity(draft.quantity),unitPrice:price(draft.unitPrice),mrp:price(draft.mrp),unit:draft.unit.trim(),rackNumber:draft.rackNumber.trim(),note:draft.note.trim()};
}
export function adjustmentPayload(stockId:string,current:number,draft:StockDraft){
 if(!uuid.test(stockId)||!Number.isInteger(current)||current<0||current>2147483647)throw new Error('Reload stock before adjusting.');
 if(!['increase','decrease'].includes(draft.type))throw new Error('Choose increase or decrease.');
 const change=quantity(draft.quantity),result=current+(draft.type==='increase'?change:-change);
 if(result<0||result>2147483647)throw new Error('Adjustment would produce an invalid stock quantity.');
 if(!draft.note.trim()||draft.note.trim().length>255)throw new Error('Enter an adjustment reason up to 255 characters.');
 return {stockId,quantity:change,type:draft.type,note:draft.note.trim(),expectedQuantity:current};
}
export function transferPayload(stockId:string,sourceBranchId:string,destinationId:string,current:number,draft:StockDraft){
 if(!uuid.test(stockId)||!uuid.test(sourceBranchId)||!uuid.test(destinationId)||sourceBranchId===destinationId)throw new Error('Choose a different destination branch.');
 if(!Number.isInteger(current)||current<0||current>2147483647)throw new Error('Reload stock before transferring.');
 const change=quantity(draft.quantity);if(change>current)throw new Error('Transfer quantity exceeds the recorded source stock.');
 if(!draft.note.trim()||draft.note.trim().length>255)throw new Error('Enter a transfer reason up to 255 characters.');
 return {stockId,toBranchId:destinationId,quantity:change,note:draft.note.trim(),expectedQuantity:current};
}
