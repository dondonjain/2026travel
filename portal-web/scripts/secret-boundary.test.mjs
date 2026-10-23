import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'fs';
import path from 'path';
import test from 'node:test';
import { fileURLToPath } from 'url';
import {
  loadCapabilityEnvironment,
  sanitizeDiagnostic
} from './lib/secret-boundary.mjs';
import { scanText } from './lib/secret-scan.mjs';

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(portalRoot, '..');

test('missing configuration reports the variable name only', () => {
  assert.throws(
    () => loadCapabilityEnvironment(['QA_DATABASE_READ_URL'], { environment: {}, files: [] }),
    { message: 'Missing required environment variable: QA_DATABASE_READ_URL' }
  );
});

test('capability loader returns only requested configuration', () => {
  const fakeSecret = ['not', 'a', 'real', 'secret'].join('-');
  const loaded = loadCapabilityEnvironment(['QA_DATABASE_READ_URL'], {
    environment: {
      QA_DATABASE_READ_URL: fakeSecret,
      SUPABASE_ACCESS_TOKEN: 'must-not-be-returned'
    },
    files: []
  });
  assert.deepEqual(Object.keys(loaded), ['QA_DATABASE_READ_URL']);
  assert.equal(loaded.QA_DATABASE_READ_URL, fakeSecret);
});

test('approved wrapper consumes dummy configuration without echoing it', () => {
  const fakeConnection = ['postgresql://qa:', 'wrapper-test-password', '@127.0.0.1:1/test'].join('');
  const result = spawnSync(process.execPath, ['scripts/qa-db-smoke.mjs'], {
    cwd: portalRoot,
    encoding: 'utf8',
    timeout: 5000,
    env: { ...process.env, QA_DATABASE_READ_URL: fakeConnection }
  });
  const output = `${result.stdout}${result.stderr}`;
  assert.equal(result.status, 1);
  assert.equal(output.includes(fakeConnection), false);
  assert.equal(output.includes('wrapper-test-password'), false);
  assert.match(output, /qa:db-smoke: FAIL/);
});

test('diagnostics redact database URLs, tokens, passwords, and known values', () => {
  const databaseUrl = ['postgresql://qa:', 'fake-password', '@db.invalid/test'].join('');
  const personalToken = ['sbp_', 'fakePersonalAccessToken123456'].join('');
  const secretKey = ['sb_secret_', 'fakeServiceKey123456789'].join('');
  const authToken = ['eyJfakeHeader1', 'eyJfakePayload2', 'fakeSignature3'].join('.');
  const diagnostic = sanitizeDiagnostic(
    `connect ${databaseUrl} ${personalToken} ${secretKey} ${authToken} password=fake-password`,
    ['fake-password']
  );
  for (const value of [databaseUrl, personalToken, secretKey, authToken, 'fake-password']) {
    assert.equal(diagnostic.includes(value), false);
  }
  assert.match(diagnostic, /REDACTED/);
});

test('source scanner reports only sanitized metadata for a synthetic violation', () => {
  const fakeCredential = ['postgresql://qa:', ['detected', 'password'].join('-'), '@db.invalid/test'].join('');
  const findings = scanText('synthetic-fixture.txt', `value=${fakeCredential}`);
  assert.deepEqual(findings, [{
    file: 'synthetic-fixture.txt',
    category: 'postgres-credential-url',
    line: 1
  }]);
  assert.equal(JSON.stringify(findings).includes(fakeCredential), false);
});

test('agent policy contains direct-inspection and Tier-3 stop rules', () => {
  const policy = fs.readFileSync(path.join(repositoryRoot, 'AGENTS.md'), 'utf8');
  assert.match(policy, /MUST NOT inspect secret-bearing environment files/);
  assert.match(policy, /unapproved Tier 3 capability/);
  assert.match(policy, /STOP and request the bounded human\/admin action/);
});
