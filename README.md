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
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Secret, server side | The agency's Google Ads developer token (one for all clients). Added by the proxy, never sent to the browser, and only used once access is restricted (see "Restricting access"). The field disappears from Settings. |
| `GOOGLE_ADS_OAUTH_CLIENT_ID` | Server side | The OAuth Client ID of the same Google Cloud project as that token. The field disappears from Settings. |
| `VITE_GOOGLE_ADS_DEVELOPER_TOKEN` | Optional, build time | Old fallback. It ends up in the public JavaScript: remove it once `GOOGLE_ADS_DEVELOPER_TOKEN` is set. |

## Setting up a client

In the dashboard, open Settings and:

1. Connect GA4 and Search Console, then pick the property and the site.
2. Press Connect Google Ads. If the agency credentials are not stored in Cloudflare yet (see Variables above), first paste the Developer Token (Basic or Standard access) and the OAuth Client ID of the same Google Cloud project. Both are the agency's, the same for every client.
3. Tick the Google Ads accounts that belong to the client. With a manager account, nothing is read until this is done.
4. Set the branded keyword regex for the client.
5. Optional: adjust the recommendation rules (how far paid spend may be cut) if the defaults do not fit the client.

These values are saved in the browser. With shared client profiles set up, save them once as a client in Settings and the rest of the team picks it from the menu.

## Restricting access

The site is limited to `@jellyfish.com` accounts with Cloudflare Access. Access asks for a Google sign-in before anything loads, and the functions check the token Access signs on every request (`server/access.js`), so the app, the API and preview URLs are all covered.

Until this is set up, the dashboard shows a red "Access is not restricted yet" notice and anyone with a Google account can open it.

One-time setup, by someone who administers the Cloudflare account (menu names may differ slightly in the Cloudflare dashboard):

1. Zero Trust > Settings > Authentication: add Google as a login method (or keep the one-time PIN by email).
2. Zero Trust > Access > Applications: add a self-hosted application for the production domain of the Pages project. Add the `*.<project>.pages.dev` domain as well so preview URLs are covered.
3. Add an Allow policy: emails ending in `@jellyfish.com`.
4. Copy the application's "Application Audience (AUD) Tag", and note the team domain (`<team>.cloudflareaccess.com`).
5. Pages project > Settings > Variables and Secrets, for Production and Preview:

| Name | Value |
| --- | --- |
| `ACCESS_TEAM_DOMAIN` | `<team>.cloudflareaccess.com` |
| `ACCESS_AUD` | the AUD tag from step 4 |
| `ALLOWED_EMAIL_DOMAINS` | Optional, comma separated. Default `jellyfish.com`. |

6. Redeploy. Open the site in a private window: Cloudflare should ask for the sign-in, and the red notice should be gone.

Both variables must be set for the check to switch on. Once they are, a request without a valid Access token is rejected, so set them only after steps 1 to 4 work. To let a specific client in later, add their email to the Access policy and their domain to `ALLOWED_EMAIL_DOMAINS`.

## Shared client profiles

A client profile holds what the team needs to open a client without setting it up again: GA4 property, Search Console site, Google Ads manager and accounts, and the brand regex. It is saved from Settings ("Shared clients") and picked from the "Client" selector at the top of the menu. Profiles never hold Google tokens: each person still connects with their own Google account.

Profiles are stored in a Cloudflare KV namespace and are only served once access is restricted (see "Restricting access").

One-time setup, by someone who administers the Cloudflare account:

1. Storage & Databases > KV: create a namespace, for example `onesearch-client-profiles`.
2. Pages project > Settings > Bindings: add a KV namespace binding named `CLIENT_PROFILES` pointing to it, for Production and Preview.
3. Redeploy. "Shared clients" in Settings then shows the save form instead of a "not set up" note.

## Monthly report

With a shared client chosen, the Summary has a "Monthly report" block. "Save this report" stores what the recommendations say for the period on screen: the decision per keyword, the totals, the rules in use and any data notices. When an earlier report exists, the block shows what changed since it: saving potential, keywords to reduce and increase, and which keywords left or joined each list and why.

Reports are kept in the same KV namespace as the shared clients (`CLIENT_PROFILES`), so they need no extra setup. Nothing is saved automatically: someone has to press the button each month.

## Agreed plan

In Spend recommendations, the last column of the keyword table records what was agreed with the client: agreed, applied (with the date) or reverted, a note, and "do not reduce" for keywords the client wants left alone. A keyword marked "do not reduce" is kept as is and is taken out of the saving figures, with the note shown as the reason.

For a shared client the plan is stored with it and the whole team sees it. Otherwise it is kept in the browser. The tool does not yet measure what happened to clicks after a change was applied.

## Languages

The selector in the page header switches what the client reads between English and Spanish. The texts live in `i18n.tsx`: the English sentence is written in the code and is also the key, and each language has a dictionary. A sentence with no translation is shown in English. To add a language, add a dictionary there and its entry in `LANGS`.

The reason given for each keyword comes from the model as a case and its figures (`why` in `recommendations.ts`), so each language writes its own sentence.

## Known limits

- Without Cloudflare Access configured (see "Restricting access"), the login screen identifies the user but does not restrict who can sign in.
- Google connections last about 1 hour and are asked for again in a new tab.
- Without shared client profiles set up (see above), client settings are per browser, not shared across the team.
