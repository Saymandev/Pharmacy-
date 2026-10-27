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

Requirements: Node.js 20+ and npm.

1. Start the backend from `../pharmacy-pos-backend` on port `3000`.
2. Copy `.env.example` to `.env.local` and set `BACKEND_API_URL` to the backend origin.
3. Install and start the frontend:

   ```bash
   npm install
   npm run dev -- --port 3001
   ```

4. Open `http://localhost:3001` and sign in with a backend account.

The Next.js route handlers proxy requests to `BACKEND_API_URL/api/v1`. This keeps the browser same-origin with the frontend and avoids exposing the backend origin to client code. Login returns tokens only to the Next.js server; the server sets HttpOnly, SameSite cookies and forwards the access token to protected backend endpoints. Production cookies use `Secure` and require HTTPS.

## Implemented slice

- Login using the backend’s `POST /api/v1/auth/login` contract (`usernameOrEmail` and `password`)
- Current-user bootstrap using `GET /api/v1/auth/me`
- Sign out by clearing the server-owned session cookies
- Role/permission-aware pharmacy overview using `GET /api/v1/reports/pharmacy/stats` and `/reports/pharmacy/graph`
- Responsive POS with live medicine/customer search, stock batches, bounded discounts, payment accounts, and register opening
- Branch-aware medicine catalog and inventory views with category/generic/manufacturer filters, batch/expiry visibility, and client-derived low-stock/expiry states
- Dhaka-local date labels, BDT formatting, responsive layout, keyboard focus styles, and reduced-motion support
- Dashboard metrics are loaded from the API; no sample sales or inventory values are presented as real data

## Backend integration notes

- The backend exposes the JWT refresh token but currently has no refresh-token route. The frontend stores the refresh token in an HttpOnly cookie for future integration; access tokens are not exposed to JavaScript.
- Purchasing, sales history/returns, customers/finance, HR, communication, settings, and backup pages remain in the implementation sequence. Catalog and inventory are currently read-only operational views; management forms are still to be added.
- Align backend CORS and deployment origins with the Next.js server before production rollout. Browser requests go through the Next server proxy.

## Design reference

- [A–Z page design matrix](docs/page-design-matrix.md)
- [Responsive design rules and visual boards](docs/responsive-design.md)
- [Backend integration audit and gaps](docs/backend-audit.md)
- [POS workflow design details](docs/pos-design-spec.md)
