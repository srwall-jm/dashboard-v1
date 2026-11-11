import React from 'react';
import { ArrowDownRight, ArrowUpRight, ArrowRight, ShieldCheck, ListChecks } from 'lucide-react';
import { KeywordRecommendation, RecommendationSummary, Range } from '../recommendations';
import { GoogleAdsGlobalMetrics } from '../types';

const int = (value: number) => Math.round(value).toLocaleString('en-US');
const range = (r: Range) => (Math.round(r.low) === Math.round(r.high) ? int(r.low) : `${int(r.low)} to ${int(r.high)}`);
const pct = (value: number) => `${Math.round(value * 100)}%`;

const RISK_BADGE: Record<string, string> = {
  low: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-700',
  high: 'bg-rose-50 text-rose-700',
};

interface ChannelStats {
  organic: { current: { sessions: number; revenue: number }; changes: { sessions: number } };
  paid: { current: { sessions: number; revenue: number }; changes: { sessions: number } };
}

const Tile: React.FC<{ label: string; value: string; note?: string; change?: number }> = ({ label, value, note, change }) => (
  <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm break-inside-avoid">
    <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</p>
    <p className="text-3xl font-black text-slate-900 tracking-tight mt-2 tabular-nums">{value}</p>
    <p className="text-xs font-bold text-slate-500 mt-1">
      {change !== undefined && change !== 0 && (
        <span className={change > 0 ? 'text-emerald-600' : 'text-rose-600'}>{change > 0 ? '+' : ''}{change.toFixed(1)}% vs previous · </span>
      )}
      {note}
    </p>
  </div>
);

