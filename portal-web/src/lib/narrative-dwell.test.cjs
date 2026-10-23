/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  NARRATIVE_DWELL_FALLBACK_MS,
  narrativeDwellMsFromPublicValue,
  narrativeDwellMsFromTrustedDurationMinutes
} = require('./narrative-dwell.js');

test('maps every approved half-open trusted-duration boundary exactly', () => {
  assert.equal(narrativeDwellMsFromTrustedDurationMinutes(29.99), 1500);
  assert.equal(narrativeDwellMsFromTrustedDurationMinutes(30), 2000);
  assert.equal(narrativeDwellMsFromTrustedDurationMinutes(45), 2800);
  assert.equal(narrativeDwellMsFromTrustedDurationMinutes(60), 4000);
  assert.equal(narrativeDwellMsFromTrustedDurationMinutes(90), 5000);
  assert.equal(narrativeDwellMsFromTrustedDurationMinutes(120), 6500);
  assert.equal(narrativeDwellMsFromTrustedDurationMinutes(180), 8000);
});

test('maps representative values inside every approved bucket without interpolation', () => {
  assert.deepEqual(
    [15, 37, 50, 75, 100, 150, 240].map(narrativeDwellMsFromTrustedDurationMinutes),
    [1500, 2000, 2800, 4000, 5000, 6500, 8000]
  );
});

test('uses the approved four-second fallback for missing or invalid trusted duration', () => {
  for (const duration of [null, undefined, Number.NaN, -1]) {
    assert.equal(narrativeDwellMsFromTrustedDurationMinutes(duration), NARRATIVE_DWELL_FALLBACK_MS);
  }
  assert.equal(narrativeDwellMsFromPublicValue(null), 4000);
  assert.equal(narrativeDwellMsFromPublicValue(1234), 4000);
  assert.equal(narrativeDwellMsFromPublicValue(6500), 6500);
});
