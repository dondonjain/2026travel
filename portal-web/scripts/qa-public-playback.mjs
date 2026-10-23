import { createRequire } from 'module';
import {
  loadCapabilityEnvironment,
  runCapability
} from './lib/secret-boundary.mjs';

const require = createRequire(import.meta.url);
const { verifyPublicPlayback } = require('../src/lib/verify-public-playback.cjs');
const requiredNames = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
];
let knownSecrets = [];

await runCapability('qa:public-playback', async () => {
  const config = loadCapabilityEnvironment(requiredNames);
  knownSecrets.push(config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  process.env.NEXT_PUBLIC_SUPABASE_URL = config.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  await verifyPublicPlayback();
}, knownSecrets);
