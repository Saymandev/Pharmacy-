# Tenant opening stock and adjustment workflow

SaaS-014 incremental phase, verified 2026-11-10. Feature branches only; no live
database, legacy screen, deployment environment or main branch is changed.

## Gate meaning and activation boundary

`TENANT_CATALOG_WRITES_ENABLED=false` is a default-off switch for the **new tenant
preview**, not a switch disabling the existing application's writes. This phase
reuses that switch for stock actions; it does not add another gate. Both tenant
preview gates, an explicitly reviewed tenant API base, tenant routes/DB ownership
rollout and current capabilities are still required. Do not enable on the legacy
live backend merely to display buttons. Full migration/route composition and UAT
remain pending; feature-branch backup is not production activation.

## Opening stock

The workspace offers Opening stock globally and from active medicine details to
users with medicine:read plus stock:create. Working branch is fixed from Settings;
the modal never supplies a second branch selector. Server-searched medicine picker
requests `registeredOnly=false`, so a newly created medicine without a batch is
selectable. Default Catalog registered-branch behavior remains unchanged. Returned
stock projections remain restricted to the explicitly requested authorized branch.

Selected medicine is reloaded, validated as owned/active with complete prices/unit,
and used to prefill unit cost/MRP. Form accepts batch, valid calendar expiry, positive
integer quantity, non-negative two-decimal prices, rack and optional note. Opening
registers a new batch; duplicate batch is a conflict, never a top-up. The form states
that supplier deliveries should use Purchases. No finance/account transaction is
created by this workflow. Expiry is serialized at UTC midnight, retaining existing
backend date behavior; this phase does not redesign shop-timezone expiry semantics.

## Adjust stock

Inventory shows an explicit Adjust stock action only with stock:update and the
write switch; entering the list already requires stock:read. The form reads the
exact owned stock again with branch scope before showing current quantity. It
validates stock/medicine/branch consistency, shows increase/decrease, positive
integer delta, unit, mandatory reason and projected resulting quantity. Negative
and overflowing results are blocked locally and independently on the backend.

The inspected `expectedQuantity` is required by this BFF. Backend checks it **after
locking the stock**, before mutation. A changed quantity produces 409 and explicit
Reload stock; reload clears the prior correction draft for a fresh decision. Final
save is confirmed from the validated committed response and the list is reloaded
for current quantity, not the optimistic UI calculation. A cached retry response
is not mislabeled as the current live balance after other operations.
Supplier-return reservation checks remain authoritative on the backend; a preview
of recorded quantity is not a reservation-availability quote.

Both forms guard duplicate submits and retain identical key/body for uncertain
retries. Prior successful operation replay does not post another stock movement.
Stock/history/audit/operation record are transactional. Unknown outcomes freeze the
draft and offer Retry stock save; the same reload/navigation uncertainty limitations
as medicine forms apply. Aborting a request is not a server rollback.

## Proxy and backend contract

Existing proxy extends only these patterns:

- GET `/pharmacy/stocks/:uuid?branchId=:uuid` — stock:read, current branch access,
  owned stock/medicine/branch. Missing branch is rejected, foreign stock unavailable.
- POST `/pharmacy/stocks/opening` — explicit stock-create permission, new owned
  batch; exact stock form fields, no identity/ledger/extra relation fields.
- POST `/pharmacy/stocks/adjust` — stock-update permission, scoped stock, reason,
  expectedQuantity and exact adjustment fields.

Same-origin check, cookie identity, route-bound tenant, JSON/key/body check, no query
on mutations, redirect denial and no legacy fallback remain. Stock transfers,
imports, price changes and all other stock writes stay blocked. The backend quantity
precondition is optional for existing staged clients; this new proxy requires it.

## Verification

- Backend build and **51 passing** native PostgreSQL/Prisma/HTTP checks include the
  unregistered medicine picker, scoped stock detail, expected quantity conflict and
  operation replay with one movement. Existing negative quantity, ownership,
  concurrency, history/audit rollback and permission cases pass.
- `npm run test:tenant-stock`: **16 unit tests** plus actual Next proxy/disposable
  HTTP-upstream browser checks. Tests opening fractional quantity rejection,
  same-key uncertain retry, one creation, duplicate batch conflict, fixed branch,
  new medicine selection, fresh adjustment read, negative prevention, stale conflict/
  reload, one adjustment on replay, list refresh and body/origin/path restrictions.
- Mobile opening in dark theme and adjustment screenshots are inspected. TypeScript,
  changed-module lint and production build pass. Browser fixtures
  never contact a real DB/live API and clean up their own Next/server processes.

Update: Stock History and Branch Transfer UI are implemented under the existing
scope/gates; see [history and transfer](saas-history-transfer.md).

Update: CSV import and batch price updates are implemented; see
[bulk workflows](saas-bulk-import.md).

Remaining: XLSX frontend/master mapping, durable offline
operation reconciliation, remaining resource adapters and final tenant release UAT.
