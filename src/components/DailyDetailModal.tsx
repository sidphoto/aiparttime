import React, { useState, useEffect } from 'react';
import { X, Clock, AlertTriangle, CheckCircle2, RefreshCw, Save, Calendar, Info } from 'lucide-react';
import { DailyWorkRecord, Employee } from '../types';
import {
  calculateDailyWorkRecord,
  formatMinutesToHoursAndMinutes,
  formatDateCN,
} from '../utils/calc';
import { TimeWheelPicker } from './TimeWheelPicker';

interface DailyDetailModalProps {
  record: DailyWorkRecord;
  employeeName: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedRecord: DailyWorkRecord) => void | Promise<void>;
  /** 提供時顯示員工選單（Header 快速補登用）；不提供則沿用 record.employee_id */
  employees?: Employee[];
}

export const DailyDetailModal: React.FC<DailyDetailModalProps> = ({
  record,
  employeeName,
  isOpen,
  onClose,
  onSave,
  employees,
}) => {
  const [clockIn1, setClockIn1] = useState(record.clock_in_1 || '');
  const [clockOut1, setClockOut1] = useState(record.clock_out_1 || '');
  const [clockIn2, setClockIn2] = useState(record.clock_in_2 || '');
  const [clockOut2, setClockOut2] = useState(record.clock_out_2 || '');
  const [isOvernight1, setIsOvernight1] = useState(record.is_overnight_1 ?? false);
  const [isOvernight2, setIsOvernight2] = useState(record.is_overnight_2 ?? false);
  const [status, setStatus] = useState(record.verification_status);
  const [workDate, setWorkDate] = useState(record.work_date);
  const [employeeId, setEmployeeId] = useState(record.employee_id);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state when record prop changes
  useEffect(() => {
    setWorkDate(record.work_date);
    setEmployeeId(record.employee_id);
    setErrorMessage(null);
    setClockIn1(record.clock_in_1 || '');
    setClockOut1(record.clock_out_1 || '');
    setClockIn2(record.clock_in_2 || '');
    setClockOut2(record.clock_out_2 || '');
    setIsOvernight1(record.is_overnight_1 ?? false);
    setIsOvernight2(record.is_overnight_2 ?? false);
    setStatus(record.verification_status);
  }, [record]);

  if (!isOpen) return null;

  // Real-time calculation of daily work record in minutes
  const computedRecord = calculateDailyWorkRecord({
    ...record,
    employee_id: employeeId,
    work_date: workDate,
    clock_in_1: clockIn1,
    clock_out_1: clockOut1,
    clock_in_2: clockIn2,
    clock_out_2: clockOut2,
    is_overnight_1: isOvernight1,
    is_overnight_2: isOvernight2,
    verification_status: status,
  });

  const isOvernightWarning1 = clockIn1 && clockOut1 && clockOut1 < clockIn1 && !isOvernight1;
  const isOvernightWarning2 = clockIn2 && clockOut2 && clockOut2 < clockIn2 && !isOvernight2;
  const isOvernightCandidate = isOvernightWarning1 || isOvernightWarning2;

  const handleConfirmOvernight = () => {
    if (isOvernightWarning1) setIsOvernight1(true);
    if (isOvernightWarning2) setIsOvernight2(true);
    setStatus('verified');
  };

  const handleSave = async () => {
    if (isSaving) return;
    setErrorMessage(null);

    if (!employeeId) {
      setErrorMessage('請先選擇員工。');
      return;
    }
    if (!workDate) {
      setErrorMessage('請先選擇工作日期。');
      return;
    }

    const finalRec: DailyWorkRecord = {
      ...computedRecord,
      employee_id: employeeId,
      work_date: workDate,
      verification_status: isOvernightCandidate ? 'needs_overnight_confirmation' : status,
      updated_at: new Date().toISOString(),
    };

    setIsSaving(true);
    try {
      // 等待實際寫入 Google Sheet；成功時由父層關閉 Modal
      await onSave(finalRec);
    } catch (err: any) {
      // 保留 Modal 並顯示 Server 實際錯誤，讓使用者修正後重試
      setErrorMessage(err?.message || '工時寫入失敗，請稍後再試。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
      <div className="bg-white text-slate-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                每日工時明細與核對
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {employeeName} · {workDate} ({formatDateCN(workDate)})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* 寫入失敗時顯示 Server 實際錯誤 */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 flex items-start space-x-2.5 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-bold text-rose-700">{errorMessage}</div>
            </div>
          )}

          {/* 員工選單（Header 快速補登時提供） */}
          {employees && employees.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5">
              <label
                htmlFor="work-employee-select"
                className="text-xs font-black text-slate-700"
              >
                補登對象
              </label>
              <select
                id="work-employee-select"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">請選擇員工</option>
                {employees.map((emp) => {
                  const empId = emp.employee_id || emp.id;
                  return (
                    <option key={empId} value={empId}>
                      {emp.name}（{empId}）
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* 工作日期（補登過往工時時必須可以指定） */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5">
            <label
              htmlFor="work-date-input"
              className="text-xs font-black text-slate-700 flex items-center space-x-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>工作日期</span>
            </label>
            <input
              id="work-date-input"
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Overnight Warning Alert */}
          {isOvernightCandidate && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start space-x-3 text-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <div className="font-black text-amber-900 text-sm">
                  可能為跨日班
                </div>
                <p className="text-amber-800 leading-relaxed font-medium">
                  偵測到下班時間早於上班時間。請確認該班次是否屬於隔日跨日班？
                </p>
                <button
                  type="button"
                  onClick={handleConfirmOvernight}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition active:scale-95"
                >
                  確認為跨日班 (+24小時)
                </button>
              </div>
            </div>
          )}

          {/* Period 1 (第一段上下班) */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-black text-slate-900 text-sm flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                <span>第一段上下班</span>
              </div>
              <div className="text-xs font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 font-mono">
                {computedRecord.period_1_minutes} 分鐘 ({formatMinutesToHoursAndMinutes(computedRecord.period_1_minutes)})
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <TimeWheelPicker
                  label="上班時間"
                  value={clockIn1}
                  onChange={setClockIn1}
                />
              </div>
              <div>
                <TimeWheelPicker
                  label="下班時間"
                  value={clockOut1}
                  onChange={setClockOut1}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <label className="flex items-center space-x-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isOvernight1}
                  onChange={(e) => setIsOvernight1(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>第一段是否為跨日班</span>
              </label>
            </div>
          </div>

          {/* Period 2 (第二段上下班 - 可選) */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-black text-slate-900 text-sm flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                <span>第二段上下班 (二度打卡/兩頭班)</span>
              </div>
              <div className="text-xs font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 font-mono">
                {computedRecord.period_2_minutes} 分鐘 ({formatMinutesToHoursAndMinutes(computedRecord.period_2_minutes)})
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <TimeWheelPicker
                  label="二段上班 (離峰重進)"
                  value={clockIn2}
                  onChange={setClockIn2}
                  placeholder="可空白"
                />
              </div>
              <div>
                <TimeWheelPicker
                  label="二段下班"
                  value={clockOut2}
                  onChange={setClockOut2}
                  placeholder="可空白"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <label className="flex items-center space-x-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isOvernight2}
                  onChange={(e) => setIsOvernight2(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>第二段是否為跨日班</span>
              </label>
            </div>
          </div>

          {/* Daily Total Calculation Card (當日總工時試算) */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-emerald-950 text-sm">
                當日總工時 (Total Minutes)
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
                {computedRecord.total_minutes} 分鐘
              </span>
            </div>

            <div className="flex items-baseline justify-between pt-1 border-t border-emerald-200/50">
              <span className="text-xs text-emerald-800 font-medium">
                即時試算結果 (UI 格式)
              </span>
              <span className="text-2xl font-black text-emerald-700 font-mono tracking-tight">
                {formatMinutesToHoursAndMinutes(computedRecord.total_minutes)}
              </span>
            </div>
          </div>

          {/* Verification Status Selector */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              資料審核狀態 (verification_status)
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
            >
              <option value="verified">已核對 (verified)</option>
              <option value="pending">待核對 (pending)</option>
              <option value="needs_overnight_confirmation">可能為跨日班 (needs_overnight_confirmation)</option>
              <option value="rejected">退回/無效 (rejected)</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 font-medium">
            最後更新時間：{new Date(record.updated_at || Date.now()).toLocaleTimeString()}
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 flex items-center space-x-1.5 transition"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? '寫入 Google Sheet 中…' : '儲存工時修改'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
