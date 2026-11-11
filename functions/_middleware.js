// Runs before every request to the site.
//
// 1. Access control. When Cloudflare Access is configured (see server/access.js), every request
//    must carry a valid Access token for an allowed email domain. Anything else is rejected,
//    including calls to the functions under /api/.
// 2. Proxy for the Google Ads API (it does not allow direct calls from the browser).
//    With Access on and GOOGLE_ADS_DEVELOPER_TOKEN set, the agency's developer token is added
//    here, so it never reaches the browser. It is never added for an unverified request.
//    Everything under /api/googleads/ is forwarded to googleads.googleapis.com.
//    Only the headers Google Ads needs are passed on; cookies and the rest stay behind.

import { accessConfig, verifyAccessRequest } from '../server/access.js';

const PREFIX = '/api/googleads';
const FORWARDED_HEADERS = ['authorization', 'content-type', 'developer-token', 'login-customer-id'];

const json = (body, status) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const isApi = url.pathname.startsWith('/api/');

  const config = accessConfig(context.env);
  if (config) {
    const result = await verifyAccessRequest(context.request, config);
    if (!result.ok) {
      return isApi
        ? json({ error: { message: result.reason } }, result.status)
        : new Response(`OneSearch: access denied. ${result.reason}`, {
            status: result.status,
            headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
          });
    }
    context.data.user = { email: result.email };
  }

  if (!url.pathname.startsWith(`${PREFIX}/`)) {
    return context.next();
  }

  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = context.request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const agencyToken = config ? String(context.env.GOOGLE_ADS_DEVELOPER_TOKEN || '').trim() : '';
  if (agencyToken) headers.set('developer-token', agencyToken);

  if (!headers.has('authorization') || !headers.has('developer-token')) {
    return json({ error: { message: 'Missing Google Ads credentials.' } }, 401);
  }

  const method = context.request.method;
  const targetUrl = `https://googleads.googleapis.com${url.pathname.slice(PREFIX.length)}${url.search}`;

  return fetch(targetUrl, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : context.request.body,
  });
}
