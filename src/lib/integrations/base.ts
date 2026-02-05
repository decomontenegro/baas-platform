// Base integration class
import type { Integration, IntegrationType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { 
  IntegrationContext, 
  IntegrationCredentials, 
  SyncResult,
  CRMContact,
  CalendarEvent,
  HelpdeskTicket,
  StorageDocument,
  WebhookPayload,
} from './types'

export abstract class BaseIntegration {
  protected integration: Integration
  protected credentials: IntegrationCredentials
  protected config: Record<string, unknown>

  constructor(integration: Integration) {
    this.integration = integration
    this.credentials = integration.credentials as IntegrationCredentials
    this.config = integration.config as Record<string, unknown>
  }

  // Must be implemented by subclasses
  abstract get type(): IntegrationType

  // Test connection
  abstract testConnection(): Promise<boolean>

  // Sync data (if applicable)
  async sync(): Promise<SyncResult> {
    throw new Error('Sync not implemented for this integration')
  }

  // Log an action
  protected async log(
    action: string,
    status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'PARTIAL',
    data?: unknown,
    error?: string,
    durationMs?: number
  ) {
    await prisma.integrationLog.create({
      data: {
        integrationId: this.integration.id,
        action: action as any,
        status,
        data: data ? JSON.stringify(data) : undefined,
        error,
        durationMs,
      },
    })
  }

  // Update integration status
  protected async updateStatus(
    status: 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'EXPIRED' | 'PENDING',
    statusMessage?: string
  ) {
    await prisma.integration.update({
      where: { id: this.integration.id },
      data: {
        status,
        statusMessage,
        lastErrorAt: status === 'ERROR' ? new Date() : undefined,
      },
    })
  }

  // Update credentials (e.g., after token refresh)
  protected async updateCredentials(credentials: Partial<IntegrationCredentials>) {
    this.credentials = { ...this.credentials, ...credentials }
    await prisma.integration.update({
      where: { id: this.integration.id },
      data: {
        credentials: this.credentials,
      },
    })
  }

  // Check if token needs refresh
  protected needsTokenRefresh(): boolean {
    if (!this.credentials.expiresAt) return false
    const buffer = 5 * 60 * 1000 // 5 minutes buffer
    return Date.now() + buffer >= this.credentials.expiresAt
  }

  // Refresh OAuth token (override in subclass if needed)
  async refreshToken(): Promise<boolean> {
    throw new Error('Token refresh not implemented')
  }

  // Make authenticated request
  protected async request<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (this.needsTokenRefresh()) {
      await this.refreshToken()
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    }

    if (this.credentials.accessToken) {
      headers['Authorization'] = `Bearer ${this.credentials.accessToken}`
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Request failed: ${response.status} - ${error}`)
    }

    return response.json()
  }

  // Get context for passing to handlers
  getContext(): IntegrationContext {
    return {
      integrationId: this.integration.id,
      workspaceId: this.integration.workspaceId,
      tenantId: '', // Would need to fetch from workspace
      credentials: this.credentials,
      config: this.config,
    }
  }
}

// CRM Integration base
export abstract class BaseCRMIntegration extends BaseIntegration {
  abstract createContact(contact: CRMContact): Promise<string>
  abstract updateContact(id: string, contact: Partial<CRMContact>): Promise<void>
  abstract getContact(id: string): Promise<CRMContact | null>
  abstract searchContacts(query: string): Promise<CRMContact[]>
}

// Calendar Integration base
export abstract class BaseCalendarIntegration extends BaseIntegration {
  abstract createEvent(event: CalendarEvent): Promise<string>
  abstract updateEvent(id: string, event: Partial<CalendarEvent>): Promise<void>
  abstract deleteEvent(id: string): Promise<void>
  abstract getAvailableSlots(date: Date, durationMinutes: number): Promise<{ start: Date; end: Date }[]>
}

// Helpdesk Integration base
export abstract class BaseHelpdeskIntegration extends BaseIntegration {
  abstract createTicket(ticket: HelpdeskTicket): Promise<string>
  abstract updateTicket(id: string, ticket: Partial<HelpdeskTicket>): Promise<void>
  abstract getTicket(id: string): Promise<HelpdeskTicket | null>
  abstract addComment(ticketId: string, comment: string, isPublic?: boolean): Promise<void>
}

// Storage Integration base
export abstract class BaseStorageIntegration extends BaseIntegration {
  abstract createDocument(document: StorageDocument): Promise<string>
  abstract uploadFile(file: Buffer, name: string, mimeType: string): Promise<string>
  abstract getDocument(id: string): Promise<StorageDocument | null>
  abstract listDocuments(parentId?: string): Promise<StorageDocument[]>
}

// Webhook Integration base
export abstract class BaseWebhookIntegration extends BaseIntegration {
  abstract sendWebhook(event: string, data: Record<string, unknown>): Promise<boolean>
  abstract verifySignature(payload: string, signature: string): boolean
}
