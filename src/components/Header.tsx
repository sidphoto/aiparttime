import React, { useState } from 'react';
import { Store, Plus, UserPlus, Edit2, X, Check } from 'lucide-react';
import { StoreSettings } from '../types';

interface HeaderProps {
  settings: StoreSettings;
  activeTab: string;
  onOpenAddShift: () => void;
  onOpenAddEmployee?: () => void;
  onOpenBatchAdd: () => void;
  onUpdateStoreName: (newName: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  activeTab,
  onOpenAddShift,
  onOpenAddEmployee,
  onOpenBatchAdd,
  onUpdateStoreName,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [inputName, setInputName] = useState(settings.storeName);

  const handleSaveStoreName = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputName.trim()) {
      onUpdateStoreName(inputName.trim());
      setIsEditingName(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white text-slate-900 shadow-xs border-b border-slate-100">
      <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-2">
        {/* Store Title & Badge */}
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs shrink-0">
            <Store className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <h1
                onClick={() => {
                  setInputName(settings.storeName);
                  setIsEditingName(true);
                }}
                className="font-extrabold text-sm sm:text-base text-slate-900 leading-tight truncate max-w-[110px] sm:max-w-[160px] cursor-pointer hover:text-blue-600 transition flex items-center gap-1 group"
                title="點擊修改店名"
              >
                <span className="truncate">{settings.storeName}</span>
                <Edit2 className="w-3 h-3 text-slate-400 group-hover:text-blue-600 transition shrink-0" />
              </h1>
              <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold bg-blue-50 text-blue-700 rounded-full border border-blue-100 shrink-0">
                考勤系統
              </span>
              <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full border border-amber-200 shrink-0">
                Alpha 測試版
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <span>每月 {settings.payCycleStartDay} 號結算</span>
              <span className="text-slate-300">•</span>
              <span className="text-emerald-600 font-bold">${settings.defaultHourlyRate}/時</span>
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center space-x-1.5 shrink-0">
          {onOpenAddEmployee && (
            <button
              onClick={onOpenAddEmployee}
              className="flex items-center space-x-1 px-2.5 sm:px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-slate-950 rounded-xl text-xs font-black shadow-xs transition active:scale-95"
              title="新增員工"
            >
              <UserPlus className="w-3.5 h-3.5 text-slate-950" />
              <span className="hidden xs:inline sm:inline">新增員工</span>
              <span className="inline xs:hidden sm:hidden">加員工</span>
            </button>
          )}
          <button
            onClick={onOpenAddShift}
            className="flex items-center space-x-1 px-2.5 sm:px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95"
            title="補登工時"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>補登工時</span>
          </button>
        </div>
      </div>

      {/* Edit Store Name Quick Modal */}
      {isEditingName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl p-5 w-full max-w-xs shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center space-x-2">
                <Store className="w-4 h-4 text-blue-600" />
                <span>修改店名</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditingName(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStoreName} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  請輸入新店名：
                </label>
                <input
                  type="text"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  placeholder="如：參陸河粉"
                  required
                  autoFocus
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>確定修改</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};


