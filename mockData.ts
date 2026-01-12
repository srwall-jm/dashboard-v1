
import { DailyData, KeywordData, ChannelType, QueryType } from './types';

const COUNTRIES = ['Spain', 'Mexico', 'USA', 'UK', 'France', 'Germany'];
const QUERY_TYPES: QueryType[] = ['Branded', 'Non-Branded'];
const CHANNELS: ChannelType[] = ['Organic Search', 'Paid Search'];

export const generateMockDailyData = (days: number = 60): DailyData[] => {
  const data: DailyData[] = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    COUNTRIES.forEach(country => {
      CHANNELS.forEach(channel => {
        QUERY_TYPES.forEach(qType => {
          const sessions = Math.floor(Math.random() * (channel === 'Paid Search' ? 500 : 1000)) + 100;
          const clicks = Math.floor(sessions * 0.8);
          const impressions = clicks * (Math.floor(Math.random() * 20) + 5);
          const revenue = Math.floor(sessions * (Math.random() * 10 + 5));
          const sales = Math.floor(sessions * 0.05 * (Math.random() + 0.5));
          
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
    'best running shoes', 'nike sneakers', 'affordable gym gear', 'running tips', 
    'pro sports store', 'buy treadmill', 'yoga mats online', 'fitness equipment',
    'marathon training', 'compression socks'
  ];
  const pages = [
    '/shoes/running', '/brand/nike', '/sale/gym-gear', '/blog/running-tips',
    '/homepage', '/equipment/treadmills', '/yoga/mats', '/fitness/all',
    '/guides/marathon', '/accessories/socks'
  ];

  return Array.from({ length: 50 }).map((_, i) => {
    const sessions = Math.floor(Math.random() * 2000) + 500;
    const clicks = Math.floor(sessions * 0.9);
    const impressions = clicks * 15;
    const sales = Math.floor(sessions * 0.04);
    
    return {
      keyword: keywords[i % keywords.length] + (i > 10 ? ` ${i}` : ''),
      landingPage: pages[i % pages.length],
      country: COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)],
      queryType: i % 3 === 0 ? 'Branded' : 'Non-Branded',
      impressions,
      clicks,
      ctr: (clicks / impressions) * 100,
      sessions,
      conversionRate: (sales / sessions) * 100,
      revenue: sales * 45,
      sales
    };
  });
};
