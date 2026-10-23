const test = require('node:test');
const assert = require('node:assert/strict');
const { reconstructTimelineTrip } = require('./cms/reconstruction.ts');
const { generateIngestionSqlStatements, persistReconstructedTrip } = require('./cms/persist-ingestion.ts');

test('nearby same-name Places stay distinct in both importer paths; explicit IDs preserve revisits', async () => {
  const entries = [
    ['10:00', '10:30', 'place-A', 'geo:34.6660,133.9170'],
    ['11:00', '11:30', 'place-B', 'geo:34.6661,133.9171'],
    ['12:00', '12:30', 'place-A', 'geo:34.6660,133.9170'],
    ['13:00', '13:30', undefined, 'geo:34.6662,133.9172']
  ].map(([start, end, placeID, placeLocation]) => ({
    startTime: `2026-08-14T${start}:00+09:00`, endTime: `2026-08-14T${end}:00+09:00`,
    visit: { hierarchyLevel: 0, topCandidate: { placeID, placeLocation, placeName: '同名場所' } }
  }));
  const result = reconstructTimelineTrip({ timelineData: entries, startDate: '2026-08-14', endDate: '2026-08-14' });
  assert.equal(result.places.length, 3);
  const places = result.visits.map(v => result.places.find(p => p.candidateVisitIds.includes(v.id)));
  assert.notEqual(places[0].id, places[1].id);
  assert.equal(places[0].id, places[2].id);
  const inserts = generateIngestionSqlStatements(result).filter(q => q.sql.includes('INSERT INTO app.visits'));
  inserts.forEach((q, i) => assert.equal(q.params[2], places[i].id));
  const calls = [];
  await persistReconstructedTrip({ reconstructionResult: result, client: { async query(sql, params) {
    calls.push({ sql, params });
    return { rows: sql.includes('RETURNING id') ? [{ id: params[0] }] : [] };
  } } });
  calls.filter(q => q.sql.includes('INSERT INTO app.visits')).forEach((q, i) => assert.equal(q.params[2], places[i].id));
  const orphaned = { ...result, places: [] };
  assert.throws(() => generateIngestionSqlStatements(orphaned), /no explicit Place association/);
});
