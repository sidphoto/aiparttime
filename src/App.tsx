/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Employee,
  ShiftLog,
  ShiftPreset,
  StoreSettings,
  TimecardRecord,
  DailyWorkRecord,
  SheetConnectionState,
} from './types';
import { defaultSettings, defaultEmployees, defaultPresets, generateSampleShifts, defaultTimecards } from './data/initialData';
import { initialDailyWorkRecords } from './data/initialDailyRecords';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeView } from './components/HomeView';
import { VerifyView } from './components/VerifyView';
import { EmployeeView } from './components/EmployeeView';
import { ReportView } from './components/ReportView';
import { CaptureCardModal } from './components/CaptureCardModal';
import { ShiftModal } from './components/ShiftModal';
import { BatchShiftModal } from './components/BatchShiftModal';
import { LineReportModal } from './components/LineReportModal';
import { AddEmployeeModal } from './components/AddEmployeeModal';
import { GoogleSheetSyncBar } from './components/GoogleSheetSyncBar';
import { GoogleLoginModal } from './components/GoogleLoginModal';
import { GoogleUser, GoogleAuthManager } from './services/googleAuth';
import { GoogleAuthService } from './services/googleSheetsClient';
import { dataServiceManager } from './services/dataServiceManager';
import { DailyDetailModal } from './components/DailyDetailModal';
import { generateStoreSummary, getPayCyclePeriod, calculateDailyWorkRecord } from './utils/calc';

