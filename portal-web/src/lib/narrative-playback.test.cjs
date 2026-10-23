/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildNarrativePlaybackTimeline, getCruiseVisualDay, getMovementCameraAction, getMvpMovementCameraFraming,
  getScopedNarrativePlaybackTimeline, interpolateNarrativeMovement, interpolatePublicSegment,
  MVP_CAMERA, normalizePublicLineString, VISIT_DWELL_MS,
  NARRATIVE_DWELL_FALLBACK_MS, narrativeDwellMsFromPublicValue, shouldFollowMovementCamera
} = require('./narrative-playback.ts');
const { fetchPublicTrajectory, mapPublicTrajectoryRows } = require('./supabase-trajectory.ts');

function visit(index, coordinate, dayNumber = 1) {
  return { id: `visit-${index}`, title: `第 ${index} 站`, coordinates: coordinate, timestamp: `2026-09-${String(dayNumber).padStart(2, '0')}T12:${String(index).padStart(2, '0')}:00Z`, dayNumber };
}

function routePart(coordinates) {
  return { segmentIndex: 1, coordinates, hasHiddenGapAfter: false, distanceKm: 1 };
}

test('35 Visits on one continuous public LineString produce 34 Visit-to-Visit movements', () => {
  const coordinates = Array.from({ length: 286 }, (_, index) => [120 + index / 1000, 24 + index / 2000]);
  const visits = Array.from({ length: 35 }, (_, index) => visit(index + 1, coordinates[index * 8]));
  const timeline = buildNarrativePlaybackTimeline(visits, [{ segmentIndex: 1, coordinates, hasHiddenGapAfter: false }]);
  assert.equal(timeline.visits.length, 35);
  assert.equal(timeline.movements.length, 34);
  assert.ok(timeline.movements.every((movement) => movement.routeParts.length === 1));
  assert.ok(timeline.movements.every((movement) => movement.distanceKm > 0));
  assert.ok(timeline.movements.every((movement) => movement.durationMs >= 4_500));
  assert.ok(timeline.movements.every((movement) => movement.durationMs <= 12_000));
  assert.ok(timeline.movements.reduce((sum, movement) => sum + movement.durationMs, 0) > 12_000);
  assert.ok(timeline.visitRoutePositions.every((position, index, positions) => index === 0 || position >= positions[index - 1]));
});

test('Visit order remains chronological and each movement follows its adjacent Visit pair', () => {
  const timeline = buildNarrativePlaybackTimeline([
    visit(2, [121, 25]), visit(1, [120, 24]), { ...visit(3, [122, 26], 2), coordinates: null }
  ], [{ segmentIndex: 1, coordinates: [[120, 24], [121, 25]], hasHiddenGapAfter: false }]);
  assert.deepEqual(timeline.visits.map((item) => item.id), ['visit-1', 'visit-2']);
  assert.deepEqual(timeline.movements.map((item) => [item.fromVisitId, item.toVisitId]), [['visit-1', 'visit-2']]);
  assert.notDeepEqual(timeline.visits.at(-1).coordinates, [0, 0]);
});

test('a Visit-to-Visit range crossing a public redaction gap retains separate safe route parts', () => {
  const timeline = buildNarrativePlaybackTimeline([
    visit(1, [120, 24]), visit(2, [122, 24])
  ], [
    { segmentIndex: 1, coordinates: [[120, 24], [121, 24]], hasHiddenGapAfter: true },
    { segmentIndex: 2, coordinates: [[121.5, 24], [122, 24]], hasHiddenGapAfter: false }
  ]);
  assert.equal(timeline.movements[0].routeParts.length, 2);
  assert.equal(timeline.movements[0].routeParts[0].hasHiddenGapAfter, true);
  assert.deepEqual(timeline.movements[0].routeParts[0].coordinates.at(-1), [121, 24]);
  assert.deepEqual(timeline.movements[0].routeParts[1].coordinates[0], [121.5, 24]);
});

