# Tenant Stock History and Branch Transfer

SaaS-014 incremental phase, verified 2026-11-10. Feature branches only. Existing
legacy pages/live settings are unchanged; no new gate is introduced.

## History

Stock-read users get a Stock history tab and View history on inventory batches.
The shortcut fixes the current stock ID and displays a clearable batch label,
never a raw-ID text input. All requests bind the current working branch and use
server pagination/search. Filters cover stock (shortcut), medicine (owned server
picker including inactive/unregistered medicines if medicine:read is assigned),
batch, direction, change type and start/end dates. Known change types are opening,
adjust, transfer, purchase, sale, supplier return and sales return.

Dates use the backend's Asia/Dhaka day bounds; table/detail timestamps explicitly
format in that zone. Rows prioritize medicine, signed movement quantity and In/Out
labels. A movement amount is not a running balance. The UI never uses the joined
stock's current quantity to invent a historical balance or a grand total from a
single page. Medicine/stock/branch relationship tuples are validated before render;
foreign or denied responses clear the page and show an error.

Read-only details show medicine, batch, date, direction, movement type/quantity,
note and counterpart branch for transfer. Counterpart names are fetched through
the existing authorized branch projection; unavailable/ungranted branches get a
generic access message. There is no inferred durable transfer document ID or
fabricated link between events based on timestamp. History deletion/edit/export
is not exposed by this phase.

## Transfer

Inventory offers Transfer stock only under the existing tenant write gate and
stock:update; the list and fresh source fetch also need stock:read. Source branch
remains fixed from Settings. Destination uses fresh tenant bootstrap branches,
server name search and bounded keyset load-more, excluding the source branch. No
automatic destination selection and no working-branch switch after success.

The form reloads the owned source batch and shows quantity, expiry/unit, target,
positive quantity, mandatory reason and projected remaining source quantity. It
rejects same-branch/invalid destinations and amounts above recorded source stock.
Recorded quantity is not an unreserved availability quote: supplier-return
reservation and destination metadata/capacity are independently checked by backend.

The BFF adds only GET stock history and POST transfer. Transfer JSON permits only
stockId/toBranchId/quantity/reason-note/expectedQuantity, requires the existing write
gate, same origin, cookie identity, request key and inspected quantity, and rejects
identity/financial/metadata overrides. Read history remains independent of the
write switch. Native backend checks permissions and both current branch grants,
active medicine, source quantity, reserved stock, target capacity and matching batch
expiry/unit/prices under its medicine/stock locks.

Expected source quantity is checked after row locks. 409 requires explicit Reload
stock, resetting correction/target for another decision. Duplicate submit and
uncertain retry use the same key/body; source decrement, target increment, paired
history, audit and operation result are atomic. A successful cached response is
confirmed without labeling its quantities as the current live balance; source
view is reloaded. Same uncertainty-on-reload/navigation limitations as stock forms
still apply. No stock metadata, account/expense or purchase mutation is performed.

## Verification

- `npm run test:tenant-bulk` in backend: **59 passing** native PostgreSQL/Prisma/
  HTTP checks. Transfer replay includes an expected quantity, stale versions do not
  move stock, source+target totals conserve quantity, paired events/history query
  scope are checked, and foreign/ungranted/self branches, opposite transfers,
  metadata mismatch, capability revocation and operation rollback are covered.
- `npm run test:tenant-history-transfer`: **20 unit tests** and actual Next proxy/
  local HTTP-upstream browser checks for destination search, fresh source/reload,
  one transfer on uncertain retry, current branch unchanged, row history shortcut,
  server pagination/date/direction/type filters, details, foreign/denied rejection,
  no fake running balance, blocked history writes and mobile/dark layout.
- Existing stock-form browser flow, changed-module lint and production build
  passed before feature-branch push. Screenshots are visually reviewed. No real
  database or live API is used by the fixtures.

Remaining: import/bulk prices, reference master CRUD, POS/checkout/other resource
adapters, durable offline reconciliation, release migration/role review and real
two-shop UAT. StockHistory is an event view of existing records, not a certified
immutable accounting ledger or a complete historical snapshot model.
