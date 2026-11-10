# Tenant reference filters and medicine add/edit

SaaS-014 incremental phase, verified 2026-11-10. Feature branches only. No main
merge, migration, deployment or real business data mutation.

## Reference controls

Catalog filters now include category, generic, group, manufacturer and medicine
unit. Inventory includes its backend-supported manufacturer filter. Each picker
uses the existing tenant master endpoint, owned-response validation, server search,
bounded 20-row pages and load-more. It does not search just the currently loaded
page. A missing master-read permission disables that picker with an explanation;
existing edit selections are retained, never silently cleared. No new master-read
privilege is granted from a medicine permission.

The custom popup supports arrow navigation, explicit option selection and Escape.
Enter in the search field does not submit an enclosing medicine/filter form.
Scope changes and stale query responses dispose their transport. Shared Select
styling is explicitly applied to the standalone shop dialogs to avoid showing both
the native and decorative select values.

## Medicine workflow

A **third server-only gate**, `TENANT_CATALOG_WRITES_ENABLED=true`, is required
along with both preview gates. It defaults false in `.env.example`. Add/Edit
buttons also require current explicit medicine create/update permissions. The
backend still independently checks current membership/capability/ownership.

Add opens a responsive form for medicine identity, Bangla labels, barcode/unit,
dosage/strength, prices, reorder level, status and five references. Edit fetches a
fresh complete owned record and version before enabling save; missing fields do
not become zero/default values and overwrite data. Changes are shop-wide and the
form says so. Stock is managed separately: creating a medicine does not implicitly
create a batch. Success refreshes the current list and explains why a new medicine
with no opening stock may not appear in the registered-branch view yet.

The medicine proxy permits only POST collection and PATCH UUID detail, with the
third gate, existing same-origin check, HttpOnly cookie identity, JSON content type,
no query string, required save key, 32KB form-body check and catalog-field allowlist.
Tenant/user/branch identity and opening-stock/nested mutation fields are rejected.
PATCH requires an expectedUpdatedAt value. Reference master mutations, DELETE,
stock adjustments/imports and all other writes remain unavailable through this BFF.

The form rejects blank/oversized names/unit, non-decimal/negative/subcent prices,
invalid reference IDs and invalid reorder levels. A synchronous guard blocks double
submit. The exact request key/body is retained for retries within the mounted form.
Uncertain outcomes freeze the draft and offer Retry save with the same key; there
is no automatic new create. This is not durable offline submission: after reload,
navigation or a session change, manually reconcile an uncertain operation before
starting a new draft. Aborting a browser request cannot undo a server commit.

The tenant backend update route accepts an optional version and save key for
compatibility with older staged clients. This BFF requires both. Updates lock the
owned medicine, reject a stale expectedUpdatedAt with 409, advance this endpoint's
updatedAt by at least one millisecond, and atomically save audit/result with the
operation record. Identical keyed retries replay the response, including after the
version changed; different payload/key combinations do not bypass conflict checks.
The UI offers explicit Reload medicine on conflict rather than silently overwriting.
Legacy callers without the precondition and other write paths still need final
contract review; this is not a system-wide immutable version scheme.

## Verification and remaining work

- Backend build + 49 native PostgreSQL/Prisma/HTTP checks pass. New assertions cover
  edit retry replay, one audit on replay, monotonic endpoint timestamp, changed
  payload/key conflict and two concurrent edits with only one success.
- `npm run test:tenant-medicine-form`: 12 unit tests plus actual Next proxy/local
  HTTP-upstream browser checks for server reference search, filter ID propagation,
  form validation, duplicate submit, uncertain create retry, stale-edit reload,
  list refresh, wrong-origin/missing-key/stock-field denial and mobile layout.
- Desktop and 390px form screenshots were inspected; labels stack above inputs,
  forms scroll and actions remain visible. TypeScript, lint and production build
  are checked before push. Browser fixtures use fake identities/local upstreams;
  native DB fixtures are disposable and no live database is contacted.

Opening stock, stock adjustments/transfer/history/import, reference-master editing,
POS/payment/receipt and the remaining tenant UI/rollout/UAT are still pending.
