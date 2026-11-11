// Keyword level recommendation model for the Search Efficiency view.
//
// Question it answers for the client: on which keywords can paid spend come
// down because organic already holds the click, and on which should it go up.
//
// Rules it never breaks:
// - Spend is never recommended to go to zero. Every reduction stops at a
//   defensive floor, because an empty ad slot is taken by a competitor.
// - The floor rises with competitive pressure and is higher for brand terms.
// - Nothing is recommended on keywords with too little data.
//
// Every number below that is an assumption (not something read from the
// accounts) lives in DEFAULT_SETTINGS so it can be shown and changed.

export type Pressure = 'low' | 'medium' | 'high' | 'unknown';
export type RecAction = 'REDUCE' | 'HOLD' | 'INCREASE' | 'NO_DATA';
export type Risk = 'low' | 'medium' | 'high';

export interface KeywordSignal {
  keyword: string;
  isBrand: boolean;
  // Google Ads, for the selected period
  cost: number;
  paidClicks: number;
  paidImpressions: number;
  paidConversions: number;
  impressionShare: number | null; // 0 to 1
  rankLostShare: number | null; // 0 to 1, impressions lost to ad rank
  topImpressionShare: number | null; // 0 to 1
  // Search Console, same period, same query text
  organicRank: number | null;
  organicClicks: number;
  organicImpressions: number;
}

export interface RecommendationSettings {
  // Below this many paid clicks in the period a keyword gets no recommendation.
  minPaidClicks: number;
  // Largest share of current spend a reduction may remove. 1 - maxCut is the floor.
  maxCut: {
    nonBrand: Record<'low' | 'medium' | 'high', number>;
    brand: Record<'low' | 'medium' | 'high', number>;
  };
  // Organic position up to which a reduction is considered at all.
  maxRankForReduce: number;
  // Organic position from which paid is considered the only real presence.
  minRankForIncrease: number;
  // Share of impressions lost to ad rank from which there is room to grow.
  minRankLostForIncrease: number;
  // Step proposed when increasing.
  increaseStep: number;
  // Share of removed paid clicks that organic is expected to pick up,
  // by organic position. Upper end of the range.
  recovery: { rank1: number; rank2to4: number; rank5plus: number };
  // Lower end of the range = recovery * this factor.
  conservativeFactor: number;
  // Rank lost share thresholds that define competitive pressure.
  pressure: { medium: number; high: number };
}

// Recovery rates come from Google's published study on ad click incrementality
// by organic position (2012): about 50% of ad clicks are incremental when the
// advertiser also ranks first, about 82% for positions 2 to 4, about 96% from
// position 5. Recovery is the complement. It is an old cross-industry average:
// treat it as a starting point and replace it with the client's own test results.
export const DEFAULT_SETTINGS: RecommendationSettings = {
  minPaidClicks: 20,
  maxCut: {
    nonBrand: { low: 0.5, medium: 0.35, high: 0.2 },
    brand: { low: 0.25, medium: 0.15, high: 0 },
  },
  maxRankForReduce: 3,
  minRankForIncrease: 10,
  minRankLostForIncrease: 0.2,
  increaseStep: 0.2,
  recovery: { rank1: 0.5, rank2to4: 0.18, rank5plus: 0.04 },
  conservativeFactor: 0.5,
  pressure: { medium: 0.1, high: 0.3 },
};

export interface Range {
  low: number;
  high: number;
}

export interface KeywordRecommendation {
  keyword: string;
  isBrand: boolean;
  action: RecAction;
  reason: string;
  pressure: Pressure;
  risk: Risk | null; // only for REDUCE
  organicRank: number | null;
  organicClicks: number;
  organicCtr: number | null;
  paidClicks: number;
  paidConversions: number;
  avgCpc: number;
  impressionShare: number | null;
  rankLostShare: number | null;
  currentSpend: number;
  suggestedSpend: number;
  changePct: number; // -0.35 = cut 35%, +0.2 = raise 20%
  spendCut: number; // 0 unless REDUCE
  // Paid clicks removed by the cut that organic is expected to keep.
  clicksRecovered: Range;
  // Paid clicks removed by the cut that are expected to be lost.
  clicksAtRisk: Range;
  conversionsAtRisk: Range;
  // What an ad click that organic would not have got really costs.
  incrementalCpc: number | null;
}

