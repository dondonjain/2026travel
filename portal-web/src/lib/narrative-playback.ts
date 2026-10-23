import type { EnrichedPlace } from '@/types/itinerary';
import {
  NARRATIVE_DWELL_FALLBACK_MS,
  narrativeDwellMsFromPublicValue
} from './narrative-dwell.js';

export { NARRATIVE_DWELL_FALLBACK_MS, narrativeDwellMsFromPublicValue };

export type SafeCoordinate = [number, number];
export type NarrativeMovementMode = 'car' | 'plane' | 'unknown';

export interface PublicTrajectorySegment {
  segmentIndex: number;
  coordinates: SafeCoordinate[];
  hasHiddenGapAfter: boolean;
}

export interface NarrativeRoutePart extends PublicTrajectorySegment {
  distanceKm: number;
}

export interface NarrativeMovement {
  routeParts: NarrativeRoutePart[];
  fromVisitId: string;
  toVisitId: string;
  mode: NarrativeMovementMode;
  distanceKm: number;
  durationMs: number;
  cameraFraming: NarrativeCameraFraming;
}

export interface NarrativeCameraFraming {
  zoom: number;
  pitch: number;
  durationMs: number;
}

export type NarrativeDayScope = number | 'all';

export type NarrativeMovementCameraAction =
  | { kind: 'frame'; movementKey: string; center: SafeCoordinate; framing: NarrativeCameraFraming }
  | { kind: 'follow'; movementKey: string; center: SafeCoordinate }
  | null;

export interface NarrativePlaybackTimeline {
  visits: Array<EnrichedPlace & { coordinates: SafeCoordinate }>;
  movements: NarrativeMovement[];
  unmappedVisitIds: string[];
  visitRoutePositions: Array<number | null>;
}

export interface NarrativeMovementFrame {
  partIndex: number;
  position: SafeCoordinate;
  bearing: number;
  visibleCoordinates: SafeCoordinate[];
  completedDistanceKm: number;
}

export const MVP_CAMERA = {
  focus: { zoom: 14.5, pitch: 35, durationMs: 800 },
  cardTarget: { zoom: 14.5, pitch: 35, durationMs: 1_200 },
  follow: { durationMs: 350 }
} as const;

// Narrative pacing is deliberately presentation-time, not historical travel time.
// The only modes currently available to the public client are explicit safe values;
// absent metadata stays unknown and uses camera-only presentation.
const MOVEMENT_PACING: Record<NarrativeMovementMode, { baseMs: number; msPerKm: number; maxMs: number }> = {
  car: { baseMs: 3_500, msPerKm: 280, maxMs: 14_000 },
  plane: { baseMs: 6_000, msPerKm: 85, maxMs: 18_000 },
  unknown: { baseMs: 4_500, msPerKm: 320, maxMs: 12_000 }
};

export const VISIT_DWELL_MS = 5_000;
export const REDACTION_GAP_TRANSITION_MS = 900;

export function shouldFollowMovementCamera(
  isPlaying: boolean,
  isDwelling: boolean,
  isGapTransition: boolean,
  elapsedMs: number,
  durationMs: number
): boolean {
  return isPlaying && !isDwelling && !isGapTransition && elapsedMs < durationMs;
}

function isSafeCoordinate(value: unknown): value is SafeCoordinate {
  return Array.isArray(value) && value.length >= 2 &&
    typeof value[0] === 'number' && Number.isFinite(value[0]) &&
    typeof value[1] === 'number' && Number.isFinite(value[1]);
}

function sameCoordinate(left: SafeCoordinate, right: SafeCoordinate): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

function dedupeCoordinates(coordinates: SafeCoordinate[]): SafeCoordinate[] {
  return coordinates.filter((coordinate, index) => index === 0 || !sameCoordinate(coordinate, coordinates[index - 1]));
}

export function normalizePublicLineString(value: unknown): SafeCoordinate[] | null {
  if (!value || typeof value !== 'object') return null;
  const geometry = value as { type?: unknown; coordinates?: unknown };
  if (geometry.type !== 'LineString' || !Array.isArray(geometry.coordinates)) return null;
  const coordinates = geometry.coordinates.filter(isSafeCoordinate);
  return coordinates.length >= 2 ? coordinates : null;
}

function radians(degrees: number): number {
  return degrees * Math.PI / 180;
}

