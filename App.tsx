
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  BarChart3, Search, Calendar, ArrowUpRight, ArrowDownRight, TrendingUp, Sparkles, Globe, Tag, MousePointer2, Eye, Percent, ShoppingBag, LogOut, RefreshCw, CheckCircle2, Layers, Activity, Filter, ArrowRight, Target, FileText, AlertCircle, Settings2, Info, Menu, X, ChevronDown, ChevronRight, ExternalLink
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Legend, LineChart, Line
} from 'recharts';
import { DashboardTab, DashboardFilters, DailyData, KeywordData, Ga4Property, GscSite, QueryType, ChannelType } from './types';
import { getDashboardInsights } from './geminiService';
import GoogleLogin from './GoogleLogin'; 

const CLIENT_ID = "333322783684-pjhn2omejhngckfd46g8bh2dng9dghlc.apps.googleusercontent.com"; 
const SCOPE_GA4 = "https://www.googleapis.com/auth/analytics.readonly";
const SCOPE_GSC = "https://www.googleapis.com/auth/webmasters.readonly";

const countryMap: Record<string, string> = {
  'esp': 'Spain', 'mex': 'Mexico', 'usa': 'United States', 'gbr': 'United Kingdom',
  'fra': 'France', 'deu': 'Germany', 'ita': 'Italy', 'prt': 'Portugal'
};

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

