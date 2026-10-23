-- Post-migration catalog assertions for 20260925000000_schema_v1.sql.
-- Run with psql against an isolated local/Supabase test database after the
-- migration. Every query must return zero rows.

-- 1. All eight base tables exist in app and have RLS forced.
WITH expected(relname) AS (
  VALUES
    ('trips'), ('places'), ('visits'), ('visit_media'), ('trajectories'),
    ('trajectory_source_records'), ('trajectory_samples'), ('trajectory_redactions')
)
SELECT 'missing_or_unforced_rls:' || expected.relname AS failure
FROM expected
LEFT JOIN pg_namespace n ON n.nspname = 'app'
LEFT JOIN pg_class c
  ON c.relnamespace = n.oid
 AND c.relname = expected.relname
 AND c.relkind IN ('r', 'p')
WHERE c.oid IS NULL OR NOT c.relrowsecurity OR NOT c.relforcerowsecurity;

-- 2. anon has neither app schema usage nor base-table privileges.
SELECT 'anon_has_app_usage' AS failure
WHERE has_schema_privilege('anon', 'app', 'USAGE')
UNION ALL
SELECT 'anon_has_base_table_privilege:' || c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'app'
  AND c.relkind IN ('r', 'p')
  AND has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE');

-- 3. Public views have the restricted owner and final client SELECT ACLs.
WITH expected(relname) AS (
  VALUES ('public_trips'), ('public_trip_visits'), ('public_visit_media')
)
SELECT 'public_view_owner_or_acl:' || expected.relname AS failure
FROM expected
LEFT JOIN pg_namespace n ON n.nspname = 'api_public'
LEFT JOIN pg_class c
  ON c.relnamespace = n.oid
 AND c.relname = expected.relname
 AND c.relkind = 'v'
WHERE c.oid IS NULL
   OR pg_get_userbyid(c.relowner) <> 'app_public_reader'
   OR has_table_privilege('anon', c.oid, 'SELECT') IS DISTINCT FROM true
   OR has_table_privilege('authenticated', c.oid, 'SELECT') IS DISTINCT FROM true;

-- 4. The public RPC has its exact contract, owner, hardened execution
-- properties, and final EXECUTE ACLs. PUBLIC must not retain its default
-- function EXECUTE privilege.
WITH target AS (
  SELECT p.*
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'api_public'
    AND p.proname = 'get_public_trajectory'
    AND pg_get_function_identity_arguments(p.oid) = 'p_trip_slug text'
)
SELECT 'missing_public_trajectory_rpc' AS failure
WHERE NOT EXISTS (SELECT 1 FROM target)
UNION ALL
SELECT 'public_trajectory_rpc_wrong_result'
FROM target
WHERE pg_get_function_result(oid) <>
  'TABLE(segment_index integer, geometry jsonb, has_hidden_gap_after boolean)'
UNION ALL
SELECT 'public_trajectory_rpc_wrong_owner'
FROM target
WHERE pg_get_userbyid(proowner) <> 'app_public_reader'
UNION ALL
SELECT 'public_trajectory_rpc_not_security_definer'
FROM target
WHERE NOT prosecdef
UNION ALL
SELECT 'public_trajectory_rpc_search_path_not_empty'
FROM target
WHERE NOT EXISTS (
  SELECT 1
  FROM unnest(coalesce(proconfig, ARRAY[]::text[])) AS setting
  WHERE setting ~ '^search_path=(|"")$'
)
UNION ALL
SELECT 'public_retains_public_trajectory_execute'
FROM target
WHERE EXISTS (
  SELECT 1
  FROM aclexplode(coalesce(proacl, acldefault('f', proowner))) AS acl
  WHERE acl.grantee = 0
    AND acl.privilege_type = 'EXECUTE'
)
UNION ALL
SELECT 'anon_missing_public_trajectory_execute'
FROM target
WHERE has_function_privilege('anon', oid, 'EXECUTE') IS DISTINCT FROM true
UNION ALL
SELECT 'authenticated_missing_public_trajectory_execute'
FROM target
WHERE has_function_privilege('authenticated', oid, 'EXECUTE') IS DISTINCT FROM true;

