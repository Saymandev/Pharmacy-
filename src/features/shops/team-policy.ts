const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const id=(v:unknown)=>typeof v==='string'&&/^[0-9a-f-]{36}$/i.test(v);
const date=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v));
const keys=(v:unknown,max=500):v is string[]=>Array.isArray(v)&&v.length<=max&&v.every(k=>typeof k==='string'&&k.length>0&&k.length<=150&&k!=='*'&&!k.startsWith('platform:'));
export type TeamRole={id:string;tenantId:string;name:string;description:string|null;updatedAt:string;protected:boolean;canAssign:boolean;assignedCount:number;permissions:string[]};
export type TeamCatalog={targetTenantId:string;capabilities:string[];roles:TeamRole[];branches:{id:string;name:string}[];permissions:{key:string;module:string;action:string}[]};
export type TeamMember={id:string;tenantId:string;userId:string;username:string;fullName:string;identityActive:boolean;roleId:string;roleName:string;status:'ACTIVE'|'SUSPENDED'|'REVOKED'|'INVITED';allBranches:boolean;branchIds:string[];homeBranchId:string|null;updatedAt:string;invitedUntil:string|null;protected:boolean;canManage:boolean};
export type TeamPage={targetTenantId:string;items:TeamMember[];page:number;pageSize:20;totalItems:number};
export type TeamKind='role.create'|'role.update'|'role.delete'|'member.access'|'member.status';
export function validTeamReceipt(v:unknown,tenant:string,kind:TeamKind,expectedId:string|null,expectedStatus?:string):boolean{
 if(!object(v)||!id(v.id)||v.tenantId!==tenant||expectedId!==null&&v.id!==expectedId||['password','email','token'].some(k=>k in v))return false;
 if(kind==='role.delete')return v.deleted===true;
 return date(v.updatedAt)&&(!kind.startsWith('member.')||typeof v.status==='string'&&['ACTIVE','SUSPENDED','REVOKED','INVITED'].includes(v.status))&&(kind!=='member.status'||v.status===expectedStatus);
}
export function validTeamCatalog(v:unknown,tenant:string):v is TeamCatalog{
 return object(v)&&v.targetTenantId===tenant&&keys(v.capabilities,1000)&&Array.isArray(v.roles)&&v.roles.length<=500&&v.roles.every(r=>object(r)&&id(r.id)&&r.tenantId===tenant&&typeof r.name==='string'&&r.name.length>0&&(r.description===null||typeof r.description==='string')&&date(r.updatedAt)&&typeof r.protected==='boolean'&&typeof r.canAssign==='boolean'&&Number.isSafeInteger(r.assignedCount)&&Number(r.assignedCount)>=0&&keys(r.permissions))&&new Set(v.roles.map(r=>r.id)).size===v.roles.length&&Array.isArray(v.branches)&&v.branches.length<=500&&v.branches.every(b=>object(b)&&id(b.id)&&typeof b.name==='string')&&new Set(v.branches.map(b=>b.id)).size===v.branches.length&&Array.isArray(v.permissions)&&v.permissions.length<=500&&v.permissions.every(p=>object(p)&&typeof p.key==='string'&&(v.capabilities as string[]).includes(p.key)&&p.key!=='*'&&!p.key.startsWith('platform:')&&typeof p.module==='string'&&typeof p.action==='string');
}
export function validTeamPage(v:unknown,tenant:string,page:number):v is TeamPage{
 return object(v)&&v.targetTenantId===tenant&&v.page===page&&v.pageSize===20&&Number.isSafeInteger(v.totalItems)&&Number(v.totalItems)>=0&&Array.isArray(v.items)&&v.items.length<=20&&new Set(v.items.map(m=>object(m)?m.id:null)).size===v.items.length&&v.items.every(m=>object(m)&&id(m.id)&&m.tenantId===tenant&&typeof m.userId==='string'&&typeof m.username==='string'&&typeof m.fullName==='string'&&typeof m.identityActive==='boolean'&&id(m.roleId)&&typeof m.roleName==='string'&&['ACTIVE','SUSPENDED','REVOKED','INVITED'].includes(String(m.status))&&typeof m.allBranches==='boolean'&&Array.isArray(m.branchIds)&&m.branchIds.length<=500&&m.branchIds.every(id)&&new Set(m.branchIds).size===m.branchIds.length&&(m.homeBranchId===null||id(m.homeBranchId))&&date(m.updatedAt)&&(m.invitedUntil===null||date(m.invitedUntil))&&typeof m.protected==='boolean'&&typeof m.canManage==='boolean'&&!['password','email','phone','token'].some(k=>k in m));
}
export function validTeamBody(v:unknown,kind:TeamKind):boolean{
 if(!object(v)||!['role.create','role.update','role.delete','member.access','member.status'].includes(kind))return false;
 const exact=(allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k));
 if(kind!=='role.create'&&!date(v.expectedUpdatedAt))return false;
 if(kind==='role.delete')return exact(['expectedUpdatedAt']);
 if(kind==='member.status')return exact(['expectedUpdatedAt','status'])&&typeof v.status==='string'&&['ACTIVE','SUSPENDED','REVOKED'].includes(v.status);
 if(kind==='member.access')return exact(['expectedUpdatedAt','roleId','allBranches','branchIds','homeBranchId'])&&id(v.roleId)&&typeof v.allBranches==='boolean'&&Array.isArray(v.branchIds)&&v.branchIds.length<=500&&v.branchIds.every(id)&&new Set(v.branchIds).size===v.branchIds.length&&(v.allBranches?v.branchIds.length===0:v.branchIds.length>0)&&(v.homeBranchId===null||id(v.homeBranchId)&&(v.allBranches||v.branchIds.includes(v.homeBranchId)));
 return exact(['name','description','permissions',...(kind==='role.update'?['expectedUpdatedAt']:[])])&&typeof v.name==='string'&&v.name.trim().length>0&&v.name.length<=100&&typeof v.description==='string'&&v.description.length<=500&&keys(v.permissions)&&new Set(v.permissions).size===v.permissions.length&&(!v.permissions.some(k=>['team:invite','user:update','user:delete'].includes(k))||v.permissions.includes('user:read'))&&(!v.permissions.some(k=>['billing:request','billing:proof'].includes(k))||v.permissions.includes('billing:read'))&&(!v.permissions.some(k=>['role:create','role:update','role:delete'].includes(k))||v.permissions.includes('role:read'));
}
