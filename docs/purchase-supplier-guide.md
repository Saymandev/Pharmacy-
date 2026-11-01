# Purchase and supplier workflow

Choose a branch, then open **Purchases → New purchase**. Select a supplier and search medicines. Enter quantity, batch and expiry for each line; use separate lines for separate batches. Quantities must be whole numbers, prices accept two decimal places, and duplicate medicine/batch lines must be combined.

Save pending until goods arrive, or receive immediately. The frontend rechecks the branch cash register before creating either type. An account is required for any initial payment. Overpayment is rejected, never silently reduced. The displayed discount and due use rounded currency amounts.

Open a purchase to see its items and payment history. Receiving and rejecting both confirm with the user and re-read status before changing it. Only pending purchases can change status. Rejecting does not automatically refund previous payments; review those with the backend/accounting team.

**Record supplier payment** supports full or partial due, account, payment method and note. The latest purchase is fetched before submission; a reduced due or rejected status blocks an outdated payment. Repeated clicks cannot send duplicate requests within the current operation.

Use **Suppliers** for paginated search, create, edit and delete. Required fields and optional email are validated before submission. Updates use the backend's PUT route. If linked purchases prevent deletion, the error remains in the dialog.

## Verification limits

Automated checks use mocked API responses and do not post to the live backend. The backend developer should verify live register/account ledger effects, receive/reject permissions, supplier ID validation and linked-record deletion behavior. Stock history still needs a mounted backend read endpoint; this frontend phase does not invent one.

Confirmed source mismatch: `prisma/schema/supplier.prisma` generates UUID supplier IDs, but `src/modules/pharmacy/supplier/supplier.validator.ts` validates edit/delete IDs with `cuid()`. The backend developer must align those validators with UUID IDs for live edit/delete to work. The frontend continues to send the original server-issued ID.
