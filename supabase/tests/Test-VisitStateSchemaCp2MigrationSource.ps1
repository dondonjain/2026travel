$ErrorActionPreference = 'Stop'

$migrationPath = Join-Path $PSScriptRoot '..\migrations\20261018000000_visit_state_schema_cp2.sql'
if (-not (Test-Path -LiteralPath $migrationPath)) {
    throw "Migration file not found: $migrationPath"
}

$sql = Get-Content -Raw -LiteralPath $migrationPath

# 1. Transaction boundary checks
if ($sql.IndexOf('BEGIN;') -lt 0 -or $sql.IndexOf('COMMIT;') -lt 0) {
    throw 'Migration must be wrapped in a transaction block (BEGIN / COMMIT).'
}

# 2. Required schema statements
foreach ($required in @(
    'ADD COLUMN review_status text NOT NULL DEFAULT ''pending'';',
    'CHECK (review_status IN (''pending'', ''confirmed''));',
    'ADD COLUMN visibility text NOT NULL DEFAULT ''public'';',
    'CHECK (visibility IN (''public'', ''private''));',
    'UPDATE app.visits',
    'WHEN publication_status = ''published'' THEN ''public''',
    'ELSE ''private''',
    'review_status = ''pending'';',
    'CREATE OR REPLACE VIEW api_cms.cms_visits WITH (security_invoker = true, security_barrier = true) AS',
    'SELECT * FROM app.visits;',
    'GRANT SELECT, INSERT, UPDATE, DELETE ON api_cms.cms_visits TO authenticated;'
)) {
    if ($sql.IndexOf($required) -lt 0) {
        throw "Missing visit state CP2 migration contract: $required"
    }
}

# 3. Legacy column preservation check: MUST NOT drop publication_status
if ($sql -match '(?i)DROP\s+COLUMN\s+publication_status') {
    throw 'CP2 must NOT drop legacy app.visits.publication_status column.'
}

# 4. Prohibited private data exposure
if ($sql -match '(?i)\b(trajectory_source_records|trajectory_samples)\b.*api_public') {
    throw 'Migration must not expose private source records or samples to api_public.'
}

Write-Output 'Visit state CP2 migration source checks: PASS'
