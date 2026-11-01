# Live development acceptance: pharmacy checkout

Status: **Not run against the live backend or physical hardware by these frontend checks.** Run with development/test records, an admin, a restricted cashier and an agreed test branch. Do not use real customer payments for this checklist. Record actual outcomes and source IDs; report discrepancies to the appropriate frontend/backend developer.

## Controlled cash-and-stock scenario

Use one test medicine and an unused batch, no existing stock in the test branch, no tax/discount/referral fees, no other session transactions and no previous customer dues. Price/cost/quantities below are a reproducible example, not verified live outcomes.

| Step | Action | Expected stock | Expected physical drawer balance |
| --- | --- | --- | --- |
| 1 | Open cashier register with 1,000 cash | 0 | 1,000 |
| 2 | Receive 10 units at cost 20; pay supplier 200 in cash, once | 10 | 800 |
| 3 | Sell 2 units at 30; collect 50 cash, leave 10 due | 8 | 850 |
| 4 | Collect the remaining 10 cash against that invoice | 8 | 860 |
| 5 | Complete a return of 1 unit from the same batch, refund 30 cash | 9 | 830 |
| 6 | Count and close the drawer at 830 | 9 | Expected 830, counted 830, difference 0 |

At each step, capture invoice/PO/return/transaction/session IDs. Check that account balances, customer/supplier dues, stock and session totals agree with actual movements. Customer due should be 10 after step 3 and zero after collection; completing the return must not create a new due or apply the refund twice. Return value and cash refunded must be separate in the statement.

Stop and record a failure if any write returns an uncertain/timeout result. Inspect saved records before retrying. Frontend in-flight locks do not establish server idempotency.

## Additional checkout cases

| Case | Expected behavior |
| --- | --- |
| Same barcode scanned rapidly | One unit per accepted scan, sequential lookup, FEFO batch progression, no over-reservation in the cart. |
| Expired or wrong-branch stock | Cannot be sold through the current cart. |
| Failed scan / network error | Code remains available for explicit retry; unrelated successful scans do not hide it. |
| Pending scan then F4 | Checkout waits for pending work. |
| Total 30, cash tender 100 | Applied payment 30, change 70, drawer increases by 30. |
| Total 30, cash 10 and card 20 | Paid 30, due 0; drawer increases only by 10, card account by 20. |
| Full due sale followed by later collection | Stock moves once at sale; payment later reduces due and posts once to the appropriate current register/account. |
| Pending order later completed | No duplicate gross-total collection or repeated stock movement. |
| Held cart | Resume only within its branch; refresh/navigation does not promise recovery or stock reservation. |
| Two cashiers use the last batch unit | Backend accepts at most available stock; losing checkout reports a conflict without partial financial posting. |
| Two collectors pay the same due | Backend prevents overpayment; totals and transactions remain consistent. |
| Duplicate approval / timeout retry | Backend handles idempotency without repeated stock/refund effects. |

## Roles and navigation

- Admin can access configured workspaces. A restricted cashier sees only granted modules and actions.
- Pasting a disallowed workspace URL shows access guidance without mounting that feature's API requests. The shared auth/branch providers may still request their common context.
- A medicine-unit-read-only user opens Units in Catalog settings, never requests Categories by default and sees no create/edit/delete actions.
- A role with finance access can still lack access to a specific finance tab/action: the backend must enforce each endpoint independently. The shell guard is a navigation aid, not server authorization.
- Verify real 403 responses, branch/account scope, changed permissions and logged-out access. Never treat a hidden button as an access boundary.

## Receipts, language and hardware

- Test original receipt and reprint in English/বাংলা, light/dark theme, 58 mm and 80 mm.
- Check long names, all lines, saved zero amounts, item/order discounts, tax, paid/due and split payments.
- Reprint must show actual saved transactions; original tender/change are unavailable unless backend records them.
- Cancel print and close preview: no new sale, collection or stock change.
- Select the correct physical driver paper, disable browser headers/footers and check both paper edges, Bengali glyphs, feed and cutter behavior. Browser PDF verification does not verify a printer.

## Reports and completion record

Filter the correct branch and Asia/Dhaka dates. Reconcile saved invoices, collections, returns/refunds, supplier payments and drawer movements by their IDs. Check CSV/print against the full filtered dataset, not only the visible page. Document backend report definitions if event dates or accounting scope differ.

| Field | Fill during testing |
| --- | --- |
| Frontend commit / backend version | Not recorded |
| Test date / branch / cashier role | Not run |
| Scenario IDs and actual balances | Not recorded |
| Printer/scanner model and settings | Not tested |
| Pass/fail and issue links | Pending |

Missing APIs and accounting fixes remain documented in [backend handoff](backend-developer-handoff.md). Do not block the available frontend checks on purchase-return or stock-history routes that are not yet implemented.
