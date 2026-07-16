/**
 * Response contracts for every public endpoint (traces: contract testing).
 *
 * These zod schemas are the published shape of the API. Any change that makes
 * a response fail these schemas is a BREAKING contract change and must fail CI
 * before a consumer (the React frontend, the admin UI) sees it.
 *
 * `.strict()` is deliberate: new fields are also contract changes — add them
 * here first, then to the implementation.
 */
import { z } from 'zod';

export const ErrorBodySchema = z
  .object({
    error: z.string().min(1),
    code: z.enum([
      'UNAUTHORIZED',
      'FORBIDDEN',
      'INVALID_TOKEN',
      'TOKEN_EXPIRED',
      'VALIDATION_ERROR',
      'INVALID_INPUT',
      'MISSING_REQUIRED_FIELDS',
      'NOT_FOUND',
      'ALREADY_EXISTS',
      'CONFLICT',
      'RATE_LIMITED',
      'BANNED',
      'INTERNAL_ERROR',
      'DATABASE_ERROR',
      'EXTERNAL_SERVICE_ERROR',
    ]),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const ConnectionSegmentSchema = z
  .object({
    start: z.string().min(1),
    relationship: z.string().min(1),
    end: z.string().min(1),
    imageUrl: z.string().nullable(),
  })
  .strict();

export const ConnectionsResponseSchema = z.array(
  z
    .object({
      segments: z.array(ConnectionSegmentSchema),
      imageUrls: z.array(z.string().nullable()),
    })
    .strict()
);

export const SuggestionsResponseSchema = z.object({ suggestions: z.array(z.string()) }).strict();

export const PopularResponseSchema = z.object({ names: z.array(z.string()) }).strict();

export const FamousPicsResponseSchema = z.object({ pics: z.array(z.string()) }).strict();

export const LoginSuccessSchema = z.object({ message: z.string() }).strict();

export const UploadSuccessSchema = z
  .object({ message: z.string(), imageUrl: z.string().url() })
  .strict();

export const IngestResultSchema = z
  .object({
    added: z.boolean(),
    existing: z.string().optional(),
    imageUrl: z.string().optional(),
    attempts: z.array(
      z
        .object({
          url: z.string(),
          source: z.string().optional(),
          status: z.enum(['accepted', 'skipped']),
          reason: z.string().optional(),
          detected: z.array(z.string()).optional(),
        })
        .strict()
    ),
  })
  .strict();

/** Assert helper: parse or fail the test with zod's readable error. */
export function expectContract<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new Error(`Contract violation:\n${JSON.stringify(result.error.issues, null, 2)}`);
  }
  return result.data;
}
