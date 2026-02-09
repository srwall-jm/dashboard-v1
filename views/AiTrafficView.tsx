
import React, { useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Bot, Zap, TrendingUp, Sparkles, MessageSquare, Search, Brain, FileText } from 'lucide-react';
import { AiTrafficData } from '../types';
import { KpiCard } from '../components/KpiCard';
import { EmptyState } from '../components/EmptyState';
import { exportToCSV } from '../utils';

export const AiTrafficView: React.FC<{
  data: AiTrafficData[];
  currencySymbol: string;
}> = ({ data, currencySymbol }) => {

  // 1. Scorecard Aggregations (Global)
  const scorecards = useMemo(() => {
    const totalSessions = data.reduce((acc, curr) => acc + curr.sessions, 0);
    const totalEngaged = data.reduce((acc, curr) => acc + curr.engagedSessions, 0);
    const avgEngagement = totalSessions > 0 ? (totalEngaged / totalSessions) * 100 : 0;
    
    return { totalSessions, avgEngagement };
  }, [data]);

  // 2. Specific LLM Stats (Breakdown)
  const llmStats = useMemo(() => {
    const stats = {
        chatgpt: 0,
        perplexity: 0,
        gemini: 0,
        claude: 0
    };

    data.forEach(d => {
        const s = d.source.toLowerCase();
        if (s.includes('chatgpt')) stats.chatgpt += d.sessions;
        else if (s.includes('perplexity')) stats.perplexity += d.sessions;
        else if (s.includes('gemini')) stats.gemini += d.sessions;
        else if (s.includes('claude')) stats.claude += d.sessions;
    });

    return stats;
  }, [data]);

  // 3. Trend Chart Data (Time Series by Source)
  const trendData = useMemo(() => {
    const dates = Array.from(new Set(data.map(d => d.date))).sort();
    const sources = Array.from(new Set(data.map(d => d.source)));

    return dates.map(date => {
      const dayData = data.filter(d => d.date === date);
      const entry: any = { date };
      sources.forEach(source => {
        entry[source] = dayData.filter(d => d.source === source).reduce((acc, curr) => acc + curr.sessions, 0);
      });
      return entry;
    });
  }, [data]);

  // 4. Table Data (Landing Page Impact)
  const tableData = useMemo(() => {
    const map: Record<string, { page: string; sessions: number; engaged: number; duration: number }> = {};
    
    data.forEach(d => {
        if (!map[d.landingPage]) map[d.landingPage] = { page: d.landingPage, sessions: 0, engaged: 0, duration: 0 };
        map[d.landingPage].sessions += d.sessions;
        map[d.landingPage].engaged += d.engagedSessions;
    });

    return Object.values(map)
        .map(item => ({
            ...item,
            engagementRate: item.sessions > 0 ? (item.engaged / item.sessions) * 100 : 0
        }))
        .sort((a, b) => b.sessions - a.sessions);
  }, [data]);

  const COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#06b6d4'];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6">
      
      {/* Section A: Global Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <KpiCard 
          title="Total AI Referred Sessions" 
          value={scorecards.totalSessions.toLocaleString()} 
          icon={<Bot />} 
          color="slate"
        />
        <KpiCard 
          title="Avg. AI Engagement Rate" 
          value={`${scorecards.avgEngagement.toFixed(2)}%`} 
          icon={<Zap />} 
          color="slate"
          isPercent
        />
      </div>

      {/* Section B: Individual LLM Breakdown */}
      <div>
        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 px-2">Traffic by Engine</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard 
            title="ChatGPT" 
            value={llmStats.chatgpt.toLocaleString()} 
            icon={<MessageSquare />} 
            color="emerald"
            />
            <KpiCard 
            title="Perplexity" 
            value={llmStats.perplexity.toLocaleString()} 
            icon={<Search />} 
            color="sky"
            />
            <KpiCard 
            title="Gemini" 
            value={llmStats.gemini.toLocaleString()} 
            icon={<Sparkles />} 
            color="violet"
            />
            <KpiCard 
            title="Claude" 
            value={llmStats.claude.toLocaleString()} 
            icon={<Brain />} 
            color="amber"
            />
        </div>
      </div>

      {/* Section C: Trend Chart */}
      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">AI Traffic Over Time</h4>
            <p className="text-[11px] font-bold text-slate-600">Session Volume by Source</p>
          </div>
        </div>
        <div className="h-[350px]">
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff' }}
                    itemStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                    labelStyle={{ color: '#94a3b8', fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}
                />
                <Legend verticalAlign="top" iconType="circle" />
                {Object.keys(trendData[0] || {}).filter(k => k !== 'date').map((source, idx) => (
                    <Line 
                        key={source} 
                        type="monotone" 
                        dataKey={source} 
                        stroke={COLORS[idx % COLORS.length]} 
                        strokeWidth={3} 
                        dot={false}
                        activeDot={{ r: 6 }} 
                    />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No AI traffic data found" />}
        </div>
      </div>

      {/* Section D: Landing Page Table */}
      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex justify-between items-center mb-8">
            <div>
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Landing Page Impact</h4>
              <p className="text-[11px] font-bold text-slate-600">Which content are LLMs referencing?</p>
            </div>
             <button 
                onClick={() => exportToCSV(tableData, "AI_Landing_Page_Impact")} 
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-[9px] font-black uppercase transition-all shadow-md"
              >
                <FileText size={12} /> Export CSV
              </button>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Landing Page</th>
                <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Sessions</th>
                <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Eng. Rate</th>
                <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Quality</th>
              </tr>
            </thead>
            <tbody>
              {tableData.slice(0, 20).map((row, idx) => (
                <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-4 font-bold text-[11px] text-slate-800 truncate max-w-md">{row.page}</td>
                  <td className="py-3 px-4 text-right text-[11px] font-bold text-slate-600">{row.sessions}</td>
                  <td className="py-3 px-4 text-right text-[11px] font-bold text-slate-600">{row.engagementRate.toFixed(1)}%</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end">
                        <div className={`w-2 h-2 rounded-full ${row.engagementRate > 60 ? 'bg-emerald-500' : row.engagementRate > 40 ? 'bg-amber-500' : 'bg-rose-500'}`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tableData.length === 0 && <EmptyState text="No landing pages found" />}
        </div>
      </div>

    </div>
  );
};
