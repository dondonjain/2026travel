const test = require('node:test');
const assert = require('node:assert/strict');
const { TrajectoryAnalyzer } = require('./trajectory-analyzer.ts');
const { PoiFetcher, OverpassAdapter, MapboxSearchBoxAdapter } = require('./poi-fetcher.ts');
const { PoiRankingEngine } = require('./poi-ranking-engine.ts');
const { resolvePlaceName } = require('./place-resolver.ts');
const { reconstructTimelineTrip, reconstructTimelineTripAsync } = require('./reconstruction.ts');
const { generateIngestionSqlStatements, persistReconstructedTrip } = require('./persist-ingestion.ts');
const start = Date.parse('2026-08-14T19:00:00+09:00');
const anchor = { coordinate: [133.9, 34.6], timestamp: start, role: 'visit' };
const visit = { coordinate: anchor.coordinate, startedAt: new Date(start).toISOString(), endedAt: new Date(start + 14 * 3600000).toISOString(), timeZone: 'Asia/Tokyo' };
const observations = [{ coordinate: anchor.coordinate, timestamp: start }, { coordinate: [133.91, 34.6], timestamp: start + 14 * 3600000 }];
const candidate = (id, categories, coordinate = anchor.coordinate) => ({ id, name: id, coordinate, categories, source: 'overpass', sourceIds: [id] });
const response = data => async () => ({ ok: true, json: async () => data });

test('gap thresholds are strict; unsorted points, timezone and unrelated gaps are handled', () => {
  const analyzer = new TrajectoryAnalyzer();
  const result = analyzer.analyze(visit, [...observations].reverse());
  assert.equal(result.hasSpatialConflict, true);
  assert.equal(result.isOvernight, true);
  assert.deepEqual(result.searchAnchors.map(a => a.coordinate), observations.map(a => a.coordinate));
  assert.equal(analyzer.analyze(visit, [observations[0], { ...observations[1], timestamp: start + 3 * 3600000 }]).hasSpatialConflict, false);
  assert.equal(analyzer.analyze(visit, [observations[0], { ...observations[1], coordinate: [133.9001, 34.6] }]).hasSpatialConflict, false);
  assert.equal(analyzer.analyze({ ...visit, startedAt: new Date(start + 15 * 3600000).toISOString(), endedAt: new Date(start + 16 * 3600000).toISOString() }, observations).hasSpatialConflict, false);
  assert.equal(analyzer.analyze(visit, []).hasSpatialConflict, false);
});

test('Mapbox administrative and address results are context only', async () => {
  const features = ['neighborhood', 'locality', 'address', 'poi'].map(feature_type => ({
    properties: { name: feature_type, feature_type, mapbox_id: feature_type, poi_category_ids: ['hotel'] }, geometry: { coordinates: anchor.coordinate }
  }));
  const result = await new MapboxSearchBoxAdapter('test-placeholder', response({ features })).search(anchor);
  assert.deepEqual(result.candidates.map(c => c.name), ['poi']);
  assert.equal(result.fallbackAreaContext.length, 3);
});

test('Overpass merges nearby same-name same-category nodes and ways, not distant branches', async () => {
  const elements = [
    { type: 'node', id: 1, lon: 133.9, lat: 34.6, tags: { name: 'Hotel', tourism: 'hotel' } },
    { type: 'way', id: 2, center: { lon: 133.9001, lat: 34.6 }, tags: { name: 'Hotel', tourism: 'hotel' } },
    { type: 'node', id: 3, lon: 133.904, lat: 34.6, tags: { name: 'Hotel', tourism: 'hotel' } },
    { type: 'node', id: 4, lon: 133.9, lat: 34.6, tags: { name: 'District', place: 'suburb' } }
  ];
  const result = await new OverpassAdapter(response({ elements })).search(anchor);
  assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[0].sourceIds.length, 2);
  assert.equal(result.fallbackAreaContext.length, 1);
});

