const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeResolutionReview, fetchResolutionReview, reviewVisitPlace } = require('./poi-review.ts');
const { persistedResolutionStatus } = require('./place-resolver.ts');
const session = { url: 'https://example.invalid', publishableKey: 'placeholder-public', accessToken: 'placeholder-editor' };
const row = { id: 'pending-id', trip_slug: 'trip', place_id: null, title: 'Night', occurred_at: '2026-08-14T19:00:00+09:00', time_zone: 'Asia/Tokyo',
  presentation_category: '住宿', review_status: 'pending', visibility: 'private', resolution_status: 'SPATIAL_CONFLICT_OVERNIGHT',
  place_name: null, longitude: null, latitude: null };
const trip = { startDate: '2026-08-14', visits: [] };

test('CMS mapper includes new null-Place Visits and keeps conflicts pending after reload', () => {
  const loaded = mergeResolutionReview(trip, [row]);
  assert.equal(loaded.visits.length, 1);
  assert.equal(loaded.visits[0].placeId, null);
  assert.equal(loaded.visits[0].coordinate, null);
  assert.equal(loaded.visits[0].dayNumber, 1);
  assert.equal(loaded.visits[0].visibility, 'private');
  assert.ok(loaded.visits[0].issues.some(i => i.severity === 'required'));
  const manual = mergeResolutionReview(loaded, [{ ...row, place_id: 'place', resolution_status: 'MANUALLY_CONFIRMED', place_name: 'Hotel', longitude: 133.9, latitude: 34.6 }]);
  assert.equal(manual.visits[0].placeName, 'Hotel');
  assert.equal(manual.visits[0].issues.length, 0);
  assert.equal(manual.visits[0].reviewStatus, 'pending');
});
test('CMS reads authenticated private view, not confirmed-only preview', async () => {
  let called;
  const rows = await fetchResolutionReview('trip', session, async (url, options) => {
    called = { url, options };
    return { ok: true, json: async () => [row] };
  });
  assert.equal(rows[0].place_id, null);
  assert.equal(called.url.pathname, '/rest/v1/cms_visit_resolution_review');
  assert.equal(called.options.headers.Authorization, 'Bearer placeholder-editor');
  assert.equal(called.options.cache, 'no-store');
});
test('human action sends only selected POI fields and never persists Mapbox suggestions', async () => {
  let body;
  const request = async (_url, options) => { body = JSON.parse(options.body); return { ok: true }; };
  const candidate = { name: 'Hotel', coordinate: [133.9, 34.6], source: 'overpass', categories: ['hotel'] };
  await reviewVisitPlace('visit', { candidate }, session, request);
  assert.deepEqual(body, { p_visit_id: 'visit', p_name: 'Hotel', p_longitude: 133.9, p_latitude: 34.6 });
  await assert.rejects(reviewVisitPlace('visit', { candidate: { ...candidate, source: 'mapbox' } }, session, request));
  await reviewVisitPlace('visit', { placeId: 'existing-id' }, session, request);
  assert.deepEqual(body, { p_visit_id: 'visit', p_place_id: 'existing-id' });
});
test('failed review is not reported successful and provider error bodies are not exposed', async () => {
  await assert.rejects(reviewVisitPlace('v', { placeId: 'p' }, session, async () => ({ ok: false, status: 403 })), /403/);
});
test('conflict flag overrides an inconsistent suggested status before persistence', () => {
  assert.equal(persistedResolutionStatus({ status: 'HIGH_CONFIDENCE_SUGGESTED', hasSpatialConflict: true, isOvernight: true }), 'SPATIAL_CONFLICT_OVERNIGHT');
});
