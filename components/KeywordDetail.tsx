// One keyword, week by week. Three small charts on the same weeks, each with its own scale:
// paid spend, clicks (paid and organic stacked) and organic position.
// Opened from the keyword list; not part of the printed report.

import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { KeywordRecommendation } from '../recommendations';
import { DetailWeek, weekIndexOf, summarizeWeeks } from '../keywordDetail';
import { PlanItem } from '../plan';
import { SERIES, ACTION_STYLE } from '../theme';
import { useI18n } from '../i18n';

export type LoadKeywordDetail = (keyword: string) => Promise<{ weeks: DetailWeek[]; notes: string[] }>;

const CHART_H = 96;

const shortDate = (iso: string, lang: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-GB', { day: 'numeric', month: 'short' });
};

// Bars for one or two stacked series. The applied week carries a marker above its column.
const WeekBars: React.FC<{
  weeks: DetailWeek[];
  series: { color: string; pick: (w: DetailWeek) => number; label: string }[];
  format: (v: number) => string;
  appliedIndex: number;
  lang: string;
}> = ({ weeks, series, format, appliedIndex, lang }) => {
  const { tr } = useI18n();
  const max = Math.max(1, ...weeks.map(w => series.reduce((sum, s) => sum + s.pick(w), 0)));
  return (
    <div>
      <div className="flex items-end gap-[3px] border-b border-slate-300" style={{ height: CHART_H }}>
        {weeks.map((w, i) => {
          const total = series.reduce((sum, s) => sum + s.pick(w), 0);
          const title = `${shortDate(w.start, lang)} – ${shortDate(w.end, lang)}: ${series.map(s => `${s.label} ${format(s.pick(w))}`).join(' · ')}`;
          return (
            <div key={w.start} className="flex-1 h-full flex flex-col justify-end gap-[2px] relative" title={title}>
              {i === appliedIndex && <span className="absolute inset-y-0 -left-[2px] border-l-2 border-dashed border-slate-900" aria-hidden="true" />}
              {[...series].reverse().map(s => {
                const value = s.pick(w);
                return value > 0 ? <div key={s.label} className="w-full rounded-t-[3px]" style={{ height: `${(value / max) * 100}%`, minHeight: 2, backgroundColor: s.color }} /> : null;
              })}
              {total === 0 && <div className="w-full h-px bg-slate-300" />}
            </div>
          );
        })}
      </div>
      <p className="mt-1 text-[11px] font-medium text-slate-500 tabular-nums">{tr('highest week: {value}', { value: format(max) })}</p>
    </div>
  );
};

