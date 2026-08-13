import { IDataService } from './dataService';
import { Employee, DailyWorkRecord, TimecardRecord } from '../types';
import { defaultEmployees, defaultTimecards } from '../data/initialData';
import { generateInitialDailyWorkRecords } from '../data/initialDailyRecords';

const STORAGE_KEYS = {
  EMPLOYEES: 'app_employees_v2',
  WORK_RECORDS: 'app_work_records_v2',
  RECOGNITION_RECORDS: 'app_recognition_records_v2',
};

export class LocalDataService implements IDataService {
  providerName = 'local';

  async initialize(): Promise<boolean> {
    if (!localStorage.getItem(STORAGE_KEYS.EMPLOYEES)) {
      localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(defaultEmployees));
    }

    const rawRecs = localStorage.getItem(STORAGE_KEYS.RECOGNITION_RECORDS);
    if (!rawRecs) {
      localStorage.setItem(STORAGE_KEYS.RECOGNITION_RECORDS, JSON.stringify(defaultTimecards));
    } else {
      try {
        const parsed: TimecardRecord[] = JSON.parse(rawRecs);
        const cleaned = parsed.map((r) =>
          r.status === 'pending' ? { ...r, status: 'verified' as const, verifiedAt: new Date().toLocaleString() } : r
        );
        localStorage.setItem(STORAGE_KEYS.RECOGNITION_RECORDS, JSON.stringify(cleaned));
      } catch {
        localStorage.setItem(STORAGE_KEYS.RECOGNITION_RECORDS, JSON.stringify(defaultTimecards));
      }
    }

