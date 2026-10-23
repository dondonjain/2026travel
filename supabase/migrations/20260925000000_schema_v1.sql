-- Travel Portal: Supabase schema v1
--
-- This migration intentionally creates no application data.  It is atomic: a
-- failure rolls back objects, roles, policies, and API grants together.
-- Before applying to Supabase, configure only api_public and api_cms as exposed
-- PostgREST schemas.  app and app_private must remain unexposed.

BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS api_public;
CREATE SCHEMA IF NOT EXISTS api_cms;
CREATE SCHEMA IF NOT EXISTS app_private;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_importer') THEN
    CREATE ROLE app_importer NOINHERIT LOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_public_reader') THEN
    CREATE ROLE app_public_reader NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_integrity_executor') THEN
    CREATE ROLE app_integrity_executor NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
END;
$$;

ALTER ROLE app_importer NOBYPASSRLS;
ALTER ROLE app_public_reader NOBYPASSRLS;
ALTER ROLE app_integrity_executor NOLOGIN NOINHERIT NOBYPASSRLS;

-- Remove broad defaults before any base table is created.  API grants are added
-- only after RLS and the read models exist.
REVOKE ALL ON SCHEMA app, app_private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SCHEMA api_public, api_cms FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;

CREATE TABLE app.trips (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  default_time_zone text,
  publication_status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trips_slug_key UNIQUE (slug),
  CONSTRAINT trips_slug_not_blank CHECK (btrim(slug) <> ''),
  CONSTRAINT trips_title_not_blank CHECK (btrim(title) <> ''),
  CONSTRAINT trips_date_range_check CHECK (starts_on <= ends_on),
  CONSTRAINT trips_publication_status_check
    CHECK (publication_status IN ('draft', 'published', 'archived'))
);

CREATE TABLE app.places (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  canonical_name text NOT NULL,
  location extensions.geography(Point, 4326),
  location_status text NOT NULL DEFAULT 'unverified',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT places_canonical_name_not_blank CHECK (btrim(canonical_name) <> ''),
  CONSTRAINT places_location_status_check
    CHECK (location_status IN ('unverified', 'verified')),
  CONSTRAINT places_verified_location_check
    CHECK ((location_status = 'verified') = (location IS NOT NULL))
);

CREATE TABLE app.visits (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES app.trips(id) ON DELETE RESTRICT,
  place_id uuid NOT NULL REFERENCES app.places(id) ON DELETE RESTRICT,
  title text,
  description text,
  occurred_at timestamptz,
  time_zone text,
  time_source text NOT NULL DEFAULT 'unknown',
  presentation_category text,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_highlight boolean NOT NULL DEFAULT false,
  publication_status text NOT NULL DEFAULT 'draft',
  display_order integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT visits_time_source_check
    CHECK (time_source IN ('editorial', 'trajectory_derived', 'unknown')),
  CONSTRAINT visits_publication_status_check
    CHECK (publication_status IN ('draft', 'published', 'archived')),
  CONSTRAINT visits_display_order_check CHECK (display_order IS NULL OR display_order >= 0)
);

CREATE TABLE app.visit_media (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES app.visits(id) ON DELETE RESTRICT,
  media_type text NOT NULL,
  url text NOT NULL,
  thumbnail_url text,
  title text,
  caption text,
  origin_kind text NOT NULL DEFAULT 'unknown',
  display_order integer NOT NULL DEFAULT 0,
  publication_status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT visit_media_type_check CHECK (media_type IN ('image', 'youtube', 'external_video')),
  CONSTRAINT visit_media_url_not_blank CHECK (btrim(url) <> ''),
  CONSTRAINT visit_media_origin_kind_check
    CHECK (origin_kind IN ('visit_captured', 'third_party', 'default', 'unknown')),
  CONSTRAINT visit_media_display_order_check CHECK (display_order >= 0),
  CONSTRAINT visit_media_publication_status_check
    CHECK (publication_status IN ('draft', 'published', 'archived')),
  CONSTRAINT visit_media_visit_display_order_key UNIQUE (visit_id, display_order)
);

