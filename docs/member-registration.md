# Invited account creation — staged

When MEMBER_REGISTRATION_PREVIEW_ENABLED=true, an anonymous recipient opening a
member-invitation fragment link sees Create account with invitation. The existing
account sign-in flow is retained. Code delivery and completion are separate from
authentication, with no legacy API fallback or public signup route.

Flow: invited email → emailed code → verified shop/role/branch review → name,
username and passphrase → explicit invitation consent → account-created receipt →
normal sign-in. Password confirmation is local; the server receives only one
password. Passwords, codes and private tokens are never stored in local/session
storage or query strings. Unknown outcomes freeze the exact request and prevent
switching forms until retry resolves it. Resending starts a new challenge after
the cooldown. Existing accounts cannot be overwritten through this flow.

The BFF only permits start/review/complete as same-origin bounded JSON POSTs, under
the separate registration gate. It requires no auth cookie for these three routes
and forwards no Authorization, tenant or caller identity headers. Existing preview
and accept routes still require authentication. Strict response validation hides
forged/mismatched invitation scope. Username labels include accessible help text.

The login provider remounts all session contents on successful sign-in. To continue
this specific invitation safely, inline sign-in reloads the same fragment link;
the recipient page immediately removes it again. The fragment never reaches the
server. No token is persisted to bypass the session boundary.

The concrete backend email adapter supports Resend, but requires actual provider
credentials and a verified sender. Registration remains closed without a reviewed
sender and its separate EXECUTE-only database connection. No real email or live
database was used for testing. See backend `doc/saas/member-registration.md` for
the additive migration, fresh staging rollout order, credential boundaries and
composition. Main/live routing is unchanged by these staged commits.

Verification uses member-registration.test.mjs and member-registration.browser.cjs,
the existing invitation/Team regressions, scoped ESLint/TypeScript and production
build. Browser checks cover anonymous real-BFF onboarding, code/request retries,
invalid codes, forged scope, mismatch validation, immutable completion retry,
roleless login with HttpOnly cookies, origin/role override rejection and mobile
dark layout. This is fixture validation; live email deliverability/UAT remains.
