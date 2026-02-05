import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import {
  successResponse,
  errorResponse,
  requireAuth,
  getDateRangeParams,
} from '@/lib/api-utils'
import { getUsageSummary, getTrendData, getCostBreakdown } from '@/lib/analytics'
import { prisma } from '@/lib/prisma'

type Granularity = 'hour' | 'day' | 'week' | 'month'

/**
 * GET /api/analytics/usage
 * Returns detailed usage data by period
 * Query params: start, end, granularity (hour|day|week|month)
 */
export async function GET(request: NextRequest) {
  try {
    const orgId = await requireAuth(request)
    const searchParams = request.nextUrl.searchParams
    const { start, end } = getDateRangeParams(searchParams)
    const granularity = (searchParams.get('granularity') || 'day') as Granularity

    // Validate granularity
    const validGranularities: Granularity[] = ['hour', 'day', 'week', 'month']
    if (!validGranularities.includes(granularity)) {
      return errorResponse(`Granularidade inválida. Use: ${validGranularities.join(', ')}`)
    }

    // Validate date range
    if (start > end) {
      return errorResponse('Data inicial não pode ser maior que a final')
    }

    // Apply max range limits based on granularity
    const maxRanges: Record<Granularity, number> = {
      hour: 7 * 24 * 60 * 60 * 1000, // 7 days for hourly
      day: 90 * 24 * 60 * 60 * 1000, // 90 days for daily
      week: 365 * 24 * 60 * 60 * 1000, // 1 year for weekly
      month: 3 * 365 * 24 * 60 * 60 * 1000, // 3 years for monthly
    }

    if (end.getTime() - start.getTime() > maxRanges[granularity]) {
      const maxDays = Math.floor(maxRanges[granularity] / (24 * 60 * 60 * 1000))
      return errorResponse(`Período máximo para granularidade '${granularity}' é ${maxDays} dias`)
    }

    // Get tenant from membership
    const membership = await prisma.membership.findFirst({
      where: {
        userId: orgId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: { tenantId: true },
    })

    if (!membership) {
      return errorResponse('Tenant não encontrado', 404)
    }

    const tenantId = membership.tenantId

    // Get usage summary
    const summary = await getUsageSummary(tenantId, start, end)

    // Get trend data
    const trends = await getTrendData(tenantId, start, end)

    // Get cost breakdown
    const costBreakdown = await getCostBreakdown(tenantId, start, end)

    // Aggregate trends by granularity if needed
    let aggregatedTrends = trends
    if (granularity === 'week') {
      aggregatedTrends = aggregateByWeek(trends)
    } else if (granularity === 'month') {
      aggregatedTrends = aggregateByMonth(trends)
    }

    const response = {
      organizationId: orgId,
      tenantId,
      period: { start, end, granularity },
      summary,
      trends: aggregatedTrends,
      costBreakdown,
      exportFormats: ['csv', 'json'],
      generatedAt: new Date(),
    }

    return successResponse(response)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error fetching usage report:', error)
    return errorResponse('Erro ao buscar relatório de uso', 500)
  }
}

// Helper to aggregate daily trends into weekly
function aggregateByWeek(trends: Array<{ date: string; messagesIn: number; messagesOut: number; cost: number; avgResponseTimeMs: number | null; uniqueUsers: number }>) {
  const weeks = new Map<string, typeof trends[0]>()
  
  for (const t of trends) {
    const date = new Date(t.date)
    // Get Monday of the week
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(date.setDate(diff))
    const weekKey = monday.toISOString().split('T')[0]
    
    const existing = weeks.get(weekKey) || {
      date: weekKey,
      messagesIn: 0,
      messagesOut: 0,
      cost: 0,
      avgResponseTimeMs: null as number | null,
      uniqueUsers: 0,
    }
    
    existing.messagesIn += t.messagesIn
    existing.messagesOut += t.messagesOut
    existing.cost += t.cost
    existing.uniqueUsers += t.uniqueUsers
    // For avg, we'd need weighted average but simplify here
    if (t.avgResponseTimeMs !== null) {
      existing.avgResponseTimeMs = existing.avgResponseTimeMs
        ? Math.round((existing.avgResponseTimeMs + t.avgResponseTimeMs) / 2)
        : t.avgResponseTimeMs
    }
    
    weeks.set(weekKey, existing)
  }
  
  return Array.from(weeks.values()).sort((a, b) => a.date.localeCompare(b.date))
}

// Helper to aggregate daily trends into monthly
function aggregateByMonth(trends: Array<{ date: string; messagesIn: number; messagesOut: number; cost: number; avgResponseTimeMs: number | null; uniqueUsers: number }>) {
  const months = new Map<string, typeof trends[0]>()
  
  for (const t of trends) {
    const monthKey = t.date.substring(0, 7) // YYYY-MM
    
    const existing = months.get(monthKey) || {
      date: monthKey + '-01',
      messagesIn: 0,
      messagesOut: 0,
      cost: 0,
      avgResponseTimeMs: null as number | null,
      uniqueUsers: 0,
    }
    
    existing.messagesIn += t.messagesIn
    existing.messagesOut += t.messagesOut
    existing.cost += t.cost
    existing.uniqueUsers += t.uniqueUsers
    if (t.avgResponseTimeMs !== null) {
      existing.avgResponseTimeMs = existing.avgResponseTimeMs
        ? Math.round((existing.avgResponseTimeMs + t.avgResponseTimeMs) / 2)
        : t.avgResponseTimeMs
    }
    
    months.set(monthKey, existing)
  }
  
  return Array.from(months.values()).sort((a, b) => a.date.localeCompare(b.date))
}
