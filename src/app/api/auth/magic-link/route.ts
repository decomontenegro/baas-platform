/**
// Force dynamic rendering
export const dynamic = 'force-dynamic'
 * Magic Link Authentication Endpoint
 * 
 * Rate limited: 5 requests per 15 minutes per email
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, isBlocked, blockIdentifier } from '@/lib/rate-limit'
import { getClientIP } from '@/lib/api/rate-limit-middleware'
import { z } from 'zod'

const magicLinkSchema = z.object({
  email: z.string().email('Invalid email address'),
})

// Track failed attempts per IP for abuse detection
const failedAttempts = new Map<string, { count: number; firstAttempt: number }>()
const ABUSE_THRESHOLD = 20 // Block after 20 failed attempts from same IP
const ABUSE_WINDOW = 3600000 // 1 hour window

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  
  // Check if IP is blocked
  if (await isBlocked(ip)) {
    return NextResponse.json(
      {
        error: 'BLOCKED',
        message: 'Your access has been temporarily blocked due to suspicious activity.',
      },
      { status: 403 }
    )
  }

  // Check IP-based abuse
  const ipAttempts = failedAttempts.get(ip)
  if (ipAttempts) {
    const isWithinWindow = Date.now() - ipAttempts.firstAttempt < ABUSE_WINDOW
    if (isWithinWindow && ipAttempts.count >= ABUSE_THRESHOLD) {
      // Block the IP
      await blockIdentifier(ip, 3600) // 1 hour block
      failedAttempts.delete(ip)
      
      return NextResponse.json(
        {
          error: 'BLOCKED',
          message: 'Too many requests from your IP. Please try again later.',
        },
        { status: 403 }
      )
    }
    
    // Reset counter if outside window
    if (!isWithinWindow) {
      failedAttempts.delete(ip)
    }
  }

  // Parse and validate request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    trackFailedAttempt(ip)
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const validation = magicLinkSchema.safeParse(body)
  if (!validation.success) {
    trackFailedAttempt(ip)
    return NextResponse.json(
      {
        error: 'VALIDATION_ERROR',
        message: validation.error.errors[0]?.message || 'Invalid email',
      },
      { status: 400 }
    )
  }

  const { email } = validation.data
  const normalizedEmail = email.toLowerCase().trim()

  // Rate limit check per email
  const rateLimitResult = await checkRateLimit('auth', normalizedEmail)
  
  // Add rate limit headers
  const headers = new Headers()
  Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
    headers.set(key, value)
  })

  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many magic link requests. Please try again in 15 minutes.',
        retryAfter: rateLimitResult.headers['Retry-After']
          ? parseInt(rateLimitResult.headers['Retry-After'])
          : undefined,
      },
      { status: 429, headers }
    )
  }

  try {
    // Here you would integrate with NextAuth's email provider
    // For now, we return success - the actual magic link sending
    // is handled by NextAuth's signIn('email', { email })
    
    // Note: In a real implementation, this endpoint might not be needed
    // as NextAuth handles magic links through its own routes.
    // This is here as an example of how to add rate limiting to auth.
    
    return NextResponse.json(
      {
        success: true,
        message: 'If an account exists, a magic link has been sent.',
      },
      { status: 200, headers }
    )
  } catch (error) {
    console.error('[Magic Link] Error:', error)
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: 'Failed to send magic link. Please try again.',
      },
      { status: 500, headers }
    )
  }
}

/**
 * Track failed attempts for abuse detection
 */
function trackFailedAttempt(ip: string) {
  const existing = failedAttempts.get(ip)
  if (existing) {
    existing.count++
  } else {
    failedAttempts.set(ip, { count: 1, firstAttempt: Date.now() })
  }
}
