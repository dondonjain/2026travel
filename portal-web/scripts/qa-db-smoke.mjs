import pg from 'pg';
import {
  loadCapabilityEnvironment,
  runCapability
} from './lib/secret-boundary.mjs';

const ENV_NAME = 'QA_DATABASE_READ_URL';
let knownSecrets = [];

await runCapability('qa:db-smoke', async () => {
  const config = loadCapabilityEnvironment([ENV_NAME]);
  const connectionString = config[ENV_NAME];
  knownSecrets.push(connectionString);
  const client = new pg.Client({ connectionString });

  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    const result = await client.query("SELECT current_setting('transaction_read_only') AS transaction_read_only");
    await client.query('ROLLBACK');
    console.log(JSON.stringify({
      status: 'PASS',
      capability: 'qa-read',
      databaseReachable: true,
      transactionReadOnly: result.rows[0]?.transaction_read_only === 'on'
    }));
  } finally {
    await client.end().catch(() => undefined);
  }
}, knownSecrets);
