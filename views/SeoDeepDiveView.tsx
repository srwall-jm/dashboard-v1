
import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, Link as LinkIcon, ExternalLink, FileText } from 'lucide-react';
import { KeywordData } from '../types';
import { exportToCSV } from '../utils';

export const SeoDeepDiveView: React.FC<{ 
  keywords: KeywordData[]; 
  searchTerm: string; 
  setSearchTerm: (s: string) => void; 
  isLoading: boolean;
  comparisonEnabled: boolean;
}> = ({ keywords, searchTerm, setSearchTerm, isLoading, comparisonEnabled }) => {
  const [expandedUrls, setExpandedUrls] = useState<Set<string>>(new Set());

  const toggleUrl = (url: string) => {
    const next = new Set(expandedUrls);
    if (next.has(url)) {
      next.delete(url);
    } else {
      next.add(url);
    }
    setExpandedUrls(next);
  };

  const groupedByUrl = useMemo(() => {
    const filtered = keywords.filter(k => 
      k.keyword.toLowerCase().includes(searchTerm.toLowerCase()) || 
      k.landingPage.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const map: Record<string, { 
      url: string; 
      clicks: number; 
      impressions: number; 
      queryMap: Record<string, KeywordData & { weightedPosition: number }>; 
    }> = {};

    filtered.forEach(k => {
      const url = k.landingPage || 'Unknown';
      if (!map[url]) {
        map[url] = { url, clicks: 0, impressions: 0, queryMap: {} };
      }
      
      if (k.dateRangeLabel === 'current') {
        map[url].clicks += k.clicks;
        map[url].impressions += k.impressions;

        if (!map[url].queryMap[k.keyword]) {
            map[url].queryMap[k.keyword] = {
                ...k,
                clicks: 0,
                impressions: 0,
                weightedPosition: 0
            };
        }
        
        const q = map[url].queryMap[k.keyword];
        q.clicks += k.clicks;
        q.impressions += k.impressions;
        // Accumulate weighted position (Position * Impressions) for accurate average
        q.weightedPosition += (k.position || 0) * k.impressions;
        q.ctr = q.impressions > 0 ? (q.clicks / q.impressions) * 100 : 0;
      }
    });

    return Object.values(map)
      .map(page => ({
        url: page.url,
        clicks: page.clicks,
        impressions: page.impressions,
        ctr: page.impressions > 0 ? (page.clicks / page.impressions) * 100 : 0,
        topQueries: Object.values(page.queryMap)
          .map(q => ({
             ...q,
             avgPosition: q.impressions > 0 ? q.weightedPosition / q.impressions : 0
          }))
          .sort((a, b) => b.clicks - a.clicks)
          .slice(0, 20)
      }))
      .sort((a, b) => b.clicks - a.clicks);
  }, [keywords, searchTerm]);

return (
  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6">
    <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">URL & Keyword Precision Analysis</h4>
          <p className="text-[11px] font-bold text-slate-600">Jerarquía por URL y sus Top 20 Queries correspondientes (Aggregated)</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => {
              const dataToExport = keywords.map(k => ({
                Keyword: k.keyword,
                Landing_Page: k.landingPage,
                Clicks: k.clicks,
                Impressions: k.impressions,
                CTR: k.ctr.toFixed(2) + "%",
                Avg_Position: k.position ? k.position.toFixed(1) : "0",
                Type: k.queryType,
                Country: k.country
              }));
              exportToCSV(dataToExport, "SEO_Keywords_Full_Report");
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase transition-all shadow-lg shadow-indigo-600/20 w-full sm:w-auto"
          >
            <FileText size={14} /> Export All Keywords
          </button>

          <div className="relative w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Filtrar por URL o Keyword..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-1 ring-indigo-500 transition-all"
            />
          </div>
        </div>
      </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest px-4 w-10"></th>
                <th className="py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest px-4">Landing Page (URL)</th>
                <th className="py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest px-4 text-right">Clicks</th>
                <th className="py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest px-4 text-right">Impr.</th>
                <th className="py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest px-4 text-right">CTR</th>
              </tr>
            </thead>
            <tbody>
              {groupedByUrl.length > 0 ? groupedByUrl.map((page, i) => (
                <React.Fragment key={page.url}>
                  <tr 
                    onClick={() => toggleUrl(page.url)}
                    className="group cursor-pointer hover:bg-slate-50/50 transition-colors border-b border-slate-50"
                  >
                    <td className="py-5 px-4 text-center">
                      {expandedUrls.has(page.url) ? 
                        <ChevronUp className="w-4 h-4 text-indigo-500" /> : 
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      }
                    </td>
                    <td className="py-5 px-4 max-w-md">
                      <div className="flex items-center gap-3">
                        <LinkIcon className="w-3 h-3 text-slate-300 flex-shrink-0" />
                        <span className="text-[11px] font-black text-slate-800 truncate block">{page.url}</span>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <ExternalLink className="w-3 h-3 text-indigo-400" />
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-4 text-right">
                      <div className="text-[11px] font-black text-slate-900">{page.clicks.toLocaleString()}</div>
                    </td>
                    <td className="py-5 px-4 text-right font-bold text-slate-600 text-[11px]">
                      {page.impressions.toLocaleString()}
                    </td>
                    <td className="py-5 px-4 text-right">
                      <div className="text-[11px] font-black text-slate-900">{page.ctr.toFixed(2)}%</div>
                      <div className="w-16 h-1 bg-slate-100 rounded-full mt-1.5 ml-auto overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${Math.min(page.ctr * 5, 100)}%` }} />
                      </div>
                    </td>
                  </tr>
                  {expandedUrls.has(page.url) && (
                    <tr>
                      <td colSpan={5} className="bg-slate-50/50 p-0">
                        <div className="animate-in slide-in-from-top-2 duration-200 pl-12 pr-8 py-6">
                          <table className="w-full border-l-2 border-indigo-200/50">
                            <thead>
                              <tr className="border-b border-indigo-100">
                                <th className="py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest px-4 text-left">Top Queries (Limit 20)</th>
                                <th className="py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest px-4 w-24">Type</th>
                                <th className="py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest px-4 text-right w-24">Avg. Rank</th>
                                <th className="py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest px-4 text-right w-24">Clicks</th>
                                <th className="py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest px-4 text-right w-24">Impr.</th>
                                <th className="py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest px-4 text-right w-24">CTR</th>
                              </tr>
                            </thead>
                            <tbody>
                              {page.topQueries.map((q, idx) => (
                                <tr key={idx} className="hover:bg-indigo-50/50 border-b border-indigo-50/30 last:border-0 transition-colors">
                                  <td className="py-2.5 px-4">
                                    <span className="text-[11px] font-bold text-slate-700">{q.keyword}</span>
                                  </td>
                                  <td className="py-2.5 px-4">
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tight ${q.queryType === 'Branded' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                                      {q.queryType}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-4 text-right">
                                    <span className={`text-[10px] font-bold ${q.avgPosition <= 3 ? 'text-emerald-600' : q.avgPosition <= 10 ? 'text-indigo-600' : 'text-slate-500'}`}>
                                      {q.avgPosition.toFixed(1)}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-4 text-right">
                                    <span className="text-[11px] font-black text-slate-900">{q.clicks.toLocaleString()}</span>
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-bold text-slate-500 text-[10px]">
                                    {q.impressions.toLocaleString()}
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-black text-slate-900 text-[10px]">
                                    {q.ctr.toFixed(2)}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )) : (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Search className="w-10 h-10 text-slate-200" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No matching search terms found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};