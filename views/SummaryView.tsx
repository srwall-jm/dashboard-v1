import React from 'react';
import { ArrowDownRight, ArrowUpRight, ArrowRight, ShieldCheck, ListChecks } from 'lucide-react';
import { KeywordRecommendation, RecommendationSummary, RecommendationSettings, DEFAULT_SETTINGS, Range } from '../recommendations';
import { GoogleAdsGlobalMetrics } from '../types';
import { ACTION_STYLE, DELTA } from '../theme';
import { PressureBadge } from '../components/KeywordRecommendations';

const int = (value: number) => Math.round(value).toLocaleString('en-US');
const range = (r: Range) => (Math.round(r.low) === Math.round(r.high) ? int(r.low) : `${int(r.low)} to ${int(r.high)}`);
const pct = (value: number) => `${Math.round(value * 100)}%`;
const plural = (n: number, word: string) => `${n} ${word}${n !== 1 ? 's' : ''}`;

interface ChannelStats {
  organic: { current: { sessions: number; revenue: number }; changes: { sessions: number } };
  paid: { current: { sessions: number; revenue: number }; changes: { sessions: number } };
}

const Tile: React.FC<{ label: string; value: string; note?: React.ReactNode; change?: number }> = ({ label, value, note, change }) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-200 break-inside-avoid">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{label}</p>
    <p className="text-2xl font-bold text-slate-900 tracking-tight mt-2 tabular-nums">{value}</p>
    <p className="text-xs font-medium text-slate-600 mt-1">
      {change !== undefined && change !== 0 && (
        <span className={`font-semibold ${change > 0 ? DELTA.up : DELTA.down}`}>{change > 0 ? '+' : ''}{change.toFixed(1)}% vs previous · </span>
      )}
      {note}
    </p>
  </div>
);

