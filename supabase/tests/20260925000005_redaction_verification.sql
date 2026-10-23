-- Setup Redaction Test Fixtures and Verify Output
BEGIN;

INSERT INTO app.trips (slug, title, starts_on, ends_on, publication_status)
VALUES ('redaction-test-trip', 'Redaction Test Trip', '2026-09-01', '2026-09-10', 'published');

INSERT INTO app.trajectories (trip_id, publication_status)
VALUES (
  (SELECT id FROM app.trips WHERE slug = 'redaction-test-trip'),
  'draft'
);

-- Insert 10 samples (1 to 10) referencing the trajectory id
INSERT INTO app.trajectory_samples (trajectory_id, sequence_no, position)
SELECT
  (SELECT t.id FROM app.trajectories t JOIN app.trips tr ON tr.id = t.trip_id WHERE tr.slug = 'redaction-test-trip'),
  s,
  extensions.ST_SetSRID(extensions.ST_MakePoint(139.70 + s*0.01, 35.60 + s*0.01), 4326)::extensions.geography
FROM generate_series(1, 10) AS s;

-- Publish trajectory
UPDATE app.trajectories
SET publication_status = 'published'
WHERE trip_id = (SELECT id FROM app.trips WHERE slug = 'redaction-test-trip');

-- Redaction 1: Active redaction on seq 3 to 4
INSERT INTO app.trajectory_redactions (trajectory_id, start_sample_id, end_sample_id, is_active)
VALUES (
  (SELECT t.id FROM app.trajectories t JOIN app.trips tr ON tr.id = t.trip_id WHERE tr.slug = 'redaction-test-trip'),
  (SELECT s.id FROM app.trajectory_samples s JOIN app.trajectories t ON t.id = s.trajectory_id JOIN app.trips tr ON tr.id = t.trip_id WHERE tr.slug = 'redaction-test-trip' AND s.sequence_no = 3),
  (SELECT s.id FROM app.trajectory_samples s JOIN app.trajectories t ON t.id = s.trajectory_id JOIN app.trips tr ON tr.id = t.trip_id WHERE tr.slug = 'redaction-test-trip' AND s.sequence_no = 4),
  true
);

-- Redaction 2: Overlapping/adjacent redaction on seq 4 to 5 (should merge with 3..4 into 3..5)
INSERT INTO app.trajectory_redactions (trajectory_id, start_sample_id, end_sample_id, is_active)
VALUES (
  (SELECT t.id FROM app.trajectories t JOIN app.trips tr ON tr.id = t.trip_id WHERE tr.slug = 'redaction-test-trip'),
  (SELECT s.id FROM app.trajectory_samples s JOIN app.trajectories t ON t.id = s.trajectory_id JOIN app.trips tr ON tr.id = t.trip_id WHERE tr.slug = 'redaction-test-trip' AND s.sequence_no = 4),
  (SELECT s.id FROM app.trajectory_samples s JOIN app.trajectories t ON t.id = s.trajectory_id JOIN app.trips tr ON tr.id = t.trip_id WHERE tr.slug = 'redaction-test-trip' AND s.sequence_no = 5),
  true
);

-- Redaction 3: Inactive redaction on seq 8 to 9 (is_active = false, should NOT hide)
INSERT INTO app.trajectory_redactions (trajectory_id, start_sample_id, end_sample_id, is_active)
VALUES (
  (SELECT t.id FROM app.trajectories t JOIN app.trips tr ON tr.id = t.trip_id WHERE tr.slug = 'redaction-test-trip'),
  (SELECT s.id FROM app.trajectory_samples s JOIN app.trajectories t ON t.id = s.trajectory_id JOIN app.trips tr ON tr.id = t.trip_id WHERE tr.slug = 'redaction-test-trip' AND s.sequence_no = 8),
  (SELECT s.id FROM app.trajectory_samples s JOIN app.trajectories t ON t.id = s.trajectory_id JOIN app.trips tr ON tr.id = t.trip_id WHERE tr.slug = 'redaction-test-trip' AND s.sequence_no = 9),
  false
);

-- Query the public trajectory RPC
SELECT segment_index, geometry, has_hidden_gap_after
FROM api_public.get_public_trajectory('redaction-test-trip');

ROLLBACK;