const App: React.FC = () => {
  // Persistence: Check localStorage on mount
  const [user, setUser] = useState<{ name: string; email: string; picture: string } | null>(() => {
    const saved = localStorage.getItem('seo_suite_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [ga4Auth, setGa4Auth] = useState<{ token: string; property: Ga4Property | null } | null>(() => {
    const saved = sessionStorage.getItem('ga4_auth');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [gscAuth, setGscAuth] = useState<{ token: string; site: GscSite | null } | null>(() => {
    const saved = sessionStorage.getItem('gsc_auth');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [availableProperties, setAvailableProperties] = useState<Ga4Property[]>([]);
  const [availableSites, setAvailableSites] = useState<GscSite[]>([]);
  const [ga4Search, setGa4Search] = useState('');
  const [gscSearch, setGscSearch] = useState('');
  
  const [realDailyData, setRealDailyData] = useState<DailyData[]>([]);
  const [realKeywordData, setRealKeywordData] = useState<KeywordData[]>([]);
  
  const [isLoadingGa4, setIsLoadingGa4] = useState(false);
  const [isLoadingGsc, setIsLoadingGsc] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [brandRegexStr, setBrandRegexStr] = useState('tienda|deportes|pro|brandname');

  const [activeTab, setActiveTab] = useState<DashboardTab>(DashboardTab.ORGANIC_VS_PAID);
  const [filters, setFilters] = useState<DashboardFilters>({
    dateRange: { 
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
      end: new Date().toISOString().split('T')[0] 
    },
    country: 'All',
    queryType: 'All',
    channelGroup: 'All'
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const tokenClientGa4 = useRef<any>(null);
  const tokenClientGsc = useRef<any>(null);

  const isBranded = (text: string) => {
    try {
      const regex = new RegExp(brandRegexStr, 'i');
      return regex.test(text);
    } catch (e) { return false; }
  };

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
      if (props.length > 0 && !ga4Auth?.property) {
        setGa4Auth({ token, property: props[0] });
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
      if (sites.length > 0 && !gscAuth?.site) {
        setGscAuth({ token, site: sites[0] });
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

      const dailyMapped: DailyData[] = (ga4Data.rows || []).map((row: any) => ({
        date: `${row.dimensionValues[0].value.slice(0,4)}-${row.dimensionValues[0].value.slice(4,6)}-${row.dimensionValues[0].value.slice(6,8)}`,
        channel: row.dimensionValues[1].value,
        country: row.dimensionValues[2].value,
        queryType: 'Non-Branded' as QueryType,
        landingPage: row.dimensionValues[3].value,
        sessions: parseInt(row.metricValues[0].value) || 0,
        revenue: parseFloat(row.metricValues[1].value) || 0,
        sales: parseInt(row.metricValues[2].value) || 0,
        conversionRate: (parseFloat(row.metricValues[3].value) || 0) * 100,
        clicks: 0, impressions: 0, ctr: 0
      }));
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
        return {
          keyword: row.keys[0],
          landingPage: row.keys[1],
          country: countryMap[countryCode] || row.keys[2],
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

  useEffect(() => {
    const initializeOAuth = () => {
      if (typeof window !== 'undefined' && (window as any).google && (window as any).google.accounts) {
        tokenClientGa4.current = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPE_GA4,
          prompt: '',
          callback: (resp: any) => {
            if (resp.access_token) {
              const newAuth = { token: resp.access_token, property: ga4Auth?.property || null };
              setGa4Auth(newAuth);
              sessionStorage.setItem('ga4_auth', JSON.stringify(newAuth));
              fetchGa4Properties(resp.access_token);
            }
          },
        });
        tokenClientGsc.current = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPE_GSC,
          prompt: '',
          callback: (resp: any) => {
            if (resp.access_token) {
              const newAuth = { token: resp.access_token, site: gscAuth?.site || null };
              setGscAuth(newAuth);
              sessionStorage.setItem('gsc_auth', JSON.stringify(newAuth));
              fetchGscSites(resp.access_token);
            }
          },
        });

        // Re-fetch properties if token is already present from session
        if (ga4Auth?.token) fetchGa4Properties(ga4Auth.token);
        if (gscAuth?.token) fetchGscSites(gscAuth.token);
      } else {
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
      const newUser = { name: decoded.name, email: decoded.email, picture: decoded.picture };
      setUser(newUser);
      localStorage.setItem('seo_suite_user', JSON.stringify(newUser));
    } catch (error) { console.error("Error decoding token:", error); }
  };

  const handleLogout = () => {
    setUser(null);
    setGa4Auth(null);
    setGscAuth(null);
    localStorage.removeItem('seo_suite_user');
    sessionStorage.removeItem('ga4_auth');
    sessionStorage.removeItem('gsc_auth');
  };

  useEffect(() => { if (ga4Auth?.token && ga4Auth.property) fetchGa4Data(); }, [ga4Auth?.property?.id, filters.dateRange]);
  useEffect(() => { if (gscAuth?.token && gscAuth.site) fetchGscData(); }, [gscAuth?.site?.siteUrl, filters.dateRange]);

  const filteredDailyData = useMemo((): DailyData[] => {
    return realDailyData.filter(d => {
      const isBrandedVal = isBranded(d.landingPage || '');
      const queryTypeActual = isBrandedVal ? 'Branded' : 'Non-Branded';
      const countryMatch = filters.country === 'All' || d.country === filters.country;
      const queryMatch = filters.queryType === 'All' || queryTypeActual === filters.queryType;
      const channelMatch = filters.channelGroup === 'All' || d.channel === filters.channelGroup;
      return countryMatch && queryMatch && channelMatch;
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

  const uniqueChannelGroups = useMemo(() => {
    return Array.from(new Set(realDailyData.map(d => d.channel))).sort();
  }, [realDailyData]);

  const filteredProperties = useMemo(() => {
    return availableProperties.filter(p => p.name.toLowerCase().includes(ga4Search.toLowerCase()));
  }, [availableProperties, ga4Search]);

  const filteredSites = useMemo(() => {
    return availableSites.filter(s => s.siteUrl.toLowerCase().includes(gscSearch.toLowerCase()));
  }, [availableSites, gscSearch]);

  const aggregate = (data: DailyData[]) => {
    const sum = data.reduce((acc, curr) => ({
      sessions: acc.sessions + curr.sessions,
      sales: acc.sales + curr.sales,
      revenue: acc.revenue + curr.revenue,
    }), { sessions: 0, sales: 0, revenue: 0 });
    return { ...sum, cr: sum.sessions > 0 ? (sum.sales / sum.sessions) * 100 : 0 };
  };

  const channelStats = useMemo(() => {
    const organic = aggregate(filteredDailyData.filter(d => d.channel.includes('Organic Search')));
    const paid = aggregate(filteredDailyData.filter(d => d.channel.includes('Paid Search')));
    return { organic, paid };
  }, [filteredDailyData]);

  const handleGenerateInsights = async () => {
    setLoadingInsights(true);
    try {
      const dashboardName = activeTab === DashboardTab.ORGANIC_VS_PAID ? "Organic vs Paid" : (activeTab === DashboardTab.SEO_BY_COUNTRY ? "SEO por País" : "Keywords Deep Dive");
      const summary = `GA4 Sessions: ${filteredDailyData.reduce((a,b)=>a+b.sessions,0)}. GSC Clicks: ${filteredKeywordData.reduce((a,b)=>a+b.clicks,0)}.`;
      const insights = await getDashboardInsights(summary, dashboardName);
      setAiInsights(insights);
    } catch (err) { console.error(err); } finally { setLoadingInsights(false); }
  };

  const isAnythingLoading = isLoadingGa4 || isLoadingGsc;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600 blur-[120px] rounded-full animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600 blur-[120px] rounded-full animate-pulse delay-1000" />
        </div>
        <div className="w-full max-w-xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-[48px] p-8 md:p-12 text-center z-10 shadow-2xl">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-indigo-600 rounded-[24px] md:rounded-[28px] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-indigo-500/20 transform -rotate-6">
            <Activity className="w-8 h-8 md:w-10 md:h-10 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-4 tracking-tighter">SEO & SEM Reporting</h1>
          <p className="text-slate-400 font-medium mb-10 text-base md:text-lg">Inicia sesión con Google para acceder al dashboard.</p>
          <div className="flex justify-center w-full">
             <GoogleLogin onLoginSuccess={handleLoginSuccess} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col md:flex-row">
      <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="xl:hidden fixed bottom-6 right-6 z-50 p-4 bg-slate-950 text-white rounded-full shadow-2xl active:scale-95 transition-transform">
        {isSidebarOpen ? <X /> : <Menu />}
      </button>

      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 xl:hidden" onClick={() => setIsSidebarOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 w-80 bg-slate-950 text-white flex flex-col z-50 shadow-2xl transition-transform duration-300 xl:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-xl shadow-indigo-500/20">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight">SEO Master</h1>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Suite Pro</p>
            </div>
          </div>

          <nav className="space-y-1 mb-8">
            <SidebarLink active={activeTab === DashboardTab.ORGANIC_VS_PAID} onClick={() => {setActiveTab(DashboardTab.ORGANIC_VS_PAID); setIsSidebarOpen(false);}} icon={<Layers />} label="Organic vs Paid" />
            <SidebarLink active={activeTab === DashboardTab.SEO_BY_COUNTRY} onClick={() => {setActiveTab(DashboardTab.SEO_BY_COUNTRY); setIsSidebarOpen(false);}} icon={<Globe />} label="Performance País" />
            <SidebarLink active={activeTab === DashboardTab.KEYWORD_DEEP_DIVE} onClick={() => {setActiveTab(DashboardTab.KEYWORD_DEEP_DIVE); setIsSidebarOpen(false);}} icon={<Target />} label="Análisis SEO Deep" />
          </nav>

          <div className="space-y-6">
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-3 text-indigo-400">
                <Settings2 className="w-3.5 h-3.5" />
                <h4 className="text-[9px] font-black uppercase tracking-widest">Configuración SEO</h4>
              </div>
              <div>
                <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest block mb-1">Branded Regex</label>
                <input type="text" value={brandRegexStr} onChange={e => setBrandRegexStr(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg text-[10px] p-2 focus:ring-1 ring-indigo-500 outline-none" placeholder="brand|tienda" />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/5 bg-slate-950">
           <div className="bg-white/5 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-6">
                <img src={user.picture} className="w-9 h-9 rounded-full border-2 border-indigo-500" alt="user" />
                <div className="truncate">
                   <p className="text-[11px] font-black truncate">{user.name}</p>
                   <p className="text-[9px] text-slate-500 truncate">{user.email}</p>
                </div>
              </div>
              <div className="space-y-4">
                 <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest block">GA4 Property</label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 w-3 h-3 text-slate-600" />
                      <input type="text" placeholder="Buscar propiedad..." value={ga4Search} onChange={e => setGa4Search(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg text-[10px] pl-8 p-2 outline-none mb-1" />
                    </div>
                    {ga4Auth?.token ? (
                       <select className="w-full bg-slate-900 border border-white/10 rounded-lg text-[10px] p-2 outline-none cursor-pointer" value={ga4Auth.property?.id || ''} onChange={e => {
                         const selected = availableProperties.find(p => p.id === e.target.value) || null;
                         const updated = {...ga4Auth, property: selected};
                         setGa4Auth(updated);
                         sessionStorage.setItem('ga4_auth', JSON.stringify(updated));
                       }}>
                         {filteredProperties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                       </select>
                    ) : (
                       <button onClick={() => tokenClientGa4.current?.requestAccessToken()} className="w-full py-2 bg-indigo-600/20 text-indigo-400 text-[8px] font-black uppercase rounded-lg border border-indigo-600/30 hover:bg-indigo-600 hover:text-white transition-all">Conectar GA4</button>
                    )}
                 </div>

                 <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest block">GSC Domain</label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 w-3 h-3 text-slate-600" />
                      <input type="text" placeholder="Buscar sitio..." value={gscSearch} onChange={e => setGscSearch(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg text-[10px] pl-8 p-2 outline-none mb-1" />
                    </div>
                    {gscAuth?.token ? (
                       <select className="w-full bg-slate-900 border border-white/10 rounded-lg text-[10px] p-2 outline-none cursor-pointer" value={gscAuth.site?.siteUrl || ''} onChange={e => {
                         const selected = availableSites.find(s => s.siteUrl === e.target.value) || null;
                         const updated = {...gscAuth, site: selected};
                         setGscAuth(updated);
                         sessionStorage.setItem('gsc_auth', JSON.stringify(updated));
                       }}>
                         {filteredSites.map(s => <option key={s.siteUrl} value={s.siteUrl}>{s.siteUrl}</option>)}
                       </select>
                    ) : (
                       <button onClick={() => tokenClientGsc.current?.requestAccessToken()} className="w-full py-2 bg-emerald-600/20 text-emerald-400 text-[8px] font-black uppercase rounded-lg border border-emerald-600/30 hover:bg-emerald-600 hover:text-white transition-all">Conectar GSC</button>
                    )}
                 </div>
              </div>
              <button onClick={handleLogout} className="w-full mt-6 py-2 text-[9px] font-black text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-2">
                <LogOut className="w-3 h-3" /> Cerrar Sesión
              </button>
           </div>
        </div>
      </aside>

      <main className="flex-1 xl:ml-80 p-5 md:p-8 xl:p-12 transition-all overflow-x-hidden">
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full ${isAnythingLoading ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                {isLoadingGa4 ? 'Cargando GA4...' : isLoadingGsc ? 'Cargando GSC...' : 'Dashboard Activo'}
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter break-words">
              {activeTab === DashboardTab.ORGANIC_VS_PAID && "Organic vs Paid Performance"}
              {activeTab === DashboardTab.SEO_BY_COUNTRY && "SEO Performance por País"}
              {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && "Análisis por URL & Keywords"}
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 bg-white p-1.5 rounded-3xl border border-slate-200 shadow-sm w-full xl:w-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 border-b sm:border-b-0 sm:border-r border-slate-100 min-w-0">
               <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
               <div className="flex items-center gap-1.5 text-[10px] font-bold overflow-hidden">
                  <input type="date" value={filters.dateRange.start} onChange={e => setFilters({...filters, dateRange: {...filters.dateRange, start: e.target.value}})} className="outline-none bg-transparent" />
                  <span className="text-slate-300">/</span>
                  <input type="date" value={filters.dateRange.end} onChange={e => setFilters({...filters, dateRange: {...filters.dateRange, end: e.target.value}})} className="outline-none bg-transparent" />
               </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 border-b sm:border-b-0 sm:border-r border-slate-100">
               <Globe className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
               <select className="bg-transparent text-[10px] font-black uppercase outline-none cursor-pointer w-full" value={filters.country} onChange={e => setFilters({...filters, country: e.target.value})}>
                  <option value="All">Todos Países</option>
                  {Array.from(new Set([...realDailyData.map(d => d.country), ...realKeywordData.map(k => k.country)])).filter(Boolean).sort().map(c => <option key={c} value={c}>{c}</option>)}
               </select>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 border-b sm:border-b-0 sm:border-r border-slate-100">
               <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
               <select className="bg-transparent text-[10px] font-black uppercase outline-none cursor-pointer w-full" value={filters.channelGroup} onChange={e => setFilters({...filters, channelGroup: e.target.value})}>
                  <option value="All">Todos Canales</option>
                  {uniqueChannelGroups.map(cg => <option key={cg} value={cg}>{cg}</option>)}
               </select>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5">
               <Tag className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
               <select className="bg-transparent text-[10px] font-black uppercase outline-none cursor-pointer w-full" value={filters.queryType} onChange={e => setFilters({...filters, queryType: e.target.value as any})}>
                  <option value="All">Tipo Query</option>
                  <option value="Branded">Branded</option>
                  <option value="Non-Branded">Non-Branded</option>
               </select>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-8 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 shadow-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="font-bold text-xs">{error}</p>
          </div>
        )}

        {aiInsights && (
          <div className="mb-10 bg-indigo-600 rounded-[32px] p-8 md:p-10 text-white shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-xl"><Sparkles className="w-5 h-5" /></div>
                <h3 className="text-xl font-black">Análisis Estratégico</h3>
              </div>
              <button onClick={() => setAiInsights(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="prose prose-invert max-w-none relative z-10 font-medium text-sm md:text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: aiInsights.replace(/\n/g, '<br/>') }} />
          </div>
        )}

        <div className="w-full overflow-x-hidden">
          {activeTab === DashboardTab.ORGANIC_VS_PAID && <OrganicVsPaidView stats={channelStats} data={filteredDailyData} />}
          {activeTab === DashboardTab.SEO_BY_COUNTRY && <SeoMarketplaceView data={filteredDailyData} keywordData={filteredKeywordData} aggregate={aggregate} />}
          {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && <SeoDeepDiveView keywords={filteredKeywordData} searchTerm={searchTerm} setSearchTerm={setSearchTerm} isLoading={isAnythingLoading} />}
        </div>

        <div className="mt-12 flex justify-center pb-12">
          <button 
            onClick={handleGenerateInsights}
            disabled={loadingInsights || isAnythingLoading || (realDailyData.length === 0 && realKeywordData.length === 0)}
            className="flex items-center gap-3 px-10 py-4 bg-slate-950 text-white rounded-3xl text-xs font-black shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
          >
            {loadingInsights ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generar Reporte IA
          </button>
        </div>
      </main>
    </div>
  );
};

const OrganicVsPaidView = ({ stats, data }: any) => {
  const chartData = useMemo(() => {
    if (!data.length) return [];
    const map: any = {};
    data.forEach((d: any) => {
      if (!map[d.date]) map[d.date] = { date: d.date, organic: 0, paid: 0 };
      if (d.channel.includes('Organic Search')) map[d.date].organic += d.sessions;
      else if (d.channel.includes('Paid Search')) map[d.date].paid += d.sessions;
    });
    return Object.values(map).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [data]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-[9px]">ORG</div>
            <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Organic Overview</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <KpiCard title="Sesiones" value={stats.organic.sessions} icon={<TrendingUp />} />
            <KpiCard title="Conv. Rate" value={`${stats.organic.cr.toFixed(2)}%`} icon={<Percent />} isPercent />
            <KpiCard title="Revenue" value={`€${stats.organic.revenue.toLocaleString()}`} icon={<Tag />} color="emerald" />
            <KpiCard title="Ventas" value={stats.organic.sales} icon={<ShoppingBag />} color="emerald" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center text-white font-bold text-[9px]">PAID</div>
            <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Paid Overview</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <KpiCard title="Sesiones" value={stats.paid.sessions} icon={<TrendingUp />} color="amber" />
            <KpiCard title="Conv. Rate" value={`${stats.paid.cr.toFixed(2)}%`} icon={<Percent />} color="amber" isPercent />
            <KpiCard title="Revenue" value={`€${stats.paid.revenue.toLocaleString()}`} icon={<Tag />} color="rose" />
            <KpiCard title="Ventas" value={stats.paid.sales} icon={<ShoppingBag />} color="rose" />
          </div>
        </div>
      </div>
      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm h-[350px]">
        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-8">Evolución de Canales</h4>
        {chartData.length > 0 ? (
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
  const seoGa4 = aggregate(data.filter((d: any) => d.channel.includes('Organic Search')));
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

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard title="Impresiones GSC" value={gscStats.impressions} icon={<Eye />} />
        <KpiCard title="Clicks GSC" value={gscStats.clicks} icon={<MousePointer2 />} />
        <KpiCard title="CTR GSC" value={`${(gscStats.impressions > 0 ? (gscStats.clicks / gscStats.impressions) * 100 : 0).toFixed(2)}%`} icon={<Percent />} />
        <KpiCard title="CR GA4" value={`${seoGa4.cr.toFixed(2)}%`} icon={<TrendingUp />} color="emerald" />
        <KpiCard title="Revenue GA4" value={`€${seoGa4.revenue.toLocaleString()}`} icon={<Tag />} color="emerald" />
        <KpiCard title="Sales GA4" value={seoGa4.sales} icon={<ShoppingBag />} color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm h-[400px]">
           <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-8">Clicks por Mercado</h4>
           {countryStats.length > 0 ? (
             <ResponsiveContainer width="100%" height="85%">
                <BarChart data={countryStats}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="country" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="clicks" name="Clicks" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
             </ResponsiveContainer>
           ) : <EmptyState text="Sin datos geográficos" />}
        </div>
        <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm h-[400px]">
           <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-8">Visibilidad Total</h4>
           {countryStats.length > 0 ? (
             <ResponsiveContainer width="100%" height="85%">
                <BarChart data={countryStats}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="country" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="impressions" name="Impresiones" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                </BarChart>
             </ResponsiveContainer>
           ) : <EmptyState text="Sin datos de visibilidad" />}
        </div>
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
      url: string; clicks: number; impressions: number; children: Record<string, KeywordData>;
    }> = {};
    
    keywords.forEach((k: KeywordData) => {
      const url = k.landingPage;
      if (!map[url]) map[url] = { url, clicks: 0, impressions: 0, children: {} };
      map[url].clicks += k.clicks;
      map[url].impressions += k.impressions;
      if (!map[url].children[k.keyword]) map[url].children[k.keyword] = { ...k };
      else {
        map[url].children[k.keyword].clicks += k.clicks;
        map[url].children[k.keyword].impressions += k.impressions;
      }
    });

    return Object.values(map).map(page => ({
      ...page,
      ctr: page.impressions > 0 ? (page.clicks / page.impressions) * 100 : 0,
      children: Object.values(page.children).sort((a,b) => b.clicks - a.clicks)
    }))
    .filter(p => p.url.toLowerCase().includes(searchTerm.toLowerCase()) || p.children.some(c => c.keyword.toLowerCase().includes(searchTerm.toLowerCase())))
    .sort((a, b) => b.clicks - a.clicks);
  }, [keywords, searchTerm]);

  return (
    <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50">
        <div className="w-full">
           <h3 className="text-xl font-black mb-1">Deep Dive SEO</h3>
           <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Agrupación por URL y Queries</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input type="text" placeholder="URL o Palabra Clave..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-medium focus:ring-2 ring-indigo-500/10 outline-none shadow-sm" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[9px] tracking-widest border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 w-10"></th>
              <th className="px-4 py-4">URL</th>
              <th className="px-6 py-4 text-center">Impr.</th>
              <th className="px-6 py-4 text-center">Clicks</th>
              <th className="px-6 py-4 text-center">CTR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {aggregatedByUrl.slice(0, 40).map((row, i) => {
              const isExpanded = expandedUrls.has(row.url);
              return (
                <React.Fragment key={row.url}>
                  <tr onClick={() => toggleUrl(row.url)} className={`group cursor-pointer transition-all ${isExpanded ? 'bg-indigo-50/30' : 'hover:bg-slate-50/50'}`}>
                    <td className="pl-6 py-4">
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-indigo-600" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                        <span className="font-bold text-slate-900 truncate max-w-[200px] md:max-w-[400px]">{row.url}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">{row.impressions.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center font-black">{row.clicks.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full font-black ${row.ctr > 3 ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 bg-slate-100'}`}>{row.ctr.toFixed(1)}%</span>
                    </td>
                  </tr>
                  {isExpanded && row.children.map((child, ci) => (
                    <tr key={ci} className="bg-white/50 border-l-2 border-indigo-500 animate-in slide-in-from-left-1">
                      <td className="py-2"></td>
                      <td className="px-4 py-2 pl-12">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-600 font-medium">{child.keyword}</span>
                          <span className={`px-1.5 py-0.5 rounded-[4px] text-[7px] font-black uppercase ${child.queryType === 'Branded' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>{child.queryType}</span>
                        </div>
                      </td>
                      <td className="px-6 py-2 text-center text-slate-400">{child.impressions.toLocaleString()}</td>
                      <td className="px-6 py-2 text-center text-slate-600 font-bold">{child.clicks.toLocaleString()}</td>
                      <td className="px-6 py-2 text-center text-slate-400">{child.ctr.toFixed(1)}%</td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
            {aggregatedByUrl.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-16 text-center text-slate-400 italic font-medium">{isLoading ? "Sincronizando..." : "No se encontraron URLs"}</td></tr>
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
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black transition-all ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 translate-x-1' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
  >
    {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-4 h-4' })}
    {label}
  </button>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="h-full flex items-center justify-center">
    <div className="text-center p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
      <Activity className="w-6 h-6 text-slate-200 mx-auto mb-3" />
      <p className="text-slate-400 italic text-[10px] font-medium">{text}</p>
    </div>
  </div>
);

export default App;
