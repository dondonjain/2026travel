const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { reconstructTimelineTrip } = require('./cms/reconstruction.ts');
const { generateIngestionSqlStatements, persistReconstructedTrip } = require('./cms/persist-ingestion.ts');

const RAW_TIMELINE_PATH = path.resolve(__dirname, '../data/raw/Timeline.json');
const PLACES_META_PATH = path.resolve(__dirname, '../data/places-metadata.json');

// 1. Valid Timeline JSON Ingestion & Date Boundary
test('CMS CP3: Ingestion parses raw Timeline JSON within date boundary', () => {
  assert.ok(fs.existsSync(RAW_TIMELINE_PATH), 'Raw Timeline.json must exist');
  const rawTimeline = JSON.parse(fs.readFileSync(RAW_TIMELINE_PATH, 'utf8'));

  const result = reconstructTimelineTrip({
    timelineData: rawTimeline,
    startDate: '2026-08-14',
    endDate: '2026-08-20',
    tripSlug: 'japan-2026'
  });

  assert.ok(result, 'Reconstruction result must be produced');
  assert.equal(result.trip.slug, 'japan-2026');
  assert.equal(result.trip.startsOn, '2026-08-14');
  assert.equal(result.trip.endsOn, '2026-08-20');
  assert.equal(result.trip.publicationStatus, 'draft');

  // Verify scan stats
  assert.equal(result.stats.rawTimelineEntriesScanned, 904);
  assert.ok(result.stats.rawVisitsInWindow >= 35);
  assert.equal(result.visits.length, 29, 'Must produce exactly 29 clean candidate visits');
});

// 2. Safe Error Handling on Invalid Input
test('CMS CP3: Safe handling of invalid Timeline JSON and missing boundaries', () => {
  assert.throws(() => {
    reconstructTimelineTrip({
      timelineData: [],
      startDate: '2026-08-14',
      endDate: '2026-08-20'
    });
  }, /non-empty array/);

  assert.throws(() => {
    reconstructTimelineTrip({
      timelineData: [{ startTime: '2026-08-14T00:00:00Z' }],
      startDate: '',
      endDate: '2026-08-20'
    });
  }, /startDate and endDate are required/);
});

// 3. Candidate Visits State Invariants (Pending + Public)
test('CMS CP3: Reconstructed Candidate Visits all start as Pending and default to Public', () => {
  const rawTimeline = JSON.parse(fs.readFileSync(RAW_TIMELINE_PATH, 'utf8'));
  const result = reconstructTimelineTrip({
    timelineData: rawTimeline,
    startDate: '2026-08-14',
    endDate: '2026-08-20'
  });

  assert.equal(result.visits.length, 29);

  for (const v of result.visits) {
    // Contract Check: ALL reconstructed visits must enter as Pending
    assert.equal(v.reviewStatus, 'pending', `Visit ${v.id} (${v.title}) must be pending`);
    // Contract Check: Default visibility must be Public
    assert.equal(v.visibility, 'public', `Visit ${v.id} (${v.title}) must default to public`);
    // Structural integrity
    assert.ok(v.id, 'Visit must have an ID');
    assert.ok(v.dayNumber >= 1 && v.dayNumber <= 7, 'Day number must be within 1..7');
    assert.ok(v.title, 'Visit must have a title');
    assert.ok(v.placeName, 'Visit must have a place name');
    assert.ok(v.evidence, 'Visit must retain source evidence');
  }
});

// 4. Noise Filtering & Anomaly Handling
test('CMS CP3: Filters short-stop noise and flags endpoint anomalies', () => {
  const rawTimeline = JSON.parse(fs.readFileSync(RAW_TIMELINE_PATH, 'utf8'));
  const result = reconstructTimelineTrip({
    timelineData: rawTimeline,
    startDate: '2026-08-14',
    endDate: '2026-08-20'
  });

  const { anomalyReport } = result;

  // 1. Short-stop noise filter: duration < 180s
  assert.ok(anomalyReport.summary.totalShortStopsRemoved >= 1, 'Must remove at least 1 short stop noise');
  const shortStop = anomalyReport.shortStopsRemoved[0];
  assert.ok(shortStop.durationSec < 180, 'Removed stop must have duration < 180s');

  // 2. Geographic & Date endpoint anomaly filter: Taiwan / out-of-bounds
  assert.ok(anomalyReport.summary.totalEndpointAnomalies >= 1, 'Must detect out-of-trip endpoint anomaly');
  const endpointAnomaly = anomalyReport.endpointAnomalies.find(a => a.reason.includes('outside target region') || a.reason.includes('Coordinate'));
  assert.ok(endpointAnomaly, 'Must identify Taiwan/Tainan endpoint anomaly');

  // 3. Duplicate and subvenues flattened
  assert.equal(anomalyReport.summary.totalFlattenedRecords, 4, 'Must flatten 4 nested/near-timestamp duplicate records');
});

