import React from 'react';
import { ArrowDownRight, ArrowUpRight, ArrowRight, ShieldCheck, ListChecks } from 'lucide-react';
import { KeywordRecommendation, RecommendationSummary, RecommendationSettings, DEFAULT_SETTINGS } from '../recommendations';
import { GoogleAdsGlobalMetrics } from '../types';
import { ACTION_STYLE, DELTA } from '../theme';
import { PressureBadge } from '../components/KeywordRecommendations';
import { useI18n } from '../i18n';

interface ChannelStats {
  organic: { current: { sessions: number; revenue: number }; changes: { sessions: number } };
  paid: { current: { sessions: number; revenue: number }; changes: { sessions: number } };
}

const Tile: React.FC<{ label: string; value: string; note?: React.ReactNode; change?: number }> = ({ label, value, note, change }) => {
  const { tr, dec } = useI18n();
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 break-inside-avoid">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{label}</p>
      <p className="jf-figure text-4xl text-slate-900 mt-2 tabular-nums">{value}</p>
      <p className="text-xs font-medium text-slate-600 mt-1">
        {change !== undefined && change !== 0 && (
          <span className={`font-semibold ${change > 0 ? DELTA.up : DELTA.down}`}>
            {tr('{change} vs previous · ', { change: `${change > 0 ? '+' : ''}${dec(change, 1)}%` })}
          </span>
        )}
        {note}
      </p>
    </div>
  );
};

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
  // Search Console queries did not load: nothing can be compared, so nothing is recommended.
  organicMissing?: boolean;
  // Shown right under the headline: what changed since the last saved report.
  afterHeadline?: React.ReactNode;
  onOpenRecommendations: () => void;
}> = ({ recommendations, summary, settings = DEFAULT_SETTINGS, channelStats, globalMetrics, currencySymbol, periodDays, comparisonEnabled, isLoading, isSample, organicMissing = false, afterHeadline, onOpenRecommendations }) => {
  const { tr, rich, int, dec, pct, range, keywords, money: fmtMoney } = useI18n();
  const money = (value: number) => fmtMoney(currencySymbol, value);
  const money2 = (value: number) => fmtMoney(currencySymbol, value, 2);
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
  const hasConversionsAtRisk = summary.conversionsAtRisk.high >= 0.5;

  const headlineClass = 'jf-display text-3xl md:text-4xl xl:text-5xl mt-3 max-w-5xl';
  const subClass = 'text-base text-slate-200 mt-5 max-w-3xl';

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* 1. Headline: the one thing to take away */}
      <section className="relative overflow-hidden bg-black text-white rounded-2xl p-8 md:p-12 break-inside-avoid" aria-labelledby="summary-headline">
        <div className="absolute inset-0 bg-cover bg-center opacity-60 pointer-events-none" style={{ backgroundImage: 'url(/brand/jellyfish-waves.jpg)' }} aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/30 pointer-events-none" aria-hidden="true" />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#F8B133]">
            {tr('The headline')}{isSample ? tr(" (sample data, not a client's)") : ''}
          </p>
          {!hasRecs ? (
            <h3 id="summary-headline" className={headlineClass} role="status">
              {isLoading
                ? tr('Loading Google Ads keywords…')
                : tr('Nothing to recommend yet. Connect Google Ads and Search Console in Settings to see which keywords can take less paid spend and which need more.')}
            </h3>
          ) : organicMissing ? (
            <>
              <h3 id="summary-headline" className={headlineClass} role="status">
                {tr('No recommendation yet: Search Console did not load, so paid keywords cannot be compared with their organic position.')}
              </h3>
              <p className={subClass}>{tr("Connect Search Console in Settings, choose this client's site and refresh. Until then every keyword is kept as is.")}</p>
            </>
          ) : nReduce > 0 ? (
            <>
              <h3 id="summary-headline" className={headlineClass}>
                {nIncrease > 0
                  ? rich('You can cut paid search by about <hl>{amount} a month ({share})</hl> on {keywords} where you already rank at the top organically, and move {moved} of it to {moreKeywords} where organic is beyond page one.', {
                      amount: money(summary.spendCutMonthly), share: pct(summary.spendCutShare), keywords: keywords(nReduce),
                      moved: money(monthly(summary.spendToIncrease)), moreKeywords: keywords(nIncrease),
                    })
                  : rich('You can cut paid search by about <hl>{amount} a month ({share})</hl> on {keywords} where you already rank at the top organically.', {
                      amount: money(summary.spendCutMonthly), share: pct(summary.spendCutShare), keywords: keywords(nReduce),
                    })}
              </h3>
              <p className={subClass}>
                {tr('No keyword goes to zero: we keep a minimum everywhere so a competitor cannot take your ad slot.')}{' '}
                {hasConversionsAtRisk
                  ? tr('Expected loss: {clicks} clicks and {conversions} conversions in a period like this one, which is why we test in steps.', { clicks: range(summary.clicksAtRisk), conversions: range(summary.conversionsAtRisk) })
                  : tr('Expected loss: {clicks} clicks in a period like this one, which is why we test in steps.', { clicks: range(summary.clicksAtRisk) })}
              </p>
            </>
          ) : (
            <>
              <h3 id="summary-headline" className={headlineClass}>
                {nIncrease > 0
                  ? rich('No paid spend should come down this period. {keywords} where organic is beyond page one can take about <hl>{amount} more a month</hl>.', { keywords: keywords(nIncrease), amount: money(monthly(summary.spendToIncrease)) })
                  : tr('No change recommended this period. No keyword has both a top {n} organic result and room to cut safely.', { n: settings.maxRankForReduce })}
              </h3>
              <p className={subClass}>{tr('Keywords are only reduced when the organic result is in the top {n}, gets clicks, and the ad is not under pressure in the auction.', { n: settings.maxRankForReduce })}</p>
            </>
          )}
          <button
            type="button"
            onClick={onOpenRecommendations}
            className="print:hidden mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-[#F8B133] hover:bg-[#e09e2d] text-slate-950 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 ring-white"
          >
            {tr('See the keyword-by-keyword plan')} <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </section>

      {afterHeadline}

      {/* 2. Why it is worth testing */}
      {nReduce > 0 && (
        <section aria-labelledby="why-test">
          <h3 id="why-test" className="text-sm font-bold text-jf-gold mb-3">{tr('Why it is worth testing')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Tile
              label={tr('Real cost per added click')}
              value={summary.addedClickCost ? tr('{low} to {high}', { low: money2(summary.addedClickCost.low), high: money2(summary.addedClickCost.high) }) : '—'}
              note={summary.nominalCpc !== null
                ? tr('On these keywords an ad click looks like it costs {cpc}, but part of those clicks would have arrived through the organic result anyway. This is what each click the ads really add costs.', { cpc: money2(summary.nominalCpc) })
                : undefined}
            />
            <Tile
              label={tr('Expected loss')}
              value={tr('{clicks} clicks', { clicks: range(summary.clicksAtRisk) })}
              note={<>
                {summary.lossShareOfSearch
                  ? tr('{share} of all search clicks on these keywords (paid + organic)', { share: tr('{low} to {high}', { low: pct(summary.lossShareOfSearch.low), high: pct(summary.lossShareOfSearch.high) }) })
                  : tr('paid clicks organic is not expected to pick up')}
                {hasConversionsAtRisk ? tr(', and {conversions} conversions', { conversions: range(summary.conversionsAtRisk) }) : ''}.{' '}
                {tr('{clicks} of the clicks removed still arrive through your organic result.', { clicks: range(summary.clicksRecovered) })}
              </>}
            />
            <div className="bg-white p-5 rounded-2xl border border-slate-200 break-inside-avoid">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{tr('Auction pressure on these keywords')}</p>
              <ul className="mt-3 space-y-2">
                {pressureMix.map(m => (
                  <li key={m.level} className="flex items-center justify-between gap-3">
                    <PressureBadge pressure={m.level} />
                    <span className="text-sm font-semibold text-slate-900 tabular-nums">{keywords(m.count)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs font-medium text-slate-600 mt-3">{tr('How often your ad did not show or was outranked. The higher it is, the less we cut.')}</p>
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
                <h3 className="jf-display text-xl text-slate-900">{tr('Reduce here first')}</h3>
              </div>
              <p className="text-xs font-medium text-slate-600 mb-4">{tr('Largest savings where you already rank in the top {n} organically.', { n: settings.maxRankForReduce })}</p>
              {reductions.length === 0 ? (
                <p className="text-sm text-slate-600 py-6">{tr('Nothing to reduce in this period.')}</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {reductions.slice(0, 5).map(r => (
                    <li key={r.keyword} className="py-3 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 break-words">
                          {r.keyword}
                          {r.isBrand && <span className="ml-2 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 align-middle">{tr('Brand')}</span>}
                        </p>
                        <p className="text-xs font-medium text-slate-600 mt-1">
                          {tr('Organic position {rank} · may lose {clicks} clicks', { rank: r.organicRank === null ? '—' : dec(r.organicRank, 1), clicks: range(r.clicksAtRisk) })}
                        </p>
                        <p className="mt-1.5 flex items-center gap-2 text-xs font-medium text-slate-600">
                          {tr('Auction pressure')} <PressureBadge pressure={r.pressure} impressionShare={r.impressionShare} rankLostShare={r.rankLostShare} />
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-slate-900 tabular-nums whitespace-nowrap">{money(r.currentSpend)} → {money(r.suggestedSpend)}</p>
                        <p className={`text-xs font-semibold tabular-nums ${ACTION_STYLE.REDUCE.text}`}>
                          {tr('{change} · saves {amount}', { change: `${Math.round(r.changePct * 100)}%`, amount: money(r.spendCut) })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {reductions.length > 5 && <p className="text-xs font-medium text-slate-600 mt-3">{tr('And {n} more in the keyword plan.', { n: int(reductions.length - 5) })}</p>}
            </div>

            <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 break-inside-avoid">
              <div className="flex items-center gap-2 mb-1">
                <span className={`p-1.5 rounded-lg ${ACTION_STYLE.INCREASE.badge}`}><ArrowUpRight size={16} aria-hidden="true" /></span>
                <h3 className="jf-display text-xl text-slate-900">{tr('Add budget here')}</h3>
              </div>
              <p className="text-xs font-medium text-slate-600 mb-4">{tr('Organic is beyond page one, ads convert efficiently, and the ad is missing from part of the searches.')}</p>
              {increases.length === 0 ? (
                <p className="text-sm text-slate-600 py-6">{tr('No keyword meets the conditions in this period.')}</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {increases.slice(0, 5).map(r => {
                    const extra = r.suggestedSpend - r.currentSpend;
                    return (
                      <li key={r.keyword} className="py-3 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 break-words">{r.keyword}</p>
                          <p className="text-xs font-medium text-slate-600 mt-1">
                            {tr('Organic position {rank}', { rank: r.organicRank === null ? '—' : dec(r.organicRank, 1) })}
                            {r.rankLostShare !== null && tr(' · your ad did not show or was outranked on {share} of searches', { share: pct(r.rankLostShare) })}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-slate-900 tabular-nums whitespace-nowrap">{money(r.currentSpend)} → {money(r.suggestedSpend)}</p>
                          <p className={`text-xs font-semibold tabular-nums ${ACTION_STYLE.INCREASE.text}`}>
                            +{money(extra)}{r.expectedExtraConversions && r.expectedExtraConversions >= 0.5 ? tr(' · about {n} more conversions', { n: int(r.expectedExtraConversions) }) : ''}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {increases.length > 0 && <p className="text-xs font-medium text-slate-600 mt-3">{tr("Extra conversions are an estimate at today's cost per conversion.")}</p>}
            </div>
          </div>

          {(nReduce > 0 || nIncrease > 0) && (
            <p className="bg-white px-6 py-4 rounded-2xl border border-slate-200 text-sm font-medium text-slate-700 break-inside-avoid">
              <span className="font-bold text-slate-900">{tr('Net effect in a period like this one:')}</span>{' '}
              {tr('{down} down, {up} up,', { down: money(summary.spendCut), up: money(summary.spendToIncrease) })}{' '}
              <span className="font-bold text-slate-900">
                {summary.netChange >= 0 ? tr('{amount} saved', { amount: money(summary.netChange) }) : tr('{amount} more invested', { amount: money(-summary.netChange) })}
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
            <h3 className="jf-display text-xl text-slate-900">{tr('How to run the test')}</h3>
          </div>
          <ol className="space-y-2 text-sm text-slate-600 list-decimal pl-5">
            <li>{tr('Start with the reductions under low auction pressure. Lower bids or budgets in steps, not at once.')}</li>
            <li>{tr('Watch total clicks and conversions for each keyword (paid + organic), not paid alone.')}</li>
            <li>{tr('Run each step for two weeks. Stop and go back one step if total clicks on a keyword fall by more than the upper figure shown here.')}</li>
            <li>{tr('Move part of the saving to the keywords in "Add budget here".')}</li>
          </ol>
        </section>
        <section className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 break-inside-avoid">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={16} className="text-slate-600" aria-hidden="true" />
            <h3 className="jf-display text-xl text-slate-900">{tr('Assumptions')}</h3>
          </div>
          <ul className="space-y-2 text-sm text-slate-600 list-disc pl-5">
            <li>{tr('These are estimates to design a test, not a forecast.')}</li>
            <li>{tr('The share of clicks that still arrive ({rank1} at organic position 1, {rank2to4} at positions 2 to 4) starts from a Google study across industries from 2012. Your own test will replace it.', { rank1: pct(settings.recovery.rank1), rank2to4: pct(settings.recovery.rank2to4) })}</li>
            <li>{tr('The more often your ad does not show or is outranked on a keyword, the smaller the cut. Brand terms are cut less. A keyword with no organic data for its exact text is kept as is.')}</li>
            {hasRecs && (
              <li>{tr('Only keywords with at least {min} paid clicks in the period are judged: {judged} of {total} keywords, covering {share} of spend.', {
                min: settings.minPaidClicks, judged: int(summary.judgedKeywords), total: int(recommendations.length), share: pct(summary.judgedSpendShare),
              })}</li>
            )}
            <li>{tr('Organic and Paid mean Organic Search and Paid Search only. Social, shopping and video are left out.')}</li>
          </ul>
        </section>
      </div>

      {/* 6. Context: background, not argument */}
      <section aria-labelledby="summary-context">
        <h3 id="summary-context" className="text-sm font-bold text-jf-gold mb-3">{tr('Search in this period')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {hasSessions ? (
            <>
              <Tile label={tr('Organic Search sessions')} value={int(organicSessions)} note="GA4" change={comparisonEnabled ? channelStats.organic.changes.sessions : undefined} />
              <Tile label={tr('Paid Search sessions')} value={int(paidSessions)} note="GA4" change={comparisonEnabled ? channelStats.paid.changes.sessions : undefined} />
              <Tile label={tr('Paid share of search')} value={pct(paidSessions / searchSessions)} note={tr('of search sessions come through ads')} />
            </>
          ) : (
            <div className="sm:col-span-2 lg:col-span-3 bg-white p-5 rounded-2xl border border-dashed border-slate-300 text-sm font-medium text-slate-600 flex items-center">
              {tr('Connect GA4 in Settings to see organic and paid sessions here.')}
            </div>
          )}
          <Tile
            label={tr('Spend on keywords analysed')}
            value={money(summary.spendAnalysed)}
            note={globalMetrics && Math.round(globalMetrics.totalCost) !== Math.round(summary.spendAnalysed)
              ? tr('Google Ads, this period. Whole account: {amount}.', { amount: money(globalMetrics.totalCost) })
              : tr('Google Ads, this period')}
          />
        </div>
      </section>
    </div>
  );
};
