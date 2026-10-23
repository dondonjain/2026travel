/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  fetchSupabaseEnrichedPlaces,
  mapPublicReadModelToEnrichedPlaces
} = require('./supabase-places.ts');

const baseVisit = {
  trip_slug: 'japan-2026',
  visit_id: 'visit-1',
  title: '公開景點',
  description: '公開描述',
  occurred_at: '2026-09-01T23:30:00Z',
  narrative_dwell_ms: 6500,
  time_zone: 'Asia/Tokyo',
  presentation_category: 'spot',
  tags: ['歷史', '日本'],
  is_highlight: false,
  place_name: '公開場所',
  latitude: 35.6,
  longitude: 139.7
};

test('maps visits and media into the existing presentation DTO', () => {
  const places = mapPublicReadModelToEnrichedPlaces(
    [baseVisit],
    [
      {
        trip_slug: 'japan-2026',
        visit_id: 'visit-1',
        media_type: 'youtube',
        url: 'https://www.youtube.com/watch?v=abcdefghijk',
        thumbnail_url: 'https://example.test/video.jpg',
        title: '影片',
        caption: '影片說明',
        display_order: 1,
        origin_kind: 'visit_captured'
      },
      {
        trip_slug: 'japan-2026',
        visit_id: 'visit-1',
        media_type: 'image',
        url: 'https://example.test/photo.jpg',
        thumbnail_url: null,
        title: '照片',
        caption: null,
        display_order: 0,
        origin_kind: 'visit_captured'
      }
    ]
  );

  assert.equal(places.length, 1);
  assert.equal(places[0].id, 'visit-1');
  assert.equal(places[0].title, '公開景點');
  assert.equal(places[0].description, '公開描述');
  assert.equal(places[0].category, 'spot');
  assert.deepEqual(places[0].tags, ['歷史', '日本']);
  assert.equal(places[0].isHighlight, false);
  assert.equal(places[0].narrativeDwellMs, 6500);
  assert.match(places[0].formattedTime, /\d{2}:\d{2}$/);
  assert.doesNotMatch(places[0].formattedTime, /\d{2}:\d{2}:\d{2}/);
  assert.deepEqual(places[0].coordinates, [139.7, 35.6]);
  assert.deepEqual(places[0].media.map((item) => item.type), ['image', 'youtube']);
  assert.equal(places[0].coverImageUrl, 'https://example.test/photo.jpg');
  assert.equal(places[0].dateStr, '2026-09-02');
  assert.equal(places[0].dayNumber, 1);
});

test('preserves private coordinates as null and handles missing media', () => {
  const places = mapPublicReadModelToEnrichedPlaces(
    [{ ...baseVisit, visit_id: 'private-place', latitude: null, longitude: null }],
    []
  );

  assert.equal(places[0].coordinates, null);
  assert.notDeepEqual(places[0].coordinates, [0, 0]);
  assert.deepEqual(places[0].media, []);
  assert.ok(places[0].coverImageUrl);
});

test('uses only the approved public dwell scalar and falls back when it is absent', () => {
  const places = mapPublicReadModelToEnrichedPlaces(
    [{ ...baseVisit, visit_id: 'fallback-dwell', narrative_dwell_ms: null }],
    []
  );
  assert.equal(places[0].narrativeDwellMs, 4000);
});

test('keeps highlight-first, timestamp, and day grouping semantics', () => {
  const places = mapPublicReadModelToEnrichedPlaces(
    [
      { ...baseVisit, visit_id: 'later', occurred_at: '2026-09-03T01:00:00Z' },
      { ...baseVisit, visit_id: 'highlight', occurred_at: '2026-09-04T01:00:00Z', is_highlight: true },
      { ...baseVisit, visit_id: 'earlier', occurred_at: '2026-09-02T01:00:00Z' }
    ],
    []
  );

  assert.deepEqual(places.map((place) => place.id), ['highlight', 'earlier', 'later']);
  assert.deepEqual(
    Object.fromEntries(places.map((place) => [place.id, place.dayNumber])),
    { highlight: 3, earlier: 1, later: 2 }
  );
});

test('uses only separate api_public view requests and joins in the adapter', async () => {
  const requests = [];
  const payloads = {
    public_trips: [{ slug: 'japan-2026' }],
    public_trip_visits: [baseVisit],
    public_visit_media: []
  };
  const fetchImpl = async (input, init) => {
    const url = new URL(input.toString());
    const resource = url.pathname.split('/').at(-1);
    requests.push({ url, init });
    return new Response(JSON.stringify(payloads[resource]), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };

  const places = await fetchSupabaseEnrichedPlaces('japan-2026', {
    config: {
      url: 'https://example.supabase.co',
      publishableKey: 'public-test-key'
    },
    fetchImpl
  });

  assert.equal(places.length, 1);
  assert.deepEqual(
    requests.map(({ url }) => url.pathname),
    [
      '/rest/v1/public_trips',
      '/rest/v1/public_trip_visits',
      '/rest/v1/public_visit_media'
    ]
  );
  assert.ok(requests.every(({ init }) => init.headers['Accept-Profile'] === 'api_public'));
  assert.ok(requests.every(({ url }) => !url.pathname.includes('app_private')));
});
