# Tenant private Media library

The selected shop workspace exposes Media library only with fresh media:read
permission and a verified working branch. Existing files remain readable when
subscription features expire. Upload/edit/trash/restore require both their role
permission and current communications feature; reservation recovery separately
honors the deployment write gate and media:create permission.

The library provides centered empty states, card skeletons, server-side filename
search/type/state filtering, native auto-dismiss filter popovers, paginated file
cards, explicit metadata editing, trash/restore confirmation and owned unfinished
upload cleanup. Trash remains recoverable and counts toward storage usage.
The responsive layout uses shared theme tokens and English/Banglish strings.

Uploads retain the original immutable File objects and operation key after an
unknown result. Edits/reconciliation also retain exact commands. Controls/close
stay disabled while the result is unknown. A committed upload can be recovered
through its safe status endpoint; an unconfirmed response never implies rollback.
Fresh rows/optimistic versions replace stale edit forms after 409 conflicts.

The Next BFF bounds raw multipart bytes before parsing (10 MB + bounded envelope),
then permits only 1–5 files, at most 5 MB each/10 MB total, and an explicit library
branch. Backend signature/MIME checks remain authoritative. It accepts no caller
auth/tenant headers, arbitrary upload fields or provider URLs. JSON mutations
require a valid save key, same origin and a strict versioned body.

Private downloads preserve no-store/nosniff/sandbox attachment semantics and allow
only expected raster/PDF MIME types and sizes. Download extensions match MIME.
Images preview through short-lived authenticated Blob URLs; PDFs are downloaded,
not embedded. All object URLs are released on close/scope disposal. Foreign shop/
branch projections, unexpected MIME/size and leaked provider fields fail closed.

Language changes no longer recreate the shop discovery/workspace transports or
clear the selected shop. A pending upload retains its form/key across a language
switch. Session/identity/shop changes still revoke and dispose the prior scope.

During verification, the installed Next.js 16.4.3 advisory was confirmed with npm
audit and the [maintainer advisory](https://github.com/vercel/next.js/security/advisories/GHSA-mfr8-8qww-v76h).
Next.js and eslint-config-next are pinned to 16.4.6; the production-dependency audit
reports zero vulnerabilities. Development dependency advisories remain separate;
this does not assert the entire dependency tree is vulnerability-free.

Tests: tenant-media.test.mjs and run-tenant-media-browser.cjs. Browser scenarios use
the real Next BFF and controlled upstream fixtures, not production data. Legacy
provider/public-media relocation, branding/template administration and retention/
purge/provider deployment remain outside this workflow.

Verified 2026-11-17: Next.js 16.4.6 production build, TypeScript, scoped ESLint and
11 relevant policy/transport/shop contract tests passed. Media, owner billing,
tenant workspace and shop discovery browser scenarios passed; the Media mobile
dark screenshot was inspected. Backend companion changes passed the complete
258-test disposable PostgreSQL regression. Production dependency audit: zero
reported vulnerabilities; no production app/database/storage deployment performed.
