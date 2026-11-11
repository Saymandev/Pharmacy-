# Tenant CSV import and batch price updates

Implemented 2026-11-11 on the SaaS frontend feature branch, in the gated `/shops`
workspace. Legacy pages and live flags are unchanged. The tenant backend factories
are still staged; this is not a production rollout or completed SaaS acceptance.

## Import

- `medicine:create` exposes Import medicines. Download the CSV sample, then choose
  one UTF-8 CSV or XLSX file (1 MB / 100 medicines maximum). The backend parses
  the uploaded file for preview, so the preview and final import share exact
  alias, workbook, formula and expansion checks.
- Standard quotes, escaped quotes, embedded newlines, CRLF, BOM and barcode leading
  zeros are handled. Invalid quotes/columns, formulas, invalid scalar values,
  duplicate barcode, excessive bounds and empty files fail before mutation.
- Supported columns: name, nameBangla, genericName, genericNameBangla, barcode,
  unit, dosageForm, strength, purchasePrice, salePrice, mrp, reorderLevel, isActive.
  Name is required. Blank optional fields use backend defaults. An existing
  barcode fails the complete import; records are created, never upserted.
- Import is shop-wide catalog creation. No inferred branch, opening stock or
  reference IDs are sent. Opening stock and reference masters use their separate
  scoped workflows. Backend revalidates and commits all rows/audits atomically.
- A single-sheet XLSX can now be previewed. Opening stock remains separate. The
  optional master mapping selects existing tenant category, generic, group,
  manufacturer or medicine unit and applies it to every preview row. It does not
  create a master record and does not bypass the normal reference permission or
  backend ownership validation.

## Prices

- `stock:read` plus `medicine:update` exposes Bulk price update in the working
  branch. Server search/page results contain only scoped batch rows. No row is
  preselected. Search/page changes clear edits and selection explicitly.
- Change selected batch unit cost and MRP, with current prices visible. This
  does not edit catalog salePrice, quantity or stock history.
- Every request carries unique medicine/SKU pairs and both inspected old prices.
  The new optional backend expected-price pair preserves older staged clients.
  Under existing sorted row locks, any mismatch returns 409 and rolls back the
  entire batch. Reload discards selection and fetches fresh prices. Successful
  same-key replay returns its saved result without rechecking historical prices.

## Transport and verification

Only POST medicines/import and PATCH stocks/bulk-price-update are added behind
the existing write gate. BFF requires same origin, HttpOnly session, valid key,
JSON, bounded bytes and strict nested scalar allowlists. No tenant/user/branch /
ledger/quantity override passes. The route chooses tenant identity. Uncertain
responses freeze the body/key and offer same-request retry; duplicate submits
are blocked. Source scope is checked before rendering and returned stock tuples
are checked before confirmation. Unmount/session disposal rejects late saves.

Verification: 60 native backend PostgreSQL/Prisma/RLS/HTTP checks (including stale
price whole-batch rollback and replay, exact CSV/XLSX preview with no write), 26 frontend unit tests, actual Next BFF /
loopback HTTP browser tests (invalid CSV, preview, duplicate submit, uncertain
retry, stale reload, server search, selection reset, scope guards and mobile
light/dark). Changed-module ESLint, TypeScript and production build passed
before push. Fixtures use no real database or live API.

Individual rows now expose searchable, permission-scoped master pickers. Explicit
row selections take precedence over all-row defaults, which take precedence over
file IDs. Clearing an override restores that fallback. Mapping is frozen during
uncertain retries and reset when a new file is selected. Browser verification
checks a row manufacturer alongside an all-row category and identical retry data.

Remaining: automatic name-to-master matching/conflict detection, durable retry recovery across
reloads, remaining resource adapters, tenant migration/route composition and
real two-shop acceptance. Default-off gates do not disable legacy live writes.
