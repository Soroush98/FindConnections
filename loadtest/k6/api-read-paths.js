/**
 * TC-PERF — k6 harness for the public read paths (traces: R5, R8).
 *
 * Usage:
 *   k6 run --env SCENARIO=smoke  loadtest/k6/api-read-paths.js   # 30s tripwire
 *   k6 run --env SCENARIO=load   loadtest/k6/api-read-paths.js   # expected traffic, 5m
 *   k6 run --env SCENARIO=stress loadtest/k6/api-read-paths.js   # find the knee, 8m
 *   k6 run --env SCENARIO=spike  loadtest/k6/api-read-paths.js   # 0→60 VUs in 10s
 *   k6 run --env SCENARIO=soak   loadtest/k6/api-read-paths.js   # 30m, hunts leaks/drift
 *
 *   --env BASE_URL=http://localhost:3000   (default; use a prod BUILD, dev mode lies)
 *
 * SLOs are encoded as thresholds below — a run that breaches them EXITS
 * NON-ZERO. Commit every meaningful run to loadtest/results/ with revision,
 * environment, numbers, and interpretation.
 *
 * Workload model: weighted mix approximating real traffic — autocomplete
 * fires on every keystroke (60%), an actual search is rarer (25%), the
 * homepage chips load once per visit (10%), and a sliver of malformed
 * requests exercises the rejection path (5%), which must stay fast or the
 * 400 path itself becomes a DoS surface.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SCENARIO = __ENV.SCENARIO || 'smoke';

const SCENARIOS = {
  smoke: {
    executor: 'constant-vus',
    vus: 2,
    duration: '30s',
  },
  load: {
    // Expected traffic: ~10 req/s arrival rate, independent of response time.
    executor: 'constant-arrival-rate',
    rate: 10,
    timeUnit: '1s',
    duration: '5m',
    preAllocatedVUs: 30,
    maxVUs: 100,
  },
  stress: {
    executor: 'ramping-arrival-rate',
    startRate: 5,
    timeUnit: '1s',
    preAllocatedVUs: 50,
    maxVUs: 300,
    stages: [
      { target: 20, duration: '2m' },
      { target: 50, duration: '2m' },
      { target: 100, duration: '2m' },
      { target: 0, duration: '1m' },
    ],
  },
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { target: 60, duration: '10s' },
      { target: 60, duration: '1m' },
      { target: 0, duration: '10s' },
    ],
  },
  soak: {
    executor: 'constant-arrival-rate',
    rate: 5,
    timeUnit: '1s',
    duration: '30m',
    preAllocatedVUs: 20,
    maxVUs: 60,
  },
};

export const options = {
  scenarios: { [SCENARIO]: SCENARIOS[SCENARIO] },
  thresholds: {
    // SLOs from QA-STRATEGY.md §9 — breach = non-zero exit = failed gate.
    'http_req_duration{endpoint:popular}': ['p(95)<500'],
    'http_req_duration{endpoint:suggestions}': ['p(95)<800'],
    'http_req_duration{endpoint:connections}': ['p(95)<2000'],
    'http_req_duration{endpoint:reject}': ['p(95)<150'],
    'http_req_failed{endpoint:popular}': ['rate<0.01'],
    'http_req_failed{endpoint:suggestions}': ['rate<0.01'],
    'http_req_failed{endpoint:connections}': ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

// Rejection-path responses are EXPECTED to be 400 — don't count them as failed.
const expect400 = { responseCallback: http.expectedStatuses(400) };

export function setup() {
  // Seed a realistic workload: real names from the live graph.
  const res = http.get(`${BASE_URL}/api/general/popular?limit=20`);
  const names = res.status === 200 ? JSON.parse(res.body).names : [];
  if (names.length < 2) {
    throw new Error(
      `setup: could not fetch popular names from ${BASE_URL} (status ${res.status}) — is the server running?`
    );
  }
  return { names };
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function scenario(data) {
  const names = data.names;
  const r = Math.random();

  if (r < 0.6) {
    // Autocomplete: 1–3 char prefix of a real name, like a user typing.
    const name = pick(names);
    const prefix = name.slice(0, 1 + Math.floor(Math.random() * 3)).toLowerCase();
    const res = http.get(
      `${BASE_URL}/api/general/suggestions?query=${encodeURIComponent(prefix)}`,
      { tags: { endpoint: 'suggestions' } }
    );
    check(res, {
      'suggestions 200': (x) => x.status === 200,
      'suggestions shape': (x) => Array.isArray(JSON.parse(x.body).suggestions),
    });
  } else if (r < 0.85) {
    // Real search between two distinct popular people.
    const name1 = pick(names);
    let name2 = pick(names);
    while (name2 === name1) name2 = pick(names);
    const res = http.get(
      `${BASE_URL}/api/general/connections?name1=${encodeURIComponent(name1)}&name2=${encodeURIComponent(name2)}`,
      { tags: { endpoint: 'connections' }, timeout: '30s' }
    );
    check(res, {
      'connections 200': (x) => x.status === 200,
      'connections is array': (x) => Array.isArray(JSON.parse(x.body)),
    });
  } else if (r < 0.95) {
    const res = http.get(`${BASE_URL}/api/general/popular?limit=8`, {
      tags: { endpoint: 'popular' },
    });
    check(res, {
      'popular 200': (x) => x.status === 200,
      'popular shape': (x) => Array.isArray(JSON.parse(x.body).names),
    });
  } else {
    // Rejection path: missing name2 must 400 fast and cheap.
    const res = http.get(
      `${BASE_URL}/api/general/connections?name1=${encodeURIComponent(pick(names))}`,
      { tags: { endpoint: 'reject' }, ...expect400 }
    );
    check(res, { 'reject is 400': (x) => x.status === 400 });
  }

  // Per-VU think time (arrival-rate executors ignore it; VU executors need it).
  sleep(Math.random() * 0.5 + 0.25);
}
