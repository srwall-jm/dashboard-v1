
import React from 'react';
import { Layers, Globe, Target, Cpu, Settings2, ExternalLink, LogOut, ChevronRight, Activity, Sparkles } from 'lucide-react';
import { DashboardTab, Ga4Property, GscSite } from '../types';

const SidebarLink: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-200 group ${
      active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'
    }`}
  >
    <div className={`p-1.5 rounded-lg transition-colors ${active ? 'bg-white/20' : 'bg-transparent group-hover:bg-white/10'}`}>
      {React.cloneElement(icon as React.ReactElement<any>, { size: 18 })}
    </div>
    <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  aiProvider: 'gemini' | 'openai';
  setAiProvider: (p: 'gemini' | 'openai') => void;
  openaiKey: string;
  setOpenaiKey: (key: string) => void;
  brandRegexStr: string;
  setBrandRegexStr: (str: string) => void;
  user: any;
  ga4Auth: any;
  gscAuth: any;
  handleConnectGa4: () => void;
  handleConnectGsc: () => void;
  handleLogout: () => void;
  ga4Search: string;
  setGa4Search: (s: string) => void;
  gscSearch: string;
  setGscSearch: (s: string) => void;
  availableProperties: Ga4Property[];
  availableSites: GscSite[];
  setGa4Auth: (auth: any) => void;
  setGscAuth: (auth: any) => void;
  filteredProperties: Ga4Property[];
  filteredSites: GscSite[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen, setIsOpen, activeTab, setActiveTab, aiProvider, setAiProvider, openaiKey, setOpenaiKey,
  brandRegexStr, setBrandRegexStr, user, ga4Auth, gscAuth, handleConnectGa4, handleConnectGsc, handleLogout,
  ga4Search, setGa4Search, gscSearch, setGscSearch, availableProperties, availableSites, setGa4Auth, setGscAuth,
  filteredProperties, filteredSites
}) => {
  return (
    <aside className={`fixed inset-y-0 left-0 w-80 bg-slate-950 text-white flex flex-col z-50 shadow-2xl transition-all duration-300 ease-in-out transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-xl shadow-indigo-500/20">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight">The OneSearch Engine</h1>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Suite Pro</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)} 
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400"
          >
            <ChevronRight className="rotate-180 w-5 h-5" />
          </button>
        </div>

        <nav className="space-y-1 mb-8">
          <SidebarLink 
            active={activeTab === DashboardTab.ORGANIC_VS_PAID} 
            onClick={() => setActiveTab(DashboardTab.ORGANIC_VS_PAID)} 
            icon={<Layers />} 
            label="Organic vs Paid" 
          />
          <SidebarLink 
            active={activeTab === DashboardTab.SEO_BY_COUNTRY} 
            onClick={() => setActiveTab(DashboardTab.SEO_BY_COUNTRY)} 
            icon={<Globe />} 
            label="Performance by Country" 
          />
          <SidebarLink 
            active={activeTab === DashboardTab.KEYWORD_DEEP_DIVE} 
            onClick={() => setActiveTab(DashboardTab.KEYWORD_DEEP_DIVE)} 
            icon={<Target />} 
            label="Deep SEO Analysis" 
          />
        </nav>
        
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 mb-6">
          <div className="flex items-center gap-2 mb-4 text-emerald-400">
            <Cpu className="w-3.5 h-3.5" />
            <h4 className="text-[9px] font-black uppercase tracking-widest">AI Analysis Engines</h4>
          </div>
          <div className="flex bg-slate-900/50 rounded-xl p-1 mb-4">
            <button onClick={() => setAiProvider('gemini')} className={`flex-1 py-1.5 text-[8px] font-black uppercase rounded-lg transition-all ${aiProvider === 'gemini' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Gemini</button>
            <button onClick={() => setAiProvider('openai')} className={`flex-1 py-1.5 text-[8px] font-black uppercase rounded-lg transition-all ${aiProvider === 'openai' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500'}`}>OpenAI</button>
          </div>
          {aiProvider === 'openai' && (
            <div className="space-y-2">
              <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest">OpenAI API Key</label>
              <input type="password" value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg text-[10px] p-2 focus:ring-1 ring-emerald-500 outline-none" placeholder="sk-..." />
            </div>
          )}
          {aiProvider === 'gemini' && <p className="text-[8px] font-black text-indigo-400/70 uppercase tracking-widest text-center py-2 border border-dashed border-indigo-500/20 rounded-xl">Gemini 3 Pro Active</p>}
        </div>

        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 mb-6">
          <div className="flex items-center gap-2 mb-3 text-indigo-400"><Settings2 className="w-3.5 h-3.5" /><h4 className="text-[9px] font-black uppercase tracking-widest">SEO Settings</h4></div>
          <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest block mb-1">Branded Regex</label>
          <input type="text" value={brandRegexStr} onChange={e => setBrandRegexStr(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg text-[10px] p-2 outline-none" placeholder="brand|shop" />
        </div>
      </div>

      <div className="p-6 border-t border-white/5 bg-slate-950">
         <div className="bg-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-6">
              <img src={user.picture} className="w-9 h-9 rounded-full border-2 border-indigo-500" alt="user" />
              <div className="truncate"><p className="text-[11px] font-black truncate">{user.name}</p><p className="text-[9px] text-slate-500 truncate">{user.email}</p></div>
            </div>
            <div className="space-y-4">
               <div className="space-y-2">
                  <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest block">GA4 Property</label>
                  {!ga4Auth?.token ? (
                    <button onClick={handleConnectGa4} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-2"><ExternalLink className="w-3 h-3" /> Connect GA4</button>
                  ) : (
                    <div className="space-y-1.5">
                      <input type="text" placeholder="Search..." value={ga4Search} onChange={e => setGa4Search(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg text-[9px] px-2 py-1.5 outline-none" />
                      <select className="w-full bg-slate-900 border border-white/10 rounded-lg text-[10px] p-2 outline-none" value={ga4Auth?.property?.id || ''} onChange={e => setGa4Auth({...ga4Auth, property: availableProperties.find(p => p.id === e.target.value) || null})}>
                        {filteredProperties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  )}
               </div>
               <div className="space-y-2">
                  <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest block">GSC Domain</label>
                  {!gscAuth?.token ? (
                    <button onClick={handleConnectGsc} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-2"><ExternalLink className="w-3 h-3" /> Connect GSC</button>
                  ) : (
                    <div className="space-y-1.5">
                      <input type="text" placeholder="Search..." value={gscSearch} onChange={e => setGscSearch(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg text-[9px] px-2 py-1.5 outline-none" />
                      <select className="w-full bg-slate-900 border border-white/10 rounded-lg text-[10px] p-2 outline-none" value={gscAuth?.site?.siteUrl || ''} onChange={e => setGscAuth({...gscAuth, site: availableSites.find(s => s.siteUrl === e.target.value) || null})}>
                        {filteredSites.map(s => <option key={s.siteUrl} value={s.siteUrl}>{s.siteUrl}</option>)}
                      </select>
                    </div>
                  )}
               </div>
            </div>
            <button onClick={handleLogout} className="w-full mt-6 py-2 text-[9px] font-black text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-2"><LogOut className="w-3 h-3" /> Sign Out</button>
         </div>
      </div>
    </aside>
  );
};
