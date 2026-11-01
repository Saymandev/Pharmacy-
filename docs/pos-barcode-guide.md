# Barcode and keyboard checkout

Use **Barcode** beside POS search, or press **F3**, to open the dedicated scanner input. Use a keyboard-wedge USB/Bluetooth scanner configured to send Enter after a code. This is not a camera/GS1 decoder; verify the actual device suffix/configuration during acceptance testing.

Each accepted scan queues one unit. Codes preserve case and leading zeroes. The lookup uses the existing exact `barcode` filter on `/pharmacy/medicines`, the active branch and active/in-stock flags. The frontend rejects missing, ambiguous or nonexact responses. Catalog category/search filters do not restrict dedicated barcode lookup.

Up to 50 scans can be pending. Requests run sequentially; another code can be entered while the previous one is loading. The cart consumes available unexpired stock in FEFO order and moves to the next batch when the earlier one is reserved. It never intentionally exceeds the returned batch quantities. Scanning does not reserve stock on the server; checkout still needs server-side stock/concurrency validation.

Failed scans remain in an attention list with code, reason and explicit retry/dismiss actions. New successful scans do not erase earlier failures. Queue overflow rejects the new scan with a message; rescan it after the queue shrinks. Stopping the scanner, changing branches or leaving the scanner cancels pending lookups. Items already added stay in the cart. Failed/pending scan records are local to the open scanner panel.

Checkout waits for pending scanner/search operations to finish. Opening another POS workflow stops the scanner. Use F2 for medicine search, F3 for barcode, F4 for checkout and Escape to leave the current POS overlay/scanner. Application shortcuts do not act behind the native preferences dialog or register/history dialogs. Normal typing in customer, quantity and payment fields is not globally captured as scanner input.

Search supports arrow keys and Enter. If the query/filters have changed and results are not ready, Enter performs a fresh lookup instead of selecting an old catalog card. Changed query/branch/filter context invalidates late selection results. Numeric codes require exact barcode matches; for opaque/alphanumeric identifiers use explicit Barcode mode. Repeated keydown from holding Enter does not enqueue duplicates. Intentional separate repeated scans each count as one unit.

## Verification

`tests/barcode-policy.test.mjs` covers opaque identifiers, validation and unique exact matches. `tests/pos-scanning.browser.cjs` uses synthetic API fixtures for rapid queued scans, FEFO, stock exhaustion, failed scans/retry, stale search, checkout gating, cancellation and mobile keyboard flow. No sale or stock mutation is posted to the live backend by these tests.

Manual development checks should cover your scanner model, prefixes/suffixes, Bangla/English keyboard layout, slow connection, low-stock batches, expired stock, multiple cashiers and physical receipt printing. Scanner success means an item entered the cart; only the saved sale response confirms checkout.
