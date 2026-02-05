// Zendesk Helpdesk Integration
import { BaseHelpdeskIntegration } from './base'
import type { HelpdeskTicket } from './types'
import type { IntegrationType } from '@prisma/client'

interface ZendeskTicket {
  id: number
  subject: string
  description: string
  status: 'new' | 'open' | 'pending' | 'hold' | 'solved' | 'closed'
  priority: 'low' | 'normal' | 'high' | 'urgent' | null
  requester_id: number
  assignee_id: number | null
  tags: string[]
  created_at: string
  updated_at: string
  custom_fields?: { id: number; value: unknown }[]
}

interface ZendeskUser {
  id: number
  email: string
  name: string
}

export class ZendeskIntegration extends BaseHelpdeskIntegration {
  private subdomain: string
  private apiBase: string

  constructor(integration: any) {
    super(integration)
    this.subdomain = (this.config.subdomain as string) || ''
    this.apiBase = `https://${this.subdomain}.zendesk.com/api/v2`
  }

  get type(): IntegrationType {
    return 'HELPDESK_ZENDESK'
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request(`${this.apiBase}/users/me.json`)
      await this.log('TEST_CONNECTION', 'SUCCESS')
      return true
    } catch (error) {
      await this.log('TEST_CONNECTION', 'FAILED', null, (error as Error).message)
      return false
    }
  }

  async createTicket(ticket: HelpdeskTicket): Promise<string> {
    const startTime = Date.now()
    try {
      // First, create or find the requester
      let requesterId: number | undefined
      
      if (ticket.requesterEmail) {
        requesterId = await this.findOrCreateUser(ticket.requesterEmail, ticket.requesterName)
      }

      const zendeskTicket = {
        ticket: {
          subject: ticket.subject,
          comment: {
            body: ticket.description,
          },
          priority: ticket.priority || 'normal',
          requester_id: requesterId,
          tags: ticket.tags || [],
          custom_fields: this.mapCustomFields(ticket.customFields),
        },
      }

      const response = await this.request<{ ticket: ZendeskTicket }>(
        `${this.apiBase}/tickets.json`,
        {
          method: 'POST',
          body: JSON.stringify(zendeskTicket),
        }
      )

      await this.log('CREATE_TICKET', 'SUCCESS', { ticketId: response.ticket.id }, undefined, Date.now() - startTime)
      return response.ticket.id.toString()
    } catch (error) {
      await this.log('CREATE_TICKET', 'FAILED', ticket, (error as Error).message, Date.now() - startTime)
      throw error
    }
  }

  async updateTicket(id: string, ticket: Partial<HelpdeskTicket>): Promise<void> {
    const startTime = Date.now()
    try {
      const update: any = { ticket: {} }
      
      if (ticket.subject) update.ticket.subject = ticket.subject
      if (ticket.priority) update.ticket.priority = ticket.priority
      if (ticket.status) update.ticket.status = this.mapStatus(ticket.status)
      if (ticket.tags) update.ticket.tags = ticket.tags
      if (ticket.customFields) update.ticket.custom_fields = this.mapCustomFields(ticket.customFields)

      await this.request(
        `${this.apiBase}/tickets/${id}.json`,
        {
          method: 'PUT',
          body: JSON.stringify(update),
        }
      )

      await this.log('UPDATE_TICKET', 'SUCCESS', { ticketId: id }, undefined, Date.now() - startTime)
    } catch (error) {
      await this.log('UPDATE_TICKET', 'FAILED', { id, ...ticket }, (error as Error).message, Date.now() - startTime)
      throw error
    }
  }

  async getTicket(id: string): Promise<HelpdeskTicket | null> {
    try {
      const response = await this.request<{ ticket: ZendeskTicket }>(
        `${this.apiBase}/tickets/${id}.json`
      )
      return this.mapFromZendeskTicket(response.ticket)
    } catch (error) {
      if ((error as Error).message.includes('404')) {
        return null
      }
      throw error
    }
  }

  async addComment(ticketId: string, comment: string, isPublic: boolean = true): Promise<void> {
    const startTime = Date.now()
    try {
      await this.request(
        `${this.apiBase}/tickets/${ticketId}.json`,
        {
          method: 'PUT',
          body: JSON.stringify({
            ticket: {
              comment: {
                body: comment,
                public: isPublic,
              },
            },
          }),
        }
      )

      await this.log('UPDATE_TICKET', 'SUCCESS', { ticketId, action: 'add_comment' }, undefined, Date.now() - startTime)
    } catch (error) {
      await this.log('UPDATE_TICKET', 'FAILED', { ticketId, action: 'add_comment' }, (error as Error).message, Date.now() - startTime)
      throw error
    }
  }

  async searchTickets(query: string): Promise<HelpdeskTicket[]> {
    const response = await this.request<{ results: ZendeskTicket[] }>(
      `${this.apiBase}/search.json?query=type:ticket ${encodeURIComponent(query)}`
    )
    return response.results.map(t => this.mapFromZendeskTicket(t))
  }

  private async findOrCreateUser(email: string, name?: string): Promise<number> {
    // Search for existing user
    const searchResponse = await this.request<{ users: ZendeskUser[] }>(
      `${this.apiBase}/users/search.json?query=${encodeURIComponent(email)}`
    )

    if (searchResponse.users.length > 0) {
      return searchResponse.users[0].id
    }

    // Create new user
    const createResponse = await this.request<{ user: ZendeskUser }>(
      `${this.apiBase}/users.json`,
      {
        method: 'POST',
        body: JSON.stringify({
          user: {
            email,
            name: name || email.split('@')[0],
            verified: true,
          },
        }),
      }
    )

    return createResponse.user.id
  }

  async refreshToken(): Promise<boolean> {
    if (!this.credentials.refreshToken) {
      throw new Error('No refresh token available')
    }

    try {
      const clientId = process.env.ZENDESK_CLIENT_ID
      const clientSecret = process.env.ZENDESK_CLIENT_SECRET

      const response = await fetch(`https://${this.subdomain}.zendesk.com/oauth/tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: this.credentials.refreshToken,
        }),
      })

      if (!response.ok) {
        throw new Error('Token refresh failed')
      }

      const data = await response.json()

      await this.updateCredentials({
        accessToken: data.access_token,
        refreshToken: data.refresh_token || this.credentials.refreshToken,
        expiresAt: Date.now() + data.expires_in * 1000,
      })

      await this.log('REFRESH_TOKEN', 'SUCCESS')
      return true
    } catch (error) {
      await this.log('REFRESH_TOKEN', 'FAILED', null, (error as Error).message)
      await this.updateStatus('EXPIRED', 'Token refresh failed')
      return false
    }
  }

  private mapStatus(status: HelpdeskTicket['status']): ZendeskTicket['status'] {
    const statusMap: Record<string, ZendeskTicket['status']> = {
      new: 'new',
      open: 'open',
      pending: 'pending',
      solved: 'solved',
      closed: 'closed',
    }
    return statusMap[status || 'new'] || 'new'
  }

  private mapCustomFields(fields?: Record<string, unknown>): { id: number; value: unknown }[] {
    if (!fields) return []
    
    const customFieldMappings = this.config.customFieldMappings as Record<string, number> | undefined
    if (!customFieldMappings) return []

    return Object.entries(fields)
      .filter(([key]) => customFieldMappings[key])
      .map(([key, value]) => ({
        id: customFieldMappings[key],
        value,
      }))
  }

  private mapFromZendeskTicket(ticket: ZendeskTicket): HelpdeskTicket {
    return {
      id: ticket.id.toString(),
      subject: ticket.subject,
      description: ticket.description,
      priority: ticket.priority || 'normal',
      status: ticket.status === 'hold' ? 'pending' : ticket.status,
      tags: ticket.tags,
    }
  }
}

// OAuth helpers for Zendesk
export function getZendeskAuthUrl(subdomain: string, state: string, redirectUri: string): string {
  const clientId = process.env.ZENDESK_CLIENT_ID
  const scopes = ['read', 'write', 'tickets:read', 'tickets:write', 'users:read', 'users:write']
  
  const url = new URL(`https://${subdomain}.zendesk.com/oauth/authorizations/new`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId!)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', scopes.join(' '))
  url.searchParams.set('state', state)
  
  return url.toString()
}

export async function exchangeZendeskCode(subdomain: string, code: string, redirectUri: string): Promise<{
  accessToken: string
  refreshToken?: string
  expiresIn?: number
}> {
  const clientId = process.env.ZENDESK_CLIENT_ID
  const clientSecret = process.env.ZENDESK_CLIENT_SECRET

  const response = await fetch(`https://${subdomain}.zendesk.com/oauth/tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OAuth exchange failed: ${error}`)
  }

  const data = await response.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  }
}
