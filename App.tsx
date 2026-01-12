
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
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
  ShieldCheck,
  Layers,
  CheckCircle2,
  Database,
  ExternalLink,
  ChevronDown,
  Activity
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import { generateMockDailyData, generateMockKeywordData } from './mockData';
import { DashboardTab, DashboardFilters, DailyData, KeywordData, ComparisonMetrics, Ga4Property, GscSite } from './types';
import { getDashboardInsights } from './geminiService';

const CLIENT_ID = "333322783684-pjhn2omejhngckfd46g8bh2dng9dghlc.apps.googleusercontent.com";
const SCOPE_GA4 = "https://www.googleapis.com/auth/analytics.readonly";
const SCOPE_GSC = "https://www.googleapis.com/auth/webmasters.readonly";

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
  // Auth State
  const [ga4Auth, setGa4Auth] = useState<{ token: string; property: Ga4Property | null } | null>(null);
  const [gscAuth, setGscAuth] = useState<{ token: string; site: GscSite | null } | null>(null);
  const [user, setUser] = useState<{ name: string; email: string; picture: string } | null>(null);
  
  // Entity Lists (Mocks for the demo)
  const ga4Properties: Ga4Property[] = [
    { id: '123456', name: 'Web Principal (GA4)' },
    { id: '789012', name: 'Blog Corporativo' },
    { id: '345678', name: 'E-commerce Staging' }
  ];
  const gscSites: GscSite[] = [
    { siteUrl: 'https://example.com/', permissionLevel: 'siteOwner' },
    { siteUrl: 'https://blog.example.com/', permissionLevel: 'siteFullUser' },
    { siteUrl: 'sc-domain:example.com', permissionLevel: 'siteOwner' }
  ];

  const [activeTab, setActiveTab] = useState<DashboardTab>(DashboardTab.ORGANIC_VS_PAID);
  const [filters, setFilters] = useState<DashboardFilters>({
    dateRange: { start: '2024-01-01', end: '2024-03-31' },
    country: 'All',
    queryType: 'All'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const tokenClientGa4 = useRef<any>(null);
  const tokenClientGsc = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).google) {
      // Basic profile identity
      (window as any).google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleIdentityResponse,
      });

      (window as any).google.accounts.id.renderButton(
        document.getElementById("googleIdentityBtn"),
        { theme: "outline", size: "large", width: "100%", text: "continue_with" }
      );

      // Dedicated Auth Clients
      tokenClientGa4.current = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE_GA4,
        callback: (resp: any) => {
          if (resp.access_token) setGa4Auth({ token: resp.access_token, property: ga4Properties[0] });
        },
      });

      tokenClientGsc.current = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE_GSC,
        callback: (resp: any) => {
          if (resp.access_token) setGscAuth({ token: resp.access_token, site: gscSites[0] });
        },
      });
    }
  }, []);

  const handleIdentityResponse = (response: any) => {
    const base64Url = response.credential.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(base64));
    setUser({ name: decoded.name, email: decoded.email, picture: decoded.picture });
  };

  const connectGa4 = () => tokenClientGa4.current.requestAccessToken();
  const connectGsc = () => tokenClientGsc.current.requestAccessToken();

  const rawDailyData = useMemo(() => generateMockDailyData(), []);
  const rawKeywordData = useMemo(() => generateMockKeywordData(), []);

  const processedData = useMemo(() => {
    const currentStart = filters.dateRange.start;
    const currentEnd = filters.dateRange.end;
    const prevStart = new Date(new Date(currentStart).setFullYear(new Date(currentStart).getFullYear() - 1)).toISOString().split('T')[0];
    const prevEnd = new Date(new Date(currentEnd).setFullYear(new Date(currentEnd).getFullYear() - 1)).toISOString().split('T')[0];

    const filterBase = (d: DailyData) => {
      const countryMatch = filters.country === 'All' || d.country === filters.country;
      const queryMatch = filters.queryType === 'All' || d.queryType === filters.queryType;
      return countryMatch && queryMatch;
    };

    const current = rawDailyData.filter(d => filterBase(d) && d.date >= currentStart && d.date <= currentEnd);
    const previous = rawDailyData.filter(d => filterBase(d) && d.date >= prevStart && d.date <= prevEnd);

    return { current, previous };
  }, [rawDailyData, filters]);

  const aggregateMetrics = (data: DailyData[]) => {
    const m = data.reduce((acc, curr) => ({
      sessions: acc.sessions + curr.sessions,
      sales: acc.sales + curr.sales,
      revenue: acc.revenue + curr.revenue,
      clicks: acc.clicks + curr.clicks,
      impressions: acc.impressions + curr.impressions,
    }), { sessions: 0, sales: 0, revenue: 0, clicks: 0, impressions: 0 });

    return { ...m, cr: m.sessions > 0 ? (m.sales / m.sessions) * 100 : 0, ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0 };
  };

  const channelStats = useMemo(() => {
    const getStats = (data: DailyData[], ch: string) => aggregateMetrics(data.filter(d => d.channel === ch));
    return {
      organic: { current: getStats(processedData.current, 'Organic Search'), previous: getStats(processedData.previous, 'Organic Search') },
      paid: { current: getStats(processedData.current, 'Paid Search'), previous: getStats(processedData.previous, 'Paid Search') }
    };
  }, [processedData]);

  const calcChange = (cur: number, prev: number) => prev === 0 ? 0 : ((cur - prev) / prev) * 100;

  const handleGenerateInsights = async () => {
    setLoadingInsights(true);
    const summary = `Dashboard: ${activeTab}. Rev: €${(channelStats.organic.current.revenue + channelStats.paid.current.revenue).toLocaleString()}.`;
    const insights = await getDashboardInsights(summary, activeTab);
    setAiInsights(insights);
    setLoadingInsights(false);
  };

  // UI Components
  const AuthScreen = () => (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative">
      <div className="absolute top-0 -left-40 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-10 animate-pulse" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-emerald-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-10 animate-pulse delay-700" />
      
      <div className="w-full max-w-2xl bg-white rounded-[40px] p-12 shadow-2xl border border-slate-100 z-10">
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white mx-auto shadow-xl mb-6 transform -rotate-6">
            <Activity className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Centro de Conexiones</h1>
          <p className="text-slate-500 font-medium text-sm">Configura tus fuentes de datos para comenzar el análisis.</p>
        </div>

        {!user ? (
          <div className="max-w-xs mx-auto">
            <div id="googleIdentityBtn"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* GA4 Card */}
            <div className={`p-6 rounded-3xl border-2 transition-all ${ga4Auth ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-100 bg-white'}`}>
              <div className="flex justify-between items-start mb-6">
                <div className={`p-3 rounded-2xl ${ga4Auth ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  <BarChart3 className="w-6 h-6" />
                </div>
                {ga4Auth && <CheckCircle2 className="w-6 h-6 text-indigo-500" />}
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1">Google Analytics 4</h3>
              <p className="text-xs text-slate-500 mb-6 font-medium">Acceso a sesiones, CR y revenue transaccional.</p>
              
              {!ga4Auth ? (
                <button onClick={connectGa4} className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-indigo-600 transition-all flex items-center justify-center gap-2">
                  Conectar GA4
                </button>
              ) : (
                <div className="space-y-3">
                   <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Propiedad Activa</p>
                   <select 
                    value={ga4Auth.property?.id} 
                    onChange={e => setGa4Auth({...ga4Auth, property: ga4Properties.find(p => p.id === e.target.value) || null})}
                    className="w-full p-2 bg-white border border-indigo-200 rounded-lg text-xs font-bold outline-none"
                   >
                     {ga4Properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                   </select>
                </div>
              )}
            </div>

            {/* GSC Card */}
            <div className={`p-6 rounded-3xl border-2 transition-all ${gscAuth ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-100 bg-white'}`}>
              <div className="flex justify-between items-start mb-6">
                <div className={`p-3 rounded-2xl ${gscAuth ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  <Search className="w-6 h-6" />
                </div>
                {gscAuth && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1">Search Console</h3>
              <p className="text-xs text-slate-500 mb-6 font-medium">Datos de impresiones, clicks y keywords SEO.</p>
              
              {!gscAuth ? (
                <button onClick={connectGsc} className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all flex items-center justify-center gap-2">
                  Conectar GSC
                </button>
              ) : (
                <div className="space-y-3">
                   <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Dominio / Sitio</p>
                   <select 
                    value={gscAuth.site?.siteUrl} 
                    onChange={e => setGscAuth({...gscAuth, site: gscSites.find(s => s.siteUrl === e.target.value) || null})}
                    className="w-full p-2 bg-white border border-emerald-200 rounded-lg text-xs font-bold outline-none"
                   >
                     {gscSites.map(s => <option key={s.siteUrl} value={s.siteUrl}>{s.siteUrl}</option>)}
                   </select>
                </div>
              )}
            </div>
          </div>
        )}

        {(ga4Auth && gscAuth) && (
          <div className="mt-12 flex justify-center animate-in fade-in slide-in-from-top-4">
            <button 
              onClick={() => {}} // User is already "in", state logic handles conditional rendering
              className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-indigo-700 transition-all transform hover:scale-105"
            >
              Entrar al Dashboard
            </button>
          </div>
        )}
      </div>
      
      <div className="mt-12 flex items-center gap-8 opacity-40 grayscale pointer-events-none">
        <div className="flex items-center gap-2 font-black text-xs text-slate-400"><ShieldCheck className="w-4 h-4" /> OAuth 2.0 Secure</div>
        <div className="flex items-center gap-2 font-black text-xs text-slate-400"><Database className="w-4 h-4" /> SSL Encryption</div>
      </div>
    </div>
  );

  if (!ga4Auth || !gscAuth) return <AuthScreen />;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex text-slate-900">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 hidden lg:flex flex-col fixed inset-y-0 shadow-sm z-30">
        <div className="p-8 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-xl">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 leading-none">SEO & SEM</h1>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mt-1">Advanced Suite</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-2">
          <NavItem active={activeTab === DashboardTab.ORGANIC_VS_PAID} onClick={() => setActiveTab(DashboardTab.ORGANIC_VS_PAID)} icon={<Layers className="w-5 h-5" />} label="Organic vs Paid" />
          <NavItem active={activeTab === DashboardTab.SEO_BY_COUNTRY} onClick={() => setActiveTab(DashboardTab.SEO_BY_COUNTRY)} icon={<Globe className="w-5 h-5" />} label="SEO Marketplace" />
          <NavItem active={activeTab === DashboardTab.KEYWORD_DEEP_DIVE} onClick={() => setActiveTab(DashboardTab.KEYWORD_DEEP_DIVE)} icon={<Search className="w-5 h-5" />} label="SEO Deep Dive" />
        </nav>

        <div className="p-6 border-t border-slate-100">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                    <img src={user?.picture} className="w-8 h-8 rounded-full" alt="avatar" />
                    <div className="truncate">
                        <p className="text-[10px] font-black text-slate-900 truncate">{user?.name}</p>
                        <p className="text-[8px] text-slate-400 truncate">{user?.email}</p>
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-[8px] font-black uppercase text-indigo-500">
                        <span>GA4: {ga4Auth.property?.name.split(' ')[0]}...</span>
                        <CheckCircle2 className="w-2.5 h-2.5" />
                    </div>
                    <div className="flex items-center justify-between text-[8px] font-black uppercase text-emerald-500">
                        <span>GSC: {gscAuth.site?.siteUrl.split('//')[1]?.substring(0, 10)}...</span>
                        <CheckCircle2 className="w-2.5 h-2.5" />
                    </div>
                </div>
                <button onClick={() => {setGa4Auth(null); setGscAuth(null);}} className="w-full mt-4 py-2 text-[10px] font-black text-slate-400 hover:text-rose-600 transition-colors flex items-center justify-center gap-2">
                    <LogOut className="w-3 h-3" /> Cerrar Sesión
                </button>
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-72 p-8 lg:p-12 overflow-y-auto">
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Data Real-Time: {filters.country}</span>
            </div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter">
              {activeTab === DashboardTab.ORGANIC_VS_PAID && "Organic vs Paid"}
              {activeTab === DashboardTab.SEO_BY_COUNTRY && "SEO por Mercado"}
              {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && "Keywords & Landing Pages"}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-4 bg-white p-2 rounded-[24px] border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 px-4 py-2 border-r border-slate-100">
              <Calendar className="w-4 h-4 text-slate-400" />
              <div className="flex items-center gap-2 text-[11px] font-bold">
                <input type="date" value={filters.dateRange.start} onChange={e => setFilters({...filters, dateRange: {...filters.dateRange, start: e.target.value}})} className="bg-transparent outline-none" />
                <span className="text-slate-300">-</span>
                <input type="date" value={filters.dateRange.end} onChange={e => setFilters({...filters, dateRange: {...filters.dateRange, end: e.target.value}})} className="bg-transparent outline-none" />
              </div>
            </div>
            <select className="px-4 py-2 bg-transparent text-[11px] font-black uppercase tracking-wider outline-none border-r border-slate-100 cursor-pointer" value={filters.country} onChange={e => setFilters({...filters, country: e.target.value})}>
                <option value="All">Global</option>
                <option value="Spain">España</option>
                <option value="Mexico">México</option>
                <option value="USA">USA</option>
            </select>
            <select className="px-4 py-2 bg-transparent text-[11px] font-black uppercase tracking-wider outline-none cursor-pointer" value={filters.queryType} onChange={e => setFilters({...filters, queryType: e.target.value as any})}>
                <option value="All">Búsqueda Total</option>
                <option value="Branded">Branded</option>
                <option value="Non-Branded">Non-Branded</option>
            </select>
          </div>
        </header>

        {aiInsights && (
          <div className="mb-12 bg-white border border-indigo-100 p-8 rounded-[32px] shadow-xl shadow-indigo-100/30 animate-in zoom-in-95 duration-500 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Sparkles className="w-40 h-40 text-indigo-600" />
            </div>
            <div className="flex justify-between items-center mb-6 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg"><Sparkles className="w-5 h-5 text-white" /></div>
                    <h4 className="text-2xl font-black tracking-tight text-slate-900">Análisis Estratégico AI</h4>
                </div>
                <button onClick={() => setAiInsights(null)} className="text-slate-400 hover:text-slate-900 bg-slate-100 w-10 h-10 rounded-full flex items-center justify-center font-black transition-colors">&times;</button>
            </div>
            <div className="text-slate-600 text-sm leading-loose font-medium space-y-4 relative z-10 pr-12" dangerouslySetInnerHTML={{ __html: aiInsights.replace(/\n/g, '<br/>') }} />
          </div>
        )}

        {/* Dashboards Sections remain functionally similar but now visually tied to their sources */}
        <div className="mb-8 p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="p-2 bg-indigo-600 text-white rounded-lg"><Activity className="w-4 h-4" /></div>
              <div>
                 <p className="text-[10px] font-black uppercase text-indigo-600 leading-none">Source: Google Analytics 4</p>
                 <p className="text-xs font-bold text-slate-700">{ga4Auth.property?.name}</p>
              </div>
           </div>
           <div className="flex items-center gap-4">
              <div className="text-right">
                 <p className="text-[10px] font-black uppercase text-emerald-600 leading-none">Source: Search Console</p>
                 <p className="text-xs font-bold text-slate-700">{gscAuth.site?.siteUrl}</p>
              </div>
              <div className="p-2 bg-emerald-600 text-white rounded-lg"><Search className="w-4 h-4" /></div>
           </div>
        </div>

        {activeTab === DashboardTab.ORGANIC_VS_PAID && <DashboardOrganicVsPaid stats={channelStats} currentData={processedData.current} />}
        {activeTab === DashboardTab.SEO_BY_COUNTRY && <DashboardSeoMarketplace processedData={processedData} aggregateMetrics={aggregateMetrics} calcChange={calcChange} />}
        {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && <DashboardDeepDive rawKeywordData={rawKeywordData} filters={filters} searchTerm={searchTerm} setSearchTerm={setSearchTerm} />}

        <div className="mt-12 flex justify-center">
            <button 
                onClick={handleGenerateInsights} 
                disabled={loadingInsights} 
                className="group px-10 py-5 bg-slate-950 text-white rounded-[24px] text-sm font-black shadow-2xl hover:bg-indigo-600 transition-all flex items-center gap-4 active:scale-95 disabled:opacity-50"
            >
                {loadingInsights ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 group-hover:animate-bounce" />}
                Generar Auditoría con Gemini 3
            </button>
        </div>
      </main>
    </div>
  );
};

// Sub-components to keep App.tsx clean
const DashboardOrganicVsPaid = ({ stats, currentData }: any) => {
  const chartData = useMemo(() => {
    const groups: any = {};
    currentData.forEach((d: any) => {
      if (!groups[d.date]) groups[d.date] = { date: d.date, organic: 0, paid: 0 };
      if (d.channel === 'Organic Search') groups[d.date].organic += d.sessions;
      else groups[d.date].paid += d.sessions;
    });
    return Object.values(groups).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [currentData]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2 px-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg"><Activity className="w-4 h-4" /></div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Canal Orgánico</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <KpiCard title="Sesiones" value={stats.organic.current.sessions.toLocaleString()} icon={<TrendingUp className="w-4 h-4" />} />
            <KpiCard title="Conv. Rate" value={`${stats.organic.current.cr.toFixed(2)}%`} icon={<Percent className="w-4 h-4" />} />
            <KpiCard title="Revenue" value={`€${stats.organic.current.revenue.toLocaleString()}`} icon={<Tag className="w-4 h-4" />} />
            <KpiCard title="Sales" value={stats.organic.current.sales.toLocaleString()} icon={<ShoppingBag className="w-4 h-4" />} />
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2 px-2">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-white shadow-lg"><Activity className="w-4 h-4" /></div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Canal de Pago</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <KpiCard title="Sesiones" value={stats.paid.current.sessions.toLocaleString()} color="amber" icon={<TrendingUp className="w-4 h-4" />} />
            <KpiCard title="Conv. Rate" value={`${stats.paid.current.cr.toFixed(2)}%`} color="amber" icon={<Percent className="w-4 h-4" />} />
            <KpiCard title="Revenue" value={`€${stats.paid.current.revenue.toLocaleString()}`} color="amber" icon={<Tag className="w-4 h-4" />} />
            <KpiCard title="Sales" value={stats.paid.current.sales.toLocaleString()} color="amber" icon={<ShoppingBag className="w-4 h-4" />} />
          </div>
        </div>
      </div>
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" hide />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
              <Tooltip />
              <Area type="monotone" dataKey="organic" stroke="#6366f1" strokeWidth={3} fillOpacity={0.1} fill="#6366f1" />
              <Area type="monotone" dataKey="paid" stroke="#f59e0b" strokeWidth={3} fillOpacity={0.1} fill="#f59e0b" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const DashboardSeoMarketplace = ({ processedData, aggregateMetrics, calcChange }: any) => {
    const seoCurrent = aggregateMetrics(processedData.current.filter((d: any) => d.channel === 'Organic Search'));
    const seoPrevious = aggregateMetrics(processedData.previous.filter((d: any) => d.channel === 'Organic Search'));

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard title="Impresiones" value={seoCurrent.impressions.toLocaleString()} icon={<Eye className="w-4 h-4" />} comparison={{current: 0, previous: 0, change: calcChange(seoCurrent.impressions, seoPrevious.impressions)}} suffix="YoY" />
          <KpiCard title="Clicks" value={seoCurrent.clicks.toLocaleString()} icon={<MousePointer2 className="w-4 h-4" />} comparison={{current: 0, previous: 0, change: calcChange(seoCurrent.clicks, seoPrevious.clicks)}} suffix="YoY" />
          <KpiCard title="CTR" value={`${seoCurrent.ctr.toFixed(2)}%`} icon={<Percent className="w-4 h-4" />} />
          <KpiCard title="Conv. Rate" value={`${seoCurrent.cr.toFixed(2)}%`} icon={<BarChart3 className="w-4 h-4" />} />
          <KpiCard title="Revenue" value={`€${seoCurrent.revenue.toLocaleString()}`} icon={<Tag className="w-4 h-4" />} comparison={{current: 0, previous: 0, change: calcChange(seoCurrent.revenue, seoPrevious.revenue)}} suffix="YoY" />
          <KpiCard title="Sales" value={seoCurrent.sales.toLocaleString()} icon={<ShoppingBag className="w-4 h-4" />} />
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={Object.entries(processedData.current.filter((d: any) => d.channel === 'Organic Search').reduce((acc: any, curr: any) => {
                  acc[curr.country] = (acc[curr.country] || 0) + curr.revenue;
                  return acc;
                }, {} as any)).map(([country, rev]) => ({ country, revenue: rev }))}>
                  <XAxis dataKey="country" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#10b981" radius={[8, 8, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
      </div>
    );
};

const DashboardDeepDive = ({ rawKeywordData, filters, searchTerm, setSearchTerm }: any) => {
  const filtered = rawKeywordData.filter((d: any) => {
    const countryMatch = filters.country === 'All' || d.country === filters.country;
    const searchMatch = d.keyword.toLowerCase().includes(searchTerm.toLowerCase()) || d.landingPage.toLowerCase().includes(searchTerm.toLowerCase());
    return countryMatch && searchMatch;
  });

  return (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="text-lg font-black">Deep Dive: Search Console</h3>
            <div className="relative w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar..." className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm" />
            </div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-widest">
                <tr>
                  <th className="px-8 py-5">Keyword</th>
                  <th className="px-8 py-5">Impressions</th>
                  <th className="px-8 py-5">CTR</th>
                  <th className="px-8 py-5 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.slice(0, 15).map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{row.keyword}</span>
                        <span className="text-[10px] text-slate-400 truncate w-48">{row.landingPage}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 font-bold">{row.impressions.toLocaleString()}</td>
                    <td className="px-8 py-5 font-black text-indigo-600">{row.ctr.toFixed(2)}%</td>
                    <td className="px-8 py-5 text-right font-black">€{row.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
    </div>
  );
};

const NavItem: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-sm font-black transition-all ${active ? 'bg-slate-950 text-white shadow-xl translate-x-1' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900 hover:translate-x-1'}`}>
    {icon} {label}
  </button>
);

export default App;
