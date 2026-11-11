// The pictures of the Spend recommendations page.
//
// One encoding everywhere, so it is learned once:
//   solid orange   paid spend that stays
//   hatched teal   paid spend that can come down (an estimate, hence the hatch)
//   solid violet   paid spend added
//   solid blue     clicks that still arrive through the organic result
//   hatched blue   clicks that could go either way
//   dashed outline clicks that may be lost
// Hatch and dashes carry the meaning without colour, so the page reads in greyscale print.
// The colours that share a chart were checked for colour-blind separation.
//
// Plain HTML bars, not a chart library: few marks, direct labels, and they reflow on paper.

import React, { useMemo, useState } from 'react';
import { ShieldCheck, FlaskConical, ChevronRight } from 'lucide-react';
import { KeywordRecommendation, RecommendationSummary, RecommendationSettings, DEFAULT_SETTINGS } from '../recommendations';
import { Plan, planKeyOf, countPlan, PLAN_STATUS_LABEL } from '../plan';
import type { KeywordResult } from '../planResults';
import { SERIES } from '../theme';
import { useI18n } from '../i18n';
import { PressureBadge } from './KeywordRecommendations';

const DOWN = '#0D9488';
const ADDED = '#6D28D9';
const STAYS = SERIES.paid;
const ORGANIC = SERIES.organic;
const INK = '#141414';

const hatch = (color: string, ground: string): React.CSSProperties => ({
  backgroundImage: `repeating-linear-gradient(135deg, ${color} 0 2px, ${ground} 2px 7px)`,
  border: `1.5px solid ${color}`,
});
const FILL = {
  stays: { backgroundColor: STAYS } as React.CSSProperties,
  untouched: { backgroundColor: STAYS, opacity: 0.45 } as React.CSSProperties,
  down: hatch(DOWN, '#CCFBF1'),
  added: { backgroundColor: ADDED } as React.CSSProperties,
  notJudged: { backgroundColor: '#fff', border: `1.5px dashed ${STAYS}` } as React.CSSProperties,
  organic: { backgroundColor: ORGANIC } as React.CSSProperties,
  either: hatch(ORGANIC, '#fff'),
  lost: { backgroundColor: '#fff', border: `1.5px dashed ${INK}` } as React.CSSProperties,
};

const Swatch: React.FC<{ style: React.CSSProperties }> = ({ style }) => (
  <span className="inline-block w-3.5 h-3.5 rounded-sm flex-shrink-0 align-middle" style={style} aria-hidden="true" />
);

// A segment of a horizontal bar. Width follows its value; a non-zero value never disappears.
const Seg: React.FC<{ value: number; style: React.CSSProperties; title: string; minWidth?: number; children?: React.ReactNode }> = ({ value, style, title, minWidth = 4, children }) =>
  value > 0 ? (
    <div className="h-full rounded-[3px] flex items-center justify-center overflow-hidden" style={{ flexGrow: value, flexBasis: 0, minWidth, ...style }} title={title}>
      {children}
    </div>
  ) : null;

const cardClass = 'bg-white p-6 md:p-8 rounded-2xl border border-slate-200 break-inside-avoid';

interface Shared {
  recommendations: KeywordRecommendation[];
  summary: RecommendationSummary;
  settings?: RecommendationSettings;
  currencySymbol: string;
  periodDays: number;
}

