// Integration factory - creates the right integration class based on type
import type { Integration, IntegrationType } from '@prisma/client'
import { BaseIntegration } from './base'
import { HubSpotIntegration } from './hubspot'
import { GoogleCalendarIntegration } from './google-calendar'
import { ZendeskIntegration } from './zendesk'
import { NotionIntegration } from './notion'
import { WebhookIntegration, ZapierIntegration, MakeIntegration } from './webhook'
import { prisma } from '@/lib/prisma'

// Factory to create integration instance
export function createIntegration(integration: Integration): BaseIntegration {
  switch (integration.type) {
    // CRM
    case 'CRM_HUBSPOT':
      return new HubSpotIntegration(integration)
    
    // Calendar
    case 'CALENDAR_GOOGLE':
      return new GoogleCalendarIntegration(integration)
    
    // Helpdesk
    case 'HELPDESK_ZENDESK':
      return new ZendeskIntegration(integration)
    
    // Storage
    case 'STORAGE_NOTION':
      return new NotionIntegration(integration)
    
    // Automation
    case 'AUTOMATION_ZAPIER':
      return new ZapierIntegration(integration)
    case 'AUTOMATION_MAKE':
      return new MakeIntegration(integration)
    
    // Generic webhook
    case 'WEBHOOK':
      return new WebhookIntegration(integration)
    
    // Default: generic webhook for unimplemented integrations
    default:
      console.warn(`Integration type ${integration.type} not fully implemented, using webhook fallback`)
      return new WebhookIntegration(integration)
  }
}

// Get an integration by ID and create the handler
export async function getIntegrationHandler(integrationId: string): Promise<BaseIntegration | null> {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId, deletedAt: null },
  })

  if (!integration) return null
  return createIntegration(integration)
}

