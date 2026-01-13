import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  BarChart3, Search, Calendar, ArrowUpRight, ArrowDownRight, TrendingUp, Sparkles, Globe, Tag, MousePointer2, Eye, Percent, ShoppingBag, LogOut, RefreshCw, CheckCircle2, Layers, Activity, Filter, ArrowRight, Target, FileText, AlertCircle, Settings2, Info, Menu, X, ChevronDown, ChevronRight, ExternalLink
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Legend, LineChart, Line
} from 'recharts';
import { DashboardTab, DashboardFilters, DailyData, KeywordData, Ga4Property, GscSite, QueryType, ChannelType } from './types';
import { getDashboardInsights } from './geminiService';

// --- IMPORTANTE: Importamos tu componente de Login ---
import GoogleLogin from './GoogleLogin'; 

const CLIENT_ID = "333322783684-pjhn2omejhngckfd46g8bh2dng9dghlc.apps.googleusercontent.com"; 
const SCOPE_GA4 = "https://www.googleapis.com/auth/analytics.readonly";
const SCOPE_GSC = "https://www.googleapis.com/auth/webmasters.readonly";

const countryMap: Record<string, string> = {
  'esp': 'Spain', 'mex': 'Mexico', 'usa': 'United States', 'gbr': 'United Kingdom',
  'fra': 'France', 'deu': 'Germany', 'ita': 'Italy', 'prt': 'Portugal'
};

// --- Componentes Auxiliares ---
const KpiCard: React.FC<{ 
  title: string; value: string | number; comparison?: number; icon: React.ReactNode; color?: string; isPercent?: boolean;
}> = ({ title, value, comparison, icon, color = "indigo", isPercent = false }) => (
  <div className="bg-white p-5 md:p-6 rounded-[24px] border border-slate-200 shadow-sm hover:shadow-md transition-all group">
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
    <p className="text-slate-400 text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] mb-1">{title}</p>
    <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight truncate">
      {typeof value === 'number' && !isPercent ? value.toLocaleString() : value}
    </h3>
  </div>
);

