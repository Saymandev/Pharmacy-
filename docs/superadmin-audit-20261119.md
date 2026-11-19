# Super Admin product and UI audit — 19 November 2026

Follow-up: the first shell/control/overview and plan workflow delivery is recorded
in [console verification](platform-console-verification.md). Findings below
describe the audited baseline; the full requirement coverage is still open.
The global subscription directory follow-up is recorded in
[subscription directory verification](subscription-directory-verification.md).

Status: audit completed; the product gaps below are OPEN. This document does not
mark SaaS-018–029 complete or claim a percentage of product completion.

Reviewed frontend main `5fcb00d`, backend main `1f6de74`, the user's hosted-panel
screenshot, the agreed backend `doc/saas/platform-billing-requirements.md` and
`platform-work-packages.json`. Checked the actual production Next build in a
local HTTP/browser fixture at 1366×768 and 390×844, with English/Bangla and light/
dark states. No hosted database mutations, payments, role changes or deployments
were performed. Authenticated hosted controls were not exercised in this audit.

## Outcome

The current `/platform` is a functional foundation for selected operations, not a
finished Super Admin application. It opens a shop directory and a large plan
editor. There is no platform Overview or module navigation. Existing per-shop
features are embedded in one detail column; larger administration requirements
are missing. Passing API tests and having a working login do not establish
product completeness or visual acceptance.

## Reproduced defects

| ID | Priority | Evidence and effect | Required correction |
|---|---|---|---|
| UI-01 | P1 | `src/app/controls.css:20–26` scopes Select wrapper/native/display styling to `.app-frame,.setup-page`. Platform uses `.platform-panel`, so the native select and custom display are BOTH visible. Measured native opacity 1/position static. | Give shared controls an explicit platform scope or make their structural styles component-owned. Verify keyboard, focus, disabled state, popup positioning and outside/Escape dismissal. |
| UI-02 | P1 | `platform.css:1` applies width:100% and padding to ALL platform inputs. In the feature editor, checkbox width measured 392px inside a 421px label on desktop, 278px inside a 332px label on mobile. | Exclude checkbox/radio/file from text-input rules; use fixed-size checks, nearby labels and full-row activation. |
| UI-03 | P1 | `platform-panel.tsx:38–57` always renders shops and the full PlanCatalog on the same page. No application sidebar/tab navigation, zero dashboard metric components. | Create a platform shell and distinct Overview, Shops, Plans/Add-ons, Subscriptions, Billing, Customization and Audit/Operations destinations. Preserve authorization at every destination. |
| UI-04 | P1 | Desktop starts with an empty detail column (`platform-panel.tsx:54`). On mobile, selected detail follows a whole page of up to 20 shop cards. Measured selected-page height 5,823px in the local fixture. There was no horizontal overflow; the problem is reachability and page structure. | Use a dedicated shop detail route or accessible drawer with tabs and stable selected state. Put the selected shop near the current interaction on mobile. |
| UI-05 | P1 | `commercial-workspace.tsx:365–610` displays the entire editor below the catalog without an explicit create/edit step. List publication/retirement buttons depend on the shared reason field at the bottom (`:318–330`). | Open a focused editor/modal, show action-specific reasons and confirmations beside the action, retain revision/idempotency/retry protections. |
| UI-06 | P2 | Dedicated audience requires comma-separated raw shop IDs (`commercial-workspace.tsx:438`). Limits expose `storageBytes` and raw values such as 104857600 (`:557`). | Search/select shops by recognizable name, show plan eligibility and selected audience; use labelled storage units with validated conversion to backend bytes. |
| UI-07 | P1 | AST scan of literal `t()` calls in platform components found 251 distinct keys and 54 absent from the translation dictionaries. Dynamic keys and unwrapped text are excluded, so this is not a complete language inventory. Screenshot and local Bangla capture show untranslated plan/term/reason/subscription labels. | Complete English/Banglish copy including labels, errors, states, actions, helper text and dynamic enums. Use the user's familiar terms in Bangla script. |
| UI-08 | P2 | General buttons/inputs have basic styling but no consistent primary/secondary/danger hierarchy; details/subscription/billing forms accumulate vertically. Dark mode retains the same broken select/check structure. | Establish platform tokens, compact headings/toolbars, readable type, action menus, dialogs, loading/error/empty states and keyboard focus. Visual QA must cover both themes. |

Local fixture measurements: desktop 3,309px document height; mobile selected page
5,823px. Fixture has 21 shops, unlike the user's three-shop screenshot: these
heights illustrate growth behaviour and are not measurements of hosted data.
Browser JavaScript error count was zero despite the visible control defects.

## Requirement coverage

