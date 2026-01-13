
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  BarChart3, Search, Calendar, ArrowUpRight, ArrowDownRight, TrendingUp, Sparkles, Globe, Tag, MousePointer2, Eye, Percent, ShoppingBag, LogOut, RefreshCw, CheckCircle2, Layers, Activity, Filter, ArrowRight, Target, FileText, AlertCircle, Settings2, Info, Menu, X, ChevronDown, ChevronRight, ExternalLink, HardDrive, Clock, TrendingDown, Map as MapIcon
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Legend, LineChart, Line, ScatterChart, Scatter, ZAxis, Cell
} from 'recharts';
import { DashboardTab, DashboardFilters, DailyData, KeywordData, Ga4Property, GscSite, QueryType, ChannelType } from './types';
import { getDashboardInsights } from './geminiService';
import GoogleLogin from './GoogleLogin'; 

const CLIENT_ID = "333322783684-pjhn2omejhngckfd46g8bh2dng9dghlc.apps.googleusercontent.com"; 
const SCOPE_GA4 = "https://www.googleapis.com/auth/analytics.readonly";
const SCOPE_GSC = "https://www.googleapis.com/auth/webmasters.readonly";

const countryMap: Record<string, string> = {
  'esp': 'Spain', 'mex': 'Mexico', 'usa': 'United States', 'gbr': 'United Kingdom',
  'fra': 'France', 'deu': 'Germany', 'ita': 'Italy', 'prt': 'Portugal',
  'spain': 'Spain', 'mexico': 'Mexico', 'united states': 'United States', 'united kingdom': 'United Kingdom',
  'france': 'France', 'germany': 'Germany', 'italy': 'Italy', 'portugal': 'Portugal'
};

const normalizeCountryName = (name: string): string => {
  const normalized = name.toLowerCase().trim();
  return countryMap[normalized] || name;
};

const PRIORITY_DIMENSIONS = [
  'sessionDefaultChannelGroup',
  'sessionSource',
  'sessionMedium',
  'sessionSourceMedium',
  'sessionCampaignName',
  'sessionSourcePlatform'
];

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

