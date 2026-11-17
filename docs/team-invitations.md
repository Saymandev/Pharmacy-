# Team invitations and member consent — staged

Team access now includes an Invitations tab for a fresh all-branch administrator
with team:invite (and user:read). The existing capability/entitlement/mutation
gates apply. Managers choose an assignable shop role, explicit active branches or
all branches, optional default branch and expiry (1 hour to 7 days). The separate gated [account onboarding flow](member-registration.md) lets recipients
verify their invited email and create an account before joining.

Pending invitations reserve a seat. The form explains same-email replacement.
Issue success exposes a private fragment link once for copying; history shows
email, role, branch scope, expiry and state with server pagination. Revocation is
confirmed and is available under the recovery gate; accepted records are managed
through membership actions instead. All command retries preserve their exact key
and payload. Unknown outcomes freeze the form, tabs and modal dismissal until
resolved. Tokens are never written to local/session storage or list responses.

The dedicated `/member-invitation` page removes the URL fragment immediately.
An existing account signs in (or a new account uses gated verified onboarding), previews the shop/role/branch names and explicitly
consents. Wrong accounts see no shop metadata. Acceptance retries use the same
token, disable sign-out during unknown results and show an accepted receipt with
a Your shops link. Reloading the page requires reopening the original invitation
link. Backend acceptance never reapplies an old role or restores revoked access.

The identity BFF only allows same-origin POST preview/accept, strict bounded JSON
and the HttpOnly cookie. It forwards no tenant/caller identity headers. Its
reviewed base must end in `/member-invitations`; there is no legacy API fallback.
Shop issuer commands remain on the allowlisted tenant BFF. Neither router can
create/reset a shared User identity. Every response is scoped/shape checked.

Staging configuration (keep disabled live until the SaaS release gate):

```
MEMBER_INVITATION_PREVIEW_ENABLED=true
MEMBER_INVITATION_BACKEND_API_URL=https://staging-backend.example/api/v1/member-invitations
```

Also configure the existing TENANT_SESSION_PREVIEW_ENABLED,
TENANT_WORKSPACE_PREVIEW_ENABLED, TENANT_CATALOG_WRITES_ENABLED and tenant base.
The backend needs the additive invitation migration, updated quota/Team contracts,
invitation fixed functions, a dedicated HMAC secret and a separate EXECUTE-only
recipient database connection. See backend `doc/saas/team-invitations.md`.

Verification: production Next build, scoped ESLint/TypeScript, Team/invitation
policy and transport tests, plus the real Next BFF browser fixture. Browser checks
cover issue/revoke unknown-result retries, disabled dismissal, token fragments,
wrong account, explicit branch consent, acceptance retry once, foreign-origin and
tenant-field rejection, and mobile dark/light layouts. Existing Team browser
regression verifies role/member actions remain intact. No live database write,
deployment, account creation or invitation email is performed by these tests.
