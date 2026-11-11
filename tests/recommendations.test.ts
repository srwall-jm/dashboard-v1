import { describe, it, expect } from 'vitest';
import {
  recommendKeyword, recommendKeywords, summarizeRecommendations, getPressure, getRecoveryRate, combineShares, coverSearchTerms,
  DEFAULT_SETTINGS, settingsFromOverrides, overridesFromSettings, isDefaultSettings, MAX_ALLOWED_CUT, type KeywordSignal,
} from '../recommendations';

const signal = (over: Partial<KeywordSignal> = {}): KeywordSignal => ({
  keyword: 'running shoes',
  isBrand: false,
  cost: 1000,
  paidClicks: 500,
  paidImpressions: 10000,
  paidConversions: 25,
  impressionShare: 0.8,
  rankLostShare: 0.05,
  topImpressionShare: 0.6,
  organicRank: 1.2,
  organicClicks: 900,
  organicImpressions: 4000,
  ...over,
});

describe('getPressure', () => {
  it('grades pressure from impressions lost to ad rank', () => {
    expect(getPressure(signal({ rankLostShare: 0.05 }))).toBe('low');
    expect(getPressure(signal({ rankLostShare: 0.15 }))).toBe('medium');
    expect(getPressure(signal({ rankLostShare: 0.4 }))).toBe('high');
  });

  it('is unknown without impression share data, unless share is almost complete', () => {
    expect(getPressure(signal({ rankLostShare: null, impressionShare: null }))).toBe('unknown');
    expect(getPressure(signal({ rankLostShare: null, impressionShare: 0.95 }))).toBe('low');
  });
});

describe('getRecoveryRate', () => {
  it('drops sharply after position 1', () => {
    expect(getRecoveryRate(1)).toBe(0.5);
    expect(getRecoveryRate(3)).toBe(0.18);
    expect(getRecoveryRate(8)).toBe(0.04);
    expect(getRecoveryRate(null)).toBe(0);
  });
});

describe('recommendKeyword', () => {
  it('reduces, never to zero, when organic is first and pressure is low', () => {
    const r = recommendKeyword(signal(), 40);
    expect(r.action).toBe('REDUCE');
    expect(r.changePct).toBeCloseTo(-0.5);
    expect(r.suggestedSpend).toBeCloseTo(500);
    expect(r.spendCut).toBeCloseTo(500);
    expect(r.risk).toBe('low');
    // 250 clicks removed: organic keeps 62.5 to 125, 125 to 187.5 are at risk
    expect(r.clicksRecovered.high).toBeCloseTo(125);
    expect(r.clicksRecovered.low).toBeCloseTo(62.5);
    expect(r.clicksAtRisk.low).toBeCloseTo(125);
    expect(r.clicksAtRisk.high).toBeCloseTo(187.5);
    expect(r.conversionsAtRisk.low).toBeCloseTo(6.25);
    // 2.00 nominal CPC, half the clicks would have come anyway
    expect(r.incrementalCpc).toBeCloseTo(4);
  });

  it('no reduction ever reaches the full spend, whatever the inputs', () => {
    for (const isBrand of [true, false]) {
      for (const rankLostShare of [0, 0.15, 0.5, null]) {
        for (const organicRank of [1, 2, 3]) {
          const r = recommendKeyword(signal({ isBrand, rankLostShare, organicRank }), 40);
          expect(r.suggestedSpend).toBeGreaterThan(0);
          expect(r.suggestedSpend).toBeGreaterThanOrEqual(r.currentSpend * 0.5);
        }
      }
    }
  });

  it('cuts less as competitive pressure rises', () => {
    const low = recommendKeyword(signal({ rankLostShare: 0.05 }), 40);
    const medium = recommendKeyword(signal({ rankLostShare: 0.15 }), 40);
    const high = recommendKeyword(signal({ rankLostShare: 0.4 }), 40);
    expect(Math.abs(low.changePct)).toBeGreaterThan(Math.abs(medium.changePct));
    expect(Math.abs(medium.changePct)).toBeGreaterThan(Math.abs(high.changePct));
    expect(high.risk).toBe('high');
  });

  it('treats unknown pressure as medium, not as safe', () => {
    const r = recommendKeyword(signal({ rankLostShare: null, impressionShare: null }), 40);
    expect(r.pressure).toBe('unknown');
    expect(r.changePct).toBeCloseTo(-DEFAULT_SETTINGS.maxCut.nonBrand.medium);
    expect(r.risk).toBe('medium');
  });

  it('halves the cut for organic positions 2 and 3', () => {
    const r = recommendKeyword(signal({ organicRank: 2.4 }), 40);
    expect(r.action).toBe('REDUCE');
    expect(r.changePct).toBeCloseTo(-0.25);
    // 12.5% is shown as a whole percent so the badge and the text agree
    expect(recommendKeyword(signal({ organicRank: 2.4, isBrand: true }), 40).changePct).toBeCloseTo(-0.13);
  });

  it('protects brand terms: smaller cut, and none under high pressure', () => {
    const calm = recommendKeyword(signal({ isBrand: true }), 40);
    expect(calm.action).toBe('REDUCE');
    expect(calm.changePct).toBeCloseTo(-0.25);
    const attacked = recommendKeyword(signal({ isBrand: true, rankLostShare: 0.45 }), 40);
    expect(attacked.action).toBe('HOLD');
    expect(attacked.spendCut).toBe(0);
    expect(attacked.reason).toMatch(/defend the brand/i);
  });

  it('gives no recommendation on thin data', () => {
    const r = recommendKeyword(signal({ paidClicks: 5, cost: 12 }), 40);
    expect(r.action).toBe('NO_DATA');
    expect(r.spendCut).toBe(0);
  });

  it('holds when organic is on page one but not in the top 3', () => {
    const r = recommendKeyword(signal({ organicRank: 6 }), 40);
    expect(r.action).toBe('HOLD');
    expect(r.reason).toMatch(/SEO opportunity/);
  });

  it('holds when organic ranks top 3 but gets no clicks', () => {
    expect(recommendKeyword(signal({ organicClicks: 0 }), 40).action).toBe('HOLD');
  });

  it('increases where organic is absent, paid is efficient and there is room', () => {
    const r = recommendKeyword(signal({ organicRank: 14, organicClicks: 4, organicImpressions: 900, rankLostShare: 0.35 }), 50);
    expect(r.action).toBe('INCREASE');
    expect(r.suggestedSpend).toBeCloseTo(1200);
    expect(r.spendCut).toBe(0);
  });

  it('does not increase when paid is inefficient, has no room, or has no share data', () => {
    const weak = { organicRank: 25, organicClicks: 3, organicImpressions: 500 };
    expect(recommendKeyword(signal({ ...weak, rankLostShare: 0.35 }), 20).action).toBe('HOLD');
    expect(recommendKeyword(signal({ ...weak, rankLostShare: 0.05 }), 50).action).toBe('HOLD');
    expect(recommendKeyword(signal({ ...weak, rankLostShare: null }), 50).action).toBe('HOLD');
    expect(recommendKeyword(signal({ ...weak, rankLostShare: 0.35, paidConversions: 0 }), 50).action).toBe('HOLD');
  });
});

