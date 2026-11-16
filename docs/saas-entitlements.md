# Runtime access and add-on workspace

Super Admin shop detail shows effective features, branch/seat/storage usage,
reserved upload bytes and the current agreement state. Explicit entitlement
capabilities control add-on draft/clone/edit/publish/retire/assign/cancel. Private
audience defaults to the selected shop; paid grants require a verified ADDON
billing invoice and settlement.

Unknown write results freeze form/navigation and retry the same body/key.
Missing or foreign entitlement projections fail closed. A zero cap is distinct
from unlimited; extra capacity is added by the backend, never browser arithmetic.

Tenant bootstrap includes the fresh safe entitlement projection. UI writes need
both deployment/role permission and an enabled current feature. An older bootstrap
without entitlements remains read-only. Historical sales/customer tools retain
their authorized read access; new POS/report/customization actions honor feature
state. Branch selection stays in workspace settings. POS has a dedicated scoped
medicine lookup, so it does not require catalog-management entitlement.

Server enforcement remains authoritative if a displayed state becomes stale.
No entitlements/permissions are accepted from local storage. Refresh on scope/
focus uses a fresh bootstrap; ordinary APIs, workers and sockets recheck on the
backend independently.

Run npm run test:entitlements. Browser fixtures use the actual Next BFF with
controlled upstream data; they are not live merchant or database verification.

Verified 2026-11-16: production build, scoped ESLint and 12 policy tests passed.
Entitlements, billing, tenant workspace and POS browser scenarios passed. Backend
companion changes passed the 251-test disposable PostgreSQL regression. Production
migration and merchant UAT remain separate release requirements.
