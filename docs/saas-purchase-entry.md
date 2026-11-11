# Tenant purchase entry

New purchase opens from the gated tenant catalog when purchase:create,
supplier:read and medicine:read are present. It uses the current workspace branch;
supplier and active medicine pickers search server-side and include unregistered
own medicines. No branch is inferred or changed by the form.

Entry supports 1–50 medicine/batch lines with unit, cost, sale price, MRP,
quantity, expiry and rack, line amount discounts, purchase amount discount and
note. Duplicate medicine/batch pairs, invalid dates, fractional/nonpositive
quantities, precision/range violations and nonpositive net totals fail before
submission. BigInt cents avoid floating-point total errors or multiplication
overflow. The backend remains authoritative for ownership, permissions, active
medicines, batch compatibility and business totals.

Review locks the form and displays subtotal after line discounts, header discount,
net and outstanding due. Pending saves without stock; completed receives stock
immediately through the existing backend transaction. This phase deliberately
saves on credit with an empty payments array. Payment entry, purchase list/detail
and draft status actions are subsequent adapters, not exposed by this BFF change.

Only gated POST /pharmacy/purchases is allowed. The BFF strictly validates all
nested fields and rejects owner/ledger/stock overrides and payment injections.
Returned purchase/shop/branch/supplier/items/amounts must match the request before
confirmation. One key/body survives uncertain responses, with frozen details and
same-request retry; double submits are blocked. Scope disposal rejects late saves.
Browser reload recovery of pending keys remains future work.

Verification: 75 native backend PostgreSQL/Prisma/RLS/HTTP checks passed using a
new local fixture database, including purchase ownership, once-only receive,
discount/due calculations, statuses, payment/refund and audit rollback regressions.
Seven frontend purchase/supplier/master unit tests passed. Actual Next BFF browser
fixtures verified pending and completed purchase creation, exact discounts/due,
review lock, double submit, same-key lost-response retry, supplier/medicine pickers
and mobile overflow. The mobile review screenshot was visually inspected.
Changed-module ESLint and production build passed. No live DB, migration,
configuration switch, backend source change or main merge was performed.
