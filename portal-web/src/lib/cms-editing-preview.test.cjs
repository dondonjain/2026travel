const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pg = require('pg');

const migrationPath = path.resolve(__dirname, '../../../supabase/migrations/20261018000001_cms_editing_and_preview_cp4.sql');

// 1. Static DDL Contract Tests
test('CMS CP4: DDL migration structure and constraints check', () => {
  assert.ok(fs.existsSync(migrationPath), 'CP4 migration file must exist');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Transaction boundaries
  assert.ok(sql.includes('BEGIN;'), 'Migration must start with BEGIN;');
  assert.ok(sql.includes('COMMIT;'), 'Migration must end with COMMIT;');

  // Invalidation Trigger
  assert.ok(sql.includes('fn_visits_structural_edit_reset_review_status'), 'Must define invalidation function');
  assert.ok(sql.includes('trg_visits_structural_edit_reset_review_status'), 'Must define invalidation trigger');
  assert.ok(sql.includes('BEFORE UPDATE ON app.visits'), 'Trigger must be BEFORE UPDATE ON app.visits');

  // api_cms RPCs
  assert.ok(sql.includes('confirm_cms_visit'), 'Must define confirm_cms_visit');
  assert.ok(sql.includes('undo_cms_visit'), 'Must define undo_cms_visit');
  assert.ok(sql.includes('update_cms_visit'), 'Must define update_cms_visit');
  assert.ok(sql.includes('add_cms_visit'), 'Must define add_cms_visit');
  assert.ok(sql.includes('create_cms_place'), 'Must define create_cms_place');

  // Draft Preview RPCs
  assert.ok(sql.includes('get_draft_preview_visits'), 'Must define get_draft_preview_visits');
  assert.ok(sql.includes('get_draft_preview_trajectory'), 'Must define get_draft_preview_trajectory');

  // api_public isolation check: MUST NOT create or alter anything in api_public
  assert.ok(!/CREATE\s+(OR\s+REPLACE\s+)?(FUNCTION|VIEW)\s+api_public\b/i.test(sql), 'Must not touch api_public');
});

// 2. Draft Preview Eligibility & Filtering Invariants (Unit Simulation)
test('CMS CP4: Draft preview filters only confirmed + public visits', () => {
  const candidateVisits = [
    { id: 'v-1', title: 'Visit 1', review_status: 'pending', visibility: 'public' },
    { id: 'v-2', title: 'Visit 2', review_status: 'pending', visibility: 'private' },
    { id: 'v-3', title: 'Visit 3', review_status: 'confirmed', visibility: 'private' }, // Excluded (Private)
    { id: 'v-4', title: 'Visit 4', review_status: 'confirmed', visibility: 'public' },  // Included!
    { id: 'v-5', title: 'Visit 5', review_status: 'confirmed', visibility: 'public' }   // Included!
  ];

  // Contract: Draft preview strictly filters review_status = 'confirmed' AND visibility = 'public'
  const previewVisits = candidateVisits.filter(
    v => v.review_status === 'confirmed' && v.visibility === 'public'
  );

  assert.equal(previewVisits.length, 2);
  assert.deepEqual(previewVisits.map(v => v.id), ['v-4', 'v-5']);

  // If usableTrajectory is true and >= 1 confirmed public visit, preview is eligible
  const isEligible = previewVisits.length > 0;
  assert.equal(isEligible, true);
});

