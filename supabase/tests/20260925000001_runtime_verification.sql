DO $$
DECLARE
  v_trip_id uuid;
  v_place_id uuid;
  v_visit_id uuid;
  v_traj_id uuid;
  v_s1 uuid;
  v_s2 uuid;
  v_s3 uuid;
  v_redaction_id uuid;
BEGIN
  -- 1. Test Setup as admin/postgres
  INSERT INTO app.trips (slug, title, starts_on, ends_on, publication_status)
  VALUES ('test-trip', 'Test Trip', '2026-09-01', '2026-09-05', 'draft')
  RETURNING id INTO v_trip_id;

  INSERT INTO app.places (canonical_name, location, location_status)
  VALUES ('Test Place', extensions.ST_SetSRID(extensions.ST_MakePoint(139.7, 35.6), 4326)::extensions.geography, 'verified')
  RETURNING id INTO v_place_id;

  INSERT INTO app.visits (trip_id, place_id, title, publication_status)
  VALUES (v_trip_id, v_place_id, 'Test Visit', 'draft')
  RETURNING id INTO v_visit_id;

  INSERT INTO app.trajectories (trip_id, publication_status)
  VALUES (v_trip_id, 'draft')
  RETURNING id INTO v_traj_id;

  INSERT INTO app.trajectory_samples (trajectory_id, sequence_no, position)
  VALUES
    (v_traj_id, 1, extensions.ST_SetSRID(extensions.ST_MakePoint(139.71, 35.61), 4326)::extensions.geography),
    (v_traj_id, 2, extensions.ST_SetSRID(extensions.ST_MakePoint(139.72, 35.62), 4326)::extensions.geography),
    (v_traj_id, 3, extensions.ST_SetSRID(extensions.ST_MakePoint(139.73, 35.63), 4326)::extensions.geography);

  SELECT id INTO v_s1 FROM app.trajectory_samples WHERE trajectory_id = v_traj_id AND sequence_no = 1;
  SELECT id INTO v_s2 FROM app.trajectory_samples WHERE trajectory_id = v_traj_id AND sequence_no = 2;
  SELECT id INTO v_s3 FROM app.trajectory_samples WHERE trajectory_id = v_traj_id AND sequence_no = 3;

  -- 2. Test validate_redaction_range trigger: start > end must fail
  BEGIN
    INSERT INTO app.trajectory_redactions (trajectory_id, start_sample_id, end_sample_id)
    VALUES (v_traj_id, v_s3, v_s1);
    RAISE EXCEPTION 'TRIGGER TEST FAILED: allowed start_sequence > end_sequence';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%start sample must not follow end sample%' THEN
      RAISE NOTICE 'CHECK 1 PASSED: redaction start > end rejected';
    ELSE
      RAISE;
    END IF;
  END;

  -- 3. Test validate_redaction_range trigger: valid range succeeds
  INSERT INTO app.trajectory_redactions (trajectory_id, start_sample_id, end_sample_id, is_active)
  VALUES (v_traj_id, v_s1, v_s2, true)
  RETURNING id INTO v_redaction_id;
  RAISE NOTICE 'CHECK 2 PASSED: valid redaction accepted';

  -- 4. Test guard_technical_write trigger when published
  UPDATE app.trajectories SET publication_status = 'published' WHERE id = v_traj_id;

  BEGIN
    INSERT INTO app.trajectory_samples (trajectory_id, sequence_no, position)
    VALUES (v_traj_id, 4, extensions.ST_SetSRID(extensions.ST_MakePoint(139.74, 35.64), 4326)::extensions.geography);
    RAISE EXCEPTION 'TRIGGER TEST FAILED: allowed insert into published trajectory';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%technical trajectory writes require a draft parent trajectory%' THEN
      RAISE NOTICE 'CHECK 3 PASSED: technical sample insert into published trajectory rejected by guard trigger';
    ELSE
      RAISE;
    END IF;
  END;

  -- Rollback all test data
  RAISE EXCEPTION 'TEST_CLEANUP_ROLLBACK';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM = 'TEST_CLEANUP_ROLLBACK' THEN
    RAISE NOTICE 'All trigger assertions passed cleanly, test transaction rolled back.';
  ELSE
    RAISE;
  END IF;
END;
$$;
