/**
 * Low-Level Google Sheets REST API Client
 * Interacts directly with Google Sheets v4 and Google Drive v3 REST APIs.
 */

export interface SheetTableConfig {
  sheetName: string;
  headers: string[];
  keyColumn: string; // Business key column name, e.g. "employee_id", "record_id", "recognition_id"
}

export const SHEET_SCHEMAS: Record<string, SheetTableConfig> = {
  EMPLOYEES: {
    sheetName: 'employees',
    headers: ['employee_id', 'store_id', 'name', 'status', 'hire_date', 'note', 'created_at', 'role', 'hourly_rate'],
    keyColumn: 'employee_id',
  },
  WORK_RECORDS: {
    sheetName: 'work_records',
    headers: [
      'record_id',
      'employee_id',
      'work_date',
      'clock_in_1',
      'clock_out_1',
      'clock_in_2',
      'clock_out_2',
      'period_1_minutes',
      'period_2_minutes',
      'total_minutes',
      'verification_status',
      'source',
      'recognition_id',
      'note',
      'created_at',
      'updated_at',
    ],
    keyColumn: 'record_id',
  },
  RECOGNITION_RECORDS: {
    sheetName: 'recognition_records',
    headers: [
      'recognition_id',
      'employee_id',
      'year',
      'month',
      'image_reference',
      'ai_confidence',
      'exception_count',
      'status',
      'created_at',
    ],
    keyColumn: 'recognition_id',
  },
};

export const SPREADSHEET_TITLE = 'AIPT時數統計_資料庫';

export class GoogleAuthService {
  public static getAccessToken(): string | null {
    return localStorage.getItem('g_sheets_token');
  }

  public static setAccessToken(token: string): void {
    localStorage.setItem('g_sheets_token', token);
    googleSheetsClient.setAccessToken(token);
  }

  public static clearAccessToken(): void {
    localStorage.removeItem('g_sheets_token');
    localStorage.removeItem('g_sheets_id');
    googleSheetsClient.clearAuth();
  }

  public static handle401Error(): void {
    this.clearAccessToken();
    console.warn('[GoogleAuthService] Access Token expired or invalid. Token cleared.');
  }
}

export class GoogleSheetsClient {
  private accessToken: string | null = null;
  private spreadsheetId: string | null = null;

  constructor() {
    this.accessToken = localStorage.getItem('g_sheets_token') || null;
  }

  public setAccessToken(token: string) {
    this.accessToken = token;
    localStorage.setItem('g_sheets_token', token);
  }

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  public setSpreadsheetId(id: string) {
    this.spreadsheetId = id;
  }

  public getSpreadsheetId(): string | null {
    return this.spreadsheetId;
  }

  public isConnected(): boolean {
    return !!this.accessToken;
  }

  public clearAuth() {
    this.accessToken = null;
    this.spreadsheetId = null;
    localStorage.removeItem('g_sheets_token');
    localStorage.removeItem('g_sheets_id');
  }

