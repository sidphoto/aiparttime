import { IDataService } from './dataService';
import { Employee, DailyWorkRecord, TimecardRecord } from '../types';
import { calculateDailyWorkRecord } from '../utils/calc';
import { googleSheetsClient, GoogleAuthService } from './googleSheetsClient';

/**
 * 帶有 HTTP 狀態碼的 API 錯誤，讓 UI 層可區分：
 * 401 授權過期 / 403 不在允許名單 / 500 · 503 Server 設定問題
 */
export class ApiRequestError extends Error {
  public status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

export class GoogleSheetsDataService implements IDataService {
  providerName = 'google_sheets';

  private getAuthHeaders(): Record<string, string> {
    const token = googleSheetsClient.getAccessToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private async fetchWithRetry(url: string, init?: RequestInit, retryCount = 0): Promise<Response> {
    const headers = this.getAuthHeaders();
    const res = await fetch(url, {
      ...init,
      headers: {
        ...headers,
        ...(init?.headers || {}),
      },
    });

    if (res.status === 401) {
      console.warn('[OAuth Debug] TOKEN_EXPIRED_OR_INVALID (HTTP 401)');
      GoogleAuthService.handle401Error();
      throw new ApiRequestError('Google 授權已失效，請點選「重新連線與整理」重新授權。', 401);
    }

    return res;
  }

  async initialize(): Promise<boolean> {
    if (!googleSheetsClient.isConnected()) {
      return false;
    }
    try {
      const res = await this.fetchWithRetry('/api/stores/S001');
      if (googleSheetsClient.isConnected()) {
        this.syncEmployees().catch((e) => console.warn('Background employee sync error:', e));
      }
      return res.ok;
    } catch (err) {
      console.warn('Google Sheets initialization error:', err);
      return false;
    }
  }

  /**
   * 連線時整備正式試算表：補檔名 + 補齊 stores / employees / work_records 分頁與表頭
   */
  async bootstrapSpreadsheet(): Promise<{ spreadsheet_title?: string; created_sheets?: string[] }> {
    const res = await this.fetchWithRetry('/api/sheet/bootstrap', { method: 'POST' });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new ApiRequestError(
        errJson.message || errJson.error || `Google Sheet 整備失敗 (HTTP ${res.status})`,
        res.status
      );
    }
    return await res.json().catch(() => ({}));
  }

  async syncEmployees(): Promise<boolean> {
    if (!googleSheetsClient.isConnected()) return false;
    try {
      const res = await this.fetchWithRetry('/api/employees/sync', {
        method: 'POST',
      });
      return res.ok;
    } catch (err) {
      console.warn('syncEmployees error:', err);
      return false;
    }
  }

  async getStore(storeId: string = 'S001'): Promise<{ store_id: string; store_name: string; owner_name: string; status: string }> {
    if (!googleSheetsClient.isConnected()) {
      return { store_id: 'S001', store_name: 'Alpha 門市', owner_name: '店長', status: 'active' };
    }
    try {
      const res = await this.fetchWithRetry(`/api/stores/${encodeURIComponent(storeId)}`);
      if (res.ok) {
        const json = await res.json();
        // Server 回傳裸物件；同時相容 { store: {...} } 包裝格式
        const store = json?.store || json;
        if (store && store.store_id) return store;
      }
    } catch (err) {
      console.warn('Failed to fetch store from server API:', err);
    }
    return { store_id: 'S001', store_name: 'Alpha 門市', owner_name: '店長', status: 'active' };
  }

  // === 1. Employees Table Operations (`employees`) ===
  async getEmployees(): Promise<Employee[]> {
    if (!googleSheetsClient.isConnected()) {
      return [];
    }
    const res = await this.fetchWithRetry('/api/employees?store_id=S001');
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      if (res.status === 401) {
        throw new ApiRequestError('Google 授權已失效，請點選「重新連線與整理」重新授權。', 401);
      }
      throw new ApiRequestError(
        errJson.message || errJson.error || '無法連接 Google Sheet，請確認 Google 授權與網路連線。',
        res.status
      );
    }
    const json = await res.json();
    // Server 回傳裸陣列；同時相容 { employees: [...] } 包裝格式
    const rawList: any[] = Array.isArray(json) ? json : json?.employees || [];

    const colors = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#ec4899', '#0891b2'];

    return rawList.map((r, idx) => {
      const empId = r.employee_id || `E${String(idx + 1).padStart(3, '0')}`;
      const name = r.name || '未命名員工';
      const status = r.status === 'inactive' ? 'inactive' : 'active';

      return {
        id: empId,
        employee_id: empId,
        employeeNo: empId,
        name,
        shortName: name.length > 2 ? name.slice(-2) : name,
        role: r.role || '兼職工讀',
        hourlyRate: Number(r.hourly_rate) || 195,
        color: colors[idx % colors.length],
        status,
        isActive: status === 'active',
        hire_date: r.hire_date || '',
        note: r.note || '',
        createdAt: r.created_at || new Date().toISOString(),
        created_at: r.created_at || new Date().toISOString(),
      };
    });
  }

