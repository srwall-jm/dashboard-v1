import { describe, it, expect, beforeEach } from 'vitest';
import { slugify, isValidId, sanitizeProfile } from '../server/clientProfiles.js';
import { onRequestGet } from '../functions/api/clients/index.js';
import { onRequestPut, onRequestDelete } from '../functions/api/clients/[id].js';

// In-memory stand-in for a Cloudflare KV namespace.
const fakeKv = () => {
  const store = new Map<string, string>();
  return {
    store,
    get: async (key: string, type?: string) => {
      const value = store.get(key);
      if (value === undefined) return null;
      return type === 'json' ? JSON.parse(value) : value;
    },
    put: async (key: string, value: string) => { store.set(key, value); },
    delete: async (key: string) => { store.delete(key); },
    list: async ({ prefix }: { prefix: string }) => ({
      keys: Array.from(store.keys()).filter(k => k.startsWith(prefix)).map(name => ({ name })),
      list_complete: true,
    }),
  };
};

const accessEnv = { ACCESS_TEAM_DOMAIN: 'jellyfish', ACCESS_AUD: 'aud' };
const ana = { user: { email: 'ana@jellyfish.com' } };
const profile = {
  name: 'Acme Sports',
  ga4PropertyId: 'properties/123',
  ga4PropertyName: 'Acme GA4',
  gscSiteUrl: 'sc-domain:acme.com',
  adsManagerId: '111-222-3333',
  adsAccountIds: ['444-555-6666', '7778889999', '7778889999'],
  brandRegex: 'acme|acmesports',
};

const put = (kv: any, id: string, body: unknown, env: any = accessEnv, data: any = ana) =>
  onRequestPut({
    request: new Request(`https://onesearch.example/api/clients/${id}`, { method: 'PUT', body: typeof body === 'string' ? body : JSON.stringify(body) }),
    env: { ...env, CLIENT_PROFILES: kv },
    data,
    params: { id },
  } as any);

let kv: ReturnType<typeof fakeKv>;
beforeEach(() => { kv = fakeKv(); });

describe('slugify / isValidId', () => {
  it('turns a client name into a safe id', () => {
    expect(slugify('Acme Sports')).toBe('acme-sports');
    expect(slugify('  Café & Té — España  ')).toBe('cafe-te-espana');
    expect(isValidId('acme-sports')).toBe(true);
    expect(isValidId('../etc')).toBe(false);
    expect(isValidId('client:other')).toBe(false);
    expect(isValidId('')).toBe(false);
  });
});

describe('sanitizeProfile', () => {
  it('keeps the known fields and normalises account ids', () => {
    const r = sanitizeProfile({ ...profile, token: 'secret', extra: { a: 1 } });
    expect(r.ok).toBe(true);
    expect(r.profile).toEqual({
      name: 'Acme Sports',
      ga4PropertyId: 'properties/123',
      ga4PropertyName: 'Acme GA4',
      gscSiteUrl: 'sc-domain:acme.com',
      adsManagerId: '1112223333',
      adsAccountIds: ['4445556666', '7778889999'],
      brandRegex: 'acme|acmesports',
    });
  });

  it('rejects a missing name, a broken regex and non numeric account ids', () => {
    expect(sanitizeProfile({ ...profile, name: '  ' }).ok).toBe(false);
    expect(sanitizeProfile({ ...profile, brandRegex: '(' }).ok).toBe(false);
    expect(sanitizeProfile({ ...profile, adsAccountIds: ['abc'] }).ok).toBe(false);
    expect(sanitizeProfile([]).ok).toBe(false);
  });
});

describe('recommendation rules in a profile', () => {
  it('keeps known numeric rules, bounded, and drops everything else', () => {
    const r = sanitizeProfile({ ...profile, recommendation: { cutNonBrandLow: 0.3, cutBrandHigh: 7, minPaidClicks: 49.6, bogus: 1, increaseStep: 'x' } });
    expect(r.profile.recommendation).toEqual({ cutNonBrandLow: 0.3, cutBrandHigh: 1, minPaidClicks: 50 });
  });

  it('stores no rules when none are valid', () => {
    expect('recommendation' in sanitizeProfile({ ...profile, recommendation: { bogus: 1 } }).profile).toBe(false);
    expect('recommendation' in sanitizeProfile(profile).profile).toBe(false);
  });
});

describe('/api/clients', () => {
  it('saves a profile with who changed it, and lists it back', async () => {
    const saved = await put(kv, 'acme-sports', profile);
    expect(saved.status).toBe(200);
    const { client } = await saved.json();
    expect(client).toMatchObject({ id: 'acme-sports', name: 'Acme Sports', updatedBy: 'ana@jellyfish.com' });
    expect(typeof client.updatedAt).toBe('string');

    const list = await onRequestGet({ env: { ...accessEnv, CLIENT_PROFILES: kv }, data: ana } as any);
    const body = await list.json();
    expect(body.available).toBe(true);
    expect(body.clients.map((c: any) => c.id)).toEqual(['acme-sports']);
  });

  it('never stores fields outside the profile, such as tokens', async () => {
    await put(kv, 'acme-sports', { ...profile, googleToken: 'ya29.secret' });
    expect(kv.store.get('client:acme-sports')).not.toContain('ya29.secret');
  });

  it('is closed while access to the site is not restricted', async () => {
    const noAccess = await put(kv, 'acme-sports', profile, {}, {});
    expect(noAccess.status).toBe(403);
    expect(kv.store.size).toBe(0);

    const noUser = await put(kv, 'acme-sports', profile, accessEnv, {});
    expect(noUser.status).toBe(403);

    kv.store.set('client:acme-sports', JSON.stringify({ id: 'acme-sports', name: 'Acme Sports' }));
    const list = await onRequestGet({ env: { CLIENT_PROFILES: kv }, data: {} } as any);
    expect(await list.json()).toEqual({ available: false, reason: 'access', clients: [] });
  });

  it('says so when the storage is not set up', async () => {
    const list = await onRequestGet({ env: accessEnv, data: ana } as any);
    expect(await list.json()).toEqual({ available: false, reason: 'storage', clients: [] });
    const saved = await onRequestPut({ request: new Request('https://x/api/clients/a', { method: 'PUT', body: '{}' }), env: accessEnv, data: ana, params: { id: 'a' } } as any);
    expect(saved.status).toBe(503);
  });

  it('rejects bad ids, bad JSON, invalid and oversized profiles', async () => {
    expect((await put(kv, 'Bad Id!', profile)).status).toBe(400);
    expect((await put(kv, 'acme', '{not json')).status).toBe(400);
    expect((await put(kv, 'acme', { name: '' })).status).toBe(400);
    expect((await put(kv, 'acme', { ...profile, name: 'x'.repeat(30000) })).status).toBe(413);
    expect(kv.store.size).toBe(0);
  });

  it('deletes a profile', async () => {
    await put(kv, 'acme-sports', profile);
    const res = await onRequestDelete({ env: { ...accessEnv, CLIENT_PROFILES: kv }, data: ana, params: { id: 'acme-sports' } } as any);
    expect(res.status).toBe(200);
    expect(kv.store.size).toBe(0);
  });
});
