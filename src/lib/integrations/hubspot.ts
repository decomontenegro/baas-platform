// HubSpot CRM Integration
import { BaseCRMIntegration } from './base'
import type { CRMContact, SyncResult } from './types'
import type { IntegrationType } from '@prisma/client'

const HUBSPOT_API_BASE = 'https://api.hubapi.com'

interface HubSpotContact {
  id: string
  properties: {
    email?: string
    firstname?: string
    lastname?: string
    phone?: string
    company?: string
    hs_lead_status?: string
    [key: string]: string | undefined
  }
  createdAt?: string
  updatedAt?: string
}

export class HubSpotIntegration extends BaseCRMIntegration {
  get type(): IntegrationType {
    return 'CRM_HUBSPOT'
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts?limit=1`)
      await this.log('TEST_CONNECTION', 'SUCCESS')
      return true
    } catch (error) {
      await this.log('TEST_CONNECTION', 'FAILED', null, (error as Error).message)
      return false
    }
  }

  async createContact(contact: CRMContact): Promise<string> {
    const startTime = Date.now()
    try {
      const properties = this.mapToHubSpotProperties(contact)
      
      const response = await this.request<HubSpotContact>(
        `${HUBSPOT_API_BASE}/crm/v3/objects/contacts`,
        {
          method: 'POST',
          body: JSON.stringify({ properties }),
        }
      )

      await this.log('CREATE_CONTACT', 'SUCCESS', { contactId: response.id }, undefined, Date.now() - startTime)
      return response.id
    } catch (error) {
      await this.log('CREATE_CONTACT', 'FAILED', contact, (error as Error).message, Date.now() - startTime)
      throw error
    }
  }

  async updateContact(id: string, contact: Partial<CRMContact>): Promise<void> {
    const startTime = Date.now()
    try {
      const properties = this.mapToHubSpotProperties(contact)
      
      await this.request(
        `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ properties }),
        }
      )

      await this.log('UPDATE_CONTACT', 'SUCCESS', { contactId: id }, undefined, Date.now() - startTime)
    } catch (error) {
      await this.log('UPDATE_CONTACT', 'FAILED', { id, ...contact }, (error as Error).message, Date.now() - startTime)
      throw error
    }
  }

  async getContact(id: string): Promise<CRMContact | null> {
    try {
      const response = await this.request<HubSpotContact>(
        `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${id}?properties=email,firstname,lastname,phone,company`
      )
      return this.mapFromHubSpotContact(response)
    } catch (error) {
      if ((error as Error).message.includes('404')) {
        return null
      }
      throw error
    }
  }

  async searchContacts(query: string): Promise<CRMContact[]> {
    const response = await this.request<{ results: HubSpotContact[] }>(
      `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`,
      {
        method: 'POST',
        body: JSON.stringify({
          filterGroups: [{
            filters: [
              { propertyName: 'email', operator: 'CONTAINS_TOKEN', value: query },
            ],
          }],
          properties: ['email', 'firstname', 'lastname', 'phone', 'company'],
          limit: 20,
        }),
      }
    )

    return response.results.map(c => this.mapFromHubSpotContact(c))
  }

  async searchByEmail(email: string): Promise<CRMContact | null> {
    const response = await this.request<{ results: HubSpotContact[] }>(
      `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`,
      {
        method: 'POST',
        body: JSON.stringify({
          filterGroups: [{
            filters: [
              { propertyName: 'email', operator: 'EQ', value: email },
            ],
          }],
          properties: ['email', 'firstname', 'lastname', 'phone', 'company'],
          limit: 1,
        }),
      }
    )

    return response.results.length > 0 
      ? this.mapFromHubSpotContact(response.results[0])
      : null
  }

  async searchByPhone(phone: string): Promise<CRMContact | null> {
    // Normalize phone number
    const normalizedPhone = phone.replace(/\D/g, '')
    
    const response = await this.request<{ results: HubSpotContact[] }>(
      `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`,
      {
        method: 'POST',
        body: JSON.stringify({
          filterGroups: [{
            filters: [
              { propertyName: 'phone', operator: 'CONTAINS_TOKEN', value: normalizedPhone },
            ],
          }],
          properties: ['email', 'firstname', 'lastname', 'phone', 'company'],
          limit: 1,
        }),
      }
    )

    return response.results.length > 0 
      ? this.mapFromHubSpotContact(response.results[0])
      : null
  }

  async sync(): Promise<SyncResult> {
    const startTime = Date.now()
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      duration: 0,
    }

    try {
      // Get all contacts updated in the last sync interval
      const after = this.integration.lastSyncAt?.toISOString() || new Date(0).toISOString()
      
      let hasMore = true
      let cursor: string | undefined

      while (hasMore) {
        const url = new URL(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts`)
        url.searchParams.set('limit', '100')
        if (cursor) url.searchParams.set('after', cursor)
        url.searchParams.set('properties', 'email,firstname,lastname,phone,company')
        url.searchParams.set('archived', 'false')

        const response = await this.request<{
          results: HubSpotContact[]
          paging?: { next?: { after: string } }
        }>(url.toString())

        result.recordsProcessed += response.results.length

        hasMore = !!response.paging?.next?.after
        cursor = response.paging?.next?.after
      }

      result.duration = Date.now() - startTime
      await this.log('SYNC', 'SUCCESS', result, undefined, result.duration)

      // Update last sync time
      await this.updateStatus('ACTIVE')

    } catch (error) {
      result.success = false
      result.duration = Date.now() - startTime
      await this.log('SYNC', 'FAILED', result, (error as Error).message, result.duration)
      await this.updateStatus('ERROR', (error as Error).message)
    }

    return result
  }

  // OAuth token refresh
  async refreshToken(): Promise<boolean> {
    if (!this.credentials.refreshToken) {
      throw new Error('No refresh token available')
    }

    try {
      const clientId = process.env.HUBSPOT_CLIENT_ID
      const clientSecret = process.env.HUBSPOT_CLIENT_SECRET

      const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId!,
          client_secret: clientSecret!,
          refresh_token: this.credentials.refreshToken,
        }),
      })

      if (!response.ok) {
        throw new Error('Token refresh failed')
      }

      const data = await response.json()

      await this.updateCredentials({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
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

  private mapToHubSpotProperties(contact: Partial<CRMContact>): Record<string, string> {
    const properties: Record<string, string> = {}
    
    if (contact.email) properties.email = contact.email
    if (contact.firstName) properties.firstname = contact.firstName
    if (contact.lastName) properties.lastname = contact.lastName
    if (contact.name && !contact.firstName && !contact.lastName) {
      const [first, ...rest] = contact.name.split(' ')
      properties.firstname = first
      if (rest.length > 0) properties.lastname = rest.join(' ')
    }
    if (contact.phone) properties.phone = contact.phone
    if (contact.company) properties.company = contact.company
    
    return properties
  }

  private mapFromHubSpotContact(hsContact: HubSpotContact): CRMContact {
    return {
      id: hsContact.id,
      email: hsContact.properties.email,
      phone: hsContact.properties.phone,
      firstName: hsContact.properties.firstname,
      lastName: hsContact.properties.lastname,
      name: [hsContact.properties.firstname, hsContact.properties.lastname].filter(Boolean).join(' ') || undefined,
      company: hsContact.properties.company,
      createdAt: hsContact.createdAt ? new Date(hsContact.createdAt) : undefined,
    }
  }
}

// OAuth helpers for HubSpot
export function getHubSpotAuthUrl(state: string, redirectUri: string): string {
  const clientId = process.env.HUBSPOT_CLIENT_ID
  const scopes = ['crm.objects.contacts.read', 'crm.objects.contacts.write']
  
  const url = new URL('https://app.hubspot.com/oauth/authorize')
  url.searchParams.set('client_id', clientId!)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', scopes.join(' '))
  url.searchParams.set('state', state)
  
  return url.toString()
}

export async function exchangeHubSpotCode(code: string, redirectUri: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
}> {
  const clientId = process.env.HUBSPOT_CLIENT_ID
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET

  const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId!,
      client_secret: clientSecret!,
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
