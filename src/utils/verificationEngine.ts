import { RecognitionDailyRecord, RecognitionTimeValue, DailyWorkRecord, TimecardRecord } from '../types';
import { timeStringToMinutes } from './calc';

export type RecordStatusType = 'normal' | 'needs_confirmation' | 'abnormal' | 'verified';

export interface RuleValidationIssue {
  code:
    | 'INVALID_FORMAT'
    | 'MISSING_PUNCH'
    | 'INVALID_SEQUENCE'
    | 'POSSIBLE_OVERNIGHT'
    | 'SECTION_TOO_LONG'
    | 'DAILY_HOURS_ABNORMAL'
    | 'LOW_CONFIDENCE'
    | 'MEDIUM_CONFIDENCE'
    | 'DUPLICATE_RECORD';
  severity: 'error' | 'warning' | 'info';
  message: string;
  field?: 'clock_in_1' | 'clock_out_1' | 'clock_in_2' | 'clock_out_2';
}

export interface VerificationResult {
  date: number; // Day of month e.g. 1..31
  workDate: string; // YYYY-MM-DD e.g. "2026-08-01"
  status: RecordStatusType;
  issues: RuleValidationIssue[];
  hasLowConfidence: boolean; // < 0.65
  hasMediumConfidence: boolean; // < 0.85
  hasDuplicateRecord: boolean;
  existingRecord?: DailyWorkRecord;
  calculatedMinutes: number;
}

/**
 * Returns Tailwind CSS class for field highlighting based on confidence
 * - confidence < 0.65: Red (自動標示紅色)
 * - confidence < 0.85: Yellow (自動標示黃色)
 * - confidence >= 0.85: Emerald/Normal
 */
export function getConfidenceFieldStyle(confidence: number | undefined | null, hasValue: boolean) {
  if (!hasValue || confidence === undefined || confidence === null) {
    return 'bg-slate-100/80 text-slate-400 border-slate-200';
  }
  if (confidence < 0.65) {
    return 'bg-rose-100 text-rose-900 border-rose-300 font-extrabold ring-1 ring-rose-400/50';
  }
  if (confidence < 0.85) {
    return 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold ring-1 ring-amber-400/50';
  }
  return 'bg-emerald-50 text-emerald-800 border-emerald-200/80 font-bold';
}

/**
 * Validates HH:MM format
 */
function isValidTimeFormat(str: string): boolean {
  if (!str) return true; // empty/null is valid unpunched state
  const reg = /^([0-1]?[0-9]|2[0-8]):[0-5][0-9]$/;
  return reg.test(str);
}

/**
 * Executes 8-item Rule Validation Mechanism on an AI OCR daily recognition item
 */
