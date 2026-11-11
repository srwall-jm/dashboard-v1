// GET /api/session
// Tells the app who is signed in, whether access to the site is restricted, and which
// Google Ads credentials the agency keeps on the server.
// The middleware has already verified the Cloudflare Access token when Access is configured.

import { accessConfig } from '../../server/access.js';

export async function onRequestGet({ env, data }) {
  const config = accessConfig(env);
  const hasToken = String(env?.GOOGLE_ADS_DEVELOPER_TOKEN || '').trim().length > 0;
  const googleAds = {
    // The server only adds the token for requests verified by Access.
    developerTokenOnServer: Boolean(config) && hasToken,
    developerTokenWaitingForAccess: !config && hasToken,
    // A client ID is public by design (it is visible in any Google sign-in).
    oauthClientId: String(env?.GOOGLE_ADS_OAUTH_CLIENT_ID || '').trim() || null,
  };
  const body = config
    ? { protected: true, email: data?.user?.email || null, allowedDomains: config.allowedDomains, googleAds }
    : { protected: false, email: null, googleAds };
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
