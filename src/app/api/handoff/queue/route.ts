import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, UnauthorizedError } from '@/lib/api/errors'
import { parseQuery, handoffQueueFilterSchema } from '@/lib/api/validate'

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// GET /api/handoff/queue - Get handoff queue
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const filters = parseQuery(request, handoffQueueFilterSchema)
    const { page, limit, workspaceId, status, priority, assignedTo, channelId } = filters
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      workspace: {
        tenantId,
      },
      deletedAt: null,
    }

    if (workspaceId) {
      where.workspaceId = workspaceId
    }

    if (status) {
      if (Array.isArray(status)) {
        where.status = { in: status }
      } else {
        where.status = status
      }
    }

    if (priority) {
      where.priority = priority
    }

    if (assignedTo) {
      where.assignedTo = assignedTo
    }

    if (channelId) {
      where.channelId = channelId
    }

    const [requests, total, stats] = await Promise.all([
      prisma.handoffRequest.findMany({
        where,
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
            },
          },
          notes: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
        skip,
        take: limit,
      }),
      prisma.handoffRequest.count({ where }),
      // Get queue stats
      prisma.handoffRequest.groupBy({
        by: ['status'],
        where: {
          workspace: { tenantId },
          deletedAt: null,
        },
        _count: true,
      }),
    ])

    // Format stats
    const queueStats = {
      pending: 0,
      assigned: 0,
      inProgress: 0,
      onHold: 0,
      resolved: 0,
      total: 0,
    }

    stats.forEach((s) => {
      const count = s._count
      queueStats.total += count
      switch (s.status) {
        case 'PENDING':
          queueStats.pending = count
          break
        case 'ASSIGNED':
          queueStats.assigned = count
          break
        case 'IN_PROGRESS':
          queueStats.inProgress = count
          break
        case 'ON_HOLD':
          queueStats.onHold = count
          break
        case 'RESOLVED':
          queueStats.resolved = count
          break
      }
    })

    return apiResponse({
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: queueStats,
      filters: {
        workspaceId,
        status,
        priority,
        assignedTo,
        channelId,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
