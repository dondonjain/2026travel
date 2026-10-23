# Repository Secret Boundary

Status: implemented repository/interface boundary; not OS-level isolation.

## Capability tiers and approved commands

| Command | Tier | Purpose | Required environment variable names |
| --- | --- | --- | --- |
| `npm run qa:public-playback` | 0 | Aggregate public Narrative Playback verification | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `npm run qa:db-smoke` | 1 | QA database connectivity inside a read-only transaction | `QA_DATABASE_READ_URL` |
| `npm run qa:fixture-verify` | 1 | Aggregate `japan-2026` entity, sample, redaction, and dwell counts | `QA_DATABASE_READ_URL` |
| `npm run qa:import-fixture` | 2 | Controlled rebuild of only the `japan-2026` QA fixture | `QA_DATABASE_WRITE_URL` |
| `npm run qa:secret-scan` | local | Sanitized scan of tracked files for obvious credential literals | none |
| `npm run qa:secret-boundary-test` | local | Negative tests for loading, redaction, scanning, and policy | none |
| `npm run qa:poi-local` | local | Disposable in-memory PostgreSQL/PostGIS migrations, resolution guards, RLS and importer verification; see `POI_RESOLUTION.md` for temporary runtime setup | none |

Run these commands from `portal-web`. The wrapper loads only the named values from the caller environment, the repository-root ignored `.env.test.local`, or `portal-web/.env.local`. Missing configuration reports the variable name only. Values must never be supplied as positional arguments.

`SUPABASE_ACCESS_TOKEN`, project-management credentials, service-role keys, password reset/rotation operations, and Supabase Management API access are Tier 3. No normal QA command consumes or requires them.

## Current flow inventory

- The application runtime and public playback verifier consume only public Supabase configuration (Tier 0).
- Database smoke and fixture-count verification consume a separately named QA read connection (Tier 1) and explicitly begin a read-only transaction.
- The fixed-fixture importer consumes a separately named QA write connection (Tier 2). Its target remains hard-coded to `japan-2026`.
- Previous ad-hoc workflows accepted a complete database URL through `SUPABASE_DATABASE_URL` or locally named test variables and allowed arbitrary inline commands to expose driver errors. The approved commands replace that interface; they do not authorize those ad-hoc flows.

Known legacy/local QA names from that workflow are `TEST_API_URL`, `TEST_PUBLISHABLE_KEY`, `TEST_PROJECT_REF`, `TEST_DB_CONNECTION_STRING`, `TEST_DB_PASSWORD`, `SUPABASE_DATABASE_URL`, and `SUPABASE_ACCESS_TOKEN`. The first two are Tier 0. The combined database/password names were used for Tier 1/2 ad-hoc access and are replaced by the separate approved read/write names above. `SUPABASE_ACCESS_TOKEN` and Management API use are Tier 3; no approved normal-QA command consumes them.

## Boundary strength and limitation

The policy boundary forbids direct secret inspection and ordinary Tier-3 use. The repository/interface boundary centralizes configuration loading, selects only required names, removes credential arguments, sanitizes failures, and limits normal operations to named commands.

This is not OS/process-level isolation. An agent or process running as the same OS user with unrestricted filesystem access can still technically read ignored local files or bypass these wrappers. True technical denial requires a separate OS identity, CI-only credentials, an external secret manager/broker, or equivalent filesystem/process sandboxing. That is a separate hardening decision.

The database schema has no dedicated LOGIN verifier role. `app_public_reader` is intentionally `NOLOGIN`; CMS and importer roles have different capabilities. Tier-1 wrappers enforce read-only transactions, but credential-level least privilege depends on the human-provisioned `QA_DATABASE_READ_URL`. Creating a dedicated login/role would require a migration and security decision and is outside this task.

## Sanitized diagnostics

Failures may retain the command label, non-secret error category/code, HTTP status, fixture slug, and aggregate counts. PostgreSQL URLs, known loaded values, Supabase PAT/secret-key forms, JWT-looking auth tokens, and explicit password parameters/assignments are replaced with redaction markers. Stack traces and complete connection strings are not printed by approved wrappers.