CREATE TABLE app.trajectories (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES app.trips(id) ON DELETE RESTRICT,
  publication_status text NOT NULL DEFAULT 'draft',
  source_started_at timestamptz,
  source_ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trajectories_trip_id_key UNIQUE (trip_id),
  CONSTRAINT trajectories_publication_status_check
    CHECK (publication_status IN ('draft', 'published', 'archived')),
  CONSTRAINT trajectories_source_range_check
    CHECK (source_started_at IS NULL OR source_ended_at IS NULL OR source_started_at <= source_ended_at)
);

CREATE TABLE app.trajectory_source_records (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  trajectory_id uuid NOT NULL REFERENCES app.trajectories(id) ON DELETE RESTRICT,
  source_kind text NOT NULL,
  source_key text NOT NULL,
  started_at timestamptz,
  ended_at timestamptz,
  raw_payload jsonb NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trajectory_source_records_kind_check
    CHECK (source_kind IN ('timeline_visit', 'timeline_activity', 'timeline_path', 'gps', 'other')),
  CONSTRAINT trajectory_source_records_key_not_blank CHECK (btrim(source_key) <> ''),
  CONSTRAINT trajectory_source_records_time_range_check
    CHECK (started_at IS NULL OR ended_at IS NULL OR started_at <= ended_at),
  CONSTRAINT trajectory_source_records_trajectory_source_key_key UNIQUE (trajectory_id, source_key)
);

