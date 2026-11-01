# Sales, due payments and returns

## Sales history and invoice details

Search invoices/customers and use branch, status, payment, date and amount filters. Dates/timestamps are displayed in Asia/Dhaka. Reversed date/amount ranges are rejected. List requests are cancelled or ignored when a newer selection supersedes them. A failed detail request shows its error rather than substituting incomplete list data. Persisted zero-value items stay zero; receipt reprinting uses saved invoice values.

The invoice-matched count covers the filtered result; paid/due/value cards explicitly describe the current page and are not whole-period financial summaries. Use Reports for full-period aggregation.

## Collecting due

1. Open the invoice and choose Collect due. Rejected invoices cannot accept payments.
2. Enter a positive amount with at most two decimal places, or choose Pay full due.
3. Choose an active payment account/method and optionally add a note.
4. Record payment. The frontend first reads the current invoice and checks the amount against its latest outstanding due. If another payment changed the balance, the form shows the updated due and prevents an excessive payment.
5. A synchronous lock prevents duplicate in-flight submissions. The note/account/method/amount are sent to `POST /sales/:id/payments`. The saved response supplies the remaining due.

The form remains open with an inline error when validation or the request fails. Inputs and dismissal are disabled while a mutation is running. A timeout is not proof a payment failed: inspect the invoice and transactions before retrying. The API has no confirmed idempotency contract, so the frontend never automatically retries a payment.

## Preparing a return

Only completed or previously returned invoices are eligible. Preparing a return requires invoice-read and return-history-read access as well as return-create permission, because earlier requests must be checked.

- Exact invoice lookup is tried before a broader invoice/customer search.
- The return form opens only after fresh invoice details and every return-history page have loaded.
- Completed and pending requests consume the return allowance; rejected requests do not. Malformed/incomplete/mismatched history blocks the action.
- Medicine + batch form a shared allowance, including duplicate lines on the original invoice. Each selected line is also bounded by its original quantity. Medicine returns use whole units; service quantities may use two decimal places.
- Before saving, the frontend re-fetches the invoice/history, checks the quantities again and uses the latest original line fields for the payload.
- The displayed original item value is **not a promised cash refund**. Item/order discounts, taxes and existing due affect final settlement. The saved return supplies its final value.

Pending review is the default. It does not deduct cash or restore stock until approved. For Complete now, an optional refund account can be sent using the backend-supported `accountId` field; otherwise the service chooses the original/latest payment account or its default cash fallback.

## Reviewing a pending return

Return details are fetched from `GET /sales/returns/:id`. Before approval/rejection, the current return status is read again. Approval also verifies the original invoice and cumulative return quantities; its own pending record is excluded from previous-request totals. A return already reviewed elsewhere cannot be processed again from the stale screen.

Approval sends only `{ status }` to `PATCH /sales/returns/:id/status`. This endpoint does not accept a refund-account override; the UI explains that it uses the original payment account/fallback. The frontend does not invent an unsupported field or endpoint.

Return details show saved item totals, the net adjustment and the saved final return value separately. Settlement reduces outstanding due before paying cash back, according to the backend. A saved return value is distinct from cash refunded. Verify the original invoice, stock history and outgoing account transaction after a completed return.

## Verification

`npm test` includes seven sales-policy tests covering money precision/limits, rejection, pending/completed return allowance, duplicate batches, line limits, fractional quantities, malformed history and invalid filters. `tests/sales-flows.browser.cjs` uses isolated mock API responses to cover fresh due validation, duplicate submit, payment notes, complete history loading, history changes at submit time, latest original prices, refund account, approval, zero totals, mobile layout and denied read access.

These are frontend checks. They do not prove real database stock/ledger effects or transaction-level concurrency safety. The backend source is unchanged.

## Findings for the backend developer

The uploaded add-payment service derives sale status from payment status (partial payment can change a completed sale to pending), while pending-sale completion is also a stock-posting trigger. Confirm and correct this lifecycle in the running backend. The frontend displays the returned status and does not invent a different persisted state.

Cumulative return limits must also be enforced inside the backend transaction. Client revalidation narrows stale-data errors but cannot prevent simultaneous requests from other clients. Return pricing and order-discount/tax proration must be verified against the original sale, especially repeated same-batch lines with different discounts. The current return API does not identify the original sale-item row directly. Automatic retries require backend idempotency support.
