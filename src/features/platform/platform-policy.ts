import {validCatalogPage,type CatalogMeta} from '../shops/catalog-contract.ts';
export const platformCaps=['platform:shops:read','platform:shops:suspend','platform:shops:resume','platform:audit:read'] as const;
export type PlatformSession={operatorId:string;userId:string;capabilities:string[]};
export type PlatformShop={id:string;name:string;slug:string;status:'PROVISIONING'|'ACTIVE'|'SUSPENDED'|'ARCHIVED';isolationReady:boolean;createdAt:string;updatedAt:string};
export type PlatformAudit={id:string;operatorId:string;targetTenantId:string;action:'SUSPEND'|'RESUME';reason:string;beforeStatus:string;afterStatus:string;createdAt:string};
export type PlatformCommand={status:'ACTIVE'|'SUSPENDED';expectedUpdatedAt:string;reason:string};
export type PlatformPage<T>={data:T[];pagination:CatalogMeta};
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(v);
const date=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v));
export function validPlatformSession(v:unknown,userId:string):v is PlatformSession{return obj(v)&&id(v.operatorId)&&v.userId===userId&&Array.isArray(v.capabilities)&&new Set(v.capabilities).size===v.capabilities.length&&v.capabilities.every(c=>platformCaps.includes(c));}
export function validPlatformShop(v:unknown):v is PlatformShop{return obj(v)&&Object.keys(v).every(k=>['id','name','slug','status','isolationReady','createdAt','updatedAt'].includes(k))&&id(v.id)&&typeof v.name==='string'&&!!v.name.trim()&&typeof v.slug==='string'&&['PROVISIONING','ACTIVE','SUSPENDED','ARCHIVED'].includes(String(v.status))&&typeof v.isolationReady==='boolean'&&date(v.createdAt)&&date(v.updatedAt);}
export function validPlatformCommand(v:unknown):v is PlatformCommand{return obj(v)&&Object.keys(v).length===3&&['ACTIVE','SUSPENDED'].includes(String(v.status))&&date(v.expectedUpdatedAt)&&typeof v.reason==='string'&&v.reason.trim().length>=5&&v.reason.length<=1000;}
export function validPlatformAudit(v:unknown,target?:string):v is PlatformAudit{return obj(v)&&Object.keys(v).every(k=>['id','operatorId','targetTenantId','action','reason','beforeStatus','afterStatus','createdAt'].includes(k))&&id(v.id)&&id(v.operatorId)&&id(v.targetTenantId)&&(!target||v.targetTenantId===target)&&typeof v.reason==='string'&&v.reason.length>=5&&v.reason.length<=1000&&date(v.createdAt)&&(v.action==='SUSPEND'?v.beforeStatus==='ACTIVE'&&v.afterStatus==='SUSPENDED':v.action==='RESUME'&&v.beforeStatus==='SUSPENDED'&&v.afterStatus==='ACTIVE');}
export function validPlatformPage<T>(v:unknown,page:number,validate:(row:unknown)=>row is T):v is PlatformPage<T>{return obj(v)&&Array.isArray(v.data)&&validCatalogPage({data:v.data,meta:v.pagination},page,validate);}
