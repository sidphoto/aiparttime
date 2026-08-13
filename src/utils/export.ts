import { StoreSummary, StoreSettings, EmployeeSummary, ShiftLog } from '../types';

/**
 * Downloads a string as a CSV file with UTF-8 BOM for Microsoft Excel compatibility
 */
export function downloadCSV(filename: string, csvContent: string) {
  // UTF-8 BOM prefix \uFEFF ensures Excel renders Traditional Chinese properly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Converts Store Summary data to CSV spreadsheet format
 */
export function generateStoreSummaryCSV(summary: StoreSummary, storeName: string): string {
  const lines: string[] = [];

  lines.push(`"${storeName} - 人員時數與薪資統計報表"`);
  lines.push(`"統計週期", "${summary.periodLabel}"`);
  lines.push(`"匯出時間", "${new Date().toLocaleString('zh-TW')}"`);
  lines.push(`"總出勤班次", "${summary.totalShifts} 班"`);
  lines.push(`"總工作時數", "${summary.totalNetHours} 小時"`);
  lines.push(`"總預估薪資", "NT$ ${summary.totalPay.toLocaleString()}"`);
  lines.push('');

  // Table header
  lines.push([
    '員工編號',
    '姓名',
    '職級',
    '時薪(元)',
    '出勤天數',
    '總班次',
    '正常工時(h)',
    '加班1.34x(h)',
    '加班1.67x(h)',
    '總計淨時數(h)',
    '基本薪資(元)',
    '加班費(元)',
    '總估算薪資(元)'
  ].map(h => `"${h}"`).join(','));

  summary.employeeSummaries.forEach(s => {
    lines.push([
      s.employee.employeeNo,
      s.employee.name,
      s.employee.role,
      s.employee.hourlyRate,
      s.totalDays,
      s.totalShifts,
      s.regularHours,
      s.overtimeHours1,
      s.overtimeHours2,
      s.totalNetHours,
      s.regularPay,
      s.overtimePay,
      s.totalPay
    ].map(v => `"${v}"`).join(','));
  });

  return lines.join('\n');
}

/**
 * Converts Shift Logs detail to CSV format
 */
export function generateShiftLogsCSV(shifts: ShiftLog[], storeName: string): string {
  const lines: string[] = [];

  lines.push(`"${storeName} - 打卡與工時明細表"`);
  lines.push(`"匯出時間", "${new Date().toLocaleString('zh-TW')}"`);
  lines.push('');

  lines.push([
    '日期',
    '員工姓名',
    '上班時間',
    '下班時間',
    '扣除休息(分)',
    '時薪',
    '正常時數',
    '加班時數1(1.34x)',
    '加班時數2(1.67x)',
    '總時數(h)',
    '估算薪資',
    '備註'
  ].map(h => `"${h}"`).join(','));

  shifts.forEach(s => {
    lines.push([
      s.date,
      s.note ? `${s.employeeId}` : s.employeeId, // replaced later or used with map
      s.startTime,
      s.endTime,
      s.breakMinutes,
      s.hourlyRate,
      s.regularHours,
      s.overtimeHours1,
      s.overtimeHours2,
      s.totalNetHours,
      s.totalPay,
      s.note || ''
    ].map(v => `"${v}"`).join(','));
  });

  return lines.join('\n');
}

/**
 * Formats report into a clean text message for LINE / SMS group chat
 */
export function generateLineReportText(summary: StoreSummary, storeName: string): string {
  let text = `📊 【${storeName}】人員工時與薪資結算通報\n`;
  text += `🗓️ 統計週期：${summary.periodLabel}\n`;
  text += `--------------------------------\n`;
  text += `👥 出勤人數：${summary.employeeSummaries.filter(e => e.totalShifts > 0).length} 人\n`;
  text += `⏱️ 總排班時數：${summary.totalNetHours} 小時 (班次: ${summary.totalShifts} 次)\n`;
  text += `💰 預估薪資總額：NT$ ${summary.totalPay.toLocaleString()}\n`;
  text += `--------------------------------\n`;
  text += `【個人時數與薪資明細】\n`;

  summary.employeeSummaries.forEach((s, idx) => {
    if (s.totalNetHours === 0) return;
    text += `${idx + 1}. ${s.employee.name} (${s.employee.role})\n`;
    text += `   • 出勤: ${s.totalDays} 天 / ${s.totalShifts} 班\n`;
    text += `   • 工時: ${s.totalNetHours} h (正常:${s.regularHours}h`;
    if (s.overtimeHours1 + s.overtimeHours2 > 0) {
      text += `, 加班:${(s.overtimeHours1 + s.overtimeHours2).toFixed(1)}h`;
    }
    text += `)\n`;
    text += `   • 預估薪資: NT$ ${s.totalPay.toLocaleString()}\n`;
  });

  text += `--------------------------------\n`;
  text += `💡 此報表由「門市工時統計APP」自動產生，請同仁核對個人時數。如有疑問請告知門市主管。`;

  return text;
}

/**
 * Formats wage slip text for a single employee
 */
export function generateEmployeePaySlipText(empSummary: EmployeeSummary, periodLabel: string, storeName: string): string {
  const e = empSummary.employee;
  let text = `🧾 【${storeName}】個人工時與薪資明細單\n`;
  text += `👤 姓名：${e.name} (${e.employeeNo})\n`;
  text += `標 職級：${e.role} (基本時薪: NT$ ${e.hourlyRate})\n`;
  text += `🗓️ 結算週期：${periodLabel}\n`;
  text += `--------------------------------\n`;
  text += `• 出勤天數：${empSummary.totalDays} 天 (${empSummary.totalShifts} 個班次)\n`;
  text += `• 正常工時：${empSummary.regularHours} 小時 -> NT$ ${empSummary.regularPay.toLocaleString()}\n`;
  if (empSummary.overtimeHours1 > 0) {
    text += `• 加班工時(1.34x)：${empSummary.overtimeHours1} 小時\n`;
  }
  if (empSummary.overtimeHours2 > 0) {
    text += `• 加班工時(1.67x)：${empSummary.overtimeHours2} 小時\n`;
  }
  if (empSummary.overtimePay > 0) {
    text += `• 加班費小計：NT$ ${empSummary.overtimePay.toLocaleString()}\n`;
  }
  text += `--------------------------------\n`;
  text += `💰 預估發放總額：NT$ ${empSummary.totalPay.toLocaleString()}\n`;
  return text;
}
