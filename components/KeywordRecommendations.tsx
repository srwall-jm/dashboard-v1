import React, { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, HelpCircle, FileText, Search, ChevronDown, ChevronUp, ArrowDown, ArrowUp } from 'lucide-react';
import {
  KeywordRecommendation, RecommendationSummary, RecAction, Range, DEFAULT_SETTINGS, RecommendationSettings, isDefaultSettings,
} from '../recommendations';
import { ACTION_STYLE, PRESSURE_STYLE, PRESSURE_HELP } from '../theme';
import { exportToCSV } from '../utils';

const ACTION_ICON: Record<RecAction, React.ReactNode> = {
  REDUCE: <ArrowDownRight size={13} aria-hidden="true" />,
  INCREASE: <ArrowUpRight size={13} aria-hidden="true" />,
  HOLD: <Minus size={13} aria-hidden="true" />,
  NO_DATA: <HelpCircle size={13} aria-hidden="true" />,
};

const int = (value: number) => Math.round(value).toLocaleString('en-US');
const range = (r: Range) => (Math.round(r.low) === Math.round(r.high) ? int(r.low) : `${int(r.low)} to ${int(r.high)}`);
const pct = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)}%`);

type Filter = RecAction | 'ALL';
type SortKey = 'impact' | 'keyword' | 'organicRank' | 'currentSpend' | 'suggestedSpend';
const PAGE = 25;

// Three small bars, so pressure levels still read in greyscale print.
export const PressureBadge: React.FC<{ pressure: KeywordRecommendation['pressure']; impressionShare?: number | null; rankLostShare?: number | null }> = ({ pressure, impressionShare, rankLostShare }) => {
  const style = PRESSURE_STYLE[pressure];
  const detail = rankLostShare !== null && rankLostShare !== undefined
    ? ` Your ad is missing from ${pct(rankLostShare)} of searches because competitors outrank it.`
    : impressionShare !== null && impressionShare !== undefined ? ` Your ad shows on ${pct(impressionShare)} of searches.` : '';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap ${style.badge}`} title={`${PRESSURE_HELP}${detail}`}>
      <span className="inline-flex items-end gap-px" aria-hidden="true">
        {[1, 2, 3].map(n => (
          <span key={n} className={`w-1 rounded-sm ${n <= style.bars ? 'bg-current' : 'bg-current opacity-25'}`} style={{ height: 4 + n * 2 }} />
        ))}
      </span>
      {style.label}
    </span>
  );
};

const effectText = (r: KeywordRecommendation, money: (v: number) => string): string => {
  if (r.action === 'REDUCE') return `May lose ${range(r.clicksAtRisk)} clicks`;
  if (r.action === 'INCREASE') {
    const extra = r.suggestedSpend - r.currentSpend;
    return r.expectedExtraConversions && r.expectedExtraConversions >= 0.5
      ? `+${money(extra)} · about ${int(r.expectedExtraConversions)} more conversions`
      : `+${money(extra)}`;
  }
  return '—';
};

