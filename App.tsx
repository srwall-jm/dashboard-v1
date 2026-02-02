
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
  // ISO-2 Codes (Estándar GSC)
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
  
  // ISO-3 Codes & Lista Extendida (Nueva)
  'abw': 'Aruba', 'afg': 'Afghanistan', 'ago': 'Angola', 'alb': 'Albania', 'and': 'Andorra', 
  'are': 'United Arab Emirates', 'arg': 'Argentina', 'arm': 'Armenia', 'atf': 'French Southern Territories', 
  'aus': 'Australia', 'aut': 'Austria', 'aze': 'Azerbaijan', 'bel': 'Belgium', 'ben': 'Benin', 
  'bgd': 'Bangladesh', 'bgr': 'Bulgaria', 'bhr': 'Bahrain', 'bih': 'Bosnia and Herzegovina', 
  'blr': 'Belarus', 'bol': 'Bolivia', 'bra': 'Brazil', 'brb': 'Barbados', 'brn': 'Brunei', 
  'btn': 'Bhutan', 'bwa': 'Botswana', 'caf': 'Central African Republic', 'can': 'Canada', 
  'che': 'Switzerland', 'chl': 'Chile', 'chn': 'China', 'civ': 'Côte d\'Ivoire', 'cmr': 'Cameroon', 
  'cod': 'DR Congo', 'cog': 'Congo', 'col': 'Colombia', 'com': 'Comoros', 'cpv': 'Cape Verde', 
  'cri': 'Costa Rica', 'cub': 'Cuba', 'cyp': 'Cyprus', 'cze': 'Czech Republic', 'deu': 'Germany', 
  'dji': 'Djibouti', 'dnk': 'Denmark', 'dom': 'Dominican Republic', 'dza': 'Algeria', 'ecu': 'Ecuador', 
  'egy': 'Egypt', 'eri': 'Eritrea', 'esh': 'Western Sahara', 'esp': 'Spain', 'est': 'Estonia', 
  'eth': 'Ethiopia', 'fin': 'Finland', 'fji': 'Fiji', 'fra': 'France', 'fro': 'Faroe Islands', 
  'gbr': 'United Kingdom', 'geo': 'Georgia', 'ggy': 'Guernsey', 'gha': 'Ghana', 'gib': 'Gibraltar', 
  'gin': 'Guinea', 'glp': 'Guadeloupe', 'gmb': 'Gambia', 'gnb': 'Guinea-Bissau', 'grc': 'Greece', 
  'gtm': 'Guatemala', 'guf': 'French Guiana', 'guy': 'Guyana', 'hkg': 'Hong Kong', 'hnd': 'Honduras', 
  'hrv': 'Croatia', 'hun': 'Hungary', 'idn': 'Indonesia', 'imn': 'Isle of Man', 'ind': 'India', 
  'irl': 'Ireland', 'irn': 'Iran', 'irq': 'Iraq', 'isl': 'Iceland', 'isr': 'Israel', 'ita': 'Italy', 
  'jam': 'Jamaica', 'jey': 'Jersey', 'jor': 'Jordan', 'jpn': 'Japan', 'kaz': 'Kazakhstan', 
  'ken': 'Kenya', 'kgz': 'Kyrgyzstan', 'khm': 'Cambodia', 'kor': 'South Korea', 'kwt': 'Kuwait', 
  'lbn': 'Lebanon', 'lby': 'Libya', 'lie': 'Liechtenstein', 'lka': 'Sri Lanka', 'lso': 'Lesotho', 
  'ltu': 'Lithuania', 'lux': 'Luxembourg', 'lva': 'Latvia', 'mac': 'Macao', 'maf': 'Saint Martin', 
  'mar': 'Morocco', 'mco': 'Monaco', 'mda': 'Moldova', 'mdg': 'Madagascar', 'mex': 'Mexico', 
  'mkd': 'North Macedonia', 'mli': 'Mali', 'mlt': 'Malta', 'mmr': 'Myanmar', 'mne': 'Montenegro', 
  'moz': 'Mozambique', 'mrt': 'Mauritania', 'mtq': 'Martinique', 'mus': 'Mauritius', 'mys': 'Malaysia', 
  'nam': 'Namibia', 'ner': 'Niger', 'nga': 'Nigeria', 'nic': 'Nicaragua', 'nld': 'Netherlands', 
  'nor': 'Norway', 'npl': 'Nepal', 'nzl': 'New Zealand', 'omn': 'Oman', 'pak': 'Pakistan', 
  'pan': 'Panama', 'per': 'Peru', 'phl': 'Philippines', 'png': 'Papua New Guinea', 'pol': 'Poland', 
  'pri': 'Puerto Rico', 'prt': 'Portugal', 'pry': 'Paraguay', 'pse': 'Palestine', 'qat': 'Qatar', 
  'reu': 'Réunion', 'rou': 'Romania', 'rus': 'Russia', 'rwa': 'Rwanda', 'sau': 'Saudi Arabia', 
  'sdn': 'Sudan', 'sen': 'Senegal', 'sgp': 'Singapore', 'slv': 'El Salvador', 'smr': 'San Marino', 
  'som': 'Somalia', 'srb': 'Serbia', 'ssd': 'South Sudan', 'sur': 'Suriname', 'svk': 'Slovakia', 
  'svn': 'Slovenia', 'swe': 'Sweden', 'swz': 'Eswatini', 'syr': 'Syria', 'tcd': 'Chad', 
  'tgo': 'Togo', 'tha': 'Thailand', 'tjk': 'Tajikistan', 'tkm': 'Turkmenistan', 'tls': 'Timor-Leste', 
  'tun': 'Tunisia', 'tur': 'Turkey', 'twn': 'Taiwan', 'tza': 'Tanzania', 'uga': 'Uganda', 
  'ukr': 'Ukraine', 'ury': 'Uruguay', 'usa': 'United States', 'uzb': 'Uzbekistan', 'ven': 'Venezuela', 
  'vnm': 'Vietnam', 'xkk': 'Kosovo', 'yem': 'Yemen', 'zaf': 'South Africa', 'zmb': 'Zambia', 
  'zwe': 'Zimbabwe', 'zzz': 'Unknown Region'
};

