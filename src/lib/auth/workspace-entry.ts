/** Public flag selects navigation only; server gates and API authorization remain mandatory. */
export function workspaceEntry(saasMode=process.env.NEXT_PUBLIC_SAAS_MODE):string{return saasMode==='true'?'/shops':'/dashboard';}
export function logoutEndpoint(saasMode=process.env.NEXT_PUBLIC_SAAS_MODE):string{return saasMode==='true'?'/api/backend/auth/logout':'/api/session/logout';}