describe('summarizeRecommendations', () => {
  it('adds up the cut and projects it to 30 days', () => {
    const recs = recommendKeywords([
      signal(),
      signal({ keyword: 'trail shoes', organicRank: 7 }),
      signal({ keyword: 'tiny', paidClicks: 3, cost: 6, paidConversions: 0 }),
    ]);
    const s = summarizeRecommendations(recs, 90);
    expect(s.counts).toEqual({ REDUCE: 1, HOLD: 1, INCREASE: 0, NO_DATA: 1 });
    expect(s.spendCut).toBeCloseTo(500);
    expect(s.spendCutMonthly).toBeCloseTo(500 / 3);
    expect(s.spendAnalysed).toBeCloseTo(2006);
    expect(s.spendCutShare).toBeCloseTo(500 / 2006);
  });
});

describe('combineShares', () => {
  it('weights each row by its eligible impressions', () => {
    // 100 of 200 eligible, and 900 of 1000 eligible: 1000 of 1200 overall
    const r = combineShares([
      { impressions: 100, impressionShare: 0.5, rankLostShare: 0.4, topImpressionShare: 0.2 },
      { impressions: 900, impressionShare: 0.9, rankLostShare: 0.1, topImpressionShare: 0.8 },
    ]);
    expect(r.impressionShare).toBeCloseTo(1000 / 1200);
    expect(r.rankLostShare).toBeCloseTo((0.4 * 200 + 0.1 * 1000) / 1200);
    expect(r.topImpressionShare).toBeCloseTo((0.2 * 200 + 0.8 * 1000) / 1200);
  });

  it('returns nulls when no row carries a share', () => {
    expect(combineShares([{ impressions: 50, impressionShare: null, rankLostShare: null, topImpressionShare: null }]))
      .toEqual({ impressionShare: null, rankLostShare: null, topImpressionShare: null });
  });
});

