# Backend handoff: APIs and accounting fixes for the pharmacy frontend

Reviewed: 1 November 2026. Scope: the backend ZIP supplied in this conversation, not a fresh audit of the deployed API. The frontend uses `/api/v1` as the API base. All paths below are relative to that base.

**Update, 3 November 2026:** Stock History, supplier returns/refunds, and verified customer advance events have now been implemented locally on `codex/pharmacy-stock-history` in backend and frontend. See `backend/doc/pharmacy-returns-advances.md` for the actual routes and migration procedure. The older proposal sections below are retained as historical requirements, not current route availability. Customer advance events do not reconstruct legacy unrecorded balances; invoice-linked history remains a separate statement. Production deployment and live verification have not occurred.

**Important:** endpoints marked **proposed** do not exist in the inspected source. Their names/payloads are suggestions for agreement with the backend developer, not claims about live behavior. Existing routes are identified separately. No backend source was modified.

## Delivery order

| Priority | Work | Why |
| --- | --- | --- |
| P0 | Supplier UUID validator fix; payment/register posting consistency; atomic stock/payment/status mutations | Existing frontend operations need reliable IDs, money and stock balances. |
| P1 | Stock-history read API | Show opening, purchase, sale, transfer and adjustment history per batch. |
| P1 | Complete customer ledger, including standalone advances | Current statement can show invoice-linked activity, but cannot reconstruct a complete historical customer account. |
| P1 | Purchase-return and supplier-settlement APIs | Required before supplier returns/refunds can be implemented end to end. |
| P2 | Branch-wide inventory alerts and stock metadata | Avoid current-page-only alert counts and limited medicine metadata coverage. |
| Optional | Opening-stock correction route | Only if editing opening entries is an agreed business requirement. |

## 1. Stock-history API — missing read route

Source evidence:

- `prisma/schema/stock.prisma` defines `StockHistory`.
- `src/modules/pharmacy/stock/stock.service.ts`, purchase and sale services write movement records.
- `src/modules/pharmacy/pharmacy.routes.ts` exposes stock operations, but no stock-history read route. A model and writes alone do not make history available to the frontend.

**Proposed:**

```http
GET /pharmacy/stocks/history
  ?branchId=...
  &stockId=...
  &medicineId=...
  &batchNumber=...
  &type=in|out
  &stockChangeType=purchase|sale|transfer|adjust|opening-stock
  &startDate=2026-11-01
  &endDate=2026-11-30
  &page=1
  &limit=25
```

Optional filters are shown together for illustration; do not require all of them. Support a stable sort, e.g. `createdAt DESC, id DESC`. Return pagination metadata and apply branch authorization on the server.

Each row should include:

- Movement `id`, `createdAt`, `stockId`, SKU, medicine ID/name, branch ID/name, batch, unit and expiry.
- Direction (`in`/`out`), movement type, quantity, and preferably signed `quantityDelta`.
- `quantityBefore` and `quantityAfter`, if recorded at the time of movement.
- Transfer source/destination branch plus a shared transfer/reference ID linking both legs.
- Source record type/ID/number: purchase, sale, return, adjustment or opening entry.
- Actor ID/name, note/reason; recovery/payment transaction reference when relevant.

The current model lacks several of those audit fields. Start returning available fields, but add immutable movement snapshots for future writes. Older unknown actors, source IDs or before/after balances must be `null`/explicitly unavailable, not fabricated using today's stock quantity. Add documented movement types for customer returns and supplier returns when those paths are implemented.

Acceptance: a transfer appears as matching source-out and destination-in records; opening, receiving, selling and adjusting show the correct batch; out-of-range dates and unauthorized branches are handled consistently.

## 2. Complete customer ledger — missing dedicated account-history contract

Already available and used by the frontend:

```http
GET /customers/:id
GET /sales?customerId=...&page=...&limit=...
GET /sales/returns?saleId=...&page=...&limit=...
POST /customers/pharmacy-payment
POST /customers/bulk-sale-payment
```

