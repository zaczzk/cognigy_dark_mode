# AGENTS.md

These are instructions for AI coding agents working in this repo. Humans: [CONTRIBUTING.md](CONTRIBUTING.md) covers the same rules plus setup.

## What this is

This is a Chrome Manifest V3 extension that recolours the Cognigy.AI web app dark. It is plain JavaScript and CSS, with no build step, no dependencies and no framework. The shipped code is `extension/`. The runtime flow and file roles are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Commands

| Task | Command |
|---|---|
| Unit tests (must pass; Node 22+) | `node --test "tests/*.test.cjs"` |
| Build browser contract pages | `node tests/browser/build.cjs` |
| Run browser contracts headless (needs Chrome) | `node tests/browser/run-headless.cjs` |

## Invariants

- **Colour-only.** Never change geometry, typography, opacity, shadow geometry or motion timing. Never apply filters or blend modes to media or its ancestors.
- **Paint only through markers.** `application.css` selects `data-cg-*` markers, never raw Cognigy classes alone.
- **Identify by structure.** Find elements by IDs, `data-test`, roles and ancestry. Computed colour serves only two purposes:
  - a guard, confirming that the native paint is the expected light value;
  - choosing the text role of an element that is already identified (`text()`).
- **Fail closed per family.** If anything is unexpected, call `rejected.add(family)`, and that family stays native. Never "fix" a refusal by loosening a selector until it matches everything.
- **Reads before writes.** All plans are collected first. A single commit loop at the end of `qualify()` calls `own(...)` after the contrast checks.
- **No new observers, timers, polling or network calls.** The existing exceptions are the single MutationObserver and the settled-retry timer in `content.js`.
- **Exact restoration** on Original, pause, route exit and teardown.
- **Privacy.** Required permissions stay `storage`, `activeTab` and `scripting`. Never read input values or page text into storage or messages. `tests/extension.test.cjs` asserts the permissions. If a change needs that test edited, stop and ask the human.

## How a surface gets painted

There are two kinds of "family". Do not confuse them:
- **Route names** come from `core.js` `routeFamily()`, for example `flow-chart` and `admin`. They are used for status and diagnostics only.
- **Component families** are where the work happens. They are listed in `content.js` `families`: shell, banner, dashboard, settings, list, agents, menu, chart, inspector, chat, global, admin, insights, project-index, utility.

In `adapters.js` `qualify()`, each block looks like this:

```js
if(enabled('global')) {
  family='global';
  const dialog=unique(doc,'…stable hooks…');                  // positive identification
  if(dialog && /* exact expected structure */) {
    boundaries.push([panel,family]);                          // region this family owns
    plan(dialog.closest('.MuiDialog-root'),'data-cg-owner',family); // route mutations of a portal
    if(!surface(panel,'overlay'))rejected.add(family);        // slot + guard native light paint
    controls(panel); text(el); slot(el,'primary');            // inputs, text roles, plain slots
  }
}
```

The canonical small example is the native confirmation dialog: search for `Native confirmation portal` in `adapters.js`. Helpers are defined near the top of `qualify()`:
- `plan(el, name, value)`
- `slot(el, value)`
- `surface(el, kind, allowedNative)`
- `text(el, role)`
- `controls(root)`
- `unique(root, selector)`

Never call `own` from an adapter.

### Touch points for a new screen, dialog or menu

1. **`adapters.js`.** Add the block in the right component family. A new route must also match the `route` regex inside `qualify()`. Search for `const route=/^\/project`.
2. **`content.js`.** The `owners` list maps DOM mutations to families. A new portal needs to match an `owners` selector, or be tagged `plan(el,'data-cg-owner',family)`. Otherwise it repaints only by accident.
3. **`application.css`.** Each slot needs a rule.
   - `data-cg-slot` is a space-separated token list, so match it with `~=`.
   - `data-cg-text` is a single role, so match it with `=`. The roles are text, secondary, muted, error, icon, accent, on-button, native-dark and native-success.
   - Rule shape: `:root[data-cg-palette="graphite-v3"] [data-cg-slot~="x"]{background-color:var(--cg-panel)!important}`
4. **`palette.css`.** Use existing `--cg-*` tokens. Add a token only if none fits.
5. Verify against a local capture (see CONTRIBUTING), or ask the human to check the live app in both Dark and Original.

### Other markers

| Marker | Purpose |
|---|---|
| `data-cg-owner` | Routes mutations for portals |
| `data-cg-native` | Opt-out: an element and its subtree are never painted (it is in `PROTECTED`) |
| `data-cg-palette` | Set on the root |
| `data-cg-startup`, `data-cg-native-read`, `data-cg-placeholder-guard` | Startup and transition plumbing in `content.js` |
| `data-cg-build` | Build identity; tested |

### Debugging

The popup shows only a status label. "Partly supported" appears on every project or workspace route, so on its own it does **not** mean a family was refused. To see real refusals, open DevTools on the popup (right-click the popup → Inspect) and run `chrome.tabs.sendMessage(<tabId>,{type:'GET_STATUS',requestId:1})`. The response includes `refusedFamilies`, `activeFamilies` and `reasonCodes`. Remove all diagnostics before finishing.

## Never commit

- Captures of real accounts (`*-fixture.html`, `*-fixture-source.json`), screenshots, `evidence/`, `releases/`, `baselines/`, `chrome-development/` and `_bmad*`.
- Generated `tests/browser/*.generated.*` and `composed-*` files.
- The `.gitignore` is a default-deny allowlist. A new file that belongs in the repo needs an explicit `!` rule, and the PR should mention it.

## Do not

- Hand-edit `chrome-development/extension/` or `releases/`. These are frozen, hash-verified copies.
- Reformat `adapters.js`. Its dense style is intentional, and whole-file diffs are unreviewable.
- Bump `manifest.json` `version`. Maintainers do that on release.
- Treat untracked notes in a maintainer checkout as specs. This file and the code win.
