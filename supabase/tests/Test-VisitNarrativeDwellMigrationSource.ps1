$ErrorActionPreference = 'Stop'

$migrationPath = Join-Path $PSScriptRoot '..\migrations\20260927000000_visit_narrative_dwell.sql'
$sql = Get-Content -Raw -LiteralPath $migrationPath

foreach ($required in @(
    'ADD COLUMN narrative_dwell_ms integer NOT NULL DEFAULT 4000;',
    'CHECK (narrative_dwell_ms IN (1500, 2000, 2800, 4000, 5000, 6500, 8000));',
    'v.narrative_dwell_ms',
    'GRANT app_public_reader TO CURRENT_USER WITH SET TRUE, INHERIT FALSE;',
    'GRANT CREATE ON SCHEMA api_public TO app_public_reader;',
    'REVOKE CREATE ON SCHEMA api_public FROM app_public_reader;',
    'REVOKE app_public_reader FROM CURRENT_USER GRANTED BY CURRENT_USER;'
)) {
    if ($sql.IndexOf($required) -lt 0) {
        throw "Missing narrative dwell migration contract: $required"
    }
}

$viewStart = $sql.IndexOf('CREATE OR REPLACE VIEW api_public.public_trip_visits')
$viewEnd = $sql.IndexOf('RESET ROLE;', $viewStart)
if ($viewStart -lt 0 -or $viewEnd -lt 0) {
    throw 'Missing public Visit view replacement or role reset.'
}

$viewSql = $sql.Substring($viewStart, $viewEnd - $viewStart)
if ($viewSql -match '(?i)\b(started_at|ended_at|trajectory_source_records|trajectory_samples)\b') {
    throw 'The public Visit view must not expose or query private duration/source fields.'
}

$setGrant = $sql.IndexOf('GRANT app_public_reader TO CURRENT_USER WITH SET TRUE, INHERIT FALSE;')
$schemaGrant = $sql.IndexOf('GRANT CREATE ON SCHEMA api_public TO app_public_reader;')
$viewReplace = $viewStart
$schemaRevoke = $sql.IndexOf('REVOKE CREATE ON SCHEMA api_public FROM app_public_reader;')
$membershipRevoke = $sql.IndexOf('REVOKE app_public_reader FROM CURRENT_USER GRANTED BY CURRENT_USER;')

if ($setGrant -gt $viewReplace -or $schemaGrant -gt $viewReplace -or
    $schemaRevoke -lt $viewReplace -or $membershipRevoke -lt $viewReplace) {
    throw 'PostgreSQL 17 public-view ownership prerequisites must be bounded around the replacement.'
}

if ($sql -match '(?im)^\s*REVOKE\s+app_public_reader\s+FROM\s+CURRENT_USER\s*;') {
    throw 'Temporary SET capability must use a grantor-specific revoke.'
}

Write-Output 'Visit narrative dwell migration source checks: PASS'
