/**
// Force dynamic rendering
export const dynamic = 'force-dynamic'
 * Notifications API
 * 
 * GET /api/notifications - List notifications (paginated)
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { 
  handleApiError, 
  apiResponse, 
  UnauthorizedError,
} from '@/lib/api/errors'
import { z } from 'zod'

// Query params schema
const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  unreadOnly: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
  type: z.string().optional(),
})

// Helper to get authenticated session
async function requireAuth() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new UnauthorizedError()
  }
  return session
}

// GET /api/notifications
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const userId = session.user.id

    // Parse query params
    const { searchParams } = new URL(request.url)
    const query = querySchema.parse({
      page: searchParams.get('page') || 1,
      limit: searchParams.get('limit') || 20,
      unreadOnly: searchParams.get('unreadOnly') || undefined,
      type: searchParams.get('type') || undefined,
    })

    const { page, limit, unreadOnly, type } = query
    const skip = (page - 1) * limit

    // Build where clause
    const where: Record<string, unknown> = {
      userId,
      deletedAt: null,
    }

    if (unreadOnly) {
      where.read = false
    }

    if (type) {
      where.type = type
    }

    // Get notifications with count
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId, read: false, deletedAt: null },
      }),
    ])

    return apiResponse({
      notifications: notifications.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data,
        read: n.read,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      unreadCount,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
