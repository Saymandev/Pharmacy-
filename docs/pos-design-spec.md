# POS design specification

This spec accompanies the POS visual board. The screen design follows endpoints and fields reviewed in `backend-audit.md`.

## POS workspace

- **Context bar:** selected branch, signed-in cashier, active cash-register session and connection state. A closed/missing session opens the register workflow before completion.
- **Search:** barcode-first input; search by medicine name, Bangla name, generic, brand/manufacturer, category or group.
- **Filter drawer:** category, generic, manufacturer, dosage form, strength, unit, in-stock and branch. Keep the query/pagination visible and allow clearing every filter.
- **Product results:** medicine, generic, strength, unit, available quantity and price. Disable add when no sellable batch is available.
- **Batch picker:** batch number, expiry date, branch stock and MRP/sale price. A cart line stores the chosen medicine ID, unit, batch and expiry because the backend deducts stock by branch and batch.
- **Cart rows:** whole-number quantity controls for current integer stock, sale price/MRP, per-line percent or fixed discount, computed amount, line total and remove action. Show a clear warning when the requested quantity exceeds selected-batch stock.
- **Keyboard use:** barcode/search focus, add/scan, cart navigation, checkout, hold/restore and remove shortcuts. Shortcut hints are labels for frontend behavior, not backend capabilities.

## Checkout panel

- Select/search a customer; show phone and existing pharmacy due. An explicit walk-in customer record must be resolved before POST until the backend default-customer bug is fixed.
- Show subtotal, item discount, sale-level discount, taxable subtotal, tax rate/amount, grand total and rounding. Sale-level discount mode is percent or fixed amount; client derives both amount and percentage for the request.
- Payment supports the backend method enum and can add tender rows. Each collected tender selects a finance account, method and amount. Totals derive paid amount, due amount and due/partial/paid state.
- Offer **Save pending** and **Complete sale**. A successful completion receives invoice/details data and feeds a print-ready browser receipt. Never label pending stock movement as completed because the backend only deducts stock on completed POS sales.
- Display the backend service’s errors next to their subject: insufficient selected batch, missing branch/account, disabled user or invalid discount/payment inputs.

## Sales history and due collection

- Search invoice number, customer name, phone, or customer number.
- Filters: branch, cashier, register session, date range, type, sale status, payment method, payment state, amount range.
- Paginated rows show invoice, customer, time, total, tender summary, payment state and status. Actions: details/receipt, collect due, initiate return.
- Due collection uses a sale’s payment endpoint or the customer’s bulk-payment endpoint. Prevent input above the backend-reported outstanding due; show remaining due after collection.

## Returns and register lifecycle

- Return lookup begins with original invoice. Display original line/batch/expiry/quantity, previously returned quantity, remaining returnable quantity, and an editable partial-return quantity.
- Show refund estimate, refund account/source, note, and pending/completed/rejected decision. Completing a return can change stock and account balance; show a confirmation summary first. Keep the UI quantity cap until the backend enforces it transactionally.
- Register open captures branch and opening cash balance/note. Close shows system expected balance, physical count, difference and closing note; do not present `closingBalance` as cash-accurate until backend excludes non-cash tenders.

## Design language

- Forest green navigation, emerald primary action, pale mint selection, warm white working surfaces, restrained amber low-stock/expiry states and red only for destructive/critical actions.
- Keep dense POS controls aligned in a stable product/cart split. Checkout totals and completion action stay visible while the cart scrolls.
- Use BDT formatting and Asia/Dhaka dates from settings; labels, empty/loading/error states and keyboard focus are part of the design, not decorative afterthoughts.
- All example values in the visual board are illustrative. Product, customer, inventory, prices, tax and tender values must be API-derived in the implemented app.
