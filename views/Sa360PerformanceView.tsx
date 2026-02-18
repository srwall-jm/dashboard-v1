
import React, { useMemo, useState } from 'react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, BarChart, Bar, ZAxis
} from 'recharts';
import { 
  DollarSign, MousePointerClick, Percent, Search, FileText, Target, ExternalLink, Zap, ChevronUp, ChevronDown
} from 'lucide-react';
import { BridgeData } from '../types';
import { exportToCSV } from '../utils';
import { KpiCard } from '../components/KpiCard';
import { EmptyState } from '../components/EmptyState';

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
};

export const Sa360PerformanceView: React.FC<{ 
  data: BridgeData[]; 
  currencySymbol: string; 
}> = ({ data, currencySymbol }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'ppcCost', direction: 'desc' });

  // 1. Aggregation Logic
  const stats = useMemo(() => {
    // Filter to only paid data first
    const paidItems = data.filter(d => d.ppcCost > 0 || d.ppcSessions > 0);
    
    const totalCost = paidItems.reduce((acc, curr) => acc + curr.ppcCost, 0);
    const totalClicks = paidItems.reduce((acc, curr) => acc + curr.ppcSessions, 0); // Using ppcSessions as Clicks/Sessions proxy
    const totalConversions = paidItems.reduce((acc, curr) => acc + curr.ppcConversions, 0);
    const totalImpressions = paidItems.reduce((acc, curr) => acc + curr.ppcImpressions, 0);
    
    const avgCpc = totalClicks > 0 ? totalCost / totalClicks : 0;
    const avgCpa = totalConversions > 0 ? totalCost / totalConversions : 0;
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    return { totalCost, totalClicks, totalConversions, totalImpressions, avgCpc, avgCpa, ctr, items: paidItems };
  }, [data]);

  // 2. Table Data (Grouped by URL & Sorted)
  const tableData = useMemo(() => {
    const map: Record<string, BridgeData> = {};
    stats.items.forEach(item => {
        // Group logic if duplicates exist, otherwise simple pass through
        if (!map[item.url]) {
            map[item.url] = item;
        } else {
            // Simple accumulation for display purposes if rows are split
            map[item.url] = {
                ...map[item.url],
                ppcCost: map[item.url].ppcCost + item.ppcCost,
                ppcSessions: map[item.url].ppcSessions + item.ppcSessions,
                ppcConversions: map[item.url].ppcConversions + item.ppcConversions,
                ppcImpressions: map[item.url].ppcImpressions + item.ppcImpressions
            }
        }
    });

    let rows = Object.values(map).filter(d => d.url.toLowerCase().includes(searchTerm.toLowerCase()));

    // Sorting Logic
    if (sortConfig) {
        rows.sort((a, b) => {
            let aVal: any = a[sortConfig.key as keyof BridgeData];
            let bVal: any = b[sortConfig.key as keyof BridgeData];

            // Handle Calculated Metrics for Sorting
            if (sortConfig.key === 'cpc') {
                aVal = a.ppcSessions > 0 ? a.ppcCost / a.ppcSessions : 0;
                bVal = b.ppcSessions > 0 ? b.ppcCost / b.ppcSessions : 0;
            } else if (sortConfig.key === 'ctr') {
                aVal = a.ppcImpressions > 0 ? a.ppcSessions / a.ppcImpressions : 0;
                bVal = b.ppcImpressions > 0 ? b.ppcSessions / b.ppcImpressions : 0;
            } else if (sortConfig.key === 'cpa') {
                aVal = a.ppcConversions > 0 ? a.ppcCost / a.ppcConversions : 0;
                bVal = b.ppcConversions > 0 ? b.ppcCost / b.ppcConversions : 0;
            }

            // String Sort
            if (typeof aVal === 'string') {
                 aVal = aVal.toLowerCase();
                 bVal = (bVal || '').toLowerCase();
                 if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                 if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                 return 0;
            }

            // Numeric Sort
            if (Number(aVal) < Number(bVal)) return sortConfig.direction === 'asc' ? -1 : 1;
            if (Number(aVal) > Number(bVal)) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    return rows;
  }, [stats.items, searchTerm, sortConfig]);

  // 3. Efficiency Chart Data (Scatter: Cost vs Conversions)
  const scatterData = useMemo(() => {
    return tableData.map(d => ({
        ...d,
        cpa: d.ppcConversions > 0 ? d.ppcCost / d.ppcConversions : 0
    })).filter(d => d.ppcCost > 0);
  }, [tableData]);

  const maxCost = Math.max(...tableData.map(d => d.ppcCost), 100);
  const maxConversions = Math.max(...tableData.map(d => d.ppcConversions), 10);

  const handleExport = () => {
    const csvData = tableData.map(r => ({
        Landing_Page: r.url,
        Campaign: r.ppcCampaign,
        Cost: r.ppcCost.toFixed(2),
        Clicks: r.ppcSessions,
        Impressions: r.ppcImpressions,
        CTR: (r.ppcImpressions > 0 ? (r.ppcSessions/r.ppcImpressions)*100 : 0).toFixed(2) + '%',
        Conversions: r.ppcConversions.toFixed(2),
        CPA: (r.ppcConversions > 0 ? r.ppcCost/r.ppcConversions : 0).toFixed(2),
        CPC: (r.ppcSessions > 0 ? r.ppcCost/r.ppcSessions : 0).toFixed(2)
    }));
    exportToCSV(csvData, "SA360_Performance_Full_Export");
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const SortableHeader = ({ label, sortKey, align = 'right', width }: { label: string, sortKey: string, align?: 'left' | 'center' | 'right', width?: string }) => (
    <th 
        className={`py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 hover:bg-slate-50 transition-colors select-none text-${align}`}
        style={{ width }}
        onClick={() => handleSort(sortKey)}
    >
        <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
            {label}
            <div className="flex flex-col">
                <ChevronUp size={8} className={`${sortConfig.key === sortKey && sortConfig.direction === 'asc' ? 'text-indigo-600' : 'text-slate-300'}`} />
                <ChevronDown size={8} className={`${sortConfig.key === sortKey && sortConfig.direction === 'desc' ? 'text-indigo-600' : 'text-slate-300'}`} />
            </div>
        </div>
    </th>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6">
      
      {/* SECTION 1: EXECUTIVE SCORECARD */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Updated formatting: symbol together with number */}
        <KpiCard 
            title="Total Spend" 
            value={`${currencySymbol}${stats.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
            icon={<DollarSign />} 
            color="orange" 
        />
        <KpiCard title="Total Clicks" value={stats.totalClicks.toLocaleString('en-US')} icon={<MousePointerClick />} color="blue" />
        <KpiCard title="Avg. CPC" value={stats.avgCpc.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} prefix={currencySymbol} icon={<Target />} color="indigo" />
        <KpiCard title="Avg. CPA" value={stats.avgCpa.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} prefix={currencySymbol} icon={<Zap />} color={stats.avgCpa > 50 ? 'rose' : 'emerald'} />
      </div>

      {/* SECTION 2: VISUAL INTELLIGENCE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Efficiency Matrix */}
         <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Efficiency Matrix</h4>
                    <p className="text-[11px] font-bold text-slate-600">Cost vs. Conversions (Identify Waste & Scale)</p>
                </div>
            </div>
            <div className="h-[300px]">
                {scatterData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" dataKey="ppcCost" name="Cost" unit={currencySymbol} tick={{fontSize: 9, fontWeight: 700}} tickFormatter={(val) => `${currencySymbol}${val.toLocaleString('en-US')}`} />
                    <YAxis type="number" dataKey="ppcConversions" name="Conversions" tick={{fontSize: 9, fontWeight: 700}} tickFormatter={(val) => val.toLocaleString('en-US')} />
                    <ZAxis type="number" dataKey="ppcSessions" range={[50, 400]} name="Clicks" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }: any) => { 
                        if (active && payload && payload.length) { 
                        const d = payload[0].payload; 
                        return (
                            <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-white/10">
                            <p className="text-[10px] font-black uppercase tracking-widest mb-2 border-b border-white/10 pb-2 truncate max-w-[200px]">{d.url}</p>
                            <div className="space-y-1">
                                <p className="text-[9px] flex justify-between gap-4"><span>Cost:</span> <span className="font-bold text-rose-400">{currencySymbol}{d.ppcCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                                <p className="text-[9px] flex justify-between gap-4"><span>Conv:</span> <span className="font-bold text-emerald-400">{d.ppcConversions.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                                <p className="text-[9px] flex justify-between gap-4"><span>CPA:</span> <span className="font-bold">{currencySymbol}{d.cpa.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                            </div>
                            </div>
                        ); 
                        } 
                        return null; 
                    }} />
                    <Scatter name="URLs" data={scatterData}>
                        {scatterData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.ppcConversions > 5 ? '#10b981' : entry.ppcCost > 500 ? '#f43f5e' : '#6366f1'} fillOpacity={0.7} />
                        ))}
                    </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>
                ) : <EmptyState text="No paid data to chart" />}
            </div>
         </div>

         {/* Mini Funnel */}
         <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-6">Paid Funnel Health</h4>
                <div className="space-y-6">
                    <div className="relative">
                        <div className="flex justify-between text-[10px] font-bold mb-1"><span className="text-slate-500">Impressions</span><span className="text-slate-900">{stats.totalImpressions.toLocaleString('en-US')}</span></div>
                        <div className="w-full h-2 bg-slate-100 rounded-full"><div className="h-full bg-slate-300 rounded-full w-full"></div></div>
                    </div>
                    <div className="relative pl-4">
                        <div className="flex justify-between text-[10px] font-bold mb-1"><span className="text-slate-500">Clicks (CTR {stats.ctr.toFixed(2)}%)</span><span className="text-slate-900">{stats.totalClicks.toLocaleString('en-US')}</span></div>
                        <div className="w-full h-2 bg-slate-100 rounded-full"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min((stats.totalClicks / stats.totalImpressions) * 100 * 5, 100)}%` }}></div></div>
                    </div>
                    <div className="relative pl-8">
                        <div className="flex justify-between text-[10px] font-bold mb-1"><span className="text-slate-500">Conversions</span><span className="text-slate-900">{stats.totalConversions.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                        <div className="w-full h-2 bg-slate-100 rounded-full"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min((stats.totalConversions / stats.totalClicks) * 100 * 5, 100)}%` }}></div></div>
                    </div>
                </div>
            </div>
            <div className="mt-8 pt-6 border-t border-slate-100">
                <div className="flex justify-between items-center">
                   <span className="text-[10px] font-black text-slate-400 uppercase">Conversion Rate</span>
                   <span className="text-xl font-black text-slate-900">{stats.totalClicks > 0 ? ((stats.totalConversions / stats.totalClicks) * 100).toFixed(2) : 0}%</span>
                </div>
            </div>
         </div>
      </div>

      {/* SECTION 3: DEEP DIVE TABLE */}
      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">SA360 Performance by URL</h4>
              <p className="text-[11px] font-bold text-slate-600">Detailed breakdown of Landing Pages and Campaigns</p>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
               <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search URL..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:ring-1 ring-indigo-500 transition-all"
                  />
               </div>
               <button 
                onClick={handleExport} 
                className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-[9px] font-black uppercase transition-all shadow-md whitespace-nowrap"
               >
                  <FileText size={12} /> CSV
                </button>
            </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                        <SortableHeader label="Landing Page" sortKey="url" align="left" width="300px" />
                        <SortableHeader label="Campaign" sortKey="ppcCampaign" align="left" />
                        <SortableHeader label="Cost" sortKey="ppcCost" width="120px" />
                        <SortableHeader label="Clicks" sortKey="ppcSessions" />
                        <SortableHeader label="CPC" sortKey="cpc" />
                        <SortableHeader label="CTR" sortKey="ctr" />
                        <SortableHeader label="Conversions" sortKey="ppcConversions" width="100px" />
                        <SortableHeader label="CPA" sortKey="cpa" />
                    </tr>
                </thead>
                <tbody>
                    {tableData.length > 0 ? tableData.slice(0, 50).map((row, idx) => (
                        <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                    <ExternalLink size={10} className="text-slate-300 flex-shrink-0" />
                                    <span className="text-[10px] font-bold text-slate-800 break-all truncate max-w-[280px]" title={row.url}>{row.url}</span>
                                </div>
                            </td>
                            <td className="py-3 px-4">
                                <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{row.ppcCampaign}</span>
                            </td>
                            <td className="py-3 px-4 text-right">
                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-[10px] font-black text-slate-800">{currencySymbol}{row.ppcCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-orange-400" style={{ width: `${Math.min((row.ppcCost / maxCost) * 100, 100)}%` }} />
                                    </div>
                                </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                                <span className="text-[10px] font-bold text-slate-600">{row.ppcSessions.toLocaleString('en-US')}</span>
                            </td>
                            <td className="py-3 px-4 text-right">
                                <span className="text-[10px] font-bold text-slate-600">{row.ppcSessions > 0 ? `${currencySymbol}${(row.ppcCost / row.ppcSessions).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</span>
                            </td>
                            <td className="py-3 px-4 text-right">
                                <span className="text-[10px] font-bold text-slate-600">{row.ppcImpressions > 0 ? `${((row.ppcSessions / row.ppcImpressions) * 100).toFixed(2)}%` : '-'}</span>
                            </td>
                            <td className="py-3 px-4 text-right">
                                <div className="flex flex-col items-end gap-1">
                                    <span className={`text-[10px] font-black ${row.ppcConversions > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{row.ppcConversions.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    {row.ppcConversions > 0 && (
                                        <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500" style={{ width: `${Math.min((row.ppcConversions / maxConversions) * 100, 100)}%` }} />
                                        </div>
                                    )}
                                </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                                <span className={`text-[10px] font-bold ${row.ppcConversions > 0 && (row.ppcCost / row.ppcConversions) < 20 ? 'text-emerald-600' : 'text-slate-600'}`}>
                                    {row.ppcConversions > 0 ? `${currencySymbol}${(row.ppcCost / row.ppcConversions).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                </span>
                            </td>
                        </tr>
                    )) : (
                        <tr><td colSpan={8} className="py-12"><EmptyState text="No SA360 Data Found. Please check settings." /></td></tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

    </div>
  );
};


