# Backend API inventory and frontend review

200 active backend route declarations discovered. Generated with `python scripts/audit-api-coverage.py`.

Candidate files are text references only: shared prefixes and dynamic entity maps require review. They do not prove an action exists, a payload is correct, or live integration passed. Webhooks are backend integrations, not cashier UI requirements.

| Method | API path (under /api/v1) | Frontend candidate files |
| --- | --- | --- |
| POST | `/auth/admin/change-password/:userId` | `access/access-workspace.tsx` |
| POST | `/auth/change-password` | `components/layout/app-shell.tsx` |
| POST | `/auth/login` | `app/api/backend/auth/login/route.ts`, `auth/auth-service.ts` |
| GET | `/auth/me` | `auth/auth-service.ts` |
| PUT | `/backups/config` | `admin/admin-workspace.tsx` |
| GET | `/backups/download/:id` | `admin/admin-workspace.tsx` |
| GET | `/backups/history` | `admin/admin-workspace.tsx` |
| POST | `/backups/trigger` | `admin/admin-workspace.tsx` |
| GET | `/branches` | `components/providers/active-branch-provider.tsx`, `customers/customer-workspace.tsx`, `access/access-workspace.tsx`, `admin/admin-workspace.tsx` |
| POST | `/branches` | `components/providers/active-branch-provider.tsx`, `customers/customer-workspace.tsx`, `access/access-workspace.tsx`, `admin/admin-workspace.tsx` |
| DELETE | `/branches/:id` | `components/providers/active-branch-provider.tsx`, `customers/customer-workspace.tsx`, `access/access-workspace.tsx`, `admin/admin-workspace.tsx` |
| GET | `/branches/:id` | `components/providers/active-branch-provider.tsx`, `customers/customer-workspace.tsx`, `access/access-workspace.tsx`, `admin/admin-workspace.tsx` |
| PUT | `/branches/:id` | `components/providers/active-branch-provider.tsx`, `customers/customer-workspace.tsx`, `access/access-workspace.tsx`, `admin/admin-workspace.tsx` |
| GET | `/communication/notices` | `admin/admin-workspace.tsx` |
| POST | `/communication/notices` | `admin/admin-workspace.tsx` |
| DELETE | `/communication/notices/:id` | `admin/admin-workspace.tsx` |
| GET | `/communication/notices/:id` | `admin/admin-workspace.tsx` |
| GET | `/communication/notifications` | `admin/admin-workspace.tsx` |
| PATCH | `/communication/notifications/:id/read` | `admin/admin-workspace.tsx` |
| PATCH | `/communication/notifications/read-all` | `admin/admin-workspace.tsx` |
| GET | `/customers` | `components/layout/app-shell.tsx`, `pos/pos-workspace.tsx`, `customers/customer-workspace.tsx` |
| POST | `/customers` | `components/layout/app-shell.tsx`, `pos/pos-workspace.tsx`, `customers/customer-workspace.tsx` |
| DELETE | `/customers/:id` | `components/layout/app-shell.tsx`, `pos/pos-workspace.tsx`, `customers/customer-workspace.tsx` |
| GET | `/customers/:id` | `components/layout/app-shell.tsx`, `pos/pos-workspace.tsx`, `customers/customer-workspace.tsx` |
| PATCH | `/customers/:id` | `components/layout/app-shell.tsx`, `pos/pos-workspace.tsx`, `customers/customer-workspace.tsx` |
| POST | `/customers/bulk-sale-payment` | `customers/customer-workspace.tsx` |
| POST | `/customers/pharmacy-payment` | `customers/customer-workspace.tsx` |
| GET | `/finance/accounts` | `pos/pos-workspace.tsx`, `sales/sales-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx`, `customers/customer-workspace.tsx`, `finance/finance-workspace.tsx`, `finance/consultation-workspace.tsx`, `purchases/purchase-workspace.tsx` |
| POST | `/finance/accounts` | `pos/pos-workspace.tsx`, `sales/sales-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx`, `customers/customer-workspace.tsx`, `finance/finance-workspace.tsx`, `finance/consultation-workspace.tsx`, `purchases/purchase-workspace.tsx` |
| DELETE | `/finance/accounts/:id` | `pos/pos-workspace.tsx`, `sales/sales-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx`, `customers/customer-workspace.tsx`, `finance/finance-workspace.tsx`, `finance/consultation-workspace.tsx`, `purchases/purchase-workspace.tsx` |
| GET | `/finance/accounts/:id` | `pos/pos-workspace.tsx`, `sales/sales-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx`, `customers/customer-workspace.tsx`, `finance/finance-workspace.tsx`, `finance/consultation-workspace.tsx`, `purchases/purchase-workspace.tsx` |
| PATCH | `/finance/accounts/:id` | `pos/pos-workspace.tsx`, `sales/sales-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx`, `customers/customer-workspace.tsx`, `finance/finance-workspace.tsx`, `finance/consultation-workspace.tsx`, `purchases/purchase-workspace.tsx` |
| GET | `/finance/consultation-charges/charges` | `finance/consultation-workspace.tsx` |
| POST | `/finance/consultation-charges/pay` | `finance/consultation-workspace.tsx` |
| GET | `/finance/consultation-charges/payments` | `finance/consultation-workspace.tsx` |
| GET | `/finance/consultation-charges/payments/:id` | `finance/consultation-workspace.tsx` |
| GET | `/finance/expenses` | `finance/finance-workspace.tsx` |
| POST | `/finance/expenses` | `finance/finance-workspace.tsx` |
| DELETE | `/finance/expenses/:id` | `finance/finance-workspace.tsx` |
| GET | `/finance/expenses/:id` | `finance/finance-workspace.tsx` |
| GET | `/finance/expenses/categories` | `finance/finance-workspace.tsx` |
| POST | `/finance/expenses/categories` | `finance/finance-workspace.tsx` |
| DELETE | `/finance/expenses/categories/:id` | `finance/finance-workspace.tsx` |
| PATCH | `/finance/expenses/categories/:id` | `finance/finance-workspace.tsx` |
| GET | `/finance/incomes` | `finance/finance-workspace.tsx` |
| POST | `/finance/incomes` | `finance/finance-workspace.tsx` |
| DELETE | `/finance/incomes/:id` | `finance/finance-workspace.tsx` |
| GET | `/finance/incomes/:id` | `finance/finance-workspace.tsx` |
| GET | `/finance/incomes/categories` | `finance/finance-workspace.tsx` |
| POST | `/finance/incomes/categories` | `finance/finance-workspace.tsx` |
| DELETE | `/finance/incomes/categories/:id` | `finance/finance-workspace.tsx` |
| PATCH | `/finance/incomes/categories/:id` | `finance/finance-workspace.tsx` |
| GET | `/finance/transactions` | `finance/finance-workspace.tsx` |
| GET | `/finance/transactions/:id` | `finance/finance-workspace.tsx` |
| PATCH | `/finance/transactions/:id` | `finance/finance-workspace.tsx` |
| POST | `/finance/transactions/transfer` | `finance/finance-workspace.tsx` |
| POST | `/finance/transactions/withdraw` | `finance/finance-workspace.tsx` |
| GET | `/hr/annual-calendars` | **Needs review / no literal reference** |
| POST | `/hr/annual-calendars` | **Needs review / no literal reference** |
| DELETE | `/hr/annual-calendars/:id` | **Needs review / no literal reference** |
| GET | `/hr/annual-calendars/:id` | **Needs review / no literal reference** |
| PATCH | `/hr/annual-calendars/:id` | **Needs review / no literal reference** |
| GET | `/hr/assigned-rosters` | `hr/duty-rosters-workspace.tsx` |
| POST | `/hr/assigned-rosters` | `hr/duty-rosters-workspace.tsx` |
| DELETE | `/hr/assigned-rosters/:id` | `hr/duty-rosters-workspace.tsx` |
| GET | `/hr/assigned-rosters/:id` | `hr/duty-rosters-workspace.tsx` |
| PATCH | `/hr/assigned-rosters/:id` | `hr/duty-rosters-workspace.tsx` |
| GET | `/hr/attendance` | `hr/hr-workspace.tsx` |
| POST | `/hr/attendance` | `hr/hr-workspace.tsx` |
| POST | `/hr/attendance-transactions/webhook` | **Needs review / no literal reference** |
| DELETE | `/hr/attendance/:id` | `hr/hr-workspace.tsx` |
| GET | `/hr/attendance/:id` | `hr/hr-workspace.tsx` |
| PATCH | `/hr/attendance/:id` | `hr/hr-workspace.tsx` |
| POST | `/hr/attendance/import/:branchId` | `hr/hr-workspace.tsx` |
| GET | `/hr/departments` | `hr/hr-setup-workspace.tsx`, `admin/admin-workspace.tsx` |
| POST | `/hr/departments` | `hr/hr-setup-workspace.tsx`, `admin/admin-workspace.tsx` |
| DELETE | `/hr/departments/:id` | `hr/hr-setup-workspace.tsx`, `admin/admin-workspace.tsx` |
| PATCH | `/hr/departments/:id` | `hr/hr-setup-workspace.tsx`, `admin/admin-workspace.tsx` |
| GET | `/hr/designations` | **Needs review / no literal reference** |
| POST | `/hr/designations` | **Needs review / no literal reference** |
| DELETE | `/hr/designations/:id` | **Needs review / no literal reference** |
| PATCH | `/hr/designations/:id` | **Needs review / no literal reference** |
| GET | `/hr/employees` | `hr/hr-workspace.tsx`, `hr/duty-rosters-workspace.tsx` |
| POST | `/hr/employees` | `hr/hr-workspace.tsx`, `hr/duty-rosters-workspace.tsx` |
| DELETE | `/hr/employees/:id` | `hr/hr-workspace.tsx`, `hr/duty-rosters-workspace.tsx` |
| GET | `/hr/employees/:id` | `hr/hr-workspace.tsx`, `hr/duty-rosters-workspace.tsx` |
| PATCH | `/hr/employees/:id` | `hr/hr-workspace.tsx`, `hr/duty-rosters-workspace.tsx` |
| GET | `/hr/leave-types` | `hr/hr-workspace.tsx` |
| POST | `/hr/leave-types` | `hr/hr-workspace.tsx` |
| DELETE | `/hr/leave-types/:id` | `hr/hr-workspace.tsx` |
| GET | `/hr/leave-types/:id` | `hr/hr-workspace.tsx` |
| PATCH | `/hr/leave-types/:id` | `hr/hr-workspace.tsx` |
| GET | `/hr/leaves` | `hr/hr-workspace.tsx` |
| POST | `/hr/leaves` | `hr/hr-workspace.tsx` |
| DELETE | `/hr/leaves/:id` | `hr/hr-workspace.tsx` |
| GET | `/hr/leaves/:id` | `hr/hr-workspace.tsx` |
| PATCH | `/hr/leaves/:id/approve` | `hr/hr-workspace.tsx` |
| GET | `/hr/rosters` | `components/layout/app-shell.tsx`, `hr/duty-rosters-workspace.tsx` |
| POST | `/hr/rosters` | `components/layout/app-shell.tsx`, `hr/duty-rosters-workspace.tsx` |
| DELETE | `/hr/rosters/:id` | `components/layout/app-shell.tsx`, `hr/duty-rosters-workspace.tsx` |
| GET | `/hr/rosters/:id` | `components/layout/app-shell.tsx`, `hr/duty-rosters-workspace.tsx` |
| PATCH | `/hr/rosters/:id` | `components/layout/app-shell.tsx`, `hr/duty-rosters-workspace.tsx` |
| GET | `/hr/shifts` | `hr/duty-rosters-workspace.tsx` |
| POST | `/hr/shifts` | `hr/duty-rosters-workspace.tsx` |
| DELETE | `/hr/shifts/:id` | `hr/duty-rosters-workspace.tsx` |
| GET | `/hr/shifts/:id` | `hr/duty-rosters-workspace.tsx` |
| PATCH | `/hr/shifts/:id` | `hr/duty-rosters-workspace.tsx` |
| POST | `/hr/time-cards/webhook` | **Needs review / no literal reference** |
| GET | `/media` | `admin/admin-workspace.tsx` |
| DELETE | `/media/:id` | `admin/admin-workspace.tsx` |
| GET | `/media/:id` | `admin/admin-workspace.tsx` |
| PATCH | `/media/:id` | `admin/admin-workspace.tsx` |
| POST | `/media/upload` | `admin/admin-workspace.tsx` |
| POST | `/media/upload-multiple` | `admin/admin-workspace.tsx` |
| GET | `/permissions` | `access/access-workspace.tsx` |
| GET | `/pharmacy/cash-register` | `pos/pos-workspace.tsx`, `purchases/purchase-workspace.tsx` |
| GET | `/pharmacy/cash-register/:id` | `pos/pos-workspace.tsx`, `purchases/purchase-workspace.tsx` |
| POST | `/pharmacy/cash-register/:id/close` | `pos/pos-workspace.tsx`, `purchases/purchase-workspace.tsx` |
| GET | `/pharmacy/cash-register/active` | `pos/pos-workspace.tsx`, `purchases/purchase-workspace.tsx` |
| POST | `/pharmacy/cash-register/open` | `pos/pos-workspace.tsx`, `purchases/purchase-workspace.tsx` |
| GET | `/pharmacy/categories` | `pos/pos-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx` |
| POST | `/pharmacy/categories` | `pos/pos-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx` |
| DELETE | `/pharmacy/categories/:id` | `pos/pos-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx` |
| PATCH | `/pharmacy/categories/:id` | `pos/pos-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx` |
| GET | `/pharmacy/generics` | `pos/pos-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx` |
| POST | `/pharmacy/generics` | `pos/pos-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx` |
| DELETE | `/pharmacy/generics/:id` | `pos/pos-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx` |
| PATCH | `/pharmacy/generics/:id` | `pos/pos-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx` |
| GET | `/pharmacy/groups` | `pos/pos-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx` |
| POST | `/pharmacy/groups` | `pos/pos-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx` |
| DELETE | `/pharmacy/groups/:id` | `pos/pos-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx` |
| PATCH | `/pharmacy/groups/:id` | `pos/pos-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx` |
| GET | `/pharmacy/manufacturers` | `pos/pos-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx` |
| POST | `/pharmacy/manufacturers` | `pos/pos-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx` |
| DELETE | `/pharmacy/manufacturers/:id` | `pos/pos-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx` |
| PATCH | `/pharmacy/manufacturers/:id` | `pos/pos-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx` |
| GET | `/pharmacy/medicines` | `pos/pos-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx`, `purchases/purchase-workspace.tsx` |
| POST | `/pharmacy/medicines` | `pos/pos-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx`, `purchases/purchase-workspace.tsx` |
| DELETE | `/pharmacy/medicines/:id` | `pos/pos-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx`, `purchases/purchase-workspace.tsx` |
| GET | `/pharmacy/medicines/:id` | `pos/pos-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx`, `purchases/purchase-workspace.tsx` |
| PATCH | `/pharmacy/medicines/:id` | `pos/pos-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx`, `purchases/purchase-workspace.tsx` |
| POST | `/pharmacy/medicines/import` | `catalog/catalog-inventory-workspace.tsx` |
| GET | `/pharmacy/purchases` | `purchases/purchase-workspace.tsx` |
| POST | `/pharmacy/purchases` | `purchases/purchase-workspace.tsx` |
| GET | `/pharmacy/purchases/:id` | `purchases/purchase-workspace.tsx` |
| POST | `/pharmacy/purchases/:id/payments` | `purchases/purchase-workspace.tsx` |
| PATCH | `/pharmacy/purchases/:id/status` | `purchases/purchase-workspace.tsx` |
| GET | `/pharmacy/stocks` | `catalog/catalog-inventory-workspace.tsx` |
| POST | `/pharmacy/stocks/adjust` | `catalog/catalog-inventory-workspace.tsx` |
| PATCH | `/pharmacy/stocks/bulk-price-update` | `catalog/catalog-inventory-workspace.tsx` |
| POST | `/pharmacy/stocks/opening` | `catalog/catalog-inventory-workspace.tsx` |
| POST | `/pharmacy/stocks/transfer` | `catalog/catalog-inventory-workspace.tsx` |
| GET | `/pharmacy/suppliers` | `suppliers/supplier-workspace.tsx`, `purchases/purchase-workspace.tsx` |
| POST | `/pharmacy/suppliers` | `suppliers/supplier-workspace.tsx`, `purchases/purchase-workspace.tsx` |
| DELETE | `/pharmacy/suppliers/:id` | `suppliers/supplier-workspace.tsx`, `purchases/purchase-workspace.tsx` |
| GET | `/pharmacy/suppliers/:id` | `suppliers/supplier-workspace.tsx`, `purchases/purchase-workspace.tsx` |
| PUT | `/pharmacy/suppliers/:id` | `suppliers/supplier-workspace.tsx`, `purchases/purchase-workspace.tsx` |
| GET | `/pharmacy/units` | `pos/pos-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx` |
| POST | `/pharmacy/units` | `pos/pos-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx` |
| DELETE | `/pharmacy/units/:id` | `pos/pos-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx` |
| PATCH | `/pharmacy/units/:id` | `pos/pos-workspace.tsx`, `catalog/catalog-inventory-workspace.tsx` |
| GET | `/reports/doctor-summary` | `reports/report-service.ts` |
| GET | `/reports/finance/expense` | `reports/report-service.ts` |
| GET | `/reports/finance/hospital-collection` | `reports/report-service.ts` |
| GET | `/reports/finance/income` | `reports/report-service.ts` |
| GET | `/reports/finance/pharmacy-collection` | `reports/report-service.ts` |
| GET | `/reports/overall-summary` | `reports/report-service.ts` |
| GET | `/reports/pharmacy/due-collection` | `reports/report-service.ts` |
| GET | `/reports/pharmacy/graph` | `reports/report-service.ts` |
| GET | `/reports/pharmacy/purchase-report` | `reports/report-service.ts` |
| GET | `/reports/pharmacy/sales-report` | `reports/report-service.ts` |
| GET | `/reports/pharmacy/stats` | `reports/report-service.ts` |
| GET | `/reports/pharmacy/summary` | `reports/report-service.ts` |
| GET | `/roles` | `access/access-workspace.tsx` |
| POST | `/roles` | `access/access-workspace.tsx` |
| DELETE | `/roles/:id` | `access/access-workspace.tsx` |
| GET | `/roles/:id` | `access/access-workspace.tsx` |
| PUT | `/roles/:id` | `access/access-workspace.tsx` |
| GET | `/roles/permissions` | `access/access-workspace.tsx` |
| GET | `/sales` | `components/layout/app-shell.tsx`, `pos/pos-workspace.tsx`, `sales/sales-workspace.tsx`, `customers/customer-workspace.tsx`, `reports/report-service.ts` |
| POST | `/sales` | `components/layout/app-shell.tsx`, `pos/pos-workspace.tsx`, `sales/sales-workspace.tsx`, `customers/customer-workspace.tsx`, `reports/report-service.ts` |
| GET | `/sales/:id` | `components/layout/app-shell.tsx`, `pos/pos-workspace.tsx`, `sales/sales-workspace.tsx`, `customers/customer-workspace.tsx`, `reports/report-service.ts` |
| PATCH | `/sales/:id` | `components/layout/app-shell.tsx`, `pos/pos-workspace.tsx`, `sales/sales-workspace.tsx`, `customers/customer-workspace.tsx`, `reports/report-service.ts` |
| POST | `/sales/:id/payments` | `components/layout/app-shell.tsx`, `pos/pos-workspace.tsx`, `sales/sales-workspace.tsx`, `customers/customer-workspace.tsx`, `reports/report-service.ts` |
| GET | `/sales/due-bills/:patientId` | **Needs review / no literal reference** |
| GET | `/sales/returns` | `sales/sales-workspace.tsx` |
| POST | `/sales/returns` | `sales/sales-workspace.tsx` |
| GET | `/sales/returns/:id` | `sales/sales-workspace.tsx` |
| PATCH | `/sales/returns/:id/status` | `sales/sales-workspace.tsx` |
| GET | `/settings` | `pos/pos-workspace.tsx`, `admin/admin-workspace.tsx` |
| GET | `/settings/:name` | `pos/pos-workspace.tsx`, `admin/admin-workspace.tsx` |
| PATCH | `/settings/:name` | `pos/pos-workspace.tsx`, `admin/admin-workspace.tsx` |
| GET | `/settings/audit-logs/all` | `admin/admin-workspace.tsx` |
| POST | `/setup` | `app/setup/page.tsx`, `app/login/page.tsx`, `components/layout/app-shell.tsx` |
| GET | `/setup/status` | `app/setup/page.tsx`, `app/login/page.tsx` |
| GET | `/users` | `access/access-workspace.tsx` |
| POST | `/users` | `access/access-workspace.tsx` |
| DELETE | `/users/:id` | `access/access-workspace.tsx` |
| GET | `/users/:id` | `access/access-workspace.tsx` |
| PATCH | `/users/:id` | `access/access-workspace.tsx` |