const KpiCard: React.FC<{ 
  title: string; 
  value: string | number; 
  comparison?: number; 
  absoluteChange?: number;
  icon: React.ReactNode; 
  color?: string; 
  isPercent?: boolean;
  prefix?: string;
}> = ({ title, value, comparison, absoluteChange, icon, color = "indigo", isPercent = false, prefix = "" }) => (
  <div className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm hover:shadow-md transition-all group">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 bg-${color}-50 text-${color}-600 rounded-2xl group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      {comparison !== undefined && !isNaN(comparison) && (
        <div className="text-right">
          <div className={`flex items-center text-[10px] font-bold px-2 py-1 rounded-full ${comparison >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {comparison >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
            {Math.abs(comparison).toFixed(1)}%
          </div>
        </div>
      )}
    </div>
    <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.15em] mb-1">{title}</p>
    <h3 className="text-xl font-black text-slate-900 tracking-tight truncate">
      {prefix}{typeof value === 'number' && !isPercent ? value.toLocaleString() : value}
    </h3>
  </div>
);

const App: React.FC = () => {
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
  const [availableDimensions, setAvailableDimensions] = useState<{ label: string; value: string }[]>([]);
  const [ga4Search, setGa4Search] = useState('');
  const [gscSearch, setGscSearch] = useState('');
  const [realDailyData, setRealDailyData] = useState<DailyData[]>([]);
  const [realKeywordData, setRealKeywordData] = useState<KeywordData[]>([]);
  const [isLoadingGa4, setIsLoadingGa4] = useState(false);
  const [isLoadingGsc, setIsLoadingGsc] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [brandRegexStr, setBrandRegexStr] = useState('tienda|deportes|pro|brandname');
  const [grouping, setGrouping] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [activeTab, setActiveTab] = useState<DashboardTab>(DashboardTab.ORGANIC_VS_PAID);
  const [filters, setFilters] = useState<DashboardFilters>({
    dateRange: { 
      start: formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)), 
      end: formatDate(new Date()) 
    },
    comparison: { enabled: false, type: 'previous_period' },
    country: 'All',
    queryType: 'All',
    ga4Dimension: 'sessionDefaultChannelGroup'
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

  const getComparisonDates = () => {
    const start = new Date(filters.dateRange.start);
    const end = new Date(filters.dateRange.end);
    const diff = end.getTime() - start.getTime();
    if (filters.comparison.type === 'previous_period') {
      const compStart = new Date(start.getTime() - diff - 86400000);
      const compEnd = new Date(start.getTime() - 86400000);
      return { start: formatDate(compStart), end: formatDate(compEnd) };
    } else {
      const compStart = new Date(start); compStart.setFullYear(compStart.getFullYear() - 1);
      const compEnd = new Date(end); compEnd.setFullYear(compEnd.getFullYear() - 1);
      return { start: formatDate(compStart), end: formatDate(compEnd) };
    }
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
      if (props.length > 0 && !ga4Auth?.property) setGa4Auth({ token, property: props[0] });
    } catch (e) { setError("Error conectando con GA4 Admin API."); }
  };

  const fetchGa4Metadata = async (token: string, propertyId: string) => {
    try {
      const resp = await fetch(`https://analyticsdata.googleapis.com/v1beta/${propertyId}/metadata`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) return;
      const data = await resp.json();
      const filtered = (data.dimensions || []).filter((d: any) => {
        const apiName = d.apiName.toLowerCase();
        const noise = ['year', 'week', 'month', 'day', 'hour', 'minute', 'isconversion', 'ordertoken', 'creativeid', 'adgroupid'];
        if (noise.some(n => apiName.includes(n))) return false;
        const relevant = ['session', 'source', 'medium', 'channel', 'campaign', 'country', 'region', 'page', 'landing', 'device'];
        return relevant.some(r => apiName.includes(r));
      });
      const mapped = filtered.map((d: any) => ({ label: d.uiName || d.apiName, value: d.apiName }));
      const sorted = mapped.sort((a: any, b: any) => {
        const aIndex = PRIORITY_DIMENSIONS.indexOf(a.value);
        const bIndex = PRIORITY_DIMENSIONS.indexOf(b.value);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.label.localeCompare(b.label);
      });
      if (sorted.length > 0) setAvailableDimensions(sorted);
    } catch (e) { console.error("Error fetching metadata:", e); }
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
      if (sites.length > 0 && !gscAuth?.site) setGscAuth({ token, site: sites[0] });
    } catch (e) { setError("Error conectando con Search Console API."); }
  };

  const fetchGa4Data = async () => {
    if (!ga4Auth?.property || !ga4Auth.token) return;
    setIsLoadingGa4(true);
    try {
      const dateRanges = [{ startDate: filters.dateRange.start, endDate: filters.dateRange.end }];
      if (filters.comparison.enabled) {
        const comp = getComparisonDates();
        dateRanges.push({ startDate: comp.start, endDate: comp.end });
      }
      const ga4ReportResp = await fetch(`https://analyticsdata.googleapis.com/v1beta/${ga4Auth.property.id}:runReport`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ga4Auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges,
          dimensions: [{ name: 'date' }, { name: filters.ga4Dimension }, { name: 'country' }, { name: 'landingPage' }],
          metrics: [{ name: 'sessions' }, { name: 'totalRevenue' }, { name: 'transactions' }, { name: 'sessionConversionRate' }]
        })
      });
      const ga4Data = await ga4ReportResp.json();
      if (ga4Data.error) throw new Error(ga4Data.error.message);
      const dailyMapped: DailyData[] = (ga4Data.rows || []).map((row: any) => ({
        date: `${row.dimensionValues[0].value.slice(0,4)}-${row.dimensionValues[0].value.slice(4,6)}-${row.dimensionValues[0].value.slice(6,8)}`,
        channel: row.dimensionValues[1].value,
        country: normalizeCountryName(row.dimensionValues[2].value),
        queryType: 'Non-Branded' as QueryType,
        landingPage: row.dimensionValues[3].value,
        dateRangeLabel: row.dimensionValues.length > 4 && row.dimensionValues[4].value === 'date_range_1' ? 'previous' : 'current',
        sessions: parseInt(row.metricValues[0].value) || 0,
        revenue: parseFloat(row.metricValues[1].value) || 0,
        sales: parseInt(row.metricValues[2].value) || 0,
        conversionRate: (parseFloat(row.metricValues[3].value) || 0) * 100,
        clicks: 0, impressions: 0, ctr: 0
      }));
      setRealDailyData(dailyMapped);
    } catch (err: any) { setError(`Error GA4: ${err.message}`); } finally { setIsLoadingGa4(false); }
  };

  const fetchGscData = async () => {
    if (!gscAuth?.site || !gscAuth.token) return;
    setIsLoadingGsc(true);
    try {
      const siteUrl = encodeURIComponent(gscAuth.site.siteUrl);
      const fetchOneRange = async (start: string, end: string, label: 'current' | 'previous') => {
        const resp = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/searchAnalytics/query`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${gscAuth.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate: start, endDate: end, dimensions: ['query', 'page', 'country', 'date'], rowLimit: 5000
          })
        });
        const data = await resp.json();
        if (data.error) throw new Error(data.error.message);
        return (data.rows || []).map((row: any) => ({
          keyword: row.keys[0], landingPage: row.keys[1],
          country: normalizeCountryName(row.keys[2]),
          queryType: 'Non-Branded' as QueryType,
          date: row.keys[3], dateRangeLabel: label,
          clicks: row.clicks, impressions: row.impressions,
          ctr: row.ctr * 100, sessions: 0, conversionRate: 0, revenue: 0, sales: 0
        }));
      };
      let combined: KeywordData[] = await fetchOneRange(filters.dateRange.start, filters.dateRange.end, 'current');
      if (filters.comparison.enabled) {
        const comp = getComparisonDates();
        const prev = await fetchOneRange(comp.start, comp.end, 'previous');
        combined = [...combined, ...prev];
      }
      setRealKeywordData(combined);
    } catch (err: any) { setError(`Error GSC: ${err.message}`); } finally { setIsLoadingGsc(false); }
  };

  useEffect(() => {
    const initializeOAuth = () => {
      if (typeof window !== 'undefined' && (window as any).google && (window as any).google.accounts) {
        tokenClientGa4.current = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID, scope: SCOPE_GA4, prompt: '',
          callback: (resp: any) => {
            if (resp.access_token) {
              const newAuth = { token: resp.access_token, property: ga4Auth?.property || null };
              setGa4Auth(newAuth); sessionStorage.setItem('ga4_auth', JSON.stringify(newAuth));
              fetchGa4Properties(resp.access_token);
            }
          },
        });
        tokenClientGsc.current = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID, scope: SCOPE_GSC, prompt: '',
          callback: (resp: any) => {
            if (resp.access_token) {
              const newAuth = { token: resp.access_token, site: gscAuth?.site || null };
              setGscAuth(newAuth); sessionStorage.setItem('gsc_auth', JSON.stringify(newAuth));
              fetchGscSites(resp.access_token);
            }
          },
        });
        if (ga4Auth?.token) fetchGa4Properties(ga4Auth.token);
        if (gscAuth?.token) fetchGscSites(gscAuth.token);
      } else { setTimeout(initializeOAuth, 500); }
    };
    initializeOAuth();
  }, []);

  const handleLoginSuccess = (credentialToken: string) => {
    const base64Url = credentialToken.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(base64));
    const newUser = { name: decoded.name, email: decoded.email, picture: decoded.picture };
    setUser(newUser); localStorage.setItem('seo_suite_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setUser(null); setGa4Auth(null); setGscAuth(null);
    localStorage.removeItem('seo_suite_user');
    sessionStorage.removeItem('ga4_auth'); sessionStorage.removeItem('gsc_auth');
  };

  useEffect(() => { 
    if (ga4Auth?.token && ga4Auth.property) {
      fetchGa4Data(); fetchGa4Metadata(ga4Auth.token, ga4Auth.property.id);
    } 
  }, [ga4Auth?.property?.id, filters.dateRange, filters.ga4Dimension, filters.comparison.enabled, filters.comparison.type]);

  useEffect(() => { 
    if (gscAuth?.token && gscAuth.site) fetchGscData(); 
  }, [gscAuth?.site?.siteUrl, filters.dateRange, filters.comparison.enabled, filters.comparison.type]);

  const filteredDailyData = useMemo(() => {
    return realDailyData.filter(d => {
      const isBrandedVal = isBranded(d.landingPage || '');
      const queryTypeActual = isBrandedVal ? 'Branded' : 'Non-Branded';
      const countryMatch = filters.country === 'All' || d.country === filters.country;
      const queryMatch = filters.queryType === 'All' || queryTypeActual === filters.queryType;
      return countryMatch && queryMatch;
    }).map(d => ({ ...d, queryType: (isBranded(d.landingPage || '') ? 'Branded' : 'Non-Branded') as QueryType }));
  }, [realDailyData, filters, brandRegexStr]);

  const filteredKeywordData = useMemo(() => {
    return realKeywordData.filter(k => {
      const isBrandedVal = isBranded(k.keyword);
      const queryTypeActual = isBrandedVal ? 'Branded' : 'Non-Branded';
      const countryMatch = filters.country === 'All' || k.country === filters.country;
      const queryMatch = filters.queryType === 'All' || queryTypeActual === filters.queryType;
      return countryMatch && queryMatch;
    }).map(k => ({ ...k, queryType: (isBranded(k.keyword) ? 'Branded' : 'Non-Branded') as QueryType }));
  }, [realKeywordData, filters, brandRegexStr]);

  const aggregateMetrics = (data: DailyData[]) => {
    const currentData = data.filter(d => d.dateRangeLabel === 'current');
    const prevData = data.filter(d => d.dateRangeLabel === 'previous');
    const sum = (arr: DailyData[]) => arr.reduce((acc, curr) => ({
      sessions: acc.sessions + curr.sessions, sales: acc.sales + curr.sales, revenue: acc.revenue + curr.revenue,
    }), { sessions: 0, sales: 0, revenue: 0 });
    const currSum = sum(currentData); const prevSum = sum(prevData);
    const getChange = (curr: number, prev: number) => prev === 0 ? 0 : ((curr - prev) / prev) * 100;
    return { 
      current: { ...currSum, cr: currSum.sessions > 0 ? (currSum.sales / currSum.sessions) * 100 : 0 },
      previous: { ...prevSum, cr: prevSum.sessions > 0 ? (prevSum.sales / prevSum.sessions) * 100 : 0 },
      changes: {
        sessions: getChange(currSum.sessions, prevSum.sessions), sales: getChange(currSum.sales, prevSum.sales),
        revenue: getChange(currSum.revenue, prevSum.revenue),
        cr: getChange(currSum.sales / (currSum.sessions || 1), prevSum.sales / (prevSum.sessions || 1))
      },
      abs: { sessions: currSum.sessions - prevSum.sessions, sales: currSum.sales - prevSum.sales, revenue: currSum.revenue - prevSum.revenue }
    };
  };

  const channelStats = useMemo(() => {
    const organic = aggregateMetrics(filteredDailyData.filter(d => d.channel.toLowerCase().includes('organic')));
    const paid = aggregateMetrics(filteredDailyData.filter(d => d.channel.toLowerCase().includes('paid') || d.channel.toLowerCase().includes('cpc')));
    return { organic, paid };
  }, [filteredDailyData]);

  const handleGenerateInsights = async () => {
    setLoadingInsights(true);
    try {
      const summary = `GA4 Sessions: ${filteredDailyData.reduce((a,b)=>a+b.sessions,0)}. GSC Clicks: ${filteredKeywordData.reduce((a,b)=>a+b.clicks,0)}.`;
      const insights = await getDashboardInsights(summary, activeTab);
      setAiInsights(insights);
    } catch (err) { console.error(err); } finally { setLoadingInsights(false); }
  };

  if (!user) {
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
          <p className="text-slate-400 font-medium mb-10 text-lg">Inicia sesión con Google para acceder al dashboard.</p>
          <div className="flex justify-center w-full"><GoogleLogin onLoginSuccess={handleLoginSuccess} /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col md:flex-row">
      <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="xl:hidden fixed bottom-6 right-6 z-50 p-4 bg-slate-950 text-white rounded-full shadow-2xl active:scale-95 transition-transform">
        {isSidebarOpen ? <X /> : <Menu />}
      </button>

      <aside className={`fixed inset-y-0 left-0 w-80 bg-slate-950 text-white flex flex-col z-50 shadow-2xl transition-transform duration-300 xl:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-xl shadow-indigo-500/20"><Activity className="w-6 h-6" /></div>
            <div><h1 className="text-lg font-black tracking-tight">SEO Master</h1><p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Suite Pro</p></div>
          </div>
          <nav className="space-y-1 mb-8">
            <SidebarLink active={activeTab === DashboardTab.ORGANIC_VS_PAID} onClick={() => setActiveTab(DashboardTab.ORGANIC_VS_PAID)} icon={<Layers />} label="Organic vs Paid" />
            <SidebarLink active={activeTab === DashboardTab.SEO_BY_COUNTRY} onClick={() => setActiveTab(DashboardTab.SEO_BY_COUNTRY)} icon={<Globe />} label="Performance País" />
            <SidebarLink active={activeTab === DashboardTab.KEYWORD_DEEP_DIVE} onClick={() => setActiveTab(DashboardTab.KEYWORD_DEEP_DIVE)} icon={<Target />} label="Análisis SEO Deep" />
          </nav>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-3 text-indigo-400"><Settings2 className="w-3.5 h-3.5" /><h4 className="text-[9px] font-black uppercase tracking-widest">Configuración SEO</h4></div>
            <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest block mb-1">Branded Regex</label>
            <input type="text" value={brandRegexStr} onChange={e => setBrandRegexStr(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg text-[10px] p-2 outline-none focus:ring-1 ring-indigo-500" />
          </div>
        </div>
        <div className="p-6 border-t border-white/5 bg-slate-950">
          <div className="flex items-center gap-3 mb-6">
            <img src={user.picture} className="w-9 h-9 rounded-full border-2 border-indigo-500" alt="user" />
            <div className="truncate"><p className="text-[11px] font-black truncate">{user.name}</p><p className="text-[9px] text-slate-500 truncate">{user.email}</p></div>
          </div>
          <button onClick={handleLogout} className="w-full py-2 text-[9px] font-black text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-2"><LogOut className="w-3 h-3" /> Cerrar Sesión</button>
        </div>
      </aside>

      <main className="flex-1 xl:ml-80 p-5 md:p-8 xl:p-12 transition-all">
        <header className="flex flex-col gap-6 mb-10">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${isLoadingGa4 || isLoadingGsc ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dashboard Activo</span>
              </div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
                {activeTab === DashboardTab.ORGANIC_VS_PAID ? "Organic vs Paid Performance" : activeTab === DashboardTab.SEO_BY_COUNTRY ? "SEO Performance País" : "Keywords Deep Dive"}
              </h2>
            </div>
            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
              <input type="checkbox" id="comp_enabled" checked={filters.comparison.enabled} onChange={e => setFilters({...filters, comparison: {...filters.comparison, enabled: e.target.checked}})} className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600" />
              <label htmlFor="comp_enabled" className="text-[10px] font-black uppercase text-slate-600 cursor-pointer">Comparar</label>
              {filters.comparison.enabled && (
                <select className="bg-transparent text-[10px] font-bold text-indigo-600 outline-none" value={filters.comparison.type} onChange={e => setFilters({...filters, comparison: {...filters.comparison, type: e.target.value as any}})}>
                  <option value="previous_period">vs Periodo Anterior</option>
                  <option value="previous_year">vs Año Anterior</option>
                </select>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 bg-white p-1.5 rounded-3xl border border-slate-200 shadow-sm w-max">
            <div className="flex items-center gap-2 px-3 py-1.5 border-r border-slate-100">
               <Calendar className="w-3.5 h-3.5 text-slate-400" />
               <input type="date" value={filters.dateRange.start} onChange={e => setFilters({...filters, dateRange: {...filters.dateRange, start: e.target.value}})} className="outline-none bg-transparent text-[10px] font-bold" />
               <span className="text-slate-300">/</span>
               <input type="date" value={filters.dateRange.end} onChange={e => setFilters({...filters, dateRange: {...filters.dateRange, end: e.target.value}})} className="outline-none bg-transparent text-[10px] font-bold" />
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5">
               <Globe className="w-3.5 h-3.5 text-slate-400" />
               <select className="bg-transparent text-[10px] font-black uppercase outline-none" value={filters.country} onChange={e => setFilters({...filters, country: e.target.value})}>
                  <option value="All">Todos Países</option>
                  {Array.from(new Set([...realDailyData.map(d => d.country), ...realKeywordData.map(k => k.country)])).filter(Boolean).sort().map(c => <option key={c} value={c}>{c}</option>)}
               </select>
            </div>
          </div>
        </header>

        {aiInsights && (
          <div className="mb-10 bg-indigo-600 rounded-[32px] p-8 text-white shadow-2xl animate-in fade-in zoom-in-95 duration-500">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3"><Sparkles className="w-5 h-5" /><h3 className="text-xl font-black">Análisis Estratégico AI</h3></div>
              <button onClick={() => setAiInsights(null)} className="p-2 hover:bg-white/10 rounded-full"><X className="w-4 h-4" /></button>
            </div>
            <div className="prose prose-invert max-w-none font-medium text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: aiInsights.replace(/\n/g, '<br/>') }} />
          </div>
        )}

        {activeTab === DashboardTab.ORGANIC_VS_PAID && <OrganicVsPaidView stats={channelStats} data={filteredDailyData} comparisonEnabled={filters.comparison.enabled} grouping={grouping} setGrouping={setGrouping} />}
        {activeTab === DashboardTab.SEO_BY_COUNTRY && <SeoPerformanceCountryView data={filteredDailyData} keywordData={filteredKeywordData} comparisonEnabled={filters.comparison.enabled} />}
        {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && <SeoDeepDiveView keywords={filteredKeywordData} searchTerm={searchTerm} setSearchTerm={setSearchTerm} isLoading={isLoadingGa4 || isLoadingGsc} comparisonEnabled={filters.comparison.enabled} />}

        <div className="mt-12 flex justify-center pb-12">
          <button onClick={handleGenerateInsights} disabled={loadingInsights} className="flex items-center gap-3 px-10 py-4 bg-slate-950 text-white rounded-3xl text-xs font-black shadow-2xl hover:scale-105 transition-all">
            {loadingInsights ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generar Reporte IA
          </button>
        </div>
      </main>
    </div>
  );
};

const OrganicVsPaidView = ({ stats, data, comparisonEnabled, grouping, setGrouping }: any) => {
  const chartData = useMemo(() => {
    if (!data.length) return [];
    const currentData = data.filter((d: any) => d.dateRangeLabel === 'current');
    const map: any = {};
    currentData.forEach((d: any) => {
      const isOrg = d.channel.toLowerCase().includes('organic');
      const isPaid = d.channel.toLowerCase().includes('paid') || d.channel.toLowerCase().includes('cpc');
      if (!isOrg && !isPaid) return;
      let key = d.date;
      if (grouping === 'weekly') key = formatDate(getStartOfWeek(new Date(d.date)));
      else if (grouping === 'monthly') key = `${d.date.slice(0, 7)}-01`;
      if (!map[key]) map[key] = { date: key, organic: 0, paid: 0, organicRevenue: 0, paidRevenue: 0 };
      if (isOrg) { map[key].organic += d.sessions; map[key].organicRevenue += d.revenue; }
      if (isPaid) { map[key].paid += d.sessions; map[key].paidRevenue += d.revenue; }
    });
    return Object.values(map).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [data, grouping]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="grid grid-cols-2 gap-3">
          <KpiCard title="Org. Sessions" value={stats.organic.current.sessions} comparison={comparisonEnabled ? stats.organic.changes.sessions : undefined} icon={<TrendingUp />} />
          <KpiCard title="Org. Revenue" value={stats.organic.current.revenue} comparison={comparisonEnabled ? stats.organic.changes.revenue : undefined} prefix="€" icon={<Tag />} color="emerald" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <KpiCard title="Paid Sessions" value={stats.paid.current.sessions} comparison={comparisonEnabled ? stats.paid.changes.sessions : undefined} icon={<TrendingUp />} color="amber" />
          <KpiCard title="Paid Revenue" value={stats.paid.current.revenue} comparison={comparisonEnabled ? stats.paid.changes.revenue : undefined} prefix="€" icon={<Tag />} color="rose" />
        </div>
      </div>
      <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Evolución Sesiones (Organic vs Paid)</h4>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {['daily', 'weekly', 'monthly'].map(g => (
              <button key={g} onClick={() => setGrouping(g)} className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg ${grouping === g ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{g === 'daily' ? 'Día' : g === 'weekly' ? 'Sem' : 'Mes'}</button>
            ))}
          </div>
        </div>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9}} />
              <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
              <Legend verticalAlign="top" align="center" iconType="circle" />
              <Area name="Organic" type="monotone" dataKey="organic" stroke="#6366f1" strokeWidth={3} fill="#6366f1" fillOpacity={0.05} />
              <Area name="Paid" type="monotone" dataKey="paid" stroke="#f59e0b" strokeWidth={3} fill="#f59e0b" fillOpacity={0.05} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const SeoPerformanceCountryView = ({ data, keywordData, comparisonEnabled }: any) => {
  const countryMetrics = useMemo(() => {
    const map: Record<string, any> = {};
    const dailyMap = data.filter((d:any) => d.dateRangeLabel === 'current' && d.channel.toLowerCase().includes('organic'));
    const keywordMapCurrent = keywordData.filter((k:any) => k.dateRangeLabel === 'current');
    const keywordMapPrev = keywordData.filter((k:any) => k.dateRangeLabel === 'previous');

    // Stats Current
    keywordMapCurrent.forEach((k: any) => {
      if (!map[k.country]) map[k.country] = { country: k.country, clicks: 0, impressions: 0, sessions: 0, revenue: 0, sales: 0, history: [] };
      map[k.country].clicks += k.clicks;
      map[k.country].impressions += k.impressions;
    });

    dailyMap.forEach((d: any) => {
      if (!map[d.country]) map[d.country] = { country: d.country, clicks: 0, impressions: 0, sessions: 0, revenue: 0, sales: 0, history: [] };
      map[d.country].sessions += d.sessions;
      map[d.country].revenue += d.revenue;
      map[d.country].sales += d.sales;
    });

    // History for Sparklines (last 30 days)
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    keywordMapCurrent.forEach((k: any) => {
      if (new Date(k.date) >= thirtyDaysAgo) {
         if (!map[k.country].historyMap) map[k.country].historyMap = {};
         const dStr = k.date;
         map[k.country].historyMap[dStr] = (map[k.country].historyMap[dStr] || 0) + k.clicks;
      }
    });

    const list = Object.values(map).map(c => ({
      ...c,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      cr: c.sessions > 0 ? (c.sales / c.sessions) * 100 : 0,
      sparkline: Object.keys(c.historyMap || {}).sort().map(date => ({ value: c.historyMap[date] }))
    })).sort((a,b) => b.clicks - a.clicks);

    return list;
  }, [data, keywordData]);

  const maxRevenue = Math.max(...countryMetrics.map(c => c.revenue), 1);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* World Heatmap Mockup with SVG */}
        <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
          <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><MapIcon className="w-3 h-3" /> Distribución de Revenue por Mercado</h4>
          <div className="flex items-center justify-center h-[300px] bg-slate-50 rounded-2xl relative">
            <Globe className="w-48 h-48 text-indigo-100 animate-pulse" />
            <div className="absolute inset-0 flex flex-wrap gap-4 p-8 justify-center items-center">
              {countryMetrics.slice(0, 8).map((c, i) => (
                <div key={i} className="px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center gap-2 hover:scale-105 transition-transform cursor-pointer">
                  <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: `rgba(99, 102, 241, ${Math.max(0.2, c.revenue/maxRevenue)})` }} />
                  <span className="text-[10px] font-black">{c.country}</span>
                  <span className="text-[9px] text-slate-400">€{Math.round(c.revenue/1000)}k</span>
                </div>
              ))}
            </div>
            <p className="absolute bottom-4 right-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">Intensidad: Revenue Total</p>
          </div>
        </div>

        {/* Scatter Plot */}
        <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
          <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-6">Eficiencia: Clicks vs Conversión</h4>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" dataKey="clicks" name="Clicks" axisLine={false} tickLine={false} tick={{fontSize: 9}} label={{ value: 'Clicks', position: 'insideBottom', offset: -10, fontSize: 9 }} />
                <YAxis type="number" dataKey="cr" name="CR %" axisLine={false} tickLine={false} tick={{fontSize: 9}} label={{ value: 'Conv %', angle: -90, position: 'insideLeft', fontSize: 9 }} />
                <ZAxis type="number" dataKey="revenue" range={[60, 400]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{borderRadius: '12px', fontSize: '10px'}} />
                <Scatter name="Paises" data={countryMetrics}>
                  {countryMetrics.map((entry:any, index:number) => (
                    <Cell key={`cell-${index}`} fill={entry.cr > 3 ? '#10b981' : '#6366f1'} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Main Performance Table */}
      <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100">
           <h3 className="text-xl font-black">Performance Detallado por Mercado</h3>
           <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Métricas consolidadas de GA4 & GSC</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[9px] tracking-widest">
              <tr>
                <th className="px-6 py-4">País</th>
                <th className="px-6 py-4 text-center">Clics</th>
                <th className="px-6 py-4 text-center">CTR</th>
                <th className="px-6 py-4 text-center">Conversión</th>
                <th className="px-6 py-4">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {countryMetrics.map((c, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-5 font-black text-slate-900">{c.country}</td>
                  <td className="px-6 py-5 text-center text-slate-600 font-medium">{c.clicks.toLocaleString()}</td>
                  <td className="px-6 py-5 text-center font-bold text-slate-500">{c.ctr.toFixed(2)}%</td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex items-center justify-center gap-2">
                       <div className={`w-2 h-2 rounded-full ${c.cr > 3 ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' : c.cr > 1.5 ? 'bg-amber-500 shadow-lg shadow-amber-500/30' : 'bg-rose-500 shadow-lg shadow-rose-500/30'}`} />
                       <span className="font-bold">{c.cr.toFixed(2)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 w-[300px]">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-[10px] font-black">
                        <span>€{c.revenue.toLocaleString()}</span>
                        <span className="text-slate-400">{Math.round((c.revenue/maxRevenue)*100)}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${(c.revenue/maxRevenue)*100}%` }} />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top 10 with Sparklines */}
      <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
         <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xl font-black">Top 10 Tendencias (30 días)</h3>
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg text-[9px] font-black text-slate-500 uppercase"><TrendingUp className="w-3 h-3" /> Clicks de GSC</div>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 divide-x divide-y divide-slate-100">
            {countryMetrics.slice(0, 10).map((c, i) => (
              <div key={i} className="p-6 hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">#{i+1}</p>
                    <h5 className="text-sm font-black truncate max-w-[120px]">{c.country}</h5>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black">{c.clicks.toLocaleString()}</p>
                    <p className="text-[8px] text-slate-400 font-bold">TOTAL CLICKS</p>
                  </div>
                </div>
                <div className="h-12 w-full">
                  {c.sparkline && c.sparkline.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={c.sparkline}>
                        <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} fill="#6366f1" fillOpacity={0.1} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <div className="h-full flex items-center justify-center text-[8px] text-slate-300 italic">Tendencia no disponible</div>}
                </div>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
};

const SeoDeepDiveView = ({ keywords, searchTerm, setSearchTerm, isLoading, comparisonEnabled }: any) => {
  const [expandedUrls, setExpandedUrls] = useState<Set<string>>(new Set());
  const toggleUrl = (url: string) => {
    const next = new Set(expandedUrls);
    if (next.has(url)) next.delete(url); else next.add(url);
    setExpandedUrls(next);
  };

  const aggregatedByUrl = useMemo(() => {
    const map: Record<string, any> = {};
    keywords.forEach((k: any) => {
      const url = k.landingPage;
      if (!map[url]) map[url] = { url, clicks: 0, impressions: 0, prevClicks: 0, prevImpressions: 0, children: {} };
      if (k.dateRangeLabel === 'current') { map[url].clicks += k.clicks; map[url].impressions += k.impressions; }
      else { map[url].prevClicks += k.clicks; map[url].prevImpressions += k.impressions; }
      if (!map[url].children[k.keyword]) map[url].children[k.keyword] = { keyword: k.keyword, queryType: k.queryType, clicks: 0, impressions: 0, prevClicks: 0, prevImpressions: 0 };
      if (k.dateRangeLabel === 'current') { map[url].children[k.keyword].clicks += k.clicks; map[url].children[k.keyword].impressions += k.impressions; }
      else { map[url].children[k.keyword].prevClicks += k.clicks; map[url].children[k.keyword].prevImpressions += k.impressions; }
    });
    return Object.values(map).map((page:any) => ({
      ...page,
      ctr: page.impressions > 0 ? (page.clicks / page.impressions) * 100 : 0,
      clickChange: page.prevClicks === 0 ? 0 : ((page.clicks - page.prevClicks) / page.prevClicks) * 100,
      children: Object.values(page.children).sort((a:any,b:any) => b.clicks - a.clicks)
    }))
    .filter((p:any) => p.url.toLowerCase().includes(searchTerm.toLowerCase()) || p.children.some((c:any) => c.keyword.toLowerCase().includes(searchTerm.toLowerCase())))
    .sort((a, b) => b.clicks - a.clicks);
  }, [keywords, searchTerm]);

  return (
    <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
      <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="w-full">
           <h3 className="text-xl font-black mb-1">Deep Dive SEO</h3>
           <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Análisis por URL y Palabra Clave</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input type="text" placeholder="Buscar URL o Palabra..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-medium focus:ring-2 ring-indigo-500/10 outline-none" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs table-fixed min-w-[1000px]">
          <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[9px] tracking-widest">
            <tr>
              <th className="px-6 py-4 w-12"></th>
              <th className="px-4 py-4 w-[45%]">Página de Destino</th>
              <th className="px-6 py-4 text-center">Impr.</th>
              <th className="px-6 py-4 text-center">Clicks</th>
              {comparisonEnabled && <th className="px-6 py-4 text-center">Var Clicks</th>}
              <th className="px-6 py-4 text-center">CTR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {aggregatedByUrl.slice(0, 100).map((row:any, i) => {
              const isExpanded = expandedUrls.has(row.url);
              return (
                <React.Fragment key={row.url}>
                  <tr onClick={() => toggleUrl(row.url)} className={`group cursor-pointer transition-all ${isExpanded ? 'bg-indigo-50/30' : 'hover:bg-slate-50/50'}`}>
                    <td className="pl-6 py-5">{isExpanded ? <ChevronDown className="w-4 h-4 text-indigo-600" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}</td>
                    <td className="px-4 py-5"><div className="flex items-center gap-3"><FileText className="w-4 h-4 text-indigo-500" /><span className="font-bold text-slate-900 break-all leading-relaxed">{row.url}</span></div></td>
                    <td className="px-6 py-5 text-center text-slate-600 font-medium">{row.impressions.toLocaleString()}</td>
                    <td className="px-6 py-5 text-center font-black text-slate-900">{row.clicks.toLocaleString()}</td>
                    {comparisonEnabled && <td className="px-6 py-5 text-center font-bold text-emerald-600">{(row.clickChange >= 0 ? '+' : '') + row.clickChange.toFixed(1)}%</td>}
                    <td className="px-6 py-5 text-center"><span className="px-2 py-1 rounded-lg font-black bg-slate-100">{row.ctr.toFixed(1)}%</span></td>
                  </tr>
                  {isExpanded && row.children.map((child:any, ci:number) => (
                    <tr key={ci} className="bg-slate-50/30 border-l-4 border-indigo-500 animate-in slide-in-from-left-1">
                      <td></td>
                      <td className="px-4 py-3 pl-14"><div className="flex items-center gap-3 font-semibold text-slate-700">{child.keyword}<span className="text-[7px] bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded">{child.queryType}</span></div></td>
                      <td className="px-6 py-3 text-center text-slate-400 font-medium">{child.impressions.toLocaleString()}</td>
                      <td className="px-6 py-3 text-center text-slate-600 font-bold">{child.clicks.toLocaleString()}</td>
                      {comparisonEnabled && <td className="px-6 py-3 text-center">--</td>}
                      <td className="px-6 py-3 text-center text-slate-400 font-bold">{(child.clicks/child.impressions*100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SidebarLink = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black transition-all ${active ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
    {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-4 h-4' })}
    {label}
  </button>
);

export default App;
