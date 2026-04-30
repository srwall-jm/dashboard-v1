
import React from 'react';
import { Layers, Globe, Target, LogOut, ChevronRight, ChevronLeft, Activity, Cable, Bot, Settings, Megaphone, Zap } from 'lucide-react';
import { DashboardTab } from '../types';

const SidebarLink: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`w-full flex flex-col items-center justify-center gap-1.5 px-2 py-4 rounded-xl transition-all duration-200 group ${
      active ? 'bg-[#F8B133] text-black shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-white'
    }`}
  >
    <div className={`p-1.5 rounded-lg transition-colors ${active ? 'bg-black/10' : 'bg-transparent group-hover:bg-white/10'}`}>
      {React.cloneElement(icon as React.ReactElement<any>, { size: 22 })}
    </div>
    <span className="text-[9px] font-black uppercase tracking-widest text-center whitespace-normal">{label}</span>
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
      w-24
    `}>
      <div className={`flex-1 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-2`}>
        <div className={`flex flex-col items-center mb-6 pt-4`}>
            <div className={`w-12 h-12 bg-[#F8B133] rounded-xl flex items-center justify-center`}>
              <Activity className="w-7 h-7 text-black" />
            </div>
            <p className="text-[9px] font-black text-[#F8B133] uppercase tracking-widest mt-2">OneSearch</p>
        </div>

        <nav className="space-y-1 flex-1">
          <SidebarLink 
            active={activeTab === DashboardTab.ORGANIC_VS_PAID} 
            onClick={() => setActiveTab(DashboardTab.ORGANIC_VS_PAID)} 
            icon={<Layers />} 
            label="Dashboard" 
          />
          <SidebarLink 
            active={activeTab === DashboardTab.SEO_BY_COUNTRY} 
            onClick={() => setActiveTab(DashboardTab.SEO_BY_COUNTRY)} 
            icon={<Globe />} 
            label="Local" 
          />
          <SidebarLink 
            active={activeTab === DashboardTab.AI_TRAFFIC_MONITOR} 
            onClick={() => setActiveTab(DashboardTab.AI_TRAFFIC_MONITOR)} 
            icon={<Bot />} 
            label="AI Traffic" 
          />
          <SidebarLink 
            active={activeTab === DashboardTab.SEARCH_EFFICIENCY} 
            onClick={() => setActiveTab(DashboardTab.SEARCH_EFFICIENCY)} 
            icon={<Zap />} 
            label="Efficiency" 
          />
        </nav>
        
        {/* Bottom Section */}
        <nav className="space-y-1 mt-auto border-t border-white/10 pt-2">
           <p className="text-[7px] text-slate-600 uppercase font-black text-center mb-1">Explorer</p>
           <SidebarLink 
            active={activeTab === DashboardTab.KEYWORD_DEEP_DIVE} 
            onClick={() => setActiveTab(DashboardTab.KEYWORD_DEEP_DIVE)} 
            icon={<Target />} 
            label="SEO" 
          />
          <SidebarLink 
            active={activeTab === DashboardTab.GOOGLE_ADS_PERFORMANCE} 
            onClick={() => setActiveTab(DashboardTab.GOOGLE_ADS_PERFORMANCE)} 
            icon={<Megaphone />} 
            label="ADS" 
          />
        </nav>
      </div>

      <div className="border-t border-white/5 bg-slate-900 p-2">
            <button 
                onClick={() => setIsSettingsOpen(true)}
                className={`w-full p-3 bg-[#F8B133] hover:bg-[#e09e2d] text-black rounded-lg flex justify-center`}
                title="Settings"
            >
                <Settings size={20} />
            </button>
      </div>
    </aside>
  );
};