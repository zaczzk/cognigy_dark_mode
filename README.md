# Cognigy Dark Mode (Cognigy Graphite)

A Chrome extension that gives the Cognigy.AI web app a dark "graphite" theme. It changes **colours only**. Layout, typography, images, node shapes and shadow geometry stay exactly as Cognigy draws them.

> Unofficial community project. Not affiliated with, endorsed by, or supported by NiCE Cognigy.

**Status: pre-1.0 (`0.14.x`).** Covered:
- Most of the authoring app: flows and inspector, AI Agents, resource lists, project settings, Knowledge, Simulator, Trainer and more.
- Admin Center, Insights and the project index.

Any screen the extension does not recognise keeps its native light appearance. Known gaps are tracked in [Issues](https://github.com/zaczzk/cognigy_dark_mode/issues).

## Install (unpacked)

1. Clone this repo (or download a zip from [Releases](https://github.com/zaczzk/cognigy_dark_mode/releases) once one is published).
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select the `extension/` folder.
3. Open your Cognigy app and click the toolbar icon. Choose **System**, **Dark** or **Original**.

Chrome 120 or later is required.

`https://trial.cognigy.ai` works out of the box. For any other Cognigy host, open the popup on that site and click **Enable on this site**, or use **Saved sites → Add site**. Chrome asks for permission for that one hostname.

## How it works (one paragraph)

The extension never restyles a page blindly. On an approved Cognigy route:
1. Per-component **adapters** (`extension/adapters.js`) positively identify each known surface by its DOM structure.
2. The adapter checks that the element's native colours are the ones it expects.
3. Only then does it tag the element with `data-cg-*` marker attributes.
4. `application.css` paints only elements that carry those markers, using the tokens in `palette.css`.

Anything unrecognised fails closed and keeps its native colours. Choosing **Original** removes every marker. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Privacy

- **Permissions:** `storage`, `activeTab` and `scripting`, plus host access to `trial.cognigy.ai`. Other hosts are optional and granted one at a time.
- **No network requests, remote code, analytics, polling or browsing history.**
- **Stored locally:** only enrolled hostnames, an optional path prefix and your appearance choice. Page content, field values and record IDs are never read into storage.

## Repo layout

| Path | What |
|---|---|
| `extension/` | The extension source. This folder is what you load and ship. |
| `tests/` | Node unit tests (`*.test.cjs`) and browser contract harnesses (`tests/browser/`). |
| `scripts/` | Packaging, dev-install staging and capture helpers. |
| `docs/` | Architecture notes. |
| `AGENTS.md` | Ground rules for AI coding agents working in this repo. |

## Contributing

Unit tests run in CI. Browser contracts need DOM captures from your own Cognigy account, so they run locally only. Run the unit tests with:

```bash
node --test "tests/*.test.cjs"   # Node 22+
```

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR. The short version:
- Colours only.
- Never filter images.
- Adapters must fail closed.
- No new permissions or network access.

## License

[MIT](LICENSE). "Cognigy" is a trademark of its owner and is used here only to describe compatibility.
