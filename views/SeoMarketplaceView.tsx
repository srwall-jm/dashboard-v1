
import React, { useState, useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ScatterChart, Scatter, ZAxis, Cell, Legend, PieChart, Pie, BarChart, Bar
} from 'recharts';
import { MousePointer2, Eye, Percent, TrendingUp, Tag, ShoppingBag, Globe, FileText, Trophy } from 'lucide-react';
import { DailyData, KeywordData, QueryType } from '../types';
import { exportToCSV, formatDate, getStartOfWeek, normalizeCountry } from '../utils';
import { KpiCard } from '../components/KpiCard';
import { ComparisonTooltip } from '../components/ComparisonTooltip';
import { EmptyState } from '../components/EmptyState';

const CountryShareAnalysis = ({ data, currencySymbol }: { data: any[], currencySymbol: string }) => {
  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316', '#3b82f6'];

  const totalSessions = useMemo(() => data.reduce((acc, curr) => acc + curr.traffic, 0) || 1, [data]);
  const totalRevenue = useMemo(() => data.reduce((acc, curr) => acc + curr.revenue, 0) || 1, [data]);

  const sessionShare = useMemo(() => data.map((d, i) => ({ 
    ...d, 
    value: d.traffic, 
    percent: (d.traffic / totalSessions) * 100,
    color: COLORS[i % COLORS.length]
  })).sort((a,b) => b.value - a.value), [data, totalSessions]);

  const revenueShare = useMemo(() => data.map((d, i) => ({ 
    ...d, 
    value: d.revenue, 
    percent: (d.revenue / totalRevenue) * 100,
    color: COLORS[i % COLORS.length]
  })).sort((a,b) => b.value - a.value), [data, totalRevenue]);

  const efficiencyRank = useMemo(() => data.map((d, i) => ({
    name: d.country,
    efficiency: d.revenue / d.traffic,
    color: COLORS[i % COLORS.length]
  })).sort((a,b) => b.efficiency - a.efficiency), [data]);

  const renderDonut = (shareData: any[], title: string, metric: string, isCurrency = false) => (
    <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{title}</h4>
        <button 
          onClick={() => exportToCSV(shareData, `${title.replace(/ /g, "_")}`)} 
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-[9px] font-black uppercase transition-all shadow-md"
        >
          <FileText size={12} /> Export CSV
        </button>
      </div>
      <div className="w-full h-[250px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={shareData}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={95}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {shareData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              content={({ active, payload }: any) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="bg-slate-900 text-white p-3 rounded-xl border border-white/10 shadow-xl">
                      <p className="text-[9px] font-black uppercase tracking-widest mb-1">{d.country}</p>
                      <p className="text-[11px] font-bold">
                        {isCurrency ? `${currencySymbol}${d.value.toLocaleString()}` : d.value.toLocaleString()} {metric}
                      </p>
                      <p className="text-[9px] text-slate-400">{d.percent.toFixed(1)}% contribution</p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Market</span>
          <span className="text-sm font-black text-slate-900">Distribution</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-6 border-t border-slate-50 pt-6">
        {shareData.slice(0, 8).map((item, i) => (
          <div key={i} className="flex items-center justify-between text-[9px] font-bold">
            <div className="flex items-center gap-1.5 truncate mr-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-slate-600 truncate">{item.country}</span>
            </div>
            <span className="text-slate-900 flex-shrink-0">{item.percent.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6">
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {renderDonut(sessionShare, 'Volume Contribution (Sessions)', 'Sessions')}
          {renderDonut(revenueShare, 'Value Contribution (Revenue)', 'Revenue', true)}
       </div>
       <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Country Efficiency Leaderboard</h4>
              <p className="text-[11px] font-bold text-slate-600">Ingreso promedio generado por cada sesión orgánica por país</p>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => exportToCSV(efficiencyRank, "Country_Efficiency_Leaderboard")} 
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-[9px] font-black uppercase transition-all shadow-md"
              >
                <FileText size={12} /> Export CSV
              </button>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <Trophy size={16} />
              </div>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={efficiencyRank} margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} tickFormatter={(val) => `${currencySymbol}${val}`} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#1e293b'}} />
                <Tooltip cursor={{fill: 'transparent'}} content={({ active, payload }: any) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl border border-white/10 shadow-xl">
                          <p className="text-[9px] font-black uppercase tracking-widest mb-1">{d.name}</p>
                          <p className="text-[11px] font-bold text-emerald-400">{currencySymbol}{d.efficiency.toFixed(2)} per session</p>
                        </div>
                      );
                    }
                    return null;
                }} />
                <Bar dataKey="efficiency" radius={[0, 12, 12, 0]} barSize={24}>
                  {efficiencyRank.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.efficiency > (totalRevenue / totalSessions) ? '#10b981' : '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
       </div>
    </div>
  );
};

