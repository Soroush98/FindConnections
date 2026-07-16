import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

/** Build a GET NextRequest with query params. */
export function getRequest(pathname: string, params: Record<string, string> = {}): NextRequest {
  const url = new URL(`http://localhost:3000${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

/** Build a POST NextRequest with a JSON body. */
export function postJson(pathname: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** Build a POST NextRequest with multipart form data. */
export function postForm(pathname: string, form: FormData): NextRequest {
  return new NextRequest(`http://localhost:3000${pathname}`, {
    method: 'POST',
    body: form,
  });
}

/** Sign a JWT the way adminService.login does. */
export function signAdminToken(
  payload: Record<string, unknown> = { email: 'admin@test.com', role: 'admin' },
  options: jwt.SignOptions = { expiresIn: '8h' },
  secret: string = process.env.SECRET_KEY as string
): string {
  return jwt.sign(payload, secret, options);
}

/**
 * Fake Neo4j session covering the surface the repositories use.
 * Queue result records per-run in FIFO order with `queueResult`.
 */
export function fakeNeo4jSession() {
  const results: Array<{ records: Array<{ get: (key: string) => unknown }> }> = [];
  const runCalls: Array<{ query: string; params: Record<string, unknown> | undefined }> = [];

  return {
    runCalls,
    queueResult(records: Array<Record<string, unknown>>) {
      results.push({
        records: records.map((row) => ({ get: (key: string) => row[key] })),
      });
    },
    session: {
      run: async (query: string, params?: Record<string, unknown>) => {
        runCalls.push({ query, params });
        return results.shift() ?? { records: [] };
      },
      close: async () => {},
    },
  };
}

/** Neo4j integers come back as objects with toNumber(). */
export function neoInt(value: number) {
  return { toNumber: () => value };
}

/** Standard error-body contract shared by every endpoint. */
export interface ErrorBody {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

/**
 * Abuse-input corpus for name fields. Every entry MUST be rejected with a 4xx
 * and produce no partial effect (never a 500, never a write). Homograph names
 * made of real unicode letters (e.g. Cyrillic look-alikes) are intentionally
 * NOT here -- they are accepted as valid names, which is a data nuance, not an
 * injection or crash risk.
 */
export const ABUSE_NAME_INPUTS: Array<{ label: string; value: string }> = [
  { label: 'cypher injection', value: "a' })-[]-() DETACH DELETE p //" },
  { label: 'sql injection', value: "Robert'); DROP TABLE admins;--" },
  { label: 'path traversal', value: '../../etc/passwd' },
  { label: 'null byte', value: 'John\u0000 Doe' },
  { label: 'html/script tag', value: '<script>alert(1)</script> x' },
  { label: 'emoji', value: 'John \ud83d\udca5Doe' },
  { label: 'newline smuggling', value: 'John\nDoe Doe' },
  { label: 'single word', value: 'Prince' },
  { label: 'digits', value: 'John Do3' },
  { label: 'empty string', value: '' },
  { label: 'whitespace only', value: '   ' },
  { label: 'tab separator', value: 'John\tDoe' },
  { label: 'newline separator', value: 'John\nDoe' },
  { label: 'oversized 10k chars', value: `${'a'.repeat(5000)} ${'b'.repeat(5000)}` },
];
