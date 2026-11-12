# Changelog

## Unreleased

Added (keyword, week by week)
- Each keyword in Spend recommendations opens a panel with its last 12 weeks: paid spend, clicks (paid and organic) and organic position, with the week a change was applied marked. Loaded on demand from Google Ads and Search Console.

Added (conversion value at risk)
- Google Ads conversion value is read per keyword. The tab shows the conversion value of the clicks that may be lost next to the saving, and the margin below which the reductions pay for themselves. Shown per keyword and in the CSV; hidden when the account records no conversion value.

Changed (Spend recommendations, visual)
- The tab now opens with pictures instead of five figure cards: the monthly amount that can come down next to a bar of where the spend goes (comes down, stays on the reduced keywords, untouched, added); what the saving may cost in clicks, with the uncertain part hatched; spend by organic position, to show why these keywords; and the first keywords to act on as bars with the part that always stays, ordered safest first or largest saving first.
- Solid bars are figures from the accounts, striped bars are estimates, dashed outlines are clicks that may be lost, so the page reads without colour and in print.
- The agreed plan is a four-step strip (proposed, agreed, applied, measured) with the measured verdicts.
- In the keyword table, the searches behind a keyword are shown with a small bar of how much of its spend is on searches already won organically.

Changed (Jellyfish look)
- Amounts in euros are written with the sign after the number ("45,991 €") everywhere. Other currencies keep the sign before it.
- Jellyfish identity across the app: DM Sans for text, Big Shoulders Display for titles and large figures, neutral greys, black menu and headline with the Jellyfish line-wave image and wordmark, yellow as the one accent, and a print footer with source and "Proprietary & Confidential".

Changed (independent design review)
- Donut charts replaced by sorted bars with written figures; scatter plots use one colour, labelled axes and country names; AI traffic quality is written, not a coloured dot.
- Older tables: sortable headers are buttons with a sort direction, and expandable rows open from the keyboard.
- Settings reorganised as the four steps to set up a client, with agency-wide credentials in a collapsed block.
- Numbers always use one locale.
- Summary rewritten around the client's decision: headline per month with cuts and increases together, the real cost of each click the ads add, expected loss in proportion, what each increase buys, a net line, a test stop rule and the assumptions.
- Spend recommendations: duplicated cards, the two-bar chart and the mislabelled "Top cannibalized URLs" block removed; sortable keyword table; the URL table moved to a collapsed analyst detail.
- Client view and print show two complete tables (Reduce, Increase) with assumptions, no controls, and a header with client, period and date. Print is A4 landscape.
- One visual system across views: fixed colours for organic, paid and totals, no text below 11px, readable chart axes and previous-period lines, one card style. "Risk" badges renamed to competitor pressure.
- Accessibility: Settings is a dialog that closes with Escape, named icon buttons, visible focus, reduced motion, better contrast.

Fixed
- Avg. CPC and Avg. CPA in Google Ads showed no currency symbol.
- The page header was cut off on narrow screens.
- Changing the client, the dates or the accounts while data was loading could let the older load overwrite the newer one, or count Search Console clicks twice. Each load is now numbered and a superseded one writes nothing. The same applies to the GA4 and Search Console loads, and their previous figures are cleared when a load fails.
- The keyword load no longer starts before the data it depends on has finished loading.
- The GA4 dimension selector offered dimensions (source, landing page, device) that left organic and paid at zero without saying so. It now offers only channel group, medium and source / medium.
- Sample rows could stay on screen next to real data when only one source was connected.
- A keyword with no organic data for its exact text was read as "no organic ranking" and could be recommended for an increase, even where the client ranks first. It is now kept as is, and nothing is recommended when Search Console queries did not load.
- A top organic position needs at least 10 organic clicks in the period before a reduction is proposed.
- Brand terms are stored per client with no default. The old default (`shop|brand|pro|sports`) marked words like "protein" as brand, an empty field marked everything as brand, and a client without brand terms inherited the previous client's.
- Sample data is no longer shown under a chosen client's name, and AI text is cleared when the client or period changes.
- Google Ads totals of the previous client stayed on screen after switching to a client with no accounts chosen, or after a failed load.
- Reconnecting Google after a token expired could silently switch to the property, site or manager account from page load.
- Google Ads spend was shown with the GA4 currency symbol. The accounts' own currency is now read; a notice appears when accounts mix currencies or differ from GA4.
- "Last 7/14/28/30 days" covered one day too many and included today, which is never complete.
- The AI report for spend recommendations was built on "all brand spend at position 1 is waste", against the never-to-zero rule. It now uses the model's figures.
- The Google Ads proxy forwards only the two read calls the dashboard makes; calls that change an account are refused.
- "Competitor pressure" renamed "Auction pressure": the figure also includes ads that did not show for reasons other than competitors.
- GA4 sessions and revenue were read by landing page as well as by day, channel and country, so large sites hit the row cap and totals came out low. The report no longer includes the landing page, which nothing in the menu used; it loads faster and totals are complete.
- Connecting Google Ads right after typing the developer token (a first visit, or a new browser) sent the request without the token and listed no accounts until the page was reloaded.

