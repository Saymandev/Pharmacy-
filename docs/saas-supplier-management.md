# Tenant supplier frontend

Shop suppliers opens from the gated tenant catalog workspace for supplier:read.
It uses server search and pagination over shop-wide suppliers (the backend searches
name, Bangla name, address, phone and email). Branch identity is never inferred for
supplier records. Lists and mutation responses validate the selected shop before
rendering or confirming success.

The existing write gate and supplier:create/update/delete independently expose
actions. Forms support required name/address/phone and optional Bangla name/email.
Delete requires an explicit confirmation; backend linked-purchase constraints and
validation errors remain visible. The BFF allows only supplier collection/detail
paths, strict scalar bodies, JSON, same-origin authenticated sessions, URL-bound
tenant identity and valid save keys.

Create uses the existing backend tenant operation contract. Unknown responses lock
the form and retry the same body/key; duplicate submits cannot issue another create.
Update/delete retain existing backend behavior without version/replay support, so
an uncertain result requires list reload and inspection. Session disposal suppresses
late results. Browser reload does not yet persist pending operation keys.

Validation: four supplier/master unit tests, changed-module lint and production
build passed. The real Next BFF browser fixture covers create with committed-but-lost
response/replay, edit, linked-delete conflict, deletion and mobile overflow, alongside
existing master/import/tenant switch/revocation checks. The mobile screenshot was
visually inspected. Backend supplier code was inspected; no backend mutation or
live database was used. No live flags or main branches changed.

Remaining: Purchase entry/payment/return/refund frontend adapters, dedicated
supplier-only navigation, durable retry recovery and deployed two-shop UAT.
