/**
// Force dynamic rendering
export const dynamic = 'force-dynamic'
 * Mark Notification as Read API
 * 
 * PATCH /api/notifications/[id]/read - Mark single notification as read
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { 
  handleApiError, 
  apiResponse, 
  UnauthorizedError,
  NotFoundError,
} from '@/lib/api/errors'
import { pushNotificationRead } from '@/lib/notifications/realtime'

// Helper to get authenticated session
async function requireAuth() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new UnauthorizedError()
  }
  return session
}

// PATCH /api/notifications/[id]/read
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const userId = session.user.id
    const { id } = await params

    // Find and update the notification
    const notification = await prisma.notification.findFirst({
      where: { id, userId, deletedAt: null },
    })

    if (!notification) {
      throw new NotFoundError('Notification')
    }

    if (!notification.read) {
      await prisma.notification.update({
        where: { id },
        data: { read: true, readAt: new Date() },
      })

      // Push realtime update
      await pushNotificationRead(userId, id)
    }

    return apiResponse({
      success: true,
      notification: {
        id: notification.id,
        read: true,
        readAt: notification.readAt || new Date(),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