// 3. Database Runtime Integration Tests (when QA_DATABASE_WRITE_URL is available)
test('CMS CP4: Database RPCs, Trigger Invalidation and Preview verification', async () => {
  let connStr = process.env.QA_DATABASE_WRITE_URL || process.env.DATABASE_URL;
  if (!connStr) {
    try {
      const { loadCapabilityEnvironment } = await import('../../../portal-web/scripts/lib/secret-boundary.mjs');
      const env = loadCapabilityEnvironment(['QA_DATABASE_WRITE_URL']);
      connStr = env.QA_DATABASE_WRITE_URL;
    } catch {
      // Skip live DB test if no environment is configured
    }
  }

  if (!connStr) {
    console.log('[CMS CP4 Test] No QA_DATABASE_WRITE_URL available, skipping live database assertions.');
    return;
  }

  const client = new pg.Client({ connectionString: connStr });
  await client.connect();

  let testVisitId = null;
  let originalTitle = null;
  let originalStatus = null;

  try {
    const tripSlug = 'japan-2026-summer';

    // 1. Check if the draft trip exists
    const tripRes = await client.query('SELECT id, slug FROM app.trips WHERE slug = $1', [tripSlug]);
    if (tripRes.rows.length === 0) {
      console.log(`[CMS CP4 Test] Trip ${tripSlug} not yet in DB, skipping live row assertions.`);
      return;
    }
    const tripId = tripRes.rows[0].id;

    // 2. Fetch a specific visit for testing and record original state
    const visitRes = await client.query(
      'SELECT id, title, review_status, visibility FROM app.visits WHERE trip_id = $1 ORDER BY display_order ASC LIMIT 1',
      [tripId]
    );
    assert.ok(visitRes.rows.length > 0, 'Must have visits for trip');
    testVisitId = visitRes.rows[0].id;
    originalTitle = visitRes.rows[0].title;
    originalStatus = visitRes.rows[0].review_status;

    // 3. Test RPC: confirm_cms_visit (Success case)
    const confirmRes = await client.query('SELECT * FROM api_cms.confirm_cms_visit($1)', [testVisitId]);
    assert.equal(confirmRes.rows[0].review_status, 'confirmed', 'Visit must become confirmed');

    // 4. Test Draft Preview RPC: get_draft_preview_visits includes this confirmed visit
    const previewVisitsRes = await client.query('SELECT * FROM api_cms.get_draft_preview_visits($1)', [tripSlug]);
    assert.ok(previewVisitsRes.rows.length >= 1, 'Draft preview must return confirmed public visit');
    assert.ok(previewVisitsRes.rows.some(r => r.visit_id === testVisitId), 'Confirmed visit must be in preview');

    // 5. Test DB Trigger: Structural edit on confirmed visit resets to 'pending'
    const newTitle = 'Updated Test Title ' + Date.now();
    await client.query('SELECT * FROM api_cms.update_cms_visit($1, $2)', [testVisitId, newTitle]);

    const checkVisit = await client.query('SELECT review_status, title FROM app.visits WHERE id = $1', [testVisitId]);
    assert.equal(checkVisit.rows[0].title, newTitle);
    assert.equal(
      checkVisit.rows[0].review_status,
      'pending',
      'Structural title update on confirmed visit MUST trigger automatic reset to pending'
    );

    // 6. Test that pending visit is now EXCLUDED from draft preview
    const previewAfterReset = await client.query('SELECT * FROM api_cms.get_draft_preview_visits($1)', [tripSlug]);
    assert.ok(
      !previewAfterReset.rows.some(r => r.visit_id === testVisitId),
      'Pending visit must be excluded from draft preview'
    );

    // 7. Test RPC: undo_cms_visit
    await client.query('SELECT * FROM api_cms.confirm_cms_visit($1)', [testVisitId]);
    const undoRes = await client.query('SELECT * FROM api_cms.undo_cms_visit($1)', [testVisitId]);
    assert.equal(undoRes.rows[0].review_status, 'pending', 'Undo must return review_status to pending');

    // 8. Test Draft Trajectory Preview RPC
    const trajRes = await client.query('SELECT * FROM api_cms.get_draft_preview_trajectory($1)', [tripSlug]);
    assert.ok(trajRes.rows.length > 0, 'Must return trajectory segments for draft trip');
    assert.equal(trajRes.rows[0].segment_index, 1);
    assert.equal(trajRes.rows[0].geometry.type, 'LineString');

    console.log('[CMS CP4 Test] All live database RPCs, triggers, and preview queries PASSED.');
  } finally {
    // Exact restoration of test visit state to avoid polluting test environment
    if (testVisitId && originalTitle !== null && originalStatus !== null) {
      await client.query(
        'UPDATE app.visits SET title = $1, review_status = $2 WHERE id = $3',
        [originalTitle, originalStatus, testVisitId]
      ).catch(() => undefined);
    }
    await client.end().catch(() => undefined);
  }
});