-- 5. Importer has the exact parent-read and PostGIS schema capabilities needed
-- by its child-table RLS predicates and sample ingestion, without table-wide
-- trajectory visibility, extension CREATE, publication writes, or curated
-- writes.
SELECT 'importer_missing_trajectory_read_contract' AS failure
WHERE has_column_privilege('app_importer', 'app.trajectories', 'id', 'SELECT') IS DISTINCT FROM true
   OR has_column_privilege('app_importer', 'app.trajectories', 'trip_id', 'SELECT') IS DISTINCT FROM true
   OR has_column_privilege('app_importer', 'app.trajectories', 'publication_status', 'SELECT') IS DISTINCT FROM true
   OR has_column_privilege('app_importer', 'app.trajectories', 'source_started_at', 'SELECT') IS DISTINCT FROM true
   OR has_column_privilege('app_importer', 'app.trajectories', 'source_ended_at', 'SELECT') IS DISTINCT FROM true
UNION ALL
SELECT 'importer_has_extra_trajectory_select:' || columns.column_name
FROM information_schema.columns columns
WHERE columns.table_schema = 'app'
  AND columns.table_name = 'trajectories'
  AND columns.column_name NOT IN (
    'id', 'trip_id', 'publication_status', 'source_started_at', 'source_ended_at'
  )
  AND has_column_privilege(
    'app_importer',
    'app.trajectories',
    columns.column_name,
    'SELECT'
  )
UNION ALL
SELECT 'importer_missing_extensions_usage'
WHERE has_schema_privilege('app_importer', 'extensions', 'USAGE') IS DISTINCT FROM true
UNION ALL
SELECT 'importer_has_extensions_create'
WHERE has_schema_privilege('app_importer', 'extensions', 'CREATE')
UNION ALL
SELECT 'importer_missing_technical_table_privilege:' || technical.table_name || ':' || technical.privilege_type
FROM (
  SELECT table_name, privilege_type
  FROM (VALUES ('trajectory_source_records'), ('trajectory_samples')) AS tables(table_name)
  CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS privileges(privilege_type)
) AS technical
WHERE has_table_privilege(
  'app_importer',
  format('app.%I', technical.table_name),
  technical.privilege_type
) IS DISTINCT FROM true
UNION ALL
SELECT 'importer_can_update_trajectory_status'
WHERE has_column_privilege('app_importer', 'app.trajectories', 'publication_status', 'UPDATE')
UNION ALL
SELECT 'importer_can_write_curated_table:' || table_name
FROM information_schema.tables
WHERE table_schema = 'app'
  AND table_name IN ('trips', 'places', 'visits', 'visit_media', 'trajectory_redactions')
  AND (
    has_table_privilege('app_importer', format('app.%I', table_name), 'INSERT')
    OR has_table_privilege('app_importer', format('app.%I', table_name), 'UPDATE')
    OR has_table_privilege('app_importer', format('app.%I', table_name), 'DELETE')
  );

-- 6. Integrity trigger functions execute only as the restricted internal
-- owner, with no caller/PUBLIC EXECUTE exposure and an exactly empty
-- search_path.
WITH expected(proname) AS (
  VALUES ('validate_redaction_range'), ('guard_technical_write')
)
SELECT 'integrity_function_contract:' || expected.proname AS failure
FROM expected
LEFT JOIN pg_namespace n ON n.nspname = 'app_private'
LEFT JOIN pg_proc p
  ON p.pronamespace = n.oid
 AND p.proname = expected.proname
 AND p.pronargs = 0
WHERE p.oid IS NULL
   OR pg_get_userbyid(p.proowner) <> 'app_integrity_executor'
   OR NOT p.prosecdef
   OR NOT EXISTS (
     SELECT 1
     FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS setting
     WHERE setting ~ '^search_path=(|"")$'
   )
   OR EXISTS (
     SELECT 1
     FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) AS acl
     WHERE acl.grantee = 0
       AND acl.privilege_type = 'EXECUTE'
   )
   OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
   OR has_function_privilege('app_importer', p.oid, 'EXECUTE');

-- 7. The integrity owner is non-assumable after migration and has only the
-- column privileges needed to read validation inputs and acquire row locks.
SELECT 'app_integrity_executor_role_attributes' AS failure
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_roles
  WHERE rolname = 'app_integrity_executor'
    AND NOT rolcanlogin
    AND NOT rolinherit
    AND NOT rolbypassrls
)
UNION ALL
SELECT 'app_integrity_executor_missing_app_usage'
WHERE has_schema_privilege('app_integrity_executor', 'app', 'USAGE') IS DISTINCT FROM true
UNION ALL
SELECT 'app_integrity_executor_retains_app_private_create'
WHERE has_schema_privilege('app_integrity_executor', 'app_private', 'CREATE')
UNION ALL
SELECT 'migration_runner_retains_integrity_executor_access'
FROM pg_auth_members membership
JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
JOIN pg_roles member_role ON member_role.oid = membership.member
WHERE granted_role.rolname = 'app_integrity_executor'
  AND member_role.rolname = current_user
  AND (membership.set_option OR membership.inherit_option)
