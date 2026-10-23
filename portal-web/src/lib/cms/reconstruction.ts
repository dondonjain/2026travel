import crypto from 'crypto';
import { CMSDay, CMSTrip, CMSVisit, ReviewStatus, Visibility, SubVenue, VisitEvidence } from './types';
import { isValidSpecificName, resolvePlacesBatch, PlaceResolveRequest } from './place-resolver';
import { TrajectoryAnalyzer } from './trajectory-analyzer';

export interface RawTimelineVisitCandidate {
  probability?: string | number;
  semanticType?: string;
  placeID?: string;
  placeLocation?: string; // "geo:lat,lng"
  placeName?: string;
}

export interface RawTimelineVisit {
  hierarchyLevel?: string | number;
  probability?: string | number;
  topCandidate?: RawTimelineVisitCandidate;
}

export interface RawTimelineActivityCandidate {
  type?: string;
  probability?: string | number;
}

export interface RawTimelineActivity {
  probability?: string | number;
  start?: string; // "geo:lat,lng"
  end?: string;   // "geo:lat,lng"
  topCandidate?: RawTimelineActivityCandidate;
  distanceMeters?: string | number;
}

export interface RawTimelinePathPoint {
  point?: string; // "geo:lat,lng"
  durationMinutesOffsetFromStartTime?: string | number;
}

export interface RawTimelineEntry {
  startTime?: string;
  endTime?: string;
  visit?: RawTimelineVisit;
  activity?: RawTimelineActivity;
  timelinePath?: RawTimelinePathPoint[];
}

export interface IngestionPlace {
  id: string;
  canonicalName: string;
  location: [number, number]; // [lng, lat]
  locationStatus: 'verified' | 'unverified';
  googlePlaceId?: string | null;
  visitCount: number;
  candidateVisitIds: string[];
}

export interface IngestionTrajectorySample {
  id: string;
  sequenceNo: number;
  coordinate: [number, number]; // [lng, lat]
  recordedAt: string; // ISO
  timeBasis: 'observed' | 'interpolated';
  sourceRecordKey: string;
}

export interface IngestionSourceRecord {
  id: string;
  sourceKind: string;
  sourceKey: string;
  startedAt?: string | null;
  endedAt?: string | null;
  rawPayload: any;
}

export interface IngestionAnomalyReport {
  summary: {
    totalShortStopsRemoved: number;
    totalEndpointAnomalies: number;
    totalFlattenedRecords: number;
    cleanCandidateVisitsProduced: number;
  };
  shortStopsRemoved: Array<{
    sourceIndex: number;
    startTime: string;
    endTime?: string;
    durationSec: number;
    coordinate?: [number, number] | null;
    placeID?: string | null;
    reason: string;
  }>;
  endpointAnomalies: Array<{
    sourceIndex: number;
    startTime: string;
    coordinate?: [number, number] | null;
    placeID?: string | null;
    reason: string;
  }>;
  flattenedRecords: Array<{
    flattenedSourceIndex: number;
    primarySourceIndex: number;
    reason: string;
  }>;
}

export interface ReconstructedTripResult {
  trip: {
    id: string;
    slug: string;
    title: string;
    startsOn: string;
    endsOn: string;
    defaultTimeZone: string;
    publicationStatus: 'draft';
  };
  places: IngestionPlace[];
  visits: CMSVisit[];
  trajectory: {
    id: string;
    publicationStatus: 'draft';
    sourceStartedAt: string;
    sourceEndedAt: string;
  };
  sourceRecords: IngestionSourceRecord[];
  samples: IngestionTrajectorySample[];
  anomalyReport: IngestionAnomalyReport;
  cmsTrip: CMSTrip;
  stats: {
    rawTimelineEntriesScanned: number;
    rawVisitsInWindow: number;
    shortStopsFiltered: number;
    endpointAnomaliesFiltered: number;
    duplicatesAndSubVenuesFlattened: number;
    candidateVisitsProduced: number;
    uniquePlacesIdentified: number;
    repeatedPlaceGroupsCount: number;
    trajectorySamplesCount: number;
  };
}

