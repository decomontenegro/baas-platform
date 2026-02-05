/**
 * Rate Limiting with Upstash Redis
 * 
 * Provides sliding window rate limiting for different endpoint types:
 * - Auth/magic-link: 5 req/15min per email
 * - API reads: 100 req/min per tenant
 * - API writes: 30 req/min per tenant
 * - Webhook: 1000 req/min per IP
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { logger } from './logger'

// Upstash Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Check if Upstash is configured
export const isUpstashConfigured = () => {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

/**
 * Rate limiter types with their configurations
 */
export type RateLimitType = 'auth' | 'api-read' | 'api-write' | 'webhook'

interface RateLimitConfig {
  requests: number
  window: `${number} ${'s' | 'm' | 'h' | 'd'}`
  prefix: string
}

const RATE_LIMIT_CONFIGS: Record<RateLimitType, RateLimitConfig> = {
  // Auth: 5 requests per 15 minutes per email
  'auth': {
    requests: 5,
    window: '15 m',
    prefix: 'ratelimit:auth',
  },
  // API reads: 100 requests per minute per tenant
  'api-read': {
    requests: 100,
    window: '1 m',
    prefix: 'ratelimit:api-read',
  },
  // API writes: 30 requests per minute per tenant
  'api-write': {
    requests: 30,
    window: '1 m',
    prefix: 'ratelimit:api-write',
  },
  // Webhooks: 1000 requests per minute per IP
  'webhook': {
    requests: 1000,
    window: '1 m',
    prefix: 'ratelimit:webhook',
  },
}

// Create rate limiters for each type
const rateLimiters = new Map<RateLimitType, Ratelimit>()

/**
 * Get or create a rate limiter for a specific type
 */
function getRateLimiter(type: RateLimitType): Ratelimit {
  if (!rateLimiters.has(type)) {
    const config = RATE_LIMIT_CONFIGS[type]
    rateLimiters.set(
      type,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(config.requests, config.window),
        prefix: config.prefix,
        analytics: true,
      })
    )
  }
  return rateLimiters.get(type)!
}

/**
 * Rate limit result with headers
 */
export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
  headers: Record<string, string>
}

/**
 * Check rate limit for an identifier
 * 
 * @param type - Type of rate limit to apply
 * @param identifier - Unique identifier (email, tenantId, IP)
 * @returns Rate limit result with headers
 */
export async function checkRateLimit(
  type: RateLimitType,
  identifier: string
): Promise<RateLimitResult> {
  // Skip rate limiting if Upstash is not configured (dev mode)
  if (!isUpstashConfigured()) {
    logger.warn({ type, identifier }, 'Upstash not configured, skipping rate limit check')
    return {
      success: true,
      limit: RATE_LIMIT_CONFIGS[type].requests,
      remaining: RATE_LIMIT_CONFIGS[type].requests,
      reset: Date.now() + 60000,
      headers: {},
    }
  }

  const limiter = getRateLimiter(type)
  const { success, limit, remaining, reset } = await limiter.limit(identifier)

  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(reset),
  }

  if (!success) {
    headers['Retry-After'] = String(Math.ceil((reset - Date.now()) / 1000))
  }

  return {
    success,
    limit,
    remaining,
    reset,
    headers,
  }
}

/**
 * Get remaining requests for an identifier
 */
export async function getRemainingRequests(
  type: RateLimitType,
  identifier: string
): Promise<number> {
  if (!isUpstashConfigured()) {
    return RATE_LIMIT_CONFIGS[type].requests
  }

  const limiter = getRateLimiter(type)
  const { remaining } = await limiter.limit(identifier)
  return remaining
}

/**
 * Reset rate limit for an identifier (admin use)
 */
export async function resetRateLimit(
  type: RateLimitType,
  identifier: string
): Promise<void> {
  if (!isUpstashConfigured()) {
    return
  }

  const config = RATE_LIMIT_CONFIGS[type]
  const key = `${config.prefix}:${identifier}`
  await redis.del(key)
}

/**
 * Block an identifier completely (for abuse prevention)
 */
export async function blockIdentifier(
  identifier: string,
  durationSeconds: number = 3600
): Promise<void> {
  if (!isUpstashConfigured()) {
    return
  }

  const key = `ratelimit:blocked:${identifier}`
  await redis.setex(key, durationSeconds, '1')
}

/**
 * Check if an identifier is blocked
 */
export async function isBlocked(identifier: string): Promise<boolean> {
  if (!isUpstashConfigured()) {
    return false
  }

  const key = `ratelimit:blocked:${identifier}`
  const blocked = await redis.get(key)
  return blocked === '1'
}

/**
 * Unblock an identifier
 */
export async function unblockIdentifier(identifier: string): Promise<void> {
  if (!isUpstashConfigured()) {
    return
  }

  const key = `ratelimit:blocked:${identifier}`
  await redis.del(key)
}

/**
 * Get rate limit config for a type
 */
export function getRateLimitConfig(type: RateLimitType): RateLimitConfig {
  return RATE_LIMIT_CONFIGS[type]
}

// Export the redis client for custom usage
export { redis }