CREATE TABLE app.trajectory_samples (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  trajectory_id uuid NOT NULL REFERENCES app.trajectories(id) ON DELETE RESTRICT,
  sequence_no integer NOT NULL,
  position extensions.geography(Point, 4326) NOT NULL,
  recorded_at timestamptz,
  time_basis text NOT NULL DEFAULT 'unknown',
  source_record_id uuid REFERENCES app.trajectory_source_records(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trajectory_samples_sequence_no_check CHECK (sequence_no >= 0),
  CONSTRAINT trajectory_samples_time_basis_check
    CHECK (time_basis IN ('observed', 'interpolated', 'unknown')),
  CONSTRAINT trajectory_samples_trajectory_sequence_key UNIQUE (trajectory_id, sequence_no)
);

CREATE TABLE app.trajectory_redactions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  trajectory_id uuid NOT NULL REFERENCES app.trajectories(id) ON DELETE RESTRICT,
  start_sample_id uuid NOT NULL REFERENCES app.trajectory_samples(id) ON DELETE RESTRICT,
  end_sample_id uuid NOT NULL REFERENCES app.trajectory_samples(id) ON DELETE RESTRICT,
  reason text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX trips_slug_publication_status_idx
  ON app.trips (slug, publication_status);
CREATE INDEX visits_trip_occurred_display_idx
  ON app.visits (trip_id, occurred_at NULLS LAST, display_order NULLS LAST, id);
CREATE INDEX visits_place_id_idx ON app.visits (place_id);
CREATE INDEX visit_media_visit_display_idx ON app.visit_media (visit_id, display_order);
CREATE INDEX trajectories_trip_publication_status_idx
  ON app.trajectories (trip_id, publication_status);
CREATE INDEX trajectory_samples_trajectory_recorded_idx
  ON app.trajectory_samples (trajectory_id, recorded_at);
CREATE INDEX trajectory_source_records_trajectory_source_key_idx
  ON app.trajectory_source_records (trajectory_id, source_key);
CREATE INDEX places_location_gist_idx ON app.places USING gist (location);
CREATE INDEX trajectory_samples_position_gist_idx ON app.trajectory_samples USING gist (position);

CREATE FUNCTION app_private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION app_private.validate_redaction_range()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  start_trajectory_id uuid;
  end_trajectory_id uuid;
  start_sequence integer;
  end_sequence integer;
BEGIN
  SELECT trajectory_id, sequence_no
    INTO start_trajectory_id, start_sequence
    FROM app.trajectory_samples
   WHERE id = NEW.start_sample_id
   FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'redaction start sample does not exist';
  END IF;

  SELECT trajectory_id, sequence_no
    INTO end_trajectory_id, end_sequence
    FROM app.trajectory_samples
   WHERE id = NEW.end_sample_id
   FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'redaction end sample does not exist';
  END IF;

  IF start_trajectory_id <> NEW.trajectory_id OR end_trajectory_id <> NEW.trajectory_id THEN
    RAISE EXCEPTION 'redaction endpoints must belong to its trajectory';
  END IF;
  IF start_sequence > end_sequence THEN
    RAISE EXCEPTION 'redaction start sample must not follow end sample';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION app_private.guard_technical_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  parent_id uuid;
  parent_status text;
BEGIN
  -- Lock every affected parent.  The lock serializes a CMS publication update
  -- with technical DML, closing the check-then-write race.
  FOR parent_id IN
    SELECT DISTINCT x.trajectory_id
      FROM (
        SELECT CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.trajectory_id END AS trajectory_id
        UNION ALL
        SELECT CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.trajectory_id END AS trajectory_id
      ) AS x
     WHERE x.trajectory_id IS NOT NULL
     ORDER BY x.trajectory_id
  LOOP
    SELECT publication_status INTO parent_status
      FROM app.trajectories
     WHERE id = parent_id
     FOR UPDATE;
    IF NOT FOUND OR parent_status <> 'draft' THEN
      RAISE EXCEPTION 'technical trajectory writes require a draft parent trajectory';
    END IF;
  END LOOP;

  -- Moving a sample referenced by a redaction would invalidate its cross-row
  -- trajectory invariant without firing the redaction trigger.
  IF TG_TABLE_NAME = 'trajectory_samples'
     AND TG_OP = 'UPDATE'
     AND NEW.trajectory_id IS DISTINCT FROM OLD.trajectory_id
     AND EXISTS (
       SELECT 1
         FROM app.trajectory_redactions r
        WHERE r.start_sample_id = OLD.id OR r.end_sample_id = OLD.id
     ) THEN
    RAISE EXCEPTION 'a redaction endpoint sample cannot move to another trajectory';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trips_set_updated_at
BEFORE UPDATE ON app.trips
FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();
CREATE TRIGGER places_set_updated_at
BEFORE UPDATE ON app.places
FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();
CREATE TRIGGER visits_set_updated_at
BEFORE UPDATE ON app.visits
FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();
CREATE TRIGGER visit_media_set_updated_at
BEFORE UPDATE ON app.visit_media
FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();
CREATE TRIGGER trajectories_set_updated_at
BEFORE UPDATE ON app.trajectories
FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();
CREATE TRIGGER trajectory_redactions_set_updated_at
BEFORE UPDATE ON app.trajectory_redactions
FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();
CREATE TRIGGER trajectory_redactions_validate_range
BEFORE INSERT OR UPDATE ON app.trajectory_redactions
FOR EACH ROW EXECUTE FUNCTION app_private.validate_redaction_range();
CREATE TRIGGER trajectory_source_records_guard_draft_parent
BEFORE INSERT OR UPDATE OR DELETE ON app.trajectory_source_records
FOR EACH ROW EXECUTE FUNCTION app_private.guard_technical_write();
CREATE TRIGGER trajectory_samples_guard_draft_parent
BEFORE INSERT OR UPDATE OR DELETE ON app.trajectory_samples
FOR EACH ROW EXECUTE FUNCTION app_private.guard_technical_write();

ALTER TABLE app.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.visit_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.trajectories ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.trajectory_source_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.trajectory_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.trajectory_redactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.trips FORCE ROW LEVEL SECURITY;
ALTER TABLE app.places FORCE ROW LEVEL SECURITY;
ALTER TABLE app.visits FORCE ROW LEVEL SECURITY;
ALTER TABLE app.visit_media FORCE ROW LEVEL SECURITY;
ALTER TABLE app.trajectories FORCE ROW LEVEL SECURITY;
ALTER TABLE app.trajectory_source_records FORCE ROW LEVEL SECURITY;
ALTER TABLE app.trajectory_samples FORCE ROW LEVEL SECURITY;
ALTER TABLE app.trajectory_redactions FORCE ROW LEVEL SECURITY;

CREATE FUNCTION app_private.is_cms_editor()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'cms_role') = 'editor', false);
$$;

