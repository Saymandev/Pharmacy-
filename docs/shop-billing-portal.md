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

The payment/credit history section uses a separate read-only history endpoint.
Payment records distinguish pending, verified, rejected and reversed states,
with an expandable allocation/refund/available-funds breakdown. Credits have a
separate view, signed additions/usage/reversals/returns, invoice reference and
full-ledger available shop-credit balance. Invoice credits are explicitly
distinguished from spendable shop credit. Each history page shows up to 20 items,
with older/newest navigation and a bounded scroll area. Empty/error/loading
states, mobile semantic themes and Banglish labels are supported.

History responses are strictly validated for shop/kind, unique UUIDs, bounded
pages, exact public keys, integer money and funding arithmetic before rendering.
Failed/foreign responses clear records, and history switches clear the prior
view synchronously. Transport is aborted on view/session disposal. Billing
request saves have a synchronous in-flight guard as well as exact-key retry.

Unknown save results freeze edits/close and retain the same payload/key for retry.
Window focus cannot discard the in-progress portal. Session/shop disposal aborts
transport and rejects stale data. Foreign or malformed projections stay hidden.
The mobile layout uses existing semantic theme tokens and English/Banglish copy.

Super Admin billing readers can expand the owner request queue. Billing managers
can acknowledge/resolve/reject a revisioned request with an owner-visible response.
Other shop navigation is locked while a review result is unknown; retry preserves
the exact command. Financial verification/settlement stays in the existing billing
workflow.

This is a completed workflow within Task 6. Delegated billing users,
quote/change requests and notification outbox/socket delivery remain
outstanding. Team/invitations/onboarding, Media and manual HR workspace flows
have separate completed checkpoints. This work is staged on SaaS feature branches,
not deployed. Deploy the backend `tenant-billing-history.sql` rollout after its
portal prerequisite before enabling this frontend; Prisma migration alone does
not install staged functions.

Verification entry points: `npm run test:billing-portal`, billing browser scenarios
(including review queue exact-key retry), scoped ESLint and production build.
Browser tests use the real Next BFF against controlled fixtures; database tests
use disposable local PostgreSQL, not live shop records.

Verified 2026-11-16: production build, scoped ESLint and ten relevant policy/
transport tests passed. Owner portal and platform billing/review browser flows
passed, including response-loss recovery and mobile dark layout. Backend full
regression passed 256 tests; final platform/portal subset passed 83 tests.

Verified 2026-11-17: payment/credit history production build, scoped ESLint and
nine policy/transport tests passed. The actual Next BFF browser scenario covers
20 + sentinel pagination, breakdowns, view switching, safe foreign-response
denial/retry, empty state and unknown-save locking. Mobile dark and Banglish
screenshots were inspected. Backend full regression passed 290/290 tests; the
final platform/boundary run passed 115/115 after bounded page aggregation and UTC
timestamp verification. This does not enable delegated access or proof uploads.

## Private payment proof self-service — 2026-11-17

Open a payment-review request in Billing request updates, then Payment proof
attachments to upload/download evidence. PDF, PNG and JPEG are supported up to
1 MiB per file, three files per request and 32 retained files per shop. Open and
acknowledged requests allow new uploads; closed requests retain downloads. The
request remains unverified until the existing operator financial workflow runs.

Unknown upload results freeze the exact file/key, file selection, other billing
actions, dialog close and Escape dismissal until confirmed retry. Known rejection
releases the form. Aborted/disposed sessions cannot render a late response or
download stale content. Foreign/malformed proof lists are hidden, with retry.
Metadata contracts reject private fields and duplicate IDs. Downloads use a safe
fixed filename and actual size/type validation even when Next streams without a
Content-Length header. The shared component supports read-only Super Admin proof
delivery, visible only with `platform:payments:verify`; billing managers without
that capability cannot view proof metadata/content through the server.

Deploy the backend proof schema expansion and tenant/platform staged rollouts
before this frontend, with the same dedicated encryption key on both reviewed
backend routers. This work does not automatically deploy those changes.

Production build, scoped ESLint and 16 relevant policy/transport tests passed.
Actual Next BFF owner flow passed invalid-file rejection, lost-response same-file
retry, close/Escape locking, download bytes and safe filename, foreign-list denial
and mobile dark layout. Super Admin BFF browser verification passed shop-request
proof viewing/download alongside the existing billing/review workflow. Mobile
proof layout was visually inspected. Backend full regression passed 295/295.
Delegated billing grants remain the next separate task.
