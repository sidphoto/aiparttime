import React, { useState } from 'react';
import { TimeWheelPicker } from './TimeWheelPicker';
import {
  Store,
  DollarSign,
  Clock,
  Sparkles,
  RotateCcw,
  Plus,
  Trash2,
  Save,
  Check,
  ShieldAlert,
  Download,
  Upload
} from 'lucide-react';
import { StoreSettings, ShiftPreset } from '../types';

interface SettingsViewProps {
  settings: StoreSettings;
  presets: ShiftPreset[];
  onUpdateSettings: (newSettings: StoreSettings) => void;
  onUpdatePresets: (newPresets: ShiftPreset[]) => void;
  onResetDemoData: () => void;
  onExportBackupJSON: () => void;
  onImportBackupJSON: (jsonStr: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  presets,
  onUpdateSettings,
  onUpdatePresets,
  onResetDemoData,
  onExportBackupJSON,
  onImportBackupJSON,
}) => {
  const [storeName, setStoreName] = useState(settings.storeName);
  const [payCycleStartDay, setPayCycleStartDay] = useState(settings.payCycleStartDay);
  const [defaultHourlyRate, setDefaultHourlyRate] = useState(settings.defaultHourlyRate);
  const [overtimeMode, setOvertimeMode] = useState(settings.overtimeMode);
  const [overtimeRate1, setOvertimeRate1] = useState(settings.overtimeRate1);
  const [overtimeRate2, setOvertimeRate2] = useState(settings.overtimeRate2);

  const [savedSettings, setSavedSettings] = useState(false);

  // Presets local state
  const [presetList, setPresetList] = useState<ShiftPreset[]>(presets);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetStart, setNewPresetStart] = useState('09:00');
  const [newPresetEnd, setNewPresetEnd] = useState('18:00');
  const [newPresetBreak, setNewPresetBreak] = useState(60);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      ...settings,
      storeName,
      payCycleStartDay: Number(payCycleStartDay) || 1,
      defaultHourlyRate: Number(defaultHourlyRate) || 190,
      overtimeMode,
      overtimeRate1: Number(overtimeRate1) || 1.34,
      overtimeRate2: Number(overtimeRate2) || 1.67,
    });
    setSavedSettings(true);
    setTimeout(() => setSavedSettings(false), 2000);
  };

  const handleAddPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;

    const newPreset: ShiftPreset = {
      id: `preset-${Date.now()}`,
      name: newPresetName,
      startTime: newPresetStart,
      endTime: newPresetEnd,
      breakMinutes: Number(newPresetBreak) || 0,
      color: '#3b82f6',
    };

    const updated = [...presetList, newPreset];
    setPresetList(updated);
    onUpdatePresets(updated);

    setNewPresetName('');
  };

  const handleDeletePreset = (id: string) => {
    const updated = presetList.filter((p) => p.id !== id);
    setPresetList(updated);
    onUpdatePresets(updated);
  };

  // Import JSON handler
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        try {
          onImportBackupJSON(content);
          alert('資料匯入成功！');
        } catch (err) {
          alert('匯入失敗：格式不正確');
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 pb-20 max-w-3xl mx-auto animate-fade-in">
      {/* Form 1: Store & Wage Settings */}
      <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
          <Store className="w-5 h-5 text-blue-400" />
          <h3 className="font-bold text-white text-base">門市資訊與薪資結算規則設定</h3>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="text-slate-300 font-semibold block mb-1">
              門市名稱：
            </label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                預設基礎約定時薪 (元/h)：
              </label>
              <input
                type="number"
                value={defaultHourlyRate}
                onChange={(e) => setDefaultHourlyRate(Number(e.target.value))}
                min="0"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-bold text-emerald-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                月度結算週期起始日：
              </label>
              <select
                value={payCycleStartDay}
                onChange={(e) => setPayCycleStartDay(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value={1}>每月 1 號 ~ 月底 (曆月發薪)</option>
                <option value={26}>每月 26 號 ~ 次月25號 (常見發薪週期)</option>
                <option value={21}>每月 21 號 ~ 次月20號</option>
                <option value={16}>每月 16 號 ~ 次月15號</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">
              加班費試算規則：
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setOvertimeMode('taiwan')}
                className={`p-3 rounded-xl border text-left transition ${
                  overtimeMode === 'taiwan'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <div className="font-bold text-sm">台灣勞基法標準</div>
                <div className="text-[10px] opacity-80 mt-1">前2h以1.34x；第3h起以1.67x</div>
              </button>

              <button
                type="button"
                onClick={() => setOvertimeMode('simple')}
                className={`p-3 rounded-xl border text-left transition ${
                  overtimeMode === 'simple'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <div className="font-bold text-sm">簡化 1.5 倍</div>
                <div className="text-[10px] opacity-80 mt-1">每日超過8h均以 1.5x 計算</div>
              </button>

              <button
                type="button"
                onClick={() => setOvertimeMode('flat')}
                className={`p-3 rounded-xl border text-left transition ${
                  overtimeMode === 'flat'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <div className="font-bold text-sm">不加成 (單一平倍)</div>
                <div className="text-[10px] opacity-80 mt-1">全時段皆依約定原時薪</div>
              </button>
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 flex items-center space-x-1.5 transition"
          >
            {savedSettings ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{savedSettings ? '設定已儲存！' : '儲存門市設定'}</span>
          </button>
        </div>
      </form>

      {/* Form 2: Shift Presets Template Manager */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-white text-base">門市常用班別範本</h3>
        </div>

        {/* Existing preset list */}
        <div className="space-y-2">
          {presetList.map((preset) => (
            <div
              key={preset.id}
              className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs"
            >
              <div className="flex items-center space-x-3">
                <span className="font-bold text-white text-sm">{preset.name}</span>
                <span className="text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  {preset.startTime} ~ {preset.endTime}
                </span>
                <span className="text-slate-400">扣除休息: {preset.breakMinutes}分</span>
              </div>

              <button
                type="button"
                onClick={() => handleDeletePreset(preset.id)}
                className="p-1.5 text-slate-400 hover:text-rose-400 transition"
                title="刪除範本"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add new preset */}
        <form onSubmit={handleAddPreset} className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2">
          <div className="text-xs font-semibold text-slate-300">新增常用班別：</div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
            <input
              type="text"
              placeholder="班別名稱 (例:早班)"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              required
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
            />
            <TimeWheelPicker
              value={newPresetStart}
              onChange={setNewPresetStart}
            />
            <TimeWheelPicker
              value={newPresetEnd}
              onChange={setNewPresetEnd}
            />
            <input
              type="number"
              placeholder="休息(分)"
              value={newPresetBreak}
              onChange={(e) => setNewPresetBreak(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
            />
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新增此班別</span>
            </button>
          </div>
        </form>
      </div>

      {/* Backup & Demo Data Management */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
          <ShieldAlert className="w-5 h-5 text-indigo-400" />
          <h3 className="font-bold text-white text-base">資料備份與示範資料</h3>
        </div>

        <p className="text-xs text-slate-400">
          您可以匯出目前門市所有同仁與打卡工時資料備份為 JSON 檔案，或匯入過去備份，亦可重置回系統初始示範資料。
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={onExportBackupJSON}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition"
          >
            <Download className="w-4 h-4 text-blue-400" />
            <span>匯出備份 (JSON)</span>
          </button>

          <label className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1.5 cursor-pointer transition">
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>匯入備份 (JSON)</span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileImport}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              if (confirm('確定要將應用程式重置為預設門市示範資料嗎？此操作將覆蓋目前的工時紀錄。')) {
                onResetDemoData();
              }
            }}
            className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>重置為預設門市示範資料</span>
          </button>
        </div>
      </div>
    </div>
  );
};
