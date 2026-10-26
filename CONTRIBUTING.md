# Contributing

Thanks for helping. This project is small, but it is careful on purpose: it runs inside other people's production tooling. Please read the rules below before you write code.

## The rules

1. **Colours only.** Do not change position, size, spacing, typography, border width, radius, opacity, shadow geometry or animation timing.
2. **Never alter media.** No `filter`, `invert`, `mix-blend-mode` or opacity on images, SVG artwork, video, canvas or their ancestors. Recolour only monochrome UI icons that an adapter has positively identified.
3. **Fail closed.** If an adapter cannot prove an element is the surface it expects, leave that element native. A light island is a bug report. Unreadable text is a regression.
4. **Privacy.** Do not add permissions, network requests, remote code, analytics, polling or `<all_urls>` behaviour. Never read field values, project text or record IDs into storage or messages.
5. **Restore exactly.** Choosing Original, pausing or navigating away must remove every `data-cg-*` marker and inline style the extension added.

[AGENTS.md](AGENTS.md) explains how adapters are written and which files a new screen touches. It is worth reading even if you're not an AI.

## Setup

- You need Chrome 120 or later, Node 22 or later, and Python 3.10 or later (for fixture conversion and packaging).
- There is no `npm install` and no bundler.
- Load `extension/` unpacked from `chrome://extensions`. After editing a file, click the extension's reload button and then reload the Cognigy tab.

## Tests

```bash
node --test "tests/*.test.cjs"
```

These unit tests cover the settings contract, routing, the popup, site management and worker reconciliation. CI runs them on every push and PR.

### Browser contracts (adapter work)

The contracts run the real controller and adapters against Cognigy DOM. Captures come from real accounts, so **each contributor makes their own and never commits them**.

1. Open the target screen in Cognigy and set the extension to **Original**.
2. Paste the contents of `scripts/capture-native-dom.js` into the DevTools console as `copy(JSON.stringify((<pasted>)()))`. This copies the capture to your clipboard.
3. Save the clipboard to the repo root as `<area>-<screen>-fixture-source.json`. `<area>` must be `admin`, `insights`, `projects` or `authoring`.
4. Convert the capture:

   ```bash
   python build-fixture.py <area>-<screen>-fixture-source.json <area>-<screen>-fixture.html
   ```

5. Run `node tests/browser/build.cjs`.
6. Serve the repo root, for example with `python -m http.server`, and open `/tests/browser/composed-<area>-<screen>.html`.
7. Click **Dark**, then **Check composition**.

The capture script strips scripts, input values, iframes, video and editor text, and removes record IDs from the URL path. It does **not** strip visible names, emails, IDs inside the markup, or project content. Treat every capture as private.

## Making a change

1. Branch from `main`. Keep each PR to one surface or one fix.
2. Add or extend a unit test when you change `core.js`, `sites.js`, `worker.js`, `popup.js` or `site-ui.js`.
3. For adapter changes, say in the PR which screen and states you checked, in both Dark and Original.
4. Leave `manifest.json` `version` alone. Maintainers bump it on release.
5. The `.gitignore` is an allowlist, so a new file is ignored until you add an explicit `!` rule for it.

### PR checklist

- [ ] `node --test "tests/*.test.cjs"` passes
- [ ] No new permissions, network calls, observers or timers
- [ ] Original mode restores the page exactly
- [ ] Images, avatars and editor content are untouched
- [ ] No captures, screenshots or diagnostics committed

## Releasing (maintainers)

```bash
python scripts/package-extension.py --label <short-label>
python scripts/stage-chrome-development.py --release <short-label>
```

Bump the version first. Then freeze `releases/<label>/` (zip plus hash receipt), stage it to the stable dev install, verify it in the live app, and attach the zip to a GitHub release. Keep at most two local release checkpoints.
