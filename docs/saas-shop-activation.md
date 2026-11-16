# Verified shop activation

Pending shops display an activation panel only for operators with
`platform:shops:activate`. The operator runs current checks, supplies a reason and
confirms before activation. Six checks cover pending status, provisioning, owner,
defaults, subscription and isolation. Missing/duplicate/foreign check results fail
validation; the API independently repeats all checks during the write.

The Next BFF uses the separate platform backend URL, HttpOnly session, origin
validation and explicit preview/write gates. No tenant header or user-controlled
readiness/status is forwarded. An uncertain save freezes navigation/form/checks
and retries the identical body and idempotency key. A conflict discards stale
checks; success reloads the shop and directory.

Run `npm run test:activation`. To verify the production build, build first and run
`NEXT_BROWSER_MODE=start node tests/run-activation-browser.cjs` (set the environment
variable with the syntax for your shell). The browser uses fixture responses;
backend PostgreSQL tests provide real persistence/isolation coverage.
