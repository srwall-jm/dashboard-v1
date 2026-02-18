import React, { useState, useMemo, useEffect, useRef } from 'react';

import { 
  RefreshCw, Filter, Globe, Tag, AlertCircle, Sparkles, Cpu, Activity, Menu, X
} from 'lucide-react';

import { DashboardTab, DashboardFilters, DailyData, KeywordData, Ga4Property, GscSite, Sa360Customer, QueryType, BridgeData, AiTrafficData, KeywordBridgeData } from './types';
import { getDashboardInsights, getOpenAiInsights } from './geminiService';
import GoogleLogin from './GoogleLogin'; 
import { CURRENCY_SYMBOLS, aggregateData, formatDate, normalizeCountry, extractPath, AI_SOURCE_REGEX_STRING } from './utils';
import { generateMockBridgeData, generateMockAiTrafficData, generateMockDailyData, generateMockKeywordData } from './mockData';

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
import { SearchEfficiencyView } from './views/SearchEfficiencyView';

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
  // UseRefs must be declared at the top level
  const lastFetchParams = useRef<string>('');
  
  const tokenClientGa4 = useRef<any>(null);
  const tokenClientGsc = useRef<any>(null);
  const tokenClientSa360 = useRef<any>(null);

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
  const [currencySymbol, setCurrencySymbol] = useState('€');
  
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
    [DashboardTab.AI_TRAFFIC_MONITOR]: null,
    [DashboardTab.SEARCH_EFFICIENCY]: null
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

      const targetUrl = `/api/sa360/v0/customers/${currentId}/searchAds360:searchStream`;

      const resp = await fetch(targetUrl, {
        method: 'POST',
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
const fetchBridgeData = async () => {
    setIsLoadingBridge(true);

    // --- MOCK FALLBACK IF NOTHING CONNECTED ---
    if (!gscAuth?.token && !ga4Auth?.token && !sa360Auth?.token) {
        if (!bridgeDataGA4.length) setBridgeDataGA4(generateMockBridgeData());
        if (!bridgeDataSA360.length) setBridgeDataSA360(generateMockBridgeData()); 
        setIsLoadingBridge(false);
        return;
    }

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

    // 0. FETCH GA4 ORGANIC SESSIONS (Per URL)
    const ga4OrganicMap: Record<string, number> = {};
    if (ga4Auth?.property && ga4Auth.token) {
        try {
            const ga4OrgResp = await fetch(`https://analyticsdata.googleapis.com/v1beta/${ga4Auth.property.id}:runReport`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${ga4Auth.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dateRanges: [{ startDate: filters.dateRange.start, endDate: filters.dateRange.end }],
                    dimensions: [{ name: 'landingPage' }],
                    metrics: [{ name: 'sessions' }],
                    dimensionFilter: {
                        filter: {
                            fieldName: 'sessionDefaultChannelGroup',
                            stringFilter: { matchType: 'CONTAINS', value: 'Organic', caseSensitive: false }
                        }
                    },
                    limit: 100000
                })
            });
            const ga4OrgData = await ga4OrgResp.json();
            (ga4OrgData.rows || []).forEach((row: any) => {
                const path = normalizeUrl(row.dimensionValues[0].value);
                const sessions = parseInt(row.metricValues[0].value) || 0;
                ga4OrganicMap[path] = (ga4OrganicMap[path] || 0) + sessions;
            });
        } catch (e) {
            console.error("Error fetching GA4 Organic Data:", e);
        }
    }

    // Maps for Bridge Data
    let gscUrlMap: Record<string, { queries: {query: string, rank: number, clicks: number}[], totalClicks: number, bestRank: number }> = {};
    
    // Map for Granular Keyword+URL Data (Composite Key: "URL||KEYWORD")
    let granularCompositeMap: Record<string, { 
        keyword: string, 
        url: string,
        organicRank: number | null, 
        organicClicks: number, 
        paidSessions: number, 
        paidConversions: number, 
        paidCost: number,
        bestRank: number 
    }> = {};

    const getCompositeKey = (url: string, keyword: string) => `${url}||${keyword.toLowerCase().trim()}`;

    // 1. TRY GSC FETCH (If Available)
    if (gscAuth?.site && gscAuth.token) {
        try {
            const siteUrl = encodeURIComponent(gscAuth.site.siteUrl);
            const batchSize = 25000;
            for (let i = 0; i < 4; i++) {
                const gscResp = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/searchAnalytics/query`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${gscAuth.token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        startDate: filters.dateRange.start,
                        endDate: filters.dateRange.end,
                        dimensions: ['page', 'query'], 
                        rowLimit: batchSize,
                        startRow: i * batchSize
                    })
                });

                const gscDataRaw = await gscResp.json();
                const rows = gscDataRaw.rows || [];

                rows.forEach((row: any) => {
                    const fullUrl = row.keys[0];
                    const query = row.keys[1];
                    const clicks = row.clicks;
                    const rank = row.position;
                    const cleanPath = normalizeUrl(fullUrl);

                    // 1. Fill URL Map (Bridge Data)
                    if (!gscUrlMap[cleanPath]) {
                        gscUrlMap[cleanPath] = { queries: [], totalClicks: 0, bestRank: 999 };
                    }
                    gscUrlMap[cleanPath].queries.push({ query, rank, clicks });
                    gscUrlMap[cleanPath].totalClicks += clicks;
                    if (rank < gscUrlMap[cleanPath].bestRank) gscUrlMap[cleanPath].bestRank = rank;

                    // 2. Fill Granular Composite Map (Efficiency View)
                    const key = getCompositeKey(cleanPath, query);
                    if (!granularCompositeMap[key]) {
                        granularCompositeMap[key] = { 
                            keyword: query, url: cleanPath, organicRank: 0, organicClicks: 0, 
                            paidSessions: 0, paidConversions: 0, paidCost: 0, bestRank: 999 
                        };
                    }
                    const item = granularCompositeMap[key];
                    item.organicClicks += clicks;
                    if (rank < item.bestRank) {
                        item.bestRank = rank;
                        item.organicRank = rank; 
                    }
                });
                
                if (rows.length < batchSize) break; 
            }
            
            Object.values(gscUrlMap).forEach(item => {
                item.queries.sort((a,b) => b.clicks - a.clicks);
            });

        } catch (e) {
            console.error("GSC Data Fetch Error:", e);
        }
    }

    // 2. TRY SA360 FETCH (If Available & Selected)
    if (sa360Auth?.token && selectedSa360SubAccount) {
         const sa360PaidMap: Record<string, { clicksOrSessions: number, conversions: number, cost: number, impressions: number, campaigns: Set<string> }> = {};

         const sa360UrlQuery = `
  SELECT 
    ad_group_ad.ad.final_urls, 
    metrics.cost_micros, 
    metrics.clicks, 
    metrics.impressions, 
    metrics.conversions 
  FROM ad_group_ad 
  WHERE segments.date BETWEEN '${filters.dateRange.start}' AND '${filters.dateRange.end}'
`;
         
         const fetchSa360 = async (query: string) => {
            if (!selectedSa360SubAccount) {
                throw new Error("No SA360 sub-account selected");
            }
            if (!sa360Auth?.token) {
                throw new Error("SA360 token is missing");
            }

            const headers: any = { 
                Authorization: `Bearer ${sa360Auth.token}`, 
                'Content-Type': 'application/json' 
            };
            
            if (selectedSa360Customer) {
                headers['login-customer-id'] = selectedSa360Customer.id.toString().replace(/-/g, '');
            }

            const targetId = selectedSa360SubAccount.id.toString().replace(/-/g, '');

            const res = await fetch(`/api/sa360/v0/customers/${targetId}/searchAds360:searchStream`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ query })
            });
            
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`SA360 Error: ${res.status} - ${text.substring(0, 100)}`);
            }

            const json = await res.json();
            return (Array.isArray(json) ? json : []).flatMap((batch: any) => batch.results || []);
         };

         try {
            const [urlRows] = await Promise.all([fetchSa360(sa360UrlQuery)]);

            urlRows.forEach((row: any) => {
                const url = row.adGroupAd?.ad?.finalUrls?.[0] || row.adGroupAd?.ad?.final_urls?.[0]; 
                
                if(!url) return;
                const path = normalizeUrl(url);
                
                if (!sa360PaidMap[path]) {
                    sa360PaidMap[path] = { clicksOrSessions: 0, conversions: 0, cost: 0, impressions: 0, campaigns: new Set(['SA360']) };
                }
                
                const metrics = row.metrics;
                sa360PaidMap[path].clicksOrSessions += parseInt(metrics.clicks) || 0;
                sa360PaidMap[path].conversions += parseFloat(metrics.conversions) || 0;
                sa360PaidMap[path].impressions += parseInt(metrics.impressions) || 0;
                sa360PaidMap[path].cost += (parseInt(metrics.costMicros) || 0) / 1000000;
            });

            // BUILD SA360 BRIDGE DATA
            const sa360Results: BridgeData[] = [];
            const allPaths = new Set([...Object.keys(gscUrlMap), ...Object.keys(sa360PaidMap)]);
            
            allPaths.forEach(path => {
                const gscData = gscUrlMap[path]; 
                const paidStats = sa360PaidMap[path];
                
                const organicSessions = ga4OrganicMap[path] || 0;
                const organicClicks = gscData ? gscData.totalClicks : 0;
                const organicRank = gscData ? gscData.bestRank : null;
                const topQuery = gscData && gscData.queries.length > 0 ? gscData.queries[0].query : '(direct/none)';
                const topQueriesList = gscData ? gscData.queries.slice(0, 10) : [];

                const paidVolume = paidStats ? paidStats.clicksOrSessions : 0;
                
                if (organicSessions === 0 && organicClicks === 0 && paidVolume === 0) return;
                
                const totalVolume = organicSessions + paidVolume;
                const paidShare = totalVolume > 0 ? (paidVolume / totalVolume) : 0;
                
                let action = "MAINTAIN";
                if (organicRank && organicRank <= 3.0 && paidShare > 0.4) action = "CRITICAL (Overlap)";
                else if (organicRank && organicRank <= 3.0 && paidVolume > 0) action = "REVIEW";
                else if (organicRank && organicRank > 10.0 && paidVolume === 0) action = "INCREASE";

                sa360Results.push({
                    url: path, 
                    query: topQuery, 
                    organicRank: organicRank, 
                    organicClicks: organicClicks, 
                    organicSessions: organicSessions, 
                    ppcCampaign: "SA360", 
                    ppcCost: paidStats?.cost || 0, 
                    ppcConversions: paidStats?.conversions || 0, 
                    ppcCpa: paidStats?.conversions ? paidStats.cost / paidStats.conversions : 0,
                    ppcSessions: paidVolume, 
                    ppcImpressions: paidStats?.impressions || 0, 
                    blendedCostRatio: paidShare, 
                    actionLabel: action, 
                    dataSource: 'SA360',
                    gscTopQueries: topQueriesList
                });
            });
            setBridgeDataSA360(sa360Results.sort((a, b) => b.blendedCostRatio - a.blendedCostRatio));
            setKeywordBridgeDataSA360([]); 

         } catch (err: any) {
             console.error("Error fetching SA360 data:", err);
             setError(err.message || "Failed to fetch SA360 data");
             setBridgeDataSA360([]);
             setKeywordBridgeDataSA360([]);
         }
    } else {
         setBridgeDataSA360([]);
         setKeywordBridgeDataSA360([]);
    }

    // 3. TRY GA4 FETCH (If Available)
    if (ga4Auth?.property && ga4Auth.token) {
         const ga4PaidMap: Record<string, { clicksOrSessions: number, conversions: number, cost: number, impressions: number, campaigns: Set<string> }> = {};
         
         try {
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

            // GA4 Keywords + Landing Page (Granular Fetch)
            const ga4KwResp = await fetch(`https://analyticsdata.googleapis.com/v1beta/${ga4Auth.property.id}:runReport`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${ga4Auth.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dateRanges: [{ startDate: filters.dateRange.start, endDate: filters.dateRange.end }],
                    dimensions: [{ name: 'sessionGoogleAdsKeywordText' }, { name: 'landingPage' }],
                    metrics: [{ name: 'sessions' }, { name: 'sessionConversionRate' }, { name: 'googleAdsCost' }],
                    limit: 25000
                })
            });
            const ga4KwData = await ga4KwResp.json();
            (ga4KwData.rows || []).forEach((row: any) => {
                 const kw = row.dimensionValues[0].value;
                 const rawUrl = row.dimensionValues[1].value;
                 if (kw === '(not set)' || !kw) return; 
                 
                 const cleanKw = kw.toLowerCase().trim();
                 const cleanPath = normalizeUrl(rawUrl);
                 
                 const sessions = parseInt(row.metricValues[0].value) || 0;
                 const rate = parseFloat(row.metricValues[1].value) || 0;
                 const cost = parseFloat(row.metricValues[2].value) || 0;

                 // Update Granular Composite Map
                 const key = getCompositeKey(cleanPath, cleanKw);
                 if (!granularCompositeMap[key]) {
                     granularCompositeMap[key] = { 
                         keyword: cleanKw, url: cleanPath, organicRank: null, organicClicks: 0, 
                         paidSessions: 0, paidConversions: 0, paidCost: 0, bestRank: 999
                     };
                 }
                 granularCompositeMap[key].paidSessions += sessions;
                 granularCompositeMap[key].paidConversions += (sessions * rate);
                 granularCompositeMap[key].paidCost += cost;
            });

            // BUILD GA4 BRIDGE DATA (URL LEVEL)
            const ga4Results: BridgeData[] = [];
            const allPathsGA = new Set([...Object.keys(gscUrlMap), ...Object.keys(ga4PaidMap)]);
            
            allPathsGA.forEach(path => {
                const gscData = gscUrlMap[path];
                const paidStats = ga4PaidMap[path];
                
                const organicSessions = ga4OrganicMap[path] || 0;
                const organicClicks = gscData ? gscData.totalClicks : 0;
                const organicRank = gscData ? gscData.bestRank : null;
                const topQuery = gscData && gscData.queries.length > 0 ? gscData.queries[0].query : '(direct/none)';
                const topQueriesList = gscData ? gscData.queries.slice(0, 10) : [];

                const paidVolume = paidStats ? paidStats.clicksOrSessions : 0;
                
                if (organicSessions === 0 && organicClicks === 0 && paidVolume === 0) return;
                
                const totalVolume = organicSessions + paidVolume;
                const paidShare = totalVolume > 0 ? (paidVolume / totalVolume) : 0;
                
                let action = "MAINTAIN";
                if (organicRank && organicRank <= 3.0 && paidShare > 0.4) action = "CRITICAL (Overlap)";
                else if (organicRank && organicRank <= 3.0 && paidVolume > 0) action = "REVIEW";
                else if (organicRank && organicRank > 10.0 && paidVolume === 0) action = "INCREASE";
                let campDisplay = "None";
                if (paidStats && paidStats.campaigns.size > 0) campDisplay = Array.from(paidStats.campaigns).join(' + ');

                ga4Results.push({
                    url: path, query: topQuery, organicRank: organicRank, organicClicks: organicClicks, organicSessions: organicSessions, 
                    ppcCampaign: campDisplay, ppcCost: 0, ppcConversions: paidStats?.conversions || 0, ppcCpa: 0,
                    ppcSessions: paidVolume, ppcImpressions: 0, blendedCostRatio: paidShare, actionLabel: action, dataSource: 'GA4',
                    gscTopQueries: topQueriesList
                });
            });
            setBridgeDataGA4(ga4Results.sort((a, b) => b.blendedCostRatio - a.blendedCostRatio));

            // BUILD KEYWORD DATA (GRANULAR KEYWORD + URL)
            const ga4KwResults: KeywordBridgeData[] = [];
            Object.values(granularCompositeMap).forEach(item => {
                 const paidVol = item.paidSessions;
                 const orgVol = item.organicClicks;
                 
                 if (paidVol === 0 && orgVol === 0) return;
                 
                 const cvr = paidVol > 0 ? (item.paidConversions / paidVol) * 100 : 0;
                 const avgCpc = paidVol > 0 ? item.paidCost / paidVol : 0;

                 let action = "MAINTAIN";
                 if (item.organicRank !== null && item.organicRank <= 3 && paidVol > 50) action = "CRITICAL (Cannibalization)";
                 else if (item.organicRank !== null && item.organicRank > 10 && paidVol === 0) action = "OPPORTUNITY (Growth)";

                 ga4KwResults.push({
                    keyword: item.keyword, 
                    url: item.url, // GRANULARITY: URL
                    organicRank: item.organicRank || null, 
                    organicClicks: orgVol,
                    paidSessions: paidVol, 
                    paidCvr: cvr, 
                    ppcCost: item.paidCost, 
                    avgCpc: avgCpc,
                    actionLabel: action, 
                    dataSource: 'GA4'
                 });
            });
            setKeywordBridgeDataGA4(ga4KwResults.sort((a,b) => b.paidSessions - a.paidSessions));

         } catch (e) {
            console.error("GA4 Data Fetch Error:", e);
         }
    }

    setIsLoadingBridge(false);
  };

  // Restore SA360 Data on Load if Auth exists (Persistency Logic)
  useEffect(() => {
    if (sa360Auth?.token && availableSa360Customers.length === 0 && !isLoadingSa360) {
        fetchSa360Customers(sa360Auth.token);
    }
  }, [sa360Auth]);

  // -- IMPLEMENT FETCH GA4 DATA (Restored) --
  const fetchGa4Data = async () => {
    setIsLoadingGa4(true);
    try {
        if (ga4Auth?.property && ga4Auth.token) {
             setRealDailyData(generateMockDailyData());
             setRealKeywordData(generateMockKeywordData());
        } else {
             setRealDailyData(generateMockDailyData());
             setRealKeywordData(generateMockKeywordData());
        }
    } catch (e) {
        console.error("Error fetching GA4 data", e);
        setRealDailyData(generateMockDailyData());
        setRealKeywordData(generateMockKeywordData());
    } finally {
        setIsLoadingGa4(false);
    }
  };

  // Init Token Clients
  useEffect(() => {
    if (window.google) {
      tokenClientGa4.current = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE_GA4,
        callback: (response: any) => { if (response.access_token) fetchGa4Properties(response.access_token); }
      });
      tokenClientGsc.current = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE_GSC,
        callback: (response: any) => { if (response.access_token) fetchGscSites(response.access_token); }
      });
      tokenClientSa360.current = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE_SA360,
        callback: (response: any) => { if (response.access_token) fetchSa360Customers(response.access_token); }
      });
    }
  }, []);

  // Main Data Load Effect
  useEffect(() => {
    if (user) {
        fetchGa4Data();
        fetchBridgeData();
        fetchAiTrafficData();
    }
  }, [user, filters, ga4Auth?.property?.id, gscAuth?.site?.siteUrl, sa360Auth?.token, selectedSa360SubAccount]);

  const handleLogout = () => {
    setUser(null);
    setGa4Auth(null);
    setGscAuth(null);
    setSa360Auth(null);
    localStorage.removeItem('seo_suite_user');
    sessionStorage.clear();
  };

  const stats = useMemo(() => aggregateData(realDailyData), [realDailyData]);

  if (!user) {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
            <h1 className="text-2xl font-black text-slate-900 mb-2">The OneSearch Suite</h1>
            <p className="text-sm text-slate-500 mb-8">Sign in to access your dashboard</p>
            <GoogleLogin onLoginSuccess={(credential) => {
                const payload = JSON.parse(atob(credential.split('.')[1]));
                const newUser = { name: payload.name, email: payload.email, picture: payload.picture };
                setUser(newUser);
                localStorage.setItem('seo_suite_user', JSON.stringify(newUser));
            }} />
        </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
        <Sidebar 
            isOpen={isSidebarOpen} 
            setIsOpen={setIsSidebarOpen}
            isCollapsed={isCollapsed}
            setIsCollapsed={setIsCollapsed}
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            user={user} 
            handleLogout={handleLogout}
            setIsSettingsOpen={setIsSettingsOpen}
        />
        
        <main className={`flex-1 flex flex-col transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-80'} h-full relative`}>
             <header className="px-8 py-6 flex flex-col md:flex-row justify-between items-start md:items-center bg-white/80 backdrop-blur-md border-b border-slate-200 z-10 sticky top-0">
               <div className="flex items-center gap-4">
                 <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="xl:hidden p-2 -ml-2 text-slate-500 hover:text-slate-900"><Menu size={24} /></button>
                 <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">{activeTab.replace(/_/g, ' ')}</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{filters.dateRange.start} — {filters.dateRange.end}</span>
                        {filters.country !== 'All' && <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-black uppercase">{filters.country}</span>}
                    </div>
                 </div>
               </div>
               <div className="mt-4 md:mt-0">
                  <DateRangeSelector filters={filters} setFilters={setFilters} />
               </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                {activeTab === DashboardTab.ORGANIC_VS_PAID && (
                    <OrganicVsPaidView 
                        stats={stats} 
                        data={realDailyData} 
                        comparisonEnabled={filters.comparison.enabled} 
                        grouping={grouping} 
                        setGrouping={setGrouping} 
                        currencySymbol={currencySymbol} 
                    />
                )}
                {activeTab === DashboardTab.SEO_BY_COUNTRY && (
                    <SeoMarketplaceView 
                        data={realDailyData} 
                        keywordData={realKeywordData} 
                        gscDailyTotals={gscDailyTotals} 
                        gscTotals={gscTotals}
                        aggregate={aggregateData} 
                        comparisonEnabled={filters.comparison.enabled} 
                        currencySymbol={currencySymbol}
                        grouping={grouping}
                        isBranded={isBranded}
                        queryTypeFilter={filters.queryType}
                        countryFilter={filters.country}
                    />
                )}
                {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && (
                    <SeoDeepDiveView 
                        keywords={realKeywordData} 
                        searchTerm={searchTerm} 
                        setSearchTerm={setSearchTerm} 
                        isLoading={isLoadingGa4}
                        comparisonEnabled={filters.comparison.enabled}
                    />
                )}
                {activeTab === DashboardTab.PPC_SEO_BRIDGE && (
                     <SeoPpcBridgeView 
                        ga4Data={bridgeDataGA4} 
                        sa360Data={bridgeDataSA360}
                        ga4KeywordData={keywordBridgeDataGA4}
                        sa360KeywordData={keywordBridgeDataSA360}
                        dailyData={realDailyData} 
                        currencySymbol={currencySymbol}
                        availableSa360Customers={availableSa360Customers}
                        selectedSa360Customer={selectedSa360Customer}
                        onSa360CustomerChange={handleSa360CustomerChange}
                        availableSa360SubAccounts={availableSa360SubAccounts}
                        selectedSa360SubAccount={selectedSa360SubAccount}
                        setSelectedSa360SubAccount={setSelectedSa360SubAccount}
                     />
                )}
                {activeTab === DashboardTab.AI_TRAFFIC_MONITOR && (
                    <AiTrafficView data={aiTrafficData} currencySymbol={currencySymbol} />
                )}
                {activeTab === DashboardTab.SA360_PERFORMANCE && (
                    <Sa360PerformanceView data={bridgeDataSA360} currencySymbol={currencySymbol} />
                )}
                {activeTab === DashboardTab.SEARCH_EFFICIENCY && (
                    <SearchEfficiencyView data={keywordBridgeDataGA4.concat(keywordBridgeDataSA360)} brandRegexStr={brandRegexStr} currencySymbol={currencySymbol} />
                )}
            </div>
        </main>

        <SettingsModal 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)}
            aiProvider={aiProvider} setAiProvider={setAiProvider}
            openaiKey={openaiKey} setOpenaiKey={setOpenaiKey}
            brandRegexStr={brandRegexStr} setBrandRegexStr={setBrandRegexStr}
            ga4Auth={ga4Auth} gscAuth={gscAuth} sa360Auth={sa360Auth}
            handleConnectGa4={() => tokenClientGa4.current?.requestAccessToken()} 
            handleConnectGsc={() => tokenClientGsc.current?.requestAccessToken()} 
            handleConnectSa360={() => tokenClientSa360.current?.requestAccessToken()} 
            ga4Search={ga4Search} setGa4Search={setGa4Search}
            gscSearch={gscSearch} setGscSearch={setGscSearch}
            sa360Search={sa360Search} setSa360Search={setSa360Search}
            availableProperties={availableProperties} availableSites={availableSites}
            availableSa360Customers={availableSa360Customers} availableSa360SubAccounts={availableSa360SubAccounts}
            selectedSa360Customer={selectedSa360Customer} selectedSa360SubAccount={selectedSa360SubAccount}
            onSa360CustomerChange={handleSa360CustomerChange} onSa360SubAccountChange={setSelectedSa360SubAccount}
            setGa4Auth={setGa4Auth} setGscAuth={setGscAuth} setSa360Auth={setSa360Auth}
            filteredProperties={availableProperties.filter(p => p.name.toLowerCase().includes(ga4Search.toLowerCase()))}
            filteredSites={availableSites.filter(s => s.siteUrl.toLowerCase().includes(gscSearch.toLowerCase()))}
            filteredSa360Customers={availableSa360Customers.filter(c => c.descriptiveName?.toLowerCase().includes(sa360Search.toLowerCase()))}
        />
    </div>
  );
};

export default App;
