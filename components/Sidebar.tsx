
import React from 'react';
import { Layers, Globe, Target, LogOut, ChevronRight, Activity, Cable, Bot, Settings } from 'lucide-react';
import { DashboardTab } from '../types';

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
  user: any;
  handleLogout: () => void;
  setIsSettingsOpen: (isOpen: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen, setIsOpen, activeTab, setActiveTab, user, handleLogout, setIsSettingsOpen
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
           <SidebarLink 
            active={activeTab === DashboardTab.PPC_SEO_BRIDGE} 
            onClick={() => setActiveTab(DashboardTab.PPC_SEO_BRIDGE)} 
            icon={<Cable />} 
            label="PPC to SEO Bridge" 
          />
          <SidebarLink 
            active={activeTab === DashboardTab.AI_TRAFFIC_MONITOR} 
            onClick={() => setActiveTab(DashboardTab.AI_TRAFFIC_MONITOR)} 
            icon={<Bot />} 
            label="AI Traffic Tracker" 
          />
        </nav>
      </div>

      <div className="p-6 border-t border-white/5 bg-slate-950">
         <div className="bg-white/5 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <img src={user.picture} className="w-9 h-9 rounded-full border-2 border-indigo-500" alt="user" />
                    <div className="truncate max-w-[120px]">
                        <p className="text-[11px] font-black truncate">{user.name}</p>
                        <p className="text-[9px] text-slate-500 truncate">{user.email}</p>
                    </div>
                </div>
                <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95"
                    title="Settings"
                >
                    <Settings size={16} />
                </button>
            </div>
            
            <button onClick={handleLogout} className="w-full mt-2 py-2 text-[9px] font-black text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-2"><LogOut className="w-3 h-3" /> Sign Out</button>
         </div>
      </div>
    </aside>
  );
};
