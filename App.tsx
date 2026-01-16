import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  BarChart3, Search, Calendar, ArrowUpRight, ArrowDownRight, TrendingUp, Sparkles, Globe, Tag, MousePointer2, Eye, Percent, ShoppingBag, LogOut, RefreshCw, CheckCircle2, Layers, Activity, Filter, ArrowRight, Target, FileText, AlertCircle, Settings2, Info, Menu, X, ChevronDown, ChevronRight, ExternalLink, HardDrive, Clock, Map, Zap, AlertTriangle, Cpu, Key, PieChart as PieIcon, Check
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Legend, LineChart, Line, ScatterChart, Scatter, ZAxis, Cell, PieChart, Pie
} from 'recharts';
import { DashboardTab, DashboardFilters, DailyData, KeywordData, Ga4Property, GscSite, QueryType, ChannelType } from './types';
import { getDashboardInsights, getOpenAiInsights } from './geminiService';
import GoogleLogin from './GoogleLogin'; 

const CLIENT_ID = "333322783684-pjhn2omejhngckfd46g8bh2dng9dghlc.apps.googleusercontent.com"; 
const SCOPE_GA4 = "https://www.googleapis.com/auth/analytics.readonly";
const SCOPE_GSC = "https://www.googleapis.com/auth/webmasters.readonly";

const CURRENCY_SYMBOLS: Record<string, string> = {
  'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥', 'CAD': 'C$', 'AUD': 'A$', 'CHF': 'CHF', 'CNY': '¥', 'INR': '₹', 'MXN': '$', 'BRL': 'R$', 'PLN': 'zł'
};

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

