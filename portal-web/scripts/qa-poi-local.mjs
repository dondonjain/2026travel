// Disposable, in-memory PostgreSQL/PostGIS verification. No environment loading,
// network connection, credentials, hosted migration, or application dependency.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtime = path.join(root, 'scratch/poi-pg-runtime/node_modules');
const load = name => import(pathToFileURL(path.join(runtime, name)).href);
let db;
let phase = 'load-local-runtime';
try {
  const { PGlite } = await load('@electric-sql/pglite/dist/index.js');
  const { pgcrypto } = await load('@electric-sql/pglite/dist/contrib/pgcrypto.js');
  const { postgis } = await load('@electric-sql/pglite-postgis/dist/index.js');
  db = new PGlite({ extensions: { pgcrypto, postgis } });
  phase = 'bootstrap-local-auth';
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS
    $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;`);
  for (const file of [
    '20260925000000_schema_v1.sql', '20260927000000_visit_narrative_dwell.sql',
    '20261018000000_visit_state_schema_cp2.sql', '20261018000001_cms_editing_and_preview_cp4.sql',
    '20261023000000_poi_resolution.sql'
  ]) {
    phase = file;
    await db.exec(await fs.readFile(path.join(root, 'supabase/migrations', file), 'utf8'));
  }
  phase = 'poi-resolution-runtime-assertions';
  await db.exec(await fs.readFile(path.join(root, 'supabase/tests/20261023000000_poi_resolution.sql'), 'utf8'));
  phase = 'actual-ingestion-round-trip';
  const require = createRequire(import.meta.url);
  require('../src/lib/test-register.cjs');
  const { reconstructTimelineTrip } = require('../src/lib/cms/reconstruction.ts');
  const { persistReconstructedTrip } = require('../src/lib/cms/persist-ingestion.ts');
  const timelineData = JSON.parse(await fs.readFile(path.join(root, 'portal-web/src/data/raw/Timeline.json'), 'utf8'));
  const reconstructed = reconstructTimelineTrip({ timelineData, startDate: '2026-08-14', endDate: '2026-08-20', tripSlug: 'poi-local-import' });
  await persistReconstructedTrip({ client: db, reconstructionResult: reconstructed, overwriteDraft: false });
  const { rows } = await db.query(`SELECT count(*)::int AS total,
    count(*) FILTER (WHERE resolution_status LIKE 'SPATIAL_CONFLICT%' AND place_id IS NULL)::int AS conflicts,
    count(*) FILTER (WHERE resolution_status LIKE 'SPATIAL_CONFLICT%' AND place_id IS NOT NULL)::int AS bad_links
    FROM app.visits`);
  if (rows[0].total !== 29 || rows[0].conflicts !== 5 || rows[0].bad_links !== 0) throw new Error('Unexpected imported resolution state');
  console.log(JSON.stringify({ status: 'PASS', engine: 'PGlite/PostGIS in memory', migrations: 5,
    imported: rows[0], checks: ['null-place-read', 'conflict-link-denial', 'unresolved-confirm-denial', 'state-clear-denial', 'non-editor-denial', 'human-review', 'confirmed-after-review', 'anon-ACL', 'editor-RLS-create', 'non-editor-RLS-denial'] }));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', phase, code: error.code || 'LOCAL_RUNTIME_ERROR', message: String(error.message).slice(0, 250) }));
  process.exitCode = 1;
} finally { if (db) await db.close(); }