    const rawWork = localStorage.getItem(STORAGE_KEYS.WORK_RECORDS);
    if (!rawWork) {
      localStorage.setItem(
        STORAGE_KEYS.WORK_RECORDS,
        JSON.stringify(generateInitialDailyWorkRecords())
      );
    } else {
      try {
        const parsed = JSON.parse(rawWork);
        const cleaned = parsed.map((r: any) =>
          r.verification_status === 'pending' ? { ...r, verification_status: 'verified' } : r
        );
        localStorage.setItem(STORAGE_KEYS.WORK_RECORDS, JSON.stringify(cleaned));
      } catch {
        localStorage.setItem(
          STORAGE_KEYS.WORK_RECORDS,
          JSON.stringify(generateInitialDailyWorkRecords())
        );
      }
    }
    return true;
  }

  // === 1. Employees Table Operations ===
  async getEmployees(): Promise<Employee[]> {
    const raw = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
    if (!raw) return defaultEmployees;
    try {
      return JSON.parse(raw);
    } catch {
      return defaultEmployees;
    }
  }

  async addEmployee(employeeData: Partial<Employee> & { name: string }): Promise<Employee> {
    const employees = await this.getEmployees();
    const count = employees.length + 1;
    const empId = employeeData.employee_id || employeeData.employeeNo || employeeData.id || `E${String(count).padStart(3, '0')}`;
    const nowIso = new Date().toISOString().split('T')[0];

    const newEmp: Employee = {
      role: '兼職工讀',
      hourlyRate: 195,
      color: '#2563eb',
      phone: '',
      note: '',
      ...employeeData,
      id: employeeData.id || empId,
      employee_id: empId,
      employeeNo: empId,
      name: employeeData.name,
      shortName: employeeData.shortName || (employeeData.name.length > 2 ? employeeData.name.slice(-2) : employeeData.name),
      status: employeeData.status || 'active',
      isActive: (employeeData.status || 'active') === 'active',
      createdAt: employeeData.createdAt || nowIso,
      created_at: employeeData.created_at || nowIso,
    };

    const filtered = employees.filter(
      (e) => e.id !== newEmp.id && e.employee_id !== empId && e.employeeNo !== empId
    );
    const updatedList = [newEmp, ...filtered];
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(updatedList));
    return newEmp;
  }

  async updateEmployee(employee_id: string, updates: Partial<Employee>): Promise<Employee> {
    const employees = await this.getEmployees();
    let updatedEmp: Employee | null = null;

    const newList = employees.map((emp) => {
      if (emp.employee_id === employee_id || emp.id === employee_id || emp.employeeNo === employee_id) {
        updatedEmp = { ...emp, ...updates };
        return updatedEmp;
      }
      return emp;
    });

    if (!updatedEmp) {
      updatedEmp = {
        id: employee_id,
        employee_id: employee_id,
        employeeNo: employee_id,
        name: updates.name || '未命名員工',
        shortName: updates.name ? (updates.name.length > 2 ? updates.name.slice(-2) : updates.name) : '未命名',
        role: updates.role || '兼職工讀',
        hourlyRate: updates.hourlyRate || 195,
        color: updates.color || '#2563eb',
        status: (updates.status || 'active') as 'active' | 'inactive',
        isActive: (updates.status || 'active') === 'active',
        hire_date: updates.hire_date || '',
        note: updates.note || '',
        createdAt: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      newList.push(updatedEmp);
    }

    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(newList));
    return updatedEmp;
  }

  async deleteEmployee(employee_id: string): Promise<boolean> {
    const employees = await this.getEmployees();
    const newList = employees.filter(
      (e) => e.id !== employee_id && e.employee_id !== employee_id && e.employeeNo !== employee_id
    );
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(newList));
    return true;
  }

  // === 2. Work Records Table Operations ===
  async getWorkRecords(employeeId?: string, yearMonth?: string): Promise<DailyWorkRecord[]> {
    const raw = localStorage.getItem(STORAGE_KEYS.WORK_RECORDS);
    let list: DailyWorkRecord[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch {
        list = generateInitialDailyWorkRecords();
      }
    } else {
      list = generateInitialDailyWorkRecords();
    }

    if (employeeId) {
      list = list.filter((r) => r.employee_id === employeeId);
    }
    if (yearMonth) {
      list = list.filter((r) => r.work_date && r.work_date.startsWith(yearMonth));
    }

    return list;
  }

  async saveWorkRecords(recordsToSave: DailyWorkRecord[]): Promise<void> {
    const existing = await this.getWorkRecords();
    const existingMap = new Map<string, DailyWorkRecord>();

    existing.forEach((r) => {
      // Key by record_id or fallback employee_id + work_date
      const key = r.record_id || `${r.employee_id}_${r.work_date}`;
      existingMap.set(key, r);
    });

    recordsToSave.forEach((r) => {
      const key = r.record_id || `${r.employee_id}_${r.work_date}`;
      existingMap.set(key, r);
    });

    const newList = Array.from(existingMap.values());
    localStorage.setItem(STORAGE_KEYS.WORK_RECORDS, JSON.stringify(newList));
  }

  // === 3. Recognition Records Table Operations ===
  async getRecognitionRecords(): Promise<TimecardRecord[]> {
    const raw = localStorage.getItem(STORAGE_KEYS.RECOGNITION_RECORDS);
    if (!raw) return defaultTimecards;
    try {
      return JSON.parse(raw);
    } catch {
      return defaultTimecards;
    }
  }

  async createRecognitionRecord(record: TimecardRecord): Promise<TimecardRecord> {
    const existing = await this.getRecognitionRecords();
    const newList = [record, ...existing];
    localStorage.setItem(STORAGE_KEYS.RECOGNITION_RECORDS, JSON.stringify(newList));
    return record;
  }

  async updateRecognitionStatus(
    recognition_id: string,
    status: 'pending' | 'verified' | 'rejected'
  ): Promise<void> {
    const existing = await this.getRecognitionRecords();
    const newList = existing.map((r) => {
      if (r.id === recognition_id) {
        return {
          ...r,
          status,
          verifiedAt: status === 'verified' ? new Date().toLocaleString() : r.verifiedAt,
        };
      }
      return r;
    });
    localStorage.setItem(STORAGE_KEYS.RECOGNITION_RECORDS, JSON.stringify(newList));
  }
}
