import React from 'react';
import { Camera, Calendar, Users, FileCheck, Clock, ChevronRight, CheckCircle2, AlertCircle, Plus, Sparkles } from 'lucide-react';
import { Employee, TimecardRecord, StoreSummary } from '../types';
import { formatHoursAndMinutes } from '../utils/calc';

interface HomeViewProps {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  employees: Employee[];
  timecards: TimecardRecord[];
  storeSummary: StoreSummary;
  onOpenCapture: () => void;
  onSelectEmployeeDetail: (employeeId: string) => void;
  onNavigateTab: (tab: 'home' | 'employees' | 'verify' | 'reports') => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  selectedMonth,
  setSelectedMonth,
  employees,
  timecards,
  storeSummary,
  onOpenCapture,
  onSelectEmployeeDetail,
  onNavigateTab,
}) => {
  // Parse month label "YYYY-MM" -> "2026年 8月"
  const safeMonth = selectedMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [yearStr, monthStr] = safeMonth.split('-');
  const displayYearMonth = `${yearStr}年 ${parseInt(monthStr, 10)}月`;

  // Calculate Month Prev / Next
  const handlePrevMonth = () => {
    const y = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);
    if (m === 1) {
      setSelectedMonth(`${y - 1}-12`);
    } else {
      setSelectedMonth(`${y}-${String(m - 1).padStart(2, '0')}`);
    }
  };

  const handleNextMonth = () => {
    const y = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);
    if (m === 12) {
      setSelectedMonth(`${y + 1}-01`);
    } else {
      setSelectedMonth(`${y}-${String(m + 1).padStart(2, '0')}`);
    }
  };

  // KPIs
  const totalEmployeesCount = employees.filter((e) => e.status === 'active').length;
  
  // Pending verify count for selected month
  const monthTimecards = timecards.filter((tc) => tc.yearMonth === selectedMonth);
  const pendingVerifyCount = monthTimecards.filter((tc) => tc.status === 'pending').length;
  const completedCount = monthTimecards.filter((tc) => tc.status === 'verified').length;

  // Total Hours calculation for Store
  const totalStoreHoursDisplay = formatHoursAndMinutes(storeSummary.totalNetHours);

  return (
    <div className="space-y-5 pb-20">
      {/* Date Header & Month Picker */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">統計月份</span>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-2 py-1 border border-slate-200/60">
          <button
            onClick={handlePrevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white text-slate-600 font-bold active:scale-95 transition-all"
            title="上個月"
          >
            ‹
          </button>
          <span className="text-sm font-bold text-slate-800 px-1">{displayYearMonth}</span>
          <button
            onClick={handleNextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white text-slate-600 font-bold active:scale-95 transition-all"
            title="下個月"
          >
            ›
          </button>
        </div>
      </div>

      {/* Prominent Action Button: 拍攝打卡卡 */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur-xs opacity-75 group-hover:opacity-100 transition duration-200"></div>
        <button
          onClick={onOpenCapture}
          className="relative w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-4 sm:p-5 shadow-md active:scale-[0.98] transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5 text-left">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-white shrink-0 shadow-inner">
              <Camera className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-extrabold tracking-tight">上傳 / 拍攝打卡卡</span>
              </div>
              <p className="text-xs text-blue-100 mt-0.5 font-medium">拍攝或上傳紙本卡即可試算當月時數與天數</p>
            </div>
          </div>
          <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-white shrink-0">
            <ChevronRight className="w-5 h-5" />
          </div>
        </button>
      </div>

      {/* Key Metric Overview Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total Month Hours */}
        <div className="col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-sm border border-slate-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-400" /> 本月總工時 (全店)
            </span>
            <button
              onClick={() => onNavigateTab('reports')}
              className="text-xs text-blue-400 font-semibold hover:underline flex items-center"
            >
              詳細報表 ›
            </button>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {storeSummary.totalHoursPart}
            </span>
            <span className="text-lg font-bold text-blue-400">時</span>
            <span className="text-3xl sm:text-4xl font-black text-white tracking-tight ml-1">
              {storeSummary.totalMinutesPart}
            </span>
            <span className="text-lg font-bold text-blue-400">分</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            共出勤 {storeSummary.totalShifts} 班次 · 預估總薪資估算 NT$ {storeSummary.totalPay.toLocaleString()}
          </p>
        </div>

        {/* Total Employees */}
        <div 
          onClick={() => onNavigateTab('employees')}
          className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs cursor-pointer hover:border-slate-300 transition-all active:scale-98"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold text-slate-500">員工總數</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-slate-900">{totalEmployeesCount}</span>
            <span className="text-xs text-slate-500 font-medium">人</span>
          </div>
          <span className="text-[10px] text-blue-600 font-semibold mt-1 inline-block">在職人員列表 ›</span>
        </div>

        {/* Pending Review */}
        <div 
          onClick={() => onNavigateTab('verify')}
          className={`rounded-2xl p-4 border shadow-xs cursor-pointer transition-all active:scale-98 ${
            pendingVerifyCount > 0 
              ? 'bg-rose-50/80 border-rose-200 text-rose-900 hover:bg-rose-100/80' 
              : 'bg-white border-slate-100 text-slate-900 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className={`text-xs font-bold ${pendingVerifyCount > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
              待核對卡片
            </span>
            <FileCheck className={`w-4 h-4 ${pendingVerifyCount > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className={`text-2xl font-black ${pendingVerifyCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {pendingVerifyCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">張</span>
          </div>
          <span className={`text-[10px] font-semibold mt-1 inline-block ${pendingVerifyCount > 0 ? 'text-rose-600 underline' : 'text-slate-500'}`}>
            {pendingVerifyCount > 0 ? '一鍵覆核與確認 ›' : '無待核對卡片'}
          </span>
        </div>

        {/* Completed Stats Count */}
        <div className="col-span-2 bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-slate-700 font-medium">本月已完成核對人數：</span>
            <span className="font-extrabold text-slate-900">{completedCount} / {totalEmployeesCount} 人</span>
          </div>
          <button 
            onClick={() => onNavigateTab('verify')}
            className="text-blue-600 font-bold text-xs hover:underline"
          >
            查看進度
          </button>
        </div>
      </div>

      {/* 員工本月工時簡易列表 (Requested Section) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">員工本月工時列表</h3>
            <p className="text-xs text-slate-400">依據累計工時排序 · 點擊查看個人打卡明細</p>
          </div>
          <span className="text-xs text-slate-400 font-medium">{displayYearMonth}</span>
        </div>

        <div className="divide-y divide-slate-100">
          {storeSummary.employeeSummaries.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              目前尚無員工資料，請點擊「新增員工」開始使用
            </div>
          ) : (
            storeSummary.employeeSummaries.map((empSum, idx) => {
            const shortName = empSum.employee.shortName || empSum.employee.name.slice(0, 2);
            const isVerified = empSum.verificationStatus === 'verified' || timecards.some((tc) => tc.employeeId === empSum.employee.id && tc.status === 'verified');
            
            return (
              <div
                key={empSum.employee.id || empSum.employee.employee_id || `home-emp-${idx}`}
                onClick={() => onSelectEmployeeDetail(empSum.employee.id)}
                className="py-3 flex items-center justify-between hover:bg-slate-50 rounded-xl px-2 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  {/* Short Name Avatar */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-xs shrink-0"
                    style={{ backgroundColor: empSum.employee.color || '#3b82f6' }}
                  >
                    {shortName}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{empSum.employee.name}</span>
                      <span className="text-xs font-semibold text-slate-400">({shortName})</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500">{empSum.employee.role}</span>
                      <span className="text-[11px] text-slate-400">· {empSum.totalDays} 天出勤</span>
                    </div>
                  </div>
                </div>

                {/* Hours Display (e.g. 278時26分) */}
                <div className="text-right">
                  <div className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    {empSum.totalHoursPart}
                    <span className="text-xs text-slate-500 font-normal">時</span>
                    {empSum.totalMinutesPart}
                    <span className="text-xs text-slate-500 font-normal">分</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-end gap-1">
                    {isVerified ? (
                      <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                        <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> 已完成
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                        <AlertCircle className="w-2.5 h-2.5 mr-0.5" /> 待核對
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        </div>
      </div>
    </div>
  );
};