test('preserves MVP dwell and camera parameters while selecting stable Movement framing from complete route parts', () => {
  assert.equal(VISIT_DWELL_MS, 5000);
  assert.equal(narrativeDwellMsFromPublicValue(undefined), NARRATIVE_DWELL_FALLBACK_MS);
  assert.equal(MVP_CAMERA.focus.zoom, 14.5);
  assert.equal(MVP_CAMERA.focus.pitch, 35);
  assert.equal(MVP_CAMERA.focus.durationMs, 800);
  assert.equal(MVP_CAMERA.cardTarget.durationMs, 1200);
  assert.deepEqual(getMvpMovementCameraFraming([routePart([[120, 24], [120.001, 24.001]])]), { zoom: 11.5, pitch: 35, durationMs: 350 });
  assert.deepEqual(getMvpMovementCameraFraming([routePart([[120, 24], [120.01, 24], [120.02, 24], [120.03, 24], [120.04, 24], [120.05, 24]])]), { zoom: 9.5, pitch: 30, durationMs: 350 });
  assert.deepEqual(getMvpMovementCameraFraming([routePart([[120, 24], [120.03, 24], [120.06, 24], [120.09, 24], [120.12, 24], [120.15, 24]])]), { zoom: 7.5, pitch: 25, durationMs: 350 });
  assert.deepEqual(getMvpMovementCameraFraming([routePart([[120, 24], [121, 25]])], 'plane'), { zoom: 5, pitch: 15, durationMs: 350 });
});

test('a Movement latches one framing band across progress while a new Movement may choose another', () => {
  const timeline = buildNarrativePlaybackTimeline([
    visit(1, [120, 24]), visit(2, [120.05, 24]), visit(3, [120.2, 24])
  ], [{
    segmentIndex: 1,
    coordinates: [[120, 24], [120.01, 24], [120.02, 24], [120.03, 24], [120.04, 24], [120.05, 24], [120.08, 24], [120.11, 24], [120.14, 24], [120.17, 24], [120.2, 24]],
    hasHiddenGapAfter: false
  }]);
  const [mediumMovement, longMovement] = timeline.movements;
  const sampledFramings = [0, 0.25, 0.5, 0.75].map((progress) => {
    assert.ok(interpolateNarrativeMovement(mediumMovement, 0, mediumMovement.durationMs * progress));
    return mediumMovement.cameraFraming;
  });

  assert.ok(sampledFramings.every((framing) => framing === mediumMovement.cameraFraming));
  assert.deepEqual(mediumMovement.cameraFraming, { zoom: 9.5, pitch: 30, durationMs: 350 });
  assert.deepEqual(longMovement.cameraFraming, { zoom: 7.5, pitch: 25, durationMs: 350 });
});

test('camera actions frame once, wait for that transition, then pan without replacing zoom', () => {
  const movement = buildNarrativePlaybackTimeline([
    visit(1, [120, 24]), visit(2, [120.05, 24])
  ], [{ segmentIndex: 1, coordinates: [[120, 24], [120.01, 24], [120.02, 24], [120.03, 24], [120.04, 24], [120.05, 24]], hasHiddenGapAfter: false }]).movements[0];
  const first = getMovementCameraAction(movement, [120, 24], true, null, false);
  assert.equal(first.kind, 'frame');
  assert.deepEqual(first.framing, movement.cameraFraming);
  assert.equal(getMovementCameraAction(movement, [120.01, 24], true, first.movementKey, true), null);
  assert.deepEqual(getMovementCameraAction(movement, [120.02, 24], true, first.movementKey, false), {
    kind: 'follow', movementKey: first.movementKey, center: [120.02, 24]
  });
  assert.equal(getMovementCameraAction(movement, [120.03, 24], false, first.movementKey, false), null);
});

