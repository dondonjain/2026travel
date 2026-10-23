import type { PublicTrajectorySegment, SafeCoordinate } from './narrative-playback';
import type { SupabasePublicConfig } from './supabase-places';

const PUBLIC_SCHEMA = 'api_public';

export interface PublicTrajectoryRpcRow {
  segment_index: number;
  geometry: unknown;
  has_hidden_gap_after: boolean;
}

interface FetchPublicTrajectoryOptions {
  config?: SupabasePublicConfig;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

function normalizePublicLineString(value: unknown): SafeCoordinate[] | null {
  if (!value || typeof value !== 'object') return null;
  const geometry = value as { type?: unknown; coordinates?: unknown };
  if (geometry.type !== 'LineString' || !Array.isArray(geometry.coordinates)) return null;
  const coordinates = geometry.coordinates.filter((coordinate): coordinate is SafeCoordinate => (
    Array.isArray(coordinate) && coordinate.length >= 2 &&
    typeof coordinate[0] === 'number' && Number.isFinite(coordinate[0]) &&
    typeof coordinate[1] === 'number' && Number.isFinite(coordinate[1])
  ));
  return coordinates.length >= 2 ? coordinates : null;
}

function getSupabasePublicConfig(): SupabasePublicConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  }
  return { url, publishableKey };
}

export function mapPublicTrajectoryRows(rows: PublicTrajectoryRpcRow[]): PublicTrajectorySegment[] {
  return rows
    .map((row) => {
      const coordinates = normalizePublicLineString(row.geometry);
      return coordinates && Number.isInteger(row.segment_index) && row.segment_index > 0
        ? {
            segmentIndex: row.segment_index,
            coordinates,
            hasHiddenGapAfter: row.has_hidden_gap_after === true
          }
        : null;
    })
    .filter((segment): segment is PublicTrajectorySegment => segment !== null)
    .sort((left, right) => left.segmentIndex - right.segmentIndex);
}

export async function fetchPublicTrajectory(
  tripSlug: string,
  options: FetchPublicTrajectoryOptions = {}
): Promise<PublicTrajectorySegment[]> {
  if (!tripSlug.trim()) throw new Error('A public trip slug is required.');
  const config = options.config || getSupabasePublicConfig();
  const fetchImpl = options.fetchImpl || fetch;
  const endpoint = new URL('/rest/v1/rpc/get_public_trajectory', config.url);
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${config.publishableKey}`,
      'Content-Profile': PUBLIC_SCHEMA,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_trip_slug: tripSlug }),
    cache: 'no-store',
    signal: options.signal
  });
  if (!response.ok) throw new Error(`Supabase public trajectory read failed (${response.status}).`);
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error('Supabase public trajectory returned an invalid payload.');
  return mapPublicTrajectoryRows(rows as PublicTrajectoryRpcRow[]);
}
