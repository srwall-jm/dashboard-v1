import React from 'react';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';
import {
  RecommendationOverrides, RecommendationSettings, overridesFromSettings, isDefaultSettings, MAX_ALLOWED_CUT,
} from '../recommendations';

type Key = keyof RecommendationOverrides;

const PercentField: React.FC<{
  label: string;
  value: number; // share, 0.35 = 35%
  max: number; // percent
  onChange: (share: number) => void;
}> = ({ label, value, max, onChange }) => (
  <label className="block">
    <span className="block text-[11px] font-bold text-slate-500 mb-1">{label}</span>
    <span className="relative block">
      <input
        type="number"
        min={0}
        max={max}
        step={1}
        value={Math.round(value * 100)}
        onChange={e => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n / 100);
        }}
        className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold p-2.5 pr-7 outline-none focus:ring-2 ring-amber-400 tabular-nums"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-500">%</span>
    </span>
  </label>
);

// Settings block with the rules behind the keyword recommendations, for the client in use.
export const RecommendationRulesPanel: React.FC<{
  settings: RecommendationSettings;
  onChange: (overrides: RecommendationOverrides | null) => void; // null = back to defaults
  clientLabel?: string;
  sharedProfilesAvailable?: boolean;
}> = ({ settings, onChange, clientLabel, sharedProfilesAvailable }) => {
  const values = overridesFromSettings(settings);
  const set = (key: Key, value: number) => onChange({ ...values, [key]: value });
  const maxCutPct = Math.round(MAX_ALLOWED_CUT * 100);

  return (
    <section>
      <div className="flex items-center justify-between gap-2 mb-2 text-slate-900">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-slate-100 rounded-lg"><SlidersHorizontal size={16} className="text-indigo-600" /></div>
          <h3 className="text-sm font-bold">3. Recommendation rules (optional)</h3>
        </div>
        <button
          onClick={() => onChange(null)}
          disabled={isDefaultSettings(settings)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-500 hover:border-slate-400 disabled:opacity-40"
        >
          <RotateCcw size={11} /> Defaults
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        How far paid spend may be cut on a keyword{clientLabel ? <> for <strong>{clientLabel}</strong></> : ''}. A cut can never exceed {maxCutPct}%, so spend never goes to zero,
        and it can only stay equal or shrink as competition rises.
        {sharedProfilesAvailable ? ' Saved in this browser; press Update in "Shared clients" to share it with the team.' : ' Saved for this client in this browser.'}
      </p>

      <div className="bg-white p-5 rounded-2xl border border-slate-100 space-y-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-900 mb-2">Largest cut, non-brand keywords</p>
          <div className="grid grid-cols-3 gap-3">
            <PercentField label="Low competition" value={values.cutNonBrandLow} max={maxCutPct} onChange={v => set('cutNonBrandLow', v)} />
            <PercentField label="Medium" value={values.cutNonBrandMedium} max={maxCutPct} onChange={v => set('cutNonBrandMedium', v)} />
            <PercentField label="High" value={values.cutNonBrandHigh} max={maxCutPct} onChange={v => set('cutNonBrandHigh', v)} />
          </div>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-900 mb-2">Largest cut, brand keywords</p>
          <div className="grid grid-cols-3 gap-3">
            <PercentField label="Low competition" value={values.cutBrandLow} max={maxCutPct} onChange={v => set('cutBrandLow', v)} />
            <PercentField label="Medium" value={values.cutBrandMedium} max={maxCutPct} onChange={v => set('cutBrandMedium', v)} />
            <PercentField label="High" value={values.cutBrandHigh} max={maxCutPct} onChange={v => set('cutBrandHigh', v)} />
          </div>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-900 mb-2">Clicks organic keeps when paid is cut</p>
          <div className="grid grid-cols-3 gap-3">
            <PercentField label="Organic position 1" value={values.recoveryRank1} max={95} onChange={v => set('recoveryRank1', v)} />
            <PercentField label="Positions 2 to 4" value={values.recoveryRank2to4} max={95} onChange={v => set('recoveryRank2to4', v)} />
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">Replace the defaults with this client's own test results when you have them.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <PercentField label="Step when increasing" value={values.increaseStep} max={100} onChange={v => set('increaseStep', v)} />
          <label className="block">
            <span className="block text-[11px] font-bold text-slate-500 mb-1">Minimum paid clicks</span>
            <input
              type="number"
              min={1}
              step={1}
              value={values.minPaidClicks}
              onChange={e => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) set('minPaidClicks', n);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold p-2.5 outline-none focus:ring-2 ring-amber-400 tabular-nums"
            />
          </label>
        </div>
        <p className="text-[11px] text-slate-500">Step when increasing: how much to raise spend per step on "increase" keywords. Minimum paid clicks: keywords below this number in the period get no recommendation.</p>
      </div>
    </section>
  );
};
