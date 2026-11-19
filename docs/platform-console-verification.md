# Super Admin console first delivery — 19 November 2026

The 19 November audit remains the full product backlog. This delivery implements
its first shell/control/overview work and improves the plan workflow; it does not
claim a complete SaaS platform.

Implemented:

- Responsive platform sidebar/navigation and compact header, with allowed
  Overview, Shops, Plans, Subscriptions, Billing, Add-ons and Security activity
  sections. Capabilities and write rollout gates remain authoritative.
- Real authorized Overview endpoint with global shop counts, subscription states,
  plan versions, open billing requests, recent shops, seven-day period endings
  and 7/30/90-day new-shop series. No fabricated metrics or pharmacy-sale revenue.
- No empty directory detail column before selection; selected mobile details
  appear before the directory and receive focus/scroll. Details can be closed.
- Working shared custom selects and fixed-size checkbox controls in platform and
  plan dialogs, including keyboard selection and disabled states.
- Focused plan editor modal and per-action publish/retire confirmation reasons.
  Version/replay guards and uncertain-response retry are preserved.
- Named, paginated server search for dedicated shop audiences; selected names
  hydrate through authorized metadata reads. No arbitrary shop data is exposed.
- Readable module labels and storage in MB with byte conversion; separate
  Unlimited controls retain null vs zero semantics.
- Platform Banglish dictionary, translated plan/status/term labels, light/dark
  tokens and mobile layouts.

Verification uses the actual Next application, BFF routes and local HTTP
fixtures. Backend native tests use disposable PostgreSQL and real restricted
roles, not the hosted database. Screenshot numbers are fixture values, not live
platform counts. Browser outputs and PNGs are in the workspace
`outputs/platform-console-20261119` directory outside Git.

Checks include date-range requests and full 21-shop counts despite 20-row
pagination, metric navigation, plan modal opening, keyboard audience selection,
authorized shop-name search, checkbox geometry and English/Banglish dark/mobile
widths. Existing commercial draft/publication/assignment, response-loss retry,
suspend/resume/stale-version, billing/manual payment, add-on and admin-to-owner
logout/login scenarios also run through the actual Next BFF.

Deploy backend first, then frontend; retain existing runtime env/gates. No new
database, migration, setup command, seed or password reset is required.

Verified: backend build and 143 native PostgreSQL tests; frontend production build,
219 unit tests, scoped ESLint/type checks, and the new console browser flow also
against `next start`. Commercial, lifecycle, billing, add-on and admin/logout/
owner browser regressions passed. A repeat static scan found zero missing literal
platform `t()` dictionary keys; dynamic backend error text is outside that scan.

Remaining work from the audit includes global subscription/payment directories,
operator management, timed support grants, full shop profile, platform theme/
template catalog/versioning, notification/outbox/operations and release UAT.
Per-shop sections are not a substitute for those outstanding global workspaces.
