export interface StoreRow {
  store_id: string;
  store_name: string;
  owner_name: string;
  status: string;
  created_at: string;
}

export interface EmployeeRow {
  employee_id: string;
  store_id: string;
  name: string;
  role?: string;
  hourly_rate?: number;
  status: string; // 'active' | 'inactive'
  hire_date: string;
  note: string;
  created_at: string;
}

export class CustomApiError extends Error {
  statusCode: number;
  errorCode?: string;
  constructor(statusCode: number, message: string, errorCode?: string) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

/**
  * Safely retrieves GOOGLE_SHEETS_SPREADSHEET_ID from server environment variables.
  * Throws 500 CONFIG_MISSING if not set.
  */
export function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!id || !id.trim()) {
    throw new CustomApiError(500, '尚未設定 GOOGLE_SHEETS_SPREADSHEET_ID 環境變數', 'CONFIG_MISSING');
  }
  return id.trim();
}

/**
 * Write row to Google Sheets API v4 using spreadsheets.values.append
 */
export async function appendSheetRow(
  sheetName: string,
  range: string,
  headers: string[],
  rowData: Record<string, any>,
  token: string
) {
  const spreadsheetId = getSpreadsheetId();
  const rowArray = headers.map((h) => (rowData[h] !== undefined && rowData[h] !== null ? String(rowData[h]) : ''));
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;

  console.log(`[GoogleSheets API Request] Range: ${range}, Spreadsheet ID: ${spreadsheetId}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [rowArray] }),
  });

  const responseText = await res.text();
  let responseJson: any = {};
  try {
    responseJson = JSON.parse(responseText);
  } catch (e) {
    responseJson = { raw: responseText };
  }

  if (!res.ok) {
    const errorMsg = responseJson.error?.message || responseText || `HTTP ${res.status}`;
    console.error(`Sheets API error message: ${errorMsg}`);
    if (res.status === 401) {
      throw new CustomApiError(401, 'Google 授權已失效，請重新連線 Google Sheet。', 'UNAUTHORIZED');
    }
    if (res.status === 403) {
      throw new CustomApiError(403, 'Google Sheet 存取權限不足，請確認 OAuth 帳號編輯權限。', 'FORBIDDEN');
    }
    throw new CustomApiError(
      res.status,
      `新增失敗，資料尚未寫入 Google Sheet (${errorMsg.slice(0, 80)})。`
    );
  }

  console.log(`[GoogleSheets API Success] HTTP Status: ${res.status}`);
  return responseJson;
}

/**
 * Update row in Google Sheets API v4
 */
async function updateSheetRow(
  sheetName: string,
  keyColumn: string,
  keyValue: string,
  headers: string[],
  updatedRowData: Record<string, any>,
  token: string
) {
  const spreadsheetId = getSpreadsheetId();
  
  // 1. Fetch current rows to find row index
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1:Z1000`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new CustomApiError(401, 'Google 授權已失效，請重新連線 Google Sheet。', 'UNAUTHORIZED');
    }
    const errTxt = await res.text();
    console.error(`[GoogleSheets API Update Read Error] HTTP Status: ${res.status}`, errTxt);
    throw new CustomApiError(res.status, `Google Sheet 讀取失敗 (HTTP ${res.status})`);
  }

  const json = (await res.json()) as any;
  const rows: string[][] = json.values || [];
  if (rows.length === 0) {
    throw new CustomApiError(404, 'Google Sheet 工作表為空');
  }

  let headerRow = [...rows[0]];
  let headerUpdated = false;
  headers.forEach((h) => {
    if (!headerRow.includes(h)) {
      headerRow.push(h);
      headerUpdated = true;
    }
  });

  if (headerUpdated) {
    const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1:Z1?valueInputOption=USER_ENTERED`;
    await fetch(headerUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [headerRow] }),
    });
  }

  const keyColIndex = headerRow.indexOf(keyColumn);
  if (keyColIndex === -1) {
    throw new CustomApiError(400, `找不到欄位: ${keyColumn}`);
  }

  let rowIndex = -1;
  for (let r = 1; r < rows.length; r++) {
    if (rows[r][keyColIndex] === keyValue) {
      rowIndex = r + 1; // 1-based index
      break;
    }
  }

  if (rowIndex === -1) {
    throw new CustomApiError(404, `找不到對應資料 ID: ${keyValue}`);
  }

  const rowArray = headerRow.map((h) => (updatedRowData[h] !== undefined && updatedRowData[h] !== null ? String(updatedRowData[h]) : ''));
  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A${rowIndex}:Z${rowIndex}?valueInputOption=USER_ENTERED`;

  const updateRes = await fetch(updateUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [rowArray] }),
  });

  if (!updateRes.ok) {
    if (updateRes.status === 401) {
      throw new CustomApiError(401, 'Google 授權已失效，請重新連線 Google Sheet。', 'UNAUTHORIZED');
    }
    const updateErr = await updateRes.text();
    console.error(`[GoogleSheets API Update Error] HTTP Status: ${updateRes.status}`, updateErr);
    throw new CustomApiError(updateRes.status, `Google Sheet 更新失敗 (HTTP ${updateRes.status})`);
  }

  return true;
}

