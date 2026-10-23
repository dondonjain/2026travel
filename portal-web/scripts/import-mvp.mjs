import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { narrativeDwellMsFromPublicValue, NARRATIVE_DWELL_FALLBACK_MS } from '../src/lib/narrative-dwell.js';
import { prepareMvpImportData } from './lib/import-mvp-sources.mjs';
import { loadCapabilityEnvironment, runCapability } from './lib/secret-boundary.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const requiredEnvName = 'QA_DATABASE_WRITE_URL';
const knownSecrets = [];

async function main() {
  const config = loadCapabilityEnvironment([requiredEnvName]);
  const connStr = config[requiredEnvName];
  knownSecrets.push(connStr);
  const client = new pg.Client({ connectionString: connStr });

  try {
    await client.connect();
    console.log('Connected to DB.');
    // 1. Read files
    const placesMetadataPath = path.join(__dirname, '../src/data/places-metadata.json');
    const parsedTrajectoryPath = path.join(__dirname, '../src/data/parsed-trajectory.json');
    const enrichedTrajectoryPath = path.join(__dirname, '../src/data/enriched-trajectory.json');

    const placesMetadata = JSON.parse(fs.readFileSync(placesMetadataPath, 'utf8'));
    const parsedTrajectory = JSON.parse(fs.readFileSync(parsedTrajectoryPath, 'utf8'));
    const enrichedTrajectory = JSON.parse(fs.readFileSync(enrichedTrajectoryPath, 'utf8'));

    // Visits retain their curated data from parsed trajectory. Technical samples
    // use the checked-in Golden MVP enriched trajectory in its existing order.
    const {
      curatedVisitPointFeatures: pointFeatures,
      technicalSamples
    } = prepareMvpImportData(parsedTrajectory, enrichedTrajectory);
    
    // We need to map node IDs to UUIDs
    // node-1 -> uuid
    const idMap = new Map();
    const getUuid = () => crypto.randomUUID();

    // 2. Auth as authenticated for curated content
    await client.query("SET ROLE authenticated;");
    await client.query("SET request.jwt.claims TO '{\"app_metadata\":{\"cms_role\":\"editor\"}}';");
    await client.query("SET search_path = app, public, extensions;");
    
    // 3. Cleanup existing data for the trip to ensure idempotency
    console.log(`Cleaning up existing data for japan-2026...`);
    const existingTripRes = await client.query("SELECT id FROM trips WHERE slug = 'japan-2026'");
    if (existingTripRes.rows.length > 0) {
      await client.query("RESET ROLE;"); // Reset to postgres to delete all
      
      const existingTripId = existingTripRes.rows[0].id;
      const visitsRes = await client.query("SELECT id FROM visits WHERE trip_id = $1", [existingTripId]);
      if (visitsRes.rows.length > 0) {
        const visitIds = visitsRes.rows.map(r => r.id);
        await client.query("DELETE FROM visit_media WHERE visit_id = ANY($1)", [visitIds]);
      }
      const trajRes = await client.query("SELECT id FROM trajectories WHERE trip_id = $1", [existingTripId]);
      if (trajRes.rows.length > 0) {
        const trajId = trajRes.rows[0].id;
        // MUST set to draft first to allow deleting child records (guard_technical_write trigger)
        await client.query("UPDATE trajectories SET publication_status = 'draft' WHERE id = $1", [trajId]);
        await client.query("DELETE FROM trajectory_redactions WHERE trajectory_id = $1", [trajId]);
        await client.query("DELETE FROM trajectory_samples WHERE trajectory_id = $1", [trajId]);
        await client.query("DELETE FROM trajectory_source_records WHERE trajectory_id = $1", [trajId]);
      }
      await client.query("DELETE FROM trajectories WHERE trip_id = $1", [existingTripId]);
      await client.query("DELETE FROM visits WHERE trip_id = $1", [existingTripId]);
      await client.query("DELETE FROM trips WHERE id = $1", [existingTripId]);
      
      await client.query("SET ROLE authenticated;");
      await client.query("SET request.jwt.claims TO '{\"app_metadata\":{\"cms_role\":\"editor\"}}';");
      await client.query("SET search_path = app, public, extensions;");
    }
    
    // Create Trip
    const tripId = getUuid();
    console.log('Inserting trip (japan-2026)...');
    await client.query(`
      INSERT INTO trips (id, slug, title, starts_on, ends_on, default_time_zone, publication_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [tripId, 'japan-2026', 'Okayama MVP (Japan 2026)', '2026-08-14', '2026-08-21', 'Asia/Tokyo', 'published']);

    // 4. Create Places & Visits
    console.log("Inserting Places & Visits...");
    let displayOrder = 0;
    const dwellReport = { trustedDurationVisits: 0, fallbackVisits: 0, byDwellMs: new Map() };
    
    // Sort point features by timestamp
    const sortedPoints = pointFeatures.sort((a, b) => new Date(a.properties.timestamp) - new Date(b.properties.timestamp));

    for (const point of sortedPoints) {
      const legacyId = point.properties.id; // e.g. node-1
      const meta = placesMetadata[legacyId] || {};
      
      const placeId = getUuid();
      const visitId = getUuid();
      idMap.set(legacyId, { placeId, visitId });

      const lng = point.geometry.coordinates[0];
      const lat = point.geometry.coordinates[1];
      // Only Visit-local, explicitly supplied trusted derived dwell is eligible.
      // Never infer dwell from neighbouring Visits, occurred_at, or GPS samples.
      const providedDwell = point.properties.narrativeDwellMs;
      const narrativeDwellMs = narrativeDwellMsFromPublicValue(providedDwell);
      if (typeof providedDwell !== 'number') dwellReport.fallbackVisits += 1;
      else dwellReport.trustedDurationVisits += 1;
      dwellReport.byDwellMs.set(narrativeDwellMs, (dwellReport.byDwellMs.get(narrativeDwellMs) || 0) + 1);

      // INSERT Place
      const canonicalName = meta.title || point.properties.title || legacyId;
      await client.query(`
        INSERT INTO places (id, canonical_name, location, location_status)
        VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3::float8, $4::float8), 4326), 'verified')
      `, [placeId, canonicalName, lng, lat]);

      // INSERT Visit
      await client.query(`
        INSERT INTO visits (id, trip_id, place_id, title, description, occurred_at, narrative_dwell_ms, time_zone, time_source, presentation_category, tags, is_highlight, publication_status, display_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        visitId, tripId, placeId, 
        meta.title || point.properties.title || null,
        meta.description || null,
        point.properties.timestamp,
        narrativeDwellMs,
        'Asia/Tokyo',
        'editorial',
        meta.category || 'spot',
        meta.tags || [],
        meta.isHighlight || false,
        'published',
        displayOrder++
      ]);

      // INSERT Media
      if (meta.media && meta.media.length > 0) {
        let mediaDisplayOrder = 0;
        for (const m of meta.media) {
          const mediaId = getUuid();
          // map external-video to external_video
          const mediaType = m.type === 'external-video' ? 'external_video' : m.type;
          
          await client.query(`
            INSERT INTO visit_media (id, visit_id, media_type, url, thumbnail_url, title, caption, origin_kind, display_order, publication_status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [
            mediaId, visitId, mediaType, m.url, m.thumbnail || null, m.title || null, m.caption || null, 'unknown', mediaDisplayOrder++, 'published'
          ]);
        }
      }
    }

    // 5. Auth as app_importer for trajectories
    console.log("Switching to app_importer for trajectory data...");
    await client.query("RESET ROLE;");
    await client.query("SET ROLE app_importer;");
    await client.query("SET search_path = app, public, extensions;");
    
    const trajectoryId = getUuid();
    const sourceStartedAt = new Date(technicalSamples[0].timestamp).toISOString();
    const sourceEndedAt = new Date(technicalSamples.at(-1).timestamp).toISOString();
    
    // We insert into trajectories AS DRAFT first because the policy requires it
    console.log('Inserting trajectory...');
    await client.query(`
      INSERT INTO trajectories (id, trip_id, source_started_at, source_ended_at)
      VALUES ($1, $2, $3, $4)
    `, [trajectoryId, tripId, sourceStartedAt, sourceEndedAt]);

    const sourceRecordId = getUuid();
    console.log(`Inserting trajectory source record...`);
    await client.query(`
      INSERT INTO trajectory_source_records (id, trajectory_id, source_kind, source_key, started_at, ended_at, raw_payload)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [sourceRecordId, trajectoryId, 'timeline_path', 'mvp_json_import', sourceStartedAt, sourceEndedAt, JSON.stringify({ note: 'MVP real data import' })]);

    console.log(`Inserting trajectory samples... count=${technicalSamples.length}`);
    // Batch insert samples
    const batchSize = 1000;
    for (let i = 0; i < technicalSamples.length; i += batchSize) {
      const batch = technicalSamples.slice(i, i + batchSize);
      
      let values = [];
      let paramIndex = 1;
      let args = [];
      
      for (let j = 0; j < batch.length; j++) {
        const sample = batch[j];
        const id = getUuid();
        const lng = sample.coordinate[0];
        const lat = sample.coordinate[1];
        const t = new Date(sample.timestamp).toISOString();
        const seq = sample.sequenceNo;
        
        values.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, ST_SetSRID(ST_MakePoint($${paramIndex++}::float8, $${paramIndex++}::float8), 4326), $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
        // The checked-in Golden MVP path contains previously derived route
        // samples. Preserve that provenance rather than presenting them as raw
        // observed GPS points.
        args.push(id, trajectoryId, seq, lng, lat, t, 'interpolated', sourceRecordId);
      }
      
      await client.query(`
        INSERT INTO trajectory_samples (id, trajectory_id, sequence_no, position, recorded_at, time_basis, source_record_id)
        VALUES ${values.join(', ')}
      `, args);
    }
    
    // 6. To update trajectory to 'published', app_importer DOES NOT HAVE UPDATE ON publication_status!
    // We must switch to authenticated role to publish the trajectory, since CMS Editor has full rights.
    console.log("Switching to authenticated to publish trajectory...");
    await client.query("RESET ROLE;");
    await client.query("SET ROLE authenticated;");
    await client.query("SET request.jwt.claims TO '{\"app_metadata\":{\"cms_role\":\"editor\"}}';");
    await client.query(`
      UPDATE trajectories SET publication_status = 'published' WHERE id = $1
    `, [trajectoryId]);
    
    console.log(`Narrative dwell summary: ${JSON.stringify({
      totalVisits: sortedPoints.length,
      trustedDurationVisits: dwellReport.trustedDurationVisits,
      fallbackVisits: dwellReport.fallbackVisits,
      byDwellMs: Object.fromEntries(dwellReport.byDwellMs),
      totalNarrativeDwellMs: [...dwellReport.byDwellMs.entries()].reduce((sum, [dwellMs, count]) => sum + dwellMs * count, 0),
      fallbackMs: NARRATIVE_DWELL_FALLBACK_MS
    })}`);
    console.log("Import completed successfully!");
    
  } finally {
    await client.end().catch(() => undefined);
  }
}

await runCapability('qa:import-fixture', main, knownSecrets);
