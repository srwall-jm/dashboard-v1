import React from 'react';
import { X, Cpu, Settings2, Database, ExternalLink, Search, CornerDownRight } from 'lucide-react';
import { Ga4Property, GscSite, Sa360Customer } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiProvider: 'gemini' | 'openai';
  setAiProvider: (p: 'gemini' | 'openai') => void;
  openaiKey: string;
  setOpenaiKey: (key: string) => void;
  brandRegexStr: string;
  setBrandRegexStr: (str: string) => void;
  ga4Auth: any;
  gscAuth: any;
  sa360Auth: any;
  handleConnectGa4: () => void;
  handleConnectGsc: () => void;
  handleConnectSa360: () => void;
  ga4Search: string;
  setGa4Search: (s: string) => void;
  gscSearch: string;
  setGscSearch: (s: string) => void;
  sa360Search: string;
  setSa360Search: (s: string) => void;
  availableProperties: Ga4Property[];
  availableSites: GscSite[];
  availableSa360Customers: Sa360Customer[];
  availableSa360SubAccounts?: Sa360Customer[];
  selectedSa360Customer?: Sa360Customer | null;
  selectedSa360SubAccount?: Sa360Customer | null;
  onSa360CustomerChange?: (customer: Sa360Customer | null) => void;
  onSa360SubAccountChange?: (customer: Sa360Customer | null) => void;
  setGa4Auth: (auth: any) => void;
  setGscAuth: (auth: any) => void;
  setSa360Auth: (auth: any) => void;
  filteredProperties: Ga4Property[];
  filteredSites: GscSite[];
  filteredSa360Customers: Sa360Customer[];
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, onClose,
  aiProvider, setAiProvider, openaiKey, setOpenaiKey,
  brandRegexStr, setBrandRegexStr,
  ga4Auth, gscAuth, sa360Auth,
  handleConnectGa4, handleConnectGsc, handleConnectSa360,
  ga4Search, setGa4Search, gscSearch, setGscSearch, sa360Search, setSa360Search,
  availableProperties, availableSites, availableSa360Customers, availableSa360SubAccounts,
  selectedSa360Customer, selectedSa360SubAccount, onSa360CustomerChange, onSa360SubAccountChange,
  setGa4Auth, setGscAuth, setSa360Auth,
  filteredProperties, filteredSites, filteredSa360Customers
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white z-10">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Configuration</h2>
            <p className="text-xs text-slate-500 font-medium">Manage data sources and analysis preferences</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="overflow-y-auto p-8 space-y-8 custom-scrollbar">
          
          {/* Section 1: Data Connectors */}
          <section>
            <div className="flex items-center gap-2 mb-4 text-slate-900">
              <div className="p-2 bg-slate-100 rounded-lg"><Database size={16} className="text-indigo-600" /></div>
              <h3 className="text-sm font-black uppercase tracking-widest">Data Connectors</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               {/* GA4 */}
               <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">Google Analytics 4</label>
                  {!ga4Auth?.token ? (
                    <button onClick={handleConnectGa4} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold transition-colors flex items-center justify-center gap-2"><ExternalLink className="w-3 h-3" /> Connect GA4</button>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                        <input type="text" placeholder="Search Property..." value={ga4Search} onChange={e => setGa4Search(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl text-[10px] pl-8 pr-2 py-2 outline-none focus:border-indigo-500" />
                      </div>
                      <select className="w-full bg-white border border-slate-200 rounded-xl text-[10px] p-2 outline-none cursor-pointer" value={ga4Auth?.property?.id || ''} onChange={e => setGa4Auth({...ga4Auth, property: availableProperties.find(p => p.id === e.target.value) || null})}>
                        {filteredProperties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <div className="flex items-center gap-1.5 text-[9px] text-emerald-600 font-bold px-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/> Connected</div>
                    </div>
                  )}
               </div>

               {/* GSC */}
               <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">Search Console</label>
                  {!gscAuth?.token ? (
                    <button onClick={handleConnectGsc} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-bold transition-colors flex items-center justify-center gap-2"><ExternalLink className="w-3 h-3" /> Connect GSC</button>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                        <input type="text" placeholder="Search Site..." value={gscSearch} onChange={e => setGscSearch(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl text-[10px] pl-8 pr-2 py-2 outline-none focus:border-emerald-500" />
                      </div>
                      <select className="w-full bg-white border border-slate-200 rounded-xl text-[10px] p-2 outline-none cursor-pointer" value={gscAuth?.site?.siteUrl || ''} onChange={e => setGscAuth({...gscAuth, site: availableSites.find(s => s.siteUrl === e.target.value) || null})}>
                        {filteredSites.map(s => <option key={s.siteUrl} value={s.siteUrl}>{s.siteUrl}</option>)}
                      </select>
                      <div className="flex items-center gap-1.5 text-[9px] text-emerald-600 font-bold px-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/> Connected</div>
                    </div>
                  )}
               </div>

               {/* SA360 */}
               <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">Search Ads 360</label>
                  {!sa360Auth?.token ? (
                    <button onClick={handleConnectSa360} className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-[10px] font-bold transition-colors flex items-center justify-center gap-2"><ExternalLink className="w-3 h-3" /> Connect SA360</button>
                  ) : (
                    <div className="space-y-3">
                      {/* Main Account Selection */}
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-slate-500 uppercase">Main Account / Manager</label>
                        <select 
                            className="w-full bg-white border border-slate-200 rounded-xl text-[10px] p-2 outline-none cursor-pointer" 
                            value={selectedSa360Customer?.resourceName || ''} 
                            onChange={e => {
                                const cust = availableSa360Customers.find(c => c.resourceName === e.target.value) || null;
                                if (onSa360CustomerChange) onSa360CustomerChange(cust);
                            }}
                        >
                            {filteredSa360Customers.map(c => <option key={c.resourceName} value={c.resourceName}>{c.descriptiveName} ({c.id})</option>)}
                        </select>
                      </div>

                      {/* Sub Account Selection */}
                      {selectedSa360Customer && availableSa360SubAccounts && (
                          <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
                              <label className="text-[8px] font-bold text-slate-500 uppercase flex items-center gap-1"><CornerDownRight size={10} /> Sub Account / Client</label>
                              <select 
                                  className="w-full bg-white border border-slate-200 rounded-xl text-[10px] p-2 outline-none cursor-pointer border-l-4 border-l-orange-400" 
                                  value={selectedSa360SubAccount?.resourceName || ''} 
                                  onChange={e => {
                                      const cust = availableSa360SubAccounts.find(c => c.resourceName === e.target.value) || null;
                                      if (onSa360SubAccountChange) onSa360SubAccountChange(cust);
                                  }}
                                  disabled={availableSa360SubAccounts.length === 0}
                              >
                                  {availableSa360SubAccounts.length === 0 && <option value="">No sub-accounts found</option>}
                                  {availableSa360SubAccounts.map(c => <option key={c.resourceName} value={c.resourceName}>{c.descriptiveName} ({c.id})</option>)}
                              </select>
                          </div>
                      )}

                      <div className="flex items-center gap-1.5 text-[9px] text-emerald-600 font-bold px-1 pt-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/> Connected</div>
                    </div>
                  )}
               </div>
            </div>
          </section>

          <div className="w-full h-px bg-slate-100" />

          {/* Section 2: AI Engines */}
          <section>
            <div className="flex items-center gap-2 mb-4 text-slate-900">
              <div className="p-2 bg-slate-100 rounded-lg"><Cpu size={16} className="text-indigo-600" /></div>
              <h3 className="text-sm font-black uppercase tracking-widest">AI Analysis Engines</h3>
            </div>
            
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <div className="flex flex-col sm:flex-row gap-6">
                    <div className="w-full sm:w-1/3">
                        <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">Active Provider</label>
                        <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-200">
                            <button onClick={() => setAiProvider('gemini')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${aiProvider === 'gemini' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>Gemini</button>
                            <button onClick={() => setAiProvider('openai')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${aiProvider === 'openai' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>OpenAI</button>
                        </div>
                    </div>
                    
                    <div className="w-full sm:w-2/3">
                        {aiProvider === 'openai' ? (
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">OpenAI API Key</label>
                                <input type="password" value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl text-xs p-3 focus:ring-2 ring-emerald-500 outline-none transition-all" placeholder="sk-..." />
                                <p className="text-[9px] text-slate-400">Your key is stored locally in your browser.</p>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col justify-center">
                                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700 text-xs font-bold flex items-center gap-2">
                                    <Cpu size={14} />
                                    Google Gemini 3 Pro is active and ready.
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
          </section>

          <div className="w-full h-px bg-slate-100" />

          {/* Section 3: SEO Settings */}
          <section>
            <div className="flex items-center gap-2 mb-4 text-slate-900">
              <div className="p-2 bg-slate-100 rounded-lg"><Settings2 size={16} className="text-indigo-600" /></div>
              <h3 className="text-sm font-black uppercase tracking-widest">SEO Definitions</h3>
            </div>
            
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">Branded Keyword Regex</label>
                <div className="flex gap-4">
                    <input type="text" value={brandRegexStr} onChange={e => setBrandRegexStr(e.target.value)} className="flex-1 bg-white border border-slate-200 rounded-xl text-xs p-3 font-mono outline-none focus:ring-2 ring-indigo-500" placeholder="brand|shop|store" />
                    <div className="w-24 flex-shrink-0 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-400 uppercase">
                        Regex
                    </div>
                </div>
                <p className="text-[9px] text-slate-400 mt-2">Use a pipe | to separate terms. Case insensitive. Used to categorize queries as "Branded" or "Non-Branded".</p>
            </div>
          </section>

        </div>
        
        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
            <button onClick={onClose} className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-xl">
                Done
            </button>
        </div>
      </div>
    </div>
  );
};