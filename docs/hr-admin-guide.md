# Finance, HR and Admin frontend audit

Audited against frontend baseline `1e84e69` and the supplied backend ZIP. No backend code or operational data was changed. All automated browser checks use mocked API responses; live acceptance is deferred until the frontend work is complete.

## Permissions and form behavior

HR operations, HR setup and duty rosters select the first readable tab and omit other tabs. List calls use that tab's exact read permission. Form options load only when a form needs them and the account can read the related resource. Creating/editing attendance needs employee options; leave creation needs employee and leave-type options; designations need departments; roster creation needs shifts; assignments need employees and rosters. The corresponding actions are hidden when those option permissions are missing. Delete actions do not need unrelated option reads. Existing APIs and permission keys are reused. Dropdowns retain the existing bounded option lists (up to 100 records for paginated resources); these are not full-directory exports.

Admin media, settings/audit/backups and branches use their own read permissions. Notifications and notices remain authenticated reads, matching the supplied backend routes. Their create/delete actions retain explicit action checks. Team access separates user and role tabs; user forms load readable role/branch choices and role forms load the existing permission inventory. No new backend permission keys are assumed.

Writes check the current action permission and a synchronous in-flight lock, preventing two events before React updates from issuing two mutations. Controls and dialog dismissal are blocked during writes. Failed writes leave the form available for review and explicit retry; there is no automatic mutation retry. This is frontend duplicate protection, not server idempotency.

New-user and reset passwords follow the backend minimum length and uppercase/lowercase/number rule. Employee age must be an integer of at least 18. Salary/opening balances use non-negative, two-decimal validation; email/date values are checked before serialization. Leave/calendar/roster date ranges reject missing, invalid and reversed dates. Leave allowances require non-negative integers. Shift time ordering, notice attachment HTTP(S) URLs, branch email and backup retention/cron syntax are checked. A leave without an explicit branch now sends the active branch ID.

Lists clear stale rows on load/error and ignore superseded responses. Loading, errors and successful empty results remain distinct, with retry controls for list failures. Settings preserve incomplete structured JSON edits and validate them before submission; read-only users cannot edit the fields. Backup configuration must load (or return 404 for a new schedule) before editing is enabled.

Consultation account options require account-read and payment permissions. The settlement action counts doctors only among selected charges; unrelated doctors on the page no longer disable a single-doctor payment. Mixed-doctor/branch selections and duplicate in-flight settlements are blocked.

## Language and display

Finance, consultation, HR, roster, configuration, communications and access controls use the shared language provider. Bengali labels, validation messages, confirmations, statuses and action text are supplied in `src/lib/i18n/workspace-bn.ts`. Enum options retain their original API values when labels change. Backend/user-generated names, raw permission keys, setting identifiers and backend error text are not translated as application copy. Displayed dates use Asia/Dhaka; finance amounts follow the selected locale. Theme behavior continues to use the existing shared palette.

## Backend dependency boundaries

Stock History, Purchase Return/Supplier Refund and the full Customer Advance Ledger remain deferred to the agreed backend contracts in [backend handoff](backend-developer-handoff.md). No proposed endpoints are called.

The supplied backup router/controller has no authentication/permission middleware. The frontend conservatively gates history/download behind settings-read and trigger/configuration behind settings-update. This does not secure those backend endpoints. The backend developer must confirm/enforce the intended authorization before live acceptance.

## Validation

Run `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`. Start the built frontend on port 3000, then run `npm run test:browser`.

`tests/hr-admin.browser.cjs` covers role-specific tabs/reads/actions, failed-list recovery, employee/leave-type/branch validation, duplicate posts, read-only settings/backups, role-only access, Bengali enum values and mobile overflow. `tests/consultations.browser.cjs` covers account-option permissions, selected-doctor grouping, duplicate payments, failed-list behavior, Bengali and mobile. `tests/workspace-forms.test.mjs` covers date/number/email/URL/cron validation and HR permission mapping. These checks do not verify deployed permissions, accounting or persistence.

Current validation record: production build, lint, TypeScript and all 17 Node test files passed. All 15 mocked browser scripts passed; the affected HR/Admin, user-reset, finance and appearance scripts were rerun after final fixes. Additional HR/Admin checks cover incomplete settings JSON, backup cron validation, new-user password validation and duplicate writes. The mobile backup layout was also inspected. No live API acceptance was performed.
