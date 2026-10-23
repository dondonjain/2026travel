import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import pg from 'pg';
import { loadCapabilityEnvironment, runCapability, sanitizeDiagnostic } from './lib/secret-boundary.mjs';

const require = createRequire(import.meta.url);
const { reconstructTimelineTrip } = require('../src/lib/cms/reconstruction.ts');
const { persistReconstructedTrip, generateIngestionSqlStatements } = require('../src/lib/cms/persist-ingestion.ts');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const portalRoot = path.resolve(__dirname, '..');

const DEFAULT_TIMELINE_PATH = path.join(portalRoot, 'src/data/raw/Timeline.json');
const DEFAULT_META_PATH = path.join(portalRoot, 'src/data/places-metadata.json');

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  const inputArgIdx = args.indexOf('--input');
  const inputPath = inputArgIdx >= 0 ? path.resolve(args[inputArgIdx + 1]) : DEFAULT_TIMELINE_PATH;

  const startArgIdx = args.indexOf('--start');
  const startDate = startArgIdx >= 0 ? args[startArgIdx + 1] : '2026-08-14';

  const endArgIdx = args.indexOf('--end');
  const endDate = endArgIdx >= 0 ? args[endArgIdx + 1] : '2026-08-20';

  const slugArgIdx = args.indexOf('--slug');
  const tripSlug = slugArgIdx >= 0 ? args[slugArgIdx + 1] : 'japan-2026';

  const titleArgIdx = args.indexOf('--title');
  const tripTitle = titleArgIdx >= 0 ? args[titleArgIdx + 1] : undefined;

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  console.log(`[CMS Ingest] Loading Timeline data from ${inputPath}...`);
  const rawData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  let placeMetadataMap = {};
  if (fs.existsSync(DEFAULT_META_PATH)) {
    placeMetadataMap = JSON.parse(fs.readFileSync(DEFAULT_META_PATH, 'utf8'));
  }

  console.log(`[CMS Ingest] Running reconstruction for ${startDate} to ${endDate}...`);
  const result = reconstructTimelineTrip({
    timelineData: rawData,
    startDate,
    endDate,
    tripSlug,
    tripTitle,
    placeMetadataMap
  });

  console.log('[CMS Ingest] Reconstruction complete:');
  console.log(`  - Raw Timeline entries scanned: ${result.stats.rawTimelineEntriesScanned}`);
  console.log(`  - Raw visits in window: ${result.stats.rawVisitsInWindow}`);
  console.log(`  - Short-stop noise filtered: ${result.stats.shortStopsFiltered}`);
  console.log(`  - Endpoint anomalies filtered: ${result.stats.endpointAnomaliesFiltered}`);
  console.log(`  - Duplicate / Sub-venues flattened: ${result.stats.duplicatesAndSubVenuesFlattened}`);
  console.log(`  - Candidate Visits produced: ${result.stats.candidateVisitsProduced}`);
  console.log(`  - Unique Places identified: ${result.stats.uniquePlacesIdentified}`);
  console.log(`  - Repeated Place groups: ${result.stats.repeatedPlaceGroupsCount}`);
  console.log(`  - Trajectory samples: ${result.stats.trajectorySamplesCount}`);

  // All visits must be Pending and Public
  const allPending = result.visits.every(v => v.reviewStatus === 'pending');
  const allPublic = result.visits.every(v => v.visibility === 'public');
  if (!allPending || !allPublic) {
    throw new Error('Reconstruction invariant failed: All visits must be Pending and Public');
  }

  if (isDryRun) {
    console.log('[CMS Ingest] Dry-run requested. Generating SQL statements...');
    const statements = generateIngestionSqlStatements(result);
    console.log(`[CMS Ingest] Generated ${statements.length} SQL execution blocks.`);
    console.log('[CMS Ingest] Dry-run PASSED successfully.');
    return;
  }

  // Check if QA_DATABASE_WRITE_URL or DATABASE_URL is available
  let connectionString = null;
  try {
    const env = loadCapabilityEnvironment(['QA_DATABASE_WRITE_URL']);
    connectionString = env.QA_DATABASE_WRITE_URL;
  } catch {
    connectionString = process.env.DATABASE_URL || null;
  }

  if (!connectionString) {
    console.log('[CMS Ingest] No QA_DATABASE_WRITE_URL or DATABASE_URL found. Running dry-run verification mode...');
    const statements = generateIngestionSqlStatements(result);
    console.log(`[CMS Ingest] Validated ${statements.length} parameterized SQL statements. Ready for database persistence.`);
    return;
  }

  console.log('[CMS Ingest] Connecting to database for persistence...');
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    const persistRes = await persistReconstructedTrip({
      client,
      reconstructionResult: result,
      overwriteDraft: true
    });
    console.log('[CMS Ingest] Persistence SUCCESS:', persistRes);
  } finally {
    await client.end().catch(() => undefined);
  }
}

await runCapability('CMS Ingest Timeline', main);
