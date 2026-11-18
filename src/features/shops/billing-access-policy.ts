export const billingCapabilities=['billing:read','billing:request','billing:proof'] as const;
export type BillingCapability=typeof billingCapabilities[number];
export function validBillingCapabilities(value:unknown):value is BillingCapability[]{
 return Array.isArray(value)&&value.length<=3&&new Set(value).size===value.length&&value.every(key=>billingCapabilities.includes(key as BillingCapability))&&(value.length===0||value.includes('billing:read'));
}
export function hasBillingAccess(context:{allBranches:boolean;billingCapabilities?:BillingCapability[]}){return context.allBranches&&context.billingCapabilities?.includes('billing:read')===true;}
export const billingPermissionLabel=(key:string)=>({'billing:read':'View billing','billing:request':'Send billing requests','billing:proof':'View payment proofs'}[key]??key);
