# SaaS frontend: session lifecycle prerequisite

This feature branch starts SaaS-014; it does not activate tenant mode or claim
tenant isolation in the existing frontend. Backend tenant factories remain staged
and unmounted. No tenant selector, tenant header or fabricated membership endpoint
is added to legacy requests.

Implemented:

- User-specific saved branch keys; the old shared key is intentionally ignored.
  Each user initially receives a branch returned by the current authorized API.
  Settings remains the single branch-change control. Existing user-specific
  preferences synchronize across tabs.
- A session request generation aborts previous API requests and rejects late
  responses after session changes, including responses decoded after a switch.
  Abort is not a rollback of a write already committed on the server.
- Logout and successful login remount the workspace subtree, disposing cart,
  branding, local page state and socket effects. Initial authentication responses
  cannot revive a session after logout.
- Same-tab login waits for a previous logout response before setting new cookies.
  A failed logout blocks subsequent login until reload rather than racing cookies.
- Successful login/logout broadcasts a random, non-secret browser storage event.
  Other tabs invalidate requests and reload to resolve the current cookie session.
  This synchronization requires working localStorage; it is not server-side
  session revocation or atomic coordination of simultaneous logins in several tabs.
- Settings ignores a stale native dialog close event when React development
  effect cleanup has already reopened the dialog, preserving branch selection.

Verification uses mocked HTTP/browser sessions; no real shop data is changed.
Run `npm run test:session` with a local development server available, plus TypeScript
and ESLint. The browser fixtures use installed Microsoft Edge. They cover request
generation/cancellation, per-user selection and cross-tab actor changes, branch
changes across POS/report tabs, and checkout branch/batch attribution.
Failed login also retains the entered username and displays the API error.

Verified on 2026-11-07: two request-boundary unit checks, both browser fixtures,
TypeScript `--noEmit`, and ESLint for all changed TypeScript components/modules.
Browser data is mocked; live tenant switching has not been verified or enabled.

Update 2026-11-10: the authenticated discovery contract and gated shop access
preview are implemented; see [shop access preview](saas-shop-access-preview.md).
Next: tenant/user/branch storage scope,
tenant permission/bootstrap adapter, authenticated media and tenant socket adapter.
Only enable tenant routes after backend release gates, full frontend integration
and cross-tenant acceptance tests. This change alone is not a SaaS release.
