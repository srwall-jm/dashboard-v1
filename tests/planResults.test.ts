import { describe, it, expect } from 'vitest';
import { measurementWindow, measureKeyword, coveringRange, gaqlString, queryRegexBatches, type DailyPoint } from '../planResults';

const days = (start: string, n: number, paidClicks: number, paidCost: number, organicClicks: number): DailyPoint[] =>
  Array.from({ length: n }, (_, i) => {
    const [y, m, d] = start.split('-').map(Number);
    const date = new Date(y, m - 1, d + i);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { date: iso, paidClicks, paidCost, organicClicks };
  });

describe('measurementWindow', () => {
  it('takes the two weeks before the date and the two weeks from it', () => {
    const w = measurementWindow('2026-10-15', '2026-11-11');
    expect(w.before).toEqual({ start: '2026-10-01', end: '2026-10-14' });
    expect(w.after).toEqual({ start: '2026-10-15', end: '2026-10-28' });
    expect(w.readyOn).toBe('2026-10-31');
    expect(w.ready).toBe(true);
  });

  it('is not ready until the two weeks are complete in Search Console', () => {
    expect(measurementWindow('2026-11-01', '2026-11-11').ready).toBe(false);
    expect(measurementWindow('2026-11-01', '2026-11-16').ready).toBe(false);
    expect(measurementWindow('2026-11-01', '2026-11-17').ready).toBe(true);
  });

  it('crosses months and years', () => {
    const w = measurementWindow('2027-01-05', '2027-02-01');
    expect(w.before.start).toBe('2026-12-22');
    expect(w.after.end).toBe('2027-01-18');
  });
});

describe('measureKeyword', () => {
  const window = measurementWindow('2026-10-15', '2026-11-11');

  it('says clicks held when organic picked up what paid gave away', () => {
    const r = measureKeyword([...days('2026-10-01', 14, 100, 200, 300), ...days('2026-10-15', 14, 50, 100, 345)], window);
    expect(r.totalBefore).toBe(5600);
    expect(r.totalAfter).toBe(5530);
    expect(r.totalChange).toBeCloseTo(-0.0125);
    expect(r.spendChange).toBeCloseTo(-1400);
    // 700 paid clicks gone, 630 more organic
    expect(r.observedRecovery).toBeCloseTo(0.9);
    expect(r.verdict).toBe('held');
  });

  it('grades a drop by its size', () => {
    const small = measureKeyword([...days('2026-10-01', 14, 100, 200, 300), ...days('2026-10-15', 14, 50, 100, 310)], window);
    expect(small.totalChange).toBeCloseTo(-0.1);
    expect(small.verdict).toBe('smallDrop');
    const big = measureKeyword([...days('2026-10-01', 14, 100, 200, 300), ...days('2026-10-15', 14, 20, 40, 290)], window);
    expect(big.verdict).toBe('drop');
    expect(big.observedRecovery).toBe(0);
  });

  it('does not judge a keyword whose spend did not come down', () => {
    const r = measureKeyword([...days('2026-10-01', 14, 100, 200, 300), ...days('2026-10-15', 14, 98, 196, 250)], window);
    expect(r.verdict).toBe('noSpendChange');
  });

  it('reports no data, and ignores days outside the two windows', () => {
    expect(measureKeyword([], window).verdict).toBe('noData');
    const r = measureKeyword([...days('2026-09-01', 20, 999, 999, 999), ...days('2026-10-01', 14, 10, 20, 30), ...days('2026-10-15', 14, 5, 10, 34), ...days('2026-10-29', 10, 999, 999, 999)], window);
    expect(r.totalBefore).toBe(560);
    expect(r.totalAfter).toBe(546);
  });
});

describe('request helpers', () => {
  it('covers every window with one range', () => {
    expect(coveringRange([measurementWindow('2026-10-15', '2026-11-11'), measurementWindow('2026-09-20', '2026-11-11')]))
      .toEqual({ start: '2026-09-06', end: '2026-10-28' });
    expect(coveringRange([])).toBeNull();
  });

  it('quotes keyword text safely for a Google Ads query', () => {
    expect(gaqlString("women's shoes")).toBe("'women\\'s shoes'");
    expect(gaqlString('a\\b')).toBe("'a\\\\b'");
  });

  it('builds exact-match expressions for Search Console and splits long lists', () => {
    expect(queryRegexBatches(['Running Shoes', 'c++ course', 'running shoes'])).toEqual(['^(running shoes|c\\+\\+ course)$']);
    const many = Array.from({ length: 300 }, (_, i) => `keyword number ${i} with some length`);
    const batches = queryRegexBatches(many);
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.every(b => b.length <= 3100 && b.startsWith('^(') && b.endsWith(')$'))).toBe(true);
  });
});
