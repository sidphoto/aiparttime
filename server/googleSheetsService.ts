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
