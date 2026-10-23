CREATE OR REPLACE FUNCTION app_private.run_full_matrix_test()
RETURNS TABLE (
  test_code text,
  result_status text,
  details text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trip_id uuid;
  v_trip_slug text := 'fixture-trip-' || substr(md5(random()::text), 1, 6);
  v_place_id uuid;
  v_unverified_place_id uuid;
  v_visit_id uuid;
  v_media_id uuid;
  v_traj_id uuid;
  v_s1 uuid;
  v_s2 uuid;
  v_s3 uuid;
  v_s4 uuid;
  v_s5 uuid;
  v_s6 uuid;
  v_red_active uuid;
BEGIN
  -- 1. Setup base fixtures as postgres
  INSERT INTO app.trips (slug, title, starts_on, ends_on, publication_status)
  VALUES (v_trip_slug, 'Fixture Trip', '2026-09-01', '2026-09-10', 'published')
  RETURNING id INTO v_trip_id;

  INSERT INTO app.places (canonical_name, location, location_status)
  VALUES ('Verified Place', extensions.ST_SetSRID(extensions.ST_MakePoint(139.7, 35.6), 4326)::extensions.geography, 'verified')
  RETURNING id INTO v_place_id;

  INSERT INTO app.places (canonical_name, location, location_status)
  VALUES ('Unverified Place', NULL, 'unverified')
  RETURNING id INTO v_unverified_place_id;

  INSERT INTO app.visits (trip_id, place_id, title, publication_status, occurred_at, display_order)
  VALUES (v_trip_id, v_place_id, 'Published Visit', 'published', now(), 1)
  RETURNING id INTO v_visit_id;

  INSERT INTO app.visit_media (visit_id, media_type, url, publication_status, display_order)
  VALUES (v_visit_id, 'image', 'https://example.com/test.jpg', 'published', 1)
  RETURNING id INTO v_media_id;

  INSERT INTO app.trajectories (trip_id, publication_status)
  VALUES (v_trip_id, 'draft')
  RETURNING id INTO v_traj_id;

  INSERT INTO app.trajectory_samples (trajectory_id, sequence_no, position)
  VALUES
    (v_traj_id, 1, extensions.ST_SetSRID(extensions.ST_MakePoint(139.70, 35.60), 4326)::extensions.geography),
    (v_traj_id, 2, extensions.ST_SetSRID(extensions.ST_MakePoint(139.71, 35.61), 4326)::extensions.geography),
    (v_traj_id, 3, extensions.ST_SetSRID(extensions.ST_MakePoint(139.72, 35.62), 4326)::extensions.geography),
    (v_traj_id, 4, extensions.ST_SetSRID(extensions.ST_MakePoint(139.73, 35.63), 4326)::extensions.geography),
    (v_traj_id, 5, extensions.ST_SetSRID(extensions.ST_MakePoint(139.74, 35.64), 4326)::extensions.geography),
    (v_traj_id, 6, extensions.ST_SetSRID(extensions.ST_MakePoint(139.75, 35.65), 4326)::extensions.geography);

  SELECT id INTO v_s1 FROM app.trajectory_samples WHERE trajectory_id = v_traj_id AND sequence_no = 1;
  SELECT id INTO v_s2 FROM app.trajectory_samples WHERE trajectory_id = v_traj_id AND sequence_no = 2;
  SELECT id INTO v_s3 FROM app.trajectory_samples WHERE trajectory_id = v_traj_id AND sequence_no = 3;
  SELECT id INTO v_s4 FROM app.trajectory_samples WHERE trajectory_id = v_traj_id AND sequence_no = 4;
  SELECT id INTO v_s5 FROM app.trajectory_samples WHERE trajectory_id = v_traj_id AND sequence_no = 5;
  SELECT id INTO v_s6 FROM app.trajectory_samples WHERE trajectory_id = v_traj_id AND sequence_no = 6;

  INSERT INTO app.trajectory_redactions (trajectory_id, start_sample_id, end_sample_id, is_active)
  VALUES (v_traj_id, v_s3, v_s4, true)
  RETURNING id INTO v_red_active;

  UPDATE app.trajectories SET publication_status = 'published' WHERE id = v_traj_id;

  -- A01
  BEGIN
    SET LOCAL ROLE anon;
    PERFORM count(*) FROM app.trips;
    test_code := 'A01'; result_status := 'FAIL'; details := 'anon could select app.trips'; RETURN NEXT;
  EXCEPTION WHEN insufficient_privilege THEN
    test_code := 'A01'; result_status := 'PASS'; details := 'anon denied app.trips (insufficient_privilege)'; RETURN NEXT;
  END;

  -- A02
  BEGIN
    SET LOCAL ROLE anon;
    PERFORM count(*) FROM app.trajectory_samples;
    test_code := 'A02'; result_status := 'FAIL'; details := 'anon could select app.trajectory_samples'; RETURN NEXT;
  EXCEPTION WHEN insufficient_privilege THEN
    test_code := 'A02'; result_status := 'PASS'; details := 'anon denied app.trajectory_samples (insufficient_privilege)'; RETURN NEXT;
  END;

  -- A03
  BEGIN
    SET LOCAL ROLE anon;
    PERFORM count(*) FROM app.trajectory_source_records;
    test_code := 'A03'; result_status := 'FAIL'; details := 'anon could select app.trajectory_source_records'; RETURN NEXT;
  EXCEPTION WHEN insufficient_privilege THEN
    test_code := 'A03'; result_status := 'PASS'; details := 'anon denied app.trajectory_source_records (insufficient_privilege)'; RETURN NEXT;
  END;

  -- A04 (Public view access by anon)
  BEGIN
    SET LOCAL ROLE anon;
    PERFORM count(*) FROM api_public.public_trips;
    test_code := 'A04'; result_status := 'PASS'; details := 'anon can query api_public.public_trips'; RETURN NEXT;
  EXCEPTION WHEN insufficient_privilege THEN
    test_code := 'A04'; result_status := 'FAIL'; details := 'anon denied api_public.public_trips (grant was lost during owner transfer)'; RETURN NEXT;
  END;

  -- C01
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"cms_role":"editor"}}', true);
    PERFORM count(*) FROM app.trajectory_samples WHERE trajectory_id = v_traj_id;
    test_code := 'C01'; result_status := 'PASS'; details := 'CMS editor can read trajectory_samples'; RETURN NEXT;
  EXCEPTION WHEN OTHERS THEN
    test_code := 'C01'; result_status := 'FAIL'; details := SQLERRM; RETURN NEXT;
  END;

  -- C02
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"cms_role":"editor"}}', true);
    UPDATE app.trajectory_samples SET sequence_no = 999 WHERE trajectory_id = v_traj_id;
    test_code := 'C02'; result_status := 'FAIL'; details := 'CMS editor allowed UPDATE trajectory_samples'; RETURN NEXT;
  EXCEPTION WHEN insufficient_privilege THEN
    test_code := 'C02'; result_status := 'PASS'; details := 'CMS editor denied UPDATE trajectory_samples (insufficient_privilege)'; RETURN NEXT;
  END;

  -- C03
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"cms_role":"editor"}}', true);
    UPDATE app.visits SET title = 'Editor Title' WHERE id = v_visit_id;
    UPDATE app.trajectory_redactions SET is_active = false WHERE id = v_red_active;
    UPDATE app.trajectory_redactions SET is_active = true WHERE id = v_red_active;
    test_code := 'C03'; result_status := 'PASS'; details := 'CMS editor can update curated visits and redactions'; RETURN NEXT;
  EXCEPTION WHEN OTHERS THEN
    test_code := 'C03'; result_status := 'FAIL'; details := SQLERRM; RETURN NEXT;
  END;

  -- C04
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"cms_role":"editor"}}', true);
    UPDATE app.trajectories SET publication_status = 'draft' WHERE id = v_traj_id;
    UPDATE app.trajectories SET publication_status = 'published' WHERE id = v_traj_id;
    test_code := 'C04'; result_status := 'PASS'; details := 'CMS editor can update publication_status'; RETURN NEXT;
  EXCEPTION WHEN OTHERS THEN
    test_code := 'C04'; result_status := 'FAIL'; details := SQLERRM; RETURN NEXT;
  END;

  -- I01
  RESET ROLE;
  UPDATE app.trajectories SET publication_status = 'draft' WHERE id = v_traj_id;
  BEGIN
    SET LOCAL ROLE app_importer;
    INSERT INTO app.trajectory_samples (trajectory_id, sequence_no, position)
    VALUES (v_traj_id, 10, extensions.ST_SetSRID(extensions.ST_MakePoint(139.79, 35.69), 4326)::extensions.geography);
    test_code := 'I01'; result_status := 'PASS'; details := 'Importer can insert sample to draft parent'; RETURN NEXT;
  EXCEPTION WHEN OTHERS THEN
    test_code := 'I01'; result_status := 'FAIL'; details := SQLERRM; RETURN NEXT;
  END;

  -- I02
  RESET ROLE;
  UPDATE app.trajectories SET publication_status = 'published' WHERE id = v_traj_id;
  BEGIN
    SET LOCAL ROLE app_importer;
    INSERT INTO app.trajectory_samples (trajectory_id, sequence_no, position)
    VALUES (v_traj_id, 11, extensions.ST_SetSRID(extensions.ST_MakePoint(139.80, 35.70), 4326)::extensions.geography);
    test_code := 'I02'; result_status := 'FAIL'; details := 'Importer was allowed to insert sample to published parent'; RETURN NEXT;
  EXCEPTION WHEN OTHERS THEN
    test_code := 'I02'; result_status := 'PASS'; details := 'Importer denied write to published parent: ' || SQLERRM; RETURN NEXT;
  END;

  -- I03
  BEGIN
    SET LOCAL ROLE app_importer;
    UPDATE app.trajectories SET publication_status = 'draft' WHERE id = v_traj_id;
    test_code := 'I03'; result_status := 'FAIL'; details := 'Importer allowed UPDATE publication_status'; RETURN NEXT;
  EXCEPTION WHEN insufficient_privilege THEN
    test_code := 'I03'; result_status := 'PASS'; details := 'Importer denied UPDATE on publication_status (column privilege check)'; RETURN NEXT;
  END;

  -- I04
  BEGIN
    SET LOCAL ROLE app_importer;
    INSERT INTO app.trajectory_redactions (trajectory_id, start_sample_id, end_sample_id)
    VALUES (v_traj_id, v_s1, v_s2);
    test_code := 'I04'; result_status := 'FAIL'; details := 'Importer allowed INSERT into trajectory_redactions'; RETURN NEXT;
  EXCEPTION WHEN insufficient_privilege THEN
    test_code := 'I04'; result_status := 'PASS'; details := 'Importer denied INSERT into trajectory_redactions (table privilege check)'; RETURN NEXT;
  END;

  -- Cleanup
  RESET ROLE;
  DELETE FROM app.visit_media WHERE id = v_media_id;
  DELETE FROM app.visits WHERE id = v_visit_id;
  DELETE FROM app.trajectory_redactions WHERE trajectory_id = v_traj_id;
  UPDATE app.trajectories SET publication_status = 'draft' WHERE id = v_traj_id;
  DELETE FROM app.trajectory_samples WHERE trajectory_id = v_traj_id;
  DELETE FROM app.trajectories WHERE id = v_traj_id;
  DELETE FROM app.places WHERE id IN (v_place_id, v_unverified_place_id);
  DELETE FROM app.trips WHERE id = v_trip_id;
END;
$$;
