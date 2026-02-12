
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  RefreshCw, Filter, Globe, Tag, AlertCircle, Sparkles, Cpu, Activity, Menu, X
} from 'lucide-react';
import { DashboardTab, DashboardFilters, DailyData, KeywordData, Ga4Property, GscSite, Sa360Customer, QueryType, BridgeData, AiTrafficData, KeywordBridgeData } from './types';
import { getDashboardInsights, getOpenAiInsights } from './geminiService';
import GoogleLogin from './GoogleLogin'; 
import { CURRENCY_SYMBOLS, aggregateData, formatDate, normalizeCountry, extractPath, AI_SOURCE_REGEX_STRING } from './utils';
import { generateMockBridgeData, generateMockAiTrafficData } from './mockData';

// Import New Components and Views
import { Sidebar } from './components/Sidebar';
import { SettingsModal } from './components/SettingsModal';
import { DateRangeSelector } from './components/DateRangeSelector';
import { OrganicVsPaidView } from './views/OrganicVsPaidView';
import { SeoMarketplaceView } from './views/SeoMarketplaceView';
import { SeoDeepDiveView } from './views/SeoDeepDiveView';
import { SeoPpcBridgeView } from './views/SeoPpcBridgeView';
import { AiTrafficView } from './views/AiTrafficView';
import { Sa360PerformanceView } from './views/Sa360PerformanceView';

const CLIENT_ID = "333322783684-pjhn2omejhngckfd46g8bh2dng9dghlc.apps.googleusercontent.com"; 
const SCOPE_GA4 = "https://www.googleapis.com/auth/analytics.readonly";
const SCOPE_GSC = "https://www.googleapis.com/auth/webmasters.readonly";
const SCOPE_SA360 = "https://www.googleapis.com/auth/doubleclicksearch";

