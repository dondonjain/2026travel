import React from 'react';
import { Play, Pause, SkipBack, SkipForward, X, Clapperboard, Sparkles } from 'lucide-react';
import type { DaySummary } from '@/types/itinerary';

export interface CruiseControllerProps {
  isCruising: boolean;
  isDwelling: boolean;
  isHoverPaused: boolean;
  dwellProgress: number; // 0 ~ 100
  currentStopIndex: number;
  totalStops: number;
  currentPlaceTitle: string;
  onStartCruise: () => void;
  onPauseResumeCruise: () => void;
  isPaused: boolean;
  onNextStop: () => void;
  onPrevStop: () => void;
  onExitCruise: () => void;
  days?: DaySummary[];
  selectedDay?: number | 'all';
  activeDay?: number | 'all';
  onSelectDay?: (day: number | 'all') => void;
}

export default function CruiseController({
  isCruising,
  isDwelling,
  isHoverPaused,
  dwellProgress,
  currentStopIndex,
  totalStops,
  currentPlaceTitle,
  onStartCruise,
  onPauseResumeCruise,
  isPaused,
  onNextStop,
  onPrevStop,
  onExitCruise,
  days = [],
  selectedDay = 'all',
  activeDay = selectedDay,
  onSelectDay
}: CruiseControllerProps) {
  // 未啟動巡航時，呈現精緻的「開始欣賞旅程」漂浮啟動膠囊
  if (!isCruising) {
    return (
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 animate-in fade-in zoom-in-95 duration-300">
        <button
          type="button"
          onClick={onStartCruise}
          className="group relative flex items-center gap-2 sm:gap-2.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl bg-zinc-900/90 hover:bg-zinc-900 text-white backdrop-blur-md shadow-xl border border-white/20 transition-all duration-300 hover:scale-[1.03] active:scale-95 cursor-pointer"
        >
          {/* 呼吸光暈背景 */}
          <span className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-60 blur-xs group-hover:opacity-100 transition duration-300 -z-10" />

          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-blue-500 flex items-center justify-center text-white shadow-xs shrink-0">
            <Clapperboard size={13} className="group-hover:rotate-6 transition duration-300" />
          </div>

          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold tracking-wide">開始欣賞旅程</span>
              <Sparkles size={11} className="text-amber-400 fill-amber-400 animate-pulse" />
            </div>
            <span className="text-[9px] sm:text-[10px] text-zinc-300">劇院級自動巡航・景點駐留導覽</span>
          </div>
        </button>
      </div>
    );
  }

  // 巡航進行中：顯示頂部中央劇院控制列
  return (
    <div className="absolute top-3 sm:top-4 left-1/2 -translate-x-1/2 z-20 w-[95%] sm:w-auto min-w-0 sm:min-w-[480px] max-w-2xl bg-zinc-950/90 text-white backdrop-blur-md rounded-2xl shadow-2xl border border-zinc-700/60 overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-top-4">
      {/* 上半部：狀態與章節資訊 */}
      <div className="px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-3 border-b border-zinc-800/80">
        {/* 左側：狀態指示燈 */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isDwelling ? (isHoverPaused ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-blue-400'
            }`} />
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
              isDwelling ? (isHoverPaused ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-blue-500'
            }`} />
          </span>

          <span className="text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-zinc-300">
            {isDwelling ? (
              isHoverPaused ? (
                <span className="text-amber-400">閱讀暫停中</span>
              ) : (
                <span className="text-emerald-400">景點停靠中</span>
              )
            ) : (
              <span className="text-blue-400">前進下一站</span>
            )}
          </span>
        </div>

        {/* 中間：天數章節選單與景點標題 */}
        <div className="flex-1 min-w-0 text-center px-1 flex flex-col items-center justify-center">
          {days.length > 0 && onSelectDay && (
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 max-w-full">
              <button
                type="button"
                onClick={() => onSelectDay('all')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition cursor-pointer shrink-0 ${
                  activeDay === 'all'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80'
                }`}
              >
                全覽
              </button>
              {days.map((d) => (
                <button
                  key={d.day}
                  type="button"
                  onClick={() => onSelectDay(d.day)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition cursor-pointer shrink-0 ${
                    activeDay === d.day
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80'
                  }`}
                  title={`${d.title} (${d.placeCount} 景點)`}
                >
                  D{d.day}
                </button>
              ))}
            </div>
          )}
          <div className="text-xs font-bold truncate text-zinc-100 max-w-full">
            <span className="text-zinc-400 font-normal mr-1.5">
              {totalStops > 0 ? `${currentStopIndex + 1} / ${totalStops}` : '0 / 0'}
            </span>
            {currentPlaceTitle || '旅程巡航'}
          </div>
        </div>

        {/* 右側：退出按鈕 */}
        <button
          type="button"
          onClick={onExitCruise}
          className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition shrink-0 cursor-pointer"
          title="結束劇院巡航模式"
        >
          <X size={16} />
        </button>
      </div>

      {/* 下半部：播放與章節導覽控制鍵 */}
      <div className="px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between gap-2 bg-zinc-900/60">
        <div className="text-[11px] text-zinc-400 hidden sm:block truncate max-w-[200px]">
          {isDwelling && (isHoverPaused ? '閱讀暫停中（移開滑鼠恢復）' : '滑鼠懸停故事卡可暫停倒數')}
        </div>
        <div className="text-[10px] text-zinc-400 sm:hidden truncate max-w-[120px]">
          {isDwelling && (isHoverPaused ? '閱讀暫停中' : '點擊卡片展開')}
        </div>

        <div className="flex items-center gap-2 mx-auto sm:mx-0 shrink-0">
          {/* 上一站 */}
          <button
            type="button"
            onClick={onPrevStop}
            disabled={currentStopIndex <= 0}
            className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
            title="上一站"
          >
            <SkipBack size={15} />
          </button>

          {/* 播放/暫停巡航 */}
          <button
            type="button"
            onClick={onPauseResumeCruise}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-xs transition active:scale-95 cursor-pointer"
            title={isPaused ? "繼續巡航" : "暫停巡航"}
          >
            {isPaused ? <Play size={13} fill="currentColor" /> : <Pause size={13} fill="currentColor" />}
            <span>{isPaused ? "繼續" : "暫停"}</span>
          </button>

          {/* 下一站 */}
          <button
            type="button"
            onClick={onNextStop}
            disabled={currentStopIndex >= totalStops - 1}
            className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
            title="下一站"
          >
            <SkipForward size={15} />
          </button>
        </div>
      </div>

      {/* 停靠駐留倒數進度微光條 */}
      {isDwelling && (
        <div className="w-full h-1 bg-zinc-800/80 overflow-hidden">
          <div
            className={`h-full transition-[width] duration-100 ease-linear ${
              isHoverPaused ? 'bg-amber-400' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, dwellProgress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
