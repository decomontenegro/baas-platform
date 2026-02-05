// Webhook Integration (for Zapier, Make, custom webhooks)
import { BaseWebhookIntegration } from './base'
import type { IntegrationType } from '@prisma/client'
import crypto from 'crypto'

export interface WebhookEvent {
  type: string
  timestamp: string
  data: Record<string, unknown>
  metadata?: {
    workspaceId?: string
    channelId?: string
    conversationId?: string
    [key: string]: unknown
  }
}

export class WebhookIntegration extends BaseWebhookIntegration {
  private webhookUrl: string
  private webhookSecret: string | undefined
  private events: string[]

  constructor(integration: any) {
    super(integration)
    this.webhookUrl = (this.config.url as string) || (this.config.webhookUrl as string) || ''
    this.webhookSecret = (this.config.secret as string) || (this.credentials.webhookSecret as string)
    this.events = (this.config.events as string[]) || []
  }

  get type(): IntegrationType {
    return 'WEBHOOK'
  }

  async testConnection(): Promise<boolean> {
    try {
      // Send a test webhook
      const success = await this.sendWebhook('test', {
        message: 'Webhook connection test',
        timestamp: new Date().toISOString(),
      })
      
      await this.log('TEST_CONNECTION', success ? 'SUCCESS' : 'FAILED')
      return success
    } catch (error) {
      await this.log('TEST_CONNECTION', 'FAILED', null, (error as Error).message)
      return false
    }
  }

  async sendWebhook(event: string, data: Record<string, unknown>): Promise<boolean> {
    const startTime = Date.now()
    
    // Check if this event is enabled
    if (this.events.length > 0 && !this.events.includes(event) && event !== 'test') {
      return true // Skip silently for non-enabled events
    }

    try {
      const payload: WebhookEvent = {
        type: event,
        timestamp: new Date().toISOString(),
        data,
        metadata: {
          workspaceId: this.integration.workspaceId,
          integrationId: this.integration.id,
        },
      }

      const body = JSON.stringify(payload)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'BaaS-Webhook/1.0',
        'X-Webhook-Event': event,
        'X-Webhook-Timestamp': payload.timestamp,
      }

      // Add signature if secret is configured
      if (this.webhookSecret) {
        const signature = this.generateSignature(body)
        headers['X-Webhook-Signature'] = signature
        headers['X-Webhook-Signature-256'] = `sha256=${signature}`
      }

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers,
        body,
      })

      const success = response.ok
      const duration = Date.now() - startTime

      await this.log(
        'WEBHOOK_SEND',
        success ? 'SUCCESS' : 'FAILED',
        {
          event,
          statusCode: response.status,
          url: this.webhookUrl,
        },
        success ? undefined : `HTTP ${response.status}`,
        duration
      )

      return success
    } catch (error) {
      await this.log(
        'WEBHOOK_SEND',
        'FAILED',
        { event, url: this.webhookUrl },
        (error as Error).message,
        Date.now() - startTime
      )
      return false
    }
  }

  verifySignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      return true // No secret configured, skip verification
    }

    const expectedSignature = this.generateSignature(payload)
    
    // Handle various signature formats
    const cleanSignature = signature
      .replace('sha256=', '')
      .replace('sha1=', '')
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(cleanSignature)
    )
  }

  private generateSignature(payload: string): string {
    return crypto
      .createHmac('sha256', this.webhookSecret || '')
      .update(payload)
      .digest('hex')
  }

  // Convenience methods for common events
  async onConversationStarted(conversation: {
    id: string
    contactName?: string
    contactPhone?: string
    channel: string
  }): Promise<boolean> {
    return this.sendWebhook('conversation.started', {
      conversation,
    })
  }

  async onMessageReceived(message: {
    conversationId: string
    content: string
    contactName?: string
    timestamp: Date
  }): Promise<boolean> {
    return this.sendWebhook('message.received', {
      message: {
        ...message,
        timestamp: message.timestamp.toISOString(),
      },
    })
  }

  async onMessageSent(message: {
    conversationId: string
    content: string
    timestamp: Date
  }): Promise<boolean> {
    return this.sendWebhook('message.sent', {
      message: {
        ...message,
        timestamp: message.timestamp.toISOString(),
      },
    })
  }

  async onHandoffRequested(handoff: {
    conversationId: string
    reason: string
    contactName?: string
    priority?: string
  }): Promise<boolean> {
    return this.sendWebhook('handoff.requested', { handoff })
  }

  async onHandoffCompleted(handoff: {
    conversationId: string
    resolvedBy?: string
    duration?: number
  }): Promise<boolean> {
    return this.sendWebhook('handoff.completed', { handoff })
  }

  async onLeadCaptured(lead: {
    name?: string
    email?: string
    phone?: string
    source: string
    data?: Record<string, unknown>
  }): Promise<boolean> {
    return this.sendWebhook('lead.captured', { lead })
  }
}

// Factory for Zapier integration (same as webhook but typed)
export class ZapierIntegration extends WebhookIntegration {
  get type(): IntegrationType {
    return 'AUTOMATION_ZAPIER'
  }
}

// Factory for Make integration (same as webhook but typed)
export class MakeIntegration extends WebhookIntegration {
  get type(): IntegrationType {
    return 'AUTOMATION_MAKE'
  }
}

// Helper to create webhook event handlers for the app
export function createWebhookEventDispatcher(workspaceId: string) {
  return {
    async dispatch(event: string, data: Record<string, unknown>): Promise<void> {
      const { prisma } = await import('@/lib/prisma')
      
      // Find all active webhook integrations for this workspace
      const integrations = await prisma.integration.findMany({
        where: {
          workspaceId,
          status: 'ACTIVE',
          type: {
            in: ['WEBHOOK', 'AUTOMATION_ZAPIER', 'AUTOMATION_MAKE'],
          },
          deletedAt: null,
        },
      })

      // Send webhook to all configured integrations
      await Promise.allSettled(
        integrations.map(async (integration) => {
          const webhook = new WebhookIntegration(integration)
          await webhook.sendWebhook(event, data)
        })
      )
    },
  }
}
