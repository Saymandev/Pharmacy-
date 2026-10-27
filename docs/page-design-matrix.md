# A–Z application page design matrix

Page scope is derived from the route modules in the backend repository. Every page follows the responsive rules in `responsive-design.md`; the matrices below record the primary task on each screen and what changes per device.

## Setup and access

| Page | Backend contract | Desktop / tablet / mobile design |
| --- | --- | --- |
| Setup status and wizard | `GET /setup/status`, `POST /setup` | Desktop: centered 3-step wizard with pharmacy/admin/settings summary. Tablet: stepper above one form. Mobile: one step per screen, sticky Back/Continue. |
| Sign-in and password change | `/auth/login`, `/auth/me`, `/auth/change-password` | Desktop split-brand/login form. Tablet compact centered form. Mobile single-column form and large password controls. |
| Users | `/users` list/detail/create/update/delete | Desktop searchable table. Tablet filter sheet and compact rows. Mobile user cards, detail sheet and full-screen create/edit form. |
| Roles and permissions | `/roles`, `/roles/permissions`, `/permissions` | Desktop role list beside grouped permission matrix. Tablet collapsible permission groups. Mobile role picker then one permission group at a time, with sticky save. |
| Branches | `/branches` list/detail/create/update/delete | Desktop branch table and detail panel. Tablet card list with detail drawer. Mobile branch cards with one focused edit form. Branch context remains visible in the app shell. |

## Pharmacy catalog and inventory

| Page | Backend contract | Desktop / tablet / mobile design |
| --- | --- | --- |
| Medicine catalog | `/pharmacy/medicines` list/detail/create/update/delete | Desktop table with search + collapsed filters. Tablet card/table hybrid and filter sheet. Mobile medicine cards, quick search and bottom-sheet filters. |
| Medicine create/edit | `/pharmacy/medicines` POST/PATCH | Desktop grouped master-data form. Tablet two-column form collapses to one column. Mobile step sections for identity, classification, price and opening stock. |
| Categories, generics, groups, manufacturers, units | `/pharmacy/categories`, `/generics`, `/groups`, `/manufacturers`, `/units` CRUD | Desktop shared master-data table pattern. Tablet filter drawer. Mobile compact cards and focused add/edit sheet. |
| Medicine import | `POST /pharmacy/medicines/import` | Desktop upload, column preview and row-level errors. Tablet preview table becomes scrollable. Mobile import summary and error list are card-based; upload/confirm stay explicit. |
| Batch stock and expiry | `/pharmacy/stocks` | Desktop batch table with expiry and rack. Tablet collapsible details. Mobile medicine → batch cards with expiry, quantity and rack visible before opening detail. |
| Stock adjustment | `POST /pharmacy/stocks/adjust` | Desktop stock context beside adjustment form. Tablet stacked summary/form. Mobile one adjustment per focused screen with before/after quantity confirmation. |
| Stock transfer | `POST /pharmacy/stocks/transfer` | Source branch/batch and destination branch are distinct steps; review quantity and destination before submit on all devices. |
| Opening stock | `POST /pharmacy/stocks/opening` | Medicine, branch, batch, expiry, quantity, cost/MRP and unit in a guided form; mobile uses grouped steps and sticky save. |
| Bulk price update | `PATCH /pharmacy/stocks/bulk-price-update` | Desktop editable table with changed-row summary. Tablet row cards. Mobile one product/batch editor at a time with a pending-change count. |

## Suppliers, procurement and POS

| Page | Backend contract | Desktop / tablet / mobile design |
| --- | --- | --- |
| Suppliers | `/pharmacy/suppliers` list/detail/create/update/delete | Desktop directory and purchase-history detail. Tablet directory with side sheet. Mobile supplier cards, contact actions and full-screen details. |
| Purchase entry | `POST /pharmacy/purchases` | Desktop supplier + line items + totals. Tablet collapsible supplier header. Mobile supplier → batch items → discount/payment review steps. |
| Purchase history/detail | `/pharmacy/purchases`, `/pharmacy/purchases/:id` | Desktop filterable invoice table. Tablet filter sheet. Mobile purchase cards, invoice details and receipt actions. |
| Purchase status/payments/returns | purchase status/payment routes and related return data | Status/reconciliation actions show existing due and account before mutation. Returns show purchased batch/expiry and supplier credit/refund state. |
| POS, checkout, history and sale returns | `/sales`, sale payment/due/return routes; `/pharmacy/cash-register/*` | See `pos-design-spec.md` and responsive POS board: persistent desktop cart, collapsible tablet drawer, collapsed mobile cart bar, full-screen mobile checkout. |
| Cash-register open/active/close/history | `/pharmacy/cash-register/active`, register routes | Desktop register summary and cash count. Tablet compact register drawer. Mobile opening/closing are focused screens; physical cash count and variance get a review step. Non-cash tender remains separated visually. |

