
import { DailyData } from './types';

export const CURRENCY_SYMBOLS: Record<string, string> = {
  'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥', 'CAD': 'C$', 'AUD': 'A$', 'CHF': 'CHF', 'CNY': '¥', 'INR': '₹', 'MXN': '$', 'BRL': 'R$', 'PLN': 'zł'
};

export const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  // ISO-2 Codes
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
  // Short list of ISO-3 for fallback
  'usa': 'United States', 'gbr': 'United Kingdom', 'esp': 'Spain', 'fra': 'France', 'deu': 'Germany'
};

// Configuration for AI Traffic Sources
// Strictly restricted to requested domains
export const AI_SOURCE_REGEX_STRING = '(chatgpt\\.com|perplexity\\.ai|claude\\.ai|gemini\\.google\\.com)';

export const normalizeCountry = (val: string): string => {
  if (!val) return 'Other';
  const clean = val.toLowerCase().trim();
  
  if (COUNTRY_CODE_TO_NAME[clean]) return COUNTRY_CODE_TO_NAME[clean];
  
  if (clean.length > 3) {
    return clean.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  }
  
  return val.toUpperCase();
};

// "The Master Key" Normalizer
// 1. Removes Protocol & Domain
// 2. Removes Query Parameters (?gclid=...)
// 3. Removes Trailing Slash
// 4. Lowercases
export const extractPath = (url: string): string => {
  try {
    let path = url;

    // 1. Remove Protocol & Domain (if absolute URL)
    if (url.startsWith('http')) {
      try {
        const urlObj = new URL(url);
        path = urlObj.pathname; 
      } catch {
        // Fallback regex if URL constructor fails
        path = url.replace(/^https?:\/\/[^\/]+/, '');
      }
    }

    // 2. Remove Query Parameters (The GA4 Fix)
    // Equivalent to REGEXP_REPLACE(Page path, "\\?.*", "")
    path = path.split('?')[0];

    // 3. Remove Trailing Slash (The Consistency Fix)
    // Equivalent to REGEXP_REPLACE(..., "/$", "")
    if (path.endsWith('/') && path.length > 1) {
      path = path.slice(0, -1);
    }

    // 4. Ensure Leading Slash (Standardization)
    if (!path.startsWith('/')) {
        path = '/' + path;
    }

    return path.toLowerCase().trim();
  } catch (e) {
    return url;
  }
};

export const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

export const exportToCSV = (data: any[], filename: string) => {
  if (!data || !data.length) return;
  const headers = Object.keys(data[0]).join(",");
  const rows = data.map(obj => 
    Object.values(obj)
      .map(val => typeof val === 'string' ? `"${val}"` : val)
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

export const aggregateData = (data: DailyData[]) => {
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
