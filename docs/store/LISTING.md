# Chrome Web Store listing

Copy these into the [developer dashboard](https://chrome.google.com/webstore/devconsole). Upload the `cognigy-graphite-<version>-release.zip` from [Releases](https://github.com/zaczzk/cognigy_dark_mode/releases/latest), not `receipt.json`.

## Store listing tab

**Name** comes from `manifest.json`: `(Unofficial) Cognigy Dark Mode`.

**Summary** (from the manifest, 91 characters):
> Unofficial dark theme for Cognigy.AI. Only colours change; layout and images stay the same.

**Category:** Developer Tools

**Language:** English

**Description:**

> A dark theme for the Cognigy.AI web app. Only colours change: layout, controls and images stay the same.
>
> • Three modes: System (default, follows your computer's light or dark setting), Dark and Original.
> • Higher contrast option for text, icons and borders.
> • Covers flows, AI Agents, Knowledge, Simulator, Trainer, settings, Admin Center, Insights and the project list. Anything not yet themed keeps Cognigy's normal colours.
> • Works on trial.cognigy.ai straight away. Enable other Cognigy sites, such as cognigy-au1.nicecxone.com, from the toolbar popup.
>
> Private by design: no network requests, no analytics, no remote code. Your site list and settings stay on your computer.
>
> Unofficial community project, not affiliated with NiCE Cognigy. "Cognigy" is a trademark of its owner and is used only to describe compatibility.
>
> Source and issues: https://github.com/zaczzk/cognigy_dark_mode

**Graphics:**
- **Store icon:** `extension/icons/icon-128.png`.
- **Screenshots** (1 required, up to 5, 1280×800 PNG or JPEG) and **small promo tile** (440×280, required): run `node scripts/store-assets.cjs`. It renders the popup from the real UI with sample sites, refreshes `docs/images/popup-*.png`, and writes the store graphics to `store-assets/`, which stays out of git.
- **Real screenshot:** add at least one of a Cognigy screen in Dark mode, from an account with no customer data. A listing with only popup images may be rejected for not showing what the extension does.

## Privacy practices tab

**Single purpose:**
> Applies a dark colour theme to the Cognigy.AI web app.

**Permission justifications:**

| Permission | Justification |
|---|---|
| `storage` | Saves the user's enabled sites and appearance choices locally. Nothing is synced or sent anywhere. |
| `activeTab` | When the user opens the popup, reads the current tab's address so the popup can offer to enable the theme on that site. |
| `scripting` | Injects the extension's own bundled CSS and scripts into Cognigy pages the user has enabled, and registers them to run on those sites. |
| Host `https://trial.cognigy.ai/*` | Cognigy's public trial, themed by default. |
| Optional host `https://*/*` | Cognigy runs on many regional and self-hosted company domains, so they can't be listed in advance. Nothing is requested at install. Access to one site is requested only when the user clicks Enable on it, and the theme runs only on sites the user enabled. For NiCE-hosted regional sites (`cognigy-<region>.nicecxone.com`) the request is `https://*.nicecxone.com/*`, so later regions need no new prompt. |

**Remote code:** No. All JavaScript and fonts are bundled in the package.

**Data usage:** tick no data categories. The extension collects none.

**Certifications:** tick all three: data is not sold to third parties, not used for unrelated purposes, and not used for creditworthiness or lending.

**Privacy policy URL:** https://github.com/zaczzk/cognigy_dark_mode/blob/main/PRIVACY.md

## Before you submit (owner only)

1. **Account setup.** Register as a developer and pay the one-time $5 fee. Turn on 2-step verification, verify the contact email, and complete the trader or non-trader declaration.
2. **Upload.** Upload the release zip, fill in the fields above, add the graphics, and set visibility. Public is fine, or choose Unlisted to test with your team first. Then submit for review.

## Automated uploads after the first release

The store API can't create a new item, so the first upload is manual. After that, every `v*` tag uploads the new zip as a draft through the `publish-cws` job in `.github/workflows/release.yml`. You then submit it in the dashboard.

1. Create an OAuth client and a refresh token for the Chrome Web Store API. See [Google's guide](https://developer.chrome.com/docs/webstore/using-api).
2. Add 4 repository secrets: `CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET` and `CHROME_REFRESH_TOKEN`.
3. Bump `manifest.json` `version` for every release. The store rejects a version it has already seen.
