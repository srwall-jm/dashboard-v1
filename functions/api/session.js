// GET /api/session
// Tells the app who is signed in and whether access to the site is restricted.
// The middleware has already verified the Cloudflare Access token when Access is configured.

import { accessConfig } from '../../server/access.js';

export async function onRequestGet({ env, data }) {
  const config = accessConfig(env);
  const body = config
    ? { protected: true, email: data?.user?.email || null, allowedDomains: config.allowedDomains }
    : { protected: false, email: null };
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