export function validateDailyRecord(
  rec: RecognitionDailyRecord,
  yearMonth: string, // "2026-08"
  employeeId: string,
  existingDailyRecords: DailyWorkRecord[]
): VerificationResult {
  const dayStr = String(rec.date).padStart(2, '0');
  const workDate = `${yearMonth}-${dayStr}`;
  const issues: RuleValidationIssue[] = [];

  let hasLowConfidence = false;
  let hasMediumConfidence = false;
  let hasDuplicateRecord = false;

  const cIn1 = rec.clock_in_1?.value || '';
  const cOut1 = rec.clock_out_1?.value || '';
  const cIn2 = rec.clock_in_2?.value || '';
  const cOut2 = rec.clock_out_2?.value || '';

  // 1. 時間格式檢查
  if (cIn1 && !isValidTimeFormat(cIn1)) {
    issues.push({ code: 'INVALID_FORMAT', severity: 'error', message: `第1段上班時間格式無效: "${cIn1}"`, field: 'clock_in_1' });
  }
  if (cOut1 && !isValidTimeFormat(cOut1)) {
    issues.push({ code: 'INVALID_FORMAT', severity: 'error', message: `第1段下班時間格式無效: "${cOut1}"`, field: 'clock_out_1' });
  }
  if (cIn2 && !isValidTimeFormat(cIn2)) {
    issues.push({ code: 'INVALID_FORMAT', severity: 'error', message: `第2段上班時間格式無效: "${cIn2}"`, field: 'clock_in_2' });
  }
  if (cOut2 && !isValidTimeFormat(cOut2)) {
    issues.push({ code: 'INVALID_FORMAT', severity: 'error', message: `第2段下班時間格式無效: "${cOut2}"`, field: 'clock_out_2' });
  }

  // 2. 缺漏時間檢查 (Unpaired Punch)
  if ((cIn1 && !cOut1) || (!cIn1 && cOut1)) {
    issues.push({ code: 'MISSING_PUNCH', severity: 'warning', message: '第 1 段刷卡記錄不完整（有上班無下班或相反）' });
  }
  if ((cIn2 && !cOut2) || (!cIn2 && cOut2)) {
    issues.push({ code: 'MISSING_PUNCH', severity: 'warning', message: '第 2 段刷卡記錄不完整（有上班無下班或相反）' });
  }

  // 3 & 4. 上下班順序 & 跨日可能檢查
  const mIn1 = timeStringToMinutes(cIn1);
  const mOut1 = timeStringToMinutes(cOut1);
  const mIn2 = timeStringToMinutes(cIn2);
  const mOut2 = timeStringToMinutes(cOut2);

  let p1Mins = 0;
  let p2Mins = 0;

  // Segment 1 logic
  if (mIn1 >= 0 && mOut1 >= 0) {
    if (mOut1 < mIn1) {
      // Out before In -> Check if overnight candidate
      if (mIn1 >= 19 * 60 && mOut1 <= 8 * 60) {
        p1Mins = (mOut1 + 24 * 60) - mIn1;
        issues.push({ code: 'POSSIBLE_OVERNIGHT', severity: 'info', message: '第 1 段為跨日大夜班（次日凌晨離退）' });
      } else {
        issues.push({ code: 'INVALID_SEQUENCE', severity: 'error', message: '第 1 段下班時間早於上班時間，請核對' });
      }
    } else {
      p1Mins = mOut1 - mIn1;
    }
  }

  // Segment 2 logic
  if (mIn2 >= 0 && mOut2 >= 0) {
    if (mIn1 >= 0 && mOut1 >= 0 && mIn2 < mOut1) {
      issues.push({ code: 'INVALID_SEQUENCE', severity: 'error', message: '第 2 段上班時間早於第 1 段下班時間' });
    }

    if (mOut2 < mIn2) {
      if (mIn2 >= 19 * 60 && mOut2 <= 8 * 60) {
        p2Mins = (mOut2 + 24 * 60) - mIn2;
        issues.push({ code: 'POSSIBLE_OVERNIGHT', severity: 'info', message: '第 2 段為跨日班次（次日離退）' });
      } else {
        issues.push({ code: 'INVALID_SEQUENCE', severity: 'error', message: '第 2 段下班時間早於上班時間' });
      }
    } else {
      p2Mins = mOut2 - mIn2;
    }
  }

  // 5. 單一工作區段是否異常過長 (> 12 hours)
  if (p1Mins > 12 * 60) {
    issues.push({ code: 'SECTION_TOO_LONG', severity: 'warning', message: `第 1 段單次工時 (${Math.floor(p1Mins / 60)}小時) 超過 12 小時，請確認` });
  }
  if (p2Mins > 12 * 60) {
    issues.push({ code: 'SECTION_TOO_LONG', severity: 'warning', message: `第 2 段單次工時 (${Math.floor(p2Mins / 60)}小時) 超過 12 小時，請確認` });
  }

  // 6. 當日總工時是否異常 (> 14 hours)
  const totalMins = p1Mins + p2Mins;
  if (totalMins > 14 * 60) {
    issues.push({ code: 'DAILY_HOURS_ABNORMAL', severity: 'error', message: `當日總工時異常 (${Math.floor(totalMins / 60)}小時${totalMins % 60}分)，超過 14 小時上限` });
  }

  // 7. AI Confidence 可信度檢查
  const fieldsToCheck: { key: 'clock_in_1' | 'clock_out_1' | 'clock_in_2' | 'clock_out_2'; label: string; item: RecognitionTimeValue }[] = [
    { key: 'clock_in_1', label: '上1', item: rec.clock_in_1 },
    { key: 'clock_out_1', label: '下1', item: rec.clock_out_1 },
    { key: 'clock_in_2', label: '上2', item: rec.clock_in_2 },
    { key: 'clock_out_2', label: '下2', item: rec.clock_out_2 },
  ];

  fieldsToCheck.forEach(({ label, item, key }) => {
    if (item?.value) {
      if (item.confidence < 0.65) {
        hasLowConfidence = true;
        issues.push({
          code: 'LOW_CONFIDENCE',
          severity: 'error',
          message: `${label} 欄位 AI 辨識可信度過低 (${Math.round(item.confidence * 100)}% < 65%)，需人工確認`,
          field: key,
        });
      } else if (item.confidence < 0.85) {
        hasMediumConfidence = true;
        issues.push({
          code: 'MEDIUM_CONFIDENCE',
          severity: 'warning',
          message: `${label} 欄位 AI 辨識可信度中等 (${Math.round(item.confidence * 100)}% < 85%)，建議隨卡複核`,
          field: key,
        });
      }
    }
  });

  // 8. 同一員工同一天是否已有正式紀錄
  const existingRecord = existingDailyRecords.find(
    (r) => r.employee_id === employeeId && r.work_date === workDate && r.verification_status === 'verified'
  );

  if (existingRecord) {
    hasDuplicateRecord = true;
    issues.push({
      code: 'DUPLICATE_RECORD',
      severity: 'error',
      message: '這一天已存在工時資料（禁止直接自動覆蓋）',
    });
  }

  // 決定此日綜合狀態 (Status Determination)
  let status: RecordStatusType = 'normal';

  const hasErrors = issues.some((i) => i.severity === 'error');
  const hasWarnings = issues.some((i) => i.severity === 'warning');

  if (hasDuplicateRecord || hasLowConfidence || hasErrors) {
    status = 'abnormal';
  } else if (hasMediumConfidence || hasWarnings) {
    status = 'needs_confirmation';
  } else {
    status = 'normal';
  }

  return {
    date: rec.date,
    workDate,
    status,
    issues,
    hasLowConfidence,
    hasMediumConfidence,
    hasDuplicateRecord,
    existingRecord,
    calculatedMinutes: totalMins,
  };
}

