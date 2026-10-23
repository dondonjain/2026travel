export type Coordinate = [number, number];
export interface TimelineObservation { coordinate: Coordinate; timestamp: number }
export interface SearchAnchor extends TimelineObservation { role: 'visit' | 'before_gap' | 'after_gap' }
export interface ResolutionVisit {
  coordinate?: Coordinate | null;
  startedAt?: string;
  endedAt?: string;
  timeZone?: string;
  isSubVisit?: boolean;
}
export interface TrajectoryAnalysis {
  hasSpatialConflict: boolean;
  isOvernight: boolean;
  searchAnchors: SearchAnchor[];
}
export function validCoordinate(value: unknown): value is Coordinate {
  return Array.isArray(value) && value.length === 2 && value.every(Number.isFinite) &&
    Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
}
export function distanceMeters(a: Coordinate, b: Coordinate): number {
  const rad = Math.PI / 180;
  const h = Math.sin((b[1] - a[1]) * rad / 2) ** 2 +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin((b[0] - a[0]) * rad / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export class TrajectoryAnalyzer {
  analyze(visit: ResolutionVisit, timelinePath: TimelineObservation[]): TrajectoryAnalysis {
    const start = Date.parse(visit.startedAt || '');
    const end = Date.parse(visit.endedAt || '');
    const validRange = Number.isFinite(start) && Number.isFinite(end) && end >= start;
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: visit.timeZone || 'Asia/Tokyo' });
    const isOvernight = validRange && date.format(start) !== date.format(end);
    const points = timelinePath.filter(p => validCoordinate(p.coordinate) && Number.isFinite(p.timestamp))
      .slice().sort((a, b) => a.timestamp - b.timestamp);
    // Only consecutive observations whose gap overlaps this Visit are evidence.
    // Never invent a point at visit.endTime to fill an overnight observation gap.
    for (let i = 1; validRange && i < points.length; i++) {
      const before = points[i - 1], after = points[i];
      if (before.timestamp < end && after.timestamp > start &&
          after.timestamp - before.timestamp > 3 * 3600000 &&
          distanceMeters(before.coordinate, after.coordinate) > 250) {
        return { hasSpatialConflict: true, isOvernight, searchAnchors: [
          { ...before, role: 'before_gap' }, { ...after, role: 'after_gap' }
        ] };
      }
    }
    return { hasSpatialConflict: false, isOvernight, searchAnchors: validCoordinate(visit.coordinate)
      ? [{ coordinate: visit.coordinate, timestamp: start, role: 'visit' }] : [] };
  }
}
