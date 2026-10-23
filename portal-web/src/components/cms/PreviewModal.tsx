"use client";

import React from 'react';
import Link from 'next/link';
import { Play, X, CheckCircle2, AlertCircle, Eye, EyeOff, MapPin } from 'lucide-react';
import { CMSVisit } from '@/lib/cms/types';

interface PreviewModalProps {
  visits: CMSVisit[];
  usableTrajectory: boolean;
  onClose: () => void;
  tripSlug?: string;
  selectedDay?: number | 'all';
  selectedVisitId?: string | null;
}

export default function PreviewModal({
  visits,
  usableTrajectory,
  onClose,
  tripSlug = 'japan-2026-summer',
  selectedDay = 1,
  selectedVisitId = null
}: PreviewModalProps) {
  const confirmedPublicVisits = visits.filter(v => v.reviewStatus === 'confirmed' && v.visibility === 'public');
  const confirmedPrivateVisits = visits.filter(v => v.reviewStatus === 'confirmed' && v.visibility === 'private');
  const pendingVisits = visits.filter(v => v.reviewStatus === 'pending');

  const isEligible = usableTrajectory && confirmedPublicVisits.length > 0;
  const previewUrl = `/cms/preview/${encodeURIComponent(tripSlug)}?day=${encodeURIComponent(selectedDay)}${
    selectedVisitId ? `&selectedVisit=${encodeURIComponent(selectedVisitId)}` : ''
  }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 bg-zinc-50">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
              <Play className="w-5 h-5 fill-blue-700" />
            </span>
            <h3 className="font-bold text-sm sm:text-base text-zinc-900">
              草稿巡航預覽 (Draft Cruise Preview)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Eligibility Alert Banner */}
          {isEligible ? (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-900 text-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">具備預覽資格 (Preview Ready)</span>
                <p className="mt-0.5 text-emerald-700">
                  系統已確認至少 1 處公開景點且軌跡正常，隨時可啟動地圖巡航播放。
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">尚未達到預覽門檻</span>
                <p className="mt-0.5 text-amber-700">
                  預覽條件：需有可用軌跡，且至少需確認 1 個「公開 (Public)」景點。
                </p>
              </div>
            </div>
          )}

          {/* Breakdown Stats */}
          <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-zinc-200/70">
              <span className="flex items-center gap-1.5 text-zinc-700 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>納入預覽景點 (已確認 + 公開)</span>
              </span>
              <span className="font-bold text-emerald-700 text-sm">{confirmedPublicVisits.length} 站</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-zinc-200/70 text-zinc-500">
              <span className="flex items-center gap-1.5">
                <EyeOff className="w-4 h-4 text-purple-500" />
                <span>排除私密景點 (已確認 + 私密)</span>
              </span>
              <span className="font-semibold text-zinc-600">{confirmedPrivateVisits.length} 站</span>
            </div>

            <div className="flex items-center justify-between py-1 text-zinc-500">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>排除待確認景點 (待確認)</span>
              </span>
              <span className="font-semibold text-zinc-600">{pendingVisits.length} 站</span>
            </div>
          </div>

          <p className="text-[11px] text-zinc-400 text-center">
            巡航預覽僅會播放已確認為公開的站點，讓您以讀者視角檢查動態地圖體驗。
          </p>

          {/* Actions */}
          <div className="pt-2 flex flex-col gap-2">
            {isEligible ? (
              <Link
                href={previewUrl}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-500/20 transition-colors"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>立即啟動巡航預覽 (Launch Cruise Preview)</span>
              </Link>
            ) : (
              <button
                disabled
                className="w-full py-3 px-4 bg-zinc-200 text-zinc-400 rounded-xl text-sm font-bold cursor-not-allowed text-center"
              >
                確認至少 1 個公開景點以解鎖預覽
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 text-xs font-semibold text-zinc-600 hover:text-zinc-800 transition-colors cursor-pointer"
            >
              返回後台編輯
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
