$ErrorActionPreference = 'Stop'

$migrationPath = Join-Path $PSScriptRoot '..\migrations\20260925000000_schema_v1.sql'
$sql = Get-Content -Raw -LiteralPath $migrationPath

if ($sql -match '(?im)\bWHERE\s+v\.place_id\s*=\s*id\b') {
    throw 'Ambiguous correlated id reference found in the public Place RLS policy.'
}

if ($sql -notmatch '(?im)\bWHERE\s+v\.place_id\s*=\s*app\.places\.id\b') {
    throw 'The public Place RLS policy must qualify its outer app.places.id reference.'
}

foreach ($functionName in @('validate_redaction_range', 'guard_technical_write')) {
    $signature = "CREATE FUNCTION app_private.$functionName()"
    $functionStart = $sql.IndexOf($signature)
    $functionEnd = if ($functionStart -ge 0) { $sql.IndexOf('$$;', $functionStart) } else { -1 }
    if ($functionStart -lt 0 -or $functionEnd -lt 0) {
        throw "Missing integrity trigger function: $functionName"
    }
    $functionBlock = $sql.Substring($functionStart, $functionEnd - $functionStart)
    if ($functionBlock -notmatch '(?is)SECURITY\s+DEFINER' -or
        $functionBlock -notmatch "(?is)SET\s+search_path\s*=\s*''") {
        throw "Integrity trigger function must be SECURITY DEFINER with an empty search_path: $functionName"
    }
}

if ($sql -notmatch '(?im)^\s*CREATE\s+ROLE\s+app_integrity_executor\s+NOLOGIN\s+NOINHERIT\s+NOBYPASSRLS\s*;') {
    throw 'The integrity trigger owner must be a NOLOGIN NOINHERIT NOBYPASSRLS role.'
}

