# Tenant walk-in POS checkout preview

The selected `/shops` workspace now opens an isolated full-screen tenant POS.
It uses only the tenant BFF; no legacy POS API, stored legacy branch, caller user
or tenant header is used. Access requires the write gate, `sale:create` and
`medicine:read`; checkout additionally verifies `account:read`,
`cash-register:read`, the current actor's open register and matching payment-account
type in the selected branch. Backend remains authoritative at commit.

This increment supports **fully paid walk-in sales**, with one selected payment
account. Customer selection, credit/due, customer advance, mixed payments, pending
sales, historical receipts and sale returns are separate next increments. The BFF
intentionally does not expose those extra mutations through this contract.

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
net total. The UI records no tendered change or advance balance.

The same frozen JSON and idempotency key are retained during an ambiguous save.
Fields and exit are locked until replay yields a verified committed receipt or a
known rejection. A stock conflict preserves the cart and allows correction. Cart
clears only after validating own tenant/branch/actor, status, paid/due amounts,
discount/VAT/net and exact committed stock lines. The receipt omits batch and
payment-journal details and prints an isolated text-content DOM clone, with no
legacy API lookup or interpolation of HTML from medicine/shop names.

Verification: 4 policy/transport tests and actual Next BFF + local upstream Edge
browser workflow cover barcode query, quantity/cart keyboard, list mode, focus
preservation, register/account checks, calculator, totals, known stock conflict,
lost response replay once, foreign-actor receipt rejection, receipt content and
mobile light/dark. Native PostgreSQL commerce regression additionally verifies
the frontend-shaped walk-in cash payload: 2 × 15, discount 1, VAT 5%, net 30.45,
one cash entry and stock decrement, unchanged on replay. Changed-code ESLint,
TypeScript and production build pass.

All preview gates remain as before. Feature branches only; this phase does not
merge main, seed/grant live roles, apply SQL, contact a production database or
deploy. Tenant-only navigation composition, rollout contracts and two-shop live
UAT remain prerequisites for release. Real account/stock/register state may
change after preview; rejection is shown and never bypassed by client totals.
