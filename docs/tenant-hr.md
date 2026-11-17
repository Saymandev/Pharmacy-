# Selected-shop HR integration — staged

The selected shop/branch workspace now opens HR & attendance when the current
membership can read at least one HR resource. Groups keep navigation compact:
Staff, Setup, Schedule and Attendance & leave. Ten sections support employees,
departments, designations, leave types, calendar, shifts, rosters, assignments,
manual attendance and leave requests/decisions. Only readable sections appear.

Forms use stacked labels, themed inputs, native-backed searchable Select controls,
compact details and a mobile single-column layout. Reference options use server
search and pages of 20 with explicit Load more; they do not silently truncate the
directory. Employee designation choices are filtered by department. List search,
status/reference/date filters and pagination are server-side. Filters float in a
dismissible popover; row actions support keyboard navigation and Escape/outside
dismissal. Salary/contact data is limited to the employee-read workspace.

Create/update/delete/decision/member-link actions honor deployment, HR feature and
resource permissions. Reference reads gate dependent forms. Unknown outcomes freeze
the exact request, resource navigation, form and dismissal until retry confirms
the saved receipt. Stale versions reload inspected state; foreign/malformed rows
remain hidden. The open dialog prevents a window-focus refresh from destroying
an in-progress form; shop/session disposal still aborts stale responses.

Employees are pharmacy staff. Their status does not deactivate a shared login.
An all-branch administrator may link an employee to an active member of this shop
with access to the employee branch; Team and HR authority are checked server-side.
Verified accepted owners use the existing owner proof. Linking never grants a
role or changes shared credentials. Member choices are server searched/paginated.

Shift times support overnight work. Leave and roster dates are inclusive; roster
assignments fit their parent date range and cannot overlap for one employee.
Leave decisions are final and approval checks annual allowances (0 = unlimited).
Imported attendance remains review-only; the new workspace writes explicitly
manual attendance and provides no biometric ingestion or payroll calculations.
Expired agreements retain authorized history and disable writes.

The BFF only permits the listed HR resource/method combinations, scoped record
IDs, leave decisions and employee membership links. It forwards the HttpOnly
cookie and route-bound tenant, never caller-provided tenant/identity headers.
Strict write bodies reject userId, roleId and medical billing fields. Legacy HR,
biometric webhooks and global identity mutation paths are not allowlisted here.

Use existing TENANT_SESSION_PREVIEW_ENABLED, TENANT_WORKSPACE_PREVIEW_ENABLED,
TENANT_CATALOG_WRITES_ENABLED and TENANT_BACKEND_API_URL in reviewed staging. The
backend HR migration/contract and owner role upgrade are required before serving
this build. See backend `doc/saas/tenant-hr.md`. No live settings/database or main
deployment was changed.

Verification: tenant-hr.test.mjs, run-tenant-hr-browser.cjs, scoped lint/TypeScript,
production build and companion native database regression. The actual Next BFF
browser scenario covers all ten sections, option pagination, stale and uncertain
writes, member links, leave decisions, scoped filters/search, foreign projection
denial, popovers, read-only actions and mobile dark/Banglish. Fixture screenshots
include the employee form; these checks are not live hardware/payroll UAT.
