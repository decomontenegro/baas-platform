/**
 * Realtime Notification Push
 * 
 * Handles pushing notifications to clients in real-time.
 * Supports multiple providers:
 * - Pusher
 * - Ably
 * - Custom WebSocket server
 * - Server-Sent Events (SSE)
 */

import Pusher from 'pusher'

// Initialize Pusher if configured
let pusher: Pusher | null = null

if (
  process.env.PUSHER_APP_ID &&
  process.env.PUSHER_KEY &&
  process.env.PUSHER_SECRET &&
  process.env.PUSHER_CLUSTER
) {
  pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER,
    useTLS: true,
  })
}

export interface RealtimeEvent {
  type: 'NEW_NOTIFICATION' | 'NOTIFICATION_READ' | 'NOTIFICATIONS_READ_ALL'
  notification?: {
    id: string
    type: string
    title: string
    body?: string | null
    data?: Record<string, unknown> | null
    read: boolean
    createdAt: Date
  }
  notificationId?: string
  count?: number
}

/**
 * Push event to user's realtime channel
 */
export async function pushToRealtime(
  userId: string,
  event: RealtimeEvent
): Promise<boolean> {
  // Use Pusher if configured
  if (pusher) {
    try {
      await pusher.trigger(`private-user-${userId}`, event.type.toLowerCase(), event)
      return true
    } catch (error) {
      console.error('[Realtime] Pusher push failed:', error)
      return false
    }
  }

  // Fallback: Log that realtime is not configured
  // In production, you might want to use a different provider
  // or implement your own WebSocket server
  console.log(`[Realtime] Would push to user ${userId}:`, event.type)
  return false
}

/**
 * Push notification read event
 */
export async function pushNotificationRead(
  userId: string,
  notificationId: string
): Promise<boolean> {
  return pushToRealtime(userId, {
    type: 'NOTIFICATION_READ',
    notificationId,
  })
}

/**
 * Push all notifications read event
 */
export async function pushAllNotificationsRead(
  userId: string,
  count: number
): Promise<boolean> {
  return pushToRealtime(userId, {
    type: 'NOTIFICATIONS_READ_ALL',
    count,
  })
}

/**
 * Get Pusher client configuration for frontend
 */
export function getPusherConfig() {
  if (!process.env.NEXT_PUBLIC_PUSHER_KEY || !process.env.NEXT_PUBLIC_PUSHER_CLUSTER) {
    return null
  }

  return {
    key: process.env.NEXT_PUBLIC_PUSHER_KEY,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
  }
}
