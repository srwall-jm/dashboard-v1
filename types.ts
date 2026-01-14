
export type ChannelType = 'Organic Search' | 'Paid Search';
export type QueryType = 'Branded' | 'Non-Branded';

export interface Ga4Property {
  id: string;
  name: string;
}

export interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}

export interface BaseMetrics {
  impressions: number;
  clicks: number;
  ctr: number;
  sessions: number;
  addToCarts: number; // Nuevo
  checkouts: number;  // Nuevo
  conversionRate: number;
  revenue: number;
  sales: number;
}

export interface DailyData extends BaseMetrics {
  date: string;
  channel: string; 
  country: string;
  queryType: QueryType;
  landingPage?: string;
  dateRangeLabel?: 'current' | 'previous';
}

export interface KeywordData extends BaseMetrics {
  keyword: string;
  landingPage: string;
  country: string;
  queryType: QueryType;
  date?: string; 
  dateRangeLabel?: 'current' | 'previous';
}

export interface DashboardFilters {
  dateRange: {
    start: string;
    end: string;
  };
  comparison: {
    enabled: boolean;
    type: 'previous_period' | 'previous_year';
  };
  country: string;
  queryType: QueryType | 'All';
  ga4Dimension: string;
}

export enum DashboardTab {
  ORGANIC_VS_PAID = 'organic_vs_paid',
  SEO_BY_COUNTRY = 'seo_by_country',
  KEYWORD_DEEP_DIVE = 'keyword_deep_dive'
}

export interface ComparisonMetrics {
  current: number;
  previous: number;
  change: number;
}