// ==========================================
// STORE API SERVICE
// ==========================================
export async function getStoreFromSheet(storeId: string = 'S001', authHeader?: string): Promise<StoreRow> {
  const token = authHeader?.replace('Bearer ', '') || process.env.GOOGLE_OAUTH_TOKEN;
  if (!token) {
    throw new CustomApiError(401, '未提供 Access Token，請先連線 Google Sheet。', 'UNAUTHORIZED');
  }

  const spreadsheetId = getSpreadsheetId();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/stores!A1:Z100`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 401) throw new CustomApiError(401, 'Google 授權已失效，請重新連線 Google Sheet。', 'UNAUTHORIZED');
    // If range cannot be parsed (sheet tab doesn't exist yet) or other non-auth error, return default store
    return {
      store_id: 'S001',
      store_name: 'Alpha 門市',
      owner_name: '店長',
      status: 'active',
      created_at: new Date().toISOString(),
    };
  }

  const json = (await res.json()) as any;
  const rows: string[][] = json.values || [];
  if (rows.length > 1) {
    const headerRow = rows[0];
    const storeIdIdx = headerRow.indexOf('store_id');
    const storeNameIdx = headerRow.indexOf('store_name');
    const ownerNameIdx = headerRow.indexOf('owner_name');

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row && (storeIdIdx === -1 || row[storeIdIdx] === storeId)) {
        return {
          store_id: storeId,
          store_name: storeNameIdx !== -1 && row[storeNameIdx] ? row[storeNameIdx] : 'Alpha 門市',
          owner_name: ownerNameIdx !== -1 && row[ownerNameIdx] ? row[ownerNameIdx] : '店長',
          status: 'active',
          created_at: new Date().toISOString(),
        };
      }
    }
  }

  return {
    store_id: 'S001',
    store_name: 'Alpha 門市',
    owner_name: '店長',
    status: 'active',
    created_at: new Date().toISOString(),
  };
}

// ==========================================
// EMPLOYEE API SERVICE
// ==========================================
export async function getEmployeesFromSheet(storeId: string = 'S001', authHeader?: string): Promise<EmployeeRow[]> {
  const spreadsheetId = getSpreadsheetId();
  const token = authHeader?.replace('Bearer ', '') || process.env.GOOGLE_OAUTH_TOKEN;

  if (!token) {
    throw new CustomApiError(401, '未提供 Google Access Token，請點選「連線 Google Sheet」進行授權。', 'UNAUTHORIZED');
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/employees!A1:I1000`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new CustomApiError(401, 'Google 授權已失效，請點選「連線 Google Sheet」重新授權。', 'UNAUTHORIZED');
    }
    if (res.status === 403) {
      throw new CustomApiError(403, 'Google Sheet 存取權限不足，請確認該帳號具備編輯試算表權限。', 'FORBIDDEN');
    }
    let errDetail = '';
    try {
      const errJson = await res.json();
      errDetail = errJson?.error?.message || '';
    } catch {
      errDetail = await res.text().catch(() => '');
    }

    // Handle HTTP 400 "Unable to parse range" when sheet tab 'employees' does not exist yet
    if (res.status === 400 || errDetail.includes('Unable to parse range') || errDetail.includes('Range')) {
      console.log('[GoogleSheetsService] employees!A1:I1000 tab not found yet in spreadsheet. Returning empty employee list.');
      return [];
    }

    throw new CustomApiError(res.status, `Google Sheet 讀取失敗 (${res.status}): ${errDetail.slice(0, 100)}`);
  }

  const json = (await res.json()) as any;
  const rows: string[][] = json.values || [];
  if (rows.length <= 1) {
    return [];
  }

  const headerRow = rows[0];
  const empIdIdx = headerRow.indexOf('employee_id');
  const storeIdIdx = headerRow.indexOf('store_id');
  const nameIdx = headerRow.indexOf('name');
  const statusIdx = headerRow.indexOf('status');
  const hireDateIdx = headerRow.indexOf('hire_date');
  const noteIdx = headerRow.indexOf('note');
  const createdAtIdx = headerRow.indexOf('created_at');
  const roleIdx = headerRow.indexOf('role');
  const hourlyRateIdx = headerRow.indexOf('hourly_rate') !== -1 ? headerRow.indexOf('hourly_rate') : headerRow.indexOf('hourlyRate');

  const parsedList: EmployeeRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const empId = empIdIdx !== -1 && row[empIdIdx] ? row[empIdIdx].trim() : row[0]?.trim() || '';
    if (!empId) continue;

    parsedList.push({
      employee_id: empId,
      store_id: storeIdIdx !== -1 && row[storeIdIdx] ? row[storeIdIdx] : storeId,
      name: nameIdx !== -1 && row[nameIdx] ? row[nameIdx].trim() : '未命名員工',
      role: roleIdx !== -1 && row[roleIdx] ? row[roleIdx] : '兼職工讀',
      hourly_rate: hourlyRateIdx !== -1 && row[hourlyRateIdx] ? Number(row[hourlyRateIdx]) || 195 : 195,
      status: statusIdx !== -1 && row[statusIdx] === 'inactive' ? 'inactive' : 'active',
      hire_date: hireDateIdx !== -1 && row[hireDateIdx] ? row[hireDateIdx] : '',
      note: noteIdx !== -1 && row[noteIdx] ? row[noteIdx] : '',
      created_at: createdAtIdx !== -1 && row[createdAtIdx] ? row[createdAtIdx] : new Date().toISOString(),
    });
  }

  return parsedList.filter((e) => e.status === 'active');
}

