// Saved reports per client: build one from what is on screen, read and write them,
// and say what changed between two of them. See server/snapshots.js.

import type { KeywordRecommendation, RecommendationSummary, RecommendationOverrides, RecAction, Pressure, Range } from './recommendations';

// Bump when the rules of the model change, so an old report is not compared as if nothing had changed.
export const MODEL_VERSION = '2026-11';

export interface SnapshotRow {
  keyword: string;
  action: RecAction;
  isBrand: boolean;
  currentSpend: number;
  suggestedSpend: number;
  organicRank: number | null;
  pressure: Pressure;
}

export interface SnapshotSummary {
  spendAnalysed: number;
  spendCut: number;
  spendCutMonthly: number;
  spendToIncrease: number;
  netChange: number;
  extraConversions: number;
  judgedKeywords: number;
  clicksAtRisk: Range;
  clicksRecovered: Range;
  counts: Record<RecAction, number>;
}

export interface SnapshotInput {
  periodStart: string;
  periodEnd: string;
  periodDays: number;
  currencySymbol: string;
  modelVersion: string;
  rules: RecommendationOverrides;
  summary: SnapshotSummary;
  recommendations: SnapshotRow[];
  warnings: string[];
}

export interface SnapshotHeader extends Omit<SnapshotInput, 'recommendations'> {
  id: string;
  clientId: string;
  keywords: number;
  savedBy?: string;
  savedAt?: string;
}

export interface Snapshot extends SnapshotInput {
  id: string;
  clientId: string;
  savedBy?: string;
  savedAt?: string;
}

export const snapshotIdOf = (periodStart: string, periodEnd: string) => `${periodStart}_${periodEnd}`;

const MAX_ROWS = 1500;

export const buildSnapshot = (args: {
  periodStart: string;
  periodEnd: string;
  periodDays: number;
  currencySymbol: string;
  rules: RecommendationOverrides | undefined;
  summary: RecommendationSummary;
  recommendations: KeywordRecommendation[];
  warnings: string[];
}): SnapshotInput => {
  const s = args.summary;
  // Keywords with too few clicks carry no decision; the largest spenders go first if there are too many.
  const rows = args.recommendations
    .filter(r => r.action !== 'NO_DATA')
    .sort((a, b) => b.currentSpend - a.currentSpend)
    .slice(0, MAX_ROWS)
    .map(r => ({
      keyword: r.keyword,
      action: r.action,
      isBrand: r.isBrand,
      currentSpend: Math.round(r.currentSpend * 100) / 100,
      suggestedSpend: Math.round(r.suggestedSpend * 100) / 100,
      organicRank: r.organicRank === null ? null : Math.round(r.organicRank * 10) / 10,
      pressure: r.pressure,
    }));
  return {
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    periodDays: args.periodDays,
    currencySymbol: args.currencySymbol,
    modelVersion: MODEL_VERSION,
    rules: args.rules || {},
    summary: {
      spendAnalysed: s.spendAnalysed,
      spendCut: s.spendCut,
      spendCutMonthly: s.spendCutMonthly,
      spendToIncrease: s.spendToIncrease,
      netChange: s.netChange,
      extraConversions: s.extraConversions,
      judgedKeywords: s.judgedKeywords,
      clicksAtRisk: s.clicksAtRisk,
      clicksRecovered: s.clicksRecovered,
      counts: s.counts,
    },
    recommendations: rows,
    warnings: args.warnings,
  };
};

// ---- What changed between two reports ----

export interface KeywordMove {
  keyword: string;
  from: RecAction | 'ABSENT';
  to: RecAction | 'ABSENT';
  organicRankBefore: number | null;
  organicRankNow: number | null;
  why: string;
}

export interface SnapshotDiff {
  previousPeriod: string; // "2026-09-01 to 2026-09-30"
  spendCutMonthlyBefore: number;
  spendCutMonthlyNow: number;
  reduceBefore: number;
  reduceNow: number;
  increaseBefore: number;
  increaseNow: number;
  leftReduce: KeywordMove[]; // were "reduce", no longer are
  joinedReduce: KeywordMove[];
  leftIncrease: KeywordMove[];
  joinedIncrease: KeywordMove[];
  // True when the comparison is not like for like.
  rulesChanged: boolean;
  modelChanged: boolean;
}

const rankText = (rank: number | null) => (rank === null ? 'no organic data' : `position ${rank.toFixed(1)}`);

