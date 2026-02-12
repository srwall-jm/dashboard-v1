import React, { useMemo, useState } from 'react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, BarChart, Bar, LineChart, Line, Legend, LabelList
} from 'recharts';
import { 
  AlertOctagon, Zap, ShieldCheck, FileText, ExternalLink, Search, Filter, ChevronDown, ChevronRight, CornerDownRight, BarChart2, TrendingUp, DollarSign, Info, LayoutList, Key, Settings
} from 'lucide-react';
import { BridgeData, DailyData, KeywordBridgeData, Sa360Customer } from '../types';
import { exportToCSV } from '../utils';
import { KpiCard } from '../components/KpiCard';

// Helper component for expanded rows (Shows Keyword Detail)
const QueryDetailRow: React.FC<{ query: string, rank: number | null, clicks: number }> = ({ query, rank, clicks }) => (
  <tr className="bg-slate-50/80 border-b border-slate-100/50">
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
    <td colSpan={3} className="py-2"></td>
  </tr>
);

const getActionInfo = (label: string) => {
    if (label.includes('CRITICAL')) return { desc: "High Cannibalization Risk", logic: "Ranking Top 3 Organic AND High Paid Volume." };
    if (label.includes('OPPORTUNITY')) return { desc: "Expansion Opportunity", logic: "Ranking on Page 2 (11-20) with NO Paid Spend." };
    if (label.includes('REVIEW')) return { desc: "Potential Inefficiency", logic: "Ranking Top 3 Organic with active Paid Spend." };
    if (label === 'INCREASE') return { desc: "Growth Opportunity", logic: "Ranking below Top 10 Organic with NO Paid Spend." };
    return { desc: "Healthy State", logic: "Balanced Organic & Paid visibility." };
};

