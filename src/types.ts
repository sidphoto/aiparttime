export type RoleType = '正職' | '兼職工讀' | '計時人員' | '門市主管' | '兼職支援';

export type VerificationStatus = 'verified' | 'pending' | 'needs_overnight_confirmation' | 'rejected';

/**
 * Google Sheet 連線狀態（AUTH UX FIX Phase 1）
 * - disconnected：尚未登入 Google（沒有 Profile）
 * - needs_reauth：Profile 存在，但 Memory-only Access Token 不存在／已過期（401）
 * - connecting：正在向 Server 驗證與載入資料
 * - connected：Token 存在且 Server API 驗證成功
 * - forbidden：Google 帳號不在 Friends Alpha 允許名單（403）
 * - error：Server / Sheet 設定異常（500 / 503 等）
 */
export type SheetConnectionState =
  | 'disconnected'
  | 'needs_reauth'
  | 'connecting'
  | 'connected'
  | 'forbidden'
  | 'error';

export interface DailyWorkRecord {
  record_id: string;
  employee_id: string;
  work_date: string; // "YYYY-MM-DD" e.g., "2026-08-01"
  clock_in_1: string; // "09:14" or ""
  clock_out_1: string; // "15:13" or ""
  clock_in_2: string; // "17:11" or ""
  clock_out_2: string; // "21:26" or ""
  period_1_minutes: number;
  period_2_minutes: number;
  total_minutes: number;
  is_overnight_1?: boolean;
  is_overnight_2?: boolean;
  verification_status: VerificationStatus;
  source: 'photo_ai' | 'manual';
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  employee_id?: string; // e.g. "E001"
  employeeNo: string; // Alias for employee_id
  name: string;
  shortName?: string; // Short name / nickname (e.g. "慶", "ANH", "HOA")
  role: RoleType;
  hourlyRate: number; // NT$ per hour
  color: string; // Hex color or Tailwind color token for UI identification
  status: 'active' | 'inactive';
  isActive: boolean;
  hire_date?: string; // 到職日期 "YYYY-MM-DD"
  phone?: string;
  note?: string;
  createdAt: string;
  created_at?: string;
}

export interface ShiftPreset {
  id: string;
  name: string; // e.g., "早班", "晚班", "中班", "全天班"
  startTime: string; // "08:30"
  endTime: string; // "17:00"
  breakMinutes: number; // e.g., 60
  color: string;
}

export interface ShiftLog {
  id: string;
  employeeId: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "09:00"
  endTime: string; // "18:00"
  breakMinutes: number; // e.g., 60
  hourlyRate: number; // hourly rate at time of shift
  regularHours: number; // Normal hours (up to 8h)
  overtimeHours1: number; // OT Level 1 (9th-10th hour, 1.34x)
  overtimeHours2: number; // OT Level 2 (>10th hour, 1.67x)
  totalNetHours: number; // Total net work time after break deduction
  isCrossNight?: boolean;
  presetName?: string;
  regularPay: number;
  overtimePay: number;
  totalPay: number;
  note?: string;
  createdAt: string;
}

export interface RecognitionTimeValue {
  value: string | null; // e.g. "09:14" or null if unreadable / not stamped
  confidence: number;   // 0.0 to 1.0 e.g. 0.98
}

export interface RecognitionDailyRecord {
  date: number; // day of month 1..31
  clock_in_1: RecognitionTimeValue;
  clock_out_1: RecognitionTimeValue;
  clock_in_2: RecognitionTimeValue;
  clock_out_2: RecognitionTimeValue;
}

export interface TimecardRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  shortName: string;
  yearMonth: string; // e.g. "2026-08"
  imageUrl: string;
  cardImageUrl?: string;
  status: 'pending' | 'verified' | 'rejected';
  isDraft?: boolean; // 標示為「AI 辨識草稿」
  totalDays: number;
  totalHours: number;
  totalMinutes: number;
  totalRecognizedHours?: number;
  aiNotes?: string;
  uploadedAt: string;
  verifiedAt?: string;
  recognizedDailyRecords?: RecognitionDailyRecord[];
  recognizedLogs?: {
    date: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    netHours: number;
  }[];
  details?: {
    day: number;
    dateStr: string;
    inTime: string;
    outTime: string;
    hours: number;
    minutes: number;
    note?: string;
  }[];
}

export interface StoreSettings {
  storeName: string;
  payCycleStartDay: number; // e.g., 1 (1st to end of month) or 26 (26th to 25th)
  currency: string; // "NT$"
  defaultHourlyRate: number; // 190
  autoDeductBreak: boolean; // Auto-deduct break based on rules if true
  overtimeRule: 'taiwan_standard' | 'simple_1_5' | 'none';
  overtimeMode?: 'standard' | 'custom' | 'none';
  overtimeRate1?: number;
  overtimeRate2?: number;
  autoDeductBreak30AfterHours: number;
  autoDeductBreak60AfterHours: number;
}

export interface EmployeeSummary {
  employee: Employee;
  totalShifts: number;
  totalDays: number;
  regularHours: number;
  overtimeHours1: number;
  overtimeHours2: number;
  totalNetHours: number;
  totalHoursPart: number; // Integer hours
  totalMinutesPart: number; // Integer minutes
  totalBreakMinutes: number; // Total break time
  regularPay: number;
  overtimePay: number;
  totalPay: number;
  verificationStatus: 'verified' | 'pending';
}

export interface StoreSummary {
  periodLabel: string;
  startDate: string;
  endDate: string;
  totalShifts: number;
  totalNetHours: number;
  totalHoursPart: number;
  totalMinutesPart: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalPay: number;
  avgHourlyCost: number;
  employeeSummaries: EmployeeSummary[];
}

