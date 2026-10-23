# POI Resolution Pipeline

Accepted scope: 2026-10-23 user request; nullable Place association, resolution status and minimal CMS migration explicitly approved in the follow-up. No deployment or existing-data rewrite authorized.

## Pipeline and invariant

- `TrajectoryAnalyzer` evaluates consecutive, chronologically sorted timelinePath observations overlapping a Visit. A gap strictly greater than 3 hours **and** separation strictly greater than 250 metres produces two anchors, before and after the gap. It does not invent observations at Visit end or infer an actual hotel. Overnight is a local-calendar-date transition in the supplied timezone (default Asia/Tokyo). Invalid observations are ignored.
- `PoiFetcher` uses Overpass concrete tourism/amenity/shop tags and Mapbox Search Box reverse lookup. Administrative/address results go only into `fallbackAreaContext`. Nearby OSM node/way duplicates merge only with the same normalized name, a shared category, and <=40 m separation; source IDs remain attached. Distinct distant branches are preserved. Overpass query radius is 500 m. Provider failures are reported by provider name, never raw URLs/errors.
- `PoiRankingEngine` uses `exp(-distance/200)` against the nearest search anchor, multiplied by `1 + 0.5` for overnight lodging and `1 + 0.4` for child-Visit restaurant/shop (additive bonuses when both apply). These are explicit heuristic defaults, not probabilities. High-confidence suggestion requires <=100 m, score >=0.6, a >=0.2 lead over second place, and no provider failures. A conflict always overrides confidence.
- Results distinguish `HIGH_CONFIDENCE_SUGGESTED`, `AMBIGUOUS_CANDIDATES`, `NO_CANDIDATES`, `SPATIAL_CONFLICT`, and `SPATIAL_CONFLICT_OVERNIGHT`. Suggestions never constitute human confirmation. Async reconstruction produces transient candidates and no provider-derived Place entities. Sync source reconstruction retains source Place identity for non-conflicted Visits; conflict Visits lose automatic associations.
- Both importer writers store resolution status and use null `place_id` for resolution-bearing Visits. Conflicting flags dominate inconsistent suggestion status. Unreferenced/stale candidate Places are not inserted. The obsolete string-only `resolvedPlacesMap` path was removed to avoid converting context names into Place identity.

## Minimal database/CMS contract

Migration: `supabase/migrations/20261023000000_poi_resolution.sql`.

- `place_id` becomes nullable; existing foreign key remains. `resolution_status` is nullable for legacy rows; there is no backfill.
- A status other than `MANUALLY_CONFIRMED` requires null Place. Manual status requires a non-null Place. Resolution state cannot be cleared to bypass the guard. A null-Place Visit cannot be confirmed by direct writes or existing confirmation RPCs.
- `cms_visits` is refreshed with its existing security-invoker policy. It was already a direct base-table view, not an inner join. New `cms_visit_resolution_review` uses a left join and includes pending/null-Place Visits under existing editor RLS. Public and draft-preview joins remain unchanged and exclude unresolved Visits. No private timestamps/anchors/status fields were added to public APIs.
- `review_cms_visit_place` is an authenticated, security-invoker, editor-claim-checked transaction: choose an accessible verified Place, or create a manually reviewed concrete POI, and mark it `MANUALLY_CONFIRMED` while retaining Visit review status `pending`. A separate Visit confirmation is still required. No grants to anon/PUBLIC. Authenticated receives only extension-schema USAGE needed by existing PostGIS operations, not CREATE or broader data access.
- The CMS panel shows transient POI suggestions and area context, permits explicit Overpass-candidate selection or an existing Place UUID, and refreshes state only after successful save. Mapbox results cannot be persisted by this UI; [Search Box documentation](https://docs.mapbox.com/api/search/search-box/) limits results to temporary use. Provider results are not put in localStorage or the new DB columns.
- The existing app has no editor login/session supplier. The new read/review integration accepts `cmsAccessToken` from a trusted authenticated session owner via CMSClientWrapper/CMSWorkspace; **the current `/cms` page does not supply it**. Without that session the panel explicitly disables saving and the existing fixture/preview flow remains. This change does not introduce login, mint credentials, or grant anonymous access. Full deployed editor UX remains an integration gate.
- Reloaded review rows contain status and Place identity, not stored provider candidates or source observation anchors. New null-Place rows without in-memory source evidence have no invented coordinate. Re-search from source evidence belongs to a future authenticated server-side source lookup; existing-Place UUID review is available through the new contract.

## Verification and reproduction

From repository root, install disposable test tooling (not application dependencies):

```powershell
npm install --prefix scratch/poi-pg-runtime --no-save --package-lock=false --ignore-scripts @electric-sql/pglite@0.5.11 @electric-sql/pglite-postgis@0.2.11
```

From `portal-web`:

```powershell
npm run test:poi
npm run qa:poi-local
npx tsc --noEmit
npm run build -- --webpack
npm run qa:secret-scan
```

`qa:poi-local` creates an in-memory PGlite/PostGIS engine, bootstraps only local Supabase role/auth helpers, runs all five actual migrations, executes rollback-contained SQL tests, and calls the actual importer on the checked-in Timeline fixture. It loads no environment/credential files and has no hosted connection. Verified aggregate: 29 Visits, five spatial conflicts with null Place, zero conflicting links. SQL checks cover constraints, confirmation denial, status-clear denial, editor/non-editor RLS, manual creation under authenticated invoker privileges, and anon ACLs. This is local PostgreSQL/PostGIS evidence, not hosted Supabase/PostgREST verification.

Local application regression, TypeScript, focused lint, server-rendered review panel and webpack build pass. Initial sandbox build failed Google Fonts DNS; the network-enabled build passed. Existing hosted CP4 test remains environment-blocked by DNS; no hosted migration or import was performed. Live provider results, browser interactions, hosted behavior and complete editor-session UX remain UNVERIFIED.

MVP mapping: chronology, playback, privacy-safe geometry and pacing -> unchanged -> MATCH under local regression. Candidate suggestions and null conflict associations -> explicit user-requested change -> APPROVED DIFFERENCE. Actual historical hotel identity -> UNVERIFIED.
