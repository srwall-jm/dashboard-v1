// Proxy for the Google Ads API (it does not allow direct calls from the browser).
// Everything under /api/googleads/ is forwarded to googleads.googleapis.com.
// Only the headers Google Ads needs are passed on; cookies and the rest stay behind.

const PREFIX = '/api/googleads';
const FORWARDED_HEADERS = ['authorization', 'content-type', 'developer-token', 'login-customer-id'];

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (!url.pathname.startsWith(`${PREFIX}/`)) {
    return context.next();
  }

  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = context.request.headers.get(name);
    if (value) headers.set(name, value);
  }

  if (!headers.has('authorization') || !headers.has('developer-token')) {
    return new Response(JSON.stringify({ error: { message: 'Missing Google Ads credentials.' } }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const method = context.request.method;
  const targetUrl = `https://googleads.googleapis.com${url.pathname.slice(PREFIX.length)}${url.search}`;

  return fetch(targetUrl, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : context.request.body,
  });
}