// Organic position: 1 at the top, a gap where the result was not shown.
const PositionLine: React.FC<{ weeks: DetailWeek[]; appliedIndex: number; dec: (v: number, d: number) => string; lang: string; label: string }> = ({ weeks, appliedIndex, dec, lang, label }) => {
  const seen = weeks.filter(w => w.organicPosition !== null).map(w => w.organicPosition as number);
  if (seen.length === 0) return null;
  const worst = Math.max(3, Math.ceil(Math.max(...seen)));
  const W = 600;
  const step = W / weeks.length;
  const x = (i: number) => step * i + step / 2;
  const y = (pos: number) => 8 + ((pos - 1) / Math.max(1, worst - 1)) * (CHART_H - 16);
  const segments: string[] = [];
  let current = '';
  weeks.forEach((w, i) => {
    if (w.organicPosition === null) { if (current) segments.push(current); current = ''; return; }
    current += `${current ? 'L' : 'M'}${x(i).toFixed(1)},${y(w.organicPosition).toFixed(1)} `;
  });
  if (current) segments.push(current);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${CHART_H}`} className="w-full border-b border-slate-300" style={{ height: CHART_H }} preserveAspectRatio="none" role="img" aria-label={label}>
        <line x1="0" x2={W} y1={y(1)} y2={y(1)} stroke={SERIES.grid} strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {appliedIndex >= 0 && <line x1={step * appliedIndex} x2={step * appliedIndex} y1="0" y2={CHART_H} stroke="#141414" strokeWidth="2" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
        {segments.map((d, i) => <path key={i} d={d} fill="none" stroke={SERIES.organic} strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
        {weeks.map((w, i) => w.organicPosition === null ? null : (
          <circle key={w.start} cx={x(i)} cy={y(w.organicPosition)} r="4" fill={SERIES.organic} stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke">
            <title>{`${shortDate(w.start, lang)} – ${shortDate(w.end, lang)}: ${dec(w.organicPosition, 1)}`}</title>
          </circle>
        ))}
      </svg>
      <p className="mt-1 text-[11px] font-medium text-slate-500 tabular-nums">1 ↑ · {worst} ↓</p>
    </div>
  );
};

export const KeywordDetail: React.FC<{
  rec: KeywordRecommendation;
  planItem?: PlanItem;
  currencySymbol: string;
  load: LoadKeywordDetail;
  onClose: () => void;
}> = ({ rec, planItem, currencySymbol, load, onClose }) => {
  const i18n = useI18n();
  const { tr, lang, int, dec } = i18n;
  const money = (v: number) => i18n.money(currencySymbol, v);
  const [state, setState] = useState<{ weeks: DetailWeek[]; notes: string[] } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    setState(null);
    setFailed(null);
    load(rec.keyword).then(result => { if (alive) setState(result); }).catch(err => { if (alive) setFailed(err?.message || 'request failed'); });
    return () => { alive = false; };
  }, [rec.keyword]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const weeks = state?.weeks || [];
  const appliedIndex = weekIndexOf(weeks, planItem?.appliedOn);
  const summary = summarizeWeeks(weeks);
  const signed = (v: number) => `${v > 0 ? '+' : '−'}${Math.abs(Math.round(v * 100))}%`;
  const style = ACTION_STYLE[rec.action];
  const hasData = weeks.some(w => w.paidCost > 0 || w.paidClicks > 0 || w.organicClicks > 0 || w.organicPosition !== null);

  const chart = (title: string, legend: { color: string; label: string }[], body: React.ReactNode) => (
    <section className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h4 className="text-[13px] font-bold text-slate-900">{title}</h4>
        {legend.length > 1 && (
          <ul className="flex gap-4 text-xs font-medium text-slate-600">
            {legend.map(l => <li key={l.label} className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: l.color }} aria-hidden="true" />{l.label}</li>)}
          </ul>
        )}
      </div>
      <div className="mt-2">{body}</div>
    </section>
  );

  return (
    <div className="print:hidden fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 md:p-10" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="keyword-detail-title" className="w-full max-w-3xl bg-white rounded-2xl border border-slate-200 p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{tr('Keyword, week by week')}</p>
            <h3 id="keyword-detail-title" className="jf-display text-2xl text-slate-900 break-words">{rec.keyword}</h3>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
              <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-semibold ${style.badge}`}>
                {tr(style.label)}{rec.changePct !== 0 ? ` ${rec.changePct > 0 ? '+' : '−'}${Math.abs(Math.round(rec.changePct * 100))}%` : ''}
              </span>
              {rec.changePct !== 0 && <span className="tabular-nums">{money(rec.currentSpend)} → {money(rec.suggestedSpend)}</span>}
            </p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={tr('Close')} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 ring-slate-900/30 flex-shrink-0">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-3 text-sm text-slate-700">{i18n.reason(rec)}</p>

        {failed ? (
          <p className="mt-6 text-sm text-slate-700" role="alert">{tr('The weekly figures could not be loaded ({reason}).', { reason: failed })}</p>
        ) : !state ? (
          <p className="mt-6 text-sm text-slate-600" role="status">{tr('Loading the last {n} weeks…', { n: 12 })}</p>
        ) : !hasData ? (
          <p className="mt-6 text-sm text-slate-700">{tr('No clicks or spend were found for this keyword in these weeks.')}</p>
        ) : (
          <>
            <p className="mt-4 text-xs font-medium text-slate-600">
              {tr('{n} weeks, from {start} to {end}.', { n: weeks.length, start: shortDate(weeks[0].start, lang), end: shortDate(weeks[weeks.length - 1].end, lang) })}
              {appliedIndex >= 0 && <> <span className="font-semibold text-slate-900">{tr('The dashed line marks the week the change was applied ({date}).', { date: planItem?.appliedOn || '' })}</span></>}
            </p>

            <p className="mt-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-800">
              {tr('Last four weeks against the first four:')}{' '}
              {[
                summary.spendChange !== null ? tr('paid spend {change}', { change: signed(summary.spendChange) }) : '',
                summary.totalClicksChange !== null ? tr('total clicks {change}', { change: signed(summary.totalClicksChange) }) : '',
                summary.positionFirst !== null && summary.positionLast !== null ? tr('organic position {from} → {to}', { from: dec(summary.positionFirst, 1), to: dec(summary.positionLast, 1) }) : '',
              ].filter(Boolean).join(' · ')}.
            </p>

            {chart(tr('Paid spend per week'), [], (
              <WeekBars weeks={weeks} series={[{ color: SERIES.paid, pick: w => w.paidCost, label: tr('Paid spend') }]} format={money} appliedIndex={appliedIndex} lang={lang} />
            ))}
            {chart(tr('Clicks per week'), [{ color: SERIES.paid, label: tr('Paid') }, { color: SERIES.organic, label: tr('Organic') }], (
              <WeekBars
                weeks={weeks}
                series={[{ color: SERIES.paid, pick: w => w.paidClicks, label: tr('Paid') }, { color: SERIES.organic, pick: w => w.organicClicks, label: tr('Organic') }]}
                format={int}
                appliedIndex={appliedIndex}
                lang={lang}
              />
            ))}
            {chart(tr('Organic position per week (1 is the top)'), [], (
              weeks.some(w => w.organicPosition !== null)
                ? <PositionLine weeks={weeks} appliedIndex={appliedIndex} dec={dec} lang={lang} label={tr('Organic position per week (1 is the top)')} />
                : <p className="text-sm text-slate-600">{tr('No organic result was shown for this keyword in these weeks.')}</p>
            ))}
            <div className="mt-1 flex justify-between text-[11px] font-medium text-slate-500">
              <span>{shortDate(weeks[0].start, lang)}</span>
              <span>{shortDate(weeks[weeks.length - 1].end, lang)}</span>
            </div>

            <details className="mt-6">
              <summary className="text-xs font-semibold text-slate-700 cursor-pointer">{tr('The same figures as a table')}</summary>
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-left text-xs tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-600">
                      <th scope="col" className="py-2 pr-3 font-semibold">{tr('Week from')}</th>
                      <th scope="col" className="py-2 px-3 font-semibold text-right">{tr('Paid spend')}</th>
                      <th scope="col" className="py-2 px-3 font-semibold text-right">{tr('Paid clicks')}</th>
                      <th scope="col" className="py-2 px-3 font-semibold text-right">{tr('Organic clicks')}</th>
                      <th scope="col" className="py-2 pl-3 font-semibold text-right">{tr('Organic position')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeks.map((w, i) => (
                      <tr key={w.start} className={`border-b border-slate-100 ${i === appliedIndex ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                        <td className="py-1.5 pr-3">{shortDate(w.start, lang)}{i === appliedIndex ? ` · ${tr('applied')}` : ''}</td>
                        <td className="py-1.5 px-3 text-right">{money(w.paidCost)}</td>
                        <td className="py-1.5 px-3 text-right">{int(w.paidClicks)}</td>
                        <td className="py-1.5 px-3 text-right">{int(w.organicClicks)}</td>
                        <td className="py-1.5 pl-3 text-right">{w.organicPosition === null ? '—' : dec(w.organicPosition, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            <p className="mt-4 text-xs text-slate-600">
              {tr('Organic figures add the keyword text and the main searches behind it. Weeks are blocks of seven days ending on the last day with complete data. Seasonality and promotions are in these figures too.')}
            </p>
            {state.notes.map(note => <p key={note} className="mt-1 text-xs font-medium text-[#B45309]">{note}</p>)}
          </>
        )}
      </div>
    </div>
  );
};
