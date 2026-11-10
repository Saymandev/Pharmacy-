/** A server-only rollout gate. Never substitute a NEXT_PUBLIC browser flag. */
export function tenantSessionRouteAllowed(path: string[], method: string, enabled = process.env.TENANT_SESSION_PREVIEW_ENABLED): boolean {
  if (enabled !== "true" || method !== "GET") return false;
  if (path[0] !== "tenant-session" || path[1] !== "memberships") return false;
  return path.length === 2 || (path.length === 3 && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(path[2]));
}