export function publicLineDistanceKm(coordinates: SafeCoordinate[]): number {
  return coordinates.slice(1).reduce((total, coordinate, index) => {
    const previous = coordinates[index];
    const latDelta = radians(coordinate[1] - previous[1]);
    const lngDelta = radians(coordinate[0] - previous[0]);
    const a = Math.sin(latDelta / 2) ** 2 +
      Math.cos(radians(previous[1])) * Math.cos(radians(coordinate[1])) * Math.sin(lngDelta / 2) ** 2;
    return total + 6_371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, 0);
}

export function getMovementDurationMs(mode: NarrativeMovementMode, distanceKm: number): number {
  const policy = MOVEMENT_PACING[mode];
  const safeDistance = Math.max(0, Number.isFinite(distanceKm) ? distanceKm : 0);
  return Math.min(policy.maxMs, Math.round(policy.baseMs + safeDistance * policy.msPerKm));
}

export function getMvpMovementCameraFraming(
  routeParts: NarrativeRoutePart[],
  mode: NarrativeMovementMode = 'unknown'
): NarrativeCameraFraming {
  if (mode === 'plane') return { zoom: 5, pitch: 15, durationMs: MVP_CAMERA.follow.durationMs };
  const maximumGoldenWindowSpan = routeParts.reduce((maximum, part) => {
    const partMaximum = part.coordinates.slice(4).reduce((partMax, coordinate, index) => {
      const previous = part.coordinates[index];
      return Math.max(partMax, Math.hypot(coordinate[0] - previous[0], coordinate[1] - previous[1]));
    }, 0);
    return Math.max(maximum, partMaximum);
  }, 0);
  if (maximumGoldenWindowSpan > 0.1) return { zoom: 7.5, pitch: 25, durationMs: MVP_CAMERA.follow.durationMs };
  if (maximumGoldenWindowSpan > 0.02) return { zoom: 9.5, pitch: 30, durationMs: MVP_CAMERA.follow.durationMs };
  return { zoom: 11.5, pitch: 35, durationMs: MVP_CAMERA.follow.durationMs };
}

export function getNarrativeMovementKey(movement: NarrativeMovement): string {
  return `${movement.fromVisitId}:${movement.toVisitId}`;
}

export function getMovementCameraAction(
  movement: NarrativeMovement,
  position: SafeCoordinate | null,
  canFollow: boolean,
  framedMovementKey: string | null,
  isCameraTransitioning: boolean
): NarrativeMovementCameraAction {
  if (!position || !canFollow) return null;
  const movementKey = getNarrativeMovementKey(movement);
  if (framedMovementKey !== movementKey) {
    return { kind: 'frame', movementKey, center: position, framing: movement.cameraFraming };
  }
  if (isCameraTransitioning) return null;
  return { kind: 'follow', movementKey, center: position };
}

export function getCruiseVisualDay(
  selectedDay: NarrativeDayScope,
  isCruising: boolean,
  activeVisitDay: number | undefined
): NarrativeDayScope {
  if (selectedDay !== 'all' || !isCruising) return selectedDay;
  return activeVisitDay ?? 'all';
}

export function getScopedNarrativePlaybackTimeline(
  fullTimeline: NarrativePlaybackTimeline,
  selectedDay: NarrativeDayScope,
  publicSegments: PublicTrajectorySegment[]
): NarrativePlaybackTimeline {
  if (selectedDay === 'all') return fullTimeline;
  return buildNarrativePlaybackTimeline(
    fullTimeline.visits.filter((visit) => visit.dayNumber === selectedDay),
    publicSegments
  );
}

export function interpolatePublicSegment(
  coordinates: SafeCoordinate[],
  progress: number
): { position: SafeCoordinate; bearing: number; visibleCoordinates: SafeCoordinate[] } | null {
  if (coordinates.length < 2) return null;
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const total = publicLineDistanceKm(coordinates);
  if (total === 0) {
    return { position: coordinates[0], bearing: 0, visibleCoordinates: [coordinates[0], coordinates[0]] };
  }

  const target = total * clampedProgress;
  let travelled = 0;
  const visibleCoordinates: SafeCoordinate[] = [coordinates[0]];
  for (let index = 1; index < coordinates.length; index += 1) {
    const start = coordinates[index - 1];
    const end = coordinates[index];
    const segmentDistance = publicLineDistanceKm([start, end]);
    if (travelled + segmentDistance >= target) {
      const fraction = segmentDistance === 0 ? 0 : (target - travelled) / segmentDistance;
      const position: SafeCoordinate = [
        start[0] + (end[0] - start[0]) * fraction,
        start[1] + (end[1] - start[1]) * fraction
      ];
      visibleCoordinates.push(position);
      const bearing = Math.atan2(end[0] - start[0], end[1] - start[1]) * 180 / Math.PI;
      return { position, bearing, visibleCoordinates };
    }
    visibleCoordinates.push(end);
    travelled += segmentDistance;
  }

  const penultimate = coordinates[coordinates.length - 2];
  const position = coordinates[coordinates.length - 1];
  return {
    position,
    bearing: Math.atan2(position[0] - penultimate[0], position[1] - penultimate[1]) * 180 / Math.PI,
    visibleCoordinates
  };
}

interface RouteEdge {
  partIndex: number;
  coordinateIndex: number;
  start: SafeCoordinate;
  end: SafeCoordinate;
  routePosition: number;
}

interface VisitProjection {
  edgeIndex: number;
  partIndex: number;
  coordinateIndex: number;
  fraction: number;
  coordinate: SafeCoordinate;
  distanceSquared: number;
  routePosition: number;
}

function projectCoordinate(coordinate: SafeCoordinate, edge: RouteEdge, edgeIndex: number): VisitProjection {
  const dx = edge.end[0] - edge.start[0];
  const dy = edge.end[1] - edge.start[1];
  const denominator = dx * dx + dy * dy;
  const rawFraction = denominator === 0 ? 0 :
    ((coordinate[0] - edge.start[0]) * dx + (coordinate[1] - edge.start[1]) * dy) / denominator;
  const fraction = Math.max(0, Math.min(1, rawFraction));
  const projected: SafeCoordinate = [edge.start[0] + dx * fraction, edge.start[1] + dy * fraction];
  const projectedDx = coordinate[0] - projected[0];
  const projectedDy = coordinate[1] - projected[1];
  return {
    edgeIndex,
    partIndex: edge.partIndex,
    coordinateIndex: edge.coordinateIndex,
    fraction,
    coordinate: projected,
    distanceSquared: projectedDx * projectedDx + projectedDy * projectedDy,
    routePosition: edge.routePosition + fraction
  };
}

function projectVisitsMonotonically(
  visits: Array<EnrichedPlace & { coordinates: SafeCoordinate }>,
  segments: PublicTrajectorySegment[]
): Array<VisitProjection | null> {
  const edges: RouteEdge[] = [];
  let routePosition = 0;
  segments.forEach((segment, partIndex) => {
    segment.coordinates.slice(1).forEach((end, coordinateIndex) => {
      edges.push({ partIndex, coordinateIndex, start: segment.coordinates[coordinateIndex], end, routePosition });
      routePosition += 1;
    });
  });
  if (!visits.length || !edges.length) return visits.map(() => null);

  const candidates = visits.map((visit) => edges.map((edge, edgeIndex) => projectCoordinate(visit.coordinates, edge, edgeIndex)));
  const backPointers: number[][] = visits.map(() => Array(edges.length).fill(-1));
  const costRows: number[][] = [candidates[0].map((candidate) => candidate.distanceSquared)];

  for (let visitIndex = 1; visitIndex < visits.length; visitIndex += 1) {
    const previousCosts = costRows[visitIndex - 1];
    const prefixCosts: number[] = Array(edges.length).fill(Number.POSITIVE_INFINITY);
    const prefixIndices: number[] = Array(edges.length).fill(-1);
    let bestCost = Number.POSITIVE_INFINITY;
    let bestIndex = -1;
    for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
      if (previousCosts[edgeIndex] < bestCost) {
        bestCost = previousCosts[edgeIndex];
        bestIndex = edgeIndex;
      }
      prefixCosts[edgeIndex] = bestCost;
      prefixIndices[edgeIndex] = bestIndex;
    }

    costRows.push(candidates[visitIndex].map((candidate, edgeIndex) => {
      let predecessorIndex = edgeIndex > 0 ? prefixIndices[edgeIndex - 1] : -1;
      let predecessorCost = edgeIndex > 0 ? prefixCosts[edgeIndex - 1] : Number.POSITIVE_INFINITY;
      if (
        candidates[visitIndex - 1][edgeIndex].fraction <= candidate.fraction &&
        previousCosts[edgeIndex] <= predecessorCost
      ) {
        predecessorIndex = edgeIndex;
        predecessorCost = previousCosts[edgeIndex];
      }
      backPointers[visitIndex][edgeIndex] = predecessorIndex;
      return predecessorCost + candidate.distanceSquared;
    }));
  }

  const finalCosts = costRows[costRows.length - 1];
  let selectedEdge = finalCosts.reduce((best, cost, index) => cost < finalCosts[best] ? index : best, 0);
  const projections: Array<VisitProjection | null> = Array(visits.length).fill(null);
  for (let visitIndex = visits.length - 1; visitIndex >= 0; visitIndex -= 1) {
    if (selectedEdge < 0 || !Number.isFinite(costRows[visitIndex][selectedEdge])) return visits.map(() => null);
    projections[visitIndex] = candidates[visitIndex][selectedEdge];
    selectedEdge = backPointers[visitIndex][selectedEdge];
  }
  return projections;
}