export const getPressure = (signal: KeywordSignal, settings: RecommendationSettings = DEFAULT_SETTINGS): Pressure => {
  const lost = signal.rankLostShare;
  if (lost !== null && Number.isFinite(lost)) {
    if (lost >= settings.pressure.high) return 'high';
    if (lost >= settings.pressure.medium) return 'medium';
    return 'low';
  }
  // No rank lost figure: an almost complete impression share still tells us nobody is pushing us out.
  if (signal.impressionShare !== null && signal.impressionShare >= 0.9) return 'low';
  return 'unknown';
};

export const getRecoveryRate = (organicRank: number | null, settings: RecommendationSettings = DEFAULT_SETTINGS): number => {
  if (organicRank === null || !Number.isFinite(organicRank)) return 0;
  if (organicRank <= 1.5) return settings.recovery.rank1;
  if (organicRank <= 4) return settings.recovery.rank2to4;
  return settings.recovery.rank5plus;
};

const pct = (value: number) => `${Math.round(value * 100)}%`;
const rankText = (rank: number) => rank.toFixed(1);

const pressureText: Record<Pressure, string> = {
  low: 'low competitive pressure',
  medium: 'medium competitive pressure',
  high: 'high competitive pressure',
  unknown: 'competitive pressure unknown, treated as medium',
};

