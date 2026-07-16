/**
 * Server-side image validation for the admin upload path.
 *
 * The browser helper (helpers/fileValidation.ts) uses FileReader and cannot run
 * on the server, so uploads must be re-validated here from raw bytes. Mirrors
 * the checks the ingestion pipeline already applies to fetched candidates:
 * extension allowlist, declared MIME allowlist, magic-number sniff, size cap.
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png']);
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png']);

export interface ImageValidationResult {
  isValid: boolean;
  message?: string;
  /** Normalized lowercase extension, present only when valid. */
  extension?: 'jpg' | 'jpeg' | 'png';
}

/** Extract a lowercase extension, or null if the filename has none. */
export function extractExtension(filename: string): string | null {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0 || dot === filename.length - 1) return null; // no dot, leading dot, or trailing dot
  return filename.slice(dot + 1).toLowerCase();
}

/** True for a JPEG (FFD8FF…) or PNG (89504E47) magic number. */
export function hasImageMagicNumber(buffer: Buffer): boolean {
  if (buffer.length < 8) return false;
  const hex = buffer.subarray(0, 8).toString('hex').toUpperCase();
  return hex.startsWith('FFD8FF') || hex.startsWith('89504E47');
}

/**
 * Validate an uploaded image by filename, declared MIME type, and byte content.
 * Returns the normalized extension so the caller can build a storage key.
 */
export function validateServerImage(
  filename: string,
  mimeType: string,
  buffer: Buffer
): ImageValidationResult {
  const extension = extractExtension(filename);
  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
    return { isValid: false, message: 'File must be a .jpg, .jpeg, or .png image.' };
  }

  if (!ALLOWED_MIME.has(mimeType.toLowerCase())) {
    return { isValid: false, message: 'Only PNG and JPEG files are allowed.' };
  }

  if (buffer.length === 0) {
    return { isValid: false, message: 'File is empty.' };
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    return { isValid: false, message: 'File size should be less than 5 MB.' };
  }

  if (!hasImageMagicNumber(buffer)) {
    return { isValid: false, message: 'File content is not a valid PNG or JPEG image.' };
  }

  return { isValid: true, extension: extension as 'jpg' | 'jpeg' | 'png' };
}
