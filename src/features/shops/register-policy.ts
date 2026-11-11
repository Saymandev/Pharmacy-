export type RegisterSession={id:string;tenantId:string;branchId:string;userId:string;status:'open'|'closed';openingBalance:string|number;closingBalance:string|number;actualBalance:string|number|null;difference:string|number|null;openingNote:string|null;closingNote:string|null;openedAt:string;closedAt:string};
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const cash=(v:unknown,negative=false)=>typeof v==='number'||typeof v==='string'&&v.trim()!==''?Number.isFinite(Number(v))&&Number(v)>=(negative?-99999999.99:0)&&Number(v)<=99999999.99&&Math.abs(Number(v)*100-Math.round(Number(v)*100))<.00001:false;
export function validRegister(value:unknown,tenantId:string,branchId:string,userId:string):value is RegisterSession{
 if(!value||typeof value!=='object')return false;const r=value as Record<string,unknown>;
 return uuid(r.id)&&r.tenantId===tenantId&&r.branchId===branchId&&r.userId===userId&&['open','closed'].includes(String(r.status))&&cash(r.openingBalance)&&cash(r.closingBalance)&&typeof r.openedAt==='string'&&Number.isFinite(Date.parse(r.openedAt))&&['openingNote','closingNote'].every(k=>r[k]===null||typeof r[k]==='string')&&(r.status==='open'||cash(r.actualBalance)&&cash(r.difference,true)&&typeof r.closedAt==='string'&&Number.isFinite(Date.parse(r.closedAt)));
}
export function validRegisterBody(value:unknown,closing=false):boolean{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;const r=value as Record<string,unknown>,note=closing?'closingNote':'openingNote';
 return uuid(r.branchId)&&Object.keys(r).every(k=>(closing?['branchId','expectedBalance','actualBalance','closingNote']:['branchId','openingBalance','openingNote']).includes(k))&&(closing?typeof r.expectedBalance==='number'&&typeof r.actualBalance==='number'&&cash(r.expectedBalance)&&cash(r.actualBalance):typeof r.openingBalance==='number'&&cash(r.openingBalance))&&(!(note in r)||typeof r[note]==='string'&&(r[note] as string).trim().length<=2000)&&(!closing||Number(r.actualBalance)===Number(r.expectedBalance)||typeof r.closingNote==='string'&&!!r.closingNote.trim());
}