export const recommendKeyword = (
  signal: KeywordSignal,
  benchmarkCpa: number | null,
  settings: RecommendationSettings = DEFAULT_SETTINGS
): KeywordRecommendation => {
  const pressure = getPressure(signal, settings);
  // Unknown pressure is never treated as "safe".
  const effectivePressure: 'low' | 'medium' | 'high' = pressure === 'unknown' ? 'medium' : pressure;
  const avgCpc = signal.paidClicks > 0 ? signal.cost / signal.paidClicks : 0;
  const organicCtr = signal.organicImpressions > 0 ? signal.organicClicks / signal.organicImpressions : null;
  const recovery = getRecoveryRate(signal.organicRank, settings);
  const cpa = signal.paidConversions > 0 ? signal.cost / signal.paidConversions : null;

  const base: KeywordRecommendation = {
    keyword: signal.keyword,
    isBrand: signal.isBrand,
    action: 'HOLD',
    reason: '',
    pressure,
    risk: null,
    organicRank: signal.organicRank,
    organicClicks: signal.organicClicks,
    organicCtr,
    paidClicks: signal.paidClicks,
    paidConversions: signal.paidConversions,
    avgCpc,
    impressionShare: signal.impressionShare,
    rankLostShare: signal.rankLostShare,
    currentSpend: signal.cost,
    suggestedSpend: signal.cost,
    changePct: 0,
    spendCut: 0,
    clicksRecovered: { low: 0, high: 0 },
    clicksAtRisk: { low: 0, high: 0 },
    conversionsAtRisk: { low: 0, high: 0 },
    incrementalCpc: avgCpc > 0 && recovery < 1 ? avgCpc / (1 - recovery) : null,
  };

  if (signal.cost <= 0 || signal.paidClicks < settings.minPaidClicks) {
    return {
      ...base,
      action: 'NO_DATA',
      incrementalCpc: null,
      reason: `Fewer than ${settings.minPaidClicks} paid clicks in the period. Not enough data to recommend a change.`,
    };
  }

  const rank = signal.organicRank;
  const strongOrganic = rank !== null && rank <= settings.maxRankForReduce && signal.organicClicks > 0;

  if (strongOrganic) {
    const caps = signal.isBrand ? settings.maxCut.brand : settings.maxCut.nonBrand;
    // Positions 2 and 3 keep far fewer clicks than position 1, so the cut is halved.
    const cut = Math.round(caps[effectivePressure] * (rank! <= 1.5 ? 1 : 0.5) * 100) / 100;

    if (cut <= 0) {
      return {
        ...base,
        action: 'HOLD',
        reason: `Brand term at organic position ${rankText(rank!)} with ${pressureText[pressure]} (${pct(signal.rankLostShare || 0)} of impressions lost to ad rank). Keep spend to defend the brand.`,
      };
    }

    const clicksRemoved = signal.paidClicks * cut;
    const recoveryLow = recovery * settings.conservativeFactor;
    const cvr = signal.paidClicks > 0 ? signal.paidConversions / signal.paidClicks : 0;
    const atRisk: Range = { low: clicksRemoved * (1 - recovery), high: clicksRemoved * (1 - recoveryLow) };

    return {
      ...base,
      action: 'REDUCE',
      risk: effectivePressure,
      changePct: -cut,
      suggestedSpend: signal.cost * (1 - cut),
      spendCut: signal.cost * cut,
      clicksRecovered: { low: clicksRemoved * recoveryLow, high: clicksRemoved * recovery },
      clicksAtRisk: atRisk,
      conversionsAtRisk: { low: atRisk.low * cvr, high: atRisk.high * cvr },
      reason: `Organic position ${rankText(rank!)}${signal.isBrand ? ', brand term' : ''}, ${pressureText[pressure]}. Cut ${pct(cut)} and keep ${pct(1 - cut)} as a defensive floor. Test in steps and watch total clicks (paid + organic).`,
    };
  }

  const weakOrganic = rank === null || rank > settings.minRankForIncrease;
  if (weakOrganic && signal.paidConversions > 0) {
    const efficient = benchmarkCpa === null || (cpa !== null && cpa <= benchmarkCpa);
    if (efficient && signal.rankLostShare === null) {
      return {
        ...base,
        action: 'HOLD',
        reason: `Paid is the only real presence here (${rank === null ? 'no organic ranking' : `organic position ${rankText(rank)}`}) and it converts, but impression share is not available, so room to grow cannot be measured.`,
      };
    }
    if (efficient && signal.rankLostShare !== null && signal.rankLostShare >= settings.minRankLostForIncrease) {
      return {
        ...base,
        action: 'INCREASE',
        changePct: settings.increaseStep,
        suggestedSpend: signal.cost * (1 + settings.increaseStep),
        reason: `${rank === null ? 'No organic ranking' : `Organic position ${rankText(rank)}`}, so paid is the only real presence. It converts at or below the account average cost per conversion, and ${pct(signal.rankLostShare)} of impressions are lost to ad rank. Raise ${pct(settings.increaseStep)} and review.`,
      };
    }
    if (!efficient) {
      return {
        ...base,
        action: 'HOLD',
        reason: `Paid is the only real presence here, but its cost per conversion is above the account average. Fix efficiency before adding budget.`,
      };
    }
    return {
      ...base,
      action: 'HOLD',
      reason: `Paid is the only real presence here and already captures most available impressions (${pct(signal.rankLostShare || 0)} lost to ad rank). No room to grow by raising bids.`,
    };
  }

  if (rank !== null && rank <= settings.minRankForIncrease) {
    return {
      ...base,
      action: 'HOLD',
      reason: rank <= settings.maxRankForReduce
        ? `Organic position ${rankText(rank)} but no organic clicks recorded in the period. Keep paid until organic proves it gets the click.`
        : `Organic position ${rankText(rank)} is not strong enough to replace paid clicks. Keep spend; this is an SEO opportunity first.`,
    };
  }

  return {
    ...base,
    action: 'HOLD',
    reason: `Paid is the only real presence here and it has no conversions in the period. Review the keyword before changing budget.`,
  };
};

export const recommendKeywords = (
  signals: KeywordSignal[],
  settings: RecommendationSettings = DEFAULT_SETTINGS
): KeywordRecommendation[] => {
  const totalCost = signals.reduce((sum, s) => sum + s.cost, 0);
  const totalConversions = signals.reduce((sum, s) => sum + s.paidConversions, 0);
  const benchmarkCpa = totalConversions > 0 ? totalCost / totalConversions : null;
  return signals.map(s => recommendKeyword(s, benchmarkCpa, settings));
};