test('Movement follow camera yields to Visit focus at the arrival boundary', () => {
  assert.equal(shouldFollowMovementCamera(true, false, false, 4_999, 5_000), true);
  assert.equal(shouldFollowMovementCamera(true, false, false, 5_000, 5_000), false);
  assert.equal(shouldFollowMovementCamera(true, true, false, 2_000, 5_000), false);
  assert.equal(shouldFollowMovementCamera(false, false, false, 2_000, 5_000), false);
  assert.equal(shouldFollowMovementCamera(true, false, true, 2_000, 5_000), false);
  assert.equal(shouldFollowMovementCamera(true, false, false, 0, 5_000), true, 'the next Movement resumes follow');
});

test('All-scope visual Day follows the active Visit without changing scope or timeline', () => {
  const fullTimeline = buildNarrativePlaybackTimeline([
    visit(1, [120, 24], 1), visit(2, [120.01, 24], 1), visit(3, [120.02, 24], 5)
  ], [{ segmentIndex: 1, coordinates: [[120, 24], [120.01, 24], [120.02, 24]], hasHiddenGapAfter: false }]);
  const allScope = getScopedNarrativePlaybackTimeline(fullTimeline, 'all', []);

  assert.equal(allScope, fullTimeline);
  assert.equal(allScope.visits.length, 3);
  assert.equal(getCruiseVisualDay('all', true, 5), 5);
  assert.equal(getCruiseVisualDay('all', true, 5), 5, 'pause/resume does not alter a derived visual Day');
  assert.equal(getCruiseVisualDay('all', false, 5), 'all', 'exit/reset restores the All highlight');
});

test('explicit All to Day and Day to All scope switches retain existing filtering behavior', () => {
  const segments = [{ segmentIndex: 1, coordinates: [[120, 24], [120.01, 24], [120.02, 24]], hasHiddenGapAfter: false }];
  const fullTimeline = buildNarrativePlaybackTimeline([
    visit(1, [120, 24], 1), visit(2, [120.01, 24], 1), visit(3, [120.02, 24], 5)
  ], segments);
  const dayFiveTimeline = getScopedNarrativePlaybackTimeline(fullTimeline, 5, segments);
  const restoredAllTimeline = getScopedNarrativePlaybackTimeline(fullTimeline, 'all', segments);

  assert.deepEqual(dayFiveTimeline.visits.map((item) => item.id), ['visit-3']);
  assert.equal(getCruiseVisualDay(5, true, 5), 5);
  assert.equal(restoredAllTimeline, fullTimeline);
  assert.deepEqual(restoredAllTimeline.visits.map((item) => item.id), ['visit-1', 'visit-2', 'visit-3']);
});

test('interpolates only within a returned public LineString and never fabricates a connector', () => {
  const frame = interpolatePublicSegment([[120, 24], [120.5, 24.5]], 0.5);
  assert.ok(frame);
  assert.deepEqual(frame.visibleCoordinates[0], [120, 24]);
  assert.notDeepEqual(frame.position, [0, 0]);
  assert.equal(normalizePublicLineString({ type: 'LineString', coordinates: [[120, 24]] }), null);
});

test('uses the public trajectory vertices between Visits instead of an endpoint connector', () => {
  const timeline = buildNarrativePlaybackTimeline([
    visit(1, [120.01, 24]), visit(2, [120.29, 24])
  ], [{
    segmentIndex: 1,
    coordinates: [[120, 24], [120.1, 24], [120.2, 24], [120.3, 24]],
    hasHiddenGapAfter: false
  }]);
  assert.deepEqual(timeline.movements[0].routeParts[0].coordinates, [
    [120.01, 24], [120.1, 24], [120.2, 24], [120.29, 24]
  ]);
  const firstFrame = interpolateNarrativeMovement(timeline.movements[0], 0, 0);
  const middleFrame = interpolateNarrativeMovement(timeline.movements[0], 0, timeline.movements[0].durationMs / 2);
  assert.ok(firstFrame.visibleCoordinates.length >= 2, 'the first movement has progressive geometry immediately');
  assert.ok(middleFrame.visibleCoordinates.some((coordinate) => coordinate[0] === 120.1));
  assert.ok(middleFrame.position[0] > 120.1 && middleFrame.position[0] < 120.2);
});

