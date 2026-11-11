import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { DELTA } from '../theme';

interface KpiCardProps {
  title: string;
  value: string | number;
  comparison?: number;
  absoluteChange?: number;
  icon: React.ReactNode;
  color?: string; // kept for callers; icons are neutral so colour never suggests a meaning it does not have
  isPercent?: boolean;
  prefix?: string;
}

const num = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 });

export const KpiCard: React.FC<KpiCardProps> = ({ title, value, comparison, absoluteChange, icon, isPercent = false, prefix = '' }) => {
  const hasComparison = comparison !== undefined && !isNaN(comparison);
  const direction = !hasComparison || comparison === 0 ? 'flat' : comparison! > 0 ? 'up' : 'down';
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 h-full flex flex-col justify-between break-inside-avoid">
      <div className="flex justify-between items-start gap-2 mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 leading-tight">{title}</p>
        <span className="text-slate-400 flex-shrink-0" aria-hidden="true">
          {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-4 h-4' })}
        </span>
      </div>
      <div>
        <p className="jf-figure text-4xl text-slate-900 tabular-nums break-words">
          {typeof value === 'number' && !isPercent ? num(value) : value}
        </p>
        {hasComparison && (
          <p className={`mt-1.5 flex items-center gap-1 text-xs font-semibold tabular-nums ${DELTA[direction]}`}>
            {direction === 'up' ? <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" /> : direction === 'down' ? <ArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" /> : <Minus className="w-3.5 h-3.5" aria-hidden="true" />}
            {direction === 'flat' ? 'No change' : `${comparison! > 0 ? '+' : '-'}${Math.abs(comparison!).toFixed(1)}%`}
            {absoluteChange !== undefined && direction !== 'flat' && (
              <span className="font-medium text-slate-600">({absoluteChange >= 0 ? '+' : '-'}{prefix}{num(Math.abs(absoluteChange))})</span>
            )}
            <span className="font-medium text-slate-600">vs previous</span>
          </p>
        )}
      </div>
    </div>
  );
};
