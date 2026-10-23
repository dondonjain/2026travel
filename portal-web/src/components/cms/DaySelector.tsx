"use client";

import React from 'react';
import { Calendar, AlertCircle } from 'lucide-react';
import { CMSDay, CMSVisit } from '@/lib/cms/types';

interface DaySelectorProps {
  days: CMSDay[];
  selectedDay: number | 'all';
  onSelectDay: (day: number | 'all') => void;
  visits: CMSVisit[];
}

export default function DaySelector({
  days,
  selectedDay,
  onSelectDay,
  visits
}: DaySelectorProps) {
  // Helper to count visits and issues per day
  const getDayStats = (dayNum: number) => {
    const dayVisits = visits.filter(v => v.dayNumber === dayNum);
    const issueCount = dayVisits.reduce((acc, v) => acc + (v.issues?.length || 0), 0);
    const confirmedCount = dayVisits.filter(v => v.reviewStatus === 'confirmed').length;
    return { total: dayVisits.length, confirmed: confirmedCount, issues: issueCount };
  };

  const totalIssuesAll = visits.reduce((acc, v) => acc + (v.issues?.length || 0), 0);
  const totalConfirmedAll = visits.filter(v => v.reviewStatus === 'confirmed').length;

  return (
    <div>
      {/* Mobile Horizontal Scrollable Bar */}
      <div className="lg:hidden flex items-center gap-2 overflow-x-auto pb-2 px-4 scrollbar-none border-b border-zinc-200 bg-white">
        <button
          type="button"
          onClick={() => onSelectDay('all')}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
            selectedDay === 'all'
              ? 'bg-zinc-900 text-white shadow-xs'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          <span>全部 ({visits.length})</span>
          {totalIssuesAll > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          )}
        </button>

        {days.map(d => {
          const stats = getDayStats(d.dayNumber);
          const isSelected = selectedDay === d.dayNumber;
          return (
            <button
              key={d.dayNumber}
              type="button"
              onClick={() => onSelectDay(d.dayNumber)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              <span>D{d.dayNumber}</span>
              <span className={`text-[10px] px-1 rounded-sm ${isSelected ? 'bg-blue-700' : 'bg-zinc-200 text-zinc-600'}`}>
                {stats.confirmed}/{stats.total}
              </span>
              {stats.issues > 0 && (
                <span className="flex items-center text-amber-500">
                  <AlertCircle className="w-3 h-3 fill-amber-500 text-white" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Desktop Vertical Days Sidebar */}
      <div className="hidden lg:flex flex-col gap-1.5 p-3">
        <div className="px-3 py-2 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
          行程天數 (Days)
        </div>

        <button
          type="button"
          onClick={() => onSelectDay('all')}
          className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left cursor-pointer ${
            selectedDay === 'all'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'text-zinc-700 hover:bg-zinc-100'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 opacity-70" />
            <span>全行程概覽 (All Days)</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className={selectedDay === 'all' ? 'text-zinc-300' : 'text-zinc-400'}>
              {totalConfirmedAll}/{visits.length}
            </span>
            {totalIssuesAll > 0 && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 font-semibold text-[10px]">
                {totalIssuesAll}
              </span>
            )}
          </div>
        </button>

        <div className="h-px bg-zinc-200 my-1" />

        {days.map(d => {
          const stats = getDayStats(d.dayNumber);
          const isSelected = selectedDay === d.dayNumber;
          return (
            <button
              key={d.dayNumber}
              type="button"
              onClick={() => onSelectDay(d.dayNumber)}
              className={`group flex flex-col gap-1 px-3 py-2.5 rounded-xl transition-all text-left cursor-pointer border ${
                isSelected
                  ? 'bg-blue-50 border-blue-200 text-blue-900 shadow-xs'
                  : 'border-transparent hover:bg-zinc-50 text-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5 whitespace-nowrap">
                <span className={`font-semibold text-sm truncate ${isSelected ? 'text-blue-600' : 'text-zinc-900'}`}>
                  {d.label}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {stats.issues > 0 && (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold">
                      <AlertCircle className="w-2.5 h-2.5" />
                      {stats.issues}
                    </span>
                  )}
                  <span className={`text-xs px-1.5 py-0.5 rounded-md font-mono ${isSelected ? 'bg-blue-200/60 text-blue-800' : 'bg-zinc-100 text-zinc-500'}`}>
                    {stats.confirmed}/{stats.total}
                  </span>
                </div>
              </div>
              <div className="text-xs text-zinc-500 leading-normal line-clamp-1" title={d.subtitle}>
                {d.subtitle}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
