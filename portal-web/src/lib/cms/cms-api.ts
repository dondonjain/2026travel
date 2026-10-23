import type { CMSTrip, CMSVisit, CMSDay, ReviewStatus, Visibility } from './types';
import { INITIAL_TRIP_FIXTURE, getCmsTrip } from './fixture';
import type { EnrichedPlace } from '@/types/itinerary';
import type { PublicTrajectorySegment } from '../narrative-playback';
import { mapPublicReadModelToEnrichedPlaces, type PublicVisitRow, type PublicVisitMediaRow } from '../supabase-places';
import { mapPublicTrajectoryRows, type PublicTrajectoryRpcRow } from '../supabase-trajectory';

const CMS_SCHEMA = 'api_cms';

interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    return null;
  }
  return { url, publishableKey };
}

/**
 * Executes a POST RPC on the api_cms schema via PostgREST.
 */
async function callCmsRpc<T>(
  rpcName: string,
  params: Record<string, unknown>,
  signal?: AbortSignal,
  accessToken?: string
): Promise<T> {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error('Supabase configuration is not available.');
  }

  const endpoint = new URL(`/rest/v1/rpc/${rpcName}`, config.url);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${accessToken || config.publishableKey}`,
      'Content-Profile': CMS_SCHEMA,
      'Accept-Profile': CMS_SCHEMA,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params),
    cache: 'no-store',
    signal
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`RPC ${rpcName} failed (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<T>;
}

export interface CmsRpcResult {
  success: boolean;
  error?: string;
}

/**
 * Confirm a visit (review_status = 'confirmed')
 */
