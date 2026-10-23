export type ReviewStatus = 'pending' | 'confirmed';
export type Visibility = 'public' | 'private';

export type IssueSeverity = 'required' | 'warning';
export type IssueType = 'place' | 'time' | 'boundary';

export interface VisitIssue {
  id: string;
  type: IssueType;
  severity: IssueSeverity;
  message: string;
  recommendation?: string;
}

export interface VisitEvidence {
  sourceIndex: number;
  hierarchyLevel: number;
  rawTimestamp: string;
  rawGeo?: [number, number]; // [lng, lat]
  candidateProbability: number;
  semanticType?: string;
  topCandidateName?: string;
  departureCoordinate?: [number, number];
}

export interface SubVenue {
  title: string;
  placeID: string;
  hierarchyLevel: number;
  durationMinutes: number;
  flattenReason: string;
}

export interface CMSVisit {
  resolution?: import('./place-resolver').PlaceResolveResult;
  resolutionStatus?: import('./place-resolver').ResolutionStatus | 'MANUALLY_CONFIRMED' | null;
  placeId?: string | null;
  id: string;
  dayNumber: number;
  title: string;
  placeName: string;
  placeCategory: '交通' | '購物' | '美食' | '住宿' | '景點' | '休歇';
  startTime: string; // approx 10-min granularity (e.g. "17:00")
  endTime: string;   // (e.g. "18:30")
  durationMinutes: number;
  coordinate: [number, number] | null; // [lng, lat]
  reviewStatus: ReviewStatus;
  visibility: Visibility;
  issues: VisitIssue[];
  evidence: VisitEvidence;
  subVenues?: SubVenue[];
}

export interface CMSDay {
  dayNumber: number;
  date: string; // "2026-08-14"
  label: string; // "Day 1 (8/14)"
  subtitle: string; // "岡山抵達 & 市區商圈"
}

export interface CMSTrip {
  id: string;
  slug: string;
  title: string;
  startDate: string;
  endDate: string;
  publicationStatus: 'draft' | 'published';
  usableTrajectory: boolean;
  days: CMSDay[];
  visits: CMSVisit[];
}