/**
 * Generates default 31-day recognition records for timecard verification preview
 */
export function generateDefault31DayRecognition(yearMonth: string, employeeId?: string): RecognitionDailyRecord[] {
  const records: RecognitionDailyRecord[] = [];

  for (let day = 1; day <= 31; day++) {
    let cIn1 = '08:30';
    let cOut1 = '17:00';
    let cIn2 = '';
    let cOut2 = '';
    let conf1In = 0.96;
    let conf1Out = 0.95;
    let conf2In = 0.95;
    let conf2Out = 0.95;

    // Day 3 matches user prompt example:
    // 上班① 09:17 / 下班① 15:39
    // 上班② 17:35 / 下班② 21:53 -> 計算結果：10時40分
    if (day === 3) {
      cIn1 = '09:17';
      cOut1 = '15:39';
      cIn2 = '17:35';
      cOut2 = '21:53';
      conf1In = 0.95;
      conf1Out = 0.92;
      conf2In = 0.91;
      conf2Out = 0.94;
    } else if (day === 5) {
      // Medium confidence example (黃色提示)
      cIn1 = '08:35';
      cOut1 = '17:05';
      conf1In = 0.76; // < 0.85 (Medium)
      conf1Out = 0.95;
    } else if (day === 12) {
      // Low confidence example (紅色提示)
      cIn1 = '08:42';
      cOut1 = '17:15';
      conf1In = 0.52; // < 0.65 (Low)
      conf1Out = 0.92;
    } else if (day === 18) {
      // Missing punch example (紅色提示)
      cIn1 = '09:00';
      cOut1 = ''; // Missing clock out
      conf1In = 0.91;
      conf1Out = 0.0;
    } else if (day % 7 === 6 || day % 7 === 0) {
      // Weekend / Off days
      cIn1 = '';
      cOut1 = '';
    } else {
      // Normal weekdays
      const jitterIn = (day * 3) % 15;
      const jitterOut = (day * 5) % 20;
      cIn1 = `08:${String(25 + (day % 10)).padStart(2, '0')}`;
      cOut1 = `17:${String(jitterOut).padStart(2, '0')}`;
      conf1In = 0.92 + (day % 7) * 0.01;
      conf1Out = 0.91 + (day % 5) * 0.01;
    }

    records.push({
      date: day,
      clock_in_1: { value: cIn1 || null, confidence: cIn1 ? conf1In : 1.0 },
      clock_out_1: { value: cOut1 || null, confidence: cOut1 ? conf1Out : 1.0 },
      clock_in_2: { value: cIn2 || null, confidence: cIn2 ? conf2In : 1.0 },
      clock_out_2: { value: cOut2 || null, confidence: cOut2 ? conf2Out : 1.0 },
    });
  }

  return records;
}

