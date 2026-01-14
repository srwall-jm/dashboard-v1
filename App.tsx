
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  BarChart3, Search, Calendar, ArrowUpRight, ArrowDownRight, TrendingUp, Sparkles, Globe, Tag, MousePointer2, Eye, Percent, ShoppingBag, LogOut, RefreshCw, CheckCircle2, Layers, Activity, Filter, ArrowRight, Target, FileText, AlertCircle, Settings2, Info, Menu, X, ChevronDown, ChevronRight, ExternalLink, HardDrive, Clock, ShoppingCart, CreditCard
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Legend, LineChart, Line, Cell
} from 'recharts';
import { DashboardTab, DashboardFilters, DailyData, KeywordData, Ga4Property, GscSite, QueryType, ChannelType } from './types';
import { getDashboardInsights } from './geminiService';
import GoogleLogin from './GoogleLogin'; 

const CLIENT_ID = "333322783684-pjhn2omejhngckfd46g8bh2dng9dghlc.apps.googleusercontent.com"; 
const SCOPE_GA4 = "https://www.googleapis.com/auth/analytics.readonly";
const SCOPE_GSC = "https://www.googleapis.com/auth/webmasters.readonly";

const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  'afg': 'Afghanistan', 'alb': 'Albania', 'dza': 'Algeria', 'and': 'Andorra', 'ago': 'Angola',
  'arg': 'Argentina', 'arm': 'Armenia', 'aus': 'Australia', 'aut': 'Austria', 'aze': 'Azerbaijan',
  'bel': 'Belgium', 'bra': 'Brazil', 'can': 'Canada', 'che': 'Switzerland', 'chl': 'Chile',
  'chn': 'China', 'col': 'Colombia', 'deu': 'Germany', 'dnk': 'Denmark', 'esp': 'Spain',
  'fin': 'Finland', 'fra': 'France', 'gbr': 'United Kingdom', 'grc': 'Greece', 'hkg': 'Hong Kong',
  'irl': 'Ireland', 'ind': 'India', 'ita': 'Italy', 'jpn': 'Japan', 'mex': 'Mexico',
  'nld': 'Netherlands', 'nor': 'Norway', 'per': 'Peru', 'pol': 'Poland', 'prt': 'Portugal',
  'rus': 'Russia', 'swe': 'Sweden', 'tur': 'Turkey', 'usa': 'United States', 'zaf': 'South Africa',
  'kor': 'South Korea', 'tha': 'Thailand', 'vnm': 'Vietnam', 'idn': 'Indonesia', 'mys': 'Malaysia',
  'phl': 'Philippines', 'sgp': 'Singapore', 'sau': 'Saudi Arabia', 'are': 'United Arab Emirates',
  'egy': 'Egypt', 'mar': 'Morocco', 'isr': 'Israel', 'ukr': 'Ukraine', 'cze': 'Czech Republic',
  'rou': 'Romania', 'hun': 'Hungary', 'nzl': 'New Zealand'
};