const normalizeCountry = (val: string): string => {
  if (!val) return 'Other';
  const clean = val.toLowerCase().trim();
  
  // 1. Check if it's a known code in our map
  if (COUNTRY_CODE_TO_NAME[clean]) return COUNTRY_CODE_TO_NAME[clean];
  
  // 2. If it's longer than 3 characters, assume it's a full name and capitalize it (fixes "austria" -> "Austria")
  if (clean.length > 3) {
    return clean.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  }
  
  // 3. Fallback to uppercase for unknown short codes
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

            <div className="mt-auto pt-6 border-t border-slate-100 space-y-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="comp_enabled_drop" 
                      checked={filters.comparison.enabled} 
                      onChange={e => setFilters({...filters, comparison: {...filters.comparison, enabled: e.target.checked}})} 
                      className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                    />
                    <label htmlFor="comp_enabled_drop" className="text-[10px] font-black uppercase text-slate-600 tracking-tight cursor-pointer">Compare</label>
                  </div>
                </div>
                {filters.comparison.enabled && (
                  <select 
                    className="w-full bg-white border border-slate-200 rounded-xl text-[10px] font-bold p-2 outline-none focus:ring-1 ring-indigo-500 shadow-sm" 
                    value={filters.comparison.type} 
                    onChange={e => setFilters({...filters, comparison: {...filters.comparison, type: e.target.value as any}})}
                  >
                    <option value="previous_period">vs Previous Period</option>
                    <option value="previous_year">vs Previous Year (YoY)</option>
                  </select>
                )}
              </div>

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

const ComparisonTooltip = ({ active, payload, label, currency = false, currencySymbol = '£', percent = false }: any) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0].payload;
    const currentDate = dataPoint.fullDateCurrent;
    const prevDate = dataPoint.fullDatePrevious;

    return (
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-white/10 min-w-[220px]">
        <div className="mb-3 border-b border-white/10 pb-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current: <span className="text-white">{currentDate}</span></p>
          {prevDate && <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Previous: <span className="text-white">{prevDate}</span></p>}
        </div>

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
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.stroke || entry.color }} />
                  <span className="text-[10px] font-black text-white">{entry.name.replace('(Cur)', '')}</span>
                </div>
                <div className="flex justify-between items-baseline gap-4 ml-4">
                  <span className="text-[11px] font-bold">
                    {currency ? `${currencySymbol}${curVal.toLocaleString()}` : percent ? `${curVal.toFixed(1)}%` : curVal.toLocaleString()}
                  </span>
                  {prevVal !== null && (
                    <div className={`flex items-center text-[9px] font-black ${diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {diff >= 0 ? '+' : ''}{diff.toFixed(1)}%
                    </div>
                  )}
                </div>
                {prevVal !== null && (
                  <div className="flex justify-between text-[8px] text-slate-500 ml-4 font-medium uppercase italic">
                    <span>Prev Period:</span>
                    <span>{currency ? `${currencySymbol}${prevVal.toLocaleString()}` : percent ? `${prevVal.toFixed(1)}%` : prevVal.toLocaleString()}</span>
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

const SidebarLink: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-200 group ${
      active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'
    }`}
  >
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
      
      {/* --- INICIO DEL BLOQUE MODIFICADO --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">URL & Keyword Precision Analysis</h4>
          <p className="text-[11px] font-bold text-slate-600">Jerarquía por URL y sus Top 20 Queries correspondientes</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* BOTÓN DE EXPORTAR */}
          <button 
            onClick={() => {
              const dataToExport = keywords.map(k => ({
                Keyword: k.keyword,
                Landing_Page: k.landingPage,
                Clicks: k.clicks,
                Impressions: k.impressions,
                CTR: k.ctr.toFixed(2) + "%",
                Type: k.queryType,
                Country: k.country
              }));
              exportToCSV(dataToExport, "SEO_Keywords_Full_Report");
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase transition-all shadow-lg shadow-indigo-600/20 w-full sm:w-auto"
          >
            <FileText size={14} /> Export All Keywords
          </button>

          {/* BUSCADOR */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Filtrar por URL o Keyword..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-1 ring-indigo-500 transition-all"
            />
          </div>
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
              {groupedByUrl.length > 0 ? groupedByUrl.map((page, i) => (
                <React.Fragment key={page.url}>
                  <tr 
                    onClick={() => toggleUrl(page.url)}
                    className="group cursor-pointer hover:bg-slate-50/50 transition-colors border-b border-slate-50"
                  >
                    <td className="py-5 px-4 text-center">
                      {expandedUrls.has(page.url) ? 
                        <ChevronUp className="w-4 h-4 text-indigo-500" /> : 
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      }
                    </td>
                    <td className="py-5 px-4 max-w-md">
                      <div className="flex items-center gap-3">
                        <LinkIcon className="w-3 h-3 text-slate-300 flex-shrink-0" />
                        <span className="text-[11px] font-black text-slate-800 truncate block">{page.url}</span>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <ExternalLink className="w-3 h-3 text-indigo-400" />
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-4 text-right">
                      <div className="text-[11px] font-black text-slate-900">{page.clicks.toLocaleString()}</div>
                    </td>
                    <td className="py-5 px-4 text-right font-bold text-slate-600 text-[11px]">
                      {page.impressions.toLocaleString()}
                    </td>
                    <td className="py-5 px-4 text-right">
                      <div className="text-[11px] font-black text-slate-900">{page.ctr.toFixed(2)}%</div>
                      <div className="w-16 h-1 bg-slate-100 rounded-full mt-1.5 ml-auto overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${Math.min(page.ctr * 5, 100)}%` }} />
                      </div>
                    </td>
                  </tr>
                  {expandedUrls.has(page.url) && (
                    <tr>
                      <td colSpan={5} className="bg-slate-50/50 p-0 overflow-hidden">
                        <div className="animate-in slide-in-from-top-2 duration-200">
                          <table className="w-full ml-10 border-l-2 border-indigo-100 my-4">
                            <thead>
                              <tr className="border-b border-indigo-50/50">
                                <th className="py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest px-6">Top Queries (Limit 20)</th>
                                <th className="py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest px-4">Type</th>
                                <th className="py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest px-4 text-right">Clicks</th>
                                <th className="py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest px-4 text-right">Impr.</th>
                                <th className="py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest px-4 text-right">CTR</th>
                              </tr>
                            </thead>
                            <tbody>
                              {page.topQueries.map((q, idx) => (
                                <tr key={idx} className="hover:bg-indigo-50/30 border-b border-indigo-50/10">
                                  <td className="py-3 px-6">
                                    <span className="text-[10px] font-bold text-slate-700">{q.keyword}</span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tight ${q.queryType === 'Branded' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                                      {q.queryType}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <span className="text-[10px] font-black text-slate-900">{q.clicks.toLocaleString()}</span>
                                  </td>
                                  <td className="py-3 px-4 text-right font-bold text-slate-500 text-[10px]">
                                    {q.impressions.toLocaleString()}
                                  </td>
                                  <td className="py-3 px-4 text-right font-black text-slate-900 text-[10px]">
                                    {q.ctr.toFixed(2)}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )) : (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Search className="w-10 h-10 text-slate-200" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No matching search terms found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
const exportToCSV = (data: any[], filename: string) => {
  if (!data || !data.length) return;
  
  // Extraer cabeceras de las llaves del primer objeto
  const headers = Object.keys(data[0]).join(",");
  const rows = data.map(obj => 
    Object.values(obj)
      .map(val => typeof val === 'string' ? `"${val}"` : val) // Escapar strings con comas
      .join(",")
  );

  const csvContent = [headers, ...rows].join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
          dimensions: [
            { name: 'date' }, 
            { name: filters.ga4Dimension }, 
            { name: 'country' }, 
            { name: 'landingPage' }
          ],
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
        const respTotals = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/searchAnalytics/query`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${gscAuth.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate: start,
            endDate: end,
            dimensions: ['date', 'country'],
          })
        });
        const dataTotals = await respTotals.json();
        const totalAggregated = (dataTotals.rows || []).reduce((acc: any, row: any) => ({
          clicks: acc.clicks + row.clicks,
          impressions: acc.impressions + row.impressions,
        }), { clicks: 0, impressions: 0 });

        const dailyTotals = (dataTotals.rows || []).map((row: any) => ({
          date: row.keys[0],
          country: normalizeCountry(row.keys[1]),
          clicks: row.clicks,
          impressions: row.impressions,
          label
        }));

        const rowLimit = 25000;
        let allGranularRows: any[] = [];
        
        for (let page = 0; page < 2; page++) {
          const respGranular = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/searchAnalytics/query`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${gscAuth.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              startDate: start,
              endDate: end,
              dimensions: ['query', 'page', 'date', 'country'],
              rowLimit: rowLimit,
              startRow: page * rowLimit
            })
          });
          const dataGranular = await respGranular.json();
          if (dataGranular.error) throw new Error(dataGranular.error.message);
          if (dataGranular.rows) {
            allGranularRows = [...allGranularRows, ...dataGranular.rows];
          }
          if (!dataGranular.rows || dataGranular.rows.length < rowLimit) break;
        }

        const mapped = allGranularRows.map((row: any) => ({
            keyword: row.keys[0] || '',
            landingPage: row.keys[1] || '',
            date: row.keys[2] || '',
            country: normalizeCountry(row.keys[3]),
            dateRangeLabel: label,
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: (row.ctr || 0) * 100,
            sessions: 0, conversionRate: 0, revenue: 0, sales: 0, addToCarts: 0, checkouts: 0, queryType: 'Non-Branded' as QueryType
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
          {activeTab === DashboardTab.SEO_BY_COUNTRY && <SeoMarketplaceView data={filteredDailyData} keywordData={filteredKeywordData} gscDailyTotals={gscDailyTotals} gscTotals={gscTotals} aggregate={aggregate} comparisonEnabled={filters.comparison.enabled} currencySymbol={currencySymbol} grouping={grouping} isBranded={isBranded} queryTypeFilter={filters.queryType} countryFilter={filters.country} />}
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

const ShareOfSearchAnalysis = ({ stats, currencySymbol }: { stats: any, currencySymbol: string }) => {
  const sessionShare = useMemo(() => {
    const searchVal = stats.organic.current.sessions + stats.paid.current.sessions;
    const othersVal = Math.max(0, stats.total.current.sessions - searchVal);
    const totalVal = stats.total.current.sessions || 1;
    return [
      { name: 'Search (Org + Paid)', value: searchVal, percent: (searchVal / totalVal) * 100 },
      { name: 'Other Channels', value: othersVal, percent: (othersVal / totalVal) * 100 }
    ];
  }, [stats]);

  const revenueShare = useMemo(() => {
    const searchVal = stats.organic.current.revenue + stats.paid.current.revenue;
    const othersVal = Math.max(0, stats.total.current.revenue - searchVal);
    const totalVal = stats.total.current.revenue || 1;
    return [
      { name: 'Search (Org + Paid)', value: searchVal, percent: (searchVal / totalVal) * 100 },
      { name: 'Other Channels', value: othersVal, percent: (othersVal / totalVal) * 100 }
    ];
  }, [stats]);

  const COLORS = ['#6366f1', '#94a3b8']; 

  const renderDonut = (data: any[], title: string, metric: string, isCurrency = false) => (
    <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm flex flex-col items-center h-full">
      <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-6 self-start">{title}</h4>
      <div className="w-full h-[220px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              content={({ active, payload }: any) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="bg-slate-900 text-white p-3 rounded-xl border border-white/10 shadow-xl">
                      <p className="text-[9px] font-black uppercase tracking-widest mb-1">{d.name}</p>
                      <p className="text-[11px] font-bold">
                        {isCurrency ? `${currencySymbol}${d.value.toLocaleString()}` : d.value.toLocaleString()} {metric}
                      </p>
                      <p className="text-[9px] text-slate-400">{d.percent.toFixed(1)}% weight</p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-black text-slate-900">{data[0].percent.toFixed(1)}%</span>
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Search Share</span>
        </div>
      </div>
      <div className="w-full space-y-3 mt-4">
        {data.map((item, i) => (
          <div key={i} className="flex justify-between items-center text-[10px] font-bold">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
              <span className="text-slate-600">{item.name}</span>
            </div>
            <span className="text-slate-900">{isCurrency ? `${currencySymbol}${item.value.toLocaleString()}` : item.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full mt-8">
      {renderDonut(sessionShare, 'Share of Total Sessions', 'Sessions')}
      {renderDonut(revenueShare, 'Share of Total Revenue', 'Revenue', true)}
    </div>
  );
};

const CountryPerformanceTable = ({ title, data, type, currencySymbol, comparisonEnabled }: { 
  title: string; 
  data: DailyData[]; 
  type: 'Organic' | 'Paid';
  currencySymbol: string;
  comparisonEnabled: boolean;
}) => {
  // Procesamos la data completa
  const countryStats = useMemo(() => {
    const channelData = data.filter(d => 
      type === 'Organic' ? d.channel.toLowerCase().includes('organic') : 
      (d.channel.toLowerCase().includes('paid') || d.channel.toLowerCase().includes('cpc'))
    );

    const map: Record<string, { country: string; current: any; previous: any }> = {};

    channelData.forEach(d => {
      const normalizedName = normalizeCountry(d.country);
      if (!map[normalizedName]) {
        map[normalizedName] = { 
          country: normalizedName, 
          current: { sessions: 0, sales: 0, revenue: 0 }, 
          previous: { sessions: 0, sales: 0, revenue: 0 } 
        };
      }
      const target = d.dateRangeLabel === 'previous' ? map[normalizedName].previous : map[normalizedName].current;
      target.sessions += d.sessions;
      target.sales += d.sales;
      target.revenue += d.revenue;
    });

    return Object.values(map).map(item => ({
      country: item.country,
      sessions: item.current.sessions,
      cr: item.current.sessions > 0 ? (item.current.sales / item.current.sessions) * 100 : 0,
      revenue: item.current.revenue,
      sales: item.current.sales,
      growth: item.previous.sessions > 0 ? ((item.current.sessions - item.previous.sessions) / item.previous.sessions) * 100 : 0
    })).sort((a, b) => b.sessions - a.sessions);
  }, [data, type]);

  const handleDownload = () => {
    // Exportamos countryStats completo (sin el slice de 10)
    const exportData = countryStats.map(c => ({
      Country: c.country,
      Sessions: c.sessions,
      Conversion_Rate: c.cr.toFixed(2) + "%",
      Revenue: c.revenue.toFixed(2),
      Sales: c.sales,
      Growth_Sessions: c.growth.toFixed(2) + "%"
    }));
    exportToCSV(exportData, `Full_Data_${type}_Performance`);
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full w-full">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${type === 'Organic' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
            <Globe size={18} />
          </div>
          <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{title}</h4>
        </div>
        
        <button 
          onClick={handleDownload}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-[9px] font-black uppercase transition-all shadow-md"
        >
          <FileText size={12} /> Export CSV (All Data)
        </button>
      </div>

      <div className="overflow-x-auto custom-scrollbar flex-1">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Country</th>
              <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Sessions</th>
              <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Conv. Rate</th>
              <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Revenue</th>
              <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Sales</th>
              {comparisonEnabled && <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Growth (Sess)</th>}
            </tr>
          </thead>
          <tbody>
            {countryStats.slice(0, 10).map((item, idx) => (
              <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                <td className="py-4 px-4 font-black text-slate-800 text-[11px]">{item.country}</td>
                <td className="py-4 px-4 text-right font-bold text-slate-900 text-[11px]">{item.sessions.toLocaleString()}</td>
                <td className="py-4 px-4 text-right font-bold text-indigo-600 text-[11px]">{item.cr.toFixed(2)}%</td>
                <td className="py-4 px-4 text-right font-bold text-emerald-600 text-[11px]">{currencySymbol}{item.revenue.toLocaleString()}</td>
                <td className="py-4 px-4 text-right font-bold text-slate-900 text-[11px]">{item.sales.toLocaleString()}</td>
                {comparisonEnabled && (
                  <td className="py-4 px-4 text-right">
                    <div className={`flex items-center justify-end text-[10px] font-bold ${item.growth >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {item.growth >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                      {Math.abs(item.growth).toFixed(1)}%
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {countryStats.length === 0 && <EmptyState text="No regional data available" />}
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
    
    // 1. Filter and sort data chronologically for each period
    const curRaw = data
      .filter(d => d.dateRangeLabel === 'current')
      .sort((a,b) => a.date.localeCompare(b.date));
      
    const prevRaw = data
      .filter(d => d.dateRangeLabel === 'previous')
      .sort((a,b) => a.date.localeCompare(b.date));

    // 2. Helper function to group data into buckets (Day, Week, Month)
    // This aggregates multiple entries for the same date/bucket (e.g. splitting by channel)
    const createBuckets = (rawData: DailyData[]) => {
       const byDate: Record<string, any> = {};
       
       rawData.forEach(d => {
         // Determine bucket key based on grouping preference
         let key = d.date;
         if (grouping === 'weekly') key = formatDate(getStartOfWeek(new Date(d.date)));
         if (grouping === 'monthly') key = `${d.date.slice(0, 7)}-01`;

         if (!byDate[key]) {
            byDate[key] = { 
                date: key, // This is the bucket identifier (e.g., specific day, start of week, start of month)
                org: 0, paid: 0, orgRev: 0, paidRev: 0, totalSess: 0, totalRev: 0 
            };
         }
         
         const isOrg = d.channel?.toLowerCase().includes('organic');
         const isPaid = d.channel?.toLowerCase().includes('paid') || d.channel?.toLowerCase().includes('cpc');
         
         if (isOrg) { 
             byDate[key].org += d.sessions; 
             byDate[key].orgRev += d.revenue; 
         }
         if (isPaid) { 
             byDate[key].paid += d.sessions; 
             byDate[key].paidRev += d.revenue; 
         }
         
         byDate[key].totalSess += d.sessions;
         byDate[key].totalRev += d.revenue;
       });

       // Return array sorted by date ensures Day 1 is always first
       return Object.values(byDate).sort((a:any, b:any) => a.date.localeCompare(b.date));
    };

    const curBuckets = createBuckets(curRaw);
    const prevBuckets = createBuckets(prevRaw);
    
    // 3. Merge buckets by INDEX to create the overlay effect
    // We iterate up to the max length of days/weeks/months available
    const maxLen = Math.max(curBuckets.length, prevBuckets.length);
    const finalChartData = [];

    for (let i = 0; i < maxLen; i++) {
      const c = curBuckets[i] || {};
      const p = prevBuckets[i] || {};

      // Create a display label for the X-Axis
      // We use the current period's date if available, otherwise a generic label
      let xLabel = `Period ${i + 1}`;
      
      const refDate = c.date || p.date;
      if (refDate) {
         const dateObj = new Date(refDate);
         xLabel = grouping === 'monthly' 
           ? dateObj.toLocaleDateString('en-US', { month: 'short' })
           : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }

      finalChartData.push({
        date: xLabel, // Visual label for X-Axis
        
        // Metadata for tooltips (real dates)
        fullDateCurrent: c.date || 'N/A',
        fullDatePrevious: p.date || 'N/A',

        // Metrics for Current Period
        'Organic (Cur)': c.org || 0,
        'Paid (Cur)': c.paid || 0,
        'Organic Rev (Cur)': c.orgRev || 0,
        'Paid Rev (Cur)': c.paidRev || 0,

        // Metrics for Previous Period
        'Organic (Prev)': p.org || 0,
        'Paid (Prev)': p.paid || 0,
        'Organic Rev (Prev)': p.orgRev || 0,
        'Paid Rev (Prev)': p.paidRev || 0,

        // Calculated Shares
        'Search Share Sessions (Cur)': c.totalSess > 0 ? ((c.org + c.paid) / c.totalSess) * 100 : 0,
        'Search Share Revenue (Cur)': c.totalRev > 0 ? ((c.orgRev + c.paidRev) / c.totalRev) * 100 : 0,
        'Search Share Sessions (Prev)': p.totalSess > 0 ? ((p.org + p.paid) / p.totalSess) * 100 : 0,
        'Search Share Revenue (Prev)': p.totalRev > 0 ? ((p.orgRev + p.paidRev) / p.totalRev) * 100 : 0,
      });
    }

    return finalChartData;
  }, [data, grouping]);

  const organicFunnelData = useMemo(() => [
    { stage: 'Sessions', value: stats.organic.current.sessions },
    { stage: 'Add to Basket', value: stats.organic.current.addToCarts },
    { stage: 'Checkout', value: stats.organic.current.checkouts },
    { stage: 'Sale', value: stats.organic.current.sales },
  ], [stats.organic.current]);

  const paidFunnelData = useMemo(() => [
    { stage: 'Sessions', value: stats.paid.current.sessions },
    { stage: 'Add to Basket', value: stats.paid.current.addToCarts },
    { stage: 'Checkout', value: stats.paid.current.checkouts },
    { stage: 'Sale', value: stats.paid.current.sales },
  ], [stats.paid.current]);

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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Sessions Performance (Time Overlay)</h4>
            <p className="text-[11px] font-bold text-slate-600">Línea sólida = Actual | Línea discontinua = Anterior</p>
          </div>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {['daily', 'weekly', 'monthly'].map(g => <button key={g} onClick={() => setGrouping(g as any)} className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg transition-all ${grouping === g ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{g === 'daily' ? 'Day' : g === 'weekly' ? 'Week' : 'Month'}</button>)}
          </div>
        </div>
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
                
                {comparisonEnabled && (
                  <>
                    <Line name="Organic (Prev)" type="monotone" dataKey="Organic (Prev)" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" opacity={0.3} dot={false} />
                    <Line name="Paid (Prev)" type="monotone" dataKey="Paid (Prev)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" opacity={0.3} dot={false} />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No data available to chart" />}
        </div>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Revenue Evolution (Time Overlay)</h4>
            <p className="text-[11px] font-bold text-slate-600">Moneda: {currencySymbol}</p>
          </div>
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
                
                <Line name="Organic Rev (Cur)" type="monotone" dataKey="Organic Rev (Cur)" stroke="#6366f1" strokeWidth={3} dot={false} />
                <Line name="Paid Rev (Cur)" type="monotone" dataKey="Paid Rev (Cur)" stroke="#f59e0b" strokeWidth={3} dot={false} />
                
                {comparisonEnabled && (
                  <>
                    <Line name="Organic Rev (Prev)" type="monotone" dataKey="Organic Rev (Prev)" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" opacity={0.3} dot={false} />
                    <Line name="Paid Rev (Prev)" type="monotone" dataKey="Paid Rev (Prev)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" opacity={0.3} dot={false} />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No revenue data available to chart" />}
        </div>
      </div>

<div className="grid grid-cols-1 gap-8"> {/* Ahora ocuparán todo el ancho */}
  <CountryPerformanceTable 
    title="Organic performance by country" 
    data={data} 
    type="Organic" 
    currencySymbol={currencySymbol} 
    comparisonEnabled={comparisonEnabled} 
  />
  <CountryPerformanceTable 
    title="Paid performance by country" 
    data={data} 
    type="Paid" 
    currencySymbol={currencySymbol} 
    comparisonEnabled={comparisonEnabled} 
  />
</div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <EcommerceFunnel title="Organic Search Funnel" data={organicFunnelData} color="indigo" />
        <EcommerceFunnel title="Paid Search Funnel" data={paidFunnelData} color="amber" />
      </div>

      <div className="mt-8 space-y-4">
        <div className="flex items-center gap-3 px-2">
          <div className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center text-white font-bold text-[9px] shadow-lg shadow-violet-600/20">
            <PieIcon size={14} />
          </div>
          <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Global Search Share (Market Dominance)</h4>
        </div>
        <ShareOfSearchAnalysis stats={stats} currencySymbol={currencySymbol} />
      </div>

      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm mt-8 overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Global Search Share Trend (Time Overlay)</h4>
            <p className="text-[11px] font-bold text-slate-600">Porcentaje de peso de búsqueda sobre el total de canales por período</p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl">
             <button onClick={() => setWeightMetric('sessions')} className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${weightMetric === 'sessions' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Share Sessions %</button>
             <button onClick={() => setWeightMetric('revenue')} className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${weightMetric === 'revenue' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Share Revenue %</button>
          </div>
        </div>
        <div className="h-[350px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} tickFormatter={(val) => `${val.toFixed(1)}%`} />
                <Tooltip content={<ComparisonTooltip percent />} />
                <Legend verticalAlign="top" align="center" iconType="circle" />
                <Line name={`${weightMetric === 'sessions' ? 'Share Sessions' : 'Share Revenue'} (Cur)`} type="monotone" dataKey={weightMetric === 'sessions' ? 'Search Share Sessions (Cur)' : 'Search Share Revenue (Cur)'} stroke="#8b5cf6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                {comparisonEnabled && (
                  <Line name={`${weightMetric === 'sessions' ? 'Share Sessions' : 'Share Revenue'} (Prev)`} type="monotone" dataKey={weightMetric === 'sessions' ? 'Search Share Sessions (Prev)' : 'Search Share Revenue (Prev)'} stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" opacity={0.3} dot={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No share data available to chart" />}
        </div>
      </div>
    </div>
  );
};

const CountryShareAnalysis = ({ data, currencySymbol }: { data: any[], currencySymbol: string }) => {
  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316', '#3b82f6'];

  const totalSessions = useMemo(() => data.reduce((acc, curr) => acc + curr.traffic, 0) || 1, [data]);
  const totalRevenue = useMemo(() => data.reduce((acc, curr) => acc + curr.revenue, 0) || 1, [data]);

  const sessionShare = useMemo(() => data.map((d, i) => ({ 
    ...d, 
    value: d.traffic, 
    percent: (d.traffic / totalSessions) * 100,
    color: COLORS[i % COLORS.length]
  })).sort((a,b) => b.value - a.value), [data, totalSessions]);

  const revenueShare = useMemo(() => data.map((d, i) => ({ 
    ...d, 
    value: d.revenue, 
    percent: (d.revenue / totalRevenue) * 100,
    color: COLORS[i % COLORS.length]
  })).sort((a,b) => b.value - a.value), [data, totalRevenue]);

  const efficiencyRank = useMemo(() => data.map((d, i) => ({
    name: d.country,
    efficiency: d.revenue / d.traffic,
    color: COLORS[i % COLORS.length]
  })).sort((a,b) => b.efficiency - a.efficiency), [data]);

  const renderDonut = (shareData: any[], title: string, metric: string, isCurrency = false) => (
    <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm h-full flex flex-col">
      <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-6">{title}</h4>
      <div className="flex-1 h-[250px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={shareData}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={95}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {shareData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              content={({ active, payload }: any) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="bg-slate-900 text-white p-3 rounded-xl border border-white/10 shadow-xl">
                      <p className="text-[9px] font-black uppercase tracking-widest mb-1">{d.country}</p>
                      <p className="text-[11px] font-bold">
                        {isCurrency ? `${currencySymbol}${d.value.toLocaleString()}` : d.value.toLocaleString()} {metric}
                      </p>
                      <p className="text-[9px] text-slate-400">{d.percent.toFixed(1)}% contribution</p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Market</span>
          <span className="text-sm font-black text-slate-900">Distribution</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-6 border-t border-slate-50 pt-6">
        {shareData.slice(0, 8).map((item, i) => (
          <div key={i} className="flex items-center justify-between text-[9px] font-bold">
            <div className="flex items-center gap-1.5 truncate mr-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-slate-600 truncate">{item.country}</span>
            </div>
            <span className="text-slate-900 flex-shrink-0">{item.percent.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6">
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {renderDonut(sessionShare, 'Volume Contribution (Sessions)', 'Sessions')}
          {renderDonut(revenueShare, 'Value Contribution (Revenue)', 'Revenue', true)}
       </div>
       <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Country Efficiency Leaderboard</h4>
              <p className="text-[11px] font-bold text-slate-600">Ingreso promedio generado por cada sesión orgánica por país</p>
            </div>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Trophy size={16} />
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={efficiencyRank} margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} tickFormatter={(val) => `${currencySymbol}${val}`} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#1e293b'}} />
                <Tooltip cursor={{fill: 'transparent'}} content={({ active, payload }: any) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl border border-white/10 shadow-xl">
                          <p className="text-[9px] font-black uppercase tracking-widest mb-1">{d.name}</p>
                          <p className="text-[11px] font-bold text-emerald-400">{currencySymbol}{d.efficiency.toFixed(2)} per session</p>
                        </div>
                      );
                    }
                    return null;
                }} />
                <Bar dataKey="efficiency" radius={[0, 12, 12, 0]} barSize={24}>
                  {efficiencyRank.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.efficiency > (totalRevenue / totalSessions) ? '#10b981' : '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
       </div>
    </div>
  );
};

const SeoMarketplaceView = ({ data, keywordData, gscDailyTotals, gscTotals, aggregate, comparisonEnabled, currencySymbol, grouping, isBranded, queryTypeFilter, countryFilter }: {
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
  countryFilter: string;
}) => {
  const [brandedMetric, setBrandedMetric] = useState<'clicks' | 'impressions'>('clicks');
  const organicGa4 = useMemo(() => aggregate(data.filter((d: any) => d.channel?.toLowerCase().includes('organic'))), [data, aggregate]);
  const gscStats = useMemo(() => {
    if (!gscTotals) return { current: { clicks: 0, impressions: 0, ctr: 0 }, changes: { clicks: 0, impressions: 0, ctr: 0 } };
    const getRangeStats = (label: 'current' | 'previous') => {
      const visibleItems = keywordData.filter(k => k.dateRangeLabel === label);
      const brandedSum = visibleItems.filter(k => isBranded(k.keyword)).reduce((acc, k) => ({ clicks: acc.clicks + k.clicks, impressions: acc.impressions + k.impressions }), { clicks: 0, impressions: 0 });
      const nonBrandedSumVisible = visibleItems.filter(k => !isBranded(k.keyword)).reduce((acc, k) => ({ clicks: acc.clicks + k.clicks, impressions: acc.impressions + k.impressions }), { clicks: 0, impressions: 0 });
      const totalSumForCurrentScope = visibleItems.reduce((acc, k) => ({ clicks: acc.clicks + k.clicks, impressions: acc.impressions + k.impressions }), { clicks: 0, impressions: 0 });
      if (queryTypeFilter === 'Branded') return brandedSum;
      if (queryTypeFilter === 'Non-Branded') return nonBrandedSumVisible;
      if (countryFilter !== 'All') return totalSumForCurrentScope;
      return label === 'current' ? gscTotals.current : gscTotals.previous;
    };
    const cur = getRangeStats('current');
    const prev = getRangeStats('previous');
    const getChange = (c: number, p: number) => p === 0 ? 0 : ((c - p) / p) * 100;
    return {
      current: { ...cur, ctr: cur.impressions > 0 ? (cur.clicks / cur.impressions) * 100 : 0 },
      changes: {
        clicks: getChange(cur.clicks, prev.clicks),
        impressions: getChange(cur.impressions, prev.impressions),
        ctr: getChange(cur.clicks / (cur.impressions || 1), prev.clicks / (prev.impressions || 1))
      }
    };
  }, [gscTotals, keywordData, queryTypeFilter, countryFilter, isBranded]);

  const brandedTrendData = useMemo(() => {
    if (!gscDailyTotals.length) return [];
    const getBucket = (dateStr: string) => {
      if (grouping === 'weekly') return formatDate(getStartOfWeek(new Date(dateStr)));
      if (grouping === 'monthly') return `${dateStr.slice(0, 7)}-01`;
      return dateStr;
    };
    const curDaily = gscDailyTotals.filter(t => t.label === 'current' && (countryFilter === 'All' || t.country === countryFilter)).sort((a,b) => a.date.localeCompare(b.date));
    const prevDaily = gscDailyTotals.filter(t => t.label === 'previous' && (countryFilter === 'All' || t.country === countryFilter)).sort((a,b) => a.date.localeCompare(b.date));
    const curBuckets = Array.from(new Set(curDaily.map(t => getBucket(t.date)))).sort();
    const prevBuckets = Array.from(new Set(prevDaily.map(t => getBucket(t.date)))).sort();
    const aggregateByBucket = (items: any[], kwData: KeywordData[]) => {
      const map: Record<string, any> = {};
      items.forEach(t => {
        const b = getBucket(t.date);
        if (!map[b]) map[b] = { totalClicks: 0, totalImpr: 0, brandedClicks: 0, brandedImpr: 0, genericClicks: 0, genericImpr: 0 };
        map[b].totalClicks += t.clicks;
        map[b].totalImpr += t.impressions;
      });
      kwData.forEach(k => {
        const b = getBucket(k.date || '');
        if (map[b]) {
          if (isBranded(k.keyword)) { map[b].brandedClicks += k.clicks; map[b].brandedImpr += k.impressions; }
          else { map[b].genericClicks += k.clicks; map[b].genericImpr += k.impressions; }
        }
      });
      return map;
    };
    const curMap = aggregateByBucket(curDaily, keywordData.filter(k => k.dateRangeLabel === 'current'));
    const prevMap = aggregateByBucket(prevDaily, keywordData.filter(k => k.dateRangeLabel === 'previous'));
    return curBuckets.map((bucket, index) => {
      const cur = curMap[bucket];
      const pBucket = prevBuckets[index];
      const prev = pBucket ? prevMap[pBucket] : null;
      const m = brandedMetric === 'clicks' ? 'Clicks' : 'Impr';
      return {
        date: bucket,
        [`Branded (Cur)`]: cur[`branded${m}`],
        [`Non-Branded (Cur)`]: cur[`generic${m}`],
        [`Anonymized (Cur)`]: Math.max(0, cur[`total${m}`] - (cur[`branded${m}`] + cur[`generic${m}`])),
        [`Branded (Prev)`]: prev ? prev[`branded${m}`] : 0,
        [`Non-Branded (Prev)`]: prev ? prev[`generic${m}`] : 0,
      };
    });
  }, [gscDailyTotals, keywordData, grouping, brandedMetric, isBranded, countryFilter]);

  const countryPerformanceData = useMemo(() => {
    const map: Record<string, { country: string; traffic: number; revenue: number; sales: number }> = {};
    data.filter((d: any) => d.dateRangeLabel === 'current' && d.channel?.toLowerCase().includes('organic'))
      .forEach((d: any) => { 
        const normalizedName = normalizeCountry(d.country);
        if (!map[normalizedName]) map[normalizedName] = { country: normalizedName, traffic: 0, revenue: 0, sales: 0 }; 
        map[normalizedName].traffic += d.sessions; 
        map[normalizedName].revenue += d.revenue;
        map[normalizedName].sales += d.sales;
      });
    return Object.values(map).filter(item => item.traffic > 0);
  }, [data]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard title="GSC Clicks" value={gscStats.current.clicks} comparison={comparisonEnabled ? gscStats.changes.clicks : undefined} icon={<MousePointer2 />} color="sky" />
        <KpiCard title="GSC Impressions" value={gscStats.current.impressions} comparison={comparisonEnabled ? gscStats.changes.impressions : undefined} icon={<Eye />} color="sky" />
        <KpiCard title="GSC Avg. CTR" value={`${gscStats.current.ctr.toFixed(2)}%`} comparison={comparisonEnabled ? gscStats.changes.ctr : undefined} icon={<Percent />} isPercent color="sky" />
        <KpiCard title="Organic Sessions" value={organicGa4.current.sessions} comparison={comparisonEnabled ? organicGa4.changes.sessions : undefined} icon={<TrendingUp />} color="indigo" />
        <KpiCard title="Organic Revenue" value={`${currencySymbol}${organicGa4.current.revenue.toLocaleString()}`} comparison={comparisonEnabled ? organicGa4.changes.revenue : undefined} icon={<Tag />} prefix={currencySymbol} color="emerald" />
        <KpiCard title="Organic Conv. Rate" value={`${organicGa4.current.cr.toFixed(2)}%`} comparison={comparisonEnabled ? organicGa4.changes.cr : undefined} icon={<ShoppingBag />} isPercent color="emerald" />
      </div>

      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm overflow-hidden w-full mt-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Brand vs Generic Search (Time Overlay)</h4>
            <p className="text-[11px] font-bold text-slate-600">Períodos superpuestos por posición relativa en el tiempo</p>
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
                <defs><linearGradient id="colorBrand" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} />
                <Tooltip content={<ComparisonTooltip />} />
                <Legend verticalAlign="top" align="center" iconType="circle" />
                <Area name="Branded (Cur)" type="monotone" dataKey="Branded (Cur)" stroke="#6366f1" fillOpacity={1} fill="url(#colorBrand)" strokeWidth={3} />
                <Area name="Non-Branded (Cur)" type="monotone" dataKey="Non-Branded (Cur)" stroke="#94a3b8" fillOpacity={0} strokeWidth={3} />
                {comparisonEnabled && (
                  <>
                    <Line name="Branded (Prev)" type="monotone" dataKey="Branded (Prev)" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" opacity={0.3} dot={false} />
                    <Line name="Non-Branded (Prev)" type="monotone" dataKey="Non-Branded (Prev)" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" opacity={0.3} dot={false} />
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No query data available" />}
        </div>
      </div>

      <div className="mt-8 space-y-4">
        <div className="flex items-center gap-3 px-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-[9px] shadow-lg shadow-indigo-600/20"><Globe size={14} /></div>
          <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Market Distribution & Efficiency Analysis</h4>
        </div>
        <CountryShareAnalysis data={countryPerformanceData} currencySymbol={currencySymbol} />
      </div>

      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm mt-8">
        <div className="flex justify-between items-center mb-8">
          <div><h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Market Efficiency Analysis (Current Period)</h4><p className="text-[11px] font-bold text-slate-600">Traffic vs Revenue | Size = Revenue Contribution</p></div>
        </div>
        <div className="h-[450px]">
          {countryPerformanceData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" dataKey="traffic" name="Traffic" unit=" sess." axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} />
                <YAxis type="number" dataKey="revenue" name="Revenue" unit={` ${currencySymbol}`} axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700}} tickFormatter={(val) => `${currencySymbol}${val.toLocaleString()}`} />
                <ZAxis type="number" dataKey="revenue" range={[100, 2000]} name="Market Value" unit={` ${currencySymbol}`} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }: any) => { 
                  if (active && payload && payload.length) { 
                    const d = payload[0].payload; 
                    return (
                      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-white/10">
                        <p className="text-[10px] font-black uppercase tracking-widest mb-2 border-b border-white/10 pb-2">{d.country}</p>
                        <div className="space-y-1">
                          <p className="text-[9px] flex justify-between gap-4"><span>Traffic:</span> <span className="font-bold">{d.traffic.toLocaleString()} sess.</span></p>
                          <p className="text-[9px] flex justify-between gap-4"><span>Revenue:</span> <span className="font-bold text-emerald-400">{currencySymbol}{d.revenue.toLocaleString()}</span></p>
                          <p className="text-[9px] flex justify-between gap-4"><span>Efficiency:</span> <span className="font-bold text-indigo-400">{currencySymbol}{(d.revenue / d.traffic).toFixed(2)}/sess.</span></p>
                        </div>
                      </div>
                    ); 
                  } 
                  return null; 
                }} />
                <Scatter name="Organic Markets" data={countryPerformanceData}>
                  {countryPerformanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.revenue > 10000 ? '#10b981' : entry.revenue > 5000 ? '#6366f1' : '#f59e0b'} fillOpacity={0.6} strokeWidth={2} stroke={entry.revenue > 10000 ? '#059669' : entry.revenue > 5000 ? '#4f46e5' : '#d97706'} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          ) : <EmptyState text="Not enough organic data for the Scatter Plot..." />}
        </div>
      </div>
    </div>
  );
};

export default App;
