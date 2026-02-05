/**
 * Admin Agent - Notification Orchestrator
 * 
 * Combines email, WhatsApp, and webhook notifications
 * with severity-based routing and throttling.
 */

import { sendAlertEmail, sendDailyReport, type Alert as EmailAlert } from './email'
import { sendAlertWhatsApp, sendUrgentMessage, broadcastAlert } from './whatsapp'
import { sendWebhook, createPayload } from './webhook'

// Re-export all providers
export * from './email'
export * from './whatsapp'
export * from './webhook'

// Types
interface AdminAgentConfig {
  id: string
  alertEmail?: string | null
  alertWhatsApp?: string | null
  alertWebhook?: string | null
}

interface AdminAlert {
  id: string
  type: string
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'
  title: string
  message: string
  botId?: string | null
  metadata?: Record<string, unknown>
}

interface NotificationResult {
  channel: string
  success: boolean
  error?: string
}

// Throttling cache: alertFingerprint -> lastSentAt
const throttleCache = new Map<string, number>()
const THROTTLE_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Create a fingerprint for throttling
 */
function createFingerprint(agentId: string, alert: AdminAlert): string {
  return `${agentId}:${alert.type}:${alert.severity}:${alert.botId || 'system'}:${alert.title}`
}

/**
 * Check if alert should be throttled
 */
function shouldThrottle(fingerprint: string): boolean {
  const lastSent = throttleCache.get(fingerprint)
  if (!lastSent) return false
  return Date.now() - lastSent < THROTTLE_WINDOW_MS
}

/**
 * Mark alert as sent for throttling
 */
function markAsSent(fingerprint: string): void {
  throttleCache.set(fingerprint, Date.now())
  
  // Cleanup old entries periodically
  if (throttleCache.size > 1000) {
    const now = Date.now()
    for (const [key, time] of throttleCache.entries()) {
      if (now - time > THROTTLE_WINDOW_MS) {
        throttleCache.delete(key)
      }
    }
  }
}

/**
 * Get channels to notify based on severity
 * 
 * INFO: log only
 * WARNING: email
 * ERROR: email + webhook
 * CRITICAL: email + whatsapp + webhook
 */
function getChannelsForSeverity(severity: string): string[] {
  switch (severity) {
    case 'INFO':
      return [] // log only
    case 'WARNING':
      return ['email']
    case 'ERROR':
      return ['email', 'webhook']
    case 'CRITICAL':
      return ['email', 'whatsapp', 'webhook']
    default:
      return ['email']
  }
}

/**
 * Send notification through all configured channels based on severity
 */
export async function sendNotification(
  adminAgent: AdminAgentConfig,
  alert: AdminAlert
): Promise<NotificationResult[]> {
  const results: NotificationResult[] = []
  
  // Check throttling
  const fingerprint = createFingerprint(adminAgent.id, alert)
  if (shouldThrottle(fingerprint)) {
    console.log(`[Notifier] Throttled alert: ${alert.title}`)
    return [{ channel: 'throttled', success: true }]
  }
  
  // Get channels based on severity
  const channels = getChannelsForSeverity(alert.severity)
  
  // Log all alerts
  console.log(`[Notifier] Alert [${alert.severity}]: ${alert.title} - ${alert.message}`)
  
  if (channels.length === 0) {
    return [{ channel: 'log', success: true }]
  }
  
  // Send to each configured channel
  const promises: Promise<NotificationResult>[] = []
  
  if (channels.includes('email') && adminAgent.alertEmail) {
    promises.push(
      sendAlertEmail(adminAgent.alertEmail, {
        id: alert.id,
        type: alert.type as 'health' | 'config' | 'security' | 'billing' | 'system',
        severity: alert.severity.toLowerCase() as 'critical' | 'warning' | 'info',
        title: alert.title,
        message: alert.message,
        botName: alert.metadata?.botName as string,
        botId: alert.botId || undefined,
        timestamp: new Date(),
        metadata: alert.metadata
      })
        .then(r => ({ channel: 'email', success: r.success, error: r.error }))
        .catch(e => ({ channel: 'email', success: false, error: e.message }))
    )
  }
  
  if (channels.includes('whatsapp') && adminAgent.alertWhatsApp) {
    promises.push(
      sendAlertWhatsApp(adminAgent.alertWhatsApp, {
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        botId: alert.botId,
        botName: alert.metadata?.botName as string,
        timestamp: new Date()
      })
        .then(r => ({ channel: 'whatsapp', success: r.success, error: r.error }))
        .catch(e => ({ channel: 'whatsapp', success: false, error: e.message }))
    )
  }
  
  if (channels.includes('webhook') && adminAgent.alertWebhook) {
    promises.push(
      sendWebhook(
        adminAgent.alertWebhook,
        createPayload(alert.type, alert.severity.toLowerCase(), alert.title, alert.message, alert.metadata)
      )
        .then(r => ({ channel: 'webhook', success: r.success, error: r.error }))
        .catch(e => ({ channel: 'webhook', success: false, error: e.message }))
    )
  }
  
  // Wait for all notifications
  const notificationResults = await Promise.all(promises)
  results.push(...notificationResults)
  
  // Mark as sent for throttling (only if at least one succeeded)
  if (notificationResults.some(r => r.success)) {
    markAsSent(fingerprint)
  }
  
  return results
}

/**
 * Get notification channels status for an admin agent
 */
export function getNotificationChannels(adminAgent: AdminAgentConfig): {
  channel: string
  configured: boolean
  destination?: string
}[] {
  return [
    {
      channel: 'email',
      configured: !!adminAgent.alertEmail,
      destination: adminAgent.alertEmail || undefined
    },
    {
      channel: 'whatsapp',
      configured: !!adminAgent.alertWhatsApp,
      destination: adminAgent.alertWhatsApp || undefined
    },
    {
      channel: 'webhook',
      configured: !!adminAgent.alertWebhook,
      destination: adminAgent.alertWebhook || undefined
    }
  ]
}
