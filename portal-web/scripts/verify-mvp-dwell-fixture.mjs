import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { NARRATIVE_DWELL_ALLOWED_MS, NARRATIVE_DWELL_FALLBACK_MS } from '../src/lib/narrative-dwell.js';
import { validatedNarrativeDwellMs } from './trusted-visit-duration.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, '../src/data/parsed-trajectory.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const points = fixture.features.filter((feature) => feature.geometry?.type === 'Point');
const byDwellMs = Object.fromEntries(NARRATIVE_DWELL_ALLOWED_MS.map((dwellMs) => [dwellMs, 0]));
let curatedDwellVisits = 0;
let fallbackVisits = 0;

for (const point of points) {
  const dwellMs = validatedNarrativeDwellMs(point, NARRATIVE_DWELL_ALLOWED_MS, NARRATIVE_DWELL_FALLBACK_MS);
  if (NARRATIVE_DWELL_ALLOWED_MS.includes(point.properties?.narrativeDwellMs)) curatedDwellVisits += 1;
  else fallbackVisits += 1;
  byDwellMs[dwellMs] += 1;
}

const report = {
  fixture: 'japan-2026',
  totalVisits: points.length,
  curatedDwellVisits,
  fallbackVisits,
  dwellBucketDistribution: byDwellMs,
  totalNarrativeDwellMs: Object.entries(byDwellMs).reduce((sum, [dwellMs, count]) => sum + Number(dwellMs) * count, 0),
  fallbackMs: NARRATIVE_DWELL_FALLBACK_MS
};

console.log(JSON.stringify(report));
