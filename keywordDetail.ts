// One keyword, week by week: paid spend and clicks from Google Ads, organic clicks and position
// from Search Console. Loaded on demand for the keyword the analyst opens.
//
// Weeks are blocks of seven days counted back from the last day, so every block is complete.

import { LAG_DAYS } from './planResults';

export const DETAIL_WEEKS = 12;

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

export interface DetailDay {
  date: string;
  paidCost: number;
  paidClicks: number;
  organicClicks: number;
  organicImpressions: number;
  positionSum: number; // position x impressions, so days and queries average correctly
}

export const emptyDay = (date: string): DetailDay => ({ date, paidCost: 0, paidClicks: 0, organicClicks: 0, organicImpressions: 0, positionSum: 0 });

export interface DetailWeek {
  start: string;
  end: string;
  paidCost: number;
  paidClicks: number;
  organicClicks: number;
  organicPosition: number | null; // null when the result was not shown that week
}

// The weeks to load: they end on the last day of the selected period, or on the last day
// Search Console has complete, whichever is earlier.
export const detailRange = (periodEnd: string, today: string, weeks = DETAIL_WEEKS): { start: string; end: string } => {
  const lastComplete = addDays(today, -LAG_DAYS);
  const end = periodEnd < lastComplete ? periodEnd : lastComplete;
  return { start: addDays(end, -(weeks * 7 - 1)), end };
};

export const toWeeks = (days: DetailDay[], range: { start: string; end: string }): DetailWeek[] => {
  const weeks: (DetailWeek & { impressions: number; positionSum: number })[] = [];
  for (let start = range.start; start <= range.end; start = addDays(start, 7)) {
    weeks.push({ start, end: addDays(start, 6), paidCost: 0, paidClicks: 0, organicClicks: 0, organicPosition: null, impressions: 0, positionSum: 0 });
  }
  days.forEach(day => {
    if (day.date < range.start || day.date > range.end) return;
    const index = Math.floor((toDate(day.date).getTime() - toDate(range.start).getTime()) / 86400000 / 7 + 1e-6);
    const week = weeks[index];
    if (!week) return;
    week.paidCost += day.paidCost;
    week.paidClicks += day.paidClicks;
    week.organicClicks += day.organicClicks;
    week.impressions += day.organicImpressions;
    week.positionSum += day.positionSum;
  });
  return weeks.map(({ impressions, positionSum, ...week }) => ({ ...week, organicPosition: impressions > 0 ? positionSum / impressions : null }));
};

// The week a date falls in, or -1.
export const weekIndexOf = (weeks: DetailWeek[], date: string | null | undefined): number =>
  date ? weeks.findIndex(week => date >= week.start && date <= week.end) : -1;

export interface DetailSummary {
  // First and last four weeks, to say in words which way things moved.
  spendChange: number | null; // -0.2 = spend down 20%
  totalClicksChange: number | null;
  positionFirst: number | null;
  positionLast: number | null;
}

export const summarizeWeeks = (weeks: DetailWeek[]): DetailSummary => {
  const span = Math.min(4, Math.floor(weeks.length / 2));
  const first = weeks.slice(0, span);
  const last = weeks.slice(weeks.length - span);
  const sum = (list: DetailWeek[], pick: (w: DetailWeek) => number) => list.reduce((total, w) => total + pick(w), 0);
  const change = (pick: (w: DetailWeek) => number) => {
    const before = sum(first, pick);
    return before > 0 ? (sum(last, pick) - before) / before : null;
  };
  const position = (list: DetailWeek[]) => {
    const seen = list.filter(w => w.organicPosition !== null);
    return seen.length > 0 ? seen.reduce((total, w) => total + (w.organicPosition as number), 0) / seen.length : null;
  };
  return {
    spendChange: change(w => w.paidCost),
    totalClicksChange: change(w => w.paidClicks + w.organicClicks),
    positionFirst: position(first),
    positionLast: position(last),
  };
};

// Sample weeks for the demo data: steady, with a small repeatable wobble per keyword.
export const sampleDetailDays = (
  keyword: string,
  perDay: { paidCost: number; paidClicks: number; organicClicks: number; organicImpressions: number; organicRank: number | null },
  range: { start: string; end: string }
): DetailDay[] => {
  let seed = 0;
  for (let i = 0; i < keyword.length; i++) seed = (seed * 31 + keyword.charCodeAt(i)) % 9973;
  const days: DetailDay[] = [];
  let n = 0;
  for (let date = range.start; date <= range.end; date = addDays(date, 1), n++) {
    const wobble = 1 + 0.18 * Math.sin((n + seed) / 5) + 0.08 * Math.sin((n * 3 + seed) / 2);
    const impressions = perDay.organicImpressions * wobble;
    const rank = perDay.organicRank === null ? null : Math.max(1, perDay.organicRank + 0.35 * Math.sin((n + seed) / 9));
    days.push({
      date,
      paidCost: perDay.paidCost * wobble,
      paidClicks: perDay.paidClicks * wobble,
      organicClicks: perDay.organicClicks * (2 - wobble),
      organicImpressions: rank === null ? 0 : impressions,
      positionSum: rank === null ? 0 : rank * impressions,
    });
  }
  return days;
};
