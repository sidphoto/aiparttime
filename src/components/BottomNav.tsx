import React from 'react';
import { Home, Users, FileCheck, BarChart3 } from 'lucide-react';

export type TabType = 'home' | 'employees' | 'verify' | 'reports';

interface BottomNavProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  pendingVerifyCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  pendingVerifyCount,
}) => {
  const tabs = [
    {
      id: 'home' as TabType,
      label: '首頁',
      icon: Home,
      badge: null,
    },
    {
      id: 'employees' as TabType,
      label: '員工',
      icon: Users,
      badge: null,
    },
    {
      id: 'verify' as TabType,
      label: '待核對',
      icon: FileCheck,
      badge: pendingVerifyCount > 0 ? `${pendingVerifyCount}` : null,
    },
    {
      id: 'reports' as TabType,
      label: '報表',
      icon: BarChart3,
      badge: null,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/80 text-slate-500 pb-safe shadow-lg">
      <div className="max-w-md mx-auto px-3 flex justify-around items-center h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex flex-col items-center justify-center w-full h-full transition-all duration-150 active:scale-95 ${
                isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 w-10 h-1 bg-blue-600 rounded-b-full shadow-xs shadow-blue-500/50" />
              )}
              <div className="relative mt-1">
                <Icon className={`w-5 h-5 ${isActive ? 'scale-110 text-blue-600' : ''} transition-transform`} />
                {tab.badge && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-black bg-rose-500 text-white rounded-full leading-none shadow-sm animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] mt-1 tracking-tight ${isActive ? 'text-blue-600 font-semibold' : ''}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

