import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  User,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { Employee, ShiftLog, ShiftPreset, StoreSettings } from '../types';
import { formatDateCN, calculateGrossHours } from '../utils/calc';

interface ShiftsViewProps {
  employees: Employee[];
  shifts: ShiftLog[];
  presets: ShiftPreset[];
  settings: StoreSettings;
  onOpenAddShift: (defaultDate?: string) => void;
  onEditShift: (shift: ShiftLog) => void;
  onDeleteShift: (shiftId: string) => void;
  onOpenBatchAdd: () => void;
}

export const ShiftsView: React.FC<ShiftsViewProps> = ({
  employees,
  shifts,
  presets,
  settings,
  onOpenAddShift,
  onEditShift,
  onDeleteShift,
  onOpenBatchAdd,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [filterEmpId, setFilterEmpId] = useState<string>('all');

  // Generate 7-day date strip around selectedDate
  const dateStrip = useMemo(() => {
    const dates: { dateStr: string; dayNum: string; dayName: string; isToday: boolean }[] = [];
    const curr = new Date(selectedDate);
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];

    for (let i = -3; i <= 3; i++) {
      const d = new Date(curr);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      dates.push({
        dateStr,
        dayNum: `${d.getDate()}`,
        dayName: dayNames[d.getDay()],
        isToday: dateStr === todayStr,
      });
    }
    return dates;
  }, [selectedDate, todayStr]);

  // Navigate single day
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // Daily shifts
  const dailyShifts = useMemo(() => {
    return shifts.filter((s) => {
      const matchDate = s.date === selectedDate;
      const matchEmp = filterEmpId === 'all' || s.employeeId === filterEmpId;
      return matchDate && matchEmp;
    });
  }, [shifts, selectedDate, filterEmpId]);

  // Daily store totals
  const dailyTotals = useMemo(() => {
    let hours = 0;
    let pay = 0;
    dailyShifts.forEach((s) => {
      hours += s.totalNetHours;
      pay += s.totalPay;
    });
    return {
      hours: Math.round(hours * 10) / 10,
      pay,
      count: dailyShifts.length,
    };
  }, [dailyShifts]);

  return (
    <div className="space-y-4 pb-20 animate-fade-in">
      {/* Date Navigation & Calendar Picker */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrevDay}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
              <CalendarIcon className="w-4 h-4 text-blue-400 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-white text-sm font-bold focus:outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={handleNextDay}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {selectedDate !== todayStr && (
              <button
                onClick={() => setSelectedDate(todayStr)}
                className="px-2.5 py-1.5 bg-blue-600/20 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-semibold hover:bg-blue-600/30 transition"
              >
                回到今天
              </button>
            )}

            <button
              onClick={() => onOpenAddShift(selectedDate)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-600/20 flex items-center space-x-1 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>新增此日工時</span>
            </button>
          </div>
        </div>

        {/* 7-Day Date Strip Picker */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 pt-1">
          {dateStrip.map((item) => {
            const isSelected = item.dateStr === selectedDate;
            const hasShift = shifts.some((s) => s.date === item.dateStr);

            return (
              <button
                key={item.dateStr}
                onClick={() => setSelectedDate(item.dateStr)}
                className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center transition ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'bg-slate-950/60 hover:bg-slate-800 text-slate-300 border border-slate-800/80'
                }`}
              >
                <span className="text-[10px] opacity-80">週{item.dayName}</span>
                <span className="text-base font-bold my-0.5">{item.dayNum}</span>
                <div className="flex items-center space-x-1">
                  {item.isToday && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-amber-300' : 'bg-blue-400'}`} />
                  )}
                  {hasShift && !item.isToday && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-400'}`} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Daily Overview Stats Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-900/40 rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs text-indigo-300 font-semibold mb-0.5 flex items-center gap-1.5">
            <span>{formatDateCN(selectedDate)}</span>
            <span className="text-slate-500">•</span>
            <span>當日門市總概況</span>
          </div>
          <div className="flex items-baseline space-x-3 text-white">
            <div>
              <span className="text-xl sm:text-2xl font-black text-blue-400">{dailyTotals.hours}</span>
              <span className="text-xs text-slate-400 ml-1">總淨工時 (小時)</span>
            </div>
            <div className="text-slate-600">|</div>
            <div>
              <span className="text-xl sm:text-2xl font-black text-emerald-400">NT$ {dailyTotals.pay.toLocaleString()}</span>
              <span className="text-xs text-slate-400 ml-1">當日工時預估成本</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Employee Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs text-slate-300">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterEmpId}
              onChange={(e) => setFilterEmpId(e.target.value)}
              className="bg-transparent text-white focus:outline-none cursor-pointer"
            >
              <option value="all">全體同仁 ({employees.length})</option>
              {employees.map((emp, idx) => (
                <option key={emp.id ? `${emp.id}-${idx}` : `shift-emp-${idx}`} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Visual Shift Coverage Timeline Bar (08:00 - 24:00) */}
      {dailyShifts.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-300">當日全天班表覆蓋時間軸</span>
            <span>8:00 ~ 24:00 門市班次分布</span>
          </div>

          <div className="relative h-12 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center px-2">
            {/* Hour lines */}
            <div className="absolute inset-0 grid grid-cols-8 gap-0 opacity-15 pointer-events-none">
              {[8, 10, 12, 14, 16, 18, 20, 22].map((h) => (
                <div key={h} className="border-r border-slate-400 text-[9px] text-slate-400 pl-1 pt-0.5">
                  {h}:00
                </div>
              ))}
            </div>

            {/* Shift blocks overlay */}
            <div className="relative w-full h-8 flex flex-col justify-center gap-1">
              {dailyShifts.map((shift) => {
                const emp = employees.find((e) => e.id === shift.employeeId);
                const [sH, sM] = shift.startTime.split(':').map(Number);
                const [eH, eM] = shift.endTime.split(':').map(Number);

                const startMins = sH * 60 + sM;
                let endMins = eH * 60 + eM;
                if (endMins < startMins) endMins += 24 * 60; // cross midnight

                const dayStartMins = 8 * 60; // 08:00
                const dayTotalMins = 16 * 60; // 16 hours window (8:00 to 24:00)

                const leftPercent = Math.max(0, Math.min(100, ((startMins - dayStartMins) / dayTotalMins) * 100));
                const widthPercent = Math.max(3, Math.min(100 - leftPercent, ((endMins - startMins) / dayTotalMins) * 100));

                return (
                  <div
                    key={shift.id}
                    onClick={() => onEditShift(shift)}
                    className="h-6 rounded-md px-2 flex items-center text-[10px] font-bold text-white shadow-sm cursor-pointer hover:brightness-125 transition truncate"
                    style={{
                      marginLeft: `${leftPercent}%`,
                      width: `${widthPercent}%`,
                      backgroundColor: emp?.color || '#3b82f6',
                    }}
                    title={`${emp?.name}: ${shift.startTime}~${shift.endTime} (${shift.totalNetHours}h)`}
                  >
                    <span className="truncate">{emp?.name} ({shift.startTime}~{shift.endTime})</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Shift Logs List */}
      <div className="space-y-3">
        {dailyShifts.map((shift) => {
          const emp = employees.find((e) => e.id === shift.employeeId);
          const hasOT = shift.overtimeHours1 + shift.overtimeHours2 > 0;

          return (
            <div
              key={shift.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-lg transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              {/* Left Info: Employee Avatar & Time */}
              <div className="flex items-start space-x-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md"
                  style={{ backgroundColor: emp?.color || '#3b82f6' }}
                >
                  {emp?.name.substring(0, 1) || '員'}
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="font-bold text-white text-base">{emp?.name || '未知員工'}</h4>
                    <span className="px-2 py-0.5 text-[11px] font-medium bg-slate-800 text-slate-300 rounded-md border border-slate-700">
                      {emp?.role}
                    </span>
                    {hasOT && (
                      <span className="px-2 py-0.5 text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md">
                        含加班
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-400 mt-1 flex items-center space-x-2">
                    <span className="font-mono text-slate-200 font-semibold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {shift.startTime} ~ {shift.endTime}
                    </span>
                    {shift.breakMinutes > 0 && (
                      <span className="text-slate-500">
                        (扣除休息 {shift.breakMinutes}分)
                      </span>
                    )}
                  </div>

                  {shift.note && (
                    <p className="text-xs text-indigo-300 mt-1">
                      💬 備註: {shift.note}
                    </p>
                  )}
                </div>
              </div>

              {/* Right Info: Hours & Wage Breakdown */}
              <div className="flex items-center justify-between sm:justify-end space-x-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                <div className="text-right">
                  <div className="text-xs text-slate-400">當班淨工時</div>
                  <div className="font-black text-blue-400 text-lg font-mono">
                    {shift.totalNetHours} <span className="text-xs font-normal">小時</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-400">當班預估薪資</div>
                  <div className="font-black text-emerald-400 text-lg font-mono">
                    NT$ {shift.totalPay.toLocaleString()}
                  </div>
                </div>

                {/* Edit & Delete Actions */}
                <div className="flex items-center space-x-1 pl-2">
                  <button
                    onClick={() => onEditShift(shift)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
                    title="編輯此工時"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('確定要刪除這筆打卡工時紀錄嗎？')) {
                        onDeleteShift(shift.id);
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition"
                    title="刪除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Empty State */}
        {dailyShifts.length === 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base">此日期尚無打卡與工時紀錄</h3>
              <p className="text-xs text-slate-400 mt-1">
                點擊下方按鈕，為 {formatDateCN(selectedDate)} 登記人員上班工時。
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-2">
              <button
                onClick={() => onOpenAddShift(selectedDate)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/30 transition flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>單筆登記工時</span>
              </button>
              <button
                onClick={onOpenBatchAdd}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>批次多人登記</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