// 5. Place Identity Clustering & Revisit Resolution
test('CMS CP3: Reuses Place identities for revisits without collapsing separate visits', () => {
  const rawTimeline = JSON.parse(fs.readFileSync(RAW_TIMELINE_PATH, 'utf8'));
  const result = reconstructTimelineTrip({
    timelineData: rawTimeline,
    startDate: '2026-08-14',
    endDate: '2026-08-20'
  });

  // Five conflicted Visits lose automatic associations; three Places become unreferenced.
  assert.equal(result.visits.length, 29);
  assert.equal(result.places.length, 22);
  assert.deepEqual(result.visits.filter(v => v.resolution?.hasSpatialConflict).map(v => v.evidence.sourceIndex), [464, 475, 476, 501, 521]);
  for (const visit of result.visits.filter(v => v.resolution?.hasSpatialConflict)) {
    assert.ok(!result.places.some(p => p.candidateVisitIds.includes(visit.id)));
  }
  assert.notEqual(result.visits.length, result.places.length, 'Visit count and Place count must not be forced 1:1');

  // Confirmed identity groups remain reusable for non-conflicted Visits.
  assert.equal(result.stats.repeatedPlaceGroupsCount, 2);

  const repeatedPlaces = result.places.filter(p => p.visitCount > 1);
  assert.equal(repeatedPlaces.length, 2);

  for (const p of repeatedPlaces) {
    // Assert that each repeated place is referenced by multiple distinct visits
    const referencingVisits = result.visits.filter(v => v.placeName === p.canonicalName);
    assert.ok(referencingVisits.length >= 2, `Place ${p.canonicalName} must be referenced by at least 2 visits`);
    // Ensure all referencing visits have distinct IDs
    const visitIds = new Set(referencingVisits.map(v => v.id));
    assert.equal(visitIds.size, referencingVisits.length, 'Revisited places must preserve distinct visit instances');
  }
});

// 6. Trajectory Continuity & Technical Samples
test('CMS CP3: Reconstructs chronological trajectory samples and preserves source records', () => {
  const rawTimeline = JSON.parse(fs.readFileSync(RAW_TIMELINE_PATH, 'utf8'));
  const result = reconstructTimelineTrip({
    timelineData: rawTimeline,
    startDate: '2026-08-14',
    endDate: '2026-08-20'
  });

  assert.ok(result.samples.length > 300, 'Must extract trajectory samples');
  assert.ok(result.sourceRecords.length > 0, 'Must extract source records');

  // Assert sequence numbers are sequential
  for (let i = 0; i < result.samples.length; i++) {
    assert.equal(result.samples[i].sequenceNo, i + 1, 'Sample sequenceNo must be 1-indexed sequential');
  }

  // Assert chronological ordering
  for (let i = 1; i < result.samples.length; i++) {
    const tPrev = new Date(result.samples[i - 1].recordedAt).getTime();
    const tCurr = new Date(result.samples[i].recordedAt).getTime();
    assert.ok(tCurr >= tPrev, `Samples must be chronological: ${tPrev} <= ${tCurr}`);
  }

  // Source records preserve raw payloads
  assert.ok(result.sourceRecords[0].rawPayload, 'Source record must preserve rawPayload');
});

