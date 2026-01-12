
import { DailyData, KeywordData, ChannelType, QueryType } from './types';

const COUNTRIES = ['Spain', 'Mexico', 'USA', 'UK', 'France', 'Germany'];
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
          // Add some seasonal/yearly variance
          const multiplier = isPreviousYear ? 0.85 : 1.0; 
          const baseSessions = channel === 'Paid Search' ? 300 : 700;
          
          const sessions = Math.floor((Math.random() * baseSessions + 100) * multiplier);
          const clicks = Math.floor(sessions * (0.6 + Math.random() * 0.3));
          const impressions = clicks * (Math.floor(Math.random() * 30) + 10);
          const sales = Math.floor(sessions * (0.02 + Math.random() * 0.04));
          const revenue = sales * (40 + Math.random() * 20);
          
          data.push({
            date: dateStr,
            channel,
            country,
            queryType: qType,
            sessions,
            clicks,
            impressions,
            ctr: (clicks / impressions) * 100,
            conversionRate: (sales / sessions) * 100,
            revenue,
            sales
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

  return Array.from({ length: 60 }).map((_, i) => {
    const sessions = Math.floor(Math.random() * 5000) + 500;
    const clicks = Math.floor(sessions * 0.85);
    const impressions = clicks * (12 + Math.random() * 10);
    const sales = Math.floor(sessions * 0.035);
    
    return {
      keyword: keywords[i % keywords.length] + (i > 10 ? ` ${i}` : ''),
      landingPage: pages[i % pages.length],
      country: COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)],
      queryType: i % 4 === 0 ? 'Branded' : 'Non-Branded',
      impressions,
      clicks,
      ctr: (clicks / impressions) * 100,
      sessions,
      conversionRate: (sales / sessions) * 100,
      revenue: sales * 55,
      sales
    };
  });
};
