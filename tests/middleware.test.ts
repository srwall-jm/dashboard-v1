import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { onRequest } from '../functions/_middleware.js';
import { onRequestGet as sessionGet } from '../functions/api/session.js';
import { clearAccessKeyCache } from '../server/access.js';

const TEAM = 'https://jellyfish.cloudflareaccess.com';
const AUD = 'aud-tag-123';
const protectedEnv = { ACCESS_TEAM_DOMAIN: 'jellyfish', ACCESS_AUD: AUD };

const b64url = (input: string | ArrayBuffer) => {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

let keyPair: CryptoKeyPair;
let publicJwk: JsonWebKey & { kid: string };
let upstreamCalls: string[] = [];

const token = async (email: string) => {
  const header = b64url(JSON.stringify({ alg: 'RS256', kid: 'key-1' }));
  const payload = b64url(JSON.stringify({ iss: TEAM, aud: [AUD], email, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(signature)}`;
};

// Minimal stand-in for the Cloudflare Pages context.
const run = async (path: string, env: Record<string, string>, headers: Record<string, string> = {}, method = 'GET') => {
  const data: Record<string, any> = {};
  const next = vi.fn(async () => new Response('page', { status: 200 }));
  const request = new Request(`https://onesearch.example${path}`, { method, headers });
  const response = await onRequest({ request, env, data, next } as any);
  return { response, next, data };
};

beforeAll(async () => {
  keyPair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  )) as CryptoKeyPair;
  publicJwk = { ...(await crypto.subtle.exportKey('jwk', keyPair.publicKey)), kid: 'key-1' };
});

beforeEach(() => {
  clearAccessKeyCache();
  upstreamCalls = [];
  vi.stubGlobal('fetch', vi.fn(async (input: any) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url === `${TEAM}/cdn-cgi/access/certs`) {
      return new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    upstreamCalls.push(url);
    return new Response('{"results":[]}', { status: 200 });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('middleware without Cloudflare Access configured', () => {
  it('lets pages through and reports the site as open', async () => {
    const { response, next } = await run('/', {});
    expect(next).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    const session = await sessionGet({ env: {}, data: {} } as any);
    expect(await session.json()).toMatchObject({ protected: false, email: null });
  });
});

describe('middleware with Cloudflare Access configured', () => {
  it('rejects pages and API calls that carry no Access token', async () => {
    const page = await run('/', protectedEnv);
    expect(page.response.status).toBe(401);
    expect(page.next).not.toHaveBeenCalled();

    const api = await run('/api/session', protectedEnv);
    expect(api.response.status).toBe(401);
    expect((await api.response.json()).error.message).toMatch(/No Cloudflare Access token/);
    expect(api.next).not.toHaveBeenCalled();

    const insights = await run('/api/insights', protectedEnv, {}, 'POST');
    expect(insights.response.status).toBe(401);
    expect(insights.next).not.toHaveBeenCalled();
  });

  it('does not forward Google Ads calls without a valid Access token', async () => {
    const { response } = await run('/api/googleads/v25/customers:listAccessibleCustomers', protectedEnv, {
      authorization: 'Bearer google-token',
      'developer-token': 'dev-token',
    });
    expect(response.status).toBe(401);
    expect(upstreamCalls).toEqual([]);
  });

  it('rejects a valid sign-in from another email domain', async () => {
    const { response, next } = await run('/api/session', protectedEnv, { 'Cf-Access-Jwt-Assertion': await token('someone@gmail.com') });
    expect(response.status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('lets a jellyfish.com sign-in through and exposes the email to the functions', async () => {
    const access = await token('ana@jellyfish.com');
    const { response, next, data } = await run('/api/session', protectedEnv, { 'Cf-Access-Jwt-Assertion': access });
    expect(next).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(data.user).toEqual({ email: 'ana@jellyfish.com' });

    const session = await sessionGet({ env: protectedEnv, data } as any);
    expect(await session.json()).toMatchObject({ protected: true, email: 'ana@jellyfish.com', allowedDomains: ['jellyfish.com'] });
  });

  it('forwards Google Ads calls for an allowed sign-in, with only the needed headers', async () => {
    const { response } = await run('/api/googleads/v25/customers:listAccessibleCustomers', protectedEnv, {
      'Cf-Access-Jwt-Assertion': await token('ana@jellyfish.com'),
      authorization: 'Bearer google-token',
      'developer-token': 'dev-token',
      cookie: 'CF_Authorization=secret',
    });
    expect(response.status).toBe(200);
    expect(upstreamCalls).toEqual(['https://googleads.googleapis.com/v25/customers:listAccessibleCustomers']);
    const forwarded = (globalThis.fetch as any).mock.calls.find((c: any[]) => String(c[0]).includes('googleads'))[1].headers as Headers;
    expect(forwarded.get('authorization')).toBe('Bearer google-token');
    expect(forwarded.get('cookie')).toBeNull();
    expect(forwarded.get('cf-access-jwt-assertion')).toBeNull();
  });
});

describe('agency Google Ads credentials kept on the server', () => {
  const adsPath = '/api/googleads/v25/customers:listAccessibleCustomers';
  const forwardedToken = () =>
    ((globalThis.fetch as any).mock.calls.find((c: any[]) => String(c[0]).includes('googleads'))?.[1].headers as Headers | undefined)?.get('developer-token');

  it('adds the server token for a verified request, replacing whatever the browser sent', async () => {
    const env = { ...protectedEnv, GOOGLE_ADS_DEVELOPER_TOKEN: 'agency-token' };
    const { response } = await run(adsPath, env, {
      'Cf-Access-Jwt-Assertion': await token('ana@jellyfish.com'),
      authorization: 'Bearer google-token',
      'developer-token': 'typed-in-browser',
    });
    expect(response.status).toBe(200);
    expect(forwardedToken()).toBe('agency-token');
  });

  it('works when the browser sends no developer token at all', async () => {
    const env = { ...protectedEnv, GOOGLE_ADS_DEVELOPER_TOKEN: 'agency-token' };
    const { response } = await run(adsPath, env, {
      'Cf-Access-Jwt-Assertion': await token('ana@jellyfish.com'),
      authorization: 'Bearer google-token',
    });
    expect(response.status).toBe(200);
    expect(forwardedToken()).toBe('agency-token');
  });

  it('never uses the server token while access is not restricted', async () => {
    const env = { GOOGLE_ADS_DEVELOPER_TOKEN: 'agency-token' };
    const withoutOwn = await run(adsPath, env, { authorization: 'Bearer google-token' });
    expect(withoutOwn.response.status).toBe(401);
    expect(upstreamCalls).toEqual([]);

    const withOwn = await run(adsPath, env, { authorization: 'Bearer google-token', 'developer-token': 'typed-in-browser' });
    expect(withOwn.response.status).toBe(200);
    expect(forwardedToken()).toBe('typed-in-browser');
  });

  it('tells the app what is managed, without ever returning the token', async () => {
    const managed = await sessionGet({ env: { ...protectedEnv, GOOGLE_ADS_DEVELOPER_TOKEN: 'agency-token', GOOGLE_ADS_OAUTH_CLIENT_ID: 'abc.apps.googleusercontent.com' }, data: { user: { email: 'ana@jellyfish.com' } } } as any);
    const text = await managed.text();
    expect(text).not.toContain('agency-token');
    expect(JSON.parse(text).googleAds).toEqual({ developerTokenOnServer: true, developerTokenWaitingForAccess: false, oauthClientId: 'abc.apps.googleusercontent.com' });

    const waiting = await sessionGet({ env: { GOOGLE_ADS_DEVELOPER_TOKEN: 'agency-token' }, data: {} } as any);
    expect((await waiting.json()).googleAds).toEqual({ developerTokenOnServer: false, developerTokenWaitingForAccess: true, oauthClientId: null });
  });
});

describe('the Google Ads proxy only reads', () => {
  const creds = { authorization: 'Bearer google-token', 'developer-token': 'dev-token' };

  it('forwards the two calls the dashboard makes', async () => {
    const list = await run('/api/googleads/v25/customers:listAccessibleCustomers', {}, creds, 'GET');
    expect(list.response.status).toBe(200);
    const search = await run('/api/googleads/v25/customers/1234567890/googleAds:search', {}, creds, 'POST');
    expect(search.response.status).toBe(200);
    expect(upstreamCalls).toHaveLength(2);
  });

  it('refuses calls that change an account, and anything else', async () => {
    const refused: [string, string][] = [
      ['/api/googleads/v25/customers/1234567890/googleAds:mutate', 'POST'],
      ['/api/googleads/v25/customers/1234567890/campaigns:mutate', 'POST'],
      ['/api/googleads/v25/customers/1234567890/campaignBudgets:mutate', 'POST'],
      ['/api/googleads/v25/customers/1234567890/googleAds:search', 'GET'],
      ['/api/googleads/v25/customers:listAccessibleCustomers', 'POST'],
      ['/api/googleads/v25/customers/1234567890/googleAds:search/../campaigns:mutate', 'POST'],
      ['/api/googleads/anything', 'GET'],
    ];
    for (const [path, method] of refused) {
      const { response } = await run(path, {}, creds, method);
      expect(response.status, `${method} ${path}`).toBe(403);
    }
    expect(upstreamCalls).toEqual([]);
  });
});
