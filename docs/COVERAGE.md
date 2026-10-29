# Coverage

This page lists the screens checked against a local capture of a real Cognigy page. Captures stay private, so this list is how contributors know what has been checked.

Last surveyed on 2026-10-27, against 0.14.100. In that capture survey, each listed screen was put in Dark and sampled for remaining light surface; results were between 0% and 4%, with no refused component family. This is a historical capture result, not evidence for source changes committed on 2026-10-28 or a live startup/transition acceptance. See the [current source checkpoint](STATUS-2026-10-29.md).

## Authoring

`ai-agent-jobs`, `connection-editor`, `connections`, `contacts`, `endpoint`, `extensions`, `flow-attached-flows`, `flow-attached-lexicons`, `flow-chart`, `flow-default-context`, `flow-nlu`, `flow-settings`, `flow-slots`, `flows`, `functions`, `global-search`, `global-tasks`, `goals`, `handover-providers`, `knowledge`, `knowledge-drawer`, `knowledge-sources`, `knowledge-type`, `lexicons`, `locales`, `logs`, `members`, `nlu-connectors`, `packaging`, `project-dashboard`, `project-dashboard-menu`, `project-switcher`, `scenario-modal`, `scenarios`, `simulations`, `simulator`, `tokens`, `trainer`, `trainer-menu`, `trainer-preset`

## Admin Center

`audit`, `audit-detail`, `connection-editor`, `connection-menu`, `connections`, `dashboard`, `llm-detail`, `llms`, `new-user`, `ops`, `ops-license`, `user-detail`, `users`

## Insights

`analysis`, `business`, `calendar`, `configuration`, `conversations`, `endpoint-filter`, `engagement`, `goals`, `live-agent`, `nlu`, `overview`, `period`, `report-menu`

## Project index

`index`, `menu`

## Live follow-up and known gaps

- **Dashboard startup repair verified, 2026-10-29:** a native reload filmstrip on `7185752a` revealed a 3.8-second white main-area interval. Pending-picker, empty-analytics and zero-dot chart phases were repaired in `e0ca18ad`. Its exported reload trace has 312 visually reviewed frames across eight sheets, all application surfaces dark through startup/loading and settlement; automated light-area checks flagged zero frames. Original restoration passed. This verifies the recorded dashboard journey; other routes and general hosted performance remain outside this result. See the [source checkpoint](STATUS-2026-10-29.md).
- **Resource-link focus repair verified live, 2026-10-29:** Tab focus on a Get Started link made old `e0ca18ad` reject the dashboard and turn white. Fixed `8b274cb5` retained dark canvas/card ownership through focus, focus movement, DevTools cleanup and popup use. Original restored native paint and removed markers; System was restored and focus checked again. This supplies a reliable reproduction and repair for the cleanup-time symptom. See the [source checkpoint](STATUS-2026-10-29.md).
- **Intent Trainer filter-preset menu repair verified live on 2026-10-29:** candidate `7185752a` retained dark styling through trigger hover, opening, keyboard focus and Escape. Original restored native colours and cleared paint markers; the prior System preference was restored. This closes the recorded settled-menu mismatch. See the [current source checkpoint](STATUS-2026-10-29.md) for evidence and remaining startup/performance limits.
- Screens missing from this list have not been captured. They may stay partly or fully light. A capture of a missing screen is a useful first contribution; [CONTRIBUTING.md](../CONTRIBUTING.md#screen-captures-adapter-work) explains how to make one.
- The popup shows **Partly supported** on every project or workspace route. On its own, that label does not mean anything on the page is light.
