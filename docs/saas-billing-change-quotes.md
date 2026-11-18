# Billing plan change and negotiation UI

The shop billing portal offers eligible plan selection, a server-priced renewal
preview, and a negotiated agreement request. Dedicated plan audiences and other
shops' data never appear in the catalog. Quotes show term dates, tax, total,
expiry, overdue and capacity-review messages. These are review estimates;
submission does not activate a plan or confirm payment.

The existing billing read/request capabilities and preview/write gates remain
mandatory. Unknown quote or request results freeze the command and parent close
action; retry preserves the exact key/body. Read-only users can view retained
request quotes. Operators view the linked quote through a separate shop-scoped
platform endpoint. Both BFFs reject extra client price/timing/privilege fields.

Run `npm run test:billing-portal` for policy checks and the actual Next BFF browser
fixture. Run `npm run test:billing` for existing operator billing regression.
Build separately before `NEXT_BROWSER_MODE=start` browser verification.

The default backend deployment still uses the legacy runtime. These screens
remain staged until the SaaS runtime, legacy data backfill, restricted database
roles and restore/migration rehearsal are complete. The user will deploy;
enabling frontend flags alone cannot supply those dependencies. Live SaaS test
shop/admin creation is pending that runtime and migration work.
