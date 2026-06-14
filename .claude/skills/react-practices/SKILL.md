---
name: react-practices
description: >-
  Modern React + TypeScript idioms (React 19 era) — Server vs Client Components,
  Server Actions, data fetching, the React Compiler, reusability, performance, and
  frontend security. Apply when writing, reviewing, or refactoring React UI —
  .tsx/.jsx components, hooks, data fetching, or client state. Complements
  engineering-principles (stack-agnostic rules); this is the React/TS-specific layer.
---

# React Practices

Production-grade React + TypeScript as of **React 19 / React Compiler 1.0**. Defer
to `engineering-principles` for general rules. Match the existing app's style and
framework — don't drag an RSC project toward an SPA pattern or vice versa.

## Pick the architecture first

- **New app → Server Components by default** (Next.js App Router, Remix, or another
  RSC framework). Fetch data on the server, ship less JS, add `"use client"` only at
  the leaves that need interactivity/browser APIs. Keep the client boundary as small
  and as low in the tree as possible.
- **Existing SPA (Vite/CRA, no RSC) → that's still valid.** Use a server-state
  library (TanStack Query / SWR) as the "server" layer. Don't bolt RSC concepts onto
  it; apply the SPA guidance below.
- Be explicit about which model the file is in — the rules differ.

## Server vs client split (RSC)

- **Server Components** do data fetching and heavy/sensitive work; they never ship to
  the browser, so secrets and big deps stay server-side.
- **`"use client"`** only for state, effects, event handlers, or browser APIs. Push
  it down: a static page with one interactive widget should have one small client
  component, not a client root.
- **Mutations → Server Actions** (`"use server"`) over hand-rolled API routes.
  **Every Server Action is a public endpoint:** validate input and check
  authorization *inside the action* — never trust that the client form gated it.
- **Stream with `<Suspense>`** around slow server components for fast first paint.

## Data fetching & mutations

- **RSC:** fetch in Server Components; use the **`use()`** hook to read promises/
  context; wrap in `<Suspense>`. Prefer this over client `useEffect` fetching.
- **SPA:** TanStack Query/SWR for all server data — caching, dedup, background
  refetch, polling. Don't hand-roll `useEffect` + loading/error `useState`.
- **Forms/mutations:** React 19 **Actions** + `useActionState` for pending/error
  state, and **`useOptimistic`** for optimistic UI with automatic rollback.
- **Effects are a last resort** — only to synchronize with external systems, never to
  transform data for render. When you must: complete dep arrays, cleanup functions,
  cancel in-flight requests with `AbortController`, and ignore out-of-order results.

## Performance (Compiler-first)

- **Enable the React Compiler and rely on it.** It auto-inserts memoization at build
  time, so **do not reflexively add `useMemo`/`useCallback`/`React.memo`** — that's
  now mostly noise. Write clean, idiomatic components and let the compiler optimize.
- **Manual memoization is an escape hatch**, justified by a measured hot path the
  compiler can't handle — not a default.
- **Still your job (the compiler won't do these):** virtualize long lists/tables/
  graphs, code-split routes/heavy components (`lazy` + `Suspense`), stable list keys
  (never array index for dynamic lists), avoid unnecessary client JS, and reduce
  network waterfalls (parallelize fetches, colocate on the server).

## Reusability & composition

- **Custom hooks** for reusable stateful logic; keep them small and single-purpose.
- **Composition over configuration:** prefer `children`/slots and **compound
  components** over a component with 20 boolean props.
- **Headless/primitive pattern:** separate behavior (hook/headless lib) from
  presentation so the same logic styles many ways.
- **Avoid prop drilling** via composition or context — but don't reach for context
  for high-frequency state (it re-renders all consumers).
- **Don't abstract prematurely.** Duplicate twice before extracting; a wrong
  abstraction costs more than repetition.

## Security (frontend is a trust boundary, not a guard)

- **Never trust the client.** Validate and authorize **on the server** for every
  Server Action / API call (e.g. with Zod) — an attacker bypasses your UI with a raw
  request. Client-side validation is UX only.
- **No secrets in the client bundle.** Anything in client code or a `NEXT_PUBLIC_*`/
  `VITE_*` env var is public. Keep keys server-side.
- **Don't store tokens in `localStorage`/`sessionStorage`** — any XSS can read them.
  Use httpOnly, Secure, SameSite cookies for sessions.
- **XSS:** JSX auto-escapes — rely on it. Avoid `dangerouslySetInnerHTML`; if
  unavoidable, sanitize with **DOMPurify** first. Never build markup from unsanitized
  user input.
- **Imperative HTML sinks bypass JSX escaping.** `el.innerHTML` and third-party
  `setHTML`/`setContent` APIs (map popups, chart tooltips, rich-text editors) are
  *not* auto-escaped — escape or sanitize the data yourself before passing it in,
  even when it came from your own backend.
- **Links:** `target="_blank"` needs `rel="noopener noreferrer"`. Validate/allowlist
  any user-supplied URL (block `javascript:` schemes).
- Set a **Content-Security-Policy**; keep dependencies patched (audit the supply
  chain); don't render untrusted data into `<script>`/style/attributes.

## Types, tooling, testing

- **Strict TypeScript:** `strict` on, no implicit `any`, avoid `!` to silence the
  compiler — model absence instead. Generate API types from the OpenAPI/GraphQL spec
  so the client can't drift from the backend.
- **Model state as discriminated unions** (`loading | error | ready`) over loose
  booleans. Derive values during render instead of mirroring props into state.
- **ESLint** (incl. `react-hooks` + the compiler's lint rules) + Prettier; `tsc
  --noEmit` in CI.
- **Test with React Testing Library** — assert on what the user sees, not internals.
- **Accessibility is non-negotiable:** semantic elements, labels, keyboard support,
  focus management, error boundaries around feature areas.