// Reusable Table Component
const BridgeAnalysisTable: React.FC<{
  title: string;
  subTitle: string;
  data: BridgeData[];
  keywordData: KeywordBridgeData[];
  metricLabel: string;
  dataSourceName: string;
  headerContent?: React.ReactNode;
}> = ({ title, subTitle, data, keywordData, metricLabel, dataSourceName, headerContent }) => {
  const [urlFilter, setUrlFilter] = useState('');
  const [keywordFilter, setKeywordFilter] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'url' | 'keyword'>('url');

  const groupedData = useMemo(() => {
    const groups: Record<string, BridgeData & { queries: { q: string, r: number | null, c: number }[] }> = {};
    data.forEach(item => {
      if (urlFilter && !item.url.toLowerCase().includes(urlFilter.toLowerCase())) return;
      if (!groups[item.url]) groups[item.url] = { ...item, queries: [] };
      groups[item.url].queries.push({ q: item.query, r: item.organicRank, c: item.organicClicks });
    });
    return Object.values(groups).sort((a, b) => b.blendedCostRatio - a.blendedCostRatio);
  }, [data, urlFilter]);

  const toggleRow = (url: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(url)) newSet.delete(url); else newSet.add(url);
    setExpandedRows(newSet);
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex flex-col gap-2">
              <div>
                <div className="flex items-center gap-3">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</h4>
                    {headerContent}
                </div>
                <p className="text-[11px] font-bold text-slate-600">{subTitle}</p>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                <button onClick={() => setViewMode('url')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === 'url' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
                  <LayoutList size={12} /> Analysis by URL
                </button>
                <button onClick={() => setViewMode('keyword')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === 'keyword' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
                  <Key size={12} /> Analysis by Keyword
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-2 w-full md:w-auto">
               <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input type="text" placeholder={viewMode === 'url' ? "Search URL..." : "Search Keyword..."}
                    value={viewMode === 'url' ? urlFilter : keywordFilter} 
                    onChange={(e) => viewMode === 'url' ? setUrlFilter(e.target.value) : setKeywordFilter(e.target.value)} 
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:ring-1 ring-indigo-500 transition-all"
                  />
               </div>
               <button onClick={() => exportToCSV(viewMode === 'url' ? data : keywordData, `PPC_SEO_${viewMode.toUpperCase()}_${dataSourceName}_Export`)} className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-[9px] font-black uppercase transition-all shadow-md whitespace-nowrap">
                  <FileText size={12} /> CSV
                </button>
            </div>
        </div>
        
        <div className="overflow-x-auto custom-scrollbar">
          {viewMode === 'url' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="py-3 px-4 w-8"></th>
                  <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">URL / Campaign</th>
                  <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Top Rank</th>
                  <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Org. {dataSourceName === 'SA360' ? 'Clicks' : 'Sessions'}</th>
                  <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">{metricLabel}</th>
                  <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right text-amber-600">Paid Share</th>
                  <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {groupedData.length > 0 ? groupedData.slice(0, 100).map((row, idx) => {
                  const actionInfo = getActionInfo(row.actionLabel);
                  return (
                  <React.Fragment key={idx}>
                    <tr className={`border-b border-slate-50 hover:bg-slate-50/80 transition-colors cursor-pointer ${expandedRows.has(row.url) ? 'bg-slate-50' : ''}`} onClick={() => toggleRow(row.url)}>
                      <td className="py-3 px-4 text-center">{expandedRows.has(row.url) ? <ChevronDown size={14} className="text-indigo-500" /> : <ChevronRight size={14} className="text-slate-400" />}</td>
                      <td className="py-3 px-4 max-w-xs">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-800 break-all"><ExternalLink size={10} className="text-indigo-400 flex-shrink-0" /> {row.url}</div>
                            <div className="flex items-center gap-1 text-[9px] text-slate-400 mt-1"><Zap size={8} /> {row.ppcCampaign}</div>
                          </div>
                      </td>
                      <td className="py-3 px-4 text-center"><span className="text-[10px] font-bold text-slate-600">#{Math.min(...row.queries.map(q => q.r || 100)).toFixed(1)}</span></td>
                      <td className="py-3 px-4 text-right"><span className="text-[10px] font-bold text-emerald-600">{row.organicSessions.toLocaleString()}</span></td>
                      <td className="py-3 px-4 text-right"><span className="text-[10px] font-bold text-indigo-600">{row.ppcSessions.toLocaleString()}</span></td>
                      <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${row.blendedCostRatio > 0.5 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${row.blendedCostRatio * 100}%` }} /></div>
                            <span className="text-[9px] font-bold text-slate-600 w-6">{(row.blendedCostRatio * 100).toFixed(0)}%</span>
                          </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="group relative inline-block">
                            <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight cursor-help ${row.actionLabel.includes('CRITICAL') ? 'bg-rose-100 text-rose-600' : row.actionLabel === 'INCREASE' ? 'bg-blue-100 text-blue-600' : row.actionLabel === 'REVIEW' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>{row.actionLabel.split(' ')[0]}</span>
                            <div className="absolute right-0 top-full mt-2 w-56 p-3 bg-slate-900 text-white text-[10px] rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 border border-white/10 pointer-events-none text-left">
                                <p className="text-slate-400 leading-relaxed font-medium">{actionInfo.logic}</p>
                            </div>
                        </div>
                      </td>
                    </tr>
                    {expandedRows.has(row.url) && (
                      <>{[...row.queries].sort((a, b) => b.c - a.c).map((q, qIdx) => (<QueryDetailRow key={`${idx}-${qIdx}`} query={q.q} rank={q.r} clicks={q.c} />))}<tr className="bg-slate-50/50 border-b border-slate-100"><td colSpan={7} className="py-1"></td></tr></>
                    )}
                  </React.Fragment>
                );
                }) : <tr><td colSpan={7} className="py-12 text-center text-xs text-slate-400">No data found</td></tr>}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Matched Keyword (Exact)</th>
                  <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Top Org. Rank</th>
                  <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Org. Clicks</th>
                  <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">{metricLabel}</th>
                  <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Paid CVR</th>
                  <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {keywordData && keywordData.length > 0 ? keywordData
                  .filter(k => !keywordFilter || k.keyword.toLowerCase().includes(keywordFilter.toLowerCase()))
                  .map((row, idx) => {
                    const actionInfo = getActionInfo(row.actionLabel);
                    return (
                      <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4"><div className="flex items-center gap-2"><Key size={10} className="text-slate-400" /><span className="text-[10px] font-bold text-slate-800">{row.keyword}</span></div></td>
                        <td className="py-3 px-4 text-center">{row.organicRank ? <span className={`px-2 py-0.5 rounded text-[10px] font-black ${row.organicRank <= 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>#{row.organicRank.toFixed(1)}</span> : <span className="text-[10px] text-slate-400">-</span>}</td>
                        <td className="py-3 px-4 text-right"><span className="text-[10px] font-bold text-emerald-600">{row.organicClicks.toLocaleString()}</span></td>
                        <td className="py-3 px-4 text-right"><span className={`text-[10px] font-black ${row.paidSessions > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>{row.paidSessions.toLocaleString()}</span></td>
                         <td className="py-3 px-4 text-right"><span className="text-[10px] font-bold text-slate-600">{row.paidCvr.toFixed(2)}%</span></td>
                        <td className="py-3 px-4 text-right">
                          <div className="group relative inline-block">
                              <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight cursor-help ${row.actionLabel.includes('CRITICAL') ? 'bg-rose-100 text-rose-600' : row.actionLabel.includes('OPPORTUNITY') ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>{row.actionLabel.replace(/\(.*\)/, '')}</span>
                              <div className="absolute right-0 top-full mt-2 w-56 p-3 bg-slate-900 text-white text-[10px] rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 border border-white/10 pointer-events-none text-left"><p className="text-slate-400 leading-relaxed font-medium">{actionInfo.logic}</p></div>
                          </div>
                        </td>
                      </tr>
                    );
                }) : <tr><td colSpan={6} className="py-12 text-center text-xs text-slate-400">No keyword data matched</td></tr>}
              </tbody>
            </table>
          )}
        </div>
    </div>
  );
};

export const SeoPpcBridgeView: React.FC<{ 
  ga4Data: BridgeData[]; 
  sa360Data: BridgeData[];
  ga4KeywordData: KeywordBridgeData[];
  sa360KeywordData: KeywordBridgeData[];
  dailyData: DailyData[];
  currencySymbol: string;
  availableSa360Customers?: Sa360Customer[];
  selectedSa360Customer?: Sa360Customer | null;
  setSelectedSa360Customer?: (c: Sa360Customer | null) => void;
}> = ({ ga4Data, sa360Data, ga4KeywordData, sa360KeywordData, dailyData, currencySymbol, availableSa360Customers, selectedSa360Customer, setSelectedSa360Customer }) => {
  
  // Decide which dataset to use for top-level stats (Prefer SA360 if available)
  const primaryData = sa360Data.length > 0 ? sa360Data : ga4Data;
  const primaryDataSource = sa360Data.length > 0 ? 'SA360' : 'GA4';
  const metricLabel = primaryDataSource === 'SA360' ? 'Paid Clicks (SA360)' : 'Paid Sessions (GA4)';
  const metricShort = primaryDataSource === 'SA360' ? 'Clicks' : 'Sessions';

  // KPIs Logic based on Primary Data
  const kpis = useMemo(() => {
    const excludeCount = primaryData.filter(d => d.actionLabel.includes('CRITICAL') || d.actionLabel.includes('REVIEW')).length;
    const increaseCount = primaryData.filter(d => d.actionLabel === 'INCREASE').length;
    const totalOrganicVolume = primaryData.reduce((acc, curr) => acc + curr.organicSessions, 0); 
    const totalPaidVolume = primaryData.reduce((acc, curr) => acc + curr.ppcSessions, 0);

    return {
      exclude: { count: excludeCount, volume: primaryData.reduce((acc, curr) => curr.actionLabel.includes('CRITICAL') ? acc + curr.ppcSessions : acc, 0) },
      increase: { count: increaseCount },
      maintain: { count: primaryData.length - excludeCount - increaseCount },
      traffic: { organic: totalOrganicVolume, paid: totalPaidVolume }
    };
  }, [primaryData]);

  const savingsData = useMemo(() => [
    { name: `Total ${metricLabel}`, value: primaryData.reduce((acc, c) => acc + c.ppcSessions, 0) },
    { name: `Cannibalized ${metricShort}`, value: kpis.exclude.volume }
  ], [primaryData, kpis, metricLabel, metricShort]);

  // Grouped Data for Scatter Plot (Primary Only)
  const groupedForScatter = useMemo(() => {
    // Simple grouping for scatter plot visualization
    const groups: Record<string, BridgeData> = {};
    primaryData.forEach(item => {
      if (!groups[item.url]) groups[item.url] = item;
    });
    return Object.values(groups);
  }, [primaryData]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6">
      
      {/* SECTION A: TRAFFIC VISIBILITY SCORECARD */}
      <div className="bg-slate-900 p-8 rounded-[32px] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10"><TrendingUp size={120} /></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between gap-8">
            <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total Visibility (Analysed URLs)</h4>
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black">{kpis.traffic.organic.toLocaleString()}</span>
                    <span className="text-sm font-bold text-emerald-400">Organic {primaryDataSource === 'SA360' ? 'Clicks (GSC)' : 'Sessions'}</span>
                </div>
            </div>
            <div className="md:text-right">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Paid Investment ({primaryDataSource})</h4>
                <div className="flex items-baseline gap-2 md:justify-end">
                    <span className="text-3xl font-black">{kpis.traffic.paid.toLocaleString()}</span>
                    <span className="text-sm font-bold text-indigo-400">{metricShort}</span>
                </div>
            </div>
            <div className="md:text-right">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Organic Ratio</h4>
                <div className="flex items-baseline gap-2 md:justify-end">
                    <span className="text-3xl font-black">{((kpis.traffic.organic / (kpis.traffic.organic + kpis.traffic.paid || 1)) * 100).toFixed(1)}%</span>
                    <span className="text-sm font-bold text-slate-500">of Total Volume</span>
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
           <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Traffic Matrix ({primaryDataSource})</h4>
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
                        <p className="text-[10px] text-emerald-400">Org: {d.organicSessions.toLocaleString()}</p>
                        <p className="text-[10px] text-indigo-400">Paid: {d.ppcSessions.toLocaleString()}</p>
                      </div>
                    );
                  } return null;
                }} />
                <Scatter name="URLs" data={groupedForScatter} fill="#8884d8">
                  {groupedForScatter.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.blendedCostRatio > 0.5 ? '#f43f5e' : '#10b981'} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
           </div>
        </div>

        {/* Graph 2 */}
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
           <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Wasted Volume ({metricShort})</h4>
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

      {/* SECTION E: DUAL TABLES */}
      
      {/* 1. GA4 TABLE */}
      {ga4Data.length > 0 && (
          <BridgeAnalysisTable 
             title="Traffic Source Audit (GA4 Scope)" 
             subTitle="Comparing Organic (GSC) vs Paid Sessions (GA4)"
             data={ga4Data}
             keywordData={ga4KeywordData}
             metricLabel="Paid Sessions (GA4)"
             dataSourceName="GA4"
          />
      )}

      {/* 2. SA360 TABLE (Only if data exists and selected from settings) */}
      {sa360Data.length > 0 && (
          <BridgeAnalysisTable 
             title="Traffic Source Audit (SA360 Scope)" 
             subTitle="Comparing Organic (GSC) vs Paid Clicks (SA360)"
             data={sa360Data}
             keywordData={sa360KeywordData}
             metricLabel="Paid Clicks (SA360)"
             dataSourceName="SA360"
             headerContent={null}
          />
      )}

      {ga4Data.length === 0 && sa360Data.length === 0 && (
         <div className="bg-white p-12 rounded-[32px] border border-slate-200 shadow-sm text-center flex flex-col items-center opacity-50">
             <Info size={48} className="text-slate-300 mb-4" />
             <p className="text-slate-400 font-bold">No bridge data available. Please connect GSC and (GA4 or SA360) in Settings.</p>
         </div>
      )}

    </div>
  );
};
