# Catalog master management

The gated tenant workspace exposes Catalog master data for users who can read at
least one reference type. Category, Generic, Group, Manufacturer and Medicine
Unit share a native modal, server search/page controls, empty/loading/error
states, name/Bangla-name forms and explicit deletion confirmation.

Read capability controls each tab. The existing tenant write flag and the
specific create/update/delete capabilities control individual actions. The BFF
only permits POST on the five collection paths and PATCH/DELETE on UUID detail
paths. Same-origin/session/tenant URL binding remains required. Body fields are
only name/nameBangla (empty object for DELETE); caller ownership, activity and
business fields cannot pass. Backend remains authoritative for capability,
tenant ownership, unique names, linked-medicine conflicts and transactional audit.

Reference mutations do not have backend operation replay or edit version checks.
The UI blocks double submits and does not automatically retry. If a response is
uncertain, it requires Reload list and inspection before a new attempt. Concurrent
edits retain the existing backend last-writer behavior. No new backend routes,
migration or production configuration were introduced in this frontend phase.

Validation: 14 unit tests across master/proxy/transport/import/matcher scopes;
actual Next proxy browser fixture creates and edits a category, verifies a linked
delete conflict and successful subsequent deletion, checks all five read tabs
and hides mutations without their specific capabilities. Existing import/retry,
branch/shop isolation and revocation browser regressions run in the same fixture.
Changed-module ESLint and production build are also checked before push.

This remains a feature-branch `/shops` preview. Master management is entered from
the tenant catalog workspace; integrating dedicated master-only navigation and
full deployed two-shop UAT remains part of the release work.
