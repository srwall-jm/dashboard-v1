
import { DailyData, KeywordData, ChannelType, QueryType, BridgeData, AiTrafficData, KeywordBridgeData } from './types';
import { coverSearchTerms, type KeywordSignal } from './recommendations';

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
    const isPMax = Math.random() > 0.8; 
    const hasOrganic = Math.random() > 0.1;
    
    const organicRank = hasOrganic ? (Math.random() * 50) + 1 : null; 
    
    const scenario = Math.random();
    let ppcCost = 0;
    let ppcConversions = 0;
    let rank = organicRank;

    if (scenario < 0.2) {
      rank = Math.floor(Math.random() * 3) + 1; 
      ppcCost = Math.floor(Math.random() * 500) + 100;
      ppcConversions = Math.floor(Math.random() * 10);
    } else if (scenario < 0.5) {
      rank = Math.floor(Math.random() * 15) + 5; 
      ppcCost = Math.floor(Math.random() * 200) + 50;
      ppcConversions = Math.floor(Math.random() * 20) + 5; 
    } else {
      rank = Math.random() > 0.5 ? Math.floor(Math.random() * 80) + 20 : null;
      ppcCost = Math.floor(Math.random() * 1000) + 50;
      ppcConversions = Math.floor(Math.random() * 50);
    }

    const ppcCpa = ppcConversions > 0 ? ppcCost / ppcConversions : 0;
    const organicClicks = rank && rank < 10 ? Math.floor(Math.random() * 1000) : Math.floor(Math.random() * 50);
    const organicSessions = Math.floor(organicClicks * 1.3) + Math.floor(Math.random() * 50); 
    const organicTransactions = Math.floor(organicSessions * 0.02);
    const organicCvr = organicSessions > 0 ? (organicTransactions / organicSessions) * 100 : 0;
    
    const ppcSessions = Math.floor(ppcCost / (0.5 + Math.random()));
    const ppcAvgCpc = ppcSessions > 0 ? ppcCost / ppcSessions : 0;

    const blendedDenominator = organicSessions + ppcSessions;
    const blendedCostRatio = blendedDenominator > 0 ? ppcSessions / blendedDenominator : 0;
    
    let action = "MAINTAIN";
    if (rank && rank <= 3.0 && blendedCostRatio > 0.4) action = "CRITICAL (Overlap)";
    else if (rank && rank <= 3.0 && ppcSessions > 0) action = "REVIEW";
    else if (rank && rank > 10.0 && ppcSessions === 0) action = "INCREASE";

    // Generate Mock Nested Queries
    const gscTopQueries = [];
    if (hasOrganic) {
        const numQueries = Math.floor(Math.random() * 5) + 1;
        for(let j=0; j<numQueries; j++) {
            gscTopQueries.push({
                query: queries[(i + j) % queries.length],
                rank: (rank || 50) + j,
                clicks: Math.floor(organicClicks / (j+1))
            });
        }
    }

    return {
      url: pages[i % pages.length],
      query: isPMax ? '(not provided)' : queries[i % queries.length],
      organicRank: rank,
      organicClicks: organicClicks,
      organicSessions: organicSessions, 
      organicTransactions: organicTransactions,
      organicCvr: organicCvr,
      ppcCampaign: campaigns[i % campaigns.length],
      ppcCost,
      ppcConversions,
      ppcCpa,
      ppcSessions: ppcSessions, 
      ppcAvgCpc,
      ppcImpressions: Math.floor(ppcCost * 20),
      searchImpressionShare: Math.random() * 0.8,
      blendedCostRatio,
      actionLabel: action,
      dataSource: 'GA4',
      gscTopQueries: gscTopQueries
    };
  });
};

export const generateMockKeywordBridgeData = (): KeywordBridgeData[] => {
    const queries = [
        'running shoes nike', 'adidas ultraboost sale', 'yoga mats non slip', 'best gym gloves', 
        'pro sports shop discount', 'home treadmill compact', 'compression socks running', 'marathon training guide',
        'whey protein isolate', 'crossfit grips', 'mens running shorts', 'womens gym leggings',
        'home gym equipment', 'adjustable dumbbell set', 'kettlebell 16kg'
    ];
    const pages = [
        '/shop/running/shoes', '/shop/weights', '/shop/yoga-mats', '/blog/best-workouts',
        '/home', '/cardio/treadmills', '/accessories/socks', '/training/marathon-plans'
    ];

    return Array.from({ length: 40 }).map((_, i) => {
        const organicRank = Math.random() > 0.3 ? (Math.random() * 40) + 1 : null;
        const organicClicks = organicRank && organicRank < 20 ? Math.floor(Math.random() * 800) + 50 : 0;
        
        const hasPaid = Math.random() > 0.4;
        const paidSessions = hasPaid ? Math.floor(Math.random() * 500) + 20 : 0;
        const ppcCost = paidSessions * (0.5 + Math.random() * 1.5);
        
        let action = "MONITOR";
        if (organicRank && organicRank <= 3 && paidSessions > 100) action = "CRITICAL (Cannibalization)";
        else if (organicRank && organicRank > 10 && paidSessions === 0) action = "OPPORTUNITY (Growth)";
        else if (!organicRank && paidSessions > 0) action = "PAID ONLY";

        const paidConversions = hasPaid ? Math.floor(Math.random() * 20) : 0;

        return {
            keyword: queries[i % queries.length],
            url: pages[i % pages.length],
            organicRank,
            organicClicks,
            paidSessions,
            paidCvr: Math.random() * 5,
            ppcCost,
            avgCpc: paidSessions > 0 ? ppcCost / paidSessions : 0,
            paidClicks: paidSessions,
            paidCtr: Math.random() * 10,
            searchImpressionShare: Math.random(),
            paidConversions,
            paidCta: paidConversions > 0 ? ppcCost / paidConversions : 0,
            actionLabel: action,
            dataSource: 'GA4'
        };
    });
};

