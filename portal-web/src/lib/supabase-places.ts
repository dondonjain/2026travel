import type { EnrichedPlace, MediaItem } from '@/types/itinerary';
import { narrativeDwellMsFromPublicValue } from './narrative-dwell.js';

const PUBLIC_SCHEMA = 'api_public';
const DEFAULT_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80';

export interface PublicTripRow {
  slug: string;
}

export interface PublicVisitRow {
  trip_slug: string;
  visit_id: string;
  title: string | null;
  description: string | null;
  occurred_at: string | null;
  narrative_dwell_ms: number | null;
  time_zone: string | null;
  presentation_category: string | null;
  tags: string[] | null;
  is_highlight: boolean;
  place_name: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface PublicVisitMediaRow {
  trip_slug: string;
  visit_id: string;
  media_type: 'image' | 'youtube' | 'external_video';
  url: string;
  thumbnail_url: string | null;
  title: string | null;
  caption: string | null;
  display_order: number;
  origin_kind: string;
}

export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
}

interface FetchSupabasePlacesOptions {
  config?: SupabasePublicConfig;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

function getSupabasePublicConfig(): SupabasePublicConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    );
  }

  return { url, publishableKey };
}

function getDateStr(timestamp: string | null, timeZone: string | null): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function formatTimestamp(timestamp: string | null, timeZone: string | null): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  try {
    return date.toLocaleString('zh-TW', {
      timeZone: timeZone || undefined,
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch {
    return date.toLocaleString('zh-TW', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }
}

function getYouTubeThumbnail(urlOrId: string): string {
  let id = urlOrId;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) {
    try {
      const parsed = new URL(urlOrId);
      id = parsed.hostname === 'youtu.be'
        ? parsed.pathname.slice(1)
        : parsed.searchParams.get('v') || parsed.pathname.replace('/embed/', '');
    } catch {
      return '';
    }
  }
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '';
}

function getCoverImage(media: MediaItem[]): string {
  const firstImage = media.find((item) => item.type === 'image' && item.url);
  if (firstImage) return firstImage.url;

  const firstYouTube = media.find((item) => item.type === 'youtube' && item.url);
  if (firstYouTube) {
    return firstYouTube.thumbnail || getYouTubeThumbnail(firstYouTube.url) || DEFAULT_FALLBACK_IMAGE;
  }

  const firstExternal = media.find(
    (item) => item.type === 'external-video' && item.thumbnail
  );
  return firstExternal?.thumbnail || DEFAULT_FALLBACK_IMAGE;
}

function mapMedia(row: PublicVisitMediaRow): MediaItem {
  return {
    type: row.media_type === 'external_video' ? 'external-video' : row.media_type,
    url: row.url,
    title: row.title || undefined,
    caption: row.caption || undefined,
    thumbnail: row.thumbnail_url || undefined
  };
}

function mapCategory(value: string | null): EnrichedPlace['category'] {
  return value === 'spot' || value === 'food' || value === 'stay' ||
    value === 'transit' || value === 'other'
    ? value
    : 'other';
}

function mapCoordinates(row: PublicVisitRow): [number, number] | null {
  return typeof row.longitude === 'number' && Number.isFinite(row.longitude) &&
    typeof row.latitude === 'number' && Number.isFinite(row.latitude)
    ? [row.longitude, row.latitude]
    : null;
}

export function mapPublicReadModelToEnrichedPlaces(
  visits: PublicVisitRow[],
  mediaRows: PublicVisitMediaRow[]
): EnrichedPlace[] {
  const mediaByVisit = new Map<string, MediaItem[]>();
  [...mediaRows]
    .sort((a, b) => a.display_order - b.display_order)
    .forEach((row) => {
      const items = mediaByVisit.get(row.visit_id) || [];
      items.push(mapMedia(row));
      mediaByVisit.set(row.visit_id, items);
    });

  const visitDates = visits.map((visit) => getDateStr(visit.occurred_at, visit.time_zone));
  const uniqueDates = Array.from(new Set(visitDates.filter(Boolean))).sort();
  const dateToDay = new Map(uniqueDates.map((date, index) => [date, index + 1]));

  return visits
    .map((visit, index): EnrichedPlace => {
      const media = mediaByVisit.get(visit.visit_id) || [];
      const dateStr = visitDates[index];
      return {
        id: visit.visit_id,
        title: visit.title || visit.place_name || '未命名景點',
        description: (visit.description || '').replace(/:\d{2}。/g, '。'),
        tags: Array.isArray(visit.tags) ? visit.tags : [],
        category: mapCategory(visit.presentation_category),
        isHighlight: visit.is_highlight,
        media,
        coordinates: mapCoordinates(visit),
        timestamp: visit.occurred_at || undefined,
        narrativeDwellMs: narrativeDwellMsFromPublicValue(visit.narrative_dwell_ms),
        formattedTime: formatTimestamp(visit.occurred_at, visit.time_zone),
        coverImageUrl: getCoverImage(media),
        dayNumber: dateStr ? dateToDay.get(dateStr) || 1 : 1,
        dateStr
      };
    })
    .sort((a, b) => {
      if (a.isHighlight && !b.isHighlight) return -1;
      if (!a.isHighlight && b.isHighlight) return 1;
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB;
    });
}

async function fetchPublicRows<T>(
  resource: 'public_trips' | 'public_trip_visits' | 'public_visit_media',
  query: Record<string, string>,
  config: SupabasePublicConfig,
  fetchImpl: typeof fetch,
  signal?: AbortSignal
): Promise<T[]> {
  const endpoint = new URL(`/rest/v1/${resource}`, config.url);
  Object.entries(query).forEach(([key, value]) => endpoint.searchParams.set(key, value));

  const response = await fetchImpl(endpoint, {
    method: 'GET',
    headers: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${config.publishableKey}`,
      'Accept-Profile': PUBLIC_SCHEMA
    },
    cache: 'no-store',
    signal
  });

  if (!response.ok) {
    throw new Error(`Supabase public read failed for ${resource} (${response.status}).`);
  }

  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) {
    throw new Error(`Supabase public read returned an invalid ${resource} payload.`);
  }
  return rows as T[];
}

export async function fetchSupabaseEnrichedPlaces(
  tripSlug: string,
  options: FetchSupabasePlacesOptions = {}
): Promise<EnrichedPlace[]> {
  if (!tripSlug.trim()) {
    throw new Error('A public trip slug is required.');
  }

  const config = options.config || getSupabasePublicConfig();
  const fetchImpl = options.fetchImpl || fetch;
  const slugFilter = `eq.${tripSlug}`;

  const trips = await fetchPublicRows<PublicTripRow>(
    'public_trips',
    { select: 'slug', slug: slugFilter, limit: '1' },
    config,
    fetchImpl,
    options.signal
  );
  if (trips.length === 0) {
    throw new Error(`Published trip not found: ${tripSlug}`);
  }

  const [visits, media] = await Promise.all([
    fetchPublicRows<PublicVisitRow>(
      'public_trip_visits',
      {
        select: 'trip_slug,visit_id,title,description,occurred_at,narrative_dwell_ms,time_zone,presentation_category,tags,is_highlight,place_name,latitude,longitude',
        trip_slug: slugFilter
      },
      config,
      fetchImpl,
      options.signal
    ),
    fetchPublicRows<PublicVisitMediaRow>(
      'public_visit_media',
      {
        select: 'trip_slug,visit_id,media_type,url,thumbnail_url,title,caption,display_order,origin_kind',
        trip_slug: slugFilter
      },
      config,
      fetchImpl,
      options.signal
    )
  ]);

  return mapPublicReadModelToEnrichedPlaces(visits, media);
}
