-- Run only on a disposable, migrated test database. Rolls back all test fixtures.
-- Requires the approved migration test runner; never run against production.
BEGIN;
DO $$
DECLARE t uuid; p uuid; v uuid; rejected boolean;
BEGIN
  INSERT INTO app.trips(slug,title,starts_on,ends_on,default_time_zone)
  VALUES ('poi-resolution-rollback-test','POI test','2026-08-14','2026-08-15','Asia/Tokyo') RETURNING id INTO t;
  INSERT INTO app.places(canonical_name, location, location_status)
  VALUES ('Test hotel', extensions.ST_SetSRID(extensions.ST_MakePoint(133.9,34.6),4326)::extensions.geography,'verified') RETURNING id INTO p;
  INSERT INTO app.visits(trip_id,place_id,title,resolution_status)
  VALUES (t,NULL,'Unresolved','SPATIAL_CONFLICT_OVERNIGHT') RETURNING id INTO v;
  IF NOT EXISTS(SELECT 1 FROM api_cms.cms_visit_resolution_review WHERE id=v AND place_id IS NULL) THEN
    RAISE EXCEPTION 'Null Place Visit missing from CMS';
  END IF;
  rejected := false;
  BEGIN
    UPDATE app.visits SET place_id=p WHERE id=v;
  EXCEPTION WHEN check_violation THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Conflict auto-link was accepted'; END IF;
  rejected := false;
  BEGIN
    PERFORM api_cms.confirm_cms_visit(v);
  EXCEPTION WHEN raise_exception THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Unresolved Visit confirmed'; END IF;
  rejected := false;
  BEGIN
    UPDATE app.visits SET resolution_status=NULL,place_id=p WHERE id=v;
  EXCEPTION WHEN raise_exception THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Conflict state cleared'; END IF;
  rejected := false;
  BEGIN
    PERFORM api_cms.review_cms_visit_place(v,p);
  EXCEPTION WHEN raise_exception THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Non-editor review accepted'; END IF;
  PERFORM set_config('request.jwt.claims','{"app_metadata":{"cms_role":"editor"}}',true);
  PERFORM api_cms.review_cms_visit_place(v,p);
  IF NOT EXISTS(SELECT 1 FROM app.visits WHERE id=v AND place_id=p AND resolution_status='MANUALLY_CONFIRMED' AND review_status='pending') THEN
    RAISE EXCEPTION 'Human review did not retain pending state';
  END IF;
  PERFORM api_cms.confirm_cms_visit(v);
  IF NOT EXISTS(SELECT 1 FROM app.visits WHERE id=v AND review_status='confirmed') THEN RAISE EXCEPTION 'Reviewed Visit not confirmable'; END IF;
  IF has_function_privilege('anon','api_cms.review_cms_visit_place(uuid,uuid,text,double precision,double precision)','EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous reviewer privilege';
  END IF;
  IF has_table_privilege('anon','api_cms.cms_visit_resolution_review','SELECT') THEN RAISE EXCEPTION 'Anonymous review read'; END IF;
END;
$$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE v uuid; chosen uuid; rejected boolean;
BEGIN
  SELECT id INTO v FROM api_cms.cms_visit_resolution_review WHERE trip_slug='poi-resolution-rollback-test';
  IF v IS NULL THEN RAISE EXCEPTION 'Editor RLS read failed'; END IF;
  -- Exercise actual invoker privileges, PostGIS construction and RLS (not owner bypass).
  SELECT place_id INTO chosen FROM api_cms.review_cms_visit_place(v,NULL,'Reviewed hotel',133.91,34.61);
  IF chosen IS NULL THEN RAISE EXCEPTION 'Editor POI creation failed'; END IF;
  PERFORM set_config('request.jwt.claims','{}',true);
  IF EXISTS(SELECT 1 FROM api_cms.cms_visit_resolution_review WHERE id=v) THEN
    RAISE EXCEPTION 'Ordinary authenticated caller can read review data';
  END IF;
  rejected := false;
  BEGIN
    PERFORM api_cms.review_cms_visit_place(v,chosen);
  EXCEPTION WHEN raise_exception THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Ordinary authenticated review accepted'; END IF;
END;
$$;
RESET ROLE;
ROLLBACK;
