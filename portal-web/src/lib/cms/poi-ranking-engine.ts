import { distanceMeters, type TrajectoryAnalysis } from './trajectory-analyzer';
import type { PoiCandidate } from './poi-fetcher';

export interface RankedPoi extends PoiCandidate { distanceMeters: number; totalScore: number }
export class PoiRankingEngine {
  rank(candidates: PoiCandidate[], analysis: TrajectoryAnalysis, isSubVisit = false): RankedPoi[] {
    return candidates.map(candidate => {
      const distance = Math.min(...analysis.searchAnchors.map(a => distanceMeters(a.coordinate, candidate.coordinate)));
      const lodging = candidate.categories.some(c => /^(hotel|hostel|motel|guest_house|lodging|accommodation)$/.test(c));
      const diningOrShop = candidate.categories.some(c => /^(restaurant|cafe|fast_food|shop|shopping)$/.test(c));
      return { ...candidate, distanceMeters: distance,
        totalScore: Math.exp(-distance / 200) * (1 + (analysis.isOvernight && lodging ? 0.5 : 0) + (isSubVisit && diningOrShop ? 0.4 : 0)) };
    }).sort((a, b) => b.totalScore - a.totalScore || a.id.localeCompare(b.id));
  }
}
