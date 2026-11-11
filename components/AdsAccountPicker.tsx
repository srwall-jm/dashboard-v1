import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { GoogleAdsCustomer } from '../types';

// Checklist of the Google Ads accounts under the chosen manager account.
// Only the ticked ones are read for the client in use.
export const AdsAccountPicker: React.FC<{
  accounts: GoogleAdsCustomer[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  clientLabel?: string;
}> = ({ accounts, selectedIds, onChange, clientLabel }) => {
  const [search, setSearch] = useState('');
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return accounts
      .filter(a => !term || (a.descriptiveName || '').toLowerCase().includes(term) || a.id.includes(term))
      .sort((a, b) => Number(selected.has(b.id)) - Number(selected.has(a.id)) || (a.descriptiveName || '').localeCompare(b.descriptiveName || ''));
    // Sorting uses the selection at the time the list is filtered, so rows do not jump while ticking.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, search]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(accounts.filter(a => next.has(a.id)).map(a => a.id));
  };

  return (
    <div className="mt-8 pt-6 border-t border-slate-100">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-3">
        <div>
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-1">
            Google Ads accounts for this client
          </label>
          <p className="text-[11px] text-slate-500 max-w-xl">
            Tick the accounts that belong to {clientLabel ? <strong>{clientLabel}</strong> : 'the GA4 property and Search Console site in use'}.
            Only these are read. The choice is saved for this client in this browser.
          </p>
        </div>
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black whitespace-nowrap ${selected.size > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {selected.size} of {accounts.length} chosen
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or account ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-400"
          />
        </div>
        <button
          onClick={() => onChange(Array.from(new Set([...selectedIds, ...visible.map(a => a.id)])))}
          className="px-3 py-2 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-slate-400"
        >
          Tick shown
        </button>
        <button
          onClick={() => onChange([])}
          disabled={selected.size === 0}
          className="px-3 py-2 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-slate-400 disabled:opacity-40"
        >
          Clear
        </button>
      </div>

      <div className="max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {visible.length === 0 ? (
          <p className="p-3 text-xs text-slate-400">No account matches.</p>
        ) : visible.map(a => (
          <label key={a.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50">
            <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} className="w-4 h-4 accent-indigo-600" />
            <span className="text-xs font-bold text-slate-800 flex-1 min-w-0 truncate">{a.descriptiveName || `Account ${a.id}`}</span>
            <span className="text-[10px] font-mono text-slate-400">{a.id}</span>
          </label>
        ))}
      </div>
    </div>
  );
};
