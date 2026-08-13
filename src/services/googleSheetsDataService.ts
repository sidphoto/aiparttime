import { IDataService } from './dataService';
import { Employee, DailyWorkRecord, TimecardRecord } from '../types';
import { calculateDailyWorkRecord } from '../utils/calc';
import { googleSheetsClient, GoogleAuthService } from './googleSheetsClient';

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
      throw new Error('Google 授權已失效，請點選「連線 Google Sheet」重新授權。');
    }

    return res;
  }

  async initialize(): Promise<boolean> {
    if (!googleSheetsClient.isConnected()) {
      return false;
    }
    try {
      const res = await this.fetchWithRetry('/api/stores?store_id=S001');
      if (googleSheetsClient.isConnected()) {
        this.syncEmployees().catch((e) => console.warn('Background employee sync error:', e));
      }
      return res.ok;
    } catch (err) {
      console.warn('Google Sheets initialization error:', err);
      return false;
    }
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
      const res = await this.fetchWithRetry(`/api/stores?store_id=${storeId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.store) return json.store;
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
        throw new Error('Google 授權已失效，請點選「連線 Google Sheet」重新授權。');
      }
      throw new Error(errJson.error || '無法連接 Google Sheet，請確認 Google 授權與網路連線。');
    }
    const json = await res.json();
    const rawList: any[] = json.employees || [];

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
    if (!json.success || !json.employee) {
      throw new Error('員工新增失敗，資料尚未寫入 Google Sheet。');
    }

    const r = json.employee;
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
    const r = json.employee;

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
    return [];
  }

  async saveWorkRecords(recordsToSave: DailyWorkRecord[]): Promise<void> {}

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
