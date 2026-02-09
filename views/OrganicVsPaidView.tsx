
import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import { TrendingUp, Percent, Tag, ShoppingBag, Globe, FileText, ChevronDown, ArrowUpRight, ArrowDownRight, PieChart as PieIcon } from 'lucide-react';
import { DailyData } from '../types';
import { exportToCSV, formatDate, getStartOfWeek, normalizeCountry } from '../utils';
import { KpiCard } from '../components/KpiCard';
import { ComparisonTooltip } from '../components/ComparisonTooltip';
import { EmptyState } from '../components/EmptyState';

const EcommerceFunnel = ({ title, data, color }: any) => {
  const max = data[0].value || 1;
  return (
    <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm">
      <div className="flex justify-between items-center mb-8">
        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{title}</h4>
        <button 
          onClick={() => exportToCSV(data, `${title.replace(/ /g, "_")}_Funnel`)} 
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-[9px] font-black uppercase transition-all shadow-md"
        >
          <FileText size={12} /> Export CSV
        </button>
      </div>
      <div className="space-y-6">
        {data.map((stage: any, i: number) => {
          const width = (stage.value / max) * 100;
          return (
            <div key={stage.stage} className="relative">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{stage.stage}</span>
                <span className="text-[10px] font-bold text-slate-500">{stage.value.toLocaleString()}</span>
              </div>
              <div className="h-9 bg-slate-50 rounded-xl overflow-hidden border border-slate-100 p-1">
                <div className={`h-full bg-${color}-600 rounded-lg transition-all duration-1000 ease-out flex items-center justify-end px-3 min-w-[5%]`} style={{ width: `${width}%` }}><span className="text-[8px] font-black text-white">{width.toFixed(1)}%</span></div>
              </div>
              {i < data.length - 1 && (<div className="absolute left-1/2 -bottom-4.5 -translate-x-1/2 z-10 flex flex-col items-center"><div className="w-[1px] h-3 bg-slate-200"></div><ChevronDown className="w-3 h-3 text-slate-300 -mt-1" /></div>)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ShareOfSearchAnalysis = ({ stats, currencySymbol }: { stats: any, currencySymbol: string }) => {
  const sessionShare = useMemo(() => {
    const searchVal = stats.organic.current.sessions + stats.paid.current.sessions;
    const othersVal = Math.max(0, stats.total.current.sessions - searchVal);
    const totalVal = stats.total.current.sessions || 1;
    return [
      { name: 'Search (Org + Paid)', value: searchVal, percent: (searchVal / totalVal) * 100 },
      { name: 'Other Channels', value: othersVal, percent: (othersVal / totalVal) * 100 }
    ];
  }, [stats]);

  const revenueShare = useMemo(() => {
    const searchVal = stats.organic.current.revenue + stats.paid.current.revenue;
    const othersVal = Math.max(0, stats.total.current.revenue - searchVal);
    const totalVal = stats.total.current.revenue || 1;
    return [
      { name: 'Search (Org + Paid)', value: searchVal, percent: (searchVal / totalVal) * 100 },
      { name: 'Other Channels', value: othersVal, percent: (othersVal / totalVal) * 100 }
    ];
  }, [stats]);

  const COLORS = ['#6366f1', '#94a3b8']; 

  const renderDonut = (data: any[], title: string, metric: string, isCurrency = false) => (
    <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm flex flex-col items-center h-full">
      <div className="w-full flex justify-between items-center mb-6">
        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest self-start">{title}</h4>
        <button 
          onClick={() => exportToCSV(data, `${title.replace(/ /g, "_")}`)} 
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-[9px] font-black uppercase transition-all shadow-md"
        >
          <FileText size={12} /> Export CSV
        </button>
      </div>
      <div className="w-full h-[220px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              content={({ active, payload }: any) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="bg-slate-900 text-white p-3 rounded-xl border border-white/10 shadow-xl">
                      <p className="text-[9px] font-black uppercase tracking-widest mb-1">{d.name}</p>
                      <p className="text-[11px] font-bold">
                        {isCurrency ? `${currencySymbol}${d.value.toLocaleString()}` : d.value.toLocaleString()} {metric}
                      </p>
                      <p className="text-[9px] text-slate-400">{d.percent.toFixed(1)}% weight</p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-black text-slate-900">{data[0].percent.toFixed(1)}%</span>
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Search Share</span>
        </div>
      </div>
      <div className="w-full space-y-3 mt-4">
        {data.map((item, i) => (
          <div key={i} className="flex justify-between items-center text-[10px] font-bold">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
              <span className="text-slate-600">{item.name}</span>
            </div>
            <span className="text-slate-900">{isCurrency ? `${currencySymbol}${item.value.toLocaleString()}` : item.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full mt-8">
      {renderDonut(sessionShare, 'Share of Total Sessions', 'Sessions')}
      {renderDonut(revenueShare, 'Share of Total Revenue', 'Revenue', true)}
    </div>
  );
};

const CountryPerformanceTable = ({ title, data, type, currencySymbol, comparisonEnabled }: { 
  title: string; 
  data: DailyData[]; 
  type: 'Organic' | 'Paid';
  currencySymbol: string;
  comparisonEnabled: boolean;
}) => {
  const countryStats = useMemo(() => {
    const channelData = data.filter(d => 
      type === 'Organic' ? d.channel.toLowerCase().includes('organic') : 
      (d.channel.toLowerCase().includes('paid') || d.channel.toLowerCase().includes('cpc'))
    );

    const map: Record<string, { country: string; current: any; previous: any }> = {};

    channelData.forEach(d => {
      const normalizedName = normalizeCountry(d.country);
      if (!map[normalizedName]) {
        map[normalizedName] = { 
          country: normalizedName, 
          current: { sessions: 0, sales: 0, revenue: 0 }, 
          previous: { sessions: 0, sales: 0, revenue: 0 } 
        };
      }
      const target = d.dateRangeLabel === 'previous' ? map[normalizedName].previous : map[normalizedName].current;
      target.sessions += d.sessions;
      target.sales += d.sales;
      target.revenue += d.revenue;
    });

    const getChange = (curr: number, prev: number) => prev === 0 ? 0 : ((curr - prev) / prev) * 100;

    return Object.values(map).map(item => ({
      country: item.country,
      // Valores actuales
      sessions: item.current.sessions,
      cr: item.current.sessions > 0 ? (item.current.sales / item.current.sessions) * 100 : 0,
      revenue: item.current.revenue,
      sales: item.current.sales,
      // Cambios porcentuales para la comparación
      changes: {
        sessions: getChange(item.current.sessions, item.previous.sessions),
        cr: getChange(
          item.current.sessions > 0 ? item.current.sales / item.current.sessions : 0,
          item.previous.sessions > 0 ? item.previous.sales / item.previous.sessions : 0
        ),
        revenue: getChange(item.current.revenue, item.previous.revenue),
        sales: getChange(item.current.sales, item.previous.sales)
      }
    })).sort((a, b) => b.sessions - a.sessions);
  }, [data, type]);

  const handleDownload = () => {
    const exportData = countryStats.map(c => ({
      Country: c.country,
      Sessions: c.sessions,
      Conversion_Rate: c.cr.toFixed(2) + "%",
      Revenue: c.revenue.toFixed(2),
      Sales: c.sales
    }));
    exportToCSV(exportData, `Full_Data_${type}_Performance`);
  };

  const RenderValueWithComparison = ({ value, change, isCurrency = false, isPercent = false }: any) => (
    <div className="flex flex-col items-end">
      <span className="font-bold text-slate-900 text-[11px]">
        {isCurrency ? `${currencySymbol}${value.toLocaleString()}` : isPercent ? `${value.toFixed(2)}%` : value.toLocaleString()}
      </span>
      {comparisonEnabled && (
        <div className={`flex items-center text-[9px] font-black ${change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
          {change >= 0 ? <ArrowUpRight className="w-2.5 h-2.5 mr-0.5" /> : <ArrowDownRight className="w-2.5 h-2.5 mr-0.5" />}
          {Math.abs(change).toFixed(1)}%
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full w-full">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${type === 'Organic' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
            <Globe size={18} />
          </div>
          <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{title}</h4>
        </div>
        <button onClick={handleDownload} className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-[9px] font-black uppercase transition-all shadow-md">
          <FileText size={12} /> Export CSV
        </button>
      </div>

      <div className="overflow-x-auto custom-scrollbar flex-1">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Country</th>
              <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Sessions</th>
              <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Conv. Rate</th>
              <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Revenue</th>
              <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Sales</th>
            </tr>
          </thead>
          <tbody>
            {countryStats.slice(0, 10).map((item, idx) => (
              <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                <td className="py-4 px-4 font-black text-slate-800 text-[11px]">{item.country}</td>
                <td className="py-4 px-4 text-right">
                  <RenderValueWithComparison value={item.sessions} change={item.changes.sessions} />
                </td>
                <td className="py-4 px-4 text-right">
                  <RenderValueWithComparison value={item.cr} change={item.changes.cr} isPercent />
                </td>
                <td className="py-4 px-4 text-right">
                  <RenderValueWithComparison value={item.revenue} change={item.changes.revenue} isCurrency />
                </td>
                <td className="py-4 px-4 text-right">
                  <RenderValueWithComparison value={item.sales} change={item.changes.sales} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {countryStats.length === 0 && <EmptyState text="No regional data available" />}
      </div>
    </div>
  );
};

export const OrganicVsPaidView = ({ stats, data, comparisonEnabled, grouping, setGrouping, currencySymbol }: {
  stats: any;
  data: DailyData[];
  comparisonEnabled: boolean;
  grouping: 'daily' | 'weekly' | 'monthly';
  setGrouping: (g: 'daily' | 'weekly' | 'monthly') => void;
  currencySymbol: string;
}) => {
  const [weightMetric, setWeightMetric] = useState<'sessions' | 'revenue'>('sessions');

  const chartData = useMemo(() => {
    if (!data.length) return [];
    
    const getBucket = (dateStr: string) => {
      if (grouping === 'weekly') return formatDate(getStartOfWeek(new Date(dateStr)));
      if (grouping === 'monthly') return `${dateStr.slice(0, 7)}-01`;
      return dateStr;
    };

    const curRaw = data.filter(d => d.dateRangeLabel === 'current').sort((a, b) => a.date.localeCompare(b.date));
    const prevRaw = data.filter(d => d.dateRangeLabel === 'previous').sort((a, b) => a.date.localeCompare(b.date));

    if (curRaw.length === 0) return [];

    const curBuckets = Array.from(new Set(curRaw.map(d => getBucket(d.date)))).sort();
    const prevBuckets = Array.from(new Set(prevRaw.map(d => getBucket(d.date)))).sort();

    const aggregateByBucket = (items: DailyData[]) => {
      const map: Record<string, any> = {};
      items.forEach(d => {
        const b = getBucket(d.date);
        if (!map[b]) map[b] = { 
          date: d.date,
          org: 0, paid: 0, orgRev: 0, paidRev: 0, totalSess: 0, totalRev: 0 
        };
        
        const isOrg = d.channel?.toLowerCase().includes('organic');
        const isPaid = d.channel?.toLowerCase().includes('paid') || d.channel?.toLowerCase().includes('cpc');
        
        if (isOrg) { 
          map[b].org += d.sessions; 
          map[b].orgRev += d.revenue; 
        }
        if (isPaid) { 
          map[b].paid += d.sessions; 
          map[b].paidRev += d.revenue; 
        }
        
        map[b].totalSess += d.sessions;
        map[b].totalRev += d.revenue;
      });
      return map;
    };

    const curMap = aggregateByBucket(curRaw);
    const prevMap = aggregateByBucket(prevRaw);

    return curBuckets.map((bucket, index) => {
      const c = curMap[bucket];
      const pBucket = prevBuckets[index];
      const p = pBucket ? prevMap[pBucket] : null;

      let xLabel = bucket;
      const refDate = c.date ? new Date(c.date) : null;
      if (refDate) {
        xLabel = grouping === 'monthly' 
          ? refDate.toLocaleDateString('en-US', { month: 'short' })
          : refDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }

      return {
        date: xLabel,
        fullDateCurrent: c.date || 'N/A',
        fullDatePrevious: p?.date || 'N/A',

        'Organic (Cur)': c.org || 0,
        'Paid (Cur)': c.paid || 0,
        'Organic Rev (Cur)': c.orgRev || 0,
        'Paid Rev (Cur)': c.paidRev || 0,

        'Organic (Prev)': p?.org || 0,
        'Paid (Prev)': p?.paid || 0,
        'Organic Rev (Prev)': p?.orgRev || 0,
        'Paid Rev (Prev)': p?.paidRev || 0,

        'Search Share Sessions (Cur)': c.totalSess > 0 ? ((c.org + c.paid) / c.totalSess) * 100 : 0,
        'Search Share Revenue (Cur)': c.totalRev > 0 ? ((c.orgRev + c.paidRev) / c.totalRev) * 100 : 0,
        'Search Share Sessions (Prev)': p && p.totalSess > 0 ? ((p.org + p.paid) / p.totalSess) * 100 : 0,
        'Search Share Revenue (Prev)': p && p.totalRev > 0 ? ((p.orgRev + p.paidRev) / p.totalRev) * 100 : 0,
      };
    });
  }, [data, grouping]);

  const organicFunnelData = useMemo(() => [
    { stage: 'Sessions', value: stats.organic.current.sessions },
    { stage: 'Add to Basket', value: stats.organic.current.addToCarts },
    { stage: 'Checkout', value: stats.organic.current.checkouts },
    { stage: 'Sale', value: stats.organic.current.sales },
  ], [stats.organic.current]);

  const paidFunnelData = useMemo(() => [
    { stage: 'Sessions', value: stats.paid.current.sessions },
    { stage: 'Add to Basket', value: stats.paid.current.addToCarts },
    { stage: 'Checkout', value: stats.paid.current.checkouts },
    { stage: 'Sale', value: stats.paid.current.sales },
  ], [stats.paid.current]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {[ {type: 'ORG', color: 'indigo', label: 'Organic', s: stats.organic}, {type: 'PAID', color: 'amber', label: 'Paid', s: stats.paid} ].map(ch => (
          <div key={ch.type} className="space-y-4">
            <div className="flex items-center gap-3 px-2"><div className={`w-7 h-7 bg-${ch.color}-600 rounded-lg flex items-center justify-center text-white font-bold text-[9px]`}>{ch.type}</div><h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{ch.label} Performance</h4></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <KpiCard title="Sessions" value={ch.s.current.sessions} comparison={comparisonEnabled ? ch.s.changes.sessions : undefined} absoluteChange={comparisonEnabled ? ch.s.abs.sessions : undefined} icon={<TrendingUp />} color={ch.color} />
              <KpiCard title="Conv. Rate" value={`${ch.s.current.cr.toFixed(2)}%`} comparison={comparisonEnabled ? ch.s.changes.cr : undefined} icon={<Percent />} isPercent color={ch.color} />
              <KpiCard title="Revenue" value={`${currencySymbol}${ch.s.current.revenue.toLocaleString()}`} comparison={comparisonEnabled ? ch.s.changes.revenue : undefined} absoluteChange={comparisonEnabled ? ch.s.abs.revenue : undefined} icon={<Tag />} prefix={currencySymbol} color={ch.type === 'ORG' ? 'emerald' : 'rose'} />
              <KpiCard title="Sales" value={ch.s.current.sales} comparison={comparisonEnabled ? ch.s.changes.sales : undefined} absoluteChange={comparisonEnabled ? ch.s.abs.revenue : undefined} icon={<ShoppingBag />} color={ch.type === 'ORG' ? 'emerald' : 'rose'} />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Sessions Performance (Time Overlay)</h4>
            <p className="text-[11px] font-bold text-slate-600">Períodos superpuestos por posición relativa en el tiempo</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => exportToCSV(chartData, "Sessions_Performance_Overlay")} 
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-[9px] font-black uppercase transition-all shadow-md"
            >
              <FileText size={12} /> Export CSV
            </button>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              {['daily', 'weekly', 'monthly'].map(g => <button key={g} onClick={() => setGrouping(g as any)} className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg transition-all ${grouping === g ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{g === 'daily' ? 'Day' : g === 'weekly' ? 'Week' : 'Month'}</button>)}
            </div>
          </div>
        </div>
        <div className="h-[300px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} />
                <Tooltip content={<ComparisonTooltip />} />
                <Legend verticalAlign="top" align="center" iconType="circle" />
                
                <Line name="Organic (Cur)" type="monotone" dataKey="Organic (Cur)" stroke="#6366f1" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                <Line name="Paid (Cur)" type="monotone" dataKey="Paid (Cur)" stroke="#f59e0b" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                
                {comparisonEnabled && (
                  <>
                    <Line name="Organic (Prev)" type="monotone" dataKey="Organic (Prev)" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" opacity={0.3} dot={false} />
                    <Line name="Paid (Prev)" type="monotone" dataKey="Paid (Prev)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" opacity={0.3} dot={false} />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No data available to chart" />}
        </div>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Revenue Evolution (Time Overlay)</h4>
            <p className="text-[11px] font-bold text-slate-600">Períodos superpuestos por posición relativa en el tiempo | Moneda: {currencySymbol}</p>
          </div>
          <button 
            onClick={() => exportToCSV(chartData, "Revenue_Evolution_Overlay")} 
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-[9px] font-black uppercase transition-all shadow-md"
          >
            <FileText size={12} /> Export CSV
          </button>
        </div>
        <div className="h-[300px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} tickFormatter={(val) => `${currencySymbol}${val.toLocaleString()}`} />
                <Tooltip content={<ComparisonTooltip currency currencySymbol={currencySymbol} />} />
                <Legend verticalAlign="top" align="center" iconType="circle" />
                
                <Line name="Organic Rev (Cur)" type="monotone" dataKey="Organic Rev (Cur)" stroke="#6366f1" strokeWidth={3} dot={false} />
                <Line name="Paid Rev (Cur)" type="monotone" dataKey="Paid Rev (Cur)" stroke="#f59e0b" strokeWidth={3} dot={false} />
                
                {comparisonEnabled && (
                  <>
                    <Line name="Organic Rev (Prev)" type="monotone" dataKey="Organic Rev (Prev)" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" opacity={0.3} dot={false} />
                    <Line name="Paid Rev (Prev)" type="monotone" dataKey="Paid Rev (Prev)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" opacity={0.3} dot={false} />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No revenue data available to chart" />}
        </div>
      </div>

<div className="grid grid-cols-1 gap-8"> {/* Ahora ocuparán todo el ancho */}
  <CountryPerformanceTable 
    title="Organic performance by country" 
    data={data} 
    type="Organic" 
    currencySymbol={currencySymbol} 
    comparisonEnabled={comparisonEnabled} 
  />
  <CountryPerformanceTable 
    title="Paid performance by country" 
    data={data} 
    type="Paid" 
    currencySymbol={currencySymbol} 
    comparisonEnabled={comparisonEnabled} 
  />
</div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <EcommerceFunnel title="Organic Search Funnel" data={organicFunnelData} color="indigo" />
        <EcommerceFunnel title="Paid Search Funnel" data={paidFunnelData} color="amber" />
      </div>

      <div className="mt-8 space-y-4">
        <div className="flex items-center gap-3 px-2">
          <div className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center text-white font-bold text-[9px] shadow-lg shadow-violet-600/20">
            <PieIcon size={14} />
          </div>
          <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Global Search Share (Market Dominance)</h4>
        </div>
        <ShareOfSearchAnalysis stats={stats} currencySymbol={currencySymbol} />
      </div>

      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm mt-8 overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Global Search Share Trend (Time Overlay)</h4>
            <p className="text-[11px] font-bold text-slate-600">Períodos superpuestos por posición relativa en el tiempo</p>
          </div>
          <div className="flex items-center gap-4">
             <button 
                onClick={() => exportToCSV(chartData, "Global_Share_Trend")} 
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-[9px] font-black uppercase transition-all shadow-md"
              >
                <FileText size={12} /> Export CSV
              </button>
            <div className="flex bg-slate-100 p-1 rounded-xl">
               <button onClick={() => setWeightMetric('sessions')} className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${weightMetric === 'sessions' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Share Sessions %</button>
               <button onClick={() => setWeightMetric('revenue')} className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${weightMetric === 'revenue' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Share Revenue %</button>
            </div>
          </div>
        </div>
        <div className="h-[350px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} tickFormatter={(val) => `${val.toFixed(1)}%`} />
                <Tooltip content={<ComparisonTooltip percent />} />
                <Legend verticalAlign="top" align="center" iconType="circle" />
                <Line name={`${weightMetric === 'sessions' ? 'Share Sessions' : 'Share Revenue'} (Cur)`} type="monotone" dataKey={weightMetric === 'sessions' ? 'Search Share Sessions (Cur)' : 'Search Share Revenue (Cur)'} stroke="#8b5cf6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                {comparisonEnabled && (
                  <Line name={`${weightMetric === 'sessions' ? 'Share Sessions' : 'Share Revenue'} (Prev)`} type="monotone" dataKey={weightMetric === 'sessions' ? 'Search Share Sessions (Prev)' : 'Search Share Revenue (Prev)'} stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" opacity={0.3} dot={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No share data available to chart" />}
        </div>
      </div>
    </div>
  );
};
