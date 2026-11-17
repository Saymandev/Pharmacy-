export type BillingHistoryKind='PAYMENTS'|'CREDITS';
export type BillingPayment={id:string;currency:'BDT';amountMinor:number;method:'BANK'|'CASH'|'MOBILE'|'GATEWAY';reference:string;receivedAt:string;createdAt:string;state:'PENDING'|'VERIFIED'|'REJECTED'|'REVERSED';allocatedMinor:number;refundedMinor:number;reservedMinor:number;availableMinor:number};
export const creditKinds=['CREDIT','SHOP_CREDIT','SHOP_CREDIT_REVERSE','CREDIT_USE','CREDIT_RETURN'] as const;
export type BillingCredit={id:string;kind:typeof creditKinds[number];currency:'BDT';amountMinor:number;invoiceNumber:string|null;createdAt:string};
export type BillingHistory={targetTenantId:string;availableShopCreditMinor:number}&({kind:'PAYMENTS';items:BillingPayment[]}|{kind:'CREDITS';items:BillingCredit[]});
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
const id=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const date=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const minor=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
export function validBillingHistory(v:unknown,target:string,kind:BillingHistoryKind):v is BillingHistory{
 if(!object(v)||!exact(v,['targetTenantId','kind','items','availableShopCreditMinor'])||v.targetTenantId!==target||v.kind!==kind||!minor(v.availableShopCreditMinor)||!Array.isArray(v.items)||v.items.length>21||new Set(v.items.map(i=>object(i)?i.id:null)).size!==v.items.length)return false;
 return v.items.every(i=>{
  if(!object(i)||!id(i.id)||i.currency!=='BDT'||!minor(i.amountMinor)||Number(i.amountMinor)<=0||!date(i.createdAt))return false;
  if(kind==='CREDITS')return exact(i,['id','kind','currency','amountMinor','invoiceNumber','createdAt'])&&creditKinds.includes(i.kind as BillingCredit['kind'])&&(i.invoiceNumber===null||typeof i.invoiceNumber==='string'&&i.invoiceNumber.length>0&&i.invoiceNumber.length<=150);
  if(!exact(i,['id','currency','amountMinor','method','reference','receivedAt','createdAt','state','allocatedMinor','refundedMinor','reservedMinor','availableMinor'])||!['BANK','CASH','MOBILE','GATEWAY'].includes(String(i.method))||typeof i.reference!=='string'||i.reference.length<1||i.reference.length>150||!date(i.receivedAt)||!['PENDING','VERIFIED','REJECTED','REVERSED'].includes(String(i.state))||!['allocatedMinor','refundedMinor','reservedMinor','availableMinor'].every(k=>minor(i[k])))return false;
  const used=Number(i.allocatedMinor)+Number(i.refundedMinor)+Number(i.reservedMinor);
  return Number.isSafeInteger(used)&&used<=Number(i.amountMinor)&&i.availableMinor===(i.state==='VERIFIED'?Number(i.amountMinor)-used:0);
 });
}
export const creditLabel=(kind:BillingCredit['kind'])=>({CREDIT:'Invoice credit',SHOP_CREDIT:'Credit added',SHOP_CREDIT_REVERSE:'Credit reversed',CREDIT_USE:'Credit used',CREDIT_RETURN:'Credit returned'}[kind]);
