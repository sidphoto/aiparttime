import React, { useState } from 'react';
import { FileSpreadsheet, RefreshCw, Link as LinkIcon, Check, AlertCircle, Sparkles, ExternalLink, PlusCircle } from 'lucide-react';
import { GoogleUser } from '../services/googleAuth';
import { GoogleAuthService } from '../services/googleSheetsClient';
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
  const [sheetInput, setSheetInput] = useState(() => localStorage.getItem('user_g_sheet_url_id') || '');
  const [activeSpreadsheetId, setActiveSpreadsheetId] = useState<string | null>(
    () => localStorage.getItem('user_g_spreadsheet_id') || null
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
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

  // Create a brand new Google Sheet with standardized headers
  const handleCreateNewSheet = async () => {
    if (!googleUser) {
      onOpenGoogleLogin();
      return;
    }

    const token = googleUser?.accessToken || GoogleAuthService.getAccessToken();
    if (!token) {
      onOpenGoogleLogin();
      return;
    }

    setIsCreating(true);
    setStatusMessage({ type: 'info', text: '正在為您在 Google 雲端硬碟建立「AIPT時數統計_資料庫」...' });

    try {
      // 1. Create Spreadsheet with employees and work_records sheets
      const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: { title: 'AIPT時數統計_資料庫' },
          sheets: [
            { properties: { title: 'employees' } },
            { properties: { title: 'work_records' } },
          ],
        }),
      });

      if (!createRes.ok) {
        const errJson = await createRes.json();
        throw new Error(`無法建立試算表: ${errJson.error?.message || createRes.statusText}`);
      }

      const createdData = await createRes.json();
      const newSpreadsheetId = createdData.spreadsheetId;
      const fullUrl = `https://docs.google.com/spreadsheets/d/${newSpreadsheetId}/edit`;

      // 2. Initialize Header Columns in both tabs
      // employees headers (9 columns, added role and hourly_rate)
      const empHeaders = [
        'employee_id',
        'store_id',
        'name',
        'status',
        'hire_date',
        'note',
        'created_at',
        'role',
        'hourly_rate',
      ];
      // work_records headers (16 columns, added recognition_id and note)
      const workHeaders = [
        'record_id',
        'employee_id',
        'work_date',
        'clock_in_1',
        'clock_out_1',
        'clock_in_2',
        'clock_out_2',
        'period_1_minutes',
        'period_2_minutes',
        'total_minutes',
        'verification_status',
        'source',
        'recognition_id',
        'note',
        'created_at',
        'updated_at',
      ];

      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${newSpreadsheetId}/values/employees!A1:I1?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [empHeaders] }),
        }
      );

      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${newSpreadsheetId}/values/work_records!A1:P1?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [workHeaders] }),
        }
      );

      // Save to localStorage
      localStorage.setItem('user_g_sheet_url_id', fullUrl);
      localStorage.setItem('user_g_spreadsheet_id', newSpreadsheetId);
      setSheetInput(fullUrl);
      setActiveSpreadsheetId(newSpreadsheetId);
      setIsEditing(false);

      setStatusMessage({ type: 'success', text: `✨ 成功建立新試算表！已寫入 employees (9個欄位) 與 work_records (16個欄位)` });

      if (onSyncCompleted) {
        onSyncCompleted();
      }
    } catch (err: any) {
      console.error('Create Sheet error:', err);
      setStatusMessage({ type: 'error', text: err.message || '建立試算表失敗，請確認授權權限。' });
    } finally {
      setIsCreating(false);
    }
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
      localStorage.setItem('user_g_sheet_url_id', sheetInput.trim());
      localStorage.setItem('user_g_spreadsheet_id', parsedId);
      setActiveSpreadsheetId(parsedId);

      const token = googleUser?.accessToken || GoogleAuthService.getAccessToken();
      if (token) {
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
              {dataServiceManager.providerName === 'google_sheets' && googleUser ? (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-400/20 text-emerald-300 rounded-full border border-emerald-400/30">
                  Google Sheet 已連線
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-400/20 text-amber-300 rounded-full border border-amber-400/30">
                  未連接 Google Sheet
                </span>
              )}
            </h3>
            <p className="text-[11px] text-blue-200/80">自動寫入欄位架構與即時連線雲端資料庫</p>
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

      {/* Input / Connection Form & Create Button */}
      {googleUser && (isEditing || !activeSpreadsheetId) && (
        <div className="space-y-3 pt-1">
          <form onSubmit={handleSaveAndSync} className="space-y-2">
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

          {/* One-Click Create New Sheet Option */}
          <div className="border-t border-white/10 pt-2 flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-200">還沒有試算表？</span>
            <button
              type="button"
              onClick={handleCreateNewSheet}
              disabled={isCreating}
              className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center space-x-1"
            >
              <PlusCircle className={`w-3.5 h-3.5 ${isCreating ? 'animate-spin' : ''}`} />
              <span>{isCreating ? '自動建檔中...' : '一鍵為我建立新 Sheet (含全欄位)'}</span>
            </button>
          </div>
        </div>
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
