# Supabase migrations

`migrations/20260925000000_schema_v1.sql` is the reviewed Schema v1 database
migration. It is transactional and creates no Trip, Place, Visit, media, raw
Timeline, or GPS sample data.

Before applying it, use an isolated database and confirm that Supabase exposes
only `api_public` and `api_cms` through PostgREST. Do not expose `app` or
`app_private`. The migration creates `app_importer` as `LOGIN NOBYPASSRLS`; its
credential provisioning is deliberately an environment operation, not part of
the migration.

The two cross-row integrity trigger functions are `SECURITY DEFINER` functions
owned by `app_integrity_executor`, a `NOLOGIN NOINHERIT NOBYPASSRLS` role. That
role receives only the column reads and lock-only column UPDATE grants needed
by `FOR UPDATE` / `FOR KEY SHARE`. FORCE RLS policies expose rows for those
reads and locks while `WITH CHECK (false)` prevents the owner role from using
its lock capability to commit table updates. CMS Editor and Importer grants are
not broadened by this mechanism.

The Importer has column-level trajectory reads, including
`publication_status`, because its source/sample RLS predicates query the parent
trajectory and must prove that it is still `draft`. The trajectory SELECT
policy hides non-draft rows, and the role has no status write privilege. It
also has `USAGE` (not `CREATE`) on `extensions` so schema-qualified PostGIS
constructors and the `geography` sample path can execute.

Run `tests/Test-SchemaV1MigrationSource.ps1` before applying the migration. It
guards the correlated outer-column qualification required by the public Place
RLS policy, finalizes public object ACLs before ownership transfer, checks the
bounded PostgreSQL 17 ownership-transfer privilege window, and requires the
restricted public reader and Importer PostGIS schema dependencies. It also
rejects table-level trajectory SELECT for the Importer.

After a successful apply, run `tests/20260925000000_schema_v1_static.sql` and
the role/session cases in `docs/SECURITY_VERIFICATION_MATRIX.md`. If any
security test fails, roll back the transaction when possible; otherwise revoke
`anon`/`authenticated` access to `api_public` before remediation.

The catalog assertions verify integrity function owner/security mode/search
path/EXECUTE ACLs, function-to-trigger wiring, the executor's exact column
privileges and RLS policies, removal of its temporary ownership-transfer
capabilities, the Importer's exact parent-read/PostGIS contract, and the
continued absence of authenticated raw-table UPDATE.

Run `tests/20260925000007_role_branch_verification.sql` with `ON_ERROR_STOP`
as the migration runner. It uses top-level `SET LOCAL ROLE` statements and a
rolled-back test-only PostgreSQL 17 SET grant to exercise valid CMS redaction
INSERT/UPDATE plus Importer source/sample INSERT/UPDATE/DELETE and sample
parent reassignment. The Importer sample INSERT deliberately invokes
schema-qualified PostGIS constructors. It must end with
`role branch verification: PASS` and
leaves no fixtures or role membership behind.

`tests/20260925000006_concurrency_lock_check.sql` only confirms that the
technical-write trigger acquires a lock in one session. It is not proof that a
concurrent publisher blocks. Before sign-off, use two independent connections
against an isolated test database and an existing draft trajectory:

1. Session A begins a transaction, assumes `app_importer`, inserts or updates a
   technical child row, and leaves the transaction open after the trigger has
   locked the parent trajectory.
2. Session B begins a transaction as an authenticated CMS Editor, sets the
   controlled `app_metadata.cms_role=editor` claim, sets a short `lock_timeout`,
   and attempts to change that same trajectory from `draft` to `published`.
3. Session B must block and then report lock timeout while Session A remains
   open. Roll back Session B, then Session A, and confirm no test data or
   temporary test membership remains.

Do not use a manually patched hosted database as final evidence. Final runtime
verification must start from a clean migration-only state.
