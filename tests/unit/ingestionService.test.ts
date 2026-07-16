/**
 * TC-INGEST — automated pair-ingestion pipeline (traces: R2, R3, R6).
 * Techniques: decision table over (MIME × magic number × A-detected ×
 * B-detected × confidence), boundary-value analysis on the 95% confidence
 * gate and the 5 MB download cap.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/integrations/serper', () => ({
  searchImages: vi.fn(),
}));
vi.mock('@/lib/integrations/rekognition', () => ({
  recognizeCelebrities: vi.fn(),
}));
vi.mock('@/lib/db/storage', () => ({
  storageHelpers: {
    upload: vi.fn(),
    publicUrl: vi.fn((key: string) => `https://test-project.supabase.co/storage/v1/object/public/connection-images/${key}`),
  },
}));
vi.mock('@/lib/repositories', () => ({
  connectionRepository: {
    getConnectionWithImage: vi.fn(),
    createConnection: vi.fn(),
  },
}));
vi.mock('@/lib/services/suggestionService', () => ({
  suggestionService: { invalidateCache: vi.fn() },
}));

import { ingestionService } from '@/lib/services/ingestionService';
import { searchImages } from '@/lib/integrations/serper';
import { recognizeCelebrities } from '@/lib/integrations/rekognition';
import { storageHelpers } from '@/lib/db/storage';
import { connectionRepository } from '@/lib/repositories';
import { suggestionService } from '@/lib/services/suggestionService';

const mockSearch = vi.mocked(searchImages);
const mockRekognize = vi.mocked(recognizeCelebrities);
const mockRepo = vi.mocked(connectionRepository);
const mockStorage = vi.mocked(storageHelpers);

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const GIF_BYTES = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00, 0x00, 0x00]);

/** Stub global fetch to return the given body/content-type (or an error). */
function stubFetch(
  responses: Array<{ bytes?: Buffer; contentType?: string; status?: number; reject?: boolean }>
) {
  const queue = [...responses];
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const next = queue.shift();
      if (!next) throw new Error('fetch called more times than stubbed');
      if (next.reject) throw new Error('network unreachable');
      const bytes = next.bytes ?? JPEG_BYTES;
      return {
        ok: (next.status ?? 200) < 400,
        status: next.status ?? 200,
        headers: { get: (h: string) => (h === 'content-type' ? next.contentType ?? 'image/jpeg' : null) },
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      };
    })
  );
}

function detection(name: string, matchConfidence: number) {
  return { name, matchConfidence, faceConfidence: 99 };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  mockRepo.getConnectionWithImage.mockResolvedValue(null);
});

