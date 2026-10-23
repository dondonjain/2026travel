-- CMS CP4: Review Editing & Cruise Preview Migration
-- Defines RPCs for visit confirmation, undo, updating, adding, and draft preview.
-- Defines DB trigger to invalidate confirmation on structural edits.
-- Schema: app and api_cms.
-- api_public remains untouched.
BEGIN;

-- 1. Database trigger on app.visits to revert confirmed to pending on structural edit
CREATE OR REPLACE FUNCTION app.fn_visits_structural_edit_reset_review_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- If currently confirmed, and update attempts to keep it confirmed (or does not specify),
  -- but structural fields (title, occurred_at, place_id, visibility, presentation_category) changed,
  -- automatically reset review_status to 'pending'.
  IF OLD.review_status = 'confirmed' AND NEW.review_status = 'confirmed' THEN
    IF NEW.title IS DISTINCT FROM OLD.title
       OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at
       OR NEW.place_id IS DISTINCT FROM OLD.place_id
       OR NEW.visibility IS DISTINCT FROM OLD.visibility
       OR NEW.presentation_category IS DISTINCT FROM OLD.presentation_category
    THEN
      NEW.review_status := 'pending';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_visits_structural_edit_reset_review_status ON app.visits;
CREATE TRIGGER trg_visits_structural_edit_reset_review_status
  BEFORE UPDATE ON app.visits
  FOR EACH ROW
  EXECUTE FUNCTION app.fn_visits_structural_edit_reset_review_status();

-- 2. api_cms RPCs for Visit mutations

-- Confirm visit
CREATE OR REPLACE FUNCTION api_cms.confirm_cms_visit(p_visit_id uuid)
RETURNS app.visits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row app.visits;
BEGIN
  UPDATE app.visits
  SET review_status = 'confirmed',
      updated_at = now()
  WHERE id = p_visit_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Visit not found: %', p_visit_id;
  END IF;

  RETURN v_row;
END;
$$;

-- Undo confirmation
CREATE OR REPLACE FUNCTION api_cms.undo_cms_visit(p_visit_id uuid)
RETURNS app.visits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row app.visits;
BEGIN
  UPDATE app.visits
  SET review_status = 'pending',
      updated_at = now()
  WHERE id = p_visit_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Visit not found: %', p_visit_id;
  END IF;

  RETURN v_row;
END;
$$;

-- Update visit (title, occurred_at, place_id, visibility, presentation_category)
CREATE OR REPLACE FUNCTION api_cms.update_cms_visit(
  p_visit_id uuid,
  p_title text DEFAULT NULL,
  p_occurred_at timestamptz DEFAULT NULL,
  p_place_id uuid DEFAULT NULL,
  p_visibility text DEFAULT NULL,
  p_presentation_category text DEFAULT NULL
)
RETURNS app.visits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row app.visits;
BEGIN
  UPDATE app.visits
  SET title = COALESCE(p_title, title),
      occurred_at = COALESCE(p_occurred_at, occurred_at),
      place_id = COALESCE(p_place_id, place_id),
      visibility = COALESCE(p_visibility, visibility),
      presentation_category = COALESCE(p_presentation_category, presentation_category),
      updated_at = now()
  WHERE id = p_visit_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Visit not found: %', p_visit_id;
  END IF;

  RETURN v_row;
END;
$$;

-- Add new visit
CREATE OR REPLACE FUNCTION api_cms.add_cms_visit(
  p_trip_id uuid,
  p_place_id uuid,
  p_title text,
  p_occurred_at timestamptz,
  p_visibility text DEFAULT 'public',
  p_presentation_category text DEFAULT 'spot'
)
RETURNS app.visits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row app.visits;
  v_order integer;
