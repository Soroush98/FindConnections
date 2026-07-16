/**
 * TC-SEC — abuse-input corpus & control-enforcement tests (traces: R1, R5, R10).
 * Every declared control must demonstrably enforce; every abusive input must
 * be handled gracefully: no 500s, no partial effects, no internals leaked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  adminService: { verifySession: vi.fn() },
  suggestionService: { invalidateCache: vi.fn(), getSuggestions: vi.fn() },
  connectionService: { findConnections: vi.fn() },
  ingestionService: { ingestPair: vi.fn() },
}));

vi.mock('@/lib/db/storage', () => ({
  storageHelpers: {
    listKeys: vi.fn(),
    upload: vi.fn(),
    publicUrl: vi.fn((key: string) => `https://bucket.test/${encodeURIComponent(key)}`),
  },
}));

vi.mock('@/lib/repositories', () => ({
  connectionRepository: { createConnection: vi.fn() },
  adminRepository: {},
  suggestionRepository: {},
}));

import { POST as uploadRoute } from '@/app/api/admin/admin-upload/route';
import { POST as ingestRoute } from '@/app/api/admin/ingest-pair/route';
import { GET as connectionsRoute } from '@/app/api/general/connections/route';
import { adminService, connectionService, ingestionService } from '@/lib/services';
import { storageHelpers } from '@/lib/db/storage';
import { connectionRepository } from '@/lib/repositories';
import { ABUSE_NAME_INPUTS, getRequest, postForm, postJson } from '../helpers/testUtils';
import { ErrorBodySchema, expectContract } from '../helpers/contracts';

const verifySession = vi.mocked(adminService.verifySession);
const upload = vi.mocked(storageHelpers.upload);
const listKeys = vi.mocked(storageHelpers.listKeys);
const createConnection = vi.mocked(connectionRepository.createConnection);
const findConnections = vi.mocked(connectionService.findConnections);
const ingestPair = vi.mocked(ingestionService.ingestPair);

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

function uploadForm(firstName: string): FormData {
  const form = new FormData();
  form.append('firstPersonFullName', firstName);
  form.append('secondPersonFullName', 'Jane Roe');
  form.append('file', new File([JPEG], 'photo.jpg', { type: 'image/jpeg' }));
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  verifySession.mockResolvedValue({ email: 'admin@test.com', role: 'admin' });
  listKeys.mockResolvedValue([]);
  ingestPair.mockResolvedValue({ added: false, attempts: [] });
  findConnections.mockResolvedValue([]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('admin-upload name gate vs abuse corpus (TC-SEC-001)', () => {
  it.each(ABUSE_NAME_INPUTS)('$label — rejected 4xx, never 500, no side effects', async ({ value }) => {
    const res = await uploadRoute(postForm('/api/admin/admin-upload', uploadForm(value)));

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expectContract(ErrorBodySchema, await res.json());
    expect(upload).not.toHaveBeenCalled();
    expect(createConnection).not.toHaveBeenCalled();
  });
});

describe('ingest-pair name gate vs abuse corpus (TC-SEC-002)', () => {
  it.each(ABUSE_NAME_INPUTS)('$label — 400 with no pipeline call', async ({ value }) => {
    const res = await ingestRoute(
      postJson('/api/admin/ingest-pair', { personA: value, personB: 'Jane Roe' })
    );
    expect(res.status).toBe(400);
    expect(ingestPair).not.toHaveBeenCalled();
  });
});

describe('public connections endpoint vs hostile queries (TC-SEC-003)', () => {
  it.each([
    ['cypher injection', "a' })-[]-() DETACH DELETE p //"],
    ['oversized', 'a'.repeat(10_000)],
    ['unicode', 'Јohn 💥Doe'],
  ])('%s — passed as data, never crashes', async (_label, hostile) => {
    const res = await connectionsRoute(
      getRequest('/api/general/connections', { name1: hostile, name2: 'C D' })
    );
    expect(res.status).toBeLessThan(500);
    // The value reaches the service verbatim as a parameter, not as query text
    // (parameterization itself is pinned in TC-REPO-001).
    expect(findConnections).toHaveBeenCalledWith(hostile, 'C D');
  });
});

describe('declared controls actually enforce (TC-SEC-004)', () => {
  it('every admin mutation route rejects an anonymous caller', async () => {
    verifySession.mockRejectedValue(
      (await import('@/lib/errors')).AppError.unauthorized()
    );

    const results = await Promise.all([
      uploadRoute(postForm('/api/admin/admin-upload', uploadForm('John Doe'))),
      ingestRoute(postJson('/api/admin/ingest-pair', { personA: 'John Doe', personB: 'Jane Roe' })),
    ]);

    for (const res of results) {
      expect(res.status).toBe(401);
    }
    expect(upload).not.toHaveBeenCalled();
    expect(ingestPair).not.toHaveBeenCalled();
  });

  // Public-API rate limiting (DEF-008 fixed) is enforced in middleware and
  // verified in tests/unit/middleware.test.ts (TC-MW-002).
});

describe('secrets never reach the client (TC-SEC-005)', () => {
  it('a repository crash carrying credentials yields only the generic body', async () => {
    findConnections.mockRejectedValue(
      new Error('Neo.ClientError auth failed for neo4j:s3cretPassw0rd@bolt://10.0.0.5')
    );
    const res = await connectionsRoute(
      getRequest('/api/general/connections', { name1: 'A B', name2: 'C D' })
    );
    const raw = JSON.stringify(await res.json());
    expect(res.status).toBe(500);
    expect(raw).not.toContain('s3cretPassw0rd');
    expect(raw).not.toContain('bolt://');
    expect(raw).not.toContain('Neo.ClientError');
  });
});