These support an invoice-based statement. They do not expose a complete account ledger for standalone advances and their subsequent use/refund. The generic finance transaction list also lacks a dedicated customer filter/ledger contract in the inspected source.

**Proposed:**

```http
GET /customers/:id/ledger
  ?branchId=...
  &startDate=2026-11-01
  &endDate=2026-11-30
  &entryType=...
  &page=1
  &limit=25
```

Required event coverage:

- Invoice/receivable creation, invoice payment and bulk/auto collection allocations.
- Customer advance received, advance applied to an invoice and unused advance refunded.
- Return credit/due adjustment and actual cash/bank refund as distinct events.
- Authorized adjustments or reversals, with their original event reference and reason.

Required row fields:

`id`, timestamp, customer, branch, `entryType`, amount/currency, invoice/return/payment reference, account, method, note, actor and allocation references. Define separate `receivableDelta` / `advanceDelta` and balances after the event (or an equally unambiguous accounting contract).

Required summary:

- Opening and closing **receivable** (what the customer owes).
- Opening and closing **advance/credit** (money held for the customer).
- Period charges, collections, return credits, advance received/applied/refunded and actual refunds.
- Explicit scope: branch, date range, currency, snapshot/as-of time and total matching events.

Do not use `customer.balance` as a substitute for invoice dues. Document whether an existing balance is opening credit, an advance or another account value. Do not create invented historical payments from `paidAmount` when transaction records are absent. If past advance events were never stored, expose an explicitly labelled migration/opening balance and document the coverage date.

The ledger must be ordered by immutable event time, with a stable tie-breaker. A collection made today against an older invoice belongs to today's collection history. A historical statement must not silently change because the source invoice's current net amount changed after a return. Define whether branch statements include centrally held advances and how cross-branch advance use is allocated.

**Advance writes, if not covered by an agreed existing contract — proposed:**

```http
POST /customers/:id/advances
POST /customers/:id/advance-allocations
POST /customers/:id/advance-refunds
```

Agree exact paths and permissions before frontend work. Receipt/refund bodies need branch, account, amount, method and note. Allocation needs stable source advance and target invoice identities/amounts. Every write must create an auditable event and appropriate financial transactions atomically, enforce ownership and remaining balances, and support idempotency. A transaction read endpoint alone cannot supply advance history if writes never persisted it.

Existing `processPharmacyPayment` credits remaining money to `customer.balance`; the inspected account/transaction writes in that path occur per allocated sale. Verify that any unallocated advance also posts the full collected money to the correct financial account and produces a durable receipt/event. Never record the customer credit without recording the money received.

## 3. Purchase Return / supplier refund — models exist, routes missing

Source evidence:

- `prisma/schema/purchase.prisma` defines `PurchaseReturn` and `PurchaseReturnItem`.
- Pharmacy reports aggregate purchase returns.
- No mounted purchase-return list/detail/create/status/refund controller contract was found in the supplied routes. Sales returns are customer returns and must not be reused for this operation.

**Proposed read routes:**

```http
GET /pharmacy/purchases/:id/returnable-items
GET /pharmacy/purchase-returns?branchId=...&supplierId=...&purchaseId=...&status=...&startDate=...&endDate=...&page=1&limit=25
GET /pharmacy/purchase-returns/:id
```

Returnable items must identify the original completed purchase and item ID, medicine, stock/batch/expiry, original quantity/cost/discount/tax allocation, completed-return quantity, pending-reserved quantity, current matching stock and remaining returnable quantity. Do not rely only on medicine ID or PO text when a purchase has multiple batches or duplicate lines.

**Proposed create:**

```http
POST /pharmacy/purchase-returns
Idempotency-Key: <unique-operation-key>
```

```json
{
  "purchaseId": "purchase-uuid",
  "branchId": "branch-uuid",
  "supplierId": "supplier-uuid",
  "status": "pending",
  "reason": "Damaged packaging",
  "note": "Supplier accepted the return",
  "items": [
    { "purchaseItemId": "purchase-item-uuid", "quantity": 2 }
  ]
}
```

