/**
 * TC-API-AUTH — admin session lifecycle over the HTTP surface (traces: R1).
 * Uses the REAL adminService + JWT stack; only the repository and the Next.js
 * cookie store are faked. State-transition coverage:
 *   anonymous → bad login → good login → verified → expired/tampered → logout
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const cookieJar = new Map<string, string>();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined,
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
  }),
}));

vi.mock('@/lib/repositories', () => ({
  adminRepository: { findByEmail: vi.fn(), findById: vi.fn() },
  connectionRepository: {},
  suggestionRepository: {},
}));

import { POST as loginRoute } from '@/app/api/admin/admin-login/route';
import { GET as verifySessionRoute } from '@/app/api/admin/verify-session/route';
import { POST as logoutRoute } from '@/app/api/admin/logout/route';
import { adminRepository } from '@/lib/repositories';
import { postJson, getRequest } from '../helpers/testUtils';
import { ErrorBodySchema, LoginSuccessSchema, expectContract } from '../helpers/contracts';

const findByEmail = vi.mocked(adminRepository.findByEmail);
const SECRET = process.env.SECRET_KEY as string;
const PASSWORD = 'correct horse battery staple';

beforeEach(async () => {
  vi.clearAllMocks();
  cookieJar.clear();
  findByEmail.mockResolvedValue({
    Id: '1',
    Email: 'admin@test.com',
    Password: await bcrypt.hash(PASSWORD, 4),
  });
});

describe('POST /api/admin/admin-login (TC-API-AUTH-001)', () => {
  it('rejects malformed JSON with 400, not 500', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await loginRoute(postJson('/api/admin/admin-login', '{not json'));
    expect(res.status).toBe(400);
    expectContract(ErrorBodySchema, await res.json());
    consoleSpy.mockRestore();
  });

  it.each([
    ['missing email', { password: 'x' }],
    ['missing password', { email: 'a@t.com' }],
    ['empty strings', { email: '', password: '' }],
    ['non-string types', { email: 123, password: ['x'] }],
  ])('rejects %s with 400', async (_label, body) => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await loginRoute(postJson('/api/admin/admin-login', body));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('MISSING_REQUIRED_FIELDS');
    consoleSpy.mockRestore();
  });

  it('rejects wrong password and unknown email with identical responses (no enumeration)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrongPw = await loginRoute(
      postJson('/api/admin/admin-login', { email: 'admin@test.com', password: 'nope' })
    );

    findByEmail.mockResolvedValue(null);
    const unknown = await loginRoute(
      postJson('/api/admin/admin-login', { email: 'ghost@test.com', password: PASSWORD })
    );

    expect(wrongPw.status).toBe(unknown.status);
    expect(await wrongPw.json()).toEqual(await unknown.json());
    consoleSpy.mockRestore();
  });

  it('sets an httpOnly, sameSite=strict, 8h admin-token cookie on success', async () => {
    const res = await loginRoute(
      postJson('/api/admin/admin-login', { email: 'admin@test.com', password: PASSWORD })
    );

    expect(res.status).toBe(200);
    expectContract(LoginSuccessSchema, await res.json());

    const cookie = res.cookies.get('admin-token');
    expect(cookie).toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.sameSite).toBe('strict');
    expect(cookie!.maxAge).toBe(8 * 60 * 60);
    expect(cookie!.path).toBe('/');

    // The cookie value is a verifiable admin JWT.
    const decoded = jwt.verify(cookie!.value, SECRET) as { role: string };
    expect(decoded.role).toBe('admin');
  });

  it('never reflects the password back in any part of the response', async () => {
    const res = await loginRoute(
      postJson('/api/admin/admin-login', { email: 'admin@test.com', password: PASSWORD })
    );
    const raw = JSON.stringify(await res.json()) + JSON.stringify([...res.headers.entries()]);
    expect(raw).not.toContain(PASSWORD);
  });
});

describe('GET /api/admin/verify-session (TC-API-AUTH-002, session state machine)', () => {
  const validToken = () =>
    jwt.sign({ email: 'admin@test.com', role: 'admin' }, SECRET, { expiresIn: '8h' });

  it('anonymous (no cookie) → 401 UNAUTHORIZED', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await verifySessionRoute(getRequest('/api/admin/verify-session'));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('UNAUTHORIZED');
    consoleSpy.mockRestore();
  });

  it('valid session → 200 with the admin email', async () => {
    cookieJar.set('admin-token', validToken());
    const res = await verifySessionRoute(getRequest('/api/admin/verify-session'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Authenticated', email: 'admin@test.com' });
  });

  it('expired token → 401 TOKEN_EXPIRED', async () => {
    cookieJar.set(
      'admin-token',
      jwt.sign({ email: 'admin@test.com', role: 'admin' }, SECRET, { expiresIn: '-1s' })
    );
    const res = await verifySessionRoute(getRequest('/api/admin/verify-session'));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('TOKEN_EXPIRED');
  });

  it('tampered token → 401 INVALID_TOKEN', async () => {
    cookieJar.set('admin-token', validToken().slice(0, -3) + 'xyz');
    const res = await verifySessionRoute(getRequest('/api/admin/verify-session'));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('INVALID_TOKEN');
  });

  it('token signed with attacker secret → 401 INVALID_TOKEN', async () => {
    cookieJar.set(
      'admin-token',
      jwt.sign({ email: 'admin@test.com', role: 'admin' }, 'attacker-secret-key-32-characters!!')
    );
    const res = await verifySessionRoute(getRequest('/api/admin/verify-session'));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('INVALID_TOKEN');
  });

  it('valid signature but non-admin role → 403 FORBIDDEN', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    cookieJar.set('admin-token', jwt.sign({ email: 'user@test.com', role: 'user' }, SECRET));
    const res = await verifySessionRoute(getRequest('/api/admin/verify-session'));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('FORBIDDEN');
    consoleSpy.mockRestore();
  });
});

describe('POST /api/admin/logout (TC-API-AUTH-003)', () => {
  it('clears the session cookie; subsequent verify fails (full lifecycle)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // login
    const login = await loginRoute(
      postJson('/api/admin/admin-login', { email: 'admin@test.com', password: PASSWORD })
    );
    cookieJar.set('admin-token', login.cookies.get('admin-token')!.value);

    // verified
    expect((await verifySessionRoute(getRequest('/api/admin/verify-session'))).status).toBe(200);

    // logout — route writes an empty, expired cookie through next/headers
    const logout = await logoutRoute();
    expect(logout.status).toBe(200);
    expect(cookieJar.get('admin-token')).toBe('');

    // anonymous again: empty cookie value → verifySession rejects
    const after = await verifySessionRoute(getRequest('/api/admin/verify-session'));
    expect(after.status).toBe(401);
    consoleSpy.mockRestore();
  });
});
