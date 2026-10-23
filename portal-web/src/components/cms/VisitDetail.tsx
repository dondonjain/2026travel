"use client";

import React, { useState } from 'react';
import {
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Map as MapIcon,
  FileText,
  Building,
  Layers,
  Sparkles,
  Navigation,
  Loader2
} from 'lucide-react';
import { CMSVisit, Visibility } from '@/lib/cms/types';
import PoiReviewPanel from './PoiReviewPanel';
import type { PlaceResolveResult } from '@/lib/cms/place-resolver';

interface VisitDetailProps {
  cmsAccessToken?: string;
  onPlaceReviewed?: () => Promise<void>;
  visit: CMSVisit | null;
  onConfirm: (visitId: string) => void;
  onUpdateVisit: (updated: CMSVisit) => void;
  onOpenMap?: (visit: CMSVisit) => void;
  onBackToList?: () => void; // for mobile progressive navigation
  availablePlaceNames?: string[];
  isSaving?: boolean;
  errorMessage?: string | null;
  onClearError?: () => void;
}

export default function VisitDetail({
  cmsAccessToken,
  onPlaceReviewed,
  visit,
  onConfirm,
  onUpdateVisit,
  onOpenMap,
  onBackToList,
  availablePlaceNames = [],
  isSaving = false,
  errorMessage = null,
  onClearError
}: VisitDetailProps) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [justRecentered, setJustRecentered] = useState(false);
  const [isChangingPlace, setIsChangingPlace] = useState(false);
  const [isResolvingPlace, setIsResolvingPlace] = useState(false);
  const [resolveNotice, setResolveNotice] = useState<string | null>(null);
  const [lookup, setLookup] = useState<{ visitId: string; result: PlaceResolveResult } | null>(null);

  const handleAutoResolvePlace = async () => {
    if (!visit || !visit.coordinate || isResolvingPlace) return;
    setIsResolvingPlace(true);
    setResolveNotice(null);
    try {
      const res = await fetch('/api/cms/resolve-place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coordinate: visit.coordinate,
          googlePlaceId: (visit.evidence as any)?.placeID,
          semanticType: visit.evidence?.semanticType
        })
      });
      const data = await res.json();
      if (data.ok && data.result?.name) {
        setLookup({ visitId: visit.id, result: data.result });
        const names = data.result.candidates?.map((candidate: { name: string }) => candidate.name).join('、');
        setResolveNotice(names
          ? `候選場所（尚未套用，須人工確認）：${names}`
          : '未找到具體 POI；區域名稱不會套用為場所。');
      } else {
        setResolveNotice('無法解析地名');
      }
    } catch {
      setResolveNotice('解析失敗，請稍後再試');
    } finally {
      setIsResolvingPlace(false);
    }
  };

  const handleRecenter = () => {
    if (onOpenMap && visit) {
      onOpenMap(visit);
      setJustRecentered(true);
      setTimeout(() => setJustRecentered(false), 1500);
    }
  };

  if (!visit) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-zinc-400 bg-white">
        <Building className="w-12 h-12 mb-3 opacity-20 text-zinc-500" />
        <h3 className="text-base font-semibold text-zinc-600">未選取任何景點</h3>
        <p className="text-xs text-zinc-400 mt-1 max-w-xs">
          請從清單中點選欲檢視或審核的造訪景點
        </p>
      </div>
    );
  }

  const isConfirmed = visit.reviewStatus === 'confirmed';
  const hasIssues = visit.issues && visit.issues.length > 0;

  // Helper to trigger structural edit: If confirmed, automatically reverts to pending!
  const handleStructuralChange = (partial: Partial<CMSVisit>) => {
    const updated: CMSVisit = {
      ...visit,
      ...partial,
      // Section 11: Edits to structural fields (Place, time, visibility, title) invalidate confirmation!
      reviewStatus: 'pending'
    };
    onUpdateVisit(updated);
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-y-auto">
      {/* Mobile Top Navigation Bar */}
      {onBackToList && (
        <div className="lg:hidden flex items-center justify-between px-3.5 py-2 border-b border-zinc-200 bg-zinc-50/95 backdrop-blur-xs sticky top-0 z-20">
          <button
            type="button"
            onClick={onBackToList}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回景點清單</span>
          </button>
          <span className="text-[11px] font-bold text-zinc-500 bg-zinc-200/60 px-2 py-0.5 rounded-md">
            編輯模式 (¾ 畫面)
          </span>
        </div>
      )}

      {/* Main Form Content - Strict Order from Section 7 */}
      <div className="flex-1 p-4 sm:p-5 space-y-4 max-w-xl">
        {/* Status Indicator Banner */}
        <div className={`flex items-center justify-between p-3.5 rounded-xl border ${
          isConfirmed
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
            : 'bg-amber-50/80 border-amber-200 text-amber-900'
        }`}>
          <div className="flex items-center gap-2">
            {isConfirmed ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-600" />
            )}
            <div>
              <span className="font-bold text-sm">
                {isConfirmed ? '此造訪已確認 (Confirmed)' : '待審核造訪 (Pending Review)'}
              </span>
              <p className="text-xs opacity-80 mt-0.5">
                {isConfirmed
                  ? '修改標題、地點、時間或可見性將自動退回待確認狀態'
                  : '請核對資訊並點擊下方「確認造訪」以推進審核'}
              </p>
            </div>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
            isConfirmed ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'
          }`}>
            {isConfirmed ? '已確認' : '待確認'}
          </span>
        </div>

        {/* 1. Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center justify-between">
            <span>1. 景點標題 (Title)</span>
            {isConfirmed && (
              <span className="text-[11px] text-amber-600 font-normal">修改將退回待確認</span>
            )}
          </label>
          <input
            type="text"
            suppressHydrationWarning
            autoComplete="off"
            value={visit.title}
            onChange={(e) => handleStructuralChange({ title: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm font-semibold text-zinc-900 transition-all outline-hidden"
            placeholder="請輸入景點標題..."
          />
        </div>

        {/* 2. Place */}
        <div className="space-y-1.5" id={`place-correction-${visit.id}`}>
          <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center justify-between">
            <span>2. 地點識別與分類 (Place)</span>
            <button
              type="button"
              onClick={() => setIsChangingPlace(!isChangingPlace)}
              className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
            >
              {isChangingPlace ? '收合校正' : '校正地點'}
            </button>
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
            <div className="p-2 bg-white border border-zinc-200 rounded-lg text-blue-600 shrink-0 self-start sm:self-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-zinc-900 truncate">{visit.placeName}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">
                  {visit.placeCategory}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5 truncate">
                坐標：[{visit.coordinate ? `${visit.coordinate[1].toFixed(5)}, ${visit.coordinate[0].toFixed(5)}` : '無坐標'}]
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-1.5 self-end sm:self-center">
              <select
                value={visit.placeCategory}
                onChange={(e) => handleStructuralChange({ placeCategory: e.target.value as any })}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white font-medium text-zinc-700 cursor-pointer"
              >
                <option value="交通">交通</option>
                <option value="景點">景點</option>
                <option value="美食">美食</option>
                <option value="購物">購物</option>
                <option value="住宿">住宿</option>
                <option value="休歇">休歇</option>
              </select>
            </div>
          </div>

          {/* Place Correction Dropdown & Auto Resolve */}
          {isChangingPlace && (
            <div className="p-3 bg-zinc-100/80 border border-zinc-300/80 rounded-xl space-y-2.5 text-xs animate-in fade-in duration-150">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-zinc-700">地點校正與地圖解析：</span>
                <button
                  type="button"
                  disabled={isResolvingPlace || !visit.coordinate}
                  onClick={handleAutoResolvePlace}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isResolvingPlace ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>解析中...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>搜尋附近 POI 候選</span>
                    </>
                  )}
                </button>
              </div>

              {resolveNotice && (
                <p className="text-[11px] text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-200">
                  {resolveNotice}
                </p>
              )}

              {availablePlaceNames.length > 0 && (
                <div>
                  <span className="text-[11px] text-zinc-500 mb-1 block">從行程候選地點中選取：</span>
                  <select
                    value={visit.placeName}
                    onChange={(e) => {
                      const newPlace = e.target.value;
                      handleStructuralChange({
                        placeName: newPlace,
                        title: visit.title === visit.placeName ? newPlace : visit.title
                      });
                      setIsChangingPlace(false);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white font-medium text-zinc-900 text-xs cursor-pointer"
                  >
                    <option value="" disabled>請選取正確地點名稱...</option>
                    {availablePlaceNames.map((pName, pIdx) => (
                      <option key={pIdx} value={pName}>{pName}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Sub-venues notice if flattened */}
          {visit.subVenues && visit.subVenues.length > 0 && (
            <div className="p-3 bg-blue-50/60 border border-blue-200/80 rounded-xl text-xs space-y-1.5 text-blue-900">
              <div className="font-semibold flex items-center gap-1.5 text-blue-800">
                <Layers className="w-3.5 h-3.5" />
                <span>內含已壓平之子店家 (可切換為主要名稱)：</span>
              </div>
              {visit.subVenues.map((sub, sIdx) => (
                <div key={sIdx} className="flex items-center justify-between pl-4 text-zinc-700">
                  <span>• {sub.title} ({sub.durationMinutes}分)</span>
                  <button
                    type="button"
                    onClick={() => handleStructuralChange({ title: sub.title, placeName: sub.title })}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
                  >
                    替換為主要景點
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {onPlaceReviewed && <PoiReviewPanel key={visit.id}
          visit={lookup?.visitId === visit.id ? { ...visit, resolutionStatus: visit.resolutionStatus || visit.resolution?.status, resolution: lookup.result } : visit}
          accessToken={cmsAccessToken} onSaved={onPlaceReviewed} />}

        {/* 3. Start/End Time (approx 10-minute precision) */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
            3. 造訪時間 (Start / End Time)
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[11px] text-zinc-500 mb-1 block">抵達時間 (大約十分鐘精度)</span>
              <div className="relative">
                <input
                  type="text"
                  suppressHydrationWarning
                  autoComplete="off"
                  value={visit.startTime}
                  onChange={(e) => handleStructuralChange({ startTime: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-300 text-sm font-semibold text-zinc-900 outline-hidden"
                  placeholder="17:00"
                />
                <Clock className="w-4 h-4 text-zinc-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>
            <div>
              <span className="text-[11px] text-zinc-500 mb-1 block">離開時間</span>
              <div className="relative">
                <input
                  type="text"
                  suppressHydrationWarning
                  autoComplete="off"
                  value={visit.endTime}
                  onChange={(e) => handleStructuralChange({ endTime: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-300 text-sm font-semibold text-zinc-900 outline-hidden"
                  placeholder="18:30"
                />
                <Clock className="w-4 h-4 text-zinc-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            停留長度約 <span className="font-bold text-zinc-700">{visit.durationMinutes} 分鐘</span>
          </div>
        </div>

        {/* 4. Visibility Control */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
            4. 公開可見性 (Visibility)
          </label>
          <div className="grid grid-cols-2 gap-3 p-1 bg-zinc-100 rounded-xl border border-zinc-200">
            <button
              type="button"
              onClick={() => handleStructuralChange({ visibility: 'public' })}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                visit.visibility === 'public'
                  ? 'bg-white text-zinc-900 shadow-xs border border-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <Eye className="w-4 h-4 text-blue-600" />
              <span>公開 (Public)</span>
            </button>
            <button
              type="button"
              onClick={() => handleStructuralChange({ visibility: 'private' })}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                visit.visibility === 'private'
                  ? 'bg-white text-purple-900 shadow-xs border border-purple-200'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <EyeOff className="w-4 h-4 text-purple-600" />
              <span>私密 (Private)</span>
            </button>
          </div>
          <p className="text-[11px] text-zinc-500">
            {visit.visibility === 'public'
              ? '公開景點：確認後將於前台巡航播放與公開頁面中呈現。'
              : '私密景點：僅在後台編輯可見，巡航播放將自動跳過此站。'}
          </p>
        </div>

        {/* 5. Required Issues */}
        {hasIssues && (
          <div className="space-y-2 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
            <label className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>{visit.issues.some(issue => issue.severity === 'required') ? '5. 待處理問題與來源提醒' : '5. 來源提醒（不阻擋確認）'}</span>
            </label>
            {visit.issues.map(issue => (
              <div key={issue.id} className="text-xs text-amber-800 space-y-1">
                <p className="text-[11px]">{issue.severity === 'required' ? '需要校正' : '資訊提醒，無須將不同位置改為相同'}</p>
                <p className="font-semibold">{issue.message}</p>
                {issue.recommendation && (
                  <p className="text-amber-700 bg-amber-100/60 p-2 rounded-lg">
                    💡 建議解法：{issue.recommendation}
                  </p>
                )}
                {issue.type === 'place' && <div className="space-y-2 pt-1">
                  {visit.coordinate && <p>停留候選：{visit.coordinate[1].toFixed(6)}, {visit.coordinate[0].toFixed(6)}</p>}
                  {visit.evidence.departureCoordinate && <p>後續移動起點：{visit.evidence.departureCoordinate[1].toFixed(6)}, {visit.evidence.departureCoordinate[0].toFixed(6)}</p>}
                  <div className="flex flex-wrap gap-2">
                    {onOpenMap && <button type="button" onClick={() => onOpenMap(visit)} className="rounded-lg border border-amber-300 px-3 py-1.5 font-semibold hover:bg-amber-100">檢視兩個來源位置</button>}
                    {issue.severity === 'required' && <button type="button" onClick={() => {
                      setIsChangingPlace(true);
                      document.getElementById(`place-correction-${visit.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }} className="rounded-lg border border-amber-300 px-3 py-1.5 font-semibold hover:bg-amber-100">前往地點校正</button>}
                  </div>
                  {issue.severity === 'required' && <p className="text-[11px]">目前地點校正可調整名稱與分類；尚未支援儲存任意經緯度。來源座標會保留供比對。</p>}
                </div>}
              </div>
            ))}
          </div>
        )}

        {/* 6. Evidence Entry (Collapsible Accordion) */}
        <div className="border border-zinc-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setEvidenceOpen(!evidenceOpen)}
            className="w-full flex items-center justify-between p-3.5 bg-zinc-50 hover:bg-zinc-100 text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-700">
              <FileText className="w-4 h-4 text-zinc-500" />
              <span>6. 原始推論依據 (Evidence & Provenance)</span>
            </div>
            {evidenceOpen ? (
              <ChevronUp className="w-4 h-4 text-zinc-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            )}
          </button>

          {evidenceOpen && (
            <div className="p-4 bg-white text-xs space-y-2 border-t border-zinc-200 font-mono text-zinc-600">
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-400">原始資料索引 (Index):</span>
                <span className="font-semibold text-zinc-800">#{visit.evidence.sourceIndex}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-400">場所階層 (Hierarchy):</span>
                <span className="font-semibold text-zinc-800">Level {visit.evidence.hierarchyLevel}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-400">候選置信度 (Confidence):</span>
                <span className="font-semibold text-zinc-800">{Math.round(visit.evidence.candidateProbability * 100)}%</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-400">原始時間戳記 (Timestamp):</span>
                <span className="text-zinc-800 truncate max-w-[200px]">{visit.evidence.rawTimestamp}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-400">頂層地點識別 (Top Candidate):</span>
                <span className="font-semibold text-zinc-800">{visit.evidence.topCandidateName || 'Unknown'}</span>
              </div>
            </div>
          )}
        </div>

        {/* 7. Map Spatial Sync Indicator */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
              <MapPin className="w-4 h-4" />
            </span>
            <div className="truncate">
              <span className="font-bold text-zinc-800">7. 空間位置已常駐對齊地圖</span>
              <p className="text-[11px] text-zinc-500 truncate">
                {visit.coordinate ? `坐標 [${visit.coordinate[1].toFixed(4)}, ${visit.coordinate[0].toFixed(4)}] • 已在常駐地圖同步聚焦點` : '本造訪尚無經緯度坐標'}
              </p>
            </div>
          </div>
          {onOpenMap && (
            <button
              type="button"
              onClick={handleRecenter}
              className={`shrink-0 px-2.5 py-1.5 font-semibold border rounded-lg text-[11px] transition-all cursor-pointer flex items-center gap-1.5 ${
                justRecentered
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                  : 'bg-white hover:bg-blue-50 text-blue-700 border-blue-200'
              }`}
            >
              <Navigation className={`w-3 h-3 ${justRecentered ? 'animate-spin' : ''}`} />
              <span>{justRecentered ? '已置中聚焦點' : '重新置中'}</span>
            </button>
          )}
        </div>

        {/* 8. Confirm Button (Section 10 State Transition) */}
        <div className="pt-2 sticky bottom-4 z-10 bg-white/90 backdrop-blur-xs space-y-2">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start justify-between gap-2 text-xs text-red-900 animate-in fade-in duration-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">確認失敗</span>
                  <p className="text-red-700 mt-0.5 break-all">{errorMessage}</p>
                </div>
              </div>
              {onClearError && (
                <button
                  type="button"
                  onClick={onClearError}
                  className="text-red-500 hover:text-red-800 font-bold shrink-0 text-xs px-1"
                >
                  關閉
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={isSaving}
            onClick={() => onConfirm(visit.id)}
            className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-sm font-bold transition-all shadow-md ${
              isSaving
                ? 'bg-zinc-400 text-white cursor-not-allowed opacity-80'
                : isConfirmed
                ? 'bg-zinc-900 text-white hover:bg-zinc-800 cursor-pointer'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20 cursor-pointer'
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>儲存中 (Saving to Database)...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>
                  {isConfirmed ? '已確認（點擊再次確認並跳下一站）' : '8. 確認造訪並前進下一站 (Confirm & Next)'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
