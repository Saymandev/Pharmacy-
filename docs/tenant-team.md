# Tenant Team access workspace

The verified selected-shop workspace offers Team access to all-branch owners or
members with explicit Team read permissions. A separate scoped BFF permits only
catalog/member reads, role CRUD, member access/status and invitation commands. It has no user
creation, password reset or global identity endpoints and never accepts caller
tenant/auth headers. Strict versioned JSON bodies and save keys gate mutations.

Members have a labeled action dropdown with keyboard navigation, outside/Escape
dismissal and explicit View permissions/Edit access/Suspend/Restore/Revoke actions.
Protected access and unsupported actions remain disabled. Search/status/page
filters run on the backend. Small screens present readable member rows as cards.

Role permissions are a readable grouped checkbox list for editing and a simple
list for viewing. Administration actions require their corresponding View rights.
Role/branch forms use stacked labels, the existing searchable Select and explicit
scope/default-branch controls. Inactive grants are removed only by an explicit
choice. Role changes describe their effect on every assigned member in this shop.
Assigned/protected roles cannot be deleted. Revocation warns that a new invitation
is needed to restore access; only suspended memberships have a Restore action.

Each unknown mutation freezes the exact body/key, form and close/navigation until
retry confirms the result. Receipts require matching shop/record/version/status.
Foreign or malformed projections stay hidden. Conflicts reload fresh inspected
state; authentication/authorization denial clears stale Team data. Session/shop
disposal rejects late responses. Language changes preserve the mounted scope.

Writes require the deployment gate, Team feature and current server capabilities.
Narrow suspension/revocation recovery separately respects deployment/role gates
when the subscription is expired; it cannot expand access. The backend remains
authoritative if a displayed scope becomes stale. UI state/local storage never
grants permissions. Shared login credentials are managed outside this workspace.

Existing-membership/role administration is complete. Existing-account invitations
and consent have a separate implementation in [team-invitations.md](team-invitations.md).
Invited account onboarding is implemented in [member-registration.md](member-registration.md).
General identity lifecycle, automated invitation delivery, HR and remaining billing/
notification work remain separate. All changes remain staged off main/live.

Verification entry points: tenant-team.test.mjs and run-tenant-team-browser.cjs,
scoped ESLint/TypeScript, production build and the companion disposable PostgreSQL
suite. Browser scenarios use the actual Next BFF with controlled upstream data.

Verified 2026-11-17: production build, scoped ESLint/TypeScript and nine policy/
transport/shop contract tests passed. Team, private Media and owner billing portal
browser scenarios passed. The mobile dark Team layout was visually inspected.
Backend companion changes passed the full 266-test local PostgreSQL regression.
Neither main merge nor production deployment/database changes were performed.


Member invitations now have a separate staged implementation; see [team-invitations.md](team-invitations.md). Existing-account consent and invited verified-account onboarding are implemented; general identity lifecycle and automated initial invitation delivery remain separate.
