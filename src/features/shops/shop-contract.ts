export type ShopMembership = {
  membershipId: string;
  tenant: {id:string;name:string;slug:string};
  role: {id:string;name:string};
};
export type ShopContext = ShopMembership & {
  userId:string;permissions:string[];allBranches:boolean;branchIds:string[];homeBranchId:string|null;
};
export type ShopPage = {items:ShopMembership[];nextCursor:string|null};
export function shopPreferenceKey(userId:string){return `pharmacy.selected-shop:user:${userId}`;}
function object(value:unknown):value is Record<string,unknown>{return !!value && typeof value==='object' && !Array.isArray(value);}
function validMembership(value:unknown):value is ShopMembership {
  return object(value) && typeof value.membershipId==='string' && object(value.tenant) &&
    typeof value.tenant.id==='string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value.tenant.id) &&
    typeof value.tenant.name==='string' && typeof value.tenant.slug==='string' &&
    object(value.role) && typeof value.role.id==='string' && typeof value.role.name==='string';
}
export function validShopPage(value:unknown):value is ShopPage {
  return object(value) && Array.isArray(value.items) && value.items.length<=50 && value.items.every(validMembership) &&
    (value.nextCursor===null || typeof value.nextCursor==='string' && /^[0-9a-f-]{36}$/i.test(value.nextCursor));
}
// Selection is only a hint. Never deserialize permissions from browser storage.
export function validShopContext(value:unknown,tenantId:string,userId:string):value is ShopContext {
  return validMembership(value) && 'userId' in value && value.tenant.id===tenantId && value.userId===userId &&
    'permissions' in value && 'allBranches' in value && 'branchIds' in value && 'homeBranchId' in value &&
    typeof value.membershipId==='string' && typeof value.role?.id==='string' &&
    typeof value.role?.name==='string' && Array.isArray(value.permissions) &&
    value.permissions.every(key=>typeof key==='string' && key!=='*') &&
    typeof value.allBranches==='boolean' && Array.isArray(value.branchIds) &&
    value.branchIds.every(id=>typeof id==='string') &&
    (value.homeBranchId===null || typeof value.homeBranchId==='string');
}
