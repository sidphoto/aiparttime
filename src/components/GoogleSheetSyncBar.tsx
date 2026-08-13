import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, RefreshCw, Link as LinkIcon, Check, AlertCircle, Sparkles, ExternalLink } from 'lucide-react';
import { GoogleUser } from '../services/googleAuth';

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
  const [sheetInput, setSheetInput] = useState(() => localStorage.getItem('user_g_sheet_url_id') || '');
  const [activeSpreadsheetId, setActiveSpreadsheetId] = useState<string | null>(
    () => localStorage.getItem('user_g_spreadsheet_id') || null
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isEditing, setIsEditing] = useState(!activeSpreadsheetId);

  // Helper to extract Spreadsheet ID from full URL or raw ID
  const parseSpreadsheetId = (input: string): string | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
      return trimmed;
    }
    return null;
  };

  const handleSaveAndSync = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!googleUser) {
      onOpenGoogleLogin();
      return;
    }

    const parsedId = parseSpreadsheetId(sheetInput);
    if (!parsedId) {
      setStatusMessage({ type: 'error', text: '請輸入有效的 Google Sheet 網址或 ID。' });
      return;
    }

    setIsSyncing(true);
    setStatusMessage({ type: 'info', text: '正在存取您的 Google Sheet 資料表...' });

    try {
      // Store user spreadsheet ID
      localStorage.setItem('user_g_sheet_url_id', sheetInput.trim());
      localStorage.setItem('user_g_spreadsheet_id', parsedId);
      setActiveSpreadsheetId(parsedId);

      // Fetch employee & work records using user's access token
      const token = googleUser.accessToken || localStorage.getItem('g_sheets_token');
      if (token) {
        // Fetch employees tab metadata
        const res = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${parsedId}/values/employees!A1:I100?key=`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('找不到該試算表，請確認權限或網址是否正確。');
          }
          if (res.status === 403 || res.status === 401) {
            throw new Error('Google Sheet 存取權限不足，請重新連線授權。');
          }
        }
      }

      setStatusMessage({ type: 'success', text: `成功連接您的 Google Sheet (${parsedId.slice(0, 8)}...)` });
      setIsEditing(false);

      if (onSyncCompleted) {
        onSyncCompleted();
      }
    } catch (err: any) {
      console.warn('Google Sheet fetch error:', err);
      setStatusMessage({ type: 'error', text: err.message || '存取 Google Sheet 失敗，已記錄設定。' });
    } finally {
      setIsSyncing(false);
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
              <span>個人 Google Sheet 資料同步</span>
              {googleUser && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-400/20 text-emerald-300 rounded-full border border-emerald-400/30">
                  SSO 已授權
                </span>
              )}
            </h3>
            <p className="text-[11px] text-blue-200/80">抓取並即時連線您雲端硬碟中的考勤試算表</p>
          </div>
        </div>

        {!googleUser ? (
          <button
            type="button"
            onClick={onOpenGoogleLogin}
            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition active:scale-95 shadow-xs shrink-0"
          >
            登入 Google 帳號
          </button>
        ) : (
          activeSpreadsheetId && !isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-xs font-bold text-blue-300 hover:text-white underline transition shrink-0"
            >
              更換試算表
            </button>
          )
        )}
      </div>

      {/* Message Status */}
      {statusMessage && (
        <div
          className={`text-xs px-3 py-2 rounded-xl flex items-center space-x-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/20 border border-emerald-400/30 text-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-rose-500/20 border border-rose-400/30 text-rose-200'
              : 'bg-blue-500/20 border border-blue-400/30 text-blue-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <Check className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="truncate">{statusMessage.text}</span>
        </div>
      )}

      {/* Input / Connection Form */}
      {googleUser && (isEditing || !activeSpreadsheetId) && (
        <form onSubmit={handleSaveAndSync} className="space-y-2 pt-1">
          <label className="text-[11px] font-bold text-blue-200 block">
            貼上您的 Google Sheet 網址或 試算表 ID：
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={sheetInput}
                onChange={(e) => setSheetInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/1XAl.../edit"
                className="w-full bg-white/10 border border-white/20 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-blue-200/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <button
              type="submit"
              disabled={isSyncing || !sheetInput.trim()}
              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center space-x-1 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? '同步中' : '連線並抓取'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Active Connected Spreadsheet Preview */}
      {googleUser && activeSpreadsheetId && !isEditing && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="font-bold text-blue-100 truncate">ID: {activeSpreadsheetId}</span>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => handleSaveAndSync()}
              disabled={isSyncing}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold rounded-lg transition flex items-center space-x-1"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>重新整理</span>
            </button>
            <a
              href={`https://docs.google.com/spreadsheets/d/${activeSpreadsheetId}/edit`}
              target="_blank"
              rel="noreferrer"
              className="p-1 bg-white/10 hover:bg-white/20 text-blue-200 rounded-lg transition"
              title="前往 Google Sheet 查看"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