export async function addEmployeeToSheet(
  data: { name: string; role?: string; hourly_rate?: number; hire_date?: string; note?: string; store_id?: string },
  authHeader?: string
): Promise<EmployeeRow> {
  const spreadsheetId = getSpreadsheetId();
  const token = authHeader?.replace('Bearer ', '') || process.env.GOOGLE_OAUTH_TOKEN;

  if (!token) {
    throw new CustomApiError(401, '未提供 Google Access Token，請點選「連線 Google Sheet」進行授權。', 'UNAUTHORIZED');
  }

  // 1. Read employees!A:A directly from Google Sheet to get real current employee_ids
  const fetchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/employees!A:A`;
  const fetchRes = await fetch(fetchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  let colAValues: string[][] = [];
  if (fetchRes.ok) {
    const fetchJson = (await fetchRes.json()) as any;
    colAValues = fetchJson.values || [];
  } else {
    if (fetchRes.status === 401) {
      throw new CustomApiError(401, 'Google 授權已失效，請重新連線 Google Sheet。', 'UNAUTHORIZED');
    }
    if (fetchRes.status === 403) {
      throw new CustomApiError(403, 'Google Sheet 存取權限不足，請確認編輯權限。', 'FORBIDDEN');
    }
    let errDetail = '';
    try {
      const errJson = await fetchRes.json();
      errDetail = errJson?.error?.message || '';
    } catch {
      errDetail = await fetchRes.text().catch(() => '');
    }
    if (fetchRes.status !== 400 && !errDetail.includes('Unable to parse range')) {
      throw new CustomApiError(fetchRes.status, `新增失敗，無法存取 Google Sheet 員工列表。`);
    }
  }

  // Find maximum E-number from Column A
  let maxNum = 0;
  for (let i = 1; i < colAValues.length; i++) {
    const cellVal = colAValues[i]?.[0] || '';
    const match = cellVal.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  const newEmpId = `E${String(maxNum + 1).padStart(3, '0')}`;
  const nowIso = new Date().toISOString();

  const newEmp: EmployeeRow = {
    employee_id: newEmpId,
    store_id: data.store_id || 'S001',
    name: data.name.trim(),
    role: data.role || '兼職工讀',
    hourly_rate: data.hourly_rate !== undefined ? Number(data.hourly_rate) : 195,
    status: 'active',
    hire_date: data.hire_date || new Date().toISOString().split('T')[0],
    note: data.note ? data.note.trim() : '',
    created_at: nowIso,
  };

  const headers = ['employee_id', 'store_id', 'name', 'status', 'hire_date', 'note', 'created_at', 'role', 'hourly_rate'];

  // Ensure header row includes role and hourly_rate in A1:I1
  try {
    const checkHeaderUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/employees!A1:I1`;
    const checkRes = await fetch(checkHeaderUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (checkRes.ok) {
      const checkJson = await checkRes.json();
      const existingHeaders: string[] = checkJson.values?.[0] || [];
      if (!existingHeaders.includes('role') || (!existingHeaders.includes('hourly_rate') && !existingHeaders.includes('hourlyRate'))) {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/employees!A1:I1?valueInputOption=USER_ENTERED`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [headers] }),
        });
      }
    }
  } catch (e) {
    console.warn('[GoogleSheetsService] Header check warning:', e);
  }

  // Append to Google Sheet
  await appendSheetRow('employees', 'employees!A:I', headers, newEmp, token);

  return newEmp;
}

export async function updateEmployeeInSheet(
  employee_id: string,
  updates: { name?: string; role?: string; hourly_rate?: number; status?: string; hire_date?: string; note?: string },
  authHeader?: string
): Promise<EmployeeRow> {
  const spreadsheetId = getSpreadsheetId();
  const token = authHeader?.replace('Bearer ', '') || process.env.GOOGLE_OAUTH_TOKEN;

  if (!token) {
    throw new CustomApiError(401, '未提供 Google Access Token，請先連線 Google Sheet。', 'UNAUTHORIZED');
  }

  // 1. Read existing row from Google Sheet
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/employees!A1:I1000`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 401) throw new CustomApiError(401, 'Google 授權已失效，請重新連線 Google Sheet。', 'UNAUTHORIZED');
    throw new CustomApiError(res.status, '讀取 Google Sheet 員工資料失敗');
  }

  const json = (await res.json()) as any;
  const rows: string[][] = json.values || [];
  if (rows.length <= 1) {
    throw new CustomApiError(404, `Google Sheet 中找不到員工 ID: ${employee_id}`);
  }

  const headerRow = rows[0];
  const empIdIdx = headerRow.indexOf('employee_id');
  const storeIdIdx = headerRow.indexOf('store_id');
  const nameIdx = headerRow.indexOf('name');
  const statusIdx = headerRow.indexOf('status');
  const hireDateIdx = headerRow.indexOf('hire_date');
  const noteIdx = headerRow.indexOf('note');
  const createdAtIdx = headerRow.indexOf('created_at');
  const roleIdx = headerRow.indexOf('role');
  const hourlyRateIdx = headerRow.indexOf('hourly_rate') !== -1 ? headerRow.indexOf('hourly_rate') : headerRow.indexOf('hourlyRate');

  let existingRow: string[] | null = null;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i] && rows[i][empIdIdx !== -1 ? empIdIdx : 0] === employee_id) {
      existingRow = rows[i];
      break;
    }
  }

  if (!existingRow) {
    throw new CustomApiError(404, `Google Sheet 中找不到員工 ID: ${employee_id}`);
  }

  const updatedEmp: EmployeeRow = {
    employee_id,
    store_id: storeIdIdx !== -1 && existingRow[storeIdIdx] ? existingRow[storeIdIdx] : 'S001',
    name: updates.name !== undefined ? updates.name.trim() : (nameIdx !== -1 ? existingRow[nameIdx] : ''),
    role: updates.role !== undefined ? updates.role : (roleIdx !== -1 ? existingRow[roleIdx] : '兼職工讀'),
    hourly_rate: updates.hourly_rate !== undefined ? Number(updates.hourly_rate) : (hourlyRateIdx !== -1 ? Number(existingRow[hourlyRateIdx]) || 195 : 195),
    status: updates.status !== undefined ? (updates.status === 'inactive' ? 'inactive' : 'active') : (statusIdx !== -1 && existingRow[statusIdx] === 'inactive' ? 'inactive' : 'active'),
    hire_date: updates.hire_date !== undefined ? updates.hire_date : (hireDateIdx !== -1 ? existingRow[hireDateIdx] : ''),
    note: updates.note !== undefined ? updates.note.trim() : (noteIdx !== -1 ? existingRow[noteIdx] : ''),
    created_at: createdAtIdx !== -1 && existingRow[createdAtIdx] ? existingRow[createdAtIdx] : new Date().toISOString(),
  };

  const headers = ['employee_id', 'store_id', 'name', 'status', 'hire_date', 'note', 'created_at', 'role', 'hourly_rate'];
  await updateSheetRow('employees', 'employee_id', employee_id, headers, updatedEmp, token);

  return updatedEmp;
}

