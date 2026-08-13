import React, { useState } from 'react';
import { X, ShieldCheck, AlertCircle, Settings, Key, Check } from 'lucide-react';
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
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showClientIdConfig, setShowClientIdConfig] = useState(false);
  const [customClientId, setCustomClientId] = useState(GoogleAuthManager.getClientId());
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  if (!isOpen) return null;

  // Handle Real Google SSO Login
  const handleRealSsoLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const realUser = await GoogleAuthManager.loginWithRealGoogleSso(customClientId);
      onLoginSuccess(realUser);
      setIsLoading(false);
      onClose();
    } catch (err: any) {
      console.error('Google SSO Error:', err);
      setErrorMessage(err.message || 'Google 授權失敗，請確認視窗權限或網路連線。');
      setIsLoading(false);
    }
  };

  // Save Custom Client ID
  const handleSaveClientId = (e: React.FormEvent) => {
    e.preventDefault();
    GoogleAuthManager.setClientId(customClientId);
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">Google 官方 SSO 認證</h3>
              <p className="text-[11px] text-slate-400">使用您個人真實 Google 帳號授權登入</p>
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

        {/* Error Alert */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-xs text-rose-700 flex items-start space-x-2 animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Real SSO Main Action */}
        <div className="space-y-4 pt-1">
          <button
            type="button"
            onClick={handleRealSsoLogin}
            disabled={isLoading}
            className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-blue-400 text-slate-800 rounded-2xl font-black text-sm shadow-xs transition active:scale-98 flex items-center justify-center space-x-3 group cursor-pointer"
          >
            {/* Colorful Google G Logo */}
            <svg className="w-5 h-5" viewBox="0 0 24 24">
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
            <span>{isLoading ? '正開啟 Google 授權視窗...' : '使用 Google 帳號 SSO 登入'}</span>
          </button>

          <p className="text-[11px] text-slate-400 text-center leading-relaxed">
            點擊後將彈出 Google 官方授權視窗，選擇您的 Google 帳號即可完成 SSO 單一簽署登入。
          </p>
        </div>

        {/* Client ID Custom Toggle */}
        <div className="border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setShowClientIdConfig(!showClientIdConfig)}
            className="text-[11px] font-bold text-slate-500 hover:text-blue-600 flex items-center space-x-1 transition"
          >
            <Settings className="w-3 h-3" />
            <span>{showClientIdConfig ? '隱藏 Client ID 設定' : '自訂 Google OAuth Client ID'}</span>
          </button>

          {showClientIdConfig && (
            <form onSubmit={handleSaveClientId} className="mt-3 space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <label className="text-[11px] font-bold text-slate-600 flex items-center space-x-1">
                <Key className="w-3 h-3 text-slate-400" />
                <span>Google OAuth Client ID：</span>
              </label>
              <input
                type="text"
                value={customClientId}
                onChange={(e) => setCustomClientId(e.target.value)}
                placeholder="apps.googleusercontent.com"
                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-[11px] font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-slate-400">可用於您個人 Google Cloud App</span>
                <button
                  type="submit"
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[11px] font-bold transition flex items-center space-x-1"
                >
                  {saveSuccessNotice ? <Check className="w-3 h-3 text-emerald-400" /> : null}
                  <span>{saveSuccessNotice ? '已儲存' : '儲存 Client ID'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
