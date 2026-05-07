import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts';
import { 
  DollarSign, TrendingDown, PiggyBank, Target, AlertTriangle, CheckCircle, Search, FileText, Info, Zap, ChevronUp, ChevronDown, Key, ExternalLink, Filter, ChevronRight
} from 'lucide-react';
import { KeywordBridgeData, GoogleAdsGlobalMetrics } from '../types';
import { KpiCard } from '../components/KpiCard';
import { EmptyState } from '../components/EmptyState';
import { exportToCSV } from '../utils';

interface UrlEfficiencyRow {
  url: string;
  cluster: 'Cannibalization Risk' | 'Paid Reliance' | 'Paid Gap' | 'Other';
  organicClicks: number;
  paidSessions: number;
  paidShare: number;
  ppcCost: number;
  avgCpc: number;
  convRateOrganic: number;
  convRatePaid: number;
  paidCpa: number;
  queries: KeywordBridgeData[];
  avgOrganicRank: number | null;
}

type SortConfig = {
  key: keyof UrlEfficiencyRow;
  direction: 'asc' | 'desc';
};

export const SearchEfficiencyView: React.FC<{ 
  urlData: any[]; // BridgeData[]
  keywordData: KeywordBridgeData[]; 
  currencySymbol: string; 
  globalMetrics: GoogleAdsGlobalMetrics | null;
  totalGscClicks: number;
  isLoading?: boolean;
}> = ({ urlData, keywordData, currencySymbol, globalMetrics, totalGscClicks, isLoading }) => {
  const [clusterFilter, setClusterFilter] = useState<'All' | 'Cannibalization Risk' | 'Paid Reliance' | 'Paid Gap'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'ppcCost', direction: 'desc' });
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);

  // 1. Data Processing Engine & Scorecard Calculations
  const { filteredData, metrics } = useMemo(() => {
    let totalCost = 0;
    let potentialSavings = 0;
    let totalOrganicClicks = 0;
    let totalPaidSessions = 0;
    const searchLower = searchTerm.toLowerCase();
    
    // Group by URL
    const urlMap = new Map<string, UrlEfficiencyRow>();

    // 1. Initialize with precise URL-level data
    for (let i = 0; i < urlData.length; i++) {
        const row = urlData[i];
        const url = row.url || '(not set)';
        
        urlMap.set(url, {
            url,
            cluster: 'Other',
            organicClicks: row.organicClicks || 0,
            paidSessions: row.ppcSessions || 0,
            paidShare: 0,
            ppcCost: row.ppcCost || 0,
            avgCpc: row.ppcSessions > 0 ? (row.ppcCost || 0) / row.ppcSessions : 0,
            convRateOrganic: (row.organicCvr || 0), 
            convRatePaid: row.ppcSessions > 0 ? ((row.ppcConversions || 0) / row.ppcSessions) * 100 : 0,
            paidCpa: (row.ppcConversions || 0) > 0 ? (row.ppcCost || 0) / row.ppcConversions : 0,
            queries: [],
            avgOrganicRank: null
        });

        // Global metrics from precise URL data
        totalCost += row.ppcCost || 0;
        totalOrganicClicks += row.organicClicks || 0;
        totalPaidSessions += row.ppcSessions || 0;
    }

    // 2. Attach keyword data for breakdown and rank calculation
    for (let i = 0; i < keywordData.length; i++) {
        const row = keywordData[i];
        const url = row.url || '(not set)';
        
        let urlEntry = urlMap.get(url);
        if (!urlEntry) {
            urlEntry = {
                url,
                cluster: 'Other',
                organicClicks: row.organicClicks || 0,
                paidSessions: row.paidSessions || 0,
                paidShare: 0,
                ppcCost: row.ppcCost || 0,
                avgCpc: row.paidSessions > 0 ? (row.ppcCost || 0) / row.paidSessions : 0,
                convRateOrganic: 0,
                convRatePaid: row.paidCvr || 0,
                paidCpa: row.paidConversions > 0 ? (row.ppcCost || 0) / row.paidConversions : 0,
                queries: [],
                avgOrganicRank: null
            };
            urlMap.set(url, urlEntry);
            
            totalCost += row.ppcCost || 0;
            totalOrganicClicks += row.organicClicks || 0;
            totalPaidSessions += row.paidSessions || 0;
        }
        
        urlEntry.queries.push(row);
    }

    const result: UrlEfficiencyRow[] = [];

    urlMap.forEach((urlData) => {
        // Apply filters
        if (searchTerm && !urlData.url.toLowerCase().includes(searchLower)) return;

        // Calculate avg rank
        let totalRank = 0;
        let rankCount = 0;
        urlData.queries.forEach(q => {
            if (q.organicRank !== null) {
                totalRank += q.organicRank;
                rankCount++;
            }
        });
        urlData.avgOrganicRank = rankCount > 0 ? totalRank / rankCount : null;

        // Clustering
        if (urlData.avgOrganicRank !== null && urlData.avgOrganicRank <= 3 && urlData.ppcCost > 0) {
            urlData.cluster = 'Cannibalization Risk';
            potentialSavings += urlData.ppcCost;
        } else if ((urlData.avgOrganicRank === null || urlData.avgOrganicRank > 10) && urlData.ppcCost > 0) {
            urlData.cluster = 'Paid Reliance';
        } else if (urlData.organicClicks > 0 && (!urlData.ppcCost || urlData.ppcCost === 0)) {
            urlData.cluster = 'Paid Gap';
        }

        if (clusterFilter !== 'All' && urlData.cluster !== clusterFilter) return;

        const totalTraffic = urlData.organicClicks + urlData.paidSessions;
        urlData.paidShare = totalTraffic > 0 ? (urlData.paidSessions / totalTraffic) * 100 : 0;

        // Sort queries by traffic/cost
        urlData.queries.sort((a, b) => (b.organicClicks + b.paidSessions) - (a.organicClicks + a.paidSessions));

        result.push(urlData);
    });

    if (globalMetrics) {
        totalCost = globalMetrics.totalCost;
    }
    
    const optimizedSpend = totalCost - potentialSavings;
    const accumulatedSavings = potentialSavings * 2.5;

    const overallTotalTraffic = totalOrganicClicks + totalPaidSessions;
    const avgPaidShare = overallTotalTraffic > 0 ? (totalPaidSessions / overallTotalTraffic) * 100 : 0;

    // Top Cannibalized URLs (Rank <= 3, High Paid Share)
    const topCannibalizedUrls = result
        .filter(u => u.ppcCost > 0 && u.paidShare > 30) // Only URLs with spend and > 30% paid share
        .sort((a, b) => b.ppcCost - a.ppcCost)
        .slice(0, 5)
        .map(u => ({ url: u.url, organic: u.organicClicks, paid: u.paidSessions, cost: u.ppcCost, share: u.paidShare }));

    return { 
        filteredData: result, 
        metrics: { totalCost, potentialSavings, optimizedSpend, accumulatedSavings, avgPaidShare, topCannibalizedUrls } 
    };
  }, [urlData, keywordData, clusterFilter, searchTerm, globalMetrics]);

  // 3. Sorting
  const sortedData = useMemo(() => {
    const sorted = [...filteredData];
    if (sortConfig) {
      sorted.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (typeof aValue === 'string' || typeof bValue === 'string') {
             const strA = (aValue as string || '').toLowerCase();
             const strB = (bValue as string || '').toLowerCase();
             if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
             if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
             return 0;
        }

        if (sortConfig.key === 'avgOrganicRank') {
            if (aValue === null) return 1; 
            if (bValue === null) return -1;
        }

        if (Number(aValue) < Number(bValue)) return sortConfig.direction === 'asc' ? -1 : 1;
        if (Number(aValue) > Number(bValue)) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
    }
    return sorted;
  }, [filteredData, sortConfig]);

  const handleSort = (key: keyof UrlEfficiencyRow) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const toggleRow = (url: string) => {
    if (expandedUrl === url) {
        setExpandedUrl(null);
    } else {
        setExpandedUrl(url);
    }
  };

  // 5. Chart Data
  const chartData = [
    {
      name: 'Current Spend',
      Spend: metrics.totalCost,
      fill: '#64748b' // Slate 500
    },
    {
      name: 'Optimized Spend',
      Spend: metrics.optimizedSpend,
      fill: '#94a3b8' // Slate 400
    }
  ];

  const handleExport = () => {
    const csv = sortedData.map(d => ({
        URL: d.url,
        Cluster: d.cluster,
        Avg_Organic_Rank: d.avgOrganicRank?.toFixed(1) || 'N/A',
        Organic_Clicks: d.organicClicks,
        Paid_Sessions: d.paidSessions,
        Paid_Share: d.paidShare.toFixed(1) + '%',
        Paid_Cost: d.ppcCost.toFixed(2),
        Avg_CPC: d.avgCpc.toFixed(2)
    }));
    exportToCSV(csv, "Optimization_Savings_Report");
  };

  const formatCurrency = (val: number, decimals: number = 2) => {
    return val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };
  
  const formatNumber = (val: number) => {
    return val.toLocaleString('en-US');
  };

  const SortableHeader = ({ label, sortKey, align = 'right', title }: { label: string, sortKey: keyof UrlEfficiencyRow, align?: 'left' | 'center' | 'right', title?: string }) => (
    <th 
        className={`py-2 px-2 text-[9px] font-black text-slate-400 uppercase tracking-tight cursor-pointer hover:text-indigo-600 hover:bg-slate-50 transition-colors select-none text-${align}`}
        onClick={() => handleSort(sortKey)}
        title={title}
    >
        <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
            <span className="whitespace-nowrap">{label}</span>
            {title && <Info size={8} className="text-slate-300" />}
            <div className="flex flex-col">
                <ChevronUp size={8} className={`${sortConfig.key === sortKey && sortConfig.direction === 'asc' ? 'text-indigo-600' : 'text-slate-300'}`} />
                <ChevronDown size={8} className={`${sortConfig.key === sortKey && sortConfig.direction === 'desc' ? 'text-indigo-600' : 'text-slate-300'}`} />
            </div>
        </div>
    </th>
  );

  if (isLoading && urlData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Sincronizando datos de Keywords...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-6">
      
      {/* Section 1: Scorecards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <div className="bg-gradient-to-br from-slate-600 to-slate-700 p-6 rounded-[32px] text-white shadow-lg shadow-slate-500/20 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-6 opacity-20">
                 <DollarSign size={64} />
             </div>
             <p className="text-slate-100 font-bold uppercase tracking-widest text-xs mb-2">Total Spend</p>
             <h3 className="text-4xl font-black tracking-tight">{currencySymbol}{formatCurrency(metrics.totalCost, 0)}</h3>
         </div>
         
         <div className="bg-gradient-to-br from-slate-400 to-slate-500 p-6 rounded-[32px] text-white shadow-lg shadow-slate-400/20 relative overflow-hidden transform hover:scale-[1.02] transition-transform">
             <div className="absolute top-0 right-0 p-6 opacity-20">
                 <PiggyBank size={64} />
             </div>
             <p className="text-slate-100 font-bold uppercase tracking-widest text-xs mb-2 flex items-center gap-2">
                 <Zap size={14} /> Potential Monthly Savings
             </p>
             <h3 className="text-4xl font-black tracking-tight">{currencySymbol}{formatCurrency(metrics.potentialSavings, 0)}</h3>
             <p className="text-slate-100 text-sm mt-2 font-medium">From Optimization</p>
         </div>

         <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-6 rounded-[32px] text-white shadow-lg shadow-indigo-500/20 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-6 opacity-20">
                 <TrendingDown size={64} />
             </div>
             <p className="text-indigo-100 font-bold uppercase tracking-widest text-xs mb-2">Total Synergy Saved</p>
             <h3 className="text-4xl font-black tracking-tight">{currencySymbol}{formatCurrency(metrics.accumulatedSavings, 0)}</h3>
             <p className="text-indigo-200 text-sm mt-2 font-medium">Accumulated over time</p>
         </div>

         <div className="bg-gradient-to-br from-amber-400 to-amber-600 p-6 rounded-[32px] text-white shadow-lg shadow-amber-500/20 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-6 opacity-20">
                 <Target size={64} />
             </div>
             <p className="text-amber-100 font-bold uppercase tracking-widest text-xs mb-2">Avg. Paid Share</p>
             <h3 className="text-4xl font-black tracking-tight">{metrics.avgPaidShare.toFixed(1)}%</h3>
             <p className="text-amber-100 text-sm mt-2 font-medium">Paid vs Organic Traffic</p>
         </div>
      </div>

      {/* Section 2: Chart */}
      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm">
          <h4 className="text-sm font-black text-slate-800 mb-6">Spend Optimization</h4>
          <div className="h-[250px] mb-8" style={{ minHeight: 250 }}>
              <ResponsiveContainer width="100%" height="100%" minHeight={250}>
                  <BarChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{fontSize: 12, fontWeight: 700, fill: '#64748b'}} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(val) => `${currencySymbol}${val}`} tick={{fontSize: 12, fontWeight: 700, fill: '#64748b'}} axisLine={false} tickLine={false} />
                      <Tooltip 
                          cursor={{fill: '#f8fafc'}}
                          content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                  return (
                                      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl border border-slate-800">
                                          <p className="font-black text-sm mb-1">{payload[0].payload.name}</p>
                                          <p className="font-bold text-lg text-emerald-400">{currencySymbol}{formatCurrency(payload[0].value as number)}</p>
                                      </div>
                                  );
                              }
                              return null;
                          }}
                      />
                      <Bar dataKey="Spend" radius={[8, 8, 0, 0]}>
                          {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                      </Bar>
                  </BarChart>
              </ResponsiveContainer>
          </div>

          {/* Top Cannibalized URLs */}
          <div className="space-y-4">
              <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Top Cannibalized URLs</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {metrics.topCannibalizedUrls.length > 0 ? metrics.topCannibalizedUrls.map((u, i) => (
                      <div key={i} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] font-bold text-slate-500 truncate max-w-[150px]" title={u.url}>{u.url}</span>
                              <span className="text-[10px] font-black text-rose-600">{currencySymbol}{formatCurrency(u.cost, 0)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden flex">
                                  <div className="h-full bg-rose-500" style={{ width: `${u.share}%` }} />
                                  <div className="h-full bg-emerald-500" style={{ width: `${100 - u.share}%` }} />
                              </div>
                              <span className="text-[10px] font-black text-slate-700">{u.share.toFixed(0)}% Paid</span>
                          </div>
                      </div>
                  )) : (
                      <p className="text-[10px] text-slate-400 italic col-span-full">No major cannibalization detected at URL level.</p>
                  )}
              </div>
          </div>
      </div>

      {/* Section 3: Detailed Savings Table */}
      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm flex flex-col">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h4 className="text-sm font-black text-slate-800">Detailed Savings Table</h4>
                <p className="text-xs font-bold text-slate-500 mt-1">Filtered by Synergy Lab Clusters</p>
              </div>
              
              <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                 <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search URL..." 
                      value={searchTerm} 
                      onChange={e => setSearchTerm(e.target.value)} 
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 ring-indigo-500 transition-all"
                    />
                 </div>
                 <button 
                  onClick={handleExport} 
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-black uppercase transition-all shadow-md whitespace-nowrap w-full md:w-auto"
                 >
                    <FileText size={14} /> CSV
                  </button>
              </div>
          </div>

          {/* Cluster Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
              {['All', 'Cannibalization Risk', 'Paid Reliance', 'Paid Gap'].map(cluster => (
                  <button 
                      key={cluster}
                      onClick={() => setClusterFilter(cluster as any)}
                      className={`px-4 py-2 text-xs font-black rounded-xl transition-all border ${
                          clusterFilter === cluster 
                              ? cluster === 'Cannibalization Risk' ? 'bg-rose-50 text-rose-600 border-rose-200'
                              : cluster === 'Paid Reliance' ? 'bg-amber-50 text-amber-600 border-amber-200'
                              : cluster === 'Paid Gap' ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                              : 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                      {cluster}
                  </button>
              ))}
          </div>

          <div className="overflow-x-auto custom-scrollbar flex-1">
              <table className="w-full text-left border-collapse">
                  <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                          <th className="py-2 px-2 w-8"></th>
                          <SortableHeader label="URL" sortKey="url" align="left" />
                          <SortableHeader label="Cluster" sortKey="cluster" align="center" />
                          <SortableHeader label="SEO Rank" sortKey="avgOrganicRank" align="center" />
                          <SortableHeader label="Org. Clicks" sortKey="organicClicks" />
                          <SortableHeader label="Ads Clicks" sortKey="paidSessions" />
                          <SortableHeader 
                              label="Paid %" 
                              sortKey="paidShare" 
                              align="center" 
                              title="Percentage of traffic coming from Paid vs Organic for this URL"
                          />
                          <SortableHeader label="Spend" sortKey="ppcCost" />
                          <SortableHeader label="Org Cvr" sortKey="convRateOrganic" align="right"/>
                          <SortableHeader label="Paid Cvr" sortKey="convRatePaid" align="right"/>
                          <SortableHeader label="CPA" sortKey="paidCpa" align="right"/>
                      </tr>
                  </thead>
                  <tbody>
                      {sortedData.length > 0 ? sortedData.slice(0, 50).map((row, idx) => (
                          <React.Fragment key={idx}>
                              <tr 
                                  className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer ${expandedUrl === row.url ? 'bg-slate-50/80' : ''}`}
                                  onClick={() => toggleRow(row.url)}
                              >
                                  <td className="py-2 px-2 text-slate-400">
                                      <ChevronRight size={14} className={`transition-transform ${expandedUrl === row.url ? 'rotate-90' : ''}`} />
                                  </td>
                                  <td className="py-2 px-2 max-w-[200px] truncate" title={row.url}>
                                      <span className="text-[11px] font-bold text-slate-800">{row.url}</span>
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-lg whitespace-nowrap ${
                                          row.cluster === 'Cannibalization Risk' ? 'bg-rose-100 text-rose-700' :
                                          row.cluster === 'Paid Reliance' ? 'bg-amber-100 text-amber-700' :
                                          row.cluster === 'Paid Gap' ? 'bg-indigo-100 text-indigo-700' :
                                          'bg-slate-100 text-slate-500'
                                      }`}>
                                          {row.cluster === 'Cannibalization Risk' ? 'RISK' : row.cluster === 'Paid Reliance' ? 'RELIANCE' : row.cluster === 'Paid Gap' ? 'GAP' : 'OTHER'}
                                      </span>
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                      {row.avgOrganicRank ? (
                                          <span className={`px-1.5 py-0.5 rounded-lg text-[10px] font-black ${row.avgOrganicRank <= 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                              #{row.avgOrganicRank.toFixed(1)}
                                          </span>
                                      ) : '-'}
                                  </td>
                                  <td className="py-2 px-2 text-right">
                                      <span className="text-[11px] font-bold text-slate-600">{formatNumber(row.organicClicks)}</span>
                                  </td>
                                  <td className="py-2 px-2 text-right">
                                      <span className="text-[11px] font-bold text-slate-600">{formatNumber(row.paidSessions)}</span>
                                  </td>
                                  <td className="py-2 px-2">
                                      <div className="flex flex-col items-center gap-0.5">
                                          <div className="w-full max-w-[60px] h-1 bg-slate-100 rounded-full overflow-hidden flex">
                                              <div 
                                                  className="h-full bg-amber-500" 
                                                  style={{ width: `${row.paidShare}%` }} 
                                              />
                                              <div 
                                                  className="h-full bg-emerald-500" 
                                                  style={{ width: `${100 - row.paidShare}%` }} 
                                              />
                                          </div>
                                          <span className="text-[9px] font-black text-slate-500">{row.paidShare.toFixed(0)}%</span>
                                      </div>
                                  </td>
                                  <td className="py-2 px-2 text-right">
                                      <span className={`text-[11px] font-bold ${row.cluster === 'Cannibalization Risk' ? 'text-rose-600' : 'text-slate-800'}`}>
                                          {currencySymbol}{formatCurrency(row.ppcCost)}
                                      </span>
                                  </td>
                                  <td className="py-2 px-2 text-right">
                                      <span className="text-[11px] font-bold text-slate-600">
                                          {row.organicClicks > 0 ? `${(row.convRateOrganic || 0).toFixed(2)}%` : '-'}
                                      </span>
                                  </td>
                                  <td className="py-2 px-2 text-right">
                                      <span className="text-[11px] font-bold text-slate-600">
                                          {row.paidSessions > 0 ? `${(row.convRatePaid || 0).toFixed(2)}%` : '-'}
                                      </span>
                                  </td>
                                  <td className="py-2 px-2 text-right">
                                      <span className="text-[11px] font-bold text-slate-600">
                                          {row.paidCpa > 0 ? `${currencySymbol}${formatCurrency(row.paidCpa)}` : '-'}
                                      </span>
                                  </td>
                              </tr>
                              {expandedUrl === row.url && (
                                  <tr className="bg-slate-50/50 border-b border-slate-100">
                                                                             <td colSpan={11} className="p-0">
                                          <div className="p-6 pl-14">
                                              <h5 className="text-xs font-black text-slate-800 mb-3 uppercase tracking-widest">Top 10 Queries for this URL</h5>
                                              <table className="w-full text-left bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                                  <thead className="bg-slate-100/50">
                                                      <tr>
                                                          <th className="py-2 px-4 text-[10px] font-black text-slate-500 uppercase">Query</th>
                                                          <th className="py-2 px-4 text-[10px] font-black text-slate-500 uppercase text-center">Org Rank</th>
                                                          <th className="py-2 px-4 text-[10px] font-black text-slate-500 uppercase text-right">Org Clicks</th>
                                                          <th className="py-2 px-4 text-[10px] font-black text-slate-500 uppercase text-right">Paid Clicks</th>
                                                          <th className="py-2 px-4 text-[10px] font-black text-slate-500 uppercase text-right">Cost</th>
                                                      </tr>
                                                  </thead>
                                                  <tbody>
                                                      {row.queries.slice(0, 10).map((q, qIdx) => (
                                                          <tr key={qIdx} className="border-t border-slate-100 hover:bg-slate-50">
                                                              <td className="py-2 px-4 text-xs font-bold text-slate-700">{q.keyword}</td>
                                                              <td className="py-2 px-4 text-xs text-center text-slate-600">{q.organicRank ? `#${q.organicRank.toFixed(1)}` : '-'}</td>
                                                              <td className="py-2 px-4 text-xs text-right text-slate-600">{formatNumber(q.organicClicks)}</td>
                                                              <td className="py-2 px-4 text-xs text-right text-slate-600">{formatNumber(q.paidSessions)}</td>
                                                              <td className="py-2 px-4 text-xs text-right text-slate-600">{currencySymbol}{formatCurrency(q.ppcCost)}</td>
                                                          </tr>
                                                      ))}
                                                  </tbody>
                                              </table>
                                          </div>
                                      </td>
                                  </tr>
                              )}
                          </React.Fragment>
                      )) : (
                          <tr><td colSpan={11} className="py-12"><EmptyState text="No data found for this cluster." /></td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>

    </div>
  );
};