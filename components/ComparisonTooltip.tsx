
import React from 'react';

export const ComparisonTooltip = ({ active, payload, label, currency = false, currencySymbol = '£', percent = false }: any) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0].payload;
    const currentDate = dataPoint.fullDateCurrent;
    const prevDate = dataPoint.fullDatePrevious;

    return (
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-white/10 min-w-[220px]">
        <div className="mb-3 border-b border-white/10 pb-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current: <span className="text-white">{currentDate}</span></p>
          {prevDate && <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Previous: <span className="text-white">{prevDate}</span></p>}
        </div>

        <div className="space-y-3">
          {payload.map((entry: any, index: number) => {
            if (entry.name.includes('(Prev)')) return null; 
            const prevEntry = payload.find((p: any) => p.name === entry.name.replace('(Cur)', '(Prev)'));
            const curVal = entry.value;
            const prevVal = prevEntry ? prevEntry.value : null;
            const diff = prevVal !== null && prevVal !== 0 ? ((curVal - prevVal) / prevVal) * 100 : 0;

            return (
              <div key={index} className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.stroke || entry.color }} />
                  <span className="text-[10px] font-black text-white">{entry.name.replace('(Cur)', '')}</span>
                </div>
                <div className="flex justify-between items-baseline gap-4 ml-4">
                  <span className="text-[11px] font-bold">
                    {currency ? `${currencySymbol}${curVal.toLocaleString()}` : percent ? `${curVal.toFixed(1)}%` : curVal.toLocaleString()}
                  </span>
                  {prevVal !== null && (
                    <div className={`flex items-center text-[9px] font-black ${diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {diff >= 0 ? '+' : ''}{diff.toFixed(1)}%
                    </div>
                  )}
                </div>
                {prevVal !== null && (
                  <div className="flex justify-between text-[8px] text-slate-500 ml-4 font-medium uppercase italic">
                    <span>Prev Period:</span>
                    <span>{currency ? `${currencySymbol}${prevVal.toLocaleString()}` : percent ? `${prevVal.toFixed(1)}%` : prevVal.toLocaleString()}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};
