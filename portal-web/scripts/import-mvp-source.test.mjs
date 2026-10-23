import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { prepareMvpImportData } from './lib/import-mvp-sources.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const parsedTrajectory = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../src/data/parsed-trajectory.json'), 'utf8')
);
const enrichedTrajectory = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../src/data/enriched-trajectory.json'), 'utf8')
);

test('separates parsed Visit content from Golden enriched technical samples', () => {
  const parsedLine = parsedTrajectory.features.find(
    (feature) => feature.geometry.type === 'LineString'
  );
  const enrichedLine = enrichedTrajectory.features.find(
    (feature) => feature.geometry.type === 'LineString'
  );
  const parsedVisitPoints = parsedTrajectory.features.filter(
    (feature) => feature.geometry.type === 'Point'
  );
  const { curatedVisitPointFeatures, technicalSamples } = prepareMvpImportData(
    parsedTrajectory,
    enrichedTrajectory
  );

  assert.equal(parsedLine.geometry.coordinates.length, 382);
  assert.equal(enrichedLine.geometry.coordinates.length, 24_852);
  assert.equal(technicalSamples.length, 24_852);
  assert.notEqual(technicalSamples.length, parsedLine.geometry.coordinates.length);
  assert.strictEqual(technicalSamples[1_000].coordinate, enrichedLine.geometry.coordinates[1_000]);
  assert.equal(technicalSamples[1_000].timestamp, enrichedTrajectory.properties.times[1_000]);

  assert.equal(curatedVisitPointFeatures.length, 35);
  assert.deepEqual(curatedVisitPointFeatures, parsedVisitPoints);
  assert.ok(technicalSamples.every((sample, index) => sample.sequenceNo === index));
});
