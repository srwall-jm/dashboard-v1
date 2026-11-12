import React from 'react';
import { FileText } from 'lucide-react';
import { SERIES } from '../theme';

export interface ShareRow {
  label: string;
  value: number;
  percent: number; // 0 to 100
}

// Shares of a whole as sorted horizontal bars with the figures written out.
// Used instead of donuts: it reads at a distance, prints in greyscale and needs no hover.
export const ShareBars: React.FC<{
  title: string;
  subtitle?: string;
  rows: ShareRow[];
  formatValue: (value: number) => string;
  // Optional big figure above the bars, e.g. "62.4%" with a line saying what it is.
  headline?: string;
  headlineLabel?: string;
  // One colour for all bars, or one per row (in the order given) when rows are different things.
  colors?: string[];
  maxRows?: number; // rows beyond this are grouped as "Other"
  keepOrder?: boolean; // do not sort (when the order means something)
  onExport?: () => void;
}> = ({ title, subtitle, rows, formatValue, headline, headlineLabel, colors = [SERIES.organic], maxRows = 7, keepOrder = false, onExport }) => {
  const ordered = keepOrder ? rows : [...rows].sort((a, b) => b.value - a.value);
  const shown = ordered.slice(0, maxRows);
  const rest = ordered.slice(maxRows);
  if (rest.length > 0) {
    shown.push({
      label: `Other (${rest.length})`,
      value: rest.reduce((sum, r) => sum + r.value, 0),
      percent: rest.reduce((sum, r) => sum + r.percent, 0),
    });
  }
  const colorOf = (index: number, isOther: boolean) => (isOther ? SERIES.context : colors[Math.min(index, colors.length - 1)]);

  return (
    <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 h-full flex flex-col break-inside-avoid">
      <div className="flex justify-between items-start gap-3 mb-5">
        <div>
          <h4 className="jf-display text-xl text-slate-900">{title}</h4>
          {subtitle && <p className="text-xs font-medium text-slate-600 mt-0.5">{subtitle}</p>}
        </div>
        {onExport && (
          <button type="button" onClick={onExport} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 flex-shrink-0">
            <FileText size={14} aria-hidden="true" /> Export CSV
          </button>
        )}
      </div>

      {headline && (
        <p className="mb-5">
          <span className="block jf-figure text-5xl text-slate-900 tabular-nums">{headline}</span>
          {headlineLabel && <span className="block text-xs font-medium text-slate-600 mt-1">{headlineLabel}</span>}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="text-sm text-slate-600 py-6">No data for this period.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((row, i) => {
            const isOther = rest.length > 0 && i === shown.length - 1;
            return (
              <li key={row.label}>
                <div className="flex justify-between items-baseline gap-3 text-[13px]">
                  <span className="font-semibold text-slate-900 truncate">{row.label}</span>
                  <span className="font-medium text-slate-700 tabular-nums whitespace-nowrap">
                    {formatValue(row.value)} · <span className="font-bold text-slate-900">{row.percent.toFixed(1)}%</span>
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 rounded-full bg-slate-100 overflow-hidden" role="presentation">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, row.percent))}%`, backgroundColor: colorOf(i, isOther) }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
