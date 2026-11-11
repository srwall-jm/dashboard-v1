import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  RefreshCw, Filter, Globe, Tag, AlertCircle, Sparkles, Cpu, Menu, X, Printer, Presentation
} from 'lucide-react';
import { DashboardTab, DashboardFilters, DailyData, KeywordData, Ga4Property, GscSite, GoogleAdsCustomer, QueryType, BridgeData, AiTrafficData, KeywordBridgeData, GoogleAdsGlobalMetrics } from './types';
import { getDashboardInsights, getOpenAiInsights } from './insightsService';
import GoogleLogin from './GoogleLogin'; 
import { CURRENCY_SYMBOLS, aggregateData, formatDate, normalizeCountry, extractPath, normalizeUrl, parseLocalDate, AI_SOURCE_REGEX_STRING, parseGoogleAdsMetric, isOrganicSearch, isPaidSearch } from './utils';
import { ga4RunReportAll, gscQueryAll, isAuthExpired } from './dataFetch';
import { generateMockBridgeData, generateMockAiTrafficData, generateMockKeywordSignals } from './mockData';
import { KeywordSignal, ShareRow, combineShares, buildRecommendations, RecommendationOverrides, settingsFromOverrides } from './recommendations';
import { RecommendationRulesPanel } from './components/RecommendationRulesPanel';
import { TAB_META } from './navigation';
import { ClientProfile, ClientProfileInput, ClientProfileList, fetchClientProfiles, saveClientProfile, deleteClientProfile } from './clientProfiles';
import { PinnedAdsAccounts, clientKeyOf, resolveAdsAccounts, loadPinnedAdsAccounts, savePinnedAdsAccounts } from './adsAccounts';
import { SummaryView } from './views/SummaryView';
// Import New Components and Views
import { Sidebar } from './components/Sidebar';
import { ClientProfilePanel } from './components/ClientProfilePanel';
import { SettingsModal } from './components/SettingsModal';
import { InsightsText } from './components/InsightsText';
import { DateRangeSelector } from './components/DateRangeSelector';
import { OrganicVsPaidView } from './views/OrganicVsPaidView';
import { SeoMarketplaceView } from './views/SeoMarketplaceView';
import { SeoDeepDiveView } from './views/SeoDeepDiveView';
import { SeoPpcBridgeView } from './views/SeoPpcBridgeView';
import { AiTrafficView } from './views/AiTrafficView';
import { GoogleAdsPerformanceView } from './views/GoogleAdsPerformanceView';
import { SearchEfficiencyView } from './views/SearchEfficiencyView';