export interface ReconstructOptions {
  timelineData: RawTimelineEntry[];
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"
  tripSlug?: string;
  tripTitle?: string;
  timeZone?: string;
  placeMetadataMap?: Record<string, { title?: string; category?: string; tags?: string[] }>;
  targetRegionBounds?: {
    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
  };
}

// Distance helper using Haversine formula (km)
export function haversineDistanceKm(p1: [number, number], p2: [number, number]): number {
  const [lon1, lat1] = p1;
  const [lon2, lat2] = p2;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function parseGeoString(geoStr?: string | null): [number, number] | null {
  if (!geoStr || !geoStr.startsWith('geo:')) return null;
  const parts = geoStr.replace('geo:', '').split(',');
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  if (isNaN(lat) || isNaN(lng)) return null;
  return [lng, lat];
}

function formatTimeHHMM(isoString: string): string {
  try {
    const d = new Date(isoString);
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = (Math.round(d.getMinutes() / 10) * 10).toString().padStart(2, '0');
    if (minutes === '60') {
      const nextHour = (d.getHours() + 1).toString().padStart(2, '0');
      return `${nextHour}:00`;
    }
    return `${hours}:${minutes}`;
  } catch {
    return '12:00';
  }
}

function mapCategory(semanticType?: string): '交通' | '購物' | '美食' | '住宿' | '景點' | '休歇' {
  if (!semanticType) return '景點';
  const lower = semanticType.toLowerCase();
  if (lower.includes('station') || lower.includes('transit') || lower.includes('airport')) return '交通';
  if (lower.includes('shopping') || lower.includes('mall') || lower.includes('store')) return '購物';
  if (lower.includes('food') || lower.includes('restaurant') || lower.includes('cafe')) return '美食';
  if (lower.includes('hotel') || lower.includes('lodging')) return '住宿';
  if (lower.includes('rest') || lower.includes('park')) return '休歇';
  return '景點';
}

function autoGenerateTripTitle(startDate: string, endDate: string, primaryCity = '岡山'): string {
  try {
    const start = new Date(startDate);
    const year = start.getFullYear();
    const month = start.getMonth() + 1;
    let season = '季';
    if (month >= 3 && month <= 5) season = '春季';
    else if (month >= 6 && month <= 8) season = '夏季';
    else if (month >= 9 && month <= 11) season = '秋季';
    else season = '冬季';
    return `${year}年 ${month}月${season} ${primaryCity}旅行`;
  } catch {
    return `日本旅行 (${startDate})`;
  }
}

/**
 * Reconstructs a real Google Timeline JSON into structured CMS Draft entities:
 * - Draft Trip
 * - Places (with revisit clustering)
 * - Pending Visits (review_status = 'pending', visibility = 'public')
 * - Trajectory & Technical Samples
 * - Anomaly Report
 */
export function reconstructTimelineTrip(options: ReconstructOptions): ReconstructedTripResult {
  const {
    timelineData,
    startDate,
    endDate,
    timeZone = 'Asia/Tokyo',
    placeMetadataMap = {},
    targetRegionBounds = { minLng: 128, maxLng: 145, minLat: 30, maxLat: 46 } // Default Japan bounds
  } = options;

  if (!Array.isArray(timelineData) || timelineData.length === 0) {
    throw new Error('Invalid input: timelineData must be a non-empty array of Timeline entries.');
  }
  if (!startDate || !endDate) {
    throw new Error('Invalid input: startDate and endDate are required.');
  }

  const tripId = crypto.randomUUID();
  const tripSlug = options.tripSlug || `trip-${startDate.replace(/-/g, '')}`;
  const tripTitle = options.tripTitle || autoGenerateTripTitle(startDate, endDate);

  // Time boundaries in UTC milliseconds
  // Include safety buffers (12 hours before start, 24 hours after end) to capture boundary transitions
  const scanStart = new Date(`${startDate}T00:00:00+09:00`).getTime() - 12 * 3600 * 1000;
  const scanEnd = new Date(`${endDate}T23:59:59+09:00`).getTime() + 24 * 3600 * 1000;
  const tripLocalEnd = new Date(`${endDate}T23:59:59+09:00`).getTime();

  // Phase 1: Ingestion & Extraction
  const rawVisits: any[] = [];
  const rawActivities: any[] = [];
  const rawPathPoints: any[] = [];
  const sourceRecords: IngestionSourceRecord[] = [];

  timelineData.forEach((item, originalIndex) => {
    if (!item.startTime) return;
    const itemStart = new Date(item.startTime).getTime();
    if (itemStart < scanStart || itemStart > scanEnd) return;

    const sourceRecordKey = `timeline_entry_${originalIndex}`;
    const sourceRecordId = crypto.randomUUID();

    sourceRecords.push({
      id: sourceRecordId,
      sourceKind: item.visit ? 'timeline_visit' : item.activity ? 'timeline_activity' : 'timeline_path',
      sourceKey: sourceRecordKey,
      startedAt: item.startTime,
      endedAt: item.endTime || null,
      rawPayload: item
    });

    if (item.visit) {
      const top = item.visit.topCandidate || {};
      const coord = parseGeoString(top.placeLocation);
      const s = new Date(item.startTime).getTime();
      const e = item.endTime ? new Date(item.endTime).getTime() : s;
      const durationSec = Math.max(0, Math.round((e - s) / 1000));

      rawVisits.push({
        sourceIndex: originalIndex,
        sourceRecordKey,
        startTime: item.startTime,
        endTime: item.endTime,
        startTimestamp: s,
        endTimestamp: e,
        durationSec,
        durationMinutes: Math.round(durationSec / 60),
        hierarchyLevel: parseInt(String(item.visit.hierarchyLevel || '0'), 10),
        placeLocationRaw: top.placeLocation,
        coordinate: coord,
        placeID: top.placeID || null,
        semanticType: top.semanticType || 'Unknown',
        probability: parseFloat(String(item.visit.probability || '0')),
        candidateProbability: parseFloat(String(top.probability || '0')),
        topCandidateName: top.placeName || null
      });
    }

    if (item.activity) {
      const startCoord = parseGeoString(item.activity.start);
      const endCoord = parseGeoString(item.activity.end);
      const s = new Date(item.startTime).getTime();
      const e = item.endTime ? new Date(item.endTime).getTime() : s;
      const top = item.activity.topCandidate || {};

      rawActivities.push({
        sourceIndex: originalIndex,
        sourceRecordKey,
        startTime: item.startTime,
        endTime: item.endTime,
        startTimestamp: s,
        endTimestamp: e,
        durationSec: Math.max(0, Math.round((e - s) / 1000)),
        type: top.type || 'unknown',
        distanceMeters: parseFloat(String(item.activity.distanceMeters || '0')),
        startCoordinate: startCoord,
        endCoordinate: endCoord
      });
    }

    if (item.timelinePath && Array.isArray(item.timelinePath)) {
      const baseStart = new Date(item.startTime).getTime();
      item.timelinePath.forEach((tp, pIdx) => {
        const coord = parseGeoString(tp.point);
        const offsetMin = parseInt(String(tp.durationMinutesOffsetFromStartTime || '0'), 10);
        const ptTimestamp = baseStart + offsetMin * 60000;
        if (coord) {
          rawPathPoints.push({
            coordinate: coord,
            timestamp: ptTimestamp,
            isoTime: new Date(ptTimestamp).toISOString(),
            sourceIndex: originalIndex,
            sourceRecordKey,
            pathPointIndex: pIdx
          });
        }
      });
    }
  });

  // Phase 2: Boundary & Noise Filtering
  const shortStopsRemoved: any[] = [];
  const endpointAnomalies: any[] = [];
  const validRawVisits: any[] = [];

  rawVisits.sort((a, b) => a.startTimestamp - b.startTimestamp);

  rawVisits.forEach((visit) => {
    // 1. Geographic & Date Endpoint Anomaly Check
    const isOutsideBounds = visit.coordinate && (
      visit.coordinate[0] < targetRegionBounds.minLng ||
      visit.coordinate[0] > targetRegionBounds.maxLng ||
      visit.coordinate[1] < targetRegionBounds.minLat ||
      visit.coordinate[1] > targetRegionBounds.maxLat
    );
    const isPastTripEndDate = visit.startTimestamp > tripLocalEnd;

    if (isOutsideBounds || isPastTripEndDate) {
      endpointAnomalies.push({
        sourceIndex: visit.sourceIndex,
        startTime: visit.startTime,
        coordinate: visit.coordinate,
        placeID: visit.placeID,
        reason: isOutsideBounds
          ? `Coordinate [${visit.coordinate}] outside target region bounds (${targetRegionBounds.minLng}-${targetRegionBounds.maxLng}, ${targetRegionBounds.minLat}-${targetRegionBounds.maxLat})`
          : `Timestamp ${visit.startTime} past trip end date ${endDate}`
      });
      return;
    }

    // 2. Short-stop noise filter (<= 180 seconds / 3 minutes)
    if (visit.durationSec < 180) {
      shortStopsRemoved.push({
        sourceIndex: visit.sourceIndex,
        startTime: visit.startTime,
        endTime: visit.endTime,
        durationSec: visit.durationSec,
        coordinate: visit.coordinate,
        placeID: visit.placeID,
        reason: `Duration ${visit.durationSec}s < 180s threshold`
      });
      return;
    }

    validRawVisits.push(visit);
  });

  // Phase 2.5: Hierarchy Flattening & Deduplication
  const flattenedRecords: any[] = [];
  const unflattenedVisits: any[] = [];

  validRawVisits.forEach((visit) => {
    let mergeTargetIndex = -1;
    let mergeReason: string | null = null;
    let shouldSwapPrimary = false;

    for (let i = 0; i < unflattenedVisits.length; i++) {
      const existing = unflattenedVisits[i];
      const timeDiffSec = Math.abs(visit.startTimestamp - existing.startTimestamp) / 1000;
      const isOverlapping = existing.endTimestamp > visit.startTimestamp && existing.startTimestamp < visit.endTimestamp;
      const distMeters = (visit.coordinate && existing.coordinate)
        ? haversineDistanceKm(visit.coordinate, existing.coordinate) * 1000
        : Infinity;

      // Rule A: Near-timestamp clash (<= 30s & < 200m)
      if (timeDiffSec <= 30 && distMeters < 200) {
        mergeTargetIndex = i;
        mergeReason = `SAME_OR_NEAR_TIMESTAMP_CLASH_${Math.round(timeDiffSec)}S`;
        if (visit.hierarchyLevel === 0 && existing.hierarchyLevel > 0) {
          shouldSwapPrimary = true;
        }
        break;
      }

      // Rule B: Hierarchy containment (< 200m & overlapping time)
      if (isOverlapping && distMeters < 200) {
        if (visit.hierarchyLevel > 0 && existing.hierarchyLevel === 0) {
          mergeTargetIndex = i;
          mergeReason = 'HIERARCHY_LEVEL_1_NESTED_IN_LEVEL_0';
          break;
        } else if (visit.hierarchyLevel === 0 && existing.hierarchyLevel > 0) {
          mergeTargetIndex = i;
          mergeReason = 'HIERARCHY_LEVEL_1_NESTED_IN_LEVEL_0';
          shouldSwapPrimary = true;
          break;
        }
      }
    }

    if (mergeTargetIndex >= 0 && mergeReason) {
      if (shouldSwapPrimary) {
        const demoted = unflattenedVisits[mergeTargetIndex];
        const subVenues: SubVenue[] = demoted.subVenues || [];
        subVenues.push({
          title: demoted.topCandidateName || `停留點 (${demoted.semanticType})`,
          placeID: demoted.placeID || '',
          hierarchyLevel: demoted.hierarchyLevel,
          durationMinutes: demoted.durationMinutes,
          flattenReason: mergeReason
        });
        unflattenedVisits[mergeTargetIndex] = {
          ...visit,
          subVenues
        };
        flattenedRecords.push({
          flattenedSourceIndex: demoted.sourceIndex,
          primarySourceIndex: visit.sourceIndex,
          reason: mergeReason
        });
      } else {
        const primary = unflattenedVisits[mergeTargetIndex];
        if (!primary.subVenues) primary.subVenues = [];
        primary.subVenues.push({
          title: visit.topCandidateName || `停留點 (${visit.semanticType})`,
          placeID: visit.placeID || '',
          hierarchyLevel: visit.hierarchyLevel,
          durationMinutes: visit.durationMinutes,
          flattenReason: mergeReason
        });
        flattenedRecords.push({
          flattenedSourceIndex: visit.sourceIndex,
          primarySourceIndex: primary.sourceIndex,
          reason: mergeReason
        });
      }
    } else {
      unflattenedVisits.push({
        ...visit,
        subVenues: []
      });
    }
  });

  unflattenedVisits.sort((a, b) => a.startTimestamp - b.startTimestamp);

  // Phase 3: Place Identity Clustering & Revisit Resolution
  const placeIdentityMap = new Map<string, IngestionPlace>();
  let placeSeq = 1;

  unflattenedVisits.forEach((cv, idx) => {
    let matchedPlaceKey: string | null = null;

    // Match 1: Google PlaceID
    if (cv.placeID) {
      for (const [key, place] of placeIdentityMap.entries()) {
        if (place.googlePlaceId === cv.placeID) {
          matchedPlaceKey = key;
          break;
        }
      }
    }

    // Proximity is not identity: adjacent businesses and activity endpoints may
    // be distinct places. Without a matching Place ID, retain a separate Place.

    if (!matchedPlaceKey) {
      matchedPlaceKey = `place-${placeSeq++}`;

      let candidateName: string | null = null;
      if (!candidateName && isValidSpecificName(cv.topCandidateName)) {
        candidateName = cv.topCandidateName;
      }

      // If placeMetadataMap has explicit match by placeID
      if (!candidateName && cv.placeID && placeMetadataMap[cv.placeID]?.title) {
        candidateName = placeMetadataMap[cv.placeID].title || null;
      }

      const defaultName = candidateName || `造訪場所 ${placeSeq - 1}`;
      placeIdentityMap.set(matchedPlaceKey, {
        id: crypto.randomUUID(),
        canonicalName: defaultName,
        location: cv.coordinate || [0, 0],
        locationStatus: cv.coordinate ? 'verified' : 'unverified',
        googlePlaceId: cv.placeID || null,
        visitCount: 0,
        candidateVisitIds: []
      });
    }

    const place = placeIdentityMap.get(matchedPlaceKey)!;
    place.visitCount++;
    const visitId = crypto.randomUUID();
    place.candidateVisitIds.push(visitId);
    cv.assignedPlaceId = place.id;
    cv.assignedPlaceName = place.canonicalName;
    cv.assignedVisitId = visitId;
  });

  const places = Array.from(placeIdentityMap.values());

  // Phase 4: Construct CMSVisits and Days
  const startDateMs = new Date(`${startDate}T00:00:00+09:00`).getTime();
  const dayBuckets = new Map<number, CMSVisit[]>();

  const cmsVisits: CMSVisit[] = unflattenedVisits.map((v, i) => {
    const dayNumber = Math.max(1, Math.floor((v.startTimestamp - startDateMs) / (86400 * 1000)) + 1);

    // Check if placeMetadataMap has explicit match by placeID
    const meta = v.placeID && placeMetadataMap[v.placeID] ? placeMetadataMap[v.placeID] : {};
    const title = (v.topCandidateName && isValidSpecificName(v.topCandidateName))
      ? v.topCandidateName
      : (v.assignedPlaceName && isValidSpecificName(v.assignedPlaceName))
      ? `${v.assignedPlaceName}${v.assignedPlaceId && places.find(p => p.id === v.assignedPlaceId)!.visitCount > 1 ? ` (造訪 ${v.sourceIndex})` : ''}`
      : meta.title || v.assignedPlaceName || `造訪 ${v.sourceIndex}`;

    const evidence: VisitEvidence = {
      sourceIndex: v.sourceIndex,
      hierarchyLevel: v.hierarchyLevel,
      rawTimestamp: v.startTime,
      rawGeo: v.coordinate || undefined,
      candidateProbability: v.candidateProbability,
      semanticType: v.semanticType,
      topCandidateName: v.topCandidateName || undefined
    };

    const visit: CMSVisit = {
      id: v.assignedVisitId,
      dayNumber,
      title,
      placeName: v.assignedPlaceName,
      placeCategory: mapCategory(v.semanticType),
      startTime: formatTimeHHMM(v.startTime),
      endTime: v.endTime ? formatTimeHHMM(v.endTime) : formatTimeHHMM(v.startTime),
      durationMinutes: v.durationMinutes,
      coordinate: v.coordinate || null,
      reviewStatus: 'pending', // REQUIRED: All reconstructed visits start as Pending!
      visibility: 'public',    // REQUIRED: Approved default visibility is Public!
      issues: [],
      evidence,
      subVenues: v.subVenues && v.subVenues.length > 0 ? v.subVenues : undefined
    };

    const analysis = new TrajectoryAnalyzer().analyze({ coordinate: visit.coordinate,
      startedAt: v.startTime, endedAt: v.endTime, timeZone }, rawPathPoints);
    if (analysis.hasSpatialConflict) {
      visit.resolution = { ...analysis, status: analysis.isOvernight ? 'SPATIAL_CONFLICT_OVERNIGHT' : 'SPATIAL_CONFLICT',
        name: '待辨識場所（來源位置有衝突）', source: 'fallback', candidates: [], fallbackAreaContext: [], providerFailures: [] };
      visit.title = visit.resolution.name;
      visit.placeName = '待辨識場所';
      visit.issues.push({ id: 'spatial-conflict', type: 'place', severity: 'required',
        message: '觀測缺口超過 3 小時且位置相距超過 250 公尺，須人工確認場所。' });
    }

    if (!dayBuckets.has(dayNumber)) dayBuckets.set(dayNumber, []);
    dayBuckets.get(dayNumber)!.push(visit);

    return visit;
  });

  // Generate Days
  for (const place of places) {
    place.candidateVisitIds = place.candidateVisitIds.filter(id => !cmsVisits.find(v => v.id === id)?.resolution?.hasSpatialConflict);
    place.visitCount = place.candidateVisitIds.length;
  }
  places.splice(0, places.length, ...places.filter(p => p.visitCount > 0));
  const totalDays = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (86400 * 1000)) + 1);
  const cmsDays: CMSDay[] = [];
  for (let d = 1; d <= totalDays; d++) {
    const curDate = new Date(new Date(startDate).getTime() + (d - 1) * 86400 * 1000);
    const dateStr = curDate.toISOString().split('T')[0];
    const month = curDate.getMonth() + 1;
    const day = curDate.getDate();
    cmsDays.push({
      dayNumber: d,
      date: dateStr,
      label: `Day ${d} (${month}/${day})`,
      subtitle: dayBuckets.get(d)?.[0]?.title ? `${dayBuckets.get(d)![0].placeName} 行程` : '自由探索'
    });
  }

  // Phase 5: Trajectory Extraction & Continuity
  const allTrajectoryPoints: Array<{ coord: [number, number]; time: number; type: string; sourceKey: string }> = [];

  rawActivities.forEach(act => {
    if (act.startCoordinate) allTrajectoryPoints.push({ coord: act.startCoordinate, time: act.startTimestamp, type: `activity-start-${act.type}`, sourceKey: act.sourceRecordKey });
    if (act.endCoordinate) allTrajectoryPoints.push({ coord: act.endCoordinate, time: act.endTimestamp, type: `activity-end-${act.type}`, sourceKey: act.sourceRecordKey });
  });
  rawVisits.forEach(v => {
    if (v.coordinate) allTrajectoryPoints.push({ coord: v.coordinate, time: v.startTimestamp, type: 'visit-anchor', sourceKey: v.sourceRecordKey });
  });
  rawPathPoints.forEach(p => {
    allTrajectoryPoints.push({ coord: p.coordinate, time: p.timestamp, type: 'path-point', sourceKey: p.sourceRecordKey });
  });

  const tripTrajectoryPoints = allTrajectoryPoints.filter(pt => {
    return pt.time >= scanStart && pt.time <= tripLocalEnd &&
      pt.coord[0] >= targetRegionBounds.minLng && pt.coord[0] <= targetRegionBounds.maxLng &&
      pt.coord[1] >= targetRegionBounds.minLat && pt.coord[1] <= targetRegionBounds.maxLat;
  });
  tripTrajectoryPoints.sort((a, b) => a.time - b.time);

  const trajectoryId = crypto.randomUUID();
  const sourceStartedAt = tripTrajectoryPoints.length > 0 ? new Date(tripTrajectoryPoints[0].time).toISOString() : new Date(startDate).toISOString();
  const sourceEndedAt = tripTrajectoryPoints.length > 0 ? new Date(tripTrajectoryPoints[tripTrajectoryPoints.length - 1].time).toISOString() : new Date(endDate).toISOString();

  const samples: IngestionTrajectorySample[] = tripTrajectoryPoints.map((pt, seq) => ({
    id: crypto.randomUUID(),
    sequenceNo: seq + 1,
    coordinate: pt.coord,
    recordedAt: new Date(pt.time).toISOString(),
    timeBasis: pt.type === 'path-point' ? 'interpolated' : 'observed',
    sourceRecordKey: pt.sourceKey
  }));

  const anomalyReport: IngestionAnomalyReport = {
    summary: {
      totalShortStopsRemoved: shortStopsRemoved.length,
      totalEndpointAnomalies: endpointAnomalies.length,
      totalFlattenedRecords: flattenedRecords.length,
      cleanCandidateVisitsProduced: cmsVisits.length
    },
    shortStopsRemoved,
    endpointAnomalies,
    flattenedRecords
  };

  const cmsTrip: CMSTrip = {
    id: tripId,
    slug: tripSlug,
    title: tripTitle,
    startDate,
    endDate,
    publicationStatus: 'draft',
    usableTrajectory: samples.length > 0,
    days: cmsDays,
    visits: cmsVisits
  };

  return {
    trip: {
      id: tripId,
      slug: tripSlug,
      title: tripTitle,
      startsOn: startDate,
      endsOn: endDate,
      defaultTimeZone: timeZone,
      publicationStatus: 'draft'
    },
    places,
    visits: cmsVisits,
    trajectory: {
      id: trajectoryId,
      publicationStatus: 'draft',
      sourceStartedAt,
      sourceEndedAt
    },
    sourceRecords,
    samples,
    anomalyReport,
    cmsTrip,
    stats: {
      rawTimelineEntriesScanned: timelineData.length,
      rawVisitsInWindow: rawVisits.length,
      shortStopsFiltered: shortStopsRemoved.length,
      endpointAnomaliesFiltered: endpointAnomalies.length,
      duplicatesAndSubVenuesFlattened: flattenedRecords.length,
      candidateVisitsProduced: cmsVisits.length,
      uniquePlacesIdentified: places.length,
      repeatedPlaceGroupsCount: places.filter(p => p.visitCount > 1).length,
      trajectorySamplesCount: samples.length
    }
  };
}