## Customers, finance and reports

| Page | Backend contract | Desktop / tablet / mobile design |
| --- | --- | --- |
| Customer directory/profile | `/customers`, `/customers/:id` | Desktop searchable list with balance and recent sale detail. Tablet detail drawer. Mobile customer cards, full-screen profile and minimal contact summary. |
| Customer due/bulk collection | `/customers/pharmacy-payment`, `/customers/bulk-sale-payment`, sale due/payment routes | Select customer/invoices, allocate against due and choose account/method. Mobile keeps outstanding balance and collected total sticky at bottom. |
| Finance accounts | `/finance/accounts` CRUD | Desktop accounts table and balance detail. Tablet cards and edit sheet. Mobile account cards with transaction history. |
| Income/expense and categories | `/finance/income`, `/finance/expense`, category CRUD | Desktop form + history list. Tablet collapsible filters. Mobile guided entry forms and summary cards. |
| Transactions | `/finance/transactions`, withdraw/transfer/update | Desktop ledger with filters. Tablet filter drawer. Mobile transaction cards and focused transfer/withdraw review. |
| Pharmacy and finance reports | `/reports/pharmacy/*`, `/reports/finance/*`, `/reports/overall-summary` | Desktop KPI/chart/report table. Tablet charts stack. Mobile KPI cards + readable single chart and filter sheet. All figures are API-sourced and permission-gated. |

## HR, communication, settings and backup

| Page | Backend contract | Desktop / tablet / mobile design |
| --- | --- | --- |
| Departments/designations/employees | HR department, designation and employee routes | Desktop directory with profile panel. Tablet cards and detail drawer. Mobile cards with compact employee info and full-screen forms. |
| Attendance and import | attendance routes and `POST /attendance/import/:branchId` | Desktop calendar/list toggle and import preview. Tablet week view. Mobile day/week agenda and row-level attendance details. |
| Leave types, annual calendar and leave approval | leave-type/calendar/leave routes | Desktop calendar plus approval queue. Tablet agenda and drawer. Mobile leave cards, date-first forms and explicit approve/reject detail. |
| Shifts and rosters | shifts, rosters, assigned-rosters CRUD | Desktop weekly roster grid. Tablet compact week with horizontal day navigation. Mobile day/employee agenda; assignment is a focused form. |
| Notices and notifications | `/communication/notices`, `/communication/notifications` | Desktop list/detail split. Tablet drawer detail. Mobile notice cards, full-screen detail, read-one/read-all actions. |
| Media library | `/media/upload`, `/upload-multiple`, list/detail/update/delete | Desktop grid and metadata panel. Tablet responsive grid. Mobile single-column asset cards and upload progress queue. |
| Settings and audit logs | `/settings`, `/settings/:name`, `/settings/audit-logs/all` | Desktop section navigation and audit table. Tablet accordion sections and filter sheet. Mobile one setting group per screen, with saved/dirty state. |
| Backup configuration/history | `/backups/config`, `/backups/history`, `/backups/trigger`, `/backups/download/:id` | Desktop schedule/config, trigger and history. Tablet stacked cards. Mobile configuration form and backup history cards. No restore control is designed because the backend has no restore route. |

## Shared page rules

- Route visibility and action controls follow `/auth/me` role permissions; frontend hiding is convenience, backend permission checks remain authoritative.
- List pages share search, applied-filter chips, result count, pagination, loading/empty/error states and preserved filter state.
- Forms mirror backend validators, and backend inconsistencies are flagged in `backend-audit.md` rather than disguised with invented fields.
- Payment/stock/return/backup actions use a review step on every device; the review itself reflows into a sheet or full-screen step on small screens.
