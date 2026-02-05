/**
// Force dynamic rendering
export const dynamic = 'force-dynamic'
 * Mark All Notifications as Read API
 * 
 * POST /api/notifications/read-all - Mark all notifications as read
 */

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { 
  handleApiError, 
  apiResponse, 
  UnauthorizedError,
} from '@/lib/api/errors'
import { pushAllNotificationsRead } from '@/lib/notifications/realtime'

// Helper to get authenticated session
async function requireAuth() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new UnauthorizedError()
  }
  return session
}

// POST /api/notifications/read-all
export async function POST() {
  try {
    const session = await requireAuth()
    const userId = session.user.id

    // Update all unread notifications
    const result = await prisma.notification.updateMany({
      where: { userId, read: false, deletedAt: null },
      data: { read: true, readAt: new Date() },
    })

    // Push realtime update
    await pushAllNotificationsRead(userId, result.count)

    return apiResponse({
      success: true,
      count: result.count,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