// --- Componente Principal APP ---
const App: React.FC = () => {
  // Estados de Autenticación
  const [user, setUser] = useState<{ name: string; email: string; picture: string } | null>(null);
  const [ga4Auth, setGa4Auth] = useState<{ token: string; property: Ga4Property | null } | null>(null);
  const [gscAuth, setGscAuth] = useState<{ token: string; site: GscSite | null } | null>(null);
  
  // Estados de Datos
  const [availableProperties, setAvailableProperties] = useState<Ga4Property[]>([]);
  const [availableSites, setAvailableSites] = useState<GscSite[]>([]);
  const [realDailyData, setRealDailyData] = useState<DailyData[]>([]);
  const [realKeywordData, setRealKeywordData] = useState<KeywordData[]>([]);
  
  // UI States
  const [isLoadingGa4, setIsLoadingGa4] = useState(false);
  const [isLoadingGsc, setIsLoadingGsc] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [brandRegexStr, setBrandRegexStr] = useState('tienda|deportes|pro|brandname');

  // Filtros y Tabs
  const [activeTab, setActiveTab] = useState<DashboardTab>(DashboardTab.ORGANIC_VS_PAID);
  const [filters, setFilters] = useState<DashboardFilters>({
    dateRange: { 
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
      end: new Date().toISOString().split('T')[0] 
    },
    country: 'All',
    queryType: 'All'
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Refs para OAuth (Permisos de Datos)
  const tokenClientGa4 = useRef<any>(null);
  const tokenClientGsc = useRef<any>(null);

  // --- Funciones Auxiliares ---
  const isBranded = (text: string) => {
    try {
      const regex = new RegExp(brandRegexStr, 'i');
      return regex.test(text);
    } catch (e) { return false; }
  };

  // --- Data Fetching Logic (GA4 & GSC) ---
  const fetchGa4Properties = async (token: string) => {
    try {
      const resp = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) throw new Error(`Status GA4 Admin: ${resp.status}`);
      const data = await resp.json();
      
      const props: Ga4Property[] = [];
      data.accountSummaries?.forEach((acc: any) => {
        acc.propertySummaries?.forEach((p: any) => {
          props.push({ id: p.property, name: p.displayName });
        });
      });
      
      setAvailableProperties(props);
      if (props.length > 0) {
        setGa4Auth(prev => prev ? { ...prev, property: props[0] } : null);
      }
    } catch (e) {
      console.error(e);
      setError("Error conectando con GA4 Admin API.");
    }
  };

  const fetchGscSites = async (token: string) => {
    try {
      const resp = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) throw new Error(`Status GSC Sites: ${resp.status}`);
      const data = await resp.json();
      const sites = data.siteEntry || [];
      setAvailableSites(sites);
      if (sites.length > 0) {
        setGscAuth(prev => prev ? { ...prev, site: sites[0] } : null);
      }
    } catch (e) {
      console.error(e);
      setError("Error conectando con Search Console API.");
    }
  };

  const fetchGa4Data = async () => {
    if (!ga4Auth?.property || !ga4Auth.token) return;
    setIsLoadingGa4(true);
    try {
      const ga4ReportResp = await fetch(`https://analyticsdata.googleapis.com/v1beta/${ga4Auth.property.id}:runReport`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ga4Auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [{ startDate: filters.dateRange.start, endDate: filters.dateRange.end }],
          dimensions: [{ name: 'date' }, { name: 'sessionDefaultChannelGroup' }, { name: 'country' }, { name: 'landingPage' }],
          metrics: [{ name: 'sessions' }, { name: 'totalRevenue' }, { name: 'transactions' }, { name: 'sessionConversionRate' }]
        })
      });
      
      const ga4Data = await ga4ReportResp.json();
      if (ga4Data.error) throw new Error(ga4Data.error.message);

      const dailyMapped: DailyData[] = (ga4Data.rows || []).map((row: any) => {
        const landingPage = row.dimensionValues[3].value;
        return {
          date: `${row.dimensionValues[0].value.slice(0,4)}-${row.dimensionValues[0].value.slice(4,6)}-${row.dimensionValues[0].value.slice(6,8)}`,
          channel: (row.dimensionValues[1].value.includes('Organic') ? 'Organic Search' : (row.dimensionValues[1].value.includes('Paid') ? 'Paid Search' : 'Organic Search')) as ChannelType,
          country: row.dimensionValues[2].value,
          queryType: 'Non-Branded' as QueryType,
          landingPage: landingPage,
          sessions: parseInt(row.metricValues[0].value) || 0,
          revenue: parseFloat(row.metricValues[1].value) || 0,
          sales: parseInt(row.metricValues[2].value) || 0,
          conversionRate: (parseFloat(row.metricValues[3].value) || 0) * 100,
          clicks: 0, impressions: 0, ctr: 0
        };
      });
      setRealDailyData(dailyMapped);
    } catch (err: any) {
      console.error(err);
      setError(`Error GA4: ${err.message}`);
    } finally {
      setIsLoadingGa4(false);
    }
  };

  const fetchGscData = async () => {
    if (!gscAuth?.site || !gscAuth.token) return;
    setIsLoadingGsc(true);
    try {
      const siteUrl = encodeURIComponent(gscAuth.site.siteUrl);
      const gscReportResp = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/searchAnalytics/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${gscAuth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: filters.dateRange.start,
          endDate: filters.dateRange.end,
          dimensions: ['query', 'page', 'country', 'date'],
          rowLimit: 5000
        })
      });
      const gscData = await gscReportResp.json();
      if (gscData.error) throw new Error(gscData.error.message);

      const keywordMapped: KeywordData[] = (gscData.rows || []).map((row: any) => {
        const countryCode = row.keys[2]?.toLowerCase() || 'unknown';
        const normCountry = countryMap[countryCode] || row.keys[2];
        return {
          keyword: row.keys[0],
          landingPage: row.keys[1],
          country: normCountry,
          queryType: 'Non-Branded' as QueryType,
          date: row.keys[3],
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr * 100,
          sessions: 0, conversionRate: 0, revenue: 0, sales: 0
        };
      });
      setRealKeywordData(keywordMapped);
    } catch (err: any) {
      console.error(err);
      setError(`Error GSC: ${err.message}`);
    } finally {
      setIsLoadingGsc(false);
    }
  };

  // --- Handlers de Autenticación (CORREGIDO CON POLLING) ---
  useEffect(() => {
    // Esta función intenta conectarse hasta que Google está listo
    const initializeOAuth = () => {
      if (typeof window !== 'undefined' && (window as any).google && (window as any).google.accounts) {
        console.log("✅ Google Script detectado. Inicializando OAuth...");
        
        // Configuramos GA4 OAuth Client
        tokenClientGa4.current = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPE_GA4,
          prompt: 'consent',
          callback: (resp: any) => {
            if (resp.access_token) {
              setGa4Auth({ token: resp.access_token, property: null });
              fetchGa4Properties(resp.access_token);
            }
          },
        });

        // Configuramos GSC OAuth Client
        tokenClientGsc.current = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPE_GSC,
          prompt: 'consent',
          callback: (resp: any) => {
            if (resp.access_token) {
              setGscAuth({ token: resp.access_token, site: null });
              fetchGscSites(resp.access_token);
            }
          },
        });
      } else {
        // Si falla, reintenta en 500ms
        console.log("⏳ Esperando script de Google para OAuth...");
        setTimeout(initializeOAuth, 500);
      }
    };

    initializeOAuth();
  }, []);

  const handleLoginSuccess = (credentialToken: string) => {
    try {
      const base64Url = credentialToken.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = JSON.parse(atob(base64));
      
      setUser({ 
        name: decoded.name, 
        email: decoded.email, 
        picture: decoded.picture 
      });
    } catch (error) {
      console.error("Error decodificando token:", error);
    }
  };

  // --- Efectos de Datos ---
  useEffect(() => {
    if (ga4Auth?.token && ga4Auth.property) fetchGa4Data();
  }, [ga4Auth?.property?.id, filters.dateRange]);

  useEffect(() => {
    if (gscAuth?.token && gscAuth.site) fetchGscData();
  }, [gscAuth?.site?.siteUrl, filters.dateRange]);

  // --- Cálculos y Memoización ---
  const filteredDailyData = useMemo((): DailyData[] => {
    return realDailyData.filter(d => {
      const isBrandedVal = isBranded(d.landingPage || '');
      const queryTypeActual = isBrandedVal ? 'Branded' : 'Non-Branded';
      const countryMatch = filters.country === 'All' || d.country === filters.country;
      const queryMatch = filters.queryType === 'All' || queryTypeActual === filters.queryType;
      return countryMatch && queryMatch;
    }).map(d => ({ ...d, queryType: (isBranded(d.landingPage || '') ? 'Branded' : 'Non-Branded') as QueryType }));
  }, [realDailyData, filters, brandRegexStr]);

  const filteredKeywordData = useMemo((): KeywordData[] => {
    return realKeywordData.filter(k => {
      const isBrandedVal = isBranded(k.keyword);
      const queryTypeActual = isBrandedVal ? 'Branded' : 'Non-Branded';
      const countryMatch = filters.country === 'All' || k.country === filters.country;
      const queryMatch = filters.queryType === 'All' || queryTypeActual === filters.queryType;
      return countryMatch && queryMatch;
    }).map(k => ({ ...k, queryType: (isBranded(k.keyword) ? 'Branded' : 'Non-Branded') as QueryType }));
  }, [realKeywordData, filters, brandRegexStr]);

  const aggregate = (data: DailyData[]) => {
    const sum = data.reduce((acc, curr) => ({
      sessions: acc.sessions + curr.sessions,
      sales: acc.sales + curr.sales,
      revenue: acc.revenue + curr.revenue,
    }), { sessions: 0, sales: 0, revenue: 0 });
    return { ...sum, cr: sum.sessions > 0 ? (sum.sales / sum.sessions) * 100 : 0 };
  };

  const channelStats = useMemo(() => {
    const organic = aggregate(filteredDailyData.filter(d => d.channel === 'Organic Search'));
    const paid = aggregate(filteredDailyData.filter(d => d.channel === 'Paid Search'));
    return { organic, paid };
  }, [filteredDailyData]);

  const handleGenerateInsights = async () => {
    setLoadingInsights(true);
    try {
      const dashboardName = activeTab === DashboardTab.ORGANIC_VS_PAID ? "Organic vs Paid" : (activeTab === DashboardTab.SEO_BY_COUNTRY ? "SEO por País" : "Keywords Deep Dive");
      const summary = `GA4 Organic Sessions: ${channelStats.organic.sessions}. GSC Clicks: ${filteredKeywordData.reduce((a,b)=>a+b.clicks,0)}.`;
      const insights = await getDashboardInsights(summary, dashboardName);
      setAiInsights(insights);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInsights(false);
    }
  };

  const isAnythingLoading = isLoadingGa4 || isLoadingGsc;

  // --- VISTA 1: LOGIN (Si no hay usuario) ---
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600 blur-[120px] rounded-full animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600 blur-[120px] rounded-full animate-pulse delay-1000" />
        </div>
        
        {/* Login Card */}
        <div className="w-full max-w-xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-[48px] p-8 md:p-12 text-center z-10 shadow-2xl">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-indigo-600 rounded-[24px] md:rounded-[28px] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-indigo-500/20 transform -rotate-6">
            <Activity className="w-8 h-8 md:w-10 md:h-10 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-4 tracking-tighter">SEO & SEM Reporting</h1>
          <p className="text-slate-400 font-medium mb-10 text-base md:text-lg">Inicia sesión con Google para acceder al dashboard.</p>
          
          {/* Aquí usamos tu componente GoogleLogin importado */}
          <div className="flex justify-center w-full">
             <GoogleLogin onLoginSuccess={handleLoginSuccess} />
          </div>
        </div>
      </div>
    );
  }

  // --- VISTA 2: DASHBOARD (Usuario autenticado) ---
  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col md:flex-row">
      {/* Mobile Toggle Button */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="xl:hidden fixed bottom-6 right-6 z-50 p-4 bg-slate-950 text-white rounded-full shadow-2xl active:scale-95 transition-transform"
      >
        {isSidebarOpen ? <X /> : <Menu />}
      </button>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 xl:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-80 bg-slate-950 text-white flex flex-col z-50 shadow-2xl transition-transform duration-300 xl:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-10 overflow-y-auto flex-1 custom-scrollbar">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20">
              <Activity className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">SEO Master</h1>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Suite Pro</p>
            </div>
          </div>

          <nav className="space-y-2 mb-12">
            <SidebarLink active={activeTab === DashboardTab.ORGANIC_VS_PAID} onClick={() => {setActiveTab(DashboardTab.ORGANIC_VS_PAID); setIsSidebarOpen(false);}} icon={<Layers />} label="Organic vs Paid" />
            <SidebarLink active={activeTab === DashboardTab.SEO_BY_COUNTRY} onClick={() => {setActiveTab(DashboardTab.SEO_BY_COUNTRY); setIsSidebarOpen(false);}} icon={<Globe />} label="Performance País" />
            <SidebarLink active={activeTab === DashboardTab.KEYWORD_DEEP_DIVE} onClick={() => {setActiveTab(DashboardTab.KEYWORD_DEEP_DIVE); setIsSidebarOpen(false);}} icon={<Target />} label="Análisis SEO Deep" />
          </nav>

          {/* Configuración SEO */}
          <div className="space-y-8">
            <div className="bg-white/5 rounded-3xl p-6 border border-white/10">
              <div className="flex items-center gap-2 mb-4 text-indigo-400">
                <Settings2 className="w-4 h-4" />
                <h4 className="text-[10px] font-black uppercase tracking-widest">Configuración SEO</h4>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest block">Branded Regex</label>
                    <Info className="w-3 h-3 text-slate-600" />
                  </div>
                  <input 
                    type="text" 
                    value={brandRegexStr} 
                    onChange={e => setBrandRegexStr(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl text-[11px] p-3 focus:ring-1 ring-indigo-500 outline-none"
                    placeholder="Ej: brand|tienda|pro"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User Info & Connections */}
        <div className="p-8 border-t border-white/5 bg-slate-950">
           <div className="bg-white/5 rounded-3xl p-5">
              <div className="flex items-center gap-3 mb-6">
                <img src={user.picture} className="w-10 h-10 rounded-full border-2 border-indigo-500" alt="user" />
                <div className="truncate">
                   <p className="text-xs font-black truncate">{user.name}</p>
                   <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                </div>
              </div>
              <div className="space-y-4">
                 {ga4Auth?.token ? (
                    <div className="relative">
                        <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest block mb-2">GA4</label>
                        <select 
                          className="w-full bg-slate-900 border border-white/10 rounded-xl text-[11px] p-2.5 outline-none cursor-pointer"
                          value={ga4Auth.property?.id || ''}
                          onChange={e => setGa4Auth({...ga4Auth, property: availableProperties.find(p => p.id === e.target.value) || null})}
                        >
                          {availableProperties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                 ) : (
                    // BOTÓN CONECTAR GA4 SEGURO
                    <button 
                      onClick={() => {
                        if (tokenClientGa4.current) {
                          tokenClientGa4.current.requestAccessToken();
                        } else {
                          console.warn("Cliente GA4 no listo. Reintentando...");
                        }
                      }} 
                      className="w-full py-2 bg-indigo-600/20 text-indigo-400 text-[9px] font-black uppercase rounded-xl border border-indigo-600/30 hover:bg-indigo-600 hover:text-white transition-all"
                    >
                      Conectar GA4
                    </button>
                 )}

                 {gscAuth?.token ? (
                    <div className="relative">
                        <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest block mb-2">GSC</label>
                        <select 
                          className="w-full bg-slate-900 border border-white/10 rounded-xl text-[11px] p-2.5 outline-none cursor-pointer"
                          value={gscAuth.site?.siteUrl || ''}
                          onChange={e => setGscAuth({...gscAuth, site: availableSites.find(s => s.siteUrl === e.target.value) || null})}
                        >
                          {availableSites.map(s => <option key={s.siteUrl} value={s.siteUrl}>{s.siteUrl}</option>)}
                        </select>
                    </div>
                 ) : (
                    // BOTÓN CONECTAR GSC SEGURO
                    <button 
                      onClick={() => {
                         if (tokenClientGsc.current) {
                           tokenClientGsc.current.requestAccessToken();
                         } else {
                           console.warn("Cliente GSC no listo. Reintentando...");
                         }
                      }} 
                      className="w-full py-2 bg-emerald-600/20 text-emerald-400 text-[9px] font-black uppercase rounded-xl border border-emerald-600/30 hover:bg-emerald-600 hover:text-white transition-all"
                    >
                      Conectar GSC
                    </button>
                 )}
              </div>
              <button onClick={() => window.location.reload()} className="w-full mt-6 py-2 text-[10px] font-black text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2">
                <LogOut className="w-3 h-3" /> Cerrar Sesión
              </button>
           </div>
        </div>
      </aside>

      {/* Main Content Dashboard */}
      <main className="flex-1 xl:ml-80 p-5 md:p-8 xl:p-14 transition-all overflow-x-hidden">
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-12">
          <div className="w-full xl:w-auto">
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2 h-2 rounded-full ${isAnythingLoading ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
              <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {isLoadingGa4 ? 'Sincronizando GA4...' : isLoadingGsc ? 'Sincronizando GSC...' : 'Dashboard Operativo'}
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter break-words">
              {activeTab === DashboardTab.ORGANIC_VS_PAID && "Organic vs Paid Performance"}
              {activeTab === DashboardTab.SEO_BY_COUNTRY && "SEO Performance por País"}
              {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && "Análisis por URL & Keywords"}
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 bg-white p-2 rounded-[28px] md:rounded-[32px] border border-slate-200 shadow-sm w-full xl:w-auto">
            <div className="flex items-center gap-2 px-4 py-2 border-b sm:border-b-0 sm:border-r border-slate-100 min-w-0">
               <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
               <div className="flex items-center gap-2 text-[11px] font-bold overflow-hidden">
                  <input type="date" value={filters.dateRange.start} onChange={e => setFilters({...filters, dateRange: {...filters.dateRange, start: e.target.value}})} className="outline-none bg-transparent w-full" />
                  <span className="text-slate-300">/</span>
                  <input type="date" value={filters.dateRange.end} onChange={e => setFilters({...filters, dateRange: {...filters.dateRange, end: e.target.value}})} className="outline-none bg-transparent w-full" />
               </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 border-b sm:border-b-0 sm:border-r border-slate-100">
               <Globe className="w-4 h-4 text-slate-400 flex-shrink-0" />
               <select className="bg-transparent text-[11px] font-black uppercase outline-none cursor-pointer w-full" value={filters.country} onChange={e => setFilters({...filters, country: e.target.value})}>
                  <option value="All">Global</option>
                  {Array.from(new Set([...realDailyData.map(d => d.country), ...realKeywordData.map(k => k.country)])).filter(Boolean).sort().map(c => <option key={c} value={c}>{c}</option>)}
               </select>
            </div>
            <div className="flex items-center gap-2 px-4 py-2">
               <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
               <select className="bg-transparent text-[11px] font-black uppercase outline-none cursor-pointer w-full" value={filters.queryType} onChange={e => setFilters({...filters, queryType: e.target.value as any})}>
                  <option value="All">Branded + Non</option>
                  <option value="Branded">Solo Branded</option>
                  <option value="Non-Branded">Solo Non-B</option>
               </select>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-8 p-5 md:p-6 bg-rose-50 border border-rose-200 rounded-[28px] md:rounded-[32px] flex items-center gap-4 text-rose-700 shadow-sm">
            <AlertCircle className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0" />
            <p className="font-bold text-xs md:text-sm">{error}</p>
          </div>
        )}

        {aiInsights && (
          <div className="mb-12 bg-indigo-600 rounded-[32px] md:rounded-[40px] p-6 md:p-10 text-white shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
            <div className="flex justify-between items-start mb-6 md:mb-8 relative z-10">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl"><Sparkles className="w-5 h-5 md:w-6 md:h-6" /></div>
                <h3 className="text-xl md:text-2xl font-black">Análisis IA Gemini</h3>
              </div>
              <button onClick={() => setAiInsights(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="prose prose-invert max-w-none relative z-10 font-medium text-sm md:text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: aiInsights.replace(/\n/g, '<br/>') }} />
          </div>
        )}

        {/* Dashboards Views */}
        <div className="w-full overflow-x-hidden">
          {activeTab === DashboardTab.ORGANIC_VS_PAID && <OrganicVsPaidView stats={channelStats} data={filteredDailyData} />}
          {activeTab === DashboardTab.SEO_BY_COUNTRY && <SeoMarketplaceView data={filteredDailyData} keywordData={filteredKeywordData} aggregate={aggregate} />}
          {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && <SeoDeepDiveView keywords={filteredKeywordData} searchTerm={searchTerm} setSearchTerm={setSearchTerm} isLoading={isAnythingLoading} />}
        </div>

        <div className="mt-16 flex justify-center pb-20">
          <button 
            onClick={handleGenerateInsights}
            disabled={loadingInsights || isAnythingLoading || (realDailyData.length === 0 && realKeywordData.length === 0)}
            className="flex items-center gap-3 px-8 md:px-12 py-4 md:py-5 bg-slate-950 text-white rounded-[24px] md:rounded-[32px] text-xs md:text-sm font-black shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
          >
            {loadingInsights ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            Obtener Reporte Estratégico IA
          </button>
        </div>
      </main>
    </div>
  );
};

// --- Sub-Componentes Dashboard ---

const OrganicVsPaidView = ({ stats, data }: any) => {
  const chartData = useMemo(() => {
    if (!data.length) return [];
    const map: any = {};
    data.forEach((d: any) => {
      if (!map[d.date]) map[d.date] = { date: d.date, organic: 0, paid: 0 };
      if (d.channel === 'Organic Search') map[d.date].organic += d.sessions;
      else if (d.channel === 'Paid Search') map[d.date].paid += d.sessions;
    });
    return Object.values(map).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [data]);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-[10px]">ORG</div>
            <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Organic Search (GA4)</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <KpiCard title="Sesiones" value={stats.organic.sessions} icon={<TrendingUp />} />
            <KpiCard title="Conv. Rate" value={`${stats.organic.cr.toFixed(2)}%`} icon={<Percent />} isPercent />
            <KpiCard title="Revenue" value={`€${stats.organic.revenue.toLocaleString()}`} icon={<Tag />} color="emerald" />
            <KpiCard title="Ventas" value={stats.organic.sales} icon={<ShoppingBag />} color="emerald" />
          </div>
        </div>
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center text-white font-bold text-[10px]">PAID</div>
            <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Paid Search (GA4)</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <KpiCard title="Sesiones" value={stats.paid.sessions} icon={<TrendingUp />} color="amber" />
            <KpiCard title="Conv. Rate" value={`${stats.paid.cr.toFixed(2)}%`} icon={<Percent />} color="amber" isPercent />
            <KpiCard title="Revenue" value={`€${stats.paid.revenue.toLocaleString()}`} icon={<Tag />} color="rose" />
            <KpiCard title="Ventas" value={stats.paid.sales} icon={<ShoppingBag />} color="rose" />
          </div>
        </div>
      </div>
      <div className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-slate-200 shadow-sm h-[350px] md:h-[450px]">
        <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10">Evolución de Sesiones por Canal</h4>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="85%">
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
              <XAxis dataKey="date" tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} />
              <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
              <Legend verticalAlign="top" align="center" iconType="circle" />
              <Area name="Orgánico" type="monotone" dataKey="organic" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorOrg)" />
              <Area name="Pago" type="monotone" dataKey="paid" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorPaid)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : <EmptyState text="Sincroniza GA4 para visualizar tendencias" /> }
      </div>
    </div>
  );
};

