import { Employee, ShiftPreset, ShiftLog, StoreSettings, TimecardRecord } from '../types';

export const defaultSettings: StoreSettings = {
  storeName: '參陸河粉',
  payCycleStartDay: 1, // 1st to end of month
  currency: 'NT$',
  defaultHourlyRate: 195,
  autoDeductBreak: true,
  overtimeRule: 'taiwan_standard',
  overtimeMode: 'standard',
  overtimeRate1: 1.34,
  overtimeRate2: 1.67,
  autoDeductBreak30AfterHours: 4,
  autoDeductBreak60AfterHours: 8,
};

export const defaultPresets: ShiftPreset[] = [
  { id: 'preset-1', name: '早班 (08:30-17:00)', startTime: '08:30', endTime: '17:00', breakMinutes: 60, color: '#3b82f6' },
  { id: 'preset-2', name: '中班 (12:00-20:30)', startTime: '12:00', endTime: '20:30', breakMinutes: 60, color: '#f59e0b' },
  { id: 'preset-3', name: '晚班 (17:00-23:30)', startTime: '17:00', endTime: '23:30', breakMinutes: 30, color: '#8b5cf6' },
  { id: 'preset-4', name: '全天班 (09:00-21:30)', startTime: '09:00', endTime: '21:30', breakMinutes: 90, color: '#ef4444' },
  { id: 'preset-5', name: '4H 兼職班 (18:00-22:00)', startTime: '18:00', endTime: '22:00', breakMinutes: 0, color: '#10b981' },
];

export const defaultEmployees: Employee[] = [
  {
    id: 'E001',
    employee_id: 'E001',
    employeeNo: 'E001',
    name: '陳志豪',
    shortName: '志豪',
    role: '正職',
    hourlyRate: 195,
    color: '#2563eb',
    status: 'active',
    isActive: true,
    hire_date: '2025-03-01',
    phone: '0912-345-678',
    note: '外場組長',
    createdAt: '2025-03-01',
    created_at: '2025-03-01',
  },
  {
    id: 'E002',
    employee_id: 'E002',
    employeeNo: 'E002',
    name: '林雅婷',
    shortName: '雅婷',
    role: '正職',
    hourlyRate: 195,
    color: '#059669',
    status: 'active',
    isActive: true,
    hire_date: '2025-06-15',
    phone: '0922-111-222',
    note: '內場廚助理',
    createdAt: '2025-06-15',
    created_at: '2025-06-15',
  },
  {
    id: 'E003',
    employee_id: 'E003',
    employeeNo: 'E003',
    name: '張家瑋',
    shortName: '家瑋',
    role: '兼職工讀',
    hourlyRate: 195,
    color: '#d97706',
    status: 'active',
    isActive: true,
    hire_date: '2025-09-01',
    phone: '0933-444-555',
    note: '兼職夥伴',
    createdAt: '2025-09-01',
    created_at: '2025-09-01',
  },
];

export const defaultTimecards: TimecardRecord[] = [
  {
    id: 'tc-1',
    employeeId: 'E002',
    employeeName: '林雅婷',
    shortName: '雅婷',
    yearMonth: '2026-08',
    imageUrl: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&auto=format&fit=crop&q=80',
    status: 'verified',
    totalDays: 21,
    totalHours: 168,
    totalMinutes: 0,
    aiNotes: '紙本打卡卡覆核完成',
    uploadedAt: '2026-08-10 18:30',
    verifiedAt: '2026-08-10 19:00',
    details: [
      { day: 1, dateStr: '2026-08-01', inTime: '08:30', outTime: '17:00', hours: 7, minutes: 30 },
      { day: 2, dateStr: '2026-08-02', inTime: '08:30', outTime: '17:30', hours: 8, minutes: 0 },
      { day: 3, dateStr: '2026-08-03', inTime: '08:30', outTime: '17:00', hours: 7, minutes: 30 },
    ],
  },
  {
    id: 'tc-2',
    employeeId: 'E003',
    employeeName: '張家瑋',
    shortName: '家瑋',
    yearMonth: '2026-08',
    imageUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
    status: 'verified',
    totalDays: 15,
    totalHours: 90,
    totalMinutes: 0,
    aiNotes: '打卡卡格子確認完畢',
    uploadedAt: '2026-08-11 11:15',
    verifiedAt: '2026-08-11 12:00',
    details: [
      { day: 1, dateStr: '2026-08-01', inTime: '17:00', outTime: '23:00', hours: 5, minutes: 30 },
      { day: 2, dateStr: '2026-08-02', inTime: '17:00', outTime: '23:30', hours: 6, minutes: 0 },
    ],
  },
  {
    id: 'tc-3',
    employeeId: 'E001',
    employeeName: '陳志豪',
    shortName: '志豪',
    yearMonth: '2026-08',
    imageUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600&auto=format&fit=crop&q=80',
    status: 'verified',
    totalDays: 22,
    totalHours: 176,
    totalMinutes: 0,
    aiNotes: '店長已覆核完成並確認工時',
    uploadedAt: '2026-08-09 09:00',
    verifiedAt: '2026-08-09 10:30',
  },
];

// Helper to generate sample shift logs for current month matching official employees
export function generateSampleShifts(): ShiftLog[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStr = String(month).padStart(2, '0');

  const shifts: ShiftLog[] = [];
  let idCounter = 1;

  const daysInMonth = new Date(year, month, 0).getDate();
  const currentDay = Math.min(now.getDate(), daysInMonth);

  for (let day = 1; day <= Math.max(12, currentDay); day++) {
    const dayStr = String(day).padStart(2, '0');
    const date = `${year}-${monthStr}-${dayStr}`;
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay();

    // Early shift: 林雅婷 (E002)
    if (dayOfWeek !== 1) {
      shifts.push({
        id: `shift-${idCounter++}`,
        employeeId: 'E002', // 林雅婷
        date,
        startTime: '08:30',
        endTime: '17:00',
        breakMinutes: 60,
        hourlyRate: 200,
        regularHours: 7.5,
        overtimeHours1: 0,
        overtimeHours2: 0,
        totalNetHours: 7.5,
        regularPay: 1500,
        overtimePay: 0,
        totalPay: 1500,
        note: '早班內場',
        createdAt: `${date}T08:30:00Z`,
      });
    }

    // Mid Shift: 陳志豪 (E001)
    if (day % 2 === 1) {
      shifts.push({
        id: `shift-${idCounter++}`,
        employeeId: 'E001', // 陳志豪
        date,
        startTime: '10:00',
        endTime: '18:30',
        breakMinutes: 60,
        hourlyRate: 200,
        regularHours: 7.5,
        overtimeHours1: 0,
        overtimeHours2: 0,
        totalNetHours: 7.5,
        regularPay: 1500,
        overtimePay: 0,
        totalPay: 1500,
        note: '外場組長',
        createdAt: `${date}T10:00:00Z`,
      });
    }

    // Evening Shift: 張家瑋 (E003)
    if (day % 3 !== 0) {
      shifts.push({
        id: `shift-${idCounter++}`,
        employeeId: 'E003', // 張家瑋
        date,
        startTime: '17:00',
        endTime: '22:30',
        breakMinutes: 30,
        hourlyRate: 190,
        regularHours: 5,
        overtimeHours1: 0,
        overtimeHours2: 0,
        totalNetHours: 5,
        regularPay: 950,
        overtimePay: 0,
        totalPay: 950,
        note: '晚班兼職',
        createdAt: `${date}T17:00:00Z`,
      });
    }
  }

  return shifts;
}
