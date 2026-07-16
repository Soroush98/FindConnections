# Defect log

Severity = impact (S1 critical → S4 trivial). Priority = urgency (P1 → P4),
independent fields. Every fix landed with a regression test referencing the
defect ID (see [TRACEABILITY.md](TRACEABILITY.md)).

All defects below were found during the 2026-07-16 QA pass and have been
**resolved** in the same pass. Detailed exploit reproductions are deliberately
omitted from this file; each entry states the area, the fix, and the guarding
test. Reproduction detail lives in the private QA notes, not in the repo.

| ID | Severity/Priority | Area | Status |
|----|-------------------|------|--------|
| DEF-001 | S2 / P2 | Graph edge direction & pair uniqueness | ✅ Fixed |
| DEF-002 | S2 / P2 | Admin upload file validation | ✅ Fixed |
| DEF-003 | S1 / P1 | Vulnerable Next.js dependency | ✅ Fixed |
| DEF-004 | S3 / P3 | Name gate rejected valid names | ✅ Fixed |
| DEF-005 | S3 / P2 | Suggestions query CPU bound | ✅ Fixed |
| DEF-006 | S3 / P3 | Name gate accepted control whitespace | ✅ Fixed |
| DEF-007 | S3 / P3 | Delete routes error mapping | ✅ Fixed |
| DEF-008 | S2 / P3 | Missing rate limiting | ✅ Fixed |
| DEF-009 | S4 / P4 | React effect anti-pattern | ✅ Fixed |

---

## DEF-001 — Edge-direction consistency & pair uniqueness · S2 / P2 · Fixed

**Area:** `lib/repositories/connectionRepository.ts`, `app/api/admin/admin-upload/route.ts`

The read/delete/exists queries disagreed on relationship direction, and the
upload path deduplicated on storage keys rather than the graph, so a pair could
end up with more than one edge or an edge that resisted deletion.

**Fix:** all pair reads and the delete are now undirected; edge creation uses an
idempotent undirected `MERGE`; the upload route dedupes through the graph via
`connectionService.connectionExists`, which is direction- and
extension-agnostic.
**Tests:** TC-REPO-002, TC-REPO-004, TC-API-UPLOAD-004, live TC-DATA-002.

## DEF-002 — Server-side upload validation · S2 / P2 · Fixed

**Area:** `app/api/admin/admin-upload/route.ts`, `helpers/serverImageValidation.ts`

Uploads were validated only in the browser, so the server would accept
non-image bytes and malformed filenames into the public bucket.

**Fix:** new `validateServerImage` re-checks extension allowlist, declared MIME,
magic number, and the 5 MB cap from raw bytes on the server before anything is
stored.
**Tests:** TC-API-UPLOAD-003, TC-SIMG-001..003.

## DEF-003 — Vulnerable Next.js dependency · S1 / P1 · Fixed

next@16.2.4 carried a high-severity middleware-bypass advisory; middleware is
the control that hides the admin surface, so this was load-bearing.

**Fix:** upgraded to next@16.2.10 (in-range) via `npm audit fix`; verified with
full suite + production build.
**Regression control:** CI gate `npm audit --audit-level=high`.
**Residual (accepted):** two moderate advisories against the postcss copy
bundled *inside* next; the only npm-offered remedy is an absurd downgrade to
next@9. Build-time tooling only; revisit when next bundles postcss ≥ 8.5.10.

## DEF-004 — Name gate rejected valid names · S3 / P3 · Fixed

The `^[a-zA-Z]+\s[a-zA-Z]+$` gate rejected hyphens, apostrophes, accents, and
names with more than two parts.

**Fix:** unicode-letter validation admitting internal hyphens/apostrophes and
three-plus-part names, centralized in `helpers/nameValidation.ts` and imported
by every route (no more inline regex copies).
**Tests:** TC-NAME-001.

## DEF-005 — Suggestions query CPU bound · S3 / P2 · Fixed

The public suggestions endpoint ran an unbounded-length query through a
per-name similarity scan.

**Fix:** query length capped at 100 chars (400 above it) at the route boundary,
before the scan.
**Tests:** TC-API-SUGG (cap + boundary).

## DEF-006 — Name gate accepted control whitespace · S3 / P3 · Fixed

`\s` admitted tab/newline separators and there was no length bound, allowing
malformed storage keys and node names.

**Fix:** literal-space separator and a 3–60 char length bound in the shared
validator.
**Tests:** TC-NAME-001, TC-NAME-002, TC-SEC-001.

## DEF-007 — Delete-route error mapping · S3 / P3 · Fixed

Malformed JSON on the delete routes surfaced as a 500 instead of a 400.

**Fix:** both delete routes parse the body defensively and return
400 VALIDATION_ERROR, matching the other write routes.
**Tests:** TC-API-DEL-001.

## DEF-008 — Rate limiting · S2 / P3 · Fixed

The `RATE_LIMITED` code existed but no endpoint enforced a limit.

**Fix:** a bounded in-memory fixed-window limiter (`lib/rateLimit.ts`) applied
in middleware to `/api/general/*` per client IP (300 req / 60 s), returning
429 with `Retry-After` and `X-RateLimit-*` headers. Documented caveat:
single-instance state; a horizontally-scaled deploy needs a shared store.
**Tests:** TC-RL-001, TC-MW-002.

## DEF-009 — React effect anti-pattern · S4 / P4 · Fixed

Two `set-state-in-effect` violations in the admin upload page.

**Fix:** preview URL derived via `useMemo` with cleanup-only revocation; the
progress timer resets in its handler rather than synchronously in the effect.
The temporary eslint override has been removed, so the lint gate is strict for
the whole tree again.
**Tests:** `npm run lint` gate (0 warnings).
