
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
  // ISO-2 Codes (Common in GSC)
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
  // Removed duplicate 'at': 'Austria' on the following line (originally line 41)
  'ro': 'Romania', 'hu': 'Hungary', 'nz': 'New Zealand', 'ba': 'Bosnia and Herzegovina',
  'bih': 'Bosnia and Herzegovina',
  // ISO-3 Codes
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
  
  // Check if it's a known code
  if (COUNTRY_CODE_TO_NAME[clean]) return COUNTRY_CODE_TO_NAME[clean];
  
  // If it's a full name in lower case, capitalize it
  if (clean.length > 3) {
    return clean.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
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
    { label: 'Today', getValue: () => { const d = new Date(); return { start: d, end: d }; } },
    { label: 'Yesterday', getValue: () => { const d = new Date(); d.setDate(d.getDate() - 1); return { start: d, end: d }; } },
    { label: 'This week', getValue: () => { const d = new Date(); const start = getStartOfWeek(d); return { start, end: d }; } },
    { label: 'This month', getValue: () => { const d = new Date(); return { start: new Date(d.getFullYear(), d.getMonth(), 1), end: new Date(d.getFullYear(), d.getMonth() + 1, 0) }; } },
    {