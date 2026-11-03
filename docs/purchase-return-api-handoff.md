# Purchase return API dependency

**Update, 3 November 2026:** The pharmacy-only backend routes described below have been implemented on `codex/pharmacy-stock-history`, with local PostgreSQL HTTP verification. The frontend now includes a Supplier returns tab. See `backend/doc/pharmacy-returns-advances.md` for the actual contract and database rollout. The original text below records the earlier gap analysis; its proposed status is superseded by this update. Live deployed API verification remains separate.

The supplied backend has `PurchaseReturn` / `PurchaseReturnItem` models in `prisma/schema/purchase.prisma` and report aggregates in `src/modules/report/pharmacy-report/pharmacy-report.service.ts`. It has no purchase-return controller/service/validator or mounted create/list/detail/status/refund routes in `src/routes/index.ts` or `src/modules/pharmacy/pharmacy.routes.ts`.

The existing sales-return API handles customer returns, not supplier purchase returns. The frontend must not send supplier returns there or show a successful local-only refund.

## Proposed backend contract for discussion

These routes are proposals, not implemented endpoints:

- List/detail purchase returns with branch, supplier, source purchase, batch, status and pagination.
- Provide returnable source purchase lines: stable purchase/item IDs, medicine, batch/expiry, original quantity, original cost/discount, already returned/reserved quantity, available stock and remaining allowance.
- Create return against a completed purchase using source item identities, whole quantities, reason/note and pending/completed status.
- Approve/reject pending returns. Revalidate quantities atomically and move the matching branch/batch stock exactly once on approval.
- Return authoritative financial allocation: purchase due reduction, supplier credit and actual cash/bank refund received. Specify whether a refund is collected immediately or through a separate endpoint; require account/method only for an actual financial movement.
- Expose linked transactions, cumulative refund received and remaining refundable credit; reject over-return, over-refund, duplicate approval and branch mismatch.

Confirm permissions, request/response envelopes, errors and whether repeated requests have an idempotency key. A return's face value must never be presented as cash received unless a corresponding refund transaction exists.

Once agreed, frontend work can cover source-purchase selection, batch allowance, return review, supplier settlement, history, permissions and mocked/live acceptance tests. No backend files were changed by this phase.
