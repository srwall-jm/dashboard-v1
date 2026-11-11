import React from 'react';
import { Layers, Globe, Target, LogOut, Bot, Settings, Megaphone, Zap, LayoutDashboard, PanelLeftClose } from 'lucide-react';
import { DashboardTab } from '../types';
import { TAB_META } from '../navigation';
import type { ClientProfile } from '../clientProfiles';

const NAV_GROUPS: { heading: string | null; items: { tab: DashboardTab; icon: React.ReactNode }[] }[] = [
  { heading: null, items: [{ tab: DashboardTab.SUMMARY, icon: <LayoutDashboard /> }] },
  { heading: 'Decide', items: [{ tab: DashboardTab.SEARCH_EFFICIENCY, icon: <Zap /> }] },
  {
    heading: 'Understand',
    items: [
      { tab: DashboardTab.ORGANIC_VS_PAID, icon: <Layers /> },
      { tab: DashboardTab.SEO_BY_COUNTRY, icon: <Globe /> },
      { tab: DashboardTab.KEYWORD_DEEP_DIVE, icon: <Target /> },
      { tab: DashboardTab.GOOGLE_ADS_PERFORMANCE, icon: <Megaphone /> },
      { tab: DashboardTab.AI_TRAFFIC_MONITOR, icon: <Bot /> },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  user: any;
  handleLogout: () => void;
  setIsSettingsOpen: (isOpen: boolean) => void;
  clients?: ClientProfile[];
  activeClientId?: string | null;
  onSelectClient?: (id: string | null) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen, setIsOpen, activeTab, setActiveTab, user, handleLogout, setIsSettingsOpen,
  clients = [], activeClientId = null, onSelectClient
}) => {
  const go = (tab: DashboardTab) => {
    setActiveTab(tab);
    // On small screens the menu covers the page, so close it after choosing.
    if (typeof window !== 'undefined' && window.innerWidth < 1280) setIsOpen(false);
  };

  return (
    <aside
      id="main-nav"
      aria-label="Sections"
      // Off screen means out of the tab order too.
      inert={!isOpen}
      className={`print:hidden fixed inset-y-0 left-0 w-60 bg-black text-white flex flex-col z-50 shadow-2xl transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
    >
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="OneSearch logo" className="w-9 h-9 rounded-xl object-cover" />
          <div>
            <p className="jf-display text-2xl text-white">OneSearch</p>
            <p className="text-[11px] font-bold text-slate-400 mt-1">Paid and organic as one channel</p>
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10" title="Hide menu" aria-label="Hide menu">
          <PanelLeftClose size={16} />
        </button>
      </div>

      {clients.length > 0 && onSelectClient && (
        <div className="px-4 pb-4">
          <label htmlFor="client-switcher" className="block mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Client</label>
          <select
            id="client-switcher"
            value={activeClientId || ''}
            onChange={e => onSelectClient(e.target.value || null)}
            className="w-full bg-white/5 border border-white/10 rounded-xl text-[13px] font-bold text-white px-3 py-2.5 outline-none cursor-pointer focus:border-[#F8B133]"
          >
            <option value="" className="text-black">Choose a client...</option>
            {clients.map(c => <option key={c.id} value={c.id} className="text-black">{c.name}</option>)}
          </select>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.heading && <p className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{group.heading}</p>}
            <div className="space-y-1">
              {group.items.map(({ tab, icon }) => {
                const active = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => go(tab)}
                    aria-current={active ? 'page' : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[13px] font-bold transition-colors ${
                      active ? 'bg-[#F8B133] text-black shadow-lg' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {React.cloneElement(icon as React.ReactElement<any>, { size: 17, className: 'flex-shrink-0' })}
                    <span>{TAB_META[tab].label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3 space-y-1">
        <div className="px-3 pt-2 pb-3">
          <img src="/brand/jellyfish-wordmark.png" alt="Jellyfish" className="h-5 w-auto" />
        </div>
        {user?.name && (
          <div className="px-3 py-2">
            <p className="text-xs font-bold text-white truncate">{user.name}</p>
            {user.email && <p className="text-[11px] text-slate-400 truncate">{user.email}</p>}
          </div>
        )}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-bold text-slate-300 hover:bg-white/5 hover:text-white"
        >
          <Settings size={17} /> Settings
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-bold text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <LogOut size={17} /> Sign out
        </button>
      </div>
    </aside>
  );
};