// Get all active integrations for a workspace
export async function getWorkspaceIntegrations(workspaceId: string): Promise<Integration[]> {
  return prisma.integration.findMany({
    where: {
      workspaceId,
      deletedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  })
}

// Get all active integrations of a specific type
export async function getIntegrationsByType(
  workspaceId: string,
  type: IntegrationType
): Promise<Integration[]> {
  return prisma.integration.findMany({
    where: {
      workspaceId,
      type,
      status: 'ACTIVE',
      deletedAt: null,
    },
  })
}

// Execute an action across all integrations of a category
export async function executeForCategory(
  workspaceId: string,
  category: 'CRM' | 'CALENDAR' | 'HELPDESK' | 'STORAGE' | 'AUTOMATION',
  action: (integration: BaseIntegration) => Promise<void>
): Promise<{ success: number; failed: number; errors: string[] }> {
  const categoryTypes: Record<string, IntegrationType[]> = {
    CRM: ['CRM_HUBSPOT', 'CRM_SALESFORCE', 'CRM_PIPEDRIVE', 'CRM_RDSTATION'],
    CALENDAR: ['CALENDAR_GOOGLE', 'CALENDAR_OUTLOOK', 'CALENDAR_CALCOM'],
    HELPDESK: ['HELPDESK_ZENDESK', 'HELPDESK_FRESHDESK', 'HELPDESK_INTERCOM'],
    STORAGE: ['STORAGE_GOOGLE_DRIVE', 'STORAGE_NOTION', 'STORAGE_AIRTABLE', 'STORAGE_S3'],
    AUTOMATION: ['AUTOMATION_ZAPIER', 'AUTOMATION_MAKE', 'WEBHOOK'],
  }

  const integrations = await prisma.integration.findMany({
    where: {
      workspaceId,
      type: { in: categoryTypes[category] },
      status: 'ACTIVE',
      deletedAt: null,
    },
  })

  const results = await Promise.allSettled(
    integrations.map(async (integration) => {
      const handler = createIntegration(integration)
      await action(handler)
    })
  )

  const errors: string[] = []
  let success = 0
  let failed = 0

  for (const result of results) {
    if (result.status === 'fulfilled') {
      success++
    } else {
      failed++
      errors.push(result.reason?.message || 'Unknown error')
    }
  }

  return { success, failed, errors }
}

// Auto-sync CRM contact when new conversation starts
export async function syncContactToCRM(
  workspaceId: string,
  contact: {
    phone?: string
    email?: string
    name?: string
    source: string
  }
): Promise<void> {
  const crmIntegrations = await prisma.integration.findMany({
    where: {
      workspaceId,
      type: { in: ['CRM_HUBSPOT', 'CRM_PIPEDRIVE', 'CRM_RDSTATION', 'CRM_SALESFORCE'] },
      status: 'ACTIVE',
      deletedAt: null,
    },
  })

  for (const integration of crmIntegrations) {
    try {
      const handler = createIntegration(integration)
      
      if ('createContact' in handler) {
        const crmHandler = handler as any
        
        // Check if contact exists first
        let existingContact = null
        if (contact.phone && 'searchByPhone' in crmHandler) {
          existingContact = await crmHandler.searchByPhone(contact.phone)
        } else if (contact.email && 'searchByEmail' in crmHandler) {
          existingContact = await crmHandler.searchByEmail(contact.email)
        }

        if (!existingContact) {
          await crmHandler.createContact({
            ...contact,
            source: contact.source || 'chatbot',
          })
        }
      }
    } catch (error) {
      console.error(`Failed to sync contact to ${integration.type}:`, error)
    }
  }
}

// Schedule calendar event
export async function scheduleCalendarEvent(
  workspaceId: string,
  event: {
    title: string
    description?: string
    startTime: Date
    endTime: Date
    attendeeEmail?: string
    attendeeName?: string
  }
): Promise<string | null> {
  const calendarIntegrations = await prisma.integration.findMany({
    where: {
      workspaceId,
      type: { in: ['CALENDAR_GOOGLE', 'CALENDAR_OUTLOOK', 'CALENDAR_CALCOM'] },
      status: 'ACTIVE',
      deletedAt: null,
    },
    take: 1, // Use first active calendar
  })

  if (calendarIntegrations.length === 0) return null

  try {
    const handler = createIntegration(calendarIntegrations[0])
    
    if ('createEvent' in handler) {
      const calendarHandler = handler as any
      return await calendarHandler.createEvent({
        ...event,
        attendees: event.attendeeEmail ? [{ email: event.attendeeEmail, name: event.attendeeName }] : undefined,
      })
    }
  } catch (error) {
    console.error('Failed to schedule calendar event:', error)
  }

  return null
}

// Create helpdesk ticket on handoff
export async function createHelpdeskTicket(
  workspaceId: string,
  ticket: {
    subject: string
    description: string
    requesterEmail?: string
    requesterName?: string
    priority?: 'low' | 'normal' | 'high' | 'urgent'
    tags?: string[]
  }
): Promise<string | null> {
  const helpdeskIntegrations = await prisma.integration.findMany({
    where: {
      workspaceId,
      type: { in: ['HELPDESK_ZENDESK', 'HELPDESK_FRESHDESK', 'HELPDESK_INTERCOM'] },
      status: 'ACTIVE',
      deletedAt: null,
    },
    take: 1,
  })

  if (helpdeskIntegrations.length === 0) return null

  try {
    const handler = createIntegration(helpdeskIntegrations[0])
    
    if ('createTicket' in handler) {
      const helpdeskHandler = handler as any
      return await helpdeskHandler.createTicket(ticket)
    }
  } catch (error) {
    console.error('Failed to create helpdesk ticket:', error)
  }

  return null
}

// Dispatch webhook events
export async function dispatchWebhookEvent(
  workspaceId: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  const webhookIntegrations = await prisma.integration.findMany({
    where: {
      workspaceId,
      type: { in: ['WEBHOOK', 'AUTOMATION_ZAPIER', 'AUTOMATION_MAKE'] },
      status: 'ACTIVE',
      deletedAt: null,
    },
  })

  await Promise.allSettled(
    webhookIntegrations.map(async (integration) => {
      const handler = createIntegration(integration) as WebhookIntegration
      await handler.sendWebhook(event, data)
    })
  )
}

// Import type for webhook
import type { WebhookIntegration } from './webhook'
