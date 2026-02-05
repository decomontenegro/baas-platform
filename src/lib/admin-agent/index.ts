/**
 * Admin Agent Module
 * 
 * Complete supervisory system for multi-bot management:
 * - Health monitoring & auto-healing
 * - Notifications (email, WhatsApp, webhook)
 * - Metrics & reports
 * - Credential pool management
 * - Audit logging
 * - Real-time events
 * - Caching
 */

// Core health checking
export * from './health-checker'

// Config validation with rollback
export * from './config-validator'

// Emergency access management
export * from './emergency-access'

// System-wide health checks
export * from './system-health'

// Cron jobs for automated tasks
export * from './cron'

// Notifications
export * from './notifiers'

// Notification scheduling (quiet hours)
export * from './notification-scheduler'

// Personality configuration
export * from './personality'

// Templates
export * from './templates/notification-templates'

// Metrics collection
export * from './metrics/collector'

// Reports generation
export * from './reports/generator'

// Credential pool management
export * from './credential-pool'

// Audit logging
export * from './audit-logger'

// Caching (Redis with in-memory fallback)
export * from './cache'

// Real-time events
export * from './realtime-events'

// Clawdbot Gateway client
export * from './clawdbot-client'

// Re-export types for convenience
export type {
  BotHealthStatus,
  AdminAlertType,
  AdminAlertSeverity,
  AdminAlertStatus,
  AdminAgentStatus
} from '@prisma/client'
