# Tenant medicine catalog and inventory read integration

SaaS-014 incremental verification, 2026-11-10. Feature branches only; both preview
flags remain default false. No main merge, deployment or real data mutation.

The gated `/shops` workspace now mounts Catalog/Inventory only after a working
branch has been freshly verified. Tabs use authoritative `medicine:read` and
`stock:read` keys, independently. Legacy `useAuth` wildcard permissions are not
adopted. The existing live catalog/inventory screens are unchanged.

## Exact read surface

The tenant BFF allowlist adds only:

- `GET /pharmacy/medicines`: explicit selected branch, page/limit, server search,
  status, hasStock, barcode, unit, dosageForm and strength.
- `GET /pharmacy/medicines/:id?branchId=...`: selected-branch batch details.
- `GET /pharmacy/stocks`: selected branch, page/limit, server search, exact batch,
  rack, unit and expiry-date range.

Every request still carries URL-bound tenant identity and cookie authentication to
the explicitly configured tenant API; backend middleware and branch/capability
checks authorize it. No fallback to legacy services. Browser filter input cannot
override tenant/branch/page. List transport retains backend metadata (pageSize,
totalItems, totalPages, next/previous); there is no filtering of the loaded page.

UI features include cards/details for medicines, a horizontally scrollable batch
inventory table, skeletons, server pagination/search, date-range validation,
native top-layer filter popovers with outside/Escape dismissal, custom selects,
error/retry/empty states and theme/language support. Details open in an accessible
native dialog. Changing branch/shop/permissions unmounts the view, resets filters,
search/page/details and rejects late results through transport disposal and request
generation. A denied detail request also clears previously loaded list data.

Response validation checks medicine ownership, **every** nested stock's tenant and
selected branch, inventory medicine/branch ownership, values and metadata before
rendering. A foreign/malformed response fails the whole page rather than silently
displaying a partial list. Prices display BDT, matching the existing staged backend
currency baseline; additional currency support is not implemented here.

## Existing backend semantics retained

With branchId and no explicit hasStock filter, the existing medicine service lists
medicines with registered stock records in that branch (including zero quantity).
`hasStock=true` requires positive stock; `false` lists tenant medicines without
positive stock in that selected branch. Expired stock is included in recorded
quantities; these are **not** promises of saleable quantity. The view displays that
notice and batch expiry dates. Inventory expiry filters follow the backend's UTC
calendar-day bounds; shop-timezone expiry semantics remain separate work.

## Verification

- `npm run test:tenant-medicines` in backend: **48 passing** native PostgreSQL/
  Prisma/HTTP checks, including all scalar/reference filters, stock/hasStock scope,
  ownership, revoked permissions, date ranges and transaction invariants. This
  phase does not change backend business code.
- `npm run test:tenant-catalog`: **8 unit tests** plus the actual Next BFF and local
  disposable HTTP-upstream browser fixture. Covers server search/filter/pagination,
  details, outside-dismiss popover, denied list/detail, foreign response rejection,
  delayed old-branch response, branch/shop separation and mobile dark layout.
  The fixture uses Microsoft Edge and never contacts the real DB/live API.
- TypeScript, changed-module ESLint and optimized production build pass.
  Preview remains off in the example configuration.

## Still open in this module

Reference dropdown filters (category/generic/group/manufacturer/unit masters),
medicine add/edit/deactivate, opening/adjustment/transfer/import/bulk prices, stock
history, related export actions and complete keyboard accessibility review.
Resource mutations require their own reviewed BFF allowlist, validation and replay
keys; none are exposed by this read-only phase. POS/checkout, purchases/returns,
customer/advance/due, finance/reports, HR/admin/media/socket adapters and final
tenant-only navigation/release acceptance remain separate work.
