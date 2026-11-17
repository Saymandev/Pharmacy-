import {validMemberToken} from './team-invitation-policy.ts';
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export type RegistrationAction='start'|'review'|'complete';
export function validRegistrationBody(v:unknown,action:string):boolean{
 if(!obj(v)||!['start','review','complete'].includes(action))return false;
 const fields=['token','email','challengeId',...(action!=='start'?['code']:[]),...(action==='complete'?['username','fullName','password','confirm']:[])];
 return Object.keys(v).length===fields.length&&Object.keys(v).every(k=>fields.includes(k))&&validMemberToken(v.token)&&typeof v.email==='string'&&v.email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)&&uuid(v.challengeId)&&(action==='start'||typeof v.code==='string'&&/^[0-9]{6}$/.test(v.code))&&(action!=='complete'||typeof v.username==='string'&&/^[a-z][a-z0-9_.-]{2,39}$/.test(v.username)&&typeof v.fullName==='string'&&v.fullName.trim().length>0&&v.fullName.length<=100&&typeof v.password==='string'&&v.password.length>=12&&new TextEncoder().encode(v.password).byteLength<=72&&v.confirm===true);
}
export function validRegistrationSent(v:unknown,challengeId:string):v is {challengeId:string;expiresAt:string;status:'CODE_SENT'}{return obj(v)&&Object.keys(v).length===3&&v.challengeId===challengeId&&v.status==='CODE_SENT'&&typeof v.expiresAt==='string'&&Number.isFinite(Date.parse(v.expiresAt));}
export function validRegistered(v:unknown,username:string):boolean{return obj(v)&&Object.keys(v).length===3&&v.status==='ACCOUNT_CREATED'&&v.username===username&&v.requiresSignIn===true;}
