import React, { useMemo, useState } from 'react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, BarChart, Bar, LineChart, Line, Legend, LabelList
} from 'recharts';
import { 
  AlertOctagon, Zap, ShieldCheck, FileText, ExternalLink, Search, Filter, ChevronDown, ChevronRight, CornerDownRight, BarChart2, TrendingUp, DollarSign, Info, LayoutList, Key, Settings, CheckSquare, Square
} from 'lucide-react';
import { BridgeData, DailyData, KeywordBridgeData, Sa360Customer } from '../types';
import { exportToCSV, formatDate } from '../utils';
import { KpiCard } from '../components/KpiCard';
import { ComparisonTooltip } from '../components/ComparisonTooltip'; // Reusing the tooltip for consistency
import { EmptyState } from '../components/EmptyState';

// Helper component for expanded rows (Shows Keyword Detail)
const QueryDetailRow: React.FC<{ query: string, rank: number | null, clicks: number }> = ({ query, rank, clicks }) => (
  <tr className="bg-slate-50/80 border-b border-slate-100/50">
    <td colSpan={3} className="py-2 pl-16">
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
  dailyData: DailyData[]; // Passed for charting
}> = ({ title, subTitle, data, keywordData, metricLabel, dataSourceName, headerContent, dailyData }) => {
  const [urlFilter, setUrlFilter] = useState('');
  const [keywordFilter, setKeywordFilter] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'url' | 'keyword'>('url');
  
  // Selection State
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());

  // Filtered Data based on URL Filter
  const filteredUrlData = useMemo(() => {
    return data
        .filter(item => !urlFilter || item.url.toLowerCase().includes(urlFilter.toLowerCase()))
        .sort((a, b) => b.blendedCostRatio - a.blendedCostRatio);
  }, [data, urlFilter]);

  const toggleRow = (url: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(url)) newSet.delete(url); else newSet.add(url);
    setExpandedRows(newSet);
  };

  // Selection Handlers
  const toggleSelection = (url: string) => {
    const newSet = new Set(selectedUrls);
    if (newSet.has(url)) newSet.delete(url); else newSet.add(url);
    setSelectedUrls(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedUrls.size === filteredUrlData.length) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(filteredUrlData.map(d => d.url)));
    }
  };

  // Chart Logic for Selected URLs
  const chartData = useMemo(() => {
    if (selectedUrls.size === 0) return [];

    // Helper to normalize daily data URL to match bridge data URL
    const normalize = (u: string) => {
       try {
         let path = u.toLowerCase().split('?')[0].split('#')[0];
         path = path.replace(/^https?:\/\/[^\/]+/, '');
         if (path.endsWith('/') && path.length > 1) path = path.slice(0, -1);
         if (!path.startsWith('/')) path = '/' + path;
         return path;
       } catch { return u; }
    };

    // Filter Daily Data to only include selected URLs
    const relevantDaily = dailyData.filter(d => selectedUrls.has(normalize(d.landingPage)));

    if (relevantDaily.length === 0) return [];

    // Group by Date and Label
    const curRaw = relevantDaily.filter(d => d.dateRangeLabel === 'current').sort((a, b) => a.date.localeCompare(b.date));
    const prevRaw = relevantDaily.filter(d => d.dateRangeLabel === 'previous').sort((a, b) => a.date.localeCompare(b.date));

    const getBucket = (dateStr: string) => dateStr; // Daily buckets
    const curBuckets = Array.from(new Set(curRaw.map(d => getBucket(d.date)))).sort();
    
    // Create map for aggregation
    const aggregate = (items: DailyData[]) => {
        const map: Record<string, { org: number, paid: number, date: string }> = {};
        items.forEach(d => {
            const b = getBucket(d.date);
            if (!map[b]) map[b] = { org: 0, paid: 0, date: d.date };
            
            const isOrg = d.channel?.toLowerCase().includes('organic');
            const isPaid = d.channel?.toLowerCase().includes('paid') || d.channel?.toLowerCase().includes('cpc');

            if (isOrg) map[b].org += d.sessions;
            if (isPaid) map[b].paid += d.sessions;
        });
        return map;
    };

    const curMap = aggregate(curRaw);
    const prevMap = aggregate(prevRaw);
    
    // Map previous dates to current indices for overlay
    const prevBuckets = Array.from(new Set(prevRaw.map(d => getBucket(d.date)))).sort();

    return curBuckets.map((bucket, index) => {
        const c = curMap[bucket as string];
        const pBucket = prevBuckets[index];
        const p = pBucket ? prevMap[pBucket as string] : null;

        const dateObj = new Date(c.date);
        const xLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        return {
            date: xLabel,
            fullDateCurrent: c.date,
            fullDatePrevious: p?.date || 'N/A',
            'Organic (Cur)': c.org,
            'Paid (Cur)': c.paid,
            'Organic (Prev)': p?.org || 0,
            'Paid (Prev)': p?.paid || 0,
        };
    });

  }, [selectedUrls, dailyData]);

  return (
    <div className="mb-10">
    <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm overflow-hidden mb-6">
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
                  <LayoutList size={12} /> Analysis by URL / QUERY
                </button>
                <button onClick={() => setViewMode('keyword')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === 'keyword' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
                  <Key size={12} /> Analysis by Exact Match
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
                  <th className="py-3 px-4 w-10 text-center">
                    <button onClick={toggleSelectAll} className="text-indigo-600 hover:text-indigo-800 transition-colors">
                        {selectedUrls.size > 0 && selectedUrls.size === filteredUrlData.length ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>
                  </th>
                  <th className="py-3 px-4 w-8"></th>
                  <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">URL / Top Query</th>
                  <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Top Org. Rank</th>
                  <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Org. Sessions (GA4)</th>
                  <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">{metricLabel}</th>
                  <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right text-amber-600">Paid Share</th>
                  <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUrlData.length > 0 ? filteredUrlData.slice(0, 100).map((row, idx) => {
                  const actionInfo = getActionInfo(row.actionLabel);
                  return (
                  <React.Fragment key={idx}>
                    <tr className={`border-b border-slate-50 hover:bg-slate-50/80 transition-colors cursor-pointer ${expandedRows.has(row.url) ? 'bg-slate-50' : ''}`}>
                      <td className="py-3 px-4 text-center">
                        <button onClick={(e) => { e.stopPropagation(); toggleSelection(row.url); }} className="text-indigo-600">
                            {selectedUrls.has(row.url) ? <CheckSquare size={16} /> : <Square size={16} className="text-slate-300" />}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center" onClick={() => toggleRow(row.url)}>
                          {expandedRows.has(row.url) ? <ChevronDown size={14} className="text-indigo-500" /> : <ChevronRight size={14} className="text-slate-400" />}
                      </td>
                      <td className="py-3 px-4 max-w-xs" onClick={() => toggleRow(row.url)}>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-800 break-all"><ExternalLink size={10} className="text-indigo-400 flex-shrink-0" /> {row.url}</div>
                            <div className="flex items-center gap-1 text-[9px] text-slate-400 mt-1"><Key size={8} /> Top Query: {row.query}</div>
                          </div>
                      </td>
                      <td className="py-3 px-4 text-center"><span className="text-[10px] font-bold text-slate-600">{row.organicRank ? `#${row.organicRank.toFixed(1)}` : '-'}</span></td>
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
                      <>
                        <tr className="bg-slate-50/50">
                            <td colSpan={8} className="px-12 py-2">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Top 10 GSC Queries for this URL</p>
                            </td>
                        </tr>
                        {row.gscTopQueries && row.gscTopQueries.length > 0 ? (
                            row.gscTopQueries.map((q, qIdx) => (
                                <QueryDetailRow key={`${idx}-${qIdx}`} query={q.query} rank={q.rank} clicks={q.clicks} />
                            ))
                        ) : (
                            <tr><td colSpan={8} className="text-center py-2 text-[10px] text-slate-400 italic">No specific query data available via GSC</td></tr>
                        )}
                        <tr className="bg-slate-50/50 border-b border-slate-100"><td colSpan={8} className="py-1"></td></tr>
                      </>
                    )}
                  </React.Fragment>
                );
                }) : <tr><td colSpan={8} className="py-12 text-center text-xs text-slate-400">No data found</td></tr>}
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

    {/* Dynamic Chart for Selected URLs */}
    {selectedUrls.size > 0 && viewMode === 'url' && (
      <div className="bg-slate-900 p-6 md:p-8 rounded-[32px] border border-slate-800 shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-top-4">
         <div className="flex justify-between items-center mb-6 z-10 relative">
            <div>
                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Sessions Performance (Time Overlay)</h4>
                <p className="text-[11px] font-bold text-white">Aggregated Performance for {selectedUrls.size} Selected URLs ({dataSourceName} Scope)</p>
            </div>
            <div className="p-2 bg-white/10 rounded-xl">
                <TrendingUp className="text-emerald-400" size={18} />
            </div>
         </div>
         
         <div className="h-[300px] w-full z-10 relative">
            {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                        <XAxis dataKey="date" tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} />
                        <Tooltip content={<ComparisonTooltip />} />
                        <Legend verticalAlign="top" align="center" iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                        
                        <Line name="Organic (Cur)" type="monotone" dataKey="Organic (Cur)" stroke="#6366f1" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                        <Line name="Paid (Cur)" type="monotone" dataKey="Paid (Cur)" stroke="#f59e0b" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                        
                        <Line name="Organic (Prev)" type="monotone" dataKey="Organic (Prev)" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" opacity={0.3} dot={false} />
                        <Line name="Paid (Prev)" type="monotone" dataKey="Paid (Prev)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" opacity={0.3} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            ) : <EmptyState text="No timeline data available for selected URLs" />}
         </div>
         
         {/* Decoration */}
         <div className="absolute top-0 right-0 p-20 opacity-5 pointer-events-none">
            <Zap size={200} className="text-white" />
         </div>
      </div>
    )}
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
                    <span className="text-sm font-bold text-emerald-400">Organic Sessions (GA4)</span>
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
             dailyData={dailyData}
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
             dailyData={dailyData}
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