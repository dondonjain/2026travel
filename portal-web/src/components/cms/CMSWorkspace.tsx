"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Play,
  AlertCircle,
  MapPin,
  Calendar,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  ArrowLeft,
  Eye,
  SlidersHorizontal,
  Home
} from 'lucide-react';
import Link from 'next/link';

import { CMSTrip, CMSVisit, ReviewStatus } from '@/lib/cms/types';
import { INITIAL_TRIP_FIXTURE, getCmsTrip } from '@/lib/cms/fixture';
import { confirmVisit, undoVisit, updateVisit, fetchConfirmedVisitIds } from '@/lib/cms/cms-api';
import { editorSession, fetchResolutionReview, mergeResolutionReview } from '@/lib/cms/poi-review';

import DaySelector from './DaySelector';
import VisitList from './VisitList';
import VisitDetail from './VisitDetail';
import ContextualMap from './ContextualMap';
import RequiredIssuesModal from './RequiredIssuesModal';
import UndoToast from './UndoToast';
import PreviewModal from './PreviewModal';

export default function CMSWorkspace({ initialTrip, cmsAccessToken }: { initialTrip?: CMSTrip; cmsAccessToken?: string }) {
  const searchParams = useSearchParams();
  const tripSlug = searchParams.get('tripSlug') || 'japan-2026-summer';
  const baseTrip = useMemo(() => initialTrip?.slug === tripSlug ? initialTrip : getCmsTrip(tripSlug), [initialTrip, tripSlug]);
  const initialDayParam = searchParams.get('day');
  const initialVisitParam = searchParams.get('selectedVisit');
  const parsedDay = initialDayParam === 'all' ? 'all' : (initialDayParam ? parseInt(initialDayParam, 10) : 1);

  // Initialize base trip
  const [trip, setTrip] = useState<CMSTrip>(() => baseTrip);
  const [selectedDay, setSelectedDay] = useState<number | 'all'>(isNaN(parsedDay as number) ? 1 : parsedDay);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(() => {
    if (initialVisitParam) return initialVisitParam;
    const initialTrip = baseTrip;
    const day1Visits = initialTrip.visits.filter(v => v.dayNumber === 1);
    const firstPending = day1Visits.find(v => v.reviewStatus === 'pending');
    return firstPending?.id || day1Visits[0]?.id || initialTrip.visits[0]?.id || null;
  });

  // Mobile progressive view state: 'list' or 'detail'
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  // Modals & Popovers
  const [issuesModalOpen, setIssuesModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [mapCenterTrigger, setMapCenterTrigger] = useState(0);

  // Undo Confirmation State
  const [undoState, setUndoState] = useState<{
    visitId: string;
    title: string;
  } | null>(null);

  // In-flight Action States (Prevent duplicate submissions and premature advancement)
  const [actionPendingVisitId, setActionPendingVisitId] = useState<string | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const [actionError, setActionError] = useState<{ visitId: string; message: string } | null>(null);

  // Database Synchronization State
  const [dbSyncStatus, setDbSyncStatus] = useState<'syncing' | 'synced' | 'error'>('syncing');
  const [dbSyncError, setDbSyncError] = useState<string | null>(null);

  // Persistence helper: only update cache after authoritative server confirmations
  const persistVisitChange = (visitId: string, partial: Partial<CMSVisit>) => {
    if (typeof window === 'undefined') return;
    try {
      const key = `cms_trip_state_${tripSlug}`;
      const raw = localStorage.getItem(key);
      const map: Record<string, Partial<CMSVisit>> = raw ? JSON.parse(raw) : {};
      map[visitId] = { ...(map[visitId] || {}), ...partial };
      localStorage.setItem(key, JSON.stringify(map));
    } catch (e) {
      console.warn('[CMS] Failed to persist visit change to localStorage:', e);
    }
  };

  // Sync state from Database (Authoritative Source of Truth)
  useEffect(() => {
    let isMounted = true;
    setDbSyncStatus('syncing');
    setDbSyncError(null);

    const session = editorSession(cmsAccessToken);
    if (session) {
      fetchResolutionReview(tripSlug, session).then(rows => {
        if (!isMounted) return;
        setTrip(mergeResolutionReview(baseTrip, rows));
        setDbSyncStatus('synced');
      }).catch(error => {
        if (!isMounted) return;
        setDbSyncStatus('error');
        setDbSyncError(error instanceof Error ? error.message : '場所待審資料載入失敗。');
      });
      return () => { isMounted = false; };
    }
    fetchConfirmedVisitIds(tripSlug).then((res) => {
      if (!isMounted) return;
      if (!res.success) {
        setDbSyncStatus('error');
        setDbSyncError(res.error || '無法連線至資料庫取得最新審核狀態。');
        return;
      }

      const dbConfirmedIds = res.confirmedIds!;
      setDbSyncStatus('synced');

      setTrip(() => {
        const currentBase = baseTrip;
        const updatedVisits = currentBase.visits.map((v) => ({
          ...v,
          reviewStatus: dbConfirmedIds.has(v.id) ? ('confirmed' as ReviewStatus) : ('pending' as ReviewStatus)
        }));

        return {
          ...currentBase,
          visits: updatedVisits
        };
      });

      // Synchronize cache: clean up stale cached entries that disagree with DB
      if (typeof window !== 'undefined') {
        const cleanCache: Record<string, Partial<CMSVisit>> = {};
        for (const id of dbConfirmedIds) {
          cleanCache[id] = { reviewStatus: 'confirmed' };
        }
        localStorage.setItem(`cms_trip_state_${tripSlug}`, JSON.stringify(cleanCache));
      }
    }).catch((err) => {
      if (!isMounted) return;
      setDbSyncStatus('error');
      setDbSyncError(err instanceof Error ? err.message : String(err));
    });

    return () => {
      isMounted = false;
    };
  }, [tripSlug, baseTrip, cmsAccessToken]);

  const reloadPlaceReview = async () => {
    const session = editorSession(cmsAccessToken);
    if (!session) throw new Error('請先登入 CMS editor 工作階段。');
    const rows = await fetchResolutionReview(tripSlug, session);
    setTrip(current => mergeResolutionReview(current, rows));
  };

  // Filtered visits for current Day
  const currentDayVisits = useMemo(() => {
    if (selectedDay === 'all') return trip.visits;
    return trip.visits.filter(v => v.dayNumber === selectedDay);
  }, [trip.visits, selectedDay]);

  // Active selected visit object
  const activeVisit = useMemo(() => {
    return trip.visits.find(v => v.id === selectedVisitId) || null;
  }, [trip.visits, selectedVisitId]);

  // Unique place names for place correction
  const availablePlaceNames = useMemo(() => {
    return Array.from(new Set(trip.visits.map(v => v.placeName))).filter(Boolean);
  }, [trip.visits]);

  // Overall Statistics
  const totalIssuesCount = useMemo(() => {
    return trip.visits.reduce((acc, v) => acc + (v.issues?.length || 0), 0);
  }, [trip.visits]);

  const confirmedPublicVisitsCount = useMemo(() => {
    return trip.visits.filter(v => v.reviewStatus === 'confirmed' && v.visibility === 'public').length;
  }, [trip.visits]);

  const isPreviewEligible = trip.usableTrajectory && confirmedPublicVisitsCount > 0;

  // --- Handlers ---

  // Handle Day Selection
  const handleSelectDay = (day: number | 'all') => {
    setSelectedDay(day);
    setMobileView('list');
    const dayVisits = day === 'all' ? trip.visits : trip.visits.filter(v => v.dayNumber === day);
    if (dayVisits.length > 0) {
      // Pick first pending visit in day, or first visit
      const firstPending = dayVisits.find(v => v.reviewStatus === 'pending');
      setSelectedVisitId(firstPending ? firstPending.id : dayVisits[0].id);
    } else {
      setSelectedVisitId(null);
    }
  };

  // Handle Visit Card Click
  const handleSelectVisit = (visitId: string, dayNumber?: number) => {
    if (dayNumber !== undefined && dayNumber !== selectedDay) {
      setSelectedDay(dayNumber);
    }
    setSelectedVisitId(visitId);
    setMobileView('detail');
  };

  // Handle Confirm Action (Section 10 State Transition)
  // Must await RPC success before marking confirmed, advancing, or updating cache
  const handleConfirm = async (visitId: string) => {
    if (actionPendingVisitId || isUndoing) return; // Prevent duplicate submissions

    const target = trip.visits.find(v => v.id === visitId);
    if (!target) return;
    if (target.placeId === null || (target.resolution?.hasSpatialConflict && target.resolutionStatus !== 'MANUALLY_CONFIRMED')) {
      setActionError({ visitId, message: '請先人工指定具體場所，再確認造訪。' });
      return;
    }

    setActionPendingVisitId(visitId);
    setActionError(null);

    // 1. Await authoritative backend confirmation
    const result = await confirmVisit(visitId, cmsAccessToken);

    if (!result.success) {
      // RPC failed: retain current state, do not advance, do not unlock preview
      setActionPendingVisitId(null);
      setActionError({
        visitId,
        message: result.error || '後端資料庫確認失敗，請檢查網路連線或稍後重試。'
      });
      return;
    }

    // 2. Update status and cache only on RPC success
    const updatedVisits = trip.visits.map(v =>
      v.id === visitId ? { ...v, reviewStatus: 'confirmed' as ReviewStatus } : v
    );

    persistVisitChange(visitId, { reviewStatus: 'confirmed' });
    setTrip(prev => ({ ...prev, visits: updatedVisits }));
    setActionPendingVisitId(null);
    setActionError(null);

    // 3. Set Undo toast
    setUndoState({
      visitId: target.id,
      title: target.title
    });

    // 4. Auto advance to next Pending visit
    const dayScope = selectedDay === 'all' ? updatedVisits : updatedVisits.filter(v => v.dayNumber === selectedDay);
    const nextPendingInDay = dayScope.find(v => v.id !== visitId && v.reviewStatus === 'pending');

    if (nextPendingInDay) {
      setSelectedVisitId(nextPendingInDay.id);
      setMobileView('detail');
    } else {
      const nextPendingAnywhere = updatedVisits.find(v => v.id !== visitId && v.reviewStatus === 'pending');
      if (nextPendingAnywhere) {
        setSelectedDay(nextPendingAnywhere.dayNumber);
        setSelectedVisitId(nextPendingAnywhere.id);
        setMobileView('detail');
      } else {
        // All confirmed! Return to list on mobile
        setMobileView('list');
      }
    }
  };

  // Handle Undo Confirmation
  const handleUndo = async () => {
    if (!undoState || actionPendingVisitId || isUndoing) return;
    const targetId = undoState.visitId;

    setIsUndoing(true);
    setActionError(null);

    const result = await undoVisit(targetId);

    if (!result.success) {
      setIsUndoing(false);
      setActionError({
        visitId: targetId,
        message: result.error || '復原確認失敗，請檢查網路或稍後重試。'
      });
      return;
    }

    persistVisitChange(targetId, { reviewStatus: 'pending' });

    const revertedVisits = trip.visits.map(v =>
      v.id === targetId ? { ...v, reviewStatus: 'pending' as ReviewStatus } : v
    );

    setTrip(prev => ({ ...prev, visits: revertedVisits }));
    setSelectedVisitId(targetId);
    setMobileView('detail');
    setUndoState(null);
    setIsUndoing(false);
    setActionError(null);
  };

  // Handle Structural Edit (Title, Place, Time, Visibility)
  const handleUpdateVisit = (updatedVisit: CMSVisit) => {
    // Persist structural update to backend asynchronously and persist to localStorage
    updateVisit(updatedVisit.id, {
      title: updatedVisit.title,
      visibility: updatedVisit.visibility,
      presentationCategory: updatedVisit.placeCategory
    }).catch((err) => console.error('[CMS] updateVisit failed:', err));

    persistVisitChange(updatedVisit.id, {
      title: updatedVisit.title,
      visibility: updatedVisit.visibility,
      placeCategory: updatedVisit.placeCategory,
      reviewStatus: updatedVisit.reviewStatus
    });

    const updatedVisits = trip.visits.map(v =>
      v.id === updatedVisit.id ? updatedVisit : v
    );
    setTrip(prev => ({ ...prev, visits: updatedVisits }));
  };

  // Day label for middle column
  const currentDayObj = trip.days.find(d => d.dayNumber === selectedDay);
  const dayHeaderLabel = selectedDay === 'all'
    ? '全行程景點清單 (All Days)'
    : `${currentDayObj?.label || `Day ${selectedDay}`} — ${currentDayObj?.subtitle || ''}`;

  return (
    <div className="flex flex-col h-screen w-full bg-zinc-100 overflow-hidden font-sans">
      {/* 1. Trip Top Header */}
      <header className="h-14 sm:h-16 bg-white border-b border-zinc-200 px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            title="返回前台首頁"
          >
            <Home className="w-5 h-5" />
          </Link>
          <div className="h-6 w-px bg-zinc-200 hidden sm:block" />
          <div className="truncate">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-zinc-900 truncate">
                {trip.title}
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200 uppercase">
                {trip.publicationStatus === 'draft' ? '草稿 (Draft)' : '已發布'}
              </span>
            </div>
            <p className="text-xs text-zinc-500 truncate hidden sm:block">
              日期區間：{trip.startDate} 至 {trip.endDate} • 共 {trip.days.length} 天 • {trip.visits.length} 個候選景點
            </p>
          </div>
        </div>

        {/* Right Action Bar: Issues & Preview Button */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Required Issues Shortcut */}
          <button
            type="button"
            onClick={() => setIssuesModalOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
              totalIssuesCount > 0
                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
            }`}
          >
            <AlertCircle className={`w-4 h-4 ${totalIssuesCount > 0 ? 'text-amber-600' : 'text-zinc-400'}`} />
            <span className="hidden sm:inline">待處理問題</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              totalIssuesCount > 0 ? 'bg-amber-200 text-amber-900' : 'bg-zinc-200 text-zinc-700'
            }`}>
              {totalIssuesCount}
            </span>
          </button>

          {/* Preview Button */}
          <button
            type="button"
            onClick={() => setPreviewModalOpen(true)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer ${
              isPreviewEligible
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                : 'bg-zinc-200 text-zinc-400 border border-zinc-300 cursor-not-allowed'
            }`}
          >
            <Play className={`w-3.5 h-3.5 ${isPreviewEligible ? 'fill-white' : 'fill-zinc-400'}`} />
            <span>巡航預覽 (Preview)</span>
          </button>
        </div>
      </header>

      {/* DB Sync Error Alert Banner */}
      {dbSyncStatus === 'error' && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between text-xs text-amber-900 shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>無法確認資料庫同步狀態：</strong>{dbSyncError || '請檢查網路連線或重新整理頁面。'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setDbSyncStatus('syncing');
              fetchConfirmedVisitIds(tripSlug).then(res => {
                if (res.success) {
                  setDbSyncStatus('synced');
                  setDbSyncError(null);
                  const dbConfirmedIds = res.confirmedIds!;
                  setTrip(() => {
                    const currentBase = baseTrip;
                    return {
                      ...currentBase,
                      visits: currentBase.visits.map(v => ({
                        ...v,
                        reviewStatus: dbConfirmedIds.has(v.id) ? ('confirmed' as ReviewStatus) : ('pending' as ReviewStatus)
                      }))
                    };
                  });
                } else {
                  setDbSyncStatus('error');
                  setDbSyncError(res.error || '重試失敗');
                }
              });
            }}
            className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg font-bold cursor-pointer transition-colors shrink-0"
          >
            重新同步
          </button>
        </div>
      )}

      {/* 2. Responsive Workspace Body */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Mobile View: Vertical Split (Upper Map ~45vh, Lower Content Sheet ~55vh) */}
        <div className="lg:hidden flex-1 flex flex-col overflow-hidden">
          {/* Mobile Day Selector Bar */}
          <div className="shrink-0 bg-white border-b border-zinc-200">
            <DaySelector
              days={trip.days}
              selectedDay={selectedDay}
              onSelectDay={handleSelectDay}
              visits={trip.visits}
            />
          </div>

          {/* Upper Section: Persistent Map (Dynamic height: 45vh in list mode, 25vh (1/4) in edit/detail mode) */}
          <div
            className={`w-full shrink-0 border-b border-zinc-200 bg-slate-900 relative transition-[height] duration-300 ease-in-out ${
              mobileView === 'detail' ? 'h-[25vh]' : 'h-[45vh]'
            }`}
          >
            <ContextualMap
              visit={activeVisit}
              visits={currentDayVisits}
              onSelectVisit={(id) => handleSelectVisit(id)}
              centerTrigger={mapCenterTrigger}
            />
          </div>

          {/* Lower Section: Interactive Content Sheet (List or Detail) */}
          <div className="flex-1 overflow-hidden flex flex-col bg-white">
            {mobileView === 'list' ? (
              <VisitList
                visits={currentDayVisits}
                selectedVisitId={selectedVisitId}
                onSelectVisit={(id) => handleSelectVisit(id)}
                dayLabel={dayHeaderLabel}
              />
            ) : (
              <VisitDetail
                cmsAccessToken={cmsAccessToken}
                onPlaceReviewed={reloadPlaceReview}
                visit={activeVisit}
                onConfirm={handleConfirm}
                onUpdateVisit={handleUpdateVisit}
                onOpenMap={() => setMapCenterTrigger(c => c + 1)}
                onBackToList={() => setMobileView('list')}
                availablePlaceNames={availablePlaceNames}
                isSaving={Boolean(activeVisit && actionPendingVisitId === activeVisit.id)}
                errorMessage={Boolean(actionError && activeVisit && actionError.visitId === activeVisit.id) ? actionError?.message : null}
                onClearError={() => setActionError(null)}
              />
            )}
          </div>
        </div>

        {/* Desktop Four-Column Layout:
            Column 1: Days Navigation (~16%, min 210px, max 250px) -> Comfortably fits Day * (M/D) on line 1, 12+ CJK chars on line 2
            Column 2: Visit List (~22%, min 270px, max 340px) -> Cards fit neatly
            Column 3: Visit Detail & Editor (~32%, min 340px, max 460px) -> Compact, non-bloated form
            Column 4: Persistent Map (flex-1, ~30%, min 320px) -> Expansive spatial canvas
        */}
        <div className="hidden lg:flex flex-1 w-full h-full overflow-hidden divide-x divide-zinc-200">
          {/* Column 1: Days Navigation (~16%) */}
          <div className="w-[16%] min-w-[210px] max-w-[250px] h-full bg-white overflow-y-auto shrink-0">
            <DaySelector
              days={trip.days}
              selectedDay={selectedDay}
              onSelectDay={handleSelectDay}
              visits={trip.visits}
            />
          </div>

          {/* Column 2: Visit List (~22%) */}
          <div className="w-[22%] min-w-[270px] max-w-[340px] h-full bg-zinc-50/50 overflow-hidden shrink-0">
            <VisitList
              visits={currentDayVisits}
              selectedVisitId={selectedVisitId}
              onSelectVisit={(id) => handleSelectVisit(id)}
              dayLabel={dayHeaderLabel}
            />
          </div>

          {/* Column 3: Visit Detail & Editor (~32%) */}
          <div className="w-[32%] min-w-[340px] max-w-[460px] h-full bg-white overflow-hidden shrink-0">
            <VisitDetail
              cmsAccessToken={cmsAccessToken}
              onPlaceReviewed={reloadPlaceReview}
              visit={activeVisit}
              onConfirm={handleConfirm}
              onUpdateVisit={handleUpdateVisit}
              onOpenMap={() => setMapCenterTrigger(c => c + 1)}
              availablePlaceNames={availablePlaceNames}
              isSaving={Boolean(activeVisit && actionPendingVisitId === activeVisit.id)}
              errorMessage={Boolean(actionError && activeVisit && actionError.visitId === activeVisit.id) ? actionError?.message : null}
              onClearError={() => setActionError(null)}
            />
          </div>

          {/* Column 4: Persistent Contextual Map (flex-1, ~30%) */}
          <div className="flex-1 min-w-[320px] h-full bg-slate-900 overflow-hidden">
            <ContextualMap
              visit={activeVisit}
              visits={currentDayVisits}
              onSelectVisit={(id) => handleSelectVisit(id)}
              centerTrigger={mapCenterTrigger}
            />
          </div>
        </div>
      </div>

      {/* Required Issues Modal */}
      {issuesModalOpen && (
        <RequiredIssuesModal
          visits={trip.visits}
          onSelectVisit={handleSelectVisit}
          onClose={() => setIssuesModalOpen(false)}
        />
      )}

      {/* Preview Eligibility Modal */}
      {previewModalOpen && (
        <PreviewModal
          visits={trip.visits}
          usableTrajectory={trip.usableTrajectory}
          onClose={() => setPreviewModalOpen(false)}
          tripSlug={trip.slug}
          selectedDay={selectedDay}
          selectedVisitId={selectedVisitId}
        />
      )}

      {/* Undo Toast */}
      <UndoToast
        onUndo={handleUndo}
        lastConfirmedTitle={undoState ? undoState.title : null}
        onDismiss={() => setUndoState(null)}
      />
    </div>
  );
}
