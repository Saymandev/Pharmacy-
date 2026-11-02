# Appearance and language

Use the top bar's language dropdown and sun/moon toggle for quick changes. Open **Display preferences** from the top-bar settings icon or sidebar for a preview of Light, Dark and System themes plus English/বাংলা options.

System follows the device's current color scheme, including changes while the application is open. The quick sun/moon button selects an explicit light/dark theme. Preferences are browser-local, survive refresh/navigation and synchronize between tabs. If browser storage is blocked, changes still work in the current session, but cannot be promised after a reload.

Saved values are validated. A pre-hydration script applies the saved appearance and document language early. The modal supports keyboard selection, Escape, focus return and reduced-motion preferences. Bangla uses available Bengali-capable system fonts without requiring an external font download.

Existing translated workflows remain in place. This phase extends Bangla coverage to purchase/report headings, labels, filters/actions and report definitions; it does not translate medicine/customer names, backend-generated error messages or arbitrary report data. Purchase amounts use the selected locale. English keys are a fallback for messages without a Bangla translation.

Recent customer statement surfaces also use the shared dark palette. Printed statements and receipts retain their separate paper styling.

`tests/appearance.browser.cjs` uses mocked API responses to check theme choices, device changes, localization, persistence, multiple tabs, mobile layout and storage failure. Existing business-flow regressions must continue to pass.

Finance, consultation settlements, HR operations/setup/rosters and Admin/Team access now use Bengali controls, messages and enum labels. API option values stay unchanged; dates display in Asia/Dhaka and finance currency follows the selected language. Arbitrary backend data, permission keys and backend error messages retain their original text. See [the audit guide](hr-admin-guide.md).
