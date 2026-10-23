CREATE OR REPLACE FUNCTION app_private.run_security_tests()
RETURNS TABLE (
  test_id text,
  actor text,
  attempted_action text,
  expected text,
  actual text,
  test_result text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trip_id uuid;
  v_trip_slug text := 'test-sec-trip-' || substr(md5(random()::text), 1, 8);
  v_place_id uuid;
  v_visit_id uuid;
  v_traj_id uuid;
  v_s1 uuid;
  v_s2 uuid;
  v_s3 uuid;
  v_redaction_id uuid;
  v_count integer;
  v_err text;
BEGIN
  -- Setup Fixtures as creator
  INSERT INTO app.trips (slug, title, starts_on, ends_on, publication_status)
  VALUES (v_trip_slug, 'Security Trip', '2026-09-01', '2026-09-05', 'draft')
  RETURNING id INTO v_trip_id;

  INSERT INTO app.places (canonical_name, location, location_status)
  VALUES ('Sec Place', extensions.ST_SetSRID(extensions.ST_MakePoint(139.7, 35.6), 4326)::extensions.geography, 'verified')
  RETURNING id INTO v_place_id;

  INSERT INTO app.visits (trip_id, place_id, title, publication_status)
  VALUES (v_trip_id, v_place_id, 'Sec Visit', 'draft')
  RETURNING id INTO v_visit_id;

  INSERT INTO app.trajectories (trip_id, publication_status)
  VALUES (v_trip_id, 'draft')
  RETURNING id INTO v_traj_id;

  -- -------------------------------------------------------------
  -- C01: CMS Editor can SELECT raw records / samples
  -- -------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"cms_role":"editor"}}', true);
    -- Test as authenticated editor
    EXECUTE 'SELECT count(*) FROM app.trajectory_samples WHERE trajectory_id = $1' INTO v_count USING v_traj_id;
    test_id := 'C01';
    actor := 'Editor';
    attempted_action := 'SELECT app.trajectory_samples';
    expected := 'Success';
    actual := 'Count: ' || v_count;
    test_result := 'PASS';
    RETURN NEXT;
  EXCEPTION WHEN OTHERS THEN
    test_id := 'C01';
    actor := 'Editor';
    attempted_action := 'SELECT app.trajectory_samples';
    expected := 'Success';
    actual := 'Error: ' || SQLERRM;
    test_result := 'FAIL';
    RETURN NEXT;
  END;

  -- -------------------------------------------------------------
  -- C02: CMS Editor cannot UPDATE/DELETE raw source / samples
  -- -------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"cms_role":"editor"}}', true);
    -- CMS editor only has SELECT on trajectory_samples
    EXECUTE 'UPDATE app.trajectory_samples SET sequence_no = 999 WHERE trajectory_id = $1' USING v_traj_id;
    test_id := 'C02';
    actor := 'Editor';
    attempted_action := 'UPDATE app.trajectory_samples';
    expected := 'Permission denied';
    actual := 'Allowed update!';
    test_result := 'FAIL';
    RETURN NEXT;
  EXCEPTION WHEN OTHERS THEN
    test_id := 'C02';
    actor := 'Editor';
    attempted_action := 'UPDATE app.trajectory_samples';
    expected := 'Permission denied';
    actual := SQLERRM;
    test_result := 'PASS';
    RETURN NEXT;
  END;

  -- -------------------------------------------------------------
  -- C03: CMS Editor can modify curated content / redactions
  -- -------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"cms_role":"editor"}}', true);
    UPDATE app.visits SET title = 'Updated Title by Editor' WHERE id = v_visit_id;
    test_id := 'C03';
    actor := 'Editor';
    attempted_action := 'UPDATE app.visits';
    expected := 'Success';
    actual := 'Success';
    test_result := 'PASS';
    RETURN NEXT;
  EXCEPTION WHEN OTHERS THEN
    test_id := 'C03';
    actor := 'Editor';
    attempted_action := 'UPDATE app.visits';
    expected := 'Success';
    actual := 'Error: ' || SQLERRM;
    test_result := 'FAIL';
    RETURN NEXT;
  END;

  -- -------------------------------------------------------------
  -- C04: CMS Editor can change Trajectory publication_status
  -- -------------------------------------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"cms_role":"editor"}}', true);
    UPDATE app.trajectories SET publication_status = 'published' WHERE id = v_traj_id;
    UPDATE app.trajectories SET publication_status = 'draft' WHERE id = v_traj_id;
    test_id := 'C04';
    actor := 'Editor';
    attempted_action := 'UPDATE app.trajectories publication_status';
    expected := 'Success';
    actual := 'Success';
    test_result := 'PASS';
    RETURN NEXT;
  EXCEPTION WHEN OTHERS THEN
    test_id := 'C04';
    actor := 'Editor';
    attempted_action := 'UPDATE app.trajectories publication_status';
    expected := 'Success';
    actual := 'Error: ' || SQLERRM;
    test_result := 'FAIL';
    RETURN NEXT;
  END;

  -- Reset config
  PERFORM set_config('request.jwt.claims', '', true);

  -- Cleanup
  DELETE FROM app.visits WHERE id = v_visit_id;
  DELETE FROM app.trajectories WHERE id = v_traj_id;
  DELETE FROM app.places WHERE id = v_place_id;
  DELETE FROM app.trips WHERE id = v_trip_id;
END;
$$;
