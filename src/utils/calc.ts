import { Employee, ShiftLog, StoreSettings, EmployeeSummary, StoreSummary, DailyWorkRecord } from '../types';

/**
 * Converts "HH:MM" string to minutes from midnight
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return -1;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return -1;
  return h * 60 + m;
}

/**
 * Formats minutes integer into Chinese string e.g. 614 -> "10時14分"
 */
export function formatMinutesToHoursAndMinutes(totalMinutes: number): string {
  if (isNaN(totalMinutes) || totalMinutes <= 0) return '0時0分';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}時${minutes}分`;
}

/**
 * Calculates period minutes and checks if it's potentially an overnight shift
 */
export function calculatePeriodMinutes(
  clockIn: string,
  clockOut: string,
  isOvernightConfirmed?: boolean
): { minutes: number; isOvernightCandidate: boolean } {
  const inM = timeStringToMinutes(clockIn);
  const outM = timeStringToMinutes(clockOut);

  if (inM < 0 || outM < 0) {
    return { minutes: 0, isOvernightCandidate: false };
  }

  if (outM < inM) {
    // Cross-midnight candidate
    const minutes = (outM + 24 * 60) - inM;
    return { minutes, isOvernightCandidate: true };
  } else {
    return { minutes: outM - inM, isOvernightCandidate: false };
  }
}

/**
 * Recalculates daily work record fields in minutes
 */
export function calculateDailyWorkRecord(rec: Partial<DailyWorkRecord>): DailyWorkRecord {
  const p1 = calculatePeriodMinutes(rec.clock_in_1 || '', rec.clock_out_1 || '', rec.is_overnight_1);
  const p2 = calculatePeriodMinutes(rec.clock_in_2 || '', rec.clock_out_2 || '', rec.is_overnight_2);

  const period_1_minutes = p1.minutes;
  const period_2_minutes = p2.minutes;
  const total_minutes = period_1_minutes + period_2_minutes;

  let verification_status = rec.verification_status || 'verified';

  // Check if either period has cross-midnight where out < in
  const hasOvernightCandidate = p1.isOvernightCandidate || p2.isOvernightCandidate;
  const isOvernightExplicitlySet = rec.is_overnight_1 !== undefined || rec.is_overnight_2 !== undefined;

  if (hasOvernightCandidate && !isOvernightExplicitlySet && verification_status !== 'rejected') {
    verification_status = 'needs_overnight_confirmation';
  }

  return {
    record_id: rec.record_id || `rec-${Date.now()}`,
    employee_id: rec.employee_id || 'E001',
    work_date: rec.work_date || '2026-08-01',
    clock_in_1: rec.clock_in_1 || '',
    clock_out_1: rec.clock_out_1 || '',
    clock_in_2: rec.clock_in_2 || '',
    clock_out_2: rec.clock_out_2 || '',
    period_1_minutes,
    period_2_minutes,
    total_minutes,
    is_overnight_1: rec.is_overnight_1 ?? p1.isOvernightCandidate,
    is_overnight_2: rec.is_overnight_2 ?? p2.isOvernightCandidate,
    verification_status,
    source: rec.source || 'photo_ai',
    created_at: rec.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Calculates time difference in gross hours between two HH:mm time strings.
 * Handles cross-midnight shifts (e.g. 22:00 to 02:00 = 4 hours).
 */
export function calculateGrossHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;

  // Cross-midnight shift
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  const durationMinutes = endMinutes - startMinutes;
  return Math.max(0, durationMinutes / 60);
}

/**
 * Calculates hours breakdown (Regular, OT1, OT2) and pay for a shift
 */
export function calculateShiftBreakdown(
  startTime: string,
  endTime: string,
  breakMinutes: number,
  hourlyRate: number,
  settings: StoreSettings
): {
  grossHours: number;
  netHours: number;
  regularHours: number;
  overtimeHours1: number;
  overtimeHours2: number;
  regularPay: number;
  overtimePay: number;
  totalPay: number;
} {
  const grossHours = calculateGrossHours(startTime, endTime);
  const breakHours = Math.max(0, breakMinutes / 60);
  const netHours = Math.max(0, grossHours - breakHours);

  let regularHours = 0;
  let overtimeHours1 = 0;
  let overtimeHours2 = 0;

  if (settings.overtimeRule === 'taiwan_standard' || settings.overtimeMode === 'standard') {
    // Taiwan Standard: <=8h = Normal, 8-10h = OT1 (1.34x), >10h = OT2 (1.67x)
    if (netHours <= 8) {
      regularHours = netHours;
    } else if (netHours <= 10) {
      regularHours = 8;
      overtimeHours1 = netHours - 8;
    } else {
      regularHours = 8;
      overtimeHours1 = 2;
      overtimeHours2 = netHours - 10;
    }
  } else if (settings.overtimeRule === 'simple_1_5' || settings.overtimeMode === 'custom') {
    // Simple: <=8h = Normal, >8h = OT1 (1.5x)
    if (netHours <= 8) {
      regularHours = netHours;
    } else {
      regularHours = 8;
      overtimeHours1 = netHours - 8;
    }
  } else {
    // Flat rate
    regularHours = netHours;
  }

  const otRate1 = settings.overtimeRate1 || (settings.overtimeRule === 'simple_1_5' ? 1.5 : 1.34);
  const otRate2 = settings.overtimeRate2 || 1.67;

  const regularPay = Math.round(regularHours * hourlyRate);
  const ot1Pay = Math.round(overtimeHours1 * hourlyRate * otRate1);
  const ot2Pay = Math.round(overtimeHours2 * hourlyRate * otRate2);
  const overtimePay = ot1Pay + ot2Pay;
  const totalPay = regularPay + overtimePay;

  return {
    grossHours: Math.round(grossHours * 100) / 100,
    netHours: Math.round(netHours * 100) / 100,
    regularHours: Math.round(regularHours * 100) / 100,
    overtimeHours1: Math.round(overtimeHours1 * 100) / 100,
    overtimeHours2: Math.round(overtimeHours2 * 100) / 100,
    regularPay,
    overtimePay,
    totalPay,
  };
}

/**
 * Suggest break minutes based on working duration
 */
export function suggestBreakMinutes(startTime: string, endTime: string): number {
  const gross = calculateGrossHours(startTime, endTime);
  if (gross >= 8) return 60;
  if (gross >= 4) return 30;
  return 0;
}

/**
 * Determines period start and end dates based on payCycleStartDay and a reference year-month string "YYYY-MM"
 */
export function getPayCyclePeriod(yearMonth: string, payCycleStartDay: number = 1): { startDate: string; endDate: string; label: string } {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (payCycleStartDay === 1) {
    // Standard calendar month
    const start = `${yearMonth}-01`;
    const lastDayNum = new Date(year, month, 0).getDate();
    const end = `${yearMonth}-${String(lastDayNum).padStart(2, '0')}`;
    return {
      startDate: start,
      endDate: end,
      label: `${year}年${month}月 (${month}/01 ~ ${month}/${lastDayNum})`,
    };
  } else {
    // Custom pay cycle (e.g. 26th of previous month to 25th of this month)
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear = year - 1;
    }

    const startMonthStr = String(prevMonth).padStart(2, '0');
    const startDayStr = String(payCycleStartDay).padStart(2, '0');
    const endDayStr = String(payCycleStartDay - 1).padStart(2, '0');

    const startDate = `${prevYear}-${startMonthStr}-${startDayStr}`;
    const endDate = `${yearMonth}-${endDayStr}`;

    return {
      startDate,
      endDate,
      label: `${year}年${month}月結算週期 (${prevMonth}/${startDayStr} ~ ${month}/${endDayStr})`,
    };
  }
}

/**
 * Formats net hours into Chinese hour and minute format e.g. "278時26分" or "221時40分"
 */
export function formatHoursAndMinutes(netHours: number): string {
  if (isNaN(netHours) || netHours <= 0) return '0時0分';
  const hours = Math.floor(netHours);
  const minutes = Math.round((netHours - hours) * 60);
  if (minutes === 60) {
    return `${hours + 1}時0分`;
  }
  return `${hours}時${minutes}分`;
}

/**
 * Summarizes shifts for store and individual employees for a given date range
 */
export function generateStoreSummary(
  employees: Employee[],
  dailyRecords: DailyWorkRecord[],
  startDate: string,
  endDate: string,
  periodLabel: string
): StoreSummary {
  // Create ID mapping lookup for exact employee matching by employee_id/id/employeeNo
  const empLookupMap = new Map<string, Employee>();
  
  employees.forEach((emp) => {
    if (emp.id) empLookupMap.set(emp.id, emp);
    if (emp.employee_id) empLookupMap.set(emp.employee_id, emp);
    if (emp.employeeNo) empLookupMap.set(emp.employeeNo, emp);
  });

  // Filter dailyRecords by work_date within range & verification_status === 'verified'
  const filteredRecords = (dailyRecords || []).filter(
    (r) =>
      r.work_date &&
      r.work_date >= startDate &&
      r.work_date <= endDate &&
      r.verification_status === 'verified'
  );

  const empMap = new Map<string, EmployeeSummary>();

  // Initialize summary for every active employee
  employees.forEach((emp) => {
    const key = emp.id || emp.employee_id || emp.employeeNo;
    if (!key) return;
    empMap.set(key, {
      employee: emp,
      totalShifts: 0,
      totalDays: 0,
      regularHours: 0,
      overtimeHours1: 0,
      overtimeHours2: 0,
      totalNetHours: 0,
      totalHoursPart: 0,
      totalMinutesPart: 0,
      totalBreakMinutes: 0,
      regularPay: 0,
      overtimePay: 0,
      totalPay: 0,
      verificationStatus: 'verified',
    });
  });

  const empDaysWorkedMap = new Map<string, Set<string>>();

  filteredRecords.forEach((rec) => {
    // Find matching employee by employee_id (TASK 3: Join via employee_id, no name guessing)
    const matchedEmp = empLookupMap.get(rec.employee_id);
    if (!matchedEmp) {
      return;
    }

    const targetEmpId = matchedEmp.id || matchedEmp.employee_id || matchedEmp.employeeNo;
    let summary = empMap.get(targetEmpId);

    if (!summary) {
      summary = {
        employee: matchedEmp,
        totalShifts: 0,
        totalDays: 0,
        regularHours: 0,
        overtimeHours1: 0,
        overtimeHours2: 0,
        totalNetHours: 0,
        totalHoursPart: 0,
        totalMinutesPart: 0,
        totalBreakMinutes: 0,
        regularPay: 0,
        overtimePay: 0,
        totalPay: 0,
        verificationStatus: 'verified',
      };
      empMap.set(targetEmpId, summary);
    }

    if (!empDaysWorkedMap.has(targetEmpId)) {
      empDaysWorkedMap.set(targetEmpId, new Set());
    }
    empDaysWorkedMap.get(targetEmpId)!.add(rec.work_date);

    // Sum total_minutes from DailyWorkRecord (TASK 5: SUM total_minutes)
    const mins = rec.total_minutes || 0;
    const hours = mins / 60;

    summary.totalShifts += 1;
    summary.totalNetHours += hours;
    summary.regularHours += Math.min(8, hours);
    if (hours > 8) {
      summary.overtimeHours1 += Math.min(2, hours - 8);
      if (hours > 10) {
        summary.overtimeHours2 += hours - 10;
      }
    }
    summary.totalPay += Math.round(hours * (matchedEmp.hourlyRate || 195));
  });

  // Format distinct days and hours/minutes for each employee
  empMap.forEach((summary, empId) => {
    const daysSet = empDaysWorkedMap.get(empId);
    summary.totalDays = daysSet ? daysSet.size : 0;
    summary.regularHours = Math.round(summary.regularHours * 10) / 10;
    summary.overtimeHours1 = Math.round(summary.overtimeHours1 * 10) / 10;
    summary.overtimeHours2 = Math.round(summary.overtimeHours2 * 10) / 10;
    summary.totalNetHours = Math.round(summary.totalNetHours * 10) / 10;
    
    summary.totalHoursPart = Math.floor(summary.totalNetHours);
    summary.totalMinutesPart = Math.round((summary.totalNetHours - summary.totalHoursPart) * 60);
    if (summary.totalMinutesPart === 60) {
      summary.totalHoursPart += 1;
      summary.totalMinutesPart = 0;
    }
  });

  const employeeSummaries = Array.from(empMap.values()).sort((a, b) => b.totalNetHours - a.totalNetHours);

  let totalShifts = 0;
  let totalNetHours = 0;
  let totalRegularHours = 0;
  let totalOvertimeHours = 0;
  let totalPay = 0;

  employeeSummaries.forEach((s) => {
    totalShifts += s.totalShifts;
    totalNetHours += s.totalNetHours;
    totalRegularHours += s.regularHours;
    totalOvertimeHours += s.overtimeHours1 + s.overtimeHours2;
    totalPay += s.totalPay;
  });

  const roundedNet = Math.round(totalNetHours * 10) / 10;
  let storeHoursPart = Math.floor(roundedNet);
  let storeMinutesPart = Math.round((roundedNet - storeHoursPart) * 60);
  if (storeMinutesPart === 60) {
    storeHoursPart += 1;
    storeMinutesPart = 0;
  }

  const avgHourlyCost = totalNetHours > 0 ? Math.round(totalPay / totalNetHours) : 0;

  return {
    periodLabel,
    startDate,
    endDate,
    totalShifts,
    totalNetHours: roundedNet,
    totalHoursPart: storeHoursPart,
    totalMinutesPart: storeMinutesPart,
    totalRegularHours: Math.round(totalRegularHours * 10) / 10,
    totalOvertimeHours: Math.round(totalOvertimeHours * 10) / 10,
    totalPay,
    avgHourlyCost,
    employeeSummaries,
  };
}

/**
 * Format currency string (e.g. NT$ 12,500)
 */
export function formatCurrency(amount: number, prefix: string = 'NT$'): string {
  return `${prefix} ${amount.toLocaleString()}`;
}

/**
 * Format date string for Chinese display
 */
export function formatDateCN(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
  const d = new Date(dateStr);
  const dayOfWeek = dayNames[d.getDay()];
  return `${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日 (${dayOfWeek})`;
}
