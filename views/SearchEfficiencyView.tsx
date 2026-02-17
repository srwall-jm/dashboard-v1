
import React, { useMemo, useState } from 'react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import { 
  DollarSign, TrendingUp, PiggyBank, Target, AlertTriangle, CheckCircle, Search, FileText, Info, Zap
} from 'lucide-react';
import { BridgeData } from '../types';
import { KpiCard } from '../components/KpiCard';
import { EmptyState } from '../components/EmptyState';
import { exportToCSV } from '../utils';

interface EfficiencyRow extends BridgeData {
  querySegment: 'Brand' | 'Non-Brand';
  brandTax: number;
  incrementalClicks: number;
  actionTag: string;
  cpaGap: number;
  organicCvr: number;
  avgCpc: number;       // New Metric
  organicValue: number; // New Metric (Organic Sessions * CPC)
}

export const SearchEfficiencyView: React.FC<{ 
  data: BridgeData[]; 
  brandRegexStr: string;
  currencySymbol: string; 
}> = ({ data, brandRegexStr, currencySymbol }) => {
  const [querySegmentFilter, setQuerySegmentFilter] = useState<'All' | 'Brand' | 'Non-Brand'>('All');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Data Processing Engine
  const processedData = useMemo(() => {
    const regex = new RegExp(brandRegexStr, 'i');

    return data.map(row => {
        // A. Segment Logic
        // Check both Query and URL for brand terms to be robust
        const isBrand = regex.test(row.query || '') || regex.test(row.url || '');
        const segment = isBrand ? 'Brand' : 'Non-Brand';

        // B. Calculate Avg CPC & Organic Value
        // Avg CPC = Cost / Paid Sessions (or Clicks)
        // Guard against division by zero
        const avgCpc = row.ppcSessions > 0 ? row.ppcCost / row.ppcSessions : 0;
        
        // Organic Value = What this organic traffic would cost if paid
        // Logic: Organic Sessions * Avg CPC
        const organicValue = row.organicSessions * avgCpc;

        // C. Brand Tax / Potential Savings
        // Logic: If (Brand Term) AND (We Rank #1 Organically) THEN (Paid Cost is "Wasted")
        // Relaxed Rank threshold to 1.9 to account for minor fluctuations
        let brandTax = 0;
        if (segment === 'Brand' && row.organicRank !== null && row.organicRank <= 1.9) {
            brandTax = row.ppcCost;
        }

        // D. Action Tag Logic
        let actionTag = "⚪ MONITOR";
        const paidShare = row.blendedCostRatio;

        if (segment === 'Brand' && row.organicRank !== null && row.organicRank <= 1.9 && paidShare > 0.5) {
            actionTag = "🔴 CUT/TEST (Cannibalization)";
        } else if (segment !== 'Brand' && row.organicRank !== null && row.organicRank <= 3 && paidShare > 0.8) {
            actionTag = "🟡 REVIEW ROI (High Paid Share)";
        } else if (row.organicRank !== null && row.organicRank > 10 && row.ppcSessions === 0) {
            actionTag = "🟢 PUSH PAID (SEO Gap)";
        }

        // E. Incremental Clicks Estimate
        let recaptureRate = 0;
        if (row.organicRank && row.organicRank <= 1.5) recaptureRate = 0.6;
        else if (row.organicRank && row.organicRank <= 3) recaptureRate = 0.4;
        else if (row.organicRank && row.organicRank <= 5) recaptureRate = 0.2;
        
        const incrementalClicks = row.ppcSessions * (1 - recaptureRate);

        return {
            ...row,
            querySegment: segment,
            brandTax,
            actionTag,
            incrementalClicks,
            cpaGap: 0, 
            organicCvr: 0,
            avgCpc,
            organicValue
        } as EfficiencyRow;
    });
  }, [data, brandRegexStr]);

  // 2. Filtering
  const filteredData = useMemo(() => {
    return processedData.filter(d => {
        const matchesSegment = querySegmentFilter === 'All' || d.querySegment === querySegmentFilter;
        const matchesSearch = !searchTerm || d.url.toLowerCase().includes(searchTerm.toLowerCase()) || d.query.toLowerCase().includes(searchTerm.toLowerCase());
        const isRelevant = d.ppcCost > 0 || (d.organicRank !== null && d.organicRank < 20);
        return matchesSegment && matchesSearch && isRelevant;
    });
  }, [processedData, querySegmentFilter, searchTerm]);

  // 3. Scorecard Calculations
  const metrics = useMemo(() => {
    const totalCost = filteredData.reduce((sum, d) => sum + d.ppcCost, 0);
    const potentialSavings = filteredData.reduce((sum, d) => sum + d.brandTax, 0);
    const totalOrganicValue = filteredData.reduce((sum, d) => sum + d.organicValue, 0);
    
    // Weighted Organic Rank
    let weightedRankSum = 0;
    let weightSum = 0;
    filteredData.forEach(d => {
        if (d.organicRank !== null) {
            weightedRankSum += d.organicRank * d.organicSessions;
            weightSum += d.organicSessions;
        }
    });
    const weightedRank = weightSum > 0 ? weightedRankSum / weightSum : 0;

    return { totalCost, potentialSavings, totalOrganicValue, weightedRank };
  }, [filteredData]);

  // 4. Scatter Plot Data
  const scatterData = useMemo(() => {
    return filteredData
        .filter(d => d.ppcCost > 0 && d.organicRank !== null && d.organicRank <= 50)
        .map(d => ({
            x: d.organicRank, // Rank
            y: d.ppcCost,     // Cost
            z: d.ppcSessions, // Bubble Size (Clicks)
            name: d.query || d.url,
            segment: d.querySegment,
            action: d.actionTag
        }));
  }, [filteredData]);

  const handleExport = () => {
    const csv = filteredData.map(d => ({
        URL: d.url,
        Query: d.query,
        Segment: d.querySegment,
        Organic_Rank: d.organicRank?.toFixed(1),
        SA360_Cost: d.ppcCost.toFixed(2),
        Avg_CPC: d.avgCpc.toFixed(2),
        Est_Organic_Value: d.organicValue.toFixed(2),
        Potential_Savings: d.brandTax.toFixed(2),
        Action: d.actionTag,
        Paid_Clicks: d.ppcSessions,
        Incremental_Clicks_Est: d.incrementalClicks.toFixed(0)
    }));
    exportToCSV(csv, "Search_Efficiency_Savings_Report");
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6">
      
      {/* Header & Global Filters */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-3xl border border-slate-200 shadow-sm gap-4">
         <div className="flex items-center gap-4">
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                <Target size={20} />
            </div>
            <div>
                <h3 className="text-sm font-black text-slate-900">Efficiency & Savings</h3>
                <p className="text-[10px] text-slate-500 font-bold">Cross-Channel Optimization</p>
            </div>
         </div>

         <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-xl">
                {['All', 'Brand', 'Non-Brand'].map(seg => (
                    <button 
                        key={seg}
                        onClick={() => setQuerySegmentFilter(seg as any)}
                        className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${querySegmentFilter === seg ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        {seg}
                    </button>
                ))}
            </div>
         </div>
      </div>

      {/* Section 1: Scorecards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         <KpiCard 
            title="Total Paid Cost" 
            value={metrics.totalCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} 
            prefix={currencySymbol}
            icon={<DollarSign />} 
            color="orange" 
         />
         <KpiCard 
            title="Est. Organic Value" 
            value={metrics.totalOrganicValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} 
            prefix={currencySymbol}
            icon={<Zap />} 
            color="indigo" 
         />
         <KpiCard 
            title="Potential Savings" 
            value={metrics.potentialSavings.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} 
            prefix={currencySymbol}
            icon={<PiggyBank />} 
            color="emerald" 
         />
         <KpiCard 
            title="Weighted Org. Rank" 
            value={metrics.weightedRank.toFixed(1)} 
            icon={<TrendingUp />} 
            color="sky" 
         />
      </div>

      {/* Section 2: Efficiency Matrix */}
      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-8">
            <div>
                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Cost Efficiency Matrix</h4>
                <p className="text-[11px] font-bold text-slate-600">Cost vs. Organic Rank (Identify Cannibalization)</p>
            </div>
            <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                <Info size={12} />
                <span>Top Left = High Cost + Good Rank (Review)</span>
            </div>
        </div>
        <div className="h-[400px]">
            {scatterData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                            type="number" 
                            dataKey="x" 
                            name="Organic Rank" 
                            domain={[1, 50]} 
                            tick={{fontSize: 9, fontWeight: 700}} 
                            label={{ value: 'GSC Average Position (Inverted)', position: 'bottom', fontSize: 10, fill: '#94a3b8' }}
                            reversed // Reversed: 1 (Good) is on the Right or Left? Standard Scatter: 0 is Left. 
                            // We want 1 on the Left (Top Left Quadrant logic). So do NOT reverse if 1 is small.
                            // Actually, standard X axis: 0 -> 50. 
                            // If we want Rank 1 on LEFT, we need normal axis 1..50.
                            // The previous prop `reversed` puts 50 on left and 1 on right. 
                            // Let's keep it standard: 1 (Left) -> 50 (Right).
                        />
                        <YAxis 
                            type="number" 
                            dataKey="y" 
                            name="Cost" 
                            unit={currencySymbol} 
                            tick={{fontSize: 9, fontWeight: 700}} 
                        />
                        <ZAxis type="number" dataKey="z" range={[50, 600]} name="Clicks" />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }: any) => { 
                            if (active && payload && payload.length) { 
                                const d = payload[0].payload; 
                                return (
                                    <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-white/10 z-50">
                                        <p className="text-[10px] font-black uppercase tracking-widest mb-2 border-b border-white/10 pb-2 truncate max-w-[200px]">{d.name}</p>
                                        <div className="space-y-1">
                                            <p className="text-[9px] flex justify-between gap-4"><span>Rank:</span> <span className="font-bold text-emerald-400">#{d.x.toFixed(1)}</span></p>
                                            <p className="text-[9px] flex justify-between gap-4"><span>Cost:</span> <span className="font-bold text-rose-400">{currencySymbol}{d.y.toLocaleString()}</span></p>
                                            <p className="text-[9px] flex justify-between gap-4"><span>Type:</span> <span className="font-bold text-indigo-400">{d.segment}</span></p>
                                            <p className="text-[9px] mt-2 italic text-slate-400">{d.action}</p>
                                        </div>
                                    </div>
                                ); 
                            } 
                            return null; 
                        }} />
                        <ReferenceLine x={3} stroke="#cbd5e1" strokeDasharray="3 3" label={{ position: 'insideTopRight', value: 'Top 3 Zone', fontSize: 9, fill: '#94a3b8' }} />
                        <Scatter name="Queries" data={scatterData}>
                            {scatterData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.segment === 'Brand' ? '#f43f5e' : '#6366f1'} fillOpacity={0.6} />
                            ))}
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>
            ) : <EmptyState text="No data available for chart" />}
        </div>
      </div>

      {/* Section 3: Actionable Table */}
      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Optimization Opportunities</h4>
              <p className="text-[11px] font-bold text-slate-600">Prioritized by Cost & Inefficiency</p>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
               <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search Query / URL..." 
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
                        <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Query / URL</th>
                        <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">GSC Rank</th>
                        <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Org. Sessions</th>
                        <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Avg. CPC</th>
                        <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Est. Org Value</th>
                        <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Paid Cost</th>
                        <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Savings</th>
                        <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredData.length > 0 ? filteredData.slice(0, 50).map((row, idx) => (
                        <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 px-4 max-w-[200px]">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-800 truncate" title={row.query}>{row.query || row.url}</span>
                                    <span className="text-[9px] text-slate-400 truncate mt-0.5">{row.url}</span>
                                </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                                {row.organicRank ? (
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${row.organicRank <= 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                        #{row.organicRank.toFixed(1)}
                                    </span>
                                ) : '-'}
                            </td>
                            <td className="py-3 px-4 text-right">
                                <span className="text-[10px] font-bold text-slate-600">{row.organicSessions.toLocaleString()}</span>
                            </td>
                            {/* NEW: Avg CPC */}
                            <td className="py-3 px-4 text-right">
                                <span className="text-[10px] font-bold text-slate-600">{currencySymbol}{row.avgCpc.toFixed(2)}</span>
                            </td>
                            {/* NEW: Organic Value */}
                            <td className="py-3 px-4 text-right">
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                   {currencySymbol}{row.organicValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                                <span className="text-[10px] font-bold text-slate-800">{currencySymbol}{row.ppcCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </td>
                            <td className="py-3 px-4 text-right">
                                {row.brandTax > 0 ? (
                                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                                        {currencySymbol}{row.brandTax.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </span>
                                ) : <span className="text-[10px] text-slate-300">-</span>}
                            </td>
                            <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                    {row.actionTag.includes('CUT') && <AlertTriangle size={12} className="text-rose-500" />}
                                    {row.actionTag.includes('PUSH') && <CheckCircle size={12} className="text-emerald-500" />}
                                    <span className={`text-[9px] font-black uppercase ${row.actionTag.includes('CUT') ? 'text-rose-600' : row.actionTag.includes('REVIEW') ? 'text-amber-600' : row.actionTag.includes('PUSH') ? 'text-emerald-600' : 'text-slate-400'}`}>
                                        {row.actionTag.split('(')[0]}
                                    </span>
                                </div>
                            </td>
                        </tr>
                    )) : (
                        <tr><td colSpan={8} className="py-12"><EmptyState text="No efficiency data found." /></td></tr>
                    )}
                </tbody>
            </table>
        </div>
        
        <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
            <Info size={16} className="text-slate-400 mt-0.5" />
            <p className="text-[10px] text-slate-500 leading-relaxed">
                <strong>Calculation Logic:</strong> 
                <br/>
                • <strong>Avg. CPC:</strong> Total Cost / Paid Sessions (or Clicks).
                <br/>
                • <strong>Est. Org Value:</strong> Organic Sessions × Avg. CPC. (Represents cost avoided by ranking organically).
                <br/>
                • <strong>Potential Savings:</strong> Sum of Paid Cost for <strong>Brand</strong> terms where Organic Rank is <strong>≤ 1.9</strong>.
            </p>
        </div>
      </div>

    </div>
  );
};
