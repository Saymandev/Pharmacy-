# Customer statements and collection

Open Customers and choose a customer. The detail drawer has **Due collection** and **Statement & history** tabs.

The account balance is a separate backend field. It can include advance amounts; it must not be presented as the sum of outstanding invoice dues. The due tab separately shows the selected branch's completed invoice dues.

## Collection

Choose a branch and account. Fill individual invoice amounts, use **Fill invoice dues**, or use **Fill full POS due** for the oldest-invoice allocation endpoint. Only completed invoices are eligible in this frontend. Auto-allocation is blocked if the backend could include a non-completed POS invoice with a positive due.

Amounts accept cents and reject overpayment without silently reducing what the user typed. Before either payment request, the frontend reloads every page of customer invoices and validates customer, branch, status and due. If balances changed, review the updated values and resubmit. Add a payment note for the transaction record. Repeated clicks are blocked during the request. After success, invoices and customer information reload.

The backend still needs atomic overpayment checks and idempotency for retries across browsers or interrupted connections. A frontend lock only prevents concurrent submissions in this mounted workspace. The bulk-payment service and auto-allocation service differ in how they update register balances; the backend developer should verify register posting and closed-session behavior.

## Statement

The statement loads every invoice page. When sale-return:read is granted, it fetches return pages per invoice (four concurrent requests) rather than requesting unrelated customer returns. Transactions shared between an invoice and return appear once.

Rows distinguish current saved invoice value, recorded payment, return face value and actual recorded refund. A return value is not cash refunded. Pending/rejected invoice and return values do not contribute to the completed-value totals. Referral/account expenses are not treated as customer refunds. No artificial running balance is calculated because historical invoice amounts may change after returns.

Branch and date filters apply to event dates in Asia/Dhaka, so a later payment for an older invoice appears on the payment date. Invoice totals use current saved invoice amounts, not reconstructed original charges. Payment/return/refund totals therefore need not match the invoice total within a date range.

Screen rows are paginated; print and CSV contain all filtered rows. Failed return loading or invalid filters disable export. Without return-read permission, statements explicitly state that return history is omitted. Missing transaction history is not reconstructed from invoice paidAmount. Standalone customer advances without invoice-linked transactions need a dedicated backend ledger endpoint for full account reconciliation.

## Test scope

Unit and browser tests use synthetic records. Live acceptance should cover account posting, partial payments, old invoice collection, customer advances, return due adjustments, refunds, register linkage and permission restrictions. No backend files are changed.
