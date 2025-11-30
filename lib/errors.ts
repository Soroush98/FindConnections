import { NextRequest, NextResponse } from 'next/server';

/**
 * Error codes for application-specific errors
 */
export enum ErrorCode {
  // Authentication errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELDS = 'MISSING_REQUIRED_FIELDS',

  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',

  // Rate limiting
  RATE_LIMITED = 'RATE_LIMITED',
  BANNED = 'BANNED',

  // Server errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
}

/**
 * Custom application error class
 */
export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON response
   */
  toJSON() {
    return {
      error: this.message,
      code: this.code,
      ...(this.details && { details: this.details }),
    };
  }

  /**
   * Convert to NextResponse
   */
  toResponse(): NextResponse {
    return NextResponse.json(this.toJSON(), { status: this.statusCode });
  }

  // Static factory methods for common errors
  static unauthorized(message = 'Not authenticated'): AppError {
    return new AppError(message, 401, ErrorCode.UNAUTHORIZED);
  }

  static forbidden(message = 'Not authorized'): AppError {
    return new AppError(message, 403, ErrorCode.FORBIDDEN);
  }

  static invalidToken(message = 'Invalid token'): AppError {
    return new AppError(message, 401, ErrorCode.INVALID_TOKEN);
  }

  static tokenExpired(message = 'Token expired'): AppError {
    return new AppError(message, 401, ErrorCode.TOKEN_EXPIRED);
  }

  static notFound(resource = 'Resource'): AppError {
    return new AppError(`${resource} not found`, 404, ErrorCode.NOT_FOUND);
  }

  static alreadyExists(resource = 'Resource'): AppError {
    return new AppError(`${resource} already exists`, 409, ErrorCode.ALREADY_EXISTS);
  }

  static conflict(message: string): AppError {
    return new AppError(message, 409, ErrorCode.CONFLICT);
  }

  static validation(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(message, 400, ErrorCode.VALIDATION_ERROR, details);
  }

  static invalidInput(message: string): AppError {
    return new AppError(message, 400, ErrorCode.INVALID_INPUT);
  }

  static missingFields(fields: string[]): AppError {
    return new AppError(
      `Missing required fields: ${fields.join(', ')}`,
      400,
      ErrorCode.MISSING_REQUIRED_FIELDS,
      { fields }
    );
  }

  static rateLimited(message = 'Too many requests'): AppError {
    return new AppError(message, 429, ErrorCode.RATE_LIMITED);
  }

  static banned(message: string): AppError {
    return new AppError(message, 429, ErrorCode.BANNED);
  }

  static internal(message = 'Internal server error'): AppError {
    return new AppError(message, 500, ErrorCode.INTERNAL_ERROR);
  }

  static database(message = 'Database error'): AppError {
    return new AppError(message, 500, ErrorCode.DATABASE_ERROR);
  }

  static externalService(service: string): AppError {
    return new AppError(
      `External service error: ${service}`,
      502,
      ErrorCode.EXTERNAL_SERVICE_ERROR
    );
  }
}

/**
 * Type for API route handlers
 */
type RouteHandler = (request: NextRequest, context?: unknown) => Promise<NextResponse>;

/**
 * Higher-order function to wrap API route handlers with error handling
 */
export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context?: unknown): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      // Handle known application errors
      if (error instanceof AppError) {
        console.error(`[${error.code}] ${error.message}`, error.details || '');
        return error.toResponse();
      }

      // Handle JWT errors
      if (error instanceof Error) {
        if (error.name === 'JsonWebTokenError') {
          return AppError.invalidToken().toResponse();
        }
        if (error.name === 'TokenExpiredError') {
          return AppError.tokenExpired().toResponse();
        }
        if (error.name === 'ConditionalCheckFailedException') {
          return AppError.conflict('Resource has been modified. Please refresh and try again.').toResponse();
        }
      }

      // Log unexpected errors
      console.error('Unexpected error:', error);

      // Return generic error for unknown errors
      return AppError.internal().toResponse();
    }
  };
}

/**
 * Utility to assert a condition and throw an AppError if false
 */
export function assertOrThrow(
  condition: boolean,
  error: AppError
): asserts condition {
  if (!condition) {
    throw error;
  }
}