const PRIORITY_DIMENSIONS = [
  'sessionDefaultChannelGroup',
  'sessionSource',
  'sessionMedium',
  'sessionSourceMedium',
  'sessionCampaignName',
  'sessionSourcePlatform'
];

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

  const [sa360Auth, setSa360Auth] = useState<{ token: string; customer: Sa360Customer | null } | null>(() => {
    const saved = sessionStorage.getItem('sa360_auth');
    return saved ? JSON.parse(saved) : null;
  });

  const [availableProperties, setAvailableProperties] = useState<Ga4Property[]>([]);
  const [availableSites, setAvailableSites] = useState<GscSite[]>([]);
  
  // SA360: Main Accounts (Managers) and Sub Accounts (Clients)
  const [availableSa360Customers, setAvailableSa360Customers] = useState<Sa360Customer[]>([]);
  const [availableSa360SubAccounts, setAvailableSa360SubAccounts] = useState<Sa360Customer[]>([]);
  
  // Track selected Manager and selected Sub-account
  const [selectedSa360Customer, setSelectedSa360Customer] = useState<Sa360Customer | null>(null);
  const [selectedSa360SubAccount, setSelectedSa360SubAccount] = useState<Sa360Customer | null>(null);

  const [availableDimensions, setAvailableDimensions] = useState<{ label: string; value: string }[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('£');
  
  const [ga4Search, setGa4Search] = useState('');
  const [gscSearch, setGscSearch] = useState('');
  const [sa360Search, setSa360Search] = useState('');
  
  const [realDailyData, setRealDailyData] = useState<DailyData[]>([]);
  const [realKeywordData, setRealKeywordData] = useState<KeywordData[]>([]);
  
  const [bridgeDataGA4, setBridgeDataGA4] = useState<BridgeData[]>([]); 
  const [bridgeDataSA360, setBridgeDataSA360] = useState<BridgeData[]>([]); 
  const [keywordBridgeDataGA4, setKeywordBridgeDataGA4] = useState<KeywordBridgeData[]>([]);
  const [keywordBridgeDataSA360, setKeywordBridgeDataSA360] = useState<KeywordBridgeData[]>([]);
  
  const [aiTrafficData, setAiTrafficData] = useState<AiTrafficData[]>([]); 

  const [gscDailyTotals, setGscDailyTotals] = useState<any[]>([]);
  const [gscTotals, setGscTotals] = useState<{current: any, previous: any} | null>(null);
  
  const [isLoadingGa4, setIsLoadingGa4] = useState(false);
  const [isLoadingGsc, setIsLoadingGsc] = useState(false);
  const [isLoadingBridge, setIsLoadingBridge] = useState(false);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [isLoadingSa360, setIsLoadingSa360] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
    [DashboardTab.KEYWORD_DEEP_DIVE]: null,
    [DashboardTab.PPC_SEO_BRIDGE]: null,
    [DashboardTab.SA360_PERFORMANCE]: null,
    [DashboardTab.AI_TRAFFIC_MONITOR]: null
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
  const tokenClientSa360 = useRef<any>(null);

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

  // Fetch Main Managers (Accessible Customers)
  const fetchSa360Customers = async (token: string) => {
    try {
        setIsLoadingSa360(true);
        const resp = await fetch('/api/sa360/v0/customers:listAccessibleCustomers', {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!resp.ok) throw new Error(`SA360 Status: ${resp.status}`);
        const data = await resp.json();
        
        const customers: Sa360Customer[] = (data.resourceNames || []).map((rn: string) => {
            const id = rn.split('/')[1];
            return {
                resourceName: rn,
                id: id,
                descriptiveName: `Account ${id}` // Default name if not fetched deeper
            };
        });
        
        setAvailableSa360Customers(customers);
        
        // Auto-select the first one if not set
        if (customers.length > 0) {
           if (!sa360Auth?.customer) {
               setSa360Auth({ token, customer: customers[0] });
           }
           if (!selectedSa360Customer) {
               const defaultCust = customers[0];
               setSelectedSa360Customer(defaultCust);
               // Trigger fetching sub-accounts for this default customer
               fetchSa360SubAccounts(token, defaultCust.id);
           }
        }
    } catch (e) {
        console.error(e);
        setError("Error connecting to Search Ads 360 API.");
    } finally {
        setIsLoadingSa360(false);
    }
  };

  const fetchSa360SubAccounts = async (token: string, managerId: string) => {
  setIsLoadingSa360(true);
  let allLeafAccounts: Sa360Customer[] = [];
  let processingQueue = [managerId];
  let processedIds = new Set<string>();

  try {
    while (processingQueue.length > 0) {
      const currentId = processingQueue.shift();
      if (!currentId || processedIds.has(currentId)) continue;
      processedIds.add(currentId);

      const query = `
        SELECT 
          customer_client.resource_name, 
          customer_client.descriptive_name, 
          customer_client.manager, 
          customer_client.status, 
          customer_client.id
        FROM customer_client 
        WHERE customer_client.status = 'ENABLED'
      `.trim();

      // ESTA ES LA URL CORRECTA PARA SA360 v0
      const targetUrl = `/api/sa360/v0/customers/${currentId}/searchAds360:searchStream`;

      const resp = await fetch(targetUrl, {
        method: 'POST', // Forzamos POST
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json',
          'login-customer-id': managerId 
        },
        body: JSON.stringify({ query })
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        console.error(`Error en cuenta ${currentId}:`, errorText);
        continue;
      }

      const json = await resp.json();

      // searchStream devuelve un Array. Cada elemento tiene un campo "results"
      if (Array.isArray(json)) {
        for (const batch of json) {
          if (!batch.results) continue;

          for (const row of batch.results) {
            const client = row.customerClient;
            if (!client) continue;

            const id = String(client.id);
            const isManager = client.manager === true;
            const name = client.descriptiveName || 'Unnamed Account';

            if (isManager) {
              if (!processedIds.has(id)) {
                processingQueue.push(id);
              }
            } else {
              // Es una cuenta final (Leaf)
              allLeafAccounts.push({
                resourceName: client.resourceName,
                id: id,
                descriptiveName: name
              });
            }
          }
        }
      }
    }
    
    console.log("Cuentas finales encontradas:", allLeafAccounts);
    setAvailableSa360SubAccounts(allLeafAccounts);
    
    if (allLeafAccounts.length > 0) {
      setSelectedSa360SubAccount(allLeafAccounts[0]);
    }

  } catch (e) {
    console.error("Error fetching SA360 recursive sub-accounts:", e);
    setError("Error al obtener la jerarquía de cuentas.");
  } finally {
    setIsLoadingSa360(false);
  }
};

  // When selectedSa360Customer changes manually, fetch its sub-accounts
  const handleSa360CustomerChange = (customer: Sa360Customer | null) => {
    setSelectedSa360Customer(customer);
    setAvailableSa360SubAccounts([]); // Clear previous
    setSelectedSa360SubAccount(null); // Clear previous selection
    
    if (customer && sa360Auth?.token) {
        fetchSa360SubAccounts(sa360Auth.token, customer.id);
    }
  };

  const fetchAiTrafficData = async () => {
    if (!ga4Auth?.property || !ga4Auth.token) {
        if (!aiTrafficData.length) setAiTrafficData(generateMockAiTrafficData());
        return;
    }

    setIsLoadingAi(true);
    try {
        const resp = await fetch(`https://analyticsdata.googleapis.com/v1beta/${ga4Auth.property.id}:runReport`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${ga4Auth.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dateRanges: [{ startDate: filters.dateRange.start, endDate: filters.dateRange.end }],
                dimensions: [
                    { name: 'date' },
                    { name: 'sessionSource' },
                    { name: 'landingPage' }
                ],
                metrics: [
                    { name: 'sessions' },
                    { name: 'engagedSessions' },
                    { name: 'engagementRate' },
                    { name: 'totalRevenue' }
                ],
                dimensionFilter: {
                    filter: {
                        fieldName: 'sessionSource',
                        stringFilter: { 
                            matchType: 'FULL_REGEXP', 
                            value: AI_SOURCE_REGEX_STRING,
                            caseSensitive: false
                        }
                    }
                }
            })
        });
        const data = await resp.json();
        if (data.error) throw new Error(data.error.message);

        const processed: AiTrafficData[] = (data.rows || []).map((row: any) => {
            const dateStr = row.dimensionValues[0].value;
            return {
                date: `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`,
                source: row.dimensionValues[1].value,
                landingPage: row.dimensionValues[2].value,
                sessions: parseInt(row.metricValues[0].value),
                engagedSessions: parseInt(row.metricValues[1].value),
                engagementRate: parseFloat(row.metricValues[2].value) * 100,
                revenue: parseFloat(row.metricValues[3].value)
            };
        });
        setAiTrafficData(processed);
    } catch (e: any) {
        console.error("AI Traffic API Error", e);
        if(!aiTrafficData.length) setAiTrafficData(generateMockAiTrafficData());
    } finally {
        setIsLoadingAi(false);
    }
  };

