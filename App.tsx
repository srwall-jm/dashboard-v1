
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  BarChart3, Search, Calendar, ArrowUpRight, ArrowDownRight, TrendingUp, Sparkles, Globe, Tag, MousePointer2, Eye, Percent, ShoppingBag, LogOut, RefreshCw, CheckCircle2, Layers, Activity, Filter, ArrowRight, Target, FileText, AlertCircle, Settings2, Info, Menu, X, ChevronDown, ChevronRight, ExternalLink, HardDrive, Clock
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

// Comprehensive mapping for SEO global markets (ISO-3 to Full Name)
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
      const sorted = mapped.sort((a: any, b: any) => {
        const aIndex = PRIORITY_DIMENSIONS.indexOf(a.value);
        const bIndex = PRIORITY_DIMENSIONS.indexOf(b.value);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
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
            { name: 'totalRevenue' }, 
            { name: 'transactions' }, 
            { name: 'sessionConversionRate' },
            { name: 'addToCarts' },
            { name: 'checkouts' }
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
        revenue: parseFloat(row.metricValues[1].value) || 0,
        sales: parseInt(row.metricValues[2].value) || 0,
        conversionRate: (parseFloat(row.metricValues[3].value) || 0) * 100,
        addToCarts: parseInt(row.metricValues[4].value) || 0,
        checkouts: parseInt(row.metricValues[5].value) || 0,
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
            startDate: start,
            endDate: end,
            dimensions: ['query', 'page', 'country', 'date'],
            rowLimit: 5000
          })
        });
        const data = await resp.json();
        if (data.error) throw new Error(data.error.message);
        return (data.rows || []).map((row: any) => ({
            keyword: row.keys[0] || '',
            landingPage: row.keys[1] || '',
            country: normalizeCountry(row.keys[2]),
            queryType: 'Non-Branded' as QueryType,
            date: row.keys[3] || '',
            dateRangeLabel: label,
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: (row.ctr || 0) * 100,
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
        if (ga4Auth?.token) fetchGa4Properties(ga4Auth.token);
        if (gscAuth?.token) fetchGscSites(gscAuth.token);
      } else { setTimeout(initializeOAuth, 500); }
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
    setUser(null); setGa4Auth(null); setGscAuth(null);
    localStorage.removeItem('seo_suite_user');
    sessionStorage.removeItem('ga4_auth');
    sessionStorage.removeItem('gsc_auth');
  };

  const handleConnectGa4 = () => { if (tokenClientGa4.current) tokenClientGa4.current.requestAccessToken(); };
  const handleConnectGsc = () => { if (tokenClientGsc.current) tokenClientGsc.current.requestAccessToken(); };

  useEffect(() => { 
    if (ga4Auth?.token && ga4Auth.property) {
      fetchGa4Data();
      fetchGa4Metadata(ga4Auth.token, ga4Auth.property.id);
    } 
  }, [ga4Auth?.property?.id, filters.dateRange, filters.ga4Dimension, filters.comparison.enabled, filters.comparison.type]);

  useEffect(() => { 
    if (gscAuth?.token && gscAuth.site) fetchGscData(); 
  }, [gscAuth?.site?.siteUrl, filters.dateRange, filters.comparison.enabled, filters.comparison.type]);

  const filteredDailyData = useMemo((): DailyData[] => {
    return realDailyData.filter(d => {
      const queryTypeActual = isBranded(d.landingPage || '') ? 'Branded' : 'Non-Branded';
      const countryMatch = filters.country === 'All' || d.country === filters.country;
      const queryMatch = filters.queryType === 'All' || queryTypeActual === filters.queryType;
      return countryMatch && queryMatch;
    }).map(d => ({ ...d, queryType: (isBranded(d.landingPage || '') ? 'Branded' : 'Non-Branded') as QueryType }));
  }, [realDailyData, filters, brandRegexStr]);

  const filteredKeywordData = useMemo((): KeywordData[] => {
    return realKeywordData.filter(k => {
      const queryTypeActual = isBranded(k.keyword) ? 'Branded' : 'Non-Branded';
      const countryMatch = filters.country === 'All' || k.country === filters.country;
      const queryMatch = filters.queryType === 'All' || queryTypeActual === filters.queryType;
      return countryMatch && queryMatch;
    }).map(k => ({ ...k, queryType: (isBranded(k.keyword) ? 'Branded' : 'Non-Branded') as QueryType }));
  }, [realKeywordData, filters, brandRegexStr]);

  const aggregate = (data: DailyData[]) => {
    const currentData = data.filter(d => d.dateRangeLabel === 'current');
    const prevData = data.filter(d => d.dateRangeLabel === 'previous');
    const sum = (arr: DailyData[]) => arr.reduce((acc, curr) => ({
      sessions: acc.sessions + curr.sessions,
      sales: acc.sales + curr.sales,
      revenue: acc.revenue + curr.revenue,
      addToCarts: acc.addToCarts + curr.addToCarts,
      checkouts: acc.checkouts + curr.checkouts,
    }), { sessions: 0, sales: 0, revenue: 0, addToCarts: 0, checkouts: 0 });
    const currSum = sum(currentData);
    const prevSum = sum(prevData);
    const getChange = (curr: number, prev: number) => prev === 0 ? 0 : ((curr - prev) / prev) * 100;
    return { 
      current: { ...currSum, cr: currSum.sessions > 0 ? (currSum.sales / currSum.sessions) * 100 : 0 },
      previous: { ...prevSum, cr: prevSum.sessions > 0 ? (prevSum.sales / prevSum.sessions) * 100 : 0 },
      changes: {
        sessions: getChange(currSum.sessions, prevSum.sessions),
        sales: getChange(currSum.sales, prevSum.sales),
        revenue: getChange(currSum.revenue, prevSum.revenue),
        addToCarts: getChange(currSum.addToCarts, prevSum.addToCarts),
        checkouts: getChange(currSum.checkouts, prevSum.checkouts),
        cr: getChange(currSum.sales / (currSum.sessions || 1), prevSum.sales / (prevSum.sessions || 1))
      },
      abs: { sessions: currSum.sessions - prevSum.sessions, sales: currSum.sales - prevSum.sales, revenue: currSum.revenue - prevSum.revenue, addToCarts: currSum.addToCarts - prevSum.addToCarts, checkouts: currSum.checkouts - prevSum.checkouts }
    };
  };

  const channelStats = useMemo(() => {
    const organic = aggregate(filteredDailyData.filter(d => d.channel.toLowerCase().includes('organic')));
    const paid = aggregate(filteredDailyData.filter(d => d.channel.toLowerCase().includes('paid') || d.channel.toLowerCase().includes('cpc')));
    return { organic, paid };
  }, [filteredDailyData]);

  const setShortcut = (type: string) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    if (type === 'this_month') { start = new Date(now.getFullYear(), now.getMonth(), 1); end = now; }
    else if (type === 'last_month') { start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0); }
    else if (type === 'last_7') { start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); end = now; }
    else if (type === 'last_30') { start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); end = now; }
    setFilters({ ...filters, dateRange: { start: formatDate(start), end: formatDate(end) } });
  };

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

  const filteredProperties = useMemo(() => availableProperties.filter(p => p.name.toLowerCase().includes(ga4Search.toLowerCase())), [availableProperties, ga4Search]);
  const filteredSites = useMemo(() => availableSites.filter(s => s.siteUrl.toLowerCase().includes(gscSearch.toLowerCase())), [availableSites, gscSearch]);

  const uniqueCountries = useMemo(() => {
    const set = new Set([...realDailyData.map(d => d.country), ...realKeywordData.map(k => k.country)]);
    return Array.from(set).filter(c => c && c !== 'Other' && c !== 'Unknown').sort();
  }, [realDailyData, realKeywordData]);

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

      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 xl:hidden" onClick={() => setIsSidebarOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 w-80 bg-slate-950 text-white flex flex-col z-50 shadow-2xl transition-transform duration-300 xl:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-xl shadow-indigo-500/20"><Activity className="w-6 h-6" /></div>
            <div><h1 className="text-lg font-black tracking-tight">SEO Master</h1><p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Suite Pro</p></div>
          </div>
          <nav className="space-y-1 mb-8">
            <SidebarLink active={activeTab === DashboardTab.ORGANIC_VS_PAID} onClick={() => {setActiveTab(DashboardTab.ORGANIC_VS_PAID); setIsSidebarOpen(false);}} icon={<Layers />} label="Organic vs Paid" />
            <SidebarLink active={activeTab === DashboardTab.SEO_BY_COUNTRY} onClick={() => {setActiveTab(DashboardTab.SEO_BY_COUNTRY); setIsSidebarOpen(false);}} icon={<Globe />} label="Performance País" />
            <SidebarLink active={activeTab === DashboardTab.KEYWORD_DEEP_DIVE} onClick={() => {setActiveTab(DashboardTab.KEYWORD_DEEP_DIVE); setIsSidebarOpen(false);}} icon={<Target />} label="Análisis SEO Deep" />
          </nav>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 mb-6">
            <div className="flex items-center gap-2 mb-3 text-indigo-400"><Settings2 className="w-3.5 h-3.5" /><h4 className="text-[9px] font-black uppercase tracking-widest">Configuración SEO</h4></div>
            <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest block mb-1">Branded Regex</label>
            <input type="text" value={brandRegexStr} onChange={e => setBrandRegexStr(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg text-[10px] p-2 focus:ring-1 ring-indigo-500 outline-none" placeholder="brand|tienda" />
          </div>
        </div>

        <div className="p-6 border-t border-white/5 bg-slate-950">
           <div className="bg-white/5 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-6">
                <img src={user.picture} className="w-9 h-9 rounded-full border-2 border-indigo-500" alt="user" />
                <div className="truncate"><p className="text-[11px] font-black truncate">{user.name}</p><p className="text-[9px] text-slate-500 truncate">{user.email}</p></div>
              </div>
              <div className="space-y-4">
                 <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest block">GA4 Property</label>
                    {!ga4Auth?.token ? (
                      <button onClick={handleConnectGa4} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-2"><ExternalLink className="w-3 h-3" /> Conectar GA4</button>
                    ) : (
                      <div className="space-y-1.5">
                        <input type="text" placeholder="Buscar..." value={ga4Search} onChange={e => setGa4Search(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg text-[9px] px-2 py-1.5 outline-none focus:ring-1 ring-indigo-500" />
                        <select className="w-full bg-slate-900 border border-white/10 rounded-lg text-[10px] p-2 outline-none" value={ga4Auth?.property?.id || ''} onChange={e => setGa4Auth({...ga4Auth, property: availableProperties.find(p => p.id === e.target.value) || null})}>
                          {filteredProperties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                    )}
                 </div>
                 <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest block">GSC Domain</label>
                    {!gscAuth?.token ? (
                      <button onClick={handleConnectGsc} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-2"><ExternalLink className="w-3 h-3" /> Conectar GSC</button>
                    ) : (
                      <div className="space-y-1.5">
                        <input type="text" placeholder="Buscar..." value={gscSearch} onChange={e => setGscSearch(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg text-[9px] px-2 py-1.5 outline-none focus:ring-1 ring-indigo-500" />
                        <select className="w-full bg-slate-900 border border-white/10 rounded-lg text-[10px] p-2 outline-none" value={gscAuth?.site?.siteUrl || ''} onChange={e => setGscAuth({...gscAuth, site: availableSites.find(s => s.siteUrl === e.target.value) || null})}>
                          {filteredSites.map(s => <option key={s.siteUrl} value={s.siteUrl}>{s.siteUrl}</option>)}
                        </select>
                      </div>
                    )}
                 </div>
              </div>
              <button onClick={handleLogout} className="w-full mt-6 py-2 text-[9px] font-black text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-2"><LogOut className="w-3 h-3" /> Cerrar Sesión</button>
           </div>
        </div>
      </aside>

      <main className="flex-1 xl:ml-80 p-5 md:p-8 xl:p-12 transition-all overflow-x-hidden">
        <header className="flex flex-col gap-6 mb-10">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${isAnythingLoading ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isLoadingGa4 ? 'Sincronizando GA4...' : isLoadingGsc ? 'Sincronizando GSC...' : 'Dashboard Activo'}</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">
                {activeTab === DashboardTab.ORGANIC_VS_PAID && "Organic vs Paid Performance"}
                {activeTab === DashboardTab.SEO_BY_COUNTRY && "SEO Performance por País"}
                {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && "Análisis por URL & Keywords"}
              </h2>
            </div>
            <div className="flex flex-col items-end gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {['this_month', 'last_month', 'last_7', 'last_30'].map(type => (
                  <button key={type} onClick={() => setShortcut(type)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase hover:bg-slate-50 transition-colors shadow-sm">
                    {type.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="comp_enabled" checked={filters.comparison.enabled} onChange={e => setFilters({...filters, comparison: {...filters.comparison, enabled: e.target.checked}})} className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600" />
                  <label htmlFor="comp_enabled" className="text-[10px] font-black uppercase text-slate-600 tracking-tight cursor-pointer">Comparar</label>
                </div>
                {filters.comparison.enabled && (
                  <select className="bg-transparent text-[10px] font-bold text-indigo-600 outline-none cursor-pointer" value={filters.comparison.type} onChange={e => setFilters({...filters, comparison: {...filters.comparison, type: e.target.value as any}})}>
                    <option value="previous_period">vs Anterior</option>
                    <option value="previous_year">vs YoY</option>
                  </select>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 bg-white p-1.5 rounded-3xl border border-slate-200 shadow-sm w-full xl:w-max">
            <div className="flex items-center gap-2 px-3 py-1.5 border-b sm:border-b-0 sm:border-r border-slate-100 min-w-0">
               <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
               <div className="flex items-center gap-1.5 text-[10px] font-bold">
                  <input type="date" value={filters.dateRange.start} onChange={e => setFilters({...filters, dateRange: {...filters.dateRange, start: e.target.value}})} className="outline-none bg-transparent" />
                  <span className="text-slate-300">/</span>
                  <input type="date" value={filters.dateRange.end} onChange={e => setFilters({...filters, dateRange: {...filters.dateRange, end: e.target.value}})} className="outline-none bg-transparent" />
               </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 border-b sm:border-b-0 sm:border-r border-slate-100">
               <Globe className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
               <select className="bg-transparent text-[10px] font-black uppercase outline-none cursor-pointer w-full" value={filters.country} onChange={e => setFilters({...filters, country: e.target.value})}>
                  <option value="All">Todos Países</option>
                  {uniqueCountries.map(c => <option key={c} value={c}>{c}</option>)}
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
          {realKeywordData.length === 0 && !isLoadingGsc && (
            <div className="text-[10px] font-bold text-amber-600 bg-amber-50 px-4 py-2 rounded-xl flex items-center gap-2 border border-amber-100">
               <Info className="w-3 h-3" /> Search Console tiene un desfase de 2-3 días. Ajusta el rango si no ves datos de Keywords.
            </div>
          )}
        </header>

        {error && (
          <div className="mb-8 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 shadow-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" /><p className="font-bold text-xs">{error}</p>
          </div>
        )}

        {aiInsights && (
          <div className="mb-10 bg-indigo-600 rounded-[32px] p-8 md:p-10 text-white shadow-2xl relative animate-in fade-in zoom-in-95 duration-500">
            <div className="flex justify-between items-start mb-6"><div className="flex items-center gap-3"><Sparkles className="w-5 h-5" /><h3 className="text-xl font-black">Reporte Estratégico</h3></div><button onClick={() => setAiInsights(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-4 h-4" /></button></div>
            <div className="prose prose-invert max-w-none font-medium text-sm md:text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: aiInsights.replace(/\n/g, '<br/>') }} />
          </div>
        )}

        <div className="w-full">
          {activeTab === DashboardTab.ORGANIC_VS_PAID && <OrganicVsPaidView stats={channelStats} data={filteredDailyData} comparisonEnabled={filters.comparison.enabled} grouping={grouping} setGrouping={setGrouping} />}
          {activeTab === DashboardTab.SEO_BY_COUNTRY && <SeoMarketplaceView data={filteredDailyData} keywordData={filteredKeywordData} aggregate={aggregate} comparisonEnabled={filters.comparison.enabled} />}
          {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && <SeoDeepDiveView keywords={filteredKeywordData} searchTerm={searchTerm} setSearchTerm={setSearchTerm} isLoading={isAnythingLoading} comparisonEnabled={filters.comparison.enabled} />}
        </div>

        <div className="mt-12 flex justify-center pb-12">
          <button onClick={handleGenerateInsights} disabled={loadingInsights || isAnythingLoading || (realDailyData.length === 0 && realKeywordData.length === 0)} className="flex items-center gap-3 px-10 py-4 bg-slate-950 text-white rounded-3xl text-xs font-black shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
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
      const isOrg = d.channel?.toLowerCase().includes('organic');
      const isPaid = d.channel?.toLowerCase().includes('paid') || d.channel?.toLowerCase().includes('cpc');
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

  const organicFunnelData = useMemo(() => [
    { stage: 'Sesiones', value: stats.organic.current.sessions },
    { stage: 'Añadir al Carrito', value: stats.organic.current.addToCarts },
    { stage: 'Checkout', value: stats.organic.current.checkouts },
    { stage: 'Venta', value: stats.organic.current.sales },
  ], [stats.organic]);

  const paidFunnelData = useMemo(() => [
    { stage: 'Sesiones', value: stats.paid.current.sessions },
    { stage: 'Añadir al Carrito', value: stats.paid.current.addToCarts },
    { stage: 'Checkout', value: stats.paid.current.checkouts },
    { stage: 'Venta', value: stats.paid.current.sales },
  ], [stats.paid]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {[ {type: 'ORG', color: 'indigo', label: 'Organic', s: stats.organic}, {type: 'PAID', color: 'amber', label: 'Paid', s: stats.paid} ].map(ch => (
          <div key={ch.type} className="space-y-4">
            <div className="flex items-center gap-3 px-2"><div className={`w-7 h-7 bg-${ch.color}-600 rounded-lg flex items-center justify-center text-white font-bold text-[9px]`}>{ch.type}</div><h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{ch.label} Performance</h4></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <KpiCard title="Sesiones" value={ch.s.current.sessions} comparison={comparisonEnabled ? ch.s.changes.sessions : undefined} absoluteChange={comparisonEnabled ? ch.s.abs.sessions : undefined} icon={<TrendingUp />} color={ch.color} />
              <KpiCard title="Conv. Rate" value={`${ch.s.current.cr.toFixed(2)}%`} comparison={comparisonEnabled ? ch.s.changes.cr : undefined} icon={<Percent />} isPercent color={ch.color} />
              <KpiCard title="Revenue" value={`€${ch.s.current.revenue.toLocaleString()}`} comparison={comparisonEnabled ? ch.s.changes.revenue : undefined} absoluteChange={comparisonEnabled ? ch.s.abs.revenue : undefined} icon={<Tag />} prefix="€" color={ch.type === 'ORG' ? 'emerald' : 'rose'} />
              <KpiCard title="Ventas" value={ch.s.current.sales} comparison={comparisonEnabled ? ch.s.changes.sales : undefined} absoluteChange={comparisonEnabled ? ch.s.abs.sales : undefined} icon={<ShoppingBag />} color={ch.type === 'ORG' ? 'emerald' : 'rose'} />
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-8"><h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tendencia de Sesiones</h4><div className="flex gap-1 bg-slate-100 p-1 rounded-xl">{['daily', 'weekly', 'monthly'].map(g => <button key={g} onClick={() => setGrouping(g)} className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg transition-all ${grouping === g ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{g === 'daily' ? 'Día' : g === 'weekly' ? 'Sem' : 'Mes'}</button>)}</div></div>
        <div className="h-[300px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} />
                <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                <Legend verticalAlign="top" align="center" iconType="circle" />
                <Area name="Organic" type="monotone" dataKey="organic" stroke="#6366f1" strokeWidth={3} fillOpacity={0.1} fill="#6366f1" />
                <Area name="Paid" type="monotone" dataKey="paid" stroke="#f59e0b" strokeWidth={3} fillOpacity={0.1} fill="#f59e0b" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyState text="Sin datos para graficar" />}
        </div>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tendencia de Revenue</h4>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <Tag className="w-3 h-3" />
            <span className="text-[9px] font-black uppercase tracking-widest">Revenue Total (€)</span>
          </div>
        </div>
        <div className="h-[300px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} tickFormatter={(val) => `€${val.toLocaleString()}`} />
                <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} formatter={(val: number) => [`€${val.toLocaleString()}`, '']} />
                <Legend verticalAlign="top" align="center" iconType="circle" />
                <Area name="Organic Revenue" type="monotone" dataKey="organicRevenue" stroke="#6366f1" strokeWidth={3} fillOpacity={0.1} fill="#6366f1" />
                <Area name="Paid Revenue" type="monotone" dataKey="paidRevenue" stroke="#f59e0b" strokeWidth={3} fillOpacity={0.1} fill="#f59e0b" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyState text="Sin datos de ingresos para graficar" />}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <EcommerceFunnel title="Funnel Organic Search" data={organicFunnelData} color="indigo" />
        <EcommerceFunnel title="Funnel Paid Search" data={paidFunnelData} color="amber" />
      </div>
    </div>
  );
};

const EcommerceFunnel = ({ title, data, color }: any) => {
  const max = data[0].value || 1;
  return (
    <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm">
      <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-8">{title}</h4>
      <div className="space-y-6">
        {data.map((stage: any, i: number) => {
          const width = (stage.value / max) * 100;
          return (
            <div key={stage.stage} className="relative">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{stage.stage}</span>
                <span className="text-[10px] font-bold text-slate-500">{stage.value.toLocaleString()}</span>
              </div>
              <div className="h-9 bg-slate-50 rounded-xl overflow-hidden border border-slate-100 p-1">
                <div 
                  className={`h-full bg-${color}-600 rounded-lg transition-all duration-1000 ease-out flex items-center justify-end px-3 min-w-[5%]`}
                  style={{ width: `${width}%` }}
                >
                  <span className="text-[8px] font-black text-white">{width.toFixed(1)}%</span>
                </div>
              </div>
              {i < data.length - 1 && (
                <div className="absolute left-1/2 -bottom-4.5 -translate-x-1/2 z-10 flex flex-col items-center">
                   <div className="w-[1px] h-3 bg-slate-200"></div>
                   <ChevronDown className="w-3 h-3 text-slate-300 -mt-1" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SeoMarketplaceView = ({ data, keywordData, aggregate, comparisonEnabled }: any) => {
  const organicGa4 = aggregate(data.filter((d: any) => d.channel?.toLowerCase().includes('organic')));
  
  const scatterData = useMemo(() => {
    const map: Record<string, { country: string; sessions: number; sales: number; revenue: number }> = {};
    data.filter((d: any) => 
      d.dateRangeLabel === 'current' && 
      d.channel?.toLowerCase().includes('organic')
    ).forEach((d: any) => {
      if (!map[d.country]) map[d.country] = { country: d.country, sessions: 0, sales: 0, revenue: 0 };
      map[d.country].sessions += d.sessions;
      map[d.country].sales += d.sales;
      map[d.country].revenue += d.revenue;
    });

    return Object.values(map)
      .map(item => ({
        country: item.country,
        traffic: item.sessions,
        revenue: item.revenue,
        sales: item.sales
      }))
      .filter(item => item.traffic > 0);
  }, [data]);

  const shareOfVoiceWalletData = useMemo(() => {
    const currentKeywords = keywordData.filter(k => k.dateRangeLabel === 'current');
    const currentOrganicDaily = data.filter(d => d.dateRangeLabel === 'current' && d.channel?.toLowerCase().includes('organic'));
    
    const totalImpressions = currentKeywords.reduce((acc, k) => acc + k.impressions, 0);
    const totalOrganicRevenue = currentOrganicDaily.reduce((acc, d) => acc + d.revenue, 0);

    const map: Record<string, { country: string; impressions: number; revenue: number }> = {};
    
    currentKeywords.forEach(k => {
      if (!map[k.country]) map[k.country] = { country: k.country, impressions: 0, revenue: 0 };
      map[k.country].impressions += k.impressions;
    });

    currentOrganicDaily.forEach(d => {
      if (!map[d.country]) map[d.country] = { country: d.country, impressions: 0, revenue: 0 };
      map[d.country].revenue += d.revenue;
    });

    return Object.values(map)
      .map(item => ({
        country: item.country,
        sov: totalImpressions > 0 ? (item.impressions / totalImpressions) * 100 : 0,
        sow: totalOrganicRevenue > 0 ? (item.revenue / totalOrganicRevenue) * 100 : 0
      }))
      .filter(item => item.sov > 0 || item.sow > 0)
      .sort((a, b) => b.sov - a.sov)
      .slice(0, 10);
  }, [keywordData, data]);

  const gscStats = useMemo(() => {
    const current = keywordData.filter((k:any) => k.dateRangeLabel === 'current');
    const previous = keywordData.filter((k:any) => k.dateRangeLabel === 'previous');
    const sum = (arr: any[]) => arr.reduce((acc, curr) => ({ impressions: acc.impressions + curr.impressions, clicks: acc.clicks + curr.clicks }), { impressions: 0, clicks: 0 });
    const cSum = sum(current); const pSum = sum(previous);
    const getChange = (c: number, p: number) => p === 0 ? 0 : ((c - p) / p) * 100;
    return { current: cSum, changes: { impressions: getChange(cSum.impressions, pSum.impressions), clicks: getChange(cSum.clicks, pSum.clicks), ctr: getChange(cSum.clicks/(cSum.impressions||1), pSum.clicks/(pSum.impressions||1)) }, abs: { impressions: cSum.impressions - pSum.impressions, clicks: cSum.clicks - pSum.clicks } };
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard title="Impresiones GSC" value={gscStats.current.impressions} comparison={comparisonEnabled ? gscStats.changes.impressions : undefined} absoluteChange={comparisonEnabled ? gscStats.abs.impressions : undefined} icon={<Eye />} />
        <KpiCard title="Clicks GSC" value={gscStats.current.clicks} comparison={comparisonEnabled ? gscStats.changes.clicks : undefined} absoluteChange={comparisonEnabled ? gscStats.abs.clicks : undefined} icon={<MousePointer2 />} />
        <KpiCard title="CTR GSC" value={`${(gscStats.current.impressions > 0 ? (gscStats.current.clicks/gscStats.current.impressions)*100 : 0).toFixed(2)}%`} comparison={comparisonEnabled ? gscStats.changes.ctr : undefined} icon={<Percent />} />
        <KpiCard title="CR GA4 Organic" value={`${organicGa4.current.cr.toFixed(2)}%`} comparison={comparisonEnabled ? organicGa4.changes.cr : undefined} icon={<TrendingUp />} color="emerald" />
        <KpiCard title="Revenue GA4" value={`€${organicGa4.current.revenue.toLocaleString()}`} comparison={comparisonEnabled ? organicGa4.changes.revenue : undefined} absoluteChange={comparisonEnabled ? organicGa4.abs.revenue : undefined} icon={<Tag />} color="emerald" prefix="€" />
        <KpiCard title="Ventas GA4" value={organicGa4.current.sales} comparison={comparisonEnabled ? organicGa4.changes.sales : undefined} absoluteChange={comparisonEnabled ? organicGa4.abs.revenue : undefined} icon={<ShoppingBag />} color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {[ {title: 'Clicks por Mercado', key: 'clicks', color: '#6366f1'}, {title: 'Visibilidad por Mercado', key: 'impressions', color: '#0ea5e9'} ].map(chart => (
          <div key={chart.key} className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm h-[400px]">
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-8">{chart.title}</h4>
            {countryStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={countryStats}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="country" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} /><YAxis axisLine={false} tickLine={false} tick={{fontSize: 9}} /><Tooltip cursor={{fill: '#f8fafc'}} /><Bar dataKey={chart.key} fill={chart.color} radius={[6, 6, 0, 0]} /></BarChart>
              </ResponsiveContainer>
            ) : <EmptyState text="Sincronizando mercados..." />}
          </div>
        ))}
      </div>

      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Análisis de Eficiencia por Mercado (Organic Search)</h4>
            <p className="text-[11px] font-bold text-slate-600">Tráfico (X) vs Revenue (Y) | Tamaño = Revenue</p>
          </div>
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
             <Activity className="w-4 h-4" />
          </div>
        </div>
        <div className="h-[450px]">
          {scatterData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" dataKey="traffic" name="Tráfico" unit=" ses." axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} />
                <YAxis type="number" dataKey="revenue" name="Revenue" unit=" €" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} tickFormatter={(val) => `€${val.toLocaleString()}`} />
                <ZAxis type="number" dataKey="revenue" range={[100, 2000]} name="Valor de Mercado" unit=" €" />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-white/10">
                        <p className="text-[10px] font-black uppercase tracking-widest mb-2 border-b border-white/10 pb-2">{d.country}</p>
                        <div className="space-y-1">
                          <p className="text-[9px] flex justify-between gap-4"><span>Tráfico:</span> <span className="font-bold">{d.traffic.toLocaleString()} ses.</span></p>
                          <p className="text-[9px] flex justify-between gap-4"><span>Revenue:</span> <span className="font-bold text-emerald-400">€{d.revenue.toLocaleString()}</span></p>
                          <p className="text-[9px] flex justify-between gap-4"><span>Eficiencia:</span> <span className="font-bold text-indigo-400">€{(d.revenue / d.traffic).toFixed(2)}/ses.</span></p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }} />
                <Scatter name="Mercados Orgánicos" data={scatterData}>
                  {scatterData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.revenue > 10000 ? '#10b981' : entry.revenue > 5000 ? '#6366f1' : '#f59e0b'} fillOpacity={0.6} strokeWidth={2} stroke={entry.revenue > 10000 ? '#059669' : entry.revenue > 5000 ? '#4f46e5' : '#d97706'} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No hay suficientes datos orgánicos para el Scatter Plot..." />}
        </div>
      </div>

      {/* Share of Voice vs. Share of Wallet */}
      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Share of Voice vs. Share of Wallet</h4>
            <p className="text-[11px] font-bold text-slate-600">Comparativa: Visibilidad (% Impr GSC) vs Rentabilidad Orgánica (% Rev GA4)</p>
          </div>
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
             <BarChart3 className="w-4 h-4" />
          </div>
        </div>
        <div className="h-[400px]">
          {shareOfVoiceWalletData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={shareOfVoiceWalletData} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="country" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} unit="%" />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  formatter={(val: number) => [`${val.toFixed(1)}%`, '']}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{fontSize: 9, fontWeight: 800, textTransform: 'uppercase', paddingBottom: 20}} />
                <Bar name="Share of Voice (Impr %)" dataKey="sov" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                <Bar name="Share of Wallet (Revenue %)" dataKey="sow" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState text="Datos insuficientes para la comparativa de Shares..." />}
        </div>
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
      const url = k.landingPage || 'Unknown URL';
      if (!map[url]) map[url] = { url, clicks: 0, impressions: 0, prevClicks: 0, children: {} };
      if (k.dateRangeLabel === 'current') { map[url].clicks += k.clicks; map[url].impressions += k.impressions; }
      else { map[url].prevClicks += k.clicks; }
      const kw = k.keyword || 'Not provided';
      if (!map[url].children[kw]) map[url].children[kw] = { keyword: kw, queryType: k.queryType, clicks: 0, impressions: 0, prevClicks: 0 };
      if (k.dateRangeLabel === 'current') { map[url].children[kw].clicks += k.clicks; map[url].children[kw].impressions += k.impressions; }
      else { map[url].children[kw].prevClicks += k.clicks; }
    });
    return Object.values(map).map((page: any) => ({
      ...page,
      ctr: page.impressions > 0 ? (page.clicks / page.impressions) * 100 : 0,
      clickChange: page.prevClicks === 0 ? 0 : ((page.clicks - page.prevClicks) / page.prevClicks) * 100,
      children: Object.values(page.children).sort((a: any, b: any) => b.clicks - a.clicks)
    }))
    .filter((p: any) => p.url.toLowerCase().includes(searchTerm.toLowerCase()) || p.children.some((c: any) => c.keyword.toLowerCase().includes(searchTerm.toLowerCase())))
    .sort((a: any, b: any) => b.clicks - a.clicks);
  }, [keywords, searchTerm]);

  return (
    <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
      <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50">
        <div><h3 className="text-xl font-black mb-1">Deep Dive SEO</h3><p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">URLs y Palabras Clave</p></div>
        <div className="relative w-full md:w-80"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" /><input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-medium focus:ring-2 ring-indigo-500/10 outline-none" /></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs table-fixed min-w-[1000px]">
          <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[9px] tracking-widest border-b border-slate-100">
            <tr><th className="px-6 py-4 w-16"></th><th className="px-4 py-4 w-[50%]">Página</th><th className="px-6 py-4 text-center w-32">Impr.</th><th className="px-6 py-4 text-center w-32">Clicks</th><th className="px-6 py-4 text-center w-28">CTR</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {aggregatedByUrl.slice(0, 100).map((row: any) => (
              <React.Fragment key={row.url}>
                <tr onClick={() => toggleUrl(row.url)} className="group cursor-pointer hover:bg-slate-50/50 transition-all">
                  <td className="pl-6 py-5 flex justify-center">{expandedUrls.has(row.url) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
                  <td className="px-4 py-5 font-bold text-slate-900 break-all">{row.url}</td>
                  <td className="px-6 py-5 text-center text-slate-500">{row.impressions.toLocaleString()}</td>
                  <td className="px-6 py-5 text-center font-black text-slate-900">{row.clicks.toLocaleString()}</td>
                  <td className="px-6 py-5 text-center"><span className="px-2 py-1 rounded-lg bg-slate-100 font-bold">{row.ctr.toFixed(1)}%</span></td>
                </tr>
                {expandedUrls.has(row.url) && row.children.map((child: any, ci: number) => (
                  <tr key={ci} className="bg-slate-50/30 border-l-4 border-indigo-500">
                    <td className="py-3"></td><td className="px-4 py-3 pl-14"><div className="flex items-center gap-3"><span className="text-slate-700 font-semibold">{child.keyword}</span><span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${child.queryType === 'Branded' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>{child.queryType}</span></div></td>
                    <td className="px-6 py-3 text-center text-slate-400">{child.impressions.toLocaleString()}</td><td className="px-6 py-3 text-center text-slate-600 font-bold">{child.clicks.toLocaleString()}</td><td className="px-6 py-3 text-center text-slate-400 font-bold">{(child.impressions > 0 ? child.clicks/child.impressions*100 : 0).toFixed(1)}%</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {aggregatedByUrl.length === 0 && <div className="px-6 py-20 text-center text-slate-400 italic font-medium">No se han encontrado datos. Prueba a ampliar el rango de fechas.</div>}
      </div>
    </div>
  );
};

const SidebarLink = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black transition-all ${active ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
    {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-4 h-4' })} {label}
  </button>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="h-full flex flex-col items-center justify-center py-10 opacity-50">
    <Activity className="w-8 h-8 text-slate-200 mb-4" /><p className="text-slate-400 italic text-xs font-medium">{text}</p>
  </div>
);

export default App;
