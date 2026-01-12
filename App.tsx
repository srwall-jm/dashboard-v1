
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
  CheckCircle2,
  Layers,
  Activity,
  Filter,
  ArrowRight,
  Target,
  FileText,
  AlertCircle
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Legend, Cell
} from 'recharts';
import { DashboardTab, DashboardFilters, DailyData, KeywordData, Ga4Property, GscSite } from './types';
import { getDashboardInsights } from './geminiService';

const CLIENT_ID = "333322783684-pjhn2omejhngckfd46g8bh2dng9dghlc.apps.googleusercontent.com";
const SCOPE_GA4 = "https://www.googleapis.com/auth/analytics.readonly";
const SCOPE_GSC = "https://www.googleapis.com/auth/webmasters.readonly";

const KpiCard: React.FC<{ 
  title: string; 
  value: string | number; 
  comparison?: number; 
  icon: React.ReactNode; 
  color?: string;
  isPercent?: boolean;
}> = ({ title, value, comparison, icon, color = "indigo", isPercent = false }) => (
  <div className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm hover:shadow-md transition-all group">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 bg-${color}-50 text-${color}-600 rounded-2xl group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      {comparison !== undefined && (
        <div className={`flex items-center text-[11px] font-bold px-2 py-1 rounded-full ${comparison >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {comparison >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
          {Math.abs(comparison).toFixed(1)}%
        </div>
      )}
    </div>
    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.15em] mb-1">{title}</p>
    <h3 className="text-2xl font-black text-slate-900 tracking-tight">
      {typeof value === 'number' && !isPercent ? value.toLocaleString() : value}
    </h3>
  </div>
);

const App: React.FC = () => {
  const [ga4Auth, setGa4Auth] = useState<{ token: string; property: Ga4Property | null } | null>(null);
  const [gscAuth, setGscAuth] = useState<{ token: string; site: GscSite | null } | null>(null);
  const [user, setUser] = useState<{ name: string; email: string; picture: string } | null>(null);
  
  const [availableProperties, setAvailableProperties] = useState<Ga4Property[]>([]);
  const [availableSites, setAvailableSites] = useState<GscSite[]>([]);
  
  // Real Data State
  const [realDailyData, setRealDailyData] = useState<DailyData[]>([]);
  const [realKeywordData, setRealKeywordData] = useState<KeywordData[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<DashboardTab>(DashboardTab.ORGANIC_VS_PAID);
  const [filters, setFilters] = useState<DashboardFilters>({
    dateRange: { start: '2024-10-01', end: '2024-12-31' },
    country: 'All',
    queryType: 'All'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const tokenClientGa4 = useRef<any>(null);
  const tokenClientGsc = useRef<any>(null);

  // --- API FETCHERS ---

  const fetchGa4Properties = async (token: string) => {
    try {
      const resp = await fetch('https://analyticsadmin.googleapis.com/v1alpha/accountSummaries', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await resp.json();
      const props: Ga4Property[] = [];
      data.accountSummaries?.forEach((acc: any) => {
        acc.propertySummaries?.forEach((p: any) => {
          props.push({ id: p.property, name: p.displayName });
        });
      });
      setAvailableProperties(props);
      if (props.length > 0) setGa4Auth(prev => prev ? { ...prev, property: props[0] } : null);
    } catch (e) { console.error("Error fetching GA4 properties", e); }
  };

  const fetchGscSites = async (token: string) => {
    try {
      const resp = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await resp.json();
      const sites = data.siteEntry || [];
      setAvailableSites(sites);
      if (sites.length > 0) setGscAuth(prev => prev ? { ...prev, site: sites[0] } : null);
    } catch (e) { console.error("Error fetching GSC sites", e); }
  };

  const fetchReportData = async () => {
    if (!ga4Auth?.property || !gscAuth?.site) return;
    
    setIsLoadingData(true);
    setError(null);

    try {
      // 1. Fetch GA4 Data (Sessions, Rev by Channel/Country/Date)
      const ga4ReportResp = await fetch(`https://analyticsdata.googleapis.com/v1beta/${ga4Auth.property.id}:runReport`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ga4Auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [{ startDate: filters.dateRange.start, endDate: filters.dateRange.end }],
          dimensions: [{ name: 'date' }, { name: 'sessionDefaultChannelGroup' }, { name: 'country' }],
          metrics: [{ name: 'sessions' }, { name: 'totalRevenue' }, { name: 'transactions' }, { name: 'sessionConversionRate' }]
        })
      });
      const ga4Data = await ga4ReportResp.json();

      // 2. Fetch GSC Data (Clicks, Impr by Query/Page/Country)
      const siteUrl = encodeURIComponent(gscAuth.site.siteUrl);
      const gscReportResp = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/searchAnalytics/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${gscAuth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: filters.dateRange.start,
          endDate: filters.dateRange.end,
          dimensions: ['query', 'page', 'country'],
          rowLimit: 2500
        })
      });
      const gscData = await gscReportResp.json();

      // --- MAPPING DATA ---
      // Transform GA4 rows into DailyData structure
      const dailyMapped: DailyData[] = (ga4Data.rows || []).map((row: any) => ({
        date: `${row.dimensionValues[0].value.slice(0,4)}-${row.dimensionValues[0].value.slice(4,6)}-${row.dimensionValues[0].value.slice(6,8)}`,
        channel: row.dimensionValues[1].value === 'Organic Search' ? 'Organic Search' : 'Paid Search',
        country: row.dimensionValues[2].value,
        queryType: 'Non-Branded', // Placeholder, real branded detection would need GSC join
        sessions: parseInt(row.metricValues[0].value),
        revenue: parseFloat(row.metricValues[1].value),
        sales: parseInt(row.metricValues[2].value),
        conversionRate: parseFloat(row.metricValues[3].value) * 100,
        clicks: 0, impressions: 0, ctr: 0 // Will be filled by GSC if channel is organic
      }));

      // Map GSC rows into KeywordData structure
      const keywordMapped: KeywordData[] = (gscData.rows || []).map((row: any) => ({
        keyword: row.keys[0],
        landingPage: row.keys[1],
        country: row.keys[2],
        queryType: row.keys[0].toLowerCase().includes('brand') ? 'Branded' : 'Non-Branded', // Simple logic
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr * 100,
        sessions: Math.floor(row.clicks * 1.1), // Estimated
        conversionRate: 2.5, // Estimated without deep GA4 join per URL
        revenue: row.clicks * 0.5, // Estimated
        sales: Math.floor(row.clicks * 0.02) // Estimated
      }));

      setRealDailyData(dailyMapped);
      setRealKeywordData(keywordMapped);
    } catch (err: any) {
      console.error("Error fetching report data:", err);
      setError("Error al obtener datos de las APIs. Verifica tus permisos o cuotas.");
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).google) {
      (window as any).google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleIdentityResponse,
      });
      (window as any).google.accounts.id.renderButton(
        document.getElementById("googleIdentityBtn"),
        { theme: "filled_black", size: "large", width: "100%", shape: "pill" }
      );

      tokenClientGa4.current = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE_GA4,
        callback: (resp: any) => {
          if (resp.access_token) {
            setGa4Auth({ token: resp.access_token, property: null });
            fetchGa4Properties(resp.access_token);
          }
        },
      });

      tokenClientGsc.current = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE_GSC,
        callback: (resp: any) => {
          if (resp.access_token) {
            setGscAuth({ token: resp.access_token, site: null });
            fetchGscSites(resp.access_token);
          }
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

  // Re-fetch when property, site or dates change
  useEffect(() => {
    if (ga4Auth?.property && gscAuth?.site) {
      fetchReportData();
    }
  }, [ga4Auth?.property?.id, gscAuth?.site?.siteUrl, filters.dateRange]);

  // Data Processing (Calculations)
  const processedData = useMemo(() => {
    const filterBase = (d: DailyData) => {
      const countryMatch = filters.country === 'All' || d.country === filters.country;
      const queryMatch = filters.queryType === 'All' || d.queryType === filters.queryType;
      return countryMatch && queryMatch;
    };
    return realDailyData.filter(filterBase);
  }, [realDailyData, filters]);

  const aggregate = (data: DailyData[]) => {
    const sum = data.reduce((acc, curr) => ({
      sessions: acc.sessions + curr.sessions,
      sales: acc.sales + curr.sales,
      revenue: acc.revenue + curr.revenue,
      clicks: acc.clicks + curr.clicks,
      impressions: acc.impressions + curr.impressions,
    }), { sessions: 0, sales: 0, revenue: 0, clicks: 0, impressions: 0 });

    return { 
      ...sum, 
      cr: sum.sessions > 0 ? (sum.sales / sum.sessions) * 100 : 0, 
      ctr: sum.impressions > 0 ? (sum.clicks / sum.impressions) * 100 : 0 
    };
  };

  const channelStats = useMemo(() => {
    const organic = aggregate(processedData.filter(d => d.channel === 'Organic Search'));
    const paid = aggregate(processedData.filter(d => d.channel === 'Paid Search'));

    return { organic, paid };
  }, [processedData]);

  const handleGenerateInsights = async () => {
    setLoadingInsights(true);
    const summary = `Dashboard: ${activeTab}. Organic Rev: €${channelStats.organic.revenue}. Paid Rev: €${channelStats.paid.revenue}.`;
    const insights = await getDashboardInsights(summary, activeTab);
    setAiInsights(insights);
    setLoadingInsights(false);
  };

  if (!ga4Auth || !gscAuth || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600 blur-[120px] rounded-full animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600 blur-[120px] rounded-full animate-pulse delay-1000" />
        </div>
        
        <div className="w-full max-w-xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-[48px] p-12 text-center z-10 shadow-2xl">
          <div className="w-20 h-20 bg-indigo-600 rounded-[28px] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-indigo-500/20 transform -rotate-6">
            <Activity className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black mb-4 tracking-tighter">SEO & SEM Reporting</h1>
          <p className="text-slate-400 font-medium mb-12 text-lg">Conecta tus fuentes de datos oficiales para generar el reporte ad hoc.</p>
          
          <div className="space-y-6">
            {!user ? (
               <div id="googleIdentityBtn" className="flex justify-center"></div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                <button 
                  onClick={() => tokenClientGa4.current.requestAccessToken()} 
                  className={`flex items-center justify-between p-6 rounded-3xl border-2 transition-all ${ga4Auth ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 hover:border-white/30'}`}
                >
                  <div className="flex items-center gap-4">
                    <BarChart3 className={ga4Auth ? 'text-indigo-400' : 'text-slate-500'} />
                    <div className="text-left">
                      <p className="font-bold">Google Analytics 4</p>
                      <p className="text-xs text-slate-400">{ga4Auth ? 'Conectado correctamente' : 'Requiere autorización'}</p>
                    </div>
                  </div>
                  {ga4Auth && <CheckCircle2 className="text-indigo-500" />}
                </button>

                <button 
                  onClick={() => tokenClientGsc.current.requestAccessToken()} 
                  className={`flex items-center justify-between p-6 rounded-3xl border-2 transition-all ${gscAuth ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 hover:border-white/30'}`}
                >
                  <div className="flex items-center gap-4">
                    <Search className={gscAuth ? 'text-emerald-400' : 'text-slate-500'} />
                    <div className="text-left">
                      <p className="font-bold">Search Console</p>
                      <p className="text-xs text-slate-400">{gscAuth ? 'Conectado correctamente' : 'Requiere autorización'}</p>
                    </div>
                  </div>
                  {gscAuth && <CheckCircle2 className="text-emerald-500" />}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* Sidebar de Navegación */}
      <aside className="w-80 bg-slate-950 text-white hidden xl:flex flex-col fixed inset-y-0 z-40">
        <div className="p-10">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20">
              <Activity className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">SEO Master</h1>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Analytics Suite</p>
            </div>
          </div>

          <nav className="space-y-2">
            <SidebarLink active={activeTab === DashboardTab.ORGANIC_VS_PAID} onClick={() => setActiveTab(DashboardTab.ORGANIC_VS_PAID)} icon={<Layers />} label="Organic vs Paid" />
            <SidebarLink active={activeTab === DashboardTab.SEO_BY_COUNTRY} onClick={() => setActiveTab(DashboardTab.SEO_BY_COUNTRY)} icon={<Globe />} label="SEO Marketplace" />
            <SidebarLink active={activeTab === DashboardTab.KEYWORD_DEEP_DIVE} onClick={() => setActiveTab(DashboardTab.KEYWORD_DEEP_DIVE)} icon={<Target />} label="Deep Dive Analysis" />
          </nav>
        </div>

        <div className="mt-auto p-8 border-t border-white/5">
           <div className="bg-white/5 rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <img src={user.picture} className="w-10 h-10 rounded-full border-2 border-indigo-500" alt="user" />
                <div className="truncate">
                   <p className="text-xs font-black truncate">{user.name}</p>
                   <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                </div>
              </div>
              <div className="space-y-4">
                 <div>
                    <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest block mb-2">Propiedad GA4</label>
                    <select 
                      className="w-full bg-slate-900 border border-white/10 rounded-xl text-[11px] p-2 focus:ring-1 ring-indigo-500 outline-none"
                      value={ga4Auth.property?.id}
                      onChange={e => setGa4Auth({...ga4Auth, property: availableProperties.find(p => p.id === e.target.value) || null})}
                    >
                      {availableProperties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest block mb-2">Sitio GSC</label>
                    <select 
                      className="w-full bg-slate-900 border border-white/10 rounded-xl text-[11px] p-2 focus:ring-1 ring-emerald-500 outline-none"
                      value={gscAuth.site?.siteUrl}
                      onChange={e => setGscAuth({...gscAuth, site: availableSites.find(s => s.siteUrl === e.target.value) || null})}
                    >
                      {availableSites.map(s => <option key={s.siteUrl} value={s.siteUrl}>{s.siteUrl}</option>)}
                    </select>
                 </div>
              </div>
              <button onClick={() => window.location.reload()} className="w-full mt-6 py-3 text-[11px] font-black text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2">
                <LogOut className="w-3 h-3" /> Desconectar
              </button>
           </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 xl:ml-80 p-8 xl:p-14">
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2 h-2 rounded-full ${isLoadingData ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {isLoadingData ? 'Cargando datos reales...' : `Conectado: ${ga4Auth.property?.name}`}
              </span>
            </div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter">
              {activeTab === DashboardTab.ORGANIC_VS_PAID && "Organic Search vs Paid Search"}
              {activeTab === DashboardTab.SEO_BY_COUNTRY && "Análisis SEO por Mercado"}
              {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && "Optimización de Keywords & Landings"}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-4 bg-white p-2 rounded-[32px] border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 px-6 py-3 border-r border-slate-100">
               <Calendar className="w-4 h-4 text-slate-400" />
               <div className="flex items-center gap-3 text-[12px] font-bold">
                  <input type="date" value={filters.dateRange.start} onChange={e => setFilters({...filters, dateRange: {...filters.dateRange, start: e.target.value}})} className="outline-none bg-transparent" />
                  <ArrowRight className="w-3 h-3 text-slate-300" />
                  <input type="date" value={filters.dateRange.end} onChange={e => setFilters({...filters, dateRange: {...filters.dateRange, end: e.target.value}})} className="outline-none bg-transparent" />
               </div>
            </div>
            <div className="flex items-center gap-2 px-6 py-3 border-r border-slate-100">
               <Globe className="w-4 h-4 text-slate-400" />
               <select className="bg-transparent text-[12px] font-black uppercase outline-none cursor-pointer" value={filters.country} onChange={e => setFilters({...filters, country: e.target.value})}>
                  <option value="All">Todos los Países</option>
                  {Array.from(new Set(realDailyData.map(d => d.country))).sort().map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
               </select>
            </div>
            <div className="flex items-center gap-2 px-6 py-3">
               <Filter className="w-4 h-4 text-slate-400" />
               <select className="bg-transparent text-[12px] font-black uppercase outline-none cursor-pointer" value={filters.queryType} onChange={e => setFilters({...filters, queryType: e.target.value as any})}>
                  <option value="All">Toda la búsqueda</option>
                  <option value="Branded">Branded</option>
                  <option value="Non-Branded">Non-Branded</option>
               </select>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-8 p-6 bg-rose-50 border border-rose-200 rounded-3xl flex items-center gap-4 text-rose-700 animate-in fade-in duration-500">
            <AlertCircle className="w-6 h-6" />
            <p className="font-bold">{error}</p>
          </div>
        )}

        {aiInsights && (
          <div className="mb-12 bg-indigo-600 rounded-[40px] p-10 text-white shadow-2xl shadow-indigo-500/20 relative overflow-hidden animate-in zoom-in-95 duration-500">
            <div className="absolute top-0 right-0 p-10 opacity-10"><Sparkles className="w-48 h-48" /></div>
            <div className="flex justify-between items-start mb-8 relative z-10">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl"><Sparkles className="w-6 h-6" /></div>
                <h3 className="text-2xl font-black">Auditoría Estratégica AI</h3>
              </div>
              <button onClick={() => setAiInsights(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">&times;</button>
            </div>
            <div className="prose prose-invert max-w-none relative z-10 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: aiInsights.replace(/\n/g, '<br/>') }} />
          </div>
        )}

        {/* Dashboards Content */}
        {activeTab === DashboardTab.ORGANIC_VS_PAID && <OrganicVsPaidView stats={channelStats} data={processedData} />}
        {activeTab === DashboardTab.SEO_BY_COUNTRY && <SeoMarketplaceView data={processedData} keywordData={realKeywordData} aggregate={aggregate} />}
        {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && <SeoDeepDiveView keywords={realKeywordData} filters={filters} searchTerm={searchTerm} setSearchTerm={setSearchTerm} />}

        <div className="mt-16 flex justify-center pb-20">
          <button 
            onClick={handleGenerateInsights}
            disabled={loadingInsights || isLoadingData}
            className="flex items-center gap-4 px-12 py-5 bg-slate-950 text-white rounded-[32px] text-sm font-black shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
          >
            {loadingInsights ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            Generar Insights Reales con Gemini
          </button>
        </div>
      </main>
    </div>
  );
};

// ---------------- DASHBOARD VIEWS ----------------

const OrganicVsPaidView = ({ stats, data }: any) => {
  const chartData = useMemo(() => {
    const map: any = {};
    data.forEach((d: any) => {
      if (!map[d.date]) map[d.date] = { date: d.date, organic: 0, paid: 0 };
      if (d.channel === 'Organic Search') map[d.date].organic += d.sessions;
      else map[d.date].paid += d.sessions;
    });
    return Object.values(map).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [data]);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white"><Activity className="w-4 h-4" /></div>
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Canal Orgánico</h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <KpiCard title="Sesiones" value={stats.organic.sessions} icon={<TrendingUp />} />
            <KpiCard title="Conv. Rate" value={`${stats.organic.cr.toFixed(2)}%`} icon={<Percent />} isPercent />
            <KpiCard title="Revenue" value={`€${stats.organic.revenue.toLocaleString()}`} icon={<Tag />} color="emerald" />
            <KpiCard title="Sales" value={stats.organic.sales} icon={<ShoppingBag />} color="emerald" />
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center text-white"><Activity className="w-4 h-4" /></div>
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Canal de Pago</h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <KpiCard title="Sesiones" value={stats.paid.sessions} icon={<TrendingUp />} color="amber" />
            <KpiCard title="Conv. Rate" value={`${stats.paid.cr.toFixed(2)}%`} icon={<Percent />} color="amber" isPercent />
            <KpiCard title="Revenue" value={`€${stats.paid.revenue.toLocaleString()}`} icon={<Tag />} color="rose" />
            <KpiCard title="Sales" value={stats.paid.sales} icon={<ShoppingBag />} color="rose" />
          </div>
        </div>
      </div>

      <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-sm h-[450px]">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Evolución de Sesiones Diarias</h4>
        <ResponsiveContainer width="100%" height="90%">
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
            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
            <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
            <Legend verticalAlign="top" height={36}/>
            <Area name="Organic Search" type="monotone" dataKey="organic" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorOrg)" />
            <Area name="Paid Search" type="monotone" dataKey="paid" stroke="#f59e0b" strokeWidth={4} fillOpacity={1} fill="url(#colorPaid)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const SeoMarketplaceView = ({ data, keywordData, aggregate }: any) => {
  const seoTotals = aggregate(data.filter((d: any) => d.channel === 'Organic Search'));
  const gscTotals = keywordData.reduce((acc: any, curr: any) => ({
    impressions: acc.impressions + curr.impressions,
    clicks: acc.clicks + curr.clicks
  }), { impressions: 0, clicks: 0 });

  const countryStats = useMemo(() => {
    const map: any = {};
    keywordData.forEach((k: any) => {
      if (!map[k.country]) map[k.country] = { country: k.country, revenue: 0, clicks: 0, impressions: 0 };
      map[k.country].revenue += k.revenue;
      map[k.country].clicks += k.clicks;
      map[k.country].impressions += k.impressions;
    });
    return Object.values(map);
  }, [keywordData]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard title="Impresiones" value={gscTotals.impressions} icon={<Eye />} />
        <KpiCard title="Clicks" value={gscTotals.clicks} icon={<MousePointer2 />} />
        <KpiCard title="CTR GSC" value={`${(gscTotals.impressions > 0 ? (gscTotals.clicks / gscTotals.impressions) * 100 : 0).toFixed(2)}%`} icon={<Percent />} />
        <KpiCard title="Conv. Rate" value={`${seoTotals.cr.toFixed(2)}%`} icon={<TrendingUp />} color="emerald" />
        <KpiCard title="Revenue" value={`€${seoTotals.revenue.toLocaleString()}`} icon={<Tag />} color="emerald" />
        <KpiCard title="Sales" value={seoTotals.sales} icon={<ShoppingBag />} color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-sm h-[400px]">
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Performance por Mercado</h4>
           <ResponsiveContainer width="100%" height="90%">
              <BarChart data={countryStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="country" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                <Tooltip cursor={{fill: '#f8fafc'}} />
                <Bar dataKey="clicks" name="Clicks" fill="#6366f1" radius={[12, 12, 0, 0]} />
                <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[12, 12, 0, 0]} />
              </BarChart>
           </ResponsiveContainer>
        </div>
        <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-sm h-[400px]">
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Impresiones por Mercado</h4>
           <ResponsiveContainer width="100%" height="90%">
              <BarChart data={countryStats} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="country" type="category" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 700}} />
                <Tooltip cursor={{fill: '#f8fafc'}} />
                <Bar dataKey="impressions" fill="#0ea5e9" radius={[0, 12, 12, 0]} />
              </BarChart>
           </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const SeoDeepDiveView = ({ keywords, filters, searchTerm, setSearchTerm }: any) => {
  const filtered = keywords.filter((k: any) => {
    const countryMatch = filters.country === 'All' || k.country === filters.country;
    const queryTypeMatch = filters.queryType === 'All' || k.queryType === filters.queryType;
    const searchMatch = k.keyword.toLowerCase().includes(searchTerm.toLowerCase()) || k.landingPage.toLowerCase().includes(searchTerm.toLowerCase());
    return countryMatch && queryTypeMatch && searchMatch;
  });

  return (
    <div className="bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="p-10 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-50/50">
        <div>
           <h3 className="text-xl font-black mb-1">Deep Dive: Keywords & Landing Pages</h3>
           <p className="text-xs text-slate-400 font-medium italic">Análisis granular real proveniente de Search Console.</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Filtrar por keyword o URL..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-3xl text-sm font-medium focus:ring-2 ring-indigo-500/20 outline-none transition-all shadow-sm"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-widest border-b border-slate-100">
            <tr>
              <th className="px-10 py-6">Keyword / Página</th>
              <th className="px-10 py-6 text-center">Impresiones</th>
              <th className="px-10 py-6 text-center">Clicks</th>
              <th className="px-10 py-6 text-center">CTR</th>
              <th className="px-10 py-6 text-center">Rev. Est.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.slice(0, 50).map((row: any, i: number) => (
              <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                <td className="px-10 py-6">
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{row.keyword}</span>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                       <FileText className="w-3 h-3" />
                       <span className="truncate max-w-[300px]">{row.landingPage}</span>
                    </div>
                  </div>
                </td>
                <td className="px-10 py-6 text-center font-medium">{row.impressions.toLocaleString()}</td>
                <td className="px-10 py-6 text-center font-bold text-slate-700">{row.clicks.toLocaleString()}</td>
                <td className="px-10 py-6 text-center">
                  <div className={`inline-block px-3 py-1 rounded-full text-[11px] font-black ${row.ctr > 5 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                    {row.ctr.toFixed(2)}%
                  </div>
                </td>
                <td className="px-10 py-6 text-center font-black text-slate-900">€{row.revenue.toLocaleString()}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-10 py-20 text-center text-slate-400 font-bold">No hay datos disponibles para estos filtros.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SidebarLink = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-sm font-black transition-all ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 translate-x-2' : 'text-slate-500 hover:text-white hover:bg-white/5 hover:translate-x-1'}`}
  >
    {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-5 h-5' })}
    {label}
  </button>
);

export default App;
