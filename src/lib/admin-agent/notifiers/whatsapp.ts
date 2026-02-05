/**
 * Admin Agent - WhatsApp Notification Service
 * 
 * Sends alerts and urgent messages via WhatsApp using Clawdbot or Twilio API
 */

// =============================================================================
// Types
// =============================================================================

export interface WhatsAppAlert {
  id: string
  type: 'BOT_DOWN' | 'BOT_SLOW' | 'HIGH_MEMORY' | 'ERROR_SPIKE' | 'CONFIG_ISSUE' | 'SECURITY'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  title: string
  message: string
  botId?: string
  botName?: string
  tenantId?: string
  tenantName?: string
  timestamp?: Date
  metadata?: Record<string, unknown>
}

export interface WhatsAppConfig {
  provider: 'clawdbot' | 'twilio'
  // Clawdbot config
  clawdbotGatewayUrl?: string
  clawdbotGatewayToken?: string
  // Twilio config
  twilioAccountSid?: string
  twilioAuthToken?: string
  twilioFromNumber?: string
}

export interface SendResult {
  success: boolean
  messageId?: string
  error?: string
  provider: 'clawdbot' | 'twilio'
  attempts: number
}

// =============================================================================
// Config
// =============================================================================

function getConfig(): WhatsAppConfig {
  const provider = (process.env.WHATSAPP_PROVIDER || 'clawdbot') as 'clawdbot' | 'twilio'
  
  return {
    provider,
    clawdbotGatewayUrl: process.env.CLAWDBOT_GATEWAY_URL || 'http://localhost:3033',
    clawdbotGatewayToken: process.env.CLAWDBOT_GATEWAY_TOKEN,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioFromNumber: process.env.TWILIO_WHATSAPP_FROM,
  }
}

// =============================================================================
// Formatters (WhatsApp-friendly, no complex markdown)
// =============================================================================

const SEVERITY_EMOJI: Record<WhatsAppAlert['severity'], string> = {
  LOW: 'ℹ️',
  MEDIUM: '⚠️',
  HIGH: '🔶',
  CRITICAL: '🚨',
}

const TYPE_EMOJI: Record<WhatsAppAlert['type'], string> = {
  BOT_DOWN: '💀',
  BOT_SLOW: '🐢',
  HIGH_MEMORY: '💾',
  ERROR_SPIKE: '📈',
  CONFIG_ISSUE: '⚙️',
  SECURITY: '🔒',
}

/**
 * Format alert for WhatsApp (no markdown tables, simple formatting)
 */
export function formatAlertMessage(alert: WhatsAppAlert): string {
  const severityEmoji = SEVERITY_EMOJI[alert.severity]
  const typeEmoji = TYPE_EMOJI[alert.type]
  const timestamp = alert.timestamp 
    ? new Date(alert.timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  
  const lines: string[] = [
    `${severityEmoji} *ALERTA ${alert.severity}* ${severityEmoji}`,
    '',
    `${typeEmoji} ${alert.title}`,
    '',
  ]
  
  if (alert.botName || alert.botId) {
    lines.push(`*Bot:* ${alert.botName || alert.botId}`)
  }
  
  if (alert.tenantName || alert.tenantId) {
    lines.push(`*Tenant:* ${alert.tenantName || alert.tenantId}`)
  }
  
  lines.push('')
  lines.push(alert.message)
  lines.push('')
  lines.push(`_${timestamp}_`)
  
  // Add alert ID for reference
  lines.push(`_ID: ${alert.id}_`)
  
  return lines.join('\n')
}

/**
 * Format urgent message (simpler, more direct)
 */
export function formatUrgentMessage(message: string, context?: {
  source?: string
  priority?: 'normal' | 'high' | 'urgent'
}): string {
  const priority = context?.priority || 'normal'
  const prefix = priority === 'urgent' 
    ? '🚨 *URGENTE* 🚨\n\n'
    : priority === 'high'
    ? '⚠️ *IMPORTANTE* ⚠️\n\n'
    : ''
  
  const source = context?.source 
    ? `\n\n_Via: ${context.source}_`
    : ''
  
  return `${prefix}${message}${source}`
}

// =============================================================================
// Retry Logic with Exponential Backoff
// =============================================================================

interface RetryConfig {
  maxAttempts: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<{ result?: T; error?: Error; attempts: number }> {
  const { maxAttempts, initialDelayMs, maxDelayMs, backoffMultiplier } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  }
  
  let lastError: Error | undefined
  let delay = initialDelayMs
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation()
      return { result, attempts: attempt }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt < maxAttempts) {
        console.warn(
          `[WhatsApp Notifier] Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}. ` +
          `Retrying in ${delay}ms...`
        )
        await sleep(delay)
        delay = Math.min(delay * backoffMultiplier, maxDelayMs)
      }
    }
  }
  
  return { error: lastError, attempts: maxAttempts }
}

// =============================================================================
// Provider Implementations
// =============================================================================

/**
 * Send via Clawdbot Gateway API
 */
