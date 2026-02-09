
import React, { useMemo, useState } from 'react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, Label, BarChart, Bar, LineChart, Line, Legend, LabelList
} from 'recharts';
import { 
  AlertOctagon, Zap, ShieldCheck, TrendingUp, DollarSign, FileText, ExternalLink, Search, Filter
} from 'lucide-react';
import { BridgeData, DailyData } from '../types';
import { exportToCSV } from '../utils';
import { KpiCard } from '../components/KpiCard';
import { EmptyState } from '../components/EmptyState';
import { ComparisonTooltip } from '../components/ComparisonTooltip';

export const SeoPpcBridgeView: React.FC<{ 
  data: BridgeData[]; 
  dailyData: DailyData[];
  currencySymbol: string;
}> = ({ data, dailyData, currencySymbol }) => {
  const [urlFilter, setUrlFilter] = useState('');

  // Process data for rules with URL Filtering
  const processedData = useMemo(() => {
    return data
      .filter(item => item.url.toLowerCase().includes(urlFilter.toLowerCase()))
      .map(item => {
        let status: 'Exclude' | 'Increase' | 'Maintain' | 'Review' = 'Review';
        
        // Rule 1: EXCLUDE (High Rank & High Cost)
        if (item.organicRank !== null && item.organicRank <= 3 && item.ppcCost > 0) {
          status = 'Exclude';
        } 
        // Rule 2: INCREASE (Mid Rank & Good CPA - assuming Good CPA < 50 for mock)
        else if (item.organicRank !== null && item.organicRank > 5 && item.organicRank <= 20 && item.ppcCpa < 50) {
          status = 'Increase';
        }
        // Rule 3: MAINTAIN (Poor Rank & Good Conversions)
        else if ((item.organicRank === null || item.organicRank > 20) && item.ppcConversions > 0) {
          status = 'Maintain';
        }

        return { ...item, status };
      });
  }, [data, urlFilter]);

  const kpis = useMemo(() => {
    const excludeItems = processedData.filter(d => d.status === 'Exclude');
    const increaseItems = processedData.filter(d => d.status === 'Increase');
    const maintainItems = processedData.filter(d => d.status === 'Maintain');

    return {
      exclude: { count: excludeItems.length, cost: excludeItems.reduce((acc, curr) => acc + curr.ppcCost, 0) },
      increase: { count: increaseItems.length, potential: increaseItems.length * 10 }, // Dummy potential logic
      maintain: { count: maintainItems.length, conversions: maintainItems.reduce((acc, curr) => acc + curr.ppcConversions, 0) }
    };
  }, [processedData]);

  // Section A: Macro Trends
  const trendData = useMemo(() => {
    const map: Record<string, { date: string, organic: number, paid: number }> = {};
    dailyData.filter(d => d.dateRangeLabel === 'current').forEach(d => {
      if(!map[d.date]) map[d.date] = { date: d.date, organic: 0, paid: 0 };
      if(d.channel.toLowerCase().includes('organic')) map[d.date].organic += d.sessions;
      if(d.channel.toLowerCase().includes('paid') || d.channel.toLowerCase().includes('cpc')) map[d.date].paid += d.sessions;
    });
    return Object.values(map).sort((a,b) => a.date.localeCompare(b.date));
  }, [dailyData]);

  // Section D: Potential Savings (Monthly Projection)
  const savingsData = useMemo(() => [
    { name: 'Current Spend', value: processedData.reduce((acc, c) => acc + c.ppcCost, 0) },
    { name: 'Potential Savings', value: kpis.exclude.cost }
  ], [processedData, kpis]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6">
      
      {/* SECTION A: Macro Trends */}
      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Macro Trends: Traffic Distribution</h4>
            <p className="text-[11px] font-bold text-slate-600">Organic Growth vs Paid Dependency</p>
          </div>
          {/* URL Filter Input */}
          <div className="flex items-center gap-3 w-full md:w-auto">
             <div className="relative w-full md:w-64">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="text" 
                  value={urlFilter}
                  onChange={(e) => setUrlFilter(e.target.value)}
                  placeholder="Filter by URL path (e.g. /product, /vuelos)"
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-400"
                />
             </div>
          </div>
        </div>
        <div className="h-[250px]">
           {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} />
                <Tooltip content={<ComparisonTooltip />} />
                <Legend verticalAlign="top" iconType="circle" />
                <Line type="monotone" dataKey="organic" name="Organic Sessions" stroke="#10b981" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="paid" name="Paid Sessions" stroke="#3b82f6" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
           ) : <EmptyState text="No daily data for trends" />}
        </div>
      </div>

      {/* SECTION B: Action Cards (The Brain) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard 
          title="Cannibalization Risks (Exclude)" 
          value={kpis.exclude.count} 
          icon={<AlertOctagon />} 
          color="rose"
          comparison={undefined}
        />
        <KpiCard 
          title="Expansion Opportunities (Increase)" 
          value={kpis.increase.count} 
          icon={<Zap />} 
          color="blue"
          comparison={undefined}
        />
        <KpiCard 
          title="Defense Keywords (Maintain)" 
          value={kpis.maintain.count} 
          icon={<ShieldCheck />} 
          color="emerald"
          comparison={undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* SECTION C: Opportunity Matrix (Scatter Plot) */}
        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Opportunity Matrix (Scatter)</h4>
              <p className="text-[11px] font-bold text-slate-600">X: Organic Rank (Inv) vs Y: PPC CPA | Size: Impressions</p>
            </div>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="organicRank" name="Organic Rank" reversed domain={[1, 50]} label={{ value: 'Organic Position (Reversed)', position: 'bottom', fontSize: 10 }} />
                <YAxis type="number" dataKey="ppcCpa" name="CPA" unit={currencySymbol} label={{ value: 'PPC CPA', angle: -90, position: 'left', fontSize: 10 }} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white p-3 rounded-xl border border-white/10 shadow-xl">
                        <p className="text-[10px] font-black uppercase tracking-widest mb-1">{d.query}</p>
                        <p className="text-[9px]">Rank: <span className="font-bold text-emerald-400">{d.organicRank || 'N/A'}</span></p>
                        <p className="text-[9px]">PPC CPA: <span className="font-bold text-indigo-400">{currencySymbol}{d.ppcCpa.toFixed(2)}</span></p>
                        <p className="text-[9px]">Blended Cost: <span className="font-bold text-amber-400">{currencySymbol}{d.blendedCostRatio.toFixed(2)}</span></p>
                        <p className="text-[9px]">Action: <span className="font-bold">{d.status}</span></p>
                      </div>
                    );
                  }
                  return null;
                }} />
                {/* Reference Lines for Zones */}
                <ReferenceLine x={3} stroke="red" strokeDasharray="3 3" label={{ value: "Top 3", position: 'insideTopLeft', fill: 'red', fontSize: 10 }} />
                <ReferenceLine y={50} stroke="orange" strokeDasharray="3 3" label={{ value: "Target CPA", position: 'insideTopRight', fill: 'orange', fontSize: 10 }} />
                
                <Scatter name="Queries" data={processedData} fill="#8884d8">
                  {processedData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={
                      entry.status === 'Exclude' ? '#f43f5e' : 
                      entry.status === 'Increase' ? '#3b82f6' : 
                      entry.status === 'Maintain' ? '#10b981' : '#94a3b8'
                    } />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SECTION D: Financial Impact Monitor */}
        <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm flex flex-col">
           <div className="mb-6">
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Financial Impact</h4>
              <p className="text-[11px] font-bold text-slate-600">Wasted Spend due to Cannibalization</p>
           </div>
           <div className="flex-1 min-h-[200px]">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={savingsData} layout="vertical" margin={{left: 30}}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 9, fontWeight: 700}} />
                  <Tooltip cursor={{fill: 'transparent'}} content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-900 text-white p-2 rounded-lg text-xs font-bold">
                            {currencySymbol}{payload[0].value.toLocaleString()}
                          </div>
                        )
                      }
                      return null;
                  }}/>
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={32}>
                    <Cell fill="#cbd5e1" />
                    <Cell fill="#f43f5e" /> {/* Red for Savings */}
                    <LabelList dataKey="value" position="right" formatter={(val: number) => `${currencySymbol}${val.toLocaleString()}`} style={{fontSize: 10, fontWeight: 900, fill: '#334155'}} />
                  </Bar>
               </BarChart>
             </ResponsiveContainer>
           </div>
           <div className="mt-4 p-4 bg-rose-50 rounded-2xl border border-rose-100">
              <div className="flex items-center gap-2 text-rose-700 mb-1">
                <DollarSign size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Potential Monthly Saving</span>
              </div>
              <p className="text-2xl font-black text-rose-600">{currencySymbol}{kpis.exclude.cost.toLocaleString()}</p>
           </div>
        </div>
      </div>

      {/* SECTION E: Detailed Table */}
      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex justify-between items-center mb-8">
            <div>
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">GSC to PPC Bridge</h4>
              <p className="text-[11px] font-bold text-slate-600">Unified Intelligence Ledger {urlFilter && <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg ml-2">Filtering by: "{urlFilter}"</span>}</p>
            </div>
             <button 
                onClick={() => exportToCSV(processedData, "PPC_SEO_Bridge_Export")} 
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-[9px] font-black uppercase transition-all shadow-md"
              >
                <FileText size={12} /> Export CSV
              </button>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">URL / Query</th>
                <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Org. Rank</th>
                <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">PPC Campaign</th>
                <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">PPC CPA</th>
                <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right text-amber-600">Blended Cost</th>
                <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {processedData.length > 0 ? processedData.slice(0, 50).map((row, idx) => (
                <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-4 max-w-xs">
                     <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-800 break-all">
                          <ExternalLink size={10} className="text-indigo-400 flex-shrink-0" /> {row.url}
                        </div>
                        <div className="flex items-center gap-2 text-[9px] text-slate-500 mt-1 pl-4">
                          <Search size={10} /> {row.query}
                        </div>
                     </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {row.organicRank ? (
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${row.organicRank <= 3 ? 'bg-emerald-100 text-emerald-700' : row.organicRank > 20 ? 'bg-rose-50 text-rose-400' : 'bg-slate-100 text-slate-600'}`}>
                        {row.organicRank.toFixed(1)}
                      </span>
                    ) : <span className="text-[10px] text-slate-300 font-bold">-</span>}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-600">{row.ppcCampaign}</span>
                        {/* Show SourceMedium if campaign is suspicious */}
                        {row.ppcCampaign.includes('Auto:') && (
                           <span className="text-[8px] text-slate-400 italic">Source: {row.ppcSourceMedium}</span>
                        )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right text-[10px] font-black text-slate-800">{currencySymbol}{row.ppcCpa.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right">
                     <div className="inline-block px-2 py-1 bg-amber-50 rounded-lg border border-amber-100">
                        <span className="text-[10px] font-black text-amber-700">{currencySymbol}{row.blendedCostRatio.toFixed(2)}</span>
                     </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight 
                      ${row.status === 'Exclude' ? 'bg-rose-100 text-rose-600' : 
                        row.status === 'Increase' ? 'bg-blue-100 text-blue-600' : 
                        row.status === 'Maintain' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                   <td colSpan={6} className="py-12 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                     No matches found for "{urlFilter}"
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
