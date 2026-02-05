/**
 * Notification Types
 */

export type NotificationType =
  | 'HANDOFF_REQUESTED'
  | 'HANDOFF_TIMEOUT'
  | 'BOT_ERROR'
  | 'USAGE_ALERT'
  | 'NEW_CONVERSATION'
  | 'MENTION'
  | 'DAILY_SUMMARY'
  | 'SYSTEM'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string | null
  data: Record<string, unknown> | null
  read: boolean
  readAt: Date | null
  createdAt: Date
}

export interface NotificationPreference {
  id: string
  userId: string
  type: NotificationType
  email: boolean
  push: boolean
  inApp: boolean
}

export interface NotificationWithMeta extends Notification {
  relativeTime: string
  icon: string
  color: string
}

// Notification type metadata
export const NOTIFICATION_TYPE_META: Record<NotificationType, {
  label: string
  description: string
  icon: string
  color: string
  defaultEmail: boolean
  defaultPush: boolean
  defaultInApp: boolean
}> = {
  HANDOFF_REQUESTED: {
    label: 'Handoff Requested',
    description: 'When someone requests a human agent',
    icon: 'user-plus',
    color: 'blue',
    defaultEmail: true,
    defaultPush: true,
    defaultInApp: true,
  },
  HANDOFF_TIMEOUT: {
    label: 'Handoff Timeout',
    description: 'When no one picks up a handoff request',
    icon: 'clock',
    color: 'orange',
    defaultEmail: true,
    defaultPush: true,
    defaultInApp: true,
  },
  BOT_ERROR: {
    label: 'Bot Error',
    description: 'When the bot fails to respond',
    icon: 'alert-triangle',
    color: 'red',
    defaultEmail: true,
    defaultPush: true,
    defaultInApp: true,
  },
  USAGE_ALERT: {
    label: 'Usage Alert',
    description: 'When approaching plan limits',
    icon: 'bar-chart',
    color: 'yellow',
    defaultEmail: true,
    defaultPush: false,
    defaultInApp: true,
  },
  NEW_CONVERSATION: {
    label: 'New Conversation',
    description: 'When a new conversation starts',
    icon: 'message-circle',
    color: 'green',
    defaultEmail: false,
    defaultPush: false,
    defaultInApp: true,
  },
  MENTION: {
    label: 'Mention',
    description: 'When the bot is mentioned',
    icon: 'at-sign',
    color: 'purple',
    defaultEmail: false,
    defaultPush: true,
    defaultInApp: true,
  },
  DAILY_SUMMARY: {
    label: 'Daily Summary',
    description: 'Daily activity summary',
    icon: 'file-text',
    color: 'gray',
    defaultEmail: true,
    defaultPush: false,
    defaultInApp: true,
  },
  SYSTEM: {
    label: 'System Updates',
    description: 'Platform updates and announcements',
    icon: 'bell',
    color: 'gray',
    defaultEmail: true,
    defaultPush: false,
    defaultInApp: true,
  },
}

export const ALL_NOTIFICATION_TYPES: NotificationType[] = [
  'HANDOFF_REQUESTED',
  'HANDOFF_TIMEOUT',
  'BOT_ERROR',
  'USAGE_ALERT',
  'NEW_CONVERSATION',
  'MENTION',
  'DAILY_SUMMARY',
  'SYSTEM',
]
