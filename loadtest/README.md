# Load testing

k6 harness for the public read paths. SLOs live in `QA-STRATEGY.md` §9 and are
**encoded as thresholds** in `k6/api-read-paths.js` — a breaching run exits
non-zero, so these are pass/fail gates, not demos.

## Prerequisites

- `k6` (`brew install k6`)
- A running server. **Use a production build** — dev mode (`next dev`)
  compiles on demand and will lie to you:

  ```sh
  npm run build && npm start   # serves on :3000
  ```

## Shapes — each answers a different question

| Command | Shape | Question it answers |
|---------|-------|---------------------|
| `npm run loadtest:smoke` | 2 VUs, 30 s | does the harness + server basically work? |
| `npm run loadtest:load` | 10 req/s arrival, 5 m | do we meet SLOs at expected traffic? |
| `npm run loadtest:stress` | ramp 5→100 req/s, 8 m | where is the knee / breaking point? |
| `npm run loadtest:spike` | 0→60 VUs in 10 s | do we survive a sudden burst (e.g. going viral)? |
| `npm run loadtest:soak` | 5 req/s, 30 m | leaks/drift: Neo4j pool, suggestion cache, memory |

Target another host with `--env BASE_URL=…`:

```sh
k6 run --env SCENARIO=load --env BASE_URL=https://staging.example.com loadtest/k6/api-read-paths.js
```

Do NOT point stress/spike/soak at production without a maintenance window —
`connections` fans out to Neo4j `shortestPath`, which is the expensive query.

## Workload model

Weighted to approximate real traffic (autocomplete fires per keystroke):
60% suggestions (1–3 char prefixes of real names), 25% connections (random
pairs of popular people), 10% popular, 5% malformed requests asserting the
rejection path stays fast (a slow 400 is itself a DoS surface).

`setup()` pulls real names from `/api/general/popular`, so the run exercises
actual graph paths, not synthetic misses.

## Recording results (mandatory)

An untracked perf result might as well not exist. After every meaningful run,
add `results/YYYY-MM-DD-<shape>-<env>.md` with: date, git revision, scenario,
environment (hardware, server mode, store locations), the k6 summary block,
and 2–3 sentences of interpretation. Compare against the previous run of the
same shape before merging perf-sensitive changes.
