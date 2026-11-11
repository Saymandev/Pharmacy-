# Branch purchase list, detail and pending approval

Branch purchases opens from the gated `/shops` catalog with purchase:read. List
requests bind the selected branch and preserve server pagination. Search and the
floating filter popover support status, payment status/method, supplier, purchase
number, date range (backend Asia/Dhaka boundaries) and min/max amount. Supplier
options require supplier:read. No manual UUID entry or first-branch fallback.

Every list row must match the current shop/branch. Details additionally verify
owned unique item IDs and purchase/medicine tuples, quantities, amounts and dates.
Rows open by click or keyboard, with an explicit purchase-number button. Detail
shows optional authorized supplier name, note, original net, paid/due and batches.
Amounts reflect backend records; no client-generated accounting ledger is inferred.

The existing write flag plus purchase:update enables Complete/Reject only for a
pending record. Each action has a final confirmation and optional status note.
Completing receives stock through the existing backend transaction; rejecting
adds no stock. Request body/key stay frozen across unknown-result retries. Double
submit is blocked; known errors reload current records before another attempt.
List/detail are cleared on failed or foreign responses. Workspace branch/shop /
permission changes remount the catalog and dispose transports and late results.

BFF additions are narrowly scoped GET purchases collection/UUID detail and PATCH
purchases/UUID/status. Status accepts only completed/rejected plus optional note;
no ownership, stock or payment fields. Read routes work with writes disabled.
Same-origin cookie authorization, trusted tenant URL and current backend grants
remain authoritative. No backend source or production configuration changed.

Validation: 10 frontend purchase/supplier/master unit tests, changed-module lint
and production build passed. Actual Next BFF + loopback upstream browser checks
cover pagination, status/date query binding, details, complete and reject, once-only
stock receipt on uncertain retry, terminal action hiding, foreign/403 rejection,
mobile layout and existing import/master/supplier/scope regressions. Mobile detail
was visually inspected. The backend procurement suite passed 75 native checks in
the preceding purchase-entry phase; its unchanged status implementation was
inspected here, not counted as a newly executed suite. No live API or DB was used.

Remaining: supplier payment/account/register workflow, purchase returns/refunds,
cash-register filter picker, durable retry recovery and deployed two-shop UAT.
