import { DashboardTab } from './types';

// One place for how each section is named in the menu and in the page header.
export interface TabMeta {
  label: string; // menu
  title: string; // page header
  question: string; // what the section answers, shown under the title
}

export const TAB_META: Record<DashboardTab, TabMeta> = {
  [DashboardTab.SUMMARY]: {
    label: 'Summary',
    title: 'Search summary',
    question: 'Where paid spend can move, and what it costs.',
  },
  [DashboardTab.SEARCH_EFFICIENCY]: {
    label: 'Spend recommendations',
    title: 'Spend recommendations',
    question: 'Keyword by keyword: reduce, hold or increase paid spend.',
  },
  [DashboardTab.ORGANIC_VS_PAID]: {
    label: 'Organic vs Paid',
    title: 'Organic vs Paid performance',
    question: 'How much each search channel brings, and how it is changing.',
  },
  [DashboardTab.SEO_BY_COUNTRY]: {
    label: 'Markets',
    title: 'SEO performance by country',
    question: 'Which markets drive organic traffic and revenue.',
  },
  [DashboardTab.KEYWORD_DEEP_DIVE]: {
    label: 'URLs & keywords',
    title: 'URL and keyword analysis',
    question: 'Organic performance by page and query, brand and non-brand.',
  },
  [DashboardTab.GOOGLE_ADS_PERFORMANCE]: {
    label: 'Google Ads',
    title: 'Google Ads performance',
    question: 'Paid search spend, clicks and conversions by landing page.',
  },
  [DashboardTab.AI_TRAFFIC_MONITOR]: {
    label: 'AI traffic',
    title: 'AI traffic monitor',
    question: 'Sessions arriving from ChatGPT, Perplexity, Claude and Gemini.',
  },
  [DashboardTab.PPC_SEO_BRIDGE]: {
    label: 'SEO and PPC bridge',
    title: 'SEO and PPC bridge',
    question: 'Organic and paid side by side for each landing page.',
  },
};
