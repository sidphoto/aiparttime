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

export const defaultEmployees: Employee[] = [];

export const defaultTimecards: TimecardRecord[] = [];

// Helper to generate sample shift logs for current month matching official employees
export function generateSampleShifts(): ShiftLog[] {
  return [];
}