-- CMS policies: app_metadata.cms_role = 'editor' is the controlled claim used
-- by the future token-issuance runbook. user_metadata is deliberately ignored.
CREATE POLICY cms_curated_all_trips ON app.trips FOR ALL TO authenticated
  USING (app_private.is_cms_editor()) WITH CHECK (app_private.is_cms_editor());
CREATE POLICY cms_curated_all_places ON app.places FOR ALL TO authenticated
  USING (app_private.is_cms_editor()) WITH CHECK (app_private.is_cms_editor());
CREATE POLICY cms_curated_all_visits ON app.visits FOR ALL TO authenticated
  USING (app_private.is_cms_editor()) WITH CHECK (app_private.is_cms_editor());
CREATE POLICY cms_curated_all_visit_media ON app.visit_media FOR ALL TO authenticated
  USING (app_private.is_cms_editor()) WITH CHECK (app_private.is_cms_editor());
CREATE POLICY cms_curated_all_trajectories ON app.trajectories FOR ALL TO authenticated
  USING (app_private.is_cms_editor()) WITH CHECK (app_private.is_cms_editor());
CREATE POLICY cms_curated_all_redactions ON app.trajectory_redactions FOR ALL TO authenticated
  USING (app_private.is_cms_editor()) WITH CHECK (app_private.is_cms_editor());
CREATE POLICY cms_raw_read_source_records ON app.trajectory_source_records FOR SELECT TO authenticated
  USING (app_private.is_cms_editor());
CREATE POLICY cms_raw_read_samples ON app.trajectory_samples FOR SELECT TO authenticated
  USING (app_private.is_cms_editor());

-- Importer policies always examine the parent trajectory, never only the child.
CREATE POLICY importer_select_draft_trajectories ON app.trajectories FOR SELECT TO app_importer
  USING (publication_status = 'draft');
CREATE POLICY importer_insert_draft_trajectories ON app.trajectories FOR INSERT TO app_importer
  WITH CHECK (publication_status = 'draft');
CREATE POLICY importer_update_draft_trajectories ON app.trajectories FOR UPDATE TO app_importer
  USING (publication_status = 'draft') WITH CHECK (publication_status = 'draft');
CREATE POLICY importer_select_draft_source_records ON app.trajectory_source_records FOR SELECT TO app_importer
  USING (EXISTS (SELECT 1 FROM app.trajectories t WHERE t.id = trajectory_id AND t.publication_status = 'draft'));
CREATE POLICY importer_insert_draft_source_records ON app.trajectory_source_records FOR INSERT TO app_importer
  WITH CHECK (EXISTS (SELECT 1 FROM app.trajectories t WHERE t.id = trajectory_id AND t.publication_status = 'draft'));
CREATE POLICY importer_update_draft_source_records ON app.trajectory_source_records FOR UPDATE TO app_importer
  USING (EXISTS (SELECT 1 FROM app.trajectories t WHERE t.id = trajectory_id AND t.publication_status = 'draft'))
  WITH CHECK (EXISTS (SELECT 1 FROM app.trajectories t WHERE t.id = trajectory_id AND t.publication_status = 'draft'));
CREATE POLICY importer_delete_draft_source_records ON app.trajectory_source_records FOR DELETE TO app_importer
  USING (EXISTS (SELECT 1 FROM app.trajectories t WHERE t.id = trajectory_id AND t.publication_status = 'draft'));
CREATE POLICY importer_select_draft_samples ON app.trajectory_samples FOR SELECT TO app_importer
  USING (EXISTS (SELECT 1 FROM app.trajectories t WHERE t.id = trajectory_id AND t.publication_status = 'draft'));
CREATE POLICY importer_insert_draft_samples ON app.trajectory_samples FOR INSERT TO app_importer
  WITH CHECK (EXISTS (SELECT 1 FROM app.trajectories t WHERE t.id = trajectory_id AND t.publication_status = 'draft'));
