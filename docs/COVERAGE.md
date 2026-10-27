# Coverage

This page lists the screens checked against a local capture of a real Cognigy page. Captures stay private, so this list is how contributors know what has been checked.

Last surveyed on 2026-10-27, at 0.14.100. Each capture was put in Dark and sampled for remaining light surface. Every screen below came out between 0% and 4% light, with no refused component family.

## Authoring

`ai-agent-jobs`, `connection-editor`, `connections`, `contacts`, `endpoint`, `extensions`, `flow-attached-flows`, `flow-attached-lexicons`, `flow-chart`, `flow-default-context`, `flow-nlu`, `flow-settings`, `flow-slots`, `flows`, `functions`, `global-search`, `global-tasks`, `goals`, `handover-providers`, `knowledge`, `knowledge-drawer`, `knowledge-sources`, `knowledge-type`, `lexicons`, `locales`, `logs`, `members`, `nlu-connectors`, `packaging`, `project-dashboard`, `project-dashboard-menu`, `project-switcher`, `scenario-modal`, `scenarios`, `simulations`, `simulator`, `tokens`, `trainer`, `trainer-menu`, `trainer-preset`

## Admin Center

`audit`, `audit-detail`, `connection-editor`, `connection-menu`, `connections`, `dashboard`, `llm-detail`, `llms`, `new-user`, `ops`, `ops-license`, `user-detail`, `users`

## Insights

`analysis`, `business`, `calendar`, `configuration`, `conversations`, `endpoint-filter`, `engagement`, `goals`, `live-agent`, `nlu`, `overview`, `period`, `report-menu`

## Project index

`index`, `menu`

## Known gaps

- **Intent Trainer filter-preset menu** stays white in the live app. Its static capture paints correctly, so the cause is something that happens only while the menu opens live (a transient state or mutation timing).
- Screens missing from this list have not been captured. They may stay partly or fully light. A capture of a missing screen is a useful first contribution; [CONTRIBUTING.md](../CONTRIBUTING.md#screen-captures-adapter-work) explains how to make one.
- The popup shows **Partly supported** on every project or workspace route. On its own, that label does not mean anything on the page is light.
