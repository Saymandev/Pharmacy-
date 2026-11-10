# Tenant workspace bootstrap and branch picker — SaaS-014

Verified 2026-11-10. This phase connects only read-only workspace bootstrap and
branch verification. POS/sales, catalog, reports and financial actions remain
unconnected in this preview. Main/live and real data are unchanged.

## Staging composition

Keep `TENANT_SESSION_PREVIEW_ENABLED=false` and
`TENANT_WORKSPACE_PREVIEW_ENABLED=false` in live. Both server-only flags must be
true for the new transport, and `TENANT_BACKEND_API_URL` must explicitly name a
reviewed tenant API base including its `/api/v1` mount. There is **no fallback** to
legacy `BACKEND_API_URL`. Membership discovery still uses the separately reviewed
auth-bootstrap factory described in `saas-shop-access-preview.md`.

Backend tenant catalog factory now includes:

- `GET /workspace/bootstrap?limit=50&after=<branch UUID>`: current validated
  tenant/membership/user, explicit role and permissions, branch grants, home branch
  and a bounded active-branch page. Every request runs the tenant middleware and
  scoped transaction. No wildcard/global role privilege is adopted.
- `GET /workspace/branches/:id`: fresh active/owned/granted branch validation,
  returning only id, tenantId, name and isActive. This picker projection is allowed
  for active members without branch administration permissions. It does not grant
  general branch CRUD or expose branch contacts/financial records.

The backend factory remains unmounted in the legacy app. Release review and real
bootstrap/business connection separation are still required before activation.

## Frontend boundary

Dedicated BFF path: `/api/backend/tenant-workspace/:tenantId/workspace/...`.
It stays under `/api/backend` so existing HttpOnly access-cookie path semantics
work. The BFF accepts only the two GET patterns above, binds `X-Tenant-Id` from the
validated route, supplies Bearer identity from the cookie, and ignores client
Authorization/X-Tenant-Id values. Missing cookies are denied locally. Redirects,
unknown paths, writes and missing configuration cannot fall back to legacy routes.
Responses use no-store; proxy timeout is 15 seconds. Abort cannot undo a committed
write, and this phase exposes no writes.

`TenantWorkspace` mounts with tenant+membership identity and disposes its own
transport when changing shop. The transport combines the auth-session and mount
abort signals and rejects late decoded responses even if fetch ignores abort.
Bootstrap validates actor, selected shop and exact membership id; branch pages and
details validate ownership, active status and explicit grants. Only server-returned
permission keys determine the preview access labels, never `useAuth` legacy '*'.

The single branch-changing control is **Workspace settings**. Saved preferences
are per-tab and scoped to user+tenant+membership. Saved/home branches are rechecked
through the branch endpoint before showing them; there is no first-branch fallback.
Missing grants require explicit selection. Losing access clears branch data and
saved preference. Window focus refreshes bootstrap/permissions and revalidates the
selected branch; data is hidden while verification runs. A displayed context is a
snapshot, not a perpetual authorization lease. Subsequent business operations must
independently enforce current context and branch access.

## Evidence

- Backend build and 37 native PostgreSQL/Prisma/HTTP checks pass, including five
  new bootstrap/picker cases (cashier without branch administration, permission
  removal, foreign/inactive branch, grant revocation, bounded pages/suspension).
- Four frontend transport/gate tests pass. TypeScript, changed-module ESLint and
  the optimized Next.js production build pass.
- `npm run test:tenant-workspace` starts a disposable local HTTP upstream and a
  local Next dev server, uses actual Next proxy and HttpOnly cookie requests, and
  launches installed Microsoft Edge. It tests forged headers, anonymous/method/path
  denial, A/B branch and permission separation, scoped preference, delayed old-shop
  response, focus revocation and mobile dark layout. No real database or live API
  is contacted. Run with no other dev server holding this repository's Next lock.
- The 390px dark screenshot was inspected without horizontal overflow. The
  fixture stops its created Next process tree and HTTP server in cleanup.

Remaining: tenant catalog/inventory/POS/report/finance adapters, authenticated
media and tenant socket lifecycle, full tenant login/navigation, production role
and migration rehearsal, real two-shop UAT. The preview remains opt-in and is not
a complete tenant-isolated SaaS release.
