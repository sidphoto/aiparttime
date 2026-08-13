import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  FileCheck,
  CheckCircle,
  AlertTriangle,
  Image as ImageIcon,
  Calendar,
  Clock,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  Sparkles,
  Info,
  ShieldCheck,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Lock,
  ArrowDown,
  ArrowUp,
  User,
  Filter,
} from 'lucide-react';
import { TimecardRecord, Employee, DailyWorkRecord, RecognitionDailyRecord, RecognitionTimeValue } from '../types';
import {
  validateDailyRecord,
  getConfidenceFieldStyle,
  generateDefault31DayRecognition,
  VerificationResult,
} from '../utils/verificationEngine';
import { calculateDailyWorkRecord, formatMinutesToHoursAndMinutes, calculatePeriodMinutes } from '../utils/calc';

interface VerifyViewProps {
  timecards: TimecardRecord[];
  employees: Employee[];
  dailyRecords: DailyWorkRecord[];
  onApproveTimecard: (id: string) => void;
  onSaveApprovedDailyRecords: (recordsToSave: DailyWorkRecord[], timecardId: string) => void;
  onOpenCapture: () => void;
}

export const VerifyView: React.FC<VerifyViewProps> = ({
  timecards,
  employees,
  dailyRecords,
  onApproveTimecard,
  onSaveApprovedDailyRecords,
  onOpenCapture,
}) => {
  // Navigation Tabs: 'pending' (待核對) | 'verified' (已核對轉正式)
  const [filterStatus, setFilterStatus] = useState<'pending' | 'verified'>('pending');

  // Filtered lists
  const pendingList = useMemo(() => timecards.filter((t) => t.status === 'pending'), [timecards]);
  const verifiedList = useMemo(() => timecards.filter((t) => t.status === 'verified'), [timecards]);

  // Selected timecard ID for verification
  const [selectedTimecardId, setSelectedTimecardId] = useState<string | null>(() => {
    return pendingList[0]?.id || timecards[0]?.id || null;
  });

  // Keep selectedTimecardId valid when pendingList updates
  useEffect(() => {
    if (filterStatus === 'pending') {
      if (!selectedTimecardId || !pendingList.some((t) => t.id === selectedTimecardId)) {
        if (pendingList.length > 0) {
          setSelectedTimecardId(pendingList[0].id);
        } else {
          setSelectedTimecardId(null);
        }
      }
    } else {
      if (!selectedTimecardId || !verifiedList.some((t) => t.id === selectedTimecardId)) {
        if (verifiedList.length > 0) {
          setSelectedTimecardId(verifiedList[0].id);
        } else {
          setSelectedTimecardId(null);
        }
      }
    }
  }, [filterStatus, pendingList, verifiedList, selectedTimecardId]);

  // Active Timecard Record
  const activeTimecard = useMemo(() => {
    return timecards.find((t) => t.id === selectedTimecardId) || null;
  }, [timecards, selectedTimecardId]);

  // Active Employee
  const activeEmployee = useMemo(() => {
    if (!activeTimecard) return null;
    return employees.find((e) => e.id === activeTimecard.employeeId) || null;
  }, [employees, activeTimecard]);

  // Photo controls state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isPhotoFullscreen, setIsPhotoFullscreen] = useState(false);

  // Local state for editable daily recognition items
  const [dailyDrafts, setDailyDrafts] = useState<RecognitionDailyRecord[]>([]);

  // Confirmed days state: Set of day numbers (1..31) explicitly confirmed by user
  const [confirmedDays, setConfirmedDays] = useState<Set<number>>(new Set());

  // Focused day for quick anomaly navigation
  const [focusedDay, setFocusedDay] = useState<number | null>(null);

  // Toast / Banner alert state
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Initialize or update dailyDrafts when activeTimecard changes
  useEffect(() => {
    if (!activeTimecard) {
      setDailyDrafts([]);
      setConfirmedDays(new Set());
      return;
    }

    if (activeTimecard.recognizedDailyRecords && activeTimecard.recognizedDailyRecords.length > 0) {
      setDailyDrafts(activeTimecard.recognizedDailyRecords);
    } else {
      setDailyDrafts(generateDefault31DayRecognition(activeTimecard.yearMonth, activeTimecard.employeeId));
    }

    setConfirmedDays(new Set());
    setFocusedDay(null);
    setZoomLevel(1);
    setRotation(0);
  }, [activeTimecard]);

  // Direct editing handler for punch times
  const handleTimeChange = (
    dateNumber: number,
    field: 'clock_in_1' | 'clock_out_1' | 'clock_in_2' | 'clock_out_2',
    newValue: string
  ) => {
    setDailyDrafts((prev) =>
      prev.map((item) => {
        if (item.date === dateNumber) {
          return {
            ...item,
            [field]: {
              value: newValue || null,
              confidence: 1.0, // Manual user edit sets confidence to 100% (High confidence / verified)
            },
          };
        }
        return item;
      })
    );
  };

  // Toggle "確認這一天" (Confirm This Day)
  const toggleConfirmDay = (dateNumber: number) => {
    setConfirmedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dateNumber)) {
        next.delete(dateNumber);
      } else {
        next.add(dateNumber);
      }
      return next;
    });
  };

  // Validation results & anomaly detection for each day
  const dailyValidationResults = useMemo(() => {
    if (!activeTimecard) return [];

    return dailyDrafts.map((draft) => {
      const res = validateDailyRecord(
        draft,
        activeTimecard.yearMonth,
        activeTimecard.employeeId,
        dailyRecords
      );

      const isConfirmed = confirmedDays.has(draft.date);

      // Check field level low/medium confidence or missing punch
      const cIn1 = draft.clock_in_1?.value || '';
      const cOut1 = draft.clock_out_1?.value || '';
      const cIn2 = draft.clock_in_2?.value || '';
      const cOut2 = draft.clock_out_2?.value || '';

      const confIn1 = draft.clock_in_1?.confidence ?? 1;
      const confOut1 = draft.clock_out_1?.confidence ?? 1;
      const confIn2 = draft.clock_in_2?.confidence ?? 1;
      const confOut2 = draft.clock_out_2?.confidence ?? 1;

      const hasLowConf =
        (cIn1 && confIn1 < 0.65) ||
        (cOut1 && confOut1 < 0.65) ||
        (cIn2 && confIn2 < 0.65) ||
        (cOut2 && confOut2 < 0.65);

      const hasMedConf =
        (cIn1 && confIn1 >= 0.65 && confIn1 < 0.85) ||
        (cOut1 && confOut1 >= 0.65 && confOut1 < 0.85) ||
        (cIn2 && confIn2 >= 0.65 && confIn2 < 0.85) ||
        (cOut2 && confOut2 >= 0.65 && confOut2 < 0.85);

      const hasRuleErrors = res.issues.some((i) => i.severity === 'error' || i.severity === 'warning');

      // An unhandled anomaly exists if the day has issues/low-confidence AND is NOT manually confirmed
      const isUnhandledAnomaly = !isConfirmed && (hasLowConf || hasMedConf || hasRuleErrors || res.hasDuplicateRecord);

      return {
        draft,
        res,
        isConfirmed,
        hasLowConf,
        hasMedConf,
        hasRuleErrors,
        isUnhandledAnomaly,
      };
    });
  }, [dailyDrafts, activeTimecard, dailyRecords, confirmedDays]);

  // List of days with unhandled anomalies
  const anomalousDays = useMemo(() => {
    return dailyValidationResults.filter((item) => item.isUnhandledAnomaly).map((item) => item.draft.date);
  }, [dailyValidationResults]);

  const unhandledAnomalyCount = anomalousDays.length;

  // Real-time recalculated monthly total minutes & days
  const monthlyStats = useMemo(() => {
    let totalMins = 0;
    let daysWithWork = 0;

    dailyValidationResults.forEach(({ res }) => {
      if (res.calculatedMinutes > 0) {
        totalMins += res.calculatedMinutes;
        daysWithWork++;
      }
    });

    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;

    return {
      totalDays: daysWithWork,
      totalHours: hours,
      totalMinutes: mins,
      formattedTotal: formatMinutesToHoursAndMinutes(totalMins),
    };
  }, [dailyValidationResults]);

  // Quick Navigation to Previous/Next Anomaly
  const scrollToDay = (dayNum: number) => {
    setFocusedDay(dayNum);
    const elem = document.getElementById(`day-card-${dayNum}`);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleNextAnomaly = () => {
    if (anomalousDays.length === 0) {
      setAlertMessage('目前所有日期均已完成核對，無未處理異常！');
      setTimeout(() => setAlertMessage(null), 3000);
      return;
    }

    let currentIndex = -1;
    if (focusedDay !== null) {
      currentIndex = anomalousDays.indexOf(focusedDay);
    }

    const nextIndex = (currentIndex + 1) % anomalousDays.length;
    const targetDay = anomalousDays[nextIndex];
    scrollToDay(targetDay);
  };

  const handlePrevAnomaly = () => {
    if (anomalousDays.length === 0) {
      setAlertMessage('目前所有日期均已完成核對，無未處理異常！');
      setTimeout(() => setAlertMessage(null), 3000);
      return;
    }

    let currentIndex = anomalousDays.length;
    if (focusedDay !== null) {
      const idx = anomalousDays.indexOf(focusedDay);
      if (idx !== -1) currentIndex = idx;
    }

    const prevIndex = (currentIndex - 1 + anomalousDays.length) % anomalousDays.length;
    const targetDay = anomalousDays[prevIndex];
    scrollToDay(targetDay);
  };

  // Handle Final Approval ("全部確認")
  const handleConfirmAll = () => {
    if (!activeTimecard) return;

    if (unhandledAnomalyCount > 0) {
      setAlertMessage(
        `尚有 ${unhandledAnomalyCount} 個未處理異常，請修正時間或點擊「確認這一天」後即可全部確認。`
      );
      // Auto scroll to first anomaly
      if (anomalousDays.length > 0) {
        scrollToDay(anomalousDays[0]);
      }
      setTimeout(() => setAlertMessage(null), 4000);
      return;
    }

    // Convert daily Drafts to formal DailyWorkRecords
    const recordsToSave: DailyWorkRecord[] = dailyDrafts.map((draft) => {
      const dayStr = String(draft.date).padStart(2, '0');
      const workDate = `${activeTimecard.yearMonth}-${dayStr}`;

      return calculateDailyWorkRecord({
        record_id: `rec-${activeTimecard.employeeId}-${workDate}`,
        employee_id: activeTimecard.employeeId,
        work_date: workDate,
        clock_in_1: draft.clock_in_1?.value || '',
        clock_out_1: draft.clock_out_1?.value || '',
        clock_in_2: draft.clock_in_2?.value || '',
        clock_out_2: draft.clock_out_2?.value || '',
        verification_status: 'verified',
        source: 'photo_ai',
      });
    });

    onSaveApprovedDailyRecords(recordsToSave, activeTimecard.id);
    setShowSuccessModal(true);
  };

  return (
    <div className="space-y-4 pb-24 max-w-5xl mx-auto">
      {/* Top Banner & Header */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
            紙本打卡卡線上核對工作台
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            上半部比對照片、下半部逐日校對。支援即時重新計算與異常快速跳轉。
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={onOpenCapture}
            className="px-3.5 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" /> 拍攝/上傳新卡
          </button>
        </div>
      </div>

      {/* Tabs: Pending Drafts vs Verified Cards */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
        <button
          onClick={() => setFilterStatus('pending')}
          className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
            filterStatus === 'pending'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>紙本打卡草稿（待核對）</span>
          <span
            className={`px-2 py-0.5 text-[11px] rounded-full font-black ${
              pendingList.length > 0 ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'
            }`}
          >
            {pendingList.length}
          </span>
        </button>

        <button
          onClick={() => setFilterStatus('verified')}
          className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
            filterStatus === 'verified'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>已核對轉正式</span>
          <span className="px-2 py-0.5 text-[11px] rounded-full font-black bg-slate-200 text-slate-600">
            {verifiedList.length}
          </span>
        </button>
      </div>

      {/* Empty State */}
      {filterStatus === 'pending' && pendingList.length === 0 && (
        <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center space-y-3 shadow-xs">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100 shadow-2xs">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h3 className="text-base font-black text-slate-900">目前沒有待核對的打卡卡草稿</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            您已完成所有打卡卡的二次核對機制！若需記錄新打卡卡，請點擊上方「拍攝/上傳新卡」。
          </p>
        </div>
      )}

      {filterStatus === 'verified' && verifiedList.length === 0 && (
        <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center space-y-3 shadow-xs">
          <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
            <FileCheck className="w-8 h-8" />
          </div>
          <h3 className="text-base font-black text-slate-900">尚無已完成核對的正式卡片</h3>
          <p className="text-xs text-slate-500">
            於「待核對草稿」中完成全數確認後，卡片將自動移至此處並算入工時薪資統計。
          </p>
        </div>
      )}

      {/* Active Timecard Verification Workspace */}
      {activeTimecard && (
        <div className="space-y-4">
          {/* Timecard Switcher Bar (If multiple pending cards exist) */}
          {filterStatus === 'pending' && pendingList.length > 1 && (
            <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs flex items-center justify-between gap-2 overflow-x-auto">
              <span className="text-xs font-bold text-slate-500 shrink-0 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-blue-600" /> 選擇待核對卡片：
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {pendingList.map((tc) => {
                  const emp = employees.find((e) => e.id === tc.employeeId);
                  const isSelected = tc.id === selectedTimecardId;
                  return (
                    <button
                      key={tc.id}
                      onClick={() => setSelectedTimecardId(tc.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-2 border ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: emp?.color || '#3b82f6' }}
                      />
                      <span>{tc.employeeName}</span>
                      <span className="font-mono text-[10px] opacity-80">({tc.yearMonth})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ==================== 上半部：顯示原始打卡卡照片 ==================== */}
          <div className="bg-slate-900 rounded-3xl p-4 sm:p-5 text-white shadow-xl border border-slate-800 space-y-3 relative overflow-hidden">
            {/* Upper Header Meta */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-white text-base shadow-md shrink-0 ring-2 ring-white/10"
                  style={{ backgroundColor: activeEmployee?.color || '#3b82f6' }}
                >
                  {activeTimecard.shortName || activeTimecard.employeeName.slice(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black tracking-tight">{activeTimecard.employeeName}</h3>
                    <span className="text-xs bg-slate-800 text-slate-300 font-extrabold px-2 py-0.5 rounded-full border border-slate-700">
                      {activeTimecard.yearMonth} 月份紙本卡
                    </span>
                    {activeTimecard.status === 'pending' ? (
                      <span className="px-2.5 py-0.5 text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-400/30 rounded-md">
                        待核對草稿
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-md">
                        已轉正式工時
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    拍攝上傳時間：{activeTimecard.uploadedAt}
                  </p>
                </div>
              </div>

              {/* Real-time Recalculated Total Stats Badge */}
              <div className="bg-slate-800/90 rounded-2xl px-4 py-2 border border-slate-700/80 flex items-center justify-between sm:justify-end gap-4 shrink-0">
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    即時試算總工時
                  </span>
                  <div className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                    {monthlyStats.formattedTotal}
                  </div>
                </div>
                <div className="w-px h-8 bg-slate-700" />
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    出勤天數
                  </span>
                  <div className="text-base sm:text-lg font-black text-blue-300 font-mono">
                    {monthlyStats.totalDays} 天
                  </div>
                </div>
              </div>
            </div>

            {/* Original Timecard Photo Container */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex flex-col items-center justify-center group min-h-[220px] max-h-[380px]">
              {/* Photo Controls Bar */}
              <div className="absolute top-3 right-3 z-20 bg-slate-900/80 backdrop-blur-md px-2 py-1 rounded-xl border border-slate-700/80 flex items-center gap-1.5 shadow-lg">
                <button
                  onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 2.5))}
                  title="放大照片"
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.75))}
                  title="縮小照片"
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  title="旋轉照片"
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsPhotoFullscreen(true)}
                  title="全螢幕看圖"
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-blue-400 hover:text-blue-300 transition"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>

              {/* Photo Image Display */}
              <div className="w-full h-full overflow-auto flex items-center justify-center p-2 min-h-[200px]">
                <img
                  src={activeTimecard.imageUrl}
                  alt="Original Timecard"
                  style={{
                    transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                    transition: 'transform 0.2s ease-out',
                  }}
                  className="max-h-[340px] w-auto object-contain rounded-lg shadow-2xl cursor-grab active:cursor-grabbing"
                />
              </div>

              <div className="absolute bottom-2 left-3 bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-lg text-[10px] text-slate-300 font-mono font-medium">
                [原始紙本卡照] 縮放: {Math.round(zoomLevel * 100)}%
              </div>
            </div>
          </div>

          {/* Alert / Notification Banner */}
          {alertMessage && (
            <div className="bg-rose-500 text-white font-extrabold text-xs px-4 py-3 rounded-2xl shadow-lg border border-rose-600 flex items-center justify-between animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0" />
                <span>{alertMessage}</span>
              </div>
              <button
                onClick={() => setAlertMessage(null)}
                className="w-5 h-5 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* ==================== 快速核對與異常跳轉控制列 ==================== */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-3 sm:px-4 text-white shadow-md border border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-3 sticky top-2 z-30 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              {unhandledAnomalyCount > 0 ? (
                <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-400/30 rounded-xl text-xs font-extrabold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>尚有 {unhandledAnomalyCount} 個未處理異常或待校對項目</span>
                </span>
              ) : (
                <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-xl text-xs font-extrabold flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>全數核對無誤！即可進行「全部確認」</span>
                </span>
              )}
            </div>

            {/* Quick Navigation Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handlePrevAnomaly}
                className="flex-1 sm:flex-none px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-extrabold text-xs rounded-xl border border-slate-700 transition flex items-center justify-center gap-1 active:scale-95 shadow-xs"
              >
                <ChevronLeft className="w-4 h-4 text-blue-400" />
                <span>上一個異常</span>
              </button>

              <button
                onClick={handleNextAnomaly}
                className="flex-1 sm:flex-none px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1 active:scale-95"
              >
                <span>下一個異常</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Legend / Color Hint Bar */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200 text-xs flex items-center justify-between flex-wrap gap-2 text-slate-600">
            <span className="font-extrabold text-slate-800">考勤卡狀態標記：</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" />
                <span className="font-bold text-slate-700">已確認 / 正常</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-rose-100 border border-rose-300" />
                <span className="font-bold text-rose-900">時間未齊全 / 缺卡警示</span>
              </span>
            </div>
          </div>

          {/* ==================== 下半部：顯示 AI 辨識結果與直接編輯 ==================== */}
          <div className="space-y-3">
            {dailyValidationResults.map(({ draft, res, isConfirmed, hasLowConf, hasMedConf, hasRuleErrors, isUnhandledAnomaly }) => {
              const dayNum = draft.date;
              const isFocused = focusedDay === dayNum;

              // Calculate period 1 & period 2 for current inputs in real time
              const cIn1 = draft.clock_in_1?.value || '';
              const cOut1 = draft.clock_out_1?.value || '';
              const cIn2 = draft.clock_in_2?.value || '';
              const cOut2 = draft.clock_out_2?.value || '';

              const p1 = calculatePeriodMinutes(cIn1, cOut1);
              const p2 = calculatePeriodMinutes(cIn2, cOut2);
              const totalDayMins = p1.minutes + p2.minutes;
              const formattedDailyTotal = formatMinutesToHoursAndMinutes(totalDayMins);

              return (
                <div
                  id={`day-card-${dayNum}`}
                  key={dayNum}
                  className={`bg-white rounded-2xl p-3.5 sm:p-4 border transition-all duration-300 space-y-3 ${
                    isFocused
                      ? 'border-blue-500 ring-4 ring-blue-500/20 shadow-xl scale-[1.01] bg-blue-50/20'
                      : isConfirmed
                      ? 'border-emerald-300 bg-emerald-50/10'
                      : isUnhandledAnomaly
                      ? 'border-rose-300 ring-1 ring-rose-200 bg-rose-50/10'
                      : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  {/* Row Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-slate-900 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
                        8月{dayNum}日
                      </span>

                      {/* Status Badges */}
                      {isConfirmed ? (
                        <span className="px-2.5 py-0.5 text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> 人工已核對
                        </span>
                      ) : isUnhandledAnomaly ? (
                        <span className="px-2.5 py-0.5 text-[11px] font-black bg-rose-100 text-rose-900 border border-rose-300 rounded-md flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> 待核對異常
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-md">
                          正常
                        </span>
                      )}
                    </div>

                    {/* Right Calculation Display & Single Day Confirm Button */}
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 block">計算結果</span>
                        <span className="font-mono font-black text-sm text-blue-600">
                          {formattedDailyTotal}
                        </span>
                      </div>

                      {/* 「確認這一天」 Button */}
                      {filterStatus === 'pending' && (
                        <button
                          onClick={() => toggleConfirmDay(dayNum)}
                          className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition shadow-2xs flex items-center gap-1 active:scale-95 ${
                            isConfirmed
                              ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isConfirmed ? '✓ 已確認此天' : '確認這一天'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 4 Punch Input Fields Grid (Directly Editable & Recalculates) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
                    {/* 上班① */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-sans font-extrabold text-slate-500 mb-1">
                        <span>上班①</span>
                        {draft.clock_in_1?.confidence !== undefined && draft.clock_in_1.value && (
                          <span
                            className={
                              draft.clock_in_1.confidence < 0.65
                                ? 'text-rose-600 font-black'
                                : draft.clock_in_1.confidence < 0.85
                                ? 'text-amber-700 font-extrabold'
                                : 'text-emerald-600'
                            }
                          >
                            {Math.round(draft.clock_in_1.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="09:00"
                        value={draft.clock_in_1?.value || ''}
                        onChange={(e) => handleTimeChange(dayNum, 'clock_in_1', e.target.value)}
                        className={`w-full px-2.5 py-2 rounded-xl border text-center transition ${getConfidenceFieldStyle(
                          draft.clock_in_1?.confidence,
                          !!draft.clock_in_1?.value
                        )}`}
                      />
                    </div>

                    {/* 下班① */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-sans font-extrabold text-slate-500 mb-1">
                        <span>下班①</span>
                        {draft.clock_out_1?.confidence !== undefined && draft.clock_out_1.value && (
                          <span
                            className={
                              draft.clock_out_1.confidence < 0.65
                                ? 'text-rose-600 font-black'
                                : draft.clock_out_1.confidence < 0.85
                                ? 'text-amber-700 font-extrabold'
                                : 'text-emerald-600'
                            }
                          >
                            {Math.round(draft.clock_out_1.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="18:00"
                        value={draft.clock_out_1?.value || ''}
                        onChange={(e) => handleTimeChange(dayNum, 'clock_out_1', e.target.value)}
                        className={`w-full px-2.5 py-2 rounded-xl border text-center transition ${getConfidenceFieldStyle(
                          draft.clock_out_1?.confidence,
                          !!draft.clock_out_1?.value
                        )}`}
                      />
                    </div>

                    {/* 上班② */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-sans font-extrabold text-slate-500 mb-1">
                        <span>上班②</span>
                        {draft.clock_in_2?.confidence !== undefined && draft.clock_in_2.value && (
                          <span
                            className={
                              draft.clock_in_2.confidence < 0.65
                                ? 'text-rose-600 font-black'
                                : draft.clock_in_2.confidence < 0.85
                                ? 'text-amber-700 font-extrabold'
                                : 'text-emerald-600'
                            }
                          >
                            {Math.round(draft.clock_in_2.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="無"
                        value={draft.clock_in_2?.value || ''}
                        onChange={(e) => handleTimeChange(dayNum, 'clock_in_2', e.target.value)}
                        className={`w-full px-2.5 py-2 rounded-xl border text-center transition ${getConfidenceFieldStyle(
                          draft.clock_in_2?.confidence,
                          !!draft.clock_in_2?.value
                        )}`}
                      />
                    </div>

                    {/* 下班② */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-sans font-extrabold text-slate-500 mb-1">
                        <span>下班②</span>
                        {draft.clock_out_2?.confidence !== undefined && draft.clock_out_2.value && (
                          <span
                            className={
                              draft.clock_out_2.confidence < 0.65
                                ? 'text-rose-600 font-black'
                                : draft.clock_out_2.confidence < 0.85
                                ? 'text-amber-700 font-extrabold'
                                : 'text-emerald-600'
                            }
                          >
                            {Math.round(draft.clock_out_2.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="無"
                        value={draft.clock_out_2?.value || ''}
                        onChange={(e) => handleTimeChange(dayNum, 'clock_out_2', e.target.value)}
                        className={`w-full px-2.5 py-2 rounded-xl border text-center transition ${getConfidenceFieldStyle(
                          draft.clock_out_2?.confidence,
                          !!draft.clock_out_2?.value
                        )}`}
                      />
                    </div>
                  </div>

                  {/* Rule Validation Warning Issues */}
                  {res.issues.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {res.issues.map((issue, idx) => (
                        <div
                          key={idx}
                          className={`text-xs p-2 rounded-xl flex items-center gap-1.5 ${
                            issue.severity === 'error'
                              ? 'bg-rose-100 text-rose-950 font-extrabold border border-rose-200'
                              : issue.severity === 'warning'
                              ? 'bg-amber-100 text-amber-950 font-bold border border-amber-200'
                              : 'bg-blue-50 text-blue-900 border border-blue-200 font-semibold'
                          }`}
                        >
                          <AlertTriangle
                            className={`w-3.5 h-3.5 shrink-0 ${
                              issue.severity === 'error'
                                ? 'text-rose-600'
                                : issue.severity === 'warning'
                                ? 'text-amber-600'
                                : 'text-blue-600'
                            }`}
                          />
                          <span>{issue.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ==================== Sticky Footer: 最終確認 (全部確認) ==================== */}
          {filterStatus === 'pending' && (
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 sm:p-4 shadow-2xl">
              <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-slate-600 space-y-0.5 text-center sm:text-left">
                  <div className="font-extrabold text-slate-900 flex items-center justify-center sm:justify-start gap-2">
                    <span>月累計試算：{monthlyStats.formattedTotal}</span>
                    <span className="text-slate-400">·</span>
                    <span>出勤 {monthlyStats.totalDays} 天</span>
                  </div>
                  {unhandledAnomalyCount > 0 ? (
                    <div className="text-rose-600 font-extrabold text-[11px] flex items-center gap-1 justify-center sm:justify-start">
                      <Lock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span>尚有 {unhandledAnomalyCount} 個未處理異常，需先修正或點擊「確認這一天」才可全部確認</span>
                    </div>
                  ) : (
                    <div className="text-emerald-600 font-black text-[11px] flex items-center gap-1 justify-center sm:justify-start">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>全數考勤資料已核對無誤！點擊右側按鈕寫入正式工時</span>
                    </div>
                  )}
                </div>

                {/* 「全部確認」 Button */}
                <button
                  onClick={handleConfirmAll}
                  disabled={unhandledAnomalyCount > 0}
                  className={`w-full sm:w-auto px-6 py-3 rounded-2xl font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                    unhandledAnomalyCount > 0
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 active:scale-95'
                  }`}
                >
                  <ShieldCheck className="w-5 h-5" />
                  <span>全部確認（寫入正式工時紀錄）</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fullscreen Photo Modal */}
      {isPhotoFullscreen && activeTimecard && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-4xl w-full h-[90vh] bg-slate-950 rounded-3xl border border-slate-800 flex flex-col overflow-hidden relative">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between text-white shrink-0">
              <span className="font-extrabold text-sm">
                原始打卡卡高畫質檢視 ({activeTimecard.employeeName} · {activeTimecard.yearMonth})
              </span>
              <button
                onClick={() => setIsPhotoFullscreen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-black">
              <img
                src={activeTimecard.imageUrl}
                alt="Full Timecard"
                className="max-h-full max-w-full object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full rounded-3xl p-6 text-center space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-50">
              <CheckCircle className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900">二次核對完成！</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                考勤資料已成功通過 8 項合規驗證，並轉換為正式工時紀錄寫入資料庫與月薪試算表。
              </p>
            </div>
            <button
              onClick={() => {
                setShowSuccessModal(false);
                setFilterStatus('verified');
              }}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-md"
            >
              檢視已轉正式列表
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
