import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { apiLogger, logApiError } from '@/lib/logger'

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED')
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN')
  }
}

export class NotFoundError extends ApiError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND')
  }
}

export class BadRequestError extends ApiError {
  constructor(message = 'Bad request') {
    super(message, 400, 'BAD_REQUEST')
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT')
  }
}

export interface ErrorResponse {
  error: {
    message: string
    code?: string
    details?: unknown
  }
}

export function handleApiError(error: unknown): NextResponse<ErrorResponse> {
  // Zod validation errors
  if (error instanceof ZodError) {
    const details = error.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }))
    
    apiLogger.warn({
      type: 'validation_error',
      details,
    }, 'Validation error')

    return NextResponse.json(
      {
        error: {
          message: 'Validation error',
          code: 'VALIDATION_ERROR',
          details,
        },
      },
      { status: 400 }
    )
  }

  // Custom API errors
  if (error instanceof ApiError) {
    // Log at appropriate level based on status code
    if (error.statusCode >= 500) {
      logApiError(error, { statusCode: error.statusCode, code: error.code })
    } else if (error.statusCode >= 400) {
      apiLogger.warn({
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
      }, `API Error: ${error.message}`)
    }

    return NextResponse.json(
      {
        error: {
          message: error.message,
          code: error.code,
        },
      },
      { status: error.statusCode }
    )
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    apiLogger.warn({
      type: 'database_error',
      prismaCode: error.code,
      meta: error.meta,
    }, `Database error: ${error.code}`)

    switch (error.code) {
      case 'P2002': // Unique constraint violation
        return NextResponse.json(
          {
            error: {
              message: 'Resource already exists',
              code: 'CONFLICT',
            },
          },
          { status: 409 }
        )
      case 'P2025': // Record not found
        return NextResponse.json(
          {
            error: {
              message: 'Resource not found',
              code: 'NOT_FOUND',
            },
          },
          { status: 404 }
        )
      default:
        return NextResponse.json(
          {
            error: {
              message: 'Database error',
              code: 'DATABASE_ERROR',
            },
          },
          { status: 500 }
        )
    }
  }

  // Generic errors
  if (error instanceof Error) {
    if (error.message === 'Unauthorized') {
      apiLogger.warn('Unauthorized access attempt')
      return NextResponse.json(
        {
          error: {
            message: 'Unauthorized',
            code: 'UNAUTHORIZED',
          },
        },
        { status: 401 }
      )
    }
  }

  // Unknown errors - log with full details
  logApiError(error, { statusCode: 500 })

  return NextResponse.json(
    {
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
    },
    { status: 500 }
  )
}

// Success response helper
export function apiResponse<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status })
}

// No content response
export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 })
}