const normalizeCountry = (val: string): string => {
  if (!val) return 'Other';
  const clean = val.toLowerCase().trim();
  if (COUNTRY_CODE_TO_NAME[clean]) return COUNTRY_CODE_TO_NAME[clean];
  return val.length <= 3 ? (COUNTRY_CODE_TO_NAME[clean] || val.toUpperCase()) : val;
};

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
  <div className="bg-white p-5 md:p-6 rounded-[24px] border border-slate-200 shadow-sm hover:shadow-md transition-all group">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 bg-${color}-50 text-${color}-600 rounded-2xl group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      {comparison !== undefined && !isNaN(comparison) && (
        <div className="text-right">
          <div className={`flex items-center text-[11px] font-bold px-2 py-1 rounded-full ${comparison >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {comparison >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
            {Math.abs(comparison).toFixed(1)}%
          </div>
          {absoluteChange !== undefined && (
            <div className={`text-[9px] font-bold mt-1 ${absoluteChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {absoluteChange >= 0 ? '+' : ''}{prefix}{absoluteChange.toLocaleString()}
            </div>
          )}
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
    comparison: {
      enabled: false,
      type: 'previous_period'
    },
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
    if (!text) return false;
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
      const compStart = new Date(start);
      compStart.setFullYear(compStart.getFullYear() - 1);
      const compEnd = new Date(end);
      compEnd.setFullYear(compEnd.getFullYear() - 1);
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
      if (props.length > 0 && !ga4Auth?.property) {
        setGa4Auth({ token, property: props[0] });
      }
    } catch (e) {
      console.error(e);
      setError("Error conectando con GA4 Admin API.");
    }
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
        const relevant = ['session', 'source', 'medium', 'channel', 'campaign', 'country', 'region', 'page', 'landing', 'device'];
        return relevant.some(r => apiName.includes(r));
      });
      const mapped = filtered.map((d: any) => ({ label: d.uiName || d.apiName, value: d.apiName }));
      if (mapped.length > 0) setAvailableDimensions(mapped);
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
          metrics: [
            { name: 'sessions' }, 
            { name: 'addToCarts' }, 
            { name: 'checkouts' }, 
            { name: 'totalRevenue' }, 
            { name: 'transactions' }, 
            { name: 'sessionConversionRate' }
          ]
        })
      });
      const ga4Data = await ga4ReportResp.json();
      if (ga4Data.error) throw new Error(ga4Data.error.message);

      const dailyMapped: DailyData[] = (ga4Data.rows || []).map((row: any) => ({
        date: `${row.dimensionValues[0].value.slice(0,4)}-${row.dimensionValues[0].value.slice(4,6)}-${row.dimensionValues[0].value.slice(6,8)}`,
        channel: row.dimensionValues[1].value,
        country: normalizeCountry(row.dimensionValues[2].value),
        queryType: 'Non-Branded' as QueryType,
        landingPage: row.dimensionValues[3].value,
        dateRangeLabel: row.dimensionValues.length > 4 && row.dimensionValues[4].value === 'date_range_1' ? 'previous' : 'current',
        sessions: parseInt(row.metricValues[0].value) || 0,
        addToCarts: parseInt(row.metricValues[1].value) || 0,
        checkouts: parseInt(row.metricValues[2].value) || 0,
        revenue: parseFloat(row.metricValues[3].value) || 0,
        sales: parseInt(row.metricValues[4].value) || 0,
        conversionRate: (parseFloat(row.metricValues[5].value) || 0) * 100,
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
            keyword: row.keys[0] || '', landingPage: row.keys[1] || '', country: normalizeCountry(row.keys[2]),
            queryType: 'Non-Branded' as QueryType, date: row.keys[3] || '', dateRangeLabel: label,
            clicks: row.clicks || 0, impressions: row.impressions || 0, ctr: (row.ctr || 0) * 100,
            sessions: 0, conversionRate: 0, revenue: 0, sales: 0, addToCarts: 0, checkouts: 0
        }));
      };
      let combined: KeywordData[] = await fetchOneRange(filters.dateRange.start, filters.dateRange.end, 'current');
      if (filters.comparison.enabled) {
        const comp = getComparisonDates();
        const prev = await fetchOneRange(comp.start, comp.end, 'previous');
        combined = [...combined, ...prev];
      }
      setRealKeywordData(combined);
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
          client_id: CLIENT_ID, scope: SCOPE_GA4, prompt: '',
          callback: (resp: any) => {
            if (resp.access_token) {
              setGa4Auth({ token: resp.access_token, property: ga4Auth?.property || null });
              fetchGa4Properties(resp.access_token);
            }
          },
        });
        tokenClientGsc.current = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID, scope: SCOPE_GSC, prompt: '',
          callback: (resp: any) => {
            if (resp.access_token) {
              setGscAuth({ token: resp.access_token, site: gscAuth?.site || null });
              fetchGscSites(resp.access_token);
            }
          },
        });
      } else { setTimeout(initializeOAuth, 500); }
    };
    initializeOAuth();
  }, []);

  const handleLoginSuccess = (token: string) => {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(base64));
    const newUser = { name: decoded.name, email: decoded.email, picture: decoded.picture };
    setUser(newUser);
    localStorage.setItem('seo_suite_user', JSON.stringify(newUser));
  };

  const handleLogout = () => { setUser(null); setGa4Auth(null); setGscAuth(null); localStorage.clear(); sessionStorage.clear(); };

  useEffect(() => { 
    if (ga4Auth?.token && ga4Auth.property) { fetchGa4Data(); fetchGa4Metadata(ga4Auth.token, ga4Auth.property.id); } 
  }, [ga4Auth?.property?.id, filters.dateRange, filters.ga4Dimension, filters.comparison.enabled]);

  useEffect(() => { 
    if (gscAuth?.token && gscAuth.site) fetchGscData(); 
  }, [gscAuth?.site?.siteUrl, filters.dateRange, filters.comparison.enabled]);

  const filteredDailyData = useMemo(() => realDailyData.filter(d => (filters.country === 'All' || d.country === filters.country) && (filters.queryType === 'All' || (isBranded(d.landingPage || '') ? 'Branded' : 'Non-Branded') === filters.queryType)), [realDailyData, filters]);
  const filteredKeywordData = useMemo(() => realKeywordData.filter(k => (filters.country === 'All' || k.country === filters.country) && (filters.queryType === 'All' || (isBranded(k.keyword) ? 'Branded' : 'Non-Branded') === filters.queryType)), [realKeywordData, filters]);

  const aggregate = (data: DailyData[]) => {
    const current = data.filter(d => d.dateRangeLabel === 'current');
    const prev = data.filter(d => d.dateRangeLabel === 'previous');
    const sum = (arr: DailyData[]) => arr.reduce((acc, curr) => ({
      sessions: acc.sessions + curr.sessions, sales: acc.sales + curr.sales, 
      revenue: acc.revenue + curr.revenue, addToCarts: acc.addToCarts + curr.addToCarts, 
      checkouts: acc.checkouts + curr.checkouts
    }), { sessions: 0, sales: 0, revenue: 0, addToCarts: 0, checkouts: 0 });
    const cSum = sum(current); const pSum = sum(prev);
    const getChange = (c: number, p: number) => p === 0 ? 0 : ((c - p) / p) * 100;
    return { 
      current: { ...cSum, cr: cSum.sessions > 0 ? (cSum.sales / cSum.sessions) * 100 : 0 },
      changes: { sessions: getChange(cSum.sessions, pSum.sessions), sales: getChange(cSum.sales, pSum.sales), revenue: getChange(cSum.revenue, pSum.revenue), cr: getChange(cSum.sales/(cSum.sessions||1), pSum.sales/(pSum.sessions||1)) },
      abs: { sessions: cSum.sessions - pSum.sessions, sales: cSum.sales - pSum.sales, revenue: cSum.revenue - pSum.revenue }
    };
  };

  const channelStats = useMemo(() => ({
    organic: aggregate(filteredDailyData.filter(d => d.channel.toLowerCase().includes('organic'))),
    paid: aggregate(filteredDailyData.filter(d => d.channel.toLowerCase().includes('paid') || d.channel.toLowerCase().includes('cpc')))
  }), [filteredDailyData]);

  const uniqueCountries = useMemo(() => Array.from(new Set([...realDailyData.map(d => d.country), ...realKeywordData.map(k => k.country)])).filter(c => c && c !== 'Other').sort(), [realDailyData, realKeywordData]);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <Activity className="w-16 h-16 text-indigo-500 mb-8 animate-pulse" />
        <h1 className="text-3xl font-black mb-4">SEO & SEM Advanced Reporting</h1>
        <p className="text-slate-400 mb-8">Accede con tu cuenta corporativa para analizar rendimiento.</p>
        <GoogleLogin onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col md:flex-row">
      <aside className="w-80 bg-slate-950 text-white flex flex-col hidden xl:flex border-r border-white/5">
        <div className="p-8 flex-1">
          <div className="flex items-center gap-3 mb-10"><Activity className="text-indigo-500 w-8 h-8" /><div><h1 className="font-black">SEO Master</h1><p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Analytics Suite</p></div></div>
          <nav className="space-y-1 mb-10">
            <SidebarLink active={activeTab === DashboardTab.ORGANIC_VS_PAID} onClick={() => setActiveTab(DashboardTab.ORGANIC_VS_PAID)} icon={<Layers />} label="Organic vs Paid" />
            <SidebarLink active={activeTab === DashboardTab.SEO_BY_COUNTRY} onClick={() => setActiveTab(DashboardTab.SEO_BY_COUNTRY)} icon={<Globe />} label="Performance País" />
            <SidebarLink active={activeTab === DashboardTab.KEYWORD_DEEP_DIVE} onClick={() => setActiveTab(DashboardTab.KEYWORD_DEEP_DIVE)} icon={<Target />} label="Análisis SEO Deep" />
          </nav>
          <div className="bg-white/5 rounded-2xl p-4 mb-6">
            <h4 className="text-[9px] font-black uppercase text-slate-500 mb-3">Branded Regex</h4>
            <input type="text" value={brandRegexStr} onChange={e => setBrandRegexStr(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg text-xs p-2 outline-none" />
          </div>
        </div>
        <div className="p-6 border-t border-white/5">
          <div className="flex items-center gap-3 mb-4"><img src={user.picture} className="w-8 h-8 rounded-full" alt="u" /><div><p className="text-xs font-bold">{user.name}</p><p className="text-[10px] text-slate-500">{user.email}</p></div></div>
          <button onClick={handleLogout} className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all">Cerrar Sesión</button>
        </div>
      </aside>

      <main className="flex-1 p-5 md:p-10 overflow-x-hidden">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {activeTab === DashboardTab.ORGANIC_VS_PAID ? 'Organic vs Paid Performance' : activeTab === DashboardTab.SEO_BY_COUNTRY ? 'SEO por Mercado' : 'Deep Dive URL & Keywords'}
            </h2>
            <p className="text-slate-500 text-sm font-medium mt-1">Análisis profundo de conversión y visibilidad.</p>
          </div>
          <div className="flex flex-wrap gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
             <div className="flex items-center gap-2 px-3 border-r border-slate-100">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <input type="date" value={filters.dateRange.start} onChange={e => setFilters({...filters, dateRange: {...filters.dateRange, start: e.target.value}})} className="text-[10px] font-bold outline-none bg-transparent" />
                <span className="text-slate-300">/</span>
                <input type="date" value={filters.dateRange.end} onChange={e => setFilters({...filters, dateRange: {...filters.dateRange, end: e.target.value}})} className="text-[10px] font-bold outline-none bg-transparent" />
             </div>
             <select className="px-3 text-[10px] font-black uppercase outline-none bg-transparent" value={filters.country} onChange={e => setFilters({...filters, country: e.target.value})}><option value="All">Global</option>{uniqueCountries.map(c => <option key={c} value={c}>{c}</option>)}</select>
          </div>
        </header>

        {activeTab === DashboardTab.ORGANIC_VS_PAID && <OrganicVsPaidView stats={channelStats} data={filteredDailyData} comparisonEnabled={filters.comparison.enabled} grouping={grouping} setGrouping={setGrouping} />}
        {activeTab === DashboardTab.SEO_BY_COUNTRY && <SeoMarketplaceView data={filteredDailyData} keywordData={filteredKeywordData} aggregate={aggregate} comparisonEnabled={filters.comparison.enabled} />}
        {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && <SeoDeepDiveView keywords={filteredKeywordData} searchTerm={searchTerm} setSearchTerm={setSearchTerm} isLoading={isLoadingGsc} comparisonEnabled={filters.comparison.enabled} />}
      </main>
    </div>
  );
};

