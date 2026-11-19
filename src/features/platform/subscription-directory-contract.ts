import {validPlatformPage,type PlatformPage} from './platform-policy.ts';
export const subscriptionDirectoryStates=['UNASSIGNED','SCHEDULED','TRIALING','ACTIVE','PENDING_PAYMENT','GRACE','EXPIRED','CANCELED'] as const;
export type DirectoryState=typeof subscriptionDirectoryStates[number];
export const subscriptionStateLabels:Record<DirectoryState,string>={UNASSIGNED:'No subscription',SCHEDULED:'Scheduled',TRIALING:'Trial',ACTIVE:'Active',PENDING_PAYMENT:'Payment pending',GRACE:'Grace period',EXPIRED:'Expired',CANCELED:'Canceled'};
export type SubscriptionDirectoryRow={shop:{id:string;name:string;slug:string;status:'PROVISIONING'|'ACTIVE'|'SUSPENDED'|'ARCHIVED'};state:DirectoryState;subscription:null|{id:string;planName:string;price:string;currency:'BDT';termKind:'MONTHLY'|'ANNUAL'|'FIXED_DAYS'|'LIFETIME';periodStart:string;periodEnd:string|null;trialEnd:string|null;graceEnd:string|null;paidThrough:string|null;canceledAt:string|null;cancelAtEnd:boolean;scheduledChange:boolean}};
export type SubscriptionDirectoryPage=PlatformPage<SubscriptionDirectoryRow>&{asOf:string};
export type SubscriptionDirectoryQuery={page:number;search:string;state:DirectoryState|'';shopStatus:SubscriptionDirectoryRow['shop']['status']|'';endingIn:''|'7'|'30';sort:'renewal'|'shop'};
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:Record<string,unknown>,allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k))&&allowed.every(k=>k in v);
const id=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(v);
const date=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v));
export function validSubscriptionDirectoryRow(v:unknown):v is SubscriptionDirectoryRow{
 if(!obj(v)||!keys(v,['shop','state','subscription'])||!obj(v.shop)||!keys(v.shop,['id','name','slug','status'])||!id(v.shop.id)||typeof v.shop.name!=='string'||!v.shop.name.trim()||typeof v.shop.slug!=='string'||!['PROVISIONING','ACTIVE','SUSPENDED','ARCHIVED'].includes(String(v.shop.status))||!subscriptionDirectoryStates.includes(v.state as DirectoryState))return false;
 if(v.state==='UNASSIGNED')return v.subscription===null;
 const s=v.subscription;if(!obj(s)||!keys(s,['id','planName','price','currency','termKind','periodStart','periodEnd','trialEnd','graceEnd','paidThrough','canceledAt','cancelAtEnd','scheduledChange']))return false;
 return id(s.id)&&typeof s.planName==='string'&&!!s.planName.trim()&&typeof s.price==='string'&&/^(0|[1-9][0-9]{0,7})(\.[0-9]{1,2})?$/.test(s.price)&&s.currency==='BDT'&&['MONTHLY','ANNUAL','FIXED_DAYS','LIFETIME'].includes(String(s.termKind))&&date(s.periodStart)&&['periodEnd','trialEnd','graceEnd','paidThrough','canceledAt'].every(k=>s[k]===null||date(s[k]))&&typeof s.cancelAtEnd==='boolean'&&typeof s.scheduledChange==='boolean'&&(s.termKind!=='LIFETIME'||s.periodEnd===null);
}
export function validSubscriptionDirectoryPage(v:unknown,page:number):v is SubscriptionDirectoryPage{return obj(v)&&keys(v,['asOf','data','pagination'])&&date(v.asOf)&&validPlatformPage(v,page,validSubscriptionDirectoryRow)&&new Set(v.data.map(row=>row.shop.id)).size===v.data.length;}
export function subscriptionDirectorySearch(q:SubscriptionDirectoryQuery){return new URLSearchParams({page:String(q.page),limit:'20',search:q.search,sort:q.sort,...(q.state?{state:q.state}:{}),...(q.shopStatus?{shopStatus:q.shopStatus}:{}),...(q.endingIn?{endingIn:q.endingIn}:{})}).toString();}
