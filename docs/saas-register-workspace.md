# Own cash register preview

The `/shops` workspace now offers **My cash register** independently of medicine
catalog access. It is bound to the selected tenant, current user and working
branch. Changing that workspace disposes the previous transport and dialog.

Features: current expected drawer cash, opening float/count and note, closing
count with expected-balance snapshot, required discrepancy explanation and final
confirmation, server-paginated own session history with note/status/date filters,
and paginated cash movements with explicit IN/OUT labels. Historical opening and
closing notes are preserved. Open/close count physical cash; they never change an
account balance. Closed session count differences are not silently reconciled.
No paginated movement list is presented as a full cash total.

The BFF uses cookie identity, URL-bound tenant, same-origin JSON writes, strict
body/path allowlists and stable idempotency keys. Ambiguous responses freeze the
form until the same request succeeds or returns a known rejection. Backend
permissions are `cash-register:read`, `cash-register:create`,
`cash-register:update`; current capability and branch grants are rechecked on
replay. Read payloads must match the own tenant, branch and actor.

Verification: 3 pure policy/transport tests; actual Next BFF with a disposable
HTTP upstream and Edge browser covers lost-response open/close retry exactly
once, discrepancy, session history, empty cash movements, popover outside-dismiss,
foreign actor rejection and mobile light/dark. Production build and changed-code
ESLint pass. Fixtures do not contact a real database or deployment.

Preview gates remain unchanged. Backend router composition, staged register SQL,
permission seeding/explicit role assignment, migration/backfill, release acceptance
and real two-shop UAT are prerequisites to enabling this on live. This phase does
not merge main, deploy, grant permissions or expose another cashier's drawer.
