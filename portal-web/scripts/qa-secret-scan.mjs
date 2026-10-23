import path from 'path';
import { fileURLToPath } from 'url';
import { runCapability } from './lib/secret-boundary.mjs';
import { scanTrackedFiles } from './lib/secret-scan.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

await runCapability('qa:secret-scan', async () => {
  const findings = scanTrackedFiles(repositoryRoot);
  if (findings.length > 0) {
    for (const finding of findings) console.error(JSON.stringify(finding));
    throw new Error(`Tracked credential scan found ${findings.length} sanitized finding(s).`);
  }
  console.log(JSON.stringify({ status: 'PASS', trackedCredentialFindings: 0 }));
});

