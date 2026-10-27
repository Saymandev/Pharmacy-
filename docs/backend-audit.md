# Pharmacy POS backend audit for frontend design

**Audit scope:** source-level review of the checked-out `pharmacy-pos-backend` repository. This is an integration and UX contract audit, not a claim that the backend has passed its test suite or a security certification.

## Frontend module map

All API modules are mounted under `/api/v1` and return the shared `{ success, message, data, meta? }` response envelope.

| Frontend area | Backend API surface | Design implications |
| --- | --- | --- |
| First-run setup | `GET /setup/status`, `POST /setup` | Gate the first-run wizard and collect pharmacy, admin, currency/VAT/timezone configuration. |
| Sign-in and access | `/auth/login`, `/auth/me`, `/auth/change-password`; `/users`; `/roles`; `/permissions` | Session bootstrap must use `/auth/me`; hide or disable actions based on role permissions. |
| Branches | `/branches` | Branch selection is a context for sales, stock, purchasing, and registers. |
| Medicine masters | `/pharmacy/medicines`, `/categories`, `/generics`, `/groups`, `/manufacturers`, `/units` | Catalog filters and CRUD use backend IDs; show Bangla and English names where present. |
| Stock operations | `/pharmacy/stocks`, `/stocks/adjust`, `/stocks/transfer`, `/stocks/opening`, `/stocks/bulk-price-update` | Inventory screens need branch, batch, expiry, rack, unit, price/MRP and history-aware confirmation. |
| Suppliers and purchases | `/pharmacy/suppliers`, `/pharmacy/purchases`, purchase status and payment routes | Procurement captures batch/expiry, quantity, cost, selling price/MRP, discount, supplier payment and due. |
| POS and sales | `/sales`, `/sales/:id`, `/sales/:id/payments`, `/sales/due-bills/:patientId` | Separate checkout, sale history, receipt/details, due collection, and payment collection. |
| Returns | `/sales/returns`, `/sales/returns/:id`, `/sales/returns/:id/status` | Support pending/completed/rejected review; completion affects stock, refund and sale balance. |
| Cash register | `/pharmacy/cash-register/active`, register list/detail, `/open`, `/:id/close` | Opening float, expected cash, physical count, variance and closing note need a dedicated shift flow. |
| Customers | `/customers`, `/customers/pharmacy-payment`, `/customers/bulk-sale-payment` | Quick customer lookup belongs in checkout; customer balances and batch due collection belong in customer/finance flows. |
| Reports | `/reports/pharmacy/*`, `/reports/finance/*`, `/reports/overall-summary` | Dashboard and reports should render real API figures with date/branch filters and permission handling. |
| Finance | `/finance/accounts`, income, expense, categories, transactions | Tender rows need valid account IDs; finance screens use transaction/account APIs rather than local-only balances. |
| HR | departments, designations, employees, attendance, leave types/requests, calendars, shifts, rosters and assigned rosters | HR navigation must cover attendance import, leave approval and roster assignment, not just a staff list. |
| Communication and media | notices, notifications, media upload/list/update/delete | Notices, unread state, uploaded media and pharmacy logo/settings have separate flows. |
| Settings and backup | settings get/update/audit log; backup trigger/history/config/download | Show backup configuration, manual trigger, history and download. There is no restore endpoint in the reviewed routes, so do not offer restore in the frontend. |

## POS contracts reflected in the design

### Product search and filters

`GET /pharmacy/medicines` supports paginated search across medicine name, Bangla name, barcode, manufacturer, category, generic and group. It also accepts category, generic, group, manufacturer, unit, dosage form, strength, active/stock and branch filters. The product browser therefore shows those filters, barcode entry, available stock, unit, and sale/MRP price. Batch choice is a separate stock lookup because medicine rows include stock records.

`GET /pharmacy/stocks` exposes branch, medicine, batch, unit, rack, expiry date range, manufacturer and search filters. It does not expose a low-stock-status or expiring-soon filter parameter; those need client-side derivation or a backend endpoint.

### Cart, discounts and tax

- Sale items accept medicine ID, item label, unit, price, MRP, quantity, batch, expiry, per-item `discountPercentage` and `discountAmount`.
- A sale accepts sale-level discount percentage/amount and tax percentage/amount.
- The create-sale service subtracts **discount amounts**. It records percentage fields but does not calculate a percentage discount from them.
- The create-sale service calculates tax as **exclusive** (`taxable amount × tax percentage`) and ignores the supplied `taxAmount`. The update/return paths also read a tax setting and contain inclusive-tax branches, so tax behavior is not consistent across sale lifecycle operations.
- There is no coupon, promotion-rule, loyalty-points, or automatic discount endpoint in the reviewed POS API. The design uses manual percent/fixed discounts only and does not imply coupons or automatic offers.

