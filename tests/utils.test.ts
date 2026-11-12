import { describe, it, expect } from 'vitest';
import { normalizeUrl, extractPath, normalizeCountry, parseGoogleAdsMetric, aggregateData, formatDate, isOrganicSearch, isPaidSearch, withCurrency } from '../utils';
import type { DailyData } from '../types';

describe('normalizeUrl', () => {
  it('reduces GSC, GA4 and Google Ads URLs to the same key', () => {
    const expected = '/es/vuelos/roma';
    expect(normalizeUrl('https://www.example.com/es/vuelos/roma/')).toBe(expected);
    expect(normalizeUrl('/es/vuelos/roma?gclid=abc#top')).toBe(expected);
    expect(normalizeUrl('https://www.example.com/ES/Vuelos/Roma?utm_source=x')).toBe(expected);
    expect(normalizeUrl('https://www.example.com/es/vuelos/roma{ignore}')).toBe(expected);
  });

  it('keeps the homepage and placeholders stable', () => {
    expect(normalizeUrl('https://www.example.com/')).toBe('/');
    expect(normalizeUrl('(not set)')).toBe('(not set)');
    expect(normalizeUrl('')).toBe('(not set)');
  });

  it('does not throw on malformed encoding', () => {
    expect(normalizeUrl('/promo/100%')).toBe('/promo/100%');
  });
});

describe('extractPath', () => {
  it('matches normalizeUrl on ordinary URLs', () => {
    const url = 'https://www.example.com/Category/Page/?a=1#b';
    expect(extractPath(url)).toBe(normalizeUrl(url));
  });
});

describe('normalizeCountry', () => {
  it('maps ISO codes and tidies names', () => {
    expect(normalizeCountry('es')).toBe('Spain');
    expect(normalizeCountry('GBR')).toBe('United Kingdom');
    expect(normalizeCountry('new caledonia')).toBe('New Caledonia');
    expect(normalizeCountry('')).toBe('Other');
  });
});

describe('parseGoogleAdsMetric', () => {
  it('reads numbers, strings and wrapped values', () => {
    expect(parseGoogleAdsMetric('12.5')).toBe(12.5);
    expect(parseGoogleAdsMetric({ value: '7' })).toBe(7);
    expect(parseGoogleAdsMetric(undefined)).toBe(0);
  });
});

describe('aggregateData', () => {
  const row = (label: 'current' | 'previous', sessions: number, sales: number, revenue: number): DailyData => ({
    date: '2026-01-01', channel: 'Organic Search', country: 'Spain', queryType: 'Non-Branded', landingPage: '/',
    dateRangeLabel: label, sessions, revenue, sales, conversionRate: 0, addToCarts: 0, checkouts: 0, clicks: 0, impressions: 0, ctr: 0,
  });

  it('sums each period and computes change and conversion rate', () => {
    const result = aggregateData([row('current', 200, 10, 1000), row('current', 100, 5, 500), row('previous', 150, 3, 750)]);
    expect(result.current.sessions).toBe(300);
    expect(result.current.cr).toBeCloseTo(5);
    expect(result.changes.sessions).toBeCloseTo(100);
    expect(result.abs.revenue).toBe(750);
  });

  it('returns 0% change when there is no previous period', () => {
    expect(aggregateData([row('current', 10, 1, 10)]).changes.sessions).toBe(0);
  });
});

describe('formatDate', () => {
  it('formats as YYYY-MM-DD in local time', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('isOrganicSearch / isPaidSearch', () => {
  it('keeps only the search channels of the default channel group', () => {
    expect(isOrganicSearch('Organic Search')).toBe(true);
    expect(isPaidSearch('Paid Search')).toBe(true);
    for (const other of ['Organic Social', 'Organic Shopping', 'Organic Video', 'Direct', 'Referral']) {
      expect(isOrganicSearch(other)).toBe(false);
    }
    for (const other of ['Paid Social', 'Paid Shopping', 'Paid Video', 'Paid Other', 'Cross-network', 'Display']) {
      expect(isPaidSearch(other)).toBe(false);
    }
  });

  it('ignores case and surrounding spaces', () => {
    expect(isOrganicSearch(' organic search ')).toBe(true);
    expect(isPaidSearch('PAID SEARCH')).toBe(true);
  });

  it('reads the medium when the dimension is medium or source / medium', () => {
    expect(isOrganicSearch('organic')).toBe(true);
    expect(isOrganicSearch('google / organic')).toBe(true);
    expect(isPaidSearch('cpc')).toBe(true);
    expect(isPaidSearch('bing / cpc')).toBe(true);
    expect(isPaidSearch('facebook / paid_social')).toBe(false);
    expect(isOrganicSearch('google / cpc')).toBe(false);
  });

  it('handles missing values', () => {
    expect(isOrganicSearch(undefined)).toBe(false);
    expect(isPaidSearch('')).toBe(false);
  });
});

describe('withCurrency', () => {
  it('puts the euro sign after the amount and keeps other currencies before it', () => {
    expect(withCurrency('€', '45,991')).toBe('45,991 €');
    expect(withCurrency('€', 45991)).toBe('45,991 €');
    expect(withCurrency('$', '45,991')).toBe('$45,991');
    expect(withCurrency('£', 12.5)).toBe('£12.5');
    expect(withCurrency('', '10')).toBe('10');
  });
});