/**
 * Asynchronously reconstruct a Timeline trip, automatically resolving places via PlaceResolver
 */
export async function reconstructTimelineTripAsync(
  options: ReconstructOptions
): Promise<ReconstructedTripResult> {
  const result = reconstructTimelineTrip(options);
  const observations = options.timelineData.flatMap(entry => (entry.timelinePath || []).flatMap(point => {
    const coordinate = parseGeoString(point.point);
    const timestamp = Date.parse(entry.startTime || '') + Number(point.durationMinutesOffsetFromStartTime || 0) * 60000;
    return coordinate && Number.isFinite(timestamp) ? [{ coordinate, timestamp }] : [];
  }));
  const requests: PlaceResolveRequest[] = result.visits.map(visit => {
    const entry = options.timelineData[visit.evidence.sourceIndex];
    return { coordinate: visit.coordinate, startedAt: entry.startTime, endedAt: entry.endTime,
      timeZone: options.timeZone, isSubVisit: visit.evidence.hierarchyLevel > 0,
      timelinePath: observations, existingName: visit.placeName };
  });
  const resolved = await resolvePlacesBatch(requests);
  result.visits.forEach((visit, i) => {
    visit.resolution = resolved[i];
    if (!visit.issues.some(issue => issue.id === 'spatial-conflict')) {
      visit.issues.push({ id: 'poi-review', type: 'place', severity: 'required', message: '場所候選尚待人工確認。' });
    }
  });
  result.places = [];
  result.stats.uniquePlacesIdentified = 0;
  result.stats.repeatedPlaceGroupsCount = 0;
  return result;
}