CREATE POLICY importer_update_draft_samples ON app.trajectory_samples FOR UPDATE TO app_importer
  USING (EXISTS (SELECT 1 FROM app.trajectories t WHERE t.id = trajectory_id AND t.publication_status = 'draft'))
  WITH CHECK (EXISTS (SELECT 1 FROM app.trajectories t WHERE t.id = trajectory_id AND t.publication_status = 'draft'));
CREATE POLICY importer_delete_draft_samples ON app.trajectory_samples FOR DELETE TO app_importer
  USING (EXISTS (SELECT 1 FROM app.trajectories t WHERE t.id = trajectory_id AND t.publication_status = 'draft'));

-- The SECURITY DEFINER trigger owner can only read the columns used by the
-- integrity checks and acquire row locks. UPDATE policies expose existing rows
-- to SELECT ... FOR [KEY] UPDATE but WITH CHECK (false) prevents the role from
-- committing raw or publication-state changes even if it were assumed.
CREATE POLICY integrity_executor_select_trajectories ON app.trajectories
  FOR SELECT TO app_integrity_executor USING (true);
CREATE POLICY integrity_executor_lock_trajectories ON app.trajectories
  FOR UPDATE TO app_integrity_executor USING (true) WITH CHECK (false);
CREATE POLICY integrity_executor_select_samples ON app.trajectory_samples
  FOR SELECT TO app_integrity_executor USING (true);
CREATE POLICY integrity_executor_lock_samples ON app.trajectory_samples
  FOR UPDATE TO app_integrity_executor USING (true) WITH CHECK (false);
CREATE POLICY integrity_executor_select_redactions ON app.trajectory_redactions
  FOR SELECT TO app_integrity_executor USING (true);

-- The public-reader role owns the API views but is not a table owner.  RLS
-- therefore still enforces the publication chain when a view/RPC runs.
CREATE POLICY public_reader_published_trips ON app.trips FOR SELECT TO app_public_reader
  USING (publication_status = 'published');
CREATE POLICY public_reader_places_with_public_visit ON app.places FOR SELECT TO app_public_reader
  USING (
    EXISTS (
      SELECT 1 FROM app.visits v
      JOIN app.trips t ON t.id = v.trip_id
      WHERE v.place_id = app.places.id
        AND v.publication_status = 'published'
        AND t.publication_status = 'published'
    )
  );
CREATE POLICY public_reader_published_visits ON app.visits FOR SELECT TO app_public_reader
  USING (
    publication_status = 'published'
    AND EXISTS (SELECT 1 FROM app.trips t WHERE t.id = trip_id AND t.publication_status = 'published')
  );
CREATE POLICY public_reader_published_visit_media ON app.visit_media FOR SELECT TO app_public_reader
  USING (
    publication_status = 'published'
    AND EXISTS (
      SELECT 1 FROM app.visits v
      JOIN app.trips t ON t.id = v.trip_id
      WHERE v.id = visit_id
        AND v.publication_status = 'published'
        AND t.publication_status = 'published'
    )
  );
CREATE POLICY public_reader_published_trajectories ON app.trajectories FOR SELECT TO app_public_reader
  USING (
    publication_status = 'published'
    AND EXISTS (SELECT 1 FROM app.trips t WHERE t.id = trip_id AND t.publication_status = 'published')
  );
CREATE POLICY public_reader_samples_for_published_trajectory ON app.trajectory_samples FOR SELECT TO app_public_reader
  USING (
    EXISTS (
      SELECT 1 FROM app.trajectories tr
      JOIN app.trips t ON t.id = tr.trip_id
      WHERE tr.id = trajectory_id
        AND tr.publication_status = 'published'
        AND t.publication_status = 'published'
    )
  );
CREATE POLICY public_reader_redactions_for_published_trajectory ON app.trajectory_redactions FOR SELECT TO app_public_reader
  USING (
    EXISTS (
      SELECT 1 FROM app.trajectories tr
      JOIN app.trips t ON t.id = tr.trip_id
      WHERE tr.id = trajectory_id
        AND tr.publication_status = 'published'
        AND t.publication_status = 'published'
    )
  );

