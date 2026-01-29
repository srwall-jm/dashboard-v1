
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  BarChart3, Search, Calendar, ArrowUpRight, ArrowDownRight, TrendingUp, Sparkles, Globe, Tag, MousePointer2, Eye, Percent, ShoppingBag, LogOut, RefreshCw, CheckCircle2, Layers, Activity, Filter, ArrowRight, Target, FileText, AlertCircle, Settings2, Info, Menu, X, ChevronDown, ChevronRight, ExternalLink, HardDrive, Clock, Map, Zap, AlertTriangle, Cpu, Key, PieChart as PieIcon, Check, ChevronUp, Link as LinkIcon, History, Trophy
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
  'af': 'Afghanistan', 'al': 'Albania', 'dz': 'Algeria', 'ad': 'Andorra', 'ao': 'Angola',
  'ar': 'Argentina', 'am': 'Armenia', 'au': 'Australia', 'at': 'Austria', 'az': 'Azerbaijan',
  'be': 'Belgium', 'br': 'Brazil', 'ca': 'Canada', 'ch': 'Switzerland', 'cl': 'Chile',
  'cn': 'China', 'co': 'Colombia', 'de': 'Germany', 'dk': 'Denmark', 'es': 'Spain',
  'fi': 'Finland', 'fr': 'France', 'gb': 'United Kingdom', 'gr': 'Greece', 'hk': 'Hong Kong',
  'ie': 'Ireland', 'in': 'India', 'it': 'Italy', 'jp': 'Japan', 'mx': 'Mexico',
  'nl': 'Netherlands', 'no': 'Norway', 'pe': 'Peru', 'pl': 'Poland', 'pt': 'Portugal',
  'ru': 'Russia', 'se': 'Sweden', 'tr': 'Turkey', 'us': 'United States', 'za': 'South Africa',
  'kr': 'South Korea', 'th': 'Thailand', 'vn': 'Vietnam', 'id': 'Indonesia', 'my': 'Malaysia',
  'ph': 'Philippines', 'sg': 'Singapore', 'sa': 'Saudi Arabia', 'ae': 'United Arab Emirates',
  'eg': 'Egypt', 'ma': 'Morocco', 'il': 'Israel', 'ua': 'Ukraine', 'cz': 'Czech Republic',
  'ro': 'Romania', 'hu': 'Hungary', 'nz': 'New Zealand', 'ba': 'Bosnia and Herzegovina',
};

