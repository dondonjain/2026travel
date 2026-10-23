import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../../..');
const portalRoot = path.resolve(scriptDirectory, '../..');

export const DEFAULT_CONFIGURATION_FILES = Object.freeze([
  path.join(repositoryRoot, '.env.test.local'),
  path.join(portalRoot, '.env.local')
]);

const DATABASE_URL_PATTERN = /postgres(?:ql)?:\/\/[^\s"']+/gi;
const SUPABASE_PAT_PATTERN = /\bsbp_[A-Za-z0-9_-]+\b/g;
const SUPABASE_SECRET_KEY_PATTERN = /\bsb_(?:secret|service_role)_[A-Za-z0-9_-]+\b/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const PASSWORD_PARAMETER_PATTERN = /([?&](?:password|passwd|pwd)=)[^&\s]+/gi;
const PASSWORD_ASSIGNMENT_PATTERN = /(\b(?:password|passwd|pwd)\s*[:=]\s*)[^\s,;]+/gi;

function readConfigurationFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return dotenv.parse(fs.readFileSync(filePath));
}

export function loadCapabilityEnvironment(requiredNames, options = {}) {
  const environment = options.environment || process.env;
  const files = options.files || DEFAULT_CONFIGURATION_FILES;
  const fileValues = files.reduce((values, filePath) => (
    Object.assign(values, readConfigurationFile(filePath))
  ), {});
  const selected = {};

  for (const name of requiredNames) {
    const value = environment[name] ?? fileValues[name];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    selected[name] = value.trim();
  }

  return selected;
}

export function sanitizeDiagnostic(value, knownSecrets = []) {
  let sanitized = value instanceof Error ? value.message : String(value);

  for (const secret of knownSecrets) {
    if (typeof secret === 'string' && secret.length > 0) {
      sanitized = sanitized.split(secret).join('[REDACTED_SECRET]');
    }
  }

  return sanitized
    .replace(DATABASE_URL_PATTERN, '[REDACTED_DATABASE_URL]')
    .replace(SUPABASE_PAT_PATTERN, '[REDACTED_SUPABASE_PAT]')
    .replace(SUPABASE_SECRET_KEY_PATTERN, '[REDACTED_SUPABASE_KEY]')
    .replace(JWT_PATTERN, '[REDACTED_AUTH_TOKEN]')
    .replace(PASSWORD_PARAMETER_PATTERN, '$1[REDACTED]')
    .replace(PASSWORD_ASSIGNMENT_PATTERN, '$1[REDACTED]');
}

export async function runCapability(label, operation, knownSecrets = []) {
  try {
    await operation();
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error
      ? ` code=${sanitizeDiagnostic(error.code, knownSecrets)}`
      : '';
    console.error(`${label}: FAIL${code}: ${sanitizeDiagnostic(error, knownSecrets)}`);
    process.exitCode = 1;
  }
}

