
export enum DashboardTab {
  ORGANIC_VS_PAID = 'ORGANIC_VS_PAID',
  SEO_BY_COUNTRY = 'SEO_BY_COUNTRY',
  KEYWORD_DEEP_DIVE = 'KEYWORD_DEEP_DIVE',
  PPC_SEO_BRIDGE = 'PPC_SEO_BRIDGE',
  AI_TRAFFIC_MONITOR = 'AI_TRAFFIC_MONITOR',
  GOOGLE_ADS_PERFORMANCE = 'GOOGLE_ADS_PERFORMANCE',
  SEARCH_EFFICIENCY = 'SEARCH_EFFICIENCY'
}

export interface DateRange {
  start: string;
  end: string;
}

export interface ComparisonConfig {
  enabled: boolean;
  type: 'previous_period' | 'previous_year';
}

export interface DashboardFilters {
  dateRange: DateRange;
  comparison: ComparisonConfig;
  country: string;
  queryType: 'All' | 'Branded' | 'Non-Branded';
  ga4Dimension: string;
}

export type ChannelType = string;
export type QueryType = 'Branded' | 'Non-Branded';

export interface DailyData {
  date: string;
  channel: string;
  country: string;
  queryType: QueryType;
  landingPage: string;
  dateRangeLabel: 'current' | 'previous';
  sessions: number;
  revenue: number;
  sales: number;
  conversionRate: number;
  addToCarts: number;
  checkouts: number;
  clicks: number;
  impressions: number;
  ctr: number;
}

export interface KeywordData {
  keyword: string;
  landingPage: string;
  date: string;
  country: string;
  dateRangeLabel: 'current' | 'previous';
  clicks: number;
  impressions: number;
  ctr: number;
  position: number; // Added Position
  sessions: number;
  conversionRate: number;
  revenue: number;
  sales: number;
  addToCarts: number;
  checkouts: number;
  queryType: QueryType;
}

export interface Ga4Property {
  id: string;
  name: string;
}

export interface GscSite {
  siteUrl: string;
}

export interface GoogleAdsCustomer {
  resourceName: string;
  id: string;
  descriptiveName?: string;
  level?: number;
  isManager?: boolean;
}

export interface BridgeData {
  url: string;
  query: string; // Primary/Top query
  organicRank: number | null;
  organicClicks: number; // GSC Clicks
  organicSessions: number; // GA4 Sessions (Primary Organic Metric)
  organicTransactions: number; // GA4 Organic Transactions
  organicCvr: number; // GA4 Organic Conversion Rate
  ppcCampaign: string;
  ppcCost: number;
  ppcConversions: number;
  ppcCpa: number;
  ppcSessions: number; // Value depends on dataSource (GA4=Sessions, GoogleAds=Clicks)
  ppcImpressions: number;
  searchImpressionShare: number | null;
  blendedCostRatio: number;
  actionLabel: string;
  status?: string;
  ppcSourceMedium?: string;
  dataSource: 'GA4' | 'GOOGLE_ADS';
  gscTopQueries?: { query: string; rank: number; clicks: number; paidClicks?: number; paidCost?: number }[]; // NEW: Top 10 Queries
}

export interface KeywordBridgeData {
  keyword: string;
  url?: string;
  organicRank: number | null;
  organicClicks: number;
  paidSessions: number; // Value depends on dataSource
  paidCvr: number;
  ppcCost: number; // Added for Efficiency View
  avgCpc: number;  // Added for Efficiency View
  paidClicks: number; // Added
  paidCtr: number; // Added
  searchImpressionShare: number | null; // Added
  paidConversions: number; // Added
  paidCta: number; // Added
  actionLabel: string;
  dataSource: 'GA4' | 'GOOGLE_ADS'; 
}

export interface GoogleAdsGlobalMetrics {
  totalCost: number;
  totalClicks: number;
  totalConversions: number;
  totalImpressions: number;
  avgCpc: number;
  avgCpa: number;
}

export interface AiTrafficData {
  date: string;
  source: string;
  landingPage: string;
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
  revenue: number;
}
