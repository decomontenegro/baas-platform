/**
 * Clawdbot Gateway Client
 * 
 * HTTP client for interacting with the Clawdbot Gateway API.
 * Used by the Admin Agent to manage bots and send messages.
 */

// Gateway configuration from environment
const GATEWAY_URL = process.env.CLAWDBOT_GATEWAY_URL || 'http://localhost:3033'
const GATEWAY_TOKEN = process.env.CLAWDBOT_GATEWAY_TOKEN

// Types
export interface GatewayResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface BotStatus {
  id: string
  status: 'running' | 'stopped' | 'error' | 'unknown'
  uptime?: number
  lastActivity?: string
  qrCode?: string
  connected: boolean
  phone?: string
  error?: string
}

export interface GatewayHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  version?: string
  uptime?: number
  activeBots?: number
  timestamp: string
}

export interface SendMessageResult {
  messageId?: string
  sent: boolean
  timestamp?: string
  error?: string
}

/**
 * Base fetch wrapper with authentication and error handling
 */
async function gatewayFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<GatewayResponse<T>> {
  if (!GATEWAY_TOKEN) {
    return {
      success: false,
      error: 'CLAWDBOT_GATEWAY_TOKEN not configured'
    }
  }

  const url = `${GATEWAY_URL}${endpoint}`
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GATEWAY_TOKEN}`,
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      }
    }

    const data = await response.json() as T
    return {
      success: true,
      data
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      error: `Gateway request failed: ${errorMessage}`
    }
  }
}

/**
 * Restart a bot instance
 * 
 * @param botId - The bot ID to restart
 * @returns Success status and any error message
 */
export async function restartBot(botId: string): Promise<GatewayResponse<{ restarted: boolean }>> {
  if (!botId) {
    return {
      success: false,
      error: 'Bot ID is required'
    }
  }

  return gatewayFetch<{ restarted: boolean }>(`/api/bots/${botId}/restart`, {
    method: 'POST',
  })
}

/**
 * Get current status of a bot
 * 
 * @param botId - The bot ID to check
 * @returns Bot status information
 */
export async function getBotStatus(botId: string): Promise<GatewayResponse<BotStatus>> {
  if (!botId) {
    return {
      success: false,
      error: 'Bot ID is required'
    }
  }

  return gatewayFetch<BotStatus>(`/api/bots/${botId}/status`, {
    method: 'GET',
  })
}

/**
 * Send a WhatsApp message through the gateway
 * 
 * @param to - Recipient phone number or JID
 * @param message - Message text to send
 * @param botId - Optional bot ID (uses default if not specified)
 * @returns Send result with message ID
 */
export async function sendMessage(
  to: string,
  message: string,
  botId?: string
): Promise<GatewayResponse<SendMessageResult>> {
  if (!to) {
    return {
      success: false,
      error: 'Recipient (to) is required'
    }
  }

  if (!message) {
    return {
      success: false,
      error: 'Message is required'
    }
  }

  const endpoint = botId 
    ? `/api/bots/${botId}/send` 
    : '/api/message/send'

  return gatewayFetch<SendMessageResult>(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      to,
      message,
    }),
  })
}

/**
 * Check gateway health status
 * 
 * @returns Gateway health information
 */
export async function getGatewayHealth(): Promise<GatewayResponse<GatewayHealth>> {
  return gatewayFetch<GatewayHealth>('/api/health', {
    method: 'GET',
  })
}

/**
 * Check if gateway is reachable (quick check)
 * 
 * @returns true if gateway responds, false otherwise
 */
export async function isGatewayReachable(): Promise<boolean> {
  const result = await getGatewayHealth()
  return result.success && result.data?.status !== 'unhealthy'
}

// Named exports for convenience
export const clawdbotClient = {
  restartBot,
  getBotStatus,
  sendMessage,
  getGatewayHealth,
  isGatewayReachable,
}

export default clawdbotClient
