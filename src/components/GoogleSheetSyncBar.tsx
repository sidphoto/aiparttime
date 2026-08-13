import React, { useEffect, useState } from 'react';
import { FileSpreadsheet, RefreshCw } from 'lucide-react';
import { SheetConnectionState } from '../types';

interface GoogleSheetSyncBarProps {
  connectionState: SheetConnectionState;
  statusMessage?: string | null;
  onOpenGoogleLogin: () => void;
  onReconnect: () => void | Promise<void>;
}

/** 各連線狀態對應的徽章樣式與文案（AUTH UX FIX Phase 1） */
const STATE_BADGE: Record<SheetConnectionState, { label: string; className: string }> = {
  connected: {
    label: '● 已連線',
    className: 'bg-emerald-400/20 text-emerald-300 border-emerald-400/30',
  },
  connecting: {
    label: '● 連線中…',
    className: 'bg-blue-400/20 text-blue-200 border-blue-400/30',
  },
  needs_reauth: {
    label: '● 需要重新授權',
    className: 'bg-amber-400/20 text-amber-300 border-amber-400/30',
  },
  forbidden: {
    label: '● 帳號未開通',
    className: 'bg-red-400/20 text-red-300 border-red-400/30',
  },
  error: {
    label: '● 連線異常',
    className: 'bg-red-400/20 text-red-300 border-red-400/30',
  },
  disconnected: {
    label: '● 未連線',
    className: 'bg-slate-400/20 text-slate-300 border-slate-400/30',
  },
};

export const GoogleSheetSyncBar: React.FC<GoogleSheetSyncBarProps> = ({
  connectionState,
  statusMessage,
  onOpenGoogleLogin,
  onReconnect,
}) => {
  const [isBusy, setIsBusy] = useState(false);

  // Legacy LocalStorage cleanup (TASK 7)
  useEffect(() => {
    try {
      localStorage.removeItem('user_g_spreadsheet_id');
      localStorage.removeItem('user_g_sheet_url_id');
    } catch {
      // ignore
    }
  }, []);

  const badge = STATE_BADGE[connectionState];
  // 尚未登入 Google 或帳號未開通 -> 引導改用登入流程；其餘狀態一律走「重新連線與整理」
  const showLoginButton = connectionState === 'disconnected' || connectionState === 'forbidden';
  const isLoading = isBusy || connectionState === 'connecting';

  const handleReconnectClick = async () => {
    if (isLoading) return;
    setIsBusy(true);
    try {
      await onReconnect();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-900 to-slate-900 text-white rounded-2xl p-4 shadow-md space-y-3 mb-4 border border-blue-800/50">
      {/* Top Banner */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-1.5">
              <span>Google Sheet 資料庫</span>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${badge.className}`}
              >
                {badge.label}
              </span>
            </h3>
            <p className="text-[11px] text-blue-200/80">員工與工時資料同步至店家 Google Sheet</p>
          </div>
        </div>

        {showLoginButton ? (
          <button
            type="button"
            onClick={onOpenGoogleLogin}
            className="px-3.5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition active:scale-95 shadow-xs shrink-0"
          >
            {connectionState === 'forbidden' ? '更換 Google 帳號' : '登入 Google 帳號'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleReconnectClick}
            disabled={isLoading}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition active:scale-95 flex items-center space-x-1 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? '連線中…' : '重新連線與整理'}</span>
          </button>
        )}
      </div>

      {/* 狀態說明：需要重新授權 / 帳號未開通 / Server 異常 */}
      {statusMessage && (
        <p className="text-[11px] leading-relaxed text-amber-200/90 bg-black/20 rounded-xl px-3 py-2 border border-white/10">
          {statusMessage}
        </p>
      )}
    </div>
  );
};
