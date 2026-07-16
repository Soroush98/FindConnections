# Load-test results log

One file per meaningful run: `YYYY-MM-DD-<shape>-<env>.md`. An untracked perf
result might as well not exist — commit the numbers WITH the interpretation.

Template:

```markdown
# 2026-07-16 · load · local prod build

- Revision: <git sha>
- Command: npm run loadtest:load
- Server: next start (prod build) on MacBook <model>, Node 24
- Stores: Neo4j (remote, neo4j.findconnections.net), Supabase Storage (remote)
- k6 summary: (paste the end-of-test block: iterations, per-endpoint
  http_req_duration p50/p95/max, http_req_failed, threshold pass/fail)

## Interpretation
2–3 sentences: did we meet SLOs? what moved vs the previous run of this
shape? any endpoint near its threshold? next action if any.
```

No runs recorded yet. First scheduled run: smoke + load against a local prod
build (`npm run build && npm start`), which reads from the live Neo4j — run it
in a quiet window.
