# Workspace access behavior

The shell uses one permission map for sidebar links and direct workspace access. A disallowed route shows an access message and links to available workspaces; the feature component is not mounted. Dashboard remains available to authenticated users, and its report requests still depend on report-read access.

This reuses the existing module permission sets; it does not add roles or grant new permissions. Different nested routes have independent requirements. An unknown route does not inherit access from a parent prefix. The backend must continue enforcing endpoint, branch, account and mutation authorization.

Catalog settings filters its tabs by their read permissions and opens the first accessible tab. Write actions check the relevant create/update/delete permission again before sending. In-flight setting writes block repeated requests and tab changes; tab changes discard old row data, and outdated list responses cannot replace a newer request. A form cannot silently move to another entity when its permission context changes.

Other multi-tab workspaces still require their own endpoint/action controls; passing a module-level route check is not proof that every tab is accessible. Follow [live acceptance](live-pos-acceptance.md) with real restricted accounts.

`tests/workspace-policy.test.mjs` covers route isolation, nested scopes and wildcard access. `tests/workspace-access.browser.cjs` covers denied direct URLs, no mounted feature API calls, units-only/read-only setup, recovery links and mobile. These use mocked permissions and do not verify live backend authorization.
