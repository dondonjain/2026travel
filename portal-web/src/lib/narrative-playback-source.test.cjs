/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mapSource = fs.readFileSync(path.join(__dirname, '../components/Map.tsx'), 'utf8');
const pageSource = fs.readFileSync(path.join(__dirname, '../app/page.tsx'), 'utf8');
const adapterSource = fs.readFileSync(path.join(__dirname, 'supabase-trajectory.ts'), 'utf8');
const publicVisitAdapterSource = fs.readFileSync(path.join(__dirname, 'supabase-places.ts'), 'utf8');
const dwellSource = fs.readFileSync(path.join(__dirname, 'narrative-dwell.js'), 'utf8');
const importerSource = fs.readFileSync(path.join(__dirname, '../../scripts/import-mvp.mjs'), 'utf8');

test('the map no longer imports raw GPS timing or interpolates a hidden connector', () => {
  assert.doesNotMatch(mapSource, /enriched-trajectory|pointTimes|globalStartTime|globalEndTime/);
  assert.match(mapSource, /!isGapTransition/);
  assert.match(mapSource, /routeParts/);
  assert.match(mapSource, /isGapTransition \? part\.coordinates : activeFrame\?\.visibleCoordinates/);
  assert.match(mapSource, /setActivePartIndex\(\(index\) => index \+ 1\)/);
  assert.match(mapSource, /setIsPlaying\(true\)/);
});

test('manual place selection remains wired from grid through page to map', () => {
  assert.match(pageSource, /targetPlace=\{selectedPlace\}/);
  assert.match(mapSource, /setIsCruising\(false\).*flyTo\(\{ center: targetPlace\.coordinates/s);
  assert.match(mapSource, /setIsManualCruisePaused\(true\).*activateSpot\(place\)/s);
});

test('day scope changes synchronize the controller, story, and focus to the first scoped Visit', () => {
  assert.match(mapSource, /const previousSelectedDayRef = useRef\(selectedDay\)/);
  const playbackReset = mapSource.match(/useEffect\(\(\) => \{ framedMovementKeyRef\.current = null; setCruiseStopIndex\(0\);[\s\S]*?\}, \[selectedDay, timeline\.movements\.length\]\);/)?.[0];
  const dayScopeFocus = mapSource.match(/useEffect\(\(\) => \{\s*const dayScopeChanged = previousSelectedDayRef\.current !== selectedDay;[\s\S]*?\}, \[activateSpot, chronologicalPlaces, selectedDay\]\);/)?.[0];
  assert.ok(playbackReset);
  assert.ok(dayScopeFocus);
  assert.match(playbackReset, /setActiveMovementIndex\(0\)/);
  assert.match(playbackReset, /setIsPlaying\(false\)/);
  assert.match(playbackReset, /setIsDwelling\(false\)/);
  assert.match(dayScopeFocus, /const firstScopedPlace = chronologicalPlaces\[0\]/);
  assert.match(dayScopeFocus, /if \(firstScopedPlace\) activateSpot\(firstScopedPlace\)/);
  assert.match(dayScopeFocus, /else setPopupPlace\(null\)/);
  assert.doesNotMatch(dayScopeFocus, /selectedDay !== ['"]all['"]/);
  assert.match(mapSource, /currentPlaceTitle=\{chronologicalPlaces\[cruiseStopIndex\]\?\.title \|\| ''\}/);
  assert.match(mapSource, /<h2[^>]*>\{popupPlace\.title\}<\/h2>/);
  assert.match(mapSource, /setPopupPlace\(place\).*mapRef\.current\?\.easeTo/s);
});

test('the application uses only api_public trajectory RPC access', () => {
  assert.match(adapterSource, /\/rest\/v1\/rpc\/get_public_trajectory/);
  assert.match(adapterSource, /Content-Profile': PUBLIC_SCHEMA/);
  assert.doesNotMatch(adapterSource, /app_private|\/rest\/v1\/app(?:\/|['"])/);
});

test('public playback consumes only the derived dwell scalar, never trusted timestamps', () => {
  assert.match(publicVisitAdapterSource, /narrative_dwell_ms/);
  assert.doesNotMatch(publicVisitAdapterSource, /started_at|ended_at|trajectory_source_records|trajectory_samples/);
  assert.match(dwellSource, /durationMinutes < 30/);
  assert.match(dwellSource, /durationMinutes < 45/);
  assert.match(dwellSource, /return 8_000/);
  assert.match(importerSource, /narrative_dwell_ms/);
  assert.doesNotMatch(importerSource, /occurred_at.*-.*occurred_at/s);
});

test('the importer preserves the Golden path and map integrates latched Movement framing with center-only follow', () => {
  assert.match(importerSource, /enriched-trajectory\.json/);
  assert.match(importerSource, /'interpolated'/);
  assert.doesNotMatch(mapSource, /lastFollowCameraAtRef|now - lastFollowCameraAtRef/);
  assert.match(mapSource, /getMovementCameraAction\(activeMovement, activeFrame\.position/);
  assert.match(mapSource, /action\?\.kind === 'frame'/);
  assert.match(mapSource, /map\.setCenter\(action\.center\)/);
  assert.match(mapSource, /easing: \(t: number\) => t \* \(2 - t\)/);
  assert.match(mapSource, /MiniPositionAvatar/);
  assert.match(mapSource, /setIsDwelling\(true\); setDwellProgress\(0\); activateSpot\(place\)/);
  assert.match(mapSource, /shouldFollowMovementCamera\(isPlaying, isDwelling, isGapTransition, movementElapsedMs, activeMovement\.durationMs\)/);
});
