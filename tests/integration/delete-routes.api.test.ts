/**
 * TC-API-DEL — POST /api/admin/delete-connection & /api/admin/delete-node
 * (traces: R1, R2). Destructive endpoints get the strictest negative suite.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '@/lib/errors';
import { fakeNeo4jSession, postJson } from '../helpers/testUtils';
import { ErrorBodySchema, expectContract } from '../helpers/contracts';

vi.mock('@/lib/services', () => ({
  adminService: { verifySession: vi.fn() },
  connectionService: { deleteConnection: vi.fn() },
  suggestionService: {},
  ingestionService: {},
}));

const fake = fakeNeo4jSession();
vi.mock('@/lib/db', () => ({
  getNeo4jSession: () => fake.session,
}));

vi.mock('@/lib/db/storage', () => ({
  storageHelpers: {
    keyFromPublicUrl: vi.fn((url: string) => {
      const prefix = 'https://test-project.supabase.co/storage/v1/object/public/connection-images/';
      return url.startsWith(prefix) ? decodeURIComponent(url.slice(prefix.length)) : null;
    }),
    remove: vi.fn(),
  },
}));

import { POST as deleteConnectionRoute } from '@/app/api/admin/delete-connection/route';
import { POST as deleteNodeRoute } from '@/app/api/admin/delete-node/route';
import { adminService, connectionService } from '@/lib/services';
import { storageHelpers } from '@/lib/db/storage';

const verifySession = vi.mocked(adminService.verifySession);
const deleteConnection = vi.mocked(connectionService.deleteConnection);
const remove = vi.mocked(storageHelpers.remove);

const IMG = (key: string) =>
  `https://test-project.supabase.co/storage/v1/object/public/connection-images/${encodeURIComponent(key)}`;

beforeEach(() => {
  vi.clearAllMocks();
  fake.runCalls.length = 0;
  verifySession.mockResolvedValue({ email: 'admin@test.com', role: 'admin' });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/admin/delete-connection (TC-API-DEL-001)', () => {
  it('401s without a session; nothing is deleted', async () => {
    verifySession.mockRejectedValue(AppError.unauthorized());
    const res = await deleteConnectionRoute(
      postJson('/api/admin/delete-connection', {
        firstPersonFullName: 'A B',
        secondPersonFullName: 'C D',
      })
    );
    expect(res.status).toBe(401);
    expect(deleteConnection).not.toHaveBeenCalled();
  });

  it('404s (from the service) when the connection does not exist', async () => {
    deleteConnection.mockRejectedValue(AppError.notFound('Connection'));
    const res = await deleteConnectionRoute(
      postJson('/api/admin/delete-connection', {
        firstPersonFullName: 'A B',
        secondPersonFullName: 'C D',
      })
    );
    expect(res.status).toBe(404);
    expectContract(ErrorBodySchema, await res.json());
  });

  it('200s and reports success on deletion', async () => {
    deleteConnection.mockResolvedValue(undefined);
    const res = await deleteConnectionRoute(
      postJson('/api/admin/delete-connection', {
        firstPersonFullName: 'A B',
        secondPersonFullName: 'C D',
      })
    );
    expect(res.status).toBe(200);
    expect(deleteConnection).toHaveBeenCalledWith('A B', 'C D');
  });

  it('malformed JSON body yields 400 VALIDATION_ERROR, not 500 (DEF-007 fixed)', async () => {
    const res = await deleteConnectionRoute(postJson('/api/admin/delete-connection', '{oops'));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/admin/delete-node (TC-API-DEL-002)', () => {
  it('401s without a session; no Cypher runs', async () => {
    verifySession.mockRejectedValue(AppError.unauthorized());
    const res = await deleteNodeRoute(postJson('/api/admin/delete-node', { fullName: 'A B' }));
    expect(res.status).toBe(401);
    expect(fake.runCalls).toHaveLength(0);
  });

  it('400s when fullName is missing', async () => {
    const res = await deleteNodeRoute(postJson('/api/admin/delete-node', {}));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('MISSING_REQUIRED_FIELDS');
  });

  it('404s when the person does not exist', async () => {
    fake.queueResult([]); // node check: no records
    const res = await deleteNodeRoute(postJson('/api/admin/delete-node', { fullName: 'Ghost Person' }));
    expect(res.status).toBe(404);
    expect(fake.runCalls).toHaveLength(1); // only the existence check ran
  });

  it('deletes node + relationships and removes each parseable image (TC-API-DEL-003)', async () => {
    fake.queueResult([{ p: {} }]); // node exists
    fake.queueResult([
      { imageUrl: IMG('A B_C D.jpg') },
      { imageUrl: IMG('E F_A B.png') },
      { imageUrl: null }, // edge with no image — must be skipped, not crash
      { imageUrl: 'https://foreign.example.com/x.jpg' }, // foreign URL — not ours to delete
    ]);
    fake.queueResult([]); // DETACH DELETE

    const res = await deleteNodeRoute(postJson('/api/admin/delete-node', { fullName: 'A B' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      message: 'Node and all its connections deleted successfully',
      deletedImages: 3, // counts non-null URLs found, including the foreign one
    });
    expect(fake.runCalls[2].query).toContain('DETACH DELETE');
    // Only bucket-owned keys are removed.
    expect(remove).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledWith('A B_C D.jpg');
    expect(remove).toHaveBeenCalledWith('E F_A B.png');
  });

  it('still 200s when one storage removal fails (graph deletion already committed)', async () => {
    fake.queueResult([{ p: {} }]);
    fake.queueResult([{ imageUrl: IMG('A B_C D.jpg') }]);
    fake.queueResult([]);
    remove.mockRejectedValue(new Error('storage down'));

    const res = await deleteNodeRoute(postJson('/api/admin/delete-node', { fullName: 'A B' }));
    expect(res.status).toBe(200);
  });
});
