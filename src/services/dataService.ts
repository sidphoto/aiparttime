import { Employee, DailyWorkRecord, TimecardRecord } from '../types';

/**
 * Standardized Data Service Interface
 * Abstracts storage operations so UI & core business logic remain completely decoupled
 * from the underlying database (Google Sheets, Firestore, Supabase, etc.).
 *
 * All records are identified purely by business IDs (employee_id, record_id, recognition_id),
 * never by array/sheet row indexes.
 */
export interface IDataService {
  /** Source identifier (e.g., 'google_sheets' | 'local') */
  providerName: string;

  /** Initialize connection / sync schemas */
  initialize(): Promise<boolean>;

  // === 1. Employees Table Operations (`employees`) ===
  getEmployees(): Promise<Employee[]>;
  addEmployee(employee: Partial<Employee> & { name: string }): Promise<Employee>;
  updateEmployee(employee_id: string, updates: Partial<Employee>): Promise<Employee>;
  deleteEmployee?(employee_id: string): Promise<boolean>;

  // === 2. Work Records Table Operations (`work_records`) ===
  getWorkRecords(employeeId?: string, yearMonth?: string): Promise<DailyWorkRecord[]>;
  saveWorkRecords(records: DailyWorkRecord[]): Promise<void>;

  // === 3. Recognition Records Table Operations (`recognition_records`) ===
  getRecognitionRecords(): Promise<TimecardRecord[]>;
  createRecognitionRecord(record: TimecardRecord): Promise<TimecardRecord>;
  updateRecognitionStatus(recognition_id: string, status: 'pending' | 'verified' | 'rejected'): Promise<void>;
}

// Data Service Provider Type
export type DataProviderType = 'google_sheets' | 'local';