export const SummaryView: React.FC<{
  recommendations: KeywordRecommendation[];
  summary: RecommendationSummary;
  settings?: RecommendationSettings;
  channelStats: ChannelStats;
  globalMetrics: GoogleAdsGlobalMetrics | null;
  currencySymbol: string;
  periodDays: number;
  comparisonEnabled: boolean;
  isLoading?: boolean;
  isSample?: boolean;
  onOpenRecommendations: () => void;
}> = ({ recommendations, summary, settings = DEFAULT_SETTINGS, channelStats, globalMetrics, currencySymbol, periodDays, comparisonEnabled, isLoading, isSample, onOpenRecommendations }) => {
  const money = (value: number) => `${currencySymbol}${int(value)}`;
  const money2 = (value: number) => `${currencySymbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  // Everything in the headline is per month, so cuts and increases can be compared.
  const monthly = (value: number) => (value * 30) / (periodDays > 0 ? periodDays : 30);

  const reductions = recommendations.filter(r => r.action === 'REDUCE').sort((a, b) => b.spendCut - a.spendCut);
  const increases = recommendations.filter(r => r.action === 'INCREASE').sort((a, b) => (b.suggestedSpend - b.currentSpend) - (a.suggestedSpend - a.currentSpend));
  const hasRecs = recommendations.length > 0;
  const nReduce = summary.counts.REDUCE;
  const nIncrease = summary.counts.INCREASE;
  const pressureMix = (['low', 'medium', 'high', 'unknown'] as const)
    .map(level => ({ level, count: reductions.filter(r => r.pressure === level).length }))
    .filter(m => m.count > 0);

  const organicSessions = channelStats.organic.current.sessions;
  const paidSessions = channelStats.paid.current.sessions;
  const searchSessions = organicSessions + paidSessions;
  const hasSessions = searchSessions > 0;

  const floorSentence = 'No keyword goes to zero: we keep a minimum everywhere so a competitor cannot take your ad slot.';
  const ruleSentence = `Keywords are only reduced when the organic result is in the top ${settings.maxRankForReduce}, gets clicks, and competitors are not pressing on the ad slot.`;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* 1. Headline: the one thing to take away */}
      <section className="bg-slate-950 text-white rounded-2xl p-8 md:p-10 break-inside-avoid" aria-labelledby="summary-headline">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#F8B133]">
          The headline{isSample ? " (sample data, not a client's)" : ''}
        </p>
        {!hasRecs ? (
          <h3 id="summary-headline" className="text-2xl md:text-3xl font-bold tracking-tight mt-3 max-w-4xl leading-tight" role="status">
            {isLoading
              ? 'Loading Google Ads keywords…'
              : 'Nothing to recommend yet. Connect Google Ads and Search Console in Settings to see which keywords can take less paid spend and which need more.'}
          </h3>
        ) : nReduce > 0 ? (
          <>
            <h3 id="summary-headline" className="text-2xl md:text-3xl font-bold tracking-tight mt-3 max-w-4xl leading-tight">
              You can cut paid search by about <span className="text-[#F8B133]">{money(summary.spendCutMonthly)} a month ({pct(summary.spendCutShare)})</span> on {plural(nReduce, 'keyword')} where you already rank at the top organically
              {nIncrease > 0 ? <>, and move {money(monthly(summary.spendToIncrease))} of it to {plural(nIncrease, 'keyword')} where ads are your only presence.</> : '.'}
            </h3>
            <p className="text-sm text-slate-300 mt-4 max-w-3xl">
              {floorSentence} Expected loss: {range(summary.clicksAtRisk)} clicks
              {summary.conversionsAtRisk.high >= 0.5 ? ` and ${range(summary.conversionsAtRisk)} conversions` : ''} in a period like this one, which is why we test in steps.
            </p>
          </>
        ) : (
          <>
            <h3 id="summary-headline" className="text-2xl md:text-3xl font-bold tracking-tight mt-3 max-w-4xl leading-tight">
              {nIncrease > 0
                ? <>No paid spend should come down this period. {plural(nIncrease, 'keyword')} where ads are your only presence can take about <span className="text-[#F8B133]">{money(monthly(summary.spendToIncrease))} more a month</span>.</>
                : `No change recommended this period. No keyword has both a top ${settings.maxRankForReduce} organic result and room to cut safely.`}
            </h3>
            <p className="text-sm text-slate-300 mt-4 max-w-3xl">{ruleSentence}</p>
          </>
        )}
        <button
          type="button"
          onClick={onOpenRecommendations}
          className="print:hidden mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-[#F8B133] hover:bg-[#e09e2d] text-slate-950 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 ring-white"
        >
          See the keyword-by-keyword plan <ArrowRight size={16} aria-hidden="true" />
        </button>
      </section>

      {/* 2. Why it is worth testing */}
      {nReduce > 0 && (
        <section aria-labelledby="why-test">
          <h3 id="why-test" className="text-sm font-bold text-slate-900 mb-3">Why it is worth testing</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Tile
              label="Real cost per added click"
              value={summary.addedClickCost ? `${money2(summary.addedClickCost.low)} to ${money2(summary.addedClickCost.high)}` : '—'}
              note={summary.nominalCpc !== null
                ? <>On these keywords an ad click looks like it costs {money2(summary.nominalCpc)}, but part of those clicks would have arrived through the organic result anyway. This is what each click the ads really add costs.</>
                : undefined}
            />
            <Tile
              label="Expected loss"
              value={`${range(summary.clicksAtRisk)} clicks`}
              note={<>
                {summary.lossShareOfSearch ? `${pct(summary.lossShareOfSearch.low)} to ${pct(summary.lossShareOfSearch.high)} of all search clicks on these keywords (paid + organic)` : 'paid clicks organic is not expected to pick up'}
                {summary.conversionsAtRisk.high >= 0.5 ? `, and ${range(summary.conversionsAtRisk)} conversions` : ''}. {range(summary.clicksRecovered)} of the clicks removed still arrive through your organic result.
              </>}
            />
            <div className="bg-white p-5 rounded-2xl border border-slate-200 break-inside-avoid">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Competitor pressure on these keywords</p>
              <ul className="mt-3 space-y-2">
                {pressureMix.map(m => (
                  <li key={m.level} className="flex items-center justify-between gap-3">
                    <PressureBadge pressure={m.level} />
                    <span className="text-sm font-semibold text-slate-900 tabular-nums">{plural(m.count, 'keyword')}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs font-medium text-slate-600 mt-3">How often competitors' ads outrank yours. The higher it is, the less we cut.</p>
            </div>
          </div>
        </section>
      )}

      {/* 3. The two lists, at equal weight */}
      {hasRecs && (
        <section className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 break-inside-avoid">
              <div className="flex items-center gap-2 mb-1">
                <span className={`p-1.5 rounded-lg ${ACTION_STYLE.REDUCE.badge}`}><ArrowDownRight size={16} aria-hidden="true" /></span>
                <h3 className="text-base font-bold text-slate-900">Reduce here first</h3>
              </div>
              <p className="text-xs font-medium text-slate-600 mb-4">Largest savings where you already rank in the top {settings.maxRankForReduce} organically.</p>
              {reductions.length === 0 ? (
                <p className="text-sm text-slate-600 py-6">Nothing to reduce in this period.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {reductions.slice(0, 5).map(r => (
                    <li key={r.keyword} className="py-3 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 break-words">
                          {r.keyword}
                          {r.isBrand && <span className="ml-2 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 align-middle">Brand</span>}
                        </p>
                        <p className="text-xs font-medium text-slate-600 mt-1">Organic position {r.organicRank?.toFixed(1)} · may lose {range(r.clicksAtRisk)} clicks</p>
                        <p className="mt-1.5 flex items-center gap-2 text-xs font-medium text-slate-600">Competitor pressure <PressureBadge pressure={r.pressure} impressionShare={r.impressionShare} rankLostShare={r.rankLostShare} /></p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-slate-900 tabular-nums whitespace-nowrap">{money(r.currentSpend)} → {money(r.suggestedSpend)}</p>
                        <p className={`text-xs font-semibold tabular-nums ${ACTION_STYLE.REDUCE.text}`}>{Math.round(r.changePct * 100)}% · saves {money(r.spendCut)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {reductions.length > 5 && <p className="text-xs font-medium text-slate-600 mt-3">And {reductions.length - 5} more in the keyword plan.</p>}
            </div>

            <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 break-inside-avoid">
              <div className="flex items-center gap-2 mb-1">
                <span className={`p-1.5 rounded-lg ${ACTION_STYLE.INCREASE.badge}`}><ArrowUpRight size={16} aria-hidden="true" /></span>
                <h3 className="text-base font-bold text-slate-900">Add budget here</h3>
              </div>
              <p className="text-xs font-medium text-slate-600 mb-4">Ads are your only presence, they convert efficiently, and competitors are taking searches from you.</p>
              {increases.length === 0 ? (
                <p className="text-sm text-slate-600 py-6">No keyword meets the conditions in this period.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {increases.slice(0, 5).map(r => {
                    const extra = r.suggestedSpend - r.currentSpend;
                    return (
                      <li key={r.keyword} className="py-3 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 break-words">{r.keyword}</p>
                          <p className="text-xs font-medium text-slate-600 mt-1">
                            {r.organicRank === null ? 'No organic ranking' : `Organic position ${r.organicRank.toFixed(1)}`}
                            {r.rankLostShare !== null && ` · your ad is missing from ${pct(r.rankLostShare)} of searches because competitors outrank it`}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-slate-900 tabular-nums whitespace-nowrap">{money(r.currentSpend)} → {money(r.suggestedSpend)}</p>
                          <p className={`text-xs font-semibold tabular-nums ${ACTION_STYLE.INCREASE.text}`}>
                            +{money(extra)}{r.expectedExtraConversions && r.expectedExtraConversions >= 0.5 ? ` · about ${int(r.expectedExtraConversions)} more conversions` : ''}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {increases.length > 0 && <p className="text-xs font-medium text-slate-600 mt-3">Extra conversions are an estimate at today's cost per conversion.</p>}
            </div>
          </div>

          {(nReduce > 0 || nIncrease > 0) && (
            <p className="bg-white px-6 py-4 rounded-2xl border border-slate-200 text-sm font-medium text-slate-700 break-inside-avoid">
              <span className="font-bold text-slate-900">Net effect in a period like this one:</span>{' '}
              {money(summary.spendCut)} down, {money(summary.spendToIncrease)} up,{' '}
              <span className="font-bold text-slate-900">
                {summary.netChange >= 0 ? `${money(summary.netChange)} saved` : `${money(-summary.netChange)} more invested`}
              </span>.
            </p>
          )}
        </section>
      )}

      {/* 4 and 5. How to run the test, and the assumptions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 break-inside-avoid">
          <div className="flex items-center gap-2 mb-3">
            <ListChecks size={16} className="text-slate-600" aria-hidden="true" />
            <h3 className="text-base font-bold text-slate-900">How to run the test</h3>
          </div>
          <ol className="space-y-2 text-sm text-slate-600 list-decimal pl-5">
            <li>Start with the reductions under low competitor pressure. Lower bids or budgets in steps, not at once.</li>
            <li>Watch total clicks and conversions for each keyword (paid + organic), not paid alone.</li>
            <li>Run each step for two weeks. Stop and go back one step if total clicks on a keyword fall by more than the upper figure shown here.</li>
            <li>Move part of the saving to the keywords in "Add budget here".</li>
          </ol>
        </section>
        <section className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 break-inside-avoid">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={16} className="text-slate-600" aria-hidden="true" />
            <h3 className="text-base font-bold text-slate-900">Assumptions</h3>
          </div>
          <ul className="space-y-2 text-sm text-slate-600 list-disc pl-5">
            <li>These are estimates to design a test, not a forecast.</li>
            <li>The share of clicks that still arrive ({pct(settings.recovery.rank1)} at organic position 1, {pct(settings.recovery.rank2to4)} at positions 2 to 4) starts from a Google study across industries from 2012. Your own test will replace it.</li>
            <li>The more often competitors' ads outrank yours on a keyword, the smaller the cut. Brand terms are cut less.</li>
            {hasRecs && <li>Only keywords with at least {settings.minPaidClicks} paid clicks in the period are judged: {summary.judgedKeywords} of {recommendations.length} keywords, covering {pct(summary.judgedSpendShare)} of spend.</li>}
            <li>Organic and Paid mean Organic Search and Paid Search only. Social, shopping and video are left out.</li>
          </ul>
        </section>
      </div>

      {/* 6. Context: background, not argument */}
      <section aria-labelledby="summary-context">
        <h3 id="summary-context" className="text-sm font-bold text-slate-900 mb-3">Search in this period</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {hasSessions ? (
            <>
              <Tile label="Organic Search sessions" value={int(organicSessions)} note="GA4" change={comparisonEnabled ? channelStats.organic.changes.sessions : undefined} />
              <Tile label="Paid Search sessions" value={int(paidSessions)} note="GA4" change={comparisonEnabled ? channelStats.paid.changes.sessions : undefined} />
              <Tile label="Paid share of search" value={pct(paidSessions / searchSessions)} note="of search sessions come through ads" />
            </>
          ) : (
            <div className="sm:col-span-2 lg:col-span-3 bg-white p-5 rounded-2xl border border-dashed border-slate-300 text-sm font-medium text-slate-600 flex items-center">
              Connect GA4 in Settings to see organic and paid sessions here.
            </div>
          )}
          <Tile
            label="Spend on keywords analysed"
            value={money(summary.spendAnalysed)}
            note={globalMetrics && Math.round(globalMetrics.totalCost) !== Math.round(summary.spendAnalysed)
              ? `Google Ads, this period. Whole account: ${money(globalMetrics.totalCost)}.`
              : 'Google Ads, this period'}
          />
        </div>
      </section>
    </div>
  );
};
