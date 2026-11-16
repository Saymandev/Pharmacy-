# Owner billing recovery portal

The fresh workspace bootstrap exposes a boolean `billingAccess`; only a verified
owner sees the subscription/billing entry. The portal is independent of the
working branch and remains reachable on subscription expiry. The restricted
backend, not browser role names/local storage, decides eligibility.

The native dialog presents agreed plan/term dates, issued invoices with totals,
due and settlement state, renewal/payment review forms and persisted support
responses. Requests are deployment-write-gated even when the subscription is
expired. They never verify payment or activate a plan. Only explicit recovery
paths are allowed by the BFF, with session-bound credentials, same-origin checks,
strict bounded bodies and no-store responses.

Unknown save results freeze edits/close and retain the same payload/key for retry.
Window focus cannot discard the in-progress portal. Session/shop disposal aborts
transport and rejects stale data. Foreign or malformed projections stay hidden.
The mobile layout uses existing semantic theme tokens and English/Banglish copy.

Super Admin billing readers can expand the owner request queue. Billing managers
can acknowledge/resolve/reject a revisioned request with an owner-visible response.
Other shop navigation is locked while a review result is unknown; retry preserves
the exact command. Financial verification/settlement stays in the existing billing
workflow.

This is the first completed workflow within Task 6. Delegated billing users,
payment/credit history, private proof self-service, quote/change requests,
notification outbox/socket delivery and remaining tenant HR/team/media integration
are still outstanding. This work is staged on SaaS feature branches, not deployed.

Verification entry points: `npm run test:billing-portal`, billing browser scenarios
(including review queue exact-key retry), scoped ESLint and production build.
Browser tests use the real Next BFF against controlled fixtures; database tests
use disposable local PostgreSQL, not live shop records.

Verified 2026-11-16: production build, scoped ESLint and ten relevant policy/
transport tests passed. Owner portal and platform billing/review browser flows
passed, including response-loss recovery and mobile dark layout. Backend full
regression passed 256 tests; final platform/portal subset passed 83 tests.
