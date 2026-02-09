import React, { useMemo, useState } from 'react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, BarChart, Bar, LineChart, Line, Legend, LabelList
} from 'recharts';
import { 
  AlertOctagon, Zap, ShieldCheck, FileText, ExternalLink, Search, Filter, ChevronDown, ChevronRight, CornerDownRight
} from 'lucide-react';
import { BridgeData, DailyData } from '../types';
import { exportToCSV } from '../utils';
import { KpiCard } from '../components/KpiCard';
import { EmptyState } from '../components/EmptyState';
import { ComparisonTooltip } from '../components/ComparisonTooltip';

// Helper component for expanded rows
const QueryDetailRow: React.FC<{ query: string, rank: number | null, action: string }> = ({ query, rank, action }) => (
  <tr className="bg-slate-50/80 border-b border-slate-100/50">
    <td className="pl-12 py-2 flex items-center gap-2 text-[10px] text-slate-500 font-medium">
      <CornerDownRight size={10} className="text-slate-300" />
      <span className="truncate max-w-[200px]" title={query}>{query}</span>
    </td>
    <td className="text-center py-2">
      {rank ? (
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${rank <= 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
          #{rank.toFixed(1)}
        </span>
      ) : '-'}
    </td>
    <td colSpan={3} className="py-2"></td>
    <td className="text-right pr-4 py-2">
      <span className={`text-[9px] font-bold uppercase ${action.includes('CRITICAL') || action.includes('EXCLUDE') ? 'text-rose-600' : 'text-slate-400'}`}>
        {action}
      </span>
    </td>
  </tr>
);

export const SeoPpcBridgeView: React.FC<{ 
  data: BridgeData[]; 
  dailyData: DailyData[];
  currencySymbol: string;
}> = ({ data, dailyData, currencySymbol }) => {
  const [urlFilter, setUrlFilter] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // 1. GROUP DATA BY URL
  const groupedData = useMemo(() => {
    const groups: Record<string, BridgeData & { queries: { q: string, r: number | null, a: string }[] }> = {};

    data.forEach(item => {
      // Filtrar si hay búsqueda
      if (urlFilter && !item.url.toLowerCase().includes(urlFilter.toLowerCase())) return;

      if (!groups[item.url]) {
        groups[item.url] = { 
          ...item, 
          queries: [] // Array para guardar las keywords hijas
        };
      }
      
      // Añadimos la query a la lista de hijos
      groups[item.url].queries.push({
        q: item.query,
        r: item.organicRank,
        a: item.actionLabel
      });
      
      // Actualizamos lógica de estado del PADRE (Si alguna query es crítica, el padre es crítico)
      // Esto es opcional, pero ayuda a destacar URLs con problemas mixtos
      if (item.actionLabel.includes('CRITICAL') || item.actionLabel.includes('REVIEW')) {
         // Podríamos forzar un estado visual aquí si quisiéramos
      }
    });

    return Object.values(groups).sort((a, b) => b.blendedCostRatio - a.blendedCostRatio);
  }, [data, urlFilter]);

  // Toggle expand/collapse
  const toggleRow = (url: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(url)) newSet.delete(url);
    else newSet.add(url);
    setExpandedRows(newSet);
  };

  // KPIs Logic (Same as before)
  const kpis = useMemo(() => {
    const excludeCount = data.filter(d => d.actionLabel.includes('CRITICAL') || d.actionLabel.includes('REVIEW')).length;
    const increaseCount = data.filter(d => d.actionLabel === 'INCREASE').length;
    return {
      exclude: { count: excludeCount, volume: data.reduce((acc, curr) => curr.actionLabel.includes('CRITICAL') ? acc + curr.ppcClicks : acc, 0) },
      increase: { count: increaseCount },
      maintain: { count: data.length - excludeCount - increaseCount }
    };
  }, [data]);

  // Chart Data
  const trendData = useMemo(() => {
    const map: Record<string, { date: string, organic: number, paid: number }> = {};
    dailyData.filter(d => d.dateRangeLabel === 'current').forEach(d => {
      if(!map[d.date]) map[d.date] = { date: d.date, organic: 0, paid: 0 };
      if(d.channel.toLowerCase().includes('organic')) map[d.date].organic += d.sessions;
      if(d.channel.toLowerCase().includes('paid')) map[d.date].paid += d.sessions;
    });
    return Object.values(map).sort((a,b) => a.date.localeCompare(b.date));
  }, [dailyData]);

  const savingsData = useMemo(() => [
    { name: 'Total Paid Traffic', value: data.reduce((acc, c) => acc + c.ppcClicks, 0) },
    { name: 'Cannibalized Traffic', value: kpis.exclude.volume }
  ], [data, kpis]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6">
      
      {/* SECTION A: Macro Trends */}
      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Macro Trends</h4>
            <p className="text-[11px] font-bold text-slate-600">Organic vs Paid Traffic Flow</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
             <div className="relative w-full md:w-64">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="text" 
                  value={urlFilter}
                  onChange={(e) => setUrlFilter(e.target.value)}
                  placeholder="Filter URLs..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-400"
                />
             </div>
          </div>
        </div>
        <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{fontSize: 9}} axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9}} />
                <Tooltip content={<ComparisonTooltip />} />
                <Legend verticalAlign="top" iconType="circle" />
                <Line type="monotone" dataKey="organic" name="Organic" stroke="#10b981" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="paid" name="Paid" stroke="#3b82f6" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
        </div>
      </div>

      {/* SECTION B: KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard title="Critical Overlap" value={kpis.exclude.count} icon={<AlertOctagon />} color="rose" comparison={undefined} />
        <KpiCard title="Expansion Opps" value={kpis.increase.count} icon={<Zap />} color="blue" comparison={undefined} />
        <KpiCard title="Safe / Maintain" value={kpis.maintain.count} icon={<ShieldCheck />} color="emerald" comparison={undefined} />
      </div>

      {/* SECTION C: MATRIX & VOLUME (Layout Compacted) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
           <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Dependency Matrix (Rank vs Paid Share)</h4>
           <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="organicRank" reversed domain={[1, 30]} hide />
                <YAxis type="number" dataKey="blendedCostRatio" domain={[0, 1]} hide />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white p-2 rounded text-xs">
                        <p className="font-bold">{d.url}</p>
                        <p>Share: {(d.blendedCostRatio*100).toFixed(0)}%</p>
                      </div>
                    );
                  } return null;
                }} />
                <Scatter name="URLs" data={groupedData} fill="#8884d8">
                  {groupedData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.blendedCostRatio > 0.5 ? '#f43f5e' : '#10b981'} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
           </div>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
           <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Wasted Volume</h4>
           <div className="h-[200px]">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={savingsData} layout="vertical" margin={{left: 0}}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 9, fontWeight: 700}} />
                  <Tooltip cursor={{fill: 'transparent'}} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                    <Cell fill="#cbd5e1" />
                    <Cell fill="#f43f5e" />
                    <LabelList dataKey="value" position="right" formatter={(val: number) => val.toLocaleString()} style={{fontSize: 10, fontWeight: 900}} />
                  </Bar>
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>

      {/* SECTION E: THE NEW GROUPED TABLE */}
      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">URL-Level Intelligence</h4>
              <p className="text-[11px] font-bold text-slate-600">Click arrows to inspect specific Keywords</p>
            </div>
             <button 
                onClick={() => exportToCSV(data, "PPC_SEO_Export")} 
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-[9px] font-black uppercase transition-all shadow-md"
              >
                <FileText size={12} /> Export Full Data
              </button>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="py-3 px-4 w-8"></th> {/* Arrow Column */}
                <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Target URL</th>
                <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Avg Rank</th>
                <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Main Campaign</th>
                <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Paid CVR</th>
                <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right text-amber-600">Paid Share</th>
                <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {groupedData.length > 0 ? groupedData.slice(0, 100).map((row, idx) => (
                <React.Fragment key={idx}>
                  {/* PARENT ROW (URL) */}
                  <tr 
                    className={`border-b border-slate-50 hover:bg-slate-50/80 transition-colors cursor-pointer ${expandedRows.has(row.url) ? 'bg-slate-50' : ''}`}
                    onClick={() => toggleRow(row.url)}
                  >
                    <td className="py-3 px-4 text-center">
                      {expandedRows.has(row.url) ? <ChevronDown size={14} className="text-indigo-500" /> : <ChevronRight size={14} className="text-slate-400" />}
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-800 break-all">
                          <ExternalLink size={10} className="text-indigo-400 flex-shrink-0" /> {row.url}
                          <span className="text-[9px] text-slate-400 font-normal">({row.queries.length} queries)</span>
                        </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {/* Mostramos el mejor ranking de sus hijos para dar contexto rápido */}
                      <span className="text-[10px] font-bold text-slate-600">
                        Top: #{Math.min(...row.queries.map(q => q.r || 100)).toFixed(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                        <span className="text-[10px] font-bold text-slate-600">{row.ppcCampaign}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                       <span className="text-[10px] font-black text-slate-800">{(row.ppcCpa * 100).toFixed(1)}%</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                        <div className={`inline-block px-2 py-0.5 rounded-md border ${row.blendedCostRatio > 0.5 ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
                           <span className="text-[10px] font-black">{(row.blendedCostRatio * 100).toFixed(0)}%</span>
                        </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight 
                        ${row.actionLabel.includes('CRITICAL') ? 'bg-rose-100 text-rose-600' : 
                          row.actionLabel === 'INCREASE' ? 'bg-blue-100 text-blue-600' : 
                          'bg-emerald-100 text-emerald-600'}`}>
                        {row.actionLabel.split(' ')[0]} {/* Show just first word for compactness */}
                      </span>
                    </td>
                  </tr>

                  {/* CHILD ROWS (QUERIES) - Only if Expanded */}
                  {expandedRows.has(row.url) && row.queries.map((q, qIdx) => (
                    <QueryDetailRow key={`${idx}-${qIdx}`} query={q.q} rank={q.r} action={q.a} />
                  ))}
                </React.Fragment>
              )) : (
                <tr><td colSpan={7} className="py-12 text-center text-xs text-slate-400">No data found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};