-- Visit-level public playback pacing. This stores only a derived narrative
-- duration; raw trusted timestamps remain private technical data.
BEGIN;

ALTER TABLE app.visits
  ADD COLUMN narrative_dwell_ms integer NOT NULL DEFAULT 4000;

ALTER TABLE app.visits
  ADD CONSTRAINT visits_narrative_dwell_ms_check
  CHECK (narrative_dwell_ms IN (1500, 2000, 2800, 4000, 5000, 6500, 8000));

-- The public-reader role owns the existing view. PostgreSQL 17 needs this
-- tightly bounded SET-role/CREATE window to replace that definition.
GRANT app_public_reader TO CURRENT_USER WITH SET TRUE, INHERIT FALSE;
GRANT CREATE ON SCHEMA api_public TO app_public_reader;

SET ROLE app_public_reader;

CREATE OR REPLACE VIEW api_public.public_trip_visits WITH (security_barrier = true) AS
  SELECT
    t.slug AS trip_slug,
    v.id AS visit_id,
    v.title,
    v.description,
    v.occurred_at,
    v.time_zone,
    v.presentation_category,
    v.tags,
    v.is_highlight,
    CASE WHEN p.location_status = 'verified' THEN p.canonical_name END AS place_name,
    CASE WHEN p.location_status = 'verified' THEN extensions.ST_Y(p.location::extensions.geometry) END AS latitude,
    CASE WHEN p.location_status = 'verified' THEN extensions.ST_X(p.location::extensions.geometry) END AS longitude,
    v.narrative_dwell_ms
  FROM app.visits v
  JOIN app.trips t ON t.id = v.trip_id
  JOIN app.places p ON p.id = v.place_id
  WHERE t.publication_status = 'published'
    AND v.publication_status = 'published'
  ORDER BY v.occurred_at NULLS LAST, v.display_order NULLS LAST, v.id;

RESET ROLE;

REVOKE CREATE ON SCHEMA api_public FROM app_public_reader;
REVOKE app_public_reader FROM CURRENT_USER GRANTED BY CURRENT_USER;

COMMIT;