const SeoMarketplaceView = ({ data, keywordData, aggregate }: any) => {
  const seoGa4 = aggregate(data.filter((d: any) => d.channel === 'Organic Search'));
  const gscStats = useMemo(() => {
    return keywordData.reduce((acc: any, curr: any) => ({
      impressions: acc.impressions + curr.impressions,
      clicks: acc.clicks + curr.clicks
    }), { impressions: 0, clicks: 0 });
  }, [keywordData]);

  const countryStats = useMemo(() => {
    const map: any = {};
    keywordData.forEach((k: any) => {
      if (!map[k.country]) map[k.country] = { country: k.country, clicks: 0, impressions: 0 };
      map[k.country].clicks += k.clicks;
      map[k.country].impressions += k.impressions;
    });
    return Object.values(map).sort((a: any, b: any) => b.clicks - a.clicks).slice(0, 10);
  }, [keywordData]);

  const monthlyStats = useMemo(() => {
    const map: any = {};
    keywordData.forEach((k: any) => {
      if (!k.date) return;
      const month = k.date.substring(0, 7); 
      if (!map[month]) map[month] = { month, clicks: 0, impressions: 0 };
      map[month].clicks += k.clicks;
      map[month].impressions += k.impressions;
    });
    return Object.values(map).sort((a: any, b: any) => a.month.localeCompare(b.month));
  }, [keywordData]);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700 overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard title="Impresiones (GSC)" value={gscStats.impressions} icon={<Eye />} />
        <KpiCard title="Clicks (GSC)" value={gscStats.clicks} icon={<MousePointer2 />} />
        <KpiCard title="CTR (GSC)" value={`${(gscStats.impressions > 0 ? (gscStats.clicks / gscStats.impressions) * 100 : 0).toFixed(2)}%`} icon={<Percent />} />
        <KpiCard title="Conv. Rate (GA4)" value={`${seoGa4.cr.toFixed(2)}%`} icon={<TrendingUp />} color="emerald" />
        <KpiCard title="Revenue (GA4)" value={`€${seoGa4.revenue.toLocaleString()}`} icon={<Tag />} color="emerald" />
        <KpiCard title="Sales (GA4)" value={seoGa4.sales} icon={<ShoppingBag />} color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-slate-200 shadow-sm h-[350px] md:h-[450px]">
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10">Clicks por Mercado</h4>
           {countryStats.length > 0 ? (
             <ResponsiveContainer width="100%" height="85%">
                <BarChart data={countryStats}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="country" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="clicks" name="Clicks" fill="#6366f1" radius={[8, 8, 0, 0]} />
                </BarChart>
             </ResponsiveContainer>
           ) : <EmptyState text="Sincroniza GSC para ver distribución geográfica" />}
        </div>
        <div className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-slate-200 shadow-sm h-[350px] md:h-[450px]">
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10">Visibilidad (Impresiones)</h4>
           {countryStats.length > 0 ? (
             <ResponsiveContainer width="100%" height="85%">
                <BarChart data={countryStats}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="country" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="impressions" name="Impresiones" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                </BarChart>
             </ResponsiveContainer>
           ) : <EmptyState text="Datos de visibilidad no disponibles" />}
        </div>
      </div>

      <div className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-slate-200 shadow-sm h-[350px] md:h-[450px]">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-10">
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tendencia Mensual SEO</h4>
           <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />
                <span className="text-[9px] font-bold text-slate-600 uppercase">Clicks</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                <span className="text-[9px] font-bold text-slate-600 uppercase">Impresiones</span>
              </div>
           </div>
        </div>
        {monthlyStats.length > 0 ? (
          <ResponsiveContainer width="100%" height="85%">
             <LineChart data={monthlyStats}>
               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
               <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} />
               <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#6366f1'}} />
               <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#10b981'}} />
               <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
               <Line yAxisId="left" type="monotone" dataKey="clicks" name="Clicks" stroke="#6366f1" strokeWidth={3} dot={{r: 3}} />
               <Line yAxisId="right" type="monotone" dataKey="impressions" name="Impresiones" stroke="#10b981" strokeWidth={3} dot={{r: 3}} />
             </LineChart>
          </ResponsiveContainer>
        ) : <EmptyState text="Histórico mensual no disponible" />}
      </div>
    </div>
  );
};

