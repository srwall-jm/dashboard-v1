import { describe, it, expect, beforeEach } from 'vitest';
import { buildSnapshot, diffSnapshots, snapshotIdOf, MODEL_VERSION, type Snapshot, type SnapshotRow } from '../snapshots';
import { recommendKeywords, summarizeRecommendations, type KeywordSignal } from '../recommendations';
import { sanitizeSnapshot } from '../server/snapshots.js';
import { onRequestGet as listGet } from '../functions/api/clients/[id]/snapshots/index.js';
import { onRequestGet as oneGet, onRequestPut, onRequestDelete } from '../functions/api/clients/[id]/snapshots/[snap].js';

const signal = (over: Partial<KeywordSignal> = {}): KeywordSignal => ({
  keyword: 'running shoes', isBrand: false, cost: 1000, paidClicks: 500, paidImpressions: 10000, paidConversions: 25,
  impressionShare: 0.8, rankLostShare: 0.05, topImpressionShare: 0.6, organicRank: 1.2, organicClicks: 900, organicImpressions: 4000, ...over,
});

const build = (signals: KeywordSignal[], start = '2026-10-01', end = '2026-10-31', days = 31) => {
  const recommendations = recommendKeywords(signals);
  return buildSnapshot({
    periodStart: start, periodEnd: end, periodDays: days, currencySymbol: '€', rules: undefined,
    summary: summarizeRecommendations(recommendations, days), recommendations, warnings: [],
  });
};

const saved = (input: ReturnType<typeof build>): Snapshot => ({ ...input, id: snapshotIdOf(input.periodStart, input.periodEnd), clientId: 'acme' });

describe('buildSnapshot', () => {
  it('keeps the decisions and drops keywords with too few clicks', () => {
    const snap = build([signal(), signal({ keyword: 'tiny', paidClicks: 3, cost: 5, paidConversions: 0 }), signal({ keyword: 'page two', organicRank: 14, rankLostShare: 0.4 })]);
    expect(snap.recommendations.map(r => `${r.keyword}:${r.action}`).sort()).toEqual(['page two:INCREASE', 'running shoes:REDUCE']);
    expect(snap.modelVersion).toBe(MODEL_VERSION);
    expect(snap.summary.counts.NO_DATA).toBe(1);
    expect(snap.summary.spendCut).toBeCloseTo(500);
  });
});

describe('diffSnapshots', () => {
  const september = saved(build([
    signal(),
    signal({ keyword: 'trail shoes', organicRank: 1.4 }),
    signal({ keyword: 'page two', organicRank: 14, rankLostShare: 0.4 }),
  ], '2026-09-01', '2026-09-30', 30));

  it('says which keywords left and joined each list, and why', () => {
    const october = build([
      signal(),
      signal({ keyword: 'trail shoes', organicRank: 6.2 }), // lost the top
      signal({ keyword: 'page two', organicRank: 14, rankLostShare: 0.05 }), // no room any more
      signal({ keyword: 'new term', organicRank: 1.1 }),
    ]);
    const d = diffSnapshots(september, october);
    expect(d.previousPeriod).toBe('2026-09-01 to 2026-09-30');
    expect(d.reduceBefore).toBe(2);
    expect(d.reduceNow).toBe(2);
    expect(d.leftReduce.map(m => m.keyword)).toEqual(['trail shoes']);
    expect(d.leftReduce[0].to).toBe('HOLD');
    expect(d.leftReduce[0].why).toMatch(/position 1\.4 to position 6\.2.*no longer holds the top/);
    expect(d.joinedReduce.map(m => m.keyword)).toEqual(['new term']);
    expect(d.joinedReduce[0].from).toBe('ABSENT');
    expect(d.leftIncrease.map(m => m.keyword)).toEqual(['page two']);
    expect(d.leftIncrease[0].why).toMatch(/auction pressure/);
    expect(d.joinedIncrease).toEqual([]);
    expect(d.rulesChanged).toBe(false);
    expect(d.modelChanged).toBe(false);
  });

  it('flags a comparison that is not like for like', () => {
    const october = { ...build([signal()]), rules: { cutNonBrandLow: 0.2 } };
    expect(diffSnapshots(september, october).rulesChanged).toBe(true);
    expect(diffSnapshots({ ...september, modelVersion: 'older' }, build([signal()])).modelChanged).toBe(true);
  });

  it('reports no moves when nothing changed', () => {
    const d = diffSnapshots(september, build([
      signal(), signal({ keyword: 'trail shoes', organicRank: 1.4 }), signal({ keyword: 'page two', organicRank: 14, rankLostShare: 0.4 }),
    ]));
    expect([d.leftReduce, d.joinedReduce, d.leftIncrease, d.joinedIncrease].every(l => l.length === 0)).toBe(true);
  });
});

// ---- server ----

const fakeKv = () => {
  const store = new Map<string, string>();
  return {
    store,
    get: async (key: string, type?: string) => { const v = store.get(key); return v === undefined ? null : type === 'json' ? JSON.parse(v) : v; },
    put: async (key: string, value: string) => { store.set(key, value); },
    delete: async (key: string) => { store.delete(key); },
    list: async ({ prefix }: { prefix: string }) => ({ keys: Array.from(store.keys()).filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }),
  };
};