function sliceRouteParts(
  segments: PublicTrajectorySegment[],
  start: VisitProjection,
  end: VisitProjection
): NarrativeRoutePart[] {
  if (end.routePosition < start.routePosition) return [];
  const routeParts: NarrativeRoutePart[] = [];
  for (let partIndex = start.partIndex; partIndex <= end.partIndex; partIndex += 1) {
    const segment = segments[partIndex];
    let coordinates: SafeCoordinate[];
    if (start.partIndex === end.partIndex) {
      coordinates = [start.coordinate, ...segment.coordinates.slice(start.coordinateIndex + 1, end.coordinateIndex + 1), end.coordinate];
    } else if (partIndex === start.partIndex) {
      coordinates = [start.coordinate, ...segment.coordinates.slice(start.coordinateIndex + 1)];
    } else if (partIndex === end.partIndex) {
      coordinates = [...segment.coordinates.slice(0, end.coordinateIndex + 1), end.coordinate];
    } else {
      coordinates = segment.coordinates.slice();
    }
    coordinates = dedupeCoordinates(coordinates);
    if (coordinates.length < 2) continue;
    routeParts.push({
      segmentIndex: segment.segmentIndex,
      coordinates,
      hasHiddenGapAfter: segment.hasHiddenGapAfter && partIndex < end.partIndex,
      distanceKm: publicLineDistanceKm(coordinates)
    });
  }
  return routeParts;
}

