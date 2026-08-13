import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  X,
  Eye,
  ArrowRight,
  GitCompare,
  Trash2,
  Check,
  Edit3,
  Calendar,
  Clock,
  Sparkles,
  HelpCircle,
  Info,
} from 'lucide-react';
import { TimecardRecord, Employee, DailyWorkRecord, RecognitionDailyRecord } from '../types';
import {
  validateDailyRecord,
  getConfidenceFieldStyle,
  VerificationResult,
  RecordStatusType,
} from '../utils/verificationEngine';
import { calculateDailyWorkRecord, formatMinutesToHoursAndMinutes } from '../utils/calc';

interface SecondaryVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  timecard: TimecardRecord | null;
  employees: Employee[];
  existingDailyRecords: DailyWorkRecord[];
  onSaveApprovedDailyRecords: (recordsToSave: DailyWorkRecord[], timecardId: string) => void;
}

export const SecondaryVerificationModal: React.FC<SecondaryVerificationModalProps> = ({
  isOpen,
  onClose,
  timecard,
  employees,
  existingDailyRecords,
  onSaveApprovedDailyRecords,
}) => {
  if (!isOpen || !timecard) return null;

  const emp = employees.find((e) => e.id === timecard.employeeId);
  const employeeName = timecard.employeeName || emp?.name || '未知員工';
  const shortName = timecard.shortName || emp?.shortName || employeeName.slice(0, 2);

  // Local state for daily recognition items (allows user to edit or exclude days)
  const [dailyDrafts, setDailyDrafts] = useState<RecognitionDailyRecord[]>(() => {
    return timecard.recognizedDailyRecords || [];
  });

  // Track user actions for duplicate days: { [workDate]: 'skip' | 'overwrite' | 'keep_original' }
  const [duplicateDecisions, setDuplicateDecisions] = useState<Record<string, 'skip' | 'overwrite'>>({});

  // Active filter tab: 'all' | 'issues_only' | 'duplicates_only' | 'normal'
  const [filterTab, setFilterTab] = useState<'all' | 'issues_only' | 'duplicates_only' | 'normal'>('all');

  // Modal overlays for Viewing Original or Side-by-Side Comparison
  const [viewingOriginalRecord, setViewingOriginalRecord] = useState<{
    workDate: string;
    original: DailyWorkRecord;
  } | null>(null);

  const [comparingRecord, setComparingRecord] = useState<{
    workDate: string;
    original: DailyWorkRecord;
    draft: RecognitionDailyRecord;
  } | null>(null);

  // Compute validation results for all daily records
  const validationResults = useMemo(() => {
    return dailyDrafts.map((draft) => {
      const res = validateDailyRecord(draft, timecard.yearMonth, timecard.employeeId, existingDailyRecords);
      return {
        draft,
        res,
      };
    });
  }, [dailyDrafts, timecard.yearMonth, timecard.employeeId, existingDailyRecords]);

  // Statistics
  const stats = useMemo(() => {
    let normalCount = 0;
    let needsConfirmCount = 0;
    let abnormalCount = 0;
    let duplicateCount = 0;

    validationResults.forEach(({ res }) => {
      if (res.hasDuplicateRecord) duplicateCount++;
      if (res.status === 'normal') normalCount++;
      else if (res.status === 'needs_confirmation') needsConfirmCount++;
      else abnormalCount++;
    });

    return {
      total: validationResults.length,
      normalCount,
      needsConfirmCount,
      abnormalCount,
      duplicateCount,
    };
  }, [validationResults]);

  // Filtered list based on active tab
  const filteredList = useMemo(() => {
    return validationResults.filter(({ res }) => {
      if (filterTab === 'issues_only') {
        return res.status === 'needs_confirmation' || res.status === 'abnormal';
      }
      if (filterTab === 'duplicates_only') {
        return res.hasDuplicateRecord;
      }
      if (filterTab === 'normal') {
        return res.status === 'normal';
      }
      return true;
    });
  }, [validationResults, filterTab]);

  // Update a specific field value
  const handleTimeChange = (
    date: number,
    field: 'clock_in_1' | 'clock_out_1' | 'clock_in_2' | 'clock_out_2',
    val: string
  ) => {
    setDailyDrafts((prev) =>
      prev.map((d) => {
        if (d.date === date) {
          return {
            ...d,
            [field]: {
              value: val || null,
              confidence: 1.0, // Manual user edit sets confidence to 100%
            },
          };
        }
        return d;
      })
    );
  };

  // Decision handler for duplicate record
  const setDecisionForDay = (workDate: string, decision: 'skip' | 'overwrite') => {
    setDuplicateDecisions((prev) => ({
      ...prev,
      [workDate]: decision,
    }));
  };

  // Final confirmation: convert draft daily records to formal DailyWorkRecord
  const handleFinalApprove = () => {
    const recordsToSave: DailyWorkRecord[] = [];

    validationResults.forEach(({ draft, res }) => {
      const decision = duplicateDecisions[res.workDate];

      // If day has duplicate record and user chose to skip import, do NOT overwrite
      if (res.hasDuplicateRecord && decision === 'skip') {
        return;
      }

      const rec = calculateDailyWorkRecord({
        record_id: `rec-${timecard.employeeId}-${res.workDate}`,
        employee_id: timecard.employeeId,
        work_date: res.workDate,
        clock_in_1: draft.clock_in_1?.value || '',
        clock_out_1: draft.clock_out_1?.value || '',
        clock_in_2: draft.clock_in_2?.value || '',
        clock_out_2: draft.clock_out_2?.value || '',
        verification_status: 'verified',
        source: 'photo_ai',
      });

      recordsToSave.push(rec);
    });

    onSaveApprovedDailyRecords(recordsToSave, timecard.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white max-w-2xl w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-black uppercase tracking-wider">
                AI 辨識二次核對機制
              </span>
              <span className="text-xs text-slate-400 font-mono">{timecard.yearMonth} 月份</span>
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
              <span>{employeeName}</span>
              <span className="text-xs bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded-full">
                {shortName}
              </span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Real-time Summary Bar */}
        <div className="bg-slate-100 border-b border-slate-200 p-3 sm:px-5 flex items-center justify-between text-xs font-bold shrink-0 overflow-x-auto gap-2">
          <div className="flex items-center gap-3">
            <span className="text-slate-600 font-extrabold">總位數：{stats.total} 天</span>
            <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> 正常 {stats.normalCount}
            </span>
            <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> 需確認 {stats.needsConfirmCount}
            </span>
            <span className="flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> 異常/低可信度 {stats.abnormalCount}
            </span>
            {stats.duplicateCount > 0 && (
              <span className="flex items-center gap-1 text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                <GitCompare className="w-3.5 h-3.5 text-purple-600" /> 重複資料 {stats.duplicateCount}
              </span>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-1 text-xs shrink-0 overflow-x-auto">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-xl font-extrabold transition ${
              filterTab === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            全部紀錄 ({stats.total})
          </button>
          <button
            onClick={() => setFilterTab('issues_only')}
            className={`px-3 py-1.5 rounded-xl font-extrabold transition flex items-center gap-1 ${
              filterTab === 'issues_only'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-800 bg-amber-50 hover:bg-amber-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            需確認 / 異常 ({stats.needsConfirmCount + stats.abnormalCount})
          </button>

          {stats.duplicateCount > 0 && (
            <button
              onClick={() => setFilterTab('duplicates_only')}
              className={`px-3 py-1.5 rounded-xl font-extrabold transition flex items-center gap-1 ${
                filterTab === 'duplicates_only'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-purple-800 bg-purple-50 hover:bg-purple-100'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              重複資料 ({stats.duplicateCount})
            </button>
          )}

          <button
            onClick={() => setFilterTab('normal')}
            className={`px-3 py-1.5 rounded-xl font-extrabold transition ${
              filterTab === 'normal'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
            }`}
          >
            正常通過 ({stats.normalCount})
          </button>
        </div>

        {/* Daily Records List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
          {filteredList.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-xs font-bold">此篩選條件下無符合紀錄</p>
            </div>
          ) : (
            filteredList.map(({ draft, res }) => {
              const decision = duplicateDecisions[res.workDate];

              return (
                <div
                  key={draft.date}
                  className={`bg-white rounded-2xl p-3.5 border transition-all space-y-2.5 ${
                    res.hasDuplicateRecord
                      ? 'border-purple-300 ring-1 ring-purple-200/80 bg-purple-50/20'
                      : res.status === 'abnormal'
                      ? 'border-rose-300 ring-1 ring-rose-200 bg-rose-50/20'
                      : res.status === 'needs_confirmation'
                      ? 'border-amber-300 ring-1 ring-amber-200 bg-amber-50/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Row Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                        {draft.date}日 ({res.workDate})
                      </span>

                      {/* Status Tag */}
                      {res.hasDuplicateRecord ? (
                        <span className="px-2.5 py-0.5 text-[11px] font-black bg-purple-100 text-purple-900 border border-purple-300 rounded-md flex items-center gap-1">
                          <GitCompare className="w-3 h-3 text-purple-700" /> 重複資料（已有正式工時）
                        </span>
                      ) : res.status === 'normal' ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-md flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-emerald-600" /> 正常
                        </span>
                      ) : res.status === 'needs_confirmation' ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 rounded-md flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600" /> 需確認
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-black bg-rose-100 text-rose-900 rounded-md flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-rose-600" /> 異常/低可信度
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-mono font-bold text-slate-600">
                      當日估算：{formatMinutesToHoursAndMinutes(res.calculatedMinutes)}
                    </div>
                  </div>

                  {/* Duplicate Record Notice & Action Bar */}
                  {res.hasDuplicateRecord && res.existingRecord && (
                    <div className="bg-purple-100/80 rounded-xl p-3 border border-purple-200 text-purple-950 space-y-2">
                      <div className="flex items-center justify-between text-xs font-black">
                        <span className="flex items-center gap-1 text-purple-900">
                          <AlertTriangle className="w-4 h-4 text-purple-700" />
                          <span>這一天已存在工時資料 (系統禁止自動覆蓋)</span>
                        </span>
                        {decision === 'skip' ? (
                          <span className="px-2 py-0.5 text-[10px] bg-slate-200 text-slate-700 rounded font-extrabold">
                            已選擇：取消匯入（保留原正式資料）
                          </span>
                        ) : decision === 'overwrite' ? (
                          <span className="px-2 py-0.5 text-[10px] bg-purple-600 text-white rounded font-extrabold">
                            已選擇：使用 AI 草稿覆蓋
                          </span>
                        ) : (
                          <span className="text-[10px] text-purple-700 font-extrabold">請選擇處理方式：</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() =>
                            setViewingOriginalRecord({
                              workDate: res.workDate,
                              original: res.existingRecord!,
                            })
                          }
                          className="px-2.5 py-1.5 bg-white hover:bg-purple-50 text-purple-900 font-bold text-xs rounded-lg border border-purple-300 shadow-2xs flex items-center gap-1 transition"
                        >
                          <Eye className="w-3.5 h-3.5 text-purple-700" /> 查看原資料
                        </button>

                        <button
                          onClick={() =>
                            setComparingRecord({
                              workDate: res.workDate,
                              original: res.existingRecord!,
                              draft,
                            })
                          }
                          className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg shadow-2xs flex items-center gap-1 transition"
                        >
                          <GitCompare className="w-3.5 h-3.5" /> 比較兩筆資料
                        </button>

                        <button
                          onClick={() => setDecisionForDay(res.workDate, 'skip')}
                          className={`px-2.5 py-1.5 font-bold text-xs rounded-lg border shadow-2xs flex items-center gap-1 transition ${
                            decision === 'skip'
                              ? 'bg-slate-800 text-white border-slate-800'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <X className="w-3.5 h-3.5 text-rose-500" /> 取消匯入此天
                        </button>

                        {decision === 'skip' && (
                          <button
                            onClick={() => setDecisionForDay(res.workDate, 'overwrite')}
                            className="text-[10px] text-purple-700 underline font-extrabold ml-auto"
                          >
                            改為允許覆蓋
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Punch Input Fields with Confidence Highlighting */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    {/* Clock In 1 */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-sans font-bold text-slate-500 mb-0.5">
                        <span>上1 (In 1)</span>
                        {draft.clock_in_1?.confidence !== undefined && draft.clock_in_1.value && (
                          <span
                            className={
                              draft.clock_in_1.confidence < 0.65
                                ? 'text-rose-600 font-extrabold'
                                : draft.clock_in_1.confidence < 0.85
                                ? 'text-amber-600 font-extrabold'
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
                        onChange={(e) => handleTimeChange(draft.date, 'clock_in_1', e.target.value)}
                        className={`w-full px-2.5 py-1.5 rounded-xl border text-center transition ${getConfidenceFieldStyle(
                          draft.clock_in_1?.confidence,
                          !!draft.clock_in_1?.value
                        )}`}
                      />
                    </div>

                    {/* Clock Out 1 */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-sans font-bold text-slate-500 mb-0.5">
                        <span>下1 (Out 1)</span>
                        {draft.clock_out_1?.confidence !== undefined && draft.clock_out_1.value && (
                          <span
                            className={
                              draft.clock_out_1.confidence < 0.65
                                ? 'text-rose-600 font-extrabold'
                                : draft.clock_out_1.confidence < 0.85
                                ? 'text-amber-600 font-extrabold'
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
                        onChange={(e) => handleTimeChange(draft.date, 'clock_out_1', e.target.value)}
                        className={`w-full px-2.5 py-1.5 rounded-xl border text-center transition ${getConfidenceFieldStyle(
                          draft.clock_out_1?.confidence,
                          !!draft.clock_out_1?.value
                        )}`}
                      />
                    </div>

                    {/* Clock In 2 */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-sans font-bold text-slate-500 mb-0.5">
                        <span>上2 (In 2)</span>
                        {draft.clock_in_2?.confidence !== undefined && draft.clock_in_2.value && (
                          <span
                            className={
                              draft.clock_in_2.confidence < 0.65
                                ? 'text-rose-600 font-extrabold'
                                : draft.clock_in_2.confidence < 0.85
                                ? 'text-amber-600 font-extrabold'
                                : 'text-emerald-600'
                            }
                          >
                            {Math.round(draft.clock_in_2.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="未填"
                        value={draft.clock_in_2?.value || ''}
                        onChange={(e) => handleTimeChange(draft.date, 'clock_in_2', e.target.value)}
                        className={`w-full px-2.5 py-1.5 rounded-xl border text-center transition ${getConfidenceFieldStyle(
                          draft.clock_in_2?.confidence,
                          !!draft.clock_in_2?.value
                        )}`}
                      />
                    </div>

                    {/* Clock Out 2 */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-sans font-bold text-slate-500 mb-0.5">
                        <span>下2 (Out 2)</span>
                        {draft.clock_out_2?.confidence !== undefined && draft.clock_out_2.value && (
                          <span
                            className={
                              draft.clock_out_2.confidence < 0.65
                                ? 'text-rose-600 font-extrabold'
                                : draft.clock_out_2.confidence < 0.85
                                ? 'text-amber-600 font-extrabold'
                                : 'text-emerald-600'
                            }
                          >
                            {Math.round(draft.clock_out_2.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="未填"
                        value={draft.clock_out_2?.value || ''}
                        onChange={(e) => handleTimeChange(draft.date, 'clock_out_2', e.target.value)}
                        className={`w-full px-2.5 py-1.5 rounded-xl border text-center transition ${getConfidenceFieldStyle(
                          draft.clock_out_2?.confidence,
                          !!draft.clock_out_2?.value
                        )}`}
                      />
                    </div>
                  </div>

                  {/* Rule Validation Warning Messages */}
                  {res.issues.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {res.issues.map((issue, idx) => (
                        <div
                          key={idx}
                          className={`text-xs p-2 rounded-xl flex items-center gap-1.5 ${
                            issue.severity === 'error'
                              ? 'bg-rose-100/90 text-rose-950 font-extrabold border border-rose-200'
                              : issue.severity === 'warning'
                              ? 'bg-amber-100/90 text-amber-950 font-bold border border-amber-200'
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
            })
          )}
        </div>

        {/* Footer Action Buttons */}
        <div className="bg-white border-t border-slate-200 p-4 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            黃色標示: 可信度 &lt; 85% · 紅色標示: 可信度 &lt; 65% (需人工對照)
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
            >
              取消/返回
            </button>
            <button
              onClick={handleFinalApprove}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md active:scale-95 transition flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" /> 一鍵完成二次核對（轉入正式工時）
            </button>
          </div>
        </div>
      </div>

      {/* Sub-modal: View Original Formal Record */}
      {viewingOriginalRecord && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-5 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-purple-600" />
                <span>原正式紀錄詳情 ({viewingOriginalRecord.workDate})</span>
              </h3>
              <button
                onClick={() => setViewingOriginalRecord(null)}
                className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 border border-slate-200 text-xs font-mono">
              <div className="flex justify-between font-extrabold text-slate-800">
                <span>紀錄 ID:</span>
                <span>{viewingOriginalRecord.original.record_id}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>第 1 段上下班:</span>
                <span>
                  {viewingOriginalRecord.original.clock_in_1 || '--'} ~ {viewingOriginalRecord.original.clock_out_1 || '--'}
                </span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>第 2 段上下班:</span>
                <span>
                  {viewingOriginalRecord.original.clock_in_2 || '--'} ~ {viewingOriginalRecord.original.clock_out_2 || '--'}
                </span>
              </div>
              <div className="flex justify-between font-bold text-emerald-800 pt-1 border-t border-slate-200">
                <span>當日總分鐘:</span>
                <span>{viewingOriginalRecord.original.total_minutes} 分鐘 ({formatMinutesToHoursAndMinutes(viewingOriginalRecord.original.total_minutes)})</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>來源與狀態:</span>
                <span>{viewingOriginalRecord.original.source} · {viewingOriginalRecord.original.verification_status}</span>
              </div>
            </div>

            <button
              onClick={() => setViewingOriginalRecord(null)}
              className="w-full py-2 bg-slate-900 text-white font-bold text-xs rounded-xl"
            >
              關閉
            </button>
          </div>
        </div>
      )}

      {/* Sub-modal: Compare Original vs. AI Draft Side-by-Side */}
      {comparingRecord && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl p-5 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                <GitCompare className="w-4 h-4 text-purple-600" />
                <span>工時資料對比 ({comparingRecord.workDate})</span>
              </h3>
              <button
                onClick={() => setComparingRecord(null)}
                className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              {/* Left Column: Existing Formal Record */}
              <div className="bg-slate-100 rounded-xl p-3 border border-slate-300 space-y-2">
                <div className="font-extrabold text-slate-800 text-center pb-1 border-b border-slate-200">
                  原正式工時紀錄
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">上1 / 下1:</span>
                  <span className="font-bold text-slate-900">
                    {comparingRecord.original.clock_in_1 || '--'} ~ {comparingRecord.original.clock_out_1 || '--'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">上2 / 下2:</span>
                  <span className="font-bold text-slate-900">
                    {comparingRecord.original.clock_in_2 || '--'} ~ {comparingRecord.original.clock_out_2 || '--'}
                  </span>
                </div>
                <div className="pt-1 border-t border-slate-200 font-extrabold text-emerald-700">
                  總工時: {formatMinutesToHoursAndMinutes(comparingRecord.original.total_minutes)}
                </div>
              </div>

              {/* Right Column: AI Draft Record */}
              <div className="bg-purple-50 rounded-xl p-3 border border-purple-200 space-y-2">
                <div className="font-extrabold text-purple-900 text-center pb-1 border-b border-purple-200">
                  ✨ AI 辨識草稿
                </div>
                <div>
                  <span className="text-[10px] text-purple-700 block">上1 / 下1:</span>
                  <span className="font-bold text-purple-950">
                    {comparingRecord.draft.clock_in_1?.value || '--'} ~ {comparingRecord.draft.clock_out_1?.value || '--'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-purple-700 block">上2 / 下2:</span>
                  <span className="font-bold text-purple-950">
                    {comparingRecord.draft.clock_in_2?.value || '--'} ~ {comparingRecord.draft.clock_out_2?.value || '--'}
                  </span>
                </div>
                <div className="pt-1 border-t border-purple-200 font-extrabold text-purple-900">
                  估算工時: {formatMinutesToHoursAndMinutes(validateDailyRecord(comparingRecord.draft, timecard.yearMonth, timecard.employeeId, existingDailyRecords).calculatedMinutes)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  setDecisionForDay(comparingRecord.workDate, 'skip');
                  setComparingRecord(null);
                }}
                className="flex-1 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 hover:bg-slate-200"
              >
                保留原正式紀錄 (取消匯入)
              </button>
              <button
                onClick={() => {
                  setDecisionForDay(comparingRecord.workDate, 'overwrite');
                  setComparingRecord(null);
                }}
                className="flex-1 py-2 bg-purple-600 text-white font-bold text-xs rounded-xl shadow-xs hover:bg-purple-700"
              >
                用 AI 草稿覆蓋原紀錄
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
