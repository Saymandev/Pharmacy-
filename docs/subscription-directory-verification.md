# Subscription directory delivery — 19 November 2026

The Super Admin Subscriptions section now starts with a global paginated
directory rather than requiring shop selection from the shop directory first.
It includes shops without plans so authorized operators can begin assignment.

Implemented UI/API behaviour:

- Shop/slug/agreed-plan search, distinct subscription and shop-security filters,
  7/30-day ending queues, renewal/name ordering, reset and quick filters;
- server totals across matching records, with no filtering of only the visible
  page; stable shop IDs and strict response/projection checks; automatic recovery
  to a valid page when a refresh or saved change shrinks the result set;
- saved plan price/term, period end, paid-through/grace/cancellation indicators,
  upcoming changes and clear unassigned/lifetime states;
- row/name/action access to a focused subscription modal, existing history and
  management controls, independent read-only permissions and write rollout gate;
- existing exact-key retry and revision/settlement checks; no close while an
  outcome is uncertain; list reload after closing the acknowledged operation;
- compact desktop table, mobile cards, top and bottom pagination, English/
  Banglish, light/dark and skeleton/error/empty states.

Backend is GET `/api/v1/platform/subscriptions`; both shop-read and subscription-
read capabilities are required. The same database and existing restricted roles
are used. Full plan snapshots, private audience IDs and business/credential data
are not part of this projection. Mutations use the existing per-shop endpoints.

Verification artifacts in workspace `outputs/subscription-directory-20261119`
are LOCAL fixture screenshots, not hosted data. The actual Next BFF browser
fixture covers 23 shops/20-row pagination, server search/state/security/ending
queries, no-plan rows, a read-only modal, rejected extra credential fields,
revoked access and Banglish/dark/mobile widths. Commercial regression assigns a
trial through the directory modal, replays the same request after response loss,
schedules cancellation and verifies the refreshed row after closing.

Backend: build and 146 native PostgreSQL checks. Frontend: 222 unit checks,
scoped ESLint/types, production build and actual browser scenarios. Deploy the
backend first and frontend second; no migration, reset, seed or new login is
needed. Existing runtime flags/gates remain enabled as configured.

Global billing/invoice/payment directories, operator/support management, richer
shop profiles, platform themes/templates and notifications/operations remain
separate open items from the original audit.
