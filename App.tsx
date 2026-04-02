import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  RefreshCw, Filter, Globe, Tag, AlertCircle, Sparkles, Cpu, Activity, Menu, X
} from 'lucide-react';
import { DashboardTab, DashboardFilters, DailyData, KeywordData, Ga4Property, GscSite, GoogleAdsCustomer, QueryType, BridgeData, AiTrafficData, KeywordBridgeData, GoogleAdsGlobalMetrics } from './types';
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
import { GoogleAdsPerformanceView } from './views/GoogleAdsPerformanceView';
import { SearchEfficiencyView } from './views/SearchEfficiencyView';

const CLIENT_ID = "333322783684-pjhn2omejhngckfd46g8bh2dng9dghlc.apps.googleusercontent.com"; 
const DEVELOPER_TOKEN = import.meta.env.VITE_GOOGLE_ADS_DEVELOPER_TOKEN || "oZ5EnjmTqUCcS8dZbRjulA"; // Reemplaza con tu Developer Token de Google Ads
const SCOPE_GA4 = "https://www.googleapis.com/auth/analytics.readonly";
const SCOPE_GSC = "https://www.googleapis.com/auth/webmasters.readonly";
const SCOPE_GOOGLE_ADS = "https://www.googleapis.com/auth/adwords";

const PRIORITY_DIMENSIONS = [
  'sessionDefaultChannelGroup',
  'sessionSource',
  'sessionMedium',
  'sessionSourceMedium',
  'sessionCampaignName',
  'sessionSourcePlatform'
];