| Area | What the code currently provides | Open product work |
|---|---|---|
| Platform shell and Overview | `/platform`, explicit operator session/capabilities, access-denied state | Navigation and actual overview metrics/queues/trends; no overview aggregation endpoint exists in the platform router. |
| Shop directory | Server search/status pagination, pending intake, invitations, accepted-owner provisioning, activation checks, suspend/resume | Compact directory, richer contact/owner profile, coherent usage summary and lifecycle screens; platform archive/export/retention workflow is absent. Base shop projection only selects id/name/slug/status/isolationReady/timestamps. |
| Plans and dedicated agreements | Public/dedicated audience, draft/clone/edit/publish/retire, immutable published versions, terms/trial/grace/features/limits | Usable catalog/editor, named shop picker, plan comparison and readable limits; currently BDT-only despite the broader configurable-currency requirement. |
| Subscriptions | Per-shop assign, snapshot/history, scheduled change, cancellation, complimentary renewal, trial/grace extension; paid settlement remains separate | Global list/filter/search, upcoming expiries, recovery/renewal queues and understandable change previews. There is no cross-shop subscription directory API. |
| Billing | Per-shop invoice documents including browser Print/Save PDF, quotes/debit/credit corrections, manual payments, proof, allocations/releases, reversal, refunds and request review | Dedicated cross-shop invoice/payment/credit/reconciliation screens and review queues. Existing backend billing reads are shop-targeted. Do not report invoice/PDF/manual-payment functionality as wholly missing. |
| Add-ons and usage | Versioned add-on API and per-shop effective entitlement/usage/grant controls | Global add-on catalog and readable usage/limit comparison in the platform navigation. Existing effective usage projection can be reused without exposing business records. |
| Platform operators | Explicit PlatformOperator records and capability enforcement; bootstrap CLI | Operator directory/create/invite/change/suspend UI and API, managed roles/capabilities and administrative recovery. Do not turn a shop role named Super Admin into platform access. |
| Support access | Platform/business-data separation | Separate time-limited, reasoned, revocable, audited support grants and UI. Broad impersonation or an unrestricted shop-data bypass would violate the agreed boundary. |
| Themes and templates | Tenant-local fixed palettes/fonts/density/layout presets, publish/restore editor and consumption; receipt snapshot work also exists | Platform theme/template catalogs, safe version publication/eligibility/preview/fallback and compatibility management. A complete historical-template reproduction guarantee is not established by fixed tenant presets. |
| Notifications and operations | Tenant-scoped notification/job foundations and per-shop security audit; backend `/audit` supports an optional target | Platform inbox, durable billing/expiry outbox/delivery and operational queues/health/failure recovery. Global audit browsing/filtering is not exposed by the current selected-shop UI. |
| Payment gateway | Provider-neutral interface and sandbox code | Actual SaaS server wiring and configured provider/merchant onboarding/sandbox verification. `createSaasApp` does not accept/forward a billingGateway and `saas-server.ts` supplies none. Manual billing is separate; this audit did not trigger real charges. |
| Release acceptance | Local functional/security checks and recent runtime/login/logout fixes | Full operator/shop/billing/customization workflows, visual and keyboard acceptance, notifications/provider verification and deployment UAT. SaaS-029 remains open. |

The agreed requirement IDs are SaaS-018–029; do not create a second unrelated
task tree or close these requirements solely because a staged API is present.
The implementation-plan statuses contain older local/release notes and need to
be maintained against current code and acceptance evidence.

## Implementation order and completion evidence

1. Platform shell, common controls and complete English/Banglish labels. Separate
   modules, compact responsive header/sidebar, clear action styling and focused
   forms. Done when initial/selected/error/loading/light/dark states work at
   desktop and 390px mobile, with no duplicated controls or detached labels.
2. Real Overview API/UI using authorized platform projections: shop lifecycle,
   effective subscription states, upcoming expiries and payment review queues.
   Define revenue from verified platform billing records, never pharmacy sales;
   distinguish invoiced, received, allocated, credit/refund and recurring-contract
   measures. Include date range/timezone and empty/error states; do not fake
   totals by counting only the currently paginated shop list.
3. Shop directory and dedicated detail view: owner/contact, subscription, usage,
   invoices/payments and audit tabs; existing lifecycle guards remain mandatory.
4. Plans/Add-ons workflow: focused version editor, named dedicated audience,
   readable module/limit controls, comparison/preview and per-action reasons.
5. Subscription directory and renewal/change/recovery queues, reusing immutable
   contracts and the existing quote/settlement rules.
6. Global billing workspaces for invoices, payment verification, credit/refund,
   requests and reconciliation; keep accounting definitions and audit evidence.
7. Operator management and bounded support access with separate permissions,
   expiry/revocation and audit; protect last-owner/operator recovery boundaries.
8. Platform theme/template version catalogs and per-shop eligibility, preview,
   publish/restore/compatibility, then historical print/document acceptance.
9. Platform notifications/outbox, operations monitoring and required lifecycle
   jobs; configure and verify a chosen gateway if automatic payments are wanted.
10. Full UAT and release evidence across all agreed requirements, with statuses
    updated individually. Existing security checks are retained throughout.

## Evidence locations and limits

Workspace artifacts outside Git:

- `outputs/superadmin-audit-20261119/measurements.json`
- `outputs/superadmin-audit-20261119/translations.json`
- `outputs/superadmin-audit-20261119/desktop-light.png`
- `outputs/superadmin-audit-20261119/shop-selected.png`
- `outputs/superadmin-audit-20261119/desktop-bangla.png`
- `outputs/superadmin-audit-20261119/mobile-bangla.png`
- `outputs/superadmin-audit-20261119/mobile-dark.png`

These are local fixture captures, not hosted account screenshots or proof of
current live billing data. This pass audited and recorded gaps; it did not
implement the redesigned panel or rerun the complete business/security suites.
