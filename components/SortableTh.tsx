import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

// A table header that sorts: a real button (keyboard and screen readers) that says which way it is sorted.
export const SortableTh: React.FC<{
  label: string;
  active: boolean;
  direction: 'asc' | 'desc';
  onSort: () => void;
  align?: 'left' | 'center' | 'right';
  title?: string;
  width?: string;
}> = ({ label, active, direction, onSort, align = 'right', title, width }) => (
  <th
    scope="col"
    aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    style={{ width }}
    className={`py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}
  >
    <button
      type="button"
      onClick={onSort}
      title={title}
      className={`inline-flex items-center gap-1 uppercase tracking-wide whitespace-nowrap rounded hover:text-slate-900 ${active ? 'text-slate-900' : ''}`}
    >
      {label}
      {active
        ? (direction === 'asc' ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)
        : <ArrowUpDown size={12} className="text-slate-400" aria-hidden="true" />}
    </button>
  </th>
);
