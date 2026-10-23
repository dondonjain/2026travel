import { TrajectoryAnalyzer, type ResolutionVisit, type TimelineObservation, type TrajectoryAnalysis } from './trajectory-analyzer';
import { PoiFetcher, OverpassAdapter, MapboxSearchBoxAdapter, type AreaContext } from './poi-fetcher';
import { PoiRankingEngine, type RankedPoi } from './poi-ranking-engine';

export interface PlaceResolveRequest extends ResolutionVisit {
  googlePlaceId?: string | null;
  semanticType?: string | null;
  existingName?: string | null;
  preferredLanguage?: string;
  timelinePath?: TimelineObservation[];
}
export type ResolutionStatus = 'HIGH_CONFIDENCE_SUGGESTED' | 'AMBIGUOUS_CANDIDATES' | 'SPATIAL_CONFLICT_OVERNIGHT' | 'SPATIAL_CONFLICT' | 'NO_CANDIDATES';
export interface PlaceResolveResult extends TrajectoryAnalysis {
  name: string;
  source: 'existing' | 'overpass' | 'mapbox' | 'fallback';
  status: ResolutionStatus;
  candidates: RankedPoi[];
  fallbackAreaContext: AreaContext[];
  providerFailures: string[];
}
// Display-name validity never establishes POI identity.
export function isValidSpecificName(name?: string | null): boolean {
  return typeof name === 'string' && !!name.trim() && !/^(造訪場所|停留點|未知地點|旅程景點|Visit|Place)\s*\d*$/i.test(name.trim());
}
export function clearPlaceResolutionCache(): void { /* Visit context is never cached by coordinate. */ }
export async function resolvePlaceName(req: PlaceResolveRequest, fetcher?: PoiFetcher): Promise<PlaceResolveResult> {
  const analysis = new TrajectoryAnalyzer().analyze(req, req.timelinePath || []);
  const providers = fetcher || new PoiFetcher([new OverpassAdapter(), new MapboxSearchBoxAdapter(
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_ACCESS_TOKEN || process.env.MAPBOX_TOKEN)]);
  const fetched = await providers.fetch(analysis.searchAnchors);
  const candidates = new PoiRankingEngine().rank(fetched.candidates, analysis, req.isSubVisit);
  const top = candidates[0];
  const confident = !!top && top.distanceMeters <= 100 && top.totalScore >= 0.6 &&
    !fetched.providerFailures.length && (!candidates[1] || top.totalScore - candidates[1].totalScore >= 0.2);
  const status: ResolutionStatus = analysis.hasSpatialConflict
    ? (analysis.isOvernight ? 'SPATIAL_CONFLICT_OVERNIGHT' : 'SPATIAL_CONFLICT')
    : !top ? 'NO_CANDIDATES' : confident ? 'HIGH_CONFIDENCE_SUGGESTED' : 'AMBIGUOUS_CANDIDATES';
  return { ...analysis, ...fetched, candidates, status,
    name: analysis.hasSpatialConflict ? '待辨識場所（來源位置有衝突）' : top?.name || (isValidSpecificName(req.existingName) ? req.existingName!.trim() : '待辨識場所'),
    source: analysis.hasSpatialConflict ? 'fallback' : top?.source || (isValidSpecificName(req.existingName) ? 'existing' : 'fallback') };
}
export async function resolvePlacesBatch(requests: PlaceResolveRequest[]): Promise<PlaceResolveResult[]> {
  const results: PlaceResolveResult[] = [];
  for (const request of requests) results.push(await resolvePlaceName(request));
  return results;
}
// Suggestions never constitute human confirmation. Search Box data remains transient.
export function automaticPlaceId(visit: { resolution?: Pick<PlaceResolveResult, 'status' | 'hasSpatialConflict'> }, placeId?: string): string | null {
  if (visit.resolution) return null;
  return placeId || null;
}

export function persistedResolutionStatus(resolution?: Pick<PlaceResolveResult, 'status' | 'hasSpatialConflict' | 'isOvernight'>): ResolutionStatus | null {
  if (!resolution) return null;
  return resolution.hasSpatialConflict
    ? (resolution.isOvernight ? 'SPATIAL_CONFLICT_OVERNIGHT' : 'SPATIAL_CONFLICT')
    : resolution.status;
}
