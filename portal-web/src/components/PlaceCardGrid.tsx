"use client";

import React, { useMemo, useState } from 'react';
import { Compass, Sparkles, Film, Filter, Calendar, Tag, X } from 'lucide-react';
import PlaceCard from './PlaceCard';
import { getDaysSummary, getUniqueTags } from '@/lib/places';
import type { EnrichedPlace } from '@/types/itinerary';

interface PlaceCardGridProps {
  places: EnrichedPlace[];
  onSelectPlace: (place: EnrichedPlace) => void;
  selectedDay?: number | 'all';
  onSelectDay?: (day: number | 'all') => void;
  activeCategory?: string;
  setActiveCategory?: (category: string) => void;
  activeTag?: string | null;
  setActiveTag?: (tag: string | null) => void;
}

const CATEGORY_OPTIONS = [
  { id: 'all', label: '全部分類' },
  { id: 'spot', label: '景點' },
  { id: 'food', label: '美食' },
  { id: 'stay', label: '住宿' },
  { id: 'transit', label: '交通' },
  { id: 'other', label: '未分類' }
];

export default function PlaceCardGrid({
  places,
  onSelectPlace,
  selectedDay: controlledDay,
  onSelectDay: setControlledDay,
  activeCategory: controlledCategory,
  setActiveCategory: setControlledCategory,
  activeTag: controlledTag,
  setActiveTag: setControlledTag
}: PlaceCardGridProps) {
  // 內部或受控的天數狀態
  const [internalDay, setInternalDay] = useState<number | 'all'>('all');
  const activeDay = controlledDay !== undefined ? controlledDay : internalDay;
  const setActiveDay = (day: number | 'all') => {
    if (setControlledDay) {
      setControlledDay(day);
    } else {
      setInternalDay(day);
    }
  };

  // 內部或受控的分類與標籤狀態
  const [internalCategory, setInternalCategory] = useState<string>('all');
  const activeCategory = controlledCategory !== undefined ? controlledCategory : internalCategory;
  const setActiveCategory = (category: string) => {
    if (setControlledCategory) {
      setControlledCategory(category);
    } else {
      setInternalCategory(category);
    }
  };

  const [internalTag, setInternalTag] = useState<string | null>(null);
  const activeTag = controlledTag !== undefined ? controlledTag : internalTag;
  const setActiveTag = (tag: string | null) => {
    if (setControlledTag) {
      setControlledTag(tag);
    } else {
      setInternalTag(tag);
    }
  };

  // 計算所有天數摘要 (Day 1 ~ Day N)
  const daysSummary = useMemo(() => {
    return getDaysSummary(places);
  }, [places]);

  // 取得所有唯一標籤
  const popularTags = useMemo(() => {
    return getUniqueTags(places).slice(0, 10); // 取前 10 個熱門標籤
  }, [places]);

  const highlightCount = useMemo(() => {
    return places.filter(p => p.isHighlight).length;
  }, [places]);

  const videoCount = useMemo(() => {
    return places.filter(p => p.media.some(m => m.type === 'youtube')).length;
  }, [places]);

  // 三軸複合過濾：天數 + 分類 + 標籤
  const filteredPlaces = useMemo(() => {
    return places.filter(place => {
      // 1. 天數過濾
      if (activeDay !== 'all' && place.dayNumber !== activeDay) {
        return false;
      }
      // 2. 分類過濾
      if (activeCategory !== 'all' && place.category !== activeCategory) {
        return false;
      }
      // 3. 標籤過濾
      if (activeTag && (!place.tags || !place.tags.includes(activeTag))) {
        return false;
      }
      return true;
    });
  }, [places, activeDay, activeCategory, activeTag]);

  const resetFilters = () => {
    setActiveDay('all');
    setActiveCategory('all');
    setActiveTag(null);
  };

  const hasActiveFilters = activeDay !== 'all' || activeCategory !== 'all' || activeTag !== null;

  return (
    <section className="w-full h-full overflow-y-auto bg-zinc-50/70 py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 頂部景點清單資訊看板 */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-200 pb-5">
          <div>
            <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm mb-1">
              <Compass size={18} />
              <span>Itinerary Highlights</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">
              探索旅程景點
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 mt-1">
              點擊任一卡片可即時切換至地圖模式並聚焦定位。
            </p>
          </div>

          {/* 統計與排序標記 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
              <Sparkles size={12} className="text-amber-500" />
              精選推薦 ({highlightCount})
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
              <Film size={12} className="text-blue-500" />
              影音節點 ({videoCount})
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white text-zinc-700 border border-zinc-200 shadow-2xs">
              顯示結果 ({filteredPlaces.length} / {places.length})
            </span>
          </div>
        </div>

        {/* 第 1 軸：多天數章節導覽列 (Multi-Day Chapter Tabs) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar size={14} className="text-blue-600" />
              行程天數章節
            </span>
            {activeDay !== 'all' && (
              <button
                type="button"
                onClick={() => setActiveDay('all')}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
              >
                查看全部天數
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveDay('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                activeDay === 'all'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              全部天數 ({places.length})
            </button>
            {daysSummary.map((day) => (
              <button
                key={day.day}
                type="button"
                onClick={() => setActiveDay(day.day)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                  activeDay === day.day
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                <span>{day.title}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeDay === day.day ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-500'
                }`}>
                  {day.placeCount}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 第 2 軸：分類過濾與主題標籤 (Categories & Tags) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-zinc-200/80 shadow-2xs">
          {/* 分類按鈕 */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <Filter size={15} className="text-zinc-400 mr-1 shrink-0" />
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* 熱門標籤雲 */}
          {popularTags.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 scrollbar-none">
              <Tag size={13} className="text-zinc-400 shrink-0" />
              {popularTags.map(({ tag }) => {
                const isSelected = activeTag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setActiveTag(isSelected ? null : tag)}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                        : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100 border border-zinc-200/60'
                    }`}
                  >
                    <span>#{tag}</span>
                    {isSelected && <X size={10} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 卡片網格 Grid */}
        {filteredPlaces.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredPlaces.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                onSelect={onSelectPlace}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-zinc-200/80 p-8 shadow-2xs">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 shadow-inner-xs">
              <Compass size={28} />
            </div>
            <h3 className="text-lg font-bold text-zinc-900">尚無符合條件的景點</h3>
            <p className="text-sm text-zinc-500 mt-1 max-w-md">
              {activeDay !== 'all' ? `Day ${activeDay} ` : ''}
              {activeCategory !== 'all' ? `在「${CATEGORY_OPTIONS.find(c => c.id === activeCategory)?.label}」` : ''}
              {activeTag ? `標籤 #${activeTag} ` : ''}
              下目前沒有景點，請嘗試切換其他天數或分類。
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-6 px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-500 transition shadow-xs cursor-pointer active:scale-95"
              >
                清除所有篩選條件
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
