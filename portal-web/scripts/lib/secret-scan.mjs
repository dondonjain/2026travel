import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { createHash } from 'crypto';

const RULES = Object.freeze([
  { category: 'postgres-credential-url', pattern: /postgres(?:ql)?:\/\/[^\s"']+:[^@\s"']+@[^\s"']+/gi },
  { category: 'supabase-personal-access-token', pattern: /\bsbp_[A-Za-z0-9_-]{16,}\b/g },
  { category: 'supabase-secret-key', pattern: /\bsb_(?:secret|service_role)_[A-Za-z0-9_-]{16,}\b/gi },
  { category: 'jwt-auth-token', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  {
    category: 'hardcoded-password-or-token',
    pattern: /\b(?:password|passwd|pwd|api[_-]?token|access[_-]?token|service[_-]?role[_-]?key)\s*[:=]\s*["'][^"'\r\n]{8,}["']/gi
  }
]);

// Existing documentation example. Keep this narrow so movement or duplication
// of the assignment is detected and reviewed again.
const TRACKED_FINDING_ALLOWLIST = new Map([
  [
    'docs/docke_deep-research-report.md:hardcoded-password-or-token:788',
    '3175cd44f262f1ba2c0a61f42e666ce138f2fa7c0d7168359cee236d320c7897'
  ]
]);

export function scanText(file, text) {
  const findings = [];
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    for (const match of text.matchAll(rule.pattern)) {
      const normalizedMatch = match[0].toLowerCase();
      if (
        rule.category === 'hardcoded-password-or-token' &&
        ['example', 'placeholder', 'your-', 'fake-', 'synthetic-', 'not-a-real'].some((marker) => normalizedMatch.includes(marker))
      ) {
        continue;
      }
      findings.push({
        file,
        category: rule.category,
        line: text.slice(0, match.index).split(/\r?\n/).length
      });
    }
  }
  return findings;
}

export function scanTrackedFiles(repositoryRoot) {
  const listed = spawnSync('git', ['ls-files', '-z', '--cached'], {
    cwd: repositoryRoot,
    encoding: 'utf8'
  });
  if (listed.status !== 0) throw new Error('Unable to enumerate tracked repository files.');

  return listed.stdout
    .split('\0')
    .filter(Boolean)
    .flatMap((file) => {
      const absolutePath = path.join(repositoryRoot, file);
      if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) return [];
      const buffer = fs.readFileSync(absolutePath);
      if (buffer.includes(0)) return [];
      const text = buffer.toString('utf8');
      const lines = text.split(/\r?\n/);
      return scanText(file, text).filter((finding) => {
        const allowlistedHash = TRACKED_FINDING_ALLOWLIST.get(
          `${finding.file}:${finding.category}:${finding.line}`
        );
        if (!allowlistedHash) return true;
        const actualHash = createHash('sha256')
          .update(lines[finding.line - 1] || '')
          .digest('hex');
        return actualHash !== allowlistedHash;
      });
    });
}
