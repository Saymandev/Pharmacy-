# Platform billing workspace

Shop detail includes capability-gated invoice drafts, issue/void, manual payment
verification, allocations/releases, settlement/reversal, credits and refund
request/approval. Current term and renewal are distinct. A renewal collected early
does not replace current service dates. The backend calculates all final totals.

Immediate plan change shows a persisted expiring preview before creating the
change invoice. Required extra charge is funded first; negative adjustments
create a shop credit note. Published terms and private audiences stay authoritative.

Invoice, payment, activity and credit lists page independently. Every returned
record binds the selected shop; unsafe projections fail validation. HttpOnly session cookies, separate platform authorization, same-origin mutation checks, explicit route/body allowlists and
preview/write gates apply. No pharmacy tenant header is sent.

Uncertain writes freeze editing/navigation and retry the same body/key. Proof
uploads freeze the exact file/key. Proofs are private download attachments with
verification permission, not public links. Missing storage configuration hides
upload. The BFF bounds streamed binary bodies to 1 MB.

Invoice preview uses persisted terms/identity and Print / Save PDF opens an
isolated document. Financial snapshots remain reproducible after seller changes.
Labels follow the application Banglish terminology and both theme tokens.

Run `npm run test:billing`. For the production bundle, build first and set
`NEXT_BROWSER_MODE=start` before running the browser script. Fixture browser
results do not constitute a production gateway or live database verification.
