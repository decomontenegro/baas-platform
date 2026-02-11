import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getUsageSummary,
  type UsagePeriod,
  type UsageSummary,
} from '@/lib/llm-gateway/usage'
import { cacheGet, cacheSet } from '@/lib/admin-agent/cache'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Cache TTLs by period (in seconds)
const CACHE_TTL: Record<UsagePeriod, number> = {
  day: 30,    // 30 seconds - day data changes frequently
  week: 60,   // 1 minute
  month: 120, // 2 minutes - aggregated data, less volatile
}

/**
 * GET /api/llm/usage
 *
 * Returns usage summary for the authenticated tenant
 *
 * Query params:
 *   - period: 'day' | 'week' | 'month' (default: 'month')
 *   - noCache: 'true' to bypass cache (optional)
 *
 * Response:
 *   - UsageSummary with totals, top agents, top models, and budget info
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
    const period = (searchParams.get('period') || 'month') as UsagePeriod
    const noCache = searchParams.get('noCache') === 'true'

    // Validate period
    if (!['day', 'week', 'month'].includes(period)) {
      return NextResponse.json(
        { success: false, error: 'Invalid period. Use: day, week, or month' },
        { status: 400 }
      )
    }

    // Cache key: tenant-specific and period-specific
    const cacheKey = `llm:usage:${tenantId}:${period}`

    // Try cache first (unless noCache requested)
    if (!noCache) {
      const cached = await cacheGet<UsageSummary>(cacheKey)
      if (cached) {
        return NextResponse.json({
          success: true,
          data: cached,
          _cached: true,
        })
      }
    }

    // Get usage summary from database
    const summary = await getUsageSummary(tenantId, period)

    // Cache the result
    await cacheSet(cacheKey, summary, CACHE_TTL[period])

    return NextResponse.json({
      success: true,
      data: summary,
      _cached: false,
    })
  } catch (error) {
    console.error('[API] Error fetching LLM usage summary:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch usage summary',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
