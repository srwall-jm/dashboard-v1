# OneSearch

Dashboard that joins Google Ads, GA4 and Google Search Console to read paid and organic search as one channel: channel weight, efficiency and savings, SEO by market, URL and keyword analysis, and AI referral traffic.

React + Vite, deployed on Cloudflare Pages. The `functions/` folder runs on Cloudflare and holds the two server pieces:

| Path | What it does |
| --- | --- |
| `functions/_middleware.js` | Proxies `/api/googleads/*` to the Google Ads API (it cannot be called from the browser). |
| `functions/api/insights.js` | Generates the AI report with Gemini, keeping the API key on the server. |

## Working on it

```bash
npm install
npm run dev        # app on http://localhost:5173 (Google Ads proxy included, no Gemini)
npm run preview    # full production build + Cloudflare functions locally
npm run check      # type check + tests + build, same as CI
```

Every push and pull request runs `.github/workflows/ci.yml`. If it fails, do not merge.

## Deploying

Cloudflare Pages builds the repo on every push.

- Build command: `npm run build`
- Output directory: `dist`
- Production branch: `main`. Any other branch gets its own preview URL.

Variables (Pages project > Settings > Variables and Secrets):

| Name | Where | Needed for |
| --- | --- | --- |
| `GEMINI_API_KEY` | Secret, server side | Gemini insights. Without it the button returns a clear message and OpenAI still works. |
| `GEMINI_MODEL` | Optional, server side | Changing the Gemini model without a code change. |
| `VITE_GOOGLE_ADS_DEVELOPER_TOKEN` | Optional, build time | Agency-wide fallback token. It ends up in the public JavaScript, so prefer the Settings field. |

## Setting up a client

In the dashboard, open Settings and:

1. Connect GA4 and Search Console, then pick the property and the site.
2. Paste the Google Ads Developer Token (Basic or Standard access).
3. Paste the OAuth Client ID that belongs to the same Google Cloud project as that token, then press Connect Google Ads.
4. Tick the Google Ads accounts that belong to the client. With a manager account, nothing is read until this is done.
5. Set the branded keyword regex for the client.

These values are saved in the browser, so today each person sets them up once per browser.

## Known limits

- The login screen identifies the user but does not restrict who can sign in.
- Google connections last about 1 hour and are asked for again in a new tab.
- Client settings are per browser, not shared across the team.
