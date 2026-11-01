# Frontend testing and handoff

## Start locally

Use Node.js 24 LTS. The frontend runs on port **3000**.

```bash
npm ci
cp .env.example .env.local  # only if you do not already have local configuration
npm run dev -- --port 3000
```

Set `BACKEND_API_URL` in the ignored `.env.local` to `https://hms-srv-dev.genify.live/api/v1` or the backend developer's chosen origin. Both origin-only and `/api/v1` URLs work. Do not put login credentials in source files. Running the frontend locally uses your own machine's backend connectivity; the cloud egress restriction does not establish whether your local connection works.

Backend source is an API reference only and has not been changed. Use a development account and development data for mutation tests. A screen rendering or a mock test does not verify database, payment ledger, permissions or inventory behavior on the real API.

## Automated checks

```bash
npm test
npm run build
npx tsc --noEmit
# Start the built frontend in a separate terminal:
npm run start -- --port 3000
# Then run the browser regression tests:
npm run test:browser
```

Browser tests use Playwright with installed `/usr/bin/chromium` where available, or its bundled browser. On your own machine, install that browser with `npx playwright install chromium` if needed. `CHROMIUM_PATH` selects another executable and `POS_TEST_BASE_URL` selects another frontend origin. Browser tests intercept API requests with synthetic fixtures, including actual backend envelope shapes; no operational records are written to a real backend.

The contract tests cover batch expiry/FEFO and stock bounds, tender/change allocation, split payment, due, nested sale-create response, Decimal-string totals, envelope pagination and API base URL normalization. Browser tests cover checkout payload/receipt, hold/resume, duplicate batch prevention, shortcuts, persisted invoice reprint, admin password reset and customer pagination.

## Manual acceptance checklist

Check desktop, narrow mobile and Bengali UI where relevant. Record the API response when a test fails; never share passwords, cookies or access tokens.

| Area | Cases to verify against your development backend |
| --- | --- |
| Setup and login | Existing setup redirects correctly; login, invalid credentials, current-user load, protected page refresh, sign-out and change-password work. |
| Branches and access | Switch branch, create/edit branch, role permissions, create/edit/activate/deactivate user, role assignments, admin password reset, role creation/update/deletion. Repeat with a restricted cashier account. |
| POS search | Name/generic/barcode search, exact barcode scanner input, ↑/↓ + Enter selection, F2 search and F4 checkout; product filters and loading more than one catalog page. |
| Stock and batches | Expired/empty/wrong-branch batches excluded; FEFO selected; exhaust the first batch then use the next; change batch without duplicates; reject excess/fractional quantities. |
| Cart | Add/remove/change quantity, item discount, order fixed/percent discount, tax; hold one cart, serve another, resume with its customer/payment; held carts are tab-memory only and do not reserve stock. |
| Register | Open, detect an existing session, close with actual balance/note, view history and linked sales. Compare backend register totals with actual cash/card/mobile collections. |
| Cash checkout | Sale 75.50, tender 100: apply 75.50 and return 24.50. Check invoice, saved totals, receipt and ledger. |
| Split payment | Cash + card/mobile across accounts, exact/partial/zero payment, reject non-cash overpayment; confirm each account receives only its applied amount. |
| Save sale | Completed vs pending status, stock effect, discounts/tax, correct customer, due/payment status, invoice/date and duplicate-click protection. Never blindly retry a timed-out sale: inspect sales history first. |
| Receipt | Saved backend Decimal values and invoice; print fresh receipt, reopen sales history and reprint. Saved zero amounts must remain zero. Historical cash tender/change cannot be reprinted because the backend does not persist it. |
| Sales and dues | Filters, date boundaries, multiple pages, detail load, pending complete/reject, collect part/all due, correct account. |
| Returns | Original invoice lookup, batch-specific remaining return quantities across previous requests, pending/approved/rejected state, refund account and stock/financial effects. |
| Catalog | Medicines and category/generic/manufacturer/group/unit setup; create/edit/deactivate/delete and import where exposed; validation and duplicate values. |
| Inventory | Branch filters, batch/expiry/low-stock information, opening stock, adjustment, transfer and history with account recovery where applicable. |
| Purchases and suppliers | Supplier create/edit/delete, medicine/batch entries, discount, pending/receive/reject, paid/due, further supplier payments and stock posting. |
| Customers | CRUD, filters, more than one page, customer detail, due invoices, selected/bulk due collection and branch/account attribution. |
| Finance | Accounts and balances, income/expense categories and subcategories, entries, transactions, consultation charges and supported filters. |
| HR setup | Department/designation, leave type and annual calendar CRUD; branch filters, pagination and required fields. |
| HR operations | Employee CRUD/status, leave request/review, shifts/rosters/assignment and attendance/time-card views. BioTime webhooks are server integrations, not manual frontend actions. |
| Reports | Branch/date filters and displayed totals for each report; compare with the same backend report response, including empty and permission-denied states. |
| Admin | Notification read/read-all, notice create/detail/delete and audiences, media upload/edit/delete, settings, audit list, backups/history/download/configuration and branch CRUD. |
| Failure states | Invalid fields show backend field messages; 401/403, offline/network error, missing entity, empty list and slow responses are visible and recoverable without losing or duplicating a sale. |

## Known limits requiring explicit validation

- Live API acceptance remains unverified in this cloud task. The user will run the real integration tests.
- The uploaded backend's sale schema uses `patientId` while its service uses `customerId`; the controller currently forwards raw body. Its default OPD lookup does not assign the found ID. Frontend sends the actual customerId when available; backend ownership of these findings remains with its developer.
- Server-side concurrent stock/expiry enforcement, return/refund limits, rounding and financial posting must be confirmed on the running backend. Frontend bounds cannot replace transaction-level validation.
- Refresh-token rotation, backup restore, automatic retry idempotency and pack/strip/piece conversion are not established by this backend contract. Do not silently invent endpoints or conversion factors.
- The route inventory lists every discovered active route. Candidate-file references in the report do not prove every field/action is complete; use this checklist and the inventory to record live acceptance or gaps.

Inventory workflows and the missing history contract: [inventory guide](inventory-guide.md).

Sales/due/return workflows and API limitations: [sales guide](sales-returns-guide.md).

Reporting controls, export/print behavior and date semantics: [reporting guide](reporting-guide.md).

Full route inventory: [API coverage review](api-coverage.md). Current POS detail: [POS tracker](pos-implementation-status.md).

Purchase and supplier workflow: [guide](purchase-supplier-guide.md). Regression checks cover fresh due/status validation, payment deduplication, supplier PUT updates and linked-record deletion errors using mocked API responses.
