"use client";

import React from 'react';
import { AlertCircle, X, ChevronRight, MapPin, Clock } from 'lucide-react';
import { CMSVisit } from '@/lib/cms/types';

interface RequiredIssuesModalProps {
  visits: CMSVisit[];
  onSelectVisit: (visitId: string, dayNumber: number) => void;
  onClose: () => void;
}

export default function RequiredIssuesModal({
  visits,
  onSelectVisit,
  onClose
}: RequiredIssuesModalProps) {
  const visitsWithIssues = visits.filter(v => v.issues && v.issues.length > 0);
  const totalIssuesCount = visitsWithIssues.reduce((acc, v) => acc + v.issues.length, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 bg-amber-50/60">
          <div className="flex items-center gap-2 text-amber-900">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="font-bold text-sm sm:text-base">全行程待處理問題清單</h3>
              <p className="text-xs text-amber-700">共 {totalIssuesCount} 個待裁決項目（點擊直接前往審核）</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Issues List */}
        <div className="p-4 overflow-y-auto space-y-3">
          {visitsWithIssues.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-sm">
              🎉 太棒了！全行程沒有任何待處理的異常問題。
            </div>
          ) : (
            visitsWithIssues.map(visit => (
              <div key={visit.id} className="space-y-2">
                {visit.issues.map(issue => (
                  <div
                    key={issue.id}
                    onClick={() => {
                      onSelectVisit(visit.id, visit.dayNumber);
                      onClose();
                    }}
                    className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 hover:bg-amber-100/60 transition-colors cursor-pointer group flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-amber-800 font-semibold">
                        <span className="px-2 py-0.5 rounded-md bg-amber-200/80 text-[10px]">
                          Day {visit.dayNumber}
                        </span>
                        <span className="truncate">{visit.title}</span>
                      </div>
                      <p className="text-xs text-zinc-800 font-medium">{issue.message}</p>
                      {issue.recommendation && (
                        <p className="text-[11px] text-zinc-500">
                          建議：{issue.recommendation}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-amber-600 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
