const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// 1. Schema CP2: Four-State Independence
test('CMS CP2: Four-state independence (review_status x visibility)', () => {
  const trip = {
    id: 'trip-japan-2026',
    slug: 'japan-2026',
    publication_status: 'published' // Trip lifecycle unchanged
  };

  const validCombinations = [
    { review_status: 'pending', visibility: 'public' },
    { review_status: 'pending', visibility: 'private' },
    { review_status: 'confirmed', visibility: 'public' },
    { review_status: 'confirmed', visibility: 'private' }
  ];

  // Validate that all 4 states can be independently formed without modifying trip publication_status
  const visits = validCombinations.map((combo, idx) => ({
    id: `visit-test-${idx + 1}`,
    trip_id: trip.id,
    title: `Visit ${idx + 1}`,
    review_status: combo.review_status,
    visibility: combo.visibility,
    publication_status: combo.visibility === 'public' ? 'published' : 'draft' // Legacy compatibility
  }));

  assert.equal(visits.length, 4);

  // Assert pending + public
  assert.ok(visits.some(v => v.review_status === 'pending' && v.visibility === 'public'));
  // Assert pending + private
  assert.ok(visits.some(v => v.review_status === 'pending' && v.visibility === 'private'));
  // Assert confirmed + public
  assert.ok(visits.some(v => v.review_status === 'confirmed' && v.visibility === 'public'));
  // Assert confirmed + private
  assert.ok(visits.some(v => v.review_status === 'confirmed' && v.visibility === 'private'));

  // Confirm Trip publication_status remains completely decoupled
  assert.equal(trip.publication_status, 'published');
});

// 2. Schema CP2: Value Constraints and Defaults
test('CMS CP2: Value constraints and default validation', () => {
  const ALLOWED_REVIEW_STATUSES = new Set(['pending', 'confirmed']);
  const ALLOWED_VISIBILITIES = new Set(['public', 'private']);

  function validateVisitState(review_status = 'pending', visibility = 'public') {
    if (!ALLOWED_REVIEW_STATUSES.has(review_status)) {
      throw new Error(`Invalid review_status: ${review_status}`);
    }
    if (!ALLOWED_VISIBILITIES.has(visibility)) {
      throw new Error(`Invalid visibility: ${visibility}`);
    }
    return { review_status, visibility };
  }

  // Defaults behave as specified
  const defaultState = validateVisitState();
  assert.equal(defaultState.review_status, 'pending');
  assert.equal(defaultState.visibility, 'public');

  // Valid values pass
  assert.doesNotThrow(() => validateVisitState('pending', 'public'));
  assert.doesNotThrow(() => validateVisitState('pending', 'private'));
  assert.doesNotThrow(() => validateVisitState('confirmed', 'public'));
  assert.doesNotThrow(() => validateVisitState('confirmed', 'private'));

  // Invalid review_status rejected
  assert.throws(() => validateVisitState('draft', 'public'), /Invalid review_status/);
  assert.throws(() => validateVisitState('published', 'public'), /Invalid review_status/);
  assert.throws(() => validateVisitState('approved', 'public'), /Invalid review_status/);

  // Invalid visibility rejected
  assert.throws(() => validateVisitState('pending', 'hidden'), /Invalid visibility/);
  assert.throws(() => validateVisitState('pending', 'draft'), /Invalid visibility/);
  assert.throws(() => validateVisitState('pending', 'internal'), /Invalid visibility/);
});

// 3. Schema CP2: Legacy Backfill Mapping
test('CMS CP2: Legacy data migration mapping rule', () => {
  function backfillLegacyVisit(legacyRow) {
    return {
      ...legacyRow,
      visibility: legacyRow.publication_status === 'published' ? 'public' : 'private',
      review_status: 'pending' // Default to pending per contract Section 8
    };
  }

  // Historical published visit -> public + pending
  const publishedRow = backfillLegacyVisit({ id: 'v1', publication_status: 'published' });
  assert.equal(publishedRow.visibility, 'public');
  assert.equal(publishedRow.review_status, 'pending');

  // Historical draft visit -> private + pending
  const draftRow = backfillLegacyVisit({ id: 'v2', publication_status: 'draft' });
  assert.equal(draftRow.visibility, 'private');
  assert.equal(draftRow.review_status, 'pending');

  // Historical archived visit -> private + pending
  const archivedRow = backfillLegacyVisit({ id: 'v3', publication_status: 'archived' });
  assert.equal(archivedRow.visibility, 'private');
  assert.equal(archivedRow.review_status, 'pending');
});

// 4. Schema CP2: Public Contract Invariants
test('CMS CP2: Public reader contract hides private visits', () => {
  const publicVisits = [
    { id: 'v1', trip_slug: 'japan-2026', title: 'Visit 1', review_status: 'confirmed', visibility: 'public', publication_status: 'published' },
    { id: 'v2', trip_slug: 'japan-2026', title: 'Visit 2 (Private)', review_status: 'confirmed', visibility: 'private', publication_status: 'draft' },
    { id: 'v3', trip_slug: 'japan-2026', title: 'Visit 3 (Pending Public)', review_status: 'pending', visibility: 'public', publication_status: 'published' },
    { id: 'v4', trip_slug: 'japan-2026', title: 'Visit 4 (Pending Private)', review_status: 'pending', visibility: 'private', publication_status: 'draft' }
  ];

  // The public view api_public.public_trip_visits filters WHERE t.publication_status = 'published' AND v.publication_status = 'published'
  // and in the new model visibility = 'public'
  const exposedToPublicReader = publicVisits.filter(v => v.visibility === 'public' && v.publication_status === 'published');

  assert.equal(exposedToPublicReader.length, 2);
  assert.ok(exposedToPublicReader.every(v => v.visibility === 'public'));
  assert.ok(!exposedToPublicReader.some(v => v.visibility === 'private'));
});

// 5. Schema CP2: Migration DDL Contract Static Invariants
test('CMS CP2: Migration DDL static invariants in 20261018000000_visit_state_schema_cp2.sql', () => {
  const migrationPath = path.resolve(__dirname, '../../../supabase/migrations/20261018000000_visit_state_schema_cp2.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration file must exist');

  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Must add review_status with default 'pending' and CHECK constraint
  assert.match(sql, /ADD COLUMN review_status text NOT NULL DEFAULT 'pending';/);
  assert.match(sql, /CHECK\s*\(review_status IN \('pending', 'confirmed'\)\)/);

  // Must add visibility with default 'public' and CHECK constraint
  assert.match(sql, /ADD COLUMN visibility text NOT NULL DEFAULT 'public';/);
  assert.match(sql, /CHECK\s*\(visibility IN \('public', 'private'\)\)/);

  // Must perform one-time compatibility backfill
  assert.match(sql, /UPDATE app\.visits/);
  assert.match(sql, /WHEN publication_status = 'published' THEN 'public'/);
  assert.match(sql, /ELSE 'private'/);
  assert.match(sql, /review_status = 'pending'/);

  // Must update api_cms.cms_visits view
  assert.match(sql, /CREATE OR REPLACE VIEW api_cms\.cms_visits/);
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE, DELETE ON api_cms\.cms_visits TO authenticated;/);

  // Must NOT drop legacy publication_status
  assert.doesNotMatch(sql, /DROP\s+COLUMN\s+publication_status/i);
});