const App: React.FC = () => {
  const lastFetchParams = useRef<string>('');
  
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
  
  const [googleAdsAuth, setGoogleAdsAuth] = useState<{ token: string; customer: GoogleAdsCustomer | null } | null>(() => {
    const saved = sessionStorage.getItem('googleads_auth');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [availableProperties, setAvailableProperties] = useState<Ga4Property[]>([]);
  const [availableSites, setAvailableSites] = useState<GscSite[]>([]);
  
  // Google Ads: Main Accounts (Managers) and Sub Accounts (Clients)
  const [availableGoogleAdsCustomers, setAvailableGoogleAdsCustomers] = useState<GoogleAdsCustomer[]>([]);
  const [availableGoogleAdsSubAccounts, setAvailableGoogleAdsSubAccounts] = useState<GoogleAdsCustomer[]>([]);
  
  // Track selected Manager and selected Sub-account
  const [selectedGoogleAdsCustomer, setSelectedGoogleAdsCustomer] = useState<GoogleAdsCustomer | null>(null);
  
  const [availableDimensions, setAvailableDimensions] = useState<{ label: string; value: string }[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('€');
  
  const [ga4Search, setGa4Search] = useState('');
  const [gscSearch, setGscSearch] = useState('');
  const [googleAdsSearch, setGoogleAdsSearch] = useState('');
  
  const [realDailyData, setRealDailyData] = useState<DailyData[]>([]);
  const [realKeywordData, setRealKeywordData] = useState<KeywordData[]>([]);
  
  const [googleAdsGlobalMetrics, setGoogleAdsGlobalMetrics] = useState<GoogleAdsGlobalMetrics | null>(null);
  const [bridgeDataGA4, setBridgeDataGA4] = useState<BridgeData[]>([]); 
  const [bridgeDataGoogleAds, setBridgeDataGoogleAds] = useState<BridgeData[]>([]); 
  const [keywordBridgeDataGA4, setKeywordBridgeDataGA4] = useState<KeywordBridgeData[]>([]);
  const [keywordBridgeDataGoogleAds, setKeywordBridgeDataGoogleAds] = useState<KeywordBridgeData[]>([]);
  
  const [aiTrafficData, setAiTrafficData] = useState<AiTrafficData[]>([]); 
  const [gscDailyTotals, setGscDailyTotals] = useState<any[]>([]);
  const [gscTotals, setGscTotals] = useState<{current: any, previous: any} | null>(null);
  
  const [isLoadingGa4, setIsLoadingGa4] = useState(false);
  const [isLoadingGsc, setIsLoadingGsc] = useState(false);
  const [isLoadingBridge, setIsLoadingBridge] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [isLoadingGoogleAds, setIsLoadingGoogleAds] = useState(false);
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
    [DashboardTab.GOOGLE_ADS_PERFORMANCE]: null,
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
  
  const tokenClientGa4 = useRef<any>(null);
  const tokenClientGsc = useRef<any>(null);
  const tokenClientGoogleAds = useRef<any>(null);
  
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
    } catch (e) { 
      console.error("Error fetching metadata:", e); 
    }
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
  
  const fetchGoogleAdsCustomers = async (token: string) => {
    try {
        setIsLoadingGoogleAds(true);
        const resp = await fetch('/api/googleads/v21/customers:listAccessibleCustomers', {
            method: 'GET',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'developer-token': DEVELOPER_TOKEN
            }
        });
        
        if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            const errMsg = errData.error?.message || `Google Ads Status: ${resp.status}`;
            throw new Error(errMsg);
        }
        const data = await resp.json();
        
        const customers: GoogleAdsCustomer[] = (data.resourceNames || []).map((rn: string) => {
            const id = rn.split('/')[1];
            return {
                resourceName: rn,
                id: id,
                descriptiveName: `Account ${id}`
            };
        });
        
        setAvailableGoogleAdsCustomers(customers);
        
        if (customers.length > 0) {
           if (!googleAdsAuth?.customer) {
               setGoogleAdsAuth({ token, customer: customers[0] });
           }
           if (!selectedGoogleAdsCustomer) {
               const defaultCust = customers[0];
               setSelectedGoogleAdsCustomer(defaultCust);
               fetchGoogleAdsSubAccounts(token, defaultCust.id);
           }
        }
    } catch (e: any) {
        console.error(e);
        setError(`Error connecting to Google Ads API: ${e.message || 'Unknown error'}`);
    } finally {
        setIsLoadingGoogleAds(false);
    }
  };
  
  const fetchGoogleAdsSubAccounts = async (token: string, managerId: string) => {
    setIsLoadingGoogleAds(true);
    let allLeafAccounts: GoogleAdsCustomer[] = [];
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
          WHERE customer_client.level <= 1
        `.trim();
        
        const targetUrl = `/api/googleads/v21/customers/${currentId}/googleAds:search`;
        const resp = await fetch(targetUrl, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`, 
            'Content-Type': 'application/json',
            'developer-token': DEVELOPER_TOKEN,
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
        
        const results = json.results || [];
        for (const row of results) {
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
            allLeafAccounts.push({
              resourceName: client.resourceName,
              id: id,
              descriptiveName: name
            });
          }
        }
      }
      
      // Deduplicate leaf accounts by ID to prevent double counting (e.g. if API returns recursive results)
      let uniqueLeafAccounts = allLeafAccounts.filter((acc, index, self) => 
          index === self.findIndex((t) => t.id === acc.id)
      );
      
      if (uniqueLeafAccounts.length === 0) {
          uniqueLeafAccounts = [{
              id: managerId,
              descriptiveName: 'Selected Account',
              resourceName: `customers/${managerId}`
          }];
      }
      
      console.log("Cuentas finales encontradas (Unique):", uniqueLeafAccounts);
      
      setAvailableGoogleAdsSubAccounts(uniqueLeafAccounts);
      
    } catch (e) {
      console.error("Error fetching Google Ads recursive sub-accounts:", e);
      setError("Error al obtener la jerarquía de cuentas. Usando cuenta principal.");
      setAvailableGoogleAdsSubAccounts([{
          id: managerId,
          descriptiveName: 'Selected Account',
          resourceName: `customers/${managerId}`
      }]);
    } finally {
      setIsLoadingGoogleAds(false);
    }
  };
  
  const handleGoogleAdsCustomerChange = (customer: GoogleAdsCustomer | null) => {
    setSelectedGoogleAdsCustomer(customer);
    setAvailableGoogleAdsSubAccounts([]);
    
    if (customer && googleAdsAuth?.token) {
        fetchGoogleAdsSubAccounts(googleAdsAuth.token, customer.id);
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
  // UPDATED: Nueva lógica granular con URL+Keyword
  const fetchBridgeData = async () => {
    setIsLoadingBridge(true);
    setLoadingProgress(0);
    
    // --- MOCK FALLBACK IF NOTHING CONNECTED ---
    if (!gscAuth?.token && !ga4Auth?.token && !googleAdsAuth?.token) {
        if (!bridgeDataGA4.length) setBridgeDataGA4(generateMockBridgeData());
        if (!bridgeDataGoogleAds.length) setBridgeDataGoogleAds(generateMockBridgeData());
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
      // Remove Google Ads ValueTrack parameters like {ignore}
      path = path.replace(/\{[^}]*\}/g, '');
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
    
    let gscUrlMap: Record<string, { queries: {query: string, rank: number, clicks: number}[], totalClicks: number, bestRank: number, totalImpressions: number, weightedRankSum: number }> = {};
    
    // NUEVA FUNCIONALIDAD: GRANULAR KEY: URL||KEYWORD
    let granularCompositeMap: Record<string, { 
        keyword: string, 
        url: string,
        organicRank: number | null, 
        organicClicks: number, 
        paidSessions: number, 
        paidConversions: number, 
        paidCost: number,
        bestRank: number,
        totalImpressions: number,
        weightedRankSum: number
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
                    const impressions = row.impressions;
                    const rank = row.position;
                    const cleanPath = normalizeUrl(fullUrl);
                    
                    // 1. Fill URL Map (Bridge Data)
                    if (!gscUrlMap[cleanPath]) {
                        gscUrlMap[cleanPath] = { queries: [], totalClicks: 0, bestRank: 999, totalImpressions: 0, weightedRankSum: 0 };
                    }
                    gscUrlMap[cleanPath].queries.push({ query, rank, clicks });
                    gscUrlMap[cleanPath].totalClicks += clicks;
                    gscUrlMap[cleanPath].totalImpressions += impressions;
                    gscUrlMap[cleanPath].weightedRankSum += (rank * impressions);
                    
                    if (rank < gscUrlMap[cleanPath].bestRank) gscUrlMap[cleanPath].bestRank = rank;
                    
                    // 2. NUEVA: Fill Granular Composite Map (Efficiency View) - KEY IS URL+KW
                    const key = getCompositeKey(cleanPath, query);
                    if (!granularCompositeMap[key]) {
                        granularCompositeMap[key] = { 
                            keyword: query, 
                            url: cleanPath, 
                            organicRank: 0, 
                            organicClicks: 0, 
                            paidSessions: 0, 
                            paidConversions: 0, 
                            paidCost: 0, 
                            bestRank: 999,
                            totalImpressions: 0,
                            weightedRankSum: 0
                        };
                    }
                    const item = granularCompositeMap[key];
                    item.organicClicks += clicks;
                    item.totalImpressions += impressions;
                    item.weightedRankSum += (rank * impressions);
                    
                    if (rank < item.bestRank) {
                        item.bestRank = rank;
                    }
                    // Calculate Avg Rank on the fly or later. Here we can just store it.
                    // We will calculate final rank when building the array.
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
    
    // 2. TRY GOOGLE ADS FETCH (If Available & Selected)
    if (googleAdsAuth?.token && availableGoogleAdsSubAccounts.length > 0) {
         const googleAdsPaidMap: Record<string, { clicksOrSessions: number, conversions: number, cost: number, impressions: number, campaigns: Set<string> }> = {};
         
         // NUEVA: Mapa granular con clave URL||KEYWORD para coste específico por URL
         const googleAdsKeywordUrlMap: Record<string, { clicksOrSessions: number, conversions: number, cost: number }> = {};

         // Query 1: URL-level metrics from landing_page_view (supports all campaign types including PMax)
         const googleAdsUrlQuery = `
           SELECT 
             landing_page_view.unexpanded_final_url,
             campaign.resource_name,
             ad_group.resource_name,
             metrics.cost_micros, 
             metrics.clicks, 
             metrics.impressions, 
             metrics.conversions 
           FROM landing_page_view 
           WHERE segments.date BETWEEN '${filters.dateRange.start}' AND '${filters.dateRange.end}'
         `;
         
         // Query 2: Keyword-level metrics using keyword_view (supports metrics + criterion fields)
         const googleAdsKwQuery = `
            SELECT 
              ad_group_criterion.keyword.text,
              ad_group_criterion.final_urls,
              campaign.resource_name,
              ad_group.resource_name,
              metrics.cost_micros, 
              metrics.clicks, 
              metrics.conversions 
            FROM keyword_view
            WHERE segments.date BETWEEN '${filters.dateRange.start}' AND '${filters.dateRange.end}'
         `;

         // Query 3: Customer-level metrics (The most accurate "Overview" total)
         const googleAdsCustomerQuery = `
            SELECT 
              metrics.cost_micros, 
              metrics.clicks, 
              metrics.impressions, 
              metrics.conversions 
            FROM customer
            WHERE segments.date BETWEEN '${filters.dateRange.start}' AND '${filters.dateRange.end}'
         `;
         
         const fetchGoogleAds = async (query: string, targetId: string) => {
            if (!googleAdsAuth?.token) {
                throw new Error("Google Ads token is missing");
            }
            
            const headers: any = { 
                Authorization: `Bearer ${googleAdsAuth.token}`, 
                'Content-Type': 'application/json',
                'developer-token': DEVELOPER_TOKEN
            };
            
            if (selectedGoogleAdsCustomer) {
                headers['login-customer-id'] = selectedGoogleAdsCustomer.id.toString().replace(/-/g, '');
            }
            
            const cleanTargetId = targetId.toString().replace(/-/g, '');
            const allResults: any[] = [];
            let nextPageToken: string | undefined = undefined;

            try {
                do {
                    const body: any = { query };
                    if (nextPageToken) {
                        body.pageToken = nextPageToken;
                    }

                    const res = await fetch(`/api/googleads/v21/customers/${cleanTargetId}/googleAds:search`, {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify(body)
                    });
                    
                    if (!res.ok) {
                        const text = await res.text();
                        console.error(`Google Ads API Error for ${targetId}:`, text);
                        break;
                    }
                    
                    const json = await res.json();
                    if (json.results && Array.isArray(json.results)) {
                        for (const item of json.results) {
                            allResults.push(item);
                        }
                    }
                    nextPageToken = json.nextPageToken;
                } while (nextPageToken);
            } catch (err) {
                console.error(`Fetch error for ${targetId}:`, err);
            }

            return allResults;
         };
         
         try {
            let accountsToFetch: string[] = [];
            let globalAvgCpc = 0;
            const isAllAccounts = true; // Always true since we removed sub-account selection
            
            // 1. ALWAYS FETCH GLOBAL TOTALS (Customer Level)
            // This ensures scorecards always show "Overall" data regardless of selection
            const allAccountIds = availableGoogleAdsSubAccounts.map(acc => acc.id);

            let globalMetrics: GoogleAdsGlobalMetrics = {
                totalCost: 0,
                totalClicks: 0,
                totalConversions: 0,
                totalImpressions: 0,
                avgCpc: 0,
                avgCpa: 0
            };

            if (allAccountIds.length > 0) {
                const chunkSize = 3; // Smaller chunks to prevent memory spikes
                for (let i = 0; i < allAccountIds.length; i += chunkSize) {
                    const chunk = allAccountIds.slice(i, i + chunkSize);
                    const customerPromises = chunk.map(id => fetchGoogleAds(googleAdsCustomerQuery, id));
                    const customerResults = await Promise.all(customerPromises);
                    
                    customerResults.forEach(res => {
                        if (Array.isArray(res)) {
                            for (const row of res) {
                                const metrics = row.metrics;
                                globalMetrics.totalCost += (parseInt(metrics?.costMicros) || 0) / 1000000;
                                globalMetrics.totalClicks += parseInt(metrics?.clicks) || 0;
                                globalMetrics.totalConversions += parseFloat(metrics?.conversions) || 0;
                                globalMetrics.totalImpressions += parseInt(metrics?.impressions) || 0;
                            }
                        }
                    });
                    setLoadingProgress(Math.round(((i + chunk.length) / (allAccountIds.length * 2)) * 100));
                }

                if (globalMetrics.totalClicks > 0) {
                    globalMetrics.avgCpc = globalMetrics.totalCost / globalMetrics.totalClicks;
                }
                if (globalMetrics.totalConversions > 0) {
                    globalMetrics.avgCpa = globalMetrics.totalCost / globalMetrics.totalConversions;
                }
                
                setGoogleAdsGlobalMetrics(globalMetrics);
                globalAvgCpc = globalMetrics.avgCpc; // Used for fallback
            }
            
            // DETAILED FETCH & IMMEDIATE AGGREGATION (Account by Account)
            accountsToFetch = allAccountIds;
            
            const chunkSize = 2; // Process very few accounts at a time to keep memory low
            for (let i = 0; i < accountsToFetch.length; i += chunkSize) {
                const chunk = accountsToFetch.slice(i, i + chunkSize);
                
                // Fetch and process each account in the chunk
                for (const accountId of chunk) {
                    const accountUrlRows = await fetchGoogleAds(googleAdsUrlQuery, accountId);
                    const accountKwRows = await fetchGoogleAds(googleAdsKwQuery, accountId);
                    
                    // 1. Build Ad Group URL Distribution Map for THIS account only
                    const accountAdGroupUrlDistribution: Record<string, { url: string, clicks: number, share: number }[]> = {};
                    const accountAdGroupTotalClicks: Record<string, number> = {};

                    accountUrlRows.forEach((row: any) => {
                        const adGroupRN = row.adGroup?.resourceName;
                        const url = row.landingPageView?.unexpandedFinalUrl;
                        const clicks = parseInt(row.metrics?.clicks) || 0;
                        
                        if (adGroupRN && url) {
                            if (!accountAdGroupUrlDistribution[adGroupRN]) {
                                accountAdGroupUrlDistribution[adGroupRN] = [];
                                accountAdGroupTotalClicks[adGroupRN] = 0;
                            }
                            accountAdGroupUrlDistribution[adGroupRN].push({ url, clicks, share: 0 });
                            accountAdGroupTotalClicks[adGroupRN] += clicks;
                        }

                        // Aggregate into googleAdsPaidMap immediately
                        const path = normalizeUrl(url);
                        if (path) {
                            if (!googleAdsPaidMap[path]) {
                                googleAdsPaidMap[path] = { clicksOrSessions: 0, conversions: 0, cost: 0, impressions: 0, campaigns: new Set(['Google Ads']) };
                            }
                            const metrics = row.metrics;
                            googleAdsPaidMap[path].clicksOrSessions += parseInt(metrics?.clicks) || 0;
                            googleAdsPaidMap[path].conversions += parseFloat(metrics?.conversions) || 0;
                            googleAdsPaidMap[path].impressions += parseInt(metrics?.impressions) || 0;
                            googleAdsPaidMap[path].cost += (parseInt(metrics?.costMicros) || 0) / 1000000;
                        }
                    });

                    // Calculate shares for this account
                    Object.keys(accountAdGroupUrlDistribution).forEach(adGroupRN => {
                        const total = accountAdGroupTotalClicks[adGroupRN];
                        const urls = accountAdGroupUrlDistribution[adGroupRN];
                        if (total > 0) {
                            urls.forEach(u => u.share = u.clicks / total);
                        } else if (urls.length > 0) {
                            urls.forEach(u => u.share = 1 / urls.length);
                        }
                    });

                    // 2. Process Keywords for THIS account with Proportional Attribution
                    accountKwRows.forEach((row: any) => {
                        const kw = row.adGroupCriterion?.keyword?.text;
                        const adGroupRN = row.adGroup?.resourceName;
                        const kwFinalUrls = row.adGroupCriterion?.finalUrls || [];
                        
                        if (!kw) return;
                        const cleanKw = kw.toLowerCase().trim();
                        const metrics = row.metrics;
                        const kwClicks = parseInt(metrics?.clicks) || 0;
                        const kwConversions = parseFloat(metrics?.conversions) || 0;
                        const kwCost = (parseInt(metrics?.costMicros) || 0) / 1000000;

                        if (kwFinalUrls.length > 0) {
                            const url = kwFinalUrls[0];
                            const cleanPath = normalizeUrl(url);
                            const compositeKey = getCompositeKey(cleanPath, cleanKw);
                            if (!googleAdsKeywordUrlMap[compositeKey]) {
                                googleAdsKeywordUrlMap[compositeKey] = { clicksOrSessions: 0, conversions: 0, cost: 0 };
                            }
                            googleAdsKeywordUrlMap[compositeKey].clicksOrSessions += kwClicks;
                            googleAdsKeywordUrlMap[compositeKey].conversions += kwConversions;
                            googleAdsKeywordUrlMap[compositeKey].cost += kwCost;
                        } else if (adGroupRN && accountAdGroupUrlDistribution[adGroupRN]) {
                            const distributions = accountAdGroupUrlDistribution[adGroupRN];
                            distributions.forEach(dist => {
                                const cleanPath = normalizeUrl(dist.url);
                                const compositeKey = getCompositeKey(cleanPath, cleanKw);
                                if (!googleAdsKeywordUrlMap[compositeKey]) {
                                    googleAdsKeywordUrlMap[compositeKey] = { clicksOrSessions: 0, conversions: 0, cost: 0 };
                                }
                                googleAdsKeywordUrlMap[compositeKey].clicksOrSessions += kwClicks * dist.share;
                                googleAdsKeywordUrlMap[compositeKey].conversions += kwConversions * dist.share;
                                googleAdsKeywordUrlMap[compositeKey].cost += kwCost * dist.share;
                            });
                        } else {
                            const compositeKey = getCompositeKey('Unknown URL', cleanKw);
                            if (!googleAdsKeywordUrlMap[compositeKey]) {
                                googleAdsKeywordUrlMap[compositeKey] = { clicksOrSessions: 0, conversions: 0, cost: 0 };
                            }
                            googleAdsKeywordUrlMap[compositeKey].clicksOrSessions += kwClicks;
                            googleAdsKeywordUrlMap[compositeKey].conversions += kwConversions;
                            googleAdsKeywordUrlMap[compositeKey].cost += kwCost;
                        }
                    });
                }
                const progress = 50 + Math.round(((i + chunk.length) / accountsToFetch.length) * 50);
                setLoadingProgress(progress);
            }
            
            // BUILD GOOGLE ADS BRIDGE DATA
            const googleAdsResults: BridgeData[] = [];
            const allPaths = new Set([...Object.keys(gscUrlMap), ...Object.keys(googleAdsPaidMap)]);
            
            allPaths.forEach(path => {
                const gscData = gscUrlMap[path]; 
                const paidStats = googleAdsPaidMap[path];
                
                const organicSessions = ga4OrganicMap[path] || 0;
                const organicClicks = gscData ? gscData.totalClicks : 0;
                // User Request: Use Avg Rank instead of Best Rank
                const organicRank = gscData && gscData.totalImpressions > 0 
                    ? gscData.weightedRankSum / gscData.totalImpressions 
                    : (gscData ? gscData.bestRank : null);
                
                const topQuery = gscData && gscData.queries.length > 0 ? gscData.queries[0].query : '(direct/none)';
                const topQueriesList = gscData ? gscData.queries.slice(0, 10) : [];
                const paidVolume = paidStats ? paidStats.clicksOrSessions : 0;
                
                if (organicSessions === 0 && organicClicks === 0 && paidVolume === 0 && (!paidStats || paidStats.cost === 0)) return;
                
                const totalVolume = organicSessions + paidVolume;
                const paidShare = totalVolume > 0 ? (paidVolume / totalVolume) : 0;
                
                let action = "MAINTAIN";
                if (organicRank && organicRank <= 3.0 && paidShare > 0.4) action = "CRITICAL (Overlap)";
                else if (organicRank && organicRank <= 3.0 && paidVolume > 0) action = "REVIEW";
                else if (organicRank && organicRank > 10.0 && paidVolume === 0) action = "INCREASE";
                
                googleAdsResults.push({
                    url: path, 
                    query: topQuery, 
                    organicRank: organicRank, 
                    organicClicks: organicClicks, 
                    organicSessions: organicSessions, 
                    ppcCampaign: "Google Ads", 
                    ppcCost: paidStats?.cost || 0, 
                    ppcConversions: paidStats?.conversions || 0, 
                    ppcCpa: paidStats?.conversions ? paidStats.cost / paidStats.conversions : 0,
                    ppcSessions: paidVolume, 
                    ppcImpressions: paidStats?.impressions || 0, 
                    blendedCostRatio: paidShare, 
                    actionLabel: action, 
                    dataSource: 'GOOGLE_ADS',
                    gscTopQueries: topQueriesList
                });
            });
            
            setBridgeDataGoogleAds(googleAdsResults.sort((a, b) => b.blendedCostRatio - a.blendedCostRatio));
            
            // BUILD GOOGLE ADS KEYWORD DATA (GRANULAR: URL + KW MATCH)
            const googleAdsKwResults: KeywordBridgeData[] = [];
            
            // 1. NUEVA LÓGICA: Process granularCompositeMap usando datos específicos de URL+KW
            const processedCompositeKeys = new Set<string>();
            Object.values(granularCompositeMap).forEach(item => {
                const compositeKey = getCompositeKey(item.url, item.keyword);
                processedCompositeKeys.add(compositeKey);
                const paidData = googleAdsKeywordUrlMap[compositeKey]; // ✅ Ahora usa datos específicos por URL+KW
                
                if (!paidData && item.organicClicks === 0) return;
                
                const paidVol = paidData ? paidData.clicksOrSessions : 0; 
                const paidCost = paidData ? paidData.cost : 0;
                const paidConv = paidData ? paidData.conversions : 0;
                const orgVol = item.organicClicks;
                
                const cvr = paidVol > 0 ? (paidConv / paidVol) * 100 : 0;
                let avgCpc = paidVol > 0 ? paidCost / paidVol : 0;

                // FALLBACK FOR ALL ACCOUNTS: Use Global Avg CPC for organic value calculation
                if (isAllAccounts && avgCpc === 0 && globalAvgCpc > 0) {
                    avgCpc = globalAvgCpc;
                }
                
                let action = "MAINTAIN";
                const avgRank = item.totalImpressions > 0 
                    ? item.weightedRankSum / item.totalImpressions 
                    : (item.bestRank < 999 ? item.bestRank : null);

                if (avgRank !== null && avgRank <= 3 && paidVol > 50) action = "CRITICAL (Cannibalization)";
                else if (avgRank !== null && avgRank > 10 && paidVol === 0) action = "OPPORTUNITY (Growth)";
                
                googleAdsKwResults.push({
                    keyword: item.keyword, 
                    url: item.url,
                    organicRank: avgRank, 
                    organicClicks: orgVol,
                    paidSessions: paidVol,
                    paidCvr: cvr, 
                    ppcCost: paidCost, 
                    avgCpc: avgCpc,
                    actionLabel: action, 
                    dataSource: 'GOOGLE_ADS'
                });
            });

            // 2. Add Google Ads keywords that are NOT in granularCompositeMap
            Object.keys(googleAdsKeywordUrlMap).forEach(compositeKey => {
                if (!processedCompositeKeys.has(compositeKey)) {
                    const paidData = googleAdsKeywordUrlMap[compositeKey];
                    // compositeKey is url||keyword
                    const parts = compositeKey.split('||');
                    const url = parts[0];
                    const keyword = parts[1] || '';
                    
                    const paidVol = paidData.clicksOrSessions;
                    const paidCost = paidData.cost;
                    const paidConv = paidData.conversions;
                    const cvr = paidVol > 0 ? (paidConv / paidVol) * 100 : 0;
                    let avgCpc = paidVol > 0 ? paidCost / paidVol : 0;

                    if (isAllAccounts && avgCpc === 0 && globalAvgCpc > 0) {
                        avgCpc = globalAvgCpc;
                    }

                    googleAdsKwResults.push({
                        keyword: keyword,
                        url: url,
                        organicRank: null,
                        organicClicks: 0,
                        paidSessions: paidVol,
                        paidCvr: cvr,
                        ppcCost: paidCost,
                        avgCpc: avgCpc,
                        actionLabel: "MAINTAIN",
                        dataSource: 'GOOGLE_ADS'
                    });
                }
            });

            // IF ALL ACCOUNTS: Add a summary row to ensure Total Paid Cost is correct in Scorecards
            if (isAllAccounts && globalMetrics.totalCost > 0) {
                googleAdsKwResults.push({
                    keyword: "Total Paid Search (Overview)",
                    url: "All Accounts Aggregated",
                    organicRank: null,
                    organicClicks: 0,
                    paidSessions: globalMetrics.totalClicks,
                    paidCvr: 0,
                    ppcCost: globalMetrics.totalCost,
                    avgCpc: globalAvgCpc,
                    actionLabel: "MONITOR",
                    dataSource: 'GOOGLE_ADS'
                });
            }
            
            setKeywordBridgeDataGoogleAds(googleAdsKwResults.sort((a,b) => b.paidSessions - a.paidSessions));

            // 3. Add "Unaccounted" URL-level traffic (PMax / Other)
            // This ensures that URLs with traffic from PMax or other non-keyword campaigns show up in Search Efficiency
            Object.keys(googleAdsPaidMap).forEach(urlPath => {
                const totalUrlPaid = googleAdsPaidMap[urlPath];
                
                // Sum up all keywords for this URL that were already accounted for
                let accountedClicks = 0;
                let accountedCost = 0;
                let accountedConversions = 0;
                
                Object.keys(googleAdsKeywordUrlMap).forEach(compositeKey => {
                    if (compositeKey.startsWith(urlPath + '||')) {
                        accountedClicks += googleAdsKeywordUrlMap[compositeKey].clicksOrSessions;
                        accountedCost += googleAdsKeywordUrlMap[compositeKey].cost;
                        accountedConversions += googleAdsKeywordUrlMap[compositeKey].conversions;
                    }
                });
                
                const diffClicks = totalUrlPaid.clicksOrSessions - accountedClicks;
                const diffCost = totalUrlPaid.cost - accountedCost;
                const diffConversions = totalUrlPaid.conversions - accountedConversions;
                
                // If there's a significant difference, add a row for it
                if (diffClicks > 1 || diffCost > 0.01) {
                    googleAdsKwResults.push({
                        keyword: "(PMax / Other Campaigns)",
                        url: urlPath,
                        organicRank: null,
                        organicClicks: 0,
                        paidSessions: Math.max(0, diffClicks),
                        paidCvr: diffClicks > 0 ? (diffConversions / diffClicks) * 100 : 0,
                        ppcCost: Math.max(0, diffCost),
                        avgCpc: diffClicks > 0 ? diffCost / diffClicks : globalAvgCpc,
                        actionLabel: "MONITOR",
                        dataSource: 'GOOGLE_ADS'
                    });
                }
            });
            
            setKeywordBridgeDataGoogleAds(googleAdsKwResults.sort((a,b) => b.paidSessions - a.paidSessions));
         } catch (err: any) {
             console.error("Error fetching Google Ads data:", err);
             setError(err.message || "Failed to fetch Google Ads data");
             setBridgeDataGoogleAds([]);
             setKeywordBridgeDataGoogleAds([]);
         }
    } else {
         setBridgeDataGoogleAds([]);
         setKeywordBridgeDataGoogleAds([]);
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
            
            // GA4 Keywords
            const ga4KwResp = await fetch(`https://analyticsdata.googleapis.com/v1beta/${ga4Auth.property.id}:runReport`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${ga4Auth.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dateRanges: [{ startDate: filters.dateRange.start, endDate: filters.dateRange.end }],
                    dimensions: [{ name: 'sessionGoogleAdsKeyword' }, { name: 'landingPage' }],
                    metrics: [{ name: 'sessions' }, { name: 'sessionConversionRate' }, { name: 'advertiserAdCost' }],
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
                 
                 // NUEVA: FILL GRANULAR MAP (URL + KW) FROM GA4 SIDE
                 const key = getCompositeKey(cleanPath, cleanKw);
                 if (!granularCompositeMap[key]) {
                     granularCompositeMap[key] = { 
                         keyword: cleanKw, 
                         url: cleanPath, 
                         organicRank: null, 
                         organicClicks: 0, 
                         paidSessions: 0, 
                         paidConversions: 0, 
                         paidCost: 0, 
                         bestRank: 999,
                         totalImpressions: 0,
                         weightedRankSum: 0
                     };
                 }
                 granularCompositeMap[key].paidSessions += sessions;
                 granularCompositeMap[key].paidConversions += (sessions * rate);
                 granularCompositeMap[key].paidCost += cost;
            });
            
            // BUILD GA4 BRIDGE DATA
            const ga4Results: BridgeData[] = [];
            const allPathsGA = new Set([...Object.keys(gscUrlMap), ...Object.keys(ga4PaidMap)]);
            
            allPathsGA.forEach(path => {
                const gscData = gscUrlMap[path];
                const paidStats = ga4PaidMap[path];
                
                const organicSessions = ga4OrganicMap[path] || 0;
                const organicClicks = gscData ? gscData.totalClicks : 0;
                // User Request: Use Avg Rank instead of Best Rank
                const organicRank = gscData && gscData.totalImpressions > 0 
                    ? gscData.weightedRankSum / gscData.totalImpressions 
                    : (gscData ? gscData.bestRank : null);
                
                const topQuery = gscData && gscData.queries.length > 0 ? gscData.queries[0].query : '(direct/none)';
                const topQueriesList = gscData ? gscData.queries.slice(0, 10) : [];
                const paidVolume = paidStats ? paidStats.clicksOrSessions : 0;
                
                if (organicSessions === 0 && organicClicks === 0 && paidVolume === 0 && (!paidStats || paidStats.cost === 0)) return;
                
                const totalVolume = organicSessions + paidVolume;
                const paidShare = totalVolume > 0 ? (paidVolume / totalVolume) : 0;
                
                let action = "MAINTAIN";
                if (organicRank && organicRank <= 3.0 && paidShare > 0.4) action = "CRITICAL (Overlap)";
                else if (organicRank && organicRank <= 3.0 && paidVolume > 0) action = "REVIEW";
                else if (organicRank && organicRank > 10.0 && paidVolume === 0) action = "INCREASE";
                
                let campDisplay = "None";
                if (paidStats && paidStats.campaigns.size > 0) campDisplay = Array.from(paidStats.campaigns).join(' + ');
                
                ga4Results.push({
                    url: path, 
                    query: topQuery, 
                    organicRank: organicRank, 
                    organicClicks: organicClicks, 
                    organicSessions: organicSessions, 
                    ppcCampaign: campDisplay, 
                    ppcCost: 0, 
                    ppcConversions: paidStats?.conversions || 0, 
                    ppcCpa: 0,
                    ppcSessions: paidVolume, 
                    ppcImpressions: 0, 
                    blendedCostRatio: paidShare, 
                    actionLabel: action, 
                    dataSource: 'GA4',
                    gscTopQueries: topQueriesList
                });
            });
            
            setBridgeDataGA4(ga4Results.sort((a, b) => b.blendedCostRatio - a.blendedCostRatio));
            
            // BUILD GA4 KEYWORD DATA (GRANULAR from Composite Map)
            const ga4KwResults: KeywordBridgeData[] = [];
            Object.values(granularCompositeMap).forEach(item => {
                 const paidVol = item.paidSessions;
                 const orgVol = item.organicClicks;
                 
                 if (paidVol === 0 && orgVol === 0) return;
                 
                 const cvr = paidVol > 0 ? (item.paidConversions / paidVol) * 100 : 0;
                 const avgCpc = paidVol > 0 ? item.paidCost / paidVol : 0;
                 
                 let action = "MAINTAIN";
                 const avgRank = item.totalImpressions > 0 
                    ? item.weightedRankSum / item.totalImpressions 
                    : (item.bestRank < 999 ? item.bestRank : null);

                 if (avgRank !== null && avgRank <= 3 && paidVol > 50) action = "CRITICAL (Cannibalization)";
                 else if (avgRank !== null && avgRank > 10 && paidVol === 0) action = "OPPORTUNITY (Growth)";
                 
                 ga4KwResults.push({
                    keyword: item.keyword, 
                    url: item.url, // NUEVA: Granular URL
                    organicRank: avgRank, 
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
  
  // Restore Google Ads Data on Load if Auth exists (Persistency Logic)
  useEffect(() => {
    if (googleAdsAuth?.token && availableGoogleAdsCustomers.length === 0 && !isLoadingGoogleAds) {
        fetchGoogleAdsCustomers(googleAdsAuth.token);
    }
  }, [googleAdsAuth]);

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
            { name: 'itemsAddedToCart' },
            { name: 'itemsCheckedOut' }
          ],
          limit: 100000
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
            position: row.position || 0,
            sessions: 0, 
            conversionRate: 0, 
            revenue: 0, 
            sales: 0, 
            addToCarts: 0, 
            checkouts: 0, 
            queryType: 'Non-Branded' as QueryType
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
    if (activeTab === DashboardTab.PPC_SEO_BRIDGE || activeTab === DashboardTab.GOOGLE_ADS_PERFORMANCE || activeTab === DashboardTab.SEARCH_EFFICIENCY) {
      fetchBridgeData();
    } else if (activeTab === DashboardTab.AI_TRAFFIC_MONITOR) {
      fetchAiTrafficData();
    }
  }, [
    activeTab, 
    ga4Auth?.property?.id, 
    gscAuth?.site?.siteUrl, 
    filters.dateRange.start,
    filters.dateRange.end
  ]);
  
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
        
        tokenClientGoogleAds.current = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPE_GOOGLE_ADS,
            prompt: '',
            callback: (resp: any) => {
              if (resp.access_token) {
                const newAuth = { token: resp.access_token, customer: googleAdsAuth?.customer || null };
                setGoogleAdsAuth(newAuth);
                sessionStorage.setItem('googleads_auth', JSON.stringify(newAuth));
                fetchGoogleAdsCustomers(resp.access_token);
              }
            },
        });
      } else { 
        setTimeout(initializeOAuth, 500); 
      }
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
    } catch (error) { 
      console.error("Error decoding token:", error); 
    }
  };
  
  const handleLogout = () => {
    setUser(null); 
    setGa4Auth(null); 
    setGscAuth(null); 
    setGoogleAdsAuth(null);
    localStorage.removeItem('seo_suite_user');
    sessionStorage.removeItem('ga4_auth');
    sessionStorage.removeItem('gsc_auth');
    sessionStorage.removeItem('googleads_auth');
  };
  
  const handleConnectGa4 = () => { 
    if (tokenClientGa4.current) tokenClientGa4.current.requestAccessToken(); 
  };
  
  const handleConnectGsc = () => { 
    if (tokenClientGsc.current) tokenClientGsc.current.requestAccessToken(); 
  };
  
  const handleConnectGoogleAds = () => { 
    if (tokenClientGoogleAds.current) tokenClientGoogleAds.current.requestAccessToken(); 
  };
  
  useEffect(() => { 
    if (ga4Auth?.token && ga4Auth.property) {
      fetchGa4Data();
      fetchGa4Metadata(ga4Auth.token, ga4Auth.property.id);
      fetchGa4PropertyDetails(ga4Auth.token, ga4Auth.property.id);
    } 
  }, [ga4Auth?.property?.id, filters.dateRange.start, filters.dateRange.end, filters.ga4Dimension, filters.comparison.enabled, filters.comparison.type]);
  
  useEffect(() => { 
    if (gscAuth?.token && gscAuth.site) fetchGscData(); 
  }, [gscAuth?.site?.siteUrl, filters.dateRange.start, filters.dateRange.end, filters.comparison.enabled, filters.comparison.type]);
  
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
  const filteredGoogleAdsCustomers = useMemo(() => availableGoogleAdsCustomers.filter(c => c.descriptiveName?.toLowerCase().includes(googleAdsSearch.toLowerCase()) || c.id.includes(googleAdsSearch)), [availableGoogleAdsCustomers, googleAdsSearch]);
  
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
                           activeTab === DashboardTab.GOOGLE_ADS_PERFORMANCE ? "Google Ads Paid Search Performance" :
                           activeTab === DashboardTab.SEARCH_EFFICIENCY ? "Search Efficiency & Cost Savings" :
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
        const primaryBridgeData = bridgeDataGoogleAds.length > 0 ? bridgeDataGoogleAds : bridgeDataGA4;
        const riskCount = primaryBridgeData.filter(b => b.organicRank !== null && b.organicRank <= 3 && b.ppcSessions > 0).length;
        const opportunityCount = primaryBridgeData.filter(b => b.organicRank !== null && b.organicRank > 5 && b.organicRank <= 20).length;
        summary = `
          Context: Integrated SEO and PPC Intelligence using Session Comparison.
          Cannibalization Risks detected: ${riskCount} keywords where we rank Top 3 organically but still pay for Sessions.
          Growth Opportunities detected: ${opportunityCount} keywords where we rank 5-20 and could increase ad spend.
        `;
      } else if (activeTab === DashboardTab.GOOGLE_ADS_PERFORMANCE) {
          const primaryData = bridgeDataGoogleAds.length > 0 ? bridgeDataGoogleAds : bridgeDataGA4;
          const totalCost = primaryData.reduce((acc, c) => acc + c.ppcCost, 0);
          const totalConv = primaryData.reduce((acc, c) => acc + c.ppcConversions, 0);
          const avgCpa = totalConv > 0 ? totalCost / totalConv : 0;
          summary = `
            Context: Google Ads / Paid Search Performance Analysis by URL.
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
      } else if (activeTab === DashboardTab.SEARCH_EFFICIENCY) {
         const primaryData = bridgeDataGoogleAds.length > 0 ? bridgeDataGoogleAds : bridgeDataGA4;
         const brandTax = primaryData.filter(d => isBranded(d.query) && d.organicRank !== null && d.organicRank <= 1.5).reduce((acc, d) => acc + d.ppcCost, 0);
         summary = `
           Context: Search Efficiency & Cost Savings.
           Goal: Identify wasted spend (Cannibalization) and incremental growth opportunities.
           Estimated Potential Brand Savings (Brand Tax): ${currencySymbol}${brandTax.toLocaleString()}.
           The dashboard highlights where we pay for Brand terms despite ranking #1 organically.
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
  
  const isAnythingLoading = isLoadingGa4 || isLoadingGsc || isLoadingBridge || isLoadingAi || isLoadingGoogleAds;
  
  useEffect(() => { 
    localStorage.setItem('ai_provider', aiProvider); 
  }, [aiProvider]);
  
  useEffect(() => { 
    localStorage.setItem('openai_api_key', openaiKey); 
  }, [openaiKey]);
  
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
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
        className="xl:hidden fixed bottom-6 right-6 z-50 p-4 bg-slate-950 text-white rounded-full shadow-2xl active:scale-95 transition-transform"
      >
        {isSidebarOpen ? <X /> : <Menu />}
      </button>
      
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 xl:hidden" onClick={() => setIsSidebarOpen(false)} />}
      
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
      
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        aiProvider={aiProvider} 
        setAiProvider={setAiProvider}
        openaiKey={openaiKey} 
        setOpenaiKey={setOpenaiKey}
        brandRegexStr={brandRegexStr} 
        setBrandRegexStr={setBrandRegexStr}
        ga4Auth={ga4Auth} 
        gscAuth={gscAuth} 
        googleAdsAuth={googleAdsAuth}
        handleConnectGa4={handleConnectGa4} 
        handleConnectGsc={handleConnectGsc} 
        handleConnectGoogleAds={handleConnectGoogleAds}
        ga4Search={ga4Search} 
        setGa4Search={setGa4Search}
        gscSearch={gscSearch} 
        setGscSearch={setGscSearch}
        googleAdsSearch={googleAdsSearch} 
        setGoogleAdsSearch={setGoogleAdsSearch}
        availableProperties={availableProperties} 
        availableSites={availableSites} 
        availableGoogleAdsCustomers={availableGoogleAdsCustomers}
        selectedGoogleAdsCustomer={selectedGoogleAdsCustomer}
        onGoogleAdsCustomerChange={handleGoogleAdsCustomerChange}
        setGa4Auth={setGa4Auth} 
        setGscAuth={setGscAuth} 
        setGoogleAdsAuth={setGoogleAdsAuth}
        filteredProperties={filteredProperties} 
        filteredSites={filteredSites} 
        filteredGoogleAdsCustomers={filteredGoogleAdsCustomers}
      />
      
      <main className={`flex-1 transition-all duration-300 ease-in-out p-5 md:p-8 xl:p-12 overflow-x-hidden ${isSidebarOpen ? (isCollapsed ? 'xl:ml-20' : 'xl:ml-80') : 'ml-0'}`}>
        <header className="flex flex-col gap-6 mb-10">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)} 
                className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-indigo-300 transition-all shadow-sm text-slate-600 hover:text-indigo-600 group" 
                title="Abrir menú"
              >
                <Menu size={20} className="group-hover:scale-110 transition-transform" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${isAnythingLoading ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  {isLoadingGa4 ? 'Syncing GA4...' : isLoadingGsc ? 'Syncing GSC...' : isLoadingGoogleAds ? 'Syncing Google Ads...' : isLoadingBridge ? 'Joining Data...' : isLoadingAi ? 'Scanning AI...' : 'Dashboard Active'}
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">
                {activeTab === DashboardTab.ORGANIC_VS_PAID && "Organic vs Paid Performance"}
                {activeTab === DashboardTab.SEO_BY_COUNTRY && "SEO Performance by Country"}
                {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && "URL & Keyword Analysis"}
                {activeTab === DashboardTab.PPC_SEO_BRIDGE && "The Bridge: SEO vs PPC Intelligence"}
                {activeTab === DashboardTab.GOOGLE_ADS_PERFORMANCE && "Google Ads & Paid Search Analysis"}
                {activeTab === DashboardTab.SEARCH_EFFICIENCY && "Search Efficiency & Savings"}
                {activeTab === DashboardTab.AI_TRAFFIC_MONITOR && "AI Traffic Monitor"}
              </h2>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-4 w-full">
            <DateRangeSelector filters={filters} setFilters={setFilters} />
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white p-1.5 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 px-3 py-1.5 sm:border-r border-slate-100">
                 <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                 <select 
                   className="bg-transparent text-[10px] font-black uppercase outline-none cursor-pointer w-full" 
                   value={filters.ga4Dimension} 
                   onChange={e => setFilters({...filters, ga4Dimension: e.target.value})}
                 >
                    {availableDimensions.map(d => (<option key={d.value} value={d.value}>{d.label}</option>))}
                    {availableDimensions.length === 0 && <option value="sessionDefaultChannelGroup">Channel Grouping</option>}
                 </select>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 sm:border-r border-slate-100">
                 <Globe className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                 <select 
                   className="bg-transparent text-[10px] font-black uppercase outline-none cursor-pointer w-full" 
                   value={filters.country} 
                   onChange={e => setFilters({...filters, country: e.target.value})}
                 >
                    <option value="All">All Countries</option>
                    {uniqueCountries.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5">
                 <Tag className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                 <select 
                   className="bg-transparent text-[10px] font-black uppercase outline-none cursor-pointer w-full" 
                   value={filters.queryType} 
                   onChange={e => setFilters({...filters, queryType: e.target.value as any})}
                 >
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
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="font-bold text-xs">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="p-1.5 hover:bg-rose-100 rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
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
                  <h3 className="text-xl font-black">
                    Strategic Report: {activeTab === DashboardTab.ORGANIC_VS_PAID ? "Channels" : activeTab === DashboardTab.SEO_BY_COUNTRY ? "Markets" : activeTab === DashboardTab.PPC_SEO_BRIDGE ? "The Bridge" : activeTab === DashboardTab.GOOGLE_ADS_PERFORMANCE ? "Paid Search" : activeTab === DashboardTab.AI_TRAFFIC_MONITOR ? "AI Intelligence" : "Deep Dive"}
                  </h3>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                    Generated by {aiProvider === 'openai' ? 'OpenAI GPT-4o-mini' : 'Google Gemini 3 Pro'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setTabInsights({...tabInsights, [activeTab as string]: null})} 
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div 
              className="prose prose-invert max-w-none font-medium text-sm md:text-base leading-relaxed z-10 relative" 
              dangerouslySetInnerHTML={{ __html: (tabInsights[activeTab as string] || '').replace(/\n/g, '<br/>') }} 
            />
          </div>
        )}
        
        <div className="w-full">
          {activeTab === DashboardTab.ORGANIC_VS_PAID && (
            <OrganicVsPaidView 
              stats={channelStats} 
              data={filteredDailyData} 
              comparisonEnabled={filters.comparison.enabled} 
              grouping={grouping} 
              setGrouping={setGrouping} 
              currencySymbol={currencySymbol} 
            />
          )}
          
          {activeTab === DashboardTab.SEO_BY_COUNTRY && (
            <SeoMarketplaceView 
              data={filteredDailyData} 
              keywordData={filteredKeywordData} 
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
              keywords={filteredKeywordData} 
              searchTerm={searchTerm} 
              setSearchTerm={setSearchTerm} 
              isLoading={isAnythingLoading} 
              comparisonEnabled={filters.comparison.enabled} 
            />
          )}
          
          {activeTab === DashboardTab.PPC_SEO_BRIDGE && (
            <SeoPpcBridgeView 
                ga4Data={bridgeDataGA4} 
                googleAdsData={bridgeDataGoogleAds}
                ga4KeywordData={keywordBridgeDataGA4}
                googleAdsKeywordData={keywordBridgeDataGoogleAds}
                dailyData={filteredDailyData} 
                currencySymbol={currencySymbol} 
                availableGoogleAdsCustomers={availableGoogleAdsCustomers}
                selectedGoogleAdsCustomer={selectedGoogleAdsCustomer}
                onGoogleAdsCustomerChange={handleGoogleAdsCustomerChange}
            />
          )}
          
          {activeTab === DashboardTab.GOOGLE_ADS_PERFORMANCE && (
              <GoogleAdsPerformanceView 
                  data={bridgeDataGoogleAds} 
                  currencySymbol={currencySymbol} 
                  globalMetrics={googleAdsGlobalMetrics}
              />
          )}
          
          {activeTab === DashboardTab.SEARCH_EFFICIENCY && (
              <SearchEfficiencyView 
                 data={keywordBridgeDataGoogleAds.length > 0 ? keywordBridgeDataGoogleAds : keywordBridgeDataGA4}
                 brandRegexStr={brandRegexStr}
                 currencySymbol={currencySymbol}
                 globalMetrics={googleAdsGlobalMetrics}
                 totalGscClicks={gscTotals?.current?.clicks || 0}
              />
          )}
          
          {activeTab === DashboardTab.AI_TRAFFIC_MONITOR && (
            <AiTrafficView 
              data={aiTrafficData} 
              currencySymbol={currencySymbol} 
            />
          )}
        </div>
        
        <div className="mt-12 flex justify-center pb-12">
          <button 
            onClick={handleGenerateInsights} 
            disabled={loadingInsights || isAnythingLoading || (realDailyData.length === 0 && realKeywordData.length === 0)} 
            className={`flex items-center gap-3 px-10 py-4 ${aiProvider === 'openai' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-slate-950 hover:bg-slate-800 shadow-slate-900/20'} text-white rounded-3xl text-xs font-black shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50`}
          >
            {loadingInsights ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              aiProvider === 'openai' ? <Cpu className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />
            )} 
            Generate {activeTab === DashboardTab.ORGANIC_VS_PAID ? 'Channel' : activeTab === DashboardTab.SEO_BY_COUNTRY ? 'Market' : activeTab === DashboardTab.PPC_SEO_BRIDGE ? 'Bridge' : activeTab === DashboardTab.GOOGLE_ADS_PERFORMANCE ? 'Paid' : activeTab === DashboardTab.AI_TRAFFIC_MONITOR ? 'AI' : 'SEO'} Insights
          </button>
        </div>
      </main>
      {isLoadingBridge && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl text-center space-y-6">
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
              <div 
                className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"
                style={{ animationDuration: '1.5s' }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center font-bold text-blue-600">
                {loadingProgress}%
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-gray-900">Sincronizando Datos</h3>
              <p className="text-gray-500 text-sm">
                Estamos procesando tus {availableGoogleAdsSubAccounts.length > 0 ? availableGoogleAdsSubAccounts.length : '7000+'} campañas. 
                Esta operación es masiva y se está realizando de forma segura para tu navegador.
              </p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-blue-600 h-full transition-all duration-500 ease-out"
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-400 italic">Por favor, no cierres esta pestaña...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
