/**
 * TC-AUTH-SVC — admin authentication service (traces: R1).
 * Technique: state-transition testing over the session lifecycle
 * (no cookie → valid → tampered → expired → wrong role), plus negative
 * login partitions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const cookieJar = new Map<string, string>();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined,
  }),
}));

vi.mock('@/lib/repositories', () => ({
  adminRepository: {
    findByEmail: vi.fn(),
    findById: vi.fn(),
  },
}));

import { adminService } from '@/lib/services/adminService';
import { adminRepository } from '@/lib/repositories';
import { AppError } from '@/lib/errors';

const findByEmail = vi.mocked(adminRepository.findByEmail);
const SECRET = process.env.SECRET_KEY as string;

beforeEach(() => {
  vi.clearAllMocks();
  cookieJar.clear();
});

describe('login (TC-AUTH-SVC-001)', () => {
  const PASSWORD = 'correct horse battery staple';
  let passwordHash: string;

  beforeEach(async () => {
    passwordHash = await bcrypt.hash(PASSWORD, 4);
  });

  it('returns a signed admin JWT for valid credentials', async () => {
    findByEmail.mockResolvedValue({ Id: '1', Email: 'admin@test.com', Password: passwordHash });

    const token = await adminService.login('admin@test.com', PASSWORD);
    const decoded = jwt.verify(token, SECRET) as { email: string; role: string; exp: number; iat: number };

    expect(decoded.email).toBe('admin@test.com');
    expect(decoded.role).toBe('admin');
    expect(decoded.exp - decoded.iat).toBe(8 * 60 * 60); // 8h expiry
  });

  it('rejects an unknown email with the same error as a bad password (no user enumeration)', async () => {
    findByEmail.mockResolvedValue(null);
    const unknownEmail = adminService.login('nobody@test.com', PASSWORD).catch((e) => e);

    findByEmail.mockResolvedValue({ Id: '1', Email: 'admin@test.com', Password: passwordHash });
    const badPassword = adminService.login('admin@test.com', 'wrong').catch((e) => e);

    const [e1, e2] = await Promise.all([unknownEmail, badPassword]);
    expect(e1).toBeInstanceOf(AppError);
    expect(e2).toBeInstanceOf(AppError);
    expect(e1.message).toBe(e2.message); // identical message either way
    expect(e1.statusCode).toBe(e2.statusCode);
  });
});

describe('verifySession lifecycle (TC-AUTH-SVC-002)', () => {
  it('rejects when no cookie is present (401)', async () => {
    await expect(adminService.verifySession()).rejects.toMatchObject({ statusCode: 401 });
  });

  it('accepts a valid admin token', async () => {
    cookieJar.set('admin-token', jwt.sign({ email: 'a@t.com', role: 'admin' }, SECRET, { expiresIn: '8h' }));
    await expect(adminService.verifySession()).resolves.toMatchObject({
      email: 'a@t.com',
      role: 'admin',
    });
  });

  it('rejects a token signed with the wrong secret', async () => {
    cookieJar.set(
      'admin-token',
      jwt.sign({ email: 'a@t.com', role: 'admin' }, 'attacker-secret-key-32-characters!!', { expiresIn: '8h' })
    );
    await expect(adminService.verifySession()).rejects.toMatchObject({ name: 'JsonWebTokenError' });
  });

  it('rejects a tampered token', async () => {
    const token = jwt.sign({ email: 'a@t.com', role: 'admin' }, SECRET, { expiresIn: '8h' });
    cookieJar.set('admin-token', token.slice(0, -3) + 'xyz');
    await expect(adminService.verifySession()).rejects.toMatchObject({ name: 'JsonWebTokenError' });
  });

  it('rejects an expired token', async () => {
    cookieJar.set('admin-token', jwt.sign({ email: 'a@t.com', role: 'admin' }, SECRET, { expiresIn: '-1s' }));
    await expect(adminService.verifySession()).rejects.toMatchObject({ name: 'TokenExpiredError' });
  });

  it('rejects a validly-signed token whose role is not admin (403)', async () => {
    cookieJar.set('admin-token', jwt.sign({ email: 'a@t.com', role: 'user' }, SECRET, { expiresIn: '8h' }));
    await expect(adminService.verifySession()).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('verifyToken (TC-AUTH-SVC-003)', () => {
  it('accepts a valid admin token and rejects a non-admin role', () => {
    const good = jwt.sign({ email: 'a@t.com', role: 'admin' }, SECRET);
    expect(adminService.verifyToken(good).email).toBe('a@t.com');

    const wrongRole = jwt.sign({ email: 'a@t.com', role: 'viewer' }, SECRET);
    expect(() => adminService.verifyToken(wrongRole)).toThrowError();
  });
});
