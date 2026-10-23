import { ReconstructedTripResult } from './reconstruction';
import { automaticPlaceId, persistedResolutionStatus } from './place-resolver';

export interface DatabaseQueryable {
  query: (sql: string, params?: any[]) => Promise<any>;
}

export interface PersistIngestionOptions {
  client: DatabaseQueryable;
  reconstructionResult: ReconstructedTripResult;
  overwriteDraft?: boolean;
}

export interface PersistIngestionResult {
  tripId: string;
  tripSlug: string;
  placesPersisted: number;
  visitsPersisted: number;
  trajectoryId: string;
  sourceRecordsPersisted: number;
  samplesPersisted: number;
}

/**
 * Generates deterministic parameterized SQL statements for ingestion
 * useful for dry-run verification and offline testing.
 */
export function generateIngestionSqlStatements(result: ReconstructedTripResult) {
  const statements: Array<{ sql: string; params: any[] }> = [];

  // 1. Upsert Trip
  statements.push({
    sql: `
      INSERT INTO app.trips (id, slug, title, starts_on, ends_on, default_time_zone, publication_status)
      VALUES ($1, $2, $3, $4, $5, $6, 'draft')
      ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        starts_on = EXCLUDED.starts_on,
        ends_on = EXCLUDED.ends_on,
        updated_at = now()
      RETURNING id;
    `.trim(),
    params: [
      result.trip.id,
      result.trip.slug,
      result.trip.title,
      result.trip.startsOn,
      result.trip.endsOn,
      result.trip.defaultTimeZone
    ]
  });

  // 2. Places
  for (const place of result.places.filter(p => result.visits.some(v => p.candidateVisitIds.includes(v.id) && automaticPlaceId(v, p.id)))) {
    statements.push({
      sql: `
        INSERT INTO app.places (id, canonical_name, location, location_status)
        VALUES ($1, $2, extensions.ST_SetSRID(extensions.ST_MakePoint($3, $4), 4326)::extensions.geography, 'verified')
        ON CONFLICT (id) DO UPDATE SET
          canonical_name = EXCLUDED.canonical_name,
          updated_at = now()
        RETURNING id;
      `.trim(),
      params: [place.id, place.canonicalName, place.location[0], place.location[1]]
    });
  }

  // 3. Visits
  result.visits.forEach((v, idx) => {
    // Find matching place id
    const place = result.places.find(p => p.candidateVisitIds.includes(v.id));
    if (!place && !v.resolution) throw new Error('Candidate Visit has no explicit Place association.');
    statements.push({
      sql: `
        INSERT INTO app.visits (
          id, trip_id, place_id, title, description,
          occurred_at, time_zone, time_source,
          presentation_category, tags, is_highlight,
          publication_status, review_status, visibility,
          display_order, narrative_dwell_ms, resolution_status
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, 'trajectory_derived',
          $8, $9, false,
          'draft', 'pending', 'public',
          $10, 4000, $11
        );
      `.trim(),
      params: [
        v.id,
        result.trip.id,
        automaticPlaceId(v, place?.id),
        v.title,
        v.placeName,
        v.evidence.rawTimestamp,
        result.trip.defaultTimeZone,
        v.placeCategory,
        [],
        idx + 1,
        persistedResolutionStatus(v.resolution)
      ]
    });
  });

  // 4. Trajectory
  statements.push({
    sql: `
      INSERT INTO app.trajectories (id, trip_id, publication_status, source_started_at, source_ended_at)
      VALUES ($1, $2, 'draft', $3, $4);
    `.trim(),
    params: [
      result.trajectory.id,
      result.trip.id,
      result.trajectory.sourceStartedAt,
      result.trajectory.sourceEndedAt
    ]
  });

  // 5. Source Records
  for (const rec of result.sourceRecords) {
    statements.push({
      sql: `
        INSERT INTO app.trajectory_source_records (id, trajectory_id, source_kind, source_key, started_at, ended_at, raw_payload)
        VALUES ($1, $2, $3, $4, $5, $6, $7);
      `.trim(),
      params: [
        rec.id,
        result.trajectory.id,
        rec.sourceKind,
        rec.sourceKey,
        rec.startedAt || null,
        rec.endedAt || null,
        JSON.stringify(rec.rawPayload)
      ]
    });
  }

  // 6. Samples (batch representation)
  const batchSize = 500;
  for (let i = 0; i < result.samples.length; i += batchSize) {
    const chunk = result.samples.slice(i, i + batchSize);
    statements.push({
      sql: `-- Batch insert ${chunk.length} trajectory samples starting sequence ${chunk[0].sequenceNo}`,
      params: [chunk.length]
    });
  }

  return statements;
}

/**
 * Persists reconstructed trip data into the database within a transaction.
 */
