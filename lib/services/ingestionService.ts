import { searchImages, SerperImage } from '@/lib/integrations/serper';
import { recognizeCelebrities, DetectedCelebrity } from '@/lib/integrations/rekognition';
import { storageHelpers } from '@/lib/db/storage';
import { connectionRepository } from '@/lib/repositories';
import { suggestionService } from './suggestionService';
import { AppError } from '@/lib/errors';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8000;
const MIN_CELEBRITY_MATCH_CONFIDENCE = 95;
const SUPPORTED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png']);

export interface IngestionAttempt {
  url: string;
  source?: string;
  status: 'accepted' | 'skipped';
  reason?: string;
  detected?: string[];
}

export interface IngestionResult {
  /** Did this call result in a new connection being stored? */
  added: boolean;
  /** Existing image URL if the pair was already connected before this call */
  existing?: string;
  /** Final image URL if a new connection was created */
  imageUrl?: string;
  /** Per-image trace, in order processed */
  attempts: IngestionAttempt[];
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

function pickExtension(contentType: string | null): 'jpg' | 'png' | null {
  if (!contentType) return null;
  const t = contentType.toLowerCase();
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg';
  if (t.includes('png')) return 'png';
  return null;
}

function isValidImageSignature(buf: Buffer): boolean {
  if (buf.length < 8) return false;
  const hex = buf.subarray(0, 8).toString('hex').toUpperCase();
  return hex.startsWith('FFD8FF') || hex.startsWith('89504E47');
}

async function downloadImage(url: string): Promise<{ buffer: Buffer; contentType: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (FindConnectionsBot)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentType = res.headers.get('content-type');
    const arrayBuf = await res.arrayBuffer();
    if (arrayBuf.byteLength > MAX_IMAGE_BYTES) throw new Error('image too large');

    return { buffer: Buffer.from(arrayBuf), contentType };
  } finally {
    clearTimeout(timer);
  }
}

interface CandidateAttempt extends IngestionAttempt {
  _buffer?: Buffer;
  _ext?: 'jpg' | 'png';
}

/**
 * Try to ingest a Photographed-With connection between two named people by
 * searching Serper, validating each candidate image with AWS Rekognition, and
 * storing the first match in S3 + Neo4j.
 */
export class IngestionService {
  /**
   * Ingest a single (personA, personB) pair. Stops at the first accepted image.
   */
  async ingestPair(personA: string, personB: string, maxCandidates = 15): Promise<IngestionResult> {
    if (!personA.trim() || !personB.trim()) {
      throw AppError.missingFields(['personA', 'personB']);
    }
    if (normalize(personA) === normalize(personB)) {
      throw AppError.validation('personA and personB must be different');
    }

    const existing = await connectionRepository.getConnectionWithImage(personA, personB);
    if (existing?.imageUrl) {
      return { added: false, existing: existing.imageUrl, attempts: [] };
    }

    // Serper's free tier rejects "advanced" query patterns (quoted phrases,
    // operators). Rekognition gates each candidate by name+confidence anyway,
    // so plain keywords are accurate enough.
    const query = `${personA} ${personB}`;
    const candidates = await searchImages(query, maxCandidates);

    const attempts: IngestionAttempt[] = [];
    const wantedA = normalize(personA);
    const wantedB = normalize(personB);

    for (const candidate of candidates) {
      const attempt = await this.tryCandidate(candidate, wantedA, wantedB);
      attempts.push({
        url: attempt.url,
        source: attempt.source,
        status: attempt.status,
        reason: attempt.reason,
        detected: attempt.detected,
      });
      if (attempt.status === 'accepted') {
        const imageUrl = await this.persist(personA, personB, attempt);
        return { added: true, imageUrl, attempts };
      }
    }

    return { added: false, attempts };
  }

  /**
   * Download a single Serper candidate, run Rekognition, and decide whether
   * to accept it. Does NOT persist — caller does that for the winner.
   */
  private async tryCandidate(
    candidate: SerperImage,
    wantedA: string,
    wantedB: string
  ): Promise<CandidateAttempt> {
    const base = { url: candidate.imageUrl, source: candidate.source };
    let buffer: Buffer;
    let contentType: string | null;
    try {
      ({ buffer, contentType } = await downloadImage(candidate.imageUrl));
    } catch (e) {
      return { ...base, status: 'skipped', reason: `download failed: ${(e as Error).message}` };
    }

    const ext = pickExtension(contentType);
    if (!ext || (contentType && !SUPPORTED_MIME.has(contentType.split(';')[0].toLowerCase()))) {
      return { ...base, status: 'skipped', reason: `unsupported content-type: ${contentType}` };
    }
    if (!isValidImageSignature(buffer)) {
      return { ...base, status: 'skipped', reason: 'invalid image signature' };
    }

    let detected: DetectedCelebrity[];
    try {
      detected = await recognizeCelebrities(buffer);
    } catch (e) {
      return { ...base, status: 'skipped', reason: `rekognition failed: ${(e as Error).message}` };
    }

    const detectedNames = detected.map((d) => d.name);
    const matchA = detected.find(
      (d) => normalize(d.name) === wantedA && d.matchConfidence >= MIN_CELEBRITY_MATCH_CONFIDENCE
    );
    const matchB = detected.find(
      (d) => normalize(d.name) === wantedB && d.matchConfidence >= MIN_CELEBRITY_MATCH_CONFIDENCE
    );

    if (!matchA || !matchB) {
      return {
        ...base,
        status: 'skipped',
        reason: 'pair not detected at required confidence',
        detected: detectedNames,
      };
    }

    return {
      ...base,
      status: 'accepted',
      detected: detectedNames,
      _buffer: buffer,
      _ext: ext,
    };
  }

  /**
   * Upload the accepted image to S3 and create the Neo4j edge.
   */
  private async persist(personA: string, personB: string, attempt: CandidateAttempt): Promise<string> {
    const { _buffer, _ext } = attempt;
    if (!_buffer || !_ext) {
      throw AppError.internal('persist called without buffer/extension');
    }
    const filename = `${personA}_${personB}.${_ext}`;
    const contentType = _ext === 'png' ? 'image/png' : 'image/jpeg';

    await storageHelpers.upload(filename, _buffer, contentType);
    const imageUrl = storageHelpers.publicUrl(filename);

    await connectionRepository.createConnection(personA, personB, imageUrl);
    suggestionService.invalidateCache();
    return imageUrl;
  }
}

export const ingestionService = new IngestionService();
