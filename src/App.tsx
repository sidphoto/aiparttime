/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Employee, ShiftLog, ShiftPreset, StoreSettings, TimecardRecord, DailyWorkRecord } from './types';
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
import { dataServiceManager } from './services/dataServiceManager';
import { generateStoreSummary, getPayCyclePeriod } from './utils/calc';

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
    const saved = localStorage.getItem('store_employees');
    if (!saved) return defaultEmployees;
    try {
      const parsed: Employee[] = JSON.parse(saved);
      const uniqueMap = new Map<string, Employee>();
      parsed.forEach((e) => {
        const key = e.id || e.employee_id || e.employeeNo;
        if (key) uniqueMap.set(key, e);
      });
      return Array.from(uniqueMap.values());
    } catch {
      return defaultEmployees;
    }
  });

  // Auto-purge legacy mock data on update once
  useEffect(() => {
    if (!localStorage.getItem('store_data_v3_purged')) {
      localStorage.removeItem('store_shifts');
      localStorage.removeItem('store_timecards');
      localStorage.removeItem('store_daily_records');
      localStorage.removeItem('store_work_records');
      localStorage.removeItem('store_recognition_records');
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
    const saved = localStorage.getItem('store_daily_records');
    return saved ? JSON.parse(saved) : [];
  });

  const [presets, setPresets] = useState<ShiftPreset[]>(() => {
    const saved = localStorage.getItem('store_presets');
    return saved ? JSON.parse(saved) : defaultPresets;
  });

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

  // Async Data Service Initialization & Data Fetching
  const loadDataFromService = useCallback(async () => {
    try {
      await dataServiceManager.initialize();

      // Fetch Store Info (S001 -> 參陸河粉)
      const storeInfo = await dataServiceManager.getStore('S001');
      if (storeInfo && storeInfo.store_name) {
        setSettings((prev) => ({ ...prev, storeName: storeInfo.store_name }));
      }

      const emps = await dataServiceManager.getEmployees();
      if (emps && emps.length > 0) {
        const uniqueMap = new Map<string, Employee>();
        emps.forEach((e) => {
          const key = e.id || e.employee_id || e.employeeNo;
          if (key) uniqueMap.set(key, e);
        });
        const uniqueEmps = Array.from(uniqueMap.values());
        setEmployees(uniqueEmps);
        localStorage.setItem('store_employees', JSON.stringify(uniqueEmps));
      }

      const workRecs = await dataServiceManager.getWorkRecords();
      if (workRecs && workRecs.length > 0) setDailyRecords(workRecs);

      const recogs = await dataServiceManager.getRecognitionRecords();
      if (recogs && recogs.length > 0) setTimecards(recogs);
    } catch (err) {
      console.error('Failed to load data from data service:', err);
    }
  }, []);

  useEffect(() => {
    loadDataFromService();
  }, [loadDataFromService]);

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem('store_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('store_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('store_shifts', JSON.stringify(shifts));
  }, [shifts]);

  useEffect(() => {
    localStorage.setItem('store_timecards', JSON.stringify(timecards));
  }, [timecards]);

  useEffect(() => {
    localStorage.setItem('store_daily_records', JSON.stringify(dailyRecords));
  }, [dailyRecords]);

  useEffect(() => {
    localStorage.setItem('store_presets', JSON.stringify(presets));
  }, [presets]);

  // Current period summary
  const currentYearMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentYearMonth);
  const period = getPayCyclePeriod(selectedMonth, settings.payCycleStartDay);
  const storeSummary = useMemo(() => {
    return generateStoreSummary(employees, shifts, period.startDate, period.endDate, period.label);
  }, [employees, shifts, period]);

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
    setDailyRecords((prev) => {
      const exists = prev.some((r) => r.record_id === updatedRecord.record_id);
      if (exists) {
        return prev.map((r) => (r.record_id === updatedRecord.record_id ? updatedRecord : r));
      }
      return [updatedRecord, ...prev];
    });

    await dataServiceManager.saveWorkRecords([updatedRecord]);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-600 selection:text-white flex flex-col">
      {/* Top Header */}
      <Header
        settings={settings}
        activeTab={activeTab}
        onOpenAddShift={() => handleOpenAddShift()}
        onOpenAddEmployee={() => setIsAddEmployeeModalOpen(true)}
        onOpenBatchAdd={() => setIsBatchModalOpen(true)}
        onUpdateStoreName={(newName) => setSettings((prev) => ({ ...prev, storeName: newName }))}
      />

      {/* Main Tab View */}
      <main className="flex-1 max-w-lg w-full mx-auto px-4 pt-4 pb-24">
        {/* Google Sheet Sync Status Bar */}
        <GoogleSheetSyncBar onSyncCompleted={loadDataFromService} />
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
            onSyncEmployees={loadDataFromService}
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
    </div>
  );
}

