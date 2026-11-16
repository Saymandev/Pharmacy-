import {validShopEntitlements,type ShopEntitlements} from './entitlement-policy.ts';
import { type ShopContext,validShopContext } from './shop-contract';
export type WorkspaceBranch={id:string;tenantId:string;name:string;isActive:true};
export type WorkspaceBootstrap=ShopContext&{entitlements?:ShopEntitlements;branches:{items:WorkspaceBranch[];nextCursor:string|null}};
export function workspaceBranchKey(context:ShopContext){return `pharmacy.workspace-branch:${context.userId}:${context.tenant.id}:${context.membershipId}`;}
export function validWorkspaceBranch(value:unknown,context:ShopContext):value is WorkspaceBranch{
  if(!value||typeof value!=='object')return false;
  const row=value as Record<string,unknown>;
  return typeof row.id==='string'&&/^[0-9a-f-]{36}$/i.test(row.id)&&row.tenantId===context.tenant.id&&
    typeof row.name==='string'&&row.isActive===true&&(context.allBranches||context.branchIds.includes(row.id));
}
export function validWorkspaceBootstrap(value:unknown,selected:ShopContext):value is WorkspaceBootstrap{
  if(!validShopContext(value,selected.tenant.id,selected.userId)||value.membershipId!==selected.membershipId||!('branches' in value))return false;
  const branches=value.branches as WorkspaceBootstrap['branches'];
  return (!('entitlements'in value)||validShopEntitlements(value.entitlements,selected.tenant.id))&&!!branches&&Array.isArray(branches.items)&&branches.items.length<=50&&branches.items.every(row=>validWorkspaceBranch(row,value))&&
    (branches.nextCursor===null||typeof branches.nextCursor==='string'&&/^[0-9a-f-]{36}$/i.test(branches.nextCursor));
}
