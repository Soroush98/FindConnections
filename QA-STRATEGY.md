# FindConnections — QA Strategy & Test Plan

Owner: QA. Applies to the whole repo. Vocabulary follows ISTQB Foundation.
Last revised: 2026-07-16.

## 1. Scope & quality objectives

FindConnections is a public, read-only graph search UI (shortest photo-chain
between two people) with an admin-only write path (manual upload + automated
Serper→Rekognition ingestion). Stores: Neo4j (graph), Supabase Postgres
(admins), Supabase Storage (`connection-images` bucket, public reads).

Quality objectives, in priority order:

1. **Never corrupt the graph or the bucket** (duplicate/dangling edges, orphan
   objects, mismatched filenames).
2. **Admin surface stays admin-only** (every `/api/admin/*` route enforces the
   JWT cookie; middleware hides admin pages/login).
3. **Public reads stay correct and fast** (right path returned; p95 within SLO).
4. **Bad input never produces a 500 or a partial write.**

## 2. Product risk register (likelihood × impact, 1–5 each)

| ID | Risk | L | I | Score | Mitigation (test level) |
|----|------|---|---|-------|-------------------------|
| R1 | Admin routes reachable without valid session → graph vandalism | 3 | 5 | 15 | API negative auth tests on every admin route (integration) |
| R2 | Graph/bucket integrity drift: duplicate edges, edges whose image is gone, objects with no edge | 4 | 4 | 16 | Live data-quality suite + unit tests on write paths |
| R3 | Edge-direction asymmetry: exists-check is undirected but delete/get are directed → duplicate edges or undeletable connections | 4 | 4 | 16 | Unit tests documenting direction semantics; live duplicate-pair invariant |
| R4 | Wrong-path or empty result shown for a connected pair | 2 | 4 | 8 | Repository unit tests; e2e smoke against live |
| R5 | Malicious/oversized input → 500s, CPU burn (Levenshtein on unbounded query), injection | 3 | 4 | 12 | Abuse-input corpus (security suite); load test on rejection paths |
| R6 | Ingestion accepts a wrong photo (confidence boundary, name mismatch) → wrong public content | 3 | 4 | 12 | Ingestion unit tests incl. 95%-confidence boundary (BVA) |
| R7 | Upload accepts non-image or wrongly named file → broken public site | 3 | 3 | 9 | Upload negative tests (extension/MIME/regex) |
| R8 | Latency collapse under normal traffic (Neo4j shortestPath is O(graph)) | 3 | 3 | 9 | k6 load/stress/spike/soak with thresholds |
| R9 | Known-vulnerable dependencies (Next middleware-bypass advisories directly defeat R1's middleware layer) | 4 | 4 | 16 | `npm audit` gate in CI |
| R10 | Secrets/PII leak in error bodies or logs | 2 | 5 | 10 | Contract tests assert generic 500 body; grep-style leak assertions |

Effort is spent in score order: R2/R3/R9/R1 first, cosmetic last.

## 3. Test levels & what each covers

| Level | Runner | Scope | Externals |
|-------|--------|-------|-----------|
| Unit | Vitest (`tests/unit`) | helpers, services, repositories, error mapping | all mocked |
| Integration/API | Vitest (`tests/integration`) | route handlers invoked through `NextRequest` → `NextResponse`; auth, validation, status codes, error bodies, contract schemas | DB/storage/AWS seams mocked via `vi.mock` |
| Security | Vitest (`tests/security`) | abuse-input corpus, auth bypass attempts, leak checks | mocked |
| Data quality (live) | Vitest (`tests/data-quality`), **opt-in** `npm run test:live-data` | invariants against the real Neo4j + Storage (read-only) | real, requires `.env` |
| E2E smoke | `scripts/smoke.mjs` against a running deployment | homepage + the three public read APIs end-to-end | real |
| Performance | k6 (`loadtest/k6`) | load/stress/spike/soak with pass/fail thresholds | real server (local prod build by default) |

Push every check to the lowest level that can catch it: e.g. the
`maxCandidates` clamp is asserted at unit/API level, never in k6.

## 4. Entry / exit criteria (CI-enforced gates)

Merge to `main` requires (see `.github/workflows/qa.yml`):

- `npm run lint` clean, `npm run typecheck` clean.
- `npm run test:coverage` green — all unit/integration/security suites pass,
  coverage ≥ 80% lines / 75% branches on `lib`, `helpers`, `app/api`.
- `npm audit --audit-level=high` reports no high/critical vulnerabilities.
- No open S1/S2 defects in `DEFECTS.md` targeting the release.

Release to production additionally requires:

- `scripts/smoke.mjs` green against the deployed URL.
- Latest k6 **load** run within SLO (`loadtest/results/`, committed with
  date + revision + numbers).

## 5. Test design techniques in use (named per suite)

- **Equivalence partitioning** — name inputs (valid two-word, single word,
  digits, symbols, empty); file types (png, jpeg, other).
- **Boundary-value analysis** — `popular` limit at 0/1/8/20/21/NaN;
  Rekognition confidence at 94.99/95/95.01; image size at 5 MB ± 1 byte;
  `maxCandidates` at 0/1/30/31.
- **Decision tables** — ingestion accept/skip decision (MIME × signature ×
  A-detected × B-detected × confidence).
- **State transition** — admin session lifecycle: no cookie → valid → expired
  → tampered → wrong-role → logged out.
- **Negative testing** — every route: missing auth (401), wrong role (403),
  malformed body (400), duplicate (409), missing resource (404),
  dependency failure (500 with generic body).

## 6. Traceability

Requirements ↔ test cases ↔ automation are mapped in `TRACEABILITY.md`.
Test case IDs (`TC-…`) appear verbatim in test names. Every defect fixed
gets a regression test naming the defect ID (`DEF-…`).

## 7. Deliberately not automated (and why)

- **Browser E2E (Playwright)** — the public UI is a single search page; the
  API-level integration suite plus `scripts/smoke.mjs` covers the risk at far
  lower maintenance cost. Revisit if the UI grows flows (accounts, editing).
- **Rekognition/Serper live calls** — paid third-party APIs; contract captured
  in mocks from observed response shapes. Drift risk accepted and documented.
- **Admin UI pages** — hidden by middleware in production; exercised manually
  by the single admin.

## 8. Defect management

Defects live in `DEFECTS.md` with severity (S1–S4) and priority (P1–P4) as
separate fields, environment/revision, reproduction, expected vs. actual,
and evidence. Triage cadence: weekly. Every fix links a regression test.

## 9. Performance SLOs (encoded as k6 thresholds)

Local prod build (`next build && next start`), Neo4j/Supabase remote:

| Endpoint | p95 | error rate |
|----------|-----|-----------|
| `GET /api/general/popular` | < 500 ms | < 1% |
| `GET /api/general/suggestions` | < 800 ms | < 1% |
| `GET /api/general/connections` | < 2000 ms | < 1% |
| rejection paths (400s) | < 150 ms | n/a (4xx expected) |

Shapes: **load** (expected traffic ~10 RPS), **stress** (ramp to breaking
point), **spike** (0→60 VU in 10 s), **soak** (30 min sustained, hunts leaks
— watch the suggestion-cache and Neo4j pool). Every run is committed to
`loadtest/results/` with date, revision, environment, numbers, interpretation.
