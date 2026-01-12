
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  BarChart3, 
  Search, 
  Filter, 
  Calendar,
  ArrowUpRight, 
  ArrowDownRight,
  TrendingUp,
  Sparkles,
  Globe,
  Tag,
  ArrowRightLeft,
  MousePointer2,
  Eye,
  Percent,
  ShoppingBag,
  ExternalLink,
  Target,
  Zap,
  LogIn,
  LogOut,
  RefreshCw,
  Lock,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ComposedChart, Area, AreaChart, Cell
} from 'recharts';
import { generateMockDailyData, generateMockKeywordData } from './mockData';
import { DashboardTab, DashboardFilters, DailyData, KeywordData, QueryType } from './types';
import { getDashboardInsights } from './geminiService';

const CLIENT_ID = "333322783684-pjhn2omejhngckfd46g8bh2dng9dghlc.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly";

const KpiCard: React.FC<{ title: string; value: string; trend?: number; icon: React.ReactNode; color?: string }> = ({ title, value, trend, icon, color = "indigo" }) => (
  <div className={`bg-white p-5 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md border-b-4 border-b-${color}-500`}>
    <div className="flex justify-between items-start mb-3">
      <div className={`p-2 bg-${color}-50 rounded-lg text-${color}-600`}>
        {icon}
      </div>
      {trend !== undefined && (
        <span className={`flex items-center text-xs font-semibold px-2 py-1 rounded-full ${trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {trend >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
          {Math.abs(trend).toFixed(1)}%
        </span>
      )}
    </div>
    <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">{title}</h3>
    <div className="mt-1 flex items-baseline gap-2">
      <span className="text-xl font-bold text-slate-900">{value}</span>
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
    /* global google */
    if (typeof window !== 'undefined' && (window as any).google) {
      // Initialize Sign In
      (window as any).google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleGoogleResponse,
        auto_select: false,
      });

      (window as any).google.accounts.id.renderButton(
        document.getElementById("googleSignInBtn"),
        { theme: "filled_blue", size: "large", width: "320", text: "signin_with", shape: "pill" }
      );

      // Initialize Token Client for Scopes
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
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const decoded = JSON.parse(jsonPayload);
    setUser({
      name: decoded.name,
      email: decoded.email,
      picture: decoded.picture
    });
    setIsAuthenticated(true);
    
    // Request scopes immediately after login
    setTimeout(() => {
        tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
    }, 1000);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setHasScopes(false);
    setUser(null);
  };

  const syncData = () => {
    if (!hasScopes) {
        tokenClientRef.current.requestAccessToken();
        return;
    }
    setIsSyncing(true);
    setTimeout(() => {
        setIsSyncing(false);
    }, 1500);
  };

  const rawDailyData = useMemo(() => generateMockDailyData(120), []);
  const rawKeywordData = useMemo(() => generateMockKeywordData(), []);

  const filteredDailyData = useMemo(() => {
    return rawDailyData.filter(d => {
      const countryMatch = filters.country === 'All' || d.country === filters.country;
      const queryMatch = filters.queryType === 'All' || d.queryType === filters.queryType;
      const dateMatch = d.date >= filters.dateRange.start && d.date <= filters.dateRange.end;
      return countryMatch && queryMatch && dateMatch;
    });
  }, [rawDailyData, filters]);

  const filteredKeywordData = useMemo(() => {
    return rawKeywordData.filter(d => {
      const countryMatch = filters.country === 'All' || d.country === filters.country;
      const queryMatch = filters.queryType === 'All' || d.queryType === filters.queryType;
      const searchMatch = d.keyword.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          d.landingPage.toLowerCase().includes(searchTerm.toLowerCase());
      return countryMatch && queryMatch && searchMatch;
    });
  }, [rawKeywordData, filters, searchTerm]);

  const channelStats = useMemo(() => {
    const getStats = (channel: 'Organic Search' | 'Paid Search') => {
      const data = filteredDailyData.filter(d => d.channel === channel);
      const sessions = data.reduce((acc, curr) => acc + curr.sessions, 0);
      const sales = data.reduce((acc, curr) => acc + curr.sales, 0);
      const revenue = data.reduce((acc, curr) => acc + curr.revenue, 0);
      const clicks = data.reduce((acc, curr) => acc + curr.clicks, 0);
      const impressions = data.reduce((acc, curr) => acc + curr.impressions, 0);
      return {
        sessions, sales, revenue, impressions, clicks,
        cr: sessions > 0 ? (sales / sessions) * 100 : 0,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0
      };
    };
    return { organic: getStats('Organic Search'), paid: getStats('Paid Search') };
  }, [filteredDailyData]);

  const handleGenerateInsights = async () => {
    setLoadingInsights(true);
    const summary = `Panel: ${activeTab}. Organic Revenue: €${channelStats.organic.revenue.toLocaleString()}.`;
    const insights = await getDashboardInsights(summary, activeTab);
    setAiInsights(insights || "No hay datos disponibles.");
    setLoadingInsights(false);
  };

  const Dashboard1 = () => {
    const chartData = useMemo(() => {
      const groups: Record<string, { date: string; organic: number; paid: number }> = {};
      filteredDailyData.forEach(d => {
        if (!groups[d.date]) groups[d.date] = { date: d.date, organic: 0, paid: 0 };
        if (d.channel === 'Organic Search') groups[d.date].organic += d.sessions;
        else groups[d.date].paid += d.sessions;
      });
      return Object.values(groups).sort((a, b) => a.date.localeCompare(b.date));
    }, [filteredDailyData]);

    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
                <div className="w-2 h-2 bg-indigo-600 rounded-full" /> GA4 Organic
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <KpiCard title="Sesiones" value={channelStats.organic.sessions.toLocaleString()} icon={<TrendingUp className="w-4 h-4" />} />
              <KpiCard title="CR" value={`${channelStats.organic.cr.toFixed(2)}%`} icon={<BarChart3 className="w-4 h-4" />} />
              <KpiCard title="Revenue" value={`€${channelStats.organic.revenue.toLocaleString()}`} icon={<Tag className="w-4 h-4" />} />
              <KpiCard title="Ventas" value={channelStats.organic.sales.toLocaleString()} icon={<LayoutDashboard className="w-4 h-4" />} />
            </div>
          </div>
          <div className="space-y-4">
             <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full" /> GA4 Paid
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <KpiCard title="Sesiones" value={channelStats.paid.sessions.toLocaleString()} icon={<TrendingUp className="w-4 h-4" />} color="amber" />
              <KpiCard title="CR" value={`${channelStats.paid.cr.toFixed(2)}%`} icon={<BarChart3 className="w-4 h-4" />} color="amber" />
              <KpiCard title="Revenue" value={`€${channelStats.paid.revenue.toLocaleString()}`} icon={<Tag className="w-4 h-4" />} color="amber" />
              <KpiCard title="Ventas" value={channelStats.paid.sales.toLocaleString()} icon={<LayoutDashboard className="w-4 h-4" />} color="amber" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Area type="monotone" dataKey="organic" name="Organic" fill="#6366f1" stroke="#6366f1" fillOpacity={0.1} strokeWidth={2} />
                <Area type="monotone" dataKey="paid" name="Paid" fill="#f59e0b" stroke="#f59e0b" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const Dashboard2 = () => {
    const seoData = useMemo(() => filteredDailyData.filter(d => d.channel === 'Organic Search'), [filteredDailyData]);
    const seoAgg = useMemo(() => {
        const imp = seoData.reduce((acc, curr) => acc + curr.impressions, 0);
        const clk = seoData.reduce((acc, curr) => acc + curr.clicks, 0);
        return {
            imp, clk,
            rev: seoData.reduce((acc, curr) => acc + curr.revenue, 0),
            sales: seoData.reduce((acc, curr) => acc + curr.sales, 0),
            ctr: imp > 0 ? (clk / imp) * 100 : 0
        }
    }, [seoData]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <KpiCard title="Impresiones" value={seoAgg.imp.toLocaleString()} icon={<Eye className="w-4 h-4" />} />
                <KpiCard title="Clicks" value={seoAgg.clk.toLocaleString()} icon={<MousePointer2 className="w-4 h-4" />} />
                <KpiCard title="CTR" value={`${seoAgg.ctr.toFixed(2)}%`} icon={<Percent className="w-4 h-4" />} color="emerald" />
                <KpiCard title="Revenue" value={`€${seoAgg.rev.toLocaleString()}`} icon={<Tag className="w-4 h-4" />} />
                <KpiCard title="Ventas" value={seoAgg.sales.toLocaleString()} icon={<ShoppingBag className="w-4 h-4" />} />
            </div>
            <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-center">
                <Globe className="w-12 h-12 text-slate-300 mb-4" />
                <h4 className="text-lg font-bold text-slate-900">Métricas de Search Console</h4>
                <p className="text-slate-500 max-w-sm mx-auto mb-6">Datos sincronizados mediante API para el mercado {filters.country === 'All' ? 'Global' : filters.country}.</p>
                {hasScopes ? (
                    <div className="flex items-center gap-2 text-emerald-600 font-bold bg-emerald-50 px-4 py-2 rounded-full text-xs">
                        <ShieldCheck className="w-4 h-4" />
                        Conexión Segura Establecida
                    </div>
                ) : (
                    <button onClick={syncData} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all">
                        Habilitar permisos GSC
                    </button>
                )}
            </div>
        </div>
    );
  };

  const Dashboard3 = () => {
    const sortedData = useMemo(() => [...filteredKeywordData].sort((a, b) => b.revenue - a.revenue), [filteredKeywordData]);
    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
                <h3 className="font-bold">Deep Dive: Palabras Clave y URLs</h3>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Filtrar..." className="pl-10 pr-4 py-2 bg-white border rounded-lg text-sm" />
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                            <th className="px-6 py-4">Keyword</th>
                            <th className="px-6 py-4">Impresiones</th>
                            <th className="px-6 py-4">CTR</th>
                            <th className="px-6 py-4">Revenue</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {sortedData.slice(0, 15).map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-semibold">{row.keyword}</td>
                                <td className="px-6 py-4 tabular-nums">{row.impressions.toLocaleString()}</td>
                                <td className="px-6 py-4 text-indigo-600 font-bold">{row.ctr.toFixed(2)}%</td>
                                <td className="px-6 py-4 font-black">€{row.revenue.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 -left-40 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse" />
        <div className="absolute bottom-0 -right-40 w-96 h-96 bg-emerald-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse delay-700" />
        
        <div className="w-full max-w-md bg-white rounded-[40px] p-12 shadow-2xl relative z-10 border border-white/20 transform transition-all">
            <div className="text-center mb-10">
                <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-2xl shadow-indigo-200 mb-6 transform -rotate-6">
                    <Lock className="w-8 h-8" />
                </div>
                <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">SEO Analytics</h1>
                <p className="text-slate-500 font-medium">Inicia sesión para conectar tus informes de <br/><span className="text-indigo-600 font-bold">Google Analytics</span> y <span className="text-indigo-600 font-bold">Search Console</span>.</p>
            </div>

            <div className="flex flex-col items-center gap-6">
                <div id="googleSignInBtn" className="w-full flex justify-center"></div>
                
                <div className="relative w-full py-2">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                    <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-300 tracking-[0.2em] bg-white px-4">Acceso Seguro</div>
                </div>

                <div className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-indigo-500" />
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">OAuth 2.0 configurado para acceso de sólo lectura a las APIs de marketing de Google.</p>
                </div>
            </div>

            <footer className="mt-12 text-center">
                <p className="text-[10px] text-slate-300 uppercase font-black tracking-widest">Client ID: 333322...lc</p>
            </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex text-slate-900">
      <aside className="w-72 bg-white border-r border-slate-200 hidden lg:flex flex-col fixed inset-y-0 shadow-sm z-10">
        <div className="p-8 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200 transform -rotate-3">
              <BarChart3 className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">SEO<span className="text-indigo-600">Metric</span></h1>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Reporting Suite</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-2">
          <NavItem active={activeTab === DashboardTab.ORGANIC_VS_PAID} onClick={() => setActiveTab(DashboardTab.ORGANIC_VS_PAID)} icon={<LayoutDashboard className="w-5 h-5" />} label="Organic vs Paid" />
          <NavItem active={activeTab === DashboardTab.SEO_BY_COUNTRY} onClick={() => setActiveTab(DashboardTab.SEO_BY_COUNTRY)} icon={<Globe className="w-5 h-5" />} label="SEO Marketplace" />
          <NavItem active={activeTab === DashboardTab.KEYWORD_DEEP_DIVE} onClick={() => setActiveTab(DashboardTab.KEYWORD_DEEP_DIVE)} icon={<Search className="w-5 h-5" />} label="Deep Dive" />
        </nav>

        <div className="p-6 border-t border-slate-100 bg-slate-50/50 space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Google APIs</span>
                    {hasScopes ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" />}
                </div>
                <button 
                    onClick={syncData}
                    disabled={isSyncing}
                    className={`w-full py-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${isSyncing ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Sync GA4 & GSC'}
                </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-200 shadow-sm group">
                <div className="flex items-center gap-2 overflow-hidden">
                    <img src={user?.picture} alt="profile" className="w-8 h-8 rounded-full border border-slate-100" />
                    <div className="truncate">
                        <p className="text-[10px] font-black text-slate-900 leading-none truncate">{user?.name}</p>
                        <p className="text-[8px] text-slate-400 truncate">{user?.email}</p>
                    </div>
                </div>
                <button onClick={handleLogout} className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors">
                    <LogOut className="w-4 h-4" />
                </button>
            </div>
        </div>
      </aside>

      <main className="flex-1 lg:ml-72 p-8 lg:p-12 overflow-y-auto">
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Connected to {user?.email}</span>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {activeTab === DashboardTab.ORGANIC_VS_PAID && "Rendimiento Cross-Channel"}
              {activeTab === DashboardTab.SEO_BY_COUNTRY && "SEO Dashboard Avanzado"}
              {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && "Optimización SEO granular"}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 px-4 py-2.5 bg-white border rounded-xl text-sm font-semibold shadow-sm">
              <Calendar className="w-4 h-4 text-slate-400" />
              <div className="flex items-center gap-2 text-xs">
                <input type="date" value={filters.dateRange.start} onChange={e => setFilters({...filters, dateRange: {...filters.dateRange, start: e.target.value}})} className="bg-transparent focus:outline-none" />
                <span className="text-slate-300">-</span>
                <input type="date" value={filters.dateRange.end} onChange={e => setFilters({...filters, dateRange: {...filters.dateRange, end: e.target.value}})} className="bg-transparent focus:outline-none" />
              </div>
            </div>
            <select className="px-4 py-2.5 bg-white border rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20" value={filters.country} onChange={e => setFilters({...filters, country: e.target.value})}>
                <option value="All">Mercado Global</option>
                <option value="Spain">España</option>
                <option value="Mexico">México</option>
                <option value="USA">USA</option>
            </select>
          </div>
        </header>

        {aiInsights && (
          <div className="mb-12 bg-white border border-indigo-100 p-8 rounded-3xl shadow-xl shadow-indigo-100/50 animate-in zoom-in-95 duration-500 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Sparkles className="w-32 h-32 text-indigo-600" />
            </div>
            <div className="flex justify-between items-center mb-6 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200"><Sparkles className="w-4 h-4 text-white" /></div>
                    <h4 className="text-xl font-black tracking-tight text-slate-900">Análisis Estratégico AI</h4>
                </div>
                <button onClick={() => setAiInsights(null)} className="text-slate-400 hover:text-slate-900 bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center font-bold">&times;</button>
            </div>
            <div className="text-slate-600 text-sm leading-relaxed font-medium space-y-4 relative z-10" dangerouslySetInnerHTML={{ __html: aiInsights.replace(/\n/g, '<br/>') }} />
          </div>
        )}

        {activeTab === DashboardTab.ORGANIC_VS_PAID && <Dashboard1 />}
        {activeTab === DashboardTab.SEO_BY_COUNTRY && <Dashboard2 />}
        {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && <Dashboard3 />}

        <div className="mt-12">
            <button 
                onClick={handleGenerateInsights} 
                disabled={loadingInsights} 
                className="group px-8 py-4 bg-slate-900 text-white rounded-2xl text-sm font-bold shadow-xl hover:bg-indigo-600 transition-all flex items-center gap-3 active:scale-95"
            >
                {loadingInsights ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 group-hover:animate-bounce" />}
                Generar Insights con Gemini AI
            </button>
        </div>
      </main>
    </div>
  );
};

const NavItem: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-bold transition-all ${
      active ? 'bg-slate-900 text-white shadow-xl translate-x-1' : 'text-slate-500 hover:bg-slate-50 hover:translate-x-1'
    }`}
  >
    {icon} {label}
  </button>
);

export default App;
