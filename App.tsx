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
  const [availableSa360Customers, setAvailableSa360Customers] = useState<Sa360Customer[]>([]);

  // NEW: State to track the specifically selected SA360 account for analysis
  const [selectedSa360Customer, setSelectedSa360Customer] = useState<Sa360Customer | null>(null);

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

  const fetchSa360Customers = async (token: string) => {
    try {
        setIsLoadingSa360(true);
        const resp = await fetch('https://searchads360.googleapis.com/v0/customers:listAccessibleCustomers', {
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
           // Default selection logic
           if (!selectedSa360Customer) {
               setSelectedSa360Customer(customers[0]);
           }
        }
    } catch (e) {
        console.error(e);
        setError("Error connecting to Search Ads 360 API.");
    } finally {
        setIsLoadingSa360(false);
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
    // FALLBACK / MOCK DATA GENERATION
    if (!gscAuth?.site || !gscAuth.token) {
         if (!bridgeDataGA4.length) setBridgeDataGA4(generateMockBridgeData());
         
         // Explicitly generate Mock SA360 Data if no data exists
         // Mock SA360 data generation for demo purposes
         if (!bridgeDataSA360.length) {
             const saMock = generateMockBridgeData().map(d => ({
                 ...d,
                 dataSource: 'SA360' as const,
                 ppcSessions: Math.round(d.ppcSessions * 0.8), // Variation: Clicks usually < Sessions or distinct
                 ppcCampaign: 'SA360 - ' + d.ppcCampaign
             }));
             setBridgeDataSA360(saMock);
             
             // Also mock customers if empty so selector appears
             if (availableSa360Customers.length === 0) {
                 const mockCustomers = [
                     { resourceName: 'c1', id: '111-222-3333', descriptiveName: 'Global Account' },
                     { resourceName: 'c2', id: '444-555-6666', descriptiveName: 'US Division' },
                     { resourceName: 'c3', id: '777-888-9999', descriptiveName: 'EU Division' }
                 ];
                 setAvailableSa360Customers(mockCustomers);
                 if (!selectedSa360Customer) setSelectedSa360Customer(mockCustomers[0]);
             }
         }
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
        // PROCESS A: SA360 DATA (Use selectedSa360Customer)
        // ---------------------------------------------------------
        // We use sa360Auth.token for authorization, but selectedSa360Customer.id for the target customer
        if (sa360Auth?.token && selectedSa360Customer) {
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
                // Using selectedSa360Customer.id specifically
                const res = await fetch(`https://searchads360.googleapis.com/v0/customers/${selectedSa360Customer.id}/googleAds:searchStream`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${sa360Auth.token}`, 'Content-Type': 'application/json' },
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
                organicRows.forEach((org: any) => {
                    const paidStats = sa360PaidMap[org.cleanPath];
                    const organicProxy = org.gscClicks; 
                    const paidVolume = paidStats ? paidStats.clicksOrSessions : 0;
                    if (organicProxy === 0 && paidVolume === 0) return;
                    
                    const totalVolume = organicProxy + paidVolume;
                    const paidShare = totalVolume > 0 ? (paidVolume / totalVolume) : 0;
                    
                    let action = "MAINTAIN";
                    if (org.rank <= 3.0 && paidShare > 0.4) action = "CRITICAL (Overlap)";
                    else if (org.rank <= 3.0 && paidVolume > 0) action = "REVIEW";
                    else if (org.rank > 10.0 && paidVolume === 0) action = "INCREASE";

                    let campDisplay = "SA360";
                    sa360Results.push({
                        url: org.cleanPath, query: org.query, organicRank: org.rank, organicClicks: org.gscClicks, organicSessions: org.gscClicks, 
                        ppcCampaign: campDisplay, ppcCost: paidStats?.cost || 0, ppcConversions: paidStats?.conversions || 0, ppcCpa: 0,
                        ppcSessions: paidVolume, ppcImpressions: paidStats?.impressions || 0, blendedCostRatio: paidShare, actionLabel: action, dataSource: 'SA360'
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

  useEffect(() => {
    // Initial data load (Mock)
    setRealDailyData(generateMockDailyData());
    setRealKeywordData(generateMockKeywordData());
    setAiTrafficData(generateMockAiTrafficData());
    setBridgeDataGA4(generateMockBridgeData());
  }, []);

  useEffect(() => {
    /* global google */
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      tokenClientGa4.current = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE_GA4,
        callback: (resp: any) => {
          if (resp.access_token) fetchGa4Properties(resp.access_token);
        },
      });
      tokenClientGsc.current = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE_GSC,
        callback: (resp: any) => {
          if (resp.access_token) fetchGscSites(resp.access_token);
        },
      });
       tokenClientSa360.current = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE_SA360,
        callback: (resp: any) => {
          if (resp.access_token) fetchSa360Customers(resp.access_token);
        },
      });
    }
  }, []);

  const handleConnectGa4 = () => tokenClientGa4.current?.requestAccessToken();
  const handleConnectGsc = () => tokenClientGsc.current?.requestAccessToken();
  const handleConnectSa360 = () => tokenClientSa360.current?.requestAccessToken();

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('seo_suite_user');
    sessionStorage.clear();
    setGa4Auth(null);
    setGscAuth(null);
    setSa360Auth(null);
  };

  const stats = useMemo(() => aggregateData(realDailyData), [realDailyData]);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-600/20">
                <Activity className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 mb-2">The OneSearch Suite</h1>
            <p className="text-sm font-medium text-slate-500 mb-8">Advanced SEO & PPC Unified Analytics</p>
            <GoogleLogin onLoginSuccess={(credential) => {
                const payload = JSON.parse(atob(credential.split('.')[1]));
                const userData = { name: payload.name, email: payload.email, picture: payload.picture };
                setUser(userData);
                localStorage.setItem('seo_suite_user', JSON.stringify(userData));
            }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
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

      <div className={`flex-1 flex flex-col h-full transition-all duration-300 ease-in-out ${isCollapsed ? 'ml-20' : 'ml-0 xl:ml-80'}`}>
         {/* Top Navigation / Header */}
         <header className="flex-shrink-0 px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 z-40">
            <div className="flex items-center gap-4">
                <button onClick={() => setIsSidebarOpen(true)} className="xl:hidden p-2 bg-white border border-slate-200 rounded-xl text-slate-500">
                    <Menu className="w-5 h-5" />
                </button>
                <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">{
                        activeTab === DashboardTab.ORGANIC_VS_PAID ? 'Organic vs Paid Performance' :
                        activeTab === DashboardTab.SEO_BY_COUNTRY ? 'Marketplace Analysis' :
                        activeTab === DashboardTab.KEYWORD_DEEP_DIVE ? 'Deep SEO Dive' :
                        activeTab === DashboardTab.PPC_SEO_BRIDGE ? 'PPC-SEO Bridge' : 'AI Traffic Monitor'
                    }</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        {filters.dateRange.start} — {filters.dateRange.end}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <DateRangeSelector filters={filters} setFilters={setFilters} />
                <button onClick={() => { fetchBridgeData(); fetchAiTrafficData(); }} className="p-2.5 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm">
                    <RefreshCw size={18} />
                </button>
            </div>
         </header>

         {/* Main Content Scrollable Area */}
         <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
            <div className="max-w-[1920px] mx-auto pb-20">
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
                        isLoading={isLoadingGsc} 
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
                        setSelectedSa360Customer={setSelectedSa360Customer}
                    />
                )}
                {activeTab === DashboardTab.AI_TRAFFIC_MONITOR && (
                    <AiTrafficView 
                        data={aiTrafficData} 
                        currencySymbol={currencySymbol} 
                    />
                )}
            </div>
         </main>
      </div>
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        aiProvider={aiProvider} setAiProvider={setAiProvider}
        openaiKey={openaiKey} setOpenaiKey={setOpenaiKey}
        brandRegexStr={brandRegexStr} setBrandRegexStr={setBrandRegexStr}
        ga4Auth={ga4Auth} setGa4Auth={setGa4Auth}
        gscAuth={gscAuth} setGscAuth={setGscAuth}
        sa360Auth={sa360Auth} setSa360Auth={setSa360Auth}
        handleConnectGa4={handleConnectGa4}
        handleConnectGsc={handleConnectGsc}
        handleConnectSa360={handleConnectSa360}
        ga4Search={ga4Search} setGa4Search={setGa4Search}
        gscSearch={gscSearch} setGscSearch={setGscSearch}
        sa360Search={sa360Search} setSa360Search={setSa360Search}
        availableProperties={availableProperties}
        availableSites={availableSites}
        availableSa360Customers={availableSa360Customers}
        filteredProperties={availableProperties.filter(p => p.name.toLowerCase().includes(ga4Search.toLowerCase()))}
        filteredSites={availableSites.filter(s => s.siteUrl.toLowerCase().includes(gscSearch.toLowerCase()))}
        filteredSa360Customers={availableSa360Customers.filter(c => (c.descriptiveName || c.id).toLowerCase().includes(sa360Search.toLowerCase()))}
        selectedSa360Customer={selectedSa360Customer}
        setSelectedSa360Customer={setSelectedSa360Customer}
      />
    </div>
  );
};

export default App;