async function sendViaClawdbot(
  to: string,
  message: string,
  config: WhatsAppConfig
): Promise<{ messageId: string }> {
  const url = `${config.clawdbotGatewayUrl}/api/whatsapp/send`
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  
  if (config.clawdbotGatewayToken) {
    headers['Authorization'] = `Bearer ${config.clawdbotGatewayToken}`
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      to: normalizePhoneNumber(to),
      message,
    }),
  })
  
  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error')
    throw new Error(`Clawdbot API error (${response.status}): ${errorBody}`)
  }
  
  const data = await response.json()
  return { messageId: data.messageId || data.id || 'unknown' }
}

/**
 * Send via Twilio WhatsApp API
 */
async function sendViaTwilio(
  to: string,
  message: string,
  config: WhatsAppConfig
): Promise<{ messageId: string }> {
  if (!config.twilioAccountSid || !config.twilioAuthToken || !config.twilioFromNumber) {
    throw new Error('Twilio configuration incomplete')
  }
  
  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Messages.json`
  
  const formData = new URLSearchParams()
  formData.append('To', `whatsapp:${normalizePhoneNumber(to)}`)
  formData.append('From', `whatsapp:${config.twilioFromNumber}`)
  formData.append('Body', message)
  
  const auth = Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString('base64')
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${auth}`,
    },
    body: formData.toString(),
  })
  
  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error')
    throw new Error(`Twilio API error (${response.status}): ${errorBody}`)
  }
  
  const data = await response.json()
  return { messageId: data.sid }
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Normalize phone number to E.164 format
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except leading +
  let normalized = phone.replace(/[^\d+]/g, '')
  
  // Ensure it starts with +
  if (!normalized.startsWith('+')) {
    // Assume Brazil if no country code
    if (normalized.length === 11) {
      normalized = `+55${normalized}`
    } else if (normalized.length === 10) {
      // Add 9 for mobile (Brazil)
      normalized = `+55${normalized.substring(0, 2)}9${normalized.substring(2)}`
    } else {
      normalized = `+${normalized}`
    }
  }
  
  return normalized
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Send an alert notification via WhatsApp
 * 
 * @param to - Phone number (E.164 format or local)
 * @param alert - Alert details
 * @returns Send result with success status and message ID
 */
export async function sendAlertWhatsApp(
  to: string,
  alert: WhatsAppAlert
): Promise<SendResult> {
  const config = getConfig()
  const message = formatAlertMessage(alert)
  
  const { result, error, attempts } = await withRetry(async () => {
    if (config.provider === 'twilio') {
      return sendViaTwilio(to, message, config)
    }
    return sendViaClawdbot(to, message, config)
  })
  
  if (error) {
    console.error(`[WhatsApp Notifier] Failed to send alert after ${attempts} attempts:`, error)
    return {
      success: false,
      error: error.message,
      provider: config.provider,
      attempts,
    }
  }
  
  console.log(`[WhatsApp Notifier] Alert sent successfully to ${to} (ID: ${result?.messageId})`)
  return {
    success: true,
    messageId: result?.messageId,
    provider: config.provider,
    attempts,
  }
}

/**
 * Send an urgent message via WhatsApp (bypass normal alert formatting)
 * 
 * @param to - Phone number (E.164 format or local)
 * @param message - Raw message text
 * @param options - Optional context (priority, source)
 * @returns Send result with success status and message ID
 */
export async function sendUrgentMessage(
  to: string,
  message: string,
  options?: {
    priority?: 'normal' | 'high' | 'urgent'
    source?: string
    skipRetry?: boolean
  }
): Promise<SendResult> {
  const config = getConfig()
  const formattedMessage = formatUrgentMessage(message, {
    priority: options?.priority,
    source: options?.source,
  })
  
  const retryConfig = options?.skipRetry 
    ? { maxAttempts: 1 } 
    : undefined
  
  const { result, error, attempts } = await withRetry(async () => {
    if (config.provider === 'twilio') {
      return sendViaTwilio(to, formattedMessage, config)
    }
    return sendViaClawdbot(to, formattedMessage, config)
  }, retryConfig)
  
  if (error) {
    console.error(`[WhatsApp Notifier] Failed to send urgent message after ${attempts} attempts:`, error)
    return {
      success: false,
      error: error.message,
      provider: config.provider,
      attempts,
    }
  }
  
  console.log(`[WhatsApp Notifier] Urgent message sent to ${to} (ID: ${result?.messageId})`)
  return {
    success: true,
    messageId: result?.messageId,
    provider: config.provider,
    attempts,
  }
}

/**
 * Send bulk alerts to multiple recipients
 * 
 * @param recipients - Array of phone numbers
 * @param alert - Alert details (same for all)
 * @returns Array of send results
 */
export async function broadcastAlert(
  recipients: string[],
  alert: WhatsAppAlert
): Promise<SendResult[]> {
  // Send with small delay between each to avoid rate limiting
  const results: SendResult[] = []
  
  for (const to of recipients) {
    const result = await sendAlertWhatsApp(to, alert)
    results.push(result)
    
    // Small delay to avoid rate limiting (500ms between messages)
    if (recipients.indexOf(to) < recipients.length - 1) {
      await sleep(500)
    }
  }
  
  const successful = results.filter(r => r.success).length
  console.log(`[WhatsApp Notifier] Broadcast complete: ${successful}/${recipients.length} sent`)
  
  return results
}

// =============================================================================
// Exports
// =============================================================================

export default {
  sendAlertWhatsApp,
  sendUrgentMessage,
  broadcastAlert,
  formatAlertMessage,
  formatUrgentMessage,
}
