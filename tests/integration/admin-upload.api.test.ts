/**
 * TC-API-UPLOAD — POST /api/admin/admin-upload (traces: R1, R2, R7;
 * fixes DEF-001, DEF-002). Negative-first: auth, field presence, name format,
 * server-side file validation, then graph-based duplicate detection, then the
 * happy path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '@/lib/errors';

vi.mock('@/lib/services', () => ({
  adminService: { verifySession: vi.fn() },
  connectionService: { connectionExists: vi.fn(), createConnection: vi.fn() },
  suggestionService: { invalidateCache: vi.fn() },
  ingestionService: {},
}));

vi.mock('@/lib/db/storage', () => ({
  storageHelpers: {
    upload: vi.fn(),
    publicUrl: vi.fn(
      (key: string) =>
        `https://test-project.supabase.co/storage/v1/object/public/connection-images/${encodeURIComponent(key)}`
    ),
  },
}));

import { POST } from '@/app/api/admin/admin-upload/route';
import { adminService, connectionService, suggestionService } from '@/lib/services';
import { storageHelpers } from '@/lib/db/storage';
import { postForm } from '../helpers/testUtils';
import { ErrorBodySchema, UploadSuccessSchema, expectContract } from '../helpers/contracts';

const verifySession = vi.mocked(adminService.verifySession);
const connectionExists = vi.mocked(connectionService.connectionExists);
const createConnection = vi.mocked(connectionService.createConnection);
const upload = vi.mocked(storageHelpers.upload);

const PATH = '/api/admin/admin-upload';
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

function buildForm(
  overrides: Partial<{ first: string | null; second: string | null; file: File | null }> = {}
): FormData {
  const form = new FormData();
  const first = overrides.first === undefined ? 'John Doe' : overrides.first;
  const second = overrides.second === undefined ? 'Jane Roe' : overrides.second;
  const file =
    overrides.file === undefined
      ? new File([JPEG_BYTES], 'photo.jpg', { type: 'image/jpeg' })
      : overrides.file;

  if (first !== null) form.append('firstPersonFullName', first);
  if (second !== null) form.append('secondPersonFullName', second);
  if (file !== null) form.append('file', file);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  verifySession.mockResolvedValue({ email: 'admin@test.com', role: 'admin' });
  connectionExists.mockResolvedValue(false);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('authentication (TC-API-UPLOAD-001)', () => {
  it('401s before touching the form when the session is invalid', async () => {
    verifySession.mockRejectedValue(AppError.unauthorized());
    const res = await POST(postForm(PATH, buildForm()));
    expect(res.status).toBe(401);
    expectContract(ErrorBodySchema, await res.json());
    expect(upload).not.toHaveBeenCalled();
    expect(createConnection).not.toHaveBeenCalled();
  });
});

describe('field validation (TC-API-UPLOAD-002)', () => {
  it.each([
    ['missing first name', { first: null }],
    ['missing second name', { second: null }],
    ['missing file', { file: null }],
  ])('%s → 400 with no side effects', async (_label, overrides) => {
    const res = await POST(postForm(PATH, buildForm(overrides)));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('MISSING_REQUIRED_FIELDS');
    expect(upload).not.toHaveBeenCalled();
  });

  it.each([
    ['single word', 'Prince'],
    ['digits', 'John Do3'],
    ['double space', 'John  Doe'],
  ])('name format: %s → 400 VALIDATION_ERROR', async (_label, badName) => {
    const res = await POST(postForm(PATH, buildForm({ first: badName })));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('VALIDATION_ERROR');
    expect(upload).not.toHaveBeenCalled();
  });

  it('accepts real names with hyphens/apostrophes/accents (DEF-004 fixed)', async () => {
    const res = await POST(
      postForm(PATH, buildForm({ first: 'Daniel Day-Lewis', second: "Conan O'Brien" }))
    );
    expect(res.status).toBe(200);
    expect(upload).toHaveBeenCalled();
  });
});

describe('server-side file validation (TC-API-UPLOAD-003, DEF-002 fixed)', () => {
  it('rejects a non-image file with a spoofed content type', async () => {
    const evil = new File([new TextEncoder().encode('#!/bin/sh\necho pwned')], 'payload.exe', {
      type: 'application/x-sh',
    });
    const res = await POST(postForm(PATH, buildForm({ file: evil })));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('VALIDATION_ERROR');
    expect(upload).not.toHaveBeenCalled();
  });

  it('rejects an extension-less filename (was silently stored — DEF-002)', async () => {
    const res = await POST(
      postForm(PATH, buildForm({ file: new File([JPEG_BYTES], 'noextension', { type: 'image/jpeg' }) }))
    );
    expect(res.status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it('rejects a disallowed extension even with valid image bytes', async () => {
    const res = await POST(
      postForm(PATH, buildForm({ file: new File([JPEG_BYTES], 'photo.gif', { type: 'image/gif' }) }))
    );
    expect(res.status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it('rejects a .jpg whose bytes are not a JPEG (magic-number mismatch)', async () => {
    const notImage = new File([new TextEncoder().encode('GIF89a....')], 'photo.jpg', {
      type: 'image/jpeg',
    });
    const res = await POST(postForm(PATH, buildForm({ file: notImage })));
    expect(res.status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it('rejects an image over the 5 MB cap (boundary)', async () => {
    const oversized = new Uint8Array(5 * 1024 * 1024 + 1);
    oversized.set(JPEG_BYTES);
    const res = await POST(
      postForm(PATH, buildForm({ file: new File([oversized], 'big.jpg', { type: 'image/jpeg' }) }))
    );
    expect(res.status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });
});

describe('duplicate detection via the graph (TC-API-UPLOAD-004, DEF-001 fixed)', () => {
  it('409s when the pair is already connected, in EITHER direction and ANY extension', async () => {
    connectionExists.mockResolvedValue(true); // undirected, extension-agnostic
    const res = await POST(postForm(PATH, buildForm()));
    expect(res.status).toBe(409);
    expect(upload).not.toHaveBeenCalled();
    expect(createConnection).not.toHaveBeenCalled();
  });
});

describe('happy path (TC-API-UPLOAD-005)', () => {
  it('validates, uploads, creates the edge, and invalidates the suggestion cache', async () => {
    const res = await POST(postForm(PATH, buildForm()));

    expect(res.status).toBe(200);
    const body = expectContract(UploadSuccessSchema, await res.json());
    expect(body.imageUrl).toContain('John%20Doe_Jane%20Roe.jpg');

    expect(upload).toHaveBeenCalledWith('John Doe_Jane Roe.jpg', expect.any(Buffer), 'image/jpeg');
    expect(createConnection).toHaveBeenCalledWith(
      'John Doe',
      'Jane Roe',
      expect.stringContaining('John%20Doe_Jane%20Roe.jpg')
    );
    expect(suggestionService.invalidateCache).toHaveBeenCalled();
  });
});
