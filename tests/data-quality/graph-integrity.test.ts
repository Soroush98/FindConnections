/**
 * TC-DATA — live data-quality suite (traces: R2, R3).
 *
 * READ-ONLY invariants against the REAL Neo4j graph and Supabase Storage
 * bucket. Opt-in: skipped unless RUN_LIVE_DATA_QA=1 (tests/setup.ts then
 * loads the real .env). Run with:  npm run test:live-data
 *
 * Every query here is a MATCH/RETURN or a bucket listing — nothing mutates.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import neo4j, { Driver } from 'neo4j-driver';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const LIVE = process.env.RUN_LIVE_DATA_QA === '1';
const BUCKET = 'connection-images';
const TIMEOUT = 60_000;

describe.skipIf(!LIVE)('live graph & storage integrity', () => {
  let driver: Driver;
  let supabase: SupabaseClient;
  let publicPrefix: string;

  beforeAll(() => {
    driver = neo4j.driver(
      process.env.NEO4J_URI || 'neo4j+ssc://neo4j.findconnections.net:7687',
      neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!)
    );
    supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    publicPrefix = `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
  });

  afterAll(async () => {
    await driver?.close();
  });

  async function run(query: string, params: Record<string, unknown> = {}) {
    const session = driver.session();
    try {
      return await session.run(query, params);
    } finally {
      await session.close();
    }
  }

  async function listAllKeys(): Promise<string[]> {
    const keys: string[] = [];
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase.storage.from(BUCKET).list('', { limit: 1000, offset });
      if (error) throw new Error(`storage.list: ${error.message}`);
      if (!data || data.length === 0) break;
      keys.push(...data.map((d) => d.name).filter(Boolean));
      if (data.length < 1000) break;
      offset += 1000;
    }
    return keys;
  }

  it('TC-DATA-001: no self-loop edges (a person photographed with themselves)', { timeout: TIMEOUT }, async () => {
    const result = await run(
      'MATCH (p:Person)-[r:PHOTOGRAPHED_WITH]->(p) RETURN p.name AS name LIMIT 25'
    );
    expect(result.records.map((r) => r.get('name'))).toEqual([]);
  });

  it('TC-DATA-002: no duplicate edges between the same unordered pair (DEF-001 impact check)', { timeout: TIMEOUT }, async () => {
    const result = await run(`
      MATCH (a:Person)-[r:PHOTOGRAPHED_WITH]-(b:Person)
      WHERE elementId(a) < elementId(b)
      WITH a, b, count(DISTINCT r) AS edges
      WHERE edges > 1
      RETURN a.name AS a, b.name AS b, edges
      ORDER BY edges DESC LIMIT 25
    `);
    const dupes = result.records.map((r) => `${r.get('a')} <-> ${r.get('b')} (${r.get('edges')} edges)`);
    expect(dupes, `duplicate PHOTOGRAPHED_WITH edges found:\n${dupes.join('\n')}`).toEqual([]);
  });

  it('TC-DATA-003: every edge carries an imageUrl inside our public bucket', { timeout: TIMEOUT }, async () => {
    const result = await run(
      `
      MATCH ()-[r:PHOTOGRAPHED_WITH]->()
      WHERE r.imageUrl IS NULL OR NOT r.imageUrl STARTS WITH $prefix
      RETURN r.imageUrl AS url LIMIT 25
      `,
      { prefix: publicPrefix }
    );
    const bad = result.records.map((r) => String(r.get('url')));
    expect(bad, `edges with missing/foreign imageUrl:\n${bad.join('\n')}`).toEqual([]);
  });

  it('TC-DATA-004: no orphan Person nodes (degree 0)', { timeout: TIMEOUT }, async () => {
    const result = await run(`
      MATCH (p:Person)
      WHERE NOT (p)-[:PHOTOGRAPHED_WITH]-()
      RETURN p.name AS name LIMIT 25
    `);
    const orphans = result.records.map((r) => r.get('name'));
    expect(orphans, `orphan Person nodes:\n${orphans.join('\n')}`).toEqual([]);
  });

  it('TC-DATA-005: person names are non-empty, trimmed, and unique', { timeout: TIMEOUT }, async () => {
    const malformed = await run(`
      MATCH (p:Person)
      WHERE p.name IS NULL OR p.name = '' OR p.name <> trim(p.name)
      RETURN p.name AS name LIMIT 25
    `);
    expect(malformed.records.map((r) => r.get('name'))).toEqual([]);

    const dupes = await run(`
      MATCH (p:Person)
      WITH p.name AS name, count(*) AS occurrences
      WHERE occurrences > 1
      RETURN name, occurrences LIMIT 25
    `);
    const dupNames = dupes.records.map((r) => `${r.get('name')} ×${r.get('occurrences')}`);
    expect(dupNames, `duplicate Person nodes:\n${dupNames.join('\n')}`).toEqual([]);
  });

  it('TC-DATA-006: reconciliation — every edge image exists in storage, every object backs an edge', { timeout: TIMEOUT * 2 }, async () => {
    const edgeResult = await run(
      'MATCH ()-[r:PHOTOGRAPHED_WITH]->() RETURN r.imageUrl AS url'
    );
    const edgeUrls = edgeResult.records
      .map((r) => r.get('url'))
      .filter((u): u is string => typeof u === 'string');
    const edgeKeys = new Set(
      edgeUrls
        .filter((u) => u.startsWith(publicPrefix))
        .map((u) => decodeURIComponent(u.slice(publicPrefix.length)))
    );

    const storageKeys = new Set(await listAllKeys());

    const danglingEdges = [...edgeKeys].filter((k) => !storageKeys.has(k));
    const orphanObjects = [...storageKeys].filter((k) => !edgeKeys.has(k));

    // Both directions reported in one run (soft), then hard-failed together.
    expect.soft(danglingEdges, `edges whose image object is MISSING from storage (broken pictures on the site):\n${danglingEdges.join('\n')}`).toEqual([]);
    expect.soft(orphanObjects, `storage objects no edge references (ghost suggestions, wasted storage):\n${orphanObjects.join('\n')}`).toEqual([]);
  });

  it('TC-DATA-007: storage keys follow the "First Last_First Last.ext" convention the suggestion parser assumes', { timeout: TIMEOUT }, async () => {
    const keys = await listAllKeys();
    const pattern = /^[^_]+ [^_]+_[^_]+ [^_]+\.(jpg|jpeg|png|webp)$/i;
    const nonConforming = keys.filter((k) => !pattern.test(k));
    expect(
      nonConforming,
      `keys the suggestion parser will mangle:\n${nonConforming.join('\n')}`
    ).toEqual([]);
  });

  it('TC-DATA-008: graph is within expected size bounds (sanity tripwire)', { timeout: TIMEOUT }, async () => {
    const result = await run(`
      MATCH (p:Person) WITH count(p) AS people
      MATCH ()-[r:PHOTOGRAPHED_WITH]->()
      RETURN people, count(r) AS edges
    `);
    const people = result.records[0].get('people').toNumber();
    const edges = result.records[0].get('edges').toNumber();
    // Tripwire, not a target: fails loudly if the graph is emptied or explodes.
    expect(people).toBeGreaterThan(0);
    expect(edges).toBeGreaterThan(0);
    expect(people).toBeLessThan(100_000);
    console.info(`[live-data] graph size: ${people} people, ${edges} edges`);
  });
});
