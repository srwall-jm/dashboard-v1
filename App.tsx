
import React, { useState, useMemo, useEffect } from 'react';
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
  Lock
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ComposedChart, Area, AreaChart, Cell
} from 'recharts';
import { generateMockDailyData, generateMockKeywordData } from './mockData';
import { DashboardTab, DashboardFilters, DailyData, KeywordData, QueryType } from './types';
import { getDashboardInsights } from './geminiService';

// Reusable Components
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
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string; picture: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Dashboard State
  const [activeTab, setActiveTab] = useState<DashboardTab>(DashboardTab.ORGANIC_VS_PAID);
  const [filters, setFilters] = useState<DashboardFilters>({
    dateRange: { start: '2024-01-01', end: '2024-03-31' },
    country: 'All',
    queryType: 'All'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // OAuth Initializers
  useEffect(() => {
    /* global google */
    if (typeof window !== 'undefined' && (window as any).google) {
      (window as any).google.accounts.id.initialize({
        client_id: "TU_CLIENT_ID_DE_GOOGLE.apps.googleusercontent.com", // REEMPLAZAR CON ID REAL
        callback: handleGoogleResponse,
      });
      (window as any).google.accounts.id.renderButton(
        document.getElementById("googleSignInBtn"),
        { theme: "outline", size: "large", width: "100%" }
      );
    }
  }, []);

  const handleGoogleResponse = (response: any) => {
    // Simulación de decodificación de JWT (en entorno real usarías una librería como jwt-decode)
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
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
  };

  const syncData = () => {
    setIsSyncing(true);
    // Simulación de fetch a GA4/GSC
    setTimeout(() => {
        setIsSyncing(false);
    }, 2000);
  };

  // Initialize data
  const rawDailyData = useMemo(() => generateMockDailyData(120), []);
  const rawKeywordData = useMemo(() => generateMockKeywordData(), []);

  // Filter logic
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
    const summary = `Panel: ${activeTab}. Revenue: ${channelStats.organic.revenue}.`;
    const insights = await getDashboardInsights(summary, activeTab);
    setAiInsights(insights || "No hay datos disponibles.");
    setLoadingInsights(false);
  };

  // Dashboard 1: Organic vs Paid
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
                <Tooltip />
                <Area type="monotone" dataKey="organic" fill="#6366f1" stroke="#6366f1" fillOpacity={0.1} strokeWidth={2} />
                <Area type="monotone" dataKey="paid" fill="#f59e0b" stroke="#f59e0b" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // Dashboard 2: SEO Only
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
                <p className="text-slate-500 max-w-sm mx-auto">Conectado a GSC vía API para el mercado {filters.country === 'All' ? 'Global' : filters.country}.</p>
            </div>
        </div>
    );
  };

  // Dashboard 3: Keyword Deep Dive
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
                        {sortedData.slice(0, 10).map((row, i) => (
                            <tr key={i}>
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

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-0 -left-40 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse" />
        <div className="absolute bottom-0 -right-40 w-96 h-96 bg-emerald-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse delay-700" />
        
        <div className="w-full max-w-md bg-white rounded-[40px] p-12 shadow-2xl relative z-10 border border-white/20">
            <div className="text-center mb-10">
                <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-2xl shadow-indigo-200 mb-6 transform -rotate-6">
                    <Lock className="w-8 h-8" />
                </div>
                <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Acceso Advanced</h1>
                <p className="text-slate-500 font-medium">Inicia sesión para conectar tus cuentas de <br/><span className="text-indigo-600 font-bold">Google Analytics 4</span> y <span className="text-indigo-600 font-bold">Search Console</span>.</p>
            </div>

            <div className="space-y-4">
                <div id="googleSignInBtn" className="w-full min-h-[50px]"></div>
                
                <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-300 font-bold tracking-widest">Seguridad Corporativa</span></div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <Zap className="w-5 h-5 text-indigo-500" />
                    <span className="text-xs text-slate-500 font-medium leading-tight">Acceso exclusivo con permisos de lectura para reporting automatizado.</span>
                </div>
            </div>

            <footer className="mt-12 text-center">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Powered by Gemini AI Engine</p>
            </footer>
        </div>
      </div>
    );
  }

  // Authenticated View
  return (
    <div className="min-h-screen bg-[#f8fafc] flex text-slate-900">
      {/* Sidebar Navigation */}
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

        {/* User Info & Sync */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 space-y-4">
            <button 
                onClick={syncData}
                disabled={isSyncing}
                className={`w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${isSyncing ? 'bg-indigo-100 text-indigo-600' : 'bg-white border border-slate-200 text-slate-700 hover:shadow-md'}`}
            >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Sincronizando APIs...' : 'Sincronizar GA4/GSC'}
            </button>

            <div className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
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

      {/* Main Content */}
      <main className="flex-1 lg:ml-72 p-8 lg:p-12 overflow-y-auto">
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Live Connection Enabled</span>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {activeTab === DashboardTab.ORGANIC_VS_PAID && "Cross-Channel Performance"}
              {activeTab === DashboardTab.SEO_BY_COUNTRY && "SEO Dashboard Avanzado"}
              {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && "Optimización SEO granular"}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 px-4 py-2.5 bg-white border rounded-xl text-sm font-semibold shadow-sm">
              <Calendar className="w-4 h-4 text-slate-400" />
              <div className="flex items-center gap-2 text-xs">
                <input type="date" value={filters.dateRange.start} onChange={e => setFilters({...filters, dateRange: {...filters.dateRange, start: e.target.value}})} className="bg-transparent" />
                <span>-</span>
                <input type="date" value={filters.dateRange.end} onChange={e => setFilters({...filters, dateRange: {...filters.dateRange, end: e.target.value}})} className="bg-transparent" />
              </div>
            </div>
            <select className="px-4 py-2.5 bg-white border rounded-xl text-xs font-bold" value={filters.country} onChange={e => setFilters({...filters, country: e.target.value})}>
                <option value="All">Global</option>
                <option value="Spain">España</option>
                <option value="Mexico">México</option>
            </select>
            <select className="px-4 py-2.5 bg-white border rounded-xl text-xs font-bold" value={filters.queryType} onChange={e => setFilters({...filters, queryType: e.target.value as any})}>
                <option value="All">Todas las Queries</option>
                <option value="Branded">Branded</option>
                <option value="Non-Branded">Non-Branded</option>
            </select>
          </div>
        </header>

        {aiInsights && (
          <div className="mb-12 bg-white border border-indigo-100 p-8 rounded-3xl shadow-xl shadow-indigo-100/50 animate-in zoom-in-95 duration-500 relative">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-600 rounded-xl"><Sparkles className="w-4 h-4 text-white" /></div>
                    <h4 className="text-xl font-black tracking-tight">Insights de Gemini AI</h4>
                </div>
                <button onClick={() => setAiInsights(null)} className="text-slate-400 hover:text-slate-900">&times;</button>
            </div>
            <div className="text-slate-600 text-sm leading-relaxed font-medium space-y-4" dangerouslySetInnerHTML={{ __html: aiInsights.replace(/\n/g, '<br/>') }} />
          </div>
        )}

        {/* Dashboards */}
        {activeTab === DashboardTab.ORGANIC_VS_PAID && <Dashboard1 />}
        {activeTab === DashboardTab.SEO_BY_COUNTRY && <Dashboard2 />}
        {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && <Dashboard3 />}

        <div className="mt-12">
            <button onClick={handleGenerateInsights} disabled={loadingInsights} className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-sm font-bold shadow-xl hover:bg-indigo-600 transition-all flex items-center gap-3">
                {loadingInsights ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Analizar estos datos con AI
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
      active ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-500 hover:bg-slate-50'
    }`}
  >
    {icon} {label}
  </button>
);

export default App;
