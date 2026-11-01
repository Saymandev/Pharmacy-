# Finance tabs and account movements

Finance now opens the first tab the current role can read. Accounts, Transactions, Income and Expenses have independent read permissions. Unavailable tabs are omitted. Account/category dropdowns fetch only when their read permission and the current workflow require them; a transaction-only or income-only reader does not request account lists or unrelated categories.

The displayed account list is separate from account dropdown options, so option refresh cannot replace a searched/paginated list. Accounts, ledger and income/expense lists retain envelope pagination metadata. Account balance cards explicitly describe the current page rather than claiming branch-wide totals. Optional dropdown options currently cover up to 100 records; this is not an all-account/category export or an authoritative aggregate.

Entry creation needs its create permission plus readable account/category options. Category writes and account/transaction edits also check their exact action permission before requests. In-flight writes share a lock and disable form controls. Frontend controls do not replace backend authorization.

Transfers and withdrawals accept positive two-decimal amounts. Before a POST, account detail is fetched again and source balance/active state are checked; transfers also check a distinct active destination. A smaller latest balance or unavailable detail stops the POST and leaves the form for review. Returned account identities must match the selected IDs. A successful frontend refresh is not a reservation: backend checks must remain atomic against concurrent withdrawals/transfers and must support idempotency for uncertain retries.

Account opening accepts zero or positive two-decimal amounts. Income/expense entry dates are validated before Dhaka-noon serialization. Invalid date filters and failed requests clear stale rows. Responses from superseded list/option/detail requests cannot replace newer requests; switching tabs clears old rows immediately.

## Verification

`tests/finance-policy.test.mjs` checks per-tab permissions, money/date validation and current account movement bounds. `tests/finance.browser.cjs` uses synthetic API data for transaction-only and income-only roles, options isolation, account/ledger pagination, changing transfer/withdraw balances, amount precision, duplicate submit protection and mobile.

No real account movement is posted by these tests. Verify actual finance permissions, active account behavior, transfer-in/out transactions, withdrawal posting, branch/account scope and accounting reversals on development data. See [live POS acceptance](live-pos-acceptance.md) and [backend handoff](backend-developer-handoff.md).