const normalizeCountry = (val: string): string => {
  if (!val) return 'Other';
  const clean = val.toLowerCase().trim();
  if (COUNTRY_CODE_TO_NAME[clean]) return COUNTRY_CODE_TO_NAME[clean];
  if (clean.length > 3) {
    return clean.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  }
  return val.toUpperCase();
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
    { label: 'Last 7 days', getValue: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 7); return { start, end }; } },
    { label: 'Last 30 days', getValue: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 30); return { start, end }; } },
    { label: 'Last month', getValue: () => { const d = new Date(); return { start: new Date(d.getFullYear(), d.getMonth() - 1, 1), end: new Date(d.getFullYear(), d.getMonth(), 0) }; } },
    { label: 'This month', getValue: () => { const d = new Date(); return { start: new Date(d.getFullYear(), d.getMonth(), 1), end: d }; } },
  ];

  const handleRangeSelect = (range: any) => {
    const { start, end } = range.getValue();
    setFilters({ ...filters, dateRange: { start: formatDate(start), end: formatDate(end) } });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-indigo-300 transition-all text-[10px] font-bold h-full"
      >
        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
        <span className="text-slate-900">{filters.dateRange.start}</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-900">{filters.dateRange.end}</span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-[480px] bg-white rounded-3xl shadow-2xl border border-slate-200 z-[100] overflow-hidden flex animate-in fade-in zoom-in-95 duration-200">
          <div className="w-1/2 border-r border-slate-100 bg-slate-50/50 max-h-[420px] overflow-y-auto custom-scrollbar">
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
                <input type="date" value={filters.dateRange.start} onChange={e => setFilters({...filters, dateRange: {...filters.dateRange, start: e.target.value}})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold" />
                <input type="date" value={filters.dateRange.end} onChange={e => setFilters({...filters, dateRange: {...filters.dateRange, end: e.target.value}})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold" />
              </div>
            </div>
            <div className="mt-auto pt-6 border-t border-slate-100 space-y-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <input type="checkbox" id="comp_enabled_drop" checked={filters.comparison.enabled} onChange={e => setFilters({...filters, comparison: {...filters.comparison, enabled: e.target.checked}})} className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600" />
                  <label htmlFor="comp_enabled_drop" className="text-[10px] font-black uppercase text-slate-600 cursor-pointer">Compare</label>
                </div>
                {filters.comparison.enabled && (
                  <select className="w-full bg-white border border-slate-200 rounded-xl text-[10px] font-bold p-2" value={filters.comparison.type} onChange={e => setFilters({...filters, comparison: {...filters.comparison, type: e.target.value as any}})}>
                    <option value="previous_period">vs Previous Period</option>
                    <option value="previous_year">vs Previous Year (YoY)</option>
                  </select>
                )}
              </div>
              <button onClick={() => setIsOpen(false)} className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-lg">Apply Range</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ComparisonTooltip = ({ active, payload, label, currency = false, currencySymbol = '£', percent = false }: any) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0].payload;
    const curDate = dataPoint.curDate;
    const prevDate = dataPoint.prevDate;

    return (
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-white/10 min-w-[220px]">
        <div className="flex justify-between items-center mb-3 border-b border-white/5 pb-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">{label}</p>
          {prevDate && <span className="text-[8px] font-black text-slate-500 uppercase">Overlay Comparison</span>}
        </div>
        
        <div className="mb-4 space-y-1">
           <div className="flex justify-between text-[9px] font-black uppercase">
             <span className="text-indigo-400">Current:</span>
             <span className="text-white">{curDate}</span>
           </div>
           {prevDate && (
             <div className="flex justify-between text-[9px] font-black uppercase">
               <span className="text-slate-500">Previous:</span>
               <span className="text-slate-300">{prevDate}</span>
             </div>
           )}
        </div>

        <div className="space-y-3">
          {payload.map((entry: any, index: number) => {
            if (entry.name.includes('(Prev)')) return null; 
            const prevEntry = payload.find((p: any) => p.name === entry.name.replace('(Cur)', '(Prev)'));
            const curVal = entry.value;
            const prevVal = prevEntry ? prevEntry.value : null;
            const diff = prevVal !== null && prevVal !== 0 ? ((curVal - prevVal) / prevVal) * 100 : 0;

            return (
              <div key={index} className="space-y-1 border-t border-white/5 pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.stroke || entry.color }} />
                  <span className="text-[10px] font-black text-white">{entry.name.replace('(Cur)', '')}</span>
                </div>
                <div className="flex justify-between items-baseline gap-4 ml-4">
                  <span className="text-[11px] font-bold">
                    {currency ? `${currencySymbol}${curVal.toLocaleString()}` : percent ? `${curVal.toFixed(1)}%` : curVal.toLocaleString()}
                  </span>
                  {prevVal !== null && (
                    <div className={`flex items-center text-[9px] font-black ${diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {diff >= 0 ? <ArrowUpRight className="w-2 h-2 mr-0.5"/> : <ArrowDownRight className="w-2 h-2 mr-0.5"/>}
                      {Math.abs(diff).toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

const SidebarLink: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-200 group ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
    <div className={`p-1.5 rounded-lg transition-colors ${active ? 'bg-white/20' : 'bg-transparent group-hover:bg-white/10'}`}>
      {React.cloneElement(icon as React.ReactElement, { size: 18 })}
    </div>
    <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div className="w-full h-full flex flex-col items-center justify-center gap-4 opacity-40">
    <HardDrive className="w-10 h-10 text-slate-300" />
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{text}</p>
  </div>
);

const SeoDeepDiveView: React.FC<{ 
  keywords: KeywordData[]; 
  searchTerm: string; 
  setSearchTerm: (s: string) => void; 
  isLoading: boolean;
  comparisonEnabled: boolean;
}> = ({ keywords, searchTerm, setSearchTerm, isLoading, comparisonEnabled }) => {
  const [expandedUrls, setExpandedUrls] = useState<Set<string>>(new Set());

  const toggleUrl = (url: string) => {
    const next = new Set(expandedUrls);
    if (next.has(url)) {
      next.delete(url);
    } else {
      next.add(url);
    }
    setExpandedUrls(next);
  };

  const groupedByUrl = useMemo(() => {
    const filtered = keywords.filter(k => 
      k.keyword.toLowerCase().includes(searchTerm.toLowerCase()) || 
      k.landingPage.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const map: Record<string, { url: string; clicks: number; impressions: number; queries: KeywordData[] }> = {};

    filtered.forEach(k => {
      const url = k.landingPage || 'Unknown';
      if (!map[url]) {
        map[url] = { url, clicks: 0, impressions: 0, queries: [] };
      }
      
      if (k.dateRangeLabel === 'current') {
        map[url].clicks += k.clicks;
        map[url].impressions += k.impressions;
        map[url].queries.push(k);
      }
    });

    return Object.values(map)
      .map(page => ({
        ...page,
        ctr: page.impressions > 0 ? (page.clicks / page.impressions) * 100 : 0,
        topQueries: page.queries.sort((a, b) => b.clicks - a.clicks).slice(0, 20)
      }))
      .sort((a, b) => b.clicks - a.clicks);
  }, [keywords, searchTerm]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6">
      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">URL & Keyword Precision Analysis</h4>
            <p className="text-[11px] font-bold text-slate-600">Jerarquía por URL y sus Top 20 Queries correspondientes</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Filtrar por URL o Keyword..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none" />
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest px-4 w-10"></th>
                <th className="py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest px-4">Landing Page (URL)</th>
                <th className="py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest px-4 text-right">Clicks</th>
                <th className="py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest px-4 text-right">Impr.</th>
                <th className="py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest px-4 text-right">CTR</th>
              </tr>
            </thead>
            <tbody>
              {groupedByUrl.map((page, i) => (
                <React.Fragment key={page.url}>
                  <tr onClick={() => toggleUrl(page.url)} className="group cursor-pointer hover:bg-slate-50/50 transition-colors border-b border-slate-50">
                    <td className="py-5 px-4 text-center">{expandedUrls.has(page.url) ? <ChevronUp className="w-4 h-4 text-indigo-500" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}</td>
                    <td className="py-5 px-4 max-w-md"><div className="flex items-center gap-3"><LinkIcon className="w-3 h-3 text-slate-300 flex-shrink-0" /><span className="text-[11px] font-black text-slate-800 truncate block">{page.url}</span></div></td>
                    <td className="py-5 px-4 text-right font-black text-slate-900">{page.clicks.toLocaleString()}</td>
                    <td className="py-5 px-4 text-right font-bold text-slate-600 text-[11px]">{page.impressions.toLocaleString()}</td>
                    <td className="py-5 px-4 text-right font-black text-slate-900 text-[11px]">{page.ctr.toFixed(2)}%</td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
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
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai'>(() => (localStorage.getItem('ai_provider') as 'gemini' | 'openai') || 'gemini');
  const [openaiKey, setOpenaiKey] = useState(() => localStorage.getItem('openai_api_key') || '');
  const [activeTab, setActiveTab] = useState<DashboardTab>(DashboardTab.ORGANIC_VS_PAID);
  const [tabInsights, setTabInsights] = useState<Record<string, string | null>>({ [DashboardTab.ORGANIC_VS_PAID]: null, [DashboardTab.SEO_BY_COUNTRY]: null, [DashboardTab.KEYWORD_DEEP_DIVE]: null });
  const [loadingInsights, setLoadingInsights] = useState(false);

  const [filters, setFilters] = useState<DashboardFilters>({
    dateRange: { start: formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)), end: formatDate(new Date()) },
    comparison: { enabled: false, type: 'previous_period' },
    country: 'All', queryType: 'All', ga4Dimension: 'sessionDefaultChannelGroup'
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const tokenClientGa4 = useRef<any>(null);
  const tokenClientGsc = useRef<any>(null);

  const isBranded = (text: string) => {
    if (!text || text.trim() === '') return false;
    try { const regex = new RegExp(brandRegexStr, 'i'); return regex.test(text.trim().toLowerCase()); } catch (e) { return false; }
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
      const resp = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', { headers: { Authorization: `Bearer ${token}` } });
      const data = await resp.json();
      const props: Ga4Property[] = [];
      data.accountSummaries?.forEach((acc: any) => acc.propertySummaries?.forEach((p: any) => props.push({ id: p.property, name: p.displayName })));
      setAvailableProperties(props);
      if (props.length > 0 && !ga4Auth?.property) setGa4Auth({ token, property: props[0] });
    } catch (e) { setError("Error connecting to GA4 Admin API."); }
  };

  const fetchGa4PropertyDetails = async (token: string, propertyId: string) => {
    try {
      const resp = await fetch(`https://analyticsadmin.googleapis.com/v1beta/${propertyId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await resp.json();
      if (data.currencyCode) setCurrencySymbol(CURRENCY_SYMBOLS[data.currencyCode] || data.currencyCode);
    } catch (e) {}
  };

  const fetchGa4Metadata = async (token: string, propertyId: string) => {
    try {
      const resp = await fetch(`https://analyticsdata.googleapis.com/v1beta/${propertyId}/metadata`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await resp.json();
      const filtered = (data.dimensions || []).filter((d: any) => {
        const apiName = d.apiName.toLowerCase();
        return ['session', 'source', 'medium', 'channel', 'campaign', 'country', 'region', 'page', 'landing', 'device'].some(r => apiName.includes(r));
      });
      const mapped = filtered.map((d: any) => ({ label: d.uiName || d.apiName, value: d.apiName }));
      setAvailableDimensions(mapped);
    } catch (e) {}
  };

  const fetchGscSites = async (token: string) => {
    try {
      const resp = await fetch('https://www.googleapis.com/webmasters/v3/sites', { headers: { Authorization: `Bearer ${token}` } });
      const data = await resp.json();
      setAvailableSites(data.siteEntry || []);
      if (data.siteEntry?.length > 0 && !gscAuth?.site) setGscAuth({ token, site: data.siteEntry[0] });
    } catch (e) { setError("Error connecting to Search Console API."); }
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
          metrics: [{ name: 'sessions' }, { name: 'totalRevenue' }, { name: 'transactions' }, { name: 'sessionConversionRate' }, { name: 'addToCarts' }, { name: 'checkouts' }]
        })
      });
      const ga4Data = await ga4ReportResp.json();
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
    } catch (err: any) { setError(`GA4 Error: ${err.message}`); } finally { setIsLoadingGa4(false); }
  };

  const fetchGscData = async () => {
    if (!gscAuth?.site || !gscAuth.token) return;
    setIsLoadingGsc(true);
    try {
      const siteUrl = encodeURIComponent(gscAuth.site.siteUrl);
      const fetchOneRange = async (start: string, end: string, label: 'current' | 'previous') => {
        const respTotals = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/searchAnalytics/query`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${gscAuth.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ startDate: start, endDate: end, dimensions: ['date', 'country'] })
        });
        const dataTotals = await respTotals.json();
        const totalAggregated = (dataTotals.rows || []).reduce((acc: any, row: any) => ({ clicks: acc.clicks + row.clicks, impressions: acc.impressions + row.impressions }), { clicks: 0, impressions: 0 });
        const dailyTotals = (dataTotals.rows || []).map((row: any) => ({ date: row.keys[0], country: normalizeCountry(row.keys[1]), clicks: row.clicks, impressions: row.impressions, label }));
        const respGranular = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/searchAnalytics/query`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${gscAuth.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ startDate: start, endDate: end, dimensions: ['query', 'page', 'date', 'country'], rowLimit: 10000 })
        });
        const dataGranular = await respGranular.json();
        const mapped = (dataGranular.rows || []).map((row: any) => ({
            keyword: row.keys[0] || '', landingPage: row.keys[1] || '', date: row.keys[2] || '', country: normalizeCountry(row.keys[3]), dateRangeLabel: label,
            clicks: row.clicks || 0, impressions: row.impressions || 0, ctr: (row.ctr || 0) * 100,
            sessions: 0, conversionRate: 0, revenue: 0, sales: 0, addToCarts: 0, checkouts: 0, queryType: 'Non-Branded' as QueryType
        }));
        return { mapped, totals: totalAggregated, dailyTotals };
      };
      const curData = await fetchOneRange(filters.dateRange.start, filters.dateRange.end, 'current');
      let combinedKeywords = curData.mapped;
      let combinedDailyTotals = curData.dailyTotals;
      let currentTotals = curData.totals;
      let previousTotals = { clicks: 0, impressions: 0 };
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
    } catch (err: any) { setError(`GSC Error: ${err.message}`); } finally { setIsLoadingGsc(false); }
  };

  useEffect(() => {
    const initializeOAuth = () => {
      if (window.google?.accounts) {
        tokenClientGa4.current = window.google.accounts.oauth2.initTokenClient({ client_id: CLIENT_ID, scope: SCOPE_GA4, callback: (resp: any) => { if (resp.access_token) { setGa4Auth({ token: resp.access_token, property: null }); fetchGa4Properties(resp.access_token); } } });
        tokenClientGsc.current = window.google.accounts.oauth2.initTokenClient({ client_id: CLIENT_ID, scope: SCOPE_GSC, callback: (resp: any) => { if (resp.access_token) { setGscAuth({ token: resp.access_token, site: null }); fetchGscSites(resp.access_token); } } });
      } else setTimeout(initializeOAuth, 500);
    };
    initializeOAuth();
  }, []);

  const handleLoginSuccess = (credentialToken: string) => {
    const decoded = JSON.parse(atob(credentialToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    setUser({ name: decoded.name, email: decoded.email, picture: decoded.picture });
    localStorage.setItem('seo_suite_user', JSON.stringify({ name: decoded.name, email: decoded.email, picture: decoded.picture }));
  };

  const handleLogout = () => { setUser(null); localStorage.removeItem('seo_suite_user'); };
  const handleConnectGa4 = () => tokenClientGa4.current?.requestAccessToken();
  const handleConnectGsc = () => tokenClientGsc.current?.requestAccessToken();

  useEffect(() => { if (ga4Auth?.token && ga4Auth.property) { fetchGa4Data(); fetchGa4Metadata(ga4Auth.token, ga4Auth.property.id); fetchGa4PropertyDetails(ga4Auth.token, ga4Auth.property.id); } }, [ga4Auth?.property?.id, filters.dateRange, filters.ga4Dimension, filters.comparison.enabled, filters.comparison.type]);
  useEffect(() => { if (gscAuth?.token && gscAuth.site) fetchGscData(); }, [gscAuth?.site?.siteUrl, filters.dateRange, filters.comparison.enabled, filters.comparison.type]);

  const filteredDailyData = useMemo(() => realDailyData.filter(d => filters.country === 'All' || d.country === filters.country), [realDailyData, filters]);
  const filteredKeywordData = useMemo(() => realKeywordData.filter(k => (filters.country === 'All' || k.country === filters.country) && (filters.queryType === 'All' || (isBranded(k.keyword) ? 'Branded' : 'Non-Branded') === filters.queryType)), [realKeywordData, filters, brandRegexStr]);

  const aggregate = (data: DailyData[]) => {
    const current = data.filter(d => d.dateRangeLabel === 'current');
    const previous = data.filter(d => d.dateRangeLabel === 'previous');
    const sum = (arr: DailyData[]) => arr.reduce((acc, curr) => ({ sessions: acc.sessions + curr.sessions, sales: acc.sales + curr.sales, revenue: acc.revenue + curr.revenue, addToCarts: acc.addToCarts + curr.addToCarts, checkouts: acc.checkouts + curr.checkouts }), { sessions: 0, sales: 0, revenue: 0, addToCarts: 0, checkouts: 0 });
    const c = sum(current); const p = sum(previous);
    const getChange = (curr: number, prev: number) => prev === 0 ? 0 : ((curr - prev) / prev) * 100;
    return { current: { ...c, cr: c.sessions > 0 ? (c.sales / c.sessions) * 100 : 0 }, previous: { ...p, cr: p.sessions > 0 ? (p.sales / p.sessions) * 100 : 0 }, changes: { sessions: getChange(c.sessions, p.sessions), sales: getChange(c.sales, p.sales), revenue: getChange(c.revenue, p.revenue), cr: getChange(c.sales/(c.sessions||1), p.sales/(p.sessions||1)) }, abs: { sessions: c.sessions - p.sessions, sales: c.sales - p.sales, revenue: c.revenue - p.revenue } };
  };

  const channelStats = useMemo(() => {
    const total = aggregate(filteredDailyData);
    const organic = aggregate(filteredDailyData.filter(d => d.channel.toLowerCase().includes('organic')));
    const paid = aggregate(filteredDailyData.filter(d => d.channel.toLowerCase().includes('paid') || d.channel.toLowerCase().includes('cpc')));
    return { total, organic, paid, shares: { sessions: { current: total.current.sessions > 0 ? ((organic.current.sessions+paid.current.sessions)/total.current.sessions)*100 : 0 } } };
  }, [filteredDailyData]);

  const handleGenerateInsights = async () => {
    setLoadingInsights(true);
    try {
      const summary = `Organic Stats: ${channelStats.organic.current.sessions} sessions, ${currencySymbol}${channelStats.organic.current.revenue} revenue. Paid Stats: ${channelStats.paid.current.sessions} sessions.`;
      const insights = aiProvider === 'openai' ? await getOpenAiInsights(openaiKey, summary, activeTab) : await getDashboardInsights(summary, activeTab);
      setTabInsights(prev => ({ ...prev, [activeTab]: insights || null }));
    } catch (err) { setError("Failed to generate insights."); } finally { setLoadingInsights(false); }
  };

  if (!user) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
      <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mb-8"><Activity className="w-10 h-10" /></div>
      <h1 className="text-4xl font-black mb-4 tracking-tighter">SEO & Paid Performance</h1>
      <p className="text-slate-400 mb-10">Sign in with Google to access your performance data.</p>
      <GoogleLogin onLoginSuccess={handleLoginSuccess} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col md:flex-row">
      <aside className={`fixed inset-y-0 left-0 w-80 bg-slate-950 text-white flex flex-col z-50 xl:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300`}>
        <div className="p-8 flex-1">
          <div className="flex items-center gap-4 mb-8"><Activity className="w-8 h-8 text-indigo-500" /><div><h1 className="font-black text-lg">SEO Suite</h1><p className="text-[9px] text-indigo-400 font-black uppercase">Analytics Pro</p></div></div>
          <nav className="space-y-1">
            <SidebarLink active={activeTab === DashboardTab.ORGANIC_VS_PAID} onClick={() => setActiveTab(DashboardTab.ORGANIC_VS_PAID)} icon={<Layers />} label="Organic vs Paid" />
            <SidebarLink active={activeTab === DashboardTab.SEO_BY_COUNTRY} onClick={() => setActiveTab(DashboardTab.SEO_BY_COUNTRY)} icon={<Globe />} label="Markets" />
            <SidebarLink active={activeTab === DashboardTab.KEYWORD_DEEP_DIVE} onClick={() => setActiveTab(DashboardTab.KEYWORD_DEEP_DIVE)} icon={<Target />} label="Deep Dive" />
          </nav>
        </div>
        <div className="p-6 border-t border-white/5"><div className="flex items-center gap-3 mb-4"><img src={user.picture} className="w-10 h-10 rounded-full border border-indigo-500" /><div className="truncate"><p className="text-xs font-black truncate">{user.name}</p></div></div><button onClick={handleLogout} className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Sign Out</button></div>
      </aside>

      <main className="flex-1 xl:ml-80 p-8 xl:p-12 overflow-x-hidden">
        <header className="flex flex-col gap-8 mb-10">
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-black tracking-tighter text-slate-900">{activeTab.replace('_', ' ').toUpperCase()}</h2>
            <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${isLoadingGa4 || isLoadingGsc ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} /><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Live Sync</span></div>
          </div>
          <div className="flex flex-wrap gap-4"><DateRangeSelector filters={filters} setFilters={setFilters} /><div className="flex items-center gap-4 bg-white p-2 border rounded-3xl"><select className="bg-transparent text-[10px] font-black uppercase outline-none" value={filters.country} onChange={e => setFilters({...filters, country: e.target.value})}><option value="All">All Countries</option>{Array.from(new Set(realDailyData.map(d=>d.country))).sort().map(c=><option key={c} value={c}>{c}</option>)}</select><select className="bg-transparent text-[10px] font-black uppercase outline-none" value={filters.queryType} onChange={e => setFilters({...filters, queryType: e.target.value as any})}><option value="All">All Types</option><option value="Branded">Branded</option><option value="Non-Branded">Non-Branded</option></select></div></div>
        </header>

        {tabInsights[activeTab] && (
          <div className="mb-10 bg-slate-900 rounded-[32px] p-8 text-white shadow-2xl relative animate-in fade-in zoom-in-95"><div className="flex justify-between items-center mb-4"><div className="flex items-center gap-2 text-indigo-400"><Sparkles size={20}/><h3 className="text-xl font-black">AI Strategic Analysis</h3></div><button onClick={() => setTabInsights(p => ({...p, [activeTab]: null}))}><X size={20}/></button></div><div className="prose prose-invert max-w-none text-slate-300" dangerouslySetInnerHTML={{ __html: tabInsights[activeTab]!.replace(/\n/g, '<br/>') }} /></div>
        )}

        {activeTab === DashboardTab.ORGANIC_VS_PAID && <OrganicVsPaidView stats={channelStats} data={filteredDailyData} comparisonEnabled={filters.comparison.enabled} grouping={grouping} setGrouping={setGrouping} currencySymbol={currencySymbol} />}
        {activeTab === DashboardTab.SEO_BY_COUNTRY && <SeoMarketplaceView data={filteredDailyData} keywordData={filteredKeywordData} gscDailyTotals={gscDailyTotals} gscTotals={gscTotals} aggregate={aggregate} comparisonEnabled={filters.comparison.enabled} currencySymbol={currencySymbol} grouping={grouping} isBranded={isBranded} countryFilter={filters.country} />}
        {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && <SeoDeepDiveView keywords={filteredKeywordData} searchTerm={searchTerm} setSearchTerm={setSearchTerm} isLoading={isLoadingGsc} comparisonEnabled={filters.comparison.enabled} />}

        <div className="mt-12 flex justify-center"><button onClick={handleGenerateInsights} disabled={loadingInsights} className="px-10 py-4 bg-slate-950 text-white rounded-3xl text-xs font-black shadow-2xl hover:scale-105 transition-all flex items-center gap-3">{loadingInsights ? <RefreshCw className="animate-spin" /> : <Sparkles size={16}/>} Generate Performance Insights</button></div>
      </main>
    </div>
  );
};

const OrganicVsPaidView = ({ stats, data, comparisonEnabled, grouping, setGrouping, currencySymbol }: { stats: any; data: DailyData[]; comparisonEnabled: boolean; grouping: 'daily' | 'weekly' | 'monthly'; setGrouping: (g: 'daily' | 'weekly' | 'monthly') => void; currencySymbol: string; }) => {
  const chartData = useMemo(() => {
    if (!data.length) return [];
    const getBucket = (d: DailyData) => grouping === 'weekly' ? formatDate(getStartOfWeek(new Date(d.date))) : grouping === 'monthly' ? `${d.date.slice(0, 7)}-01` : d.date;
    const curRaw = data.filter(d => d.dateRangeLabel === 'current').sort((a,b) => a.date.localeCompare(b.date));
    const prevRaw = data.filter(d => d.dateRangeLabel === 'previous').sort((a,b) => a.date.localeCompare(b.date));

    const aggregateByBucket = (items: DailyData[]) => {
      const g: Record<string, DailyData[]> = {}; items.forEach(d => { const k = getBucket(d); if(!g[k]) g[k]=[]; g[k].push(d); }); return g;
    };
    const curG = aggregateByBucket(curRaw); const prevG = aggregateByBucket(prevRaw);
    const curK = Object.keys(curG).sort(); const prevK = Object.keys(prevG).sort();

    return curK.map((bucket, index) => {
      const curItems = curG[bucket] || [];
      const prevBucket = prevK[index]; const prevItems = prevBucket ? prevG[prevBucket] : [];
      const sum = (items: DailyData[]) => items.reduce((acc, d) => ({
        organic: acc.organic + (d.channel.toLowerCase().includes('organic') ? d.sessions : 0),
        paid: acc.paid + (d.channel.toLowerCase().includes('paid') || d.channel.toLowerCase().includes('cpc') ? d.sessions : 0),
        organicRev: acc.organicRev + (d.channel.toLowerCase().includes('organic') ? d.revenue : 0),
        paidRev: acc.paidRev + (d.channel.toLowerCase().includes('paid') || d.channel.toLowerCase().includes('cpc') ? d.revenue : 0),
      }), { organic: 0, paid: 0, organicRev: 0, paidRev: 0 });

      const cS = sum(curItems); const pS = sum(prevItems);
      const labelPrefix = grouping === 'daily' ? 'Day' : grouping === 'weekly' ? 'Week' : 'Month';

      return {
        relLabel: `${labelPrefix} ${index + 1}`,
        curDate: bucket,
        prevDate: prevBucket || null,
        'Organic (Cur)': cS.organic, 'Paid (Cur)': cS.paid, 'Organic Rev (Cur)': cS.organicRev, 'Paid Rev (Cur)': cS.paidRev,
        'Organic (Prev)': pS.organic, 'Paid (Prev)': pS.paid, 'Organic Rev (Prev)': pS.organicRev, 'Paid Rev (Prev)': pS.paidRev
      };
    });
  }, [data, grouping]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="space-y-4"><div className="flex items-center gap-2"><div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center text-white text-[8px] font-black">ORG</div><h4 className="text-[10px] font-black uppercase tracking-widest">Organic Performance</h4></div><div className="grid grid-cols-2 gap-4"><KpiCard title="Sessions" value={stats.organic.current.sessions} comparison={comparisonEnabled ? stats.organic.changes.sessions : undefined} icon={<TrendingUp />} color="indigo" /><KpiCard title="Revenue" value={`${currencySymbol}${stats.organic.current.revenue.toLocaleString()}`} comparison={comparisonEnabled ? stats.organic.changes.revenue : undefined} icon={<Tag />} color="emerald" prefix={currencySymbol} /></div></div>
        <div className="space-y-4"><div className="flex items-center gap-2"><div className="w-6 h-6 bg-amber-600 rounded flex items-center justify-center text-white text-[8px] font-black">PAID</div><h4 className="text-[10px] font-black uppercase tracking-widest">Paid Performance</h4></div><div className="grid grid-cols-2 gap-4"><KpiCard title="Sessions" value={stats.paid.current.sessions} comparison={comparisonEnabled ? stats.paid.changes.sessions : undefined} icon={<TrendingUp />} color="amber" /><KpiCard title="Revenue" value={`${currencySymbol}${stats.paid.current.revenue.toLocaleString()}`} comparison={comparisonEnabled ? stats.paid.changes.revenue : undefined} icon={<Tag />} color="rose" prefix={currencySymbol} /></div></div>
      </div>

      <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-8"><div><h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Sessions Overlap Comparison (YoY/PoP)</h4><p className="text-[10px] font-bold text-slate-500">Líneas superpuestas por índice temporal relativo ({grouping === 'daily' ? 'Días' : grouping === 'weekly' ? 'Semanas' : 'Meses'})</p></div><div className="flex bg-slate-100 p-1 rounded-xl">{['daily', 'weekly', 'monthly'].map(g => <button key={g} onClick={() => setGrouping(g as any)} className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg transition-all ${grouping === g ? 'bg-white shadow-sm' : 'text-slate-500'}`}>{g}</button>)}</div></div>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="relLabel" tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} />
              <Tooltip content={<ComparisonTooltip />} />
              <Legend verticalAlign="top" iconType="circle" />
              <Line name="Organic (Cur)" type="monotone" dataKey="Organic (Cur)" stroke="#6366f1" strokeWidth={3} dot={false} activeDot={{r: 6}} />
              <Line name="Paid (Cur)" type="monotone" dataKey="Paid (Cur)" stroke="#f59e0b" strokeWidth={3} dot={false} activeDot={{r: 6}} />
              {comparisonEnabled && <><Line name="Organic (Prev)" type="monotone" dataKey="Organic (Prev)" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" opacity={0.3} dot={false} /><Line name="Paid (Prev)" type="monotone" dataKey="Paid (Prev)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" opacity={0.3} dot={false} /></>}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-8"><div><h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Revenue Overlap Evolution</h4><p className="text-[10px] font-bold text-slate-500">Comparativa directa de ingresos por posición en el periodo</p></div></div>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="relLabel" tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} tickFormatter={v => `${currencySymbol}${v.toLocaleString()}`} />
              <Tooltip content={<ComparisonTooltip currency currencySymbol={currencySymbol} />} />
              <Legend verticalAlign="top" iconType="circle" />
              <Line name="Organic Rev (Cur)" type="monotone" dataKey="Organic Rev (Cur)" stroke="#10b981" strokeWidth={3} dot={false} />
              <Line name="Paid Rev (Cur)" type="monotone" dataKey="Paid Rev (Cur)" stroke="#ec4899" strokeWidth={3} dot={false} />
              {comparisonEnabled && <><Line name="Organic Rev (Prev)" type="monotone" dataKey="Organic Rev (Prev)" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" opacity={0.3} dot={false} /><Line name="Paid Rev (Prev)" type="monotone" dataKey="Paid Rev (Prev)" stroke="#ec4899" strokeWidth={2} strokeDasharray="5 5" opacity={0.3} dot={false} /></>}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const SeoMarketplaceView = ({ data, keywordData, gscDailyTotals, gscTotals, aggregate, comparisonEnabled, currencySymbol, grouping, isBranded, countryFilter }: { data: DailyData[]; keywordData: KeywordData[]; gscDailyTotals: any[]; gscTotals: any; aggregate: (data: DailyData[]) => any; comparisonEnabled: boolean; currencySymbol: string; grouping: 'daily' | 'weekly' | 'monthly'; isBranded: (t: string) => boolean; countryFilter: string; }) => {
  const organicGa4 = useMemo(() => aggregate(data.filter(d => d.channel.toLowerCase().includes('organic'))), [data, aggregate]);
  
  const brandedTrendData = useMemo(() => {
    if (!gscDailyTotals.length) return [];
    const getB = (d: string) => grouping === 'weekly' ? formatDate(getStartOfWeek(new Date(d))) : grouping === 'monthly' ? `${d.slice(0, 7)}-01` : d;
    const cD = gscDailyTotals.filter(t => t.label === 'current' && (countryFilter === 'All' || t.country === countryFilter)).sort((a,b) => a.date.localeCompare(b.date));
    const pD = gscDailyTotals.filter(t => t.label === 'previous' && (countryFilter === 'All' || t.country === countryFilter)).sort((a,b) => a.date.localeCompare(b.date));
    
    const cK = Array.from(new Set(cD.map(t => getB(t.date)))).sort();
    const pK = Array.from(new Set(pD.map(t => getB(t.date)))).sort();

    const agg = (items: any[], kw: KeywordData[]) => {
      const m: Record<string, any> = {}; 
      items.forEach(t => { const b = getB(t.date); if(!m[b]) m[b]={total:0,branded:0}; m[b].total += t.clicks; });
      kw.forEach(k => { const b = getB(k.date||''); if(m[b] && isBranded(k.keyword)) m[b].branded += k.clicks; });
      return m;
    };
    const cM = agg(cD, keywordData.filter(k => k.dateRangeLabel === 'current'));
    const pM = agg(pD, keywordData.filter(k => k.dateRangeLabel === 'previous'));

    return cK.map((bucket, index) => {
      const c = cM[bucket]; const pB = pK[index]; const p = pB ? pM[pB] : null;
      const labelPrefix = grouping === 'daily' ? 'Day' : grouping === 'weekly' ? 'Week' : 'Month';
      return {
        relLabel: `${labelPrefix} ${index + 1}`,
        curDate: bucket, prevDate: pB || null,
        'Branded (Cur)': c.branded, 'Generic (Cur)': Math.max(0, c.total - c.branded),
        'Branded (Prev)': p ? p.branded : 0, 'Generic (Prev)': p ? Math.max(0, p.total - p.branded) : 0
      };
    });
  }, [gscDailyTotals, keywordData, grouping, isBranded, countryFilter]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard title="Clicks" value={gscTotals?.current.clicks || 0} comparison={comparisonEnabled ? ((gscTotals?.current.clicks - gscTotals?.previous.clicks)/(gscTotals?.previous.clicks||1))*100 : undefined} icon={<MousePointer2 />} color="sky" />
        <KpiCard title="Impr." value={gscTotals?.current.impressions || 0} comparison={comparisonEnabled ? ((gscTotals?.current.impressions - gscTotals?.previous.impressions)/(gscTotals?.previous.impressions||1))*100 : undefined} icon={<Eye />} color="sky" />
        <KpiCard title="Organic Sess." value={organicGa4.current.sessions} comparison={comparisonEnabled ? organicGa4.changes.sessions : undefined} icon={<TrendingUp />} color="indigo" />
        <KpiCard title="Organic Rev." value={`${currencySymbol}${organicGa4.current.revenue.toLocaleString()}`} comparison={comparisonEnabled ? organicGa4.changes.revenue : undefined} icon={<Tag />} color="emerald" prefix={currencySymbol} />
      </div>

      <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
        <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-8">Brand vs Generic Search Overlap (Clicks)</h4>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={brandedTrendData}>
              <defs><linearGradient id="colorBrand" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="relLabel" tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} />
              <Tooltip content={<ComparisonTooltip />} />
              <Legend verticalAlign="top" iconType="circle" />
              <Area name="Branded (Cur)" type="monotone" dataKey="Branded (Cur)" stroke="#6366f1" fill="url(#colorBrand)" strokeWidth={3} />
              <Area name="Generic (Cur)" type="monotone" dataKey="Generic (Cur)" stroke="#94a3b8" fillOpacity={0} strokeWidth={3} />
              {comparisonEnabled && <><Line name="Branded (Prev)" type="monotone" dataKey="Branded (Prev)" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" opacity={0.3} dot={false} /><Line name="Generic (Prev)" type="monotone" dataKey="Generic (Prev)" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" opacity={0.3} dot={false} /></>}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default App;
