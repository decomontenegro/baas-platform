import { NextRequest, NextResponse } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import {
  errorResponse,
  requireAuth,
  getDateRangeParams,
} from '@/lib/api-utils'
import { exportAnalyticsCSV, getOverviewMetrics, getTrendData, getChannelBreakdown } from '@/lib/analytics'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/analytics/export
 * Export analytics data as CSV or JSON
 * Query params: start, end, format (csv|json)
 */
export async function GET(request: NextRequest) {
  try {
    const orgId = await requireAuth(request)
    const searchParams = request.nextUrl.searchParams
    const { start, end } = getDateRangeParams(searchParams)
    const format = searchParams.get('format') || 'csv'

    // Validate format
    if (!['csv', 'json'].includes(format)) {
      return errorResponse('Formato inválido. Use: csv ou json')
    }

    // Validate date range
    if (start > end) {
      return errorResponse('Data inicial não pode ser maior que a final')
    }

    const maxRange = 365 * 24 * 60 * 60 * 1000 // 1 year
    if (end.getTime() - start.getTime() > maxRange) {
      return errorResponse('Período máximo é de 1 ano')
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

    if (format === 'csv') {
      // Export as CSV
      const csv = await exportAnalyticsCSV(tenantId, start, end)
      
      const filename = `analytics_${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}.csv`
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    } else {
      // Export as JSON
      const [overview, trends, channelBreakdown] = await Promise.all([
        getOverviewMetrics(tenantId, start, end),
        getTrendData(tenantId, start, end),
        getChannelBreakdown(tenantId, start, end),
      ])

      const exportData = {
        exportedAt: new Date().toISOString(),
        period: { start: start.toISOString(), end: end.toISOString() },
        tenantId,
        overview,
        dailyTrends: trends,
        channelBreakdown,
      }

      const filename = `analytics_${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}.json`
      
      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error exporting analytics:', error)
    return errorResponse('Erro ao exportar analytics', 500)
  }
}
