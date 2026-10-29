# Cognigy Graphite

A colour-only dark theme for the Cognigy.AI web app. Layout, typography, images and shadows are unchanged. This is an unofficial project and is not affiliated with NiCE Cognigy.

## Use

- Click the toolbar icon on a Cognigy tab and choose **System** (follow Chrome's light/dark preference), **Dark** or **Original**.
- `trial.cognigy.ai` is enabled by default. On any other Cognigy host, click **Enable on this site**. Chrome asks for permission for that one hostname.
- **Saved sites** lists every enrolled host, with **Pause**, **Enable**, **Remove** and **Add site**. Add site accepts an optional application path prefix.

## Scope

- **Covered:** authoring (`/project…`), the project index (`/projects`), Admin Center (`/admincenter`) and Insights (`/insights`).
- **Excluded:** the public cognigy.com website and embedded CXone frames.
- Screens the extension does not recognise keep their native colours. The popup shows **Partly supported** on project and workspace routes; that label alone does not indicate a refused component or a light surface.

## Privacy

- **Permissions:** `storage`, `activeTab` and `scripting`, plus `trial.cognigy.ai`. Other hosts are granted individually.
- No network requests, analytics, remote code or browsing history.
- Only enrolled hostnames, path prefixes and appearance choices are stored, locally.

Source, issues and contributing: https://github.com/zaczzk/cognigy_dark_mode
