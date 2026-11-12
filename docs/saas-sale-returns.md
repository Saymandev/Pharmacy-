# Tenant sale returns and refunds

Open `/shops`, select a branch, open Sales history and an invoice, then choose
Sale returns and refunds. Access requires sale read plus sale-return read.
Creation and updates independently require sale-return create/update and the
existing preview write gate.

The server supplies remaining quantities after completed and pending returns.
Saving creates a pending reservation; completion restores source stock and
reduces invoice due first. Registered customer credit enters the advance wallet,
where the existing Customers / Refund advance workflow handles payouts.
Walk-in credit supports a separate capped outgoing refund with account selection.
Cash refunds require the actor's open register in the selected branch.

The interface provides server-side source/branch-bound pagination, search,
status, exact return number and date filters. Filters use a dismissible popover.
Pending estimates and final due/advance/walk-in credit are labelled separately.
Refund journals show outgoing amounts; customer receipts are unchanged.

Mutation commands freeze their payload and idempotency key. Unknown responses
disable edits and exits until the same command is retried. The parent invoice
dialog cannot close or remount the workflow during an operation. Returning to
the invoice reloads its totals and status.

Validation commands:

- `node --test tests/sale-returns.test.mjs tests/sales-workspace.test.mjs`
- `node tests/run-tenant-sale-returns-browser.cjs`
- `npm run lint` and `npm run build`

The browser fixture runs the actual Next BFF against a disposable loopback
backend and verifies response-loss retries, reservations, due-first wallet
credit, refund caps, foreign response rejection, read-only access and mobile
themes. It does not write to a live database.

Verification result: 35 combined frontend unit checks and 101 native backend
checks pass. Frontend and backend production builds pass. The return/refund
browser flow and existing sales/due browser regression pass. Changed-file ESLint
passes. Repository-wide ESLint currently
reports 15 pre-existing errors in legacy customer/purchase panels and older
CommonJS test runners; those files are outside this change.

This is staged SaaS preview work. Production mounting, tenant migration and
deployment remain separate release work; no environment or gate was enabled.
