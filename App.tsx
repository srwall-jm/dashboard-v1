
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  BarChart3, 
  Search, 
  Calendar,
  ArrowUpRight, 
  ArrowDownRight,
  TrendingUp,
  Sparkles,
  Globe,
  Tag,
  MousePointer2,
  Eye,
  Percent,
  ShoppingBag,
  LogOut,
  RefreshCw,
  Lock,
  CheckCircle2,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  Layers
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, Cell, ComposedChart, Line
} from 'recharts';
import { generateMockDailyData, generateMockKeywordData } from './mockData';
import { DashboardTab, DashboardFilters, DailyData, KeywordData, QueryType, ComparisonMetrics } from './types';
import { getDashboardInsights } from './geminiService';

const CLIENT_ID = "333322783684-pjhn2omejhngckfd46g8bh2dng9dghlc.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly";

const KpiCard: React.FC<{ 
  title: string; 
  value: string; 
  comparison?: ComparisonMetrics; 
  icon: React.ReactNode; 
  color?: string;
  suffix?: string;
}> = ({ title, value, comparison, icon, color = "indigo", suffix = "" }) => (
  <div className={`bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md relative overflow-hidden`}>
    <div className={`absolute top-0 right-0 w-1 h-full bg-${color}-500 opacity-20`} />
    <div className="flex justify-between items-start mb-4">
      <div className={`p-2.5 bg-${color}-50 rounded-xl text-${color}-600`}>
        {icon}
      </div>
      {comparison && (
        <div className={`flex items-center text-[10px] font-bold px-2 py-1 rounded-lg ${comparison.change >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {comparison.change >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
          {Math.abs(comparison.change).toFixed(1)}% {suffix}
        </div>
      )}
    </div>
    <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{title}</h3>
    <div className="mt-1 flex items-baseline gap-2">
      <span className="text-2xl font-black text-slate-900 tracking-tight">{value}</span>
    </div>
  </div>
);

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string; picture: string; accessToken?: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasScopes, setHasScopes] = useState(false);
  const tokenClientRef = useRef<any>(null);

  const [activeTab, setActiveTab] = useState<DashboardTab>(DashboardTab.ORGANIC_VS_PAID);
  const [filters, setFilters] = useState<DashboardFilters>({
    dateRange: { start: '2024-01-01', end: '2024-03-31' },
    country: 'All',
    queryType: 'All'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).google) {
      (window as any).google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleGoogleResponse,
        auto_select: false,
      });

      (window as any).google.accounts.id.renderButton(
        document.getElementById("googleSignInBtn"),
        { theme: "filled_blue", size: "large", width: "320", text: "signin_with", shape: "pill" }
      );

      tokenClientRef.current = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse: any) => {
          if (tokenResponse && tokenResponse.access_token) {
            setHasScopes(true);
            setUser(prev => prev ? { ...prev, accessToken: tokenResponse.access_token } : null);
          }
        },
      });
    }
  }, []);

  const handleGoogleResponse = (response: any) => {
    const base64Url = response.credential.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    const decoded = JSON.parse(jsonPayload);
    setUser({ name: decoded.name, email: decoded.email, picture: decoded.picture });
    setIsAuthenticated(true);
    setTimeout(() => tokenClientRef.current.requestAccessToken({ prompt: 'consent' }), 1000);
  };

  const rawDailyData = useMemo(() => generateMockDailyData(), []);
  const rawKeywordData = useMemo(() => generateMockKeywordData(), []);

  // Filter current period and previous year period
  const processedData = useMemo(() => {
    const currentStart = new Date(filters.dateRange.start);
    const currentEnd = new Date(filters.dateRange.end);
    
    const prevStart = new Date(currentStart);
    prevStart.setFullYear(prevStart.getFullYear() - 1);
    const prevEnd = new Date(currentEnd);
    prevEnd.setFullYear(prevEnd.getFullYear() - 1);

    const filterBase = (d: DailyData) => {
      const countryMatch = filters.country === 'All' || d.country === filters.country;
      const queryMatch = filters.queryType === 'All' || d.queryType === filters.queryType;
      return countryMatch && queryMatch;
    };

    const current = rawDailyData.filter(d => filterBase(d) && d.date >= filters.dateRange.start && d.date <= filters.dateRange.end);
    const previous = rawDailyData.filter(d => filterBase(d) && d.date >= prevStart.toISOString().split('T')[0] && d.date <= prevEnd.toISOString().split('T')[0]);

    return { current, previous };
  }, [rawDailyData, filters]);

  const aggregateMetrics = (data: DailyData[]) => {
    const metrics = data.reduce((acc, curr) => ({
      sessions: acc.sessions + curr.sessions,
      sales: acc.sales + curr.sales,
      revenue: acc.revenue + curr.revenue,
      clicks: acc.clicks + curr.clicks,
      impressions: acc.impressions + curr.impressions,
    }), { sessions: 0, sales: 0, revenue: 0, clicks: 0, impressions: 0 });

    return {
      ...metrics,
      cr: metrics.sessions > 0 ? (metrics.sales / metrics.sessions) * 100 : 0,
      ctr: metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0,
    };
  };

  const channelComparison = useMemo(() => {
    const getChannelStats = (data: DailyData[], channel: 'Organic Search' | 'Paid Search') => aggregateMetrics(data.filter(d => d.channel === channel));
    
    return {
      organic: {
        current: getChannelStats(processedData.current, 'Organic Search'),
        previous: getChannelStats(processedData.previous, 'Organic Search')
      },
      paid: {
        current: getChannelStats(processedData.current, 'Paid Search'),
        previous: getChannelStats(processedData.previous, 'Paid Search')
      }
    };
  }, [processedData]);

  const calcChange = (cur: number, prev: number) => prev === 0 ? 0 : ((cur - prev) / prev) * 100;

  const handleGenerateInsights = async () => {
    setLoadingInsights(true);
    const summary = `Dashboard: ${activeTab}. Country: ${filters.country}. Query: ${filters.queryType}. Organic Revenue: €${channelComparison.organic.current.revenue.toLocaleString()}. Paid Revenue: €${channelComparison.paid.current.revenue.toLocaleString()}. YoY change Organic: ${calcChange(channelComparison.organic.current.revenue, channelComparison.organic.previous.revenue).toFixed(1)}%`;
    const insights = await getDashboardInsights(summary, activeTab);
    setAiInsights(insights || "No hay datos suficientes para el análisis.");
    setLoadingInsights(false);
  };

  const DashboardOrganicVsPaid = () => {
    const chartData = useMemo(() => {
      const groups: Record<string, { date: string; organic: number; paid: number }> = {};
      processedData.current.forEach(d => {
        if (!groups[d.date]) groups[d.date] = { date: d.date, organic: 0, paid: 0 };
        if (d.channel === 'Organic Search') groups[d.date].organic += d.sessions;
        else groups[d.date].paid += d.sessions;
      });
      return Object.values(groups).sort((a, b) => a.date.localeCompare(b.date));
    }, [processedData]);

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white"><Search className="w-4 h-4" /></div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Canal: Organic Search</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <KpiCard title="Sesiones" value={channelComparison.organic.current.sessions.toLocaleString()} icon={<TrendingUp className="w-4 h-4" />} comparison={{current: 0, previous: 0, change: calcChange(channelComparison.organic.current.sessions, channelComparison.organic.previous.sessions)}} />
              <KpiCard title="Conv. Rate" value={`${channelComparison.organic.current.cr.toFixed(2)}%`} icon={<BarChart3 className="w-4 h-4" />} />
              <KpiCard title="Revenue" value={`€${channelComparison.organic.current.revenue.toLocaleString()}`} icon={<Tag className="w-4 h-4" />} comparison={{current: 0, previous: 0, change: calcChange(channelComparison.organic.current.revenue, channelComparison.organic.previous.revenue)}} />
              <KpiCard title="Sales" value={channelComparison.organic.current.sales.toLocaleString()} icon={<ShoppingBag className="w-4 h-4" />} />
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-white"><Layers className="w-4 h-4" /></div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Canal: Paid Search</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <KpiCard title="Sesiones" value={channelComparison.paid.current.sessions.toLocaleString()} color="amber" icon={<TrendingUp className="w-4 h-4" />} comparison={{current: 0, previous: 0, change: calcChange(channelComparison.paid.current.sessions, channelComparison.paid.previous.sessions)}} />
              <KpiCard title="Conv. Rate" value={`${channelComparison.paid.current.cr.toFixed(2)}%`} color="amber" icon={<BarChart3 className="w-4 h-4" />} />
              <KpiCard title="Revenue" value={`€${channelComparison.paid.current.revenue.toLocaleString()}`} color="amber" icon={<Tag className="w-4 h-4" />} comparison={{current: 0, previous: 0, change: calcChange(channelComparison.paid.current.revenue, channelComparison.paid.previous.revenue)}} />
              <KpiCard title="Sales" value={channelComparison.paid.current.sales.toLocaleString()} color="amber" icon={<ShoppingBag className="w-4 h-4" />} />
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h4 className="font-black text-slate-900 flex items-center gap-2 text-sm uppercase tracking-widest">
              <TrendingUp className="w-4 h-4 text-indigo-600" /> Evolución Comparativa de Tráfico
            </h4>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-indigo-600" /> Organic</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-amber-500" /> Paid</div>
            </div>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorOrg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" hide />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 600}} stroke="#94a3b8" />
                <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px'}} />
                <Area type="monotone" dataKey="organic" name="Organic" stroke="#6366f1" strokeWidth={3} fill="url(#colorOrg)" />
                <Area type="monotone" dataKey="paid" name="Paid" stroke="#f59e0b" strokeWidth={3} fill="url(#colorPaid)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  const DashboardSeoMarketplace = () => {
    const seoCurrent = aggregateMetrics(processedData.current.filter(d => d.channel === 'Organic Search'));
    const seoPrevious = aggregateMetrics(processedData.previous.filter(d => d.channel === 'Organic Search'));

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard title="Impresiones" value={seoCurrent.impressions.toLocaleString()} icon={<Eye className="w-4 h-4" />} comparison={{current: 0, previous: 0, change: calcChange(seoCurrent.impressions, seoPrevious.impressions)}} suffix="YoY" />
          <KpiCard title="Clicks" value={seoCurrent.clicks.toLocaleString()} icon={<MousePointer2 className="w-4 h-4" />} comparison={{current: 0, previous: 0, change: calcChange(seoCurrent.clicks, seoPrevious.clicks)}} suffix="YoY" />
          <KpiCard title="CTR" value={`${seoCurrent.ctr.toFixed(2)}%`} icon={<Percent className="w-4 h-4" />} color="emerald" />
          <KpiCard title="Conv. Rate" value={`${seoCurrent.cr.toFixed(2)}%`} icon={<BarChart3 className="w-4 h-4" />} />
          <KpiCard title="Revenue" value={`€${seoCurrent.revenue.toLocaleString()}`} icon={<Tag className="w-4 h-4" />} comparison={{current: 0, previous: 0, change: calcChange(seoCurrent.revenue, seoPrevious.revenue)}} suffix="YoY" />
          <KpiCard title="Sales" value={seoCurrent.sales.toLocaleString()} icon={<ShoppingBag className="w-4 h-4" />} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h4 className="font-black text-slate-900 mb-6 text-sm uppercase tracking-widest flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-500" /> Distribución por Mercado (SEO)
            </h4>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={Object.entries(processedData.current.filter(d => d.channel === 'Organic Search').reduce((acc, curr) => {
                  acc[curr.country] = (acc[curr.country] || 0) + curr.revenue;
                  return acc;
                }, {} as any)).map(([country, rev]) => ({ country, revenue: rev }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="country" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 600}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                  <Bar dataKey="revenue" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-slate-900 p-8 rounded-3xl text-white flex flex-col justify-center relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-10">
                <ShieldCheck className="w-32 h-32" />
             </div>
             <h4 className="text-xl font-black mb-4 relative z-10">Sincronización de Search Console</h4>
             <p className="text-slate-400 text-sm mb-8 relative z-10 leading-relaxed">Conecta directamente con la API de GSC para obtener métricas YoY en tiempo real por cada mercado seleccionado.</p>
             <button 
              onClick={() => { setIsSyncing(true); setTimeout(() => setIsSyncing(false), 2000); }} 
              className="w-full py-4 bg-white text-slate-900 rounded-2xl font-bold hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center gap-3 relative z-10"
             >
                {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Actualizar Datos YoY
             </button>
          </div>
        </div>
      </div>
    );
  };

  const DashboardDeepDive = () => {
    const filteredKeywords = useMemo(() => {
      return rawKeywordData.filter(d => {
        const countryMatch = filters.country === 'All' || d.country === filters.country;
        const queryMatch = filters.queryType === 'All' || d.queryType === filters.queryType;
        const searchMatch = d.keyword.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            d.landingPage.toLowerCase().includes(searchTerm.toLowerCase());
        return countryMatch && queryMatch && searchMatch;
      });
    }, [filters, searchTerm]);

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50">
            <div>
              <h3 className="text-lg font-black text-slate-900">Análisis Granular de SEO</h3>
              <p className="text-slate-500 text-xs font-medium">Keywords y Landing Pages con mayor potencial comercial.</p>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                placeholder="Buscar keyword o URL..." 
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none shadow-sm"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-[0.15em] border-b border-slate-100">
                  <th className="px-8 py-5">Keyword & URL</th>
                  <th className="px-8 py-5">Impressions</th>
                  <th className="px-8 py-5">CTR</th>
                  <th className="px-8 py-5">Conv. Rate</th>
                  <th className="px-8 py-5 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredKeywords.slice(0, 20).map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 text-base mb-1 group-hover:text-indigo-600 transition-colors">{row.keyword}</span>
                        <span className="text-slate-400 text-[10px] font-medium flex items-center gap-1">
                          <Globe className="w-3 h-3" /> {row.landingPage}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5 font-bold tabular-nums text-slate-600">{row.impressions.toLocaleString()}</td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col gap-1.5 min-w-[100px]">
                        <span className="font-black text-indigo-600">{row.ctr.toFixed(2)}%</span>
                        <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                          <div className="bg-indigo-500 h-full" style={{ width: `${Math.min(row.ctr * 5, 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col gap-1.5 min-w-[100px]">
                        <span className="font-black text-emerald-600">{row.conversionRate.toFixed(2)}%</span>
                        <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(row.conversionRate * 10, 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-lg font-black text-slate-900">€{row.revenue.toLocaleString()}</span>
                        <span className="text-[10px] font-bold text-slate-400">{row.sales} ventas</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredKeywords.length === 0 && (
            <div className="p-20 text-center flex flex-col items-center">
              <Search className="w-12 h-12 text-slate-200 mb-4" />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No se encontraron resultados para los filtros seleccionados</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 -left-40 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse" />
        <div className="absolute bottom-0 -right-40 w-96 h-96 bg-emerald-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse delay-700" />
        <div className="w-full max-w-md bg-white rounded-[40px] p-12 shadow-2xl relative z-10 border border-white/20">
            <div className="text-center mb-10">
                <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-2xl shadow-indigo-200 mb-6 transform -rotate-6">
                    <Lock className="w-8 h-8" />
                </div>
                <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">SEO Reporting</h1>
                <p className="text-slate-500 font-medium">Panel avanzado de marketing para <br/><span className="text-indigo-600 font-bold">Google Search Console</span> y <span className="text-indigo-600 font-bold">GA4</span>.</p>
            </div>
            <div className="flex flex-col items-center gap-6">
                <div id="googleSignInBtn" className="w-full flex justify-center"></div>
                <div className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-indigo-500" />
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">OAuth 2.0 de alta seguridad con scopes de solo lectura para GA4 y Webmasters.</p>
                </div>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex text-slate-900">
      <aside className="w-72 bg-white border-r border-slate-200 hidden lg:flex flex-col fixed inset-y-0 shadow-sm z-30">
        <div className="p-8 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-xl shadow-indigo-200">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 leading-none">SEOMetric</h1>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mt-1">Reporting Suite</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-2">
          <NavItem active={activeTab === DashboardTab.ORGANIC_VS_PAID} onClick={() => setActiveTab(DashboardTab.ORGANIC_VS_PAID)} icon={<Layers className="w-5 h-5" />} label="Organic vs Paid" />
          <NavItem active={activeTab === DashboardTab.SEO_BY_COUNTRY} onClick={() => setActiveTab(DashboardTab.SEO_BY_COUNTRY)} icon={<Globe className="w-5 h-5" />} label="SEO Marketplace" />
          <NavItem active={activeTab === DashboardTab.KEYWORD_DEEP_DIVE} onClick={() => setActiveTab(DashboardTab.KEYWORD_DEEP_DIVE)} icon={<Search className="w-5 h-5" />} label="SEO Deep Dive" />
        </nav>

        <div className="p-6 border-t border-slate-100 space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 group">
                <div className="flex items-center gap-2 overflow-hidden">
                    <img src={user?.picture} alt="profile" className="w-8 h-8 rounded-full border border-white shadow-sm" />
                    <div className="truncate">
                        <p className="text-[10px] font-black text-slate-900 leading-none truncate">{user?.name}</p>
                        <p className="text-[8px] text-slate-400 truncate">{user?.email}</p>
                    </div>
                </div>
                <button onClick={() => setIsAuthenticated(false)} className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors">
                    <LogOut className="w-4 h-4" />
                </button>
            </div>
        </div>
      </aside>

      <main className="flex-1 lg:ml-72 p-8 lg:p-12 overflow-y-auto">
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Live Data: {filters.country === 'All' ? 'Global Markets' : filters.country}</span>
            </div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter">
              {activeTab === DashboardTab.ORGANIC_VS_PAID && "Organic vs Paid Search"}
              {activeTab === DashboardTab.SEO_BY_COUNTRY && "Evolución SEO y YoY"}
              {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && "Análisis de Contenido"}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-4 bg-white p-2 rounded-[24px] border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 px-4 py-2 border-r border-slate-100">
              <Calendar className="w-4 h-4 text-slate-400" />
              <div className="flex items-center gap-2 text-[11px] font-bold">
                <input type="date" value={filters.dateRange.start} onChange={e => setFilters({...filters, dateRange: {...filters.dateRange, start: e.target.value}})} className="bg-transparent focus:outline-none" />
                <span className="text-slate-300">-</span>
                <input type="date" value={filters.dateRange.end} onChange={e => setFilters({...filters, dateRange: {...filters.dateRange, end: e.target.value}})} className="bg-transparent focus:outline-none" />
              </div>
            </div>
            <select className="px-4 py-2 bg-transparent text-[11px] font-black uppercase tracking-wider outline-none border-r border-slate-100 cursor-pointer" value={filters.country} onChange={e => setFilters({...filters, country: e.target.value})}>
                <option value="All">Todos los Países</option>
                <option value="Spain">España</option>
                <option value="Mexico">México</option>
                <option value="USA">USA</option>
                <option value="UK">Reino Unido</option>
            </select>
            <select className="px-4 py-2 bg-transparent text-[11px] font-black uppercase tracking-wider outline-none cursor-pointer" value={filters.queryType} onChange={e => setFilters({...filters, queryType: e.target.value as any})}>
                <option value="All">Búsqueda Total</option>
                <option value="Branded">Branded</option>
                <option value="Non-Branded">Non-Branded</option>
            </select>
          </div>
        </header>

        {aiInsights && (
          <div className="mb-12 bg-white border border-indigo-100 p-8 rounded-[32px] shadow-xl shadow-indigo-100/50 animate-in zoom-in-95 duration-500 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Sparkles className="w-40 h-40 text-indigo-600" />
            </div>
            <div className="flex justify-between items-center mb-6 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200"><Sparkles className="w-5 h-5 text-white" /></div>
                    <h4 className="text-2xl font-black tracking-tight text-slate-900">Visión Estratégica AI</h4>
                </div>
                <button onClick={() => setAiInsights(null)} className="text-slate-400 hover:text-slate-900 bg-slate-100 w-10 h-10 rounded-full flex items-center justify-center font-black transition-colors">&times;</button>
            </div>
            <div className="text-slate-600 text-sm leading-loose font-medium space-y-4 relative z-10 pr-12" dangerouslySetInnerHTML={{ __html: aiInsights.replace(/\n/g, '<br/>') }} />
          </div>
        )}

        {activeTab === DashboardTab.ORGANIC_VS_PAID && <DashboardOrganicVsPaid />}
        {activeTab === DashboardTab.SEO_BY_COUNTRY && <DashboardSeoMarketplace />}
        {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && <DashboardDeepDive />}

        <div className="mt-12 flex justify-center">
            <button 
                onClick={handleGenerateInsights} 
                disabled={loadingInsights} 
                className="group px-10 py-5 bg-slate-950 text-white rounded-[24px] text-sm font-black shadow-2xl hover:bg-indigo-600 transition-all flex items-center gap-4 active:scale-95 disabled:opacity-50"
            >
                {loadingInsights ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 group-hover:animate-bounce" />}
                Generar Auditoría Estratégica
            </button>
        </div>
      </main>
    </div>
  );
};

const NavItem: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-sm font-black transition-all ${
      active ? 'bg-slate-950 text-white shadow-xl translate-x-1' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900 hover:translate-x-1'
    }`}
  >
    {icon} {label}
  </button>
);

export default App;
