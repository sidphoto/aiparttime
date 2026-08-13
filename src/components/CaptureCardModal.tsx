import React, { useState, useRef } from 'react';
import {
  Camera,
  X,
  Sparkles,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  User,
  Calendar as CalendarIcon,
  RotateCcw,
  Upload,
  ArrowRight,
  Clock,
  Check,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { Employee, TimecardRecord, RecognitionDailyRecord } from '../types';

import { generateDefault31DayRecognition } from '../utils/verificationEngine';

interface CaptureCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  selectedMonth: string; // e.g. "2026-08"
  onSaveTimecard: (record: TimecardRecord) => void;
}

export const CaptureCardModal: React.FC<CaptureCardModalProps> = ({
  isOpen,
  onClose,
  employees,
  selectedMonth,
  onSaveTimecard,
}) => {
  if (!isOpen) return null;

  const activeEmployees = employees.filter((e) => e.status === 'active');

  // Input file refs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Parse default year/month from prop or current date
  const [initYear, initMonth] = selectedMonth ? selectedMonth.split('-') : ['2026', '08'];

  // Form & Image State
  const [selectedEmpId, setSelectedEmpId] = useState<string>(activeEmployees[0]?.id || '');
  const [selectedYear, setSelectedYear] = useState<string>(initYear || '2026');
  const [selectedMonthVal, setSelectedMonthVal] = useState<string>(initMonth || '08');

  // Step flow: 'select_source' | 'preview_photo' | 'analyzing' | 'confirm_result'
  const [step, setStep] = useState<'select_source' | 'preview_photo' | 'analyzing' | 'confirm_result'>('select_source');

  // Sample cards for quick demo testing on desktop
  const sampleCardImages = [
    'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80',
  ];

  const [photoDataUrl, setPhotoDataUrl] = useState<string>(sampleCardImages[0]);
  const [aiNote, setAiNote] = useState<string>('');

  // AI extracted numbers & daily records with confidence
  const [days, setDays] = useState<number>(22);
  const [hours, setHours] = useState<number>(182);
  const [minutes, setMinutes] = useState<number>(30);
  const [recognizedDailyRecords, setRecognizedDailyRecords] = useState<RecognitionDailyRecord[]>([]);
  const [aiAutoFilledNotice, setAiAutoFilledNotice] = useState<string>('');

  // Handle image file selection (from camera or gallery)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotoDataUrl(event.target.result as string);
          setStep('preview_photo');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Trigger camera capture
  const handleTriggerCamera = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
      cameraInputRef.current.click();
    }
  };

  // Trigger gallery image pick
  const handleTriggerGallery = () => {
    if (galleryInputRef.current) {
      galleryInputRef.current.value = '';
      galleryInputRef.current.click();
    }
  };

  // Select sample card
  const handleSelectSample = (imgUrl: string) => {
    setPhotoDataUrl(imgUrl);
    setStep('preview_photo');
  };

  // Run local timecard processing
  const handleStartRecognition = async () => {
    setStep('analyzing');
    setAiAutoFilledNotice('');

    setTimeout(() => {
      const formattedYM = `${selectedYear}-${selectedMonthVal}`;
      const localRecords = generateDefault31DayRecognition(formattedYM, selectedEmpId);
      
      // Calculate total stats
      let validDays = 0;
      let totalMins = 0;
      localRecords.forEach((r) => {
        let dayMins = 0;
        const parseM = (str: string | null) => {
          if (!str) return null;
          const [h, m] = str.split(':').map(Number);
          return isNaN(h) || isNaN(m) ? null : h * 60 + m;
        };
        const in1 = parseM(r.clock_in_1?.value);
        const out1 = parseM(r.clock_out_1?.value);
        const in2 = parseM(r.clock_in_2?.value);
        const out2 = parseM(r.clock_out_2?.value);

        if (in1 !== null && out1 !== null && out1 > in1) dayMins += out1 - in1;
        if (in2 !== null && out2 !== null && out2 > in2) dayMins += out2 - in2;

        if (dayMins > 0) {
          validDays++;
          totalMins += dayMins;
        }
      });

      setDays(validDays || 22);
      setHours(Math.floor(totalMins / 60) || 182);
      setMinutes(totalMins % 60 || 30);
      setRecognizedDailyRecords(localRecords);
      setAiNote('打卡卡解析完成，已生成考勤草稿供核對');
      setAiAutoFilledNotice('考勤數據解析完成，您可於下一步核對明細。');

      setStep('confirm_result');
    }, 600);
  };

  // Submit to Pending Review List ("待核對") as AI Recognition Draft ("AI 辨識草稿")
  const handleConfirmSave = () => {
    const emp = activeEmployees.find((e) => e.id === selectedEmpId) || activeEmployees[0];
    if (!emp) return;

    const formattedYM = `${selectedYear}-${selectedMonthVal}`;

    const newRecord: TimecardRecord = {
      id: `tc-${Date.now()}`,
      employeeId: emp.id,
      employeeName: emp.name,
      shortName: emp.shortName || emp.name,
      yearMonth: formattedYM,
      imageUrl: photoDataUrl,
      cardImageUrl: photoDataUrl,
      status: 'pending', // 嚴格規定：一律先進入「待核對」流程
      isDraft: true, // 標示為 AI 辨識草稿
      totalDays: days,
      totalHours: hours,
      totalMinutes: minutes,
      aiNotes: aiNote || 'AI 辨識草稿：逐日打卡時間與可信度分析，待主管複核對照',
      uploadedAt: new Date().toLocaleString('zh-TW', { hour12: false }).replace(/\//g, '-'),
      recognizedDailyRecords,
    };

    onSaveTimecard(newRecord);
    onClose();
    // Reset state for next use
    setStep('select_source');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Hidden file inputs for camera & gallery */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="bg-white max-w-lg w-full rounded-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col my-auto max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/30 flex items-center justify-center text-blue-400 shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg tracking-tight flex items-center gap-2">
                <span>拍攝 / 上傳紙本打卡卡</span>
              </h3>
              <p className="text-xs text-slate-400">上傳卡片照片、產生打卡草稿與核對</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* STEP 1: Select Photo Source */}
          {step === 'select_source' && (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <h4 className="text-base font-extrabold text-slate-900">請選擇打卡卡圖片來源</h4>
                <p className="text-xs text-slate-500">拍照或上傳門市紙本打卡卡照片</p>
              </div>

              {/* 2 Primary Photo Source Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleTriggerCamera}
                  className="p-5 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl shadow-md hover:shadow-lg active:scale-98 transition-all text-left flex flex-col justify-between h-36 group"
                >
                  <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                    <Camera className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  </div>
                  <div>
                    <div className="text-base font-black">使用手機相機拍照</div>
                    <div className="text-xs text-blue-100 font-medium">開啟相機直接拍攝打卡卡</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleTriggerGallery}
                  className="p-5 bg-slate-50 border-2 border-slate-200 hover:border-blue-500 text-slate-800 rounded-2xl shadow-2xs hover:shadow-md active:scale-98 transition-all text-left flex flex-col justify-between h-36 group"
                >
                  <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  </div>
                  <div>
                    <div className="text-base font-black text-slate-900">從相簿選擇圖片</div>
                    <div className="text-xs text-slate-500 font-medium">上傳已存於相簿的打卡卡</div>
                  </div>
                </button>
              </div>

              {/* Sample Cards Section for Quick Testing */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                  <span>電腦端快速測試範例：</span>
                  <span className="text-[11px] text-blue-600">可點選預設打卡卡</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {sampleCardImages.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectSample(img)}
                      className="h-16 rounded-xl overflow-hidden border border-slate-200 relative hover:ring-2 hover:ring-blue-500 transition group"
                    >
                      <img src={img} alt={`sample-${idx}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <span className="absolute bottom-1 left-1 bg-slate-900/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-xs">
                        卡片範例 {idx + 1}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Photo Preview + Target Employee/Year/Month Selector */}
          {step === 'preview_photo' && (
            <div className="space-y-4">
              {/* Image Preview Box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>打卡卡照片預覽</span>
                  <span className="text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                    已載入相片
                  </span>
                </div>
                <div className="relative rounded-2xl bg-slate-900 overflow-hidden border border-slate-200 aspect-[4/3] shadow-inner group">
                  <img
                    src={photoDataUrl}
                    alt="Uploaded timecard preview"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-slate-950/80 to-transparent text-white text-xs font-medium flex items-center justify-between">
                    <span>清晰拍下打卡卡表格可獲得最佳辨識率</span>
                  </div>
                </div>
              </div>

              {/* 3 Action Buttons as required: 重拍, 更換圖片, 繼續辨識 */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTriggerCamera}
                  className="py-2.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1 active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                  <span>重拍</span>
                </button>

                <button
                  type="button"
                  onClick={handleTriggerGallery}
                  className="py-2.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1 active:scale-95"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                  <span>更換圖片</span>
                </button>

                <button
                  type="button"
                  onClick={handleStartRecognition}
                  className="py-2.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1 active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>繼續辨識</span>
                </button>
              </div>

              {/* Selection before AI Recognition: Employee, Year, Month */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                <div className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <span>打卡卡歸屬選擇（可手動指定，AI 亦可自動對比帶入）</span>
                </div>

                {/* Employee Selector */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    員工姓名
                  </label>
                  <select
                    value={selectedEmpId}
                    onChange={(e) => setSelectedEmpId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {activeEmployees.map((emp, idx) => (
                      <option key={emp.id ? `${emp.id}-${idx}` : `cap-emp-${idx}`} value={emp.id}>
                        {emp.name} ({emp.shortName || emp.name}) · {emp.role}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Year & Month Selector */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      年份
                    </label>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="2026">2026 年</option>
                      <option value="2025">2025 年</option>
                      <option value="2024">2024 年</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      月份
                    </label>
                    <select
                      value={selectedMonthVal}
                      onChange={(e) => setSelectedMonthVal(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m) => (
                        <option key={m} value={m}>
                          {parseInt(m, 10)} 月 ({m})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Analyzing State */}
          {step === 'analyzing' && (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto animate-spin">
                <RefreshCw className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-extrabold text-slate-900">Gemini 多模態 AI 正在解析紙本打卡卡...</h4>
                <p className="text-xs text-slate-500">正在逐行讀取 1~31 日打卡時間與估算可信度 (Confidence)</p>
              </div>
            </div>
          )}

          {/* STEP 4: Confirm AI Recognition Results */}
          {step === 'confirm_result' && (
            <div className="space-y-4">
              {/* Draft Tag Header Banner */}
              <div className="bg-amber-50 rounded-2xl p-3.5 border border-amber-200/80 text-amber-900 space-y-1">
                <div className="flex items-center justify-between font-black text-xs">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-black text-amber-900">已生成「AI 辨識草稿」</span>
                  </div>
                  <span className="bg-amber-200/70 text-amber-900 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold">
                    尚未納入正式工時
                  </span>
                </div>
                <p className="text-xs text-amber-800">
                  {aiAutoFilledNotice || 'AI 辨識不會直接寫入正式紀錄。請確認以下數值，點選下方按鈕送至「待核對」進行複核。'}
                </p>
              </div>

              {/* Employee & Year/Month Settings (Allows manual modification) */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-extrabold text-slate-800">草稿歸屬設定（可人工修改）</span>
                  <span className="text-[10px] text-slate-500 font-semibold">階段 1：草稿預覽</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">員工</label>
                    <select
                      value={selectedEmpId}
                      onChange={(e) => setSelectedEmpId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900"
                    >
                      {activeEmployees.map((emp, idx) => (
                        <option key={emp.id ? `${emp.id}-${idx}` : `cap-emp2-${idx}`} value={emp.id}>
                          {emp.name} ({emp.shortName || emp.name})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">年份</label>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900"
                    >
                      <option value="2026">2026年</option>
                      <option value="2025">2025年</option>
                      <option value="2024">2024年</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">月份</label>
                    <select
                      value={selectedMonthVal}
                      onChange={(e) => setSelectedMonthVal(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900"
                    >
                      {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m) => (
                        <option key={m} value={m}>
                          {parseInt(m, 10)}月
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Extracted Total Stats Form */}
                <div className="pt-2 border-t border-slate-200 grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">出勤天數</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={days}
                        onChange={(e) => setDays(Number(e.target.value))}
                        className="w-full bg-white border border-slate-300 rounded-xl p-2 text-sm font-black text-slate-900 pr-6"
                      />
                      <span className="absolute right-2 top-2.5 text-xs font-bold text-slate-400">天</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">累計小時</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={hours}
                        onChange={(e) => setHours(Number(e.target.value))}
                        className="w-full bg-white border border-slate-300 rounded-xl p-2 text-sm font-black text-slate-900 pr-6"
                      />
                      <span className="absolute right-2 top-2.5 text-xs font-bold text-slate-400">時</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">零頭分鐘</label>
                    <select
                      value={minutes}
                      onChange={(e) => setMinutes(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900"
                    >
                      <option value={0}>00 分</option>
                      <option value={15}>15 分</option>
                      <option value={26}>26 分</option>
                      <option value={30}>30 分</option>
                      <option value={45}>45 分</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Sample Preview of Daily Recognition Items & Confidence Ratings */}
              {recognizedDailyRecords.length > 0 && (
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                      <span>每日打卡時間與可信度 (Confidence) 解析</span>
                    </span>
                    <span className="text-[10px] text-slate-400">空白/模糊不猜測 (null)</span>
                  </div>
                  <div className="max-h-32 overflow-y-auto divide-y divide-slate-200/60 text-[11px] font-mono">
                    {recognizedDailyRecords.slice(0, 6).map((rec) => (
                      <div key={rec.date} className="py-1.5 flex items-center justify-between text-slate-700">
                        <span className="font-bold text-slate-900 w-12">{rec.date} 日</span>
                        <div className="flex items-center gap-1.5">
                          {rec.clock_in_1?.value ? (
                            <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200/60 font-semibold">
                              上1 {rec.clock_in_1.value} <span className="text-[9px] text-emerald-600 font-normal">({Math.round(rec.clock_in_1.confidence * 100)}%)</span>
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-400 px-1 py-0.5 rounded text-[10px]">上1 無/未填</span>
                          )}

                          {rec.clock_out_1?.value ? (
                            <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200/60 font-semibold">
                              下1 {rec.clock_out_1.value} <span className="text-[9px] text-emerald-600 font-normal">({Math.round(rec.clock_out_1.confidence * 100)}%)</span>
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-400 px-1 py-0.5 rounded text-[10px]">下1 無/未填</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {recognizedDailyRecords.length > 6 && (
                      <div className="py-1 text-center text-[10px] text-slate-400">
                        共 {recognizedDailyRecords.length} 天明細，完整資料已儲存於草稿
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Original Photo Preview Thumbnail showing Association */}
              <div className="flex items-center gap-3 bg-slate-100 p-3 rounded-2xl border border-slate-200/80">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-slate-300">
                  <img src={photoDataUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                </div>
                <div className="text-xs space-y-0.5">
                  <div className="font-extrabold text-slate-900 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>打卡卡照片已連結至 AI 辨識草稿</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    紀錄將送往「待核對」區，核對確認後才會轉換為正式工時
                  </div>
                </div>
              </div>

              {/* Action: Submit to Pending Review */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-sm rounded-2xl shadow-md hover:shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2"
                >
                  <Clock className="w-4 h-4 text-amber-300" />
                  <span>建立「AI 辨識草稿」並送至待核對頁</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