const DEFAULT_CLIENT_ID = "333322783684-pjhn2omejhngckfd46g8bh2dng9dghlc.apps.googleusercontent.com"; 
// Fallback opcional vía env var (agencia). El campo que cada cliente rellena en Settings tiene prioridad.
const DEVELOPER_TOKEN = import.meta.env.VITE_GOOGLE_ADS_DEVELOPER_TOKEN || "";
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
  const lastBridgeFetchParams = useRef<string>('');
  const lastAiFetchParams = useRef<string>('');
  
  const [user, setUser] = useState<{ name: string; email: string; picture: string } | null>(() => {
    const saved = localStorage.getItem('seo_suite_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Who Cloudflare Access says is signed in.
  // 'protected': the site is restricted and the identity comes from Access.
  // 'open': the functions answer but Access is not configured yet.
  // 'unknown': no session endpoint (local `npm run dev`).
  const [accessSession, setAccessSession] = useState<{ status: 'loading' | 'protected' | 'open' | 'unknown'; email?: string }>({ status: 'loading' });
  // Google Ads credentials the agency keeps in Cloudflare, so nobody types them in Settings.
  const [agencyAds, setAgencyAds] = useState<{ developerTokenOnServer: boolean; developerTokenWaitingForAccess: boolean; oauthClientId: string | null }>({ developerTokenOnServer: false, developerTokenWaitingForAccess: false, oauthClientId: null });

  useEffect(() => {
    let cancelled = false;
    type Session = { status: 'protected' | 'open' | 'unknown'; email?: string };
    fetch('/api/session', { headers: { Accept: 'application/json' } })
      .then(async (resp): Promise<Session> => {
        if (!resp.ok || !(resp.headers.get('content-type') || '').includes('application/json')) return { status: 'unknown' };
        const body = await resp.json();
        if (!cancelled && body?.googleAds) {
          setAgencyAds({
            developerTokenOnServer: body.googleAds.developerTokenOnServer === true,
            developerTokenWaitingForAccess: body.googleAds.developerTokenWaitingForAccess === true,
            oauthClientId: typeof body.googleAds.oauthClientId === 'string' && body.googleAds.oauthClientId ? body.googleAds.oauthClientId : null,
          });
        }
        if (body?.protected === true && body.email) return { status: 'protected', email: String(body.email) };
        return body?.protected === false ? { status: 'open' } : { status: 'unknown' };
      })
      .catch((): Session => ({ status: 'unknown' }))
      .then(next => {
        if (cancelled) return;
        setAccessSession(next);
        if (next.status === 'protected' && next.email) {
          const name = next.email.split('@')[0].split(/[._-]+/).filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
          setUser({ name: name || next.email, email: next.email, picture: '' });
        }
      });
    return () => { cancelled = true; };
  }, []);
  
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
  // Accounts chosen for each client (GA4 property + Search Console site). The MCC is never added up as a whole.
  const [pinnedAdsAccounts, setPinnedAdsAccounts] = useState<PinnedAdsAccounts>(loadPinnedAdsAccounts);
  
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
  const [googleAdsDailyTotals, setGoogleAdsDailyTotals] = useState<{date: string, impressions: number, label: 'current' | 'previous'}[]>([]);
  const [bridgeDataGA4, setBridgeDataGA4] = useState<BridgeData[]>([]); 
  const [bridgeDataGoogleAds, setBridgeDataGoogleAds] = useState<BridgeData[]>([]); 
  const [keywordBridgeDataGA4, setKeywordBridgeDataGA4] = useState<KeywordBridgeData[]>([]);
  const [keywordBridgeDataGoogleAds, setKeywordBridgeDataGoogleAds] = useState<KeywordBridgeData[]>([]);
  const [globalKeywordBridgeDataGoogleAds, setGlobalKeywordBridgeDataGoogleAds] = useState<KeywordBridgeData[]>([]);
  // One row per paid keyword with its organic counterpart, input of the recommendation model.
  const [keywordSignals, setKeywordSignals] = useState<KeywordSignal[]>([]);
  // Search Console totals per query (all URLs together), filled while the bridge data loads.
  const gscQueryTotals = useRef<Record<string, { clicks: number; impressions: number; weightedRankSum: number }>>({});
  
  const [aiTrafficData, setAiTrafficData] = useState<AiTrafficData[]>([]); 
  const [gscDailyTotals, setGscDailyTotals] = useState<any[]>([]);
  const [gscTotals, setGscTotals] = useState<{current: any, previous: any} | null>(null);
  
  const [isLoadingGa4, setIsLoadingGa4] = useState(false);
  const [isLoadingGsc, setIsLoadingGsc] = useState(false);
  const [isLoadingBridge, setIsLoadingBridge] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [isLoadingGoogleAds, setIsLoadingGoogleAds] = useState(false);
  const [isGoogleAdsKeywordsLoading, setIsGoogleAdsKeywordsLoading] = useState(false);
  const [isGoogleAdsKeywordsLoaded, setIsGoogleAdsKeywordsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Non-blocking notices about incomplete data (row caps, accounts that failed), keyed by source.
  const [dataWarnings, setDataWarnings] = useState<Record<string, string>>({});
  const setWarning = (key: string, message: string | null) =>
    setDataWarnings(prev => {
      if (!message && !(key in prev)) return prev;
      const next = { ...prev };
      if (message) next[key] = message; else delete next[key];
      return next;
    });

  const adsClientKey = clientKeyOf(ga4Auth?.property?.id, gscAuth?.site?.siteUrl);
  const adsAccountsForClient = useMemo(
    () => resolveAdsAccounts(availableGoogleAdsSubAccounts, pinnedAdsAccounts[adsClientKey]),
    [availableGoogleAdsSubAccounts, pinnedAdsAccounts, adsClientKey]
  );
  const activeAdsAccounts = adsAccountsForClient.accounts;
  const activeAdsAccountsKey = activeAdsAccounts.map(a => a.id).join(',');

  const handlePinnedAdsAccountsChange = (ids: string[]) => {
    setPinnedAdsAccounts(prev => {
      const next = { ...prev, [adsClientKey]: ids };
      savePinnedAdsAccounts(next);
      return next;
    });
  };

  // --- Recommendation rules, per client (same key as the Google Ads accounts) ---
  const [rulesByClient, setRulesByClient] = useState<Record<string, RecommendationOverrides>>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('recommendation_rules_by_client') || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch { return {}; }
  });
  const recommendationSettings = useMemo(() => settingsFromOverrides(rulesByClient[adsClientKey]), [rulesByClient, adsClientKey]);

  const setRulesForClient = (key: string, overrides: RecommendationOverrides | null) => {
    setRulesByClient(prev => {
      const next = { ...prev };
      if (overrides) next[key] = overrides; else delete next[key];
      try { localStorage.setItem('recommendation_rules_by_client', JSON.stringify(next)); } catch { /* still applies for this session */ }
      return next;
    });
  };

  // --- Shared client profiles (Cloudflare KV). A profile fills in the client setup for anyone on the team. ---
  const [clientProfiles, setClientProfiles] = useState<ClientProfileList>({ available: false, reason: 'offline', clients: [] });
  const [activeProfileId, setActiveProfileId] = useState<string | null>(() => localStorage.getItem('active_client_profile'));
  const activeProfile = clientProfiles.clients.find(p => p.id === activeProfileId) || null;
  // Parts of a profile still waiting for a Google connection before they can be applied.
  const pendingProfile = useRef<{ ga4: Ga4Property | null; gsc: string | null; managerId: string | null } | null>(null);
  const [pendingProfileTick, setPendingProfileTick] = useState(0);

  useEffect(() => {
    if (accessSession.status === 'loading') return;
    let cancelled = false;
    fetchClientProfiles().then(list => { if (!cancelled) setClientProfiles(list); });
    return () => { cancelled = true; };
  }, [accessSession.status]);

  const applyClientProfile = (profile: ClientProfile | null) => {
    setActiveProfileId(profile?.id || null);
    if (profile) localStorage.setItem('active_client_profile', profile.id); else localStorage.removeItem('active_client_profile');
    if (!profile) { pendingProfile.current = null; return; }

    if (profile.brandRegex) setBrandRegexStr(profile.brandRegex);
    setRulesForClient(clientKeyOf(profile.ga4PropertyId, profile.gscSiteUrl), profile.recommendation || null);
    if (profile.adsAccountIds.length > 0) {
      const key = clientKeyOf(profile.ga4PropertyId, profile.gscSiteUrl);
      setPinnedAdsAccounts(prev => {
        const next = { ...prev, [key]: profile.adsAccountIds };
        savePinnedAdsAccounts(next);
        return next;
      });
    }
    pendingProfile.current = {
      ga4: profile.ga4PropertyId ? { id: profile.ga4PropertyId, name: profile.ga4PropertyName || profile.ga4PropertyId } : null,
      gsc: profile.gscSiteUrl || null,
      managerId: profile.adsManagerId || null,
    };
    setPendingProfileTick(t => t + 1);
  };

  // A profile chosen in an earlier visit is applied again once the list has loaded.
  const restoredProfile = useRef(false);
  useEffect(() => {
    if (restoredProfile.current || !clientProfiles.available) return;
    restoredProfile.current = true;
    if (activeProfile) applyClientProfile(activeProfile);
  }, [clientProfiles.available, activeProfile?.id]);

  // Applies each part of the chosen profile as soon as its Google connection is there.
  useEffect(() => {
    const pending = pendingProfile.current;
    if (!pending) return;
    if (pending.ga4 && ga4Auth?.token) {
      if (ga4Auth.property?.id !== pending.ga4.id) {
        const next = { token: ga4Auth.token, property: pending.ga4 };
        setGa4Auth(next);
        sessionStorage.setItem('ga4_auth', JSON.stringify(next));
      }
      pending.ga4 = null;
    }
    if (pending.gsc && gscAuth?.token) {
      if (gscAuth.site?.siteUrl !== pending.gsc) {
        const next = { token: gscAuth.token, site: { siteUrl: pending.gsc } };
        setGscAuth(next);
        sessionStorage.setItem('gsc_auth', JSON.stringify(next));
      }
      pending.gsc = null;
    }
    if (pending.managerId && availableGoogleAdsCustomers.length > 0) {
      const manager = availableGoogleAdsCustomers.find(c => c.id.replace(/-/g, '') === pending.managerId);
      if (manager && selectedGoogleAdsCustomer?.id !== manager.id) handleGoogleAdsCustomerChange(manager);
      pending.managerId = null;
    }
    if (!pending.ga4 && !pending.gsc && !pending.managerId) pendingProfile.current = null;
  }, [pendingProfileTick, ga4Auth?.token, gscAuth?.token, availableGoogleAdsCustomers]);

  // Built when Settings renders, once every value below exists.
  const buildCurrentProfileInput = (): ClientProfileInput => ({
    name: activeProfile?.name || '',
    ga4PropertyId: ga4Auth?.property?.id || '',
    ga4PropertyName: ga4Auth?.property?.name || '',
    gscSiteUrl: gscAuth?.site?.siteUrl || '',
    adsManagerId: (selectedGoogleAdsCustomer?.id || '').replace(/-/g, ''),
    adsAccountIds: activeAdsAccounts.map(a => a.id),
    brandRegex: brandRegexStr,
    recommendation: rulesByClient[adsClientKey] || undefined,
  });

  const handleSaveClientProfile = async (id: string, profile: ClientProfileInput) => {
    const saved = await saveClientProfile(id, profile);
    setClientProfiles(prev => ({
      ...prev,
      clients: [...prev.clients.filter(p => p.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name)),
    }));
    setActiveProfileId(saved.id);
    localStorage.setItem('active_client_profile', saved.id);
  };

  const handleDeleteClientProfile = async (id: string) => {
    await deleteClientProfile(id);
    setClientProfiles(prev => ({ ...prev, clients: prev.clients.filter(p => p.id !== id) }));
    if (activeProfileId === id) {
      setActiveProfileId(null);
      localStorage.removeItem('active_client_profile');
    }
  };

  const handleSelectClientProfile = (id: string | null) =>
    applyClientProfile(clientProfiles.clients.find(p => p.id === id) || null);

  useEffect(() => {
    if (!googleAdsAuth?.token || availableGoogleAdsSubAccounts.length === 0) {
      setWarning('adsAccounts', null);
    } else if (adsAccountsForClient.needsChoice) {
      setWarning('adsAccounts', `Google Ads: no accounts are chosen for this client. Pick them in Settings (${availableGoogleAdsSubAccounts.length} available). No paid data is loaded until then, so nothing is added up across the whole manager account.`);
    } else if (adsAccountsForClient.missing.length > 0) {
      setWarning('adsAccounts', `Google Ads: ${adsAccountsForClient.missing.length} account${adsAccountsForClient.missing.length !== 1 ? 's' : ''} chosen for this client cannot be reached with the current login or manager account (${adsAccountsForClient.missing.join(', ')}). Paid figures are incomplete.`);
    } else {
      setWarning('adsAccounts', null);
    }
  }, [googleAdsAuth?.token, availableGoogleAdsSubAccounts.length, adsAccountsForClient]);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1280);
  // Client view: the same page without menu, filters or settings, ready to present or print.
  const [clientView, setClientView] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [brandRegexStr, setBrandRegexStr] = useState(() => localStorage.getItem('brand_regex') || 'shop|brand|pro|sports');
  const [grouping, setGrouping] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai'>(() => {
    const saved = localStorage.getItem('ai_provider');
    return (saved as 'gemini' | 'openai') || 'gemini';
  });
  const [openaiKey, setOpenaiKey] = useState(() => localStorage.getItem('openai_api_key') || '');
  const [developerToken, setDeveloperToken] = useState(() => localStorage.getItem('google_ads_developer_token') || '');
  const [googleAdsClientId, setGoogleAdsClientId] = useState(() => localStorage.getItem('google_ads_client_id') || DEFAULT_CLIENT_ID);
  
  const [activeTab, setActiveTab] = useState<DashboardTab>(DashboardTab.SUMMARY);
  
  const [tabInsights, setTabInsights] = useState<Record<string, string | null>>({
    [DashboardTab.SUMMARY]: null,
    [DashboardTab.ORGANIC_VS_PAID]: null,
    [DashboardTab.SEO_BY_COUNTRY]: null,
    [DashboardTab.KEYWORD_DEEP_DIVE]: null,
    [DashboardTab.PPC_SEO_BRIDGE]: null,
    [DashboardTab.GOOGLE_ADS_PERFORMANCE]: null,
    [DashboardTab.AI_TRAFFIC_MONITOR]: null,
    [DashboardTab.SEARCH_EFFICIENCY]: null
  });
  
  const [loadingInsights, setLoadingInsights] = useState(false);
  
  const [filters, setFilters] = useState<DashboardFilters>(() => {
    const d = new Date();
    const lastMonthStart = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const lastMonthEnd = new Date(d.getFullYear(), d.getMonth(), 0);
    return {
      dateRange: { 
        start: formatDate(lastMonthStart), 
        end: formatDate(lastMonthEnd) 
      },
      comparison: {
        enabled: false,
        type: 'previous_period'
      },
      country: 'All',
      queryType: 'All',
      ga4Dimension: 'sessionDefaultChannelGroup'
    };
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  
  const tokenClientGa4 = useRef<any>(null);
  const tokenClientGsc = useRef<any>(null);
  const tokenClientGoogleAds = useRef<any>(null);
  
  useEffect(() => {
    localStorage.setItem('google_ads_developer_token', developerToken);

    // Re-fetch Google Ads customers when the developer token or auth changes,
    // but debounced so it doesn't fire once per keystroke while typing.
    if (!googleAdsAuth?.token) return;
    const handle = setTimeout(() => {
      if (!isLoadingGoogleAds) {
        fetchGoogleAdsCustomers(googleAdsAuth.token);
      }
    }, 800);
    return () => clearTimeout(handle);
  }, [developerToken, googleAdsAuth?.token]);

  // Initial data loading for account lists on mount or when auth is restored from sessionStorage
  useEffect(() => {
    if (ga4Auth?.token && availableProperties.length === 0) {
      fetchGa4Properties(ga4Auth.token);
    }
  }, [ga4Auth?.token]);

  useEffect(() => {
    if (gscAuth?.token && availableSites.length === 0) {
      fetchGscSites(gscAuth.token);
    }
  }, [gscAuth?.token]);

  const handleManualRefresh = () => {
    fetchBridgeData();
  };

  const isBranded = (text: string) => {
    if (!text || text.trim() === '') return false;
    try {
      const regex = new RegExp(brandRegexStr, 'i');
      return regex.test(text.trim().toLowerCase());
    } catch (e) { return false; }
  };
  
  const getComparisonDates = () => {
    const start = parseLocalDate(filters.dateRange.start);
    const end = parseLocalDate(filters.dateRange.end);
    
    if (filters.comparison.type === 'previous_period') {
      // Same number of days, ending the day before the current range starts.
      const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
      const compEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1);
      const compStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() - days);
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
        setError(null);
        setIsLoadingGoogleAds(true);
        const tokenToUse = (developerToken || '').trim() || DEVELOPER_TOKEN;
        const resp = await fetch('/api/googleads/v25/customers:listAccessibleCustomers', {
            method: 'GET',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'developer-token': tokenToUse
            }
        });
        
        if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            let errMsg = errData.error?.message || `Google Ads Status: ${resp.status}`;
            
            // Check for specific DEVELOPER_TOKEN_PROHIBITED error
            const errors = errData.error?.details?.[0]?.errors;
            if (errors?.some((e: any) => e.errorCode?.authorizationError === 'DEVELOPER_TOKEN_PROHIBITED')) {
                errMsg = "The Developer Token is not allowed for the Google Cloud project of the OAuth Client ID in use. Check that the token has 'Basic' or 'Standard' access and that the Client ID in Settings belongs to the project paired with this token.";
            }
            
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
    try {
      // Use a single query to get ALL leaf accounts (non-managers) in the hierarchy
      // This is much more efficient than a BFS crawl
      // We remove the hidden=false and manager=false filters to see if that helps in complex hierarchies
      // and we will filter in the code
      const query = `
        SELECT 
          customer_client.id, 
          customer_client.descriptive_name, 
          customer_client.resource_name,
          customer_client.manager,
          customer_client.status,
          customer_client.level,
          customer_client.hidden
        FROM customer_client
        WHERE customer_client.status = 'ENABLED'
      `.trim();
      
      const targetUrl = `/api/googleads/v25/customers/${managerId}/googleAds:search`;
      const resp = await fetch(targetUrl, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json',
          'developer-token': (developerToken || '').trim() || DEVELOPER_TOKEN,
          'login-customer-id': managerId 
        },
        body: JSON.stringify({ query })
      });
      
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        const errors = errData.error?.details?.[0]?.errors;
        if (errors?.some((e: any) => e.errorCode?.authorizationError === 'DEVELOPER_TOKEN_PROHIBITED')) {
            throw new Error("The Developer Token is not allowed for the Google Cloud project of the OAuth Client ID in use. It needs 'Basic' or 'Standard' access.");
        }
        throw new Error(errData.error?.message || `Status: ${resp.status}`);
      }
      
      const json = await resp.json();
      const results = json.results || [];
      
      // Filter for non-managers and non-hidden accounts
      let allLeafAccounts: GoogleAdsCustomer[] = results
        .filter((row: any) => row.customerClient && !row.customerClient.manager && !row.customerClient.hidden)
        .map((row: any) => {
          const client = row.customerClient;
          return {
            id: String(client.id),
            descriptiveName: client.descriptiveName || `Account ${client.id}`,
            resourceName: client.resourceName
          };
        });
      
      // Deduplicate by ID
      const uniqueLeafAccounts = allLeafAccounts.filter((acc, index, self) => 
          index === self.findIndex((t) => t.id === acc.id)
      );
      
      if (uniqueLeafAccounts.length === 0) {
          setAvailableGoogleAdsSubAccounts([{
              id: managerId,
              descriptiveName: 'MCC / Selected Account',
              resourceName: `customers/${managerId}`
          }]);
      } else {
          setAvailableGoogleAdsSubAccounts(uniqueLeafAccounts);
      }
      
    } catch (e: any) {
      console.error("Error fetching Google Ads hierarchy:", e);
      setError(`Hierarchy Error: ${e.message}`);
      // Fallback
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
        setAiTrafficData([]);
        setError(`AI Traffic: ${e.message || 'GA4 request failed'}`);
    } finally {
        setIsLoadingAi(false);
    }
  };

  // --- BRIDGE DATA: GA4 SESSIONS (ORGANIC vs PAID) ---
  // UPDATED: New granular logic with URL+Keyword
  const fetchBridgeData = async () => {
    setIsLoadingBridge(true);
    setLoadingProgress(0);
    
    // --- MOCK FALLBACK IF NOTHING CONNECTED ---
    if (!gscAuth?.token && !ga4Auth?.token && !googleAdsAuth?.token) {
        if (!bridgeDataGA4.length) setBridgeDataGA4(generateMockBridgeData());
        if (!bridgeDataGoogleAds.length) setBridgeDataGoogleAds(generateMockBridgeData());
        if (!keywordSignals.length) setKeywordSignals(generateMockKeywordSignals());
        setIsLoadingBridge(false);
        return;
    }
    
    
    // 0. FETCH GA4 ORGANIC SESSIONS (Per URL)
    const ga4OrganicMap: Record<string, { sessions: number, transactions: number }> = {};
    if (ga4Auth?.property && ga4Auth.token) {
        try {
            const ga4OrgResp = await fetch(`https://analyticsdata.googleapis.com/v1beta/${ga4Auth.property.id}:runReport`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${ga4Auth.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dateRanges: [{ startDate: filters.dateRange.start, endDate: filters.dateRange.end }],
                    dimensions: [{ name: 'landingPage' }],
                    metrics: [{ name: 'sessions' }, { name: 'transactions' }],
                    dimensionFilter: {
                        filter: {
                            fieldName: 'sessionDefaultChannelGroup',
                            stringFilter: { matchType: 'EXACT', value: 'Organic Search', caseSensitive: false }
                        }
                    },
                    limit: 100000
                })
            });
            const ga4OrgData = await ga4OrgResp.json();
            (ga4OrgData.rows || []).forEach((row: any) => {
                const path = normalizeUrl(row.dimensionValues[0].value);
                const sessions = parseInt(row.metricValues[0].value) || 0;
                const transactions = parseFloat(row.metricValues[1].value) || 0;
                if (!ga4OrganicMap[path]) {
                    ga4OrganicMap[path] = { sessions: 0, transactions: 0 };
                }
                ga4OrganicMap[path].sessions += sessions;
                ga4OrganicMap[path].transactions += transactions;
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
    setWarning('gscBridge', null);
    gscQueryTotals.current = {};
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
                if (gscDataRaw.error) throw new Error(gscResp.status === 401 ? 'session expired, reconnect Search Console in Settings' : gscDataRaw.error.message);
                const rows = gscDataRaw.rows || [];
                
                rows.forEach((row: any) => {
                    const fullUrl = row.keys[0];
                    const query = row.keys[1];
                    const clicks = row.clicks;
                    const impressions = row.impressions;
                    const rank = row.position;
                    const cleanPath = normalizeUrl(fullUrl);

                    const queryKey = String(query).toLowerCase().trim();
                    const queryTotal = gscQueryTotals.current[queryKey] || (gscQueryTotals.current[queryKey] = { clicks: 0, impressions: 0, weightedRankSum: 0 });
                    queryTotal.clicks += clicks;
                    queryTotal.impressions += impressions;
                    queryTotal.weightedRankSum += rank * impressions;
                    
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
                if (i === 3) {
                    setWarning('gscBridge', 'Search Console: URL and keyword joins use the top 100,000 page and query rows for the period. Long-tail queries beyond that are not included.');
                }
            }
            
            Object.values(gscUrlMap).forEach(item => {
                item.queries.sort((a,b) => b.clicks - a.clicks);
            });
        } catch (e: any) {
            console.error("GSC Data Fetch Error:", e);
            setWarning('gscBridge', `Search Console data for the SEO and PPC join could not be read (${e?.message || 'request failed'}). Organic rank and clicks are missing.`);
        }
    }
    
    // 2. TRY GOOGLE ADS FETCH (If Available & Selected)
    if (googleAdsAuth?.token && activeAdsAccounts.length > 0) {
         const googleAdsPaidMap: Record<string, { clicksOrSessions: number, conversions: number, cost: number, impressions: number, campaigns: Set<string> }> = {};
         
         // NEW: Granular map with URL||KEYWORD key for specific cost per URL
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
           AND metrics.clicks > 0
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
            AND metrics.clicks > 0
         `;

         // Query 3: Customer-level metrics (The most accurate "Overview" total)
         const googleAdsCustomerQuery = `
            SELECT 
              segments.date,
              metrics.cost_micros, 
              metrics.clicks, 
              metrics.impressions, 
              metrics.conversions 
            FROM customer
            WHERE segments.date BETWEEN '${filters.dateRange.start}' AND '${filters.dateRange.end}'
         `;
         
         // Accounts whose requests failed, so the user is told the paid figures are incomplete.
         const adsFailures = new Map<string, string>();
         setWarning('ads', null);

         const fetchGoogleAds = async (query: string, targetId: string) => {
            if (!googleAdsAuth?.token) {
                throw new Error("Google Ads token is missing");
            }
            
            const headers: any = { 
                Authorization: `Bearer ${googleAdsAuth.token}`, 
                'Content-Type': 'application/json',
                'developer-token': (developerToken || '').trim() || DEVELOPER_TOKEN
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

                    const res = await fetch(`/api/googleads/v25/customers/${cleanTargetId}/googleAds:search`, {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify(body)
                    });
                    
                    if (!res.ok) {
                        const errData = await res.json().catch(() => ({}));
                        const errors = errData.error?.details?.[0]?.errors;
                        let reason = errData.error?.message || `status ${res.status}`;
                        if (res.status === 401) reason = 'session expired, reconnect Google Ads in Settings';
                        else if (errors?.some((e: any) => e.errorCode?.authorizationError === 'DEVELOPER_TOKEN_PROHIBITED')) reason = "the Developer Token needs 'Basic' or 'Standard' access";
                        console.error(`Google Ads API Error for ${targetId}:`, errData);
                        adsFailures.set(cleanTargetId, reason);
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
            } catch (err: any) {
                console.error(`Fetch error for ${targetId}:`, err);
                adsFailures.set(cleanTargetId, err?.message || 'network error');
            }

            return allResults;
         };
         
         try {
            let accountsToFetch: string[] = [];
            let globalAvgCpc = 0;
            const isAllAccounts = true; // Always true since we removed sub-account selection
            
            // 1. ALWAYS FETCH GLOBAL TOTALS (Customer Level)
            // This ensures scorecards always show "Overall" data regardless of selection
            const allAccountIds = activeAdsAccounts.map(acc => acc.id);

            let globalMetrics: GoogleAdsGlobalMetrics = {
                totalCost: 0,
                totalClicks: 0,
                totalConversions: 0,
                totalImpressions: 0,
                avgCpc: 0,
                avgCpa: 0
            };

            const adsDailyMap: Record<string, {date: string, impressions: number, label: 'current' | 'previous'}> = {};

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
                                const segments = row.segments;
                                const date = segments?.date;

                                const clicks = parseGoogleAdsMetric(metrics?.clicks || metrics?.clicks_val);
                                const costMicros = parseGoogleAdsMetric(metrics?.costMicros || metrics?.cost_micros);
                                const conversions = parseGoogleAdsMetric(metrics?.conversions || metrics?.conversions_val);
                                const impressions = parseGoogleAdsMetric(metrics?.impressions || metrics?.impressions_val);

                                globalMetrics.totalCost += costMicros / 1000000;
                                globalMetrics.totalClicks += clicks;
                                globalMetrics.totalConversions += conversions;
                                globalMetrics.totalImpressions += impressions;

                                if (date) {
                                    if (!adsDailyMap[date]) {
                                        adsDailyMap[date] = { date, impressions: 0, label: 'current' };
                                    }
                                    adsDailyMap[date].impressions += impressions;
                                }
                            }
                        }
                    });
                    setLoadingProgress(Math.round(((i + chunk.length) / (allAccountIds.length * 2)) * 100));
                }

                setGoogleAdsDailyTotals(Object.values(adsDailyMap));

                if (globalMetrics.totalClicks > 0) {
                    globalMetrics.avgCpc = globalMetrics.totalCost / globalMetrics.totalClicks;
                }
                if (globalMetrics.totalConversions > 0) {
                    globalMetrics.avgCpa = globalMetrics.totalCost / globalMetrics.totalConversions;
                }
                
                setGoogleAdsGlobalMetrics(globalMetrics);
                globalAvgCpc = globalMetrics.avgCpc; // Used for fallback
            }
            
            // 1. Process URLs for Bridge Data (source of truth for URL-level metrics)
            const googleAdsPaidMap: Record<string, { clicksOrSessions: number, conversions: number, cost: number, impressions: number, campaigns: Set<string> }> = {};
            
            // Measure 1 & 2: Parallelization and Filtering
            const chunkSize = 5; 
            for (let i = 0; i < allAccountIds.length; i += chunkSize) {
                const chunk = allAccountIds.slice(i, i + chunkSize);
                const results = await Promise.all(chunk.map(id => fetchGoogleAds(googleAdsUrlQuery, id)));
                
                results.forEach((accountUrlRows) => {
                    accountUrlRows.forEach((row: any) => {
                        const url = row.landingPageView?.unexpandedFinalUrl;
                        if (!url) return;
                        const path = normalizeUrl(url);
                        if (path) {
                            if (!googleAdsPaidMap[path]) {
                                googleAdsPaidMap[path] = { clicksOrSessions: 0, conversions: 0, cost: 0, impressions: 0, campaigns: new Set(['Google Ads']) };
                            }
                            const metrics = row.metrics;
                            const clicks = parseGoogleAdsMetric(metrics?.clicks || metrics?.clicks_val);
                            const costMicros = parseGoogleAdsMetric(metrics?.costMicros || metrics?.cost_micros);
                            const conversions = parseGoogleAdsMetric(metrics?.conversions || metrics?.conversions_val);
                            const impressions = parseGoogleAdsMetric(metrics?.impressions || metrics?.impressions_val);

                            googleAdsPaidMap[path].clicksOrSessions += clicks;
                            googleAdsPaidMap[path].conversions += conversions;
                            googleAdsPaidMap[path].impressions += impressions;
                            googleAdsPaidMap[path].cost += costMicros / 1000000;
                        }
                    });
                });
                setLoadingProgress(50 + Math.round(((i + chunk.length) / allAccountIds.length) * 50));
            }
            
            // BUILD GOOGLE ADS BRIDGE DATA
            const googleAdsResults: BridgeData[] = [];
            
            const allPaths = new Set([...Object.keys(gscUrlMap), ...Object.keys(googleAdsPaidMap)]);
            
            allPaths.forEach(path => {
                const gscData = gscUrlMap[path]; 
                const paidStats = googleAdsPaidMap[path];
                
                const organicStats = ga4OrganicMap[path] || { sessions: 0, transactions: 0 };
                const organicSessions = organicStats.sessions;
                const organicCvr = organicSessions > 0 ? (organicStats.transactions / organicSessions) * 100 : 0;
                const organicClicks = gscData ? gscData.totalClicks : 0;
                const organicRank = gscData && gscData.totalImpressions > 0 
                    ? gscData.weightedRankSum / gscData.totalImpressions 
                    : (gscData ? gscData.bestRank : null);
                
                const topQuery = gscData && gscData.queries.length > 0 ? gscData.queries[0].query : '(direct/none)';
                
                // Lazy Loading: We don't have paid keywords yet
                const topQueriesList = gscData ? gscData.queries.slice(0, 10).map(q => ({
                    query: q.query,
                    rank: q.rank,
                    clicks: q.clicks,
                    paidClicks: 0,
                    paidCost: 0
                })) : [];

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
                    organicTransactions: organicStats.transactions,
                    organicCvr: organicCvr,
                    ppcCampaign: "Google Ads", 
                    ppcCost: paidStats?.cost || 0, 
                    ppcConversions: paidStats?.conversions || 0, 
                    ppcCpa: paidStats?.conversions ? paidStats.cost / paidStats.conversions : 0,
                    ppcSessions: paidVolume, 
                    ppcImpressions: paidStats?.impressions || 0, 
                    searchImpressionShare: 0,
                    blendedCostRatio: paidShare, 
                    actionLabel: action, 
                    dataSource: 'GOOGLE_ADS',
                    gscTopQueries: topQueriesList
                });
            });

            setBridgeDataGoogleAds(googleAdsResults.sort((a, b) => b.blendedCostRatio - a.blendedCostRatio));
            if (adsFailures.size > 0) {
                setWarning('ads', `Google Ads: ${adsFailures.size} of ${allAccountIds.length} account${allAccountIds.length !== 1 ? 's' : ''} could not be read (${Array.from(adsFailures.values())[0]}). Spend, clicks and conversions are incomplete.`);
            }
            setIsGoogleAdsKeywordsLoaded(false); // Reset keywords
            setKeywordBridgeDataGoogleAds([]);
            setGlobalKeywordBridgeDataGoogleAds([]);
            setKeywordSignals([]);
         } catch (err: any) {
             console.error("Error fetching Google Ads data:", err);
             setError(err.message || "Failed to fetch Google Ads data");
             setBridgeDataGoogleAds([]);
             setKeywordBridgeDataGoogleAds([]);
             setKeywordSignals([]);
         }
    } else {
         setBridgeDataGoogleAds([]);
         setKeywordBridgeDataGoogleAds([]);
         setKeywordSignals([]);
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
                    metrics: [ { name: 'sessions' }, { name: 'transactions' } ],
                    limit: 100000 
                })
            });
            
            const ga4Data = await ga4Resp.json();
            (ga4Data.rows || []).forEach((row: any) => {
                const rawUrl = row.dimensionValues[0].value;
                const channelGroup = row.dimensionValues[1].value.toLowerCase();
                const campaignName = row.dimensionValues[2].value;
                const sessions = parseInt(row.metricValues[0].value) || 0;
                const transactions = parseFloat(row.metricValues[1].value) || 0;
                const path = normalizeUrl(rawUrl);
                
                if (isPaidSearch(channelGroup)) {
                    if (!ga4PaidMap[path]) ga4PaidMap[path] = { clicksOrSessions: 0, conversions: 0, cost: 0, impressions: 0, campaigns: new Set() };
                    ga4PaidMap[path].clicksOrSessions += sessions;
                    ga4PaidMap[path].conversions += transactions;
                    
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
                    metrics: [{ name: 'sessions' }, { name: 'transactions' }, { name: 'advertiserAdCost' }],
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
                 const transactions = (parseFloat(row.metricValues[1].value) || 0);
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
                 granularCompositeMap[key].paidConversions += transactions;
                 granularCompositeMap[key].paidCost += cost;
            });
            
            // BUILD GA4 BRIDGE DATA
            const ga4Results: BridgeData[] = [];
            const allPathsGA = new Set([...Object.keys(gscUrlMap), ...Object.keys(ga4PaidMap)]);
            
            allPathsGA.forEach(path => {
                const gscData = gscUrlMap[path];
                const paidStats = ga4PaidMap[path];
                
                const organicStats = ga4OrganicMap[path] || { sessions: 0, transactions: 0 };
                const organicSessions = organicStats.sessions;
                const organicCvr = organicSessions > 0 ? (organicStats.transactions / organicSessions) * 100 : 0;
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
                    organicTransactions: organicStats.transactions,
                    organicCvr: organicCvr,
                    ppcCampaign: campDisplay, 
                    ppcCost: 0, 
                    ppcConversions: paidStats?.conversions || 0, 
                    ppcCpa: 0,
                    ppcSessions: paidVolume, 
                    ppcImpressions: 0, 
                    searchImpressionShare: 0,
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
                    paidClicks: paidVol,
                    paidCtr: 0,
                    searchImpressionShare: 0,
                    paidConversions: item.paidConversions,
                    paidCta: item.paidConversions > 0 ? item.paidCost / item.paidConversions : 0,
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
  
  const fetchGoogleAdsKeywords = async () => {
    if (!googleAdsAuth?.token || isGoogleAdsKeywordsLoading || isGoogleAdsKeywordsLoaded || activeAdsAccounts.length === 0) return;
    
    setIsGoogleAdsKeywordsLoading(true);
    const allAccountIds = activeAdsAccounts.map(acc => acc.id);
    const googleAdsGlobalKeywordMap: Record<string, { clicks: number, conversions: number, cost: number, impressions: number }> = {};
    const googleAdsKeywordUrlMap: Record<string, { clicks: number, conversions: number, cost: number }> = {};
    
    const buildKwQuery = (withShares: boolean) => `
        SELECT
          ad_group_criterion.keyword.text,
          ad_group_criterion.final_urls,
          metrics.cost_micros,
          metrics.clicks,
          metrics.conversions,
          metrics.impressions${withShares ? `,
          metrics.search_impression_share,
          metrics.search_rank_lost_impression_share,
          metrics.search_top_impression_share` : ''}
        FROM keyword_view
        WHERE segments.date BETWEEN '${filters.dateRange.start}' AND '${filters.dateRange.end}'
        AND metrics.clicks > 0
    `;
    // Impression share tells how hard competitors push on each keyword.
    // If an account rejects those fields, the keyword load still works without them.
    const kwShareRows: Record<string, ShareRow[]> = {};
    let sharesUnavailable = false;
    const parseShare = (value: any): number | null => {
        if (value === undefined || value === null || value === '') return null;
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    };

    const kwFailures = new Map<string, string>();
    setWarning('adsKeywords', null);

    const fetchGoogleAds = async (query: string, targetId: string) => {
        const headers: any = { 
            Authorization: `Bearer ${googleAdsAuth.token}`, 
            'Content-Type': 'application/json',
            'developer-token': (developerToken || '').trim() || DEVELOPER_TOKEN
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
                if (nextPageToken) body.pageToken = nextPageToken;
                const res = await fetch(`/api/googleads/v25/customers/${cleanTargetId}/googleAds:search`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(body)
                });
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    kwFailures.set(cleanTargetId, res.status === 401 ? 'session expired, reconnect Google Ads in Settings' : (errData.error?.message || `status ${res.status}`));
                    break;
                }
                const json = await res.json();
                if (json.results) allResults.push(...json.results);
                nextPageToken = json.nextPageToken;
            } while (nextPageToken);
        } catch (err: any) {
            kwFailures.set(cleanTargetId, err?.message || 'network error');
        }
        return allResults;
    };

    try {
        const chunkSize = 5; 
        for (let i = 0; i < allAccountIds.length; i += chunkSize) {
            const chunk = allAccountIds.slice(i, i + chunkSize);
            const results = await Promise.all(chunk.map(async id => {
                const cleanId = id.toString().replace(/-/g, '');
                const rows = await fetchGoogleAds(buildKwQuery(true), id);
                if (!kwFailures.has(cleanId)) return rows;
                // Retry without impression share before reporting the account as failed.
                kwFailures.delete(cleanId);
                const basicRows = await fetchGoogleAds(buildKwQuery(false), id);
                if (!kwFailures.has(cleanId)) sharesUnavailable = true;
                return basicRows;
            }));
            
            results.forEach((accountKwRows) => {
                accountKwRows.forEach((row: any) => {
                    const kw = row.adGroupCriterion?.keyword?.text;
                    if (!kw) return;
                    const cleanKw = kw.toLowerCase().trim();
                    const metrics = row.metrics;
                    const clicks = parseGoogleAdsMetric(metrics?.clicks || metrics?.clicks_val);
                    const costMicros = parseGoogleAdsMetric(metrics?.costMicros || metrics?.cost_micros);
                    const conversions = parseGoogleAdsMetric(metrics?.conversions || metrics?.conversions_val);
                    const impressions = parseGoogleAdsMetric(metrics?.impressions || metrics?.impressions_val);
                    const cost = costMicros / 1000000;

                    if (!googleAdsGlobalKeywordMap[cleanKw]) {
                        googleAdsGlobalKeywordMap[cleanKw] = { clicks: 0, conversions: 0, cost: 0, impressions: 0 };
                    }
                    googleAdsGlobalKeywordMap[cleanKw].clicks += clicks;
                    googleAdsGlobalKeywordMap[cleanKw].conversions += conversions;
                    googleAdsGlobalKeywordMap[cleanKw].impressions += impressions;
                    googleAdsGlobalKeywordMap[cleanKw].cost += cost;

                    (kwShareRows[cleanKw] || (kwShareRows[cleanKw] = [])).push({
                        impressions,
                        impressionShare: parseShare(metrics?.searchImpressionShare),
                        rankLostShare: parseShare(metrics?.searchRankLostImpressionShare),
                        topImpressionShare: parseShare(metrics?.searchTopImpressionShare),
                    });

                    const finalUrls: string[] = row.adGroupCriterion?.finalUrls || row.adGroupCriterion?.final_urls || [];
                    if (Array.isArray(finalUrls) && finalUrls.length > 0) {
                        finalUrls.forEach(fUrl => {
                            const cleanPath = normalizeUrl(fUrl);
                            const key = `${cleanPath}||${cleanKw}`;
                            if (!googleAdsKeywordUrlMap[key]) {
                                googleAdsKeywordUrlMap[key] = { clicks: 0, conversions: 0, cost: 0 };
                            }
                            googleAdsKeywordUrlMap[key].clicks += clicks;
                            googleAdsKeywordUrlMap[key].conversions += conversions;
                            googleAdsKeywordUrlMap[key].cost += cost;
                        });
                    }
                });
            });
        }

        // Now update the bridge data with the keywords
        setBridgeDataGoogleAds(prev => prev.map(item => {
            if (!item.gscTopQueries) return item;
            const urlPaidSessions = item.ppcSessions || 0;
            const urlPaidCost = item.ppcCost || 0;

            return {
                ...item,
                gscTopQueries: item.gscTopQueries.map(q => {
                    const cleanKw = q.query.toLowerCase().trim();
                    const compositeKey = `${item.url}||${cleanKw}`;
                    let paidVol = 0;
                    let paidCost = 0;

                    if (urlPaidSessions > 0) {
                        const directUrlKw = googleAdsKeywordUrlMap[compositeKey];
                        if (directUrlKw) {
                            paidVol = directUrlKw.clicks;
                            paidCost = directUrlKw.cost;
                        } else {
                            const paidKwData = googleAdsGlobalKeywordMap[cleanKw];
                            if (paidKwData && paidKwData.clicks > 0) {
                                paidVol = Math.min(paidKwData.clicks, urlPaidSessions);
                                const avgCpc = paidKwData.cost / paidKwData.clicks;
                                paidCost = Math.min(paidVol * avgCpc, urlPaidCost);
                            }
                        }
                    }

                    return {
                        ...q,
                        paidClicks: paidVol,
                        paidCost: paidCost
                    };
                })
            };
        }));

        // Build Keyword Results for Search Efficiency
        const googleAdsKwResults: KeywordBridgeData[] = [];
        // We use bridgeDataGoogleAds as the source of URLs
        bridgeDataGoogleAds.forEach(item => {
            if (!item.gscTopQueries) return;
            const urlPaidSessions = item.ppcSessions || 0;
            const urlPaidCost = item.ppcCost || 0;

            item.gscTopQueries.forEach(q => {
                const cleanKw = q.query.toLowerCase().trim();
                const compositeKey = `${item.url}||${cleanKw}`;
                let paidVol = 0;
                let paidCost = 0;
                let paidConversions = 0;

                if (urlPaidSessions > 0) {
                    const directUrlKw = googleAdsKeywordUrlMap[compositeKey];
                    if (directUrlKw) {
                        paidVol = directUrlKw.clicks;
                        paidCost = directUrlKw.cost;
                        paidConversions = directUrlKw.conversions;
                    } else {
                        const paidKwData = googleAdsGlobalKeywordMap[cleanKw];
                        if (paidKwData && paidKwData.clicks > 0) {
                            paidVol = Math.min(paidKwData.clicks, urlPaidSessions);
                            const avgCpc = paidKwData.cost / paidKwData.clicks;
                            paidCost = Math.min(paidVol * avgCpc, urlPaidCost);
                            paidConversions = paidKwData.conversions;
                        }
                    }
                }

                if (paidVol > 0 || q.clicks > 0) {
                    const cvr = paidVol > 0 ? (paidConversions / paidVol) * 100 : 0;
                    const avgCpc = paidVol > 0 ? paidCost / paidVol : (googleAdsGlobalMetrics?.avgCpc || 0);

                    googleAdsKwResults.push({
                        url: item.url,
                        keyword: q.query,
                        organicClicks: q.clicks,
                        organicRank: q.rank,
                        paidSessions: paidVol,
                        ppcCost: paidCost,
                        paidCvr: cvr,
                        avgCpc: avgCpc,
                        paidClicks: paidVol,
                        paidCtr: 0,
                        searchImpressionShare: 0,
                        paidConversions: paidConversions,
                        paidCta: paidConversions > 0 ? paidCost / paidConversions : 0,
                        actionLabel: q.rank <= 3 && paidVol > 0 ? "REVIEW" : "MAINTAIN",
                        dataSource: 'GOOGLE_ADS'
                    });
                }
            });
        });

        // Build Global Aggregate for Exact Match View
        const globalKwBridgeMap: Record<string, any> = {};
        googleAdsKwResults.forEach(item => {
            const cleanKw = item.keyword.toLowerCase().trim();
            if (!globalKwBridgeMap[cleanKw]) {
                globalKwBridgeMap[cleanKw] = { ...item, organicRankSum: 0, organicRankCount: 0, organicClicks: 0, paidSessions: 0, ppcCost: 0 };
                delete globalKwBridgeMap[cleanKw].url;
            }
            globalKwBridgeMap[cleanKw].organicClicks += item.organicClicks;
            globalKwBridgeMap[cleanKw].paidSessions = item.paidSessions;
            globalKwBridgeMap[cleanKw].ppcCost = item.ppcCost;
            if (item.organicRank !== null) {
                globalKwBridgeMap[cleanKw].organicRankSum += item.organicRank;
                globalKwBridgeMap[cleanKw].organicRankCount += 1;
            }
        });

        const finalGlobalKwResults = Object.values(globalKwBridgeMap).map((item: any) => {
            const avgRank = item.organicRankCount > 0 ? item.organicRankSum / item.organicRankCount : null;
            return {
                ...item,
                organicRank: avgRank,
                actionLabel: avgRank !== null && avgRank <= 3 && item.paidSessions > 0 ? "REVIEW" : "MAINTAIN"
            };
        });

        // One row per paid keyword, joined to the same query text in Search Console.
        const signals: KeywordSignal[] = Object.entries(googleAdsGlobalKeywordMap).map(([kw, paid]) => {
            const organic = gscQueryTotals.current[kw];
            return {
                keyword: kw,
                isBrand: false, // set in the view, the brand regex can change after loading
                cost: paid.cost,
                paidClicks: paid.clicks,
                paidImpressions: paid.impressions,
                paidConversions: paid.conversions,
                ...combineShares(kwShareRows[kw] || []),
                organicRank: organic && organic.impressions > 0 ? organic.weightedRankSum / organic.impressions : null,
                organicClicks: organic?.clicks || 0,
                organicImpressions: organic?.impressions || 0,
            };
        });
        setKeywordSignals(signals);
        setWarning('adsShares', sharesUnavailable ? 'Google Ads: impression share could not be read for some accounts. Competitive pressure is treated as medium on their keywords, so reductions are more cautious.' : null);

        setKeywordBridgeDataGoogleAds(googleAdsKwResults.sort((a, b) => b.paidSessions - a.paidSessions));
        setGlobalKeywordBridgeDataGoogleAds(finalGlobalKwResults.sort((a, b) => b.paidSessions - a.paidSessions));
        setIsGoogleAdsKeywordsLoaded(true);
        if (kwFailures.size > 0) {
            setWarning('adsKeywords', `Google Ads keywords: ${kwFailures.size} of ${allAccountIds.length} account${allAccountIds.length !== 1 ? 's' : ''} could not be read (${Array.from(kwFailures.values())[0]}). Keyword-level paid data is incomplete.`);
        }
    } catch (err: any) {
        console.error("Error fetching Google Ads keywords:", err);
        setWarning('adsKeywords', `Google Ads keywords could not be processed (${err?.message || 'unexpected error'}).`);
        // Mark as attempted so the loader does not retry in a loop and burn API quota.
        setIsGoogleAdsKeywordsLoaded(true);
    } finally {
        setIsGoogleAdsKeywordsLoading(false);
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
      
      setWarning('ga4', null);
      const ga4Data = await ga4RunReportAll(ga4Auth.token, ga4Auth.property.id, {
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
          { name: 'itemsAddedToCart' },
          { name: 'itemsCheckedOut' }
        ],
      }, { maxRows: 300000 });
      if (ga4Data.truncated) {
        setWarning('ga4', `GA4: loaded ${ga4Data.rows.length.toLocaleString()} of ${(ga4Data.totalRows || 0).toLocaleString()} rows. Sessions and revenue are understated. Use a shorter date range.`);
      }
      
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
          conversionRate: (parseInt(row.metricValues[0].value) || 0) > 0 ? (parseFloat(row.metricValues[2].value) / parseInt(row.metricValues[0].value)) * 100 : 0,
          addToCarts: parseInt(row.metricValues[3].value) || 0,
          checkouts: parseInt(row.metricValues[4].value) || 0,
          clicks: 0, impressions: 0, ctr: 0
        };
      });
      
      setRealDailyData(dailyMapped);
      
    } catch (err: any) {
      console.error("Error fetching GA4:", err);
      setError(`GA4 Error: ${err.message}`);
      if (isAuthExpired(err)) { setGa4Auth(null); sessionStorage.removeItem('ga4_auth'); }
    } finally {
      setIsLoadingGa4(false);
    }
  };
  
  // Trigger Keyword Fetch for Google Ads when entering relevant tabs
  useEffect(() => {
    if ((activeTab === DashboardTab.SUMMARY || activeTab === DashboardTab.ORGANIC_VS_PAID || activeTab === DashboardTab.PPC_SEO_BRIDGE || activeTab === DashboardTab.SEARCH_EFFICIENCY || activeTab === DashboardTab.GOOGLE_ADS_PERFORMANCE) && 
        googleAdsAuth?.token && 
        !isGoogleAdsKeywordsLoaded && 
        !isGoogleAdsKeywordsLoading &&
        activeAdsAccounts.length > 0) {
      fetchGoogleAdsKeywords();
    }
  }, [activeTab, isGoogleAdsKeywordsLoaded, isGoogleAdsKeywordsLoading, googleAdsAuth, activeAdsAccountsKey]);

  const fetchGscData = async () => {
    if (!gscAuth?.site || !gscAuth.token) return;
    
    setIsLoadingGsc(true);
    try {
      const siteUrl = gscAuth.site.siteUrl;
      const gscToken = gscAuth.token;
      let keywordsTruncated = false;
      setWarning('gsc', null);
      
      const fetchOneRange = async (start: string, end: string, label: 'current' | 'previous') => {
        // Totals by day and country. Without an explicit row limit Search Console returns only 1,000 rows,
        // which understates clicks and impressions on sites with traffic from many countries.
        const dataTotals = await gscQueryAll(gscToken, siteUrl, {
          startDate: start,
          endDate: end,
          dimensions: ['date', 'country'],
        }, { maxRows: 200000 });
        
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
        
        const granular = await gscQueryAll(gscToken, siteUrl, {
          startDate: start,
          endDate: end,
          dimensions: ['query', 'page', 'date', 'country'],
        }, { maxRows: 50000 });
        const allGranularRows = granular.rows;
        if (granular.truncated) keywordsTruncated = true;
        
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
      if (keywordsTruncated) {
        setWarning('gsc', 'Search Console: keyword tables show the top 50,000 query rows for the period. Totals are complete; keyword and branded splits are partial. Use a shorter date range for full detail.');
      }
    } catch (err: any) {
      console.error(err);
      setError(`GSC Error: ${err.message}`);
      if (isAuthExpired(err)) { setGscAuth(null); sessionStorage.removeItem('gsc_auth'); }
    } finally {
      setIsLoadingGsc(false);
    }
  };
  
  useEffect(() => {
    const bridgeParams = `${ga4Auth?.property?.id}-${gscAuth?.site?.siteUrl}-${selectedGoogleAdsCustomer?.id}-${activeAdsAccountsKey}-${(developerToken || '').trim()}-${filters.dateRange.start}-${filters.dateRange.end}`;
    const aiParams = `${ga4Auth?.property?.id}-${filters.dateRange.start}-${filters.dateRange.end}`;

    if (activeTab === DashboardTab.SUMMARY || activeTab === DashboardTab.ORGANIC_VS_PAID || activeTab === DashboardTab.PPC_SEO_BRIDGE || activeTab === DashboardTab.GOOGLE_ADS_PERFORMANCE || activeTab === DashboardTab.SEARCH_EFFICIENCY) {
      if (bridgeParams !== lastBridgeFetchParams.current) {
        lastBridgeFetchParams.current = bridgeParams;
        fetchBridgeData();
      }
    } else if (activeTab === DashboardTab.AI_TRAFFIC_MONITOR) {
      if (aiParams !== lastAiFetchParams.current) {
        lastAiFetchParams.current = aiParams;
        fetchAiTrafficData();
      }
    }
  }, [
    activeTab, 
    ga4Auth?.property?.id, 
    gscAuth?.site?.siteUrl, 
    selectedGoogleAdsCustomer?.id,
    activeAdsAccountsKey,
    developerToken,
    filters.dateRange.start,
    filters.dateRange.end
  ]);
  
  useEffect(() => {
    const initializeOAuth = () => {
      if (typeof window !== 'undefined' && (window as any).google && (window as any).google.accounts) {
        tokenClientGa4.current = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: DEFAULT_CLIENT_ID,
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
          client_id: DEFAULT_CLIENT_ID,
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
      } else { 
        setTimeout(initializeOAuth, 500); 
      }
    };
    initializeOAuth();
  }, []);

  // Google Ads uses its own OAuth Client ID, configurable per client, because the
  // developer token is permanently paired to whichever Cloud project the Client ID
  // belongs to. Re-initializes whenever the client picks a different Client ID.
  useEffect(() => {
    localStorage.setItem('google_ads_client_id', googleAdsClientId);
    const clientIdToUse = agencyAds.oauthClientId || (googleAdsClientId || '').trim() || DEFAULT_CLIENT_ID;

    const initializeGoogleAdsOAuth = () => {
      if (typeof window !== 'undefined' && (window as any).google && (window as any).google.accounts) {
        tokenClientGoogleAds.current = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: clientIdToUse,
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
        setTimeout(initializeGoogleAdsOAuth, 500);
      }
    };
    initializeGoogleAdsOAuth();
  }, [googleAdsClientId, agencyAds.oauthClientId]);
  
  const handleLoginSuccess = (credentialToken: string) => {
    try {
      const base64Url = credentialToken.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = JSON.parse(atob(base64));
      const newUser = { name: decoded.name, email: decoded.email, picture: decoded.picture };
      setUser(newUser);
      localStorage.setItem('seo_suite_user', JSON.stringify(newUser));
      // Automatically open settings after successful login
      setIsSettingsOpen(true);
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
    if (accessSession.status === 'protected') window.location.href = '/cdn-cgi/access/logout';
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
    const organic = aggregateData(filteredDailyData.filter(d => isOrganicSearch(d.channel)));
    const paid = aggregateData(filteredDailyData.filter(d => isPaidSearch(d.channel)));
    
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
  
  const periodDays = Math.round((parseLocalDate(filters.dateRange.end).getTime() - parseLocalDate(filters.dateRange.start).getTime()) / 86400000) + 1;
  const periodLabel = `${filters.dateRange.start} to ${filters.dateRange.end}`;
  const clientName = activeProfile?.name || (gscAuth?.site?.siteUrl || '').replace(/^sc-domain:/, '').replace(/^https?:\/\//, '').replace(/\/$/, '') || ga4Auth?.property?.name || '';
  const summaryRecs = useMemo(
    () => buildRecommendations(keywordSignals, isBranded, filters.queryType, periodDays, recommendationSettings),
    [keywordSignals, brandRegexStr, filters.queryType, periodDays, recommendationSettings]
  );

  const SAMPLE_BRIDGE_TABS = [DashboardTab.SUMMARY, DashboardTab.PPC_SEO_BRIDGE, DashboardTab.GOOGLE_ADS_PERFORMANCE, DashboardTab.SEARCH_EFFICIENCY];
  const nothingConnected = !gscAuth?.token && !ga4Auth?.token && !googleAdsAuth?.token;
  const isShowingSampleData =
    (SAMPLE_BRIDGE_TABS.includes(activeTab) && nothingConnected && (bridgeDataGA4.length > 0 || bridgeDataGoogleAds.length > 0)) ||
    (activeTab === DashboardTab.AI_TRAFFIC_MONITOR && !ga4Auth?.property && aiTrafficData.length > 0);

  const isAnythingLoading = isLoadingGa4 || isLoadingGsc || isLoadingBridge || isLoadingAi || isLoadingGoogleAds;
  
  useEffect(() => { 
    localStorage.setItem('ai_provider', aiProvider); 
  }, [aiProvider]);

  useEffect(() => {
    localStorage.setItem('brand_regex', brandRegexStr);
  }, [brandRegexStr]);
  
  useEffect(() => { 
    localStorage.setItem('openai_api_key', openaiKey); 
  }, [openaiKey]);
  
  if (!user && accessSession.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex flex-col md:flex-row overflow-hidden">
        {/* Left Side: Dark Background with Content */}
        <div className="hidden md:flex flex-1 bg-black text-white p-16 flex-col justify-between">
            <div className="space-y-6">
                <h1 className="text-5xl font-black leading-tight tracking-tighter">
                  One Search is a unified search methodology developed by Jellyfish that integrates Paid Search (PPC) and Organic Search (SEO) into a single, cohesive strategy.
                </h1>
            </div>
            
            <div className="space-y-8">
              <div className="flex gap-6 items-center opacity-60">
                {/* Simulated Logos/Icons as per image */}
                <div className="text-2xl">G✦</div>
                <div className="text-2xl">O</div>
                <div className="text-2xl">✻</div>
                <div className="text-2xl">✱</div>
                <div className="text-2xl">✧</div>
                <div className="text-2xl">Ⓜ</div>
              </div>
              <p className="text-slate-500 font-medium">© 2026 Jellyfish. All rights reserved.</p>
            </div>
        </div>

        {/* Right Side: Login Options */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white">
          <div className="w-full max-w-sm space-y-8">
            <div className="text-center flex flex-col items-center gap-3">
               <img src="/logo.png" alt="OneSearch Logo" className="w-16 h-16 rounded-2xl object-cover" />
               <span className="text-xl font-black tracking-tight">OneSearch™</span>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-center"><GoogleLogin onLoginSuccess={handleLoginSuccess} /></div>
            </div>
            
            <p className="text-xs text-slate-500 text-center">
                Don't have an account or trouble logging in? <a href="#" className="font-bold text-black underline">Contact</a>
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col md:flex-row">
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
        className={`xl:hidden print:hidden fixed bottom-6 right-6 z-50 p-4 bg-slate-950 text-white rounded-full shadow-2xl active:scale-95 transition-transform ${clientView ? 'hidden' : ''}`}
      >
        {isSidebarOpen ? <X /> : <Menu />}
      </button>
      
      {isSidebarOpen && !clientView && <div className="fixed inset-0 bg-black/50 z-40 xl:hidden print:hidden" onClick={() => setIsSidebarOpen(false)} />}
      
      <Sidebar 
        isOpen={isSidebarOpen && !clientView} 
        setIsOpen={setIsSidebarOpen}
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        user={user} 
        handleLogout={handleLogout}
        setIsSettingsOpen={setIsSettingsOpen}
        clients={clientProfiles.available ? clientProfiles.clients : []}
        activeClientId={activeProfile?.id || null}
        onSelectClient={handleSelectClientProfile}
      />
      
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        handleLogout={handleLogout}
        aiProvider={aiProvider} 
        setAiProvider={setAiProvider}
        openaiKey={openaiKey} 
        setOpenaiKey={setOpenaiKey}
        developerToken={developerToken}
        setDeveloperToken={setDeveloperToken}
        googleAdsClientId={googleAdsClientId}
        setGoogleAdsClientId={setGoogleAdsClientId}
        developerTokenManaged={agencyAds.developerTokenOnServer}
        developerTokenWaitingForAccess={agencyAds.developerTokenWaitingForAccess}
        oauthClientIdManaged={Boolean(agencyAds.oauthClientId)}
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
        googleAdsSubAccounts={availableGoogleAdsSubAccounts}
        pinnedGoogleAdsAccountIds={activeAdsAccounts.map(a => a.id)}
        onPinnedGoogleAdsAccountsChange={handlePinnedAdsAccountsChange}
        googleAdsClientLabel={clientName}
        recommendationRulesPanel={
          <RecommendationRulesPanel
            settings={recommendationSettings}
            onChange={overrides => setRulesForClient(adsClientKey, overrides)}
            clientLabel={clientName}
            sharedProfilesAvailable={clientProfiles.available}
          />
        }
        clientProfilePanel={
          <ClientProfilePanel
            available={clientProfiles.available}
            unavailableReason={clientProfiles.reason}
            profiles={clientProfiles.clients}
            activeProfile={activeProfile}
            current={buildCurrentProfileInput()}
            onSave={handleSaveClientProfile}
            onDelete={handleDeleteClientProfile}
            onSelect={handleSelectClientProfile}
          />
        }
        setGa4Auth={setGa4Auth} 
        setGscAuth={setGscAuth} 
        setGoogleAdsAuth={setGoogleAdsAuth}
        filteredProperties={filteredProperties} 
        filteredSites={filteredSites} 
        filteredGoogleAdsCustomers={filteredGoogleAdsCustomers}
      />
      
      <main className={`flex-1 transition-all duration-300 ease-in-out p-5 md:p-8 xl:p-12 overflow-x-hidden print:ml-0 print:p-0 ${isSidebarOpen && !clientView ? 'xl:ml-60' : 'ml-0'}`}>
        <header className="flex flex-col gap-6 mb-10">
          <div className="flex items-center gap-6">
            <div className={`items-center gap-2 print:flex ${isSidebarOpen && !clientView ? 'hidden' : 'flex'}`}>
              <img src="/logo.png" alt="OneSearch Logo" className="w-8 h-8 rounded-xl object-cover" />
              <h1 className="text-xl font-black text-slate-800 tracking-tighter">OneSearch</h1>
            </div>
            
            <div className={`h-6 w-px bg-slate-200 print:block ${isSidebarOpen && !clientView ? 'hidden' : 'block'}`} />                

            {!isSidebarOpen && !clientView && (
              <button 
                onClick={() => setIsSidebarOpen(true)} 
                className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-indigo-300 transition-all shadow-sm text-slate-600 hover:text-indigo-600 group" 
                title="Open menu"
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
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">{TAB_META[activeTab].title}</h2>
              <p className="text-sm font-medium text-slate-500 mt-1">
                {clientView ? [clientName, periodLabel].filter(Boolean).join(' · ') : TAB_META[activeTab].question}
              </p>
            </div>

            <div className="ml-auto flex items-center gap-2 print:hidden">
              <button
                onClick={() => setClientView(v => !v)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-colors ${clientView ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
                title="Hide menu, filters and settings to present this page"
              >
                <Presentation size={14} /> {clientView ? 'Exit client view' : 'Client view'}
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-white text-slate-600 border border-slate-200 hover:border-slate-400 transition-colors"
                title="Print this page or save it as PDF"
              >
                <Printer size={14} /> Print / PDF
              </button>
            </div>
          </div>
          
          <div className={`flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-4 w-full print:hidden ${clientView ? 'hidden' : 'flex'}`}>
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
              
              <div className="pl-1 pr-1.5 flex items-center">
                  <button 
                    onClick={handleManualRefresh}
                    disabled={isAnythingLoading}
                    className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black transition-all shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={isAnythingLoading ? 'animate-spin' : ''} />
                    {isAnythingLoading ? 'SYNCING...' : 'REFRESH'}
                  </button>
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
        
        {Object.keys(dataWarnings).length > 0 && (
          <div className="mb-8 p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 text-amber-900 shadow-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-black text-xs uppercase tracking-widest">Incomplete data</p>
              {Object.entries(dataWarnings).map(([key, message]) => (
                <p key={key} className="font-bold text-xs">{message}</p>
              ))}
            </div>
          </div>
        )}
        
        {accessSession.status === 'open' && (
          <div className="mb-8 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 shadow-sm print:hidden">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-black text-xs uppercase tracking-widest">Access is not restricted yet</p>
              <p className="font-bold text-xs">Anyone with a Google account can open this dashboard. Set up Cloudflare Access to limit it to @jellyfish.com (README, "Restricting access").</p>
            </div>
          </div>
        )}

        {isShowingSampleData && (
          <div className="mb-8 p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-center gap-3 text-amber-900 shadow-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="font-bold text-xs">
              Sample data. These figures are illustrative and do not belong to any client. Connect your sources in Settings to load real data.
            </p>
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
                    Generated by {aiProvider === 'openai' ? 'OpenAI' : 'Google Gemini'}
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
            <InsightsText text={tabInsights[activeTab as string] || ''} />
          </div>
        )}
        
        <div className="w-full">
          {activeTab === DashboardTab.SUMMARY && (
            <SummaryView
              recommendations={summaryRecs.recommendations}
              summary={summaryRecs.summary}
              channelStats={channelStats}
              globalMetrics={googleAdsGlobalMetrics}
              currencySymbol={currencySymbol}
              comparisonEnabled={filters.comparison.enabled}
              isLoading={isGoogleAdsKeywordsLoading || isLoadingBridge}
              onOpenRecommendations={() => setActiveTab(DashboardTab.SEARCH_EFFICIENCY)}
            />
          )}

          {activeTab === DashboardTab.ORGANIC_VS_PAID && (
            <OrganicVsPaidView 
              stats={channelStats} 
              data={filteredDailyData} 
              comparisonEnabled={filters.comparison.enabled} 
              grouping={grouping} 
              setGrouping={setGrouping} 
              currencySymbol={currencySymbol} 
              gscDailyTotals={gscDailyTotals}
              googleAdsDailyTotals={googleAdsDailyTotals}
              onFetchAdsData={fetchBridgeData}
              isAdsLoading={isLoadingBridge}
              onRefresh={handleManualRefresh}
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
              onRefresh={handleManualRefresh}
              isLoading={isAnythingLoading}
            />
          )}
          
          {activeTab === DashboardTab.KEYWORD_DEEP_DIVE && (
            <SeoDeepDiveView 
              keywords={filteredKeywordData} 
              searchTerm={searchTerm} 
              setSearchTerm={setSearchTerm} 
              isLoading={isAnythingLoading} 
              comparisonEnabled={filters.comparison.enabled} 
              onRefresh={handleManualRefresh}
            />
          )}
          
          {activeTab === DashboardTab.PPC_SEO_BRIDGE && (
            <SeoPpcBridgeView 
                ga4Data={bridgeDataGA4} 
                googleAdsData={bridgeDataGoogleAds}
                ga4KeywordData={keywordBridgeDataGA4}
                googleAdsKeywordData={globalKeywordBridgeDataGoogleAds.length > 0 ? globalKeywordBridgeDataGoogleAds : keywordBridgeDataGoogleAds}
                dailyData={filteredDailyData} 
                currencySymbol={currencySymbol} 
                availableGoogleAdsCustomers={availableGoogleAdsCustomers}
                selectedGoogleAdsCustomer={selectedGoogleAdsCustomer}
                onGoogleAdsCustomerChange={handleGoogleAdsCustomerChange}
                isGoogleAdsKeywordsLoading={isGoogleAdsKeywordsLoading}
                onRefresh={handleManualRefresh}
                isLoading={isAnythingLoading}
            />
          )}
          
          {activeTab === DashboardTab.GOOGLE_ADS_PERFORMANCE && (
              <GoogleAdsPerformanceView 
                  data={bridgeDataGoogleAds} 
                  currencySymbol={currencySymbol} 
                  globalMetrics={googleAdsGlobalMetrics}
                  onRefresh={handleManualRefresh}
                  isLoading={isAnythingLoading}
              />
          )}
          
          {activeTab === DashboardTab.SEARCH_EFFICIENCY && (
              <SearchEfficiencyView 
                 urlData={bridgeDataGoogleAds.length > 0 ? bridgeDataGoogleAds : bridgeDataGA4}
                 keywordData={keywordBridgeDataGoogleAds.length > 0 ? keywordBridgeDataGoogleAds : keywordBridgeDataGA4}
                 currencySymbol={currencySymbol}
                 globalMetrics={googleAdsGlobalMetrics}
                 totalGscClicks={gscTotals?.current?.clicks || 0}
                 isLoading={isGoogleAdsKeywordsLoading}
                 isBranded={isBranded}
                 onRefresh={handleManualRefresh}
                 queryTypeFilter={filters.queryType}
                 keywordSignals={keywordSignals}
                 periodDays={periodDays}
                 recommendationSettings={recommendationSettings}
                 clientName={clientName}
                 periodLabel={periodLabel}
              />
          )}
          
          {activeTab === DashboardTab.AI_TRAFFIC_MONITOR && (
            <AiTrafficView 
              data={aiTrafficData} 
              currencySymbol={currencySymbol} 
              onRefresh={handleManualRefresh}
              isLoading={isAnythingLoading}
            />
          )}
        </div>
        
        <div className={`mt-12 flex-col items-center gap-4 pb-12 print:hidden ${clientView || activeTab === DashboardTab.SUMMARY ? 'hidden' : 'flex'}`}>
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
          <div className="bg-white rounded-[32px] p-10 max-w-md w-full shadow-2xl text-center space-y-6 animate-in zoom-in-95">
            <div className="relative w-28 h-28 mx-auto">
              <div className="absolute inset-0 border-8 border-slate-100 rounded-full"></div>
              <div 
                className="absolute inset-0 border-8 border-indigo-600 rounded-full border-t-transparent animate-spin"
                style={{ animationDuration: '1.2s' }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center font-black text-xl text-slate-900">
                {loadingProgress}%
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight text-balance">Syncing campaigns</h3>
              <div className="space-y-4">
                <p className="text-slate-500 text-sm font-medium">
                  Processing <strong>{activeAdsAccounts.length} account{activeAdsAccounts.length !== 1 ? 's' : ''}</strong>.
                </p>
                
                {availableGoogleAdsSubAccounts.length === 1 && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-[10px] leading-relaxed text-left">
                    <p className="font-bold mb-1 flex items-center gap-1"><AlertCircle size={12} /> Expected more accounts?</p>
                    If this is an MCC with sub-accounts, make sure the Developer Token has <strong>Basic</strong> or <strong>Standard</strong> access. 
                    <strong>Test</strong> level tokens can only reach their own Google Cloud project.
                  </div>
                )}
                
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-50 py-2 rounded-lg">
                  Joining Google Ads + GSC + GA4
                </p>
              </div>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-indigo-600 h-full transition-all duration-700 ease-in-out"
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-slate-400 font-bold italic animate-pulse">Please keep this tab open...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
