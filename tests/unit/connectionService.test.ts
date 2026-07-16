/**
 * TC-CONN-SVC — connection service business logic (traces: R2, R3, R4).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/repositories', () => ({
  connectionRepository: {
    findShortestPath: vi.fn(),
    getConnectionWithImage: vi.fn(),
    deleteConnection: vi.fn(),
    deletePersonNode: vi.fn(),
    createConnection: vi.fn(),
    connectionExists: vi.fn(),
  },
}));

vi.mock('@/lib/db/storage', () => ({
  storageHelpers: {
    keyFromPublicUrl: vi.fn(),
    remove: vi.fn(),
  },
}));

import { connectionService } from '@/lib/services/connectionService';
import { connectionRepository } from '@/lib/repositories';
import { storageHelpers } from '@/lib/db/storage';

const repo = vi.mocked(connectionRepository);
const storage = vi.mocked(storageHelpers);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('findConnections (TC-CONN-SVC-001)', () => {
  it('delegates to the repository for valid names', async () => {
    repo.findShortestPath.mockResolvedValue([]);
    await connectionService.findConnections('John Doe', 'Jane Roe');
    expect(repo.findShortestPath).toHaveBeenCalledWith('John Doe', 'Jane Roe');
  });

  it('rejects empty names with a 400', async () => {
    await expect(connectionService.findConnections('', 'Jane Roe')).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe('deleteConnection (TC-CONN-SVC-002)', () => {
  it('404s when the connection does not exist, deleting nothing', async () => {
    repo.getConnectionWithImage.mockResolvedValue(null);
    await expect(connectionService.deleteConnection('A B', 'C D')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(repo.deleteConnection).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('deletes the edge, then the storage object', async () => {
    repo.getConnectionWithImage.mockResolvedValue({ imageUrl: 'https://x/public/connection-images/A B_C D.jpg' });
    storage.keyFromPublicUrl.mockReturnValue('A B_C D.jpg');

    await connectionService.deleteConnection('A B', 'C D');

    expect(repo.deleteConnection).toHaveBeenCalledWith('A B', 'C D');
    expect(storage.remove).toHaveBeenCalledWith('A B_C D.jpg');
  });

  it('still succeeds when storage deletion fails (graph is source of truth)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    repo.getConnectionWithImage.mockResolvedValue({ imageUrl: 'https://x/img.jpg' });
    storage.keyFromPublicUrl.mockReturnValue('img.jpg');
    storage.remove.mockRejectedValue(new Error('storage down'));

    await expect(connectionService.deleteConnection('A B', 'C D')).resolves.toBeUndefined();
    expect(repo.deleteConnection).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('skips storage removal when the URL is foreign (key not parseable)', async () => {
    repo.getConnectionWithImage.mockResolvedValue({ imageUrl: 'https://evil.example.com/x.jpg' });
    storage.keyFromPublicUrl.mockReturnValue(null);

    await connectionService.deleteConnection('A B', 'C D');
    expect(storage.remove).not.toHaveBeenCalled();
  });
});

describe('deletePersonNode (TC-CONN-SVC-003)', () => {
  it('409s when the person still has relationships', async () => {
    repo.deletePersonNode.mockResolvedValue(false);
    await expect(connectionService.deletePersonNode('John Doe')).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('succeeds for an isolated node', async () => {
    repo.deletePersonNode.mockResolvedValue(true);
    await expect(connectionService.deletePersonNode('John Doe')).resolves.toBeUndefined();
  });
});

describe('createConnection (TC-CONN-SVC-004)', () => {
  it('409s when the connection already exists (undirected check)', async () => {
    repo.connectionExists.mockResolvedValue(true);
    await expect(
      connectionService.createConnection('A B', 'C D', 'https://x/img.jpg')
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.createConnection).not.toHaveBeenCalled();
  });

  it('creates when no connection exists', async () => {
    repo.connectionExists.mockResolvedValue(false);
    await connectionService.createConnection('A B', 'C D', 'https://x/img.jpg');
    expect(repo.createConnection).toHaveBeenCalledWith('A B', 'C D', 'https://x/img.jpg');
  });
});
