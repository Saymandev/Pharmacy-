export const workspacePermissions: Record<string, readonly string[]> = {
  "/pos": ["sale:read", "sale:create"],
  "/catalog": ["medicine:read"],
  "/catalog/setup": ["medicine-category:read", "medicine-generic:read", "medicine-manufacturer:read", "medicine-group:read", "medicine-unit:read"],
  "/inventory": ["stock:read"],
  "/purchases": ["purchase:read"],
  "/suppliers": ["supplier:read"],
  "/sales": ["sale:read"],
  "/returns": ["sale-return:read"],
  "/customers": ["customer:read"],
  "/finance": ["account:read", "transaction:read", "income:read", "expense:read"],
  "/finance/consultations": ["consultation-charge:read"],
  "/reports": ["report:read"],
  "/hr": ["employee:read", "attendance:read", "leave:read"],
  "/hr/rosters": ["shift:read", "roster:read", "assigned-roster:read"],
  "/hr/setup": ["department:read", "designation:read", "leave-type:read", "annual-calendar:read"],
  "/admin": ["settings:read", "branch:read", "media:read", "notice:read", "notice:create", "notification:update"],
  "/access": ["user:read", "role:read"],
};

export function canVisitWorkspace(path:string,hasPermission:(permission:string)=>boolean){
 const normalized=path.length>1?path.replace(/\/+$/,''):path;
 if(normalized==='/'||normalized==='/dashboard')return true;
 const required=workspacePermissions[normalized];return !!required?.some(hasPermission);
}
export function workspaceDeniedMessage(path:string){if(path==='/reports')return 'Your role cannot view reports.';if(path==='/purchases')return 'Your role cannot view purchases.';if(path==='/suppliers')return 'Your role cannot view suppliers.';return 'Your role cannot view this page.';}
