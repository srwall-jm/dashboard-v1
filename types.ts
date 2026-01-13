
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
  conversionRate: number;
  revenue: number;
  sales: number;
}

export interface DailyData extends BaseMetrics {
  date: string;
  channel: ChannelType | string; // Permite cualquier channel group de GA4
  country: string;
  queryType: QueryType;
  landingPage?: string;
}

export interface KeywordData extends BaseMetrics {
  keyword: string;
  landingPage: string;
  country: string;
  queryType: QueryType;
  date?: string; 
}

export interface DashboardFilters {
  dateRange: {
    start: string;
    end: string;
  };
  country: string;
  queryType: QueryType | 'All';
  channelGroup: string; // Nuevo filtro de canal
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
