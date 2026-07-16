/**
 * TC-INT — external integration wrappers (traces: R6, R10).
 * Serper and Rekognition are faked at the fetch/SDK boundary; these tests pin
 * our handling of their error and shape variations.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('searchImages (TC-INT-001)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  async function importSerper() {
    return import('@/lib/integrations/serper');
  }

  it('maps Serper hits to our shape and slices to the requested count', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          images: [
            { imageUrl: 'https://a/1.jpg', link: 'https://a', source: 'a.com', title: 't1', imageWidth: 100, imageHeight: 50 },
            { imageUrl: 'https://a/2.jpg' },
            { imageUrl: 'https://a/3.jpg' },
          ],
        }),
      }))
    );
    const { searchImages } = await importSerper();

    const images = await searchImages('John Doe Jane Roe', 2);

    expect(images).toHaveLength(2);
    expect(images[0]).toEqual({
      imageUrl: 'https://a/1.jpg',
      link: 'https://a',
      source: 'a.com',
      title: 't1',
      width: 100,
      height: 50,
    });

    const fetchMock = vi.mocked(fetch);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://google.serper.dev/images');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ q: 'John Doe Jane Roe', num: 2 });
  });

  it('returns [] when Serper responds without an images field', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })));
    const { searchImages } = await importSerper();
    expect(await searchImages('x y', 5)).toEqual([]);
  });

  it('surfaces HTTP failures as a 400 AppError with the body truncated to 200 chars', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 429, text: async () => 'rate limited '.repeat(100) }))
    );
    const { searchImages } = await importSerper();

    const err = await searchImages('x y', 5).catch((e) => e);
    expect(err.statusCode).toBe(400);
    expect(err.message).toContain('Serper request failed (429)');
    expect(err.message.length).toBeLessThan(260); // 200-char slice + prefix
  });

  it('fails fast with a clear error when SERPER_API_KEY is not configured', async () => {
    vi.stubEnv('SERPER_API_KEY', undefined);
    vi.stubGlobal('fetch', vi.fn());
    const { searchImages } = await importSerper();

    await expect(searchImages('x y', 5)).rejects.toMatchObject({ statusCode: 400 });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('recognizeCelebrities (TC-INT-002)', () => {
  const sendMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    sendMock.mockReset();
    vi.doMock('@aws-sdk/client-rekognition', () => ({
      RekognitionClient: class {
        send = sendMock;
      },
      RecognizeCelebritiesCommand: class {
        constructor(public input: unknown) {}
      },
    }));
  });

  it('maps celebrity faces, dropping entries without a name and defaulting confidences to 0', async () => {
    sendMock.mockResolvedValue({
      CelebrityFaces: [
        { Name: 'John Doe', MatchConfidence: 99.5, Face: { Confidence: 99.9 } },
        { Name: 'Jane Roe' }, // no confidences reported
        { MatchConfidence: 88 }, // no name — dropped
      ],
    });
    const { recognizeCelebrities } = await import('@/lib/integrations/rekognition');

    const detected = await recognizeCelebrities(Buffer.from([0xff, 0xd8]));

    expect(detected).toEqual([
      { name: 'John Doe', matchConfidence: 99.5, faceConfidence: 99.9 },
      { name: 'Jane Roe', matchConfidence: 0, faceConfidence: 0 },
    ]);
  });

  it('returns [] when Rekognition reports no celebrity faces', async () => {
    sendMock.mockResolvedValue({});
    const { recognizeCelebrities } = await import('@/lib/integrations/rekognition');
    expect(await recognizeCelebrities(Buffer.from([0xff, 0xd8]))).toEqual([]);
  });
});
