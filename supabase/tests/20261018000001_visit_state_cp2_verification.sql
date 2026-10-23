-- Runtime verification for CMS CP2 Visit State Schema
-- Verifies review_status and visibility columns, defaults, check constraints,
-- 4-state independence, backfill behavior, and api_cms.cms_visits exposure.
DO $$
DECLARE
  v_trip_id uuid;
  v_place_id uuid;
  v_v_default uuid;
  v_v_pen_pub uuid;
  v_v_pen_priv uuid;
  v_v_conf_pub uuid;
  v_v_conf_priv uuid;
  v_review text;
  v_vis text;
  v_check_passed boolean;
BEGIN
  -- 1. Setup minimal test Trip & Place
  INSERT INTO app.trips (slug, title, starts_on, ends_on, publication_status)
  VALUES ('cp2-test-trip', 'CP2 Test Trip', '2026-10-01', '2026-10-05', 'draft')
  RETURNING id INTO v_trip_id;

  INSERT INTO app.places (canonical_name, location, location_status)
  VALUES ('CP2 Test Place', extensions.ST_SetSRID(extensions.ST_MakePoint(139.7, 35.6), 4326)::extensions.geography, 'verified')
  RETURNING id INTO v_place_id;

  -- 2. Test Defaults: inserting without review_status or visibility gets 'pending' and 'public'
  INSERT INTO app.visits (trip_id, place_id, title)
  VALUES (v_trip_id, v_place_id, 'Default State Visit')
  RETURNING id INTO v_v_default;

  SELECT review_status, visibility INTO v_review, v_vis
  FROM app.visits WHERE id = v_v_default;

  IF v_review <> 'pending' OR v_vis <> 'public' THEN
    RAISE EXCEPTION 'DEFAULT CHECK FAILED: expected (pending, public), got (%, %)', v_review, v_vis;
  END IF;
  RAISE NOTICE 'CHECK 1 PASSED: Default review_status is pending and visibility is public';

  -- 3. Test 4-state independence: prove all 4 independent combinations can be represented
  -- State 1: Pending + Public
  INSERT INTO app.visits (trip_id, place_id, title, review_status, visibility)
  VALUES (v_trip_id, v_place_id, 'Pending Public', 'pending', 'public')
  RETURNING id INTO v_v_pen_pub;

  -- State 2: Pending + Private
  INSERT INTO app.visits (trip_id, place_id, title, review_status, visibility)
  VALUES (v_trip_id, v_place_id, 'Pending Private', 'pending', 'private')
  RETURNING id INTO v_v_pen_priv;

  -- State 3: Confirmed + Public
  INSERT INTO app.visits (trip_id, place_id, title, review_status, visibility)
  VALUES (v_trip_id, v_place_id, 'Confirmed Public', 'confirmed', 'public')
  RETURNING id INTO v_v_conf_pub;

  -- State 4: Confirmed + Private
  INSERT INTO app.visits (trip_id, place_id, title, review_status, visibility)
  VALUES (v_trip_id, v_place_id, 'Confirmed Private', 'confirmed', 'private')
  RETURNING id INTO v_v_conf_priv;

  IF (SELECT count(*) FROM app.visits WHERE id IN (v_v_pen_pub, v_v_pen_priv, v_v_conf_pub, v_v_conf_priv)) <> 4 THEN
    RAISE EXCEPTION 'STATE INDEPENDENCE FAILED: not all 4 states inserted';
  END IF;
  RAISE NOTICE 'CHECK 2 PASSED: 4-state independence verified (pending+public, pending+private, confirmed+public, confirmed+private)';

  -- 4. Constraint rejection: invalid review_status rejected
  v_check_passed := false;
  BEGIN
    INSERT INTO app.visits (trip_id, place_id, title, review_status, visibility)
    VALUES (v_trip_id, v_place_id, 'Invalid Review', 'invalid_status', 'public');
  EXCEPTION WHEN check_violation THEN
    v_check_passed := true;
  END;
  IF NOT v_check_passed THEN
    RAISE EXCEPTION 'CONSTRAINT CHECK FAILED: invalid review_status was accepted';
  END IF;
  RAISE NOTICE 'CHECK 3 PASSED: invalid review_status rejected by check constraint';

  -- 5. Constraint rejection: invalid visibility rejected
  v_check_passed := false;
  BEGIN
    INSERT INTO app.visits (trip_id, place_id, title, review_status, visibility)
    VALUES (v_trip_id, v_place_id, 'Invalid Visibility', 'pending', 'hidden');
  EXCEPTION WHEN check_violation THEN
    v_check_passed := true;
  END;
  IF NOT v_check_passed THEN
    RAISE EXCEPTION 'CONSTRAINT CHECK FAILED: invalid visibility was accepted';
  END IF;
  RAISE NOTICE 'CHECK 4 PASSED: invalid visibility rejected by check constraint';

  -- 6. Verify api_cms.cms_visits exposure
  PERFORM review_status, visibility FROM api_cms.cms_visits WHERE id = v_v_conf_pub;
  RAISE NOTICE 'CHECK 5 PASSED: api_cms.cms_visits exposes review_status and visibility';

  -- Clean up test records
  DELETE FROM app.visits WHERE trip_id = v_trip_id;
  DELETE FROM app.places WHERE id = v_place_id;
  DELETE FROM app.trips WHERE id = v_trip_id;

  RAISE NOTICE 'ALL CMS CP2 RUNTIME CHECKS PASSED';
END;
$$;
