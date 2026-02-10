
import React, { useMemo, useState } from 'react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, BarChart, Bar, LineChart, Line, Legend, LabelList
} from 'recharts';
import { 
  AlertOctagon, Zap, ShieldCheck, FileText, ExternalLink, Search, Filter, ChevronDown, ChevronRight, CornerDownRight, BarChart2, TrendingUp, DollarSign
} from 'lucide-react';
import { BridgeData, DailyData } from '../types';
import { exportToCSV } from '../utils';
import { KpiCard } from '../components/KpiCard';
import { ComparisonTooltip } from '../components/ComparisonTooltip';

// Helper component for expanded rows (Shows Keyword Detail)
const QueryDetailRow: React.FC<{ query: string, rank: number | null, clicks: number }> = ({ query, rank, clicks }) => (
  <tr className="bg-slate-50/80 border-b border-slate-100/50">
    {/* Colspan 2 covers Chevron + URL Column for better indentation space */}
    <td colSpan={2} className="py-2 pl-12">
      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
        <CornerDownRight size={10} className="text-slate-300 flex-shrink-0" />
        <span className="truncate max-w-[200px]" title={query}>{query}</span>
      </div>
    </td>
    <td className="text-center py-2">
      {rank ? (
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${rank <= 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
          #{rank.toFixed(1)}
        </span>
      ) : '-'}
    </td>
    <td className="text-right pr-4 py-2 text-[10px] text-slate-500 font-mono">
       {clicks.toLocaleString()} clicks
    </td>
    {/* Colspan 3 covers Paid Sessions, Share, and Action columns */}
    <td colSpan={3} className="py-2"></td>
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
    const groups: Record<string, BridgeData & { queries: { q: string, r: number | null, c: number }[] }> = {};

    data.forEach(item => {
      if (urlFilter && !item.url.toLowerCase().includes(urlFilter.toLowerCase())) return;

      if (!groups[item.url]) {
        groups[item.url] = { 
          ...item, 
          queries: [] 
        };
      }
      
      // Agregamos la query hijo
      groups[item.url].queries.push({
        q: item.query,
        r: item.organicRank,
        c: item.organicClicks
      });
    });

    return Object.values(groups).sort((a, b) => b.blendedCostRatio - a.blendedCostRatio);
  }, [data, urlFilter]);

  const toggleRow = (url: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(url)) newSet.delete(url);
    else newSet.add(url);
    setExpandedRows(newSet);
  };

  // KPIs Logic
  const kpis = useMemo(() => {
    const excludeCount = data.filter(d => d.actionLabel.includes('CRITICAL') || d.actionLabel.includes('REVIEW')).length;
    const increaseCount = data.filter(d => d.actionLabel === 'INCREASE').length;
    const totalOrganicSessions = data.reduce((acc, curr) => acc + curr.organicSessions, 0);
    const totalPaidSessions = data.reduce((acc, curr) => acc + curr.ppcSessions, 0);

    return {
      exclude: { count: excludeCount, volume: data.reduce((acc, curr) => curr.actionLabel.includes('CRITICAL') ? acc + curr.ppcSessions : acc, 0) },
      increase: { count: increaseCount },
      maintain: { count: data.length - excludeCount - increaseCount },
      traffic: { organic: totalOrganicSessions, paid: totalPaidSessions }
    };
  }, [data]);

  const savingsData = useMemo(() => [
    { name: 'Total Paid Sessions', value: data.reduce((acc, c) => acc + c.ppcSessions, 0) },
    { name: 'Cannibalized Sessions', value: kpis.exclude.volume }
  ], [data, kpis]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6">
      
      {/* SECTION A: TRAFFIC VISIBILITY SCORECARD */}
      <div className="bg-slate-900 p-8 rounded-[32px] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
            <TrendingUp size={120} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between gap-8">
            <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total Visibility (Analysed URLs)</h4>
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black">{kpis.traffic.organic.toLocaleString()}</span>
                    <span className="text-sm font-bold text-emerald-400">Organic Sessions</span>
                </div>
            </div>
            <div className="md:text-right">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Paid Investment</h4>
                <div className="flex items-baseline gap-2 md:justify-end">
                    <span className="text-3xl font-black">{kpis.traffic.paid.toLocaleString()}</span>
                    <span className="text-sm font-bold text-indigo-400">Paid Sessions</span>
                </div>
            </div>
            <div className="md:text-right">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Organic Ratio</h4>
                <div className="flex items-baseline gap-2 md:justify-end">
                    <span className="text-3xl font-black">{((kpis.traffic.organic / (kpis.traffic.organic + kpis.traffic.paid || 1)) * 100).toFixed(1)}%</span>
                    <span className="text-sm font-bold text-slate-500">of Total Traffic</span>
                </div>
            </div>
        </div>
      </div>

      {/* SECTION B: KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard title="Critical Overlap" value={kpis.exclude.count} icon={<AlertOctagon />} color="rose" comparison={undefined} />
        <KpiCard title="Expansion Opps" value={kpis.increase.count} icon={<Zap />} color="blue" comparison={undefined} />
        <KpiCard title="Safe / Maintain" value={kpis.maintain.count} icon={<ShieldCheck />} color="emerald" comparison={undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Graph 1 */}
        <div className="lg:col-span-2 bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
           <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Traffic Matrix (Rank vs Paid Share)</h4>
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
                      <div className="bg-slate-900 text-white p-3 rounded-xl border border-white/10 shadow-xl">
                        <p className="font-bold text-xs mb-1">{d.url}</p>
                        <p className="text-[10px] text-slate-300">Paid Share: {(d.blendedCostRatio*100).toFixed(0)}%</p>
                        <p className="text-[10px] text-emerald-400">Org. Sessions: {d.organicSessions.toLocaleString()}</p>
                        <p className="text-[10px] text-indigo-400">Paid Sessions: {d.ppcSessions.toLocaleString()}</p>
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

        {/* Graph 2 */}
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
           <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Wasted Volume (Sessions)</h4>
           <div className="h-[200px]">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={savingsData} layout="vertical" margin={{left: 0}}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={110} tick={{fontSize: 9, fontWeight: 700}} />
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

      {/* SECTION E: THE NEW CLEAN TABLE */}
      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Traffic Source Audit</h4>
              <p className="text-[11px] font-bold text-slate-600">Comparing GA4 Sessions: Organic vs Paid</p>
            </div>
            
            <div className="flex items-center gap-2 w-full md:w-auto">
               <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search URL..." 
                    value={urlFilter} 
                    onChange={(e) => setUrlFilter(e.target.value)} 
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:ring-1 ring-indigo-500 transition-all"
                  />
               </div>
               <button 
                  onClick={() => exportToCSV(data, "PPC_SEO_Export")} 
                  className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-[9px] font-black uppercase transition-all shadow-md whitespace-nowrap"
                >
                  <FileText size={12} /> Export CSV
                </button>
            </div>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="py-3 px-4 w-8"></th>
                <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">URL / Campaign</th>
                <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Top Rank</th>
                <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Organic Sessions (GA4)</th>
                <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Paid Sessions (GA4)</th>
                <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right text-amber-600">Paid Share</th>
                <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
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
                        <div className="flex flex-col">
                           <div className="flex items-center gap-2 text-[10px] font-bold text-slate-800 break-all">
                             <ExternalLink size={10} className="text-indigo-400 flex-shrink-0" /> {row.url}
                           </div>
                           <div className="flex items-center gap-1 text-[9px] text-slate-400 mt-1">
                             <Zap size={8} /> {row.ppcCampaign}
                           </div>
                        </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-[10px] font-bold text-slate-600">
                        #{Math.min(...row.queries.map(q => q.r || 100)).toFixed(1)}
                      </span>
                    </td>
                    
                    {/* COLUMNA: SEO VOL (Dato Orgánico GA4) */}
                    <td className="py-3 px-4 text-right">
                       <span className="text-[10px] font-bold text-emerald-600">
                         {row.organicSessions.toLocaleString()}
                       </span>
                    </td>

                    {/* COLUMNA: PPC VOL (Dato Pagado GA4) */}
                    <td className="py-3 px-4 text-right">
                       <span className="text-[10px] font-bold text-indigo-600">
                         {row.ppcSessions.toLocaleString()}
                       </span>
                    </td>

                    {/* COLUMNA: SHARE (Barra Visual) */}
                    <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                           <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${row.blendedCostRatio > 0.5 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                                style={{ width: `${row.blendedCostRatio * 100}%` }} 
                              />
                           </div>
                           <span className="text-[9px] font-bold text-slate-600 w-6">
                             {(row.blendedCostRatio * 100).toFixed(0)}%
                           </span>
                        </div>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight 
                        ${row.actionLabel.includes('CRITICAL') ? 'bg-rose-100 text-rose-600' : 
                          row.actionLabel === 'INCREASE' ? 'bg-blue-100 text-blue-600' : 
                          'bg-emerald-100 text-emerald-600'}`}>
                        {row.actionLabel.split(' ')[0]}
                      </span>
                    </td>
                  </tr>

                  {/* CHILD ROWS (Queries) - Sorted by Top 10 Clicks */}
                  {expandedRows.has(row.url) && (
                    <>
                      <tr className="bg-slate-50/50">
                        <td colSpan={7} className="px-12 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100/50">
                          Top 10 GSC Queries (by Clicks)
                        </td>
                      </tr>
                      {/* FIX: Create a shallow copy before sorting to avoid mutating state directly */}
                      {[...row.queries]
                        .sort((a, b) => b.c - a.c)
                        .slice(0, 10)
                        .map((q, qIdx) => (
                        <QueryDetailRow key={`${idx}-${qIdx}`} query={q.q} rank={q.r} clicks={q.c} />
                      ))}
                      <tr className="bg-slate-50/50 border-b border-slate-100"><td colSpan={7} className="py-1"></td></tr>
                    </>
                  )}
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