# Thermal receipt and reprint

Checkout and Sales → Print receipt now use the same preview. Select **58 mm** or **80 mm** and English/বাংলা in its toolbar. Paper width is saved in this browser; language uses the shared application preference. Closing the preview or cancelling the browser print dialog does not change a sale or payment.

## Printer setup

1. Install/select the actual thermal printer and choose its matching 58 mm or 80 mm roll/paper definition in the operating system/driver and browser print settings.
2. Use actual size / 100% scale when supported. Turn browser headers and footers off. Keep extra driver margins off or within the printer's printable width.
3. Print a short receipt and one with long medicine/customer/branch names. Check both edges, Bangla glyphs, item quantities, totals, last lines and cutter/feed behavior.
4. If text is clipped, confirm paper selection and hardware printable area before changing browser scale. The frontend cannot select your printer, configure its driver, confirm a physical print succeeded or operate a cash drawer/cutter through browser printing.

The application sets receipt content width and uses a named print page with zero CSS margins. Paper height remains controlled by the printer/browser; it does not claim to force a roll size. Browser PDF tests use explicit 58/80 mm page widths with a 297 mm test page height to check multi-page output. Actual roll/feed behavior needs device testing.

## Content and accounting

- Date/time uses Asia/Dhaka. Names, branch, invoice, batch and long references wrap rather than truncating.
- Gross subtotal, item discount, sale discount, tax, saved final total, paid and due are separate. Saved zero remains zero; unavailable amounts are displayed as an em dash rather than invented zeros.
- Original checkout can show tender/change only when the known tender, saved paid amount and payment lines reconcile. A mismatch hides that local tender/payment breakdown and asks the operator to check saved sales history.
- Reprints use current saved invoice values, not a reconstructed immutable original invoice. Recorded incoming sale transactions form the payment breakdown; recorded outgoing sale-return transactions are shown separately as refunds. Refunds are not subtracted a second time from saved paid/due amounts.
- The supplied backend does not persist original cash tender/change, so reprints explicitly state they are unavailable. Missing transactions do not become a guessed cash payment. A cashier name is displayed only if available as a name; an opaque creator ID is not printed as a person's name.
- Pending sales have an explicit notice that the slip does not confirm completed checkout.

The preview remains paper-white in dark theme. Print CSS isolates the receipt from the application and removes controls; all item rows stay in the print output. Bengali-capable system fonts are used, and print waits for document fonts to be ready. No external font service is required, but the workstation must have fonts with Bengali glyphs for dependable physical output.

## Verification

`tests/receipt-model.test.mjs` checks authoritative amounts and saved zeros, line-total fallbacks, unknown values, transaction deduplication, refund separation and tender/change consistency.

`tests/receipts.browser.cjs` uses mocked API data for a 35-item invoice with long bilingual names, split payments/refunds, both preview and print widths, multi-page PDFs, language selection, mobile, width persistence, closing and print action. Existing POS/reprint regressions also run. These tests do not claim physical-printer or live-backend verification.
