import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  getUsageHistory,
  getHourlyUsageToday,
  getCurrentMonthUsage,
  getRealTimeStats,
} from '@/lib/llm-gateway/usage'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * GET /api/llm/usage/history
 *
 * Returns usage history for charts and analytics
 *
 * Query params:
 *   - days: number (default: 30, max: 90)
 *   - type: 'daily' | 'hourly' | 'realtime' | 'month' (default: 'daily')
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

    const tenantId = session.user.tenantId
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

    let data: any

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

    return NextResponse.json({
      success: true,
      data,
      meta: {
        type,
        ...(type === 'daily' && { days }),
      },
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