BEGIN
  SELECT COALESCE(max(display_order), 0) + 1 INTO v_order
  FROM app.visits
  WHERE trip_id = p_trip_id;

  INSERT INTO app.visits (
    trip_id, place_id, title, occurred_at,
    visibility, review_status, presentation_category,
    display_order, publication_status
  ) VALUES (
    p_trip_id, p_place_id, p_title, p_occurred_at,
    COALESCE(p_visibility, 'public'), 'pending', COALESCE(p_presentation_category, 'spot'),
    v_order, 'draft'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Create place by coordinates
CREATE OR REPLACE FUNCTION api_cms.create_cms_place(
  p_canonical_name text,
  p_longitude double precision,
  p_latitude double precision
)
RETURNS app.places
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  p_row app.places;
BEGIN
  INSERT INTO app.places (
    canonical_name,
    location,
    location_status
  ) VALUES (
    p_canonical_name,
    extensions.ST_SetSRID(extensions.ST_MakePoint(p_longitude, p_latitude), 4326)::extensions.geography,
    'verified'
  )
  RETURNING * INTO p_row;

  RETURN p_row;
END;
$$;

-- 3. Draft Preview RPCs in api_cms (strictly for authenticated/CMS preview)

-- Draft preview visits: ONLY confirmed + public visits
CREATE OR REPLACE FUNCTION api_cms.get_draft_preview_visits(p_trip_slug text)
RETURNS TABLE (
  trip_slug text,
  visit_id uuid,
  title text,
  description text,
  occurred_at timestamptz,
  narrative_dwell_ms integer,
  time_zone text,
  presentation_category text,
  tags text[],
  is_highlight boolean,
  place_name text,
  latitude double precision,
  longitude double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    t.slug AS trip_slug,
    v.id AS visit_id,
    v.title,
    v.description,
    v.occurred_at,
    v.narrative_dwell_ms,
    v.time_zone,
    v.presentation_category,
    v.tags,
    v.is_highlight,
    CASE WHEN p.location_status = 'verified' THEN p.canonical_name END AS place_name,
    CASE WHEN p.location_status = 'verified' THEN extensions.ST_Y(p.location::extensions.geometry) END AS latitude,
    CASE WHEN p.location_status = 'verified' THEN extensions.ST_X(p.location::extensions.geometry) END AS longitude
  FROM app.visits v
  JOIN app.trips t ON t.id = v.trip_id
  JOIN app.places p ON p.id = v.place_id
  WHERE t.slug = p_trip_slug
    AND v.review_status = 'confirmed'
    AND v.visibility = 'public'
  ORDER BY v.occurred_at NULLS LAST, v.display_order NULLS LAST, v.id;
$$;

-- Draft preview trajectory: returns LineString GeoJSON for draft trip
CREATE OR REPLACE FUNCTION api_cms.get_draft_preview_trajectory(p_trip_slug text)
RETURNS TABLE (
  segment_index integer,
  geometry jsonb,
  has_hidden_gap_after boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH target AS (
    SELECT tr.id
    FROM app.trips t
    JOIN app.trajectories tr ON tr.trip_id = t.id
    WHERE t.slug = p_trip_slug
  ),
  raw_ranges AS (
    SELECT ss.sequence_no AS start_sequence_no, es.sequence_no AS end_sequence_no
    FROM app.trajectory_redactions r
    JOIN app.trajectory_samples ss ON ss.id = r.start_sample_id
    JOIN app.trajectory_samples es ON es.id = r.end_sample_id
    JOIN target ON target.id = r.trajectory_id
    WHERE r.is_active
  ),
  running_ranges AS (
    SELECT
      start_sequence_no,
      end_sequence_no,
      max(end_sequence_no) OVER (
        ORDER BY start_sequence_no, end_sequence_no
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ) AS previous_max_end
    FROM raw_ranges
  ),
  range_groups AS (
    SELECT
      start_sequence_no,
      end_sequence_no,
      sum(CASE WHEN previous_max_end IS NULL OR start_sequence_no > previous_max_end + 1 THEN 1 ELSE 0 END)
        OVER (ORDER BY start_sequence_no, end_sequence_no) AS group_no
    FROM running_ranges
  ),
  merged_ranges AS (
    SELECT min(start_sequence_no) AS start_sequence_no, max(end_sequence_no) AS end_sequence_no
    FROM range_groups
    GROUP BY group_no
  ),
  visible_samples AS (
    SELECT s.sequence_no, s.position
    FROM app.trajectory_samples s
    JOIN target ON target.id = s.trajectory_id
    WHERE NOT EXISTS (
      SELECT 1 FROM merged_ranges r
      WHERE s.sequence_no BETWEEN r.start_sequence_no AND r.end_sequence_no
    )
  ),
  visible_breaks AS (
    SELECT
      sequence_no,
      position,
      CASE WHEN lag(sequence_no) OVER (ORDER BY sequence_no) = sequence_no - 1 THEN 0 ELSE 1 END AS starts_segment
    FROM visible_samples
  ),
  visible_groups AS (
    SELECT
      sequence_no,
      position,
      sum(starts_segment) OVER (ORDER BY sequence_no) AS group_no
    FROM visible_breaks
  ),
  segment_lines AS (
    SELECT
      group_no,
      min(sequence_no) AS start_sequence_no,
      max(sequence_no) AS end_sequence_no,
      extensions.ST_SimplifyPreserveTopology(
        extensions.ST_MakeLine(extensions.ST_SnapToGrid(position::extensions.geometry, 0.001) ORDER BY sequence_no),
        0.0005
      ) AS line
    FROM visible_groups
    GROUP BY group_no
  ),
  numbered_segments AS (
    SELECT
      row_number() OVER (ORDER BY start_sequence_no)::integer AS segment_index,
      line,
      end_sequence_no,
      lead(start_sequence_no) OVER (ORDER BY start_sequence_no) AS next_start_sequence_no
    FROM segment_lines
    WHERE extensions.ST_NPoints(line) >= 2
  )
  SELECT
    n.segment_index,
    extensions.ST_AsGeoJSON(n.line)::jsonb AS geometry,
    EXISTS (
      SELECT 1
      FROM merged_ranges r
      WHERE r.start_sequence_no > n.end_sequence_no
        AND (n.next_start_sequence_no IS NULL OR r.start_sequence_no < n.next_start_sequence_no)
    ) AS has_hidden_gap_after
  FROM numbered_segments n
  ORDER BY n.segment_index;
$$;

-- 4. Grants
GRANT USAGE ON SCHEMA api_cms TO authenticated, anon;
GRANT EXECUTE ON FUNCTION api_cms.confirm_cms_visit(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION api_cms.undo_cms_visit(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION api_cms.update_cms_visit(uuid, text, timestamptz, uuid, text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION api_cms.add_cms_visit(uuid, uuid, text, timestamptz, text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION api_cms.create_cms_place(text, double precision, double precision) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION api_cms.get_draft_preview_visits(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION api_cms.get_draft_preview_trajectory(text) TO authenticated, anon;

COMMIT;
