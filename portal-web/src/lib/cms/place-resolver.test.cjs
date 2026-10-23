const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolvePlaceName,
  resolvePlacesBatch,
  clearPlaceResolutionCache,
  isValidSpecificName
} = require('./place-resolver.ts');

test('PlaceResolver: Identifies generic placeholder names correctly', () => {
  assert.equal(isValidSpecificName(null), false);
  assert.equal(isValidSpecificName(''), false);
  assert.equal(isValidSpecificName('   '), false);
  assert.equal(isValidSpecificName('造訪場所 1'), false);
  assert.equal(isValidSpecificName('停留點 2'), false);
  assert.equal(isValidSpecificName('未知地點'), false);
  assert.equal(isValidSpecificName('Visit 5'), false);
  assert.equal(isValidSpecificName('岡山車站抵達 (JR Okayama Station)'), true);
  assert.equal(isValidSpecificName('天然溫泉 吉備之湯 岡山多米飯店'), true);
  assert.equal(isValidSpecificName('下石井1丁目'), true);
});

test('PlaceResolver: Retains existing display name when no POI was found', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ elements: [], features: [] }) }));
  clearPlaceResolutionCache();
  const res = await resolvePlaceName({
    existingName: '岡山車站抵達 (JR Okayama Station)',
    googlePlaceId: 'ChIJxxx',
    coordinate: [133.917, 34.666]
  });

  assert.equal(res.name, '岡山車站抵達 (JR Okayama Station)');
  assert.equal(res.source, 'existing');
});

test('PlaceResolver: Falls back safely when providers fail', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('unavailable'); });
  clearPlaceResolutionCache();
  const res = await resolvePlaceName({
    existingName: '造訪場所 1', // generic placeholder should be ignored
    coordinate: [133.9176, 34.6620],
    semanticType: 'INFERRED_HOME'
  });

  // Must not return '造訪場所 1' and must not return 'node-2' mock
  assert.ok(res.name.length > 0);
  assert.notEqual(res.name, '岡山後樂園漫步');
  assert.equal(res.source, 'fallback');
  assert.equal(res.status, 'NO_CANDIDATES');
});

test('PlaceResolver: Batch resolution retains separate Visit results', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ elements: [], features: [] }) }));
  clearPlaceResolutionCache();
  const requests = [
    { existingName: '地點 A', coordinate: [133.91, 34.66] },
    { existingName: '地點 A', coordinate: [133.91, 34.66] }
  ];

  const results = await resolvePlacesBatch(requests);
  assert.equal(results.length, 2);
  assert.equal(results[0].name, '地點 A');
  assert.equal(results[1].name, '地點 A');
});
