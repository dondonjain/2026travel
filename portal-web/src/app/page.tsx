"use client";

import React, { useState, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Map as MapIcon, LayoutGrid, MapPin, Loader2 } from 'lucide-react';
import TrajectoryMap from '@/components/Map';
import PlaceCardGrid from '@/components/PlaceCardGrid';
import { fetchSupabaseEnrichedPlaces } from '@/lib/supabase-places';
import { fetchPublicTrajectory } from '@/lib/supabase-trajectory';
import type { PublicTrajectorySegment } from '@/lib/narrative-playback';
import type { EnrichedPlace } from '@/types/itinerary';

type ViewMode = 'map' | 'list';
const PUBLIC_TRIP_SLUG = process.env.NEXT_PUBLIC_TRIP_SLUG;

function TravelPortal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 讀取 URL 初值
  const initialMode = (searchParams.get('mode') as ViewMode) || 'map';
  const initialDayParam = searchParams.get('day');
  const initialDay = initialDayParam && initialDayParam !== 'all' ? parseInt(initialDayParam, 10) : 'all';
  const initialCategory = searchParams.get('category') || 'all';
  const initialTag = searchParams.get('tag') || null;

  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const [selectedPlace, setSelectedPlace] = useState<EnrichedPlace | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | 'all'>(isNaN(initialDay as number) ? 'all' : initialDay);
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);
  const [activeTag, setActiveTag] = useState<string | null>(initialTag);
  const [places, setPlaces] = useState<EnrichedPlace[]>([]);
  const [trajectorySegments, setTrajectorySegments] = useState<PublicTrajectorySegment[]>([]);
  const [placesLoading, setPlacesLoading] = useState(Boolean(PUBLIC_TRIP_SLUG));
  const [placesError, setPlacesError] = useState<string | null>(
    PUBLIC_TRIP_SLUG ? null : '尚未設定 NEXT_PUBLIC_TRIP_SLUG。'
  );

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    if (!PUBLIC_TRIP_SLUG) return () => controller.abort();

    Promise.all([
      fetchSupabaseEnrichedPlaces(PUBLIC_TRIP_SLUG, { signal: controller.signal }),
      fetchPublicTrajectory(PUBLIC_TRIP_SLUG, { signal: controller.signal })
    ])
      .then(([nextPlaces, nextSegments]) => {
        if (!isActive) return;
        setPlaces(nextPlaces);
        setTrajectorySegments(nextSegments);
        setPlacesError(null);
      })
      .catch((error: unknown) => {
        if (!isActive || (error instanceof DOMException && error.name === 'AbortError')) return;
        setPlacesError(error instanceof Error ? error.message : '公開行程資料載入失敗。');
      })
      .finally(() => {
        if (isActive) setPlacesLoading(false);
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  // 同步狀態至 URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (viewMode === 'map') {
      params.delete('mode');
    } else {
      params.set('mode', viewMode);
    }

    if (selectedDay === 'all') {
      params.delete('day');
    } else {
      params.set('day', selectedDay.toString());
    }

    if (activeCategory === 'all') {
      params.delete('category');
    } else {
      params.set('category', activeCategory);
    }

    if (!activeTag) {
      params.delete('tag');
    } else {
      params.set('tag', activeTag);
    }

    const currentSearch = searchParams.toString();
    const newSearch = params.toString();
    if (currentSearch !== newSearch) {
      const newUrl = newSearch ? `${pathname}?${newSearch}` : pathname;
      router.replace(newUrl, { scroll: false });
    }
  }, [viewMode, selectedDay, activeCategory, activeTag, pathname, router, searchParams]);

  // 從清單模式點擊景點卡片，跳轉至地圖模式並聚焦定位
  const handleSelectPlace = useCallback((place: EnrichedPlace) => {
    if (!place.coordinates) return;
    setSelectedPlace(place);
    if (place.dayNumber) {
      setSelectedDay(place.dayNumber);
    }
    setViewMode('map');
  }, []);

  const handleClearTarget = useCallback(() => {
    setSelectedPlace(null);
  }, []);

  return (
    <main className="w-screen h-screen overflow-hidden bg-zinc-50 flex flex-col relative font-sans">
      {/* 頂部導覽與模式切換列 */}
      <header className="w-full bg-white/90 backdrop-blur-md border-b border-zinc-200/80 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between z-30 shadow-2xs shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs shrink-0">
            <MapPin size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-bold text-zinc-900 leading-tight truncate">
              動態軌跡影音地圖
            </h1>
            <p className="text-xs text-zinc-500 hidden sm:block">
              Interactive Video Trajectory & Travel Portal
            </p>
          </div>
        </div>

        {/* 雙模式切換控制器 (Segmented Control) */}
        <nav className="inline-flex p-1 bg-zinc-100 rounded-xl border border-zinc-200/80 shadow-inner-xs shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('map')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
              viewMode === 'map'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <MapIcon size={14} />
            <span>地圖<span className="hidden sm:inline">模式</span></span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
              viewMode === 'list'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <LayoutGrid size={14} />
            <span className="hidden sm:inline">景點清單 ({places.length})</span>
            <span className="sm:hidden">清單 ({places.length})</span>
          </button>
        </nav>
      </header>

      {/* 雙模式主視窗容器 (DOM 保留，切換無需重新載入圖資) */}
      <div className="flex-1 w-full h-full relative overflow-hidden">
        {/* 地圖模式 */}
        <div className={`w-full h-full ${viewMode === 'map' ? 'block' : 'hidden'}`}>
          <TrajectoryMap
            places={places}
            trajectorySegments={trajectorySegments}
            targetPlace={selectedPlace}
            onClearTarget={handleClearTarget}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
        </div>

        {/* 景點清單模式 */}
        <div className={`w-full h-full ${viewMode === 'list' ? 'block' : 'hidden'}`}>
          {placesLoading ? (
            <div className="w-full h-full flex items-center justify-center bg-zinc-50 text-zinc-500 gap-2">
              <Loader2 className="animate-spin text-blue-500" size={24} />
              <span className="text-sm">載入公開行程資料…</span>
            </div>
          ) : placesError ? (
            <div className="w-full h-full flex items-center justify-center bg-zinc-50 px-6">
              <p className="max-w-lg text-center text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {placesError}
              </p>
            </div>
          ) : (
            <PlaceCardGrid
              places={places}
              onSelectPlace={handleSelectPlace}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              activeTag={activeTag}
              setActiveTag={setActiveTag}
            />
          )}
        </div>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="w-screen h-screen flex items-center justify-center bg-zinc-50">
          <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
      }
    >
      <TravelPortal />
    </Suspense>
  );
}
