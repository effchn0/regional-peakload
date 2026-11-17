# Regional Peak Load • High Alarm

Live dashboard (GitHub Pages): https://effchn0.github.io/regional-peakload/

Features: เลือกภาค/เดือน/ปี ค.ศ., Peak/Avg, High Alarm, ตารางวันที่เกินเกณฑ์, ปรับแกน Y ใต้กราฟ, Manual Collect เลือกเดือนเริ่ม/สิ้นสุดและปี, Auto Collect เมื่อข้อมูลล่าสุดย้อนหลังเกิน 1 วัน.

## Publish
Settings → Pages → Source = **GitHub Actions**. Workflow `.github/workflows/pages.yml` จะเผยแพร่ทุก push ไป main.

## Backend setup (required for real data)
GitHub Pages is static and cannot store real data or fetch private EGAT pages directly. This repo provides:
- `backend/worker.js`: Cloudflare Worker API with KV storage.
- `collector/server.mjs`: localhost collector intended to run **inside authorized EGAT network**.
- `GET /api/data` serves persisted data; authenticated `POST /api/data` merges upserts by date+region.
- The browser triggers localhost `/collect` on demand and during page startup if Last Data is older than 1 day.

Configure a Cloudflare KV binding named `LOAD_KV`, set the Worker secret `WRITE_TOKEN`, and set allowed frontend origin `https://effchn0.github.io`. Do not put EGAT credentials, backend write token, Session or Hidden Fields in public site JavaScript. Configure the collector with allowed EGAT source and the Worker token stored **only on your local authorized machine**.

No actual EGAT URL/authentication adapter has yet been supplied. Until it is configured, Collector must fail clearly and never generate or claim to save fake data. Use JSON import for a read-only local preview.

JSON shape: `{"rows":[{"date":"2026-11-01","region":"ภาคใต้","load":2150.5},{"date":"2026-11-02","region":"ภาคใต้","load":null}]}`. Missing values stay null and display – rather than zero.

## Deployment

GitHub Pages publishes automatically via `.github/workflows/pages.yml` when `main` is updated. Source: GitHub Actions.
