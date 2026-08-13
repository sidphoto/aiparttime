import React, { useState } from 'react';
import { X, Sparkles, Check, Users, Calendar } from 'lucide-react';
import { Employee, ShiftPreset, ShiftLog, StoreSettings } from '../types';
import { calculateShiftBreakdown } from '../utils/calc';
import { TimeWheelPicker } from './TimeWheelPicker';

interface BatchShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveBatch: (newShifts: Omit<ShiftLog, 'id' | 'createdAt'>[]) => void;
  employees: Employee[];
  presets: ShiftPreset[];
  settings: StoreSettings;
}

export const BatchShiftModal: React.FC<BatchShiftModalProps> = ({
  isOpen,
  onClose,
  onSaveBatch,
  employees,
  presets,
  settings,
}) => {
  const activeEmployees = employees.filter((e) => e.status === 'active');
  const todayStr = new Date().toISOString().split('T')[0];

  const [date, setDate] = useState<string>(todayStr);
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(presets[0]?.id || '');
  const [startTime, setStartTime] = useState<string>(presets[0]?.startTime || '09:00');
  const [endTime, setEndTime] = useState<string>(presets[0]?.endTime || '18:00');
  const [breakMinutes, setBreakMinutes] = useState<number>(presets[0]?.breakMinutes || 60);

  if (!isOpen) return null;

  const toggleSelectEmp = (id: string) => {
    setSelectedEmpIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllEmps = () => {
    if (selectedEmpIds.length === activeEmployees.length) {
      setSelectedEmpIds([]);
    } else {
      setSelectedEmpIds(activeEmployees.map((e) => e.id));
    }
  };

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = presets.find((p) => p.id === presetId);
    if (preset) {
      setStartTime(preset.startTime);
      setEndTime(preset.endTime);
      setBreakMinutes(preset.breakMinutes);
    }
  };

  const handleBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmpIds.length === 0) {
      alert('請至少勾選一位同仁');
      return;
    }

    const batchShifts: Omit<ShiftLog, 'id' | 'createdAt'>[] = [];

    selectedEmpIds.forEach((empId) => {
      const emp = employees.find((e) => e.id === empId);
      const hourlyRate = emp ? emp.hourlyRate : settings.defaultHourlyRate;
      const breakdown = calculateShiftBreakdown(
        startTime,
        endTime,
        breakMinutes,
        hourlyRate,
        settings
      );

      batchShifts.push({
        employeeId: empId,
        date,
        startTime,
        endTime,
        breakMinutes: Number(breakMinutes) || 0,
        hourlyRate,
        regularHours: breakdown.regularHours,
        overtimeHours1: breakdown.overtimeHours1,
        overtimeHours2: breakdown.overtimeHours2,
        totalNetHours: breakdown.netHours,
        regularPay: breakdown.regularPay,
        overtimePay: breakdown.overtimePay,
        totalPay: breakdown.totalPay,
        note: '批次登記班表',
      });
    });

    onSaveBatch(batchShifts);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white">批次快速登記多人員工時</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleBatchSubmit} className="p-5 overflow-y-auto space-y-4">
          {/* Date Picker */}
          <div>
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span>排班日期</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Preset templates */}
          {presets.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                選擇班別時段：
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p.id)}
                    className={`px-2.5 py-2 text-xs rounded-xl border font-medium text-left transition flex flex-col justify-between ${
                      selectedPresetId === p.id
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span className="font-bold">{p.name}</span>
                    <span className="text-[10px] text-slate-400">{p.startTime} ~ {p.endTime}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Time & Break fine tuning */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
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
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">扣除休息(分)</label>
              <input
                type="number"
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
              />
            </div>
          </div>

          {/* Employee checkboxes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-400" />
                <span>選擇套用此班別的人員 ({selectedEmpIds.length}/{activeEmployees.length}):</span>
              </label>
              <button
                type="button"
                onClick={selectAllEmps}
                className="text-xs text-blue-400 hover:underline"
              >
                {selectedEmpIds.length === activeEmployees.length ? '取消全選' : '全選所有人員'}
              </button>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {activeEmployees.map((emp, idx) => {
                const isChecked = selectedEmpIds.includes(emp.id);
                return (
                  <div
                    key={emp.id ? `${emp.id}-${idx}` : `batch-emp-${idx}`}
                    onClick={() => toggleSelectEmp(emp.id)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                      isChecked
                        ? 'bg-blue-600/15 border-blue-500/50 text-white'
                        : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: emp.color || '#3b82f6' }}
                      />
                      <span className="font-semibold text-sm">{emp.name}</span>
                      <span className="text-xs text-slate-400">({emp.role})</span>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                        isChecked
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'border-slate-600 bg-slate-900'
                      }`}
                    >
                      {isChecked && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={selectedEmpIds.length === 0}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition flex items-center space-x-1.5"
            >
              <Sparkles className="w-4 h-4" />
              <span>新增 {selectedEmpIds.length} 筆工時紀錄</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
