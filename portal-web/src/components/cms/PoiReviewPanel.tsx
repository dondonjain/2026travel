'use client';

import { useState } from 'react';
import type { CMSVisit } from '@/lib/cms/types';
import { editorSession, reviewVisitPlace } from '@/lib/cms/poi-review';
import type { PoiCandidate } from '@/lib/cms/poi-fetcher';

export default function PoiReviewPanel({ visit, accessToken, onSaved }: {
  visit: CMSVisit; accessToken?: string; onSaved: () => Promise<void>;
}) {
  const [placeId, setPlaceId] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const session = editorSession(accessToken);
  const status = visit.resolutionStatus || visit.resolution?.status;
  const statusText = status === 'MANUALLY_CONFIRMED' ? '已人工指定場所'
    : status?.startsWith('SPATIAL_CONFLICT') ? '來源位置有衝突，待人工確認'
    : status === 'HIGH_CONFIDENCE_SUGGESTED' ? '有較明確候選，待人工確認'
    : status === 'AMBIGUOUS_CANDIDATES' ? '多個候選，待人工確認' : '尚無具體候選';
  const save = async (choice: { placeId: string } | { candidate: PoiCandidate }) => {
    if (!session || pending) return;
    setPending(true);
    setNotice('');
    try {
      await reviewVisitPlace(visit.id, choice, session);
      await onSaved();
      setNotice('場所已人工指定；請再確認這筆造訪。');
    } catch (error) { setNotice(error instanceof Error ? error.message : '場所確認失敗。'); }
    finally { setPending(false); }
  };
  return <section className="p-3 border border-amber-200 rounded-xl space-y-2 text-xs" aria-label="場所人工確認">
    <p className="font-semibold">場所解析：{statusText}</p>
    <p>候選與區域背景不代表實際造訪位置；人工指定前不會連結 Place。</p>
    {!session && <p role="status">目前沒有 CMS editor 登入工作階段，無法儲存場所確認。</p>}
    {visit.resolution?.candidates.map(candidate => <div key={candidate.id} className="flex gap-2 items-center">
      <span>{candidate.name}（約 {Math.round(candidate.distanceMeters)} 公尺）</span>
      {candidate.source === 'overpass' ? <button type="button" disabled={!session || pending}
        onClick={() => save({ candidate })} className="border rounded px-2 py-1 disabled:opacity-50">人工確認此場所</button>
        : <span>Mapbox 候選僅供參考</span>}
    </div>)}
    {!!visit.resolution?.fallbackAreaContext.length && <p>區域背景：{visit.resolution.fallbackAreaContext.map(a => a.name).join('、')}</p>}
    <label className="block">或指定已確認的 Place ID
      <input value={placeId} onChange={e => setPlaceId(e.target.value)} className="block border rounded p-1 w-full" />
    </label>
    <button type="button" disabled={!session || pending || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(placeId)}
      onClick={() => save({ placeId })} className="border rounded px-2 py-1 disabled:opacity-50">人工指定現有場所</button>
    {notice && <p role="status">{notice}</p>}
  </section>;
}
