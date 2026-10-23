import { distanceMeters, validCoordinate, type Coordinate, type SearchAnchor } from './trajectory-analyzer';

export interface PoiCandidate {
  id: string;
  name: string;
  coordinate: Coordinate;
  categories: string[];
  source: 'overpass' | 'mapbox';
  sourceIds: string[];
}
export interface AreaContext { name: string; type: string; source: string }
export interface PoiFetchResult {
  candidates: PoiCandidate[];
  fallbackAreaContext: AreaContext[];
  providerFailures: string[];
}
export interface PoiAdapter { search(anchor: SearchAnchor): Promise<PoiFetchResult> }
const empty = (): PoiFetchResult => ({ candidates: [], fallbackAreaContext: [], providerFailures: [] });
interface OverpassElement {
  id?: number; type?: string; lon?: number; lat?: number;
  center?: { lon?: number; lat?: number };
  tags?: Record<string, string>;
}
interface SearchFeature {
  properties?: { name?: string; feature_type?: string; mapbox_id?: string; poi_category_ids?: unknown[] };
  geometry?: { coordinates?: unknown };
}

export function mergeNearbyPois(candidates: PoiCandidate[]): PoiCandidate[] {
  const merged: PoiCandidate[] = [];
  for (const candidate of candidates) {
    const match = merged.find(p => p.source === candidate.source &&
      (p.id === candidate.id || (p.name.normalize('NFKC').trim().toLowerCase() === candidate.name.normalize('NFKC').trim().toLowerCase() &&
        p.categories.some(c => candidate.categories.includes(c)) && distanceMeters(p.coordinate, candidate.coordinate) <= 40)));
    if (match) match.sourceIds = [...new Set([...match.sourceIds, ...candidate.sourceIds])];
    else merged.push({ ...candidate, sourceIds: [...candidate.sourceIds] });
  }
  return merged;
}
export class OverpassAdapter implements PoiAdapter {
  constructor(private readonly request: typeof fetch = fetch) {}
  async search(anchor: SearchAnchor): Promise<PoiFetchResult> {
    const result = empty();
    if (!validCoordinate(anchor.coordinate)) return result;
    const [lng, lat] = anchor.coordinate;
    const around = `(around:500,${lat},${lng})`;
    const query = `[out:json][timeout:10];(nwr${around}[tourism];nwr${around}[amenity];nwr${around}[shop];);out center tags;`;
    const response = await this.request('https://overpass-api.de/api/interpreter', {
      method: 'POST', body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error('overpass_unavailable');
    const data = await response.json();
    for (const item of (Array.isArray(data.elements) ? data.elements : []) as OverpassElement[]) {
      const tags = item.tags || {};
      if (typeof tags.name !== 'string' || !tags.name.trim()) continue;
      if (tags.boundary === 'administrative' || tags.place) {
        result.fallbackAreaContext.push({ name: tags.name, type: tags.place || 'administrative', source: 'overpass' });
        continue;
      }
      const coordinate = [item.lon ?? item.center?.lon, item.lat ?? item.center?.lat];
      const categories = [tags.tourism, tags.amenity, tags.shop ? 'shop' : null].filter((v): v is string => typeof v === 'string');
      if (!validCoordinate(coordinate) || !categories.length || item.id == null || !item.type) continue;
      const id = `osm:${item.type}:${item.id}`;
      result.candidates.push({ id, name: tags.name, coordinate, categories, source: 'overpass', sourceIds: [id] });
    }
    result.candidates = mergeNearbyPois(result.candidates);
    return result;
  }
}
export class MapboxSearchBoxAdapter implements PoiAdapter {
  constructor(private readonly token: string | undefined, private readonly request: typeof fetch = fetch) {}
  async search(anchor: SearchAnchor): Promise<PoiFetchResult> {
    const result = empty();
    if (!this.token || !validCoordinate(anchor.coordinate)) return result;
    const params = new URLSearchParams({ longitude: String(anchor.coordinate[0]), latitude: String(anchor.coordinate[1]), access_token: this.token, limit: '5' });
    const response = await this.request(`https://api.mapbox.com/search/searchbox/v1/reverse?${params}`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('mapbox_unavailable');
    const data = await response.json();
    for (const feature of (Array.isArray(data.features) ? data.features : []) as SearchFeature[]) {
      const p = feature.properties || {};
      if (typeof p.name !== 'string') continue;
      if (p.feature_type !== 'poi') {
        result.fallbackAreaContext.push({ name: p.name, type: p.feature_type || 'unknown', source: 'mapbox' });
        continue;
      }
      const coordinate = feature.geometry?.coordinates;
      if (!validCoordinate(coordinate) || typeof p.mapbox_id !== 'string') continue;
      result.candidates.push({ id: p.mapbox_id, name: p.name, coordinate,
        categories: Array.isArray(p.poi_category_ids) ? p.poi_category_ids.filter((c: unknown) => typeof c === 'string') : [],
        source: 'mapbox', sourceIds: [p.mapbox_id] });
    }
    return result;
  }
}
export class PoiFetcher {
  constructor(private readonly adapters: PoiAdapter[]) {}
  async fetch(anchors: SearchAnchor[]): Promise<PoiFetchResult> {
    const result = empty();
    for (const anchor of anchors) for (const adapter of this.adapters) {
      try {
        const fetched = await adapter.search(anchor);
        result.candidates.push(...fetched.candidates);
        result.fallbackAreaContext.push(...fetched.fallbackAreaContext);
        result.providerFailures.push(...fetched.providerFailures);
      } catch { result.providerFailures.push(adapter.constructor.name); }
    }
    result.candidates = mergeNearbyPois(result.candidates);
    result.fallbackAreaContext = result.fallbackAreaContext.filter((a, i, all) => all.findIndex(b => a.source === b.source && a.type === b.type && a.name === b.name) === i);
    return result;
  }
}
