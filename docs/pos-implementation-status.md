# POS frontend implementation status

Backend source at `/workspace/pharmacy-pos-backend-main` is an API reference only. All its original files remain unchanged. User will test live integration against the supplied development API.

## Implemented

- Branch-aware product/name/generic/barcode search and supported filters.
- Preserve backend envelope pagination metadata so later catalog pages remain reachable.
- Arrow keys and Enter select a name-search result; exact barcode matching, F2 search, F3 queued barcode mode and F4 checkout.
- FEFO batches, expired/invalid/wrong-branch stock exclusion, positive whole-unit quantities, duplicate-batch guards and checkout revalidation.
- Move to the next available batch after the earlier batch is fully in the cart.
- Prevent mixing branches; hold a cart under its original stock branch.
- In-tab, branch-scoped hold/resume preserves items, customer, discounts and tender. It does not persist across refresh/navigation or reserve stock.
- Bounded item/order discounts, tax controls, split tenders, partial/zero payment and due.
- Cash change is deducted from cash allocation; only applied payments are posted. Reject invalid/negative tender and non-cash overpayment.
- Session open/close/history requests and pending/completed sale actions.
- Synchronous submission lock blocks duplicate in-flight posts; no automatic sale retry.
- Correctly unwrap the backend's `{ data: { sale: ... } }` create response.
- Receipt uses returned invoice, item totals, netPrice, paidAmount and dueAmount, including Decimal-string zeroes.
- Shared 58/80 mm receipt preview and saved receipt reprint from sales history. Historical cash tender/change is not invented because it is absent from the saved backend model.
- Bengali controls, mobile checkout and keyboard accessibility improvements.

## Verification

`npm test`: 62 unit/contract tests. `npm run lint`, TypeScript and production build pass. Twelve browser regression scripts use actual backend response shapes with synthetic fixtures; they verify frontend behavior without creating real records. Browser results and manual checklist are described in [frontend testing](frontend-testing.md).

## Live acceptance remains with the user

Verify login, sale creation, inventory decrement, concurrent stock changes, financial postings, due collection, returns/refunds, register reconciliation, and printed receipt totals against development data. Mocked tests do not prove these backend effects.

The uploaded backend has a customerId/patientId schema inconsistency and a default OPD lookup without assignment. The current controller passes raw request bodies; do not assume selected customerId is always stripped. These findings belong to the backend developer. Server stock/expiry/return validation and financial rounding also require live verification.

Pack/strip/piece conversion factors, refresh-token rotation, backup restore and sale retry idempotency are not established by the uploaded contract. The frontend does not invent these APIs or conversion factors.

The [API inventory](api-coverage.md) enumerates 200 active backend routes and candidate frontend files. Text references are not proof that all workflows have passed acceptance.

Workspace permission checks and read-only catalog setup are described in [workspace access](workspace-access-guide.md). The [live development checklist](live-pos-acceptance.md) records expected cash/stock scenarios separately from completed mock tests.

## Finance/HR/Admin frontend follow-up

Read-scoped HR/setup/roster/Admin/access tabs and form options, action checks, validation and duplicate-submit locks are covered in [the audit guide](hr-admin-guide.md). Finance/HR/Admin Bengali coverage is extended without changing backend enum values. This work does not implement the missing Stock History, Purchase Return/Supplier Refund or full Customer Advance Ledger APIs. Live verification remains deferred; older counts above belong to their original snapshot.
