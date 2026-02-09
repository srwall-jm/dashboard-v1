
import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { DashboardFilters } from '../types';
import { formatDate, getStartOfWeek } from '../utils';

export const DateRangeSelector: React.FC<{
  filters: DashboardFilters;
  setFilters: (f: DashboardFilters) => void;
}> = ({ filters, setFilters }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const ranges = [
    { label: 'Today', getValue: () => { const d = new Date(); return { start: d, end: d }; } },
    { label: 'Yesterday', getValue: () => { const d = new Date(); d.setDate(d.getDate() - 1); return { start: d, end: d }; } },
    { label: 'This week', getValue: () => { const d = new Date(); const start = getStartOfWeek(d); return { start, end: d }; } },
    { label: 'This month', getValue: () => { const d = new Date(); return { start: new Date(d.getFullYear(), d.getMonth(), 1), end: new Date(d.getFullYear(), d.getMonth() + 1, 0) }; } },
    { label: 'This month to date', getValue: () => { const d = new Date(); return { start: new Date(d.getFullYear(), d.getMonth(), 1), end: d }; } },
    { label: 'This quarter', getValue: () => { const d = new Date(); const q = Math.floor(d.getMonth() / 3); return { start: new Date(d.getFullYear(), q * 3, 1), end: new Date(d.getFullYear(), (q + 1) * 3, 0) }; } },
    { label: 'This quarter to date', getValue: () => { const d = new Date(); const q = Math.floor(d.getMonth() / 3); return { start: new Date(d.getFullYear(), q * 3, 1), end: d }; } },
    { label: 'This year', getValue: () => { const d = new Date(); return { start: new Date(d.getFullYear(), 0, 1), end: new Date(d.getFullYear(), 11, 31) }; } },
    { label: 'This year to date', getValue: () => { const d = new Date(); return { start: new Date(d.getFullYear(), 0, 1), end: d }; } },
    { label: 'Last 7 days', getValue: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 7); return { start, end }; } },
    { label: 'Last 14 days', getValue: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 14); return { start, end }; } },
    { label: 'Last 28 days', getValue: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 28); return { start, end }; } },
    { label: 'Last 30 days', getValue: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 30); return { start, end }; } },
    { label: 'Last week', getValue: () => { const d = new Date(); d.setDate(d.getDate() - 7); const start = getStartOfWeek(d); const end = new Date(start); end.setDate(end.getDate() + 6); return { start, end }; } },
    { label: 'Last month', getValue: () => { const d = new Date(); return { start: new Date(d.getFullYear(), d.getMonth() - 1, 1), end: new Date(d.getFullYear(), d.getMonth(), 0) }; } },
    { label: 'Last quarter', getValue: () => { const d = new Date(); const q = Math.floor(d.getMonth() / 3) - 1; return { start: new Date(d.getFullYear(), q * 3, 1), end: new Date(d.getFullYear(), (q + 1) * 3, 0) }; } },
    { label: 'Last year', getValue: () => { const d = new Date(); return { start: new Date(d.getFullYear() - 1, 0, 1), end: new Date(d.getFullYear() - 1, 11, 31) }; } },
  ];

  const handleRangeSelect = (range: any) => {
    const { start, end } = range.getValue();
    setFilters({ ...filters, dateRange: { start: formatDate(start), end: formatDate(end) } });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-indigo-300 transition-all text-[10px] font-bold h-full"
      >
        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
        <span className="text-slate-900">{filters.dateRange.start}</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-900">{filters.dateRange.end}</span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-[480px] bg-white rounded-3xl shadow-2xl border border-slate-200 z-[100] overflow-hidden flex animate-in fade-in zoom-in-95 duration-200">
          <div className="w-1/2 border-r border-slate-100 bg-slate-50/50 max-h-[420px] overflow-y-auto custom-scrollbar">
            <div className="p-2 grid grid-cols-1 gap-0.5">
              {ranges.map((r) => (
                <button
                  key={r.label}
                  onClick={() => handleRangeSelect(r)}
                  className="px-4 py-2 text-left text-[10px] font-black uppercase text-slate-600 hover:bg-white hover:text-indigo-600 hover:shadow-sm rounded-xl transition-all"
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="w-1/2 p-6 flex flex-col gap-6">
            <div>
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Custom Range</h4>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-500 uppercase">Start Date</label>
                  <input 
                    type="date" 
                    value={filters.dateRange.start} 
                    onChange={e => setFilters({...filters, dateRange: {...filters.dateRange, start: e.target.value}})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:ring-1 ring-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-500 uppercase">End Date</label>
                  <input 
                    type="date" 
                    value={filters.dateRange.end} 
                    onChange={e => setFilters({...filters, dateRange: {...filters.dateRange, end: e.target.value}})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:ring-1 ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-auto pt-6 border-t border-slate-100 space-y-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="comp_enabled_drop" 
                      checked={filters.comparison.enabled} 
                      onChange={e => setFilters({...filters, comparison: {...filters.comparison, enabled: e.target.checked}})} 
                      className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                    />
                    <label htmlFor="comp_enabled_drop" className="text-[10px] font-black uppercase text-slate-600 tracking-tight cursor-pointer">Compare</label>
                  </div>
                </div>
                {filters.comparison.enabled && (
                  <select 
                    className="w-full bg-white border border-slate-200 rounded-xl text-[10px] font-bold p-2 outline-none focus:ring-1 ring-indigo-500 shadow-sm" 
                    value={filters.comparison.type} 
                    onChange={e => setFilters({...filters, comparison: {...filters.comparison, type: e.target.value as any}})}
                  >
                    <option value="previous_period">vs Previous Period</option>
                    <option value="previous_year">vs Previous Year (YoY)</option>
                  </select>
                )}
              </div>

              <button 
                onClick={() => setIsOpen(false)}
                className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-lg"
              >
                Apply Range
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
