import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts';
import { 
  DollarSign, TrendingDown, PiggyBank, Target, AlertTriangle, CheckCircle, Search, FileText, Info, Zap, ChevronUp, ChevronDown, Key, ExternalLink, Filter, ChevronRight, RefreshCw
} from 'lucide-react';
import { KeywordBridgeData, GoogleAdsGlobalMetrics } from '../types';
import { KpiCard } from '../components/KpiCard';
import { EmptyState } from '../components/EmptyState';
import { exportToCSV } from '../utils';
import { KeywordSignal, buildRecommendations, RecommendationSettings, DEFAULT_SETTINGS } from '../recommendations';
import { KeywordRecommendations } from '../components/KeywordRecommendations';

interface UrlEfficiencyRow {
  url: string;
  cluster: 'Cannibalization Risk' | 'Paid Reliance' | 'Paid Gap' | 'Other';
  organicClicks: number;
  organicSessions: number;
  organicTransactions: number;
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
  isBranded?: (text: string) => boolean;
  onRefresh?: () => void;
  queryTypeFilter: 'All' | 'Branded' | 'Non-Branded';
  keywordSignals?: KeywordSignal[];
  periodDays?: number;
  recommendationSettings?: RecommendationSettings;
  presentation?: boolean; // client view: recommendations only
  clientName?: string;
  periodLabel?: string;
}> = ({ urlData, keywordData, currencySymbol, globalMetrics, totalGscClicks, isLoading, isBranded, onRefresh, queryTypeFilter, keywordSignals = [], periodDays = 30, recommendationSettings = DEFAULT_SETTINGS, presentation = false, clientName, periodLabel }) => {
  const [clusterFilter, setClusterFilter] = useState<'All' | 'Cannibalization Risk' | 'Paid Reliance' | 'Paid Gap'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'ppcCost', direction: 'desc' });
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);
  const [showLandingPages, setShowLandingPages] = useState(false);

  // 0. Keyword recommendations (reduce / hold / increase), the source of every saving figure in this view
  const { recommendations, summary: recSummary } = useMemo(
    () => buildRecommendations(keywordSignals, isBranded, queryTypeFilter, periodDays, recommendationSettings),
    [keywordSignals, isBranded, queryTypeFilter, periodDays, recommendationSettings]
  );

  // 1. Data Processing Engine & Scorecard Calculations
  const { filteredData, metrics } = useMemo(() => {
    let totalCost = 0;
    let potentialSavings = 0;
    let totalOrganicClicks = 0;
    let totalPaidSessions = 0;
    const searchLower = searchTerm.toLowerCase();
    
    // Group by URL
    const urlMap = new Map<string, UrlEfficiencyRow>();

    // Prepare keywords first, filtered by query type if needed
    const processedKeywords = isBranded && queryTypeFilter !== 'All' 
        ? keywordData.filter(k => {
            const branded = isBranded(k.keyword);
            return queryTypeFilter === 'Branded' ? branded : !branded;
          })
        : keywordData;

    // 1. Initialize from keywords first to ensure we capture all PPC/SEO activity 
    // even if the join in urlData is still processing.
    for (let i = 0; i < processedKeywords.length; i++) {
        const row = processedKeywords[i];
        const url = row.url || '(not set)';
        
        let urlEntry = urlMap.get(url);
        if (!urlEntry) {
            urlEntry = {
                url,
                cluster: 'Other',
                organicClicks: 0,
                organicSessions: 0,
                organicTransactions: 0,
                paidSessions: 0,
                paidShare: 0,
                ppcCost: 0,
                avgCpc: 0,
                convRateOrganic: 0,
                convRatePaid: 0,
                paidCpa: 0,
                queries: [],
                avgOrganicRank: null
            };
            urlMap.set(url, urlEntry);
        }
        
        urlEntry.queries.push(row);
        
        // Always aggregate keyword level metrics
        urlEntry.organicClicks += row.organicClicks || 0;
        urlEntry.organicSessions += row.organicSessions || 0;
        urlEntry.organicTransactions += row.organicTransactions || 0;
        urlEntry.paidSessions += row.paidSessions || 0;
        urlEntry.ppcCost += row.ppcCost || 0;
    }

    // 2. Supplement with urlData if we are in 'All' view to get full URL context 
    // (sessions, transactions that might not be keyed to specific keywords)
    if (queryTypeFilter === 'All') {
        for (let i = 0; i < urlData.length; i++) {
            const row = urlData[i];
            const url = row.url || '(not set)';
            
            let urlEntry = urlMap.get(url);
            if (!urlEntry) {
                urlMap.set(url, {
                    url,
                    cluster: 'Other',
                    organicClicks: row.organicClicks || 0,
                    organicSessions: row.organicSessions || 0,
                    organicTransactions: row.organicTransactions || 0,
                    paidSessions: row.ppcSessions || 0,
                    paidShare: 0,
                    ppcCost: row.ppcCost || 0,
                    avgCpc: row.ppcSessions > 0 ? (row.ppcCost || 0) / row.ppcSessions : 0,
                    convRateOrganic: (row.organicSessions || 0) > 0 ? ((row.organicTransactions || 0) / row.organicSessions) * 100 : 0, 
                    convRatePaid: row.ppcSessions > 0 ? ((row.ppcConversions || 0) / row.ppcSessions) * 100 : 0,
                    paidCpa: (row.ppcConversions || 0) > 0 ? (row.ppcCost || 0) / row.ppcConversions : 0,
                    queries: [],
                    avgOrganicRank: null
                });
            } else {
                // If already created from keywords, we prefer the deeper URL-level stats 
                // for sessions and transactions if they are higher (more accurate total)
                urlEntry.organicClicks = Math.max(urlEntry.organicClicks, row.organicClicks || 0);
                urlEntry.organicSessions = Math.max(urlEntry.organicSessions, row.organicSessions || 0);
                urlEntry.organicTransactions = Math.max(urlEntry.organicTransactions, row.organicTransactions || 0);
                urlEntry.paidSessions = Math.max(urlEntry.paidSessions, row.ppcSessions || 0);
                urlEntry.ppcCost = Math.max(urlEntry.ppcCost, row.ppcCost || 0);
            }
        }
    }

    const result: UrlEfficiencyRow[] = [];
    
    // Reset global totals for final sum
    totalCost = 0;
    totalOrganicClicks = 0;
    totalPaidSessions = 0;

    urlMap.forEach((urlData) => {
        // Apply search filter
        if (searchTerm && !urlData.url.toLowerCase().includes(searchLower)) return;

        // Finalize row metrics
        urlData.avgCpc = urlData.paidSessions > 0 ? urlData.ppcCost / urlData.paidSessions : 0;
        urlData.convRateOrganic = urlData.organicSessions > 0 ? (urlData.organicTransactions / urlData.organicSessions) * 100 : 0;
        // convRatePaid and paidCpa are hard to re-agg perfectly without conversion counts per URL, 
        // we'll use keyword-level averages or row data if we have it.

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

        const totalTraffic = urlData.organicClicks + urlData.paidSessions;
        urlData.paidShare = totalTraffic > 0 ? (urlData.paidSessions / totalTraffic) * 100 : 0;

        // Clustering
        if (urlData.avgOrganicRank !== null && urlData.avgOrganicRank <= 3 && urlData.ppcCost > 0) {
            urlData.cluster = 'Cannibalization Risk';
        } else if ((urlData.avgOrganicRank === null || urlData.avgOrganicRank > 10) && urlData.ppcCost > 0) {
            urlData.cluster = 'Paid Reliance';
        } else if (urlData.organicClicks > 0 && (!urlData.ppcCost || urlData.ppcCost === 0)) {
            urlData.cluster = 'Paid Gap';
        }

        if (clusterFilter !== 'All' && urlData.cluster !== clusterFilter) return;

        // Sort queries by traffic
        urlData.queries.sort((a, b) => (b.organicClicks + b.paidSessions) - (a.organicClicks + a.paidSessions));

        totalCost += urlData.ppcCost;
        totalOrganicClicks += urlData.organicClicks;
        totalPaidSessions += urlData.paidSessions;

        result.push(urlData);
    });

    if (globalMetrics && queryTypeFilter === 'All' && !searchTerm && clusterFilter === 'All') {
        totalCost = globalMetrics.totalCost;
    }
    
    // Savings come from the keyword model, never from a flat percentage of spend.
    potentialSavings = Math.min(recSummary.spendCut, totalCost);
    const optimizedSpend = totalCost - potentialSavings;

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
        metrics: { totalCost, potentialSavings, optimizedSpend, avgPaidShare, topCannibalizedUrls } 
    };
  }, [urlData, keywordData, clusterFilter, queryTypeFilter, searchTerm, globalMetrics, isBranded, recSummary]);

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
      fill: '#475569' // Slate 400
    }
  ];

  const handleExportUrls = () => {
    const csv = sortedData.map(d => ({
        URL: d.url,
        Cluster: d.cluster,
        Avg_Organic_Rank: d.avgOrganicRank?.toFixed(1) || 'N/A',
        Organic_Clicks: d.organicClicks,
        Paid_Sessions: d.paidSessions,
        Paid_Share: d.paidShare.toFixed(1) + '%',
        Paid_Cost: d.ppcCost.toFixed(2),
        Avg_CPC: d.avgCpc.toFixed(2),
        Organic_Cvr: d.organicSessions > 0 ? (d.convRateOrganic || 0).toFixed(2) + '%' : 'N/A',
        Paid_Cvr: d.paidSessions > 0 ? (d.convRatePaid || 0).toFixed(2) + '%' : 'N/A',
        Paid_CPA: d.paidCpa > 0 ? d.paidCpa.toFixed(2) : 'N/A'
    }));
    exportToCSV(csv, "Search_Efficiency_URLs_Report");
  };

  const handleExportKeywords = () => {
    const keywordRows: any[] = [];
    
    sortedData.forEach(urlRow => {
      if (urlRow.queries && urlRow.queries.length > 0) {
        urlRow.queries.forEach(q => {
          keywordRows.push({
            Keyword: q.keyword,
            URL: urlRow.url,
            Cluster: urlRow.cluster,
            SEO_Rank: q.organicRank !== null && q.organicRank !== undefined ? q.organicRank.toFixed(1) : 'N/A',
            Organic_Clicks: q.organicClicks || 0,
            Paid_Sessions_Clicks: q.paidSessions || q.paidClicks || 0,
            PPC_Cost: (q.ppcCost || 0).toFixed(2),
            Avg_CPC: (q.avgCpc || 0).toFixed(2),
            Paid_Conversions: q.paidConversions || 0,
            Action_Label: q.actionLabel || ''
          });
        });
      } else {
        keywordRows.push({
          Keyword: '(no query data)',
          URL: urlRow.url,
          Cluster: urlRow.cluster,
          SEO_Rank: urlRow.avgOrganicRank?.toFixed(1) || 'N/A',
          Organic_Clicks: urlRow.organicClicks,
          Paid_Sessions_Clicks: urlRow.paidSessions,
          PPC_Cost: urlRow.ppcCost.toFixed(2),
          Avg_CPC: urlRow.avgCpc.toFixed(2),
          Paid_Conversions: 0,
          Action_Label: ''
        });
      }
    });

    if (keywordRows.length === 0) {
      keywordData.forEach(q => {
        keywordRows.push({
          Keyword: q.keyword,
          URL: q.url || '(not set)',
          Cluster: 'N/A',
          SEO_Rank: q.organicRank !== null && q.organicRank !== undefined ? q.organicRank.toFixed(1) : 'N/A',
          Organic_Clicks: q.organicClicks || 0,
          Paid_Sessions_Clicks: q.paidSessions || q.paidClicks || 0,
          PPC_Cost: (q.ppcCost || 0).toFixed(2),
          Avg_CPC: (q.avgCpc || 0).toFixed(2),
          Paid_Conversions: q.paidConversions || 0,
          Action_Label: q.actionLabel || ''
        });
      });
    }

    exportToCSV(keywordRows, "Search_Efficiency_Keywords_Report");
  };

  const formatCurrency = (val: number, decimals: number = 2) => {
    return val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };
  
  const formatNumber = (val: number) => {
    return val.toLocaleString('en-US');
  };

  const SortableHeader = ({ label, sortKey, align = 'right', title }: { label: string, sortKey: keyof UrlEfficiencyRow, align?: 'left' | 'center' | 'right', title?: string }) => (
    <th 
        className={`py-2 px-2 text-[11px] font-bold text-slate-500 uppercase tracking-tight cursor-pointer hover:text-indigo-600 hover:bg-slate-50 transition-colors select-none text-${align}`}
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
        <p className="text-slate-500 font-bold uppercase tracking-wide text-[11px]">Syncing keyword data...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">

      {/* Section 1b: Keyword recommendations */}
      <KeywordRecommendations
        recommendations={recommendations}
        summary={recSummary}
        settings={recommendationSettings}
        currencySymbol={currencySymbol}
        periodDays={periodDays}
        periodLabel={periodLabel}
        clientName={clientName}
        isLoading={isLoading}
        presentation={presentation}
      />

      {/* Analyst detail: landing pages. Not part of what the client sees. */}
      {!presentation && (
        <div className="print:hidden space-y-4">
          <button
            type="button"
            onClick={() => setShowLandingPages(v => !v)}
            aria-expanded={showLandingPages}
            className="w-full flex items-center justify-between gap-3 px-6 py-4 bg-white rounded-2xl border border-slate-200 text-left hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 ring-slate-900/30"
          >
            <span>
              <span className="block text-sm font-bold text-slate-900">Analyst detail: landing pages behind these keywords</span>
              <span className="block text-xs font-medium text-slate-600 mt-0.5">Organic and paid by URL, with the queries of each page. Not shown in client view or print.</span>
            </span>
            {showLandingPages ? <ChevronUp size={18} className="text-slate-600 flex-shrink-0" aria-hidden="true" /> : <ChevronDown size={18} className="text-slate-600 flex-shrink-0" aria-hidden="true" />}
          </button>
          {showLandingPages && (
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h4 className="text-base font-bold text-slate-900">Landing pages</h4>
                <p className="text-xs font-medium text-slate-600 mt-1">Overlap: organic top 3 and ads on the same page. Ads only: no organic top 10. Organic only: no ad spend.</p>
              </div>
              
              <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                 <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="Search URL..." 
                      value={searchTerm} 
                      onChange={e => setSearchTerm(e.target.value)} 
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 ring-indigo-500 transition-all"
                    />
                 </div>
                 <div className="flex items-center gap-2 w-full md:w-auto">
                   <button 
                    onClick={handleExportUrls} 
                    className="flex items-center justify-center gap-2 px-3.5 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-bold uppercase transition-all shadow-md whitespace-nowrap flex-1 md:flex-none"
                    title="Export URL efficiency summary report"
                   >
                      <FileText size={14} /> CSV (URLs)
                    </button>
                   <button 
                    onClick={handleExportKeywords} 
                    className="flex items-center justify-center gap-2 px-3.5 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl text-xs font-bold uppercase transition-all shadow-md whitespace-nowrap flex-1 md:flex-none"
                    title="Export keyword level breakdown report"
                   >
                      <Key size={14} /> CSV (Keywords)
                    </button>
                 </div>
              </div>
          </div>

          {/* Cluster & Query Type Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex flex-wrap gap-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide w-full mb-1">Clusters</span>
                  {['All', 'Cannibalization Risk', 'Paid Reliance', 'Paid Gap'].map(cluster => (
                      <button 
                          key={cluster}
                          onClick={() => setClusterFilter(cluster as any)}
                          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all border ${
                              clusterFilter === cluster 
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                          }`}
                      >
                          {cluster === 'Cannibalization Risk' ? 'Overlap' : cluster === 'Paid Reliance' ? 'Ads only' : cluster === 'Paid Gap' ? 'Organic only' : cluster}
                      </button>
                  ))}
              </div>
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
                                  <td className="py-2 px-2 text-slate-500">
                                      <ChevronRight size={14} className={`transition-transform ${expandedUrl === row.url ? 'rotate-90' : ''}`} />
                                  </td>
                                  <td className="py-2 px-2 max-w-[200px] truncate" title={row.url}>
                                      <span className="text-[11px] font-bold text-slate-800">{row.url}</span>
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                      <span className={`text-[11px] font-bold uppercase px-1.5 py-0.5 rounded-lg whitespace-nowrap ${
                                          'bg-slate-100 text-slate-700'
                                      }`}>
                                          {row.cluster === 'Cannibalization Risk' ? 'Overlap' : row.cluster === 'Paid Reliance' ? 'Ads only' : row.cluster === 'Paid Gap' ? 'Organic only' : 'Other'}
                                      </span>
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                      {row.avgOrganicRank ? (
                                          <span className={`px-1.5 py-0.5 rounded-lg text-[11px] font-bold ${row.avgOrganicRank <= 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
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
                                          <span className="text-[11px] font-bold text-slate-500">{row.paidShare.toFixed(0)}%</span>
                                      </div>
                                  </td>
                                  <td className="py-2 px-2 text-right">
                                      <span className={`text-[11px] font-bold ${row.cluster === 'Cannibalization Risk' ? 'text-rose-600' : 'text-slate-800'}`}>
                                          {currencySymbol}{formatCurrency(row.ppcCost)}
                                      </span>
                                  </td>
                                  <td className="py-2 px-2 text-right">
                                      <span className="text-[11px] font-bold text-slate-600">
                                          {row.organicSessions > 0 ? `${(row.convRateOrganic || 0).toFixed(2)}%` : '-'}
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
                                              <div className="flex items-center justify-between mb-3">
                                                   <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Top {row.queries.length} Queries for this URL</h5>
                                                   {row.queries.length > 0 && (
                                                       <button
                                                           onClick={(e) => {
                                                               e.stopPropagation();
                                                               const csv = row.queries.map(q => ({
                                                                   Query: q.keyword,
                                                                   URL: row.url,
                                                                   SEO_Rank: q.organicRank ? `#${q.organicRank.toFixed(1)}` : 'N/A',
                                                                   Organic_Clicks: q.organicClicks || 0,
                                                                   Paid_Clicks: q.paidSessions || q.paidClicks || 0,
                                                                   PPC_Cost: (q.ppcCost || 0).toFixed(2)
                                                               }));
                                                               const sanitizedUrl = row.url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
                                                               exportToCSV(csv, `Queries_${sanitizedUrl}`);
                                                           }}
                                                           className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-[11px] font-bold shadow-sm transition-all"
                                                       >
                                                           <FileText size={12} /> Export URL Queries CSV
                                                       </button>
                                                   )}
                                               </div>
                                              <table className="w-full text-left bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                                  <thead className="bg-slate-100/50">
                                                      <tr>
                                                          <th className="py-2 px-4 text-[11px] font-bold text-slate-500 uppercase">Query</th>
                                                          <th className="py-2 px-4 text-[11px] font-bold text-slate-500 uppercase text-center">Org Rank</th>
                                                          <th className="py-2 px-4 text-[11px] font-bold text-slate-500 uppercase text-right">Org Clicks</th>
                                                          <th className="py-2 px-4 text-[11px] font-bold text-slate-500 uppercase text-right">Paid Clicks</th>
                                                          <th className="py-2 px-4 text-[11px] font-bold text-slate-500 uppercase text-right">Cost</th>
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
          )}
        </div>
      )}

    </div>
  );
};