export async function confirmVisit(visitId: string, accessToken?: string): Promise<CmsRpcResult> {
  const config = getSupabaseConfig();
  if (!config) {
    return { success: false, error: '未設定 Supabase 連線，無法持久化至資料庫。' };
  }

  try {
    await callCmsRpc('confirm_cms_visit', { p_visit_id: visitId }, undefined, accessToken);
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[CMS API] Failed to confirm visit ${visitId} via RPC:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Undo visit confirmation (review_status = 'pending')
 */
export async function undoVisit(visitId: string): Promise<CmsRpcResult> {
  const config = getSupabaseConfig();
  if (!config) {
    return { success: false, error: '未設定 Supabase 連線，無法持久化至資料庫。' };
  }

  try {
    await callCmsRpc('undo_cms_visit', { p_visit_id: visitId });
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[CMS API] Failed to undo visit ${visitId} via RPC:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Update visit structural or editorial fields.
 * Any structural edit on a confirmed visit is automatically reset to 'pending' by the DB trigger.
 */
export async function updateVisit(
  visitId: string,
  updates: {
    title?: string;
    occurredAt?: string;
    placeId?: string;
    visibility?: Visibility;
    presentationCategory?: string;
  }
): Promise<boolean> {
  const config = getSupabaseConfig();
  if (!config) {
    return true;
  }

  try {
    await callCmsRpc('update_cms_visit', {
      p_visit_id: visitId,
      p_title: updates.title ?? null,
      p_occurred_at: updates.occurredAt ?? null,
      p_place_id: updates.placeId ?? null,
      p_visibility: updates.visibility ?? null,
      p_presentation_category: updates.presentationCategory ?? null
    });
    return true;
  } catch (err) {
    console.warn(`[CMS API] Failed to update visit ${visitId} via RPC:`, err);
    return false;
  }
}

/**
 * Add a new visit to a trip.
 */
export async function addVisit(params: {
  tripId: string;
  placeId: string;
  title: string;
  occurredAt?: string;
  visibility?: Visibility;
  presentationCategory?: string;
}): Promise<boolean> {
  const config = getSupabaseConfig();
  if (!config) {
    return true;
  }

  try {
    await callCmsRpc('add_cms_visit', {
      p_trip_id: params.tripId,
      p_place_id: params.placeId,
      p_title: params.title,
      p_occurred_at: params.occurredAt ?? null,
      p_visibility: params.visibility ?? 'public',
      p_presentation_category: params.presentationCategory ?? 'spot'
    });
    return true;
  } catch (err) {
    console.warn('[CMS API] Failed to add visit via RPC:', err);
    return false;
  }
}

/**
 * Fetch available places for Place correction selection.
 */
export async function fetchTripPlaces(
  tripSlug?: string
): Promise<Array<{ id: string; canonicalName: string; coordinate: [number, number] | null }>> {
  const config = getSupabaseConfig();
  if (!config) {
    // Return places from fixture as fallback
    const seen = new Set<string>();
    const places: Array<{ id: string; canonicalName: string; coordinate: [number, number] | null }> = [];
    for (const v of INITIAL_TRIP_FIXTURE.visits) {
      if (!seen.has(v.placeName)) {
        seen.add(v.placeName);
        places.push({
          id: `place-${seen.size}`,
          canonicalName: v.placeName,
          coordinate: v.coordinate
        });
      }
    }
    return places;
  }

  try {
    const endpoint = new URL('/rest/v1/cms_places', config.url);
    endpoint.searchParams.set('select', 'id,canonical_name,location');
    endpoint.searchParams.set('limit', '100');

    const res = await fetch(endpoint, {
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${config.publishableKey}`,
        'Accept-Profile': CMS_SCHEMA
      },
      cache: 'no-store'
    });

    if (!res.ok) throw new Error(`Status ${res.status}`);
    const rows = await res.json();
    return rows.map((r: any) => ({
      id: r.id,
      canonicalName: r.canonical_name,
      coordinate: null // Coordinate extracted if geography point is returned
    }));
  } catch (err) {
    console.warn('[CMS API] Failed to fetch places:', err);
    return [];
  }
}

/**
 * Fetch confirmed visit IDs directly from DB (Authoritative source of truth).
 */
export async function fetchConfirmedVisitIds(
  tripSlug: string,
  options: { signal?: AbortSignal } = {}
): Promise<{ success: boolean; confirmedIds?: Set<string>; error?: string }> {
  const config = getSupabaseConfig();
  if (!config) {
    return { success: false, error: '未設定 Supabase 連線，無法從資料庫同步審核狀態。' };
  }

  try {
    const rows = await callCmsRpc<PublicVisitRow[]>(
      'get_draft_preview_visits',
      { p_trip_slug: tripSlug },
      options.signal
    );
    const confirmedIds = new Set((rows || []).map(r => r.visit_id));
    return { success: true, confirmedIds };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[CMS API] Failed to fetch confirmed visits for ${tripSlug}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Fetch draft trip preview data (visits + trajectory).
 * Strictly filters: only confirmed + public visits are returned by the database.
 * No client-side fallback or artificial supplementation.
 */
export async function fetchDraftPreview(
  tripSlug: string,
  options: { signal?: AbortSignal } = {}
): Promise<{
  places: EnrichedPlace[];
  trajectory: PublicTrajectorySegment[];
  isEligible: boolean;
  error?: string;
}> {
  const config = getSupabaseConfig();

  if (!config) {
    return {
      places: [],
      trajectory: [],
      isEligible: false,
      error: '未設定 Supabase 連線，無法載入草稿預覽。'
    };
  }

  try {
    const [visitRows, trajRows] = await Promise.all([
      callCmsRpc<PublicVisitRow[]>('get_draft_preview_visits', { p_trip_slug: tripSlug }, options.signal),
      callCmsRpc<PublicTrajectoryRpcRow[]>('get_draft_preview_trajectory', { p_trip_slug: tripSlug }, options.signal)
    ]);

    const places = mapPublicReadModelToEnrichedPlaces(visitRows || [], []);
    const trajectory = mapPublicTrajectoryRows(trajRows || []);

    return {
      places,
      trajectory,
      isEligible: trajectory.length > 0 && places.length > 0
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[CMS API] Failed to fetch draft preview for ${tripSlug}:`, errorMsg);
    return {
      places: [],
      trajectory: [],
      isEligible: false,
      error: errorMsg
    };
  }
}
