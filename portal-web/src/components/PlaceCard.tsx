"use client";

import React from 'react';
import { Sparkles, Clock, MapPin, Video, Image as ImageIcon, ExternalLink } from 'lucide-react';
import OptimizedImage from './OptimizedImage';
import type { EnrichedPlace } from '@/types/itinerary';

interface PlaceCardProps {
  place: EnrichedPlace;
  onSelect: (place: EnrichedPlace) => void;
}

const categoryLabelMap: Record<string, string> = {
  spot: '景點',
  food: '美食',
  stay: '住宿',
  transit: '交通',
  other: '未分類'
};

export default function PlaceCard({ place, onSelect }: PlaceCardProps) {
  const hasVideo = place.media.some(m => m.type === 'youtube');
  const imageCount = place.media.filter(m => m.type === 'image').length;
  const canLocate = place.coordinates !== null;

  return (
    <div
      onClick={() => {
        if (canLocate) onSelect(place);
      }}
      aria-disabled={!canLocate}
      className={`group flex flex-col bg-white rounded-2xl border border-zinc-200/80 shadow-xs transition-all duration-300 overflow-hidden text-left ${
        canLocate
          ? 'hover:shadow-lg hover:-translate-y-1 cursor-pointer'
          : 'cursor-default'
      }`}
    >
      {/* 封面圖片區塊 */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-100">
        <OptimizedImage
          src={place.coverImageUrl}
          alt={place.title}
          className="group-hover:scale-105"
        />

        {/* 頂部浮動標籤列 */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-20">
          <div>
            {place.isHighlight && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/90 text-white backdrop-blur-xs shadow-xs">
                <Sparkles size={12} className="fill-white" />
                精選推薦
              </span>
            )}
          </div>

          <div>
            {place.category && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium backdrop-blur-xs shadow-xs ${
                place.category === 'other' ? 'bg-black/30 text-white/90' : 'bg-black/55 text-white'
              }`}>
                {categoryLabelMap[place.category] || place.category}
              </span>
            )}
          </div>
        </div>

        {/* 底部浮動影音標記 */}
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 pointer-events-none">
          {hasVideo && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-600/90 text-white backdrop-blur-xs shadow-xs">
              <Video size={11} />
              影音
            </span>
          )}
          {imageCount > 1 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-black/60 text-white backdrop-blur-xs shadow-xs">
              <ImageIcon size={11} />
              {imageCount}
            </span>
          )}
        </div>
      </div>

      {/* 內容文字區塊 */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* 時間記錄 */}
          {place.formattedTime && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium mb-1.5">
              <Clock size={12} className="text-zinc-400" />
              <span>{place.formattedTime}</span>
            </div>
          )}

          {/* 景點標題 */}
          <h3 className="font-bold text-zinc-900 text-base leading-snug group-hover:text-blue-600 transition line-clamp-1">
            {place.title}
          </h3>

          {/* 景點摘要心得 */}
          <p className="text-xs text-zinc-600 line-clamp-2 mt-1.5 leading-relaxed min-h-[2rem]">
            {place.description || '探索這趟旅程留下的美好足跡與動態回憶。'}
          </p>

          {/* 標籤雲 */}
          {place.tags && place.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {place.tags.slice(0, 3).map((tag, idx) => (
                <span
                  key={idx}
                  className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 group-hover:bg-blue-50 group-hover:text-blue-700 transition"
                >
                  #{tag}
                </span>
              ))}
              {place.tags.length > 3 && (
                <span className="text-[11px] font-medium px-1.5 py-0.5 text-zinc-400">
                  +{place.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 底部動作列 */}
        <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs">
          <span className="text-zinc-400 flex items-center gap-1">
            <MapPin size={12} />
            {canLocate ? '點擊查看地圖' : '位置未公開'}
          </span>
          {canLocate && (
            <span className="font-semibold text-blue-600 flex items-center gap-0.5 group-hover:translate-x-1 transition">
              定位視角
              <ExternalLink size={12} className="ml-0.5" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