const explain = (before: SnapshotRow | undefined, now: SnapshotRow | undefined, list: 'REDUCE' | 'INCREASE', joined: boolean): string => {
  if (!now) return 'no longer among the paid keywords analysed';
  if (!before) return 'new among the paid keywords analysed';
  if (before.organicRank !== now.organicRank) {
    const lostTop = list === 'REDUCE' && !joined;
    return `organic went from ${rankText(before.organicRank)} to ${rankText(now.organicRank)}${lostTop ? ', so it no longer holds the top' : ''}`;
  }
  if (before.pressure !== now.pressure) return `auction pressure went from ${before.pressure} to ${now.pressure}`;
  if (before.isBrand !== now.isBrand) return now.isBrand ? 'now counted as a brand term' : 'no longer counted as a brand term';
  return 'clicks or conversions in the period changed';
};

export const diffSnapshots = (previous: Snapshot, current: SnapshotInput): SnapshotDiff => {
  const before = new Map(previous.recommendations.map(r => [r.keyword, r]));
  const now = new Map(current.recommendations.map(r => [r.keyword, r]));

  const moves = (list: 'REDUCE' | 'INCREASE') => {
    const left: KeywordMove[] = [];
    const joined: KeywordMove[] = [];
    before.forEach((b, keyword) => {
      if (b.action !== list) return;
      const n = now.get(keyword);
      if (n?.action === list) return;
      left.push({ keyword, from: list, to: n ? n.action : 'ABSENT', organicRankBefore: b.organicRank, organicRankNow: n ? n.organicRank : null, why: explain(b, n, list, false) });
    });
    now.forEach((n, keyword) => {
      if (n.action !== list) return;
      const b = before.get(keyword);
      if (b?.action === list) return;
      joined.push({ keyword, from: b ? b.action : 'ABSENT', to: list, organicRankBefore: b ? b.organicRank : null, organicRankNow: n.organicRank, why: explain(b, n, list, true) });
    });
    const bySpend = (m: KeywordMove) => (now.get(m.keyword)?.currentSpend ?? before.get(m.keyword)?.currentSpend ?? 0);
    return { left: left.sort((a, b) => bySpend(b) - bySpend(a)), joined: joined.sort((a, b) => bySpend(b) - bySpend(a)) };
  };

  const reduce = moves('REDUCE');
  const increase = moves('INCREASE');
  return {
    previousPeriod: `${previous.periodStart} to ${previous.periodEnd}`,
    spendCutMonthlyBefore: previous.summary.spendCutMonthly,
    spendCutMonthlyNow: current.summary.spendCutMonthly,
    reduceBefore: previous.summary.counts.REDUCE,
    reduceNow: current.summary.counts.REDUCE,
    increaseBefore: previous.summary.counts.INCREASE,
    increaseNow: current.summary.counts.INCREASE,
    leftReduce: reduce.left,
    joinedReduce: reduce.joined,
    leftIncrease: increase.left,
    joinedIncrease: increase.joined,
    rulesChanged: JSON.stringify(previous.rules || {}) !== JSON.stringify(current.rules || {}),
    modelChanged: (previous.modelVersion || '') !== current.modelVersion,
  };
};

// ---- API ----

const isJson = (resp: Response) => (resp.headers.get('content-type') || '').includes('application/json');
const fail = async (resp: Response, fallback: string) => {
  const body = isJson(resp) ? await resp.json().catch(() => ({})) : {};
  return new Error(body?.error || `${fallback} (status ${resp.status}).`);
};
const base = (clientId: string) => `/api/clients/${encodeURIComponent(clientId)}/snapshots`;

export const fetchSnapshotList = async (clientId: string): Promise<{ available: boolean; snapshots: SnapshotHeader[] }> => {
  try {
    const resp = await fetch(base(clientId), { headers: { Accept: 'application/json' } });
    if (!resp.ok || !isJson(resp)) return { available: false, snapshots: [] };
    const body = await resp.json();
    return { available: body?.available === true, snapshots: Array.isArray(body?.snapshots) ? body.snapshots : [] };
  } catch {
    return { available: false, snapshots: [] };
  }
};

export const fetchSnapshot = async (clientId: string, snapshotId: string): Promise<Snapshot> => {
  const resp = await fetch(`${base(clientId)}/${encodeURIComponent(snapshotId)}`, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw await fail(resp, 'The report could not be read');
  return (await resp.json()).snapshot as Snapshot;
};

export const saveSnapshotRemote = async (clientId: string, snapshot: SnapshotInput): Promise<SnapshotHeader> => {
  const resp = await fetch(`${base(clientId)}/${encodeURIComponent(snapshotIdOf(snapshot.periodStart, snapshot.periodEnd))}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
  });
  if (!resp.ok) throw await fail(resp, 'The report could not be saved');
  return (await resp.json()).snapshot as SnapshotHeader;
};

export const deleteSnapshotRemote = async (clientId: string, snapshotId: string): Promise<void> => {
  const resp = await fetch(`${base(clientId)}/${encodeURIComponent(snapshotId)}`, { method: 'DELETE' });
  if (!resp.ok) throw await fail(resp, 'The report could not be deleted');
};