export async function persistReconstructedTrip(options: PersistIngestionOptions): Promise<PersistIngestionResult> {
  const { client, reconstructionResult, overwriteDraft = true } = options;
  const res = reconstructionResult;

  await client.query('BEGIN;');
  try {
    // 1. Handle Trip upsert
    const tripRes = await client.query(`
      INSERT INTO app.trips (id, slug, title, starts_on, ends_on, default_time_zone, publication_status)
      VALUES ($1, $2, $3, $4, $5, $6, 'draft')
      ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        starts_on = EXCLUDED.starts_on,
        ends_on = EXCLUDED.ends_on,
        updated_at = now()
      RETURNING id;
    `, [
      res.trip.id,
      res.trip.slug,
      res.trip.title,
      res.trip.startsOn,
      res.trip.endsOn,
      res.trip.defaultTimeZone
    ]);
    const actualTripId = tripRes.rows?.[0]?.id || res.trip.id;

    // 2. If overwriteDraft is requested, remove existing unconfirmed visits & trajectory
    if (overwriteDraft) {
      const existingTraj = await client.query(`SELECT id FROM app.trajectories WHERE trip_id = $1`, [actualTripId]);
      if (existingTraj.rows && existingTraj.rows.length > 0) {
        for (const tRow of existingTraj.rows) {
          await client.query(`DELETE FROM app.trajectory_samples WHERE trajectory_id = $1`, [tRow.id]);
          await client.query(`DELETE FROM app.trajectory_redactions WHERE trajectory_id = $1`, [tRow.id]);
          await client.query(`DELETE FROM app.trajectory_source_records WHERE trajectory_id = $1`, [tRow.id]);
          await client.query(`DELETE FROM app.trajectories WHERE id = $1`, [tRow.id]);
        }
      }
      await client.query(`DELETE FROM app.visits WHERE trip_id = $1 AND review_status = 'pending'`, [actualTripId]);
    }

    // 3. Upsert Places
    const placeIdMap = new Map<string, string>(); // memory Place ID -> DB Place ID
    for (const place of res.places.filter(p => res.visits.some(v => p.candidateVisitIds.includes(v.id) && automaticPlaceId(v, p.id)))) {
      const placeRes = await client.query(`
        INSERT INTO app.places (id, canonical_name, location, location_status)
        VALUES ($1, $2, extensions.ST_SetSRID(extensions.ST_MakePoint($3, $4), 4326)::extensions.geography, 'verified')
        ON CONFLICT (id) DO UPDATE SET
          canonical_name = EXCLUDED.canonical_name,
          updated_at = now()
        RETURNING id;
      `, [place.id, place.canonicalName, place.location[0], place.location[1]]);
      const dbPlaceId = placeRes.rows?.[0]?.id || place.id;
      placeIdMap.set(place.id, dbPlaceId);
    }

    // 4. Insert Candidate Visits (Pending + Public)
    let visitCount = 0;
    for (let i = 0; i < res.visits.length; i++) {
      const v = res.visits[i];
      const memPlace = res.places.find(p => p.candidateVisitIds.includes(v.id));
      if (!memPlace && !v.resolution) throw new Error('Candidate Visit has no explicit Place association.');
      const dbPlaceId = automaticPlaceId(v, memPlace && (placeIdMap.get(memPlace.id) || memPlace.id));

      await client.query(`
        INSERT INTO app.visits (
          id, trip_id, place_id, title, description,
          occurred_at, time_zone, time_source,
          presentation_category, tags, is_highlight,
          publication_status, review_status, visibility,
          display_order, narrative_dwell_ms, resolution_status
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, 'trajectory_derived',
          $8, $9, false,
          'draft', 'pending', 'public',
          $10, 4000, $11
        )
      `, [
        v.id,
        actualTripId,
        dbPlaceId,
        v.title,
        v.placeName,
        v.evidence.rawTimestamp,
        res.trip.defaultTimeZone,
        v.placeCategory,
        [],
        i + 1,
        persistedResolutionStatus(v.resolution)
      ]);
      visitCount++;
    }

    // 5. Insert Trajectory
    const trajRes = await client.query(`
      INSERT INTO app.trajectories (id, trip_id, publication_status, source_started_at, source_ended_at)
      VALUES ($1, $2, 'draft', $3, $4)
      RETURNING id;
    `, [
      res.trajectory.id,
      actualTripId,
      res.trajectory.sourceStartedAt,
      res.trajectory.sourceEndedAt
    ]);
    const actualTrajId = trajRes.rows?.[0]?.id || res.trajectory.id;

    // 6. Insert Source Records
    const sourceRecordIdMap = new Map<string, string>(); // sourceKey -> DB id
    for (const rec of res.sourceRecords) {
      const sRes = await client.query(`
        INSERT INTO app.trajectory_source_records (id, trajectory_id, source_kind, source_key, started_at, ended_at, raw_payload)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id;
      `, [
        rec.id,
        actualTrajId,
        rec.sourceKind,
        rec.sourceKey,
        rec.startedAt || null,
        rec.endedAt || null,
        JSON.stringify(rec.rawPayload)
      ]);
      sourceRecordIdMap.set(rec.sourceKey, sRes.rows?.[0]?.id || rec.id);
    }

    // 7. Insert Trajectory Samples (batch of 500)
    const batchSize = 500;
    for (let i = 0; i < res.samples.length; i += batchSize) {
      const batch = res.samples.slice(i, i + batchSize);
      const values: string[] = [];
      const args: any[] = [];
      let pIdx = 1;

      for (const s of batch) {
        const sRecId = sourceRecordIdMap.get(s.sourceRecordKey) || null;
        values.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, extensions.ST_SetSRID(extensions.ST_MakePoint($${pIdx++}::float8, $${pIdx++}::float8), 4326)::extensions.geography, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
        args.push(
          s.id,
          actualTrajId,
          s.sequenceNo,
          s.coordinate[0],
          s.coordinate[1],
          s.recordedAt,
          s.timeBasis,
          sRecId
        );
      }

      await client.query(`
        INSERT INTO app.trajectory_samples (id, trajectory_id, sequence_no, position, recorded_at, time_basis, source_record_id)
        VALUES ${values.join(', ')}
      `, args);
    }

    await client.query('COMMIT;');

    return {
      tripId: actualTripId,
      tripSlug: res.trip.slug,
      placesPersisted: placeIdMap.size,
      visitsPersisted: visitCount,
      trajectoryId: actualTrajId,
      sourceRecordsPersisted: res.sourceRecords.length,
      samplesPersisted: res.samples.length
    };
  } catch (error) {
    await client.query('ROLLBACK;').catch(() => undefined);
    throw error;
  }
}