describe('input validation (TC-INGEST-001)', () => {
  it('rejects blank names', async () => {
    await expect(ingestionService.ingestPair('  ', 'Jane Roe')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('rejects identical people (case/whitespace-insensitive)', async () => {
    await expect(ingestionService.ingestPair('John Doe', '  john doe ')).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe('pre-flight existing check (TC-INGEST-002)', () => {
  it('short-circuits without calling Serper when the pair is already connected', async () => {
    mockRepo.getConnectionWithImage.mockResolvedValue({ imageUrl: 'https://x/existing.jpg' });
    const result = await ingestionService.ingestPair('John Doe', 'Jane Roe');
    expect(result).toEqual({ added: false, existing: 'https://x/existing.jpg', attempts: [] });
    expect(mockSearch).not.toHaveBeenCalled();
  });
});

describe('candidate decision table (TC-INGEST-003)', () => {
  const CANDIDATE = { imageUrl: 'https://img.example.com/a.jpg', source: 'example.com' };

  beforeEach(() => {
    mockSearch.mockResolvedValue([CANDIDATE]);
  });

  it('accepts: valid JPEG + both people at exactly 95% confidence (boundary)', async () => {
    stubFetch([{ bytes: JPEG_BYTES, contentType: 'image/jpeg' }]);
    mockRekognize.mockResolvedValue([detection('John Doe', 95), detection('Jane Roe', 95)]);

    const result = await ingestionService.ingestPair('John Doe', 'Jane Roe');

    expect(result.added).toBe(true);
    expect(mockStorage.upload).toHaveBeenCalledWith('John Doe_Jane Roe.jpg', expect.any(Buffer), 'image/jpeg');
    expect(mockRepo.createConnection).toHaveBeenCalledWith(
      'John Doe',
      'Jane Roe',
      expect.stringContaining('John Doe_Jane Roe.jpg')
    );
    expect(suggestionService.invalidateCache).toHaveBeenCalled();
  });

  it('skips: one person at 94.99% confidence (boundary, just below gate)', async () => {
    stubFetch([{ bytes: JPEG_BYTES, contentType: 'image/jpeg' }]);
    mockRekognize.mockResolvedValue([detection('John Doe', 95), detection('Jane Roe', 94.99)]);

    const result = await ingestionService.ingestPair('John Doe', 'Jane Roe');

    expect(result.added).toBe(false);
    expect(result.attempts[0]).toMatchObject({ status: 'skipped', reason: expect.stringContaining('confidence') });
    expect(mockStorage.upload).not.toHaveBeenCalled();
    expect(mockRepo.createConnection).not.toHaveBeenCalled();
  });

  it('skips: only one of the two people detected', async () => {
    stubFetch([{ bytes: JPEG_BYTES, contentType: 'image/jpeg' }]);
    mockRekognize.mockResolvedValue([detection('John Doe', 99)]);

    const result = await ingestionService.ingestPair('John Doe', 'Jane Roe');
    expect(result.added).toBe(false);
    expect(result.attempts[0].detected).toEqual(['John Doe']);
  });

  it('matches detected names case-insensitively', async () => {
    stubFetch([{ bytes: JPEG_BYTES, contentType: 'image/jpeg' }]);
    mockRekognize.mockResolvedValue([detection('JOHN DOE', 99), detection('jane roe', 99)]);

    const result = await ingestionService.ingestPair('John Doe', 'Jane Roe');
    expect(result.added).toBe(true);
  });

  it('skips: unsupported content-type (image/gif) without calling Rekognition', async () => {
    stubFetch([{ bytes: GIF_BYTES, contentType: 'image/gif' }]);

    const result = await ingestionService.ingestPair('John Doe', 'Jane Roe');
    expect(result.added).toBe(false);
    expect(result.attempts[0].reason).toContain('unsupported content-type');
    expect(mockRekognize).not.toHaveBeenCalled();
  });

  it('skips: correct MIME header but wrong magic number (spoofed content-type)', async () => {
    stubFetch([{ bytes: GIF_BYTES, contentType: 'image/jpeg' }]);

    const result = await ingestionService.ingestPair('John Doe', 'Jane Roe');
    expect(result.added).toBe(false);
    expect(result.attempts[0].reason).toBe('invalid image signature');
    expect(mockRekognize).not.toHaveBeenCalled();
  });

  it('skips: download failure (HTTP error)', async () => {
    stubFetch([{ status: 404 }]);
    const result = await ingestionService.ingestPair('John Doe', 'Jane Roe');
    expect(result.added).toBe(false);
    expect(result.attempts[0].reason).toContain('download failed');
  });

  it('skips: network failure', async () => {
    stubFetch([{ reject: true }]);
    const result = await ingestionService.ingestPair('John Doe', 'Jane Roe');
    expect(result.added).toBe(false);
    expect(result.attempts[0].reason).toContain('download failed');
  });

  it('skips: image over the 5 MB cap (boundary)', async () => {
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1);
    oversized.set(JPEG_BYTES);
    stubFetch([{ bytes: oversized, contentType: 'image/jpeg' }]);

    const result = await ingestionService.ingestPair('John Doe', 'Jane Roe');
    expect(result.added).toBe(false);
    expect(result.attempts[0].reason).toContain('image too large');
  });

  it('skips: Rekognition failure is contained, not fatal', async () => {
    stubFetch([{ bytes: JPEG_BYTES, contentType: 'image/jpeg' }]);
    mockRekognize.mockRejectedValue(new Error('ThrottlingException'));

    const result = await ingestionService.ingestPair('John Doe', 'Jane Roe');
    expect(result.added).toBe(false);
    expect(result.attempts[0].reason).toContain('rekognition failed');
  });

  it('stores PNG uploads with a .png key and image/png content type', async () => {
    stubFetch([{ bytes: PNG_BYTES, contentType: 'image/png' }]);
    mockRekognize.mockResolvedValue([detection('John Doe', 99), detection('Jane Roe', 99)]);

    await ingestionService.ingestPair('John Doe', 'Jane Roe');
    expect(mockStorage.upload).toHaveBeenCalledWith('John Doe_Jane Roe.png', expect.any(Buffer), 'image/png');
  });
});

describe('multi-candidate behavior (TC-INGEST-004)', () => {
  it('stops at the first accepted candidate and records all attempts up to it', async () => {
    mockSearch.mockResolvedValue([
      { imageUrl: 'https://img.example.com/1.jpg' },
      { imageUrl: 'https://img.example.com/2.jpg' },
      { imageUrl: 'https://img.example.com/3.jpg' },
    ]);
    stubFetch([
      { status: 500 }, // candidate 1: download fails
      { bytes: JPEG_BYTES, contentType: 'image/jpeg' }, // candidate 2: accepted
    ]);
    mockRekognize.mockResolvedValue([detection('John Doe', 99), detection('Jane Roe', 99)]);

    const result = await ingestionService.ingestPair('John Doe', 'Jane Roe');

    expect(result.added).toBe(true);
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0].status).toBe('skipped');
    expect(result.attempts[1].status).toBe('accepted');
    expect(mockStorage.upload).toHaveBeenCalledTimes(1);
  });

  it('returns added:false with a full attempt trace when no candidate qualifies', async () => {
    mockSearch.mockResolvedValue([
      { imageUrl: 'https://img.example.com/1.jpg' },
      { imageUrl: 'https://img.example.com/2.jpg' },
    ]);
    stubFetch([
      { bytes: JPEG_BYTES, contentType: 'image/jpeg' },
      { bytes: JPEG_BYTES, contentType: 'image/jpeg' },
    ]);
    mockRekognize.mockResolvedValue([detection('Someone Else', 99)]);

    const result = await ingestionService.ingestPair('John Doe', 'Jane Roe');
    expect(result.added).toBe(false);
    expect(result.attempts).toHaveLength(2);
    expect(mockRepo.createConnection).not.toHaveBeenCalled();
  });
});
