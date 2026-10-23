"use client";

import React, { useState, useEffect, use } from 'react';
import { useSearchParams, useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Play, AlertCircle, Loader2, Sparkles, MapPin } from 'lucide-react';
import TrajectoryMap from '@/components/Map';
import { fetchDraftPreview } from '@/lib/cms/cms-api';
import type { EnrichedPlace } from '@/types/itinerary';
import type { PublicTrajectorySegment } from '@/lib/narrative-playback';

export default function CMSDraftPreviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const tripSlug = (params?.tripSlug as string) || 'japan-2026-summer';

  const returnDay = searchParams.get('day') || '1';
  const returnVisitId = searchParams.get('selectedVisit') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [places, setPlaces] = useState<EnrichedPlace[]>([]);
  const [trajectorySegments, setTrajectorySegments] = useState<PublicTrajectorySegment[]>([]);
  const [isEligible, setIsEligible] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | 'all'>('all');
  const [selectedPlace, setSelectedPlace] = useState<EnrichedPlace | null>(null);

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    setLoading(true);
    fetchDraftPreview(tripSlug, { signal: controller.signal })
      .then((data) => {
        if (!isActive) return;
        if (data.error) {
          setError(data.error);
          setIsEligible(false);
          setPlaces([]);
          setTrajectorySegments([]);
        } else {
          setPlaces(data.places);
          setTrajectorySegments(data.trajectory);
          setIsEligible(data.isEligible);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!isActive) return;
        setError(err instanceof Error ? err.message : '載入草稿預覽失敗。');
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [tripSlug]);

  const returnUrl = `/cms?tripSlug=${encodeURIComponent(tripSlug)}&day=${encodeURIComponent(returnDay)}${
    returnVisitId ? `&selectedVisit=${encodeURIComponent(returnVisitId)}` : ''
  }`;

  if (loading) {
    return (
      <main className="w-screen h-screen flex flex-col items-center justify-center bg-zinc-900 text-white font-sans p-6">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
        <h2 className="text-base font-bold">正在載入草稿漫遊預覽 (Loading Draft Cruise)...</h2>
        <p className="text-xs text-zinc-400 mt-1">
          系統正在檢驗草稿行程之已確認景點與軌跡資料
        </p>
      </main>
    );
  }

  if (error || !isEligible || places.length === 0) {
    return (
      <main className="w-screen h-screen flex flex-col items-center justify-center bg-zinc-900 text-white font-sans p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-zinc-100">
          {error ? '載入預覽發生錯誤' : '尚未達到漫遊預覽門檻'}
        </h2>
        <p className="text-xs text-zinc-400 mt-2 max-w-md leading-relaxed">
          {error || '草稿巡航預覽條件：行程必須具備有效軌跡，且至少需審核確認 (Confirm) 1 處「公開 (Public)」景點。'}
        </p>
        <Link
          href={returnUrl}
          className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回後台審閱景點 (Back to CMS)</span>
        </Link>
      </main>
    );
  }

  return (
    <main className="w-screen h-screen overflow-hidden bg-zinc-950 relative font-sans">
      {/* 1. Floating Top Navigation Bar: Back to CMS + Status Badge */}
      <header className="fixed top-3 left-3 sm:top-4 sm:left-4 z-40 flex items-center gap-2 sm:gap-3 pointer-events-auto">
        <Link
          href={returnUrl}
          className="flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 bg-white/95 hover:bg-white text-zinc-900 rounded-xl shadow-xl border border-zinc-200/90 backdrop-blur-md text-xs sm:text-sm font-bold transition-all hover:scale-[1.02] cursor-pointer"
          title="返回審閱工作台，保留目前選取狀態"
        >
          <ArrowLeft className="w-4 h-4 text-blue-600" />
          <span>返回編輯後台</span>
        </Link>

        <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-zinc-900/90 text-white border border-zinc-700/80 rounded-xl shadow-lg backdrop-blur-md text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold">草稿巡航預覽模式</span>
          <span className="text-zinc-400 font-normal">| 已納入 {places.length} 個公開景點</span>
        </div>
      </header>

      {/* 2. Fullscreen Cruise Trajectory Map */}
      <div className="w-full h-full">
        <TrajectoryMap
          places={places}
          trajectorySegments={trajectorySegments}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          targetPlace={selectedPlace}
          onClearTarget={() => setSelectedPlace(null)}
        />
      </div>
    </main>
  );
}
