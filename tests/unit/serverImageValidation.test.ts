/**
 * TC-SIMG — server-side image validation (traces: R7; supports DEF-002).
 * Techniques: equivalence partitioning on extension/MIME/magic-number,
 * boundary-value analysis on the 5 MB cap.
 */
import { describe, it, expect } from 'vitest';
import {
  extractExtension,
  hasImageMagicNumber,
  validateServerImage,
  MAX_IMAGE_BYTES,
} from '@/helpers/serverImageValidation';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GIF = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00]);

describe('extractExtension (TC-SIMG-001)', () => {
  it.each([
    ['photo.jpg', 'jpg'],
    ['photo.JPEG', 'jpeg'],
    ['a.b.png', 'png'],
  ])('extracts %s → %s', (name, ext) => {
    expect(extractExtension(name)).toBe(ext);
  });

  it.each([
    ['no dot', 'noextension'],
    ['trailing dot', 'photo.'],
    ['leading dot only', '.gitignore'],
  ])('returns null for %s', (_label, name) => {
    expect(extractExtension(name)).toBeNull();
  });
});

describe('hasImageMagicNumber (TC-SIMG-002)', () => {
  it('accepts JPEG and PNG signatures', () => {
    expect(hasImageMagicNumber(JPEG)).toBe(true);
    expect(hasImageMagicNumber(PNG)).toBe(true);
  });

  it('rejects GIF and short buffers', () => {
    expect(hasImageMagicNumber(GIF)).toBe(false);
    expect(hasImageMagicNumber(Buffer.from([0xff, 0xd8]))).toBe(false);
  });
});

describe('validateServerImage decision table (TC-SIMG-003)', () => {
  it('accepts a valid JPEG and returns the normalized extension', () => {
    const result = validateServerImage('photo.jpg', 'image/jpeg', JPEG);
    expect(result).toEqual({ isValid: true, extension: 'jpg' });
  });

  it('accepts a valid PNG', () => {
    expect(validateServerImage('photo.png', 'image/png', PNG).isValid).toBe(true);
  });

  it.each([
    ['extension-less name', 'noextension', 'image/jpeg', JPEG],
    ['disallowed extension', 'photo.gif', 'image/gif', GIF],
    ['spoofed mime for exe', 'payload.exe', 'application/x-sh', JPEG],
    ['mime not allowed', 'photo.jpg', 'text/html', JPEG],
    ['magic-number mismatch', 'photo.jpg', 'image/jpeg', GIF],
    ['empty buffer', 'photo.jpg', 'image/jpeg', Buffer.alloc(0)],
  ])('rejects %s', (_label, name, mime, buf) => {
    expect(validateServerImage(name, mime, buf).isValid).toBe(false);
  });

  it('enforces the 5 MB cap at the boundary (BVA)', () => {
    const atCap = Buffer.alloc(MAX_IMAGE_BYTES);
    JPEG.copy(atCap);
    expect(validateServerImage('photo.jpg', 'image/jpeg', atCap).isValid).toBe(true);

    const overCap = Buffer.alloc(MAX_IMAGE_BYTES + 1);
    JPEG.copy(overCap);
    expect(validateServerImage('photo.jpg', 'image/jpeg', overCap).isValid).toBe(false);
  });
});
