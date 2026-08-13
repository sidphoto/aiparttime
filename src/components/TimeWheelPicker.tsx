import React, { useState, useEffect, useRef } from 'react';
import { Clock, ChevronUp, ChevronDown, Check, X, Sparkles } from 'lucide-react';

interface TimeWheelPickerProps {
  value: string; // "HH:mm" e.g. "09:00"
  onChange: (newValue: string) => void;
  label?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  theme?: 'dark' | 'light';
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

// Popular quick time presets for workplace shifts
const QUICK_TIME_PRESETS = [
  { label: '08:00', val: '08:00' },
  { label: '09:00', val: '09:00' },
  { label: '12:00', val: '12:00' },
  { label: '13:00', val: '13:00' },
  { label: '17:00', val: '17:00' },
  { label: '18:00', val: '18:00' },
  { label: '21:30', val: '21:30' },
  { label: '22:00', val: '22:00' },
  { label: '23:00', val: '23:00' },
  { label: '00:00', val: '00:00' },
];

export const TimeWheelPicker: React.FC<TimeWheelPickerProps> = ({
  value,
  onChange,
  label,
  className = '',
  placeholder = '選擇時間',
  disabled = false,
  theme = 'auto',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Parse current value
  const parseTime = (valStr: string) => {
    if (!valStr || !valStr.includes(':')) {
      return { h: '09', m: '00' };
    }
    const parts = valStr.split(':');
    const h = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    return {
      h: HOURS.includes(h) ? h : '09',
      m: MINUTES.includes(m) ? m : '00',
    };
  };

  const initialTime = parseTime(value);
  const [selectedHour, setSelectedHour] = useState<string>(initialTime.h);
  const [selectedMinute, setSelectedMinute] = useState<string>(initialTime.m);

  // Sync internal state when prop value changes
  useEffect(() => {
    const parsed = parseTime(value);
    setSelectedHour(parsed.h);
    setSelectedMinute(parsed.m);
  }, [value]);

  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  // Auto scroll columns to selected item when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        scrollToSelected('hour', selectedHour);
        scrollToSelected('minute', selectedMinute);
      }, 50);
    }
  }, [isOpen]);

  const scrollToSelected = (type: 'hour' | 'minute', val: string) => {
    const container = type === 'hour' ? hourListRef.current : minuteListRef.current;
    if (!container) return;
    const index = type === 'hour' ? HOURS.indexOf(val) : MINUTES.indexOf(val);
    if (index !== -1) {
      const itemHeight = 44; // height of each wheel item
      container.scrollTo({
        top: index * itemHeight,
        behavior: 'smooth',
      });
    }
  };

  const handleScroll = (type: 'hour' | 'minute') => {
    const container = type === 'hour' ? hourListRef.current : minuteListRef.current;
    if (!container) return;
    const itemHeight = 44;
    const scrollTop = container.scrollTop;
    const index = Math.round(scrollTop / itemHeight);

    if (type === 'hour') {
      const clampedIndex = Math.max(0, Math.min(HOURS.length - 1, index));
      if (HOURS[clampedIndex] !== selectedHour) {
        setSelectedHour(HOURS[clampedIndex]);
      }
    } else {
      const clampedIndex = Math.max(0, Math.min(MINUTES.length - 1, index));
      if (MINUTES[clampedIndex] !== selectedMinute) {
        setSelectedMinute(MINUTES[clampedIndex]);
      }
    }
  };

  const adjustValue = (type: 'hour' | 'minute', delta: number) => {
    if (type === 'hour') {
      const currIdx = HOURS.indexOf(selectedHour);
      const nextIdx = (currIdx + delta + 24) % 24;
      const nextVal = HOURS[nextIdx];
      setSelectedHour(nextVal);
      scrollToSelected('hour', nextVal);
    } else {
      const currIdx = MINUTES.indexOf(selectedMinute);
      const nextIdx = (currIdx + delta + 60) % 60;
      const nextVal = MINUTES[nextIdx];
      setSelectedMinute(nextVal);
      scrollToSelected('minute', nextVal);
    }
  };

  const handleApplyPreset = (presetVal: string) => {
    const parsed = parseTime(presetVal);
    setSelectedHour(parsed.h);
    setSelectedMinute(parsed.m);
    scrollToSelected('hour', parsed.h);
    scrollToSelected('minute', parsed.m);
  };

  const handleConfirm = () => {
    const formatted = `${selectedHour}:${selectedMinute}`;
    onChange(formatted);
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block w-full ${className}`}>
      {label && (
        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1 mb-1.5">
          <Clock className="w-3.5 h-3.5 text-blue-400" />
          <span>{label}</span>
        </label>
      )}

      {/* Trigger Field */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen(true);
        }}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left group ${
          disabled
            ? 'bg-slate-800/50 border-slate-700/50 text-slate-500 cursor-not-allowed'
            : 'bg-slate-800 border-slate-700 hover:border-blue-500 text-white shadow-xs active:scale-[0.99]'
        }`}
      >
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-blue-400 group-hover:scale-110 transition" />
          <span className="font-mono text-base font-bold tracking-wider">
            {value || placeholder}
          </span>
        </div>
        <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-500/20 text-blue-300 rounded-md border border-blue-500/30">
          撥盤選擇
        </span>
      </button>

      {/* Wheel Picker Popover Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
          <div
            className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-xl">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">時間上下撥盤選擇器</h3>
                  <p className="text-[11px] text-slate-400">上下滑動或拉滾輪選擇時、分</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 space-y-4">
              {/* Live Preview Display */}
              <div className="bg-slate-800/80 border border-blue-500/30 rounded-2xl p-3 text-center shadow-inner">
                <span className="text-xs text-slate-400 block mb-0.5 font-medium">當前已選擇時間</span>
                <span className="text-3xl font-black font-mono tracking-widest text-blue-400">
                  {selectedHour} : {selectedMinute}
                </span>
              </div>

              {/* Dial Wheel Picker Box */}
              <div className="relative bg-slate-950 border border-slate-800 rounded-2xl p-2 overflow-hidden shadow-2xl select-none">
                {/* Active Selection Highlight Bar (Middle Zone) */}
                <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-[44px] bg-blue-600/20 border-y-2 border-blue-500/80 rounded-xl pointer-events-none z-0 flex items-center justify-center">
                  <span className="text-blue-400 font-extrabold text-lg tracking-widest font-mono">
                    :
                  </span>
                </div>

                {/* Dial Columns Grid */}
                <div className="grid grid-cols-2 gap-4 relative z-10">
                  {/* Hours Column */}
                  <div className="flex flex-col items-center">
                    <div className="flex items-center justify-between w-full px-2 mb-1">
                      <span className="text-xs font-bold text-slate-400">時 (00 - 23)</span>
                      <div className="flex space-x-1">
                        <button
                          type="button"
                          onClick={() => adjustValue('hour', -1)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          title="往前1小時"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustValue('hour', 1)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          title="往後1小時"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div
                      ref={hourListRef}
                      onScroll={() => handleScroll('hour')}
                      className="h-[220px] w-full overflow-y-auto snap-y snap-mandatory scrollbar-none py-[88px] space-y-0"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                      {HOURS.map((h) => {
                        const isSelected = h === selectedHour;
                        return (
                          <div
                            key={h}
                            onClick={() => {
                              setSelectedHour(h);
                              scrollToSelected('hour', h);
                            }}
                            className={`h-[44px] flex items-center justify-center snap-center cursor-pointer transition-all duration-150 ${
                              isSelected
                                ? 'text-blue-400 font-black text-2xl scale-110'
                                : 'text-slate-500 font-bold text-base hover:text-slate-300 opacity-60'
                            }`}
                          >
                            <span className="font-mono">{h} 時</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Minutes Column */}
                  <div className="flex flex-col items-center">
                    <div className="flex items-center justify-between w-full px-2 mb-1">
                      <span className="text-xs font-bold text-slate-400">分 (00 - 59)</span>
                      <div className="flex space-x-1">
                        <button
                          type="button"
                          onClick={() => adjustValue('minute', -5)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          title="減5分鐘"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustValue('minute', 5)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          title="加5分鐘"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div
                      ref={minuteListRef}
                      onScroll={() => handleScroll('minute')}
                      className="h-[220px] w-full overflow-y-auto snap-y snap-mandatory scrollbar-none py-[88px] space-y-0"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                      {MINUTES.map((m) => {
                        const isSelected = m === selectedMinute;
                        return (
                          <div
                            key={m}
                            onClick={() => {
                              setSelectedMinute(m);
                              scrollToSelected('minute', m);
                            }}
                            className={`h-[44px] flex items-center justify-center snap-center cursor-pointer transition-all duration-150 ${
                              isSelected
                                ? 'text-blue-400 font-black text-2xl scale-110'
                                : 'text-slate-500 font-bold text-base hover:text-slate-300 opacity-60'
                            }`}
                          >
                            <span className="font-mono">{m} 分</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Minute Jumps */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1.5">
                  分鐘快速微調：
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {['00', '15', '30', '45'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setSelectedMinute(m);
                        scrollToSelected('minute', m);
                      }}
                      className={`py-1 text-xs font-bold font-mono rounded-lg border transition ${
                        selectedMinute === m
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      }`}
                    >
                      :{m} 分
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Shift Presets Bar */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mb-1.5">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>常用上下班時間快選：</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_TIME_PRESETS.map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => handleApplyPreset(preset.val)}
                      className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border transition ${
                        selectedHour === preset.val.split(':')[0] &&
                        selectedMinute === preset.val.split(':')[1]
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-5 py-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center space-x-1.5 active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>套用時間 ({selectedHour}:{selectedMinute})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
