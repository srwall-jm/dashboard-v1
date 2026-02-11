
export enum DashboardTab {
  ORGANIC_VS_PAID = 'ORGANIC_VS_PAID',
  SEO_BY_COUNTRY = 'SEO_BY_COUNTRY',
  KEYWORD_DEEP_DIVE = 'KEYWORD_DEEP_DIVE',
  PPC_SEO_BRIDGE = 'PPC_SEO_BRIDGE',
  AI_TRAFFIC_MONITOR = 'AI_TRAFFIC_MONITOR'
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

export interface Sa360Customer {
  resourceName: string;
  id: string;
  descriptiveName?: string;
}

export interface GoogleAdsCustomer {
  id: string;
  resourceName: string;
  name: string;
}

export interface BridgeData {
  url: string;
  query: string;
  organicRank: number | null;
  organicClicks: number; // GSC Clicks (Kept for reference/CTR context only)
  organicSessions: number; // GA4 Sessions (Primary Metric)
  ppcCampaign: string;
  ppcCost: number;
  ppcConversions: number;
  ppcCpa: number;
  ppcSessions: number; // GA4 Paid Sessions (Primary Metric)
  ppcImpressions: number;
  blendedCostRatio: number;
  actionLabel: string;
  status?: string;
  ppcSourceMedium?: string;
}

export interface KeywordBridgeData {
  keyword: string;
  organicRank: number | null;
  organicClicks: number;
  paidSessions: number;
  paidCvr: number;
  actionLabel: string;
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
