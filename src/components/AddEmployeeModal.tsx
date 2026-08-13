import React, { useState } from 'react';
import { X, UserPlus, Loader2 } from 'lucide-react';
import { Employee, StoreSettings } from '../types';

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddEmployee: (empData: Omit<Employee, 'id' | 'createdAt'>) => Promise<void>;
  settings: StoreSettings;
  existingEmployees: Employee[];
}

const ROLE_OPTIONS = ['兼職工讀', '正職', '門市主管', '計時人員', '實習生'];
const COLOR_OPTIONS = [
  '#2563eb', '#059669', '#d97706', '#7c3aed', '#ec4899',
  '#0284c7', '#16a34a', '#ca8a04', '#9333ea', '#db2777',
];

export const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({
  isOpen,
  onClose,
  onAddEmployee,
  settings,
  existingEmployees,
}) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState('兼職工讀');
  const [hourlyRate, setHourlyRate] = useState<number>(settings.defaultHourlyRate || 195);
  const [hireDate, setHireDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [note, setNote] = useState('');
  const [color, setColor] = useState(COLOR_OPTIONS[existingEmployees.length % COLOR_OPTIONS.length]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Auto-generate next employee_id (e.g. E001, E002, E003...)
  const generateNextEmployeeId = () => {
    let maxNum = 0;
    existingEmployees.forEach((emp) => {
      const code = emp.employee_id || emp.employeeNo || emp.id || '';
      const match = code.match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `E${String(maxNum + 1).padStart(3, '0')}`;
  };

  const nextEmpId = generateNextEmployeeId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('請輸入員工姓名');
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const trimmedName = name.trim();
      const shortName = trimmedName.length > 2 ? trimmedName.slice(-2) : trimmedName;

      await onAddEmployee({
        employee_id: nextEmpId,
        employeeNo: nextEmpId,
        name: trimmedName,
        shortName,
        role,
        hourlyRate: Number(hourlyRate) || settings.defaultHourlyRate || 195,
        color,
        status,
        isActive: status === 'active',
        hire_date: hireDate,
        note,
      });

      // Reset & Close
      setName('');
      setNote('');
      setIsSubmitting(false);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || '新增員工失敗，請稍後再試');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
      <div className="bg-white text-slate-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">新增員工</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                系統自動給號：
                <span className="font-mono font-bold text-blue-600 ml-1">{nextEmpId}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
              {errorMsg}
            </div>
          )}

          {/* Employee ID */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              員工編號 <span className="text-slate-400 font-normal">(自動生成)</span>
            </label>
            <input
              type="text"
              disabled
              value={nextEmpId}
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
              autoFocus
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
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                約定時薪 (NT$)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
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

          {/* Avatar Color */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              代表顏色 (頭像標籤)
            </label>
            <div className="flex items-center space-x-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-all ${
                    color === c ? 'scale-110 ring-2 ring-offset-2 ring-blue-600' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
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
                  name="empModalStatus"
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
                  name="empModalStatus"
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
              rows={2}
              placeholder="例如：外場組長、負責叫貨排班..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
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
                  <span>新增中…</span>
                </>
              ) : (
                <span>確認新增</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
