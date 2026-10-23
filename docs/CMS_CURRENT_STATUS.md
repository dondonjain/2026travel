# Travel Portal CMS — Current Status

**Last Updated:** 2026-10-18
**Current Milestone:** CMS Vertical Slice 1 (VS1) — Create Trip to First Cruise Preview
**Active Checkpoint:** CP4 — Live Review Persistence & First Cruise Preview Integration (MACHINE_VERIFIED / READY_FOR_PRODUCT_OWNER_ACCEPTANCE)

---

## 1. Governance & Reading Structure

All CMS pair-programming agents and subagents must read:

1. `AGENTS.md`
2. `PRODUCT.md`
3. `ARCHITECTURE.md`
4. `MVP_BEHAVIORAL_BASELINE.md`
5. `DECISIONS.md`
6. `TESTING.md`
7. `CURRENT_STATUS.md`
8. `docs/CMS_PRODUCT_CONTRACT.md`
9. `docs/CMS_RESPONSIVE_UX_CONTRACT.md`
10. `docs/CMS_VS1_VERIFICATION_MATRIX.md`
11. `docs/CMS_CURRENT_STATUS.md`
12. `docs/CMS_CURRENT_CHECKPOINT.md`

Historical checkpoint documents (such as `docs/CMS_UI_CHECKPOINT_1.md` and `docs/CMS_SCHEMA_CHECKPOINT_2.md`) are preserved for repository history but are superseded by this status tracker and the active checkpoint document.

---

## 2. Checkpoint History

### CP1 — Responsive Trip Review Shell
- **Status:** `PRODUCT_ACCEPTED`
- **Protected Interaction Baseline (Strictly Non-Negotiable):**
  - Canonical workflow: `Trip → Day → Visit → Detail → Confirm → Preview` shared across desktop and mobile.
  - Mobile-first progressive disclosure: Day selector → Visit list → Visit Detail → contextual bottom sheet Map.
  - Desktop 4-column balanced layout: Day selector → Visit list → persistent Map canvas (1/3 or 1/4) → Visit Detail (2/3 or 3/4 during active edit).
  - Explicit user actions:
    - `Confirm` moves visit from `Pending` to `Confirmed` and auto-advances to the next Pending visit in the same day.
    - `Undo` returns Confirmed visit to Pending.
    - Structural edits (Place, Time, Title, Visibility) automatically invalidate confirmation and revert `Confirmed → Pending`.
  - Required Issue summary and navigation banner.
  - Preview transition placeholder requiring at least 1 Confirmed + Public visit with usable trajectory.
  - No separate desktop/mobile interaction model.

---