// 7. CMSTrip Fixture Compatibility (feeds CP1 Shell)
test('CMS CP3: Reconstructed CMSTrip feeds approved CP1 UI Review Shell', () => {
  const rawTimeline = JSON.parse(fs.readFileSync(RAW_TIMELINE_PATH, 'utf8'));
  let meta = {};
  if (fs.existsSync(PLACES_META_PATH)) {
    meta = JSON.parse(fs.readFileSync(PLACES_META_PATH, 'utf8'));
  }

  const result = reconstructTimelineTrip({
    timelineData: rawTimeline,
    startDate: '2026-08-14',
    endDate: '2026-08-20',
    placeMetadataMap: meta
  });

  const { cmsTrip } = result;
  assert.equal(cmsTrip.days.length, 7, 'Must generate 7 days');
  assert.equal(cmsTrip.visits.length, 29, 'Must generate 29 visits');
  assert.equal(cmsTrip.usableTrajectory, true, 'Usable trajectory flag must be true');

  // Verify that CP1 day grouping works (days 1-6 have candidate visits, day 7 is travel/return day)
  for (let d = 1; d <= 6; d++) {
    const dayVisits = cmsTrip.visits.filter(v => v.dayNumber === d);
    assert.ok(dayVisits.length > 0, `Day ${d} must have visits`);
  }
  const day7Visits = cmsTrip.visits.filter(v => v.dayNumber === 7);
  assert.equal(day7Visits.length, 0, 'Day 7 in raw Timeline contains activities and flight home, no raw visits');
});

// 8. Database Persistence Simulation & Transaction Safety
test('CMS CP3: Database persistence simulation executes full transactional DDL/DML', async () => {
  const rawTimeline = JSON.parse(fs.readFileSync(RAW_TIMELINE_PATH, 'utf8'));
  const result = reconstructTimelineTrip({
    timelineData: rawTimeline,
    startDate: '2026-08-14',
    endDate: '2026-08-20',
    tripSlug: 'japan-2026-test'
  });

  const executedQueries = [];
  const mockClient = {
    async query(sql, params) {
      executedQueries.push({ sql: sql.trim(), params });
      if (sql.includes('RETURNING id')) {
        return { rows: [{ id: 'mock-uuid-123' }] };
      }
      return { rows: [] };
    }
  };

  const persistResult = await persistReconstructedTrip({
    client: mockClient,
    reconstructionResult: result,
    overwriteDraft: true
  });

  assert.ok(persistResult.tripId);
  assert.equal(persistResult.placesPersisted, 22);
  assert.equal(persistResult.visitsPersisted, 29);
  assert.ok(persistResult.samplesPersisted > 300);

  // Assert transaction boundaries
  assert.equal(executedQueries[0].sql, 'BEGIN;');
  assert.equal(executedQueries[executedQueries.length - 1].sql, 'COMMIT;');

  // Assert Trips upserted as draft
  const tripInsert = executedQueries.find(q => q.sql.includes('INSERT INTO app.trips'));
  assert.ok(tripInsert, 'Must execute trip insert');
  assert.ok(tripInsert.sql.includes("'draft'"), 'Trip must be inserted as draft');

  // Assert Visits inserted as pending + public
  const visitInserts = executedQueries.filter(q => q.sql.includes('INSERT INTO app.visits'));
  assert.equal(visitInserts.length, 29, 'Must execute 29 visit inserts');
  for (const vi of visitInserts) {
    assert.ok(vi.sql.includes("'pending'"), 'Visits must be inserted as pending');
    assert.ok(vi.sql.includes("'public'"), 'Visits must be inserted as public');
  }

  // Assert Trajectory inserted as draft
  const trajInsert = executedQueries.find(q => q.sql.includes('INSERT INTO app.trajectories'));
  assert.ok(trajInsert, 'Must execute trajectory insert');
  assert.ok(trajInsert.sql.includes("'draft'"), 'Trajectory must be inserted as draft');
});

// 9. SQL Statement Generator Invariants
test('CMS CP3: generateIngestionSqlStatements produces deterministic execution blocks', () => {
  const rawTimeline = JSON.parse(fs.readFileSync(RAW_TIMELINE_PATH, 'utf8'));
  const result = reconstructTimelineTrip({
    timelineData: rawTimeline,
    startDate: '2026-08-14',
    endDate: '2026-08-20'
  });

  const statements = generateIngestionSqlStatements(result);
  assert.ok(statements.length > 50, 'Must generate SQL statements');

  const tripStmt = statements.find(s => s.sql.includes('INSERT INTO app.trips'));
  assert.ok(tripStmt, 'Must contain Trip insert');
  assert.equal(tripStmt.params[1], result.trip.slug);

  const visitStmts = statements.filter(s => s.sql.includes('INSERT INTO app.visits'));
  assert.equal(visitStmts.length, 29, 'Must contain 29 visit insert statements');
});