const OrganicVsPaidView = ({ stats, data, comparisonEnabled, grouping, setGrouping }: any) => {
  const trendData = useMemo(() => {
    const map: any = {};
    data.filter((d: any) => d.dateRangeLabel === 'current').forEach((d: any) => {
      const isOrg = d.channel.toLowerCase().includes('organic');
      const isPaid = d.channel.toLowerCase().includes('paid') || d.channel.toLowerCase().includes('cpc');
      if (!isOrg && !isPaid) return;
      let key = d.date;
      if (grouping === 'weekly') key = formatDate(getStartOfWeek(new Date(d.date)));
      else if (grouping === 'monthly') key = `${d.date.slice(0, 7)}-01`;
      if (!map[key]) map[key] = { date: key, organicRevenue: 0, paidRevenue: 0, organicSessions: 0, paidSessions: 0 };
      if (isOrg) { map[key].organicRevenue += d.revenue; map[key].organicSessions += d.sessions; }
      if (isPaid) { map[key].paidRevenue += d.revenue; map[key].paidSessions += d.sessions; }
    });
    return Object.values(map).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [data, grouping]);

  const funnelData = useMemo(() => {
    const getStageData = (s: any) => [
      { name: 'Sesiones', value: s.current.sessions },
      { name: 'Add to Cart', value: s.current.addToCarts },
      { name: 'Checkout', value: s.current.checkouts },
      { name: 'Venta', value: s.current.sales }
    ];
    return { organic: getStageData(stats.organic), paid: getStageData(stats.paid) };
  }, [stats]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <KpiContainer label="Organic Search" color="indigo" s={stats.organic} comparisonEnabled={comparisonEnabled} />
        <KpiContainer label="Paid Search" color="amber" s={stats.paid} comparisonEnabled={comparisonEnabled} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tendencias de Revenue (€)</h4>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              {['daily', 'weekly', 'monthly'].map(g => <button key={g} onClick={() => setGrouping(g)} className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg ${grouping === g ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{g.slice(0,3)}</button>)}
            </div>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                   <linearGradient id="gOrg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient>
                   <linearGradient id="gPaid" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9}} />
                <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                <Legend verticalAlign="top" align="center" iconType="circle" />
                <Area name="Organic Revenue" type="monotone" dataKey="organicRevenue" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#gOrg)" />
                <Area name="Paid Revenue" type="monotone" dataKey="paidRevenue" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#gPaid)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10">Embudo de Conversión Comparativo</h4>
           <div className="space-y-6">
              {funnelData.organic.map((stage: any, i: number) => {
                const oVal = stage.value;
                const pVal = funnelData.paid[i].value;
                const max = Math.max(oVal, pVal, 1);
                const oPerc = (oVal / funnelData.organic[0].value * 100).toFixed(1);
                const pPerc = (pVal / funnelData.paid[0].value * 100).toFixed(1);

                return (
                  <div key={stage.name} className="relative">
                    <div className="flex justify-between text-[10px] font-black text-slate-900 mb-2 uppercase tracking-tighter">
                       <span>{stage.name}</span>
                       <div className="flex gap-4">
                          <span className="text-indigo-600">ORG: {oVal.toLocaleString()} ({oPerc}%)</span>
                          <span className="text-amber-600">PAID: {pVal.toLocaleString()} ({pPerc}%)</span>
                       </div>
                    </div>
                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex">
                       <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${(oVal / max) * 50}%`, borderRight: '1px solid white' }}></div>
                       <div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: `${(pVal / max) * 50}%` }}></div>
                    </div>
                    {i < funnelData.organic.length - 1 && (
                      <div className="flex justify-center -my-1 relative z-10">
                        <ArrowDownRight className="w-3 h-3 text-slate-300" />
                      </div>
                    )}
                  </div>
                );
              })}
           </div>
           <div className="mt-10 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Observación de Calidad</p>
              <p className="text-xs font-medium text-slate-600 leading-relaxed">
                El tráfico <strong>{stats.organic.current.cr > stats.paid.current.cr ? 'Orgánico' : 'Pagado'}</strong> presenta una mayor eficiencia en el cierre de venta ({Math.max(stats.organic.current.cr, stats.paid.current.cr).toFixed(2)}% vs {Math.min(stats.organic.current.cr, stats.paid.current.cr).toFixed(2)}%).
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

const KpiContainer = ({ label, color, s, comparisonEnabled }: any) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 px-2"><div className={`w-2 h-2 rounded-full bg-${color}-500`} /><h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{label}</h4></div>
    <div className="grid grid-cols-2 gap-4">
      <KpiCard title="Sesiones" value={s.current.sessions} comparison={comparisonEnabled ? s.changes.sessions : undefined} absoluteChange={comparisonEnabled ? s.abs.sessions : undefined} icon={<TrendingUp />} color={color} />
      <KpiCard title="CR (%)" value={`${s.current.cr.toFixed(2)}%`} comparison={comparisonEnabled ? s.changes.cr : undefined} icon={<Percent />} isPercent color={color} />
      <KpiCard title="Ingresos" value={`€${s.current.revenue.toLocaleString()}`} comparison={comparisonEnabled ? s.changes.revenue : undefined} absoluteChange={comparisonEnabled ? s.abs.revenue : undefined} icon={<Tag />} prefix="€" color="emerald" />
      <KpiCard title="Ventas" value={s.current.sales} comparison={comparisonEnabled ? s.changes.sales : undefined} absoluteChange={comparisonEnabled ? s.abs.sales : undefined} icon={<ShoppingBag />} color="emerald" />
    </div>
  </div>
);

const SeoMarketplaceView = ({ data, keywordData, aggregate, comparisonEnabled }: any) => {
  const organicGa4 = aggregate(data.filter((d: any) => d.channel?.toLowerCase().includes('organic')));
  const gscStats = useMemo(() => {
    const current = keywordData.filter((k:any) => k.dateRangeLabel === 'current');
    const sum = (arr: any[]) => arr.reduce((acc, curr) => ({ impressions: acc.impressions + curr.impressions, clicks: acc.clicks + curr.clicks }), { impressions: 0, clicks: 0 });
    const cSum = sum(current);
    return { current: cSum, ctr: cSum.impressions > 0 ? (cSum.clicks / cSum.impressions) * 100 : 0 };
  }, [keywordData]);

  const countryStats = useMemo(() => {
    const map: any = {};
    keywordData.filter((k:any) => k.dateRangeLabel === 'current').forEach((k: any) => {
      if (!map[k.country]) map[k.country] = { country: k.country, clicks: 0, impressions: 0 };
      map[k.country].clicks += k.clicks; map[k.country].impressions += k.impressions;
    });
    return Object.values(map).sort((a: any, b: any) => b.clicks - a.clicks).slice(0, 10);
  }, [keywordData]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Visibilidad (GSC)" value={gscStats.current.impressions} icon={<Eye />} />
        <KpiCard title="Clicks (GSC)" value={gscStats.current.clicks} icon={<MousePointer2 />} />
        <KpiCard title="CTR (GSC)" value={`${gscStats.ctr.toFixed(2)}%`} icon={<Percent />} />
        <KpiCard title="Revenue (GA4)" value={`€${organicGa4.current.revenue.toLocaleString()}`} icon={<Tag />} color="emerald" prefix="€" />
      </div>
      <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm h-[450px]">
         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10">Clicks por Mercado</h4>
         <ResponsiveContainer width="100%" height="85%">
            <BarChart data={countryStats}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="country" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9}} />
              <Tooltip cursor={{fill: '#f8fafc'}} />
              <Bar dataKey="clicks" fill="#6366f1" radius={[8, 8, 0, 0]} />
            </BarChart>
         </ResponsiveContainer>
      </div>
    </div>
  );
};

const SeoDeepDiveView = ({ keywords, searchTerm, setSearchTerm, isLoading, comparisonEnabled }: any) => {
  const [expandedUrls, setExpandedUrls] = useState<Set<string>>(new Set());
  const toggleUrl = (url: string) => { const next = new Set(expandedUrls); if (next.has(url)) next.delete(url); else next.add(url); setExpandedUrls(next); };
  const aggregatedByUrl = useMemo(() => {
    const map: any = {};
    keywords.forEach((k: any) => {
      const url = k.landingPage || 'Unknown';
      if (!map[url]) map[url] = { url, clicks: 0, impressions: 0, children: {} };
      if (k.dateRangeLabel === 'current') { map[url].clicks += k.clicks; map[url].impressions += k.impressions; }
      const kw = k.keyword || 'Unknown';
      if (!map[url].children[kw]) map[url].children[kw] = { keyword: kw, clicks: 0, impressions: 0 };
      if (k.dateRangeLabel === 'current') { map[url].children[kw].clicks += k.clicks; map[url].children[kw].impressions += k.impressions; }
    });
    return Object.values(map).map((p: any) => ({
      ...p, ctr: p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0,
      children: Object.values(p.children).sort((a: any, b: any) => b.clicks - a.clicks)
    }))
    .filter((p: any) => p.url.toLowerCase().includes(searchTerm.toLowerCase()) || p.children.some((c: any) => c.keyword.toLowerCase().includes(searchTerm.toLowerCase())))
    .sort((a: any, b: any) => b.clicks - a.clicks);
  }, [keywords, searchTerm]);

  return (
    <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
      <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50">
        <div><h3 className="text-xl font-black">Análisis de URLs</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Desglose de Keywords por página</p></div>
        <div className="relative w-full md:w-80"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" /><input type="text" placeholder="Filtrar URL..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-medium outline-none focus:ring-2 ring-indigo-500/10" /></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs table-fixed min-w-[1000px]">
          <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[9px] tracking-widest border-b border-slate-100">
            <tr><th className="px-6 py-4 w-16"></th><th className="px-4 py-4 w-[50%]">Página</th><th className="px-6 py-4 text-center w-32">Clicks</th><th className="px-6 py-4 text-center w-28">CTR</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {aggregatedByUrl.slice(0, 100).map((row: any) => (
              <React.Fragment key={row.url}>
                <tr onClick={() => toggleUrl(row.url)} className="group cursor-pointer hover:bg-slate-50/50 transition-all">
                  <td className="pl-6 py-5 flex justify-center">{expandedUrls.has(row.url) ? <ChevronDown className="w-4 h-4 text-indigo-500" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}</td>
                  <td className="px-4 py-5 font-bold text-slate-900 break-all">{row.url}</td>
                  <td className="px-6 py-5 text-center font-black text-slate-900">{row.clicks.toLocaleString()}</td>
                  <td className="px-6 py-5 text-center"><span className="px-2 py-1 rounded-lg bg-slate-100 font-bold">{row.ctr.toFixed(1)}%</span></td>
                </tr>
                {expandedUrls.has(row.url) && row.children.map((child: any, ci: number) => (
                  <tr key={ci} className="bg-slate-50/30 border-l-4 border-indigo-500">
                    <td className="py-3"></td><td className="px-4 py-3 pl-14 font-semibold text-slate-600">{child.keyword}</td>
                    <td className="px-6 py-3 text-center text-slate-500">{child.clicks.toLocaleString()}</td><td className="px-6 py-3 text-center text-slate-400">{(child.impressions > 0 ? child.clicks/child.impressions*100 : 0).toFixed(1)}%</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SidebarLink = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black transition-all ${active ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
    {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-4 h-4' })} {label}
  </button>
);

export default App;
