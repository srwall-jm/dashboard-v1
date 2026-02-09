
import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface KpiCardProps { 
  title: string; 
  value: string | number; 
  comparison?: number; 
  absoluteChange?: number;
  icon: React.ReactNode; 
  color?: string; 
  isPercent?: boolean;
  prefix?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({ title, value, comparison, absoluteChange, icon, color = "indigo", isPercent = false, prefix = "" }) => (
  <div className="bg-white p-4 lg:p-6 rounded-[24px] border border-slate-200 shadow-sm hover:shadow-md transition-all group h-full flex flex-col justify-between">
    <div className="flex justify-between items-start mb-2 lg:mb-4">
      <div className={`p-2 lg:p-3 bg-${color}-50 text-${color}-600 rounded-2xl group-hover:scale-110 transition-transform flex-shrink-0`}>
        {React.cloneElement(icon as React.ReactElement<any>, { className: "w-4 h-4 lg:w-5 lg:h-5" })}
      </div>

      {comparison !== undefined && !isNaN(comparison) && (
        <div className="text-right ml-2">
          <div className={`flex items-center text-[10px] lg:text-[11px] font-bold px-2 py-0.5 lg:py-1 rounded-full whitespace-nowrap ${comparison >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {comparison >= 0 ? <ArrowUpRight className="w-2.5 h-2.5 lg:w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-2.5 h-2.5 lg:w-3 h-3 mr-0.5" />}
            {Math.abs(comparison).toFixed(1)}%
          </div>
          {absoluteChange !== undefined && (
            <div className={`text-[8px] lg:text-[9px] font-black mt-0.5 lg:mt-1 ${absoluteChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {absoluteChange >= 0 ? '+' : ''}{prefix}{absoluteChange.toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>

    <div>
      <p className="text-slate-400 text-[8px] lg:text-[9px] font-black uppercase tracking-[0.15em] mb-0.5 lg:mb-1 leading-tight">
        {title}
      </p>
      <h3 className="text-lg md:text-xl lg:text-2xl font-black text-slate-900 tracking-tight truncate leading-none">
        {typeof value === 'number' && !isPercent ? value.toLocaleString() : value}
      </h3>
    </div>
  </div>
);
