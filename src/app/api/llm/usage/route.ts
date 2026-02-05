import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getUsageSummary,
  type UsagePeriod,
} from '@/lib/llm-gateway/usage'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * GET /api/llm/usage
 *
 * Returns usage summary for the authenticated tenant
 *
 * Query params:
 *   - period: 'day' | 'week' | 'month' (default: 'month')
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

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'No tenant associated with user' },
        { status: 403 }
      )
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const period = (searchParams.get('period') || 'month') as UsagePeriod

    // Validate period
    if (!['day', 'week', 'month'].includes(period)) {
      return NextResponse.json(
        { success: false, error: 'Invalid period. Use: day, week, or month' },
        { status: 400 }
      )
    }

    // Get usage summary
    const summary = await getUsageSummary(tenantId, period)

    return NextResponse.json({
      success: true,
      data: summary,
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