export async function deleteEmployeeInSheet(employee_id: string, authHeader?: string): Promise<boolean> {
  const token = authHeader?.replace('Bearer ', '') || process.env.GOOGLE_OAUTH_TOKEN;
  if (!token) {
    throw new CustomApiError(401, '未提供 Google Access Token，請先連線 Google Sheet。', 'UNAUTHORIZED');
  }

  await updateSheetRow('employees', 'employee_id', employee_id, ['employee_id', 'store_id', 'name', 'status', 'hire_date', 'note', 'created_at'], {
    employee_id,
    status: 'inactive'
  }, token);

  return true;
}

export async function syncAllEmployeesToSheet(authHeader?: string): Promise<{ success: boolean; syncedCount: number; message?: string }> {
  const spreadsheetId = getSpreadsheetId();
  const token = authHeader?.replace('Bearer ', '') || process.env.GOOGLE_OAUTH_TOKEN;
  if (!token) {
    throw new CustomApiError(401, '未提供 Access Token，無法同步。', 'UNAUTHORIZED');
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/employees!A1:Z1000`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (res.status === 401) {
      throw new CustomApiError(401, 'Google 授權已失效，請點擊「連線 Google Sheet」重新授權。', 'UNAUTHORIZED');
    }
    if (res.status === 403) {
      throw new CustomApiError(403, 'Google Sheet 存取權限不足，請確認 OAuth 帳號編輯權限。', 'FORBIDDEN');
    }
    throw new CustomApiError(res.status, 'Google Sheet 讀取失敗');
  }

  const json = (await res.json()) as any;
  const rows: string[][] = json.values || [];
  if (rows.length === 0) {
    return { success: true, syncedCount: 0 };
  }

  const standardHeaders = ['employee_id', 'store_id', 'name', 'status', 'hire_date', 'note', 'created_at', 'role', 'hourly_rate'];
  const headerRow = rows[0];

  const empIdIdx = headerRow.indexOf('employee_id');
  const storeIdIdx = headerRow.indexOf('store_id');
  const nameIdx = headerRow.indexOf('name');
  const statusIdx = headerRow.indexOf('status');
  const hireDateIdx = headerRow.indexOf('hire_date');
  const noteIdx = headerRow.indexOf('note');
  const createdAtIdx = headerRow.indexOf('created_at');
  const roleIdx = headerRow.indexOf('role');
  const hourlyRateIdx = headerRow.indexOf('hourly_rate') !== -1 ? headerRow.indexOf('hourly_rate') : headerRow.indexOf('hourlyRate');

  const newMatrix: string[][] = [standardHeaders];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const empId = empIdIdx !== -1 && r[empIdIdx] ? r[empIdIdx] : r[0] || '';
    if (!empId) continue;

    const storeId = storeIdIdx !== -1 && r[storeIdIdx] ? r[storeIdIdx] : 'S001';
    const name = nameIdx !== -1 && r[nameIdx] ? r[nameIdx] : r[2] || '';
    const status = statusIdx !== -1 && r[statusIdx] ? r[statusIdx] : 'active';
    const hireDate = hireDateIdx !== -1 && r[hireDateIdx] ? r[hireDateIdx] : '';
    const note = noteIdx !== -1 && r[noteIdx] ? r[noteIdx] : '';
    const createdAt = createdAtIdx !== -1 && r[createdAtIdx] ? r[createdAtIdx] : new Date().toISOString();
    const role = roleIdx !== -1 && r[roleIdx] ? r[roleIdx] : '兼職工讀';
    const hourlyRate = hourlyRateIdx !== -1 && r[hourlyRateIdx] ? r[hourlyRateIdx] : '195';

    newMatrix.push([
      empId,
      storeId,
      name,
      status,
      hireDate,
      note,
      createdAt,
      role,
      hourlyRate,
    ]);
  }

  const putUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/employees!A1:I${newMatrix.length}?valueInputOption=USER_ENTERED`;
  const putRes = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: newMatrix }),
  });

  if (!putRes.ok) {
    const errTxt = await putRes.text();
    throw new CustomApiError(putRes.status, `Google Sheet 同步失敗: ${errTxt}`);
  }

  return { success: true, syncedCount: newMatrix.length - 1 };
}

