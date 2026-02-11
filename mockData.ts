
import { DailyData, KeywordData, ChannelType, QueryType, BridgeData, AiTrafficData } from './types';

export const COUNTRIES = ['Spain', 'Mexico', 'United States', 'United Kingdom', 'France', 'Germany', 'Italy', 'Portugal'];
const QUERY_TYPES: QueryType[] = ['Branded', 'Non-Branded'];
const CHANNELS: ChannelType[] = ['Organic Search', 'Paid Search'];

export const generateMockDailyData = (): DailyData[] => {
  const data: DailyData[] = [];
  const now = new Date();
  
  // Generate data for 2 years to support YoY
  const days = 730; 

  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const isPreviousYear = i >= 365;

    COUNTRIES.forEach(country => {
      CHANNELS.forEach(channel => {
        QUERY_TYPES.forEach(qType => {
          const multiplier = isPreviousYear ? 0.85 : 1.0; 
          const baseSessions = channel === 'Paid Search' ? 300 : 700;
          
          const sessions = Math.floor((Math.random() * baseSessions + 100) * multiplier);
          const clicks = Math.floor(sessions * (0.6 + Math.random() * 0.3));
          const impressions = clicks * (Math.floor(Math.random() * 30) + 10);
          
          // Funnel Logic
          const addToCarts = Math.floor(sessions * (0.08 + Math.random() * 0.05));
          const checkouts = Math.floor(addToCarts * (0.4 + Math.random() * 0.2));
          const sales = Math.floor(checkouts * (0.6 + Math.random() * 0.2));
          
          const revenue = sales * (40 + Math.random() * 20);
          
          data.push({
            date: dateStr,
            channel,
            country,
            queryType: qType,
            landingPage: '(not set)',
            dateRangeLabel: 'current',
            sessions,
            clicks,
            impressions,
            ctr: (clicks / impressions) * 100,
            conversionRate: (sales / sessions) * 100,
            revenue,
            sales,
            addToCarts,
            checkouts
          });
        });
      });
    });
  }
  return data;
};

export const generateMockKeywordData = (): KeywordData[] => {
  const keywords = [
    'zapatillas running', 'comprar pesas', 'mejor equipamiento yoga', 'rutina gimnasio', 
    'tienda deportes pro', 'cinta de correr barata', 'esterillas online', 'fitness equipment',
    'marathon training', 'calcetines compresion'
  ];
  const pages = [
    '/calzado/running', '/fitness/pesas', '/yoga/accesorios', '/blog/rutinas',
    '/home', '/maquinaria/cardio', '/yoga/mats', '/fitness/catalogo',
    '/guias/entrenamiento', '/accesorios/running'
  ];
  const now = new Date();

  return Array.from({ length: 150 }).map((_, i) => {
    const sessions = Math.floor(Math.random() * 5000) + 500;
    const clicks = Math.floor(sessions * 0.85);
    const impressions = clicks * (12 + Math.random() * 10);
    const sales = Math.floor(sessions * 0.035);
    const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
    const position = Math.random() * 30 + 1; // Random rank 1-30

    return {
      keyword: keywords[i % keywords.length] + (i > 10 ? ` ${i}` : ''),
      landingPage: pages[i % pages.length],
      date: now.toISOString().split('T')[0],
      country,
      dateRangeLabel: 'current',
      queryType: i % 4 === 0 ? 'Branded' : 'Non-Branded',
      impressions,
      clicks,
      ctr: (clicks / impressions) * 100,
      position,
      sessions,
      conversionRate: (sales / sessions) * 100,
      revenue: sales * 55,
      sales,
      addToCarts: Math.floor(sessions * 0.1),
      checkouts: Math.floor(sessions * 0.05)
    };
  });
};

