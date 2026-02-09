import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  getUsageByAgent,
  getUsageByModel,
  getUsageByProvider,
  type UsagePeriod,
} from '@/lib/llm-gateway/usage'
import { cacheGet, cacheSet } from '@/lib/admin-agent/cache'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

type GroupBy = 'agent' | 'model' | 'provider'

// Cache TTLs by period (in seconds)
const CACHE_TTL: Record<UsagePeriod, number> = {
  day: 30,    // 30 seconds - day data changes frequently
  week: 60,   // 1 minute
  month: 120, // 2 minutes - aggregated data, less volatile
}

/**
 * GET /api/llm/usage/breakdown
 *
 * Returns detailed breakdown of usage by different dimensions
 *
 * Query params:
 *   - groupBy: 'agent' | 'model' | 'provider' (required)
 *   - period: 'day' | 'week' | 'month' (default: 'month')
 *   - noCache: 'true' to bypass cache (optional)
 *
 * Response:
 *   - Array of usage data grouped by the specified dimension
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

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'No tenant associated with user' },
        { status: 403 }
      )
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const groupBy = searchParams.get('groupBy') as GroupBy | null
    const period = (searchParams.get('period') || 'month') as UsagePeriod
    const noCache = searchParams.get('noCache') === 'true'

    // Validate groupBy
    if (!groupBy || !['agent', 'model', 'provider'].includes(groupBy)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or missing groupBy parameter. Use: agent, model, or provider',
        },
        { status: 400 }
      )
    }

    // Validate period
    if (!['day', 'week', 'month'].includes(period)) {
      return NextResponse.json(
        { success: false, error: 'Invalid period. Use: day, week, or month' },
        { status: 400 }
      )
    }

    // Cache key: tenant + groupBy + period
    const cacheKey = `llm:usage:breakdown:${tenantId}:${groupBy}:${period}`

    // Try cache first
    if (!noCache) {
      const cached = await cacheGet<unknown[]>(cacheKey)
      if (cached) {
        return NextResponse.json({
          success: true,
          data: cached,
          meta: {
            groupBy,
            period,
            count: cached.length,
          },
          _cached: true,
        })
      }
    }

    // Get breakdown data based on groupBy
    let data: unknown[]

    switch (groupBy) {
      case 'agent':
        data = await getUsageByAgent(tenantId, period)
        break

      case 'model':
        data = await getUsageByModel(tenantId, period)
        break

      case 'provider':
        data = await getUsageByProvider(tenantId, period)
        break
    }

    // Cache the result
    await cacheSet(cacheKey, data, CACHE_TTL[period])

    return NextResponse.json({
      success: true,
      data,
      meta: {
        groupBy,
        period,
        count: data.length,
      },
      _cached: false,
    })
  } catch (error) {
    console.error('[API] Error fetching LLM usage breakdown:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch usage breakdown',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