// === WORK RECORDS SHEET OPERATIONS (`work_records`) ===

export interface WorkRecordRow {
  record_id: string;
  store_id: string;
  employee_id: string;
  work_date: string;
  clock_in_1: string;
  clock_out_1: string;
  clock_in_2: string;
  clock_out_2: string;
  period_1_minutes: number;
  period_2_minutes: number;
  total_minutes: number;
  is_overnight_1: boolean;
  is_overnight_2: boolean;
  verification_status: string;
  source: string;
  created_at: string;
  updated_at: string;
}

const WORK_RECORDS_HEADERS = [
  'record_id',
  'store_id',
  'employee_id',
  'work_date',
  'clock_in_1',
  'clock_out_1',
  'clock_in_2',
  'clock_out_2',
  'period_1_minutes',
  'period_2_minutes',
  'total_minutes',
  'is_overnight_1',
  'is_overnight_2',
  'verification_status',
  'source',
  'created_at',
  'updated_at',
];

/**
 * Converts "HH:MM" string to minutes from midnight. Returns -1 if invalid.
 */
function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return -1;
  const parts = timeStr.split(':').map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return -1;
  return parts[0] * 60 + parts[1];
}

/**
 * Deterministic Server-side calculation for work period minutes
 */
function calculatePeriodMinutesServer(
  clockIn: string,
  clockOut: string,
  isOvernight?: boolean
): { minutes: number; isOvernightCandidate: boolean } {
  const inM = parseTimeToMinutes(clockIn);
  const outM = parseTimeToMinutes(clockOut);

  if (inM < 0 || outM < 0) {
    return { minutes: 0, isOvernightCandidate: false };
  }

  if (outM < inM || isOvernight) {
    // Cross-midnight: Add 24h (1440 mins)
    const minutes = (outM + 1440) - inM;
    return { minutes: Math.max(0, minutes), isOvernightCandidate: true };
  } else {
    return { minutes: Math.max(0, outM - inM), isOvernightCandidate: false };
  }
}