export function interpolateNarrativeMovement(
  movement: NarrativeMovement,
  partIndex: number,
  elapsedMs: number
): NarrativeMovementFrame | null {
  const part = movement.routeParts[partIndex];
  if (!part) return null;
  const distanceBefore = movement.routeParts.slice(0, partIndex).reduce((sum, routePart) => sum + routePart.distanceKm, 0);
  const targetDistance = movement.distanceKm === 0
    ? 0
    : Math.max(0, Math.min(1, elapsedMs / movement.durationMs)) * movement.distanceKm;
  const localProgress = part.distanceKm === 0 ? 1 : (targetDistance - distanceBefore) / part.distanceKm;
  const frame = interpolatePublicSegment(part.coordinates, localProgress);
  return frame && {
    ...frame,
    partIndex,
    completedDistanceKm: distanceBefore + Math.max(0, Math.min(part.distanceKm, targetDistance - distanceBefore))
  };
}

export function getRoutePartEndElapsedMs(movement: NarrativeMovement, partIndex: number): number {
  if (movement.distanceKm === 0) return movement.durationMs;
  const distanceThroughPart = movement.routeParts.slice(0, partIndex + 1).reduce((sum, part) => sum + part.distanceKm, 0);
  return movement.durationMs * distanceThroughPart / movement.distanceKm;
}

export function buildNarrativePlaybackTimeline(
  places: EnrichedPlace[],
  publicSegments: PublicTrajectorySegment[]
): NarrativePlaybackTimeline {
  const visits = places
    .filter((place): place is EnrichedPlace & { coordinates: SafeCoordinate } => place.coordinates !== null)
    .slice()
    .sort((left, right) => {
      const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : Number.MAX_SAFE_INTEGER;
      const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime || left.id.localeCompare(right.id);
    });

  const segments = publicSegments.slice().sort((left, right) => left.segmentIndex - right.segmentIndex);
  const projections = projectVisitsMonotonically(visits, segments);
  const unmappedVisitIds = visits.filter((_, index) => !projections[index]).map((visit) => visit.id);
  const movements = visits.slice(0, -1).map((visit, index): NarrativeMovement => {
    const start = projections[index];
    const end = projections[index + 1];
    const routeParts = start && end ? sliceRouteParts(segments, start, end) : [];
    const mode: NarrativeMovementMode = 'unknown';
    const distanceKm = routeParts.reduce((sum, part) => sum + part.distanceKm, 0);
    return {
      routeParts,
      fromVisitId: visit.id,
      toVisitId: visits[index + 1].id,
      mode,
      distanceKm,
      durationMs: getMovementDurationMs(mode, distanceKm),
      cameraFraming: getMvpMovementCameraFraming(routeParts, mode)
    };
  });

  return {
    visits,
    movements,
    unmappedVisitIds,
    visitRoutePositions: projections.map((projection) => projection?.routePosition ?? null)
  };
}
