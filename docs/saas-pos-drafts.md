# POS Save pending

Review & pay now has a separate Save pending button with an explicit no-payment
label. It uses the selected tenant/branch, medicine batches, quantities, customer,
note, discount and VAT, while always sending `status:pending`, `payments:[]` and
`advanceAmount:0`. Entered collection or advance fields are not persisted. Draft
save requires only the existing POS create/catalog access and write gate; it does
not require account/register permissions or an open register. A selected registered
customer is refreshed and verified before a new save request.

Draft and completed-sale bodies share stock-line and amount validation but have
separate funding contracts. The narrow sale-create BFF accepts either validated
shape; funding a pending body is rejected. Saving a draft does not reserve or
deduct stock. Completion later rechecks current stock, expiry, reservations,
customer wallet, payment account and own register using the existing status flow.

The same submit guard prevents draft/complete races. Unknown replies freeze all
fields and exits, including an already-open discard confirmation, and preserve
the exact request body/key. Retry dispatches by the frozen request's kind, so a
draft can never be retried as a completed sale. Cart clears only after a verified
own actor/customer/branch pending acknowledgement with exact totals/stock lines,
zero paid, zero advance, zero transactions and no return adjustments.

Success shows the saved invoice number and history guidance, with no paid receipt
or print option. A cached create reply is a historical acknowledgement: another
user may already have completed/rejected the invoice, so the screen directs users
to Sales history for its current state. New sale clears the draft/customer/funding
inputs. Existing history completion/rejection handles the saved invoice.

Verification: 2 dedicated draft policy tests and actual Next BFF + local upstream
Edge workflow cover saving without account/register access, omitted entered
funding, locked discard, foreign acknowledgement rejection, stable-key retry once,
unchanged stock, mobile confirmation and subsequent full completion from history.
Native PostgreSQL suite has **100 passing** checks, including draft creation in a
branch with no register, no financial/stock movement, replay, rejection of pending
funding, later completion once and the unchanged historical create acknowledgement.
Changed-code lint, TypeScript and production build pass.

Feature branches only; no live data, permission seed, SQL rollout, main merge or
deployment changed. Draft line editing, held-cart UX, sale returns/refunds and final
tenant navigation/release acceptance remain separate work.
