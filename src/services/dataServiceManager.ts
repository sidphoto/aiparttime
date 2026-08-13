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
    if (this.activeProvider === 'google_sheets') {
      try {
        return await this.sheetsService.getStore(storeId);
      } catch (err) {
        console.warn('Google Sheets store read error:', err);
      }
    }
    return { store_id: 'S001', store_name: '參陸河粉', owner_name: '店長', status: 'active' };
  }

  /**
   * Helper to verify Google Sheets connection & fetch employees directly
   */
  async getEmployeesFromSheetOnly() {
    return await this.sheetsService.getEmployees();
  }

  // Delegate all IDataService interface calls to active service

  async getEmployees() {
    if (this.activeProvider === 'google_sheets') {
      // Must read from Google Sheet as Source of Truth, no local fallback!
      return await this.sheetsService.getEmployees();
    }
    // Disconnected state: Return empty array so local storage is NOT used as authoritative formal employees
    return [];
  }

  async addEmployee(employee: Partial<import('../types').Employee> & { name: string }) {
    if (this.activeProvider !== 'google_sheets') {
      throw new Error('請先連接 Google Sheet，再進行資料操作。');
    }
    // Must write to Google Sheet. On failure, throw exception directly (No local fallback/persistence)
    return await this.sheetsService.addEmployee(employee);
  }

  async updateEmployee(employee_id: string, updates: Partial<import('../types').Employee>) {
    if (this.activeProvider !== 'google_sheets') {
      throw new Error('請先連接 Google Sheet，再進行資料操作。');
    }
    return await this.sheetsService.updateEmployee(employee_id, updates);
  }

  async deleteEmployee(employee_id: string): Promise<boolean> {
    if (this.activeProvider !== 'google_sheets') {
      throw new Error('請先連接 Google Sheet，再進行資料操作。');
    }
    return await this.sheetsService.deleteEmployee(employee_id);
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
