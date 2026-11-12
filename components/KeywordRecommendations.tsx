import React, { useMemo, useState } from 'react';
import { withCurrency } from '../utils';
import { LineChart, ArrowDownRight, ArrowUpRight, Minus, HelpCircle, FileText, Search, ChevronDown, ChevronUp, ArrowDown, ArrowUp } from 'lucide-react';
import {
  KeywordRecommendation, RecommendationSummary, RecAction, Range, DEFAULT_SETTINGS, RecommendationSettings, isDefaultSettings,
} from '../recommendations';
import { ACTION_STYLE, PRESSURE_STYLE, PRESSURE_HELP } from '../theme';
import { Plan, PlanItem, PlanStatus, EMPTY_ITEM, PLAN_STATUS_LABEL, planKeyOf, countPlan } from '../plan';
import { exportToCSV } from '../utils';
import { useI18n } from '../i18n';
import { KeywordResult, measurementWindow, todayIso } from '../planResults';
import { SearchTermsBar } from './SpendVisuals';

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
  const { tr } = useI18n();
  const style = PRESSURE_STYLE[pressure];
  const detail = rankLostShare !== null && rankLostShare !== undefined
    ? tr(' Your ad did not show or was outranked on {share} of searches.', { share: pct(rankLostShare) })
    : impressionShare !== null && impressionShare !== undefined ? tr(' Your ad shows on {share} of searches.', { share: pct(impressionShare) }) : '';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap ${style.badge}`} title={`${tr(PRESSURE_HELP)}${detail}`}>
      <span className="inline-flex items-end gap-px" aria-hidden="true">
        {[1, 2, 3].map(n => (
          <span key={n} className={`w-1 rounded-sm ${n <= style.bars ? 'bg-current' : 'bg-current opacity-25'}`} style={{ height: 4 + n * 2 }} />
        ))}
      </span>
      {tr(style.label)}
    </span>
  );
};

type I18n = ReturnType<typeof useI18n>;

const effectText = (r: KeywordRecommendation, money: (v: number) => string, i18n: I18n): string => {
  if (r.action === 'REDUCE') {
    const clicks = i18n.tr('May lose {clicks} clicks', { clicks: i18n.range(r.clicksAtRisk) });
    return r.valueAtRisk.high >= 1
      ? `${clicks} · ${i18n.tr('{value} of conversion value', { value: i18n.tr('{low} to {high}', { low: money(r.valueAtRisk.low), high: money(r.valueAtRisk.high) }) })}`
      : clicks;
  }
  if (r.action === 'INCREASE') {
    const extra = r.suggestedSpend - r.currentSpend;
    return r.expectedExtraConversions && r.expectedExtraConversions >= 0.5
      ? `+${money(extra)}${i18n.tr(' · about {n} more conversions', { n: i18n.int(r.expectedExtraConversions) })}`
      : `+${money(extra)}`;
  }
  return '—';
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// What was agreed with the client for one keyword. Editable for the analyst, read-only for the client.
const PlanCell: React.FC<{
  keyword: string;
  item: PlanItem;
  onChange?: (item: PlanItem) => void;
  result?: KeywordResult;
  money: (v: number) => string;
}> = ({ keyword, item, onChange, result, money }) => {
  const { tr, int } = useI18n();
  const verdictText: Record<KeywordResult['verdict'], string> = {
    held: tr('Total clicks held.'),
    smallDrop: tr('Small drop in total clicks.'),
    drop: tr('Total clicks fell: consider going back one step.'),
    noSpendChange: tr('Paid spend did not come down, so there is nothing to judge yet.'),
    noData: tr('No clicks found in the two periods.'),
  };
  const verdictClass: Record<KeywordResult['verdict'], string> = {
    held: 'text-[#047857]', smallDrop: 'text-[#B45309]', drop: 'text-[#B91C1C]', noSpendChange: 'text-slate-500', noData: 'text-slate-500',
  };
  const pending = item.status === 'applied' && item.appliedOn && !result ? measurementWindow(item.appliedOn, todayIso()) : null;
  const resultLine = result ? (
    <span className="block mt-1 text-[11px] text-slate-600">
      {result.verdict !== 'noData' && (
        <>
          {tr('Total clicks, 2 weeks before and after: {before} → {after} ({change})', {
            before: int(result.totalBefore),
            after: int(result.totalAfter),
            change: result.totalChange === null ? '—' : `${result.totalChange > 0 ? '+' : ''}${Math.round(result.totalChange * 100)}%`,
          })}
          {' · '}
          {tr('spend {amount}', { amount: `${result.spendChange > 0 ? '+' : '−'}${money(Math.abs(result.spendChange))}` })}
          {'. '}
        </>
      )}
      <span className={`font-semibold ${verdictClass[result.verdict]}`}>{verdictText[result.verdict]}</span>
    </span>
  ) : pending && !pending.ready ? (
    <span className="block mt-1 text-[11px] text-slate-500">{tr('Result can be measured from {date}.', { date: pending.readyOn })}</span>
  ) : null;
  if (!onChange) {
    const parts = [
      item.status !== 'none' ? `${tr(PLAN_STATUS_LABEL[item.status])}${item.appliedOn ? tr(' on {date}', { date: item.appliedOn }) : ''}` : '',
      item.doNotReduce ? tr('Do not reduce') : '',
      item.note,
    ].filter(Boolean);
    return <span className="text-xs text-slate-700">{parts.length > 0 ? parts.join(' · ') : '—'}{resultLine}</span>;
  }
  return (
    <div className="flex flex-col gap-1.5 min-w-[170px]">
      <div className="flex items-center gap-1.5">
        <select
          aria-label={tr('Plan for {keyword}', { keyword })}
          value={item.status}
          onChange={e => {
            const status = e.target.value as PlanStatus;
            onChange({ ...item, status, appliedOn: status === 'applied' || status === 'reverted' ? item.appliedOn || today() : null });
          }}
          className="bg-white border border-slate-200 rounded-md text-xs font-semibold text-slate-700 px-1.5 py-1 outline-none cursor-pointer"
        >
          {(Object.keys(PLAN_STATUS_LABEL) as PlanStatus[]).map(st => <option key={st} value={st}>{tr(PLAN_STATUS_LABEL[st])}</option>)}
        </select>
        {(item.status === 'applied' || item.status === 'reverted') && (
          <input
            type="date"
            aria-label={tr('Date applied for {keyword}', { keyword })}
            value={item.appliedOn || ''}
            max={today()}
            onChange={e => onChange({ ...item, appliedOn: e.target.value || today() })}
            className="bg-white border border-slate-200 rounded-md text-xs text-slate-700 px-1.5 py-1 outline-none"
          />
        )}
      </div>
      <input
        type="text"
        aria-label={tr('Note for {keyword}', { keyword })}
        key={`${keyword}:${item.note}`}
        defaultValue={item.note}
        placeholder={tr('Note')}
        maxLength={300}
        onBlur={e => { if (e.target.value.trim() !== item.note) onChange({ ...item, note: e.target.value.trim() }); }}
        className="bg-white border border-slate-200 rounded-md text-xs text-slate-700 px-1.5 py-1 outline-none"
      />
      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
        <input type="checkbox" checked={item.doNotReduce} onChange={e => onChange({ ...item, doNotReduce: e.target.checked })} className="w-3.5 h-3.5 accent-slate-900" />
        {tr('Do not reduce')}
      </label>
      {resultLine}
    </div>
  );
};

const RecTable: React.FC<{
  rows: KeywordRecommendation[];
  money: (v: number) => string;
  sort?: { key: SortKey; dir: 'asc' | 'desc' };
  onSort?: (key: SortKey) => void;
  caption?: string;
  plan?: Plan; // shown as a column when given
  onPlanChange?: (keyword: string, item: PlanItem) => void; // editable when given
  planResults?: Record<string, KeywordResult>;
  settings?: RecommendationSettings;
  onOpenDetail?: (keyword: string) => void;
}> = ({ rows, money, sort, onSort, caption, plan, onPlanChange, planResults, settings, onOpenDetail }) => {
  const i18n = useI18n();
  const { tr } = i18n;
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
    <table className={`w-full text-left ${plan ? 'min-w-[1160px]' : 'min-w-[960px]'}`}>
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead>
        <tr className="border-b border-slate-200">
          {header(tr('Keyword'), 'keyword')}
          {header(tr('Action'), null)}
          {header(tr('Organic position'), 'organicRank', 'right')}
          {header(tr('Spend now'), 'currentSpend', 'right')}
          {header(tr('Suggested'), 'suggestedSpend', 'right')}
          {header(tr('Expected effect'), 'impact')}
          {header(tr('Auction pressure'), null)}
          {header(tr('Why'), null)}
          {plan && header(tr('Agreed plan'), null)}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => {
          const style = ACTION_STYLE[r.action];
          return (
            <tr key={r.keyword} className="border-b border-slate-100 align-top">
              <td className="py-3 px-3 text-[13px] font-semibold text-slate-900 max-w-[220px]">
                <span className="break-words">{r.keyword}</span>
                {r.isBrand && <span className="ml-2 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600">{tr('Brand')}</span>}
                {onOpenDetail && (
            <button type="button" onClick={() => onOpenDetail(r.keyword)} className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 ring-slate-900/30 rounded">
              <LineChart size={12} aria-hidden="true" /> {tr('Week by week')}<span className="sr-only">: {r.keyword}</span>
            </button>
                )}
              </td>
              <td className="py-3 px-3">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap ${style.badge}`}>
                  {ACTION_ICON[r.action]} {tr(style.label)}{r.changePct !== 0 ? ` ${r.changePct > 0 ? '+' : ''}${Math.round(r.changePct * 100)}%` : ''}
                </span>
              </td>
              <td className="py-3 px-3 text-[13px] font-medium text-slate-700 text-right tabular-nums">{r.organicRank === null ? '—' : i18n.dec(r.organicRank, 1)}</td>
              <td className="py-3 px-3 text-[13px] font-medium text-slate-700 text-right tabular-nums">{money(r.currentSpend)}</td>
              <td className="py-3 px-3 text-[13px] font-bold text-slate-900 text-right tabular-nums">{r.changePct === 0 ? '—' : money(r.suggestedSpend)}</td>
              <td className="py-3 px-3 text-[13px] font-medium text-slate-700 tabular-nums">{effectText(r, money, i18n)}</td>
              <td className="py-3 px-3"><PressureBadge pressure={r.pressure} impressionShare={r.impressionShare} rankLostShare={r.rankLostShare} /></td>
              <td className="py-3 px-3 text-xs text-slate-600 max-w-[340px]">
                {i18n.reason(r)}
                <SearchTermsBar rec={r} settings={settings} />
              </td>
              {plan && (
                <td className="py-3 px-3">
                  <PlanCell keyword={r.keyword} item={plan[planKeyOf(r.keyword)] || EMPTY_ITEM} onChange={onPlanChange ? item => onPlanChange(r.keyword, item) : undefined} result={planResults?.[planKeyOf(r.keyword)]} money={money} />
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

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
  // What was agreed with the client, keyword by keyword.
  plan?: Plan;
  onPlanChange?: (keyword: string, item: PlanItem) => void;
  planShared?: boolean; // saved for the team, as opposed to this browser only
  // What happened after the applied changes, once measured.
  planResults?: Record<string, KeywordResult>;
  onMeasurePlan?: () => void;
  isMeasuringPlan?: boolean;
  planMeasureNote?: string | null;
  onOpenDetail?: (keyword: string) => void;
}> = ({ recommendations, summary, settings, currencySymbol, periodDays, periodLabel, clientName, isLoading, presentation = false, plan, onPlanChange, planShared = false, planResults, onMeasurePlan, isMeasuringPlan = false, planMeasureNote, onOpenDetail }) => {
  const [filter, setFilter] = useState<Filter>('REDUCE');
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(PAGE);
  const [showMethod, setShowMethod] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'impact', dir: 'desc' });

  const i18n = useI18n();
  const { tr } = i18n;
  const money = (value: number) => i18n.money(currencySymbol, value);
  const money2 = (value: number) => i18n.money(currencySymbol, value, 2);
  const range = i18n.range;
  const int = i18n.int;

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
      'Paid conversions': r.paidConversions.toFixed(1),
      'Paid conversion value': r.paidConversionValue.toFixed(2),
      'Conversion value you may lose (low)': r.valueAtRisk.low.toFixed(2),
      'Conversion value you may lose (high)': r.valueAtRisk.high.toFixed(2),
      'Expected extra conversion value': r.expectedExtraValue === null ? '' : r.expectedExtraValue.toFixed(2),
      'Expected extra conversions': r.expectedExtraConversions === null ? '' : r.expectedExtraConversions.toFixed(1),
      'Ad shown on % of searches': r.impressionShare === null ? '' : Math.round(r.impressionShare * 100),
      'Searches where the ad did not show or was outranked %': r.rankLostShare === null ? '' : Math.round(r.rankLostShare * 100),
      'Auction pressure': r.pressure,
      Why: i18n.reason(r),
    })), 'Keyword_Recommendations');
  };

  const chips: { key: Filter; label: string; count: number }[] = [
    { key: 'REDUCE', label: tr(ACTION_STYLE.REDUCE.label), count: summary.counts.REDUCE },
    { key: 'INCREASE', label: tr(ACTION_STYLE.INCREASE.label), count: summary.counts.INCREASE },
    { key: 'HOLD', label: tr(ACTION_STYLE.HOLD.label), count: summary.counts.HOLD },
    { key: 'NO_DATA', label: tr(ACTION_STYLE.NO_DATA.label), count: summary.counts.NO_DATA },
    { key: 'ALL', label: tr('All'), count: recommendations.length },
  ];

  const s = settings || DEFAULT_SETTINGS;
  const customRules = !isDefaultSettings(s);
  const hasRecs = recommendations.length > 0;
  const planCounts = countPlan(plan || {});
  const planHasEntries = Boolean(plan) && Object.keys(plan!).length > 0;

  // The interactive table is for the analyst. Client view and print get the two tables that matter, complete.
  const interactiveClass = presentation ? 'hidden' : 'print:hidden';
  const deliverableClass = presentation ? 'block' : 'hidden print:block';

  return (
    <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
        <div>
          <h3 className="jf-display text-2xl text-slate-900">{tr('Every keyword')}</h3>
          <p className={`${interactiveClass} text-xs font-medium text-slate-600 mt-1`}>{tr('Filter, search and sort. The last column records what was agreed.')}</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={rows.length === 0}
          className={`${interactiveClass} flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:border-slate-400 disabled:opacity-40 flex-shrink-0`}
        >
          <FileText size={14} aria-hidden="true" /> {tr('Export CSV')}
        </button>
      </div>

      {!hasRecs ? (
        <p className="text-sm text-slate-600 py-8 text-center" role="status">
          {isLoading ? tr('Loading Google Ads keywords…') : tr('Keyword recommendations need Google Ads keywords and Search Console. Connect both in Settings.')}
        </p>
      ) : (
        <>
          {/* Analyst: filter, search, sort */}
          <div className={interactiveClass}>
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 mb-4">
              <div className="flex flex-wrap gap-2" role="group" aria-label={tr('Filter by action')}>
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
                  aria-label={tr('Search keyword')}
                  placeholder={tr('Search keyword…')}
                  value={search}
                  onChange={e => { setSearch(e.target.value); setVisible(PAGE); }}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus-visible:ring-2 ring-slate-900/30"
                />
              </div>
            </div>
            {rows.length === 0 ? (
              <p className="text-sm text-slate-600 py-8 text-center">{tr('No keywords in this group.')}</p>
            ) : (
              <div className="overflow-x-auto">
                <RecTable rows={rows.slice(0, visible)} money={money} sort={sort} onSort={handleSort} caption={tr('Keyword recommendations')} plan={plan} onPlanChange={onPlanChange} planResults={planResults} settings={s} onOpenDetail={onOpenDetail} />
                {rows.length > visible && (
                  <button type="button" onClick={() => setVisible(v => v + PAGE)} className="mt-4 text-xs font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-900">
                    {tr('Show {n} more of {total}', { n: Math.min(PAGE, rows.length - visible), total: int(rows.length) })}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Client view and print: the two complete tables */}
          <div className={`${deliverableClass} space-y-8`}>
            <section>
              <h4 className="jf-display text-xl text-slate-900 mb-2">{tr('Reduce')}: {i18n.keywords(reduceRows.length)}</h4>
              {reduceRows.length === 0
                ? <p className="text-sm text-slate-600">{tr('No keyword meets the conditions for a reduction in this period.')}</p>
                : <div className="overflow-x-auto"><RecTable rows={reduceRows} money={money} caption={tr('Keywords to reduce')} plan={planHasEntries ? plan : undefined} planResults={planResults} settings={s} onOpenDetail={onOpenDetail} /></div>}
            </section>
            <section>
              <h4 className="jf-display text-xl text-slate-900 mb-2">{tr('Increase')}: {i18n.keywords(increaseRows.length)}</h4>
              {increaseRows.length === 0
                ? <p className="text-sm text-slate-600">{tr('No keyword meets the conditions for an increase in this period.')}</p>
                : <div className="overflow-x-auto"><RecTable rows={increaseRows} money={money} caption={tr('Keywords to increase')} plan={planHasEntries ? plan : undefined} planResults={planResults} settings={s} onOpenDetail={onOpenDetail} /></div>}
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
          {tr('Assumptions and how this is calculated')} {showMethod ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        </button>
        <div className={presentation || showMethod ? 'block' : 'hidden print:block'}>
          <h4 className={`${deliverableClass} jf-display text-xl text-slate-900 mb-2`}>{tr('Assumptions')}</h4>
          <ul className="mt-3 space-y-1.5 text-xs text-slate-600 list-disc pl-4 max-w-3xl">
            {customRules && <li><strong>{tr('These rules were adjusted for this client in Settings.')}</strong> {tr('The figures below are the ones in use.')}</li>}
            <li>{tr('Each Google Ads keyword is matched to the same search query in Search Console for the same period. Keywords with fewer than {min} paid clicks get no recommendation: {judged} of {total} keywords are judged, covering {share} of spend.', { min: s.minPaidClicks, judged: int(summary.judgedKeywords), total: int(recommendations.length), share: pct(summary.judgedSpendShare) })}</li>
            <li>{tr('When Google Ads search terms can be read, a keyword is judged by the searches it really spends on: it is reduced only if at least {share} of its spend is on searches where you rank in the top {top}, and the cut applies to that share only.', { share: pct(s.minTopOrganicShare), top: s.maxRankForReduce })}</li>
            <li>{tr('Reduce is only proposed when the organic result is in the top {top} and gets at least {clicks} clicks. A keyword with no organic data for its exact text is kept as is, never increased. Positions 2 and 3 get half the cut of position 1.', { top: s.maxRankForReduce, clicks: s.minOrganicClicks })}</li>
            <li>{tr('The cut depends on auction pressure (how often your ad did not show or was outranked): up to {low} when low, {medium} when medium, {high} when high. Brand terms: {brandLow}, {brandMedium} and {brandHigh} under high pressure. Unknown pressure counts as medium.', { low: pct(s.maxCut.nonBrand.low), medium: pct(s.maxCut.nonBrand.medium), high: pct(s.maxCut.nonBrand.high), brandLow: pct(s.maxCut.brand.low), brandMedium: pct(s.maxCut.brand.medium), brandHigh: s.maxCut.brand.high > 0 ? pct(s.maxCut.brand.high) : tr('no cut at all') })}</li>
            <li>{tr('Clicks that still arrive: {rank1} of removed paid clicks at organic position 1, {rank2to4} at positions 2 to 4 (upper end; the lower end is half).', { rank1: pct(s.recovery.rank1), rank2to4: pct(s.recovery.rank2to4) })} {customRules ? tr('These rates are set per client in Settings.') : tr('These rates come from a Google study across industries from 2012. Your own test results will replace them.')}</li>
            <li>{tr('Increase is proposed when organic is beyond position {rank} or absent, ads convert at or below the account average cost per conversion, and the ad did not show or was outranked on at least {share} of searches. Extra conversions assume today\'s cost per conversion holds.', { rank: s.minRankForIncrease, share: pct(s.minRankLostForIncrease) })}</li>
            <li>{tr('Conversion value at risk is the value Google Ads records per paid click on each keyword, applied to the clicks that may be lost. It is revenue only if the account tracks sales, and it is never profit: compare it with the saving using your own margin.')}</li>
            <li>{tr('These are estimates to design a test, not a forecast. Change spend in steps and compare total clicks (paid + organic) before and after.')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
