# Shop access preview — SaaS-014, in progress

Verified 2026-11-10. This is a staged access selector, not a tenant business workspace.

`/shops` is a standalone page behind server-only
`TENANT_SESSION_PREVIEW_ENABLED=true`. Default is false in `.env.example`.
The page and membership proxy return 404 while disabled. No existing navigation,
login redirect, branch selection, production environment, cookies or legacy business
route is switched into tenant mode. Do not enable this in live until rollout review.

Backend contract (factory on `codex/saas-tenant-foundation`): mount
`createTenantSessionRouter` at `/api/v1/tenant-session` in a reviewed staging app,
injecting real identity authentication, a separately reviewed auth-bootstrap directory
connection, and the authoritative membership loader. This is intentionally not mounted
in the legacy app. The existing `BACKEND_API_URL` identifies that staging API.

- `GET /memberships?limit=20&after=<membership UUID>` returns `items` and nullable
  `nextCursor`. Each item has `membershipId`, `tenant:{id,name,slug}` and `role:{id,name}`.
- `GET /memberships/:tenantId` freshly resolves current actor/membership/grants and
  returns that metadata plus `userId`, explicit `permissions`, `allBranches`,
  `branchIds` and nullable `homeBranchId`. It does not mint tokens, switch cookies,
  return business data or grant access from the old global role/JWT.

The proxy allows only these GET paths when enabled. It forwards identity through
the existing HttpOnly token and does not forward a tenant header. Other methods
and paths are denied. Every business request must still use the tenant middleware
once the separate business adapter is implemented; this preview grants no access.

The screen handles skeletons, bounded load-more, no shops, failed discovery/retry,
keyboard selection/focus, dark/light and Bangla. Selecting a shop clears previous
selection and pending request state and verifies context with the API. Browser
storage contains only a per-user, per-tab last-selected shop hint. No permissions,
membership claims or credentials are trusted from storage; reload does not auto-verify.
Revocation or mismatched actor/shop responses clear the selection. Displayed access
is a snapshot at selection time, not a long-lived authorization lease.

Validation: TypeScript, ESLint on changed modules, three contract/gate tests, and
the Playwright browser fixture pass. Browser API responses are mocked and the
fixture asserts there are no legacy business calls or tenant header activation.
Desktop dark and 390px Bangla screenshots were inspected. Backend passes 32 native
PostgreSQL/Prisma/HTTP checks including seven new membership cases; no live DB is used.

Run a staging dev server with the flag true, then `npm run test:shops` (installed
Microsoft Edge; optional `TEST_BASE_URL`). Keep real credentials out of fixtures.

Update 2026-11-10: read-only workspace bootstrap, isolated tenant transport,
permission projection and Settings branch picker are now implemented behind a
second gate; see [tenant workspace](saas-tenant-workspace.md). The preview still
cannot perform sales or other business operations.

Remaining SaaS-014: resource business API adapters, media/blob and socket adapters, tenant-only
navigation/login lifecycle, complete settings/POS/report integration, real two-shop
acceptance. Keep main/live unchanged until these and backend rollout gates pass.
