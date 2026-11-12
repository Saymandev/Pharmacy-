# Platform Super Admin preview

The later [pending shop onboarding](saas-shop-onboarding.md) phase adds an
explicitly authorized Add shop intake. Full provisioning and activation remain pending.

`/platform` is separate from `/shops` and the legacy dashboard. Active tenant
Super Admin roles do not grant operator access. The server resolves an explicit
active operator and capabilities on every request.

The first panel provides shop metadata, server-side search/status filters and
pagination, security status details, suspend/resume confirmation with a reason,
and authorized security activity. It does not expose customer records, account
balances, passwords or arbitrary shop support access.

Unknown save responses freeze the same payload/key and disable edits, cancellation
and Escape until retry. Stale versions require reloading shop detail. Successful
acknowledgements reload current metadata and audit. The transport never sends a
tenant header, uses no cache and rejects disposed/session-invalid responses.
Read-only operators have no write controls. Light/dark and mobile layouts share
the application tokens; interface labels use the existing English/Banglish system.

Staged server environment sample (not applied to live):

```dotenv
PLATFORM_ADMIN_PREVIEW_ENABLED=false
PLATFORM_ADMIN_WRITES_ENABLED=false
PLATFORM_BACKEND_API_URL=https://backend.example/api/v1/platform
```

The BFF requires its explicit dedicated base ending in /platform, validates fixed
paths and strict command bodies, enforces same-origin JSON writes and refuses
legacy-proxy fallback. Existing tenant preview/write gates are independent.

Verification: `npm run test:platform-admin`, changed-file ESLint and `npm run build`.
The browser fixture covers tenant-admin denial, explicit operator access,
search/page/detail, stale version conflicts, lost-response retries, activity,
origin/body forgery, unsafe projections, read-only controls and mobile themes.

No live migration, operator bootstrap, public route mount or deployment is part
of this phase. This initial administration panel does not include provisioning,
subscription management or theme/template publishing. Theme/template work follows
this operator foundation; full Super Admin product scope remains tracked separately.

Verified: four frontend unit checks, the actual Next BFF/Edge browser flow,
changed-file ESLint and production build pass. Native backend coverage passes
214 composed checks plus two schema/foundation checks. Repository-wide legacy
lint errors reported in the previous phase remain outside this change.
