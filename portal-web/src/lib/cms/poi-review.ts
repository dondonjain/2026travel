import type { CMSVisit, CMSTrip } from './types';
import type { ResolutionStatus } from './place-resolver';
import type { PoiCandidate } from './poi-fetcher';
import { validCoordinate } from './trajectory-analyzer';

export interface ResolutionReviewRow {
  id: string; trip_slug: string; place_id: string | null; title: string;
  occurred_at: string | null; time_zone: string; presentation_category: string | null;
  review_status: 'pending' | 'confirmed'; visibility: 'public' | 'private';
  resolution_status: ResolutionStatus | 'MANUALLY_CONFIRMED' | null;
  place_name: string | null; longitude: number | null; latitude: number | null;
}
export interface CmsEditorSession { url: string; publishableKey: string; accessToken: string }
export function editorSession(accessToken?: string): CmsEditorSession | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return accessToken && url && publishableKey ? { url, publishableKey, accessToken } : null;
}
function headers(session: CmsEditorSession): Record<string, string> {
  return { apikey: session.publishableKey, Authorization: `Bearer ${session.accessToken}`,
    'Accept-Profile': 'api_cms', 'Content-Profile': 'api_cms', 'Content-Type': 'application/json' };
}
export async function fetchResolutionReview(tripSlug: string, session: CmsEditorSession, request: typeof fetch = fetch): Promise<ResolutionReviewRow[]> {
  const url = new URL('/rest/v1/cms_visit_resolution_review', session.url);
  url.searchParams.set('trip_slug', `eq.${tripSlug}`);
  url.searchParams.set('order', 'occurred_at.asc.nullslast,id.asc');
  const response = await request(url, { headers: headers(session), cache: 'no-store' });
  if (!response.ok) throw new Error(`無法讀取場所待審資料（HTTP ${response.status}）；請確認 editor 權限與 migration。`);
  return response.json();
}
export async function reviewVisitPlace(visitId: string, choice: { placeId: string } | { candidate: PoiCandidate },
  session: CmsEditorSession, request: typeof fetch = fetch): Promise<void> {
  const params: Record<string, unknown> = { p_visit_id: visitId };
  if ('placeId' in choice) params.p_place_id = choice.placeId;
  else {
    const candidate = choice.candidate;
    if (candidate.source !== 'overpass' || !validCoordinate(candidate.coordinate) || !candidate.name.trim()) {
      throw new Error('此候選僅供參考，不能持久化為場所。');
    }
    params.p_name = candidate.name;
    params.p_longitude = candidate.coordinate[0];
    params.p_latitude = candidate.coordinate[1];
  }
  const response = await request(new URL('/rest/v1/rpc/review_cms_visit_place', session.url), {
    method: 'POST', headers: headers(session), body: JSON.stringify(params), cache: 'no-store'
  });
  if (!response.ok) throw new Error(`場所確認未儲存（HTTP ${response.status}）。`);
}
export function mergeResolutionReview(trip: CMSTrip, rows: ResolutionReviewRow[]): CMSTrip {
  const visits = rows.map(row => {
    const existing = trip.visits.find(v => v.id === row.id);
    const coordinate = [row.longitude, row.latitude];
    const time = row.occurred_at ? new Date(row.occurred_at) : null;
    const zone = row.time_zone || 'Asia/Tokyo';
    const localDate = time ? new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(time) : trip.startDate;
    const dayNumber = Math.max(1, Math.round((Date.parse(localDate) - Date.parse(trip.startDate)) / 86400000) + 1);
    const base: CMSVisit = existing || {
      id: row.id, title: row.title || '待整理造訪', dayNumber, placeName: '待辨識場所', placeCategory: '景點',
      startTime: time ? new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit' }).format(time) : '',
      endTime: '', durationMinutes: 0, coordinate: null, reviewStatus: 'pending', visibility: row.visibility,
      issues: [], evidence: { sourceIndex: -1, hierarchyLevel: 0, rawTimestamp: row.occurred_at || '', candidateProbability: 0 }
    };
    const unresolved = row.place_id === null;
    const issues = base.issues.filter(i => !['spatial-conflict', 'poi-review', 'day-one-source-conflict'].includes(i.id));
    if (unresolved) issues.push({ id: 'poi-review', type: 'place', severity: 'required',
      message: row.resolution_status?.startsWith('SPATIAL_CONFLICT') ? '來源位置有衝突，場所保持未指定，須人工確認。' : '場所尚未確認，請選擇具體 POI。' });
    const categories: CMSVisit['placeCategory'][] = ['交通', '購物', '美食', '住宿', '景點', '休歇'];
    return { ...base, title: row.title || base.title, placeId: row.place_id, resolutionStatus: row.resolution_status,
      placeCategory: categories.find(c => c === row.presentation_category) || base.placeCategory,
      placeName: row.place_name || '待辨識場所', coordinate: validCoordinate(coordinate) ? coordinate : base.evidence.rawGeo || null,
      reviewStatus: row.review_status, visibility: row.visibility, issues };
  });
  return { ...trip, visits };
}
