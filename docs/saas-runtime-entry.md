# SaaS navigation and logout

Set server `SAAS_RUNTIME_ENABLED=true` for the reviewed SaaS deployment. The
dynamic root layout passes this runtime mode to the auth provider, so navigation
and logout do not depend on a correctly inlined browser build flag.
Authenticated home/sign-in opens `/workspace`, which verifies `/platform/session`:
an explicitly authorized operator opens `/platform`, a 403 opens `/shops`, and
verification failures show retry rather than granting platform access. Identity
`role:null` is intentional; shop authority comes from fresh memberships. Legacy
mode keeps `/dashboard`. Old dashboard bookmarks also resolve through the SaaS
entry route. `NEXT_PUBLIC_SAAS_MODE=true` may be retained for compatibility.

Set server `SAAS_RUNTIME_ENABLED=true` to use the dedicated cookie-bearing logout
route `/api/backend/auth/logout`. It validates request origin, forwards the
HttpOnly access token to backend session revocation, and clears both cookies only
after success or an already invalid session. A backend failure preserves cookies
for retry. The UI retains the actor and offers retry on failure; a rejected logout
does not permanently poison later attempts. Successful logout opens a fresh login
page after cookie deletion. The compatibility logout route uses a RELATIVE 307
Location so a container's internal `0.0.0.0:3000` URL cannot leak into the browser
redirect. Tokens are never returned to browser JavaScript.

After the backend/data cutover gate passes, the matching server configuration is:

```dotenv
BACKEND_API_URL=https://pharmecy.genify.live/api/v1
NEXT_PUBLIC_SAAS_MODE=true
SAAS_RUNTIME_ENABLED=true
TENANT_SESSION_PREVIEW_ENABLED=true
TENANT_WORKSPACE_PREVIEW_ENABLED=true
TENANT_CATALOG_WRITES_ENABLED=true
TENANT_BACKEND_API_URL=https://pharmecy.genify.live/api/v1/tenant
PLATFORM_ADMIN_PREVIEW_ENABLED=true
PLATFORM_ADMIN_WRITES_ENABLED=true
PLATFORM_BACKEND_API_URL=https://pharmecy.genify.live/api/v1/platform
OWNER_INVITATION_PREVIEW_ENABLED=true
OWNER_INVITATION_BACKEND_API_URL=https://pharmecy.genify.live/api/v1/owner-invitations
```

This is future cutover configuration, not an instruction to enable flags on the
current legacy server. The backend now has an explicit `start:saas` server, but
restored legacy sales/cost/source/time/register reconciliation now passes. Live
cutover and owner activation still require the reviewed deployment steps.
Native/browser fixtures do not create a
live test shop/admin. Member registration and other remaining release adapters
keep their separate gates disabled.
