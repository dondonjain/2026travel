-- CMS CP2: Visit State Schema & Compatibility Migration
-- Introduces independent review_status and visibility to app.visits.
-- Preserves legacy app.visits.publication_status for backward compatibility.
BEGIN;

-- 1. Add review_status column with default 'pending' and check constraint
ALTER TABLE app.visits
  ADD COLUMN review_status text NOT NULL DEFAULT 'pending';

ALTER TABLE app.visits
  ADD CONSTRAINT visits_review_status_check
  CHECK (review_status IN ('pending', 'confirmed'));

-- 2. Add visibility column with default 'public' and check constraint
ALTER TABLE app.visits
  ADD COLUMN visibility text NOT NULL DEFAULT 'public';

ALTER TABLE app.visits
  ADD CONSTRAINT visits_visibility_check
  CHECK (visibility IN ('public', 'private'));

-- 3. One-time compatibility backfill:
-- Historical visits that were 'published' remain 'public';
-- any non-published visits (draft/archived) receive 'private'.
-- Historical visits receive review_status = 'pending' per CP2 contract.
UPDATE app.visits
  SET visibility = CASE
    WHEN publication_status = 'published' THEN 'public'
    ELSE 'private'
  END,
  review_status = 'pending';

-- 4. Recreate api_cms.cms_visits so security-invoker CMS view projects new columns
CREATE OR REPLACE VIEW api_cms.cms_visits WITH (security_invoker = true, security_barrier = true) AS
  SELECT * FROM app.visits;

GRANT SELECT, INSERT, UPDATE, DELETE ON api_cms.cms_visits TO authenticated;

COMMIT;
