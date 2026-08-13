import React, { useState } from 'react';
import { X, Copy, Check, MessageSquare, Share2 } from 'lucide-react';
import { StoreSummary } from '../types';
import { generateLineReportText } from '../utils/export';

interface LineReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: StoreSummary;
  storeName: string;
}

export const LineReportModal: React.FC<LineReportModalProps> = ({
  isOpen,
  onClose,
  summary,
  storeName,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const reportText = generateLineReportText(summary, storeName);

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <MessageSquare className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white">複製 LINE 門市群組通報訊息</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Preview */}
        <div className="p-5 overflow-y-auto space-y-3">
          <p className="text-xs text-slate-400">
            已將「{summary.periodLabel}」的時數與薪資自動整理為文字格式，點擊下方按鈕即可一鍵複製並發送至 LINE 工作群組供同仁核對。
          </p>

          <div className="relative bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap select-all max-h-80 overflow-y-auto">
            {reportText}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Share2 className="w-3.5 h-3.5" />
            <span>支援 LINE, WeChat, Messenger, 短訊</span>
          </span>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
            >
              關閉
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-1.5 shadow-lg transition active:scale-95 ${
                copied
                  ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>已複製到剪貼簿！</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>一鍵複製通報文字</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