  async addEmployee(employeeData: Partial<Employee> & { name: string }): Promise<Employee> {
    const res = await this.fetchWithRetry('/api/employees', {
      method: 'POST',
      body: JSON.stringify({
        name: employeeData.name,
        role: employeeData.role,
        hourly_rate: employeeData.hourlyRate,
        hire_date: employeeData.hire_date,
        note: employeeData.note,
        store_id: 'S001',
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      if (res.status === 401) {
        throw new Error('Google 授權已失效，請重新連線 Google Sheet。');
      }
      throw new Error(errJson.error || '員工新增失敗，資料尚未寫入 Google Sheet。');
    }

    const json = await res.json();
    // Server 回傳裸物件；同時相容 { success, employee } 包裝格式
    const r = json?.employee || json;
    if (!r || !r.employee_id) {
      throw new Error('員工新增失敗，資料尚未寫入 Google Sheet。');
    }

    const empId = r.employee_id;

    return {
      role: r.role || employeeData.role || '兼職工讀',
      hourlyRate: Number(r.hourly_rate) || employeeData.hourlyRate || 195,
      color: '#2563eb',
      phone: '',
      note: r.note || '',
      ...employeeData,
      id: empId,
      employee_id: empId,
      employeeNo: empId,
      name: r.name,
      shortName: r.name.length > 2 ? r.name.slice(-2) : r.name,
      status: (r.status || 'active') as 'active' | 'inactive',
      isActive: r.status === 'active',
      hire_date: r.hire_date || '',
      createdAt: r.created_at || new Date().toISOString(),
      created_at: r.created_at || new Date().toISOString(),
    };
  }

  async updateEmployee(employee_id: string, updates: Partial<Employee>): Promise<Employee> {
    const res = await this.fetchWithRetry(`/api/employees/${employee_id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: updates.name,
        role: updates.role,
        hourly_rate: updates.hourlyRate,
        status: updates.status,
        hire_date: updates.hire_date,
        note: updates.note,
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      if (res.status === 401) {
        throw new Error('Google 授權已失效，請重新連線 Google Sheet。');
      }
      throw new Error(errJson.error || 'Google Sheet 更新失敗，請稍後再試。');
    }

    const json = await res.json();
    // Server 回傳裸物件；同時相容 { employee: {...} } 包裝格式
    const r = json?.employee || json;
    if (!r || !r.employee_id) {
      throw new Error('Google Sheet 更新失敗，回應缺少員工資料。');
    }

    return {
      ...updates,
      id: r.employee_id,
      employee_id: r.employee_id,
      employeeNo: r.employee_id,
      name: r.name,
      shortName: r.name.length > 2 ? r.name.slice(-2) : r.name,
      role: updates.role || '兼職工讀',
      hourlyRate: updates.hourlyRate || 195,
      color: updates.color || '#2563eb',
      status: (r.status || 'active') as 'active' | 'inactive',
      isActive: r.status === 'active',
      hire_date: r.hire_date || '',
      note: r.note || '',
      createdAt: r.created_at || new Date().toISOString(),
      created_at: r.created_at || new Date().toISOString(),
    };
  }

  async deleteEmployee(employee_id: string): Promise<boolean> {
    try {
      const res = await this.fetchWithRetry(`/api/employees/${employee_id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        if (res.status === 401) {
          throw new Error('Google 授權已失效，請重新連線 Google Sheet。');
        }
        throw new Error(errJson.error || 'Google Sheet 刪除失敗');
      }
      return true;
    } catch (err: any) {
      console.warn('Delete employee Google Sheets error:', err);
      throw err;
    }
  }

  // === 2. Work Records Table Operations (`work_records`) ===
  async getWorkRecords(employeeId?: string, yearMonth?: string): Promise<DailyWorkRecord[]> {
    try {
      const res = await this.fetchWithRetry('/api/work-records');
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new ApiRequestError(
          errJson.message || errJson.error || `無法讀取 work_records (HTTP ${res.status})`,
          res.status
        );
      }
      const data = await res.json();
      // Server 回傳裸陣列；同時相容 { records: [...] } 包裝格式
      let records: DailyWorkRecord[] = Array.isArray(data) ? data : data?.records || [];
      if (employeeId) {
        records = records.filter((r) => r.employee_id === employeeId);
      }
      if (yearMonth) {
        records = records.filter((r) => r.work_date && r.work_date.startsWith(yearMonth));
      }
      return records;
    } catch (err: any) {
      console.warn('Google Sheets getWorkRecords error:', err?.message || err);
      throw err;
    }
  }

  async saveWorkRecords(recordsToSave: DailyWorkRecord[]): Promise<void> {
    try {
      for (const rec of recordsToSave) {
        const res = await this.fetchWithRetry('/api/work-records', {
          method: 'POST',
          body: JSON.stringify(rec),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          const errMsg = errJson.message || errJson.error || `工時補登失敗 (HTTP ${res.status})`;
          console.error('Save work_records failed:', errMsg);
          throw new ApiRequestError(errMsg, res.status);
        }
      }
    } catch (err: any) {
      console.error('Google Sheets saveWorkRecords error:', err?.message || err);
      throw err;
    }
  }

  // === 3. Recognition Records Table Operations (`recognition_records`) ===
  async getRecognitionRecords(): Promise<TimecardRecord[]> {
    return [];
  }

  async createRecognitionRecord(record: TimecardRecord): Promise<TimecardRecord> {
    return record;
  }

  async updateRecognitionStatus(
    recognition_id: string,
    status: 'pending' | 'verified' | 'rejected'
  ): Promise<void> {}
}
