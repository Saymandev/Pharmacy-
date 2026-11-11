# Customer profiles and advance ledger preview

`Customers & advance` is available from the selected `/shops` workspace with
`customer:read`, independently of medicine access. Profiles and wallet balances
are tenant-wide; ledger entries are always bound to the selected active branch.
The explicit ledger envelope must match tenant, customer and branch even when
empty. The UI labels the shop-wide balance and per-event shop balance separately
from branch activity. It never sums a filtered/paginated page as the wallet total.

Server search and pagination select a fresh customer detail. Add requires
`customer:create`; edit, receive and refund require `customer:update`; money
controls additionally require `account:read`. Cash requires an own open register
and `cash-register:read`. Bank/MFS uses matching account options without requiring
a cash register. Walk-in profiles are read-only and cannot receive/refund advance.

Profile forms submit only name, Bangla name, phone, address, age and gender.
Editing includes inspected `expectedUpdatedAt`. Balance, tenant, walk-in flag and
other identity fields cannot be injected through the BFF. Backend edit now uses
idempotency, a row lock, optional version comparison and monotonic timestamps;
the frontend BFF always requires that version. A stale response offers explicit
reload instead of overwriting another edit. Legitimate nullable legacy customer
numbers are accepted in management and POS read projections.

Advance receive/refund has amount, method, server-searched/paginated account,
note and explicit money-direction confirmation. Customer is refreshed before a
new request and refund is capped by that current wallet; the backend still locks
and reconciles the ledger/account/drawer atomically. Unknown results freeze the
form and manager exit, retaining the exact key and body. Replays do not refresh or
recalculate the attempted mutation. Success requires a verified own customer,
branch, actor, amount, direction and account/transaction linkage, then reloads
current detail/ledger instead of presenting a cached event balance as current.

Ledger filters (kind and dates) use an outside-dismiss popover and server query.
Credit/debit signs describe wallet direction; returned credit is not falsely
labelled a cash receipt. Add/edit forms use stacked labels and responsive fields;
mobile/light/dark use shared theme variables. Active manager forms survive browser
focus changes, and transports are disposed on workspace/session changes.

Verification: 5 dedicated policy/transport tests plus actual Next BFF and local
HTTP-upstream Edge flow cover create/edit lost-response retries, stale edit reload,
receive/refund once, refund cap, filtered ledger with unchanged shop balance,
foreign ledger rejection, read-only controls, popover dismissal and mobile themes.
Native PostgreSQL/Prisma/HTTP suite has **97 passing** checks, including new edit
concurrency/version, stable replay, revoked permission and audit rollback cases.
Changed-code ESLint, TypeScript and production build pass. No real DB is used by
fixtures.

Feature branches only. Preview gates, live data, SQL rollout and deployment are
unchanged. Customer deletion, advance allocation to historical invoices and ledger
export remain separate work. Tenant sales history and money collection now have a
separate [sales workspace](saas-sales-history-due.md).
