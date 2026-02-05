/**
 * Notification Sender
 * 
 * Central module for sending notifications across all channels:
 * - In-app (database + realtime)
 * - Email (via Resend)
 * - Push (Web Push API - optional)
 */

import { prisma } from '@/lib/prisma'
import { NotificationType, NOTIFICATION_TYPE_META, ALL_NOTIFICATION_TYPES } from '@/types/notification'
import { Resend } from 'resend'
import { renderNotificationEmail } from './email-templates'
import { pushToRealtime } from './realtime'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface SendNotificationOptions {
  userId: string
  type: NotificationType
  title: string
  body?: string
  data?: Record<string, unknown>
  // Override preference checks (for critical notifications)
  force?: boolean
}

export interface NotificationResult {
  success: boolean
  notificationId?: string
  channels: {
    inApp: boolean
    email: boolean
    push: boolean
  }
  errors?: string[]
}

/**
 * Send a notification to a user
 */
export async function sendNotification(
  options: SendNotificationOptions
): Promise<NotificationResult> {
  const { userId, type, title, body, data, force } = options
  const errors: string[] = []
  const channels = { inApp: false, email: false, push: false }

  // Get user preferences (or use defaults)
  const preferences = await getOrCreatePreferences(userId, type)
  
  // Get user email for email notifications
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  })

  if (!user) {
    return {
      success: false,
      channels,
      errors: ['User not found'],
    }
  }

  let notificationId: string | undefined

  // 1. In-app notification (always create, preference controls display)
  if (force || preferences.inApp) {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId,
          type,
          title,
          body,
          data: data ? JSON.parse(JSON.stringify(data)) : undefined,
        },
      })
      notificationId = notification.id
      channels.inApp = true

      // Push to realtime channel
      await pushToRealtime(userId, {
        type: 'NEW_NOTIFICATION',
        notification: {
          id: notification.id,
          type,
          title,
          body,
          data,
          read: false,
          createdAt: notification.createdAt,
        },
      })
    } catch (error) {
      errors.push(`In-app notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // 2. Email notification
  if (force || preferences.email) {
    try {
      const html = renderNotificationEmail({
        type,
        title,
        body,
        data,
        userName: user.name || undefined,
      })

      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'BaaS <notifications@resend.dev>',
        to: user.email,
        subject: title,
        html,
      })
      channels.email = true
    } catch (error) {
      errors.push(`Email notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // 3. Push notification (if enabled and user has push subscription)
  if (force || preferences.push) {
    try {
      // TODO: Implement Web Push API
      // This requires storing push subscriptions in the database
      // and using web-push library to send
      channels.push = false // Not implemented yet
    } catch (error) {
      errors.push(`Push notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return {
    success: channels.inApp || channels.email || channels.push,
    notificationId,
    channels,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * Send notification to multiple users
 */
export async function broadcastNotification(
  userIds: string[],
  options: Omit<SendNotificationOptions, 'userId'>
): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0

  for (const userId of userIds) {
    const result = await sendNotification({ ...options, userId })
    if (result.success) {
      success++
    } else {
      failed++
    }
  }

  return { success, failed }
}

/**
 * Send system-wide notification to all users of a tenant
 */
export async function sendTenantNotification(
  tenantId: string,
  options: Omit<SendNotificationOptions, 'userId'>
): Promise<{ success: number; failed: number }> {
  const users = await prisma.user.findMany({
    where: { tenantId },
    select: { id: true },
  })

  return broadcastNotification(
    users.map(u => u.id),
    options
  )
}

/**
 * Get or create default preferences for a user and notification type
 */
async function getOrCreatePreferences(
  userId: string,
  type: NotificationType
): Promise<{ email: boolean; push: boolean; inApp: boolean }> {
  const existing = await prisma.notificationPreference.findUnique({
    where: { userId_type: { userId, type } },
  })

  if (existing) {
    return {
      email: existing.email,
      push: existing.push,
      inApp: existing.inApp,
    }
  }

  // Use defaults from type metadata
  const meta = NOTIFICATION_TYPE_META[type]
  return {
    email: meta.defaultEmail,
    push: meta.defaultPush,
    inApp: meta.defaultInApp,
  }
}

/**
 * Initialize default preferences for a new user
 */
export async function initializeUserPreferences(userId: string): Promise<void> {
  const createPromises = ALL_NOTIFICATION_TYPES.map(type => {
    const meta = NOTIFICATION_TYPE_META[type]
    return prisma.notificationPreference.upsert({
      where: { userId_type: { userId, type } },
      update: {},
      create: {
        userId,
        type,
        email: meta.defaultEmail,
        push: meta.defaultPush,
        inApp: meta.defaultInApp,
      },
    })
  })

  await Promise.all(createPromises)
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId: string, userId: string): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true, readAt: new Date() },
  })
  return result.count > 0
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true, readAt: new Date() },
  })
  return result.count
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, read: false, deletedAt: null },
  })
}

/**
 * Delete old notifications (cleanup job)
 */
export async function cleanupOldNotifications(daysOld: number = 90): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysOld)

  const result = await prisma.notification.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      read: true,
    },
  })
  return result.count
}