The UI design can preview percentage discounts, but the request must include the derived amount and percentage together. Discount values must be capped client-side to the line or sale subtotal until backend validation adds upper bounds and negative-total protection.

### Checkout and register

Supported payment methods are `cash`, `card`, `online`, `cheque`, `bKash`, `Nagad`, `Rocket`, and `Bank Transfer`. `payments[]` supports split tender, with each row requiring an account ID, amount and method. Sale status is pending/completed/rejected and payment status is due/partial/paid. Completing a POS sale deducts the selected branch+batch stock; pending sales do not.

The POS design includes branch, cashier, register session, account per tender, paid/due, note and explicit pending/complete actions. The design should require an active register for cashier checkout as a frontend guard until the backend makes it a server-side rule.

### History, returns and customer balances

Sales listing supports invoice/customer search, branch, status, payment method/status, cashier, register session, type, date range, and min/max amount with pagination. Customer due bills, adding payment to one sale and bulk payment across multiple sales are available. Returns support sale lookup, return line items, note, optional account and pending/completed/rejected status; a completed return restores stock and may refund from an account.

The return UI shows original, already-returned and remaining quantities and caps the user-entered quantity. The backend currently needs an authoritative remaining-returnable check before a return is accepted or completed.

## Blocking and high-risk backend gaps found

| Priority | Finding | Frontend/design impact | Recommended backend correction |
| --- | --- | --- | --- |
| P0 | Create-sale validation declares `patientId`; the service/model use `customerId`. The sale controller passes raw `req.body` instead of the parsed `req.validated.body`. | `customerId` is not validated as the formal contract; unknown input survives while the parsed body is ignored. | Make schema, controller and service consistently use `customerId`; pass the parsed body to the service. |
| P0 | When the service looks up the default OPD customer for a sale without a customer, it never assigns that record’s ID back to `customerId`. | A walk-in checkout can reach a required `Sale.customerId` with no ID. | Set the default customer ID and add a service-level test. |
| P0 | Percentage discounts are stored but monetary calculations only subtract `discountAmount`; there are no maximums or subtotal bounds. | The UI can preview a percentage discount, but backend totals can disagree or become negative. | Calculate/validate percentages server-side, validate percentage ≤100 and amount ≤ eligible subtotal, use decimal-safe money math. |
| P0 | Create-sale tax ignores `taxAmount` and does not load the tax setting; update and return calculations load tax config and have inclusive-tax logic. | Receipt totals and refund totals can diverge across create/edit/return. | Centralize tax configuration and one rounding/inclusive policy across sale, update, return and report calculations. |
| P1 | Register is optional in sale creation. `closingBalance` is incremented by all paid amount regardless of cash/card/mobile method. | A checkout can bypass shift opening; cash expected can include non-cash tender. | Require an active session for POS completion and increment expected cash only by cash tender (with explicit cash account rules). |
| P1 | Stock quantity is integer, while sale-item quantity accepts decimals down to `0.01`. | Fractional quantities can fail when stock is decremented or become ambiguous across strip/box units. | Either restrict sale quantities to integers or model unit conversions/fractional stock consistently. |
| P1 | Return creation matches an original item, but the reviewed service does not validate cumulative return quantity against sold quantity; completion increments stock. | Repeated/oversized returns can over-credit and overstate inventory. | Enforce returnable remainder per sale item and batch transactionally at create and completion. |
| P1 | Cashier can create a completed sale without an active session; `payments` can be omitted while `paidAmount` is nonzero, so no account transaction is written for that amount. | Receipt/ledger/register can disagree with the amount the UI says was collected. | Require payment rows for every collected amount and reconcile paid/due; reject overpayment unless change handling is explicit. |
| P1 | Backup routes expose trigger, history, config and download, but no restore operation. | A restore button would promise a backend capability that does not exist. | Add and secure a restore endpoint with auditability before designing a restore workflow. |

These are source-level findings for engineering follow-up. They are not silently papered over by the visual design. Until the backend fixes land, the frontend should send explicit account/tender rows, compute bounded discount amounts, restrict quantities to whole stock units, require an active register in the UI, and display return limits based on the original sale history.
