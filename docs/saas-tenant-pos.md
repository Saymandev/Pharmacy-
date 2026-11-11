# Tenant POS checkout preview

The selected `/shops` workspace now opens an isolated full-screen tenant POS.
It uses only the tenant BFF; no legacy POS API, stored legacy branch, caller user
or tenant header is used. Access requires the write gate, `sale:create` and
`medicine:read`; checkout additionally verifies `account:read`,
`cash-register:read`, the current actor's open register and matching payment-account
type in the selected branch. Backend remains authoritative at commit.

Supports **fully paid walk-in sales** and **registered-customer full, partial or
fully due sales**, with one payment account plus optional existing customer
advance. Server-paginated customer search/detail requires `customer:read`;
applying advance additionally requires `customer:update`. Customer creation,
advance deposits/refunds and a ledger screen, mixed payment accounts, pending
sales, historical receipts and sale returns remain separate increments. The BFF
exposes only customer list/detail reads and sale creation for this workflow.

The compact catalog uses server name/generic/barcode search and pagination, card
and list modes, active owned branch stock, expiry screening and FEFO default
batch selection. Cart is collapsible; its batch and quantity controls are compact.
F2 focuses search, ArrowDown enters results, Enter adds the focused medicine,
quantity Enter returns to search, F8 toggles cart, F4 opens checkout. Native quantity
inputs support arrow increments. Switching browser focus preserves the active
cart instead of remounting the workspace. Branch changes dispose that workspace;
carts are not copied across shops, branches or user sessions.

Checkout contains discount amount, VAT percentage, calculator, order summary,
method/account picker and one Complete sale action. VAT rounds half-up in integer
cents after discount, matching the backend. Walk-in funding must equal the exact
net total. Registered customers may set Collect now to zero or a partial amount;
blank collects the remaining total after advance. Advance is capped by the
inspected wallet and permission. Customer detail is refreshed before constructing
a new save request; a reduced wallet blocks saving. Backend ledger locking is
still authoritative if that balance changes after the refresh. A zero-money sale
needs no account selection and creates no payment journal entry. The UI records
no tendered change or new advance deposit.

The same frozen JSON and idempotency key are retained during an ambiguous save.
Fields and exit are locked until replay yields a verified committed receipt or a
known rejection. Retrying an ambiguous request never refreshes the wallet or
changes the frozen body. A stock conflict preserves the cart and allows correction.
Cart clears only after validating own tenant/branch/actor and selected customer,
status, cash-plus-advance paid amount and exact remaining due, discount/VAT/net
and committed stock lines. A due checkout uses red borders/amount indicators;
its receipt has a bold red DUE stamp and outstanding amount, including in print.
Paid including advance is labelled separately from advance applied. The receipt omits batch and
payment-journal details and prints an isolated text-content DOM clone, with no
legacy API lookup or interpolation of HTML from medicine/shop names.

Verification: 7 policy/transport tests and actual Next BFF + local upstream Edge
browser workflow cover barcode query, quantity/cart keyboard, list mode, focus
preservation, register/account checks, calculator, totals, known stock conflict,
lost response replay once, foreign-actor receipt rejection, receipt content and
mobile light/dark. A second registered-customer browser workflow covers server
search/detail, stale wallet prevention, partial cash plus advance, full due
without an account, exact-key replay without another wallet read, foreign
customer rejection, missing advance permission and due receipt/mobile themes.
Native PostgreSQL commerce regression (**96 passing** across the composed suite) verifies
the frontend-shaped walk-in cash payload: 2 × 15, discount 1, VAT 5%, net 30.45,
one cash entry and stock decrement, unchanged on replay. It also verifies a 30.45
registered invoice funded by cash 10 plus advance 5, due 15.45, exact ledger/account/
drawer changes, revoked permission on replay, stale advance rollback, advance-only
settlement and a fully due invoice with no cash movement. Changed-code ESLint,
TypeScript and production build pass.

All preview gates remain as before. Feature branches only; this phase does not
merge main, seed/grant live roles, apply SQL, contact a production database or
deploy. Tenant-only navigation composition, rollout contracts and two-shop live
UAT remain prerequisites for release. Real account/stock/register state may
change after preview; rejection is shown and never bypassed by client totals.
