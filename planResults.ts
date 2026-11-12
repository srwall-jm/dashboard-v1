// What happened after a change was applied to a keyword: clicks in the two weeks before the
// date against the two weeks from it, paid and organic together.
//
// This is an observation, not proof of cause: seasonality, promotions and anything else that
// changed in those weeks are in the numbers too.

export const WINDOW_DAYS = 14;
// Search Console data arrives two to three days late; a window that ends later than this is not complete.
export const LAG_DAYS = 3;

const toDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const toIso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const addDays = (iso: string, days: number) => {
  const date = toDate(iso);
  date.setDate(date.getDate() + days);
  return toIso(date);
};

export interface MeasurementWindow {
  before: { start: string; end: string };
  after: { start: string; end: string };
  ready: boolean; // the "after" weeks are complete in every source
  readyOn: string; // first day on which they are
}

export const measurementWindow = (appliedOn: string, today: string): MeasurementWindow => {
  const afterEnd = addDays(appliedOn, WINDOW_DAYS - 1);
  const readyOn = addDays(afterEnd, LAG_DAYS);
  return {
    before: { start: addDays(appliedOn, -WINDOW_DAYS), end: addDays(appliedOn, -1) },
    after: { start: appliedOn, end: afterEnd },
    ready: today >= readyOn,
    readyOn,
  };
};

export interface DailyPoint {
  date: string;
  paidClicks: number;
  paidCost: number;
  organicClicks: number;
}

export type Verdict =
  | 'held' // total clicks stayed within 5%
  | 'smallDrop' // down between 5% and 15%
  | 'drop' // down more than 15%: consider going back one step
  | 'noSpendChange' // paid spend did not come down, so there is nothing to judge
  | 'noData';

export interface KeywordResult {
  window: MeasurementWindow;
  paidClicksBefore: number;
  paidClicksAfter: number;
  costBefore: number;
  costAfter: number;
  organicBefore: number;
  organicAfter: number;
  totalBefore: number;
  totalAfter: number;
  totalChange: number | null; // -0.04 = total clicks down 4%
  spendChange: number; // negative = saved in the two weeks
  // Of the paid clicks that went away, the share that came back through organic. Null when paid clicks did not fall.
  observedRecovery: number | null;
  verdict: Verdict;
}

export const measureKeyword = (points: DailyPoint[], window: MeasurementWindow): KeywordResult => {
  const sum = (range: { start: string; end: string }) =>
    points
      .filter(p => p.date >= range.start && p.date <= range.end)
      .reduce((acc, p) => ({ paid: acc.paid + p.paidClicks, cost: acc.cost + p.paidCost, organic: acc.organic + p.organicClicks }), { paid: 0, cost: 0, organic: 0 });
  const before = sum(window.before);
  const after = sum(window.after);
  const totalBefore = before.paid + before.organic;
  const totalAfter = after.paid + after.organic;
  const totalChange = totalBefore > 0 ? (totalAfter - totalBefore) / totalBefore : null;
  const paidRemoved = before.paid - after.paid;

  let verdict: Verdict;
  if (totalBefore === 0 && totalAfter === 0) verdict = 'noData';
  else if (before.cost <= 0 || after.cost > before.cost * 0.9) verdict = 'noSpendChange';
  else if (totalChange === null || totalChange >= -0.05) verdict = 'held';
  else if (totalChange >= -0.15) verdict = 'smallDrop';
  else verdict = 'drop';

  return {
    window,
    paidClicksBefore: before.paid,
    paidClicksAfter: after.paid,
    costBefore: before.cost,
    costAfter: after.cost,
    organicBefore: before.organic,
    organicAfter: after.organic,
    totalBefore,
    totalAfter,
    totalChange,
    spendChange: after.cost - before.cost,
    observedRecovery: paidRemoved > 0 ? Math.max(0, Math.min(1, (after.organic - before.organic) / paidRemoved)) : null,
    verdict,
  };
};

// The earliest and latest day needed to measure a set of applied dates.
export const coveringRange = (windows: MeasurementWindow[]): { start: string; end: string } | null => {
  if (windows.length === 0) return null;
  return {
    start: windows.map(w => w.before.start).sort()[0],
    end: windows.map(w => w.after.end).sort().reverse()[0],
  };
};

// ---- helpers for the two requests ----

// A string literal for a Google Ads query.
export const gaqlString = (value: string) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

// Search Console filters by regular expression (RE2). Queries are grouped so each expression stays short.
const escapeRe2 = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const queryRegexBatches = (queries: string[], maxLength = 3000): string[] => {
  const batches: string[] = [];
  let current: string[] = [];
  let length = 0;
  Array.from(new Set(queries.map(q => q.trim().toLowerCase()).filter(Boolean))).forEach(query => {
    const escaped = escapeRe2(query);
    if (current.length > 0 && length + escaped.length + 1 > maxLength) {
      batches.push(`^(${current.join('|')})$`);
      current = [];
      length = 0;
    }
    current.push(escaped);
    length += escaped.length + 1;
  });
  if (current.length > 0) batches.push(`^(${current.join('|')})$`);
  return batches;
};

export const todayIso = () => toIso(new Date());