const SeoDeepDiveView = ({ keywords, searchTerm, setSearchTerm, isLoading }: any) => {
  const [expandedUrls, setExpandedUrls] = useState<Set<string>>(new Set());

  const toggleUrl = (url: string) => {
    const next = new Set(expandedUrls);
    if (next.has(url)) next.delete(url);
    else next.add(url);
    setExpandedUrls(next);
  };

  const aggregatedByUrl = useMemo(() => {
    const map: Record<string, { 
      url: string; clicks: number; impressions: number; ctr: number; children: Record<string, KeywordData>; brandedCount: number 
    }> = {};
    
    keywords.forEach((k: KeywordData) => {
      const url = k.landingPage;
      if (!map[url]) {
        map[url] = { url, clicks: 0, impressions: 0, ctr: 0, children: {}, brandedCount: 0 };
      }
      map[url].clicks += k.clicks;
      map[url].impressions += k.impressions;
      
      const kw = k.keyword;
      if (!map[url].children[kw]) {
        map[url].children[kw] = { ...k };
      } else {
        map[url].children[kw].clicks += k.clicks;
        map[url].children[kw].impressions += k.impressions;
      }
    });

    return Object.values(map).map(page => {
      const childrenList = Object.values(page.children).map(c => ({
        ...c,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0
      })).sort((a, b) => b.clicks - a.clicks);

      const brandedCount = childrenList.filter(c => c.queryType === 'Branded').length;

      return {
        url: page.url,
        clicks: page.clicks,
        impressions: page.impressions,
        ctr: page.impressions > 0 ? (page.clicks / page.impressions) * 100 : 0,
        children: childrenList,
        brandedCount
      };
    })
    .filter(p => p.url.toLowerCase().includes(searchTerm.toLowerCase()) || p.children.some(c => c.keyword.toLowerCase().includes(searchTerm.toLowerCase())))
    .sort((a, b) => b.clicks - a.clicks);
  }, [keywords, searchTerm]);

  return (
    <div className="bg-white rounded-[32px] md:rounded-[40px] border border-slate-200 overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="p-6 md:p-10 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-50/50">
        <div className="w-full">
           <h3 className="text-xl md:text-2xl font-black mb-1">Deep Dive por URL (Expandible)</h3>
           <p className="text-[11px] md:text-xs text-slate-400 font-medium">Agrupación automática por Landing Page y desglose de queries asociadas.</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Buscar por URL o Keyword..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-3xl text-sm font-medium focus:ring-2 ring-indigo-500/20 outline-none transition-all shadow-sm"
          />
        </div>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-sm min-w-[800px]">
          <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-widest border-b border-slate-100">
            <tr>
              <th className="px-10 py-6 w-10"></th>
              <th className="px-4 py-6">Landing Page / URL</th>
              <th className="px-6 py-6 text-center">Impresiones</th>
              <th className="px-6 py-6 text-center">Clicks</th>
              <th className="px-6 py-6 text-center">CTR Avg</th>
              <th className="px-10 py-6 text-center">Queries</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {aggregatedByUrl.slice(0, 50).map((row, i) => {
              const isExpanded = expandedUrls.has(row.url);
              return (
                <React.Fragment key={row.url}>
                  <tr 
                    onClick={() => toggleUrl(row.url)}
                    className={`group cursor-pointer transition-all ${isExpanded ? 'bg-indigo-50/40' : 'hover:bg-slate-50/80'}`}
                  >
                    <td className="pl-10 py-6">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-indigo-600" /> : <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />}
                    </td>
                    <td className="px-4 py-6">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                        <span className="font-bold text-slate-900 truncate max-w-[300px]" title={row.url}>{row.url}</span>
                        <a href={row.url} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white rounded-md shadow-sm">
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </a>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center font-medium">{row.impressions.toLocaleString()}</td>
                    <td className="px-6 py-6 text-center font-black text-slate-900">{row.clicks.toLocaleString()}</td>
                    <td className="px-6 py-6 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-black ${row.ctr > 5 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {row.ctr.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-10 py-6 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded-md text-[10px] font-black">{row.children.length}</span>
                        {row.brandedCount > 0 && (
                          <span title="Contiene queries branded">
                            <Tag className="w-3 h-3 text-indigo-500" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && row.children.map((child, ci) => (
                    <tr key={ci} className="bg-white/40 border-l-4 border-indigo-500 animate-in slide-in-from-left-2">
                      <td className="py-4"></td>
                      <td className="px-4 py-4 pl-12">
                        <div className="flex items-center gap-3">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                          <span className="text-slate-600 text-xs font-semibold">{child.keyword}</span>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${child.queryType === 'Branded' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                            {child.queryType}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-xs text-slate-500">{child.impressions.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center text-xs font-bold text-slate-700">{child.clicks.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center text-xs text-slate-500">{child.ctr.toFixed(2)}%</td>
                      <td className="px-10 py-4"></td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
            {aggregatedByUrl.length === 0 && (
              <tr>
                <td colSpan={6} className="px-10 py-20 text-center text-slate-400 italic font-medium">
                  {isLoading ? "Actualizando base de datos..." : "No se encontraron resultados para la búsqueda actual."}
                </td>
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

const EmptyState = ({ text }: { text: string }) => (
  <div className="h-full flex items-center justify-center">
    <div className="text-center p-8 bg-slate-50 border border-dashed border-slate-200 rounded-3xl">
      <Activity className="w-8 h-8 text-slate-200 mx-auto mb-4" />
      <p className="text-slate-400 italic text-xs font-medium">{text}</p>
    </div>
  </div>
);

export default App;
