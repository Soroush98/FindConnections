/**
 * Global test setup.
 *
 * lib/env.ts validates process.env at import time, so every required variable
 * must exist before any module under test is imported. Unit and integration
 * suites always run against FAKE values — they must never be able to reach a
 * real database, bucket, or AWS account, even when a developer has a .env file.
 *
 * The live data-quality suite (tests/data-quality) is the one exception: when
 * RUN_LIVE_DATA_QA=1 the real .env is loaded instead, and those tests talk to
 * the production stores read-only.
 */
import path from 'path';

if (process.env.RUN_LIVE_DATA_QA === '1') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dotenv = require('dotenv') as typeof import('dotenv');
  dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
} else {
  process.env.AWS_ACCESS_KEY_ID = 'test-access-key-id';
  process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-access-key';
  process.env.AWS_REGION = 'us-east-1';
  process.env.SECRET_KEY = 'test-secret-key-that-is-at-least-32-chars-long';
  process.env.NEO4J_URI = 'bolt://localhost:7687';
  process.env.NEO4J_USER = 'neo4j';
  process.env.NEO4J_PASSWORD = 'test-password';
  process.env.SUPABASE_URL = 'https://test-project.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.SERPER_API_KEY = 'test-serper-key';
}
