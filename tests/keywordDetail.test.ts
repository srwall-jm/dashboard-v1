import { describe, it, expect } from 'vitest';
import { detailRange, toWeeks, weekIndexOf, summarizeWeeks, sampleDetailDays, emptyDay, type DetailDay } from '../keywordDetail';

const day = (date: string, over: Partial<DetailDay> = {}): DetailDay => ({ ...emptyDay(date), ...over });

describe('detailRange', () => {
  it('ends on the last day of the period when Search Console already has it', () => {
    expect(detailRange('2026-10-31', '2026-11-12')).toEqual({ start: '2026-08-09', end: '2026-10-31' });
  });

  it('stops three days before today when the period runs to today', () => {
    expect(detailRange('2026-11-12', '2026-11-12', 2)).toEqual({ start: '2026-10-27', end: '2026-11-09' });
  });
});

describe('toWeeks', () => {
  const range = { start: '2026-10-01', end: '2026-10-14' };

  it('adds days into blocks of seven and averages position by impressions', () => {
    const weeks = toWeeks([
      day('2026-10-01', { paidCost: 10, paidClicks: 5, organicClicks: 20, organicImpressions: 100, positionSum: 100 }),
      day('2026-10-07', { paidCost: 30, paidClicks: 15, organicClicks: 10, organicImpressions: 300, positionSum: 900 }),
      day('2026-10-08', { paidCost: 7, paidClicks: 2 }),
      day('2026-09-30', { paidCost: 999 }),
      day('2026-10-15', { paidCost: 999 }),
    ], range);
    expect(weeks).toHaveLength(2);
    expect(weeks[0]).toMatchObject({ start: '2026-10-01', end: '2026-10-07', paidCost: 40, paidClicks: 20, organicClicks: 30 });
    expect(weeks[0].organicPosition).toBeCloseTo(2.5);
    expect(weeks[1]).toMatchObject({ start: '2026-10-08', end: '2026-10-14', paidCost: 7, organicPosition: null });
  });

  it('keeps the weeks in place across the autumn clock change', () => {
    const weeks = toWeeks([day('2026-10-26', { paidClicks: 1 })], { start: '2026-10-12', end: '2026-11-01' });
    expect(weeks.map(w => w.paidClicks)).toEqual([0, 0, 1]);
  });

  it('finds the week a change was applied in', () => {
    const weeks = toWeeks([], range);
    expect(weekIndexOf(weeks, '2026-10-09')).toBe(1);
    expect(weekIndexOf(weeks, '2026-11-01')).toBe(-1);
    expect(weekIndexOf(weeks, null)).toBe(-1);
  });
});

describe('summarizeWeeks', () => {
  it('compares the last four weeks with the first four', () => {
    const range = { start: '2026-08-09', end: '2026-10-31' };
    const days = toWeeks([], range).map((w, i) => day(w.start, {
      paidCost: i < 4 ? 100 : 50, paidClicks: i < 4 ? 50 : 25, organicClicks: i < 4 ? 50 : 70,
      organicImpressions: 100, positionSum: i < 4 ? 200 : 150,
    }));
    const s = summarizeWeeks(toWeeks(days, range));
    expect(s.spendChange).toBeCloseTo(-0.5);
    expect(s.totalClicksChange).toBeCloseTo(-0.05);
    expect(s.positionFirst).toBeCloseTo(2);
    expect(s.positionLast).toBeCloseTo(1.5);
  });

  it('gives no change when there was nothing at the start', () => {
    expect(summarizeWeeks(toWeeks([], { start: '2026-10-01', end: '2026-10-28' })).spendChange).toBeNull();
  });
});

describe('sampleDetailDays', () => {
  it('is repeatable and has no position without an organic result', () => {
    const range = { start: '2026-10-01', end: '2026-10-14' };
    const per = { paidCost: 10, paidClicks: 5, organicClicks: 8, organicImpressions: 50, organicRank: null };
    const a = sampleDetailDays('running shoes', per, range);
    expect(a).toEqual(sampleDetailDays('running shoes', per, range));
    expect(a).toHaveLength(14);
    expect(toWeeks(a, range)[0].organicPosition).toBeNull();
  });
});