### CP2 — Visit State Persistence
- **Status:** `MACHINE_VERIFIED` / Commit `adcef51`
- **Implementation Result & Repository Evidence:**
  - **Migration Identifier:** [`supabase/migrations/20261018000000_visit_state_schema_cp2.sql`](file:///d:/AI/SynologyDrive/travel/supabase/migrations/20261018000000_visit_state_schema_cp2.sql)
  - **Schema Delta:**
    - Added `review_status text NOT NULL DEFAULT 'pending'` with `CHECK (review_status IN ('pending', 'confirmed'))`.
    - Added `visibility text NOT NULL DEFAULT 'public'` with `CHECK (visibility IN ('public', 'private'))`.
  - **Four-State Independence:**
    - Database supports all 4 independent combinations:
      1. `Pending + Public`
      2. `Pending + Private`
      3. `Confirmed + Public`
      4. `Confirmed + Private`
    - Trip lifecycle (`app.trips.publication_status`: `draft`, `published`, `archived`) remains completely independent.
  - **Legacy `publication_status` Conclusion:**
    - Classified as a **legacy compatibility field, safely deprecatable later, removable only in a future migration**.
    - Retained without dropping to preserve existing public-reader RLS policies (`public_reader_published_visits`, `public_reader_places_with_public_visit`, `public_reader_published_visit_media`) and view definitions (`api_public.public_trip_visits`, `api_public.public_visit_media`).
  - **One-Time Compatibility Backfill:**
    - Existing visits with `publication_status = 'published'` mapped to `visibility = 'public'`.
    - Non-published visits (`draft`, `archived`) mapped to `visibility = 'private'`.
    - All existing visits received `review_status = 'pending'`.
  - **CMS View Exposure:**
    - Recreated `api_cms.cms_visits` with `security_invoker = true, security_barrier = true` to project the new columns to authenticated CMS users.
  - **Verification Evidence:**
    - Static migration DDL tests: `Test-VisitStateSchemaCp2MigrationSource.ps1` (PASS).
    - Runtime verification PL/pgSQL: `20261018000001_visit_state_cp2_verification.sql`.
    - Node test suite: `portal-web/src/lib/cms-schema-cp2.test.cjs` (5/5 PASS).
    - Total test suite: 39/39 passing (`npm test`).
    - TypeScript: 0 errors (`npx tsc --noEmit`).
    - Security scan: 0 tracked credentials (`npm run qa:secret-scan`).
    - Secret boundary test: 6/6 PASS (`npm run qa:secret-boundary-test`).
    - Public playback regression: 35 visits, 34 movements, monotonic projections (`npm run qa:public-playback`).
  - **Known Deferred Cleanup:**
    - Drop legacy `publication_status` column in a future major schema migration once all views and RLS policies transition to `visibility`.

---

## 3. Active Work

### CP3 — Reconstruction Ingestion Integration
- **Status:** `MACHINE_VERIFIED` (Commit `a7dc704`)
- **Mission:** Connect the validated offline reconstruction pipeline to real CMS trusted database persistence (`app.trips`, `app.places`, `app.visits`, `app.trajectories`, `app.trajectory_source_records`, `app.trajectory_samples`).
- **Implementation Result & Repository Evidence:**
  - Persisted Japanese Golden Trip (`japan-2026-summer`):
    - 1 Draft Trip created (`starts_on: 2026-08-14`, `ends_on: 2026-08-20`)
    - 25 Places created with verified geography points
    - 29 Candidate Visits created (`review_status = 'pending'`, `visibility = 'public'`)
    - 1 Trajectory created (`publication_status = 'draft'`)
    - 105 Trajectory source records and 373 trajectory samples persisted
  - Pipeline modules: `portal-web/src/lib/cms/reconstruction.ts`, `portal-web/src/lib/cms/persist-ingestion.ts`, `portal-web/scripts/cms-ingest-timeline.mjs`.

---

### CP4 — Live Review Persistence & First Cruise Preview Integration
- **Status:** `MACHINE_VERIFIED` / `READY_FOR_PRODUCT_OWNER_ACCEPTANCE`
- **Implementation Result & Repository Evidence:**
  - **Migration Identifier:** [`supabase/migrations/20261018000001_cms_editing_and_preview_cp4.sql`](file:///d:/AI/SynologyDrive/travel/supabase/migrations/20261018000001_cms_editing_and_preview_cp4.sql)
  - **Database Invalidation Trigger:**
    - `app.trg_visits_structural_edit_reset_review_status`: automatically reverts any confirmed visit to `pending` upon structural edits (Title, Time, Place, Visibility, Presentation Category).
  - **CMS Mutation RPCs in `api_cms`:**
    - `api_cms.confirm_cms_visit(p_visit_id uuid)`
    - `api_cms.undo_cms_visit(p_visit_id uuid)`
    - `api_cms.update_cms_visit(p_visit_id uuid, p_title, p_occurred_at, p_place_id, p_visibility, p_presentation_category)`
    - `api_cms.add_cms_visit(p_trip_id uuid, p_place_id uuid, p_title, p_occurred_at, p_visibility, p_presentation_category)`
    - `api_cms.create_cms_place(p_canonical_name, p_longitude, p_latitude)`
  - **Draft Cruise Preview RPCs in `api_cms`:**
    - `api_cms.get_draft_preview_visits(p_trip_slug text)`: strictly filters `v.review_status = 'confirmed' AND v.visibility = 'public'`. Excludes pending and private.
    - `api_cms.get_draft_preview_trajectory(p_trip_slug text)`: delivers GeoJSON LineString segments symmetric to reader contract.
  - **Frontend Integration:**
    - `portal-web/src/lib/cms/cms-api.ts`: API client abstraction with offline fallback.
    - `portal-web/src/app/cms/preview/[tripSlug]/page.tsx`: Fullscreen cruise preview route with reader player and floating "Back to CMS" button.
    - `portal-web/src/components/cms/CMSWorkspace.tsx`: URL search param synchronization (`day`, `selectedVisit`), async RPC persistence wiring.
    - `portal-web/src/components/cms/VisitDetail.tsx`: In-trip place candidate dropdown for instant place correction without external paid API.
    - `portal-web/src/components/cms/PreviewModal.tsx`: Launch link to `/cms/preview/[tripSlug]`.
  - **Verification Evidence:**
    - PowerShell DDL tests: `supabase/tests/Test-CmsEditingAndPreviewCp4MigrationSource.ps1` (PASS).
    - Automated test suite: `portal-web/src/lib/cms-editing-preview.test.cjs` (3/3 PASS, including live DB transaction tests).
    - Full test suite: 51/51 tests passing (`npm test`).
    - TypeScript: 0 errors (`npx tsc --noEmit`).
    - Security scan: 0 tracked credentials (`npm run qa:secret-scan`).
    - Secret boundary test: 6/6 PASS (`npm run qa:secret-boundary-test`).
    - Public playback regression: 35 visits, 34 movements (100% untouched).

---

## 3. Active Work

### CP5 — End-to-End Pipeline & Golden Trip Product Owner Walkthrough
- **Status:** Pending Product Owner Acceptance of CP4
- **Mission:** Execute complete real-world walkthrough with Product Owner on Golden Trip, verify user experience pacing, and solidify Gate C regression baseline.
