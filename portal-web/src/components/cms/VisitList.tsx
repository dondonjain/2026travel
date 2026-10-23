"use client";

import React from 'react';
import {
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ChevronRight,
  Layers
} from 'lucide-react';
import { CMSVisit } from '@/lib/cms/types';

interface VisitListProps {
  visits: CMSVisit[];
  selectedVisitId: string | null;
  onSelectVisit: (visitId: string) => void;
  dayLabel?: string;
}

export default function VisitList({
  visits,
  selectedVisitId,
  onSelectVisit,
  dayLabel
}: VisitListProps) {
  if (visits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-zinc-400">
        <MapPin className="w-10 h-10 mb-2 opacity-30" />
        <p className="text-sm">本日無造訪行程</p>
      </div>
    );
  }

  const categoryColors: Record<string, string> = {
    '交通': 'bg-sky-50 text-sky-700 border-sky-200',
    '購物': 'bg-rose-50 text-rose-700 border-rose-200',
    '美食': 'bg-amber-50 text-amber-700 border-amber-200',
    '住宿': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    '景點': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    '休歇': 'bg-teal-50 text-teal-700 border-teal-200'
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50/50">
      {/* List Header */}
      <div className="px-4 py-3 bg-white border-b border-zinc-200 shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-zinc-900">
            {dayLabel || '造訪景點清單'}
          </h2>
          <p className="text-xs text-zinc-500">
            共 {visits.length} 個站點 • {visits.filter(v => v.reviewStatus === 'confirmed').length} 已確認
          </p>
        </div>
      </div>

      {/* Cards Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {visits.map((visit, idx) => {
          const isSelected = selectedVisitId === visit.id;
          const isConfirmed = visit.reviewStatus === 'confirmed';
          const isPrivate = visit.visibility === 'private';
          const hasIssues = visit.issues && visit.issues.length > 0;
          const catClass = categoryColors[visit.placeCategory] || 'bg-zinc-100 text-zinc-700 border-zinc-200';

          return (
            <div
              role="button"
              tabIndex={0}
              key={visit.id}
              onClick={() => onSelectVisit(visit.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectVisit(visit.id);
                }
              }}
              className={`group relative w-full block p-3.5 rounded-xl border transition-all cursor-pointer bg-white text-left select-none ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-500/15 shadow-sm'
                  : 'border-zinc-200/90 hover:border-zinc-300 hover:shadow-xs'
              }`}
            >
              {/* Top row: Time & Badges */}
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
                  <span className="w-5 h-5 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] text-zinc-500 font-bold shrink-0">
                    {idx + 1}
                  </span>
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{visit.startTime} – {visit.endTime}</span>
                  <span className="text-[11px] text-zinc-400 font-normal">({visit.durationMinutes}分)</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Visibility Badge */}
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                    isPrivate
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : 'bg-zinc-50 text-zinc-600 border-zinc-200'
                  }`}>
                    {isPrivate ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                    <span>{isPrivate ? '私密' : '公開'}</span>
                  </span>

                  {/* Review Status Badge */}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    isConfirmed
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {isConfirmed && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                    <span>{isConfirmed ? '已確認' : '待確認'}</span>
                  </span>
                </div>
              </div>

              {/* Title & Category */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className={`text-sm font-semibold truncate ${isSelected ? 'text-blue-700' : 'text-zinc-900 group-hover:text-blue-600'}`}>
                    {visit.title}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-500 truncate">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${catClass}`}>
                      {visit.placeCategory}
                    </span>
                    <span className="truncate">{visit.placeName}</span>
                  </div>
                </div>

                <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? 'text-blue-600 translate-x-0.5' : 'text-zinc-300 group-hover:text-zinc-400'}`} />
              </div>

              {/* Flattened Sub-venues note if any */}
              {visit.subVenues && visit.subVenues.length > 0 && (
                <div className="mt-2 pt-2 border-t border-dashed border-zinc-100 flex items-center gap-1 text-[11px] text-zinc-500">
                  <Layers className="w-3 h-3 text-zinc-400" />
                  <span>包含 {visit.subVenues.length} 個內部店家（已自動壓平）</span>
                </div>
              )}

              {/* Issues Alert Indicator */}
              {hasIssues && (
                <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-amber-50/90 border border-amber-200 text-amber-800 text-xs flex items-center gap-1.5 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="truncate">{visit.issues[0].message}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
