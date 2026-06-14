---
name: engineering-principles
description: >-
  Stack-agnostic staff-level engineering practices for architecture, concurrency,
  reliability, error handling, testing, CI/CD, and code craft. Apply when
  designing, building, reviewing, or refactoring any non-trivial software, in any
  language — whenever design choices, failure modes, or scale matter (not one-line
  edits). Pairs with the stack-specific skills (go-practices, react-practices,
  python-practices) for idioms; this skill holds the principles those specialize.
---

# Engineering Principles

Operate like a staff engineer: correctness and clear failure behavior first, then
scalability, then ergonomics. **Match the conventions of the code already in the
repo over any preference below.** Make the smallest change that fully solves the
problem, and make the design legible to the next reader. Use the matching
stack-specific skill for language idioms; the rules here are stack-agnostic.

## Before writing code

- **Understand the contract first.** Identify the data model, the public surface,
  and the invariants before touching implementation. If there's an API, treat the
  schema/spec as the source of truth and derive code from it — don't hand-maintain
  what should be generated.
- **Find the generated/hand-written boundary.** If a file is generated, fix the
  generator/template, never the output.
- **State the design in 3-5 lines before a non-trivial change:** the approach, the
  main failure mode, and what you're deliberately *not* doing. Then build.
- **Reuse before adding.** Search for an existing helper or pattern. A new
  dependency or abstraction must earn its place.

## Architecture

- **Separation of concerns by layer:** transport → domain/service logic → storage.
  Keep business logic free of framework and I/O details so it's testable alone.
- **Depend on interfaces at boundaries** (storage, external services, clocks,
  queues). Inject dependencies; avoid globals and singletons. This is what makes
  code unit-testable without the network.
- **Stateless compute, externalized state.** Design so horizontal scaling is "run
  more replicas." Keep durable state in a datastore. For background work, use a
  queue + a pool of stateless workers so the queue can move from in-process to a
  broker (Redis/SQS/Kafka) without changing worker logic.
- **Make the scaling path explicit.** When you take an in-process shortcut, leave a
  comment naming the production swap so the seam is visible.
- **One source of truth per concept.** No duplicated config; nothing that must be
  edited in two places. If two things must change together, generate one from the
  other or unify them.

## Concurrency & scalability

- **Propagate cancellation/deadlines** through every blocking call and every
  spawned task (context/cancellation token/AbortSignal). Nothing runs uncancellable.
- **Bound concurrency.** Never spawn unbounded work-per-item. Use a fixed worker
  pool or a semaphore sized to the real constraint (CPU, connections, downstream
  rate limit).
- **Rate-limit shared external resources globally** with one shared limiter so the
  system respects a single quota regardless of concurrency.
- **Retry only transient failures** (timeouts, 429/503, network) with exponential
  backoff + jitter, capped, and only for idempotent/safe operations. Honor server
  hints like `Retry-After`. **Never retry a permanent error** (4xx, validation).
- **Apply backpressure.** A full queue fails fast or blocks deliberately — it never
  grows unbounded. Surface the limit.
- **Make shared state race-free and prove it** with the language's race/concurrency
  tooling. Guard mutable state or confine it to one owner; hand out copies, not
  internal pointers.
- **Shut down gracefully:** stop accepting work, cancel in-flight tasks, drain,
  exit within a timeout.

## Reliability & failure handling

- **Design for partial failure.** In fan-out/multi-step work, decide explicitly:
  fail-fast vs continue-on-error, and record per-item status.
- **Idempotency** for anything retryable or redeliverable (keys, upserts, dedup).
- **Timeouts on every external call.** No unbounded waits.
- **Validate input at the boundary** and reject early with a clear, typed error;
  check structural invariants before expensive work.

## Error handling

- **Typed, inspectable errors,** wrapped with context; let callers branch on type,
  not on matching message text.
- **No silent failures.** Handle, wrap-and-return, or log with enough context
  (which operation, which key/id) to debug from one line.
- **Don't crash across API boundaries.** Return errors; reserve hard failures for
  truly unrecoverable programmer bugs.
- **Errors carry actionable context** — the resource/URL/id involved, not just
  "operation failed."

## Security

- **Treat all external input as hostile.** Validate and authorize on the
  server/trusted layer; never rely on client- or caller-side checks — anyone can
  craft a raw request that bypasses your UI/SDK.
- **Authorize every sensitive operation,** not just the entry route. Authentication
  ≠ authorization. **Fail closed** (deny by default).
- **Least privilege** for every credential, token, DB role, and CI job.
- **Never commit or ship secrets.** Keep them out of source, logs, and any
  client-delivered bundle; load from env or a secrets manager.
- **Don't log secrets or PII;** sanitize untrusted data before storing or rendering
  it (injection/XSS/SQL).
- **Parameterize queries; whitelist identifiers.** Values always flow through bind
  parameters, never string interpolation. When you must interpolate something that
  *can't* be a parameter (a column/table name, sort direction), validate it against a
  fixed allowlist/enum first — never build SQL from caller- or model-supplied input.
- **Keep dependencies patched** and mind the supply chain (pin, audit, minimal deps).

## Testing

- **Parameterized/table-driven tests** for multi-case units. Test behavior and edge
  cases, not implementation details.
- **Golden-file tests** for generators, serializers, and rendered output; regenerate
  intentionally and review the diff.
- **Exercise concurrency** with the race detector / stress runs; assert on
  observable outcomes, not timing.
- **Mock at the interface boundary** so units don't hit the network; keep a smaller
  set of integration tests for the real wiring.
- **A bug fix ships with a regression test** that fails before the fix.
- Respect the repo's coverage floor; cover core logic, not generated code.

## CI/CD & delivery

- **Pipeline gates:** lint → typecheck → tests → build → integration → publish.
  Merges blocked on required checks.
- **Conventional Commits** with scopes; focused, reviewable commits.
- **Least-privilege CI:** minimal permissions, short-lived/OIDC credentials over
  static secrets, pinned actions, gated dependency auto-merge.
- **Changelog as fragments** built at release time, not hand-edited. Semantic
  versioning.
- **Containers:** multi-stage builds, minimal/non-root runtime images.
- Commit or push only when asked; branch before committing on a default branch.

## Code style & craft

- **Write code that reads like the surrounding code** — match naming, comment
  density, layout, and idioms already present.
- Comment the *why*, not the *what*; explain non-obvious tradeoffs.
- Small, single-purpose functions and files; clear names over cleverness.
- No dead code, commented-out blocks, or stray debug output in committed code.
- Keep public surfaces small; expose the minimum.

## Definition of done

- [ ] Solves the actual problem; edge cases and failure modes handled.
- [ ] Concurrency bounded, cancellable, race-free.
- [ ] Errors typed/wrapped with context; no silent failures.
- [ ] Tests cover the change (incl. a regression test for any bug fix).
- [ ] Lint / typecheck / format clean.
- [ ] Reads like the existing codebase; scaling/production seams are visible.
- [ ] You can state, in one paragraph, the design, its main failure mode, and what
      was intentionally left out.
