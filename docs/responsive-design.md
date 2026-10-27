# Responsive design system: desktop, tablet and mobile

Responsive behavior applies to every backend module, not only POS. Layouts reflow around the task and input method; screens are not reduced desktop screenshots.

## Breakpoint behavior

| Viewport | App shell | Data-heavy screens | Primary action pattern |
| --- | --- | --- | --- |
| Desktop, 1200px and wider | Persistent labeled sidebar, branch switcher, topbar and content canvas. | Dashboard cards in four columns; tables with headers and useful density; POS keeps products and cart side by side. Cart is a persistent panel, not a modal. HR uses roster/calendar grids. | Persistent page action or checkout summary, keyboard shortcuts for scanner/search workflows. |
| Tablet, 768–1199px | Collapsed/overlay navigation; keep branch and cashier visible. | Dashboard uses two columns; table filters open in a side sheet; POS cart is a collapsible drawer with a visible item-count/total button. In landscape it may stay open; in portrait it starts collapsed. HR shifts to a compact one-week roster. | Large touch controls; primary action stays visible in the working pane. |
| Mobile, below 768px | Single-column content with a compact header, permission-aware navigation drawer/bottom bar, and visible branch context. | Tables become stacked summary cards with detail sheets; filters open in a bottom sheet; POS keeps the cart collapsed to a sticky item-count/total bar until tapped, then shows full-screen cart/checkout. HR roster becomes day/week list; charts become horizontally scrollable with readable labels. | Thumb-friendly controls with at least 44px targets; sticky bottom action where a user must finish a workflow. |

## Filter behavior

- Do not keep the whole filter set expanded by default.
- Keep search and the one most common quick filter visible (for stock search, “In stock” is a quick filter). Put the rest behind **Filter**.
- Show applied criteria as removable chips; expose result count and **Clear all**.
- Desktop uses a compact popover or side panel. Tablet uses a side sheet. Mobile uses a bottom sheet with common filters first and an expandable **More filters** group.
- Keep draft filter state separate until **Apply** is pressed; **Cancel** closes without mutating the current results.
- Preserve selected filters and pagination when opening an item and returning to a list.

## Module adaptations

| Module | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Setup, sign-in, users and roles | Split setup wizard, user table and permission matrix. | Stacked wizard steps, compact user list, permission groups in collapsible sections. | One step/form at a time; user cards; permission groups with clear role context and sticky save action. |
| Overview and reports | KPI grid, chart and supporting tables side by side. | Two-column KPIs and vertically stacked charts. | Two KPI cards per row, single chart per panel with horizontal labels, date/branch controls in sheet. |
| Medicine catalog and inventory | Search/filterable tables with batch details and actions. | Dense cards or table with filter drawer. | Medicine cards; batch/expiry detail opens a full-screen sheet; adjustment/transfer forms stack fields. |
| POS, cash register and sales | Product/cart split, checkout summary, till controls. | Cart drawer and touch-oriented product view. | Scanner/search → product cards → full-screen cart/checkout; register opening/counting in focused screens. |
| Purchases, suppliers and returns | Supplier and line-item editor side by side. | Collapsible supplier summary and item editor. | Step-based supplier → items → payment/return; line items are cards with batch/expiry fields. |
| Customers and finance | Customer/account tables with balances and transaction history. | Filter sheet plus summary cards. | Customer cards; due invoices listed with selectable allocations; payment controls grouped in a single checkout panel. |
| HR, attendance, leave and rosters | Calendar/roster matrix with employee columns. | One-week compact grid with horizontal navigation. | Day/week agenda list; check-in and leave approval are individual cards with clear status. |
| Notifications, notices and media | Split notice list/detail and media library grid. | Tabs and drawer detail. | Notice cards and full-screen detail; media uploads are a simple queue with progress. |
| Settings, audit and backups | Section navigation with forms and history table. | Settings categories become an accordion; audit filters in a sheet. | One settings section at a time; backup/restore status and confirmation occupy a focused screen. |

## Accessibility and interaction

- Inputs, icon buttons and touch targets remain usable at 200% zoom; avoid hover-only actions.
- Keyboard focus order follows the visible task sequence; scanner entry must not steal focus from an open modal or payment field.
- Use text/status plus color for stock, expiry, payment and attendance states. Keep focus rings visible and support reduced-motion preferences.
- Preserve the same backend permission checks and business rules at every viewport; hiding a button is not authorization.

The responsive POS board is the first detailed example. These rules are the shared design contract for all other screens in `pos-design-spec.md` and `backend-audit.md`.

## Visual boards

- [POS workspace, filters and cart](design-assets/pos-responsive.webp)
- [Medicine catalog and batch inventory](design-assets/catalog-inventory-responsive.webp)
- [Finance reports and customer due collection](design-assets/finance-customer-responsive.webp)
- [HR, notices, settings and backup history](design-assets/hr-operations-responsive.webp)

## Cart visibility states

- **Desktop:** Keep the cart visible beside the product list so each add/edit immediately updates the total. It can collapse on narrow desktop widths, but does not block search or barcode entry.
- **Tablet:** The responsive board shows the cart-open landscape state. The actual layout has a cart toggle with item count and total; start collapsed in portrait or constrained widths, and let the cashier open/close the drawer without losing cart state.
- **Mobile:** Do not show the full cart while browsing. Keep a sticky summary bar with item count, total and **View cart / Checkout**. Tapping it opens a dedicated full-screen cart/checkout state; Back returns to the previous product search and preserves filters and scroll position.
