import React, { useState, useEffect } from 'react';
import { X, Clock, DollarSign, Calendar, User, FileText, Sparkles, AlertCircle, Trash2 } from 'lucide-react';
import { Employee, ShiftPreset, ShiftLog, StoreSettings } from '../types';
import { calculateShiftBreakdown, suggestBreakMinutes } from '../utils/calc';
import { TimeWheelPicker } from './TimeWheelPicker';

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (shiftData: Omit<ShiftLog, 'id' | 'createdAt'>, shiftId?: string) => void;
  onDelete?: (shiftId: string) => void;
  editingShift?: ShiftLog | null;
  employees: Employee[];
  presets: ShiftPreset[];
  settings: StoreSettings;
  defaultDate?: string;
}

export const ShiftModal: React.FC<ShiftModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  editingShift,
  employees,
  presets,
  settings,
  defaultDate,
}) => {
  const activeEmployees = employees.filter((e) => e.status === 'active');

  const todayStr = new Date().toISOString().split('T')[0];

  const [employeeId, setEmployeeId] = useState<string>('');
  const [date, setDate] = useState<string>(defaultDate || todayStr);
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('18:00');
  const [breakMinutes, setBreakMinutes] = useState<number>(60);
  const [hourlyRate, setHourlyRate] = useState<number>(settings.defaultHourlyRate);
  const [note, setNote] = useState<string>('');
  const [useCustomRate, setUseCustomRate] = useState<boolean>(false);

  // Initialize form state when modal opens or editingShift changes
  useEffect(() => {
    if (editingShift) {
      setEmployeeId(editingShift.employeeId);
      setDate(editingShift.date);
      setStartTime(editingShift.startTime);
      setEndTime(editingShift.endTime);
      setBreakMinutes(editingShift.breakMinutes);
      setHourlyRate(editingShift.hourlyRate);
      setNote(editingShift.note || '');
      setUseCustomRate(true);
    } else {
      const defaultEmp = activeEmployees[0];
      if (defaultEmp) {
        setEmployeeId(defaultEmp.id);
        setHourlyRate(defaultEmp.hourlyRate);
      }
      setDate(defaultDate || todayStr);
      setStartTime('09:00');
      setEndTime('18:00');
      setBreakMinutes(60);
      setNote('');
      setUseCustomRate(false);
    }
  }, [editingShift, isOpen, defaultDate]);

  // Update hourly rate when employee selection changes (unless custom rate is locked)
  const handleEmployeeChange = (empId: string) => {
    setEmployeeId(empId);
    if (!useCustomRate) {
      const selected = employees.find((e) => e.id === empId);
      if (selected) {
        setHourlyRate(selected.hourlyRate);
      }
    }
  };

  // Apply a shift preset
  const handleApplyPreset = (preset: ShiftPreset) => {
    setStartTime(preset.startTime);
    setEndTime(preset.endTime);
    setBreakMinutes(preset.breakMinutes);
  };

  // Live calculation breakdown
  const breakdown = calculateShiftBreakdown(startTime, endTime, breakMinutes, hourlyRate, settings);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      alert('請選擇上班人員');
      return;
    }
    if (!startTime || !endTime) {
      alert('請設定完整的上下班時間');
      return;
    }

    onSave(
      {
        employeeId,
        date,
        startTime,
        endTime,
        breakMinutes: Number(breakMinutes) || 0,
        hourlyRate: Number(hourlyRate) || settings.defaultHourlyRate,
        regularHours: breakdown.regularHours,
        overtimeHours1: breakdown.overtimeHours1,
        overtimeHours2: breakdown.overtimeHours2,
        totalNetHours: breakdown.netHours,
        regularPay: breakdown.regularPay,
        overtimePay: breakdown.overtimePay,
        totalPay: breakdown.totalPay,
        note,
      },
      editingShift ? editingShift.id : undefined
    );
    onClose();
  };

  const selectedEmp = employees.find((e) => e.id === employeeId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 sticky top-0 z-10">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white">
              {editingShift ? '編輯打卡與工時紀錄' : '登記班次與工時'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {/* Presets Bar */}
          {presets.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>套用常用班別範本：</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center space-x-1 active:scale-95"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: preset.color || '#3b82f6' }}
                    />
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Employee Picker */}
          <div>
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
              <User className="w-4 h-4 text-blue-400" />
              <span>上班同仁 <span className="text-rose-400">*</span></span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={employeeId}
                onChange={(e) => handleEmployeeChange(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="" disabled>請選擇人員...</option>
                {activeEmployees.map((emp, idx) => (
                  <option key={emp.id ? `${emp.id}-${idx}` : `emp-opt-${idx}`} value={emp.id}>
                    {emp.name} ({emp.role} - ${emp.hourlyRate}/h)
                  </option>
                ))}
              </select>

              {/* Hourly rate display/edit */}
              <div className="flex items-center space-x-2 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2">
                <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs text-slate-400 shrink-0">時薪:</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={hourlyRate}
                  onChange={(e) => {
                    setHourlyRate(Number(e.target.value));
                    setUseCustomRate(true);
                  }}
                  className="w-full bg-transparent text-sm font-semibold text-emerald-400 focus:outline-none"
                />
                <span className="text-xs text-slate-400">元/h</span>
              </div>
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span>上班日期 <span className="text-rose-400">*</span></span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Start Time & End Time with Dial Wheel Picker */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <TimeWheelPicker
                label="上班時間"
                value={startTime}
                onChange={setStartTime}
              />
            </div>

            <div>
              <TimeWheelPicker
                label="下班時間"
                value={endTime}
                onChange={setEndTime}
              />
            </div>
          </div>

          {/* Break duration */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                扣除休息時間 (分鐘)
              </label>
              <button
                type="button"
                onClick={() => setBreakMinutes(suggestBreakMinutes(startTime, endTime))}
                className="text-[11px] text-blue-400 hover:text-blue-300 underline"
              >
                自動建議 ({suggestBreakMinutes(startTime, endTime)}分)
              </button>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[0, 30, 60, 90, 120].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setBreakMinutes(mins)}
                  className={`py-1.5 text-xs rounded-lg border font-medium transition ${
                    breakMinutes === mins
                      ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {mins === 0 ? '無休息' : `${mins}分`}
                </button>
              ))}
            </div>
          </div>

          {/* Real-time Calculation Breakdown Box */}
          <div className="bg-slate-950/70 rounded-xl p-3.5 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 border-b border-slate-800 pb-2">
              <span>工時與薪資試算：</span>
              <span className="text-emerald-400 text-sm">
                預估薪資 NT$ {breakdown.totalPay.toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-slate-900/90 p-2 rounded-lg">
                <div className="text-slate-400 text-[10px]">總總在班時數</div>
                <div className="font-semibold text-slate-200">{breakdown.grossHours} 小時</div>
              </div>

              <div className="bg-slate-900/90 p-2 rounded-lg">
                <div className="text-slate-400 text-[10px]">實際淨工時</div>
                <div className="font-bold text-blue-400">{breakdown.netHours} 小時</div>
              </div>

              <div className="bg-slate-900/90 p-2 rounded-lg">
                <div className="text-slate-400 text-[10px]">正常工時 (1.0x)</div>
                <div className="font-semibold text-emerald-400">{breakdown.regularHours}h</div>
              </div>

              <div className="bg-slate-900/90 p-2 rounded-lg">
                <div className="text-slate-400 text-[10px]">加班費 (1.34/1.67)</div>
                <div className="font-semibold text-amber-400">
                  {breakdown.overtimeHours1 + breakdown.overtimeHours2 > 0
                    ? `NT$ ${breakdown.overtimePay} (${breakdown.overtimeHours1 + breakdown.overtimeHours2}h)`
                    : '無加班'}
                </div>
              </div>
            </div>

            {settings.overtimeMode === 'taiwan' && (breakdown.overtimeHours1 > 0 || breakdown.overtimeHours2 > 0) && (
              <p className="text-[11px] text-amber-300/90 flex items-center gap-1 pt-1">
                <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                <span>
                  符合勞基法：前2小時加班以 1.34x (${Math.round(hourlyRate * 1.34)}/h)；第3小時起以 1.67x (${Math.round(hourlyRate * 1.67)}/h) 計算。
                </span>
              </p>
            )}
          </div>

          {/* Note */}
          <div>
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1 mb-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>備註事項 (選填)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例如：外送支援、代班、遲到扣時..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-800">
            {editingShift && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm('確定要刪除此筆班次紀錄嗎？')) {
                    onDelete(editingShift.id);
                    onClose();
                  }
                }}
                className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-semibold flex items-center space-x-1 transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>刪除</span>
              </button>
            ) : <div />}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs sm:text-sm font-medium transition"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-lg shadow-blue-600/30 transition"
              >
                {editingShift ? '更新儲存' : '確認儲存'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