export const generateMockAiTrafficData = (): AiTrafficData[] => {
  const sources = ['chatgpt.com', 'perplexity.ai', 'gemini.google.com', 'claude.ai'];
  const pages = [
    '/blog/top-running-shoes-2024', '/shop/yoga/kits', '/guide/home-workouts', 
    '/product/smart-dumbbell', '/blog/nutrition-tips', '/shop/sale'
  ];

  const data: AiTrafficData[] = [];
  const now = new Date();

  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    sources.forEach(source => {
      const isHighQuality = source.includes('perplexity') || source.includes('chatgpt');
      const baseSessions = isHighQuality ? Math.floor(Math.random() * 50) + 10 : Math.floor(Math.random() * 20) + 2;
      
      pages.forEach(page => {
        if (Math.random() > 0.7) return; 

        const sessions = Math.ceil(baseSessions * Math.random());
        const engagementRate = isHighQuality ? 0.6 + (Math.random() * 0.3) : 0.3 + (Math.random() * 0.3);
        const engagedSessions = Math.round(sessions * engagementRate);
        const revenue = engagedSessions * (Math.random() * 5); 

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

// Sample keywords for the recommendation panel. One of each situation the model handles.
export const generateMockKeywordSignals = (): KeywordSignal[] => {
  const row = (
    keyword: string, cost: number, paidClicks: number, paidConversions: number,
    organicRank: number | null, organicClicks: number, organicImpressions: number,
    impressionShare: number | null, rankLostShare: number | null
  ): KeywordSignal => ({
    keyword, isBrand: false, cost: cost / 4, paidClicks, paidImpressions: paidClicks * 12, paidConversions,
    paidConversionValue: paidConversions * (42 + (keyword.length % 5) * 9), // an order value that differs by keyword
    organicRank, organicClicks, organicImpressions, impressionShare, rankLostShare, topImpressionShare: null,
  });
  const signals: KeywordSignal[] = [
    row('running shoes', 4200, 2100, 96, 1.2, 5400, 21000, 0.86, 0.04),
    row('trail running shoes', 2600, 1150, 51, 1.4, 2300, 9800, 0.71, 0.18),
    row('waterproof running jacket', 1900, 820, 30, 2.3, 1100, 8200, 0.78, 0.07),
    row('marathon training plan', 1350, 900, 12, 1.1, 3900, 14000, 0.52, 0.38),
    row('carbon plate shoes', 3100, 980, 74, 14.5, 60, 5200, 0.44, 0.41),
    row('running shoes sale', 2800, 1400, 88, 18.4, 12, 2600, 0.58, 0.27),
    row('trail shoes waterproof', 1200, 520, 21, null, 0, 0, 0.61, 0.24),
    row('best running socks', 950, 610, 19, 6.8, 240, 4100, 0.69, 0.12),
    row('kids running shoes', 1700, 760, 9, 22.0, 15, 1900, 0.35, 0.33),
    row('gps running watch', 2200, 700, 41, 3.0, 0, 3000, 0.74, 0.09),
    row('running headlamp', 38, 14, 1, 1.8, 320, 1500, 0.9, 0.02),
  ];
  // Search terms for three of them, to show a keyword judged by where its money goes.
  const terms = (keyword: string, rows: [string, number, number | null, number][]) => {
    const signal = signals.find(s => s.keyword === keyword);
    if (!signal) return;
    signal.searchTerms = coverSearchTerms(rows.map(([term, share, organicRank, organicClicks]) => ({ term, cost: signal.cost * share, clicks: signal.paidClicks * share, organicRank, organicClicks })), signal.cost);
  };
  terms('running shoes', [['running shoes', 0.62, 1.2, 5400], ['running shoes men', 0.2, 1.6, 900], ['cheap trainers', 0.12, 9.4, 30]]);
  terms('trail running shoes', [['trail running shoes', 0.75, 1.4, 2300], ['trail shoes waterproof', 0.18, null, 0]]);
  terms('waterproof running jacket', [['waterproof running jacket', 0.3, 2.3, 1100], ['rain jacket', 0.45, null, 0], ['windbreaker running', 0.2, 16, 4]]);
  return signals;
};
