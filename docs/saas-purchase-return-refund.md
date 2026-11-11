# Purchase Return and Supplier Refund adapters

Completed purchase details now contain their source-scoped return list, server
pagination and a floating search/status/number/date/amount filter. Source purchase,
branch and supplier identity are fixed by the selected owned purchase; no raw ID
fields or implicit first-branch selection are exposed. The default list includes
all dates. Unsupported payment/register filters are not offered for returns.

## Return lifecycle

- purchase:create exposes Create purchase return. It fetches fresh returnable items
  and validates every source item/medicine/batch/tenant tuple. Quantities start
  blank, must be whole and cannot exceed remaining purchase/stock allowance. A
  reason is required. Pending returns reserve allowance without deducting stock.
- purchase:update exposes explicit approval/rejection confirmation. Approval
  deducts stock once, reduces purchase due first and assigns only the remainder
  to supplier credit. Rejection releases reservations without moving stock.
- The pending return value is an estimate. Completed values and due/credit splits
  come from the backend, including its cumulative discount/rounding calculation.
  Purchase due is refreshed after mutations; the UI does not recalculate a ledger.

## Refund lifecycle

A completed return with remaining credit plus purchase:update/account:read exposes
Receive supplier refund. Opening reloads the current credit. Active owned
cash/bank/MFS accounts use the existing limited payment-options projection, with
search/pagination and no tenant-wide balance snapshots. Amount is positive and
capped by fresh refundable credit. Cash requires the user's open branch register.
The form explicitly records money actually received; it never repeats due
reduction. Partial/full refunds update an incoming transaction history and hide
the action when credit is exhausted.

Each create/status/refund has a frozen key/body for unknown-result retries and
blocks double submits/navigation while unresolved. Known conflicts require
reload before another attempt. Proof checks source/return identity, nested items,
cent-exact completed value = due reduction + supplier credit, remaining credit
and a newly returned matching incoming transaction. Lists/details reject foreign
or malformed responses. Scope disposal prevents late result rendering.

## Contract fixes and verification

Prisma serializes PurchaseItem/PurchaseReturnItem quantity as Decimal strings.
Purchase read and create confirmation now accept bounded whole numeric strings;
request quantities remain JSON integers. The actual Decimal(10,2) storage cap is
99,999,999 whole units, enforced in frontend and backend purchase/return DTOs.
Return detail now projects owned incoming transactions without account balances.

Verification: 75 native backend PostgreSQL/Prisma/RLS/HTTP checks, 14 frontend
purchase/return/refund regression tests, actual Next BFF + loopback browser flows,
changed-module lint and production build passed. Browser cases cover allowance
overflow, pending reservations/rejection release, unpaid return reducing due,
paid return producing credit, partial/full incoming refunds, same-key lost-response
replay, once-only stock/money movement, filters/outside dismissal and foreign
response rejection. Mobile refund screenshot was visually inspected.

Work is staged in the tenant `/shops` feature branches. No schema/migration,
main merge, live API/DB write or production flag change occurred. Remaining:
standalone branch-wide return navigation, register management adapters, durable
retry recovery after reload and real deployed two-shop acceptance.
