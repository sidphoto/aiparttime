import React, { useEffect } from 'react';
import { FileSpreadsheet, RefreshCw } from 'lucide-react';
import { GoogleUser } from '../services/googleAuth';
import { dataServiceManager } from '../services/dataServiceManager';

interface GoogleSheetSyncBarProps {
  googleUser: GoogleUser | null;
  onOpenGoogleLogin: () => void;
  onSyncCompleted?: () => void;
}

export const GoogleSheetSyncBar: React.FC<GoogleSheetSyncBarProps> = ({
  googleUser,
  onOpenGoogleLogin,
  onSyncCompleted,
}) => {
  // Legacy LocalStorage cleanup (TASK 7)
  useEffect(() => {
    try {
      localStorage.removeItem('user_g_spreadsheet_id');
      localStorage.removeItem('user_g_sheet_url_id');
    } catch {
      // ignore
    }
  }, []);

  const isConnected = dataServiceManager.providerName === 'google_sheets' && !!googleUser;

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
              {isConnected ? (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-400/20 text-emerald-300 rounded-full border border-emerald-400/30">
                  ● 已連線
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-400/20 text-amber-300 rounded-full border border-amber-400/30">
                  ● 未連線
                </span>
              )}
            </h3>
            <p className="text-[11px] text-blue-200/80">員工與工時資料同步至店家 Google Sheet</p>
          </div>
        </div>

        {!googleUser ? (
          <button
            type="button"
            onClick={onOpenGoogleLogin}
            className="px-3.5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition active:scale-95 shadow-xs shrink-0"
          >
            登入 Google 帳號
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSyncCompleted && onSyncCompleted()}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition active:scale-95 flex items-center space-x-1 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>重新連線與整理</span>
          </button>
        )}
      </div>
    </div>
  );
};
