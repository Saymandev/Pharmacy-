# Cash register closing

In POS, open the register menu beside the medicine catalog.

Opening accepts zero or a positive amount with at most two decimal places and an optional note. Before opening, the frontend checks whether a session already exists in the branch. Repeated clicks are blocked during the operation.

Closing shows the server's opening balance, recorded sales/expenses (when available) and expected balance. Count physical cash and enter it yourself; the field starts empty. Difference is counted minus expected: negative means shortage, positive means overage. Add a closing note if needed.

Before posting close, the frontend reloads session detail. Closed sessions, a changed branch, invalid amounts, missing expected balance or a failed refresh block the request. If expected balance changed, review the updated difference and submit again. The backend's close response supplies the recorded difference. Another transaction can still occur after the frontend refresh; atomic close/ledger consistency belongs to the backend.

Register history uses server pagination metadata, includes opening/closing notes and displays times in Asia/Dhaka. Old detail requests cannot update a dismissed dialog or a different branch.

## Live verification needed

Browser regressions use mock API responses and never write to the live backend. Test actual opening/closing, branch permissions and account movements on the deployed service.

The frontend uses `closingBalance` from the server; it does not reconstruct drawer cash from sales totals. In the supplied backend, sales/purchase services update session balances using paid amounts across payment methods, and status transitions include gross-total updates. The backend developer should verify that cash, bank, mobile payments, partial payments, returns and pending-to-completed transitions each affect the physical drawer correctly. Closing service permissions/ownership and concurrency also need backend verification.

Purchase returns remain dependent on the missing API: see [handoff](purchase-return-api-handoff.md).