-- Table and schema privileges. auth users need underlying table privileges for
-- security-invoker CMS views; RLS keeps ordinary authenticated users at deny.
GRANT USAGE ON SCHEMA app TO authenticated, app_importer, app_public_reader,
  app_integrity_executor;
GRANT USAGE ON SCHEMA extensions TO app_importer, app_public_reader;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_cms_editor() TO authenticated;
REVOKE ALL ON FUNCTION app_private.set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.validate_redaction_range() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.guard_technical_write() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.is_cms_editor() FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON app.trips, app.places, app.visits,
  app.visit_media, app.trajectories, app.trajectory_redactions TO authenticated;
GRANT SELECT ON app.trajectory_source_records, app.trajectory_samples TO authenticated;

-- publication_status is readable only so the importer can evaluate the
-- parent-draft predicates used by its child-table RLS policies. The trajectory
-- SELECT policy still hides every non-draft row, and no status write is granted.
GRANT SELECT (id, trip_id, publication_status, source_started_at, source_ended_at)
  ON app.trajectories TO app_importer;
GRANT INSERT (id, trip_id, source_started_at, source_ended_at) ON app.trajectories TO app_importer;
GRANT UPDATE (source_started_at, source_ended_at) ON app.trajectories TO app_importer;
GRANT SELECT, INSERT, UPDATE, DELETE ON app.trajectory_source_records, app.trajectory_samples TO app_importer;

GRANT SELECT (id, publication_status) ON app.trajectories TO app_integrity_executor;
GRANT UPDATE (id) ON app.trajectories TO app_integrity_executor;
GRANT SELECT (id, trajectory_id, sequence_no) ON app.trajectory_samples TO app_integrity_executor;
GRANT UPDATE (id) ON app.trajectory_samples TO app_integrity_executor;
GRANT SELECT (start_sample_id, end_sample_id) ON app.trajectory_redactions TO app_integrity_executor;

GRANT SELECT ON app.trips, app.places, app.visits, app.visit_media,
  app.trajectories, app.trajectory_samples, app.trajectory_redactions TO app_public_reader;

REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC, anon;

-- PostgreSQL 17 ownership transfer requires temporary SET capability and
-- CREATE on the containing schema. Keep both capabilities bounded to the two
-- hardened trigger functions, then restore the non-assumable role boundary.
GRANT app_integrity_executor TO CURRENT_USER WITH SET TRUE, INHERIT FALSE;
GRANT CREATE ON SCHEMA app_private TO app_integrity_executor;

ALTER FUNCTION app_private.validate_redaction_range() OWNER TO app_integrity_executor;
ALTER FUNCTION app_private.guard_technical_write() OWNER TO app_integrity_executor;

REVOKE CREATE ON SCHEMA app_private FROM app_integrity_executor;
REVOKE app_integrity_executor FROM CURRENT_USER GRANTED BY CURRENT_USER;

CREATE VIEW api_public.public_trips WITH (security_barrier = true) AS
  SELECT t.slug, t.title, t.starts_on, t.ends_on, t.default_time_zone
  FROM app.trips t
  WHERE t.publication_status = 'published';

CREATE VIEW api_public.public_trip_visits WITH (security_barrier = true) AS
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
    CASE WHEN p.location_status = 'verified' THEN extensions.ST_X(p.location::extensions.geometry) END AS longitude
  FROM app.visits v
  JOIN app.trips t ON t.id = v.trip_id
  JOIN app.places p ON p.id = v.place_id
  WHERE t.publication_status = 'published'
    AND v.publication_status = 'published'
  ORDER BY v.occurred_at NULLS LAST, v.display_order NULLS LAST, v.id;

CREATE VIEW api_public.public_visit_media WITH (security_barrier = true) AS
  SELECT
    t.slug AS trip_slug,
    v.id AS visit_id,
    m.media_type,
    m.url,
    m.thumbnail_url,
    m.title,
    m.caption,
    m.display_order,
    m.origin_kind
  FROM app.visit_media m
  JOIN app.visits v ON v.id = m.visit_id
  JOIN app.trips t ON t.id = v.trip_id
  WHERE t.publication_status = 'published'
    AND v.publication_status = 'published'
    AND m.publication_status = 'published'
  ORDER BY t.slug, v.id, m.display_order;