UNION ALL
SELECT 'integrity_executor_missing_required_column_privilege'
WHERE has_column_privilege('app_integrity_executor', 'app.trajectories', 'id', 'SELECT') IS DISTINCT FROM true
   OR has_column_privilege('app_integrity_executor', 'app.trajectories', 'publication_status', 'SELECT') IS DISTINCT FROM true
   OR has_column_privilege('app_integrity_executor', 'app.trajectories', 'id', 'UPDATE') IS DISTINCT FROM true
   OR has_column_privilege('app_integrity_executor', 'app.trajectory_samples', 'id', 'SELECT') IS DISTINCT FROM true
   OR has_column_privilege('app_integrity_executor', 'app.trajectory_samples', 'trajectory_id', 'SELECT') IS DISTINCT FROM true
   OR has_column_privilege('app_integrity_executor', 'app.trajectory_samples', 'sequence_no', 'SELECT') IS DISTINCT FROM true
   OR has_column_privilege('app_integrity_executor', 'app.trajectory_samples', 'id', 'UPDATE') IS DISTINCT FROM true
   OR has_column_privilege('app_integrity_executor', 'app.trajectory_redactions', 'start_sample_id', 'SELECT') IS DISTINCT FROM true
   OR has_column_privilege('app_integrity_executor', 'app.trajectory_redactions', 'end_sample_id', 'SELECT') IS DISTINCT FROM true
UNION ALL
SELECT 'integrity_executor_has_table_write_privilege'
WHERE has_table_privilege(
  'app_integrity_executor',
  'app.trajectories',
  'INSERT,UPDATE,DELETE,TRUNCATE'
)
   OR has_table_privilege(
     'app_integrity_executor',
     'app.trajectory_samples',
     'INSERT,UPDATE,DELETE,TRUNCATE'
   )
   OR has_table_privilege(
     'app_integrity_executor',
     'app.trajectory_redactions',
     'INSERT,UPDATE,DELETE,TRUNCATE'
   );

-- 8. No extra SELECT/UPDATE column grants escape the integrity contract.
WITH allowed(table_name, column_name, privilege_type) AS (
  VALUES
    ('trajectories', 'id', 'SELECT'),
    ('trajectories', 'publication_status', 'SELECT'),
    ('trajectories', 'id', 'UPDATE'),
    ('trajectory_samples', 'id', 'SELECT'),
    ('trajectory_samples', 'trajectory_id', 'SELECT'),
    ('trajectory_samples', 'sequence_no', 'SELECT'),
    ('trajectory_samples', 'id', 'UPDATE'),
    ('trajectory_redactions', 'start_sample_id', 'SELECT'),
    ('trajectory_redactions', 'end_sample_id', 'SELECT')
), candidates AS (
  SELECT c.table_name, c.column_name, privilege_type
  FROM information_schema.columns c
  CROSS JOIN (VALUES ('SELECT'), ('UPDATE')) AS privileges(privilege_type)
  WHERE c.table_schema = 'app'
    AND c.table_name IN ('trajectories', 'trajectory_samples', 'trajectory_redactions')
)
SELECT 'integrity_executor_extra_column_privilege:' || candidates.table_name || '.' ||
  candidates.column_name || ':' || candidates.privilege_type AS failure
FROM candidates
LEFT JOIN allowed USING (table_name, column_name, privilege_type)
WHERE allowed.table_name IS NULL
  AND has_column_privilege(
    'app_integrity_executor',
    format('app.%I', candidates.table_name),
    candidates.column_name,
    candidates.privilege_type
  );

