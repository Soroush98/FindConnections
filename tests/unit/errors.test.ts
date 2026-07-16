/**
 * TC-ERR — error taxonomy & handler mapping (traces: R10, R5).
 * The withErrorHandler wrapper is the single choke point that decides what
 * clients see when anything throws. It must map known errors to their codes
 * and NEVER leak internals for unknown ones.
 */
import { describe, it, expect, vi } from 'vitest';
import { AppError, ErrorCode, withErrorHandler } from '@/lib/errors';
import { getRequest } from '../helpers/testUtils';
import { NextResponse } from 'next/server';

describe('AppError factories (TC-ERR-001)', () => {
  it.each([
    ['unauthorized', AppError.unauthorized(), 401, ErrorCode.UNAUTHORIZED],
    ['forbidden', AppError.forbidden(), 403, ErrorCode.FORBIDDEN],
    ['invalidToken', AppError.invalidToken(), 401, ErrorCode.INVALID_TOKEN],
    ['tokenExpired', AppError.tokenExpired(), 401, ErrorCode.TOKEN_EXPIRED],
    ['notFound', AppError.notFound(), 404, ErrorCode.NOT_FOUND],
    ['alreadyExists', AppError.alreadyExists(), 409, ErrorCode.ALREADY_EXISTS],
    ['conflict', AppError.conflict('x'), 409, ErrorCode.CONFLICT],
    ['validation', AppError.validation('x'), 400, ErrorCode.VALIDATION_ERROR],
    ['invalidInput', AppError.invalidInput('x'), 400, ErrorCode.INVALID_INPUT],
    ['rateLimited', AppError.rateLimited(), 429, ErrorCode.RATE_LIMITED],
    ['internal', AppError.internal(), 500, ErrorCode.INTERNAL_ERROR],
    ['database', AppError.database(), 500, ErrorCode.DATABASE_ERROR],
    ['externalService', AppError.externalService('svc'), 502, ErrorCode.EXTERNAL_SERVICE_ERROR],
  ])('%s maps to expected status and code', (_label, error, status, code) => {
    expect(error.statusCode).toBe(status);
    expect(error.code).toBe(code);
  });

  it('missingFields lists the fields in message and details (TC-ERR-002)', () => {
    const err = AppError.missingFields(['name1', 'name2']);
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('Missing required fields: name1, name2');
    expect(err.details).toEqual({ fields: ['name1', 'name2'] });
  });
});

describe('withErrorHandler mapping (TC-ERR-003)', () => {
  const req = () => getRequest('/api/test');

  it('passes through a successful response', async () => {
    const handler = withErrorHandler(async () => NextResponse.json({ ok: true }));
    const res = await handler(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('serializes AppError with its status, code, and details', async () => {
    const handler = withErrorHandler(async () => {
      throw AppError.validation('bad input', { field: 'name1' });
    });
    const res = await handler(req());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'bad input',
      code: 'VALIDATION_ERROR',
      details: { field: 'name1' },
    });
  });

  it('maps JsonWebTokenError to 401 INVALID_TOKEN', async () => {
    const handler = withErrorHandler(async () => {
      const e = new Error('jwt malformed');
      e.name = 'JsonWebTokenError';
      throw e;
    });
    const res = await handler(req());
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('INVALID_TOKEN');
  });

  it('maps TokenExpiredError to 401 TOKEN_EXPIRED', async () => {
    const handler = withErrorHandler(async () => {
      const e = new Error('jwt expired');
      e.name = 'TokenExpiredError';
      throw e;
    });
    const res = await handler(req());
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('TOKEN_EXPIRED');
  });

  it('never leaks internals from unknown errors (TC-ERR-004, traces R10)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = withErrorHandler(async () => {
      throw new Error('connect failed: bolt://internal-host:7687 password=hunter2');
    });
    const res = await handler(req());
    const body = await res.json();

    expect(res.status).toBe(500);
    // Exact generic body — nothing else may be present.
    expect(body).toEqual({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    const raw = JSON.stringify(body);
    expect(raw).not.toContain('bolt://');
    expect(raw).not.toContain('hunter2');
    expect(raw).not.toContain('stack');
    consoleSpy.mockRestore();
  });

  it('handles non-Error throwables with a generic 500', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = withErrorHandler(async () => {
      throw 'string-throw';
    });
    const res = await handler(req());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    consoleSpy.mockRestore();
  });
});