export default function App() {
  // LocalStorage state initialization
  const [settings, setSettings] = useState<StoreSettings>(() => {
    const saved = localStorage.getItem('store_settings');
    if (!saved) return { ...defaultSettings, defaultHourlyRate: 195 };
    try {
      const parsed = JSON.parse(saved);
      return {
        ...parsed,
        defaultHourlyRate: 195,
        storeName: parsed.storeName || '參陸河粉',
      };
    } catch {
      return { ...defaultSettings, defaultHourlyRate: 195 };
    }
  });

  const [employees, setEmployees] = useState<Employee[]>(() => {
    // Purge legacy local storage employees to prevent stale local data as formal employees
    try {
      localStorage.removeItem('store_employees');
    } catch {
      // ignore
    }
    return [];
  });

  // Auto-purge legacy mock data on update once
  useEffect(() => {
    if (!localStorage.getItem('store_data_v3_purged')) {
      localStorage.removeItem('store_shifts');
      localStorage.removeItem('store_timecards');
      localStorage.removeItem('store_daily_records');
      localStorage.removeItem('store_work_records');
      localStorage.removeItem('store_recognition_records');
      localStorage.removeItem('store_employees');
      localStorage.setItem('store_data_v3_purged', 'true');
      setShifts([]);
      setTimecards([]);
      setDailyRecords([]);
    }
  }, []);

  const [shifts, setShifts] = useState<ShiftLog[]>(() => {
    const saved = localStorage.getItem('store_shifts');
    return saved ? JSON.parse(saved) : [];
  });

  const [timecards, setTimecards] = useState<TimecardRecord[]>(() => {
    const saved = localStorage.getItem('store_timecards');
    return saved ? JSON.parse(saved) : [];
  });

  const [dailyRecords, setDailyRecords] = useState<DailyWorkRecord[]>(() => {
    try {
      localStorage.removeItem('store_daily_records');
    } catch {
      // ignore
    }
    return [];
  });

  const [presets, setPresets] = useState<ShiftPreset[]>(() => {
    const saved = localStorage.getItem('store_presets');
    return saved ? JSON.parse(saved) : defaultPresets;
  });

  // Google User State
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(() => GoogleAuthManager.getUser());
  const [isGoogleLoginOpen, setIsGoogleLoginOpen] = useState(false);

  // Google Sheet 連線狀態（AUTH UX FIX Phase 1）
  const [sheetConnection, setSheetConnection] = useState<SheetConnectionState>('disconnected');
  const [sheetStatusMessage, setSheetStatusMessage] = useState<string | null>(null);

  // Navigation Tab State: 'home' | 'employees' | 'verify' | 'reports'
  const [activeTab, setActiveTab] = useState<'home' | 'employees' | 'verify' | 'reports'>('home');

  // Modals
  const [isCaptureModalOpen, setIsCaptureModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isLineModalOpen, setIsLineModalOpen] = useState(false);
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftLog | null>(null);
  const [defaultShiftDate, setDefaultShiftDate] = useState<string | undefined>(undefined);
  // Header 快速補登：草稿存 state，避免每次 render 產生新物件導致 Modal 內狀態被重置
  const [quickRecordDraft, setQuickRecordDraft] = useState<DailyWorkRecord | null>(null);

  // 中斷連線：Provider 回到 local，並清空正式資料（不得以 localStorage 作為正式資料庫）
  const resetSheetData = useCallback(() => {
    dataServiceManager.setProvider('local');
    setEmployees([]);
    setDailyRecords([]);
  }, []);

  // Async Data Service Initialization & Data Fetching (TASK 2 & TASK 4)
  const loadDataFromService = useCallback(async () => {
    const token = GoogleAuthService.getAccessToken();
    // Profile 直接讀 localStorage，避免 logout 時 React state 尚未更新造成狀態誤判
    const profile = GoogleAuthManager.getUser();

    if (!token) {
      // AUTH UX FIX Phase 1：Memory Token 不存在時「不自動彈出 OAuth」，只切換 UI 狀態
      resetSheetData();
      if (profile) {
        setSheetConnection('needs_reauth');
        setSheetStatusMessage('頁面重新整理後 Google 授權已失效（Token 僅存於記憶體），請點「重新連線與整理」重新授權。');
      } else {
        setSheetConnection('disconnected');
        setSheetStatusMessage(null);
      }
      return;
    }

    setSheetConnection('connecting');
    setSheetStatusMessage(null);

    try {
      await dataServiceManager.initialize();

      // Test Google Sheets API access via GET /api/employees (Server Authorization & Access PASS)
      const emps = await dataServiceManager.getEmployeesFromSheetOnly();

      // Switch Provider ONLY after Google Sheet access is verified!
      dataServiceManager.setProvider('google_sheets');

      const uniqueMap = new Map<string, Employee>();
      (emps || []).forEach((e) => {
        const key = e.id || e.employee_id || e.employeeNo;
        if (key) uniqueMap.set(key, e);
      });
      setEmployees(Array.from(uniqueMap.values()));

      // Fetch Store Info (S001 -> 參陸河粉)
      const storeInfo = await dataServiceManager.getStore('S001');
      if (storeInfo && storeInfo.store_name) {
        setSettings((prev) => ({ ...prev, storeName: storeInfo.store_name }));
      }

      const workRecs = await dataServiceManager.getWorkRecords();
      setDailyRecords(workRecs || []);

      const recogs = await dataServiceManager.getRecognitionRecords();
      if (recogs && recogs.length > 0) setTimecards(recogs);

      setSheetConnection('connected');
      setSheetStatusMessage(null);
    } catch (err: any) {
      console.warn('Google Sheet connection or fetch failed, provider remains local:', err?.message || err);
      resetSheetData();

      const status = Number(err?.status) || 0;
      if (status === 401) {
        // Token 無效/過期 -> 清除 Memory Token -> 需要重新授權
        GoogleAuthService.clearAccessToken();
        setSheetConnection('needs_reauth');
        setSheetStatusMessage('Google 授權已過期，請點「重新連線與整理」重新授權。');
      } else if (status === 403) {
        setSheetConnection('forbidden');
        setSheetStatusMessage('此 Google 帳號不在 Friends Alpha 測試名單中，請聯絡管理員開通後再試。');
      } else if (status >= 500) {
        setSheetConnection('error');
        setSheetStatusMessage(`伺服器或 Google Sheet 設定異常 (HTTP ${status})，請稍後再試。`);
      } else {
        setSheetConnection('error');
        setSheetStatusMessage(err?.message || 'Google Sheet 連線失敗，請確認網路後再試。');
      }
    }
  }, [resetSheetData]);

  useEffect(() => {
    loadDataFromService();
  }, [loadDataFromService]);

  /**
   * 「重新連線與整理」唯一入口（AUTH UX FIX Phase 1）
   * Token 有 -> 直接重新載入；Token 無 -> 由使用者這個明確操作開啟 GoogleLoginModal 重新 OAuth
   */
  const handleReconnectAndSync = useCallback(async () => {
    if (GoogleAuthService.getAccessToken()) {
      await loadDataFromService();
      return;
    }
    setSheetStatusMessage(null);
    setIsGoogleLoginOpen(true);
  }, [loadDataFromService]);

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem('store_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('store_shifts', JSON.stringify(shifts));
  }, [shifts]);

  useEffect(() => {
    localStorage.setItem('store_timecards', JSON.stringify(timecards));
  }, [timecards]);



  useEffect(() => {
    localStorage.setItem('store_presets', JSON.stringify(presets));
  }, [presets]);

  // Current period summary
  const currentYearMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentYearMonth);
  const period = getPayCyclePeriod(selectedMonth, settings.payCycleStartDay);
  const storeSummary = useMemo(() => {
    return generateStoreSummary(employees, dailyRecords, period.startDate, period.endDate, period.label);
  }, [employees, dailyRecords, period]);

  // Pending timecards count
  const pendingCount = useMemo(() => {
    return timecards.filter((tc) => tc.status === 'pending').length;
  }, [timecards]);

  // Handlers
  const handleOpenAddShift = (defaultDate?: string) => {
    setEditingShift(null);
    setDefaultShiftDate(defaultDate);
    setIsShiftModalOpen(true);
  };

  const handleOpenEditShift = (shift: ShiftLog) => {
    setEditingShift(shift);
    setIsShiftModalOpen(true);
  };

  const handleSaveShift = (
    shiftData: Omit<ShiftLog, 'id' | 'createdAt'>,
    shiftId?: string
  ) => {
    if (shiftId) {
      setShifts((prev) =>
        prev.map((s) =>
          s.id === shiftId
            ? { ...shiftData, id: shiftId, createdAt: s.createdAt }
            : s
        )
      );
    } else {
      const newShift: ShiftLog = {
        ...shiftData,
        id: `shift-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        createdAt: new Date().toISOString(),
      };
      setShifts((prev) => [newShift, ...prev]);
    }
  };

  const handleDeleteShift = (shiftId: string) => {
    setShifts((prev) => prev.filter((s) => s.id !== shiftId));
  };

  // Timecard verification handler
  const handleVerifyTimecard = async (id: string, verifiedLogs?: TimecardRecord['recognizedLogs']) => {
    setTimecards((prev) =>
      prev.map((tc) => {
        if (tc.id === id) {
          return {
            ...tc,
            status: 'verified',
            recognizedLogs: verifiedLogs || tc.recognizedLogs,
          };
        }
        return tc;
      })
    );
    await dataServiceManager.updateRecognitionStatus(id, 'verified');
  };

  // Secondary verification approved daily records handler -> Write to work_records
  const handleSaveApprovedDailyRecords = async (recordsToSave: DailyWorkRecord[], timecardId: string) => {
    setDailyRecords((prev) => {
      const recordMap = new Map<string, DailyWorkRecord>();
      prev.forEach((r) => recordMap.set(`${r.employee_id}_${r.work_date}`, r));
      recordsToSave.forEach((r) => recordMap.set(`${r.employee_id}_${r.work_date}`, r));
      return Array.from(recordMap.values());
    });

    setTimecards((prev) =>
      prev.map((tc) =>
        tc.id === timecardId ? { ...tc, status: 'verified', verifiedAt: new Date().toISOString() } : tc
      )
    );

    // Save to Data Service Layer (work_records table)
    await dataServiceManager.saveWorkRecords(recordsToSave);
    await dataServiceManager.updateRecognitionStatus(timecardId, 'verified');
  };

  // Add new timecard record from capture simulation -> Write to recognition_records
  const handleSaveTimecard = async (newRecord: TimecardRecord) => {
    setTimecards((prev) => [newRecord, ...prev]);
    setActiveTab('verify');
    await dataServiceManager.createRecognitionRecord(newRecord);
  };

  // Employee handlers -> Write to employees table
  const handleAddEmployee = async (empData: Omit<Employee, 'id' | 'createdAt'>) => {
    const created = await dataServiceManager.addEmployee({
      ...empData,
      status: empData.status || 'active',
      hire_date: empData.hire_date || new Date().toISOString().split('T')[0],
      note: empData.note || '',
    });
    setEmployees((prev) => {
      const targetId = created.id || created.employee_id || created.employeeNo;
      const filtered = prev.filter(
        (e) => e.id !== targetId && e.employee_id !== targetId && e.employeeNo !== targetId
      );
      return [...filtered, created];
    });
  };

  const handleUpdateEmployee = async (updatedEmp: Employee) => {
    const targetId = updatedEmp.employee_id || updatedEmp.employeeNo || updatedEmp.id;
    const updated = await dataServiceManager.updateEmployee(targetId, updatedEmp);
    setEmployees((prev) =>
      prev.map((e) =>
        e.id === updatedEmp.id || e.employee_id === targetId || e.employeeNo === targetId
          ? { ...e, ...updatedEmp, ...updated }
          : e
      )
    );
  };

  const handleDeleteEmployee = async (empId: string) => {
    setEmployees((prev) =>
      prev.filter(
        (e) => e.id !== empId && e.employee_id !== empId && e.employeeNo !== empId
      )
    );
    await dataServiceManager.deleteEmployee(empId);
  };

  const handleUpdateDailyRecord = async (updatedRecord: DailyWorkRecord) => {
    if (dataServiceManager.providerName !== 'google_sheets') {
      throw new Error('請先連接 Google Sheet，再進行工時補登操作。');
    }
    // Must save to Google Sheet first! Throws error if failed
    await dataServiceManager.saveWorkRecords([updatedRecord]);
    setDailyRecords((prev) => {
      const exists = prev.some((r) => r.record_id === updatedRecord.record_id);
      if (exists) {
        return prev.map((r) => (r.record_id === updatedRecord.record_id ? updatedRecord : r));
      }
      return [updatedRecord, ...prev];
    });
  };

  // Handle Google SSO Login Success (TASK 1)
  const handleGoogleLoginSuccess = async (user: GoogleUser) => {
    // 1. OAuth Access Token Validation (TASK 6)
    if (!user || !user.accessToken) {
      console.warn('[Google Login] OAUTH_ACCESS_TOKEN_MISSING');
      setGoogleUser(user || null);
      setIsGoogleLoginOpen(false);
      resetSheetData();
      setSheetConnection(user ? 'needs_reauth' : 'disconnected');
      setSheetStatusMessage(
        user ? 'Google 登入未取得 Sheets 授權，請再點一次「重新連線與整理」。' : null
      );
      return;
    }

    // 2. Set Access Token into Memory-only Global Service (TASK 1 & TASK 2)
    GoogleAuthService.setAccessToken(user.accessToken);

    // 3. Update React User State
    setGoogleUser(user);

    // 4. Close Login Modal
    setIsGoogleLoginOpen(false);

    // 5. Trigger Server Sheet Verification & Data Loading (TASK 1 & TASK 3 & TASK 4)
    await loadDataFromService();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-600 selection:text-white flex flex-col">
      {/* Top Header */}
      <Header
        settings={settings}
        activeTab={activeTab}
        googleUser={googleUser}
        onOpenGoogleLogin={() => setIsGoogleLoginOpen(true)}
        onGoogleLogout={() => {
          GoogleAuthService.clearAccessToken();
          GoogleAuthManager.logout();
          setGoogleUser(null);
          loadDataFromService();
        }}
        onOpenAddShift={() => {
          // 補登必須寫入 work_records（Google Sheet），不可再走 ShiftLog / localStorage
          setQuickRecordDraft(
            calculateDailyWorkRecord({
              employee_id: '',
              work_date: new Date().toISOString().split('T')[0],
              clock_in_1: '09:00',
              clock_out_1: '18:00',
              verification_status: 'verified',
              source: 'manual',
            })
          );
        }}
        onOpenAddEmployee={() => setIsAddEmployeeModalOpen(true)}
        onOpenBatchAdd={() => setIsBatchModalOpen(true)}
        onUpdateStoreName={(newName) => setSettings((prev) => ({ ...prev, storeName: newName }))}
      />

      {/* Main Tab View */}
      <main className="flex-1 max-w-lg w-full mx-auto px-4 pt-4 pb-24">
        {/* Google Sheet Sync Status Bar */}
        <GoogleSheetSyncBar
          connectionState={sheetConnection}
          statusMessage={sheetStatusMessage}
          onOpenGoogleLogin={() => setIsGoogleLoginOpen(true)}
          onReconnect={handleReconnectAndSync}
        />
        {activeTab === 'home' && (
          <HomeView
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            employees={employees}
            timecards={timecards}
            storeSummary={storeSummary}
            onOpenCapture={() => setIsCaptureModalOpen(true)}
            onSelectEmployeeDetail={() => {
              setActiveTab('employees');
            }}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'employees' && (
          <EmployeeView
            employees={employees}
            shifts={shifts}
            timecards={timecards}
            dailyRecords={dailyRecords}
            settings={settings}
            onAddEmployee={handleAddEmployee}
            onUpdateEmployee={handleUpdateEmployee}
            onDeleteEmployee={handleDeleteEmployee}
            onUpdateDailyRecord={handleUpdateDailyRecord}
            onSyncEmployees={handleReconnectAndSync}
          />
        )}

        {activeTab === 'verify' && (
          <VerifyView
            timecards={timecards}
            employees={employees}
            dailyRecords={dailyRecords}
            onApproveTimecard={handleVerifyTimecard}
            onSaveApprovedDailyRecords={handleSaveApprovedDailyRecords}
            onOpenCapture={() => setIsCaptureModalOpen(true)}
          />
        )}

        {activeTab === 'reports' && (
          <ReportView
            employees={employees}
            shifts={shifts}
            settings={settings}
            dailyRecords={dailyRecords}
            onOpenLineModal={() => setIsLineModalOpen(true)}
            onSelectEmployeeDetail={() => {
              setActiveTab('employees');
            }}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingCount={pendingCount}
      />

      {/* Camera Capture Modal */}
      <CaptureCardModal
        isOpen={isCaptureModalOpen}
        onClose={() => setIsCaptureModalOpen(false)}
        employees={employees}
        selectedMonth={selectedMonth}
        onSaveTimecard={handleSaveTimecard}
      />

      {/* Single Shift Modal */}
      <ShiftModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        onSave={handleSaveShift}
        onDelete={handleDeleteShift}
        editingShift={editingShift}
        employees={employees}
        presets={presets}
        settings={settings}
        defaultDate={defaultShiftDate}
      />

      {/* Batch Shift Modal */}
      <BatchShiftModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        onSaveBatch={(batchData) => {
          const newShifts: ShiftLog[] = batchData.map((d, i) => ({
            ...d,
            id: `shift-${Date.now()}-${i}`,
            createdAt: new Date().toISOString(),
          }));
          setShifts((prev) => [...newShifts, ...prev]);
        }}
        employees={employees}
        presets={presets}
        settings={settings}
      />

      {/* LINE Group Share Modal */}
      <LineReportModal
        isOpen={isLineModalOpen}
        onClose={() => setIsLineModalOpen(false)}
        summary={storeSummary}
        storeName={settings.storeName}
      />

      {/* Add Employee Quick Modal */}
      <AddEmployeeModal
        isOpen={isAddEmployeeModalOpen}
        onClose={() => setIsAddEmployeeModalOpen(false)}
        onAddEmployee={handleAddEmployee}
        settings={settings}
        existingEmployees={employees}
      />

      {/* Header 快速補登工時 -> 寫入 work_records */}
      {quickRecordDraft && (
        <DailyDetailModal
          isOpen
          record={quickRecordDraft}
          employees={employees}
          employeeName="補登工時"
          onClose={() => setQuickRecordDraft(null)}
          onSave={async (rec) => {
            await handleUpdateDailyRecord(rec);
            setQuickRecordDraft(null);
          }}
        />
      )}

      {/* Google Account Login Modal */}
      <GoogleLoginModal
        isOpen={isGoogleLoginOpen}
        onClose={() => setIsGoogleLoginOpen(false)}
        onLoginSuccess={handleGoogleLoginSuccess}
      />
    </div>
  );
}
