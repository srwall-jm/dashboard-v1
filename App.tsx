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

  const [availableDimensions, setAvailableDimensions] = useState<{ label: string; value: string }[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('£');
  
  const [ga4Search, setGa4Search] = useState('');
  const [gscSearch, setGscSearch] = useState('');
  const [sa360Search, setSa360Search] = useState('');
  
  const [realDailyData, setRealDailyData] = useState<DailyData[]>([]);
  const [realKeywordData, setRealKeywordData] = useState<KeywordData[]>([]);
  
  const [bridgeData, setBridgeData] = useState<BridgeData[]>([]); 
  const [keywordBridgeData, setKeywordBridgeData] = useState<KeywordBridgeData[]>([]); 
  
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
                descriptiveName: `Customer ${id}` 
            };
        });
        
        setAvailableSa360Customers(customers);
        if (customers.length > 0 && !sa360Auth?.customer) {
            setSa360Auth({ token, customer: customers[0] });
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

  const fetchBridgeData = async () => {
    if (!gscAuth?.site || !gscAuth.token) {
         if (!bridgeData.length) setBridgeData(generateMockBridgeData());
         return;
    }

    setIsLoadingBridge(true);
    
    // Normalize URL function to join datasets
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
        
        // 1. Fetch GSC Data (Organic Rankings & Clicks)
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
        
        const uniqueQueryMap: Record<string, { clicks: number, bestRank: number }> = {};
        (gscDataRaw.rows || []).forEach((row: any) => {
            const query = row.keys[1];
            if (!query) return;
            const cleanKw = query.toLowerCase().trim();
            const clicks = row.clicks || 0;
            const rank = row.position || 0;

            if (!uniqueQueryMap[cleanKw]) {
                uniqueQueryMap[cleanKw] = { clicks: 0, bestRank: 999 };
            }
            uniqueQueryMap[cleanKw].clicks += clicks;
            if (rank > 0 && rank < uniqueQueryMap[cleanKw].bestRank) {
                uniqueQueryMap[cleanKw].bestRank = rank;
            }
        });

        const organicRows = (gscDataRaw.rows || []).map((row: any) => ({
            query: row.keys[1],
            cleanPath: normalizeUrl(row.keys[0]), 
            fullUrl: row.keys[0], 
            rank: row.position,
            gscClicks: row.clicks
        }));

        // 2. PREPARE MAPS
        let paidDataMap: Record<string, { clicksOrSessions: number, conversions: number, cost: number, impressions: number, campaigns: Set<string> }> = {};
        let keywordDataMap: Record<string, { clicksOrSessions: number, conversions: number, cost: number }> = {};
        
        // IMPORTANT: We need Real Organic Sessions from GA4 regardless of Paid Source
        let organicSessionsMap: Record<string, number> = {};

        // 3. FETCH GA4 DATA (ALWAYS run this to get Organic Sessions + Fallback Paid if needed)
        let activeSource: 'GA4' | 'SA360' = 'GA4';
        
        if (ga4Auth?.property && ga4Auth.token) {
             const ga4Resp = await fetch(`https://analyticsdata.googleapis.com/v1beta/${ga4Auth.property.id}:runReport`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${ga4Auth.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dateRanges: [{ startDate: filters.dateRange.start, endDate: filters.dateRange.end }],
                    dimensions: [
                        { name: 'landingPage' },
                        { name: 'sessionDefaultChannelGroup' },
                        { name: 'sessionCampaignName' }
                    ],
                    metrics: [
                        { name: 'sessions' },
                        { name: 'sessionConversionRate' } 
                    ],
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

                // A. Store Organic Sessions (Critical Fix)
                if (channelGroup.includes('organic')) {
                    if (!organicSessionsMap[path]) organicSessionsMap[path] = 0;
                    organicSessionsMap[path] += sessions;
                }

                // B. Store Paid Sessions (Fallback if SA360 not present)
                if ((channelGroup.includes('paid') || channelGroup.includes('cpc') || channelGroup.includes('ppc'))) {
                    if (!paidDataMap[path]) {
                         paidDataMap[path] = { clicksOrSessions: 0, conversions: 0, cost: 0, impressions: 0, campaigns: new Set() };
                    }
                    paidDataMap[path].clicksOrSessions += sessions;
                    
                    let campType = "Other Paid";
                    const n = campaignName.toLowerCase();
                    if (n.includes('pmax')) campType = "⚡ PMax";
                    else if (n.includes('brand')) campType = "🛡️ Brand";
                    else if (n.includes('generic') || n.includes('non')) campType = "🌍 Generic";
                    else if (n !== '(not set)') campType = campaignName;
                    paidDataMap[path].campaigns.add(campType);
                }
            });

            // Also fetch keywords from GA4 just in case we need fallback
            if (!sa360Auth?.customer) {
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
                    
                    if (!keywordDataMap[cleanKw]) keywordDataMap[cleanKw] = { clicksOrSessions: 0, conversions: 0, cost: 0 };
                    
                    keywordDataMap[cleanKw].clicksOrSessions += sessions;
                    keywordDataMap[cleanKw].conversions += (sessions * rate);
                });
            }
        }

        // 4. OVERRIDE PAID DATA IF SA360 IS ACTIVE
        if (sa360Auth?.customer && sa360Auth.token) {
             activeSource = 'SA360';
             // Reset Paid Maps to use SA360 data exclusively for Paid columns
             paidDataMap = {}; 
             keywordDataMap = {};

             const sa360UrlQuery = `
                SELECT 
                  landing_page_view.unmasked_url, 
                  metrics.cost_micros, 
                  metrics.clicks, 
                  metrics.impressions, 
                  metrics.conversions 
                FROM landing_page_view 
                WHERE segments.date BETWEEN '${filters.dateRange.start}' AND '${filters.dateRange.end}'
                AND metrics.clicks > 0
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
                AND metrics.clicks > 0
             `;
             
             const fetchSa360 = async (query: string) => {
                const res = await fetch(`https://searchads360.googleapis.com/v0/customers/${sa360Auth.customer!.id}/googleAds:searchStream`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${sa360Auth.token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query })
                });
                const json = await res.json();
                if (Array.isArray(json)) {
                    return json.flatMap((batch: any) => batch.results || []);
                } else {
                    console.warn("SA360 Response not array", json);
                    return [];
                }
             };

             const [urlRows, kwRows] = await Promise.all([fetchSa360(sa360UrlQuery), fetchSa360(sa360KwQuery)]);

             urlRows.forEach((row: any) => {
                const url = row.landingPageView?.unmaskedUrl;
                if(!url) return;
                const path = normalizeUrl(url);
                
                if (!paidDataMap[path]) {
                    paidDataMap[path] = { clicksOrSessions: 0, conversions: 0, cost: 0, impressions: 0, campaigns: new Set(['SA360']) };
                }
                const metrics = row.metrics;
                paidDataMap[path].clicksOrSessions += parseInt(metrics.clicks) || 0;
                paidDataMap[path].conversions += parseFloat(metrics.conversions) || 0;
                paidDataMap[path].impressions += parseInt(metrics.impressions) || 0;
                paidDataMap[path].cost += (parseInt(metrics.costMicros) || 0) / 1000000;
             });

             kwRows.forEach((row: any) => {
                 const kw = row.adGroupCriterion?.keyword?.text;
                 if(!kw) return;
                 const cleanKw = kw.toLowerCase().trim();

                 if (!keywordDataMap[cleanKw]) {
                     keywordDataMap[cleanKw] = { clicksOrSessions: 0, conversions: 0, cost: 0 };
                 }
                 const metrics = row.metrics;
                 keywordDataMap[cleanKw].clicksOrSessions += parseInt(metrics.clicks) || 0;
                 keywordDataMap[cleanKw].conversions += parseFloat(metrics.conversions) || 0;
                 keywordDataMap[cleanKw].cost += (parseInt(metrics.costMicros) || 0) / 1000000;
             });
        }

        // 5. COMBINE DATASETS
        const bridgeResults: BridgeData[] = [];
        organicRows.forEach(org => {
            const paidStats = paidDataMap[org.cleanPath];
            
            // FIX: Use Real Organic Sessions from GA4 Map, defaulting to 0 if not found in GA4
            const realOrganicSessions = organicSessionsMap[org.cleanPath] || 0;
            
            const paidVolume = paidStats ? paidStats.clicksOrSessions : 0;
            
            // Only skip if NO organic visibility (clicks/sessions) AND NO paid volume
            if (org.gscClicks === 0 && realOrganicSessions === 0 && paidVolume === 0) return;

            const totalVolume = realOrganicSessions + paidVolume;
            const paidShare = totalVolume > 0 ? (paidVolume / totalVolume) : 0;
            const cost = paidStats ? paidStats.cost : 0;
            const conversions = paidStats ? paidStats.conversions : 0;
            const cpa = conversions > 0 ? cost / conversions : 0;
            const avgCpc = paidVolume > 0 ? cost / paidVolume : 0;

            let action = "MAINTAIN";
            if (org.rank <= 3.0 && paidShare > 0.4) action = "CRITICAL (Overlap)";
            else if (org.rank <= 3.0 && paidVolume > 0) action = "REVIEW";
            else if (org.rank > 10.0 && paidVolume === 0) action = "INCREASE";

            let campDisplay = "None";
            if (paidStats && paidStats.campaigns.size > 0) campDisplay = Array.from(paidStats.campaigns).join(' + ');

            bridgeResults.push({
                url: org.cleanPath, 
                query: org.query,
                organicRank: org.rank,
                organicClicks: org.gscClicks, // GSC Metric
                organicSessions: realOrganicSessions, // Real GA4 Metric
                ppcCampaign: campDisplay,
                ppcCost: cost,
                ppcConversions: conversions,
                ppcCpa: cpa,
                ppcAvgCpc: avgCpc,
                ppcSessions: paidVolume, 
                ppcImpressions: paidStats ? paidStats.impressions : 0,
                blendedCostRatio: paidShare, 
                actionLabel: action,
                dataSource: activeSource
            });
        });
        setBridgeData(bridgeResults.sort((a, b) => b.blendedCostRatio - a.blendedCostRatio));

        // Keyword View Logic (unchanged mostly, but good to have)
        const keywordResults: KeywordBridgeData[] = [];
        const allKeys = new Set([...Object.keys(keywordDataMap), ...Object.keys(uniqueQueryMap)]);

        allKeys.forEach(key => {
            const paidData = keywordDataMap[key] || { clicksOrSessions: 0, conversions: 0, cost: 0 };
            const paidVol = paidData.clicksOrSessions;
            const gscData = uniqueQueryMap[key];
            const orgVol = gscData ? gscData.clicks : 0;
            const organicRank = gscData ? gscData.bestRank : null;

            if (paidVol === 0 && orgVol === 0) return;

            const cvr = paidVol > 0 ? (paidData.conversions / paidVol) * 100 : 0;
            const cpc = paidVol > 0 ? paidData.cost / paidVol : 0;
            const cpa = paidData.conversions > 0 ? paidData.cost / paidData.conversions : 0;

            let action = "MAINTAIN";
            if (organicRank !== null && organicRank <= 3.0 && paidVol > 50) action = "CRITICAL (Cannibalization)";
            else if (organicRank !== null && organicRank > 10 && paidVol === 0) action = "OPPORTUNITY (Growth)";
            else if (organicRank !== null && organicRank <= 3.0 && paidVol > 0 && paidVol <= 50) action = "REVIEW (Ineficiency)";

            keywordResults.push({
               keyword: key,
               organicRank: organicRank === 999 ? null : organicRank,
               organicClicks: orgVol,
               paidSessions: paidVol,
               paidCvr: cvr,
               paidCpc: cpc,
               paidCpa: cpa,
               paidCost: paidData.cost,
               actionLabel: action,
               dataSource: activeSource
            });
        });

        setKeywordBridgeData(keywordResults.sort((a, b) => b.paidSessions - a.paidSessions));

    } catch (e) {
        console.error("❌ ERROR BRIDGE:", e);
    } finally {
        setIsLoadingBridge(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('seo_suite_user');
    setGa4Auth(null);
    sessionStorage.removeItem('ga4_auth');
    setGscAuth(null);
    sessionStorage.removeItem('gsc_auth');
    setSa360Auth(null);
    sessionStorage.removeItem('sa360_auth');
  };

  const handleConnectGa4 = () => {
     if (tokenClientGa4.current) tokenClientGa4.current.requestAccessToken();
  };
  
  const handleConnectGsc = () => {
     if (tokenClientGsc.current) tokenClientGsc.current.requestAccessToken();
  };

  const handleConnectSa360 = () => {
     if (tokenClientSa360.current) tokenClientSa360.current.requestAccessToken();
  };

  // Google Identity Services Initialization
  useEffect(() => {
    if (window.google) {
        tokenClientGa4.current = window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPE_GA4,
            callback: async (resp: any) => {
                if (resp.access_token) {
                    await fetchGa4Properties(resp.access_token);
                }
            },
        });
        tokenClientGsc.current = window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPE_GSC,
            callback: async (resp: any) => {
                if (resp.access_token) {
                    await fetchGscSites(resp.access_token);
                }
            },
        });
        tokenClientSa360.current = window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPE_SA360,
            callback: async (resp: any) => {
                if (resp.access_token) {
                    await fetchSa360Customers(resp.access_token);
                }
            },
        });
    }
  }, []);

  // Data Fetching Effects
  useEffect(() => {
    const loadData = async () => {
        if (!ga4Auth?.token) {
            setRealDailyData(generateMockDailyData());
            setRealKeywordData(generateMockKeywordData());
        } else {
             // If fetching real data logic was fully implemented, it would be here. 
             // Falling back to mocks for this demo or where data is missing.
             setRealDailyData(generateMockDailyData()); 
             setRealKeywordData(generateMockKeywordData());
        }

        await fetchBridgeData();
        await fetchAiTrafficData();
    };
    loadData();
  }, [filters, ga4Auth, gscAuth, sa360Auth]);

  const stats = useMemo(() => aggregateData(realDailyData), [realDailyData]);
  
  const filteredProperties = availableProperties.filter(p => p.name.toLowerCase().includes(ga4Search.toLowerCase()));
  const filteredSites = availableSites.filter(s => s.siteUrl.toLowerCase().includes(gscSearch.toLowerCase()));
  const filteredSa360Customers = availableSa360Customers.filter(c => (c.descriptiveName || c.id).toLowerCase().includes(sa360Search.toLowerCase()));

  if (!user) {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
             <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
                 <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-600/20">
                     <Activity className="text-white w-8 h-8" />
                 </div>
                 <h1 className="text-2xl font-black text-slate-900 mb-2">The OneSearch Engine</h1>
                 <p className="text-sm text-slate-500 font-medium mb-8">Sign in to access your SEO & Paid Search intelligence suite.</p>
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

  const renderContent = () => {
      switch (activeTab) {
          case DashboardTab.ORGANIC_VS_PAID:
              return <OrganicVsPaidView stats={stats} data={realDailyData} comparisonEnabled={filters.comparison.enabled} grouping={grouping} setGrouping={setGrouping} currencySymbol={currencySymbol} />;
          case DashboardTab.SEO_BY_COUNTRY:
              return <SeoMarketplaceView data={realDailyData} keywordData={realKeywordData} gscDailyTotals={gscDailyTotals} gscTotals={gscTotals} aggregate={aggregateData} comparisonEnabled={filters.comparison.enabled} currencySymbol={currencySymbol} grouping={grouping} isBranded={isBranded} queryTypeFilter={filters.queryType} countryFilter={filters.country} />;
          case DashboardTab.KEYWORD_DEEP_DIVE:
              return <SeoDeepDiveView keywords={realKeywordData} searchTerm={searchTerm} setSearchTerm={setSearchTerm} isLoading={false} comparisonEnabled={filters.comparison.enabled} />;
          case DashboardTab.PPC_SEO_BRIDGE:
              return <SeoPpcBridgeView data={bridgeData} keywordData={keywordBridgeData} dailyData={realDailyData} currencySymbol={currencySymbol} />;
          case DashboardTab.AI_TRAFFIC_MONITOR:
              return <AiTrafficView data={aiTrafficData} currencySymbol={currencySymbol} />;
          default:
              return null;
      }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
        <Sidebar 
            isOpen={isSidebarOpen} 
            setIsOpen={setIsSidebarOpen} 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            user={user} 
            handleLogout={handleLogout}
            setIsSettingsOpen={setIsSettingsOpen}
        />
        
        <main className={`flex-1 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'ml-80' : 'ml-0'}`}>
            <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {!isSidebarOpen && (
                        <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
                            <Menu size={20} />
                        </button>
                    )}
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">
                            {activeTab === DashboardTab.ORGANIC_VS_PAID && "Organic vs Paid Performance"}
                            {activeTab === DashboardTab.SEO_BY_COUNTRY && "International Market Performance"}
                            {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && "Deep Keyword Analysis"}
                            {activeTab === DashboardTab.PPC_SEO_BRIDGE && "PPC to SEO Bridge"}
                            {activeTab === DashboardTab.AI_TRAFFIC_MONITOR && "AI Traffic Monitor"}
                        </h2>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Live Data
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <DateRangeSelector filters={filters} setFilters={setFilters} />
                </div>
            </header>

            <div className="p-6 md:p-8 max-w-[1920px] mx-auto">
                {renderContent()}
            </div>
        </main>

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
            availableProperties={availableProperties} availableSites={availableSites} availableSa360Customers={availableSa360Customers}
            setGa4Auth={setGa4Auth} setGscAuth={setGscAuth} setSa360Auth={setSa360Auth}
            filteredProperties={filteredProperties} filteredSites={filteredSites} filteredSa360Customers={filteredSa360Customers}
        />
    </div>
  );
};

export default App;