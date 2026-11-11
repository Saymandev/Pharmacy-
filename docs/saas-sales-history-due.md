# Tenant sales history and due collection

Selected `/shops` workspaces now offer Sales history and a direct Collect due
entry, independently of medicine access. `sale:read` lists only current tenant POS
invoices in the selected branch; the quick due view fixes `status=completed` and
`hasDue=true`, including partial and fully due invoices. Rows are full clickable
buttons and load fresh scoped detail. Server filters cover invoice/customer/phone
search, status, payment status, positive/zero due, exact invoice number, original
invoice date range, and the selected invoice customer's other sales. Filter
popovers dismiss outside; pages never invent aggregate totals.

List/detail customer projection contains only id, tenant, name, phone and walk-in
flag, so sale readers need no customer administration permission. Wallet/profile
data is not included. Detail also returns scoped incoming collections, original
advance applied, completed return value and return due reduction. Frontend checks
original totals, line discounts, customer/branch ownership and the identity
`paid + outstanding due + return due reduction = original net`.

Collection requires the write gate, `sale:update`, `account:read`, a matching
active account and (for cash) an own open register with register read permission.
Quick due rows open collection directly, with the full current due prefilled and
Pay full due focused. History also provides a collect action on eligible details.
There is one submit action, no second confirmation dialog. Before a new request,
the invoice is refreshed; an amount above its changed due is blocked. Backend
serialization/caps remain authoritative if another payment commits afterwards.

Unknown responses freeze the form and parent exit and retain exactly the same
body/key. Replay is verified against the original invoice/customer/branch, amount,
new matching incoming transaction, paid/due progress and unchanged invoice date.
It does not reread and recalculate a possibly already-paid request. Success reloads
current detail/list. Collection changes money/due, never stock or the invoice date;
the transaction receives today's timestamp for collection-date reporting.

Receipt preview/isolated print is shared with checkout. It shows current settlement,
advance usage and return adjustments with a returned-invoice label when relevant,
plus the red DUE stamp if money remains. It contains neither batch labels nor
collection forms/journal controls. Pending/rejected invoices cannot be printed as
completed receipts or collect payments through this UI. Status mutation is not
exposed in this BFF increment.

Verification: 5 dedicated policy/transport tests plus actual Next BFF + local
upstream Edge flow verify server search/date filters, clickable rows, quick-due
focus, stale due prevention, response-loss retry once, foreign response rejection,
original invoice date, no stock mutation, receipt separation, read-only controls
and mobile light/dark. Native PostgreSQL/Prisma/HTTP suite has **98 passing** cases,
including original-day filters vs current-day collection, concurrent payoff caps,
projection privacy, return due reconciliation and archived record denial. Changed
code lint, TypeScript and production build pass.

Feature branches only; no live writes, merge, SQL deployment or gate changes.
Global due access across the final tenant navigation shell, pending-sale actions,
sale-return/refund screens, export and release UAT remain separate work. This
preview's Collect due entry is scoped to the selected shop workspace.
