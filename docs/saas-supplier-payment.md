# Supplier payments from completed purchases

Pay supplier appears on a completed purchase with positive due when the existing
write flag, purchase:update and account:read are present. Opening the form reloads
the purchase and its transaction projection. The full-due button receives focus;
the user explicitly selects a payment account. Partial and full payments use
cent-safe positive amounts capped by the fresh displayed due. Backend final
validation protects against concurrent payments, changed due and account balances.

Account search/pagination uses only GET finance/accounts/payment-options with the
working branch and cash/bank/MFS type. Search, page or method changes clear the
selection. Every option must match tenant identity/type and the limited projection;
balance snapshots are rejected. Cash selects cash; bKash/Nagad/Rocket select MFS;
card/online/cheque/Bank Transfer select bank accounts. Backend remains authoritative
for active ownership, method compatibility and permission revocation.

Cash requires exactly one current user's open register in this branch plus enough
register and account funds. The form explains this prerequisite; it does not
create/open a register or infer one. The existing payment service enforces it
inside its transaction. A known rejection requires reloading purchase/accounts.

POST purchases/UUID/payments accepts only accountId, amount, paymentMethod and note.
The BFF rejects tenant/branch/ledger overrides and exposes no full account admin
route. Same-origin cookie and tenant URL binding remain. One frozen payload/key
survives unknown results; double submit and background purchase navigation are
blocked. Success requires an owned purchase result, appropriate paid/due status
and a newly returned matching outgoing transaction. Concurrent legitimate payments
may produce additional rows; backend operation keys enforce exactly-once behavior.
After confirmation, due/paid and payment history refresh; paid purchases hide Pay.

Backend change: payment-options now also selects tenantId, enabling the UI to
validate identity without balances. No schema/migration or deployment changes.

Verification: 98 native backend PostgreSQL/Prisma/RLS/HTTP checks passed, including
owned payment projection, branch denial, cash/register/account invariants,
overpayment/concurrent payments and transaction/replay rollback cases. Nine frontend
purchase/payment unit tests passed. Actual Next BFF browser fixtures cover foreign
account rejection, missing cash register, blocked overpayment, partial bank then
full cash, committed-but-lost response replay, once-only outgoing amount and payment
history. Mobile screenshot was visually inspected; changed-module lint and production
build passed. No real/live DB or API was used by verification.

Remaining: Purchase Return/Supplier Refund UI, register management adapters,
durable key recovery after reload and real deployed two-shop acceptance.