export async function getWorkRecordsFromSheet(authHeader?: string): Promise<WorkRecordRow[]> {
  const spreadsheetId = getSpreadsheetId();
  const token = authHeader?.replace('Bearer ', '') || process.env.GOOGLE_OAUTH_TOKEN;
  if (!token) {
    throw new CustomApiError(401, '未提供 Access Token，無法取得工時紀錄。', 'UNAUTHORIZED');
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/work_records!A1:Q1000`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 404 || res.status === 400) {
      return [];
    }
    if (res.status === 401) {
      throw new CustomApiError(401, 'Google 授權已失效，請重新連線 Google Sheet。', 'UNAUTHORIZED');
    }
    if (res.status === 403) {
      throw new CustomApiError(403, 'Google Sheet 存取權限不足，請確認 OAuth 帳號編輯權限。', 'FORBIDDEN');
    }
    return [];
  }

  const json = (await res.json()) as any;
  const rows: string[][] = json.values || [];
  if (rows.length <= 1) {
    return [];
  }

  const header = rows[0];
  const recordIdIdx = header.indexOf('record_id');
  const storeIdIdx = header.indexOf('store_id');
  const empIdIdx = header.indexOf('employee_id');
  const dateIdx = header.indexOf('work_date');
  const in1Idx = header.indexOf('clock_in_1');
  const out1Idx = header.indexOf('clock_out_1');
  const in2Idx = header.indexOf('clock_in_2');
  const out2Idx = header.indexOf('clock_out_2');
  const p1Idx = header.indexOf('period_1_minutes');
  const p2Idx = header.indexOf('period_2_minutes');
  const totalIdx = header.indexOf('total_minutes');
  const over1Idx = header.indexOf('is_overnight_1');
  const over2Idx = header.indexOf('is_overnight_2');
  const statusIdx = header.indexOf('verification_status');
  const sourceIdx = header.indexOf('source');
  const createdIdx = header.indexOf('created_at');
  const updatedIdx = header.indexOf('updated_at');

  const records: WorkRecordRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const recordId = recordIdIdx !== -1 && r[recordIdIdx] ? r[recordIdIdx] : r[0];
    if (!recordId) continue;

    const empId = empIdIdx !== -1 && r[empIdIdx] ? r[empIdIdx] : r[2] || '';
    const workDate = dateIdx !== -1 && r[dateIdx] ? r[dateIdx] : r[3] || '';
    const clockIn1 = in1Idx !== -1 && r[in1Idx] ? r[in1Idx] : '';
    const clockOut1 = out1Idx !== -1 && r[out1Idx] ? r[out1Idx] : '';
    const clockIn2 = in2Idx !== -1 && r[in2Idx] ? r[in2Idx] : '';
    const clockOut2 = out2Idx !== -1 && r[out2Idx] ? r[out2Idx] : '';

    const p1 = Number(p1Idx !== -1 && r[p1Idx] ? r[p1Idx] : 0);
    const p2 = Number(p2Idx !== -1 && r[p2Idx] ? r[p2Idx] : 0);
    const totalM = Number(totalIdx !== -1 && r[totalIdx] ? r[totalIdx] : p1 + p2);

    records.push({
      record_id: recordId,
      store_id: storeIdIdx !== -1 && r[storeIdIdx] ? r[storeIdIdx] : 'S001',
      employee_id: empId,
      work_date: workDate,
      clock_in_1: clockIn1,
      clock_out_1: clockOut1,
      clock_in_2: clockIn2,
      clock_out_2: clockOut2,
      period_1_minutes: isNaN(p1) ? 0 : p1,
      period_2_minutes: isNaN(p2) ? 0 : p2,
      total_minutes: isNaN(totalM) ? 0 : totalM,
      is_overnight_1: over1Idx !== -1 ? r[over1Idx] === 'true' : false,
      is_overnight_2: over2Idx !== -1 ? r[over2Idx] === 'true' : false,
      verification_status: statusIdx !== -1 && r[statusIdx] ? r[statusIdx] : 'verified',
      source: sourceIdx !== -1 && r[sourceIdx] ? r[sourceIdx] : 'manual',
      created_at: createdIdx !== -1 && r[createdIdx] ? r[createdIdx] : new Date().toISOString(),
      updated_at: updatedIdx !== -1 && r[updatedIdx] ? r[updatedIdx] : new Date().toISOString(),
    });
  }

  return records;
}

export async function saveWorkRecordToSheet(
  data: {
    record_id?: string;
    employee_id: string;
    work_date: string;
    clock_in_1?: string;
    clock_out_1?: string;
    clock_in_2?: string;
    clock_out_2?: string;
    is_overnight_1?: boolean;
    is_overnight_2?: boolean;
    verification_status?: string;
    source?: string;
    break_minutes?: number;
    store_id?: string;
  },
  authHeader?: string
): Promise<WorkRecordRow> {
  const token = authHeader?.replace('Bearer ', '') || process.env.GOOGLE_OAUTH_TOKEN;
  if (!token) {
    throw new CustomApiError(401, '未提供 Access Token，無法儲存工時。', 'UNAUTHORIZED');
  }

  // 1. INPUT VALIDATION: Check break_minutes
  if (data.break_minutes !== undefined && data.break_minutes < 0) {
    throw new CustomApiError(400, '休息時間不能為負數', 'INVALID_BREAK_MINUTES');
  }

  // 2. INPUT VALIDATION: Validate employee_id exists in employees Sheet
  const employees = await getEmployeesFromSheet(data.store_id || 'S001', authHeader);
  const matchedEmp = employees.find(
    (e) => e.employee_id === data.employee_id || e.name === data.employee_id
  );
  if (!matchedEmp && employees.length > 0) {
    throw new CustomApiError(400, `員工 (${data.employee_id}) 不存在於員工列表中`, 'INVALID_EMPLOYEE');
  }

  const effectiveEmpId = matchedEmp ? matchedEmp.employee_id : data.employee_id;

  // 3. DETERMINISTIC SERVER-SIDE TIME CALCULATION
  const in1 = data.clock_in_1 || '';
  const out1 = data.clock_out_1 || '';
  const in2 = data.clock_in_2 || '';
  const out2 = data.clock_out_2 || '';

  const p1Result = calculatePeriodMinutesServer(in1, out1, data.is_overnight_1);
  const p2Result = calculatePeriodMinutesServer(in2, out2, data.is_overnight_2);

  const breakMins = Math.max(0, Number(data.break_minutes || 0));
  const rawTotalMinutes = p1Result.minutes + p2Result.minutes;
  // Ignore client-provided forged work_minutes and recalculate
  const total_minutes = Math.max(0, rawTotalMinutes - breakMins);

  const record_id = data.record_id || `WR${Date.now()}`;
  const nowStr = new Date().toISOString();

  // 4. DEDUPLICATION CHECK: Check duplicate employee_id + work_date + clock_in_1 + clock_out_1
  const existingRecords = await getWorkRecordsFromSheet(authHeader);
  const duplicate = existingRecords.find(
    (r) =>
      r.record_id !== record_id &&
      r.employee_id === effectiveEmpId &&
      r.work_date === data.work_date &&
      r.clock_in_1 === in1 &&
      r.clock_out_1 === out1
  );

  if (duplicate) {
    throw new CustomApiError(
      409,
      `已有相同的工時紀錄 (${data.work_date} ${in1}~${out1})，請勿重複提交`,
      'DUPLICATE_WORK_RECORD'
    );
  }

  const recordRow: WorkRecordRow = {
    record_id,
    store_id: data.store_id || 'S001',
    employee_id: effectiveEmpId,
    work_date: data.work_date,
    clock_in_1: in1,
    clock_out_1: out1,
    clock_in_2: in2,
    clock_out_2: out2,
    period_1_minutes: p1Result.minutes,
    period_2_minutes: p2Result.minutes,
    total_minutes,
    is_overnight_1: data.is_overnight_1 ?? p1Result.isOvernightCandidate,
    is_overnight_2: data.is_overnight_2 ?? p2Result.isOvernightCandidate,
    verification_status: data.verification_status || 'verified',
    source: data.source || 'manual',
    created_at: nowStr,
    updated_at: nowStr,
  };

  // Check if updating existing row or appending new row
  const existingIndex = existingRecords.findIndex((r) => r.record_id === record_id);
  if (existingIndex !== -1) {
    await updateSheetRow(
      'work_records',
      'record_id',
      record_id,
      WORK_RECORDS_HEADERS,
      recordRow as any,
      token
    );
  } else {
    await appendSheetRow(
      'work_records',
      'work_records!A:Q',
      WORK_RECORDS_HEADERS,
      recordRow as any,
      token
    );
  }

  return recordRow;
}

