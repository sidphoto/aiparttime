import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  Clock,
  Users,
  TrendingUp,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Printer,
  Calendar,
  FileText,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { Employee, ShiftLog, StoreSettings, EmployeeSummary, DailyWorkRecord } from '../types';
import { getPayCyclePeriod, generateStoreSummary, formatCurrency, formatHoursAndMinutes, formatMinutesToHoursAndMinutes } from '../utils/calc';
import { downloadCSV, generateStoreSummaryCSV, generateEmployeePaySlipText } from '../utils/export';

interface ReportViewProps {
  employees: Employee[];
  shifts: ShiftLog[];
  settings: StoreSettings;
  dailyRecords?: DailyWorkRecord[];
  onOpenLineModal: () => void;
  onSelectEmployeeDetail?: (empId: string) => void;
}

export const ReportView: React.FC<ReportViewProps> = ({
  employees,
  shifts,
  settings,
  dailyRecords = [],
  onOpenLineModal,
  onSelectEmployeeDetail,
}) => {
  const today = new Date();
  const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const [selectedYearMonth, setSelectedYearMonth] = useState<string>('2026-08');
  const [selectedEmpPaySlip, setSelectedEmpPaySlip] = useState<EmployeeSummary | null>(null);
  const [copiedPaySlip, setCopiedPaySlip] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'chart'>('summary');

  // Navigate months
  const handlePrevMonth = () => {
    const [y, m] = selectedYearMonth.split('-').map(Number);
    let prevY = y;
    let prevM = m - 1;
    if (prevM < 1) {
      prevM = 12;
      prevY = y - 1;
    }
    setSelectedYearMonth(`${prevY}-${String(prevM).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedYearMonth.split('-').map(Number);
    let nextY = y;
    let nextM = m + 1;
    if (nextM > 12) {
      nextM = 1;
      nextY = y + 1;
    }
    setSelectedYearMonth(`${nextY}-${String(nextM).padStart(2, '0')}`);
  };

  // Pay cycle calculation
  const period = useMemo(() => {
    return getPayCyclePeriod(selectedYearMonth, settings.payCycleStartDay);
  }, [selectedYearMonth, settings.payCycleStartDay]);

  // Generate Store Summary
  const storeSummary = useMemo(() => {
    return generateStoreSummary(
      employees,
      shifts,
      period.startDate,
      period.endDate,
      period.label
    );
  }, [employees, shifts, period]);

  // Monthly Store Stats from dailyRecords
  const monthStoreStats = useMemo(() => {
    const recordsInMonth = dailyRecords.filter((r) => r.work_date.startsWith(selectedYearMonth));

    const empStatsMap = employees.map((emp) => {
      const empRecs = recordsInMonth.filter(
        (r) =>
          r.employee_id === emp.id ||
          r.employee_id === emp.employee_id ||
          r.employee_id === emp.employeeNo
      );

      let totalMins = empRecs.reduce((acc, r) => acc + (r.total_minutes || 0), 0);
      let attendanceDays = new Set(empRecs.map((r) => r.work_date)).size;
      let pendingCount = empRecs.filter(
        (r) => r.verification_status === 'pending' || r.verification_status === 'needs_overnight_confirmation'
      ).length;



      return {
        employee: emp,
        attendanceDays,
        totalMinutes: totalMins,
        formattedHours: formatMinutesToHoursAndMinutes(totalMins),
        pendingCount,
      };
    });

    const storeMins = empStatsMap.reduce((acc, e) => acc + e.totalMinutes, 0);
    const storePending = empStatsMap.reduce((acc, e) => acc + e.pendingCount, 0);

    return {
      totalEmployees: employees.length,
      storeTotalMinutes: storeMins,
      storeFormattedHours: formatMinutesToHoursAndMinutes(storeMins),
      storePendingCount: storePending,
      employeeStats: empStatsMap,
    };
  }, [employees, dailyRecords, selectedYearMonth]);

  // Chart Data: Daily breakdown across the period
  const dailyChartData = useMemo(() => {
    const dailyMap = new Map<string, { date: string; dayLabel: string; netHours: number; totalPay: number; shiftsCount: number }>();

    // Collect all dates in period
    const start = new Date(period.startDate);
    const end = new Date(period.endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const monthDay = `${d.getMonth() + 1}/${d.getDate()}`;
      dailyMap.set(dateStr, { date: dateStr, dayLabel: monthDay, netHours: 0, totalPay: 0, shiftsCount: 0 });
    }

    shifts.forEach((s) => {
      if (s.date >= period.startDate && s.date <= period.endDate) {
        const item = dailyMap.get(s.date);
        if (item) {
          item.netHours += s.totalNetHours;
          item.totalPay += s.totalPay;
          item.shiftsCount += 1;
        }
      }
    });

    return Array.from(dailyMap.values()).map((item) => ({
      ...item,
      netHours: Math.round(item.netHours * 10) / 10,
    }));
  }, [shifts, period]);

  // Export CSV
  const handleExportCSV = () => {
    const csvContent = generateStoreSummaryCSV(storeSummary, settings.storeName);
    const filename = `${settings.storeName}_工時與薪資報表_${selectedYearMonth}.csv`;
    downloadCSV(filename, csvContent);
  };

  // Copy individual pay slip
  const handleCopySinglePaySlip = (empSummary: EmployeeSummary) => {
    const slipText = generateEmployeePaySlipText(empSummary, period.label, settings.storeName);
    navigator.clipboard.writeText(slipText);
    setCopiedPaySlip(true);
    setTimeout(() => setCopiedPaySlip(false), 2000);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Month & Pay Cycle Selector Bar */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <button
            onClick={handlePrevMonth}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition"
            title="上個月"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
            <input
              type="month"
              value={selectedYearMonth}
              onChange={(e) => setSelectedYearMonth(e.target.value)}
              className="bg-transparent text-slate-900 text-sm font-bold focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={handleNextMonth}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition"
            title="下個月"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <span className="text-xs text-slate-400 font-medium hidden sm:inline-block">
            {period.label}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={onOpenLineModal}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 transition active:scale-95"
          >
            <MessageSquare className="w-4 h-4" />
            <span>LINE 群組報表</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>匯出 CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs transition"
            title="列印此報表"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metric Summary Cards (最上方顯示：員工人數、全店總工時、待核對數量) */}
      <div className="grid grid-cols-3 gap-3">
        {/* 員工人數 */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-bold">員工人數</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
            {monthStoreStats.totalEmployees} <span className="text-xs font-normal text-slate-500">人</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            門市編制員工數
          </div>
        </div>

        {/* 全店總工時 */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-bold">全店總工時</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-900 tracking-tight font-mono">
            {monthStoreStats.storeFormattedHours}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            累計 {monthStoreStats.storeTotalMinutes} 分鐘
          </div>
        </div>

        {/* 待核對數量 */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-bold">待核對數量</span>
            <div className={`p-1.5 rounded-lg ${monthStoreStats.storePendingCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
            {monthStoreStats.storePendingCount} <span className="text-xs font-normal text-slate-500">筆</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            待主管確認與核對
          </div>
        </div>
      </div>

      {/* Tabs for Table vs Daily Chart */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                activeTab === 'summary'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 bg-slate-100'
              }`}
            >
              全店月份統計表
            </button>
            <button
              onClick={() => setActiveTab('chart')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                activeTab === 'chart'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 bg-slate-100'
              }`}
            >
              每日工時趨勢圖
            </button>
          </div>
        </div>

        {/* Tab 1: All-Store Monthly Summary Table */}
        {activeTab === 'summary' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 text-xs font-bold">
                  <th className="py-3 px-4">員工</th>
                  <th className="py-3 px-3 text-center">出勤</th>
                  <th className="py-3 px-3 text-right">總工時</th>
                  <th className="py-3 px-4 text-center">待核對</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-mono">
                {monthStoreStats.employeeStats.map((empStat, idx) => {
                  const emp = empStat.employee;
                  const shortName = emp.shortName || emp.name;

                  return (
                    <tr
                      key={emp.id ? `${emp.id}-${idx}` : `rep-emp-${idx}`}
                      onClick={() => onSelectEmployeeDetail && onSelectEmployeeDetail(emp.id)}
                      className="hover:bg-blue-50/60 transition text-slate-800 cursor-pointer"
                    >
                      {/* 員工 */}
                      <td className="py-3.5 px-4 font-bold font-sans">
                        <div className="flex items-center space-x-2.5">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0 shadow-xs"
                            style={{ backgroundColor: emp.color || '#3b82f6' }}
                          >
                            {shortName}
                          </div>
                          <div>
                            <div className="text-slate-900 font-extrabold">{emp.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {emp.employeeNo || emp.employee_id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 出勤 */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="font-extrabold text-slate-900">{empStat.attendanceDays}天</span>
                      </td>

                      {/* 總工時 */}
                      <td className="py-3.5 px-3 text-right font-black text-slate-900 text-base">
                        {empStat.formattedHours}
                      </td>

                      {/* 待核對 */}
                      <td className="py-3.5 px-4 text-center font-bold">
                        {empStat.pendingCount > 0 ? (
                          <span className="px-2.5 py-0.5 text-xs bg-amber-100 text-amber-800 rounded-full font-black">
                            {empStat.pendingCount}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {monthStoreStats.employeeStats.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400 text-sm font-sans">
                      選取月份尚無工時資料。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Daily Chart */}
        {activeTab === 'chart' && (
          <div className="p-5">
            <h3 className="text-xs font-bold text-slate-500 mb-3">
              【{period.label}】每日門市排班工時 (小時) 統計圖表
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                  <XAxis dataKey="dayLabel" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '12px',
                      color: '#0f172a',
                      fontSize: '12px',
                    }}
                    formatter={(value: any) => [`${value} 小時`, '總工時']}
                    labelFormatter={(label) => `日期: ${label}`}
                  />
                  <Bar dataKey="netHours" fill="#2563eb" radius={[4, 4, 0, 0]} name="門市總工時">
                    {dailyChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.netHours > 12 ? '#f59e0b' : '#2563eb'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Single Employee Pay Slip Drawer / Modal */}
      {selectedEmpPaySlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white text-slate-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-5 space-y-4 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-slate-900 text-base">個人薪資試算單</h3>
              </div>
              <button
                onClick={() => setSelectedEmpPaySlip(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 font-mono text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
              {generateEmployeePaySlipText(selectedEmpPaySlip, period.label, settings.storeName)}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setSelectedEmpPaySlip(null)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold"
              >
                關閉
              </button>
              <button
                onClick={() => handleCopySinglePaySlip(selectedEmpPaySlip)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1 shadow-xs"
              >
                {copiedPaySlip ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPaySlip ? '已複製薪資單' : '複製文字傳發'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

