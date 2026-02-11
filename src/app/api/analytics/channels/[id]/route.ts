import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import {
  successResponse,
  errorResponse,
  requireAuth,
  getDateRangeParams,
} from '@/lib/api-utils'
import { getTrendData } from '@/lib/analytics'
import { prisma } from '@/lib/prisma'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * GET /api/analytics/channels/[id]
 * Returns analytics for a specific channel
 * Query params: start, end (ISO date strings)
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const orgId = await requireAuth(request)
    const { id: channelId } = await params
    const searchParams = request.nextUrl.searchParams
    const { start, end } = getDateRangeParams(searchParams)

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

    // Verify channel belongs to this tenant
    const channel = await prisma.Channel.findFirst({
      where: {
        id: channelId,
        Workspace: {
          tenantId: membership.tenantId,
          deletedAt: null,
        },
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        lastConnectedAt: true,
        workspaceId: true,
      },
    })

    if (!channel) {
      return errorResponse('Canal não encontrado', 404)
    }

    // Get daily stats for this channel
    const dailyStats = await prisma.dailyStats.findMany({
      where: {
        tenantId: membership.tenantId,
        channelId,
        date: { gte: start, lte: end },
      },
      orderBy: { date: 'asc' },
    })

    // Calculate totals
    const totals = dailyStats.reduce(
      (acc, s) => ({
        messagesIn: acc.messagesIn + s.messagesIn,
        messagesOut: acc.messagesOut + s.messagesOut,
        conversationsStarted: acc.conversationsStarted + s.conversationsStarted,
        conversationsEnded: acc.conversationsEnded + s.conversationsEnded,
        handoffRequests: acc.handoffRequests + s.handoffRequests,
        handoffCompleted: acc.handoffCompleted + s.handoffCompleted,
        errorCount: acc.errorCount + s.errorCount,
        feedbackPositive: acc.feedbackPositive + s.feedbackPositive,
        feedbackNegative: acc.feedbackNegative + s.feedbackNegative,
        tokensIn: acc.tokensIn + s.tokensIn,
        tokensOut: acc.tokensOut + s.tokensOut,
        cost: acc.cost + Number(s.cost),
        uniqueUsers: acc.uniqueUsers + s.uniqueUsers,
      }),
      {
        messagesIn: 0,
        messagesOut: 0,
        conversationsStarted: 0,
        conversationsEnded: 0,
        handoffRequests: 0,
        handoffCompleted: 0,
        errorCount: 0,
        feedbackPositive: 0,
        feedbackNegative: 0,
        tokensIn: 0,
        tokensOut: 0,
        cost: 0,
        uniqueUsers: 0,
      }
    )

    // Calculate response time averages
    const statsWithResponseTime = dailyStats.filter((s) => s.avgResponseTimeMs !== null)
    const avgResponseTimeMs = statsWithResponseTime.length > 0
      ? Math.round(
          statsWithResponseTime.reduce((sum, s) => sum + (s.avgResponseTimeMs ?? 0) * s.messagesOut, 0) /
          statsWithResponseTime.reduce((sum, s) => sum + s.messagesOut, 0)
        )
      : null

    // Get percentiles from latest day
    const latestStats = dailyStats
      .filter((s) => s.p50ResponseTimeMs !== null)
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0]

    // Calculate derived metrics
    const totalMessages = totals.messagesIn + totals.messagesOut
    const totalConversations = totals.conversationsStarted
    const resolutionRate = totalConversations > 0
      ? ((totalConversations - totals.handoffRequests) / totalConversations) * 100
      : 100
    const errorRate = totalMessages > 0
      ? (totals.errorCount / totalMessages) * 100
      : 0
    const totalFeedback = totals.feedbackPositive + totals.feedbackNegative
    const satisfactionScore = totalFeedback > 0
      ? (totals.feedbackPositive / totalFeedback) * 100
      : null

    // Get trends
    const trends = await getTrendData(membership.tenantId, start, end, channelId)

    const response = {
      organizationId: orgId,
      tenantId: membership.tenantId,
      Channel: {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        status: channel.status,
        lastConnectedAt: channel.lastConnectedAt,
      },
      period: { start, end },
      metrics: {
        Message: {
          total: totalMessages,
          incoming: totals.messagesIn,
          outgoing: totals.messagesOut,
        },
        conversations: {
          started: totals.conversationsStarted,
          ended: totals.conversationsEnded,
          ongoing: totals.conversationsStarted - totals.conversationsEnded,
        },
        performance: {
          avgResponseTimeMs,
          p50ResponseTimeMs: latestStats?.p50ResponseTimeMs ?? null,
          p95ResponseTimeMs: latestStats?.p95ResponseTimeMs ?? null,
          p99ResponseTimeMs: latestStats?.p99ResponseTimeMs ?? null,
          resolutionRate: Math.round(resolutionRate * 10) / 10,
          errorRate: Math.round(errorRate * 100) / 100,
        },
        handoffs: {
          requested: totals.handoffRequests,
          completed: totals.handoffCompleted,
        },
        costs: {
          total: Math.round(totals.cost * 100) / 100,
          tokensIn: totals.tokensIn,
          tokensOut: totals.tokensOut,
          perMessage: totalMessages > 0
            ? Math.round((totals.cost / totalMessages) * 10000) / 10000
            : null,
        },
        satisfaction: {
          positive: totals.feedbackPositive,
          negative: totals.feedbackNegative,
          score: satisfactionScore !== null ? Math.round(satisfactionScore) : null,
        },
        uniqueUsers: totals.uniqueUsers,
      },
      trends,
      generatedAt: new Date(),
    }

    return successResponse(response)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error fetching channel analytics:', error)
    return errorResponse('Erro ao buscar analytics do canal', 500)
  }
}
