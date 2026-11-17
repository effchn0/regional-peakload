# GitHub Pages · mirror of ChatGPT Site visual interface

## Deployment result
The GitHub Pages action builds the published root from these **public frontend assets** at:
`https://effchn-peakload.chalermphol-ko132.chatgpt.site/`

- `index.html`: original Regional Peak Load / High Alarm page, including its colors, cards, legend, criteria controls, chart, event log and chart-axis controls.
- `monthly.html`, `monthly.js`, `theme.css`, `thailand-regions.png`: original Monthly Requirement layout, map, SVG charts, peak cards, data table and exports.
- `version.js`: fixed bottom-right deployment timestamp label.
- `.nojekyll`: GitHub Pages compatibility.

**No private EGAT collector credentials, Cookies or hidden fields** are included. The action downloads only the public Site frontend files; it never GETs the EGAT internal HTTP site.

## Data behavior and current limitation

The static pages first try `./data/YYYY-MM.json` if an **approved** monthly file is published. If missing, they try `https://effchn-peakload.chalermphol-ko132.chatgpt.site/monthly?year=YYYY&month=MM` without credentials.

That second browser request is cross-origin; it works only if the old Site permits `https://effchn0.github.io` via CORS. A prior response from the old Site had `transport: internal-snapshot` and `connectionStatus: source_unreachable`: HTTP 200 was a previously stored snapshot **not a fresh live EGAT collect**.

GitHub Pages alone still cannot run server-side HTTP WebForms GET/POST against EGAT. Collecting fresh data from any authorized EGAT workstation requires an organization-approved HTTPS gateway whose server can access the internal source. `gateway/server.mjs` is an implementation starter, not a deployed internal service.

## Disclosure

The user-supplied ZIP included 2026-01 through 2026-11 EGAT data. These data have **not** been committed by the Site mirror workflow to the public GitHub repository or Pages without explicit approval of their release. The original Site's public frontend and original source file designs are used for the mirror.

## Build and verify

GitHub workflow: `.github/workflows/pages.yml` → `node scripts/build-site-mirror.mjs` → `actions/upload-pages-artifact` of `published/`.

The build fails if source pages / stylesheet / map / script cannot be downloaded or do not contain expected markers; it will not silently replace the UI with placeholder HTML.

This is a visual/frontend mirror, not a claim that original private backend or live EGAT access is replicated.
