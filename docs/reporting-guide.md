# Reporting workflow

## Using reports

1. Open Reports. Pharmacy summary starts with **Today**, using Asia/Dhaka dates.
2. Choose Today, Yesterday, Last 7 days, This month, Last month or custom From/To dates.
3. Choose the active branch, another available branch or all available branches. Apply filters.
4. Select a report. The heading always states the applied dates/branch and the load time. Editing filters does not relabel old data; apply them first.
5. Summary cards show every amount/count supplied by the backend, including zeroes, Decimal strings and negative profit.
6. Detailed tables show all columns. Use Previous/Next and Rows per page. Group names and backend subtotals stay attached to their invoice/expense rows.
7. Export CSV downloads **all fetched rows**, not just the displayed page. Summary-only reports also export. Filter context and generated time are included, numeric values remain spreadsheet-friendly and formula-like text is escaped. Individual tables can be exported separately.
8. Print report prints the full fetched tables with repeated column headings, not just the current table page. Use landscape in the print dialog for wide reports.

## Choosing the right report

| Report | What it represents |
| --- | --- |
| Pharmacy summary | POS sales/purchases, returns, expenses, cost of goods and profit as aggregated by the backend. |
| All operations overview | All sale types, including hospital/services. Its scope differs from pharmacy-only totals. |
| Sales detail | Indoor/outdoor POS sale and return rows, using creation dates. |
| Purchase detail | Pharmacy/hospital/clinic purchase and return groups. |
| Due collection | Payments made on a later Dhaka calendar day than the original sale; filter uses payment date. Same-day later payments are excluded by this backend definition. |
| Income | The backend's grouped income rows; its default excludes POS. An explicit sale-type filter is available. |
| Expenses | Expense-category rows, using expense dates. |
| Pharmacy collection | POS payment receipts/refunds grouped by invoice, using transaction date. |
| Hospital collection | Non-POS payment receipts/refunds grouped by invoice, using transaction date. |
| Doctors | Visits, appointment amounts and consultation commissions supplied by the backend. |

Sales and collections are different measures. A sale, later due payment and refund may fall in different reporting periods. Counts are not formatted as currency. Frontend never recomputes profit or replaces backend totals with inferred numbers.

## Failure and access handling

Changing report/branch/date selection cancels older requests and prevents old results from appearing under a new heading. Failed reports clear the old view; Retry requests that exact selection again. Export/print are disabled while there is no current result or filters have unapplied changes. Users without `report:read` see an access message and do not request reporting endpoints.

## Validation

`npm test` includes reporting-model coverage for all summary fields, Decimal values, negative profit, grouped invoice/expense rows, more than 100 records, all columns, complete/safe CSV and Dhaka date presets. `npm run test:browser` includes reporting filters, exports, table paging, full print, request cancellation, error/export handling, permission denial and mobile layout with mock API fixtures.

These checks verify frontend behavior. Real totals still need comparison against the running backend and development records.

## Backend findings for its developer

The uploaded backend is unchanged. Its overall-summary service uses `Date.setHours` in the server's local timezone; other reports explicitly interpret date-only values as Dhaka dates. Around midnight, overall and pharmacy reports may therefore disagree if the server timezone differs. The uploaded report services also reference some patient/doctor/hospital fields absent from parts of the uploaded pharmacy schema. Confirm these against the running backend rather than masking an API failure in the frontend.