const DateRangeSelector: React.FC<{
  filters: DashboardFilters;
  setFilters: (f: DashboardFilters) => void;
}> = ({ filters, setFilters }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const ranges = [
    { label: 'Today', getValue: () => { const d = new Date(); return { start: d, end: d }; } },
    { label: 'Yesterday', getValue: () => { const d = new Date(); d.setDate(d.getDate() - 1); return { start: d, end: d }; } },
    { label: 'This week', getValue: () => { const d = new Date(); const start = getStartOfWeek(d); return { start, end: d }; } },
    { label: 'This month', getValue: () => { const d = new Date(); return { start: new Date(d.getFullYear(), d.getMonth(), 1), end: new Date(d.getFullYear(), d.getMonth() + 1, 0) }; } },
    { label: 'This month to date', getValue: () => { const d = new Date(); return { start: new Date(d.getFullYear(), d.getMonth(), 1), end: d }; } },
    { label: 'This quarter', getValue: () => { const d = new Date(); const q = Math.floor(d.getMonth() / 3); return { start: new Date(d.getFullYear(), q * 3, 1), end: new Date(d.getFullYear(), (q + 1) * 3, 0) }; } },
    { label: 'This quarter to date', getValue: () => { const d = new Date(); const q = Math.floor(d.getMonth() / 3); return { start: new Date(d.getFullYear(), q * 3, 1), end: d }; } },
    { label: 'This year', getValue: () => { const d = new Date(); return { start: new Date(d.getFullYear(), 0, 1), end: new Date(d.getFullYear(), 11, 31) }; } },
    { label: 'This year to date', getValue: () => { const d = new Date(); return { start: new Date(d.getFullYear(), 0, 1), end: d }; } },
    { label: 'Last 7 days', getValue: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 7); return { start, end }; } },
    { label: 'Last 14 days', getValue: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 14); return { start, end }; } },
    { label: 'Last 28 days', getValue: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 28); return { start, end }; } },
    { label: 'Last 30 days', getValue: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 30); return { start, end }; } },
    { label: 'Last week', getValue: () => { const d = new Date(); d.setDate(d.getDate() - 7); const start = getStartOfWeek(d); const end = new Date(start); end.setDate(end.getDate() + 6); return { start, end }; } },
    { label: 'Last month', getValue: () => { const d = new Date(); return { start: new Date(d.getFullYear(), d.getMonth() - 1, 1), end: new Date(d.getFullYear(), d.getMonth(), 0) }; } },
    { label: 'Last quarter', getValue: () => { const d = new Date(); const q = Math.floor(d.getMonth() / 3) - 1; return { start: new Date(d.getFullYear(), q * 3, 1), end: new Date(d.getFullYear(), (q + 1) * 3, 0) }; } },
    { label: 'Last year', getValue: () => { const d = new Date(); return { start: new Date(d.getFullYear() - 1, 0, 1), end: new Date(d.getFullYear() - 1, 11, 31) }; } },
  ];

  const handleRangeSelect = (range: any) => {
    const { start, end } = range.getValue();
    setFilters({ ...filters, dateRange: { start: formatDate(start), end: formatDate(end) } });
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-indigo-300 transition-all text-[10px] font-bold"
      >
        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
        <span className="text-slate-900">{filters.dateRange.start}</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-900">{filters.dateRange.end}</span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-[480px] bg-white rounded-3xl shadow-2xl border border-slate-200 z-[100] overflow-hidden flex animate-in fade-in zoom-in-95 duration-200">
          <div className="w-1/2 border-r border-slate-100 bg-slate-50/50 max-h-[400px] overflow-y-auto custom-scrollbar">
            <div className="p-2 grid grid-cols-1 gap-0.5">
              {ranges.map((r) => (
                <button
                  key={r.label}
                  onClick={() => handleRangeSelect(r)}
                  className="px-4 py-2 text-left text-[10px] font-black uppercase text-slate-600 hover:bg-white hover:text-indigo-600 hover:shadow-sm rounded-xl transition-all"
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="w-1/2 p-6 flex flex-col gap-6">
            <div>
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Custom Range</h4>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-500 uppercase">Start Date</label>
                  <input 
                    type="date" 
                    value={filters.dateRange.start} 
                    onChange={e => setFilters({...filters, dateRange: {...filters.dateRange, start: e.target.value}})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:ring-1 ring-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-500 uppercase">End Date</label>
                  <input 
                    type="date" 
                    value={filters.dateRange.end} 
                    onChange={e => setFilters({...filters, dateRange: {...filters.dateRange, end: e.target.value}})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:ring-1 ring-indigo-500"
                  />
                </div>
              </div>
            </div>
            <div className="mt-auto pt-6 border-t border-slate-100">
              <button 
                onClick={() => setIsOpen(false)}
                className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-lg"
              >
                Apply Range
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ComparisonTooltip = ({ active, payload, label, currency = false, currencySymbol = '£' }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-white/10 min-w-[200px]">
        <p className="text-[10px] font-black uppercase tracking-widest mb-3 text-slate-400 border-b border-white/5 pb-2">{label}</p>
        <div className="space-y-3">
          {payload.map((entry: any, index: number) => {
            if (entry.name.includes('(Prev)')) return null; 
            const prevEntry = payload.find((p: any) => p.name === entry.name.replace('(Cur)', '(Prev)'));
            const curVal = entry.value;
            const prevVal = prevEntry ? prevEntry.value : null;
            const diff = prevVal !== null && prevVal !== 0 ? ((curVal - prevVal) / prevVal) * 100 : 0;

            return (
              <div key={index} className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.stroke || entry.color }} />
                  <span className="text-[10px] font-black text-white">{entry.name.replace('(Cur)', '')}</span>
                </div>
                <div className="flex justify-between items-baseline gap-4 ml-4">
                  <span className="text-[11px] font-bold">
                    {currency ? `${currencySymbol}${curVal.toLocaleString()}` : curVal.toLocaleString()}
                  </span>
                  {prevVal !== null && (
                    <div className={`flex items-center text-[9px] font-black ${diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {diff >= 0 ? '+' : ''}{diff.toFixed(1)}%
                    </div>
                  )}
                </div>
                {prevVal !== null && (
                  <div className="flex justify-between text-[8px] text-slate-500 ml-4 font-medium uppercase italic">
                    <span>Previous:</span>
                    <span>{currency ? `${currencySymbol}${prevVal.toLocaleString()}` : prevVal.toLocaleString()}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

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
  const [currencySymbol, setCurrencySymbol] = useState('£');
  
  const [ga4Search, setGa4Search] = useState('');
  const [gscSearch, setGscSearch] = useState('');
  
  const [realDailyData, setRealDailyData] = useState<DailyData[]>([]);
  const [realKeywordData, setRealKeywordData] = useState<KeywordData[]>([]);
  const [gscDailyTotals, setGscDailyTotals] = useState<any[]>([]);
  const [gscTotals, setGscTotals] = useState<{current: any, previous: any} | null>(null);
  
  const [isLoadingGa4, setIsLoadingGa4] = useState(false);
  const [isLoadingGsc, setIsLoadingGsc] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [brandRegexStr, setBrandRegexStr] = useState('shop|brand|pro|sports');
  const [grouping, setGrouping] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai'>(() => {
    const saved = localStorage.getItem('ai_provider');
    return (saved as 'gemini' | 'openai') || 'gemini';
  });
  const [openaiKey, setOpenaiKey] = useState(() => localStorage.getItem('openai_api_key') || '');

  const [activeTab, setActiveTab] = useState<DashboardTab>(DashboardTab.ORGANIC_VS_PAID);
  
  const [tabInsights, setTabInsights] = useState<Record<string, string | null>>({
    [DashboardTab.ORGANIC_VS_PAID]: null,
    [DashboardTab.SEO_BY_COUNTRY]: null,
    [DashboardTab.KEYWORD_DEEP_DIVE]: null
  });
  const [loadingInsights, setLoadingInsights] = useState(false);

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

  const tokenClientGa4 = useRef<any>(null);
  const tokenClientGsc = useRef<any>(null);

  const isBranded = (text: string) => {
    if (!text || text.trim() === '') return false;
    try {
      const regex = new RegExp(brandRegexStr, 'i');
      return regex.test(text.trim().toLowerCase());
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
      if (!resp.ok) throw new Error(`GA4 Admin Status: ${resp.status}`);
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
      setError("Error connecting to GA4 Admin API.");
    }
  };

  const fetchGa4PropertyDetails = async (token: string, propertyId: string) => {
    try {
      const resp = await fetch(`https://analyticsadmin.googleapis.com/v1beta/${propertyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) return;
      const data = await resp.json();
      if (data.currencyCode) {
        setCurrencySymbol(CURRENCY_SYMBOLS[data.currencyCode] || data.currencyCode);
      }
    } catch (e) {
      console.error("Error fetching property details:", e);
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
      if (!resp.ok) throw new Error(`GSC Sites Status: ${resp.status}`);
      const data = await resp.json();
      const sites = data.siteEntry || [];
      setAvailableSites(sites);
      if (sites.length > 0 && !gscAuth?.site) {
        setGscAuth({ token, site: sites[0] });
      }
    } catch (e) {
      console.error(e);
      setError("Error connecting to Search Console API.");
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
      setError(`GA4 Error: ${err.message}`);
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
        // Obtenemos el máximo de queries permitidas para categorización exacta
        const respGranular = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/searchAnalytics/query`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${gscAuth.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate: start,
            endDate: end,
            dimensions: ['query', 'date'],
            rowLimit: 25000 
          })
        });
        const dataGranular = await respGranular.json();
        if (dataGranular.error) throw new Error(dataGranular.error.message);

        // Obtenemos los totales ABSOLUTOS del sitio (100% de clicks/impresiones del sitio)
        const respTotals = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/searchAnalytics/query`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${gscAuth.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate: start,
            endDate: end,
            dimensions: ['date'],
          })
        });
        const dataTotals = await respTotals.json();
        const totalAggregated = (dataTotals.rows || []).reduce((acc: any, row: any) => ({
          clicks: acc.clicks + row.clicks,
          impressions: acc.impressions + row.impressions,
        }), { clicks: 0, impressions: 0 });

        const dailyTotals = (dataTotals.rows || []).map((row: any) => ({
          date: row.keys[0],
          clicks: row.clicks,
          impressions: row.impressions,
          label
        }));

        const mapped = (dataGranular.rows || []).map((row: any) => ({
            keyword: row.keys[0] || '',
            landingPage: '',
            country: 'All',
            queryType: 'Non-Branded' as QueryType,
            date: row.keys[1] || '',
            dateRangeLabel: label,
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: (row.ctr || 0) * 100,
            sessions: 0, conversionRate: 0, revenue: 0, sales: 0, addToCarts: 0, checkouts: 0
        }));

        return { mapped, totals: totalAggregated, dailyTotals };
      };

      let combinedKeywords: KeywordData[] = [];
      let combinedDailyTotals: any[] = [];
      let currentTotals = { clicks: 0, impressions: 0 };
      let previousTotals = { clicks: 0, impressions: 0 };

      const curData = await fetchOneRange(filters.dateRange.start, filters.dateRange.end, 'current');
      combinedKeywords = curData.mapped;
      combinedDailyTotals = curData.dailyTotals;
      currentTotals = curData.totals;

      if (filters.comparison.enabled) {
        const comp = getComparisonDates();
        const prevData = await fetchOneRange(comp.start, comp.end, 'previous');
        combinedKeywords = [...combinedKeywords, ...prevData.mapped];
        combinedDailyTotals = [...combinedDailyTotals, ...prevData.dailyTotals];
        previousTotals = prevData.totals;
      }
      
      setRealKeywordData(combinedKeywords);
      setGscDailyTotals(combinedDailyTotals);
      setGscTotals({ current: currentTotals, previous: previousTotals });
    } catch (err: any) {
      console.error(err);
      setError(`GSC Error: ${err.message}`);
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
      fetchGa4PropertyDetails(ga4Auth.token, ga4Auth.property.id);
    } 
  }, [ga4Auth?.property?.id, filters.dateRange, filters.ga4Dimension, filters.comparison.enabled, filters.comparison.type]);

  useEffect(() => { 
    if (gscAuth?.token && gscAuth.site) fetchGscData(); 
  }, [gscAuth?.site?.siteUrl, filters.dateRange, filters.comparison.enabled, filters.comparison.type]);

  const filteredDailyData = useMemo((): DailyData[] => {
    return realDailyData.filter(d => {
      const countryMatch = filters.country === 'All' || d.country === filters.country;
      return countryMatch;
    });
  }, [realDailyData, filters]);

  const filteredKeywordData = useMemo((): KeywordData[] => {
    return realKeywordData.filter(k => {
      const isActuallyBranded = isBranded(k.keyword);
      const queryTypeActual = isActuallyBranded ? 'Branded' : 'Non-Branded';
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
    const total = aggregate(filteredDailyData);
    const organic = aggregate(filteredDailyData.filter(d => d.channel.toLowerCase().includes('organic')));
    const paid = aggregate(filteredDailyData.filter(d => d.channel.toLowerCase().includes('paid') || d.channel.toLowerCase().includes('cpc')));
    
    const searchWeightSessions = total.current.sessions > 0 ? ((organic.current.sessions + paid.current.sessions) / total.current.sessions) * 100 : 0;
    const prevSearchWeightSessions = total.previous.sessions > 0 ? ((organic.previous.sessions + paid.previous.sessions) / total.previous.sessions) * 100 : 0;
    const changeSearchWeightSessions = prevSearchWeightSessions === 0 ? 0 : ((searchWeightSessions - prevSearchWeightSessions) / prevSearchWeightSessions) * 100;

    const searchWeightRev = total.current.revenue > 0 ? ((organic.current.revenue + paid.current.revenue) / total.current.revenue) * 100 : 0;
    const prevSearchWeightRev = total.previous.revenue > 0 ? ((organic.previous.revenue + paid.previous.revenue) / total.previous.revenue) * 100 : 0;
    const changeSearchWeightRev = prevSearchWeightRev === 0 ? 0 : ((searchWeightRev - prevSearchWeightRev) / prevSearchWeightRev) * 100;

    return { 
      total, 
      organic, 
      paid, 
      shares: {
        sessions: { current: searchWeightSessions, change: changeSearchWeightSessions },
        revenue: { current: searchWeightRev, change: changeSearchWeightRev }
      } 
    };
  }, [filteredDailyData]);

  const handleGenerateInsights = async () => {
    setLoadingInsights(true);
    setError(null);
    try {
      let summary = "";
      const dashboardName = activeTab === DashboardTab.ORGANIC_VS_PAID ? "Organic vs Paid Performance" : 
                           (activeTab === DashboardTab.SEO_BY_COUNTRY ? "SEO Performance by Country" : 
                           "Deep URL and Keyword Analysis");

      if (activeTab === DashboardTab.ORGANIC_VS_PAID) {
        summary = `
          Context: Analysis of Organic vs Paid Search funnels.
          Organic Stats: ${channelStats.organic.current.sessions} sessions, ${currencySymbol}${channelStats.organic.current.revenue.toLocaleString()} revenue, ${channelStats.organic.current.cr.toFixed(2)}% CR.
          Paid Stats: ${channelStats.paid.current.sessions} sessions, ${currencySymbol}${channelStats.paid.current.revenue.toLocaleString()} revenue, ${channelStats.paid.current.cr.toFixed(2)}% CR.
          Search Weight: ${channelStats.shares.sessions.current.toFixed(1)}% share.
        `;
      } else if (activeTab === DashboardTab.SEO_BY_COUNTRY) {
        summary = `
          Context: Market-level SEO efficiency.
          Organic GA4 Rev: ${currencySymbol}${channelStats.organic.current.revenue.toLocaleString()}.
        `;
      }

      let insights: string | undefined;
      
      if (aiProvider === 'openai') {
        if (!openaiKey) throw new Error("Please enter your OpenAI API Key in the sidebar.");
        insights = await getOpenAiInsights(openaiKey, summary, dashboardName);
      } else {
        insights = await getDashboardInsights(summary, dashboardName);
      }
      
      setTabInsights((prev) => ({ ...prev, [activeTab as string]: insights || null }));
    } catch (err: any) { 
      console.error(err); 
      setError(err.message || "Failed to generate insights.");
    } finally { 
      setLoadingInsights(false); 
    }
  };

  const isAnythingLoading = isLoadingGa4 || isLoadingGsc;

  const filteredProperties = useMemo(() => availableProperties.filter(p => p.name.toLowerCase().includes(ga4Search.toLowerCase())), [availableProperties, ga4Search]);
  const filteredSites = useMemo(() => availableSites.filter(s => s.siteUrl.toLowerCase().includes(gscSearch.toLowerCase())), [availableSites, gscSearch]);

  const uniqueCountries = useMemo(() => {
    const set = new Set([...realDailyData.map(d => d.country), ...realKeywordData.map(k => k.country)]);
    return Array.from(set).filter(c => c && c !== 'Other' && c !== 'Unknown').sort();
  }, [realDailyData, realKeywordData]);

  useEffect(() => { localStorage.setItem('ai_provider', aiProvider); }, [aiProvider]);
  useEffect(() => { localStorage.setItem('openai_api_key', openaiKey); }, [openaiKey]);

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
          <h1 className="text-3xl md:text-4xl font-black mb-4 tracking-tighter">SEO & Paid Reporting</h1>
          <p className="text-slate-400 font-medium mb-10 text-base md:text-lg">Sign in with Google to access your dashboard.</p>
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
            <SidebarLink active={activeTab === DashboardTab.SEO_BY_COUNTRY} onClick={() => {setActiveTab(DashboardTab.SEO_BY_COUNTRY); setIsSidebarOpen(false);}} icon={<Globe />} label="Performance by Country" />
            <SidebarLink active={activeTab === DashboardTab.KEYWORD_DEEP_DIVE} onClick={() => {setActiveTab(DashboardTab.KEYWORD_DEEP_DIVE); setIsSidebarOpen(false);}} icon={<Target />} label="Deep SEO Analysis" />
          </nav>
          
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 mb-6">
            <div className="flex items-center gap-2 mb-4 text-emerald-400">
              <Cpu className="w-3.5 h-3.5" />
              <h4 className="text-[9px] font-black uppercase tracking-widest">AI Analysis Engines</h4>
            </div>
            
            <div className="flex bg-slate-900/50 rounded-xl p-1 mb-4">
              <button 
                onClick={() => setAiProvider('gemini')}
                className={`flex-1 py-1.5 text-[8px] font-black uppercase rounded-lg transition-all ${aiProvider === 'gemini' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}
              >
                Gemini
              </button>
              <button 
                onClick={() => setAiProvider('openai')}
                className={`flex-1 py-1.5 text-[8px] font-black uppercase rounded-lg transition-all ${aiProvider === 'openai' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500'}`}
              >
                OpenAI
              </button>
            </div>

            {aiProvider === 'openai' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest">OpenAI API Key</label>
                  <Key className="w-2.5 h-2.5 text-emerald-500" />
                </div>
                <input 
                  type="password" 
                  value={openaiKey} 
                  onChange={e => setOpenaiKey(e.target.value)} 
                  className="w-full bg-slate-900 border border-white/10 rounded-lg text-[10px] p-2 focus:ring-1 ring-emerald-500 outline-none transition-all" 
                  placeholder="sk-..." 
                />
              </div>
            )}
            
            {aiProvider === 'gemini' && (
              <p className="text-[8px] font-black text-indigo-400/70 uppercase tracking-widest text-center py-2 border border-dashed border-indigo-500/20 rounded-xl">
                Gemini 3 Pro Active
              </p>
            )}
          </div>

          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 mb-6">
            <div className="flex items-center gap-2 mb-3 text-indigo-400"><Settings2 className="w-3.5 h-3.5" /><h4 className="text-[9px] font-black uppercase tracking-widest">SEO Settings</h4></div>
            <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest block mb-1">Branded Regex</label>
            <input type="text" value={brandRegexStr} onChange={e => setBrandRegexStr(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg text-[10px] p-2 focus:ring-1 ring-indigo-500 outline-none" placeholder="brand|shop" />
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
                      <button onClick={handleConnectGa4} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-2"><ExternalLink className="w-3 h-3" /> Connect GA4</button>
                    ) : (
                      <div className="space-y-1.5">
                        <input type="text" placeholder="Search..." value={ga4Search} onChange={e => setGa4Search(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg text-[9px] px-2 py-1.5 outline-none focus:ring-1 ring-indigo-500" />
                        <select className="w-full bg-slate-900 border border-white/10 rounded-lg text-[10px] p-2 outline-none" value={ga4Auth?.property?.id || ''} onChange={e => setGa4Auth({...ga4Auth, property: availableProperties.find(p => p.id === e.target.value) || null})}>
                          {filteredProperties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                    )}
                 </div>
                 <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest block">GSC Domain</label>
                    {!gscAuth?.token ? (
                      <button onClick={handleConnectGsc} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-2"><ExternalLink className="w-3 h-3" /> Connect GSC</button>
                    ) : (
                      <div className="space-y-1.5">
                        <input type="text" placeholder="Search..." value={gscSearch} onChange={e => setGscSearch(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg text-[9px] px-2 py-1.5 outline-none focus:ring-1 ring-indigo-500" />
                        <select className="w-full bg-slate-900 border border-white/10 rounded-lg text-[10px] p-2 outline-none" value={gscAuth?.site?.siteUrl || ''} onChange={e => setGscAuth({...gscAuth, site: availableSites.find(s => s.siteUrl === e.target.value) || null})}>
                          {filteredSites.map(s => <option key={s.siteUrl} value={s.siteUrl}>{s.siteUrl}</option>)}
                        </select>
                      </div>
                    )}
                 </div>
              </div>
              <button onClick={handleLogout} className="w-full mt-6 py-2 text-[9px] font-black text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-2"><LogOut className="w-3 h-3" /> Sign Out</button>
           </div>
        </div>
      </aside>

      <main className="flex-1 xl:ml-80 p-5 md:p-8 xl:p-12 transition-all overflow-x-hidden">
        <header className="flex flex-col gap-6 mb-10">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${isAnythingLoading ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isLoadingGa4 ? 'Syncing GA4...' : isLoadingGsc ? 'Syncing GSC...' : 'Dashboard Active'}</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">
                {activeTab === DashboardTab.ORGANIC_VS_PAID && "Organic vs Paid Performance"}
                {activeTab === DashboardTab.SEO_BY_COUNTRY && "SEO Performance by Country"}
                {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && "URL & Keyword Analysis"}
              </h2>
            </div>
            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="comp_enabled" checked={filters.comparison.enabled} onChange={e => setFilters({...filters, comparison: {...filters.comparison, enabled: e.target.checked}})} className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600" />
                  <label htmlFor="comp_enabled" className="text-[10px] font-black uppercase text-slate-600 tracking-tight cursor-pointer">Compare</label>
                </div>
                {filters.comparison.enabled && (
                  <select className="bg-transparent text-[10px] font-bold text-indigo-600 outline-none cursor-pointer" value={filters.comparison.type} onChange={e => setFilters({...filters, comparison: {...filters.comparison, type: e.target.value as any}})}>
                    <option value="previous_period">vs Previous</option>
                    <option value="previous_year">vs YoY</option>
                  </select>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-4 w-full">
            <DateRangeSelector filters={filters} setFilters={setFilters} />
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white p-1.5 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 px-3 py-1.5 sm:border-r border-slate-100">
                 <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                 <select className="bg-transparent text-[10px] font-black uppercase outline-none cursor-pointer w-full" value={filters.ga4Dimension} onChange={e => setFilters({...filters, ga4Dimension: e.target.value})}>
                    {availableDimensions.map(d => (<option key={d.value} value={d.value}>{d.label}</option>))}
                    {availableDimensions.length === 0 && <option value="sessionDefaultChannelGroup">Channel Grouping</option>}
                 </select>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 sm:border-r border-slate-100">
                 <Globe className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                 <select className="bg-transparent text-[10px] font-black uppercase outline-none cursor-pointer w-full" value={filters.country} onChange={e => setFilters({...filters, country: e.target.value})}>
                    <option value="All">All Countries</option>
                    {uniqueCountries.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5">
                 <Tag className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                 <select className="bg-transparent text-[10px] font-black uppercase outline-none cursor-pointer w-full" value={filters.queryType} onChange={e => setFilters({...filters, queryType: e.target.value as any})}>
                    <option value="All">Query Type</option>
                    <option value="Branded">Branded</option>
                    <option value="Non-Branded">Non-Branded</option>
                 </select>
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-8 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-3 text-rose-700 shadow-sm animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-3"><AlertCircle className="w-5 h-5 flex-shrink-0" /><p className="font-bold text-xs">{error}</p></div>
            <button onClick={() => setError(null)} className="p-1.5 hover:bg-rose-100 rounded-full transition-colors"><X className="w-4 h-4" /></button>
          </div>
        )}

        {tabInsights[activeTab as string] && (
          <div className="mb-10 bg-slate-900 rounded-[32px] p-8 md:p-10 text-white shadow-2xl relative animate-in fade-in zoom-in-95 duration-500 overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
              {aiProvider === 'openai' ? <Cpu className="w-48 h-48 text-emerald-500" /> : <Sparkles className="w-48 h-48 text-indigo-500" />}
            </div>
            <div className="flex justify-between items-start mb-6 z-10 relative">
              <div className="flex items-center gap-3">
                {aiProvider === 'openai' ? <Cpu className="w-5 h-5 text-emerald-400" /> : <Sparkles className="w-5 h-5 text-indigo-400" />}
                <div className="flex flex-col">
                  <h3 className="text-xl font-black">Strategic Report: {activeTab === DashboardTab.ORGANIC_VS_PAID ? "Channels" : activeTab === DashboardTab.SEO_BY_COUNTRY ? "Markets" : "Deep Dive"}</h3>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Generated by {aiProvider === 'openai' ? 'OpenAI GPT-4o-mini' : 'Google Gemini 3 Pro'}</p>
                </div>
              </div>
              <button onClick={() => setTabInsights({...tabInsights, [activeTab as string]: null})} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="prose prose-invert max-w-none font-medium text-sm md:text-base leading-relaxed z-10 relative" dangerouslySetInnerHTML={{ __html: (tabInsights[activeTab as string] || '').replace(/\n/g, '<br/>') }} />
          </div>
        )}

        <div className="w-full">
          {activeTab === DashboardTab.ORGANIC_VS_PAID && <OrganicVsPaidView stats={channelStats} data={filteredDailyData} comparisonEnabled={filters.comparison.enabled} grouping={grouping} setGrouping={setGrouping} currencySymbol={currencySymbol} />}
          {activeTab === DashboardTab.SEO_BY_COUNTRY && <SeoMarketplaceView data={filteredDailyData} keywordData={realKeywordData} gscDailyTotals={gscDailyTotals} gscTotals={gscTotals} aggregate={aggregate} comparisonEnabled={filters.comparison.enabled} currencySymbol={currencySymbol} grouping={grouping} isBranded={isBranded} queryTypeFilter={filters.queryType} />}
          {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && <SeoDeepDiveView keywords={filteredKeywordData} searchTerm={searchTerm} setSearchTerm={setSearchTerm} isLoading={isAnythingLoading} comparisonEnabled={filters.comparison.enabled} />}
        </div>

        <div className="mt-12 flex justify-center pb-12">
          <button 
            onClick={handleGenerateInsights} 
            disabled={loadingInsights || isAnythingLoading || (realDailyData.length === 0 && realKeywordData.length === 0)} 
            className={`flex items-center gap-3 px-10 py-4 ${aiProvider === 'openai' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-slate-950 hover:bg-slate-800 shadow-slate-900/20'} text-white rounded-3xl text-xs font-black shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50`}
          >
            {loadingInsights ? <RefreshCw className="w-4 h-4 animate-spin" /> : (aiProvider === 'openai' ? <Cpu className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />)} 
            Generate {activeTab === DashboardTab.ORGANIC_VS_PAID ? 'Channel' : activeTab === DashboardTab.SEO_BY_COUNTRY ? 'Market' : 'SEO'} Insights
          </button>
        </div>
      </main>
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
                <div className={`h-full bg-${color}-600 rounded-lg transition-all duration-1000 ease-out flex items-center justify-end px-3 min-w-[5%]`} style={{ width: `${width}%` }}><span className="text-[8px] font-black text-white">{width.toFixed(1)}%</span></div>
              </div>
              {i < data.length - 1 && (<div className="absolute left-1/2 -bottom-4.5 -translate-x-1/2 z-10 flex flex-col items-center"><div className="w-[1px] h-3 bg-slate-200"></div><ChevronDown className="w-3 h-3 text-slate-300 -mt-1" /></div>)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const OrganicVsPaidView = ({ stats, data, comparisonEnabled, grouping, setGrouping, currencySymbol }: {
  stats: any;
  data: DailyData[];
  comparisonEnabled: boolean;
  grouping: 'daily' | 'weekly' | 'monthly';
  setGrouping: (g: 'daily' | 'weekly' | 'monthly') => void;
  currencySymbol: string;
}) => {
  const [weightMetric, setWeightMetric] = useState<'sessions' | 'revenue'>('sessions');

  const chartData = useMemo(() => {
    if (!data.length) return [];
    
    const curRaw = data.filter(d => d.dateRangeLabel === 'current');
    const prevRaw = data.filter(d => d.dateRangeLabel === 'previous');

    const getBucket = (d: DailyData) => {
      if (grouping === 'weekly') return formatDate(getStartOfWeek(new Date(d.date)));
      if (grouping === 'monthly') return `${d.date.slice(0, 7)}-01`;
      return d.date;
    };

    const buckets = Array.from(new Set(curRaw.map(getBucket))).sort();
    
    const aggregateRange = (items: DailyData[]) => {
      const grouped: Record<string, any> = {};
      items.forEach(d => {
        const key = getBucket(d);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(d);
      });
      return grouped;
    };

    const curGrouped = aggregateRange(curRaw);
    const prevGrouped = aggregateRange(prevRaw);
    const prevBuckets = Object.keys(prevGrouped).sort();

    return buckets.map((bucket, index) => {
      const curItems = curGrouped[bucket] || [];
      const prevBucket = prevBuckets[index];
      const prevItems = prevBucket ? prevGrouped[prevBucket] : [];

      const sum = (items: DailyData[]) => items.reduce((acc, d) => {
        const isOrg = d.channel?.toLowerCase().includes('organic');
        const isPaid = d.channel?.toLowerCase().includes('paid') || d.channel?.toLowerCase().includes('cpc');
        const isSearch = isOrg || isPaid;
        return {
          organic: acc.organic + (isOrg ? d.sessions : 0),
          paid: acc.paid + (isPaid ? d.sessions : 0),
          organicRev: acc.organicRev + (isOrg ? d.revenue : 0),
          paidRev: acc.paidRev + (isPaid ? d.revenue : 0),
          search: acc.search + (isSearch ? d.sessions : 0),
          others: acc.others + (!isSearch ? d.sessions : 0),
          searchRev: acc.searchRev + (isSearch ? d.revenue : 0),
          othersRev: acc.othersRev + (!isSearch ? d.revenue : 0)
        };
      }, { organic: 0, paid: 0, organicRev: 0, paidRev: 0, search: 0, others: 0, searchRev: 0, othersRev: 0 });

      const curSum = sum(curItems);
      const prevSum = sum(prevItems);

      return {
        date: bucket,
        'Organic (Cur)': curSum.organic,
        'Paid (Cur)': curSum.paid,
        'Organic Rev (Cur)': curSum.organicRev,
        'Paid Rev (Cur)': curSum.paidRev,
        'Search Weight (Cur)': weightMetric === 'sessions' ? curSum.search : curSum.searchRev,
        'Others Weight (Cur)': weightMetric === 'sessions' ? curSum.others : curSum.othersRev,
        'Organic (Prev)': prevSum.organic,
        'Paid (Prev)': prevSum.paid,
        'Organic Rev (Prev)': prevSum.organicRev,
        'Paid Rev (Prev)': prevSum.paidRev,
        'Search Weight (Prev)': prevSum.search,
        'Others Weight (Prev)': prevSum.others,
      };
    });
  }, [data, grouping, weightMetric]);

  const organicFunnelData = useMemo(() => [
    { stage: 'Sessions', value: stats.organic.current.sessions },
    { stage: 'Add to Basket', value: stats.organic.current.addToCarts },
    { stage: 'Checkout', value: stats.organic.current.checkouts },
    { stage: 'Sale', value: stats.organic.current.sales },
  ], [stats.organic]);

  const paidFunnelData = useMemo(() => [
    { stage: 'Sessions', value: stats.paid.current.sessions },
    { stage: 'Add to Basket', value: stats.paid.current.addToCarts },
    { stage: 'Checkout', value: stats.paid.current.checkouts },
    { stage: 'Sale', value: stats.paid.current.sales },
  ], [stats.paid]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {[ {type: 'ORG', color: 'indigo', label: 'Organic', s: stats.organic}, {type: 'PAID', color: 'amber', label: 'Paid', s: stats.paid} ].map(ch => (
          <div key={ch.type} className="space-y-4">
            <div className="flex items-center gap-3 px-2"><div className={`w-7 h-7 bg-${ch.color}-600 rounded-lg flex items-center justify-center text-white font-bold text-[9px]`}>{ch.type}</div><h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{ch.label} Performance</h4></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <KpiCard title="Sessions" value={ch.s.current.sessions} comparison={comparisonEnabled ? ch.s.changes.sessions : undefined} absoluteChange={comparisonEnabled ? ch.s.abs.sessions : undefined} icon={<TrendingUp />} color={ch.color} />
              <KpiCard title="Conv. Rate" value={`${ch.s.current.cr.toFixed(2)}%`} comparison={comparisonEnabled ? ch.s.changes.cr : undefined} icon={<Percent />} isPercent color={ch.color} />
              <KpiCard title="Revenue" value={`${currencySymbol}${ch.s.current.revenue.toLocaleString()}`} comparison={comparisonEnabled ? ch.s.changes.revenue : undefined} absoluteChange={comparisonEnabled ? ch.s.abs.revenue : undefined} icon={<Tag />} prefix={currencySymbol} color={ch.type === 'ORG' ? 'emerald' : 'rose'} />
              <KpiCard title="Sales" value={ch.s.current.sales} comparison={comparisonEnabled ? ch.s.changes.sales : undefined} absoluteChange={comparisonEnabled ? ch.s.abs.revenue : undefined} icon={<ShoppingBag />} color={ch.type === 'ORG' ? 'emerald' : 'rose'} />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-8"><h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sessions Performance (Period Overlay)</h4><div className="flex gap-1 bg-slate-100 p-1 rounded-xl">{['daily', 'weekly', 'monthly'].map(g => <button key={g} onClick={() => setGrouping(g as any)} className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg transition-all ${grouping === g ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{g === 'daily' ? 'Day' : g === 'weekly' ? 'Week' : 'Month'}</button>)}</div></div>
        <div className="h-[300px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} />
                <Tooltip content={<ComparisonTooltip />} />
                <Legend verticalAlign="top" align="center" iconType="circle" />
                <Line name="Organic (Cur)" type="monotone" dataKey="Organic (Cur)" stroke="#6366f1" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                <Line name="Paid (Cur)" type="monotone" dataKey="Paid (Cur)" stroke="#f59e0b" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                {comparisonEnabled && <Line name="Organic (Prev)" type="monotone" dataKey="Organic (Prev)" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4 4" dot={false} opacity={0.35} />}
                {comparisonEnabled && <Line name="Paid (Prev)" type="monotone" dataKey="Paid (Prev)" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} opacity={0.35} />}
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No data available to chart" />}
        </div>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Revenue Evolution (Period Overlay)</h4>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl"><Tag className="w-3 h-3" /><span className="text-[9px] font-black uppercase tracking-widest">Currency: {currencySymbol}</span></div>
        </div>
        <div className="h-[300px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} tickFormatter={(val) => `${currencySymbol}${val.toLocaleString()}`} />
                <Tooltip content={<ComparisonTooltip currency currencySymbol={currencySymbol} />} />
                <Legend verticalAlign="top" align="center" iconType="circle" />
                <Line name="Organic Rev (Cur)" type="monotone" dataKey="Organic Rev (Cur)" stroke="#6366f1" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                <Line name="Paid Rev (Cur)" type="monotone" dataKey="Paid Rev (Cur)" stroke="#f59e0b" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                {comparisonEnabled && <Line name="Organic Rev (Prev)" type="monotone" dataKey="Organic Rev (Prev)" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4 4" dot={false} opacity={0.35} />}
                {comparisonEnabled && <Line name="Paid Rev (Prev)" type="monotone" dataKey="Paid Rev (Prev)" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} opacity={0.35} />}
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No revenue data available to chart" />}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <EcommerceFunnel title="Organic Search Funnel" data={organicFunnelData} color="indigo" />
        <EcommerceFunnel title="Paid Search Funnel" data={paidFunnelData} color="amber" />
      </div>

      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div><h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Search Weight Analysis (Superposed)</h4><p className="text-[11px] font-bold text-slate-600">Total Search vs All Other Channels</p></div>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setWeightMetric('sessions')} className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${weightMetric === 'sessions' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Sessions</button>
            <button onClick={() => setWeightMetric('revenue')} className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${weightMetric === 'revenue' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Revenue</button>
          </div>
        </div>
        <div className="h-[400px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} tickFormatter={(val) => weightMetric === 'revenue' ? `${currencySymbol}${val.toLocaleString()}` : val.toLocaleString()} />
                <Tooltip content={<ComparisonTooltip currency={weightMetric === 'revenue'} currencySymbol={currencySymbol} />} />
                <Legend verticalAlign="top" align="center" iconType="circle" />
                <Line name="Search Weight (Cur)" type="monotone" dataKey="Search Weight (Cur)" stroke="#6366f1" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                <Line name="Others Weight (Cur)" type="monotone" dataKey="Others Weight (Cur)" stroke="#94a3b8" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                {comparisonEnabled && <Line name="Search Weight (Prev)" type="monotone" dataKey="Search Weight (Prev)" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4 4" dot={false} opacity={0.35} />}
                {comparisonEnabled && <Line name="Others Weight (Prev)" type="monotone" dataKey="Others Weight (Prev)" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} opacity={0.35} />}
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No data available for weight analysis" />}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <KpiCard 
          title="Search Share (Sessions)" 
          value={`${stats.shares.sessions.current.toFixed(1)}%`} 
          comparison={comparisonEnabled ? stats.shares.sessions.change : undefined} 
          icon={<PieIcon />} 
          isPercent 
          color="violet" 
        />
        <KpiCard 
          title="Search Share (Revenue)" 
          value={`${stats.shares.revenue.current.toFixed(1)}%`} 
          comparison={comparisonEnabled ? stats.shares.revenue.change : undefined} 
          icon={<ShoppingBag />} 
          isPercent 
          color="violet" 
        />
      </div>
    </div>
  );
};

const SeoMarketplaceView = ({ data, keywordData, gscDailyTotals, gscTotals, aggregate, comparisonEnabled, currencySymbol, grouping, isBranded, queryTypeFilter }: {
  data: DailyData[];
  keywordData: KeywordData[];
  gscDailyTotals: any[];
  gscTotals: any;
  aggregate: (data: DailyData[]) => any;
  comparisonEnabled: boolean;
  currencySymbol: string;
  grouping: 'daily' | 'weekly' | 'monthly';
  isBranded: (text: string) => boolean;
  queryTypeFilter: QueryType | 'All';
}) => {
  const [brandedMetric, setBrandedMetric] = useState<'clicks' | 'impressions'>('clicks');
  
  // GA4 Organic Metrics
  const organicGa4 = useMemo(() => aggregate(data.filter((d: any) => d.channel?.toLowerCase().includes('organic'))), [data, aggregate]);
  
  // GSC Metrics que REACCIONAN al filtro Branded/Non-Branded
  // Para que Non-Branded cuadre con GSC, sumamos solo las queries visibles que NO coinciden con el regex
  const gscStats = useMemo(() => {
    if (!gscTotals) return { current: { clicks: 0, impressions: 0, ctr: 0 }, changes: { clicks: 0, impressions: 0, ctr: 0 } };
    
    const getRangeStats = (label: 'current' | 'previous', absTotal: any) => {
      const visibleItems = keywordData.filter(k => k.dateRangeLabel === label);
      
      const brandedSum = visibleItems.filter(k => isBranded(k.keyword))
        .reduce((acc, k) => ({ clicks: acc.clicks + k.clicks, impressions: acc.impressions + k.impressions }), { clicks: 0, impressions: 0 });

      const nonBrandedSumVisible = visibleItems.filter(k => !isBranded(k.keyword))
        .reduce((acc, k) => ({ clicks: acc.clicks + k.clicks, impressions: acc.impressions + k.impressions }), { clicks: 0, impressions: 0 });

      if (queryTypeFilter === 'Branded') {
        return brandedSum;
      } else if (queryTypeFilter === 'Non-Branded') {
        // Ahora usamos solo las queries visibles que NO cumplen el regex (coincide con el filtro de GSC)
        return nonBrandedSumVisible;
      }
      return absTotal; // Caso "All" muestra el 100% real del sitio
    };

    const cur = getRangeStats('current', gscTotals.current);
    const prev = getRangeStats('previous', gscTotals.previous);
    
    const getChange = (c: number, p: number) => p === 0 ? 0 : ((c - p) / p) * 100;
    
    return {
      current: { ...cur, ctr: cur.impressions > 0 ? (cur.clicks / cur.impressions) * 100 : 0 },
      changes: {
        clicks: getChange(cur.clicks, prev.clicks),
        impressions: getChange(cur.impressions, prev.impressions),
        ctr: getChange(cur.clicks / (cur.impressions || 1), prev.clicks / (prev.impressions || 1))
      }
    };
  }, [gscTotals, keywordData, queryTypeFilter, isBranded]);

  const brandedTrendData = useMemo(() => {
    if (!gscDailyTotals.length) return [];
    
    const getBucket = (dateStr: string) => {
      if (grouping === 'weekly') return formatDate(getStartOfWeek(new Date(dateStr)));
      if (grouping === 'monthly') return `${dateStr.slice(0, 7)}-01`;
      return dateStr;
    };

    const bucketsCurrent = Array.from(new Set(gscDailyTotals.filter(t => t.label === 'current').map(t => getBucket(t.date)))).sort();

    const aggSiteTotals = (items: any[]) => {
      const grouped: Record<string, any> = {};
      items.forEach(t => {
        const key = getBucket(t.date);
        if (!grouped[key]) grouped[key] = { clicks: 0, impressions: 0 };
        grouped[key].clicks += t.clicks;
        grouped[key].impressions += t.impressions;
      });
      return grouped;
    };

    const aggVisibleQueries = (items: KeywordData[]) => {
      const grouped: Record<string, any> = {};
      items.forEach(k => {
        const key = getBucket(k.date || '');
        if (!grouped[key]) grouped[key] = { brandedClicks: 0, brandedImpr: 0, genericClicks: 0, genericImpr: 0 };
        if (isBranded(k.keyword)) {
          grouped[key].brandedClicks += k.clicks;
          grouped[key].brandedImpr += k.impressions;
        } else {
          grouped[key].genericClicks += k.clicks;
          grouped[key].genericImpr += k.impressions;
        }
      });
      return grouped;
    };

    const curSite = aggSiteTotals(gscDailyTotals.filter(t => t.label === 'current'));
    const prevSite = aggSiteTotals(gscDailyTotals.filter(t => t.label === 'previous'));
    const curVisible = aggVisibleQueries(keywordData.filter(k => k.dateRangeLabel === 'current'));
    const prevVisible = aggVisibleQueries(keywordData.filter(k => k.dateRangeLabel === 'previous'));
    
    const prevBuckets = Object.keys(prevSite).sort();

    return bucketsCurrent.map((bucket, index) => {
      const siteCur = curSite[bucket] || { clicks: 0, impressions: 0 };
      const visCur = curVisible[bucket] || { brandedClicks: 0, brandedImpr: 0, genericClicks: 0, genericImpr: 0 };
      
      const prevBucket = prevBuckets[index];
      const sitePrev = prevBucket ? prevSite[prevBucket] : { clicks: 0, impressions: 0 };
      const visPrev = prevBucket ? prevVisible[prevBucket] : { brandedClicks: 0, brandedImpr: 0, genericClicks: 0, genericImpr: 0 };

      // Lógica de visualización:
      // Branded = Suma de queries branded
      // Non-Branded = Suma de queries que no coinciden (Coincide con GSC)
      // Anonymized/Other = Total sitio - (Suma todas las queries visibles)
      return {
        date: bucket,
        'Branded (Cur)': brandedMetric === 'clicks' ? visCur.brandedClicks : visCur.brandedImpr,
        'Non-Branded (Cur)': brandedMetric === 'clicks' ? visCur.genericClicks : visCur.genericImpr,
        'Anonymized (Cur)': brandedMetric === 'clicks' 
          ? Math.max(0, siteCur.clicks - (visCur.brandedClicks + visCur.genericClicks)) 
          : Math.max(0, siteCur.impressions - (visCur.brandedImpr + visCur.genericImpr)),
        'Branded (Prev)': brandedMetric === 'clicks' ? visPrev.brandedClicks : visPrev.brandedImpr,
        'Non-Branded (Prev)': brandedMetric === 'clicks' ? visPrev.genericClicks : visPrev.genericImpr,
      };
    });
  }, [gscDailyTotals, keywordData, grouping, brandedMetric, isBranded]);

  const scatterData = useMemo(() => {
    const map: Record<string, { country: string; sessions: number; sales: number; revenue: number }> = {};
    data.filter((d: any) => d.dateRangeLabel === 'current' && d.channel?.toLowerCase().includes('organic')).forEach((d: any) => { 
      if (!map[d.country]) map[d.country] = { country: d.country, sessions: 0, sales: 0, revenue: 0 }; 
      map[d.country].sessions += d.sessions; 
      map[d.country].sales += d.sales; 
      map[d.country].revenue += d.revenue; 
    });
    return Object.values(map);
  }, [data]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard 
          title="GSC Clicks" 
          value={gscStats.current.clicks} 
          comparison={comparisonEnabled ? gscStats.changes.clicks : undefined} 
          icon={<MousePointer2 />} 
          color="sky" 
        />
        <KpiCard 
          title="GSC Impressions" 
          value={gscStats.current.impressions} 
          comparison={comparisonEnabled ? gscStats.changes.impressions : undefined} 
          icon={<Eye />} 
          color="sky" 
        />
        <KpiCard 
          title="GSC Avg. CTR" 
          value={`${gscStats.current.ctr.toFixed(2)}%`} 
          comparison={comparisonEnabled ? gscStats.changes.ctr : undefined} 
          icon={<Percent />} 
          isPercent 
          color="sky" 
        />
        <KpiCard 
          title="Organic Sessions" 
          value={organicGa4.current.sessions} 
          comparison={comparisonEnabled ? organicGa4.changes.sessions : undefined} 
          icon={<TrendingUp />} 
          color="indigo" 
        />
        <KpiCard 
          title="Organic Revenue" 
          value={`${currencySymbol}${organicGa4.current.revenue.toLocaleString()}`} 
          comparison={comparisonEnabled ? organicGa4.changes.revenue : undefined} 
          icon={<Tag />} 
          prefix={currencySymbol} 
          color="emerald" 
        />
        <KpiCard 
          title="Organic Conv. Rate" 
          value={`${organicGa4.current.cr.toFixed(2)}%`} 
          comparison={comparisonEnabled ? organicGa4.changes.cr : undefined} 
          icon={<ShoppingBag />} 
          isPercent 
          color="emerald" 
        />
      </div>

      <div className="flex flex-col gap-8">
        <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm overflow-hidden w-full">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Brand vs Generic Search</h4>
              <p className="text-[11px] font-bold text-slate-600">Categorización exacta: Branded (Regex), Genérico (Visible) y Anonimizado</p>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl">
               <button onClick={() => setBrandedMetric('clicks')} className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${brandedMetric === 'clicks' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Clicks</button>
               <button onClick={() => setBrandedMetric('impressions')} className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${brandedMetric === 'impressions' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Impr.</button>
            </div>
          </div>
          <div className="h-[400px]">
            {brandedTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={brandedTrendData}>
                  <defs>
                    <linearGradient id="colorBrand" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorGeneric" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1}/><stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorAnon" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#e2e8f0" stopOpacity={0.1}/><stop offset="95%" stopColor="#e2e8f0" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} />
                  <Tooltip content={<ComparisonTooltip />} />
                  <Legend verticalAlign="top" align="center" iconType="circle" />
                  <Area name="Branded (Cur)" type="monotone" dataKey="Branded (Cur)" stroke="#6366f1" fillOpacity={1} fill="url(#colorBrand)" strokeWidth={3} />
                  <Area name="Non-Branded (Cur)" type="monotone" dataKey="Non-Branded (Cur)" stroke="#94a3b8" fillOpacity={1} fill="url(#colorGeneric)" strokeWidth={3} />
                  <Area name="Anonymized (Cur)" type="monotone" dataKey="Anonymized (Cur)" stroke="#cbd5e1" fillOpacity={1} fill="url(#colorAnon)" strokeWidth={1} strokeDasharray="5 5" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyState text="No query data available" />}
          </div>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm w-full">
          <div className="mb-8">
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Market Efficiency Matrix</h4>
            <p className="text-[11px] font-bold text-slate-600">SEO Revenue vs Volume by Market</p>
          </div>
          <div className="h-[450px]">
            {scatterData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    type="number" 
                    dataKey="sessions" 
                    name="Sessions" 
                    tick={{fontSize: 9}} 
                    label={{ value: 'Sessions (Organic)', position: 'insideBottom', offset: -20, fontSize: 10, fontWeight: 900 }} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <YAxis 
                    type="number" 
                    dataKey="revenue" 
                    name="Revenue" 
                    tick={{fontSize: 9}} 
                    tickFormatter={(val) => `${currencySymbol}${val.toLocaleString()}`} 
                    label={{ value: 'Revenue', angle: -90, position: 'insideLeft', fontSize: 10, fontWeight: 900 }}
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <ZAxis type="number" dataKey="sales" range={[150, 2000]} name="Sales" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }: any) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl border border-white/10">
                          <p className="text-[10px] font-black uppercase mb-2 text-indigo-400">{d.country}</p>
                          <div className="space-y-1 text-[11px] font-bold">
                            <p>Revenue: {currencySymbol}{d.revenue.toLocaleString()}</p>
                            <p>Sessions: {d.sessions.toLocaleString()}</p>
                            <p>Sales: {d.sales.toLocaleString()}</p>
                            <p>Conv. Rate: {(d.sessions > 0 ? (d.sales / d.sessions) * 100 : 0).toFixed(2)}%</p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Scatter name="Markets" data={scatterData} fill="#6366f1">
                    {scatterData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.revenue > 10000 ? '#10b981' : '#6366f1'} />)}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            ) : <EmptyState text="No market data available" />}
          </div>
        </div>
      </div>
    </div>
  );
};

const SeoDeepDiveView = ({ keywords, searchTerm, setSearchTerm, isLoading, comparisonEnabled }: {
  keywords: KeywordData[];
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  isLoading: boolean;
  comparisonEnabled: boolean;
}) => {
  const filtered = useMemo(() => keywords.filter(k => k.keyword.toLowerCase().includes(searchTerm.toLowerCase())), [keywords, searchTerm]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6">
      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
           <div><h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">URL & Keyword Precision Analysis</h4><p className="text-[11px] font-bold text-slate-600">Performance granular view from Search Console</p></div>
           <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Search keyword or URL..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-1 ring-indigo-500 transition-all" />
           </div>
        </div>
        
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100"><th className="pb-4 text-[9px] font-black text-slate-400 uppercase tracking-widest px-4">Keyword</th><th className="pb-4 text-[9px] font-black text-slate-400 uppercase tracking-widest px-4">Query Type</th><th className="pb-4 text-[9px] font-black text-slate-400 uppercase tracking-widest px-4 text-right">Clicks</th><th className="pb-4 text-[9px] font-black text-slate-400 uppercase tracking-widest px-4 text-right">Impr.</th><th className="pb-4 text-[9px] font-black text-slate-400 uppercase tracking-widest px-4 text-right">CTR</th><th className="pb-4 text-[9px] font-black text-slate-400 uppercase tracking-widest px-4">Primary Landing Page</th></tr>
            </thead>
            <tbody>
              {filtered.filter(k => k.dateRangeLabel === 'current').slice(0, 50).map((k, i) => {
                const prev = keywords.find(pk => pk.dateRangeLabel === 'previous' && pk.keyword === k.keyword);
                const clickDiff = prev && prev.clicks > 0 ? ((k.clicks - prev.clicks) / prev.clicks) * 100 : 0;

                return (
                  <tr key={i} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50">
                    <td className="py-4 px-4"><div className="flex items-center gap-3"><span className="text-[11px] font-bold text-slate-900">{k.keyword}</span><div className="opacity-0 group-hover:opacity-100 transition-opacity"><ExternalLink className="w-3 h-3 text-indigo-400 cursor-pointer" /></div></div></td>
                    <td className="py-4 px-4"><span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight ${k.queryType === 'Branded' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>{k.queryType}</span></td>
                    <td className="py-4 px-4 text-right">
                       <div className="text-[11px] font-black text-slate-900">{k.clicks.toLocaleString()}</div>
                       {comparisonEnabled && prev && (
                         <div className={`text-[8px] font-black ${clickDiff >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{clickDiff >= 0 ? '+' : ''}{clickDiff.toFixed(1)}%</div>
                       )}
                    </td>
                    <td className="py-4 px-4 text-right font-bold text-slate-600 text-[11px]">{k.impressions.toLocaleString()}</td>
                    <td className="py-4 px-4 text-right">
                       <div className="text-[11px] font-black text-slate-900">{k.ctr.toFixed(2)}%</div>
                       <div className="w-16 h-1 bg-slate-100 rounded-full mt-1.5 ml-auto overflow-hidden"><div className="h-full bg-sky-500" style={{ width: `${Math.min(k.ctr * 5, 100)}%` }} /></div>
                    </td>
                    <td className="py-4 px-4"><div className="flex items-center gap-2 group/link"><span className="text-[10px] font-medium text-slate-400 truncate max-w-[200px]">{k.landingPage || 'Query View'}</span><ChevronRight className="w-3 h-3 text-slate-300 group-hover/link:translate-x-1 transition-transform" /></div></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (<tr><td colSpan={6} className="py-20 text-center"><div className="flex flex-col items-center gap-4"><Search className="w-10 h-10 text-slate-200" /><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No matching search terms found</p></div></td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const SidebarLink = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-200 group ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
    <div className={`p-1.5 rounded-lg transition-colors ${active ? 'bg-white/20' : 'bg-transparent group-hover:bg-white/10'}`}>{React.cloneElement(icon, { size: 18 })}</div>
    <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="w-full h-full flex flex-col items-center justify-center gap-4 opacity-40">
    <HardDrive className="w-10 h-10 text-slate-300" />
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{text}</p>
  </div>
);

export default App;