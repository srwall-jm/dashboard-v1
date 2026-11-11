import { describe, it, expect, beforeEach } from 'vitest';
import { withPlanItem, countPlan, doNotReduceMap, EMPTY_ITEM, type Plan } from '../plan';
import { buildRecommendations, type KeywordSignal } from '../recommendations';
import { sanitizePlanItem } from '../server/plan.js';
import { onRequestGet, onRequestPatch } from '../functions/api/clients/[id]/plan.js';

const signal = (over: Partial<KeywordSignal> = {}): KeywordSignal => ({
  keyword: 'running shoes', isBrand: false, cost: 1000, paidClicks: 500, paidImpressions: 10000, paidConversions: 25,
  impressionShare: 0.8, rankLostShare: 0.05, topImpressionShare: 0.6, organicRank: 1.2, organicClicks: 900, organicImpressions: 4000, ...over,
});

describe('plan in the browser', () => {
  it('sets, changes and clears the entry of a keyword', () => {
    let plan: Plan = {};
    plan = withPlanItem(plan, 'Running Shoes ', { ...EMPTY_ITEM, status: 'agreed' });
    expect(plan).toEqual({ 'running shoes': { status: 'agreed', appliedOn: null, note: '', doNotReduce: false } });
    plan = withPlanItem(plan, 'running shoes', { ...plan['running shoes'], status: 'applied', appliedOn: '2026-11-03', note: 'Bid down 20%' });
    expect(plan['running shoes']).toMatchObject({ status: 'applied', appliedOn: '2026-11-03', note: 'Bid down 20%' });
    // back to "not decided" drops the date; with no note and no flag the entry goes away
    plan = withPlanItem(plan, 'running shoes', { status: 'none', appliedOn: '2026-11-03', note: '', doNotReduce: false });
    expect(plan).toEqual({});
  });

  it('counts where the plan stands', () => {
    const plan: Plan = {
      a: { status: 'agreed', appliedOn: null, note: '', doNotReduce: false },
      b: { status: 'applied', appliedOn: '2026-11-01', note: '', doNotReduce: false },
      c: { status: 'none', appliedOn: null, note: 'legal', doNotReduce: true },
      d: { status: 'reverted', appliedOn: '2026-10-01', note: '', doNotReduce: true },
    };
    expect(countPlan(plan)).toEqual({ agreed: 1, applied: 1, reverted: 1, doNotReduce: 2 });
    expect(Array.from(doNotReduceMap(plan).entries())).toEqual([['c', 'legal'], ['d', '']]);
  });
});

describe('"do not reduce" in the recommendations', () => {
  it('keeps the keyword as is, says why, and takes it out of the saving', () => {
    const signals = [signal(), signal({ keyword: 'trail shoes' })];
    const free = buildRecommendations(signals, undefined, 'All', 30);
    expect(free.summary.counts.REDUCE).toBe(2);

    const held = buildRecommendations(signals, undefined, 'All', 30, undefined, new Map([['running shoes', 'Legal wants it always on']]));
    const row = held.recommendations.find(r => r.keyword === 'running shoes')!;
    expect(row.action).toBe('HOLD');
    expect(row.suggestedSpend).toBe(row.currentSpend);
    expect(row.spendCut).toBe(0);
    expect(row.reason).toMatch(/do not reduce.*Legal wants it always on.*cut of 50%/);
    expect(held.summary.counts.REDUCE).toBe(1);
    expect(held.summary.spendCut).toBeCloseTo(free.summary.spendCut / 2);
  });

  it('does not touch keywords the model would not reduce anyway', () => {
    const held = buildRecommendations([signal({ organicRank: 14, rankLostShare: 0.4 })], undefined, 'All', 30, undefined, new Map([['running shoes', '']]));
    expect(held.recommendations[0].action).toBe('INCREASE');
  });
});

// ---- server ----