const accessEnv = { ACCESS_TEAM_DOMAIN: 'jellyfish', ACCESS_AUD: 'aud' };
const ana = { user: { email: 'ana@jellyfish.com' } };
let kv: ReturnType<typeof fakeKv>;
beforeEach(() => { kv = fakeKv(); });

const put = (snap: any, id = snapshotIdOf(snap.periodStart, snap.periodEnd), client = 'acme', env: any = accessEnv, data: any = ana) =>
  onRequestPut({
    request: new Request(`https://x/api/clients/${client}/snapshots/${id}`, { method: 'PUT', body: typeof snap === 'string' ? snap : JSON.stringify(snap) }),
    env: { ...env, CLIENT_PROFILES: kv }, data, params: { id: client, snap: id },
  } as any);

describe('sanitizeSnapshot', () => {
  it('keeps known fields only and rejects a broken period or keyword', () => {
    const snap = build([signal()]);
    const ok = sanitizeSnapshot({ ...snap, token: 'secret', recommendations: snap.recommendations.map((r: SnapshotRow) => ({ ...r, extra: 1 })) });
    expect(ok.ok).toBe(true);
    expect(JSON.stringify(ok.snapshot)).not.toContain('secret');
    expect(JSON.stringify(ok.snapshot)).not.toContain('"extra":');
    expect(sanitizeSnapshot({ ...snap, periodStart: '2026-13-99x' }).ok).toBe(false);
    expect(sanitizeSnapshot({ ...snap, periodStart: '2026-11-01' }).ok).toBe(false);
    expect(sanitizeSnapshot({ ...snap, recommendations: [{ keyword: 'x', action: 'DELETE' }] }).ok).toBe(false);
    expect(sanitizeSnapshot({ ...snap, recommendations: 'none' }).ok).toBe(false);
  });
});

describe('/api/clients/:id/snapshots', () => {
  it('saves a report with who saved it, lists headers newest first and returns the rows on request', async () => {
    const sep = build([signal()], '2026-09-01', '2026-09-30', 30);
    const oct = build([signal(), signal({ keyword: 'b', organicRank: 1.1 })]);
    expect((await put(sep)).status).toBe(200);
    const res = await put(oct);
    const header = (await res.json()).snapshot;
    expect(header).toMatchObject({ id: '2026-10-01_2026-10-31', clientId: 'acme', savedBy: 'ana@jellyfish.com', keywords: 2 });
    expect('recommendations' in header).toBe(false);

    const list = await (await listGet({ env: { ...accessEnv, CLIENT_PROFILES: kv }, data: ana, params: { id: 'acme' } } as any)).json();
    expect(list.available).toBe(true);
    expect(list.snapshots.map((s: any) => s.id)).toEqual(['2026-10-01_2026-10-31', '2026-09-01_2026-09-30']);
    expect(list.snapshots.every((s: any) => !('recommendations' in s))).toBe(true);

    const one = await (await oneGet({ env: { ...accessEnv, CLIENT_PROFILES: kv }, data: ana, params: { id: 'acme', snap: '2026-09-01_2026-09-30' } } as any)).json();
    expect(one.snapshot.recommendations).toHaveLength(1);
  });

  it('keeps the reports of each client apart', async () => {
    await put(build([signal()]), undefined, 'acme');
    const other = await (await listGet({ env: { ...accessEnv, CLIENT_PROFILES: kv }, data: ana, params: { id: 'acme-two' } } as any)).json();
    expect(other.snapshots).toEqual([]);
  });

  it('is closed without access restriction or storage', async () => {
    const snap = build([signal()]);
    expect((await put(snap, undefined, 'acme', {}, {})).status).toBe(403);
    expect(kv.store.size).toBe(0);
    const noStorage = await onRequestPut({ request: new Request('https://x', { method: 'PUT', body: '{}' }), env: accessEnv, data: ana, params: { id: 'acme', snap: '2026-10-01_2026-10-31' } } as any);
    expect(noStorage.status).toBe(503);
    const list = await (await listGet({ env: { CLIENT_PROFILES: kv }, data: {}, params: { id: 'acme' } } as any)).json();
    expect(list).toEqual({ available: false, reason: 'access', snapshots: [] });
  });

  it('rejects bad ids, a mismatched period, bad JSON and oversized reports', async () => {
    const snap = build([signal()]);
    expect((await put(snap, 'october')).status).toBe(400);
    expect((await put(snap, '2026-09-01_2026-09-30')).status).toBe(400);
    expect((await put(snap, undefined, '../x')).status).toBe(400);
    expect((await put('{not json')).status).toBe(400);
    expect((await put({ ...snap, warnings: ['x'.repeat(700000)] })).status).toBe(413);
    expect(kv.store.size).toBe(0);
  });

  it('deletes a report and answers 404 afterwards', async () => {
    await put(build([signal()]));
    const ctx = { env: { ...accessEnv, CLIENT_PROFILES: kv }, data: ana, params: { id: 'acme', snap: '2026-10-01_2026-10-31' } } as any;
    expect((await onRequestDelete(ctx)).status).toBe(200);
    expect((await oneGet(ctx)).status).toBe(404);
  });
});
