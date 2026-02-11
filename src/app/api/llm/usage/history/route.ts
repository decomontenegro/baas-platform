import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  getUsageHistory,
  getHourlyUsageToday,
  getCurrentMonthUsage,
  getRealTimeStats,
} from '@/lib/llm-gateway/usage'
import { cacheGet, cacheSet } from '@/lib/admin-agent/cache'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Cache TTLs by type (in seconds)
const CACHE_TTL: Record<string, number> = {
  hourly: 60,   // 1 minute
  daily: 120,   // 2 minutes
  month: 120,   // 2 minutes
  realtime: 0,  // No cache - needs to be real-time
}

/**
 * GET /api/llm/usage/history
 *
 * Returns usage history for charts and analytics
 *
 * Query params:
 *   - days: number (default: 30, max: 90)
 *   - type: 'daily' | 'hourly' | 'realtime' | 'month' (default: 'daily')
 *   - noCache: 'true' to bypass cache (optional)
 *
 * Response varies by type:
 *   - daily: Array of DailyUsage for the last N days
 *   - hourly: Array of HourlyUsage for today
 *   - realtime: Stats for last 5 minutes
 *   - month: Current month detailed breakdown
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const tenantId = session.user.TenantId
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'No tenant associated with user' },
        { status: 403 }
      )
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') || '30', 10)))
    const type = searchParams.get('type') || 'daily'
    const noCache = searchParams.get('noCache') === 'true'

    // Cache key based on type and params
    const cacheKey = `llm:usage:history:${tenantId}:${type}:${type === 'daily' ? days : ''}`
    const ttl = CACHE_TTL[type] || 0

    // Try cache first (except for realtime)
    if (ttl > 0 && !noCache) {
      const cached = await cacheGet<unknown>(cacheKey)
      if (cached) {
        return NextResponse.json({
          success: true,
          data: cached,
          meta: {
            type,
            ...(type === 'daily' && { days }),
          },
          _cached: true,
        })
      }
    }

    let data: unknown

    switch (type) {
      case 'hourly':
        data = await getHourlyUsageToday(tenantId)
        break

      case 'realtime':
        data = await getRealTimeStats(tenantId)
        break

      case 'month':
        data = await getCurrentMonthUsage(tenantId)
        break

      case 'daily':
      default:
        data = await getUsageHistory(tenantId, days)
        break
    }

    // Cache the result (except for realtime)
    if (ttl > 0) {
      await cacheSet(cacheKey, data, ttl)
    }

    return NextResponse.json({
      success: true,
      data,
      meta: {
        type,
        ...(type === 'daily' && { days }),
      },
      _cached: false,
    })
  } catch (error) {
    console.error('[API] Error fetching LLM usage history:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch usage history',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
