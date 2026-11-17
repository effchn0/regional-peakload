# Regional Peak Load • EGAT Monthly Requirement

**GitHub Pages:** https://effchn0.github.io/regional-peakload/  
**Source:** http://control.egat.co.th/gpddwebsite/MonthlyRequirementNonCoPage.aspx

The GitHub Pages dashboard reads only **approved, published** monthly JSON files from relative paths `data/YYYY-MM.json`. It does not contact EGAT from GitHub Pages or a GitHub-hosted runner. There is **no automatic Mock fallback**.

## Setup on an authorized computer inside EGAT

Install Node.js 20 or later. Clone this repository, then run:

```sh
git clone https://github.com/effchn0/regional-peakload.git
cd regional-peakload
npm install
npm run collect -- 2026 1 11
```

This generates `data/2026-01.json` … `data/2026-11.json` locally. The Collector uses:
1. Fresh GET of EGAT ASP.NET page with timeout, reads Cookie and all `__*` hidden fields.
2. POST back to the same domain with those cookies and fresh hidden fields; padded month `01`–`12` and Gregorian year `2026`.
3. Parse `#ContentPlaceHolder1_tblReq` using nested-cell-aware HTML parser.
4. Strictly validate date/month/year, duplicate dates, numeric fields, per-region Peak time, and sort rows.
5. Cache generated JSON for 15 minutes (CLI option `--force` bypasses the cache).

No credentials, Cookies, Session IDs, HTML responses or Hidden Fields are written to `data/`.

### Review and publish

**Only publish after verifying that the JSON is authorized for public disclosure.** A Public GitHub repository and GitHub Pages make committed `data/*.json` publicly accessible. Do **not** publish if EGAT restrictions prohibit release.

```sh
git status
# Inspect and approve only intended data/YYYY-MM.json files
git add data/2026-01.json data/2026-02.json
git commit -m "data: publish approved monthly requirements"
git push origin main
```

A GitHub Actions workflow deploys the static site automatically on push. **The workflow does not connect to EGAT.**

### Collect from the dashboard (optional)

Start Local Collector on the *same authorized EGAT-network computer*, from the cloned repository root:

```sh
npm run collector:server
```

It listens on `http://127.0.0.1:8765` only. The website's **Collect Data** button sends the selected Gregorian year and month range to that localhost Collector. The Collector writes JSON **locally only**. It never commits or pushes; after checking/publication approval, run the manual git commands above.

On page opening, when the selected current month's published data is more than one day stale or missing, the page tries the local Collector if reachable. When opened outside EGAT, or without a running Collector, it shows a connection error and continues showing previously published data. A fetch failure cannot by itself distinguish “outside EGAT” from a stopped Collector or browser local-network restrictions.

### JSON schema

```json
{
  "schemaVersion": 1,
  "source": "EGAT Monthly Requirement",
  "year": 2026,
  "month": 1,
  "unit": "MW",
  "unitBasis": "project-configuration",
  "collectedAt": "2026-11-17T08:00:00.000Z",
  "isMock": false,
  "rows": [
    {
      "date": "2026-01-01",
      "metro": {"time": null, "demand": null},
      "central": {"time": null, "generation": null, "export": null, "demand": null},
      "northeast": {"time": null, "generation": null, "export": null, "demand": null},
      "south": {"time": null, "generation": null, "export": null, "demand": null},
      "north": {"time": null, "demand": null},
      "total": {"time": null, "demand": null}
    }
  ]
}
```

Example is **schema illustration, not collected data**. Blank/dash means `null`, not `0`. All dates and Peak times are independent. Total demand is **reported source total**, never computed from regional Peaks. The HTML source table does not state a unit; MW is supplied by project configuration.

### Dashboard

Preserved: monthly/year selectors, per-region load bar chart, High Alarm criterion and day list, adjustable chart Y-axis minimum, summary cards, JSON preview/export. Added: Peak day/time table and provenance (`collectedAt`, **ข้อมูลที่เก็บไว้ ไม่ใช่ Live**). No file → no data, never mocked.

### Security note

Local Collector is localhost-only and the page origin is restricted to `https://effchn0.github.io`. No Cookie/Session/Hidden Field is uploaded to GitHub, and browser code does not read or transmit EGAT credentials. If local network access is disallowed by browser policy, run the CLI directly on the authorized EGAT computer and review/push JSON separately.

Legacy `backend/worker.js` remains for compatibility but is **not used by this static JSON workflow**.