// --- BRIDGE DATA: GA4 SESSIONS (ORGANIC vs PAID) ---
// UPDATED: Uses selectedSa360SubAccount for the SA360 portion
  const fetchBridgeData = async () => {
    if (!gscAuth?.site || !gscAuth.token) {
         if (!bridgeDataGA4.length) setBridgeDataGA4(generateMockBridgeData());
         return;
    }

    setIsLoadingBridge(true);
    
    const normalizeUrl = (url: string) => {
      if (!url || url === '(not set)') return '';
      try { url = decodeURIComponent(url); } catch (e) {}
      let path = url.toLowerCase().trim();
      path = path.replace(/^https?:\/\/[^\/]+/, '');
      path = path.split('?')[0];
      path = path.split('#')[0];
      if (path.endsWith('/') && path.length > 1) { path = path.slice(0, -1); }
      if (!path.startsWith('/')) { path = '/' + path; }
      return path;
    };

    try {
        const siteUrl = encodeURIComponent(gscAuth.site.siteUrl);
        
        // 1. GSC RAW DATA (Needed for ALL views)
        const gscResp = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/searchAnalytics/query`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${gscAuth.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                startDate: filters.dateRange.start,
                endDate: filters.dateRange.end,
                dimensions: ['page', 'query'], 
                rowLimit: 25000 
            })
        });

        const gscDataRaw = await gscResp.json();
        
        const organicRows = (gscDataRaw.rows || []).map((row: any) => ({
            query: row.keys[1],
            cleanPath: normalizeUrl(row.keys[0]), 
            fullUrl: row.keys[0], 
            rank: row.position,
            gscClicks: row.clicks
        }));

        const uniqueQueryMap: Record<string, { rankSum: number, count: number, bestRank: number, clicks: number }> = {};
        organicRows.forEach((row: any) => {
           const q = row.query.toLowerCase().trim();
           if (!uniqueQueryMap[q]) uniqueQueryMap[q] = { rankSum: 0, count: 0, bestRank: 999, clicks: 0 };
           uniqueQueryMap[q].rankSum += row.rank;
           uniqueQueryMap[q].count += 1;
           uniqueQueryMap[q].clicks += row.gscClicks;
           if (row.rank < uniqueQueryMap[q].bestRank) uniqueQueryMap[q].bestRank = row.rank;
        });

        // ---------------------------------------------------------
        // PROCESS A: SA360 DATA (Use selectedSa360SubAccount)
        // ---------------------------------------------------------
        // CRITICAL: We query the *Sub-account* ID, not the Manager ID, for accurate ad data.
        if (sa360Auth?.token && selectedSa360SubAccount) {
             const sa360PaidMap: Record<string, { clicksOrSessions: number, conversions: number, cost: number, impressions: number, campaigns: Set<string> }> = {};
             const sa360KeywordMap: Record<string, { clicksOrSessions: number, conversions: number, cost: number }> = {};

             const sa360UrlQuery = `
                SELECT 
                  landing_page_view.unmasked_url, 
                  metrics.cost_micros, 
                  metrics.clicks, 
                  metrics.impressions, 
                  metrics.conversions 
                FROM landing_page_view 
                WHERE segments.date BETWEEN '${filters.dateRange.start}' AND '${filters.dateRange.end}'
             `;
             const sa360KwQuery = `
                SELECT 
                  ad_group_criterion.keyword.text, 
                  metrics.cost_micros, 
                  metrics.clicks, 
                  metrics.impressions, 
                  metrics.conversions 
                FROM keyword_view 
                WHERE segments.date BETWEEN '${filters.dateRange.start}' AND '${filters.dateRange.end}'
             `;
             
             const fetchSa360 = async (query: string) => {
                // Using selectedSa360SubAccount.id specifically
                const headers: any = { 
                    Authorization: `Bearer ${sa360Auth.token}`, 
                    'Content-Type': 'application/json' 
                };
                
                // Point 2: login-customer-id Header included for manager context in reporting data
                if (selectedSa360Customer) {
                    headers['login-customer-id'] = selectedSa360Customer.id;
                }

                // REVERTED to direct URL to avoid 404 in non-proxy environments
                const res = await fetch(`/api/sa360/v0/customers/${selectedSa360SubAccount.id}/googleAds:searchStream`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({ query })
                });
                const json = await res.json();
                return (json || []).flatMap((batch: any) => batch.results || []);
             };

             try {
                const [urlRows, kwRows] = await Promise.all([fetchSa360(sa360UrlQuery), fetchSa360(sa360KwQuery)]);

                urlRows.forEach((row: any) => {
                    const url = row.landingPageView?.unmaskedUrl;
                    if(!url) return;
                    const path = normalizeUrl(url);
                    
                    if (!sa360PaidMap[path]) sa360PaidMap[path] = { clicksOrSessions: 0, conversions: 0, cost: 0, impressions: 0, campaigns: new Set(['SA360']) };
                    const metrics = row.metrics;
                    sa360PaidMap[path].clicksOrSessions += parseInt(metrics.clicks) || 0;
                    sa360PaidMap[path].conversions += parseFloat(metrics.conversions) || 0;
                    sa360PaidMap[path].impressions += parseInt(metrics.impressions) || 0;
                    sa360PaidMap[path].cost += (parseInt(metrics.costMicros) || 0) / 1000000;
                });

                kwRows.forEach((row: any) => {
                    const kw = row.adGroupCriterion?.keyword?.text;
                    if(!kw) return;
                    const cleanKw = kw.toLowerCase().trim();
                    if (!sa360KeywordMap[cleanKw]) sa360KeywordMap[cleanKw] = { clicksOrSessions: 0, conversions: 0, cost: 0 };
                    const metrics = row.metrics;
                    sa360KeywordMap[cleanKw].clicksOrSessions += parseInt(metrics.clicks) || 0;
                    sa360KeywordMap[cleanKw].conversions += parseFloat(metrics.conversions) || 0;
                    sa360KeywordMap[cleanKw].cost += (parseInt(metrics.costMicros) || 0) / 1000000;
                });

                // BUILD SA360 BRIDGE DATA
                const sa360Results: BridgeData[] = [];
                // Combine organic list with pure paid URLs (even if no organic data)
                const allPaths = new Set([...organicRows.map(o => o.cleanPath), ...Object.keys(sa360PaidMap)]);
                
                allPaths.forEach(path => {
                    const org = organicRows.find(o => o.cleanPath === path); // Simple lookup, simplified for loop performance
                    const paidStats = sa360PaidMap[path];
                    const organicProxy = org ? org.gscClicks : 0;
                    const organicRank = org ? org.rank : null;
                    const paidVolume = paidStats ? paidStats.clicksOrSessions : 0;
                    
                    if (organicProxy === 0 && paidVolume === 0) return;
                    
                    const totalVolume = organicProxy + paidVolume;
                    const paidShare = totalVolume > 0 ? (paidVolume / totalVolume) : 0;
                    
                    let action = "MAINTAIN";
                    if (organicRank && organicRank <= 3.0 && paidShare > 0.4) action = "CRITICAL (Overlap)";
                    else if (organicRank && organicRank <= 3.0 && paidVolume > 0) action = "REVIEW";
                    else if (organicRank && organicRank > 10.0 && paidVolume === 0) action = "INCREASE";

                    sa360Results.push({
                        url: path, 
                        query: org?.query || '(direct/none)', // Simplified
                        organicRank: organicRank, 
                        organicClicks: organicProxy, 
                        organicSessions: organicProxy, 
                        ppcCampaign: "SA360", 
                        ppcCost: paidStats?.cost || 0, 
                        ppcConversions: paidStats?.conversions || 0, 
                        ppcCpa: paidStats?.conversions ? paidStats.cost / paidStats.conversions : 0,
                        ppcSessions: paidVolume, 
                        ppcImpressions: paidStats?.impressions || 0, 
                        blendedCostRatio: paidShare, 
                        actionLabel: action, 
                        dataSource: 'SA360'
                    });
                });
                setBridgeDataSA360(sa360Results.sort((a, b) => b.blendedCostRatio - a.blendedCostRatio));

                // BUILD SA360 KEYWORD DATA
                const sa360KwResults: KeywordBridgeData[] = [];
                const allKeysSA = new Set([...Object.keys(sa360KeywordMap), ...Object.keys(uniqueQueryMap)]);
                allKeysSA.forEach(key => {
                    const paidData = sa360KeywordMap[key] || { clicksOrSessions: 0, conversions: 0 };
                    const gscData = uniqueQueryMap[key];
                    const paidVol = paidData.clicksOrSessions;
                    const orgVol = gscData ? gscData.clicks : 0;
                    if (paidVol === 0 && orgVol === 0) return;
                    const cvr = paidVol > 0 ? (paidData.conversions / paidVol) * 100 : 0;
                    let action = "MAINTAIN";
                    if (gscData?.bestRank && gscData.bestRank <= 3 && paidVol > 50) action = "CRITICAL (Cannibalization)";
                    else if (gscData?.bestRank && gscData.bestRank > 10 && paidVol === 0) action = "OPPORTUNITY (Growth)";

                    sa360KwResults.push({
                        keyword: key, organicRank: gscData?.bestRank || null, organicClicks: orgVol,
                        paidSessions: paidVol, paidCvr: cvr, actionLabel: action, dataSource: 'SA360'
                    });
                });
                setKeywordBridgeDataSA360(sa360KwResults.sort((a,b) => b.paidSessions - a.paidSessions));
             } catch (err) {
                 console.error("Error fetching specific SA360 account data:", err);
             }
        } else {
             // Clear data if no sub-account selected
             setBridgeDataSA360([]);
             setKeywordBridgeDataSA360([]);
        }

        // ---------------------------------------------------------
        // PROCESS B: GA4 DATA (If available)
        // ---------------------------------------------------------
        if (ga4Auth?.property && ga4Auth.token) {
             const ga4PaidMap: Record<string, { clicksOrSessions: number, conversions: number, cost: number, impressions: number, campaigns: Set<string> }> = {};
             const ga4KeywordMap: Record<string, { clicksOrSessions: number, conversions: number, cost: number }> = {};

             const ga4Resp = await fetch(`https://analyticsdata.googleapis.com/v1beta/${ga4Auth.property.id}:runReport`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${ga4Auth.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dateRanges: [{ startDate: filters.dateRange.start, endDate: filters.dateRange.end }],
                    dimensions: [ { name: 'landingPage' }, { name: 'sessionDefaultChannelGroup' }, { name: 'sessionCampaignName' } ],
                    metrics: [ { name: 'sessions' }, { name: 'sessionConversionRate' } ],
                    limit: 100000 
                })
            });
            const ga4Data = await ga4Resp.json();
            (ga4Data.rows || []).forEach((row: any) => {
                const rawUrl = row.dimensionValues[0].value;
                const channelGroup = row.dimensionValues[1].value.toLowerCase();
                const campaignName = row.dimensionValues[2].value;
                const sessions = parseInt(row.metricValues[0].value) || 0;
                const path = normalizeUrl(rawUrl);

                if ((channelGroup.includes('paid') || channelGroup.includes('cpc') || channelGroup.includes('ppc'))) {
                    if (!ga4PaidMap[path]) ga4PaidMap[path] = { clicksOrSessions: 0, conversions: 0, cost: 0, impressions: 0, campaigns: new Set() };
                    ga4PaidMap[path].clicksOrSessions += sessions;
                    let campType = "Other Paid";
                    const n = campaignName.toLowerCase();
                    if (n.includes('pmax')) campType = "⚡ PMax";
                    else if (n.includes('brand')) campType = "🛡️ Brand";
                    else if (n.includes('generic') || n.includes('non')) campType = "🌍 Generic";
                    else if (n !== '(not set)') campType = campaignName;
                    ga4PaidMap[path].campaigns.add(campType);
                }
            });

            // GA4 Keywords
            const ga4KwResp = await fetch(`https://analyticsdata.googleapis.com/v1beta/${ga4Auth.property.id}:runReport`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${ga4Auth.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dateRanges: [{ startDate: filters.dateRange.start, endDate: filters.dateRange.end }],
                    dimensions: [{ name: 'sessionGoogleAdsKeywordText' }],
                    metrics: [{ name: 'sessions' }, { name: 'sessionConversionRate' }],
                    limit: 25000
                })
            });
            const ga4KwData = await ga4KwResp.json();
            (ga4KwData.rows || []).forEach((row: any) => {
                 const kw = row.dimensionValues[0].value;
                 if (kw === '(not set)' || !kw) return; 
                 const cleanKw = kw.toLowerCase().trim();
                 const sessions = parseInt(row.metricValues[0].value) || 0;
                 const rate = parseFloat(row.metricValues[1].value) || 0;
                 if (!ga4KeywordMap[cleanKw]) ga4KeywordMap[cleanKw] = { clicksOrSessions: 0, conversions: 0, cost: 0 };
                 ga4KeywordMap[cleanKw].clicksOrSessions += sessions;
                 ga4KeywordMap[cleanKw].conversions += (sessions * rate);
            });

            // BUILD GA4 BRIDGE DATA
            const ga4Results: BridgeData[] = [];
            organicRows.forEach((org: any) => {
                const paidStats = ga4PaidMap[org.cleanPath];
                const organicProxy = org.gscClicks; 
                const paidVolume = paidStats ? paidStats.clicksOrSessions : 0;
                if (organicProxy === 0 && paidVolume === 0) return;
                const totalVolume = organicProxy + paidVolume;
                const paidShare = totalVolume > 0 ? (paidVolume / totalVolume) : 0;
                let action = "MAINTAIN";
                if (org.rank <= 3.0 && paidShare > 0.4) action = "CRITICAL (Overlap)";
                else if (org.rank <= 3.0 && paidVolume > 0) action = "REVIEW";
                else if (org.rank > 10.0 && paidVolume === 0) action = "INCREASE";
                let campDisplay = "None";
                if (paidStats && paidStats.campaigns.size > 0) campDisplay = Array.from(paidStats.campaigns).join(' + ');

                ga4Results.push({
                    url: org.cleanPath, query: org.query, organicRank: org.rank, organicClicks: org.gscClicks, organicSessions: org.gscClicks, 
                    ppcCampaign: campDisplay, ppcCost: 0, ppcConversions: paidStats?.conversions || 0, ppcCpa: 0,
                    ppcSessions: paidVolume, ppcImpressions: 0, blendedCostRatio: paidShare, actionLabel: action, dataSource: 'GA4'
                });
            });
            setBridgeDataGA4(ga4Results.sort((a, b) => b.blendedCostRatio - a.blendedCostRatio));

            // BUILD GA4 KEYWORD DATA
            const ga4KwResults: KeywordBridgeData[] = [];
            const allKeysGA = new Set([...Object.keys(ga4KeywordMap), ...Object.keys(uniqueQueryMap)]);
            allKeysGA.forEach(key => {
                 const paidData = ga4KeywordMap[key] || { clicksOrSessions: 0, conversions: 0 };
                 const gscData = uniqueQueryMap[key];
                 const paidVol = paidData.clicksOrSessions;
                 const orgVol = gscData ? gscData.clicks : 0;
                 if (paidVol === 0 && orgVol === 0) return;
                 const cvr = paidVol > 0 ? (paidData.conversions / paidVol) * 100 : 0;
                 let action = "MAINTAIN";
                 if (gscData?.bestRank && gscData.bestRank <= 3 && paidVol > 50) action = "CRITICAL (Cannibalization)";
                 else if (gscData?.bestRank && gscData.bestRank > 10 && paidVol === 0) action = "OPPORTUNITY (Growth)";

                 ga4KwResults.push({
                    keyword: key, organicRank: gscData?.bestRank || null, organicClicks: orgVol,
                    paidSessions: paidVol, paidCvr: cvr, actionLabel: action, dataSource: 'GA4'
                 });
            });
            setKeywordBridgeDataGA4(ga4KwResults.sort((a,b) => b.paidSessions - a.paidSessions));
        }

    } catch (e) {
        console.error("❌ ERROR BRIDGE:", e);
    } finally {
        setIsLoadingBridge(false);
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

      const currentStart = parseInt(filters.dateRange.start.replace(/-/g, ''), 10);
      const currentEnd = parseInt(filters.dateRange.end.replace(/-/g, ''), 10);

      const dailyMapped: DailyData[] = (ga4Data.rows || []).map((row: any) => {
        const rowDateStr = row.dimensionValues[0].value;
        const rowDateNum = parseInt(rowDateStr, 10);
        
        let label: 'current' | 'previous' = 'current';

        if (filters.comparison.enabled) {
          if (rowDateNum >= currentStart && rowDateNum <= currentEnd) {
            label = 'current';
          } else {
            label = 'previous';
          }
        }

        return {
          date: `${rowDateStr.slice(0,4)}-${rowDateStr.slice(4,6)}-${rowDateStr.slice(6,8)}`,
          channel: row.dimensionValues[1].value,
          country: normalizeCountry(row.dimensionValues[2].value),
          queryType: 'Non-Branded' as QueryType,
          landingPage: row.dimensionValues[3].value,
          dateRangeLabel: label,
          sessions: parseInt(row.metricValues[0].value) || 0,
          revenue: parseFloat(row.metricValues[1].value) || 0,
          sales: parseInt(row.metricValues[2].value) || 0,
          conversionRate: (parseFloat(row.metricValues[3].value) || 0) * 100,
          addToCarts: parseInt(row.metricValues[4].value) || 0,
          checkouts: parseInt(row.metricValues[5].value) || 0,
          clicks: 0, impressions: 0, ctr: 0
        };
      });

      setRealDailyData(dailyMapped);
      
    } catch (err: any) {
      console.error("Error fetching GA4:", err);
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
            position: row.position || 0, // MAPPED POSITION HERE
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

  // Re-fetch Bridge data whenever selected sub-account changes
  useEffect(() => {
    if (activeTab === DashboardTab.PPC_SEO_BRIDGE || activeTab === DashboardTab.SA360_PERFORMANCE) {
      fetchBridgeData();
    } else if (activeTab === DashboardTab.AI_TRAFFIC_MONITOR) {
      fetchAiTrafficData();
    }
  }, [activeTab, ga4Auth?.property?.id, gscAuth?.site?.siteUrl, filters.dateRange, selectedSa360SubAccount?.id]);

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
        tokenClientSa360.current = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPE_SA360,
            prompt: '',
            callback: (resp: any) => {
              if (resp.access_token) {
                const newAuth = { token: resp.access_token, customer: sa360Auth?.customer || null };
                setSa360Auth(newAuth);
                sessionStorage.setItem('sa360_auth', JSON.stringify(newAuth));
                fetchSa360Customers(resp.access_token);
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
    setUser(null); setGa4Auth(null); setGscAuth(null); setSa360Auth(null);
    localStorage.removeItem('seo_suite_user');
    sessionStorage.removeItem('ga4_auth');
    sessionStorage.removeItem('gsc_auth');
    sessionStorage.removeItem('sa360_auth');
  };

  const handleConnectGa4 = () => { if (tokenClientGa4.current) tokenClientGa4.current.requestAccessToken(); };
  const handleConnectGsc = () => { if (tokenClientGsc.current) tokenClientGsc.current.requestAccessToken(); };
  const handleConnectSa360 = () => { if (tokenClientSa360.current) tokenClientSa360.current.requestAccessToken(); };

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
  
  const filteredProperties = useMemo(() => availableProperties.filter(p => p.name.toLowerCase().includes(ga4Search.toLowerCase())), [availableProperties, ga4Search]);
  const filteredSites = useMemo(() => availableSites.filter(s => s.siteUrl.toLowerCase().includes(gscSearch.toLowerCase())), [availableSites, gscSearch]);
  const filteredSa360Customers = useMemo(() => availableSa360Customers.filter(c => c.descriptiveName?.toLowerCase().includes(sa360Search.toLowerCase()) || c.id.includes(sa360Search)), [availableSa360Customers, sa360Search]);

  const uniqueCountries = useMemo(() => {
    const set = new Set([...realDailyData.map(d => d.country), ...realKeywordData.map(k => k.country)]);
    return Array.from(set).filter(c => c && c !== 'Other' && c !== 'Unknown').sort();
  }, [realDailyData, realKeywordData]);

  const channelStats = useMemo(() => {
    const total = aggregateData(filteredDailyData);
    const organic = aggregateData(filteredDailyData.filter(d => d.channel.toLowerCase().includes('organic')));
    const paid = aggregateData(filteredDailyData.filter(d => d.channel.toLowerCase().includes('paid') || d.channel.toLowerCase().includes('cpc')));
    
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
                           activeTab === DashboardTab.PPC_SEO_BRIDGE ? "PPC & SEO Bridge Intelligence" :
                           activeTab === DashboardTab.SA360_PERFORMANCE ? "SA360 Paid Search Performance" :
                           activeTab === DashboardTab.AI_TRAFFIC_MONITOR ? "AI Traffic Tracker" :
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
      } else if (activeTab === DashboardTab.PPC_SEO_BRIDGE) {
        // Summarize bridge data for AI (Use the primary available source)
        const primaryBridgeData = bridgeDataSA360.length > 0 ? bridgeDataSA360 : bridgeDataGA4;
        const riskCount = primaryBridgeData.filter(b => b.organicRank !== null && b.organicRank <= 3 && b.ppcSessions > 0).length;
        const opportunityCount = primaryBridgeData.filter(b => b.organicRank !== null && b.organicRank > 5 && b.organicRank <= 20).length;
        summary = `
          Context: Integrated SEO and PPC Intelligence using Session Comparison.
          Cannibalization Risks detected: ${riskCount} keywords where we rank Top 3 organically but still pay for Sessions.
          Growth Opportunities detected: ${opportunityCount} keywords where we rank 5-20 and could increase ad spend.
        `;
      } else if (activeTab === DashboardTab.SA360_PERFORMANCE) {
          const primaryData = bridgeDataSA360.length > 0 ? bridgeDataSA360 : bridgeDataGA4;
          const totalCost = primaryData.reduce((acc, c) => acc + c.ppcCost, 0);
          const totalConv = primaryData.reduce((acc, c) => acc + c.ppcConversions, 0);
          const avgCpa = totalConv > 0 ? totalCost / totalConv : 0;
          summary = `
            Context: SA360 / Paid Search Performance Analysis by URL.
            Total Spend: ${currencySymbol}${totalCost.toLocaleString()}.
            Total Conversions: ${totalConv}.
            Average CPA: ${currencySymbol}${avgCpa.toFixed(2)}.
            Look for high CPA URLs and efficient high-volume URLs in the data provided.
          `;
      } else if (activeTab === DashboardTab.AI_TRAFFIC_MONITOR) {
        const totalAi = aiTrafficData.reduce((acc, curr) => acc + curr.sessions, 0);
        summary = `
          Context: AI/LLM Traffic Analysis (ChatGPT, Perplexity, Gemini, etc.).
          Total AI Referred Sessions: ${totalAi}.
          Top Sources identified in list.
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

  const isAnythingLoading = isLoadingGa4 || isLoadingGsc || isLoadingBridge || isLoadingAi || isLoadingSa360;

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
          <h1 className="text-3xl md:text-4xl font-black mb-4 tracking-tighter">The OneSearch Engine</h1>
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

      <Sidebar 
        isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen}
        isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed}
        activeTab={activeTab} setActiveTab={setActiveTab}
        user={user} handleLogout={handleLogout}
        setIsSettingsOpen={setIsSettingsOpen}
      />

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        aiProvider={aiProvider} setAiProvider={setAiProvider}
        openaiKey={openaiKey} setOpenaiKey={setOpenaiKey}
        brandRegexStr={brandRegexStr} setBrandRegexStr={setBrandRegexStr}
        ga4Auth={ga4Auth} gscAuth={gscAuth} sa360Auth={sa360Auth}
        handleConnectGa4={handleConnectGa4} handleConnectGsc={handleConnectGsc} handleConnectSa360={handleConnectSa360}
        ga4Search={ga4Search} setGa4Search={setGa4Search}
        gscSearch={gscSearch} setGscSearch={setGscSearch}
        sa360Search={sa360Search} setSa360Search={setSa360Search}
        availableProperties={availableProperties} availableSites={availableSites} 
        availableSa360Customers={availableSa360Customers}
        availableSa360SubAccounts={availableSa360SubAccounts}
        selectedSa360Customer={selectedSa360Customer}
        selectedSa360SubAccount={selectedSa360SubAccount}
        onSa360CustomerChange={handleSa360CustomerChange}
        onSa360SubAccountChange={setSelectedSa360SubAccount}
        setGa4Auth={setGa4Auth} setGscAuth={setGscAuth} setSa360Auth={setSa360Auth}
        filteredProperties={filteredProperties} filteredSites={filteredSites} filteredSa360Customers={filteredSa360Customers}
      />

      <main className={`flex-1 transition-all duration-300 ease-in-out p-5 md:p-8 xl:p-12 overflow-x-hidden ${isSidebarOpen ? (isCollapsed ? 'xl:ml-20' : 'xl:ml-80') : 'ml-0'}`}>
  <header className="flex flex-col gap-6 mb-10">
    <div className="flex items-center gap-4">
      {!isSidebarOpen && (
        <button onClick={() => setIsSidebarOpen(true)} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-indigo-300 transition-all shadow-sm text-slate-600 hover:text-indigo-600 group" title="Abrir menú">
          <Menu size={20} className="group-hover:scale-110 transition-transform" />
        </button>
      )}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className={`w-2 h-2 rounded-full ${isAnythingLoading ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
            {isLoadingGa4 ? 'Syncing GA4...' : isLoadingGsc ? 'Syncing GSC...' : isLoadingSa360 ? 'Syncing SA360...' : isLoadingBridge ? 'Joining Data...' : isLoadingAi ? 'Scanning AI...' : 'Dashboard Active'}
          </span>
        </div>
        <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">
          {activeTab === DashboardTab.ORGANIC_VS_PAID && "Organic vs Paid Performance"}
          {activeTab === DashboardTab.SEO_BY_COUNTRY && "SEO Performance by Country"}
          {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && "URL & Keyword Analysis"}
          {activeTab === DashboardTab.PPC_SEO_BRIDGE && "The Bridge: SEO vs PPC Intelligence"}
          {activeTab === DashboardTab.SA360_PERFORMANCE && "SA360 & Paid Search Analysis"}
          {activeTab === DashboardTab.AI_TRAFFIC_MONITOR && "AI Traffic Monitor"}
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
                  <h3 className="text-xl font-black">Strategic Report: {activeTab === DashboardTab.ORGANIC_VS_PAID ? "Channels" : activeTab === DashboardTab.SEO_BY_COUNTRY ? "Markets" : activeTab === DashboardTab.PPC_SEO_BRIDGE ? "The Bridge" : activeTab === DashboardTab.SA360_PERFORMANCE ? "Paid Search" : activeTab === DashboardTab.AI_TRAFFIC_MONITOR ? "AI Intelligence" : "Deep Dive"}</h3>
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
          
          {activeTab === DashboardTab.SEO_BY_COUNTRY && <SeoMarketplaceView data={filteredDailyData} keywordData={filteredKeywordData} gscDailyTotals={gscDailyTotals} gscTotals={gscTotals} aggregate={aggregateData} comparisonEnabled={filters.comparison.enabled} currencySymbol={currencySymbol} grouping={grouping} isBranded={isBranded} queryTypeFilter={filters.queryType} countryFilter={filters.country} />}
          
          {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && <SeoDeepDiveView keywords={filteredKeywordData} searchTerm={searchTerm} setSearchTerm={setSearchTerm} isLoading={isAnythingLoading} comparisonEnabled={filters.comparison.enabled} />}

          {/* PPC BRIDGE VIEW UPDATE: Passing selection props */}
          {activeTab === DashboardTab.PPC_SEO_BRIDGE && (
            <SeoPpcBridgeView 
                ga4Data={bridgeDataGA4} 
                sa360Data={bridgeDataSA360}
                ga4KeywordData={keywordBridgeDataGA4}
                sa360KeywordData={keywordBridgeDataSA360}
                dailyData={filteredDailyData} 
                currencySymbol={currencySymbol} 
                availableSa360Customers={availableSa360Customers}
                selectedSa360Customer={selectedSa360Customer}
                setSelectedSa360Customer={setSelectedSa360Customer}
            />
          )}
          
          {activeTab === DashboardTab.SA360_PERFORMANCE && (
             <Sa360PerformanceView 
                data={bridgeDataSA360.length > 0 ? bridgeDataSA360 : bridgeDataGA4} 
                currencySymbol={currencySymbol} 
             />
          )}

          {activeTab === DashboardTab.AI_TRAFFIC_MONITOR && <AiTrafficView data={aiTrafficData} currencySymbol={currencySymbol} />}
        </div>

        <div className="mt-12 flex justify-center pb-12">
          <button 
            onClick={handleGenerateInsights} 
            disabled={loadingInsights || isAnythingLoading || (realDailyData.length === 0 && realKeywordData.length === 0)} 
            className={`flex items-center gap-3 px-10 py-4 ${aiProvider === 'openai' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-slate-950 hover:bg-slate-800 shadow-slate-900/20'} text-white rounded-3xl text-xs font-black shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50`}
          >
            {loadingInsights ? <RefreshCw className="w-4 h-4 animate-spin" /> : (aiProvider === 'openai' ? <Cpu className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />)} 
            Generate {activeTab === DashboardTab.ORGANIC_VS_PAID ? 'Channel' : activeTab === DashboardTab.SEO_BY_COUNTRY ? 'Market' : activeTab === DashboardTab.PPC_SEO_BRIDGE ? 'Bridge' : activeTab === DashboardTab.SA360_PERFORMANCE ? 'Paid' : activeTab === DashboardTab.AI_TRAFFIC_MONITOR ? 'AI' : 'SEO'} Insights
          </button>
        </div>
      </main>
    </div>
  );
};

export default App;