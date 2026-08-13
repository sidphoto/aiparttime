import React, { useState } from 'react';
import {
  Users,
  Plus,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Edit2,
  Trash2,
  X,
  Search,
  FileText,
  UserCheck,
  UserX,
  AlertTriangle,
  Sliders,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import {
  Employee,
  RoleType,
  ShiftLog,
  StoreSettings,
  TimecardRecord,
  DailyWorkRecord,
} from '../types';
import { DailyDetailModal } from './DailyDetailModal';
import {
  formatMinutesToHoursAndMinutes,
  formatDateCN,
  calculateDailyWorkRecord,
} from '../utils/calc';

interface EmployeeViewProps {
  employees: Employee[];
  shifts: ShiftLog[];
  timecards?: TimecardRecord[];
  dailyRecords?: DailyWorkRecord[];
  settings: StoreSettings;
  onAddEmployee: (emp: Omit<Employee, 'id' | 'createdAt'>) => void;
  onUpdateEmployee: (emp: Employee) => void;
  onDeleteEmployee: (empId: string) => void;
  onUpdateDailyRecord?: (updatedRecord: DailyWorkRecord) => void;
  onSyncEmployees?: () => Promise<void>;
}

const COLOR_OPTIONS = [
  '#2563eb', // Blue
  '#059669', // Emerald
  '#d97706', // Amber
  '#7c3aed', // Purple
  '#ec4899', // Pink
  '#0284c7', // Sky
  '#ea580c', // Orange
  '#4f46e5', // Indigo
];

export const EmployeeView: React.FC<EmployeeViewProps> = ({
  employees,
  shifts,
  timecards = [],
  dailyRecords = [],
  settings,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onUpdateDailyRecord,
  onSyncEmployees,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>('2026/08');

  // Add / Edit Employee Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [deletingEmp, setDeletingEmp] = useState<Employee | null>(null);

  // Daily Work Record Modal State
  const [selectedDailyRecord, setSelectedDailyRecord] = useState<DailyWorkRecord | null>(null);

  // Form states for Add / Edit Employee
  const [name, setName] = useState('');
  const [hireDate, setHireDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [role, setRole] = useState<RoleType>('兼職工讀');
  const [hourlyRate, setHourlyRate] = useState<number>(settings.defaultHourlyRate);

  // Submitting & Toast notification states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleManualSheetSync = async () => {
    if (!onSyncEmployees) return;
    setIsSyncingSheet(true);
    try {
      await onSyncEmployees();
      showToast('已完成與 Google Sheet 同步！', 'success');
    } catch (err: any) {
      showToast('同步失敗，請稍後再試。', 'error');
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Auto-generate next employee_id (e.g. E001, E002, E003...)
  const generateNextEmployeeId = () => {
    let maxNum = 0;
    employees.forEach((emp) => {
      const code = emp.employee_id || emp.employeeNo || '';
      const match = code.match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `E${String(maxNum + 1).padStart(3, '0')}`;
  };

  const openAddModal = () => {
    setEditingEmp(null);
    setName('');
    setHireDate(new Date().toISOString().split('T')[0]);
    setNote('');
    setStatus('active');
    setRole('兼職工讀');
    setHourlyRate(settings.defaultHourlyRate);
    setIsAddModalOpen(true);
  };

  const openEditModal = (emp: Employee, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingEmp(emp);
    setName(emp.name);
    setHireDate(emp.hire_date || new Date().toISOString().split('T')[0]);
    setNote(emp.note || '');
    setStatus(emp.status);
    setRole(emp.role || '兼職工讀');
    setHourlyRate(emp.hourlyRate || settings.defaultHourlyRate);
    setIsAddModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingEmp) return;
    const targetId = deletingEmp.employee_id || deletingEmp.employeeNo || deletingEmp.id;
    try {
      await onDeleteEmployee(targetId);
      showToast(`已成功刪除員工「${deletingEmp.name}」`, 'success');
      if (selectedEmp?.id === deletingEmp.id || selectedEmp?.employee_id === targetId || selectedEmp?.employeeNo === targetId) {
        setSelectedEmp(null);
      }
    } catch (err) {
      showToast('刪除員工失敗，請稍後再試', 'error');
    } finally {
      setDeletingEmp(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('請輸入員工姓名', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingEmp) {
        const updated: Employee = {
          ...editingEmp,
          name: name.trim(),
          hire_date: hireDate,
          note: note.trim(),
          status,
          isActive: status === 'active',
          role,
          hourlyRate: Number(hourlyRate) || settings.defaultHourlyRate,
        };
        await onUpdateEmployee(updated);
        if (selectedEmp?.id === editingEmp.id) {
          setSelectedEmp(updated);
        }
        showToast('員工資料已成功更新！', 'success');
      } else {
        const autoId = generateNextEmployeeId();
        const newEmpData: Omit<Employee, 'id' | 'createdAt'> = {
          employee_id: autoId,
          employeeNo: autoId,
          name: name.trim(),
          shortName: name.trim().slice(-2),
          role,
          hourlyRate: Number(hourlyRate) || settings.defaultHourlyRate,
          color: COLOR_OPTIONS[employees.length % COLOR_OPTIONS.length],
          status,
          isActive: status === 'active',
          hire_date: hireDate,
          note: note.trim(),
          created_at: new Date().toISOString().split('T')[0],
        };
        await onAddEmployee(newEmpData);
        showToast('員工新增成功！', 'success');
      }
      setIsAddModalOpen(false);
    } catch (err: any) {
      console.error('Save employee error:', err);
      showToast(err.message || '無法連接 Google Sheet，請稍後再試。', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate monthly stats for an employee
  const getEmployeeMonthStats = (emp: Employee, yearMonth: string) => {
    // Filter daily records for this employee in this yearMonth
    const empRecords = dailyRecords.filter(
      (r) =>
        (r.employee_id === emp.id ||
          r.employee_id === emp.employee_id ||
          r.employee_id === emp.employeeNo) &&
        r.work_date.startsWith(yearMonth)
    );

    let totalMinutesSum = empRecords.reduce((acc, r) => acc + (r.total_minutes || 0), 0);
    const attendanceDays = new Set(empRecords.map((r) => r.work_date)).size;
    const verifiedCount = empRecords.filter((r) => r.verification_status === 'verified').length;
    const pendingCardsCount = empRecords.filter((r) => r.verification_status === 'pending').length;
    const abnormalCount = empRecords.filter(
      (r) => r.verification_status === 'needs_overnight_confirmation' || r.verification_status === 'rejected'
    ).length;



    const formatted = formatMinutesToHoursAndMinutes(totalMinutesSum);

    return {
      formatted,
      totalMinutesSum,
      attendanceDays,
      verifiedCount,
      pendingCardsCount,
      abnormalCount,
      hasRecords: totalMinutesSum > 0,
      records: empRecords,
    };
  };

  // Filtered employees list
  const filteredEmployees = employees.filter((emp) => {
    const code = (emp.employee_id || emp.employeeNo || '').toLowerCase();
    const q = searchTerm.toLowerCase();
    return emp.name.toLowerCase().includes(q) || code.includes(q);
  });

  // Current year-month string "2026-08"
  const currentYM = '2026-08';

  // Render Employee Detail View Helper
  const renderEmployeeDetail = (emp: Employee) => {
    const empId = emp.employee_id || emp.employeeNo || 'E001';
    const currentMonthStats = getEmployeeMonthStats(emp, currentYM);

    return (
      <div className="space-y-4">
        {/* Top Back Navigation Bar */}
        <div className="flex items-center justify-between bg-white border border-slate-100 rounded-2xl p-3 shadow-xs">
          <button
            onClick={() => setSelectedEmp(null)}
            className="flex items-center space-x-1 text-slate-700 hover:text-slate-900 font-bold text-sm bg-slate-100 px-3 py-1.5 rounded-xl transition active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回員工列表</span>
          </button>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={(e) => openEditModal(selectedEmp, e)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1"
              title="編輯基本資料"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>編輯</span>
            </button>
            <button
              onClick={() => setDeletingEmp(selectedEmp)}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition flex items-center space-x-1"
              title="刪除員工"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>刪除</span>
            </button>
          </div>
        </div>

        {/* Employee Profile Header Card */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3.5">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-xs shrink-0"
                style={{ backgroundColor: selectedEmp.color || '#2563eb' }}
              >
                {selectedEmp.shortName || selectedEmp.name.slice(-2)}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    {selectedEmp.name}
                  </h2>
                  <span className="text-xs font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60 font-mono">
                    {empId}
                  </span>
                </div>

                <div className="flex items-center space-x-2 mt-1">
                  {selectedEmp.status === 'active' ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 text-xs font-bold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200/60">
                      <UserCheck className="w-3 h-3" />
                      <span>在職中</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 text-xs font-bold bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                      <UserX className="w-3 h-3" />
                      <span>停用 / 離職</span>
                    </span>
                  )}
                  {selectedEmp.role && (
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                      {selectedEmp.role}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Details Table */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
            <div>
              <span className="text-slate-400 font-medium block">員工編號</span>
              <span className="font-mono font-bold text-slate-900 text-sm">{empId}</span>
            </div>
            <div>
              <span className="text-slate-400 font-medium block">到職日期</span>
              <span className="font-bold text-slate-900 text-sm">
                {selectedEmp.hire_date || '未紀錄'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-medium block">約定時薪</span>
              <span className="font-mono font-bold text-emerald-600 text-sm">
                NT$ {selectedEmp.hourlyRate || settings.defaultHourlyRate}/小時
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-medium block">本月待核對打卡</span>
              <span className="font-bold text-amber-600 text-sm">
                {currentMonthStats.pendingCardsCount} 筆
              </span>
            </div>
          </div>

          {selectedEmp.note && (
            <div className="text-xs text-slate-600 bg-amber-50/60 border border-amber-100 p-3 rounded-xl">
              <span className="font-bold text-amber-800">備註：</span> {selectedEmp.note}
            </div>
          )}
        </div>

        {/* Monthly Work Hours Section (員工月份頁) */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs space-y-4">
          {/* Header with Employee Short Name / Full Name & Selected Month */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="text-xl font-black text-slate-900 tracking-tight">
                {selectedEmp.shortName || selectedEmp.name}
              </div>
              <div className="text-sm font-extrabold text-blue-600 font-mono mt-0.5">
                2026 年 8 月
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  const newRec = calculateDailyWorkRecord({
                    employee_id: selectedEmp.id,
                    work_date: '2026-08-06',
                    clock_in_1: '09:00',
                    clock_out_1: '18:00',
                    verification_status: 'verified',
                    source: 'manual',
                  });
                  setSelectedDailyRecord(newRec);
                }}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl transition flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新增打卡紀錄</span>
              </button>
            </div>
          </div>

          {/* 5 Key Metric Cards for Employee Month */}
          {(() => {
            const currentMonthStats = getEmployeeMonthStats(selectedEmp, '2026-08');
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {/* 本月總工時 */}
                  <div className="bg-blue-50/70 border border-blue-100 p-3 rounded-2xl col-span-2 sm:col-span-1">
                    <div className="text-[11px] font-bold text-blue-600">本月總工時</div>
                    <div className="text-xl font-black text-blue-900 font-mono mt-0.5">
                      {currentMonthStats.formatted}
                    </div>
                    <div className="text-[10px] text-blue-600/80 mt-0.5 font-mono">
                      (累計 {currentMonthStats.totalMinutesSum} 分鐘)
                    </div>
                  </div>

                  {/* 出勤天數 */}
                  <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl">
                    <div className="text-[11px] font-bold text-slate-500">出勤天數</div>
                    <div className="text-lg font-black text-slate-800 font-mono mt-0.5">
                      {currentMonthStats.attendanceDays} 天
                    </div>
                  </div>

                  {/* 已確認紀錄 */}
                  <div className="bg-emerald-50/70 border border-emerald-100 p-3 rounded-2xl">
                    <div className="text-[11px] font-bold text-emerald-700">已確認紀錄</div>
                    <div className="text-lg font-black text-emerald-800 font-mono mt-0.5">
                      {currentMonthStats.verifiedCount} 筆
                    </div>
                  </div>

                  {/* 待核對紀錄 */}
                  <div className="bg-amber-50/70 border border-amber-100 p-3 rounded-2xl">
                    <div className="text-[11px] font-bold text-amber-700">待核對紀錄</div>
                    <div className="text-lg font-black text-amber-800 font-mono mt-0.5">
                      {currentMonthStats.pendingCardsCount} 筆
                    </div>
                  </div>

                  {/* 異常紀錄 */}
                  <div className="bg-rose-50/70 border border-rose-100 p-3 rounded-2xl">
                    <div className="text-[11px] font-bold text-rose-700">異常紀錄</div>
                    <div className="text-lg font-black text-rose-800 font-mono mt-0.5">
                      {currentMonthStats.abnormalCount} 筆
                    </div>
                  </div>
                </div>

                {/* Daily Work List (下面列出每日工時) */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="text-xs font-bold text-slate-500 px-1 flex items-center justify-between">
                    <span>每日打卡工時明細：</span>
                    <span className="text-[11px] text-slate-400 font-normal">點擊日期進入每日明細</span>
                  </div>

                  {currentMonthStats.records.length === 0 ? (
                    <div className="p-4 bg-slate-50 rounded-2xl text-slate-400 text-center text-xs font-medium">
                      2026/08 暫無打卡紀錄
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 bg-slate-50/70 rounded-2xl border border-slate-200/80 overflow-hidden">
                      {currentMonthStats.records.map((rec) => {
                        const dateParts = rec.work_date.split('-');
                        const monthNum = parseInt(dateParts[1], 10);
                        const dayNum = dateParts[2];
                        const displayDate = `${monthNum}/${dayNum}`;
                        const hoursText = formatMinutesToHoursAndMinutes(rec.total_minutes);

                        return (
                          <div
                            key={rec.record_id}
                            onClick={() => setSelectedDailyRecord(rec)}
                            className="p-3.5 flex items-center justify-between hover:bg-blue-50/80 cursor-pointer transition active:bg-blue-100/80 group"
                          >
                            <div className="flex items-center space-x-3">
                              <span className="font-extrabold text-slate-900 text-sm font-mono w-12">
                                {displayDate}
                              </span>
                              <span className="font-black text-slate-800 text-sm font-mono">
                                {hoursText}
                              </span>
                            </div>

                            <div className="flex items-center space-x-2">
                              {rec.verification_status === 'needs_overnight_confirmation' && (
                                <span className="px-2.5 py-0.5 text-[11px] font-bold bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                                  可能為跨日班
                                </span>
                              )}
                              {rec.verification_status === 'pending' && (
                                <span className="px-2.5 py-0.5 text-[11px] font-bold bg-slate-200 text-slate-700 rounded-full">
                                  待核對
                                </span>
                              )}
                              {rec.verification_status === 'verified' && (
                                <span className="px-2.5 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                                  已確認
                                </span>
                              )}
                              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  };

  // Main Return
  return (
    <div className="space-y-4 pb-24 relative animate-fade-in">
      {selectedEmp ? (
        renderEmployeeDetail(selectedEmp)
      ) : (
        /* Render Main Employee List */
        <div className="space-y-4">
          {/* Top Header & Search Bar */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜尋員工姓名或編號 (如 E001)..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {onSyncEmployees && (
            <button
              onClick={handleManualSheetSync}
              disabled={isSyncingSheet}
              className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-bold shadow-xs flex items-center justify-center space-x-1.5 transition active:scale-95 disabled:opacity-50"
              title="重新載入 Google Sheet 員工資料"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheet ? 'animate-spin text-blue-600' : ''}`} />
              <span className="hidden sm:inline">同步 Sheet</span>
            </button>
          )}

          <button
            onClick={openAddModal}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs flex items-center justify-center space-x-1.5 transition active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>新增員工</span>
          </button>
        </div>
      </div>

      {/* Roster Cards List */}
      <div className="space-y-3">
        {filteredEmployees.map((emp, idx) => {
          const empId = emp.employee_id || emp.employeeNo || emp.id || 'E001';
          const stats = getEmployeeMonthStats(emp, currentYM);

          return (
            <div
              key={emp.id ? `${emp.id}-${idx}` : `emp-${idx}`}
              onClick={() => setSelectedEmp(emp)}
              className="bg-white border border-slate-100 hover:border-blue-200 rounded-2xl p-4 shadow-xs hover:shadow-md transition cursor-pointer active:scale-[0.99] flex items-center justify-between"
            >
              <div className="flex items-center space-x-3.5">
                {/* Avatar */}
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-base shadow-xs shrink-0"
                  style={{ backgroundColor: emp.color || '#2563eb' }}
                >
                  {emp.shortName || emp.name.slice(-2)}
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-extrabold text-slate-900 text-base">
                      {emp.name}
                    </h3>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                      {empId}
                    </span>
                    {emp.status === 'active' ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded-md border border-emerald-100">
                        在職
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-500 rounded-md">
                        停用
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 mt-1.5 text-xs text-slate-600">
                    <div>
                      本月工時：
                      <span className="font-bold text-slate-900 font-mono">
                        {stats.formatted}
                      </span>
                    </div>
                    {stats.pendingCardsCount > 0 ? (
                      <div className="text-amber-600 font-bold flex items-center space-x-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>{stats.pendingCardsCount} 筆待核對</span>
                      </div>
                    ) : (
                      <div className="text-slate-400">無待核對</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => openEditModal(emp, e)}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition"
                  title="編輯員工"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingEmp(emp);
                  }}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                  title="刪除員工"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <ChevronRight className="w-5 h-5 text-slate-300 ml-0.5" />
              </div>
            </div>
          );
        })}

        {filteredEmployees.length === 0 && (
          <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-400 text-sm">
            目前無符合的員工資料。點擊右上角「新增員工」進行建立。
          </div>
        )}
      </div>
    </div>
  )}

      {/* Floating Action Button (FAB) for Mobile */}
      <button
        onClick={openAddModal}
        className="fixed bottom-20 right-4 sm:hidden z-20 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition"
        title="新增員工"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Add / Edit Employee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-white text-slate-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {editingEmp ? '編輯員工資料' : '新增員工'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  系統自動產生員工編號：
                  <span className="font-mono font-bold text-blue-600">
                    {editingEmp ? editingEmp.employee_id || editingEmp.employeeNo : generateNextEmployeeId()}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Employee ID (Auto-generated Readonly) */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  員工編號 <span className="text-slate-400 font-normal">(系統自動給號)</span>
                </label>
                <input
                  type="text"
                  disabled
                  value={editingEmp ? editingEmp.employee_id || editingEmp.employeeNo : generateNextEmployeeId()}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600 font-mono font-bold cursor-not-allowed"
                />
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  姓名 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="請輸入員工姓名 (例如：陳志豪)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Role & Hourly Rate */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    職務類別
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as RoleType)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="兼職工讀">兼職工讀</option>
                    <option value="正職">正職</option>
                    <option value="門市主管">門市主管</option>
                    <option value="計時人員">計時人員</option>
                    <option value="實習生">實習生</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    約定時薪 (元/小時)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Hire Date */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  到職日期
                </label>
                <input
                  type="date"
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Status */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  在職狀態
                </label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-1.5 text-xs text-slate-800 font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="empStatus"
                      value="active"
                      checked={status === 'active'}
                      onChange={() => setStatus('active')}
                      className="text-blue-600"
                    />
                    <span>在職中</span>
                  </label>
                  <label className="flex items-center space-x-1.5 text-xs text-slate-500 cursor-pointer">
                    <input
                      type="radio"
                      name="empStatus"
                      value="inactive"
                      checked={status === 'inactive'}
                      onChange={() => setStatus('inactive')}
                      className="text-blue-600"
                    />
                    <span>停用 / 離職</span>
                  </label>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  備註
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="例如：負責早班、調飲或排班管理..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5 ${
                    isSubmitting ? 'opacity-60 cursor-not-allowed' : 'active:scale-95'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{editingEmp ? '正在儲存…' : '正在新增員工…'}</span>
                    </>
                  ) : (
                    <span>{editingEmp ? '確認儲存' : '新增員工'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Employee Confirmation Modal */}
      {deletingEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-white text-slate-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-extrabold text-slate-900 text-lg">
                確認刪除員工？
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                您即將刪除「<span className="font-bold text-slate-900">{deletingEmp.name}</span>」（編號：<span className="font-mono font-bold text-blue-600">{deletingEmp.employee_id || deletingEmp.employeeNo || deletingEmp.id}</span>）。此動作將從員工名冊中移除該員工。
              </p>
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingEmp(null)}
                className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast Notification Banner */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center space-x-2 transition-all animate-bounce ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/20'
              : 'bg-rose-600 text-white border-rose-500 shadow-rose-900/20'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Daily Work Detail & Edit Modal */}
      {selectedDailyRecord && (
        <DailyDetailModal
          record={selectedDailyRecord}
          employeeName={selectedEmp ? selectedEmp.name : '員工'}
          isOpen={!!selectedDailyRecord}
          onClose={() => setSelectedDailyRecord(null)}
          onSave={(updatedRec) => {
            if (onUpdateDailyRecord) {
              onUpdateDailyRecord(updatedRec);
            }
            setSelectedDailyRecord(null);
          }}
        />
      )}
    </div>
  );
};
