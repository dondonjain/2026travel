$ErrorActionPreference = 'Stop'

$migrationPath = Join-Path $PSScriptRoot '..\migrations\20261018000001_cms_editing_and_preview_cp4.sql'
if (-not (Test-Path -LiteralPath $migrationPath)) {
    throw "Migration file not found: $migrationPath"
}

$sql = Get-Content -Raw -LiteralPath $migrationPath

# 1. Transaction boundary checks
if ($sql.IndexOf('BEGIN;') -lt 0 -or $sql.IndexOf('COMMIT;') -lt 0) {
    throw 'Migration must be wrapped in a transaction block (BEGIN / COMMIT).'
}

# 2. Required schema statements & functions
foreach ($required in @(
    'CREATE OR REPLACE FUNCTION app.fn_visits_structural_edit_reset_review_status()',
    'CREATE TRIGGER trg_visits_structural_edit_reset_review_status',
    'CREATE OR REPLACE FUNCTION api_cms.confirm_cms_visit(p_visit_id uuid)',
    'CREATE OR REPLACE FUNCTION api_cms.undo_cms_visit(p_visit_id uuid)',
    'CREATE OR REPLACE FUNCTION api_cms.update_cms_visit(',
    'CREATE OR REPLACE FUNCTION api_cms.add_cms_visit(',
    'CREATE OR REPLACE FUNCTION api_cms.create_cms_place(',
    'CREATE OR REPLACE FUNCTION api_cms.get_draft_preview_visits(p_trip_slug text)',
    'CREATE OR REPLACE FUNCTION api_cms.get_draft_preview_trajectory(p_trip_slug text)',
    'GRANT USAGE ON SCHEMA api_cms TO authenticated, anon;',
    'GRANT EXECUTE ON FUNCTION api_cms.confirm_cms_visit(uuid) TO authenticated, anon;',
    'GRANT EXECUTE ON FUNCTION api_cms.get_draft_preview_visits(text) TO authenticated, anon;',
    'GRANT EXECUTE ON FUNCTION api_cms.get_draft_preview_trajectory(text) TO authenticated, anon;'
)) {
    if ($sql.IndexOf($required) -lt 0) {
        throw "Missing CP4 migration contract: $required"
    }
}

# 3. Security check: api_public must remain untouched
if ($sql -match '(?i)CREATE\s+(OR\s+REPLACE\s+)?(FUNCTION|VIEW)\s+api_public\b') {
    throw 'CP4 migration must NOT add or alter api_public schema.'
}

# 4. Preview filtering check: Must filter confirmed and public
if ($sql.IndexOf("v.review_status = 'confirmed'") -lt 0 -or $sql.IndexOf("v.visibility = 'public'") -lt 0) {
    throw 'Draft preview must filter by review_status = confirmed and visibility = public.'
}

Write-Output 'CMS CP4 editing and preview migration source checks: PASS'