const fakeKv = () => {
  const store = new Map<string, string>();
  return {
    store,
    get: async (key: string, type?: string) => { const v = store.get(key); return v === undefined ? null : type === 'json' ? JSON.parse(v) : v; },
    put: async (key: string, value: string) => { store.set(key, value); },
  };
};
const accessEnv = { ACCESS_TEAM_DOMAIN: 'jellyfish', ACCESS_AUD: 'aud' };
const ana = { user: { email: 'ana@jellyfish.com' } };
let kv: ReturnType<typeof fakeKv>;
beforeEach(() => { kv = fakeKv(); });

const patch = (body: unknown, client = 'acme', env: any = accessEnv, data: any = ana) =>
  onRequestPatch({
    request: new Request(`https://x/api/clients/${client}/plan`, { method: 'PATCH', body: typeof body === 'string' ? body : JSON.stringify(body) }),
    env: { ...env, CLIENT_PROFILES: kv }, data, params: { id: client },
  } as any);
const read = async (client = 'acme') => (await onRequestGet({ env: { ...accessEnv, CLIENT_PROFILES: kv }, data: ana, params: { id: client } } as any)).json();

describe('sanitizePlanItem', () => {
  it('needs a date for an applied change and drops unknown fields', () => {
    expect(sanitizePlanItem({ keyword: 'x', status: 'applied' }).ok).toBe(false);
    expect(sanitizePlanItem({ keyword: 'x', status: 'applied', appliedOn: '03/11/2026' }).ok).toBe(false);
    const ok = sanitizePlanItem({ keyword: ' Running Shoes ', status: 'applied', appliedOn: '2026-11-03', note: ' Bid down ', token: 'secret' });
    expect(ok).toEqual({ ok: true, keyword: 'running shoes', item: { status: 'applied', appliedOn: '2026-11-03', note: 'Bid down', doNotReduce: false } });
    expect(sanitizePlanItem({ keyword: 'x', status: 'whatever' })).toEqual({ ok: true, keyword: 'x', item: null });
    expect(sanitizePlanItem({ status: 'agreed' }).ok).toBe(false);
  });
});

describe('/api/clients/:id/plan', () => {
  it('records who changed a keyword, keeps other keywords, and clears an entry', async () => {
    expect((await patch({ keyword: 'running shoes', status: 'agreed' })).status).toBe(200);
    expect((await patch({ keyword: 'trail shoes', status: 'none', doNotReduce: true, note: 'Legal' })).status).toBe(200);
    let plan = await read();
    expect(plan.available).toBe(true);
    expect(Object.keys(plan.items).sort()).toEqual(['running shoes', 'trail shoes']);
    expect(plan.items['running shoes']).toMatchObject({ status: 'agreed', updatedBy: 'ana@jellyfish.com' });

    await patch({ keyword: 'running shoes', status: 'none' });
    plan = await read();
    expect(Object.keys(plan.items)).toEqual(['trail shoes']);
  });

  it('keeps the plans of two clients apart', async () => {
    await patch({ keyword: 'running shoes', status: 'agreed' }, 'acme');
    expect((await read('acme-two')).items).toEqual({});
  });

  it('is closed without access restriction, and rejects bad input', async () => {
    expect((await patch({ keyword: 'x', status: 'agreed' }, 'acme', {}, {})).status).toBe(403);
    expect((await patch('{not json')).status).toBe(400);
    expect((await patch({ keyword: 'x', status: 'applied' })).status).toBe(400);
    expect((await patch({ keyword: 'x', status: 'agreed' }, '../x')).status).toBe(400);
    expect((await patch({ keyword: 'x', status: 'agreed', note: 'n'.repeat(5000) })).status).toBe(413);
    expect(kv.store.size).toBe(0);
    const closed = await (await onRequestGet({ env: { CLIENT_PROFILES: kv }, data: {}, params: { id: 'acme' } } as any)).json();
    expect(closed).toEqual({ available: false, reason: 'access', items: {} });
  });
});