describe('rules adjusted per client', () => {
  it('falls back to the defaults when nothing is stored', () => {
    expect(settingsFromOverrides(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(settingsFromOverrides({})).toEqual(DEFAULT_SETTINGS);
    expect(isDefaultSettings(settingsFromOverrides(null))).toBe(true);
  });

  it('round-trips through the stored form', () => {
    const custom = settingsFromOverrides({ cutNonBrandLow: 0.3, cutNonBrandMedium: 0.2, cutNonBrandHigh: 0.1, minPaidClicks: 50, recoveryRank1: 0.6 });
    expect(custom.maxCut.nonBrand).toEqual({ low: 0.3, medium: 0.2, high: 0.1 });
    expect(custom.minPaidClicks).toBe(50);
    expect(custom.recovery.rank1).toBe(0.6);
    expect(isDefaultSettings(custom)).toBe(false);
    expect(settingsFromOverrides(overridesFromSettings(custom))).toEqual(custom);
  });

  it('never allows a cut that takes spend to zero', () => {
    const s = settingsFromOverrides({ cutNonBrandLow: 1, cutNonBrandMedium: 5, cutNonBrandHigh: 1, cutBrandLow: 2 });
    expect(s.maxCut.nonBrand.low).toBe(MAX_ALLOWED_CUT);
    expect(s.maxCut.brand.low).toBe(MAX_ALLOWED_CUT);
    const r = recommendKeyword(signal(), 40, s);
    expect(r.action).toBe('REDUCE');
    expect(r.suggestedSpend).toBeGreaterThan(0);
    expect(r.suggestedSpend).toBeCloseTo(100);
  });

  it('keeps cuts from growing as competition rises', () => {
    const s = settingsFromOverrides({ cutNonBrandLow: 0.2, cutNonBrandMedium: 0.5, cutNonBrandHigh: 0.8 });
    expect(s.maxCut.nonBrand).toEqual({ low: 0.2, medium: 0.2, high: 0.2 });
  });

  it('ignores values that are not numbers and pulls the rest into range', () => {
    const s = settingsFromOverrides({ cutBrandLow: Number.NaN, minPaidClicks: -4, increaseStep: 9, recoveryRank1: 0.3, recoveryRank2to4: 0.8 } as any);
    expect(s.maxCut.brand.low).toBe(DEFAULT_SETTINGS.maxCut.brand.low);
    expect(s.minPaidClicks).toBe(1);
    expect(s.increaseStep).toBe(1);
    expect(s.recovery.rank2to4).toBe(0.3);
  });

  it('changes the recommendation for the client that set them', () => {
    const cautious = settingsFromOverrides({ cutNonBrandLow: 0.1, cutNonBrandMedium: 0.1, cutNonBrandHigh: 0.05 });
    expect(recommendKeyword(signal(), 40).changePct).toBeCloseTo(-0.5);
    expect(recommendKeyword(signal(), 40, cautious).changePct).toBeCloseTo(-0.1);
  });
});

describe('the figures that make the argument', () => {
  const recs = recommendKeywords([
    signal(), // reduce: 1000 spend, 500 paid clicks, 900 organic clicks, cut 50%
    signal({ keyword: 'only ads', organicRank: 22, organicClicks: 0, organicImpressions: 300, rankLostShare: 0.35, cost: 400, paidClicks: 200, paidConversions: 20 }),
    signal({ keyword: 'tiny', paidClicks: 3, cost: 6, paidConversions: 0 }),
  ]);
  const s = summarizeRecommendations(recs, 30);

  it('prices each click the ads really add above the nominal CPC', () => {
    expect(s.nominalCpc).toBeCloseTo(2);
    // 500 cut for 125 to 187.5 clicks lost
    expect(s.addedClickCost!.low).toBeCloseTo(500 / 187.5);
    expect(s.addedClickCost!.high).toBeCloseTo(4);
    expect(s.addedClickCost!.low).toBeGreaterThan(s.nominalCpc!);
  });

  it('puts the loss in proportion to all search clicks on those keywords', () => {
    expect(s.lossShareOfSearch!.low).toBeCloseTo(125 / 1400);
    expect(s.lossShareOfSearch!.high).toBeCloseTo(187.5 / 1400);
  });

  it('says what an increase buys and what is left after moving budget', () => {
    const up = recs.find(r => r.keyword === 'only ads')!;
    expect(up.action).toBe('INCREASE');
    // 80 more at 20 per conversion
    expect(up.expectedExtraConversions).toBeCloseTo(4);
    expect(s.spendToIncrease).toBeCloseTo(80);
    expect(s.extraConversions).toBeCloseTo(4);
    expect(s.netChange).toBeCloseTo(420);
  });

  it('reports how much was judged', () => {
    expect(s.judgedKeywords).toBe(2);
    expect(s.judgedSpendShare).toBeCloseTo(1400 / 1406);
  });

  it('leaves the argument empty when there is nothing to reduce', () => {
    const none = summarizeRecommendations(recommendKeywords([signal({ organicRank: 7 })]), 30);
    expect(none.addedClickCost).toBeNull();
    expect(none.lossShareOfSearch).toBeNull();
    expect(none.netChange).toBe(0);
  });
});

describe('no advice from missing data', () => {
  it('never recommends an increase when there is no organic data for the keyword', () => {
    for (const rankLostShare of [0.05, 0.35, 0.8, null]) {
      const r = recommendKeyword(signal({ organicRank: null, organicClicks: 0, organicImpressions: 0, rankLostShare }), 50);
      expect(r.action).toBe('HOLD');
      expect(r.suggestedSpend).toBe(r.currentSpend);
      expect(r.reason).toMatch(/No organic data/);
    }
  });

  it('does not treat a top position with a handful of clicks as proof', () => {
    expect(recommendKeyword(signal({ organicClicks: 9 }), 40).action).toBe('HOLD');
    expect(recommendKeyword(signal({ organicClicks: 10 }), 40).action).toBe('REDUCE');
  });

  it('with no organic data at all, nothing is reduced or increased', () => {
    const recs = recommendKeywords([
      signal({ organicRank: null, organicClicks: 0, organicImpressions: 0 }),
      signal({ keyword: 'b', organicRank: null, organicClicks: 0, organicImpressions: 0, rankLostShare: 0.5 }),
    ]);
    const s = summarizeRecommendations(recs, 30);
    expect(s.counts.REDUCE).toBe(0);
    expect(s.counts.INCREASE).toBe(0);
    expect(s.spendCut).toBe(0);
  });
});

describe('keywords judged by their search terms', () => {
  const term = (t: string, cost: number, organicRank: number | null, organicClicks = 200) => ({ term: t, cost, clicks: cost / 2, organicRank, organicClicks });

  it('measures how much of the spend is on searches where organic holds the top', () => {
    const cover = coverSearchTerms([term('a', 600, 1.2), term('b', 300, 7), term('c', 100, null, 0)], 1250)!;
    expect(cover.coverage).toBeCloseTo(0.8);
    expect(cover.topOrganicShare).toBeCloseTo(0.6);
    expect(cover.topOrganicRank).toBeCloseTo(1.2);
    expect(cover.terms.map(t => t.term)).toEqual(['a', 'b', 'c']);
    expect(coverSearchTerms([], 100)).toBeNull();
  });

  it('does not count a top position that gets almost no clicks', () => {
    expect(coverSearchTerms([term('a', 500, 1, 3), term('b', 500, 1)], 1000)!.topOrganicShare).toBeCloseTo(0.5);
  });

  it('keeps a broad keyword whose own text ranks first but whose money goes elsewhere', () => {
    const searchTerms = coverSearchTerms([term('running shoes', 200, 1.1), term('cheap trainers online', 500, null, 0), term('best sneakers 2026', 300, 18, 2)], 1000);
    const r = recommendKeyword(signal({ searchTerms }), 40);
    expect(r.action).toBe('HOLD');
    expect(r.spendCut).toBe(0);
    expect(r.why).toEqual({ code: 'mostlyOtherSearches', params: { share: 0.2, top: 3 } });
    expect(r.reason).toMatch(/Only 20% of this keyword's spend/);
  });

  it('reduces a keyword whose text has no organic data when most of its searches are won organically, and only on that share', () => {
    const searchTerms = coverSearchTerms([term('vuelos baratos madrid', 700, 1.3), term('vuelos low cost', 300, 12, 5)], 1000);
    const r = recommendKeyword(signal({ organicRank: null, organicClicks: 0, organicImpressions: 0, searchTerms }), 40);
    expect(r.action).toBe('REDUCE');
    // low pressure, position 1: 50% cap, applied to the 70% of spend where organic holds the top
    expect(r.changePct).toBeCloseTo(-0.35);
    expect(r.suggestedSpend).toBeCloseTo(650);
    expect(r.why!.code).toBe('reduceTerms');
    expect(r.searchTerms!.terms).toHaveLength(2);
  });

  it('falls back to the keyword text when the known search terms cover too little of the spend', () => {
    const searchTerms = coverSearchTerms([term('something else', 300, null, 0)], 1000);
    expect(searchTerms!.coverage).toBeCloseTo(0.3);
    const r = recommendKeyword(signal({ searchTerms }), 40);
    expect(r.action).toBe('REDUCE');
    expect(r.why!.code).toBe('reduce');
  });

  it('still never cuts to zero', () => {
    const searchTerms = coverSearchTerms([term('a', 1000, 1)], 1000);
    const r = recommendKeyword(signal({ searchTerms }), 40);
    expect(r.suggestedSpend).toBeGreaterThanOrEqual(500);
  });
});
