import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, UnauthorizedError } from '@/lib/api/errors'
import { parseQuery } from '@/lib/api/validate'
import { executionHistoryFilterSchema } from '@/lib/api/actions-schemas'

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// GET /api/actions/history - Get action execution history
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const filters = parseQuery(request, executionHistoryFilterSchema)
    const { page, limit, actionId, channelId, status, dateFrom, dateTo } = filters
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      action: {
        tenantId,
      },
    }

    if (actionId) {
      where.actionId = actionId
    }

    if (channelId) {
      where.channelId = channelId
    }

    if (status) {
      where.status = status
    }

    if (dateFrom || dateTo) {
      where.executedAt = {}
      if (dateFrom) where.executedAt.gte = new Date(dateFrom)
      if (dateTo) where.executedAt.lte = new Date(dateTo)
    }

    const [executions, total] = await Promise.all([
      prisma.actionExecution.findMany({
        where,
        include: {
          action: {
            select: {
              id: true,
              name: true,
              trigger: true,
              type: true,
            },
          },
        },
        orderBy: { executedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.actionExecution.count({ where }),
    ])

    // Get aggregated stats
    const stats = await prisma.actionExecution.groupBy({
      by: ['status'],
      where: {
        action: { tenantId },
        executedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      _count: true,
      _avg: {
        durationMs: true,
      },
    })

    const statsMap = stats.reduce((acc, s) => {
      acc[s.status] = {
        count: s._count,
        avgDurationMs: Math.round(s._avg.durationMs || 0),
      }
      return acc
    }, {} as Record<string, { count: number; avgDurationMs: number }>)

    return apiResponse({
      executions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        last24h: statsMap,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
