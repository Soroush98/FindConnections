# Requirement ↔ Test traceability matrix

Requirements are derived from `README.md` and the implicit contracts of the
API surface. Test-case IDs appear verbatim in automated test names — grep a
`TC-` prefix to find the implementation. Gaps show as empty cells; audits
should start there.

| Req | Requirement | Test cases | Automation |
|-----|-------------|-----------|------------|
| REQ-01 | Anyone can find the shortest photo-chain between two people | TC-REPO-001, TC-CONN-SVC-001, TC-API-CONN-001..003 | `tests/unit/connectionRepository.test.ts`, `tests/integration/connections.api.test.ts`, `scripts/smoke.mjs` |
| REQ-02 | Autocomplete suggests names from the stored photo set (typo-tolerant) | TC-SUGG-001..002, TC-SUGGREPO-001..002, TC-API-SUGG-001..002 | `tests/unit/suggestionService.test.ts`, `tests/unit/suggestionRepository.test.ts`, `tests/integration/suggestions.api.test.ts` |
| REQ-03 | Home page shows top-degree "popular" quick picks (limit 1–20, default 8, cached 5 min) | TC-SUGG-003, TC-REPO-005, TC-API-POP-001..002 | `tests/unit/suggestionService.test.ts`, `tests/integration/popular.api.test.ts` |
| REQ-04 | Famous-pics gallery lists only image files | TC-API-PICS-001 | `tests/integration/famous-pics.api.test.ts` |
| REQ-05 | Admin surface is admin-only: JWT cookie (8 h, role=admin, httpOnly, sameSite=strict); admin pages + login hidden by middleware | TC-AUTH-SVC-001..003, TC-API-AUTH-001..003, TC-MW-001, TC-SEC-004 | `tests/unit/adminService.test.ts`, `tests/integration/admin-auth.api.test.ts`, `tests/unit/middleware.test.ts`, `tests/security/abuse.test.ts` |
| REQ-06 | Admin can upload a pair photo: `First Last` names, no duplicate pair, stored as `A_B.ext`, edge created, suggestion cache invalidated | TC-API-UPLOAD-001..005, TC-NAME-001..002, TC-FILE-001..003 | `tests/integration/admin-upload.api.test.ts`, `tests/unit/nameValidation.test.ts`, `tests/unit/fileValidation.test.ts` |
| REQ-07 | Ingestion pipeline: Serper search → download+validate (MIME, magic number, ≤5 MB) → Rekognition both names ≥95% → store+edge; stops at first accept; full attempt trace | TC-INGEST-001..004, TC-INT-001..002, TC-API-INGEST-001..004 | `tests/unit/ingestionService.test.ts`, `tests/unit/integrations.test.ts`, `tests/integration/ingest-pair.api.test.ts` |
| REQ-08 | Admin can delete a connection (edge + storage object) or a node (with all edges + images); storage failure never blocks graph deletion | TC-CONN-SVC-002..003, TC-API-DEL-001..003 | `tests/unit/connectionService.test.ts`, `tests/integration/delete-routes.api.test.ts` |
| REQ-09 | Graph & bucket integrity: no self-loops, no duplicate pair edges, every edge image resolves, no orphans, key convention holds | TC-REPO-002..004, TC-STOR-001..003, TC-DATA-001..008 | `tests/unit/connectionRepository.test.ts`, `tests/unit/storageHelpers.test.ts`, `tests/data-quality/graph-integrity.test.ts` (opt-in live) |
| REQ-10 | Uniform error contract; internals (credentials, hosts, stacks) never reach clients | TC-ERR-001..004, TC-SEC-003, TC-SEC-005, `ErrorBodySchema` used across all API suites | `tests/unit/errors.test.ts`, `tests/security/abuse.test.ts`, `tests/helpers/contracts.ts` |
| REQ-11 | Performance SLOs (QA-STRATEGY §9): popular p95<500 ms, suggestions p95<800 ms, connections p95<2 s, rejects p95<150 ms, errors <1% | TC-PERF (k6 thresholds) | `loadtest/k6/api-read-paths.js` + committed runs in `loadtest/results/` |
| REQ-12 | Abusive input is always handled gracefully: no 500s, no partial writes | TC-SEC-001..003 (abuse corpus) | `tests/security/abuse.test.ts`, `tests/helpers/testUtils.ts` |

## Known coverage gaps (deliberate — QA-STRATEGY §7)

- Browser-level UI flows (React pages) — covered by `scripts/smoke.mjs` at the
  HTTP level only.
- Live Serper/Rekognition responses — pinned via mocks; drift risk accepted.
- Admin UI pages (production-hidden).

## Defect ↔ regression-test links

All defects from the 2026-07-16 pass are fixed; each is guarded by the test(s)
below (they now assert the corrected behavior).

| Defect | Guarded by |
|--------|-----------|
| DEF-001 | `TC-REPO-002`, `TC-REPO-004`, `TC-API-UPLOAD-004`, live `TC-DATA-002` |
| DEF-002 | `TC-API-UPLOAD-003`, `TC-SIMG-001..003` |
| DEF-003 | CI `npm audit --audit-level=high` gate (next 16.2.4→16.2.10) |
| DEF-004 | `TC-NAME-001` |
| DEF-005 | `TC-API-SUGG` (cap + 100-char boundary) |
| DEF-006 | `TC-NAME-001`, `TC-NAME-002`, `TC-SEC-001` |
| DEF-007 | `TC-API-DEL-001` |
| DEF-008 | `TC-RL-001`, `TC-MW-002` |
| DEF-009 | `npm run lint` gate (strict, no override) |
