# Existing pending invoice completion and rejection

Sales history now offers Complete pending sale and Reject pending sale only for
pending invoices, behind the write gate and `sale:update`. Completion additionally
requires account and own-register read access; the backend requires an open own
register even for a bank/advance/credit completion. Rejection requires neither a
payment account nor register lookup. Walk-in completion must be fully paid;
registered customers can use partial/zero cash and existing advance. Advance use
requires customer read/update and a freshly checked customer wallet.

The review form shows immutable invoice/customer/total, funding and remaining due,
with explicit confirmation before the terminal action. A new attempt refreshes
the selected invoice and requires it still be pending and unfunded. Unexpected
legacy pre-funded drafts are blocked for reconciliation. No line prices, customer
assignment or stock tuples are rewritten by this screen. Changed status or stock
conflict preserves the form and shows the backend rejection.

Only PATCH `/sales/:id/status` with strict status/payments/advance body is exposed.
Unknown replies freeze all fields and manager exit and retain the exact body/key.
Replay does not reload an already completed invoice or reapply its funding.
Verified success requires the same invoice, customer, original date, stock lines,
net total and exact paid/due/advance values; rejection cannot acknowledge money.
Current list/detail then reload. Pending/rejected receipts remain disabled.

Verification: 4 dedicated policy/transport tests and actual Next BFF + local
HTTP-upstream Edge workflow cover stock conflict, partial cash plus advance,
single completion/stock movement under lost-response replay, foreign response
rejection, terminal controls, rejection without money/register calls and mobile
layout. A delayed list reload failing during an uncertain completion cannot
unmount the financial form or lose its retry key. Backend native PostgreSQL suite has **99 passing** checks, including
complete/reject concurrency, exact wallet/account/stock changes and stable replay.
Changed code lint, TypeScript and production build pass.

This increment handles **existing pending invoices**. POS draft creation is now
available through [Save pending](saas-pos-drafts.md). Draft editing and sale
returns/refunds remain separate UI work.
Feature branches only; preview gates, live data, main and deployment are unchanged.
