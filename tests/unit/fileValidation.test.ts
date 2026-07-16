// @vitest-environment happy-dom
/**
 * TC-FILE — client-side image validation (traces: R7).
 * Techniques: equivalence partitioning on MIME type and magic number,
 * boundary-value analysis on the 5 MB size cap.
 *
 * NOTE: this helper runs in the BROWSER only. The server upload route does
 * not re-run these checks — that gap is filed as DEF-002 and covered by the
 * admin-upload API tests.
 */
import { describe, it, expect } from 'vitest';
import { validateImageFile, validateImageSignature } from '@/helpers/fileValidation';

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46];
const GIF_MAGIC = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00];

function makeFile(bytes: number[], name: string, type: string, padToBytes = 0): File {
  const content = new Uint8Array(Math.max(bytes.length, padToBytes));
  content.set(bytes);
  return new File([content], name, { type });
}

describe('validateImageSignature (TC-FILE-001)', () => {
  it('accepts a PNG magic number', async () => {
    const result = await validateImageSignature(makeFile(PNG_MAGIC, 'a.png', 'image/png'));
    expect(result.isValid).toBe(true);
  });

  it('accepts a JPEG/JFIF magic number', async () => {
    const result = await validateImageSignature(makeFile(JPEG_MAGIC, 'a.jpg', 'image/jpeg'));
    expect(result.isValid).toBe(true);
  });

  it('rejects a GIF pretending to be a PNG (content sniffing beats extension)', async () => {
    const result = await validateImageSignature(makeFile(GIF_MAGIC, 'fake.png', 'image/png'));
    expect(result.isValid).toBe(false);
  });

  it('rejects an empty file', async () => {
    const result = await validateImageSignature(makeFile([], 'empty.png', 'image/png'));
    expect(result.isValid).toBe(false);
  });
});

describe('validateImageFile (TC-FILE-002)', () => {
  it('accepts a valid PNG under the size cap', async () => {
    const result = await validateImageFile(makeFile(PNG_MAGIC, 'a.png', 'image/png'));
    expect(result.isValid).toBe(true);
  });

  it.each(['image/gif', 'application/pdf', 'text/html', 'image/svg+xml'])(
    'rejects disallowed MIME type %s',
    async (type) => {
      const result = await validateImageFile(makeFile(PNG_MAGIC, 'a.png', type));
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('Only PNG and JPEG');
    }
  );

  // BVA on the 5 MB cap: exactly 5 MB passes, one byte over fails.
  it('accepts a file of exactly 5 MB (TC-FILE-003, boundary)', async () => {
    const result = await validateImageFile(
      makeFile(PNG_MAGIC, 'max.png', 'image/png', 5 * 1024 * 1024)
    );
    expect(result.isValid).toBe(true);
  });

  it('rejects a file of 5 MB + 1 byte (TC-FILE-003, boundary)', async () => {
    const result = await validateImageFile(
      makeFile(PNG_MAGIC, 'over.png', 'image/png', 5 * 1024 * 1024 + 1)
    );
    expect(result.isValid).toBe(false);
    expect(result.message).toContain('File size');
  });
});
