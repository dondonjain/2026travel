import pg from 'pg';
import {
  loadCapabilityEnvironment,
  runCapability
} from './lib/secret-boundary.mjs';

const ENV_NAME = 'QA_DATABASE_READ_URL';
const FIXTURE_SLUG = 'japan-2026';
let knownSecrets = [];

await runCapability('qa:fixture-verify', async () => {
  const config = loadCapabilityEnvironment([ENV_NAME]);
  const connectionString = config[ENV_NAME];
  knownSecrets.push(connectionString);
  const client = new pg.Client({ connectionString });

  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    const countsResult = await client.query(`
      WITH target_trip AS (
        SELECT id FROM app.trips WHERE slug = $1
      ), target_visits AS (
        SELECT v.id, v.narrative_dwell_ms
        FROM app.visits v JOIN target_trip t ON t.id = v.trip_id
      ), target_trajectories AS (
        SELECT tr.id FROM app.trajectories tr JOIN target_trip t ON t.id = tr.trip_id
      ), target_samples AS (
        SELECT s.sequence_no
        FROM app.trajectory_samples s JOIN target_trajectories tr ON tr.id = s.trajectory_id
      )
      SELECT
        (SELECT count(*)::int FROM target_trip) AS trips,
        (SELECT count(*)::int FROM app.places p WHERE EXISTS (
          SELECT 1 FROM app.visits v JOIN target_trip t ON t.id = v.trip_id WHERE v.place_id = p.id
        )) AS places,
        (SELECT count(*)::int FROM target_visits) AS visits,
        (SELECT count(*)::int FROM app.visit_media vm JOIN target_visits v ON v.id = vm.visit_id) AS media,
        (SELECT count(*)::int FROM target_trajectories) AS trajectories,
        (SELECT count(*)::int FROM app.trajectory_source_records sr JOIN target_trajectories tr ON tr.id = sr.trajectory_id) AS source_records,
        (SELECT count(*)::int FROM target_samples) AS samples,
        (SELECT min(sequence_no)::int FROM target_samples) AS sample_sequence_min,
        (SELECT max(sequence_no)::int FROM target_samples) AS sample_sequence_max,
        (SELECT count(DISTINCT sequence_no)::int FROM target_samples) AS sample_sequence_distinct,
        (SELECT count(*) > 0
          AND min(sequence_no) = 0
          AND max(sequence_no) = count(*) - 1
          AND count(DISTINCT sequence_no) = count(*)
          FROM target_samples) AS sample_sequence_contiguous,
        (SELECT count(*)::int FROM app.trajectory_redactions r JOIN target_trajectories tr ON tr.id = r.trajectory_id WHERE r.is_active) AS active_redactions
    `, [FIXTURE_SLUG]);
    const dwellResult = await client.query(`
      SELECT v.narrative_dwell_ms AS dwell_ms, count(*)::int AS visit_count
      FROM app.visits v
      JOIN app.trips t ON t.id = v.trip_id
      WHERE t.slug = $1
      GROUP BY v.narrative_dwell_ms
      ORDER BY v.narrative_dwell_ms
    `, [FIXTURE_SLUG]);
    await client.query('ROLLBACK');

    const counts = countsResult.rows[0];
    if (counts?.trips !== 1) throw new Error(`Fixture count verification failed for ${FIXTURE_SLUG}`);
    const dwellDistribution = dwellResult.rows.map((row) => ({
      dwellMs: row.dwell_ms,
      visitCount: row.visit_count
    }));
    console.log(JSON.stringify({
      status: 'PASS',
      fixture: FIXTURE_SLUG,
      counts,
      dwellDistribution,
      totalNarrativeDwellMs: dwellDistribution.reduce(
        (sum, row) => sum + row.dwellMs * row.visitCount,
        0
      )
    }));
  } finally {
    await client.end().catch(() => undefined);
  }
}, knownSecrets);
