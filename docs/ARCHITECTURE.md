# Architecture

This is a Manifest V3 extension with no build step and no dependencies. Every file in `extension/` ships exactly as written, except `build.js`, which the packager rewrites.

## Runtime flow

```
manifest.json
 ├─ content_scripts (trial.cognigy.ai, document_start): sites.js + bootstrap.js   ← tiny route gate
 └─ background: worker.js                                                          ← sole writer of site registry

worker.js ── registers per-site scripts with chrome.scripting ──▶ on approved app routes:
   startup-{dark|system}.js + startup.css   paint only the empty app canvas before first render
   sites.js, bootstrap.js, build.js, core.js, adapters.js, content.js
   palette.css, application.css

bootstrap.js ── validates registry entry + route ──▶ CogGraphiteStart() in content.js
content.js   ── one MutationObserver → owners map mutations to component families
             ── CogGraphiteAdapters.qualify(doc, loc, own, onlyFamilies)
adapters.js  ── reads DOM + computed colours, collects plans, rejects failing families,
                then one commit loop calls own(el, name, value, family)
application.css ── paints [data-cg-*] markers with palette.css tokens (--cg-*)
```

## Files

| File | Role |
|---|---|
| `core.js` | Pure helpers: mode parsing (`native` / `dark` / `system`), the preference key `cogDepth.v1.<site>`, and `routeFamily()`, which gives a route name for status. Unit-tested. |
| `sites.js` | Pure enrolment contract: validates hostnames and path prefixes, excludes the public cognigy.com, and maps a URL to its logical app path. |
| `worker.js` | Service worker. Owns the site registry (`cogDepth.sites.v1` in `chrome.storage.local`) and reconciles registered content scripts with the granted permissions. Handles `SITES_LIST`, `SITE_ENABLE`, `SITE_PAUSE`, `SITE_REMOVE` and `SYNC_STARTUP` from the popup, and `CG_ACTIVATE` / `CG_VERIFIED` from pages. |
| `bootstrap.js` | Per-page gate. Does nothing outside admitted routes (`/projects`, `/project`, `/admincenter`, `/insights`). Starts or stops the controller on navigation and when the registry changes. Answers `CG_ENSURE`. |
| `content.js` | Controller. Contains `own(el, name, value, family='palette', transition)`, which is the only marker writer. Also holds the mutation-to-family routing (`owners`), colour-transition guards so a recheck never flashes light, and exact restoration. Answers `GET_STATUS` with `refusedFamilies`, `activeFamilies` and `reasonCodes`. |
| `adapters.js` | Most of the code: the positive registry of known Cognigy surfaces, grouped by component family. See [AGENTS.md](../AGENTS.md#how-a-surface-gets-painted). |
| `application.css`, `palette.css` | Paint rules keyed only on `data-cg-*` markers, and the colour tokens. |
| `popup.*`, `site-ui.js` | Toolbar popup. Its two views are the current site's appearance and the saved-sites manager. |
| `build.js` | Build identity. In source its candidate is `development`; the packager freezes a real ID. |

## Releases and the dev install (maintainers)

- `python scripts/package-extension.py --label <name>` freezes `extension/` into `releases/<name>/`, writing a zip and a `receipt.json` with SHA-256 hashes. It never overwrites an existing release.
- `python scripts/stage-chrome-development.py --release <name>` copies a frozen release into `chrome-development/extension/`. That is a stable unpacked path, so Chrome keeps the same extension ID and settings across updates.
  - The script refuses to run if that folder was hand-edited. Revert any edits first.
- Both folders are local-only. Keep at most two release checkpoints, and publish zips as GitHub Releases.
