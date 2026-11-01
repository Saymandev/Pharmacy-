# Pharmacy POS frontend

Frontend for the Pharmacy POS backend. The UI is implemented against the backend’s Express `/api/v1` routes and response envelope; it does not introduce a second data model or seed fake operational numbers.

## Stack and structure

- Next.js App Router and React with strict TypeScript
- Tailwind CSS v4 import plus a small CSS-token design system for application components
- Feature-oriented source layout: `features/`, `components/`, `lib/`, and `types/`
- Next.js server proxy for API traffic, with JWTs kept in HttpOnly cookies
- API types mirror the backend’s `{ success, message, data, meta? }` envelope

```text
src/
├── app/                  # Routes and same-origin server API handlers
├── components/           # App shell, dashboard, and auth provider
├── features/             # Auth, reports, and POS workflows
├── lib/api/              # Typed API client
└── types/                # Backend response and domain contracts
```

## Local development

Requirements: Node.js 24 LTS (for the TypeScript contract tests) and npm.

```bash
npm ci
cp .env.example .env.local
npm run dev -- --port 3000
```

`.env.example` targets the supplied development API at `https://hms-srv-dev.genify.live/api/v1`. Set `BACKEND_API_URL` in `.env.local` to your backend origin or API base. The proxy accepts both forms without duplicating `/api/v1`. For a local backend, use a different port from the frontend, such as `http://localhost:3001`.

Sign in with a backend account. Do not commit credentials. See [frontend testing](docs/frontend-testing.md) for the full manual checklist and regression commands.

The Next.js route handlers proxy requests to `BACKEND_API_URL/api/v1`. This keeps the browser same-origin with the frontend and avoids exposing the backend origin to client code. Login returns tokens only to the Next.js server; the server sets HttpOnly, SameSite cookies and forwards the access token to protected backend endpoints. Production cookies use `Secure` and require HTTPS.

## Implemented slice

- Login using the backend’s `POST /api/v1/auth/login` contract (`usernameOrEmail` and `password`)
- Current-user bootstrap using `GET /api/v1/auth/me`
- Sign out by clearing the server-owned session cookies
- Role/permission-aware pharmacy overview using `GET /api/v1/reports/pharmacy/stats` and `/reports/pharmacy/graph`
- Responsive POS with live medicine/customer search, stock batches, bounded discounts, payment accounts, and register opening
- Branch-aware medicine catalog and inventory views with category/generic/manufacturer filters, batch/expiry visibility, and client-derived low-stock/expiry states
- Supplier directory and purchase workflow with batch entry, discounts, supplier payments, pending/receive states, and stock posting
- Paginated sales history with backend filters, due collection, sale detail and bounded batch-based return requests/review
- Dhaka-local date labels, BDT formatting, responsive layout, keyboard focus styles, and reduced-motion support
- Dashboard metrics are loaded from the API; no sample sales or inventory values are presented as real data

## Backend integration notes

- The backend exposes the JWT refresh token but currently has no refresh-token route. The frontend stores the refresh token in an HttpOnly cookie for future integration; access tokens are not exposed to JavaScript.
- Existing workspaces cover catalog, inventory, purchases, sales/returns, customers, finance, HR, roles/users, notices/notifications, media, settings and backups. API inventory and verification status are tracked in [the API review](docs/api-coverage.md); screen presence does not prove live integration.
- Align backend CORS and deployment origins with the Next.js server before production rollout. Browser requests go through the Next server proxy.

## Design reference

- [A–Z page design matrix](docs/page-design-matrix.md)
- [Responsive design rules and visual boards](docs/responsive-design.md)
- [Backend integration audit and gaps](docs/backend-audit.md)
- [POS workflow design details](docs/pos-design-spec.md)
- [Reporting workflow, date scope and exports](docs/reporting-guide.md)
- [Sales, due collection and return workflow](docs/sales-returns-guide.md)
- [Inventory operations and history requirements](docs/inventory-guide.md)

Purchase and supplier workflow: [guide](docs/purchase-supplier-guide.md). Regression checks cover fresh due/status validation, payment deduplication, supplier PUT updates and linked-record deletion errors using mocked API responses.

Cash register reconciliation: [guide](docs/register-guide.md). Purchase Return API dependency: [backend handoff](docs/purchase-return-api-handoff.md).

Customer ledger and due collection: [guide](docs/customer-ledger-guide.md).

Backend developer handoff (missing APIs, proposed contracts and accounting fixes): [full requirements](docs/backend-developer-handoff.md).

Theme and language controls: [appearance guide](docs/appearance-language-guide.md).

POS barcode and keyboard flow: [guide](docs/pos-barcode-guide.md).

58/80 mm receipts and reprints: [printer setup and behavior](docs/receipt-printing-guide.md).

Before live rollout: [development acceptance checklist](docs/live-pos-acceptance.md) and [workspace access behavior](docs/workspace-access-guide.md).