const RecTable: React.FC<{
  rows: KeywordRecommendation[];
  money: (v: number) => string;
  sort?: { key: SortKey; dir: 'asc' | 'desc' };
  onSort?: (key: SortKey) => void;
  caption?: string;
}> = ({ rows, money, sort, onSort, caption }) => {
  const header = (label: string, key: SortKey | null, align: 'left' | 'right' = 'left') => {
    const active = Boolean(sort && key && sort.key === key);
    return (
      <th
        scope="col"
        aria-sort={key && onSort ? (active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
        className={`py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 ${align === 'right' ? 'text-right' : 'text-left'}`}
      >
        {key && onSort ? (
          <button type="button" onClick={() => onSort(key)} className="inline-flex items-center gap-1 uppercase tracking-wide rounded focus-visible:outline-none focus-visible:ring-2 ring-slate-900/30 hover:text-slate-900">
            {label}
            {active && (sort!.dir === 'asc' ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)}
          </button>
        ) : label}
      </th>
    );
  };

  return (
    <table className="w-full text-left min-w-[960px]">
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead>
        <tr className="border-b border-slate-200">
          {header('Keyword', 'keyword')}
          {header('Action', null)}
          {header('Organic position', 'organicRank', 'right')}
          {header('Spend now', 'currentSpend', 'right')}
          {header('Suggested', 'suggestedSpend', 'right')}
          {header('Expected effect', 'impact')}
          {header('Competitor pressure', null)}
          {header('Why', null)}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => {
          const style = ACTION_STYLE[r.action];
          return (
            <tr key={r.keyword} className="border-b border-slate-100 align-top">
              <td className="py-3 px-3 text-[13px] font-semibold text-slate-900 max-w-[220px]">
                <span className="break-words">{r.keyword}</span>
                {r.isBrand && <span className="ml-2 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600">Brand</span>}
              </td>
              <td className="py-3 px-3">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap ${style.badge}`}>
                  {ACTION_ICON[r.action]} {style.label}{r.changePct !== 0 ? ` ${r.changePct > 0 ? '+' : ''}${Math.round(r.changePct * 100)}%` : ''}
                </span>
              </td>
              <td className="py-3 px-3 text-[13px] font-medium text-slate-700 text-right tabular-nums">{r.organicRank === null ? '—' : r.organicRank.toFixed(1)}</td>
              <td className="py-3 px-3 text-[13px] font-medium text-slate-700 text-right tabular-nums">{money(r.currentSpend)}</td>
              <td className="py-3 px-3 text-[13px] font-bold text-slate-900 text-right tabular-nums">{r.changePct === 0 ? '—' : money(r.suggestedSpend)}</td>
              <td className="py-3 px-3 text-[13px] font-medium text-slate-700 tabular-nums">{effectText(r, money)}</td>
              <td className="py-3 px-3"><PressureBadge pressure={r.pressure} impressionShare={r.impressionShare} rankLostShare={r.rankLostShare} /></td>
              <td className="py-3 px-3 text-xs text-slate-600 max-w-[320px]">{r.reason}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

const Card: React.FC<{ label: string; value: string; note: React.ReactNode }> = ({ label, value, note }) => (
  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 break-inside-avoid">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{label}</p>
    <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{value}</p>
    <p className="text-xs font-medium text-slate-600 mt-1">{note}</p>
  </div>
);

export const KeywordRecommendations: React.FC<{
  recommendations: KeywordRecommendation[];
  summary: RecommendationSummary;
  settings?: RecommendationSettings;
  currencySymbol: string;
  periodDays: number;
  periodLabel?: string;
  clientName?: string;
  isLoading?: boolean;
  // Client view: no controls, the two tables a client needs, assumptions open.
  presentation?: boolean;
}> = ({ recommendations, summary, settings, currencySymbol, periodDays, periodLabel, clientName, isLoading, presentation = false }) => {
  const [filter, setFilter] = useState<Filter>('REDUCE');
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(PAGE);
  const [showMethod, setShowMethod] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'impact', dir: 'desc' });

  const money = (value: number) => `${currencySymbol}${int(value)}`;
  const money2 = (value: number) => `${currencySymbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // "Impact" puts the biggest money move first, whether it is a cut or a raise.
  const impactOf = (r: KeywordRecommendation) => Math.abs(r.suggestedSpend - r.currentSpend);
  const sorted = (list: KeywordRecommendation[], by = sort) => {
    const dir = by.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (by.key === 'keyword') return a.keyword.localeCompare(b.keyword) * dir;
      if (by.key === 'organicRank') {
        if (a.organicRank === null) return 1;
        if (b.organicRank === null) return -1;
        return (a.organicRank - b.organicRank) * dir;
      }
      const value = (r: KeywordRecommendation) => (by.key === 'impact' ? impactOf(r) : by.key === 'suggestedSpend' ? r.suggestedSpend : r.currentSpend);
      return (value(a) - value(b)) * dir || (b.currentSpend - a.currentSpend);
    });
  };

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sorted(recommendations.filter(r => (filter === 'ALL' || r.action === filter) && (!term || r.keyword.toLowerCase().includes(term))));
  }, [recommendations, filter, search, sort]);

  const reduceRows = useMemo(() => sorted(recommendations.filter(r => r.action === 'REDUCE'), { key: 'impact', dir: 'desc' }), [recommendations]);
  const increaseRows = useMemo(() => sorted(recommendations.filter(r => r.action === 'INCREASE'), { key: 'impact', dir: 'desc' }), [recommendations]);

  const handleSort = (key: SortKey) =>
    setSort(prev => (prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: key === 'keyword' || key === 'organicRank' ? 'asc' : 'desc' }));

  const handleExport = () => {
    exportToCSV(rows.map(r => ({
      Keyword: r.keyword,
      Brand: r.isBrand ? 'Yes' : 'No',
      Action: ACTION_STYLE[r.action].label,
      'Organic position': r.organicRank === null ? '' : r.organicRank.toFixed(1),
      'Organic clicks': r.organicClicks,
      'Paid clicks': r.paidClicks,
      'Current spend': r.currentSpend.toFixed(2),
      'Suggested spend': r.suggestedSpend.toFixed(2),
      'Change %': Math.round(r.changePct * 100),
      'Spend cut': r.spendCut.toFixed(2),
      'Clicks that still arrive (low)': Math.round(r.clicksRecovered.low),
      'Clicks that still arrive (high)': Math.round(r.clicksRecovered.high),
      'Clicks you may lose (low)': Math.round(r.clicksAtRisk.low),
      'Clicks you may lose (high)': Math.round(r.clicksAtRisk.high),
      'Expected extra conversions': r.expectedExtraConversions === null ? '' : r.expectedExtraConversions.toFixed(1),
      'Ad shown on % of searches': r.impressionShare === null ? '' : Math.round(r.impressionShare * 100),
      'Searches missed to competitors %': r.rankLostShare === null ? '' : Math.round(r.rankLostShare * 100),
      'Competitor pressure': r.pressure,
      Why: r.reason,
    })), 'Keyword_Recommendations');
  };

  const chips: { key: Filter; label: string; count: number }[] = [
    { key: 'REDUCE', label: ACTION_STYLE.REDUCE.label, count: summary.counts.REDUCE },
    { key: 'INCREASE', label: ACTION_STYLE.INCREASE.label, count: summary.counts.INCREASE },
    { key: 'HOLD', label: ACTION_STYLE.HOLD.label, count: summary.counts.HOLD },
    { key: 'NO_DATA', label: ACTION_STYLE.NO_DATA.label, count: summary.counts.NO_DATA },
    { key: 'ALL', label: 'All', count: recommendations.length },
  ];

  const s = settings || DEFAULT_SETTINGS;
  const customRules = !isDefaultSettings(s);
  const hasRecs = recommendations.length > 0;

  // The interactive table is for the analyst. Client view and print get the two tables that matter, complete.
  const interactiveClass = presentation ? 'hidden' : 'print:hidden';
  const deliverableClass = presentation ? 'block' : 'hidden print:block';

  return (
    <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Where paid spend can move</h3>
          <p className="text-xs font-medium text-slate-600 mt-1">
            {[clientName, periodLabel, `${periodDays} day${periodDays !== 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
          </p>
          <p className="text-sm text-slate-600 mt-2 max-w-2xl">
            Keyword by keyword: reduce where you already rank at the top organically, increase where ads are your only presence and have room.
            No keyword goes to zero. We keep a minimum everywhere so a competitor cannot take your ad slot.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={rows.length === 0}
          className={`${interactiveClass} flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:border-slate-400 disabled:opacity-40 flex-shrink-0`}
        >
          <FileText size={14} aria-hidden="true" /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
        <Card
          label="Can come down"
          value={money(summary.spendCut)}
          note={<>in this period · about {money(summary.spendCutMonthly)} a month · {pct(summary.spendCutShare)} of keyword spend</>}
        />
        <Card
          label="Real cost per added click"
          value={summary.addedClickCost ? `${money2(summary.addedClickCost.low)} to ${money2(summary.addedClickCost.high)}` : '—'}
          note={summary.addedClickCost && summary.nominalCpc !== null
            ? <>An ad click here looks like it costs {money2(summary.nominalCpc)}, but part of those clicks would arrive through the organic result anyway.</>
            : 'Shown when there are keywords to reduce.'}
        />
        <Card
          label="Clicks you may lose"
          value={range(summary.clicksAtRisk)}
          note={<>
            {summary.lossShareOfSearch ? `${pct(summary.lossShareOfSearch.low)} to ${pct(summary.lossShareOfSearch.high)} of all search clicks on these keywords` : 'paid clicks organic is not expected to pick up'}
            {summary.conversionsAtRisk.high >= 0.5 ? ` · ${range(summary.conversionsAtRisk)} conversions` : ''}. This is the price of the saving.
          </>}
        />
        <Card
          label="Clicks that still arrive"
          value={range(summary.clicksRecovered)}
          note="of the paid clicks removed, expected to come through your organic result instead"
        />
        <Card
          label="Add budget"
          value={summary.counts.INCREASE > 0 ? money(summary.spendToIncrease) : '—'}
          note={summary.counts.INCREASE > 0
            ? <>on {summary.counts.INCREASE} keyword{summary.counts.INCREASE !== 1 ? 's' : ''} where ads are your only presence{summary.extraConversions >= 0.5 ? ` · about ${int(summary.extraConversions)} more conversions` : ''}</>
            : 'No keyword meets the conditions in this period.'}
        />
      </div>

      {!hasRecs ? (
        <p className="text-sm text-slate-600 py-8 text-center" role="status">
          {isLoading ? 'Loading Google Ads keywords…' : 'Keyword recommendations need Google Ads keywords and Search Console. Connect both in Settings.'}
        </p>
      ) : (
        <>
          {/* Analyst: filter, search, sort */}
          <div className={interactiveClass}>
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 mb-4">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by action">
                {chips.map(c => (
                  <button
                    type="button"
                    key={c.key}
                    aria-pressed={filter === c.key}
                    onClick={() => { setFilter(c.key); setVisible(PAGE); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${filter === c.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'}`}
                  >
                    {c.label} <span className="opacity-70 tabular-nums">{c.count}</span>
                  </button>
                ))}
              </div>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Search keyword"
                  placeholder="Search keyword…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setVisible(PAGE); }}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus-visible:ring-2 ring-slate-900/30"
                />
              </div>
            </div>
            {rows.length === 0 ? (
              <p className="text-sm text-slate-600 py-8 text-center">No keywords in this group.</p>
            ) : (
              <div className="overflow-x-auto">
                <RecTable rows={rows.slice(0, visible)} money={money} sort={sort} onSort={handleSort} caption="Keyword recommendations" />
                {rows.length > visible && (
                  <button type="button" onClick={() => setVisible(v => v + PAGE)} className="mt-4 text-xs font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-900">
                    Show {Math.min(PAGE, rows.length - visible)} more of {rows.length}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Client view and print: the two complete tables */}
          <div className={`${deliverableClass} space-y-8`}>
            <section>
              <h4 className="text-base font-bold text-slate-900 mb-2">Reduce: {reduceRows.length} keyword{reduceRows.length !== 1 ? 's' : ''}</h4>
              {reduceRows.length === 0
                ? <p className="text-sm text-slate-600">No keyword meets the conditions for a reduction in this period.</p>
                : <div className="overflow-x-auto"><RecTable rows={reduceRows} money={money} caption="Keywords to reduce" /></div>}
            </section>
            <section>
              <h4 className="text-base font-bold text-slate-900 mb-2">Increase: {increaseRows.length} keyword{increaseRows.length !== 1 ? 's' : ''}</h4>
              {increaseRows.length === 0
                ? <p className="text-sm text-slate-600">No keyword meets the conditions for an increase in this period.</p>
                : <div className="overflow-x-auto"><RecTable rows={increaseRows} money={money} caption="Keywords to increase" /></div>}
            </section>
          </div>
        </>
      )}

      <div className="mt-6 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={() => setShowMethod(v => !v)}
          aria-expanded={showMethod || presentation}
          className={`${interactiveClass} flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900`}
        >
          Assumptions and how this is calculated {showMethod ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        </button>
        <div className={presentation || showMethod ? 'block' : 'hidden print:block'}>
          <h4 className={`${deliverableClass} text-base font-bold text-slate-900 mb-2`}>Assumptions</h4>
          <ul className="mt-3 space-y-1.5 text-xs text-slate-600 list-disc pl-4 max-w-3xl">
            {customRules && <li><strong>These rules were adjusted for this client in Settings.</strong> The figures below are the ones in use.</li>}
            <li>Each Google Ads keyword is matched to the same search query in Search Console for the same period. Keywords with fewer than {s.minPaidClicks} paid clicks get no recommendation: {summary.judgedKeywords} of {recommendations.length} keywords are judged, covering {pct(summary.judgedSpendShare)} of spend.</li>
            <li>Reduce is only proposed when the organic result is in the top {s.maxRankForReduce} and gets clicks. Positions 2 and 3 get half the cut of position 1.</li>
            <li>The cut depends on competitor pressure (how often competitors' ads outrank yours): up to {pct(s.maxCut.nonBrand.low)} when low, {pct(s.maxCut.nonBrand.medium)} when medium, {pct(s.maxCut.nonBrand.high)} when high. Brand terms: {pct(s.maxCut.brand.low)}, {pct(s.maxCut.brand.medium)} and {s.maxCut.brand.high > 0 ? pct(s.maxCut.brand.high) : 'no cut at all'} under high pressure. Unknown pressure counts as medium.</li>
            <li>Clicks that still arrive: {pct(s.recovery.rank1)} of removed paid clicks at organic position 1, {pct(s.recovery.rank2to4)} at positions 2 to 4 (upper end; the lower end is half). {customRules ? 'These rates are set per client in Settings.' : "These rates come from a Google study across industries from 2012. Your own test results will replace them."}</li>
            <li>Increase is proposed when organic is beyond position {s.minRankForIncrease} or absent, ads convert at or below the account average cost per conversion, and the ad is missing from at least {pct(s.minRankLostForIncrease)} of searches because competitors outrank it. Extra conversions assume today's cost per conversion holds.</li>
            <li>These are estimates to design a test, not a forecast. Change spend in steps and compare total clicks (paid + organic) before and after.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
