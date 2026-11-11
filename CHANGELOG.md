# Changelog

## Unreleased

Changed
- "Organic" and "Paid" now mean search only: GA4 `Organic Search` and `Paid Search`. Organic Social, Organic Shopping, Organic Video, Paid Social, Paid Shopping, Paid Video and Paid Other no longer count in the channel KPIs, charts, country tables or the per URL join.

## 1.2.0 (2026-11-11) Data accuracy

Fixed
- Search Console totals were read without a row limit, so only the first 1,000 day and country rows counted. Clicks and impressions were understated on sites with traffic from many countries. Now read in full.
- GA4 main report stopped at 100,000 rows without notice, understating sessions and revenue on large sites. Now paginated up to 300,000 rows, with a warning beyond that.
- Google Ads accounts that failed (expired session, token, quota) were skipped silently, showing partial or zero spend. Now reported in an "Incomplete data" notice.
- A failure while processing Google Ads keywords made the loader retry in a loop. It now stops and reports it.
- Expired Google sessions show a clear "reconnect" message for GA4 and Search Console.
- Dates were parsed as UTC, shifting comparisons and weekly grouping by 1 day for users west of Greenwich.

Added
- "Incomplete data" notice whenever a source hits a row cap or an account cannot be read.
- `dataFetch.ts` with paginated readers, plus 8 tests (17 in total).

## 1.1.0 (2026-11-11) Stabilisation

Fixed
- Google Ads keyword load crashed on an undefined `normalizeUrl` (URL + keyword join in Efficiency).
- Gemini insights could not run in production (`process.env` in the browser). Now served by `functions/api/insights.js` with the key on the server.
- Branded keyword regex was lost on reload. Now saved in the browser.
- AI Traffic showed sample data after a real GA4 error. It now shows the error.
- Sample data is clearly labelled with a banner.
- Removed the broken "View Technical Debug Logs" link.
- AI report rendered as raw HTML. Now rendered as safe text with basic formatting.
- CSV export broke on values containing double quotes.
- Interface strings unified in English; removed the hardcoded Cloud project ID from error messages.

Build and deploy
- Single Vite version, Tailwind compiled at build time instead of the CDN script, AI Studio import map removed.
- Removed the unused Express server (`server.ts`) and `functions/ping.js`.
- Google Ads proxy only forwards the 4 headers it needs and rejects calls without credentials.
- Logo served locally (2 MB file reduced to 114 KB); JavaScript split in 2 files.
- Type check now runs inside `npm run build`.

Added
- GitHub Actions CI (type check, tests, build), 9 unit tests, real README, `.nvmrc`.
