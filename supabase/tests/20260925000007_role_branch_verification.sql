-- Targeted role-session regression for branches not covered by the original
-- hosted matrix. Run as the migration runner with ON_ERROR_STOP enabled.
-- The transaction rolls back fixtures and the temporary test-only SET grant.

BEGIN;

-- PostgreSQL 17 gives a non-superuser CREATEROLE creator ADMIN but not SET on
-- a newly created role. Add SET only inside this rolled-back test transaction.
GRANT app_importer TO CURRENT_USER WITH SET TRUE, INHERIT FALSE;

INSERT INTO app.trips (id, slug, title, starts_on, ends_on, publication_status)
VALUES
  ('f0000000-0000-4000-8000-000000000001', 'role-branch-a', 'Role Branch A', '2026-09-01', '2026-09-02', 'draft'),
  ('f0000000-0000-4000-8000-000000000002', 'role-branch-b', 'Role Branch B', '2026-09-03', '2026-09-04', 'draft');

INSERT INTO app.trajectories (id, trip_id, publication_status)
VALUES
  ('f0000000-0000-4000-8000-000000000101', 'f0000000-0000-4000-8000-000000000001', 'draft'),
  ('f0000000-0000-4000-8000-000000000102', 'f0000000-0000-4000-8000-000000000002', 'draft');

INSERT INTO app.trajectory_samples (id, trajectory_id, sequence_no, position)
VALUES
  (
    'f0000000-0000-4000-8000-000000000201',
    'f0000000-0000-4000-8000-000000000101',
    1,
    extensions.ST_SetSRID(extensions.ST_MakePoint(139.70, 35.60), 4326)::extensions.geography
  ),
  (
    'f0000000-0000-4000-8000-000000000202',
    'f0000000-0000-4000-8000-000000000101',
    2,
    extensions.ST_SetSRID(extensions.ST_MakePoint(139.71, 35.61), 4326)::extensions.geography
  );

-- Exercise valid redaction INSERT and UPDATE as a real authenticated role
-- session. Both statements execute validate_redaction_range() and its
-- FOR KEY SHARE endpoint reads.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"role":"authenticated","app_metadata":{"cms_role":"editor"}}',
  true
);

INSERT INTO app.trajectory_redactions (
  id, trajectory_id, start_sample_id, end_sample_id, is_active
)
VALUES (
  'f0000000-0000-4000-8000-000000000301',
  'f0000000-0000-4000-8000-000000000101',
  'f0000000-0000-4000-8000-000000000201',
  'f0000000-0000-4000-8000-000000000202',
  true
);

UPDATE app.trajectory_redactions
SET end_sample_id = 'f0000000-0000-4000-8000-000000000201'
WHERE id = 'f0000000-0000-4000-8000-000000000301';

RESET ROLE;

-- Exercise importer INSERT / UPDATE / DELETE for both technical tables.
SET LOCAL ROLE app_importer;

INSERT INTO app.trajectory_source_records (
  id, trajectory_id, source_kind, source_key, raw_payload
)
VALUES (
  'f0000000-0000-4000-8000-000000000401',
  'f0000000-0000-4000-8000-000000000101',
  'gps',
  'role-branch-source',
  '{"stage":"insert"}'::jsonb
);

UPDATE app.trajectory_source_records
SET raw_payload = '{"stage":"update"}'::jsonb
WHERE id = 'f0000000-0000-4000-8000-000000000401';

-- Use the schema-qualified PostGIS constructor as the importer so this branch
-- verifies both extensions schema USAGE and the geography insert path.
INSERT INTO app.trajectory_samples (id, trajectory_id, sequence_no, position)
VALUES (
  'f0000000-0000-4000-8000-000000000203',
  'f0000000-0000-4000-8000-000000000101',
  10,
  extensions.ST_SetSRID(extensions.ST_MakePoint(139.72, 35.62), 4326)::extensions.geography
);

UPDATE app.trajectory_samples
SET recorded_at = '2026-09-01T00:00:00Z'
WHERE id = 'f0000000-0000-4000-8000-000000000203';

-- Moving a non-endpoint sample exercises the old/new parent locks and the
-- guard_technical_write() branch that reads trajectory_redactions.
UPDATE app.trajectory_samples
SET trajectory_id = 'f0000000-0000-4000-8000-000000000102',
    sequence_no = 10
WHERE id = 'f0000000-0000-4000-8000-000000000203';

DELETE FROM app.trajectory_samples
WHERE id = 'f0000000-0000-4000-8000-000000000203';

DELETE FROM app.trajectory_source_records
WHERE id = 'f0000000-0000-4000-8000-000000000401';

RESET ROLE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM app.trajectories
    WHERE id IN (
      'f0000000-0000-4000-8000-000000000101',
      'f0000000-0000-4000-8000-000000000102'
    )
      AND publication_status <> 'draft'
  ) THEN
    RAISE EXCEPTION 'role branch regression changed trajectory publication state';
  END IF;
END;
$$;

SELECT 'role branch verification: PASS' AS result;

ROLLBACK;
