import React, { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, HelpCircle, FileText, Search, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import {
  KeywordRecommendation, RecommendationSummary, RecAction, Range, DEFAULT_SETTINGS,
} from '../recommendations';
import { exportToCSV } from '../utils';

const ACTION_META: Record<RecAction, { label: string; badge: string; icon: React.ReactNode }> = {
  REDUCE: { label: 'Reduce', badge: 'bg-emerald-100 text-emerald-700', icon: <ArrowDownRight size={12} /> },
  INCREASE: { label: 'Increase', badge: 'bg-indigo-100 text-indigo-700', icon: <ArrowUpRight size={12} /> },
  HOLD: { label: 'Hold', badge: 'bg-slate-100 text-slate-600', icon: <Minus size={12} /> },
  NO_DATA: { label: 'No data', badge: 'bg-slate-50 text-slate-400', icon: <HelpCircle size={12} /> },
};

const RISK_BADGE: Record<string, string> = {
  low: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-700',
  high: 'bg-rose-50 text-rose-700',
};

const int = (value: number) => Math.round(value).toLocaleString('en-US');
const range = (r: Range) => (Math.round(r.low) === Math.round(r.high) ? int(r.low) : `${int(r.low)} to ${int(r.high)}`);
const pct = (value: number | null) => (value === null ? 'n/a' : `${Math.round(value * 100)}%`);

type Filter = RecAction | 'ALL';
const PAGE = 25;

export const KeywordRecommendations: React.FC<{
  recommendations: KeywordRecommendation[];
  summary: RecommendationSummary;
  currencySymbol: string;
  periodDays: number;
  periodLabel?: string;
  clientName?: string;
  isLoading?: boolean;
}> = ({ recommendations, summary, currencySymbol, periodDays, periodLabel, clientName, isLoading }) => {
  const [filter, setFilter] = useState<Filter>('REDUCE');
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(PAGE);
  const [showMethod, setShowMethod] = useState(false);

  const money = (value: number) => `${currencySymbol}${int(value)}`;

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return recommendations
      .filter(r => (filter === 'ALL' || r.action === filter) && (!term || r.keyword.toLowerCase().includes(term)))
      .sort((a, b) => (b.spendCut - a.spendCut) || (b.currentSpend - a.currentSpend));
  }, [recommendations, filter, search]);

  const handleExport = () => {
    exportToCSV(rows.map(r => ({
      Keyword: r.keyword,
      Brand: r.isBrand ? 'Yes' : 'No',
      Action: ACTION_META[r.action].label,
      'Organic position': r.organicRank === null ? '' : r.organicRank.toFixed(1),
      'Organic clicks': r.organicClicks,
      'Paid clicks': r.paidClicks,
      'Current spend': r.currentSpend.toFixed(2),
      'Suggested spend': r.suggestedSpend.toFixed(2),
      'Change %': Math.round(r.changePct * 100),
      'Spend cut': r.spendCut.toFixed(2),
      'Clicks kept by organic (low)': Math.round(r.clicksRecovered.low),
      'Clicks kept by organic (high)': Math.round(r.clicksRecovered.high),
      'Clicks at risk (low)': Math.round(r.clicksAtRisk.low),
      'Clicks at risk (high)': Math.round(r.clicksAtRisk.high),
      'Impression share %': r.impressionShare === null ? '' : Math.round(r.impressionShare * 100),
      'Lost to ad rank %': r.rankLostShare === null ? '' : Math.round(r.rankLostShare * 100),
      'Competitive pressure': r.pressure,
      Risk: r.risk || '',
      Why: r.reason,
    })), 'Keyword_Recommendations');
  };

  const chips: { key: Filter; label: string; count: number }[] = [
    { key: 'REDUCE', label: 'Reduce', count: summary.counts.REDUCE },
    { key: 'INCREASE', label: 'Increase', count: summary.counts.INCREASE },
    { key: 'HOLD', label: 'Hold', count: summary.counts.HOLD },
    { key: 'NO_DATA', label: 'No data', count: summary.counts.NO_DATA },
    { key: 'ALL', label: 'All', count: recommendations.length },
  ];

  const s = DEFAULT_SETTINGS;

  return (
    <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
        <div>
          <h4 className="text-lg font-black text-slate-900">Where paid spend can move</h4>
          <p className="text-xs font-bold text-slate-500 mt-1">
            {[clientName, periodLabel, `${periodDays} day${periodDays !== 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
          </p>
          <p className="text-xs text-slate-500 mt-2 max-w-2xl">
            Keyword by keyword: reduce where organic already holds the click, increase where paid is the only presence and has room.
            No keyword is ever taken to zero. A defensive floor stays in place so competitors cannot take the ad slot.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={rows.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 disabled:opacity-40 transition-colors flex-shrink-0"
        >
          <FileText size={12} /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Spend that can come down</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{money(summary.spendCut)}</p>
          <p className="text-[11px] font-bold text-slate-500 mt-1">
            in this period · about {money(summary.spendCutMonthly)} a month · {pct(summary.spendCutShare)} of keyword spend
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Clicks organic keeps</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{range(summary.clicksRecovered)}</p>
          <p className="text-[11px] font-bold text-slate-500 mt-1">of the paid clicks removed, expected to arrive through the organic result</p>
        </div>
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Clicks at risk</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{range(summary.clicksAtRisk)}</p>
          <p className="text-[11px] font-bold text-slate-500 mt-1">
            may be lost{summary.conversionsAtRisk.high >= 0.5 ? ` · ${range(summary.conversionsAtRisk)} conversions` : ''}. This is the price of the saving.
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700">Where to add budget</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{summary.counts.INCREASE} keyword{summary.counts.INCREASE !== 1 ? 's' : ''}</p>
          <p className="text-[11px] font-bold text-slate-500 mt-1">
            {summary.counts.INCREASE > 0 ? `about ${money(summary.spendToIncrease)} more in a period like this` : 'none meets the conditions in this period'}
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {chips.map(c => (
            <button
              key={c.key}
              onClick={() => { setFilter(c.key); setVisible(PAGE); }}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-colors ${filter === c.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}
            >
              {c.label} <span className="opacity-60">{c.count}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search keyword..."
            value={search}
            onChange={e => { setSearch(e.target.value); setVisible(PAGE); }}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-400"
          />
        </div>
      </div>

      {recommendations.length === 0 ? (
        <p className="text-xs text-slate-500 py-8 text-center">
          {isLoading ? 'Loading Google Ads keywords...' : 'Keyword recommendations need Google Ads keywords and Search Console. Connect both in Settings.'}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-slate-500 py-8 text-center">No keywords in this group.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-200">
                {['Keyword', 'Action', 'Organic pos.', 'Spend now', 'Suggested', 'Clicks at risk', 'Competition', 'Why'].map((h, i) => (
                  <th key={h} className={`py-2 px-2 text-[9px] font-black text-slate-400 uppercase tracking-tight ${i >= 2 && i <= 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, visible).map(r => {
                const meta = ACTION_META[r.action];
                return (
                  <tr key={r.keyword} className="border-b border-slate-100 align-top hover:bg-slate-50/60">
                    <td className="py-3 px-2 text-xs font-bold text-slate-800 max-w-[220px]">
                      <span className="break-words">{r.keyword}</span>
                      {r.isBrand && <span className="ml-2 px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-indigo-100 text-indigo-700">Brand</span>}
                    </td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase whitespace-nowrap ${meta.badge}`}>
                        {meta.icon} {meta.label}{r.changePct !== 0 ? ` ${r.changePct > 0 ? '+' : ''}${Math.round(r.changePct * 100)}%` : ''}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-xs font-bold text-slate-700 text-right tabular-nums">{r.organicRank === null ? 'none' : r.organicRank.toFixed(1)}</td>
                    <td className="py-3 px-2 text-xs font-bold text-slate-700 text-right tabular-nums">{money(r.currentSpend)}</td>
                    <td className="py-3 px-2 text-xs font-black text-slate-900 text-right tabular-nums">{r.changePct === 0 ? '—' : money(r.suggestedSpend)}</td>
                    <td className="py-3 px-2 text-xs font-bold text-slate-700 text-right tabular-nums whitespace-nowrap">{r.action === 'REDUCE' ? range(r.clicksAtRisk) : '—'}</td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase whitespace-nowrap ${r.pressure === 'unknown' ? 'bg-slate-100 text-slate-500' : RISK_BADGE[r.pressure]}`}
                        title={`Impression share ${pct(r.impressionShare)}, lost to ad rank ${pct(r.rankLostShare)}`}>
                        {r.pressure === 'high' && <ShieldAlert size={11} />}{r.pressure}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-[11px] text-slate-600 max-w-[340px]">{r.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length > visible && (
            <button onClick={() => setVisible(v => v + PAGE)} className="mt-4 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800">
              Show {Math.min(PAGE, rows.length - visible)} more of {rows.length}
            </button>
          )}
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-slate-100">
        <button onClick={() => setShowMethod(v => !v)} className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-800">
          How this is calculated {showMethod ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {showMethod && (
          <ul className="mt-3 space-y-1.5 text-[11px] text-slate-600 list-disc pl-4 max-w-3xl">
            <li>Each Google Ads keyword is matched to the same query text in Search Console for the same period. Keywords with fewer than {s.minPaidClicks} paid clicks get no recommendation.</li>
            <li>Reduce is only proposed when the organic result is in the top {s.maxRankForReduce} and gets clicks. Positions 2 and 3 get half the cut of position 1.</li>
            <li>The cut is capped by competition, measured as the share of impressions lost to ad rank: up to {pct(s.maxCut.nonBrand.low)} when low, {pct(s.maxCut.nonBrand.medium)} when medium, {pct(s.maxCut.nonBrand.high)} when high. Brand terms: {pct(s.maxCut.brand.low)}, {pct(s.maxCut.brand.medium)} and no cut at all under high pressure. Unknown competition counts as medium.</li>
            <li>Clicks organic keeps: {pct(s.recovery.rank1)} of removed paid clicks at organic position 1, {pct(s.recovery.rank2to4)} at positions 2 to 4 (upper end; the lower end is half). These rates come from Google's published study on ad click incrementality by organic position. They are cross-industry averages and should be replaced by this client's own test results.</li>
            <li>Increase is proposed when organic is beyond position {s.minRankForIncrease} or absent, paid converts at or below the account average cost per conversion, and at least {pct(s.minRankLostForIncrease)} of impressions are lost to ad rank.</li>
            <li>These are estimates to design a test, not a forecast. Change spend in steps and compare total clicks (paid + organic) before and after.</li>
          </ul>
        )}
      </div>
    </div>
  );
};
