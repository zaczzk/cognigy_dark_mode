# Privacy policy

(Unofficial) Cognigy Dark Mode is a Chrome extension that changes the colours of the Cognigy.AI web app. It is an unofficial project, not affiliated with NiCE Cognigy.

## What it collects

Nothing. The extension makes no network requests, has no analytics and loads no remote code. No data leaves your computer.

## What it stores

Using Chrome's local extension storage, on your computer only, it keeps:

- the sites you enabled (hostname and optional app path)
- your appearance choice for each site (System, Dark or Original) and the Higher contrast setting

It never stores or sends page content, what you type, account details or record IDs. Removing a site, or uninstalling the extension, deletes its settings.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Saves your site list and appearance choices locally. |
| `activeTab` | Lets the popup see which site is open when you click the icon, so it can offer to enable it. |
| `scripting` | Applies the bundled theme files to Cognigy sites you enabled. |
| `trial.cognigy.ai` | The public Cognigy trial works without setup. |
| Other sites (optional) | Cognigy runs on many regional and company domains. Access is asked for only when you click **Enable** on a site. For NiCE-hosted sites such as `cognigy-au1.nicecxone.com`, Chrome asks once for `*.nicecxone.com`. The extension still runs only on the sites you enabled. |

You can remove any site in the popup, or revoke access on `chrome://extensions`.

## Contact

Questions: [open an issue](https://github.com/zaczzk/cognigy_dark_mode/issues).
