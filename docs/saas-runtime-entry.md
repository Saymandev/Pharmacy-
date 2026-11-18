# SaaS navigation and logout

Build with `NEXT_PUBLIC_SAAS_MODE=true` only for the reviewed SaaS deployment.
Authenticated home/sign-in opens `/shops`; identity role:null is intentional and
shop authority comes from fresh memberships. Legacy mode keeps `/dashboard`.

Set server `SAAS_RUNTIME_ENABLED=true` to use the dedicated cookie-bearing logout
route `/api/backend/auth/logout`. It validates request origin, forwards the
HttpOnly access token to backend session revocation, and clears both cookies only
after success or an already invalid session. A backend failure preserves cookies
for retry. Tokens are never returned to browser JavaScript.

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
restored legacy sales/cost/source/time/register reconciliation remains unfinished.
The user deploys after that gate passes. Native/browser fixtures do not create a
live test shop/admin. Member registration and other remaining release adapters
keep their separate gates disabled.