This is a proposed body, not an existing schema. Server must derive/validate item prices, stock identity, branch and supplier from the original purchase. Quantities must be whole units and within purchased/remaining/current-stock bounds. Define whether pending returns reserve stock or only reserve allowance; apply the same policy to concurrent drafts and approval.

**Proposed status:**

```http
PATCH /pharmacy/purchase-returns/:id/status
```

Body: `{ "status": "completed", "note": "Accepted by supplier" }`, or rejection. Only pending returns may be completed/rejected. Completing must atomically reduce the correct batch stock once, add movement history and post supplier accounting once. Rejected returns must release reservations. Repeated approval must not repeat stock or financial effects.

**Proposed settlement/refund:**

```http
POST /pharmacy/purchase-returns/:id/refunds
```

```json
{
  "accountId": "account-uuid",
  "amount": 100.00,
  "paymentMethod": "cash",
  "note": "Refund received from supplier"
}
```

A supplier refund is money **received** by the pharmacy. It is different from reducing an unpaid purchase due or retaining supplier credit.

Return detail must expose authoritative amounts separately: return value, purchase-due adjustment, remaining purchase due, supplier credit created, refund received and remaining refundable credit. Include settlement/transaction IDs, accounts/methods/timestamps and status history. Agree the allocation order and how partially paid purchases are handled; do not permit arbitrary excess cash refunds.

Example: a return valued at 200 against a purchase still owing 500 can reduce due to 300 with zero cash received. A return against a fully paid purchase can create refundable supplier credit; it is not cash received until a refund transaction is recorded. Report these outcomes separately.

## 4. Branch-wide stock alerts — enhancement to existing stock API

Current frontend stock-alert counts are explicitly page-scoped. Optional medicine metadata is limited, so some rows cannot reliably calculate a medicine-wide low-stock state.

**Proposed extension:**

```http
GET /pharmacy/stocks?branchId=...&stockState=low|out|expiring|expired
GET /pharmacy/stocks/summary?branchId=...&asOf=2026-11-01&expiringWithinDays=90
```

Agree whether summaries follow all current search filters or always cover the whole branch; return that scope explicitly. Suggested fields: total medicines/batches, usable quantity, low-stock medicine count, out-of-stock medicine count, expired batch count and soon-expiring batch count.

Low stock should compare combined usable, unexpired branch quantity per medicine against its reorder level, not each batch independently. Define whether out-of-stock is included in low-stock counts; define overlapping alert groups and expiry-day boundaries. Include medicines with zero batches in out-of-stock results. Add `reorderLevel`, `usableBranchQuantity` and authoritative alert flags to the stock/medicine projection where practical.

## 5. Existing APIs needing fixes/verification — not requests for duplicate endpoints

### Supplier ID validation: confirmed source mismatch (P0)

`prisma/schema/supplier.prisma` generates UUID IDs. `src/modules/pharmacy/supplier/supplier.validator.ts` uses `cuid()` in update/id validation. Align it with persisted UUIDs.

Existing routes affected include supplier detail, update and delete. Frontend already uses PUT for supplier updates. Keep linked-record deletion errors clear; do not solve this by changing frontend-issued IDs.

### Register posting consistency (P0)

Review these existing services together:

- `src/modules/sale/sale.service.ts`: sale creation increments session balance using total paid amount; pending-to-completed paths include a gross-total increment.
- `src/modules/pharmacy/purchase/purchase.service.ts`: direct completed creation decrements using paid amount; pending-to-completed paths include a gross-total decrement.
- `src/modules/customer/customer.service.ts`: auto-allocation updates a linked register in the inspected path, while bulk collection does not have the same register update.
- `src/modules/pharmacy/cash-register/cash-register.service.ts`: close calculates difference from a read expected balance, then updates the session.

Expected behavior to agree and test:

