# Tenant reports preview

Open `/shops`, select the working branch in Settings, then Open tenant reports.
The manager uses only the selected shop and branch. Summary and six detail
datasets cover sales, purchases, collections, operational income/expenses and
account movements. Existing legacy reports are separate.

Filters use Dhaka calendar dates, at most 366 inclusive days ending today or
earlier. Detail search is literal document-reference search on the backend.
Pagination is server-side. Metadata verifies the effective tenant, branch,
period, dataset, cutoff and timezone before displaying records. Invalid or failed
responses clear the report and prevent export. Changed filters disable download
until applied.

Sales recognition uses completion date. Collections distinguish same-day
receipts, previous-day dues and refunds. Advance application is separate from
new receipts. Outstanding due includes invoices before the period start.
Period returns and reversals can produce negative totals; these are supported.
These figures are not profit or current account/wallet balances.

Read requires `report:read`; download additionally requires `report:export`.
Exports use a fresh, audited backend document snapshot of all matched rows,
independent of the visible page. Above 5000 rows, the server rejects the export.
The frontend verifies count/completeness and scope, then creates CSV/PDF locally.
Session invalidation cancels delivery. CSV text is formula-prefix protected.
Backend audits generation, not proof of completed delivery to a user.

Verification:

- `node --test tests/tenant-reports.test.mjs tests/workspace-client.test.mjs`
- `node tests/run-tenant-reports-browser.cjs`
- Changed-file ESLint and production build.
- Backend: `npm run test:tenant-reports` (disposable PostgreSQL, no live database).

No production/router mount, migration, write gate or deployment is changed.
Stock/COGS/profit, specialized reports, as-of account/wallet reconciliation and
release/UAT work remain separate tasks.

Verified: 41 combined frontend unit checks, actual Next BFF/Edge coverage for all
six datasets, complete filtered CSV, a downloaded/rendered one-page sample PDF,
mobile light/dark, errors and export permissions; changed-file ESLint and build
pass. Backend composed reporting suite passes 147 checks. The repository-wide
lint's 15 pre-existing legacy-panel/test-runner errors are unchanged.
