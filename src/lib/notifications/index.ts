/**
 * Notifications Module
 * 
 * Export all notification-related functions
 */

export {
  sendNotification,
  broadcastNotification,
  sendTenantNotification,
  initializeUserPreferences,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  cleanupOldNotifications,
  type SendNotificationOptions,
  type NotificationResult,
} from './sender'

export {
  pushToRealtime,
  pushNotificationRead,
  pushAllNotificationsRead,
  getPusherConfig,
  type RealtimeEvent,
} from './realtime'

export { renderNotificationEmail, renderDailySummaryEmail } from './email-templates'
