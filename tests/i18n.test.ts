import { describe, it, expect } from 'vitest';
import { translate, formatNumber, reasonText, isLang } from '../i18n';
import { recommendKeyword, buildRecommendations, type KeywordSignal } from '../recommendations';

const signal = (over: Partial<KeywordSignal> = {}): KeywordSignal => ({
  keyword: 'running shoes', isBrand: false, cost: 1000, paidClicks: 500, paidImpressions: 10000, paidConversions: 25,
  impressionShare: 0.8, rankLostShare: 0.05, topImpressionShare: 0.6, organicRank: 1.2, organicClicks: 900, organicImpressions: 4000, ...over,
});

describe('translate', () => {
  it('returns the English text as written, with its figures filled in', () => {
    expect(translate('en', 'And {n} more in the keyword plan.', { n: 3 })).toBe('And 3 more in the keyword plan.');
  });

  it('uses the Spanish text when there is one', () => {
    expect(translate('es', 'Reduce here first')).toBe('Reducir primero aquí');
    expect(translate('es', 'And {n} more in the keyword plan.', { n: 3 })).toBe('Y 3 más en el plan por keyword.');
  });

  it('falls back to English for a text with no translation, instead of showing nothing', () => {
    expect(translate('es', 'A sentence nobody translated yet')).toBe('A sentence nobody translated yet');
  });

  it('leaves a placeholder visible when its value is missing', () => {
    expect(translate('en', 'Top {n}', {})).toBe('Top {n}');
  });

  it('only accepts known languages', () => {
    expect(isLang('es')).toBe(true);
    expect(isLang('fr')).toBe(false);
    expect(isLang(undefined)).toBe(false);
  });
});

describe('formatNumber', () => {
  it('writes thousands the way each language does', () => {
    expect(formatNumber('en', 45991)).toBe('45,991');
    expect(formatNumber('es', 45991)).toBe('45.991');
    // Spanish would not group four digits by default; in a report it should.
    expect(formatNumber('es', 4521)).toBe('4.521');
    expect(formatNumber('es', 0.67, 2)).toBe('0,67');
    expect(formatNumber('en', 0.67, 2)).toBe('0.67');
  });
});

describe('reasonText', () => {
  it('keeps the English sentence of the model for English', () => {
    const r = recommendKeyword(signal(), 40);
    expect(reasonText('en', r)).toBe(r.reason);
  });

  it('writes a reduction in Spanish with the same figures', () => {
    const text = reasonText('es', recommendKeyword(signal(), 40));
    expect(text).toMatch(/Posición orgánica 1,2/);
    expect(text).toMatch(/presión baja en la subasta/);
    expect(text).toMatch(/Recortar un 50% y mantener el 50% como mínimo/);
  });

  it('marks brand terms and translates the pressure level', () => {
    const text = reasonText('es', recommendKeyword(signal({ isBrand: true, rankLostShare: 0.15 }), 40));
    expect(text).toMatch(/Posición orgánica 1,2, marca, presión media/);
  });

  it('has a Spanish sentence for every case the model can produce', () => {
    const cases: KeywordSignal[] = [
      signal(),
      signal({ paidClicks: 3, cost: 5 }),
      signal({ isBrand: true, rankLostShare: 0.5 }),
      signal({ organicRank: null, organicClicks: 0, organicImpressions: 0 }),
      signal({ organicRank: 14, rankLostShare: null }),
      signal({ organicRank: 14, rankLostShare: 0.4 }),
      signal({ organicRank: 14, rankLostShare: 0.4, paidConversions: 2 }),
      signal({ organicRank: 14, rankLostShare: 0.02 }),
      signal({ organicClicks: 2 }),
      signal({ organicRank: 6 }),
      signal({ organicRank: 14, paidConversions: 0 }),
    ];
    const codes = new Set<string>();
    cases.forEach(c => {
      const r = recommendKeyword(c, 40);
      expect(r.why, r.reason).not.toBeNull();
      codes.add(r.why!.code);
      const es = reasonText('es', r);
      expect(es, r.why!.code).not.toBe(r.reason);
      expect(es, r.why!.code).not.toMatch(/\{\w+\}/);
    });
    expect(codes.size).toBe(11);
  });

  it('translates "do not reduce" with the note', () => {
    const { recommendations } = buildRecommendations([signal()], undefined, 'All', 30, undefined, new Map([['running shoes', 'Legal']]));
    expect(reasonText('es', recommendations[0])).toBe('Marcada como "no reducir" para este cliente: Legal. El modelo habría propuesto un recorte del 50%.');
  });
});