-- 9. FORCE RLS gives the integrity owner read/lock access, while WITH CHECK
-- false prevents direct writes through its lock-only UPDATE grants.
WITH expected(table_name, policy_name, command_name, expected_qual, expected_check) AS (
  VALUES
    ('trajectories', 'integrity_executor_select_trajectories', 'SELECT', 'true', NULL),
    ('trajectories', 'integrity_executor_lock_trajectories', 'UPDATE', 'true', 'false'),
    ('trajectory_samples', 'integrity_executor_select_samples', 'SELECT', 'true', NULL),
    ('trajectory_samples', 'integrity_executor_lock_samples', 'UPDATE', 'true', 'false'),
    ('trajectory_redactions', 'integrity_executor_select_redactions', 'SELECT', 'true', NULL)
)
SELECT 'integrity_executor_policy_contract:' || expected.policy_name AS failure
FROM expected
LEFT JOIN pg_policies policy
  ON policy.schemaname = 'app'
 AND policy.tablename = expected.table_name
 AND policy.policyname = expected.policy_name
WHERE policy.policyname IS NULL
   OR NOT ('app_integrity_executor' = ANY (policy.roles))
   OR policy.cmd <> expected.command_name
   OR policy.qual IS DISTINCT FROM expected.expected_qual
   OR policy.with_check IS DISTINCT FROM expected.expected_check;

-- 10. The three integrity triggers remain enabled and wired to the hardened
-- functions owned by app_integrity_executor.
WITH expected(trigger_name, table_name, function_name) AS (
  VALUES
    ('trajectory_redactions_validate_range', 'trajectory_redactions', 'validate_redaction_range'),
    ('trajectory_source_records_guard_draft_parent', 'trajectory_source_records', 'guard_technical_write'),
    ('trajectory_samples_guard_draft_parent', 'trajectory_samples', 'guard_technical_write')
)
SELECT 'integrity_trigger_wiring:' || expected.trigger_name AS failure
FROM expected
LEFT JOIN pg_namespace table_namespace ON table_namespace.nspname = 'app'
LEFT JOIN pg_class table_class
  ON table_class.relnamespace = table_namespace.oid
 AND table_class.relname = expected.table_name
LEFT JOIN pg_trigger trigger_object
  ON trigger_object.tgrelid = table_class.oid
 AND trigger_object.tgname = expected.trigger_name
 AND NOT trigger_object.tgisinternal
LEFT JOIN pg_proc function_object ON function_object.oid = trigger_object.tgfoid
LEFT JOIN pg_namespace function_namespace ON function_namespace.oid = function_object.pronamespace
WHERE trigger_object.oid IS NULL
   OR trigger_object.tgenabled = 'D'
   OR function_namespace.nspname <> 'app_private'
   OR function_object.proname <> expected.function_name
   OR pg_get_userbyid(function_object.proowner) <> 'app_integrity_executor';

-- 11. CMS authenticated retains raw SELECT only; the trigger fix must not add
-- UPDATE on any raw source/sample column.
SELECT 'authenticated_has_raw_update:' || columns.table_name || '.' || columns.column_name AS failure
FROM information_schema.columns columns
WHERE columns.table_schema = 'app'
  AND columns.table_name IN ('trajectory_source_records', 'trajectory_samples')
  AND has_column_privilege(
    'authenticated',
    format('app.%I', columns.table_name),
    columns.column_name,
    'UPDATE'
  );

-- 12. The restricted reader has exactly the platform capabilities needed at
-- runtime, without retaining ownership-transfer capabilities.
SELECT 'app_public_reader_role_attributes' AS failure
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_roles
  WHERE rolname = 'app_public_reader'
    AND NOT rolcanlogin
    AND NOT rolinherit
    AND NOT rolbypassrls
)
UNION ALL
SELECT 'app_public_reader_missing_extensions_usage'
WHERE has_schema_privilege('app_public_reader', 'extensions', 'USAGE') IS DISTINCT FROM true
UNION ALL
SELECT 'app_public_reader_retains_api_public_create'
WHERE has_schema_privilege('app_public_reader', 'api_public', 'CREATE')
UNION ALL
SELECT 'migration_runner_retains_app_public_reader_access'
FROM pg_auth_members membership
JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
JOIN pg_roles member_role ON member_role.oid = membership.member
WHERE granted_role.rolname = 'app_public_reader'
  AND member_role.rolname = current_user
  AND (membership.set_option OR membership.inherit_option)
UNION ALL
SELECT 'migration_runner_lost_app_public_reader_admin'
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_auth_members membership
  JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
  JOIN pg_roles member_role ON member_role.oid = membership.member
  WHERE granted_role.rolname = 'app_public_reader'
    AND member_role.rolname = current_user
    AND membership.admin_option
);
