import React, { useState } from 'react';
import { X, LogIn, Mail, User, ShieldCheck } from 'lucide-react';
import { GoogleUser, GoogleAuthManager } from '../services/googleAuth';

interface GoogleLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: GoogleUser) => void;
}

export const GoogleLoginModal: React.FC<GoogleLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  // Handle Simulated / Direct Google Account Login
  const handleDirectLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setIsLoading(true);
    setTimeout(() => {
      // Create user profile
      const newUser: GoogleUser = {
        id: `google-${Date.now()}`,
        name: name.trim(),
        email: email.trim(),
        picture: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name.trim())}`,
      };
      GoogleAuthManager.setUser(newUser);
      onLoginSuccess(newUser);
      setIsLoading(false);
      onClose();
    }, 500);
  };

  // Preset quick accounts for fast user test
  const handleQuickPreset = (presetName: string, presetEmail: string) => {
    setIsLoading(true);
    setTimeout(() => {
      const newUser: GoogleUser = {
        id: `google-${Date.now()}`,
        name: presetName,
        email: presetEmail,
        picture: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(presetName)}`,
      };
      GoogleAuthManager.setUser(newUser);
      onLoginSuccess(newUser);
      setIsLoading(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            {/* Google Colorful Icon */}
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
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
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">登入 Google 帳號</h3>
              <p className="text-[11px] text-slate-400">登入個人 Google 身份以管理考勤系統</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Google Quick Select Options */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 block">快速選取 Google 帳號身份：</label>
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => handleQuickPreset('張店長', 'manager@gmail.com')}
              className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition text-left group"
            >
              <div className="flex items-center space-x-3">
                <img
                  src="https://api.dicebear.com/7.x/avataaars/svg?seed=張店長"
                  alt="張店長"
                  className="w-8 h-8 rounded-full bg-white border border-slate-200"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700">張店長 (Manager)</div>
                  <div className="text-[11px] text-slate-500">manager@gmail.com</div>
                </div>
              </div>
              <ShieldCheck className="w-4 h-4 text-blue-600 opacity-0 group-hover:opacity-100 transition" />
            </button>

            <button
              type="button"
              onClick={() => handleQuickPreset('陳組長', 'leader.chen@gmail.com')}
              className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition text-left group"
            >
              <div className="flex items-center space-x-3">
                <img
                  src="https://api.dicebear.com/7.x/avataaars/svg?seed=陳組長"
                  alt="陳組長"
                  className="w-8 h-8 rounded-full bg-white border border-slate-200"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700">陳組長 (Supervisor)</div>
                  <div className="text-[11px] text-slate-500">leader.chen@gmail.com</div>
                </div>
              </div>
              <ShieldCheck className="w-4 h-4 text-blue-600 opacity-0 group-hover:opacity-100 transition" />
            </button>
          </div>
        </div>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink mx-2 text-[11px] font-bold text-slate-400">或輸入您的 Google 帳號</span>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        {/* Custom Input Form */}
        <form onSubmit={handleDirectLogin} className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">姓名 / 稱呼</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：王小明"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Google Email 帳號</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@gmail.com"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center space-x-1.5"
            >
              <LogIn className="w-4 h-4" />
              <span>{isLoading ? '登入授權中...' : '確認以 Google 身份登入'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
