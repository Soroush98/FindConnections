/**
 * TC-REPO — Neo4j repository query semantics (traces: R2, R3, R4).
 * These tests pin the DIRECTION semantics of each Cypher query, because the
 * mismatch between the undirected exists-check and the directed get/delete
 * is the root of defect DEF-001.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeNeo4jSession, neoInt } from '../helpers/testUtils';

const fake = fakeNeo4jSession();

vi.mock('@/lib/db', () => ({
  getNeo4jSession: () => fake.session,
}));

import { connectionRepository } from '@/lib/repositories/connectionRepository';

beforeEach(() => {
  fake.runCalls.length = 0;
});

describe('findShortestPath (TC-REPO-001)', () => {
  it('maps a path record into segments and imageUrls', async () => {
    fake.queueResult([
      {
        path: {
          segments: [
            {
              start: { properties: { name: 'A B' } },
              relationship: { type: 'PHOTOGRAPHED_WITH', properties: { imageUrl: 'https://x/1.jpg' } },
              end: { properties: { name: 'C D' } },
            },
            {
              start: { properties: { name: 'C D' } },
              relationship: { type: 'PHOTOGRAPHED_WITH', properties: { imageUrl: 'https://x/2.jpg' } },
              end: { properties: { name: 'E F' } },
            },
          ],
        },
      },
    ]);

    const paths = await connectionRepository.findShortestPath('A B', 'E F');

    expect(paths).toHaveLength(1);
    expect(paths[0].segments).toEqual([
      { start: 'A B', relationship: 'PHOTOGRAPHED_WITH', end: 'C D', imageUrl: 'https://x/1.jpg' },
      { start: 'C D', relationship: 'PHOTOGRAPHED_WITH', end: 'E F', imageUrl: 'https://x/2.jpg' },
    ]);
    expect(paths[0].imageUrls).toEqual(['https://x/1.jpg', 'https://x/2.jpg']);
  });

  it('returns [] when no path exists', async () => {
    fake.queueResult([]);
    expect(await connectionRepository.findShortestPath('A B', 'Z Z')).toEqual([]);
  });

  it('passes names as parameters, never interpolated into Cypher (injection safety)', async () => {
    fake.queueResult([]);
    const hostile = "a' })-[]-() DETACH DELETE p //";
    await connectionRepository.findShortestPath(hostile, 'C D');

    const call = fake.runCalls[0];
    expect(call.params).toEqual({ name1: hostile, name2: 'C D' });
    expect(call.query).not.toContain(hostile);
  });
});

describe('direction semantics (TC-REPO-002, DEF-001 fixed: all reads/writes undirected)', () => {
  it('connectionExists matches edges in EITHER direction', async () => {
    fake.queueResult([{ count: neoInt(1) }]);
    await connectionRepository.connectionExists('A B', 'C D');
    const match = fake.runCalls[0].query;
    expect(match).toContain('-[:PHOTOGRAPHED_WITH]-');
    expect(match).not.toContain('->');
  });

  it('getConnectionWithImage matches edges in EITHER direction (was directed — DEF-001)', async () => {
    fake.queueResult([]);
    await connectionRepository.getConnectionWithImage('A B', 'C D');
    expect(fake.runCalls[0].query).not.toContain('->');
    expect(fake.runCalls[0].query).toContain('-[r:PHOTOGRAPHED_WITH]-');
  });

  it('deleteConnection matches edges in EITHER direction, so order no longer matters (DEF-001)', async () => {
    fake.queueResult([]);
    await connectionRepository.deleteConnection('A B', 'C D');
    expect(fake.runCalls[0].query).not.toContain('->');
    expect(fake.runCalls[0].query).toContain('-[r:PHOTOGRAPHED_WITH]-');
  });
});

describe('deletePersonNode (TC-REPO-003)', () => {
  it('refuses to delete a node with relationships and runs no DELETE', async () => {
    fake.queueResult([{ relCount: neoInt(3) }]);
    const deleted = await connectionRepository.deletePersonNode('A B');
    expect(deleted).toBe(false);
    expect(fake.runCalls).toHaveLength(1); // only the check query ran
  });

  it('deletes an isolated node', async () => {
    fake.queueResult([{ relCount: neoInt(0) }]);
    fake.queueResult([]);
    const deleted = await connectionRepository.deletePersonNode('A B');
    expect(deleted).toBe(true);
    expect(fake.runCalls).toHaveLength(2);
    expect(fake.runCalls[1].query).toContain('DELETE');
  });
});

describe('createConnection (TC-REPO-004, DEF-001 fixed: idempotent undirected MERGE)', () => {
  it('MERGEs people and the relationship undirected, setting imageUrl only on create', async () => {
    fake.queueResult([]);
    await connectionRepository.createConnection('A B', 'C D', 'https://x/1.jpg');
    const query = fake.runCalls[0].query;
    expect(query).toContain('MERGE (p1:Person');
    expect(query).toContain('MERGE (p2:Person');
    // Relationship MERGE is undirected (no arrowhead) → no duplicate edge for a
    // pair already connected in either direction.
    expect(query).toMatch(/MERGE \(p1\)-\[r:PHOTOGRAPHED_WITH\]-\(p2\)/);
    expect(query).not.toMatch(/CREATE \(p1\)-\[/);
    expect(query).toContain('ON CREATE SET r.imageUrl');
  });
});

describe('getTopPeopleByDegree (TC-REPO-005)', () => {
  it('floors fractional limits and clamps to at least 1 (BVA)', async () => {
    fake.queueResult([]);
    await connectionRepository.getTopPeopleByDegree(0.4);
    expect(fake.runCalls[0].params).toEqual({ limit: 1 });

    fake.queueResult([]);
    await connectionRepository.getTopPeopleByDegree(7.9);
    expect(fake.runCalls[1].params).toEqual({ limit: 7 });
  });

  it('returns names in result order', async () => {
    fake.queueResult([{ name: 'Popular Person' }, { name: 'Second Person' }]);
    expect(await connectionRepository.getTopPeopleByDegree(2)).toEqual([
      'Popular Person',
      'Second Person',
    ]);
  });
});
