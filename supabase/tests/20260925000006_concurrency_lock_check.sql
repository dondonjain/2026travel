BEGIN;

-- Setup draft trip & trajectory
INSERT INTO app.trips (slug, title, starts_on, ends_on, publication_status)
VALUES ('lock-test-trip', 'Lock Test', '2026-09-01', '2026-09-05', 'draft');

INSERT INTO app.trajectories (trip_id, publication_status)
VALUES (
  (SELECT id FROM app.trips WHERE slug = 'lock-test-trip'),
  'draft'
);

-- Insert a sample which fires guard_technical_write()
INSERT INTO app.trajectory_samples (trajectory_id, sequence_no, position)
VALUES (
  (SELECT t.id FROM app.trajectories t JOIN app.trips tr ON tr.id = t.trip_id WHERE tr.slug = 'lock-test-trip'),
  1,
  extensions.ST_SetSRID(extensions.ST_MakePoint(139.7, 35.6), 4326)::extensions.geography
);

-- Inspect pg_locks for the current transaction on app.trajectories
SELECT l.locktype, l.mode, l.granted, c.relname
FROM pg_locks l
JOIN pg_class c ON c.oid = l.relation
WHERE c.relname = 'trajectories' AND l.pid = pg_backend_pid();

ROLLBACK;