export interface RecommendationSummary {
  spendAnalysed: number;
  spendCut: number; // for the selected period
  spendCutMonthly: number; // projected to 30 days
  spendCutShare: number; // of spend analysed
  clicksRecovered: Range;
  clicksAtRisk: Range;
  conversionsAtRisk: Range;
  spendToIncrease: number; // extra spend proposed on INCREASE keywords
  counts: Record<RecAction, number>;
}

export const summarizeRecommendations = (recs: KeywordRecommendation[], periodDays: number): RecommendationSummary => {
  const days = periodDays > 0 ? periodDays : 30;
  const summary: RecommendationSummary = {
    spendAnalysed: 0,
    spendCut: 0,
    spendCutMonthly: 0,
    spendCutShare: 0,
    clicksRecovered: { low: 0, high: 0 },
    clicksAtRisk: { low: 0, high: 0 },
    conversionsAtRisk: { low: 0, high: 0 },
    spendToIncrease: 0,
    counts: { REDUCE: 0, HOLD: 0, INCREASE: 0, NO_DATA: 0 },
  };
  recs.forEach(r => {
    summary.spendAnalysed += r.currentSpend;
    summary.counts[r.action] += 1;
    summary.spendCut += r.spendCut;
    summary.clicksRecovered.low += r.clicksRecovered.low;
    summary.clicksRecovered.high += r.clicksRecovered.high;
    summary.clicksAtRisk.low += r.clicksAtRisk.low;
    summary.clicksAtRisk.high += r.clicksAtRisk.high;
    summary.conversionsAtRisk.low += r.conversionsAtRisk.low;
    summary.conversionsAtRisk.high += r.conversionsAtRisk.high;
    if (r.action === 'INCREASE') summary.spendToIncrease += r.suggestedSpend - r.currentSpend;
  });
  summary.spendCutMonthly = (summary.spendCut * 30) / days;
  summary.spendCutShare = summary.spendAnalysed > 0 ? summary.spendCut / summary.spendAnalysed : 0;
  return summary;
};

// Combines impression share figures from several rows of the same keyword
// (ad groups, match types, accounts). Shares cannot be averaged directly:
// each row is weighted by its eligible impressions (impressions / share).
export interface ShareRow {
  impressions: number;
  impressionShare: number | null;
  rankLostShare: number | null;
  topImpressionShare: number | null;
}

export const combineShares = (rows: ShareRow[]): { impressionShare: number | null; rankLostShare: number | null; topImpressionShare: number | null } => {
  let eligible = 0;
  let impressions = 0;
  let lost = 0;
  let lostEligible = 0;
  let top = 0;
  let topEligible = 0;
  rows.forEach(r => {
    if (r.impressionShare === null || !(r.impressionShare > 0) || !(r.impressions > 0)) return;
    const rowEligible = r.impressions / r.impressionShare;
    eligible += rowEligible;
    impressions += r.impressions;
    if (r.rankLostShare !== null) {
      lost += r.rankLostShare * rowEligible;
      lostEligible += rowEligible;
    }
    if (r.topImpressionShare !== null) {
      top += r.topImpressionShare * rowEligible;
      topEligible += rowEligible;
    }
  });
  return {
    impressionShare: eligible > 0 ? Math.min(1, impressions / eligible) : null,
    rankLostShare: lostEligible > 0 ? lost / lostEligible : null,
    topImpressionShare: topEligible > 0 ? top / topEligible : null,
  };
};

// Recommendations for the keywords in scope: brand flag from the client's brand
// regex, then the Branded / Non-Branded filter of the dashboard.
export const buildRecommendations = (
  signals: KeywordSignal[],
  isBranded: ((text: string) => boolean) | undefined,
  queryType: 'All' | 'Branded' | 'Non-Branded',
  periodDays: number,
  settings: RecommendationSettings = DEFAULT_SETTINGS
): { recommendations: KeywordRecommendation[]; summary: RecommendationSummary } => {
  const scoped = signals
    .map(k => ({ ...k, isBrand: isBranded ? isBranded(k.keyword) : k.isBrand }))
    .filter(k => queryType === 'All' || (queryType === 'Branded' ? k.isBrand : !k.isBrand));
  const recommendations = recommendKeywords(scoped, settings);
  return { recommendations, summary: summarizeRecommendations(recommendations, periodDays) };
};