// ---------------------------------------------------------------------
// 1. The answer: how much can come down, and what stays
// ---------------------------------------------------------------------
export const MoneyMoves: React.FC<Shared> = ({ summary, currencySymbol, periodDays }) => {
  const i18n = useI18n();
  const { tr, pct } = i18n;
  const money = (v: number) => i18n.money(currencySymbol, v);

  const down = summary.spendCut;
  const staysOnReduced = Math.max(0, summary.reduceSpend - summary.spendCut);
  const untouched = Math.max(0, summary.spendAnalysed - summary.reduceSpend);
  const added = summary.spendToIncrease;
  const hasReduce = summary.counts.REDUCE > 0;
  const hasIncrease = summary.counts.INCREASE > 0;
  const suggested = summary.spendAnalysed - summary.netChange;

  const legend: { style: React.CSSProperties; label: string; value: string; note?: string }[] = [];
  if (hasReduce) {
    legend.push({ style: FILL.down, label: tr('Can come down'), value: `−${money(down)}`, note: tr('{share} of the keyword spend analysed', { share: pct(summary.spendCutShare) }) });
    legend.push({
      style: FILL.stays,
      label: tr('Stays on the keywords we reduce'),
      value: money(staysOnReduced),
      note: tr('{share} of what they spend today always stays', { share: pct(summary.reduceSpend > 0 ? staysOnReduced / summary.reduceSpend : 1) }),
    });
  }
  legend.push({ style: FILL.untouched, label: tr('All other keywords'), value: money(untouched) });
  if (hasIncrease) legend.push({ style: FILL.added, label: tr('Added where organic is beyond page one'), value: `+${money(added)}`, note: i18n.keywords(summary.counts.INCREASE) });

  return (
    <section className="grid grid-cols-12 rounded-2xl overflow-hidden border border-slate-200 break-inside-avoid" aria-labelledby="money-moves">
      <div className="col-span-12 lg:col-span-4 bg-black text-white p-8 flex flex-col justify-center">
        <p id="money-moves" className="text-[11px] font-semibold uppercase tracking-wide text-[#F8B133]">{tr('Paid search spend that can come down')}</p>
        {hasReduce ? (
          <>
            <p className="jf-figure text-5xl xl:text-6xl text-[#F8B133] mt-3 tabular-nums">{tr('about {amount}', { amount: money(summary.spendCutMonthly) })}</p>
            <p className="text-sm font-semibold text-white mt-1">{tr('a month')}</p>
            <p className="text-sm text-slate-300 mt-3">{tr('{share} of the keyword spend analysed, on {keywords}.', { share: pct(summary.spendCutShare), keywords: i18n.keywords(summary.counts.REDUCE) })}</p>
          </>
        ) : (
          <p className="jf-display text-3xl mt-3">{tr('No paid spend should come down in this period.')}</p>
        )}
      </div>

      <div className="col-span-12 lg:col-span-8 bg-white p-6 md:p-8">
        <h3 className="jf-display text-xl text-slate-900">{tr('Where your paid search spend goes')}</h3>
        <p className="text-xs font-medium text-slate-600 mt-0.5">
          {tr('Keyword spend analysed in these {n} days: {now} today, {suggested} suggested.', { n: periodDays, now: money(summary.spendAnalysed), suggested: money(suggested) })}
        </p>

        <div className="mt-5 h-12 flex gap-[2px]" role="img" aria-label={legend.map(l => `${l.label}: ${l.value}`).join('. ')}>
          <Seg value={down} style={FILL.down} title={`${tr('Can come down')}: ${money(down)}`} minWidth={10} />
          <Seg value={staysOnReduced} style={FILL.stays} title={`${tr('Stays on the keywords we reduce')}: ${money(staysOnReduced)}`} minWidth={10}>
            <ShieldCheck size={18} color={INK} aria-hidden="true" />
          </Seg>
          <Seg value={untouched} style={FILL.untouched} title={`${tr('All other keywords')}: ${money(untouched)}`} />
          <Seg value={added} style={FILL.added} title={`${tr('Added where organic is beyond page one')}: ${money(added)}`} minWidth={10} />
        </div>

        <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {legend.map(item => (
            <li key={item.label}>
              <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-700"><Swatch style={item.style} /> {item.label}</p>
              <p className="jf-figure text-3xl text-slate-900 tabular-nums mt-0.5">{item.value}</p>
              {item.note && <p className="text-xs font-medium text-slate-600">{item.note}</p>}
            </li>
          ))}
        </ul>

        {(hasReduce || hasIncrease) && (
          <p className="mt-4 pt-4 border-t border-slate-100 text-sm font-medium text-slate-700">
            {summary.netChange >= 0
              ? tr('Net effect: {amount} less paid spend in a period like this one.', { amount: money(summary.netChange) })
              : tr('Net effect: {amount} more paid spend in a period like this one, because the keywords that need more take more than the saving.', { amount: money(-summary.netChange) })}
          </p>
        )}
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------
// The two things that cannot be drawn
// ---------------------------------------------------------------------
export const RuleAndCaveat: React.FC = () => {
  const { tr } = useI18n();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <p className="flex items-start gap-3 bg-white px-5 py-4 rounded-2xl border border-slate-200 text-sm font-medium text-slate-700 break-inside-avoid">
        <ShieldCheck size={20} className="text-slate-900 flex-shrink-0 mt-0.5" aria-hidden="true" />
        {tr('No keyword goes to zero. On every keyword we reduce, part of the spend stays, so another advertiser cannot take your place at the top of the page.')}
      </p>
      <p className="flex items-start gap-3 bg-white px-5 py-4 rounded-2xl border border-slate-200 text-sm font-medium text-slate-700 break-inside-avoid">
        <FlaskConical size={20} className="text-slate-900 flex-shrink-0 mt-0.5" aria-hidden="true" />
        {tr('These are estimates, shown as ranges, to design a test. They are not a forecast. Striped bars are estimates; solid bars are figures from your accounts.')}
      </p>
    </div>
  );
};

// ---------------------------------------------------------------------
// 2. What the saving may cost in clicks
// ---------------------------------------------------------------------
export const ClicksPrice: React.FC<Shared> = ({ summary, currencySymbol }) => {
  const i18n = useI18n();
  const { tr, int, pct, range } = i18n;
  const money2 = (v: number) => i18n.money(currencySymbol, v, 2);

  const still = summary.clicksRecovered.low;
  const either = Math.max(0, summary.clicksRecovered.high - summary.clicksRecovered.low);
  const lost = summary.clicksAtRisk.low;
  const allSearch = summary.reducePaidClicks + summary.reduceOrganicClicks;

  return (
    <section className={cardClass} aria-labelledby="clicks-price">
      <h3 id="clicks-price" className="jf-display text-xl text-slate-900">{tr('What the saving may cost in clicks')}</h3>
      {summary.counts.REDUCE === 0 ? (
        <p className="text-sm text-slate-600 mt-4">{tr('Shown when there are keywords to reduce.')}</p>
      ) : (
        <>
          <p className="text-xs font-medium text-slate-600 mt-0.5">{tr('Of the paid clicks removed by the reductions.')}</p>

          <div className="mt-5 flex justify-between items-end gap-4">
            <div>
              <p className="text-[13px] font-semibold text-slate-700">{tr('Still arrive through your organic result')}</p>
              <p className="jf-figure text-3xl text-slate-900 tabular-nums">{range(summary.clicksRecovered)}</p>
            </div>
            <div className="text-right">
              <p className="text-[13px] font-semibold text-slate-700">{tr('May be lost')}</p>
              <p className="jf-figure text-3xl text-slate-900 tabular-nums">{range(summary.clicksAtRisk)}</p>
            </div>
          </div>

          <div className="mt-2 h-10 flex gap-[2px]" role="img" aria-label={tr('Still arrive: {a}. May be lost: {b}.', { a: range(summary.clicksRecovered), b: range(summary.clicksAtRisk) })}>
            <Seg value={still} style={FILL.organic} title={`${tr('Still arrive, at least')}: ${int(still)}`} />
            <Seg value={either} style={FILL.either} title={`${tr('Could go either way')}: ${int(either)}`} />
            <Seg value={lost} style={FILL.lost} title={`${tr('May be lost, at least')}: ${int(lost)}`} />
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs font-medium text-slate-600">
            <li className="flex items-center gap-1.5"><Swatch style={FILL.organic} /> {tr('Still arrive, at least')}</li>
            {either > 0 && <li className="flex items-center gap-1.5"><Swatch style={FILL.either} /> {tr('Could go either way')}</li>}
            <li className="flex items-center gap-1.5"><Swatch style={FILL.lost} /> {tr('May be lost, at least')}</li>
          </ul>

          {summary.lossShareOfSearch && allSearch > 0 && (
            <div className="mt-5">
              <p className="text-sm font-medium text-slate-700">
                {pct(summary.lossShareOfSearch.low) === pct(summary.lossShareOfSearch.high)
                  ? tr('That is about {share} of all the clicks these keywords get from Google, paid and organic together.', { share: pct(summary.lossShareOfSearch.high) })
                  : tr('That is {low} to {high} of all the clicks these keywords get from Google, paid and organic together.', { low: pct(summary.lossShareOfSearch.low), high: pct(summary.lossShareOfSearch.high) })}
                {summary.conversionsAtRisk.high >= 0.5 ? ` ${tr('In conversions: {range}.', { range: range(summary.conversionsAtRisk) })}` : ''}
              </p>
              <div className="mt-2 h-3 flex gap-[2px]" aria-hidden="true">
                <div className="h-full rounded-[3px] bg-slate-200" style={{ flexGrow: Math.max(0, allSearch - summary.clicksAtRisk.high), flexBasis: 0 }} />
                <div className="h-full rounded-[3px]" style={{ flexGrow: summary.clicksAtRisk.high, flexBasis: 0, minWidth: 6, ...FILL.lost }} />
              </div>
            </div>
          )}

          {summary.addedClickCost && summary.nominalCpc !== null && (
            <p className="mt-4 pt-4 border-t border-slate-100 text-xs font-medium text-slate-600">
              {tr('An ad click on these keywords looks like it costs {cpc}. Counting only the clicks you would not get anyway, each one costs {low} to {high}.', {
                cpc: money2(summary.nominalCpc), low: money2(summary.addedClickCost.low), high: money2(summary.addedClickCost.high),
              })}
            </p>
          )}
        </>
      )}
    </section>
  );
};

// ---------------------------------------------------------------------
// 3. Why these keywords: spend by organic position
// ---------------------------------------------------------------------
export const PositionBands: React.FC<Shared> = ({ recommendations, settings = DEFAULT_SETTINGS, currencySymbol }) => {
  const i18n = useI18n();
  const { tr } = i18n;
  const money = (v: number) => i18n.money(currencySymbol, v);
  const top = settings.maxRankForReduce;
  const far = settings.minRankForIncrease;

  const bands = useMemo(() => {
    const defs = [
      { key: 'p1', label: tr('Position 1'), note: tr('organic holds the top: paid can come down') },
      { key: 'top', label: tr('Positions 2 to {n}', { n: top }), note: tr('organic holds the top: paid can come down') },
      { key: 'mid', label: tr('Positions {a} to {b}', { a: top + 1, b: far }), note: tr('not strong enough to replace paid: keep') },
      { key: 'far', label: tr('Beyond page one'), note: tr('paid is the only presence: add where it converts') },
      { key: 'none', label: tr('No organic result found'), note: tr('cannot be compared: keep') },
    ].map(d => ({ ...d, stays: 0, notJudged: 0, down: 0, added: 0, today: 0, count: 0, reduce: 0, increase: 0 }));
    const byKey = Object.fromEntries(defs.map(d => [d.key, d]));
    recommendations.forEach(r => {
      // The position the model judged: from the search terms when they decide, else the keyword's own.
      const judged = r.action === 'REDUCE' && typeof r.why?.params.rank === 'number' ? (r.why.params.rank as number) : r.organicRank;
      const band = judged === null ? byKey.none : judged <= 1.5 ? byKey.p1 : judged <= top ? byKey.top : judged <= far ? byKey.mid : byKey.far;
      band.count += 1;
      band.today += r.currentSpend;
      if (r.action === 'NO_DATA') band.notJudged += r.currentSpend;
      else if (r.action === 'REDUCE') { band.stays += r.suggestedSpend; band.down += r.spendCut; band.reduce += 1; }
      else if (r.action === 'INCREASE') { band.stays += r.currentSpend; band.added += r.suggestedSpend - r.currentSpend; band.increase += 1; }
      else band.stays += r.currentSpend;
    });
    return defs;
  }, [recommendations, top, far, i18n.lang]);

  const max = Math.max(1, ...bands.map(b => b.today + b.added));

  return (
    <section className={cardClass} aria-labelledby="position-bands">
      <h3 id="position-bands" className="jf-display text-xl text-slate-900">{tr('Why these keywords')}</h3>
      <p className="text-xs font-medium text-slate-600 mt-0.5">{tr('Paid spend by where your organic result ranks. Reductions sit where organic already holds the top.')}</p>

      <ul className="mt-5 space-y-4">
        {bands.map(b => (
          <li key={b.key} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] gap-x-4 gap-y-1 items-center">
            <div>
              <p className="text-[13px] font-semibold text-slate-900">{b.label}</p>
              <p className="text-xs text-slate-600">{b.note}</p>
            </div>
            <div>
              <div className="h-[18px] flex gap-[2px]" style={{ width: `${Math.max(b.count > 0 ? 3 : 0, ((b.today + b.added) / max) * 100)}%` }}>
                <Seg value={b.stays} style={FILL.stays} title={`${tr('Stays')}: ${money(b.stays)}`} />
                <Seg value={b.notJudged} style={FILL.notJudged} title={`${tr('Too few clicks to judge')}: ${money(b.notJudged)}`} />
                <Seg value={b.down} style={FILL.down} title={`${tr('Can come down')}: ${money(b.down)}`} />
                <Seg value={b.added} style={FILL.added} title={`${tr('Added')}: ${money(b.added)}`} />
              </div>
              <p className="mt-1 text-xs font-medium text-slate-600 tabular-nums">
                {b.count === 0 ? '—' : <>
                  {money(b.today)} · {i18n.keywords(b.count)}
                  {b.reduce > 0 && <span className="font-semibold" style={{ color: '#0F766E' }}> · {tr('{n} to reduce', { n: b.reduce })} (−{money(b.down)})</span>}
                  {b.increase > 0 && <span className="font-semibold" style={{ color: ADDED }}> · {tr('{n} to increase', { n: b.increase })} (+{money(b.added)})</span>}
                </>}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-xs font-medium text-slate-600">
        <li className="flex items-center gap-1.5"><Swatch style={FILL.stays} /> {tr('Stays')}</li>
        <li className="flex items-center gap-1.5"><Swatch style={FILL.down} /> {tr('Can come down')}</li>
        <li className="flex items-center gap-1.5"><Swatch style={FILL.added} /> {tr('Added')}</li>
        <li className="flex items-center gap-1.5"><Swatch style={FILL.notJudged} /> {tr('Too few clicks to judge')}</li>
      </ul>
      <p className="mt-3 text-xs text-slate-600">{tr('Orange in the top bands is spend we keep on purpose: brand terms, pressure in the auction, or too few organic clicks.')}</p>
    </section>
  );
};

// ---------------------------------------------------------------------
// 4. Keyword by keyword: now, suggested, and the minimum that stays
// ---------------------------------------------------------------------
const PRESSURE_ORDER: Record<string, number> = { low: 0, medium: 1, unknown: 2, high: 3 };

export const KeywordBars: React.FC<Shared & { plan?: Plan; planResults?: Record<string, KeywordResult> }> = ({ recommendations, summary, currencySymbol, periodDays, plan, planResults }) => {
  const i18n = useI18n();
  const { tr, dec, range, int } = i18n;
  const money = (v: number) => i18n.money(currencySymbol, v);
  const [order, setOrder] = useState<'safest' | 'largest'>('safest');

  const reduceAll = useMemo(() => {
    const rows = recommendations.filter(r => r.action === 'REDUCE');
    return rows.sort((a, b) =>
      order === 'safest'
        ? (PRESSURE_ORDER[a.pressure] - PRESSURE_ORDER[b.pressure]) || (b.spendCut - a.spendCut)
        : b.spendCut - a.spendCut);
  }, [recommendations, order]);
  const increaseAll = useMemo(
    () => recommendations.filter(r => r.action === 'INCREASE').sort((a, b) => (b.suggestedSpend - b.currentSpend) - (a.suggestedSpend - a.currentSpend)),
    [recommendations]);

  const reduce = reduceAll.slice(0, 8);
  const increase = increaseAll.slice(0, 4);
  if (reduce.length === 0 && increase.length === 0) return null;

  const max = Math.max(1, ...[...reduce, ...increase].map(r => Math.max(r.currentSpend, r.suggestedSpend)));
  const shownCut = reduce.reduce((sum, r) => sum + r.spendCut, 0);

  const row = (r: KeywordRecommendation) => {
    const isReduce = r.action === 'REDUCE';
    const stays = isReduce ? r.suggestedSpend : r.currentSpend;
    const change = Math.abs(r.suggestedSpend - r.currentSpend);
    const item = plan?.[planKeyOf(r.keyword)];
    const result = planResults?.[planKeyOf(r.keyword)];
    const keep = r.currentSpend > 0 ? r.suggestedSpend / r.currentSpend : 1;
    const rank = isReduce && typeof r.why?.params.rank === 'number' ? (r.why.params.rank as number) : r.organicRank;
    return (
      <li key={r.keyword} className="py-3 grid grid-cols-1 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,13rem)] gap-x-5 gap-y-2 items-center border-b border-slate-100 last:border-0 break-inside-avoid">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 break-words">
            {r.keyword}
            {r.isBrand && <span className="ml-2 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 align-middle">{tr('Brand')}</span>}
          </p>
          <p className="text-xs text-slate-600 mt-0.5">
            {tr('Organic position {rank}', { rank: rank === null ? '—' : dec(rank, 1) })}
            {isReduce ? ` · ${tr('may lose {clicks} clicks', { clicks: range(r.clicksAtRisk) })}` : ''}
          </p>
          {item && (item.status !== 'none' || item.doNotReduce) && (
            <p className="text-xs font-semibold text-slate-700 mt-1">
              {item.status !== 'none' ? `${tr(PLAN_STATUS_LABEL[item.status])}${item.appliedOn ? tr(' on {date}', { date: item.appliedOn }) : ''}` : tr('Do not reduce')}
              {result && result.totalChange !== null && result.verdict !== 'noData' && result.verdict !== 'noSpendChange' ? ` · ${tr('total clicks {change}', { change: `${result.totalChange > 0 ? '+' : ''}${Math.round(result.totalChange * 100)}%` })}` : ''}
            </p>
          )}
        </div>

        <div className="min-w-0">
          <div className="h-5 flex gap-[2px] border-l border-slate-400" style={{ width: `${Math.max(6, (Math.max(r.currentSpend, r.suggestedSpend) / max) * 100)}%` }}>
            <Seg value={stays} style={FILL.stays} title={`${tr('Stays')}: ${money(stays)}`} minWidth={8}>
              {isReduce && (stays / max) > 0.24 && <span className="px-1 text-xs font-bold whitespace-nowrap" style={{ color: INK }}>{tr('{share} stays', { share: `${Math.round(keep * 100)}%` })}</span>}
            </Seg>
            <Seg value={change} style={isReduce ? FILL.down : FILL.added} title={`${isReduce ? tr('Can come down') : tr('Added')}: ${money(change)}`} minWidth={4} />
          </div>
        </div>

        <div className="lg:text-right flex lg:block items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-900 tabular-nums whitespace-nowrap">{money(r.currentSpend)} → {money(r.suggestedSpend)}</p>
            <p className="text-xs font-semibold tabular-nums" style={{ color: isReduce ? '#0F766E' : ADDED }}>
              {isReduce
                ? tr('{change} · saves {amount}', { change: `−${Math.round(-r.changePct * 100)}%`, amount: money(r.spendCut) })
                : `+${money(change)}${r.expectedExtraConversions && r.expectedExtraConversions >= 0.5 ? tr(' · about {n} more conversions', { n: int(r.expectedExtraConversions) }) : ''}`}
            </p>
          </div>
          <div className="lg:mt-1"><PressureBadge pressure={r.pressure} impressionShare={r.impressionShare} rankLostShare={r.rankLostShare} /></div>
        </div>
      </li>
    );
  };

  return (
    <section className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200" aria-labelledby="keyword-bars">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
        <div>
          <h3 id="keyword-bars" className="jf-display text-xl text-slate-900">{tr('Start here')}</h3>
          <p className="text-xs font-medium text-slate-600 mt-0.5">
            {tr('Spend now, the suggested level, and the part that always stays. Amounts for these {n} days.', { n: periodDays })}
            {reduce.length > 1 && summary.spendCut > 0 ? ` ${tr('These {n} keywords make up {share} of the saving.', { n: reduce.length, share: `${Math.round((shownCut / summary.spendCut) * 100)}%` })}` : ''}
          </p>
        </div>
        {reduceAll.length > 1 && (
          <div className="print:hidden flex rounded-lg border border-slate-200 bg-white p-0.5 flex-shrink-0" role="group" aria-label={tr('Order')}>
            {(['safest', 'largest'] as const).map(key => (
              <button
                key={key}
                type="button"
                aria-pressed={order === key}
                onClick={() => setOrder(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${order === key ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                {key === 'safest' ? tr('Safest first') : tr('Largest saving first')}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="hidden print:block text-xs text-slate-600 mt-1">{order === 'safest' ? tr('Ordered with the safest reductions first.') : tr('Ordered with the largest savings first.')}</p>

      {reduce.length > 0 && (
        <>
          <h4 className="mt-5 text-[13px] font-bold uppercase tracking-wide" style={{ color: '#0F766E' }}>{tr('Reduce')}</h4>
          <ul>{reduce.map(row)}</ul>
          {reduceAll.length > reduce.length && (
            <p className="mt-2 text-xs font-medium text-slate-600">
              {tr('And {n} more in the table below: {amount} more can come down.', { n: reduceAll.length - reduce.length, amount: money(summary.spendCut - shownCut) })}
            </p>
          )}
        </>
      )}

      {increase.length > 0 && (
        <>
          <h4 className="mt-6 text-[13px] font-bold uppercase tracking-wide" style={{ color: ADDED }}>{tr('Add budget here')}</h4>
          <ul>{increase.map(row)}</ul>
          {increaseAll.length > increase.length && <p className="mt-2 text-xs font-medium text-slate-600">{tr('And {n} more in the table below.', { n: increaseAll.length - increase.length })}</p>}
        </>
      )}
    </section>
  );
};

// ---------------------------------------------------------------------
// 5. From plan to result
// ---------------------------------------------------------------------
export const PlanProgress: React.FC<{
  summary: RecommendationSummary;
  plan?: Plan;
  planResults?: Record<string, KeywordResult>;
  planShared?: boolean;
  onMeasure?: () => void;
  isMeasuring?: boolean;
  measureNote?: string | null;
  presentation?: boolean;
}> = ({ summary, plan, planResults = {}, planShared, onMeasure, isMeasuring, measureNote, presentation }) => {
  const { tr } = useI18n();
  if (!plan) return null;
  const counts = countPlan(plan);
  const hasEntries = Object.keys(plan).length > 0;
  if (!hasEntries && presentation) return null;

  const proposed = summary.counts.REDUCE + summary.counts.INCREASE;
  const results = Object.values(planResults);
  const verdict = (key: KeywordResult['verdict']) => results.filter(r => r.verdict === key).length;
  const measured = verdict('held') + verdict('smallDrop') + verdict('drop');
  const agreed = counts.agreed + counts.applied;
  // The plan can hold keywords the current filter hides, so the scale is the larger of the two.
  const scale = Math.max(proposed, agreed);
  const steps = [
    { label: tr('Proposed'), value: proposed },
    { label: tr('Agreed with the client'), value: agreed },
    { label: tr('Applied in Google Ads'), value: counts.applied },
    { label: tr('Measured'), value: measured },
  ];

  return (
    <section className={cardClass} aria-labelledby="plan-progress">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
        <div>
          <h3 id="plan-progress" className="jf-display text-xl text-slate-900">{tr('From plan to result')}</h3>
          <p className="text-xs font-medium text-slate-600 mt-0.5">
            {hasEntries
              ? tr('What was agreed with the client, what has been applied, and what was measured afterwards.')
              : tr('Nothing recorded yet. Use the last column of the table to note what was agreed with the client and when it was applied.')}
            {!presentation && <span className="print:hidden"> {planShared ? tr('Shared with the team.') : tr('Saved in this browser only.')}</span>}
          </p>
        </div>
        {onMeasure && !presentation && counts.applied > 0 && (
          <button type="button" onClick={onMeasure} disabled={isMeasuring} className="print:hidden px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-700 disabled:opacity-50 flex-shrink-0">
            {isMeasuring ? tr('Measuring…') : tr('Measure applied changes')}
          </button>
        )}
      </div>

      {hasEntries && (
        <>
          <ol className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            {steps.map((step, i) => (
              <li key={step.label} className="relative">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{step.label}</p>
                <p className="jf-figure text-4xl text-slate-900 tabular-nums">{step.value}</p>
                <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
                  <div className="h-full rounded-full" style={{ width: `${scale > 0 ? Math.min(100, (step.value / scale) * 100) : 0}%`, backgroundColor: INK }} />
                </div>
                {i < steps.length - 1 && <ChevronRight size={18} className="hidden md:block absolute -right-3 top-6 text-slate-300" aria-hidden="true" />}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs font-medium text-slate-600">
            {measured > 0 && <>
              <span className="font-semibold text-[#047857]">{tr('{n} held', { n: verdict('held') })}</span>{' · '}
              <span className="font-semibold text-[#B45309]">{tr('{n} small drop', { n: verdict('smallDrop') })}</span>{' · '}
              <span className="font-semibold text-[#B91C1C]">{tr('{n} fell', { n: verdict('drop') })}</span>{' · '}
            </>}
            {tr('{reverted} reverted · {held} marked do not reduce', { reverted: counts.reverted, held: counts.doNotReduce })}
          </p>
        </>
      )}
      {measureNote && <p className="mt-3 text-xs text-slate-600">{measureNote}</p>}
    </section>
  );
};

// ---------------------------------------------------------------------
// The searches behind one keyword (inside the table)
// ---------------------------------------------------------------------
export const SearchTermsBar: React.FC<{ rec: KeywordRecommendation; settings?: RecommendationSettings }> = ({ rec, settings = DEFAULT_SETTINGS }) => {
  const { tr, dec } = useI18n();
  const cover = rec.searchTerms;
  if (!cover || cover.terms.length === 0) return null;
  const won = cover.coverage * cover.topOrganicShare;
  const depends = cover.coverage * (1 - cover.topOrganicShare);
  const hidden = Math.max(0, 1 - cover.coverage);
  const barTitle = tr('{share} of its spend is on searches where you rank in the top {n}', { share: `${Math.round(won * 100)}%`, n: settings.maxRankForReduce });
  return (
    <span className="block mt-2" title={barTitle}>
      <span className="block text-xs font-medium text-slate-600">
        {cover.coverage < settings.minTermCoverage
          ? tr('Only {share} of its spend is visible as searches, so the keyword text decides.', { share: `${Math.round(cover.coverage * 100)}%` })
          : tr('Searches behind it. Blue: you already rank in the top {n}.', { n: settings.maxRankForReduce })}
      </span>
      <span className="mt-1 h-2.5 w-full max-w-[240px] flex gap-[2px]" aria-hidden="true">
        {won > 0 && <span className="h-full rounded-[2px]" style={{ flexGrow: won, flexBasis: 0, minWidth: 3, ...FILL.organic }} />}
        {depends > 0 && <span className="h-full rounded-[2px]" style={{ flexGrow: depends, flexBasis: 0, minWidth: 3, ...FILL.stays }} />}
        {hidden > 0.01 && <span className="h-full rounded-[2px]" style={{ flexGrow: hidden, flexBasis: 0, minWidth: 3, backgroundColor: '#fff', border: '1px dashed #9E9E9E' }} />}
      </span>
      {cover.terms.slice(0, 3).map(t => {
        const isWon = t.organicRank !== null && t.organicRank <= settings.maxRankForReduce && t.organicClicks >= settings.minOrganicClicks;
        return (
          <span key={t.term} className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={isWon ? { backgroundColor: ORGANIC } : { border: `2px solid ${STAYS}` }} aria-hidden="true" />
            <span className="break-words">{t.term}</span>
            <span className="text-slate-500 whitespace-nowrap">· {t.organicRank === null ? tr('no organic data') : tr('position {rank}', { rank: dec(t.organicRank, 1) })}</span>
          </span>
        );
      })}
    </span>
  );
};