CREATE FUNCTION api_public.get_public_trajectory(p_trip_slug text)
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
      AND t.publication_status = 'published'
      AND tr.publication_status = 'published'
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

CREATE VIEW api_cms.cms_trips WITH (security_invoker = true, security_barrier = true) AS
  SELECT * FROM app.trips;
CREATE VIEW api_cms.cms_places WITH (security_invoker = true, security_barrier = true) AS
  SELECT * FROM app.places;
CREATE VIEW api_cms.cms_visits WITH (security_invoker = true, security_barrier = true) AS
  SELECT * FROM app.visits;
CREATE VIEW api_cms.cms_visit_media WITH (security_invoker = true, security_barrier = true) AS
  SELECT * FROM app.visit_media;
CREATE VIEW api_cms.cms_trajectories WITH (security_invoker = true, security_barrier = true) AS
  SELECT * FROM app.trajectories;
CREATE VIEW api_cms.cms_trajectory_redactions WITH (security_invoker = true, security_barrier = true) AS
  SELECT * FROM app.trajectory_redactions;
CREATE VIEW api_cms.cms_trajectory_source_records WITH (security_invoker = true, security_barrier = true) AS
  SELECT * FROM app.trajectory_source_records;
CREATE VIEW api_cms.cms_trajectory_samples WITH (security_invoker = true, security_barrier = true) AS
  SELECT * FROM app.trajectory_samples;

-- Establish the final API ACLs while the migration runner still owns the
-- views/function.  Ownership transfer preserves these ACLs; delaying these
-- object grants until after the bounded SET-role window would leave the
-- non-superuser hosted migration runner without grant option.
REVOKE ALL ON SCHEMA api_public, api_cms FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA api_public, api_cms FROM PUBLIC;
REVOKE ALL ON FUNCTION api_public.get_public_trajectory(text) FROM PUBLIC;
GRANT USAGE ON SCHEMA api_public TO anon, authenticated;
GRANT SELECT ON api_public.public_trips, api_public.public_trip_visits,
  api_public.public_visit_media TO anon, authenticated;
GRANT EXECUTE ON FUNCTION api_public.get_public_trajectory(text) TO anon, authenticated;

GRANT USAGE ON SCHEMA api_cms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON api_cms.cms_trips, api_cms.cms_places,
  api_cms.cms_visits, api_cms.cms_visit_media, api_cms.cms_trajectories,
  api_cms.cms_trajectory_redactions TO authenticated;
GRANT SELECT ON api_cms.cms_trajectory_source_records, api_cms.cms_trajectory_samples TO authenticated;

-- PostgreSQL 17 requires both SET capability for the new owner and CREATE on
-- the containing schema during ALTER ... OWNER.  The automatic CREATEROLE
-- grant is bootstrap-granted ADMIN TRUE / SET FALSE / INHERIT FALSE and cannot
-- be edited by its recipient.  Add a separate, non-inheriting self-grant only
-- for this transfer window.
GRANT app_public_reader TO CURRENT_USER WITH SET TRUE, INHERIT FALSE;
GRANT CREATE ON SCHEMA api_public TO app_public_reader;

ALTER VIEW api_public.public_trips OWNER TO app_public_reader;
ALTER VIEW api_public.public_trip_visits OWNER TO app_public_reader;
ALTER VIEW api_public.public_visit_media OWNER TO app_public_reader;
ALTER FUNCTION api_public.get_public_trajectory(text) OWNER TO app_public_reader;

-- Remove only the self-granted temporary membership.  GRANTED BY CURRENT_USER
-- preserves the bootstrap-granted automatic ADMIN OPTION membership.
REVOKE CREATE ON SCHEMA api_public FROM app_public_reader;
REVOKE app_public_reader FROM CURRENT_USER GRANTED BY CURRENT_USER;

COMMIT;
