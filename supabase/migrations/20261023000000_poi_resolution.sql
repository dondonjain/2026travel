-- Pending POI resolution: additive schema, no backfill or public API expansion.
BEGIN;
-- Schema lookup for the existing PostGIS functions, not CREATE or data privileges.
GRANT USAGE ON SCHEMA extensions TO authenticated;

ALTER TABLE app.visits ALTER COLUMN place_id DROP NOT NULL;
ALTER TABLE app.visits ADD COLUMN resolution_status text;
ALTER TABLE app.visits ADD CONSTRAINT visits_resolution_status_check CHECK (
  resolution_status IS NULL OR resolution_status IN (
    'HIGH_CONFIDENCE_SUGGESTED', 'AMBIGUOUS_CANDIDATES', 'NO_CANDIDATES',
    'SPATIAL_CONFLICT', 'SPATIAL_CONFLICT_OVERNIGHT', 'MANUALLY_CONFIRMED'
  )
);
ALTER TABLE app.visits ADD CONSTRAINT visits_resolution_link_check CHECK (
  resolution_status IS NULL OR
  (resolution_status = 'MANUALLY_CONFIRMED' AND place_id IS NOT NULL) OR
  (resolution_status <> 'MANUALLY_CONFIRMED' AND place_id IS NULL)
);

-- Row-local guard also covers legacy RPCs and direct INSERT/UPDATE. No new privilege.
CREATE FUNCTION app_private.guard_visit_resolution()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.place_id IS NULL AND NEW.review_status = 'confirmed' THEN
    RAISE EXCEPTION 'Select and review a concrete Place before confirming the Visit';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.resolution_status IS NOT NULL
     AND NEW.resolution_status IS NULL THEN
    RAISE EXCEPTION 'Resolution state cannot be cleared';
  END IF;
  IF NEW.resolution_status = 'MANUALLY_CONFIRMED' AND
     (TG_OP = 'INSERT' OR OLD.resolution_status IS DISTINCT FROM NEW.resolution_status
      OR OLD.place_id IS DISTINCT FROM NEW.place_id) THEN
    IF NOT app_private.is_cms_editor() THEN
      RAISE EXCEPTION 'CMS editor review is required';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION app_private.guard_visit_resolution() FROM PUBLIC;
CREATE TRIGGER visits_guard_resolution BEFORE INSERT OR UPDATE ON app.visits
FOR EACH ROW EXECUTE FUNCTION app_private.guard_visit_resolution();

-- Refresh SELECT * expansion; existing security-invoker grants/policies are retained.
CREATE OR REPLACE VIEW api_cms.cms_visits WITH (security_invoker = true, security_barrier = true) AS
SELECT * FROM app.visits;

-- A pending Visit without a Place remains visible only to authorized CMS editors.
CREATE VIEW api_cms.cms_visit_resolution_review WITH (security_invoker = true, security_barrier = true) AS
SELECT v.id, t.slug AS trip_slug, v.place_id, v.title, v.occurred_at, v.time_zone,
       v.presentation_category, v.review_status, v.visibility, v.resolution_status,
       p.canonical_name AS place_name,
       extensions.ST_X(p.location::extensions.geometry) AS longitude,
       extensions.ST_Y(p.location::extensions.geometry) AS latitude
FROM app.visits v JOIN app.trips t ON t.id = v.trip_id
LEFT JOIN app.places p ON p.id = v.place_id;
GRANT SELECT ON api_cms.cms_visit_resolution_review TO authenticated;

-- Explicit human action. Resolve an existing Place or create a human-reviewed POI
-- atomically. Provider suggestions and precise source timestamps are never stored.
CREATE FUNCTION api_cms.review_cms_visit_place(
  p_visit_id uuid,
  p_place_id uuid DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_latitude double precision DEFAULT NULL
) RETURNS app.visits LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_row app.visits; chosen_id uuid;
BEGIN
  IF NOT app_private.is_cms_editor() THEN RAISE EXCEPTION 'CMS editor review is required'; END IF;
  SELECT * INTO v_row FROM app.visits WHERE id = p_visit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Visit not found or not accessible'; END IF;
  chosen_id := p_place_id;
  IF chosen_id IS NULL THEN
    IF p_name IS NULL OR length(btrim(p_name)) = 0 OR length(p_name) > 300
       OR p_longitude IS NULL OR p_latitude IS NULL
       OR NOT (p_longitude BETWEEN -180 AND 180) OR NOT (p_latitude BETWEEN -90 AND 90) THEN
      RAISE EXCEPTION 'A concrete Place name and valid coordinates are required';
    END IF;
    INSERT INTO app.places(canonical_name, location, location_status)
    VALUES (btrim(p_name), extensions.ST_SetSRID(extensions.ST_MakePoint(p_longitude, p_latitude),4326)::extensions.geography, 'verified')
    RETURNING id INTO chosen_id;
  ELSE
    PERFORM 1 FROM app.places WHERE id = chosen_id AND location_status = 'verified';
    IF NOT FOUND THEN RAISE EXCEPTION 'Select an accessible verified Place'; END IF;
  END IF;
  UPDATE app.visits SET place_id = chosen_id, resolution_status = 'MANUALLY_CONFIRMED', review_status = 'pending'
  WHERE id = p_visit_id RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION api_cms.review_cms_visit_place(uuid,uuid,text,double precision,double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION api_cms.review_cms_visit_place(uuid,uuid,text,double precision,double precision) TO authenticated;

-- Existing public/preview inner joins intentionally exclude unresolved Visits.
COMMIT;