export const SummaryView: React.FC<{
  recommendations: KeywordRecommendation[];
  summary: RecommendationSummary;
  channelStats: ChannelStats;
  globalMetrics: GoogleAdsGlobalMetrics | null;
  currencySymbol: string;
  comparisonEnabled: boolean;
  isLoading?: boolean;
  onOpenRecommendations: () => void;
}> = ({ recommendations, summary, channelStats, globalMetrics, currencySymbol, comparisonEnabled, isLoading, onOpenRecommendations }) => {
  const money = (value: number) => `${currencySymbol}${int(value)}`;
  const reductions = recommendations.filter(r => r.action === 'REDUCE').sort((a, b) => b.spendCut - a.spendCut).slice(0, 5);
  const increases = recommendations.filter(r => r.action === 'INCREASE').sort((a, b) => b.currentSpend - a.currentSpend).slice(0, 5);
  const hasRecs = recommendations.length > 0;

  const organicSessions = channelStats.organic.current.sessions;
  const paidSessions = channelStats.paid.current.sessions;
  const searchSessions = organicSessions + paidSessions;
  const paidSpend = globalMetrics?.totalCost || summary.spendAnalysed;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-6">
      {/* Headline: the one thing to take away */}
      <div className="bg-slate-900 text-white rounded-[32px] p-8 md:p-10 shadow-xl break-inside-avoid">
        <p className="text-[11px] font-black uppercase tracking-widest text-[#F8B133]">The headline</p>
        {!hasRecs ? (
          <p className="text-2xl md:text-3xl font-black tracking-tight mt-3 max-w-4xl">
            {isLoading ? 'Loading Google Ads keywords...' : 'Connect Google Ads and Search Console in Settings to see where paid spend can move.'}
          </p>
        ) : summary.counts.REDUCE === 0 ? (
          <p className="text-2xl md:text-3xl font-black tracking-tight mt-3 max-w-4xl">
            No keyword meets the conditions for a reduction in this period. Paid spend is not overlapping with strong organic positions.
          </p>
        ) : (
          <>
            <p className="text-2xl md:text-3xl font-black tracking-tight mt-3 max-w-4xl leading-tight">
              About <span className="text-[#F8B133]">{money(summary.spendCut)}</span> of the {money(summary.spendAnalysed)} spent on paid keywords can come down
              ({pct(summary.spendCutShare)}), on {summary.counts.REDUCE} keyword{summary.counts.REDUCE !== 1 ? 's' : ''} where organic already holds the top of the page.
            </p>
            <p className="text-sm font-medium text-slate-300 mt-4 max-w-3xl">
              That is about {money(summary.spendCutMonthly)} a month. No keyword goes to zero: a defensive floor stays everywhere so competitors cannot take the ad slot.
              The expected cost is {range(summary.clicksAtRisk)} paid clicks; organic is expected to keep {range(summary.clicksRecovered)} of the clicks removed.
              {summary.counts.INCREASE > 0 && ` ${summary.counts.INCREASE} keyword${summary.counts.INCREASE !== 1 ? 's' : ''} deserve${summary.counts.INCREASE === 1 ? 's' : ''} more budget.`}
            </p>
          </>
        )}
        <button
          onClick={onOpenRecommendations}
          className="print:hidden mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-[#F8B133] hover:bg-[#e09e2d] text-black rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
        >
          See every keyword <ArrowRight size={14} />
        </button>
      </div>

      {/* Context */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label="Organic Search sessions" value={int(organicSessions)} note="GA4" change={comparisonEnabled ? channelStats.organic.changes.sessions : undefined} />
        <Tile label="Paid Search sessions" value={int(paidSessions)} note="GA4" change={comparisonEnabled ? channelStats.paid.changes.sessions : undefined} />
        <Tile label="Paid share of search" value={searchSessions > 0 ? pct(paidSessions / searchSessions) : 'n/a'} note="of search sessions come through ads" />
        <Tile label="Paid search spend" value={money(paidSpend)} note="Google Ads, this period" />
      </div>

      {/* The two lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm break-inside-avoid">
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700"><ArrowDownRight size={16} /></span>
            <h3 className="text-base font-black text-slate-900">Reduce here first</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">Largest savings where organic already ranks in the top 3.</p>
          {reductions.length === 0 ? (
            <p className="text-xs text-slate-400 py-6">Nothing to reduce in this period.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {reductions.map(r => (
                <li key={r.keyword} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 break-words">
                      {r.keyword}
                      {r.isBrand && <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-indigo-100 text-indigo-700 align-middle">Brand</span>}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Organic position {r.organicRank?.toFixed(1)} · {range(r.clicksAtRisk)} clicks at risk
                      {r.risk && <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${RISK_BADGE[r.risk]}`}>{r.risk} risk</span>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-black text-slate-900 tabular-nums whitespace-nowrap">{money(r.currentSpend)} → {money(r.suggestedSpend)}</p>
                    <p className="text-xs font-black text-emerald-600 tabular-nums">{Math.round(r.changePct * 100)}% · saves {money(r.spendCut)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm break-inside-avoid">
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700"><ArrowUpRight size={16} /></span>
            <h3 className="text-base font-black text-slate-900">Add budget here</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">Paid is the only real presence, it converts efficiently, and impressions are being lost.</p>
          {increases.length === 0 ? (
            <p className="text-xs text-slate-400 py-6">No keyword meets the conditions in this period.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {increases.map(r => (
                <li key={r.keyword} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 break-words">{r.keyword}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {r.organicRank === null ? 'No organic ranking' : `Organic position ${r.organicRank.toFixed(1)}`}
                      {r.rankLostShare !== null && ` · ${pct(r.rankLostShare)} of impressions lost to ad rank`}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-black text-slate-900 tabular-nums whitespace-nowrap">{money(r.currentSpend)} → {money(r.suggestedSpend)}</p>
                    <p className="text-xs font-black text-indigo-600 tabular-nums">+{Math.round(r.changePct * 100)}%</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* How to act and how to read it */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm break-inside-avoid">
          <div className="flex items-center gap-2 mb-3">
            <ListChecks size={16} className="text-slate-500" />
            <h3 className="text-base font-black text-slate-900">How to act on this</h3>
          </div>
          <ol className="space-y-2 text-sm text-slate-600 list-decimal pl-5">
            <li>Start with the low risk reductions. Lower bids or budgets in steps over two to four weeks, not at once.</li>
            <li>Watch total clicks and conversions for each keyword (paid + organic), not paid alone.</li>
            <li>If the total holds, keep the new level and move to the next step. If it drops more than expected, go back one step.</li>
            <li>Move part of the saving to the keywords in "Add budget here".</li>
          </ol>
        </div>
        <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm break-inside-avoid">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={16} className="text-slate-500" />
            <h3 className="text-base font-black text-slate-900">How to read these numbers</h3>
          </div>
          <ul className="space-y-2 text-sm text-slate-600 list-disc pl-5">
            <li>They are estimates to design a test, not a forecast.</li>
            <li>The size of each cut depends on competition: the more impressions lost to competitors' ad rank, the smaller the cut. Brand terms are cut less, and not at all under high pressure.</li>
            <li>"Clicks at risk" is the price of the saving: paid clicks that organic is not expected to pick up.</li>
            <li>Organic and Paid mean Organic Search and Paid Search only. Social, shopping and video are left out.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