test('ranking boosts lodging overnight and dining/shop for child Visits with distance decay', () => {
  const engine = new PoiRankingEngine();
  const analysis = { searchAnchors: [anchor], isOvernight: true, hasSpatialConflict: false };
  const candidates = [candidate('food', ['restaurant']), candidate('hotel', ['hotel']), candidate('far', ['hotel'], [134, 34.6])];
  assert.equal(engine.rank(candidates, analysis)[0].id, 'hotel');
  assert.equal(engine.rank(candidates, { ...analysis, isOvernight: false }, true)[0].id, 'food');
  assert.equal(engine.rank(candidates, analysis).at(-1).id, 'far');
});

test('conflict overrides a confident POI; both anchors queried; provider errors remain sanitized', async () => {
  const seen = [];
  const fetcher = new PoiFetcher([{ async search(a) { seen.push(a); return { candidates: [candidate('hotel', ['hotel'])], fallbackAreaContext: [], providerFailures: [] }; } }]);
  const conflict = await resolvePlaceName({ ...visit, timelinePath: observations }, fetcher);
  assert.equal(conflict.status, 'SPATIAL_CONFLICT_OVERNIGHT');
  assert.equal(seen.length, 2);
  assert.equal(conflict.candidates.length, 1);
  const clear = await resolvePlaceName(visit, fetcher);
  assert.equal(clear.status, 'HIGH_CONFIDENCE_SUGGESTED');
  const failed = await resolvePlaceName(visit, new PoiFetcher([{ async search() { throw new Error('private provider URL'); } }]));
  assert.equal(failed.status, 'NO_CANDIDATES');
  assert.ok(!JSON.stringify(failed).includes('private provider URL'));
});

const timeline = [
  { startTime: visit.startedAt, endTime: visit.endedAt, visit: { hierarchyLevel: 0, topCandidate: { placeID: 'source', placeName: 'Source candidate', placeLocation: 'geo:34.6,133.9' } }, timelinePath: [{ point: 'geo:34.6,133.9', durationMinutesOffsetFromStartTime: 0 }] },
  { startTime: visit.endedAt, timelinePath: [{ point: 'geo:34.6,133.91', durationMinutesOffsetFromStartTime: 0 }] }
];
test('sync reconstruction and both SQL writers retain null even with a stale associated Place', async () => {
  const result = reconstructTimelineTrip({ timelineData: timeline, startDate: '2026-08-14', endDate: '2026-08-15' });
  assert.equal(result.visits[0].resolution.status, 'SPATIAL_CONFLICT_OVERNIGHT');
  assert.equal(result.places.length, 0);
  result.places.push({ id: 'stale', canonicalName: 'Stale', location: anchor.coordinate, candidateVisitIds: [result.visits[0].id] });
  const statements = generateIngestionSqlStatements(result);
  assert.equal(statements.find(s => s.sql.includes('INSERT INTO app.visits')).params[2], null);
  assert.equal(statements.find(s => s.sql.includes('INSERT INTO app.visits')).params[10], 'SPATIAL_CONFLICT_OVERNIGHT');
  assert.ok(!statements.some(s => s.sql.includes('INSERT INTO app.places')));
  const executed = [];
  await persistReconstructedTrip({ reconstructionResult: result, overwriteDraft: false, client: { async query(sql, params) { executed.push({ sql, params }); return { rows: [] }; } } });
  assert.equal(executed.find(s => s.sql.includes('INSERT INTO app.visits')).params[2], null);
  assert.equal(executed.find(s => s.sql.includes('INSERT INTO app.visits')).params[10], 'SPATIAL_CONFLICT_OVERNIGHT');
  assert.ok(!executed.some(s => s.sql.includes('INSERT INTO app.places')));
});

test('async ingestion never converts provider areas into Places', async (t) => {
  t.mock.method(globalThis, 'fetch', response({ elements: [], features: [{ properties: { name: 'District', feature_type: 'locality' } }] }));
  const result = await reconstructTimelineTripAsync({ timelineData: timeline, startDate: '2026-08-14', endDate: '2026-08-15' });
  assert.equal(result.places.length, 0);
  assert.equal(result.visits[0].resolution.hasSpatialConflict, true);
  assert.equal(result.visits[0].resolution.candidates.length, 0);
});
