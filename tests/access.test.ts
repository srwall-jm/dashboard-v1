import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { accessConfig, normalizeTeamDomain, verifyAccessToken, verifyAccessRequest, clearAccessKeyCache } from '../server/access.js';

const TEAM = 'https://jellyfish.cloudflareaccess.com';
const AUD = 'aud-tag-123';
const NOW = Date.UTC(2026, 10, 11, 12, 0, 0);
const config = { teamDomain: TEAM, aud: AUD, allowedDomains: ['jellyfish.com'] };

const b64url = (input: string | ArrayBuffer) => {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

let keyPair: CryptoKeyPair;
let otherKeyPair: CryptoKeyPair;
let publicJwk: JsonWebKey & { kid: string };
let certsCalls = 0;

const generate = () =>
  crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  ) as Promise<CryptoKeyPair>;

const sign = async (claims: Record<string, unknown>, opts: { key?: CryptoKey; kid?: string; alg?: string } = {}) => {
  const header = b64url(JSON.stringify({ alg: opts.alg || 'RS256', kid: opts.kid || 'key-1', typ: 'JWT' }));
  const payload = b64url(JSON.stringify(claims));
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', opts.key || keyPair.privateKey, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(signature)}`;
};

const claims = (over: Record<string, unknown> = {}) => ({
  iss: TEAM,
  aud: [AUD],
  email: 'ana@jellyfish.com',
  exp: Math.floor(NOW / 1000) + 3600,
  iat: Math.floor(NOW / 1000) - 10,
  ...over,
});

const fetchImpl = (async (url: string) => {
  certsCalls += 1;
  expect(url).toBe(`${TEAM}/cdn-cgi/access/certs`);
  return { ok: true, status: 200, json: async () => ({ keys: [publicJwk] }) };
}) as unknown as typeof fetch;

const verify = (token: string, cfg = config) => verifyAccessToken(token, cfg, { fetchImpl, now: NOW });

beforeAll(async () => {
  keyPair = await generate();
  otherKeyPair = await generate();
  publicJwk = { ...(await crypto.subtle.exportKey('jwk', keyPair.publicKey)), kid: 'key-1' };
});

beforeEach(() => {
  clearAccessKeyCache();
  certsCalls = 0;
});

describe('accessConfig', () => {
  it('is off until both the team domain and the audience are set', () => {
    expect(accessConfig({})).toBeNull();
    expect(accessConfig({ ACCESS_TEAM_DOMAIN: 'jellyfish' })).toBeNull();
    expect(accessConfig({ ACCESS_AUD: AUD })).toBeNull();
  });

  it('defaults to jellyfish.com and accepts a list of domains', () => {
    expect(accessConfig({ ACCESS_TEAM_DOMAIN: 'jellyfish', ACCESS_AUD: AUD })).toEqual(config);
    expect(accessConfig({ ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ALLOWED_EMAIL_DOMAINS: '@jellyfish.com, Client.com' })?.allowedDomains)
      .toEqual(['jellyfish.com', 'client.com']);
  });

  it('normalises the team domain', () => {
    expect(normalizeTeamDomain('jellyfish')).toBe(TEAM);
    expect(normalizeTeamDomain('https://jellyfish.cloudflareaccess.com/')).toBe(TEAM);
    expect(normalizeTeamDomain('')).toBe('');
  });
});

describe('verifyAccessToken', () => {
  it('accepts a valid token from an allowed domain', async () => {
    expect(await verify(await sign(claims()))).toEqual({ ok: true, email: 'ana@jellyfish.com' });
  });

  it('rejects a missing or malformed token', async () => {
    expect((await verify('')).status).toBe(401);
    expect((await verify('not-a-token')).status).toBe(401);
    expect((await verify('a.b.c')).status).toBe(401);
  });

  it('rejects other email domains, including lookalikes', async () => {
    for (const email of ['ana@gmail.com', 'ana@jellyfish.com.evil.io', 'ana@notjellyfish.com', 'jellyfish.com']) {
      const r = await verify(await sign(claims({ email })));
      expect(r.ok).toBe(false);
      expect(r.status).toBe(403);
    }
  });

  it('rejects a token with no email (service tokens)', async () => {
    const { email, ...rest } = claims();
    expect((await verify(await sign(rest))).status).toBe(403);
  });

  it('rejects a token signed with another key', async () => {
    const r = await verify(await sign(claims(), { key: otherKeyPair.privateKey }));
    expect(r).toMatchObject({ ok: false, status: 401 });
  });

  it('rejects a payload changed after signing', async () => {
    const [h, , s] = (await sign(claims({ email: 'ana@gmail.com' }))).split('.');
    const forged = `${h}.${b64url(JSON.stringify(claims()))}.${s}`;
    expect((await verify(forged)).ok).toBe(false);
  });

  it('rejects unsigned and non RS256 tokens', async () => {
    const none = `${b64url(JSON.stringify({ alg: 'none', kid: 'key-1' }))}.${b64url(JSON.stringify(claims()))}.`;
    expect((await verify(none)).ok).toBe(false);
    expect((await verify(await sign(claims(), { alg: 'HS256' }))).ok).toBe(false);
  });

  it('rejects expired tokens, other applications and other teams', async () => {
    expect((await verify(await sign(claims({ exp: Math.floor(NOW / 1000) - 3600 })))).reason).toMatch(/expired/);
    expect((await verify(await sign(claims({ aud: ['another-app'] })))).reason).toMatch(/another application/);
    expect((await verify(await sign(claims({ iss: 'https://evil.cloudflareaccess.com' })))).reason).toMatch(/another Cloudflare team/);
  });

  it('rejects an unknown key id after re-reading the keys once', async () => {
    const r = await verify(await sign(claims(), { kid: 'rotated-away' }));
    expect(r).toMatchObject({ ok: false, status: 401 });
    expect(certsCalls).toBe(2);
  });

  it('caches the signing keys between requests', async () => {
    await verify(await sign(claims()));
    await verify(await sign(claims()));
    expect(certsCalls).toBe(1);
  });

  it('answers 503 when the keys cannot be read', async () => {
    const failing = (async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch;
    const r = await verifyAccessToken(await sign(claims()), config, { fetchImpl: failing, now: NOW });
    expect(r).toMatchObject({ ok: false, status: 503 });
  });
});

describe('verifyAccessRequest', () => {
  it('reads the token from the Access header or cookie', async () => {
    const token = await sign(claims());
    const fromHeader = new Request('https://onesearch.example/api/session', { headers: { 'Cf-Access-Jwt-Assertion': token } });
    const fromCookie = new Request('https://onesearch.example/', { headers: { Cookie: `a=b; CF_Authorization=${token}` } });
    const none = new Request('https://onesearch.example/');
    expect((await verifyAccessRequest(fromHeader, config, { fetchImpl, now: NOW })).ok).toBe(true);
    expect((await verifyAccessRequest(fromCookie, config, { fetchImpl, now: NOW })).ok).toBe(true);
    expect((await verifyAccessRequest(none, config, { fetchImpl, now: NOW })).status).toBe(401);
  });
});
