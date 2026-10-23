/* eslint-disable @typescript-eslint/no-require-imports */
// Read-only hosted fixture check. It reports aggregate counts only: never keys,
// URLs, Visit content, or raw geometry.
const { buildNarrativePlaybackTimeline, interpolateNarrativeMovement } = require('./narrative-playback.ts');
const { fetchSupabaseEnrichedPlaces } = require('./supabase-places.ts');
const { fetchPublicTrajectory } = require('./supabase-trajectory.ts');

async function verifyPublicPlayback() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Set public Supabase configuration through the caller environment; this verifier never reads credential files.');
  }

  const [places, segments] = await Promise.all([
    fetchSupabaseEnrichedPlaces('japan-2026'),
    fetchPublicTrajectory('japan-2026')
  ]);
  const timeline = buildNarrativePlaybackTimeline(places, segments);
  const firstFrame = timeline.movements[0] && interpolateNarrativeMovement(timeline.movements[0], 0, 0);
  const middleFrame = timeline.movements[0] && interpolateNarrativeMovement(
    timeline.movements[0],
    0,
    timeline.movements[0].durationMs / 2
  );
  const projectionsAreMonotonic = timeline.visitRoutePositions.every((position, index, positions) => (
    position !== null && (index === 0 || positions[index - 1] !== null && position >= positions[index - 1])
  ));
  const movementsWithoutRouteParts = timeline.movements.filter((movement) => movement.routeParts.length === 0).length;
  const endpointOnlyMovements = timeline.movements.filter((movement, index) => {
    if (movement.routeParts.length !== 1 || movement.routeParts[0].coordinates.length !== 2) return false;
    const coordinates = movement.routeParts[0].coordinates;
    const from = timeline.visits[index].coordinates;
    const to = timeline.visits[index + 1].coordinates;
    return coordinates[0][0] === from[0] && coordinates[0][1] === from[1] &&
      coordinates[1][0] === to[0] && coordinates[1][1] === to[1];
  }).length;
  const report = {
    visits: timeline.visits.length,
    movements: timeline.movements.length,
    publicSegments: segments.length,
    publicCoordinates: segments.reduce((sum, segment) => sum + segment.coordinates.length, 0),
    unmappedVisits: timeline.unmappedVisitIds.length,
    routeParts: timeline.movements.reduce((sum, movement) => sum + movement.routeParts.length, 0),
    movementsWithoutRouteParts,
    endpointOnlyMovements,
    projectionsAreMonotonic,
    firstMovementProgressiveCoordinates: firstFrame?.visibleCoordinates.length || 0,
    markerMidpointAvailable: Boolean(middleFrame?.position),
    hasSyntheticZeroCoordinate: timeline.movements.some((movement) => movement.routeParts.some((part) => part.coordinates.some((coordinate) => coordinate[0] === 0 && coordinate[1] === 0)))
  };
  if (
    report.visits !== 35 || report.movements !== 34 || report.publicSegments < 1 || report.publicCoordinates < 2 ||
    report.unmappedVisits !== 0 || report.movementsWithoutRouteParts !== 0 || report.endpointOnlyMovements !== 0 ||
    !report.projectionsAreMonotonic || report.firstMovementProgressiveCoordinates < 2 || !report.markerMidpointAvailable ||
    report.hasSyntheticZeroCoordinate
  ) {
    throw new Error(`Hosted japan-2026 playback fixture did not match expected aggregate shape: ${JSON.stringify(report)}`);
  }
  console.log(JSON.stringify(report));
}

module.exports = { verifyPublicPlayback };

if (require.main === module) {
  console.error('Use the approved command: npm run qa:public-playback');
  process.exitCode = 1;
}
