# Inventory and stock operations

Inventory implements only the routes in the uploaded backend contract. Backend source is unchanged.

## View batches and alerts

The stock list is scoped to the selected branch, with server-side medicine/generic search, exact batch/rack filters, manufacturer and expiry-range filters. Query failures clear stale results; out-of-range pages are corrected. Optional medicine lookup failures do not hide the stock list.

“All batches” shows the filtered backend total. Alert counts and state filters apply to the current loaded page, as explained on screen. A row may have multiple alerts. Expiry uses the inclusive calendar date in Asia/Dhaka, matching POS batch selection; invalid expiry dates are shown explicitly. Low stock compares the medicine's combined **unexpired** branch quantity with its reorder level when complete medicine data is available, rather than comparing each batch separately. Missing reorder data stays unknown. The supplemental medicine list is bounded to 100 results; stocks outside that metadata coverage remain visible without invented low-stock status.

## Opening stock

Choose Opening stock, search the medicine by name/generic/barcode and select the result. The picker searches the API and is not limited to the first 100 catalog entries. Medicine-read access is needed to choose an item.

Fill batch, expiry, positive whole quantity, unit cost, MRP, optional rack/unit and note. The form states the branch and warns that entering an existing medicine/batch adds quantity and updates its expiry/prices, matching the backend's upsert behavior. Expired stock can be recorded for an accurate physical inventory, but POS will not treat it as sellable.

The request uses `POST /pharmacy/stocks/opening`. Expiry is serialized with its selected Dhaka calendar date. Quantity fits the database's positive Int range and stock prices fit two-decimal precision. Repeated clicks cannot create a second in-flight opening request.

## Adjusting quantity

Use the page action or Adjust next to a batch. The batch dropdown is the source of truth: changing it changes the submitted stock ID and availability preview. Choose Increase/Decrease and a positive whole quantity.

The frontend reads the selected batch again using the supported stock-list filters before submission. A decrease is checked against the **latest** quantity. If stock later increases, trying again can see the newly available quantity instead of being blocked by an old snapshot. Changing the active branch invalidates an open operation.

For a decrease, optional recovered money requires a recovery account and nonnegative two-decimal amount. Switching to Increase clears those hidden recovery fields. The request uses `POST /pharmacy/stocks/adjust`; a recovery credits the selected account according to the backend.

## Transferring stock

Select the source batch, a different destination branch, quantity and optional note. The frontend verifies source identity/branch and fresh quantity before `POST /pharmacy/stocks/transfer`. It does not invent conversion factors or alter the batch/unit during transfer. Inspect both branches after the real transaction.

## Batch prices

Bulk price editing covers the current stock page. Only changed rows are sent to `PATCH /pharmacy/stocks/bulk-price-update`, with `{ medicineId, sku, unitPrice, mrp }`. Blank, nonfinite, nonpositive, over-precision and out-of-range stock prices are rejected before sending. The editor is bound to its opening branch. Backend decides the final persisted prices.

Stock writes share a synchronous mutation lock, disable dismissal during saving and show errors inside the dialog. A timed-out request is not proof of failure; inspect current quantities/account transactions before manually retrying. There is no automatic mutation retry.

## Stock history is a backend dependency

The uploaded service writes `StockHistory` records but exposes **no stock-history read endpoint**. Its `updateOpeningStock` function also has no mounted route. The frontend does not invent either endpoint or present a local action log as authoritative history.

Ask the backend developer for a paginated history read contract supporting branch, stock/medicine, date, movement type and transfer source/destination. Server-side aggregate stock-state filters would also allow branch-wide low/out alerts without client page limitations. The stock-list medicine projection could expose reorder level and usable branch total to avoid incomplete metadata coverage.

The backend must enforce concurrent transfer/decrease bounds transactionally. Opening stock can overwrite existing expiry/prices, so review data carefully. Frontend rechecks are useful but cannot replace backend concurrency/idempotency safeguards.

## Verification and manual checks

`npm test` covers Dhaka expiry boundaries, aggregated low-stock state, unknown metadata, quantity/price bounds, same-branch transfers, stale quantities and recovery rules. `tests/inventory.browser.cjs` uses mock API fixtures for selected-batch identity, fresh decrease/transfer checks, recovery payload, remote medicine search, duplicate submit, changed-only bulk prices, optional metadata failure, mobile and permissions.

Against development data, verify opening quantity, adjustment recovery account, both transfer branches, price persistence and stock-history records with the backend developer. These mock tests do not verify real database or ledger effects.
