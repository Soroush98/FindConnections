# 2026-07-16 · smoke + load · local prod build

- Revision: `047900c` (+ uncommitted QA work; next upgraded 16.2.4→16.2.10)
- Commands: `k6 run --env SCENARIO=smoke|load --env BASE_URL=http://localhost:3001 loadtest/k6/api-read-paths.js`
- Server: `next start` (production build), Apple M5, macOS 26.5.2, Node 24.14.1, port 3001
- Stores: Neo4j remote (neo4j.findconnections.net), Supabase Storage remote
- Preceded by: `scripts/smoke.mjs` — 7/7 checks passed; live data-quality suite — 8/8 invariants passed

## load (constant-arrival 10 req/s, 5 m) — ALL THRESHOLDS PASSED

| Endpoint | n | avg | med | p90 | p95 | max | SLO (p95) | Verdict |
|----------|---|-----|-----|-----|-----|-----|-----------|---------|
| connections | 793 | 72.3 ms | 69.1 ms | 80.2 ms | **89.3 ms** | 181 ms | < 2000 ms | ✅ 22× headroom |
| suggestions | 1775 | 5.4 ms | 2.7 ms | 3.3 ms | **3.4 ms** | 607 ms | < 800 ms | ✅ |
| popular | 286 | 2.9 ms | 2.7 ms | 3.3 ms | **3.4 ms** | 67 ms | < 500 ms | ✅ |
| reject (400 path) | 147 | 3.0 ms | 3.0 ms | 3.7 ms | **3.9 ms** | 5.4 ms | < 150 ms | ✅ |

- `http_req_failed`: 0.00% (0/3001) on every endpoint (SLO < 1%)
- checks: 100% (5854/5854); exactly 10.0 req/s sustained; VUs peaked at 9 of 30 pre-allocated

## smoke (2 VUs, 30 s) — passed

Same shape of numbers at lower n; connections p95 214 ms with a 721 ms cold-start max on the very first hits.

## Interpretation

At expected traffic the system is nowhere near its limits: `shortestPath` on
the current graph costs ~70 ms per query against the remote Neo4j, and the
in-process caches flatten `suggestions`/`popular` to ~3 ms (the 607 ms
suggestions max is the once-per-60 s cold cache refill hitting Supabase
Storage listing — visible but harmless at this scale). The rejection path is
~3 ms, so malformed traffic is cheap. Error budget untouched.

Caveats: single-machine client+server; network hop to Neo4j is real but
residential. The knee is unknown — run `SCENARIO=stress` before any traffic
event, and `SCENARIO=soak` (30 m) to watch the Neo4j pool and cache drift.
Next comparison run should use these numbers as the baseline.