1. Physical drawer cash changes only for actual cash transactions. Card, bank and mobile money are summarized separately.
2. Receiving/completing a previously paid document must not collect or pay its gross value again. Unpaid and partially paid documents must post only actual cash movements.
3. Collection/refund for an old invoice should use the actual current cashier session as appropriate, not silently mutate a closed historical drawer.
4. Auto and bulk collection must follow the same financial/register rules.
5. Closing must atomically verify ownership/branch/status and the reviewed balance/version. Reject stale review with a conflict response, or return an explicit review-required result; do not silently accept a changed expected balance.
6. Account transactions, customer/supplier balances, stock and register movements must commit together or roll back together.

### Existing collection routes (P0 correctness)

Keep `/customers/pharmacy-payment` and `/customers/bulk-sale-payment`; they already exist and are integrated. Define completed-invoice eligibility consistently. Current auto-allocation service excludes rejected invoices but can include other non-completed states; frontend blocks those dues to avoid an unintended lifecycle change.

Apply customer/branch/account authorization, latest-due checks and duplicate invoice detection transactionally. Return one receipt/operation ID, actual collected amount, per-invoice allocations, remaining dues, advance created if any, transaction IDs and session reference. A timed-out client request must be recoverable by operation/idempotency key.

### Opening-stock correction (optional, not a blocker for current features)

`updateOpeningStock` exists internally but has no mounted route in the inspected pharmacy router. If opening entries must be edited, expose a documented correction/reversal flow with original history identity, audit trail and stock-sold/concurrency rules. Do not simply expose an internal updater without defining how historical balances are preserved.

## 6. Shared API conventions required for integration

- Publish OpenAPI schemas/examples, methods, permissions and route paths. Confirm existing numeric-string response conventions; use decimal-safe money (two places) and integer stock quantities.
- Use a consistent success envelope, including `data` and list `meta` (`page`, `limit`, `total`, `totalPages`, optionally `hasNextPage`). Summary totals must cover all matching rows, not just the page.
- Date-only filters use Asia/Dhaka calendar boundaries, inclusive end date. Store timestamps with timezone and document stable ordering/snapshot behavior for statements.
- Every operation requires server-side branch/entity/account authorization. UI permission checks do not enforce access.
- Use idempotency for payments, refunds, returns and stock mutations: same key/body returns the original result; same key/different body is a conflict. Set the supported retention/recovery policy.
- Return explicit errors: 403 unauthorized scope, 404 missing record, 409 stale balance/duplicate transition/conflict, 422 validation or documented business-rule failure. Include machine-readable error codes and field errors where possible.
- Do not silently clamp quantities or payments. Do not turn a failed financial transaction into a successful status/stock update.
- Provide development test cases for partially paid returns, noncash payments, simultaneous sales/stock transfer, two collectors paying the same due, double approval, timeout replay and closed-register behavior.

## Current frontend state

Implemented: POS, sales/due/customer returns, reports, inventory operations, purchases/suppliers, register closing/history, invoice-based customer statement and selected/auto due collection.

Current statements distinguish invoice value, payment, return face value and actual refund. Full print/CSV exports include all filtered rows. Dedicated account advances and supplier purchase returns need the new contracts above.

Validation already completed for the pending frontend code: lint, production build, 50 unit tests and 8 mocked browser suites. Mock tests do not verify the deployed database, account balances or cash-drawer posting. Backend work needs live development acceptance tests before those accounting effects can be claimed verified.

## Additional frontend audit finding: backup authorization

The supplied `src/modules/backup/backup.routes.ts` mounts history, trigger, configuration and download handlers without authentication or permission middleware; `src/routes/index.ts` mounts that router directly. The inspected controller has no equivalent authorization checks. Backend code remains unchanged. Confirm and enforce the intended read/write/download permissions and audit sensitive backup access before live acceptance. The frontend conservatively uses existing settings-read/settings-update permissions for those controls; hiding controls does not secure the API. No new permission key or endpoint has been invented.

The frontend Finance/HR/Admin follow-up is documented in [the audit guide](hr-admin-guide.md). Earlier test counts above describe earlier snapshots; use the current test runner results for the current revision. Live accounting/persistence verification remains pending.