export const SeoMarketplaceView = ({ data, keywordData, gscDailyTotals, gscTotals, aggregate, comparisonEnabled, currencySymbol, grouping, isBranded, queryTypeFilter, countryFilter }: {
  data: DailyData[];
  keywordData: KeywordData[];
  gscDailyTotals: any[];
  gscTotals: any;
  aggregate: (data: DailyData[]) => any;
  comparisonEnabled: boolean;
  currencySymbol: string;
  grouping: 'daily' | 'weekly' | 'monthly';
  isBranded: (text: string) => boolean;
  queryTypeFilter: QueryType | 'All';
  countryFilter: string;
}) => {
  const [brandedMetric, setBrandedMetric] = useState<'clicks' | 'impressions'>('clicks');
  const organicGa4 = useMemo(() => aggregate(data.filter((d: any) => d.channel?.toLowerCase().includes('organic'))), [data, aggregate]);
  const gscStats = useMemo(() => {
    if (!gscTotals) return { current: { clicks: 0, impressions: 0, ctr: 0 }, changes: { clicks: 0, impressions: 0, ctr: 0 } };
    const getRangeStats = (label: 'current' | 'previous') => {
      const visibleItems = keywordData.filter(k => k.dateRangeLabel === label);
      const brandedSum = visibleItems.filter(k => isBranded(k.keyword)).reduce((acc, k) => ({ clicks: acc.clicks + k.clicks, impressions: acc.impressions + k.impressions }), { clicks: 0, impressions: 0 });
      const nonBrandedSumVisible = visibleItems.filter(k => !isBranded(k.keyword)).reduce((acc, k) => ({ clicks: acc.clicks + k.clicks, impressions: acc.impressions + k.impressions }), { clicks: 0, impressions: 0 });
      const totalSumForCurrentScope = visibleItems.reduce((acc, k) => ({ clicks: acc.clicks + k.clicks, impressions: acc.impressions + k.impressions }), { clicks: 0, impressions: 0 });
      if (queryTypeFilter === 'Branded') return brandedSum;
      if (queryTypeFilter === 'Non-Branded') return nonBrandedSumVisible;
      if (countryFilter !== 'All') return totalSumForCurrentScope;
      return label === 'current' ? gscTotals.current : gscTotals.previous;
    };
    const cur = getRangeStats('current');
    const prev = getRangeStats('previous');
    const getChange = (c: number, p: number) => p === 0 ? 0 : ((c - p) / p) * 100;
    return {
      current: { ...cur, ctr: cur.impressions > 0 ? (cur.clicks / cur.impressions) * 100 : 0 },
      changes: {
        clicks: getChange(cur.clicks, prev.clicks),
        impressions: getChange(cur.impressions, prev.impressions),
        ctr: getChange(cur.clicks / (cur.impressions || 1), prev.clicks / (prev.impressions || 1))
      }
    };
  }, [gscTotals, keywordData, queryTypeFilter, countryFilter, isBranded]);

  const brandedTrendData = useMemo(() => {
    if (!gscDailyTotals.length) return [];
    const getBucket = (dateStr: string) => {
      if (grouping === 'weekly') return formatDate(getStartOfWeek(new Date(dateStr)));
      if (grouping === 'monthly') return `${dateStr.slice(0, 7)}-01`;
      return dateStr;
    };
    const curDaily = gscDailyTotals.filter(t => t.label === 'current' && (countryFilter === 'All' || t.country === countryFilter)).sort((a,b) => a.date.localeCompare(b.date));
    const prevDaily = gscDailyTotals.filter(t => t.label === 'previous' && (countryFilter === 'All' || t.country === countryFilter)).sort((a,b) => a.date.localeCompare(b.date));
    const curBuckets = Array.from(new Set(curDaily.map(t => getBucket(t.date)))).sort();
    const prevBuckets = Array.from(new Set(prevDaily.map(t => getBucket(t.date)))).sort();
    const aggregateByBucket = (items: any[], kwData: KeywordData[]) => {
      const map: Record<string, any> = {};
      items.forEach(t => {
        const b = getBucket(t.date);
        if (!map[b]) map[b] = { totalClicks: 0, totalImpr: 0, brandedClicks: 0, brandedImpr: 0, genericClicks: 0, genericImpr: 0 };
        map[b].totalClicks += t.clicks;
        map[b].totalImpr += t.impressions;
      });
      kwData.forEach(k => {
        const b = getBucket(k.date || '');
        if (map[b]) {
          if (isBranded(k.keyword)) { map[b].brandedClicks += k.clicks; map[b].brandedImpr += k.impressions; }
          else { map[b].genericClicks += k.clicks; map[b].genericImpr += k.impressions; }
        }
      });
      return map;
    };
    const curMap = aggregateByBucket(curDaily, keywordData.filter(k => k.dateRangeLabel === 'current'));
    const prevMap = aggregateByBucket(prevDaily, keywordData.filter(k => k.dateRangeLabel === 'previous'));
    return curBuckets.map((bucket, index) => {
      const cur = curMap[bucket];
      const pBucket = prevBuckets[index];
      const prev = pBucket ? prevMap[pBucket] : null;
      const m = brandedMetric === 'clicks' ? 'Clicks' : 'Impr';
      return {
        date: bucket,
        [`Branded (Cur)`]: cur[`branded${m}`],
        [`Non-Branded (Cur)`]: cur[`generic${m}`],
        [`Anonymized (Cur)`]: Math.max(0, cur[`total${m}`] - (cur[`branded${m}`] + cur[`generic${m}`])),
        [`Branded (Prev)`]: prev ? prev[`branded${m}`] : 0,
        [`Non-Branded (Prev)`]: prev ? prev[`generic${m}`] : 0,
      };
    });
  }, [gscDailyTotals, keywordData, grouping, brandedMetric, isBranded, countryFilter]);

  const countryPerformanceData = useMemo(() => {
    const map: Record<string, { country: string; traffic: number; revenue: number; sales: number }> = {};
    data.filter((d: any) => d.dateRangeLabel === 'current' && d.channel?.toLowerCase().includes('organic'))
      .forEach((d: any) => { 
        const normalizedName = normalizeCountry(d.country);
        if (!map[normalizedName]) map[normalizedName] = { country: normalizedName, traffic: 0, revenue: 0, sales: 0 }; 
        map[normalizedName].traffic += d.sessions; 
        map[normalizedName].revenue += d.revenue;
        map[normalizedName].sales += d.sales;
      });
    return Object.values(map).filter(item => item.traffic > 0);
  }, [data]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6">
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-6 gap-4">        <KpiCard title="GSC Clicks" value={gscStats.current.clicks} comparison={comparisonEnabled ? gscStats.changes.clicks : undefined} icon={<MousePointer2 />} color="sky" />
        <KpiCard title="GSC Impressions" value={gscStats.current.impressions} comparison={comparisonEnabled ? gscStats.changes.impressions : undefined} icon={<Eye />} color="sky" />
        <KpiCard title="GSC Avg. CTR" value={`${gscStats.current.ctr.toFixed(2)}%`} comparison={comparisonEnabled ? gscStats.changes.ctr : undefined} icon={<Percent />} isPercent color="sky" />
        <KpiCard title="Organic Sessions" value={organicGa4.current.sessions} comparison={comparisonEnabled ? organicGa4.changes.sessions : undefined} icon={<TrendingUp />} color="indigo" />
        <KpiCard title="Organic Revenue" value={`${currencySymbol}${organicGa4.current.revenue.toLocaleString()}`} comparison={comparisonEnabled ? organicGa4.changes.revenue : undefined} icon={<Tag />} prefix={currencySymbol} color="emerald" />
        <KpiCard title="Organic Conv. Rate" value={`${organicGa4.current.cr.toFixed(2)}%`} comparison={comparisonEnabled ? organicGa4.changes.cr : undefined} icon={<ShoppingBag />} isPercent color="emerald" />
      </div>

      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm overflow-hidden w-full mt-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Brand vs Generic Search (Time Overlay)</h4>
            <p className="text-[11px] font-bold text-slate-600">Períodos superpuestos por posición relativa en el tiempo</p>
          </div>
          <div className="flex items-center gap-4">
             <button 
                onClick={() => exportToCSV(brandedTrendData, "Brand_vs_Generic_Trend")} 
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-[9px] font-black uppercase transition-all shadow-md"
              >
                <FileText size={12} /> Export CSV
              </button>
            <div className="flex bg-slate-100 p-1 rounded-xl">
               <button onClick={() => setBrandedMetric('clicks')} className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${brandedMetric === 'clicks' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Clicks</button>
               <button onClick={() => setBrandedMetric('impressions')} className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${brandedMetric === 'impressions' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Impr.</button>
            </div>
          </div>
        </div>
        <div className="h-[400px]">
          {brandedTrendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={brandedTrendData}>
                <defs><linearGradient id="colorBrand" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} tickFormatter={(val) => val.split('-').slice(1).join('/')} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} />
                <Tooltip content={<ComparisonTooltip />} />
                <Legend verticalAlign="top" align="center" iconType="circle" />
                <Area name="Branded (Cur)" type="monotone" dataKey="Branded (Cur)" stroke="#6366f1" fillOpacity={1} fill="url(#colorBrand)" strokeWidth={3} />
                <Area name="Non-Branded (Cur)" type="monotone" dataKey="Non-Branded (Cur)" stroke="#94a3b8" fillOpacity={0} strokeWidth={3} />
                {comparisonEnabled && (
                  <>
                    <Line name="Branded (Prev)" type="monotone" dataKey="Branded (Prev)" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" opacity={0.3} dot={false} />
                    <Line name="Non-Branded (Prev)" type="monotone" dataKey="Non-Branded (Prev)" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" opacity={0.3} dot={false} />
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No query data available" />}
        </div>
      </div>

      <div className="mt-8 space-y-4">
        <div className="flex items-center gap-3 px-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-[9px] shadow-lg shadow-indigo-600/20"><Globe size={14} /></div>
          <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Market Distribution & Efficiency Analysis</h4>
        </div>
        <CountryShareAnalysis data={countryPerformanceData} currencySymbol={currencySymbol} />
      </div>

      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm mt-8">
        <div className="flex justify-between items-center mb-8">
          <div><h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Market Efficiency Analysis (Current Period)</h4><p className="text-[11px] font-bold text-slate-600">Traffic vs Revenue | Size = Revenue Contribution</p></div>
          <button 
            onClick={() => exportToCSV(countryPerformanceData, "Market_Efficiency_Analysis")} 
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-[9px] font-black uppercase transition-all shadow-md"
          >
            <FileText size={12} /> Export CSV
          </button>
        </div>
        <div className="h-[450px]">
          {countryPerformanceData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" dataKey="traffic" name="Traffic" unit=" sess." axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} />
                <YAxis type="number" dataKey="revenue" name="Revenue" unit={` ${currencySymbol}`} axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} tickFormatter={(val) => `${currencySymbol}${val.toLocaleString()}`} />
                <ZAxis type="number" dataKey="revenue" range={[100, 2000]} name="Market Value" unit={` ${currencySymbol}`} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }: any) => { 
                  if (active && payload && payload.length) { 
                    const d = payload[0].payload; 
                    return (
                      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-white/10">
                        <p className="text-[10px] font-black uppercase tracking-widest mb-2 border-b border-white/10 pb-2">{d.country}</p>
                        <div className="space-y-1">
                          <p className="text-[9px] flex justify-between gap-4"><span>Traffic:</span> <span className="font-bold">{d.traffic.toLocaleString()} sess.</span></p>
                          <p className="text-[9px] flex justify-between gap-4"><span>Revenue:</span> <span className="font-bold text-emerald-400">{currencySymbol}{d.revenue.toLocaleString()}</span></p>
                          <p className="text-[9px] flex justify-between gap-4"><span>Efficiency:</span> <span className="font-bold text-indigo-400">{currencySymbol}{(d.revenue / d.traffic).toFixed(2)}/sess.</span></p>
                        </div>
                      </div>
                    ); 
                  } 
                  return null; 
                }} />
                <Scatter name="Organic Markets" data={countryPerformanceData}>
                  {countryPerformanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.revenue > 10000 ? '#10b981' : entry.revenue > 5000 ? '#6366f1' : '#f59e0b'} fillOpacity={0.6} strokeWidth={2} stroke={entry.revenue > 10000 ? '#059669' : entry.revenue > 5000 ? '#4f46e5' : '#d97706'} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          ) : <EmptyState text="Not enough organic data for the Scatter Plot..." />}
        </div>
      </div>
    </div>
  );
};