$setGrant = $sql.IndexOf('GRANT app_public_reader TO CURRENT_USER WITH SET TRUE, INHERIT FALSE;')
$schemaCreateGrant = $sql.IndexOf('GRANT CREATE ON SCHEMA api_public TO app_public_reader;')
$schemaCreateRevoke = $sql.IndexOf('REVOKE CREATE ON SCHEMA api_public FROM app_public_reader;')
$temporaryMembershipRevoke = $sql.IndexOf('REVOKE app_public_reader FROM CURRENT_USER GRANTED BY CURRENT_USER;')
$extensionsUsageGrant = $sql.IndexOf('GRANT USAGE ON SCHEMA extensions TO app_importer, app_public_reader;')
$importerTrajectoryReadGrant = $sql.IndexOf(@'
GRANT SELECT (id, trip_id, publication_status, source_started_at, source_ended_at)
  ON app.trajectories TO app_importer;
'@.Trim())
$integritySetGrant = $sql.IndexOf('GRANT app_integrity_executor TO CURRENT_USER WITH SET TRUE, INHERIT FALSE;')
$integritySchemaCreateGrant = $sql.IndexOf('GRANT CREATE ON SCHEMA app_private TO app_integrity_executor;')
$integritySchemaCreateRevoke = $sql.IndexOf('REVOKE CREATE ON SCHEMA app_private FROM app_integrity_executor;')
$integrityMembershipRevoke = $sql.IndexOf('REVOKE app_integrity_executor FROM CURRENT_USER GRANTED BY CURRENT_USER;')

$publicObjectAclStatements = @(
    'REVOKE ALL ON ALL TABLES IN SCHEMA api_public, api_cms FROM PUBLIC;',
    'REVOKE ALL ON FUNCTION api_public.get_public_trajectory(text) FROM PUBLIC;',
    'GRANT SELECT ON api_public.public_trips, api_public.public_trip_visits,',
    'GRANT EXECUTE ON FUNCTION api_public.get_public_trajectory(text) TO anon, authenticated;'
)

$ownerTransfers = @(
    'ALTER VIEW api_public.public_trips OWNER TO app_public_reader;',
    'ALTER VIEW api_public.public_trip_visits OWNER TO app_public_reader;',
    'ALTER VIEW api_public.public_visit_media OWNER TO app_public_reader;',
    'ALTER FUNCTION api_public.get_public_trajectory(text) OWNER TO app_public_reader;'
)
$ownerTransferPositions = $ownerTransfers | ForEach-Object {
    $position = $sql.IndexOf($_)
    if ($position -lt 0) {
        throw "Missing ownership transfer: $_"
    }
    $position
}

$firstOwnerTransfer = ($ownerTransferPositions | Measure-Object -Minimum).Minimum
$lastOwnerTransfer = ($ownerTransferPositions | Measure-Object -Maximum).Maximum

$publicObjectAclPositions = $publicObjectAclStatements | ForEach-Object {
    $position = $sql.IndexOf($_)
    if ($position -lt 0) {
        throw "Missing public object ACL statement: $_"
    }
    $position
}
$lastPublicObjectAcl = ($publicObjectAclPositions | Measure-Object -Maximum).Maximum

$integrityOwnerTransfers = @(
    'ALTER FUNCTION app_private.validate_redaction_range() OWNER TO app_integrity_executor;',
    'ALTER FUNCTION app_private.guard_technical_write() OWNER TO app_integrity_executor;'
)
$integrityOwnerTransferPositions = $integrityOwnerTransfers | ForEach-Object {
    $position = $sql.IndexOf($_)
    if ($position -lt 0) {
        throw "Missing integrity function ownership transfer: $_"
    }
    $position
}
$firstIntegrityOwnerTransfer = ($integrityOwnerTransferPositions | Measure-Object -Minimum).Minimum
$lastIntegrityOwnerTransfer = ($integrityOwnerTransferPositions | Measure-Object -Maximum).Maximum

if ($setGrant -lt 0 -or $schemaCreateGrant -lt 0 -or
    $setGrant -gt $firstOwnerTransfer -or $schemaCreateGrant -gt $firstOwnerTransfer) {
    throw 'PostgreSQL 17 ownership prerequisites must precede every app_public_reader ownership transfer.'
}

if ($schemaCreateRevoke -lt $lastOwnerTransfer -or $temporaryMembershipRevoke -lt $lastOwnerTransfer) {
    throw 'Temporary ownership-transfer privileges must be removed after every ownership transfer.'
}

if ($lastPublicObjectAcl -gt $firstOwnerTransfer) {
    throw 'Public view/function ACLs must be finalized while the migration runner still owns the objects.'
}

if ($extensionsUsageGrant -lt 0) {
    throw 'Importer and public reader require USAGE on the extensions schema for their PostGIS paths.'
}

if ($importerTrajectoryReadGrant -lt 0) {
    throw 'Importer requires the exact trajectory SELECT columns used by its draft-parent RLS contract.'
}

if ($sql -match '(?im)^\s*GRANT\s+SELECT\s+ON\s+app\.trajectories\s+TO\s+app_importer\s*;') {
    throw 'Importer must not receive table-level SELECT on app.trajectories.'
}

if ($integritySetGrant -lt 0 -or $integritySchemaCreateGrant -lt 0 -or
    $integritySetGrant -gt $firstIntegrityOwnerTransfer -or
    $integritySchemaCreateGrant -gt $firstIntegrityOwnerTransfer) {
    throw 'PostgreSQL 17 ownership prerequisites must precede every integrity function ownership transfer.'
}

if ($integritySchemaCreateRevoke -lt $lastIntegrityOwnerTransfer -or
    $integrityMembershipRevoke -lt $lastIntegrityOwnerTransfer) {
    throw 'Temporary integrity-owner transfer privileges must be removed after every ownership transfer.'
}

foreach ($functionName in @('validate_redaction_range', 'guard_technical_write')) {
    $revokePosition = $sql.IndexOf("REVOKE ALL ON FUNCTION app_private.$functionName() FROM PUBLIC;")
    if ($revokePosition -lt 0 -or $revokePosition -gt $firstIntegrityOwnerTransfer) {
        throw "PUBLIC EXECUTE must be revoked before integrity function ownership transfer: $functionName"
    }
}

if ($sql -match '(?im)^\s*REVOKE\s+app_public_reader\s+FROM\s+CURRENT_USER\s*;') {
    throw 'Do not blanket-revoke membership; target only the CURRENT_USER self-grant.'
}

if ($sql -match '(?im)^\s*REVOKE\s+app_integrity_executor\s+FROM\s+CURRENT_USER\s*;') {
    throw 'Do not blanket-revoke integrity-owner membership; target only the CURRENT_USER self-grant.'
}

Write-Output 'Schema v1 migration source checks: PASS'