  /**
   * Request a fresh OAuth 2.0 Access Token using Google Identity Services (GIS) Token Model
   */
  public requestFreshAccessToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
      if (!clientId) {
        console.warn('[OAuth Debug] OAuth token obtained: false (Missing VITE_GOOGLE_CLIENT_ID)');
        return reject(new Error('未設定 VITE_GOOGLE_CLIENT_ID'));
      }
      if (typeof window === 'undefined' || !(window as any).google?.accounts?.oauth2) {
        console.warn('[OAuth Debug] OAuth token obtained: false (GIS SDK not loaded)');
        return reject(new Error('Google Identity Services SDK 尚未載入'));
      }

      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope:
            'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
          callback: (response: any) => {
            if (response.access_token) {
              console.log('[OAuth Debug] OAuth token obtained: true');
              console.log('[OAuth Debug] Token type: access token');
              console.log(
                '[OAuth Debug] Requested scopes: https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file'
              );
              this.setAccessToken(response.access_token);
              resolve(response.access_token);
            } else {
              console.warn('[OAuth Debug] OAuth token obtained: false', response.error);
              this.clearAuth();
              reject(new Error('Google 授權已失效，請重新連線 Google Sheet。'));
            }
          },
          error_callback: (err: any) => {
            console.warn('[OAuth Debug] OAuth error_callback:', err);
            this.clearAuth();
            reject(new Error('Google 授權已失效，請重新連線 Google Sheet。'));
          },
        });
        client.requestAccessToken();
      } catch (err: any) {
        console.warn('[OAuth Debug] GIS init failed:', err);
        this.clearAuth();
        reject(new Error('Google 授權已失效，請重新連線 Google Sheet。'));
      }
    });
  }

  private getAuthHeaders(): Record<string, string> {
    if (!this.accessToken) {
      throw new Error('Google OAuth Token 尚未設定或已過期，請先連結 Google 帳號。');
    }
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Finds existing spreadsheet in Google Drive by name, or creates a new one.
   */
  public async ensureSpreadsheet(): Promise<string> {
    if (!this.accessToken) {
      throw new Error('Missing OAuth Access Token');
    }

    if (this.spreadsheetId) {
      // Validate spreadsheet access
      try {
        const res = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}`,
          { headers: this.getAuthHeaders() }
        );
        if (res.ok) {
          await this.ensureSheetTabsAndHeaders();
          return this.spreadsheetId;
        }
      } catch (err) {
        console.warn('Existing spreadsheetId invalid or inaccessible, searching Drive...', err);
      }
    }

    // Search Drive for file with name "紙本打卡考勤系統_資料庫"
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(
      SPREADSHEET_TITLE
    )}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;

    const searchRes = await fetch(searchUrl, { headers: this.getAuthHeaders() });
    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        const foundId = data.files[0].id;
        this.setSpreadsheetId(foundId);
        await this.ensureSheetTabsAndHeaders();
        return foundId;
      }
    }

    // Create a new Spreadsheet with the 3 standardized tabs
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        properties: { title: SPREADSHEET_TITLE },
        sheets: [
          { properties: { title: SHEET_SCHEMAS.EMPLOYEES.sheetName } },
          { properties: { title: SHEET_SCHEMAS.WORK_RECORDS.sheetName } },
          { properties: { title: SHEET_SCHEMAS.RECOGNITION_RECORDS.sheetName } },
        ],
      }),
    });

    if (!createRes.ok) {
      const errJson = await createRes.json();
      throw new Error(`無法建立 Google Sheet 資料庫: ${errJson.error?.message || createRes.statusText}`);
    }

    const createdData = await createRes.json();
    const newId = createdData.spreadsheetId;
    this.setSpreadsheetId(newId);

    // Initialize Headers
    await this.ensureSheetTabsAndHeaders();

    return newId;
  }

  /**
   * Ensures that sheet tabs exist and headers match exact specification.
   */
  public async ensureSheetTabsAndHeaders(): Promise<void> {
    if (!this.spreadsheetId) return;

    // Get spreadsheet metadata to check existing sheet titles
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}`,
      { headers: this.getAuthHeaders() }
    );
    if (!metaRes.ok) return;

    const metaData = await metaRes.json();
    const existingTitles: string[] = (metaData.sheets || []).map(
      (s: any) => s.properties?.title
    );

    const requests: any[] = [];
    Object.values(SHEET_SCHEMAS).forEach((schema) => {
      if (!existingTitles.includes(schema.sheetName)) {
        requests.push({
          addSheet: {
            properties: { title: schema.sheetName },
          },
        });
      }
    });

    if (requests.length > 0) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ requests }),
      });
    }

    // Set header rows for all 3 sheets
    for (const schema of Object.values(SHEET_SCHEMAS)) {
      const rangeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${
        this.spreadsheetId
      }/values/${encodeURIComponent(schema.sheetName)}!A1:Z1?valueInputOption=USER_ENTERED`;

      // Check current header
      const getRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${
          this.spreadsheetId
        }/values/${encodeURIComponent(schema.sheetName)}!A1:Z1`,
        { headers: this.getAuthHeaders() }
      );

      let needsHeader = true;
      if (getRes.ok) {
        const getJson = await getRes.json();
        if (getJson.values && getJson.values.length > 0 && getJson.values[0].length > 0) {
          needsHeader = false;
        }
      }

      if (needsHeader) {
        await fetch(rangeUrl, {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            values: [schema.headers],
          }),
        });
      }
    }
  }

  /**
   * Reads all rows from a sheet and maps them to JSON objects by header column names.
   * Absolutely ZERO dependence on row index as IDs!
   */
  public async readTableRows<T extends Record<string, any>>(
    schema: SheetTableConfig
  ): Promise<T[]> {
    if (!this.spreadsheetId) throw new Error('Spreadsheet ID missing');

    const rangeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${
      this.spreadsheetId
    }/values/${encodeURIComponent(schema.sheetName)}!A1:Z1000`;

    const res = await fetch(rangeUrl, { headers: this.getAuthHeaders() });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`讀取 Sheet [${schema.sheetName}] 失敗: ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    const rows: string[][] = data.values || [];
    if (rows.length < 2) {
      return []; // No data rows (only header or empty)
    }

    const headerRow = rows[0];
    const dataRows = rows.slice(1);

    const result: T[] = dataRows.map((row) => {
      const obj: any = {};
      headerRow.forEach((colName, idx) => {
        const cellVal = row[idx] !== undefined ? row[idx] : '';
        obj[colName] = cellVal;
      });
      return obj as T;
    });

    return result;
  }

  /**
   * Appends or updates rows by business key column (`employee_id`, `record_id`, `recognition_id`).
   */
  public async upsertTableRows(
    schema: SheetTableConfig,
    itemsToUpsert: Record<string, any>[]
  ): Promise<void> {
    if (!this.spreadsheetId) throw new Error('Spreadsheet ID missing');

    // Fetch existing raw rows to locate row indices
    const rangeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${
      this.spreadsheetId
    }/values/${encodeURIComponent(schema.sheetName)}!A1:Z2000`;

    const res = await fetch(rangeUrl, { headers: this.getAuthHeaders() });
    let rows: string[][] = [];
    if (res.ok) {
      const data = await res.json();
      rows = data.values || [];
    }

    let headerRow = rows[0];
    if (!headerRow || headerRow.length === 0) {
      headerRow = schema.headers;
      rows = [headerRow];
    }

    const keyColIndex = headerRow.indexOf(schema.keyColumn);

    for (const item of itemsToUpsert) {
      const itemKeyValue = String(item[schema.keyColumn] || '');
      let existingRowIndex = -1;

      if (keyColIndex !== -1) {
        for (let r = 1; r < rows.length; r++) {
          if (String(rows[r][keyColIndex] || '') === itemKeyValue) {
            existingRowIndex = r + 1; // 1-based index in Google Sheets
            break;
          }
        }
      }

      // Convert object to row array matching header sequence
      const rowArray = headerRow.map((colName) => {
        const val = item[colName];
        if (val === undefined || val === null) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      });

      if (existingRowIndex > 0) {
        // Update existing row
        const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${
          this.spreadsheetId
        }/values/${encodeURIComponent(schema.sheetName)}!A${existingRowIndex}:Z${existingRowIndex}?valueInputOption=USER_ENTERED`;

        await fetch(updateUrl, {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ values: [rowArray] }),
        });
      } else {
        // Append new row
        const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${
          this.spreadsheetId
        }/values/${encodeURIComponent(schema.sheetName)}!A1:append?valueInputOption=USER_ENTERED`;

        await fetch(appendUrl, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ values: [rowArray] }),
        });
      }
    }
  }
}

export const googleSheetsClient = new GoogleSheetsClient();