Added
- Measured results for the agreed plan: for each keyword marked as applied, "Measure applied changes" compares total clicks (paid plus organic) and spend in the two weeks before the date with the two weeks from it, and says whether clicks held, dropped a little, or fell enough to go back one step. A change too recent to measure shows the date from which it can be.
- Keywords are judged by their search terms. Google Ads search terms are read for each keyword and matched to the same search in Search Console; a keyword is reduced only when at least half of its spend is on searches where organic is in the top 3, and the cut applies to that share. A keyword whose own text ranks first but whose spend goes to other searches is kept, with the advice to split it. The table shows the main searches behind each keyword. Falls back to the keyword text when search terms cannot be read or cover under half of the spend.
- Language selector (English and Spanish) for what the client reads: Summary, spend recommendations with the reason for each keyword, monthly report, agreed plan, menu, page header and print. Numbers follow the language ("45.991 €" in Spanish). The choice is kept per client and saved with a shared client. Analyst screens (Settings, data notices, the other sections) are still in English.
- Agreed plan per keyword in Spend recommendations: mark a keyword as agreed, applied (with its date) or reverted, add a note, or mark it "do not reduce". A keyword marked that way is kept as is and leaves the saving figures. Shared with the team for a shared client, otherwise kept in the browser. Measuring what happened after a change is not built yet.
- Monthly report per client: save the report of a period from the Summary and, next time, see what changed since it: monthly saving potential, how many keywords to reduce and increase, and which keywords left or joined each list and why. Stored with the shared client in Cloudflare KV; needs access to be restricted.
- Recommendation rules editable per client in Settings (largest cuts by competition, clicks organic keeps, increase step, minimum clicks). No cut can exceed 90%, and cuts cannot grow as competition rises. Rules are saved with the shared client profile.
- Shared client profiles stored in Cloudflare KV (`CLIENT_PROFILES`): save the client setup once in Settings and anyone on the team opens it from the Client selector in the menu. No Google tokens are stored. Needs access to be restricted. Setup steps in the README.
- The Google Ads developer token and OAuth Client ID can be stored in Cloudflare (`GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_OAUTH_CLIENT_ID`). The proxy adds the token on the server, only for requests verified by Cloudflare Access, and both fields disappear from Settings.
- Access restricted to `@jellyfish.com` through Cloudflare Access. The functions verify the Access token on every request (pages, Google Ads proxy, insights). Off until `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are set; the dashboard shows a notice while it is off. Setup steps in the README.
- Google Ads accounts are chosen per client in Settings. Only the ticked accounts are read; the whole manager account is never added up. With several accounts and none chosen, no paid data loads and a notice asks to pick them.
- Summary page as the landing page: headline saving, context figures, top keywords to reduce and to increase, how to act.
- Navigation with section names grouped as Summary, Decide and Understand. Header shows what each section answers.
- Client view (hides menu, filters and settings) and Print / PDF.
- Keyword recommendations in Search Efficiency: reduce, hold or increase per keyword, with the reason, the suggested spend, and the clicks kept by organic and at risk. Spend is never recommended to go to zero; the floor rises with competitive pressure (impression share lost to ad rank) and is higher for brand terms. Assumptions are listed in the panel.
- Google Ads keyword load reads impression share, with a fallback and a notice when an account does not return it.

Fixed
- Savings in Search Efficiency were a flat 40% of spend per URL, and the accumulated figure was that number times 2.5. Both now come from the keyword model and refer to the selected period, with a 30 day projection.

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