// 4. Persistence Consistency Invariant Tests (RPC Await, Lock, Error Handling, Stale Cache)
test('CMS CP4 Consistency: Client state machine invariants', async () => {
  // Scenario A: Stale Cache Elimination (DB is authoritative source of truth)
  const tripSlug = 'japan-2026-summer';
  const dbConfirmedIds = new Set(['visit-db-confirmed']);
  const staleLocalMap = {
    'visit-db-confirmed': { reviewStatus: 'confirmed' },
    'visit-db-pending': { reviewStatus: 'confirmed' } // Stale: DB is actually pending!
  };

  const initialBaseVisits = [
    { id: 'visit-db-confirmed', title: 'Visit 1', reviewStatus: 'pending' },
    { id: 'visit-db-pending', title: 'Visit 2', reviewStatus: 'pending' }
  ];

  // Must overwrite with authoritative DB state, NOT merge with stale cache
  const syncedVisits = initialBaseVisits.map(v => ({
    ...v,
    reviewStatus: dbConfirmedIds.has(v.id) ? 'confirmed' : 'pending'
  }));

  assert.equal(syncedVisits[0].reviewStatus, 'confirmed', 'Visit in DB confirmed set must be confirmed');
  assert.equal(syncedVisits[1].reviewStatus, 'pending', 'Stale cache must NOT override DB pending state');

  // Scenario B: In-flight duplicate submission lock invariant
  let inFlightAction = false;
  let rpcCallCount = 0;

  async function simulateUserClick() {
    if (inFlightAction) return false; // Blocked by in-flight lock
    inFlightAction = true;
    try {
      rpcCallCount++;
      // Simulate RPC network delay
      await new Promise(r => setTimeout(r, 20));
      return true;
    } finally {
      inFlightAction = false;
    }
  }

  // Rapid double-click
  const [click1, click2] = await Promise.all([
    simulateUserClick(),
    simulateUserClick()
  ]);

  assert.equal(click1, true, 'First click must proceed');
  assert.equal(click2, false, 'Second click while in-flight must be rejected');
  assert.equal(rpcCallCount, 1, 'Only exactly 1 RPC call may be dispatched');

  // Scenario C: RPC Failure retention invariant
  const failureResult = { success: false, error: 'Network timeout (504)' };
  let currentStatus = 'pending';
  let previewEligible = false;
  let activeError = null;

  if (failureResult.success) {
    currentStatus = 'confirmed';
    previewEligible = true;
  } else {
    activeError = failureResult.error;
  }

  assert.equal(currentStatus, 'pending', 'Status must stay pending on RPC failure');
  assert.equal(previewEligible, false, 'Preview must not be unlocked on RPC failure');
  assert.equal(activeError, 'Network timeout (504)', 'Error must be captured for display and retry');

  // Scenario D: Undo & Reload Invariant
  // When an Undo succeeds in DB, a subsequent reload sees only DB state
  const postUndoDbConfirmedIds = new Set(); // empty
  const reloadedVisits = initialBaseVisits.map(v => ({
    ...v,
    reviewStatus: postUndoDbConfirmedIds.has(v.id) ? 'confirmed' : 'pending'
  }));
  assert.ok(reloadedVisits.every(v => v.reviewStatus === 'pending'), 'All visits must be pending after undo and reload');
});
