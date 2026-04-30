
import React from 'react';
import { Layers, Globe, Target, LogOut, ChevronRight, ChevronLeft, Activity, Cable, Bot, Settings, Megaphone, Zap } from 'lucide-react';
import { DashboardTab } from '../types';

const SidebarLink: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-200 group ${
      active ? 'bg-[#F8B133] text-black shadow-xl shadow-[#F8B133]/40' : 'text-slate-400 hover:bg-white/5 hover:text-white'
    }`}
  >
    <div className={`p-1.5 rounded-lg transition-colors ${active ? 'bg-white/20' : 'bg-transparent group-hover:bg-white/10'}`}>
      {React.cloneElement(icon as React.ReactElement<any>, { size: 18 })}
    </div>
    <span className="text-[11px] font-black uppercase tracking-widest whitespace-nowrap overflow-hidden transition-all duration-300">{label}</span>
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
    <aside className={`fixed inset-y-0 left-0 bg-slate-950 text-white flex flex-col z-50 shadow-2xl transition-all duration-300 ease-in-out transform 
      ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
      w-80
    `}>
      <div className={`flex-1 overflow-y-auto custom-scrollbar p-8`}>
        <div className={`flex items-center justify-between mb-8`}>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 bg-[#F8B133] rounded-xl flex items-center justify-center shadow-xl shadow-[#F8B133]/20 flex-shrink-0 transition-all duration-300`}>
              <Activity className="w-6 h-6 text-black" />
            </div>
            <div className="transition-opacity duration-300">
                <h1 className="text-lg font-black tracking-tight whitespace-nowrap">The OneSearch</h1>
                <p className="text-[10px] font-black text-[#F8B133] uppercase tracking-widest">Suite Pro</p>
            </div>
          </div>
          
          {/* Mobile Close Button */}
          <button 
            onClick={() => setIsOpen(false)} 
            className="xl:hidden p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400"
          >
            <ChevronRight className="rotate-180 w-5 h-5" />
          </button>
        </div>

        <nav className="space-y-2 mb-8">
          <SidebarLink 
            active={activeTab === DashboardTab.ORGANIC_VS_PAID} 
            onClick={() => setActiveTab(DashboardTab.ORGANIC_VS_PAID)} 
            icon={<Layers />} 
            label="Activation" 
          />
          <div className="h-px bg-white/10 my-4 mx-4"></div>
          <SidebarLink 
            active={activeTab === DashboardTab.SEO_BY_COUNTRY} 
            onClick={() => setActiveTab(DashboardTab.SEO_BY_COUNTRY)} 
            icon={<Globe />} 
            label="Brand" 
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
            active={activeTab === DashboardTab.GOOGLE_ADS_PERFORMANCE} 
            onClick={() => setActiveTab(DashboardTab.GOOGLE_ADS_PERFORMANCE)} 
            icon={<Megaphone />} 
            label="Google Ads Performance" 
          />
           <SidebarLink 
            active={activeTab === DashboardTab.SEARCH_EFFICIENCY} 
            onClick={() => setActiveTab(DashboardTab.SEARCH_EFFICIENCY)} 
            icon={<Zap />} 
            label="Search Efficiency & Savings" 
          />
          <SidebarLink 
            active={activeTab === DashboardTab.AI_TRAFFIC_MONITOR} 
            onClick={() => setActiveTab(DashboardTab.AI_TRAFFIC_MONITOR)} 
            icon={<Bot />} 
            label="AI Traffic Tracker" 
          />
        </nav>
      </div>

      <div className={`border-t border-white/5 bg-slate-900 p-6`}>
         <div className={`bg-white/5 rounded-2xl p-4`}>
            <div className={`flex items-center justify-between mb-6`}>
                <div className={`flex items-center gap-3`}>
                    <img src={user.picture} className="w-9 h-9 rounded-full border-2 border-[#F8B133]" alt="user" />
                    <div className="truncate max-w-[120px]">
                        <p className="text-[11px] font-black truncate">{user.name}</p>
                        <p className="text-[9px] text-slate-500 truncate">{user.email}</p>
                    </div>
                </div>
                <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className={`p-2 bg-[#F8B133] hover:bg-[#e09e2d] text-black rounded-xl shadow-lg shadow-[#F8B133]/20 transition-all hover:scale-105 active:scale-95`}
                    title="Settings"
                >
                    <Settings size={16} />
                </button>
            </div>
            
            <button 
                onClick={handleLogout} 
                className={`w-full mt-2 py-2 text-[9px] font-black text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-2`}
            >
                <LogOut className="w-3 h-3" /> Sign Out
            </button>
         </div>
      </div>
    </aside>
  );
};