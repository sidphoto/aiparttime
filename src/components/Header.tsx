import React, { useState } from 'react';
import { Store, Plus, UserPlus, Edit2, X, Check, LogOut } from 'lucide-react';
import { StoreSettings } from '../types';
import { GoogleUser } from '../services/googleAuth';

interface HeaderProps {
  settings: StoreSettings;
  activeTab: string;
  googleUser: GoogleUser | null;
  onOpenGoogleLogin: () => void;
  onGoogleLogout: () => void;
  onOpenAddShift: () => void;
  onOpenAddEmployee?: () => void;
  onOpenBatchAdd: () => void;
  onUpdateStoreName: (newName: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  googleUser,
  onOpenGoogleLogin,
  onGoogleLogout,
  onOpenAddShift,
  onOpenAddEmployee,
  onUpdateStoreName,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [inputName, setInputName] = useState(settings.storeName);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSaveStoreName = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputName.trim()) {
      onUpdateStoreName(inputName.trim());
      setIsEditingName(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white text-slate-900 shadow-xs border-b border-slate-100">
      <div className="max-w-lg mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
        {/* Store Title & Badge */}
        <div className="flex items-center space-x-2 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs shrink-0">
            <Store className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <h1
                onClick={() => {
                  setInputName(settings.storeName);
                  setIsEditingName(true);
                }}
                className="font-extrabold text-sm sm:text-base text-slate-900 leading-tight truncate max-w-[100px] sm:max-w-[140px] cursor-pointer hover:text-blue-600 transition flex items-center gap-1 group"
                title="點擊修改店名"
              >
                <span className="truncate">{settings.storeName}</span>
                <Edit2 className="w-3 h-3 text-slate-400 group-hover:text-blue-600 transition shrink-0" />
              </h1>
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-blue-50 text-blue-700 rounded-full border border-blue-100 shrink-0">
                考勤系統
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
              <span>{settings.payCycleStartDay}號結算</span>
              <span className="text-slate-300">•</span>
              <span className="text-emerald-600 font-bold">${settings.defaultHourlyRate}/時</span>
            </p>
          </div>
        </div>

        {/* Quick Actions & Google User */}
        <div className="flex items-center space-x-1.5 shrink-0">
          {/* Google Login / Account Info */}
          {googleUser ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-1.5 p-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition"
                title={googleUser.email}
              >
                <img
                  src={googleUser.picture}
                  alt={googleUser.name}
                  className="w-6 h-6 rounded-lg bg-white border border-slate-200 object-cover"
                />
                <span className="text-xs font-bold text-slate-800 max-w-[70px] truncate hidden sm:inline">
                  {googleUser.name}
                </span>
              </button>

              {/* User Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-fade-in">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-xs font-black text-slate-900">{googleUser.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{googleUser.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      onGoogleLogout();
                    }}
                    className="w-full mt-1 px-3 py-1.5 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition flex items-center space-x-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>登出 Google 帳號</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenGoogleLogin}
              className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition active:scale-95 border border-slate-200"
              title="登入 Google 帳號"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Google 登入</span>
            </button>
          )}

          {onOpenAddEmployee && (
            <button
              onClick={onOpenAddEmployee}
              className="flex items-center space-x-1 px-2.5 sm:px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-slate-950 rounded-xl text-xs font-black shadow-xs transition active:scale-95"
              title="新增員工"
            >
              <UserPlus className="w-3.5 h-3.5 text-slate-950" />
              <span className="hidden xs:inline sm:inline">新增員工</span>
            </button>
          )}
          <button
            onClick={onOpenAddShift}
            className="flex items-center space-x-1 px-2.5 sm:px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95"
            title="補登工時"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>補登</span>
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
