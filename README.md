# Cognigy Graphite

**Dark mode for Cognigy.AI.** Colours change. Your layout, controls and media stay familiar.

[![CI](https://github.com/zaczzk/cognigy_dark_mode/actions/workflows/ci.yml/badge.svg)](https://github.com/zaczzk/cognigy_dark_mode/actions/workflows/ci.yml)
[![Latest Release](https://img.shields.io/github/v/release/zaczzk/cognigy_dark_mode)](https://github.com/zaczzk/cognigy_dark_mode/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Preview · Chrome 120+**

[Install](#install) · [Use it](#use-it) · [Troubleshooting](#troubleshooting) · [Contribute](#contribute)

## Install

### Quick install (recommended)

1. Download the latest `cognigy-graphite-*-release.zip` from [Releases](https://github.com/zaczzk/cognigy_dark_mode/releases/latest).
2. Unzip it into a permanent folder.
3. In Chrome, open `chrome://extensions` and turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the unzipped folder.
5. Pin the Graphite icon to your toolbar.

### From source

1. `git clone https://github.com/zaczzk/cognigy_dark_mode.git`
2. In `chrome://extensions` → **Load unpacked** → select the repository's **`extension/`** folder.

## Use it

The toolbar popup follows your system theme: **Ink** in dark mode, **Paper** in light mode.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/popup-ink.png">
  <img alt="Graphite popup in Paper (light): current site with Dark applied, a new site ready to enable, and the saved sites list" src="docs/images/popup-paper.png">
</picture>

<details><summary>Both themes</summary>

**Ink (dark)**

![Graphite popup in Ink (dark)](docs/images/popup-ink.png)

**Paper (light)**

![Graphite popup in Paper (light)](docs/images/popup-paper.png)

</details>

| Mode | Result |
|---|---|
| **System** | Follows your system's light/dark preference. |
| **Dark** | Keeps Cognigy dark. |
| **Original** | Restores Cognigy's native colours. |

**Higher contrast:** a switch in the popup strengthens text, icons, borders and focus rings, in the popup and on every enabled Cognigy site. Surfaces keep the same graphite palette.

**Trial:** `trial.cognigy.ai` is enabled by default.

**Another Cognigy host:** open the popup → **Enable on this site** → approve access to that hostname.

**Saved sites:** add, pause, enable or remove hosts. An optional path prefix supports apps hosted under a subpath.

## What it covers

- **Authoring:** flows, inspector, AI Agents, Knowledge, settings, Simulator, Trainer and resource lists.
- **Admin Center** and **Insights**.
- **Project index** and dashboard.

Recognised components receive the graphite palette. Unsupported or unexpected components keep their native colours.

**Still a preview.** See [checked screens and known gaps](docs/COVERAGE.md) or the [latest verification record](docs/STATUS-2026-10-29.md).

## Update

- **From zip:** Replace the folder contents with the new release zip.
- **From git:** Run `git pull`.
- Then open `chrome://extensions` → click ⟳ **Reload** on Graphite → reload any open Cognigy tabs.

## Troubleshooting

| You see… | Do this |
|---|---|
| No icon in toolbar | Click the Chrome puzzle piece icon (Extensions) and pin **Cognigy Graphite**. |
| **Reload this page to connect** | Reload the Cognigy tab. |
| A light page in **System** mode | Check your system preference. Choose **Dark** for an always-dark theme. |
| A white component in **Dark** mode | It may be unsupported. [Report the screen and interaction](https://github.com/zaczzk/cognigy_dark_mode/issues). |
| **Partly supported** | Normal status. The route has supported components; only unrecognized elements stay native. |

Include the extension version and steps to reproduce. Keep account details and captures private.

## Privacy

- No network requests, analytics or remote code.
- Saves approved hostnames, optional path prefixes and appearance choices locally.
- Never stores page content, input values or record IDs.
- Required permissions: `storage`, `activeTab`, `scripting`, plus `trial.cognigy.ai`. Other hosts are granted individually.

## Contribute

**Node 22+ and Chrome.** No npm install or bundler.

```bash
node --test "tests/*.test.cjs"
node tests/browser/build.cjs
node tests/browser/run-headless.cjs
```

CI checks PRs and pushes to `main`, validating unit tests, browser contracts, and generating installable extension zip artifacts. Tagged releases automatically generate GitHub Releases with signed hash receipts.

**Rules:** colours only, exact Original restoration, no media filters, no new permissions or network calls. Private captures stay local.

[Contributor guide](CONTRIBUTING.md) · [Architecture](docs/ARCHITECTURE.md) · [Agent instructions](AGENTS.md)

## License & affiliation

[MIT](LICENSE). The popup bundles [Be Vietnam Pro](extension/fonts/OFL.txt) under the SIL Open Font License 1.1. Unofficial community project, unaffiliated with NiCE Cognigy. "Cognigy" is its owner's trademark and describes compatibility.
