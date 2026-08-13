import { IDataService } from './dataService';
import { LocalDataService } from './localDataService';
import { GoogleSheetsDataService } from './googleSheetsDataService';
import { googleSheetsClient } from './googleSheetsClient';
import { defaultEmployees, defaultTimecards } from '../data/initialData';
import { generateInitialDailyWorkRecords } from '../data/initialDailyRecords';

export class DataServiceManager implements IDataService {
  private localService: LocalDataService;
  private sheetsService: GoogleSheetsDataService;
  private activeProvider: 'google_sheets' | 'local' = 'local';

  constructor() {
    this.localService = new LocalDataService();
    this.sheetsService = new GoogleSheetsDataService();
  }

  public get providerName(): string {
    return this.activeProvider;
  }

  public getActiveService(): IDataService {
    return this.activeProvider === 'google_sheets' ? this.sheetsService : this.localService;
  }

  public setProvider(provider: 'google_sheets' | 'local') {
    this.activeProvider = provider;
  }

  async initialize(): Promise<boolean> {
    await this.localService.initialize();
    return true;
  }

  async getStore(storeId: string = 'S001') {
    return { store_id: 'S001', store_name: '參陸河粉', owner_name: '店長', status: 'active' };
  }

  /**
   * Seed Google Sheet with initial app data if newly connected & empty.
   */
  async seedInitialDataToSheet(): Promise<void> {
    if (!googleSheetsClient.isConnected()) return;

    try {
      const existingEmps = await this.sheetsService.getEmployees();
      if (existingEmps.length === 0) {
        for (const emp of defaultEmployees) {
          await this.sheetsService.addEmployee({
            employee_id: emp.employee_id || emp.employeeNo,
            name: emp.name,
            status: emp.status || 'active',
            hire_date: emp.hire_date || '2025-01-15',
            note: emp.note || '',
          });
        }
      }

      const existingRecords = await this.sheetsService.getWorkRecords();
      if (existingRecords.length === 0) {
        const initialDaily = generateInitialDailyWorkRecords();
        await this.sheetsService.saveWorkRecords(initialDaily);
      }

      const existingRecogs = await this.sheetsService.getRecognitionRecords();
      if (existingRecogs.length === 0) {
        for (const tc of defaultTimecards) {
          await this.sheetsService.createRecognitionRecord(tc);
        }
      }
    } catch (err) {
      console.error('Failed to seed initial data to Google Sheet:', err);
    }
  }

  // Delegate all IDataService interface calls to active service

  async getEmployees() {
    try {
      return await this.getActiveService().getEmployees();
    } catch (err) {
      console.warn('Google Sheets read error, fallback to local:', err);
      return await this.localService.getEmployees();
    }
  }

  async addEmployee(employee: Partial<import('../types').Employee> & { name: string }) {
    // Write to active service
    const created = await this.getActiveService().addEmployee(employee);
    // Also sync created employee (with assigned employee_id) to local cache
    try {
      await this.localService.addEmployee(created);
    } catch (err) {
      console.warn('Syncing added employee to local cache failed:', err);
    }
    return created;
  }

  async updateEmployee(employee_id: string, updates: Partial<import('../types').Employee>) {
    const updated = await this.getActiveService().updateEmployee(employee_id, updates);
    try {
      await this.localService.updateEmployee(employee_id, updates);
    } catch (err) {
      console.warn('Syncing updated employee to local cache failed:', err);
    }
    return updated;
  }

  async deleteEmployee(employee_id: string): Promise<boolean> {
    try {
      await this.getActiveService().deleteEmployee?.(employee_id);
    } catch (err) {
      console.warn('Failed to delete employee from active service:', err);
    }
    try {
      await this.localService.deleteEmployee(employee_id);
    } catch (err) {
      console.warn('Syncing deleted employee to local cache failed:', err);
    }
    return true;
  }

  async getWorkRecords(employeeId?: string, yearMonth?: string) {
    try {
      return await this.getActiveService().getWorkRecords(employeeId, yearMonth);
    } catch (err) {
      console.warn('Google Sheets work records read error, fallback to local:', err);
      return await this.localService.getWorkRecords(employeeId, yearMonth);
    }
  }

  async saveWorkRecords(records: import('../types').DailyWorkRecord[]) {
    await this.getActiveService().saveWorkRecords(records);
    await this.localService.saveWorkRecords(records);
  }

  async getRecognitionRecords() {
    try {
      return await this.getActiveService().getRecognitionRecords();
    } catch (err) {
      console.warn('Google Sheets recognition records read error, fallback to local:', err);
      return await this.localService.getRecognitionRecords();
    }
  }

  async createRecognitionRecord(record: import('../types').TimecardRecord) {
    const created = await this.getActiveService().createRecognitionRecord(record);
    await this.localService.createRecognitionRecord(record);
    return created;
  }

  async updateRecognitionStatus(
    recognition_id: string,
    status: 'pending' | 'verified' | 'rejected'
  ) {
    await this.getActiveService().updateRecognitionStatus(recognition_id, status);
    await this.localService.updateRecognitionStatus(recognition_id, status);
  }
}

export const dataServiceManager = new DataServiceManager();
