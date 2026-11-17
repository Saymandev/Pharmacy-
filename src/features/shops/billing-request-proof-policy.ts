export const proofMimes=['application/pdf','image/png','image/jpeg'] as const;
export const proofId=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const validProofFile=(v:{type:string;name:string;size:number})=>proofMimes.includes(v.type as typeof proofMimes[number])&&v.name.length>0&&v.name.length<=150&&Number.isSafeInteger(v.size)&&v.size>0&&v.size<=1048576;
export type RequestProof={id:string;requestId:string;mime:string;name:string;size:number;createdAt:string};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function validRequestProof(v:unknown,requestId:string):v is RequestProof{
 return object(v)&&Object.keys(v).length===6&&Object.keys(v).every(k=>['id','requestId','mime','name','size','createdAt'].includes(k))&&proofId(v.id)&&v.requestId===requestId&&typeof v.mime==='string'&&typeof v.name==='string'&&typeof v.size==='number'&&validProofFile({name:v.name,type:v.mime,size:v.size})&&typeof v.createdAt==='string'&&Number.isFinite(Date.parse(v.createdAt));
}
export function validRequestProofList(v:unknown,target:string,requestId:string):v is {targetTenantId:string;requestId:string;items:RequestProof[]}{
 return object(v)&&Object.keys(v).length===3&&v.targetTenantId===target&&v.requestId===requestId&&Array.isArray(v.items)&&v.items.length<=3&&v.items.every(i=>validRequestProof(i,requestId))&&new Set(v.items.map(i=>i.id)).size===v.items.length;
}
export function proofSignature(bytes:Uint8Array,mime:string){return mime==='application/pdf'&&new TextDecoder().decode(bytes.slice(0,5))==='%PDF-'||mime==='image/png'&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b)||mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;}
