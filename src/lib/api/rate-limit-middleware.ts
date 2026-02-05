/**
 * Rate Limit Middleware for API Routes
 * 
 * Wrapper to easily add rate limiting to Next.js API routes
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, isBlocked, RateLimitType } from '@/lib/rate-limit'
import { auth } from '@/lib/auth'

/**
 * Extract client IP from request
 */
export function getClientIP(request: NextRequest): string {
  // Check various headers for the real IP
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }
  
  // Fallback to connection info (may not work in all environments)
  return request.headers.get('cf-connecting-ip') || 
         request.headers.get('true-client-ip') ||
         '127.0.0.1'
}

/**
 * Get rate limit type based on HTTP method
 */
export function getRateLimitTypeByMethod(method: string): RateLimitType {
  const writeMethods = ['POST', 'PUT', 'PATCH', 'DELETE']
  return writeMethods.includes(method.toUpperCase()) ? 'api-write' : 'api-read'
}

/**
 * Create 429 Too Many Requests response
 */
export function createRateLimitResponse(
  headers: Record<string, string>,
  message = 'Too many requests. Please try again later.'
): NextResponse {
  return NextResponse.json(
    {
      error: 'RATE_LIMIT_EXCEEDED',
      message,
      retryAfter: headers['Retry-After'] ? parseInt(headers['Retry-After']) : undefined,
    },
    {
      status: 429,
      headers,
    }
  )
}

/**
 * Create 403 Blocked response
 */
export function createBlockedResponse(): NextResponse {
  return NextResponse.json(
    {
      error: 'BLOCKED',
      message: 'Your access has been temporarily blocked due to suspicious activity.',
    },
    { status: 403 }
  )
}

/**
 * Options for rate limit wrapper
 */
interface RateLimitOptions {
  /** Rate limit type (defaults to auto-detect based on method) */
  type?: RateLimitType
  /** Custom identifier (defaults to tenantId or IP) */
  identifier?: (request: NextRequest) => Promise<string> | string
  /** Custom error message */
  errorMessage?: string
  /** Skip rate limiting for certain conditions */
  skip?: (request: NextRequest) => Promise<boolean> | boolean
}

/**
 * Wrap an API route handler with rate limiting
 * 
 * @example
 * ```ts
 * // app/api/bots/route.ts
 * import { withRateLimit } from '@/lib/api/rate-limit-middleware'
 * 
 * export const GET = withRateLimit(async (request) => {
 *   // Your handler logic
 *   return NextResponse.json({ bots: [] })
 * })
 * 
 * export const POST = withRateLimit(async (request) => {
 *   // Your handler logic
 *   return NextResponse.json({ success: true })
 * }, { type: 'api-write' })
 * ```
 */
export function withRateLimit<T extends NextRequest>(
  handler: (request: T, context?: any) => Promise<NextResponse>,
  options: RateLimitOptions = {}
): (request: T, context?: any) => Promise<NextResponse> {
  return async (request: T, context?: any) => {
    // Check if rate limiting should be skipped
    if (options.skip) {
      const shouldSkip = await options.skip(request)
      if (shouldSkip) {
        return handler(request, context)
      }
    }

    // Determine identifier
    let identifier: string
    if (options.identifier) {
      identifier = await options.identifier(request)
    } else {
      // Try to get tenantId from session, fallback to IP
      try {
        const session = await auth()
        identifier = session?.user?.tenantId || getClientIP(request)
      } catch {
        identifier = getClientIP(request)
      }
    }

    // Check if blocked
    if (await isBlocked(identifier)) {
      return createBlockedResponse()
    }

    // Determine rate limit type
    const type = options.type || getRateLimitTypeByMethod(request.method)

    // Check rate limit
    const result = await checkRateLimit(type, identifier)

    if (!result.success) {
      return createRateLimitResponse(result.headers, options.errorMessage)
    }

    // Call the actual handler
    const response = await handler(request, context)

    // Add rate limit headers to successful responses
    const headers = new Headers(response.headers)
    Object.entries(result.headers).forEach(([key, value]) => {
      headers.set(key, value)
    })

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}

/**
 * Rate limit middleware for webhook endpoints
 * Uses IP-based limiting with higher thresholds
 */
export function withWebhookRateLimit<T extends NextRequest>(
  handler: (request: T, context?: any) => Promise<NextResponse>
): (request: T, context?: any) => Promise<NextResponse> {
  return withRateLimit(handler, {
    type: 'webhook',
    identifier: (request) => getClientIP(request),
    errorMessage: 'Webhook rate limit exceeded. Please reduce request frequency.',
  })
}

/**
 * Rate limit middleware for auth endpoints
 * Uses email-based limiting with strict thresholds
 */
export function withAuthRateLimit<T extends NextRequest>(
  handler: (request: T, context?: any) => Promise<NextResponse>,
  getEmail: (request: T) => Promise<string> | string
): (request: T, context?: any) => Promise<NextResponse> {
  return withRateLimit(handler, {
    type: 'auth',
    identifier: getEmail,
    errorMessage: 'Too many authentication attempts. Please try again in 15 minutes.',
  })
}

/**
 * Check rate limit and return result (for use in existing handlers)
 * 
 * @example
 * ```ts
 * export async function POST(request: NextRequest) {
 *   const rateLimitResult = await checkRequestRateLimit(request, 'api-write')
 *   if (!rateLimitResult.success) {
 *     return rateLimitResult.response
 *   }
 *   
 *   // Continue with handler logic
 * }
 * ```
 */
export async function checkRequestRateLimit(
  request: NextRequest,
  type?: RateLimitType,
  customIdentifier?: string
): Promise<{ success: boolean; response?: NextResponse; headers: Record<string, string> }> {
  const identifier = customIdentifier || await (async () => {
    try {
      const session = await auth()
      return session?.user?.tenantId || getClientIP(request)
    } catch {
      return getClientIP(request)
    }
  })()

  // Check if blocked
  if (await isBlocked(identifier)) {
    return {
      success: false,
      response: createBlockedResponse(),
      headers: {},
    }
  }

  const limitType = type || getRateLimitTypeByMethod(request.method)
  const result = await checkRateLimit(limitType, identifier)

  if (!result.success) {
    return {
      success: false,
      response: createRateLimitResponse(result.headers),
      headers: result.headers,
    }
  }

  return {
    success: true,
    headers: result.headers,
  }
}
