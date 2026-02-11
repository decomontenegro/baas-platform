import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import {
  successResponse,
  errorResponse,
  requireAuth,
  getDateRangeParams,
} from '@/lib/api-utils'
import { getTrendData, getPeakHours, getChannelBreakdown } from '@/lib/analytics'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/analytics/trends
 * Returns trend data for charts (activity, peak hours, channel breakdown)
 * Query params: start, end, channelId (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const orgId = await requireAuth(request)
    const searchParams = request.nextUrl.searchParams
    const { start, end } = getDateRangeParams(searchParams)
    const channelId = searchParams.get('channelId') || undefined

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

    // Validate channelId if provided
    if (channelId) {
      const channel = await prisma.Channel.findFirst({
        where: {
          id: channelId,
          Workspace: {
            tenantId,
            deletedAt: null,
          },
          deletedAt: null,
        },
      })

      if (!channel) {
        return errorResponse('Canal não encontrado', 404)
      }
    }

    // Get activity trends
    const activity = await getTrendData(tenantId, start, end, channelId)

    // Get peak hours (tenant level only)
    const peakHours = await getPeakHours(tenantId, start, end)

    // Get channel breakdown (only if no specific channel selected)
    let channelBreakdown = null
    if (!channelId) {
      channelBreakdown = await getChannelBreakdown(tenantId, start, end)
    }

    // Calculate some derived trend metrics
    const totalMessages = activity.reduce((sum, a) => sum + a.messagesIn + a.messagesOut, 0)
    const totalCost = activity.reduce((sum, a) => sum + a.cost, 0)
    const avgDaily = activity.length > 0
      ? {
          messages: Math.round(totalMessages / activity.length),
          cost: Math.round((totalCost / activity.length) * 100) / 100,
        }
      : { messages: 0, cost: 0 }

    // Find busiest and quietest days
    let busiestDay = null
    let quietestDay = null
    if (activity.length > 0) {
      const sorted = [...activity].sort(
        (a, b) => (b.messagesIn + b.messagesOut) - (a.messagesIn + a.messagesOut)
      )
      busiestDay = {
        date: sorted[0].date,
        messages: sorted[0].messagesIn + sorted[0].messagesOut,
      }
      quietestDay = {
        date: sorted[sorted.length - 1].date,
        messages: sorted[sorted.length - 1].messagesIn + sorted[sorted.length - 1].messagesOut,
      }
    }

    // Find peak hour
    let peakHour = null
    if (peakHours.length > 0) {
      const maxHour = peakHours.reduce((max, h) => h.Message > max.Message ? h : max)
      peakHour = {
        hour: maxHour.hour,
        label: maxHour.label,
        messages: maxHour.Message,
      }
    }

    const response = {
      organizationId: orgId,
      tenantId,
      period: { start, end },
      channelId: channelId || null,
      activity,
      peakHours,
      channelBreakdown,
      insights: {
        avgDaily,
        busiestDay,
        quietestDay,
        peakHour,
        totalMessages,
        totalCost: Math.round(totalCost * 100) / 100,
      },
      generatedAt: new Date(),
    }

    return successResponse(response)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error fetching analytics trends:', error)
    return errorResponse('Erro ao buscar tendências', 500)
  }
}
