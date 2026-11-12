# Pending shop onboarding

In the staged /platform panel, operators with explicit `platform:shops:create`
and shop directory access can Add shop when platform writes are enabled. The
responsive modal collects shop/slug, owner contact, intended first branch and a
reason. It explains and confirms that this is pending setup, not an active shop.

The BFF only accepts a strict same-origin JSON command with an idempotency key.
An unknown result freezes payload/key, fields, cancel/Escape and parent controls
until the same command is retried. A known duplicate-slug conflict permits editing
and a new save key. Responses must prove matching shop/contact data and a pending,
not-ready state. Successful saves reload the current shop, select its slug/status
filter and show authorized pending setup details plus ONBOARD activity.

Owner contact reads are independently checked against the selected shop. Malformed
foreign responses are not rendered. Directory-only users cannot see intake contact
details or Add shop. No passwords are collected or external invitations sent.

Run `node --test tests/platform-admin.test.mjs tests/shop-onboarding.test.mjs`
and `node tests/run-shop-onboarding-browser.cjs`. The actual Next BFF/Edge fixture
covers conflict recovery, response-loss retry once, disabled exits, pending status,
contact scoping, read-only access and mobile/light/dark layout. Existing platform
security controls remain covered by `node tests/platform-admin.browser.cjs`.

Remaining fulfilment: owner invitation/verification, branch/default creation,
subscription assignment and reviewed activation. Theme/template tasks remain in
the requested backlog. Nothing is migrated, mounted or enabled in live deployment.

Verified: eight frontend unit checks, actual onboarding and existing platform
browser flows, changed-file ESLint and production build pass. The backend passes
217 composed native checks plus two foundation checks. Desktop/mobile screenshots
were inspected; repository-wide pre-existing lint errors remain outside this scope.
