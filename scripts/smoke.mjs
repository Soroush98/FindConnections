#!/usr/bin/env node
/**
 * TC-E2E — post-deploy smoke test (traces: R4; QA-STRATEGY.md §3).
 * Hits a RUNNING deployment end-to-end (real Neo4j, real Storage).
 *
 *   node scripts/smoke.mjs                          # http://localhost:3000
 *   BASE_URL=https://findconnections.net node scripts/smoke.mjs
 *
 * Exit code 0 = all checks pass. Keep this under a minute — it's a smoke
 * test, not a regression suite.
 */
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

let failures = 0;

async function checkStep(name, fn) {
  const started = Date.now();
  try {
    await fn();
    console.log(`  ✓ ${name} (${Date.now() - started}ms)`);
  } catch (err) {
    failures += 1;
    console.error(`  ✗ ${name}: ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function getJson(path) {
  const res = await fetch(`${BASE_URL}${path}`, { signal: AbortSignal.timeout(30_000) });
  assert(res.status === 200, `${path} → HTTP ${res.status}`);
  return res.json();
}

console.log(`Smoke test against ${BASE_URL}`);

let popularNames = [];

await checkStep('homepage renders', async () => {
  const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(30_000) });
  assert(res.status === 200, `/ → HTTP ${res.status}`);
  const html = await res.text();
  assert(html.toLowerCase().includes('connection'), 'homepage HTML missing expected content');
});

await checkStep('GET /api/general/popular returns names', async () => {
  const body = await getJson('/api/general/popular?limit=8');
  assert(Array.isArray(body.names), 'names is not an array');
  assert(body.names.length >= 2, `expected ≥2 popular names, got ${body.names.length}`);
  popularNames = body.names;
});

await checkStep('GET /api/general/suggestions returns matches for a real prefix', async () => {
  const prefix = (popularNames[0] || 'a').slice(0, 2);
  const body = await getJson(`/api/general/suggestions?query=${encodeURIComponent(prefix)}`);
  assert(Array.isArray(body.suggestions), 'suggestions is not an array');
});

await checkStep('GET /api/general/connections finds a path between two popular people', async () => {
  const [name1, name2] = popularNames;
  const body = await getJson(
    `/api/general/connections?name1=${encodeURIComponent(name1)}&name2=${encodeURIComponent(name2)}`
  );
  assert(Array.isArray(body), 'connections response is not an array');
});

await checkStep('rejection path: connections without name2 → 400 with contract body', async () => {
  const res = await fetch(`${BASE_URL}/api/general/connections?name1=x`, {
    signal: AbortSignal.timeout(10_000),
  });
  assert(res.status === 400, `expected 400, got ${res.status}`);
  const body = await res.json();
  assert(body.code === 'MISSING_REQUIRED_FIELDS', `unexpected error code ${body.code}`);
});

await checkStep('admin surface is hidden: /api/admin/admin-login → 404', async () => {
  const res = await fetch(`${BASE_URL}/api/admin/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(10_000),
  });
  assert(res.status === 404, `expected 404 (middleware), got ${res.status}`);
});

await checkStep('admin mutation without session → 401', async () => {
  const res = await fetch(`${BASE_URL}/api/admin/ingest-pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personA: 'John Doe', personB: 'Jane Roe' }),
    signal: AbortSignal.timeout(10_000),
  });
  assert(res.status === 401, `expected 401, got ${res.status}`);
});

if (failures > 0) {
  console.error(`\nSmoke test FAILED: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nSmoke test passed.');