export const generateMockBridgeData = (): BridgeData[] => {
  const queries = [
    'nike running shoes', 'buy dumbbells', 'yoga mats online', 'best gym routine', 
    'pro sports shop', 'cheap treadmill', 'compression socks', 'marathon training plan',
    'protein powder', 'crossfit gear', 'running shorts men', 'womens leggings',
    'home gym setup', 'adjustable bench', 'kettlebell set'
  ];
  
  const pages = [
    '/shop/running', '/shop/weights', '/shop/yoga', '/blog/workouts',
    '/home', '/cardio/treadmills', '/accessories/socks', '/training/plans'
  ];

  const campaigns = ['Search - Brand', 'Search - Generic', 'PMax - Products', 'Shopping - Best Sellers'];

  return Array.from({ length: 60 }).map((_, i) => {
    const isPMax = Math.random() > 0.8; // 20% Chance of being PMax (Query might be null/grouped)
    const hasOrganic = Math.random() > 0.1; // 90% chance of having organic data
    
    const organicRank = hasOrganic ? (Math.random() * 50) + 1 : null; // Rank 1 to 50 or Null
    
    const scenario = Math.random();
    let ppcCost = 0;
    let ppcConversions = 0;
    let rank = organicRank;

    if (scenario < 0.2) {
      // Cannibalization setup
      rank = Math.floor(Math.random() * 3) + 1; // 1-3
      ppcCost = Math.floor(Math.random() * 500) + 100;
      ppcConversions = Math.floor(Math.random() * 10);
    } else if (scenario < 0.5) {
      // Opportunity setup
      rank = Math.floor(Math.random() * 15) + 5; // 5-20
      ppcCost = Math.floor(Math.random() * 200) + 50;
      ppcConversions = Math.floor(Math.random() * 20) + 5; // Good conversions
    } else {
      // Defense or General
      rank = Math.random() > 0.5 ? Math.floor(Math.random() * 80) + 20 : null;
      ppcCost = Math.floor(Math.random() * 1000) + 50;
      ppcConversions = Math.floor(Math.random() * 50);
    }

    const ppcCpa = ppcConversions > 0 ? ppcCost / ppcConversions : 0;
    const organicClicks = rank && rank < 10 ? Math.floor(Math.random() * 1000) : Math.floor(Math.random() * 50);
    const organicSessions = Math.floor(organicClicks * 1.3); // GA4 Sessions usually higher than GSC clicks
    
    // Paid Sessions Logic
    const ppcSessions = Math.floor(ppcCost / (0.5 + Math.random()));
    const ppcAvgCpc = ppcSessions > 0 ? ppcCost / ppcSessions : 0;

    const blendedDenominator = organicSessions + ppcSessions;
    const blendedCostRatio = blendedDenominator > 0 ? ppcSessions / blendedDenominator : 0;
    
    // Logic for Action Label
    let action = "MAINTAIN";
    if (rank && rank <= 3.0 && blendedCostRatio > 0.4) action = "CRITICAL (Overlap)";
    else if (rank && rank <= 3.0 && ppcSessions > 0) action = "REVIEW";
    else if (rank && rank > 10.0 && ppcSessions === 0) action = "INCREASE";

    return {
      url: pages[i % pages.length],
      query: isPMax ? '(not provided)' : queries[i % queries.length],
      organicRank: rank,
      organicClicks: organicClicks,
      organicSessions: organicSessions, // GA4 Metric
      ppcCampaign: campaigns[i % campaigns.length],
      ppcCost,
      ppcConversions,
      ppcCpa,
      ppcSessions: ppcSessions, // GA4 Paid Sessions
      ppcAvgCpc,
      ppcImpressions: Math.floor(ppcCost * 20),
      blendedCostRatio,
      actionLabel: action,
      dataSource: 'GA4' // Default source for mock data
    };
  });
};

export const generateMockAiTrafficData = (): AiTrafficData[] => {
  // Only the requested sources
  const sources = ['chatgpt.com', 'perplexity.ai', 'gemini.google.com', 'claude.ai'];
  
  const pages = [
    '/blog/top-running-shoes-2024', '/shop/yoga/kits', '/guide/home-workouts', 
    '/product/smart-dumbbell', '/blog/nutrition-tips', '/shop/sale'
  ];

  const data: AiTrafficData[] = [];
  const now = new Date();

  // Generate 30 days of data
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    sources.forEach(source => {
      // Perplexity and ChatGPT usually have higher engagement in mock scenarios
      const isHighQuality = source.includes('perplexity') || source.includes('chatgpt');
      const baseSessions = isHighQuality ? Math.floor(Math.random() * 50) + 10 : Math.floor(Math.random() * 20) + 2;
      
      pages.forEach(page => {
        if (Math.random() > 0.7) return; // Not every page gets traffic from every source every day

        const sessions = Math.ceil(baseSessions * Math.random());
        const engagementRate = isHighQuality ? 0.6 + (Math.random() * 0.3) : 0.3 + (Math.random() * 0.3);
        const engagedSessions = Math.round(sessions * engagementRate);
        const revenue = engagedSessions * (Math.random() * 5); // Some random revenue

        data.push({
          date: dateStr,
          source,
          landingPage: page,
          sessions,
          engagedSessions,
          engagementRate: engagementRate * 100,
          revenue
        });
      });
    });
  }
  return data;
};