test('global projection keeps repeated nearby Visits in chronological route order', () => {
  const coordinates = [[0, 0], [1, 0], [2, 0], [1, 0.01], [0, 0.01]];
  const timeline = buildNarrativePlaybackTimeline([
    visit(1, [0, 0.005]), visit(2, [2, 0]), visit(3, [0, 0.01])
  ], [{ segmentIndex: 1, coordinates, hasHiddenGapAfter: false }]);
  assert.equal(timeline.movements.length, 2);
  assert.ok(timeline.visitRoutePositions[0] < timeline.visitRoutePositions[1]);
  assert.ok(timeline.visitRoutePositions[1] < timeline.visitRoutePositions[2]);
  assert.deepEqual(timeline.movements[1].routeParts[0].coordinates.at(-1), [0, 0.01]);
});

test('the checked-in Golden path has no raw endpoint jumps and supports all japan-2026 Visit pairs', () => {
  const fixturePath = path.join(__dirname, '../data/enriched-trajectory.json');
  const visitsPath = path.join(__dirname, '../data/parsed-trajectory.json');
  const trajectoryFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const visitFixture = JSON.parse(fs.readFileSync(visitsPath, 'utf8'));
  const coordinates = trajectoryFixture.features.find((feature) => feature.geometry?.type === 'LineString').geometry.coordinates;
  const visits = visitFixture.features
    .filter((feature) => feature.geometry?.type === 'Point')
    .map((feature) => ({
      id: feature.properties.id,
      title: feature.properties.title,
      coordinates: feature.geometry.coordinates,
      timestamp: feature.properties.timestamp
    }));
  const maxStepDegrees = coordinates.slice(1).reduce((maximum, coordinate, index) => (
    Math.max(maximum, Math.hypot(coordinate[0] - coordinates[index][0], coordinate[1] - coordinates[index][1]))
  ), 0);
  const timeline = buildNarrativePlaybackTimeline(visits, [{ segmentIndex: 1, coordinates, hasHiddenGapAfter: false }]);

  assert.equal(visits.length, 35);
  assert.equal(timeline.movements.length, 34);
  assert.equal(timeline.unmappedVisitIds.length, 0);
  assert.ok(maxStepDegrees < 1, 'Golden path must not contain a raw long-distance endpoint jump');
  assert.ok(timeline.movements.every((movement) => movement.routeParts.length > 0));
  assert.ok(timeline.movements.every((movement) => movement.durationMs >= 4_500 && movement.durationMs <= 12_000));
  assert.ok(timeline.visitRoutePositions.every((position, index, positions) => index === 0 || position >= positions[index - 1]));
});

test('uses only the approved api_public trajectory RPC', async () => {
  const requests = [];
  const fetchImpl = async (input, init) => { requests.push({ url: new URL(input.toString()), init }); return new Response(JSON.stringify([{ segment_index: 1, geometry: { type: 'LineString', coordinates: [[120, 24], [121, 25]] }, has_hidden_gap_after: false }]), { status: 200 }); };
  const segments = await fetchPublicTrajectory('public-trip', { config: { url: 'https://example.supabase.co', publishableKey: 'public-key' }, fetchImpl });
  assert.equal(segments.length, 1);
  assert.equal(requests[0].url.pathname, '/rest/v1/rpc/get_public_trajectory');
  assert.equal(requests[0].init.headers['Content-Profile'], 'api_public');
  assert.ok(!requests[0].url.pathname.includes('app_private'));
  assert.equal(mapPublicTrajectoryRows([{ segment_index: 1, geometry: { type: 'LineString', coordinates: [[120, 24], [121, 25]] }, has_hidden_gap_after: false }]).length, 1);
});
