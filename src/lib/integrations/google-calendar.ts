// Google Calendar Integration
import { BaseCalendarIntegration } from './base'
import type { CalendarEvent } from './types'
import type { IntegrationType } from '@prisma/client'

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

interface GoogleCalendarEvent {
  id: string
  summary: string
  description?: string
  start: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  end: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  location?: string
  attendees?: { email: string; displayName?: string; responseStatus?: string }[]
  reminders?: {
    useDefault: boolean
    overrides?: { method: string; minutes: number }[]
  }
  status?: string
  htmlLink?: string
}

interface FreeBusyResponse {
  calendars: {
    [calendarId: string]: {
      busy: { start: string; end: string }[]
    }
  }
}

export class GoogleCalendarIntegration extends BaseCalendarIntegration {
  private calendarId: string

  constructor(integration: any) {
    super(integration)
    this.calendarId = (this.config.calendarId as string) || 'primary'
  }

  get type(): IntegrationType {
    return 'CALENDAR_GOOGLE'
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request(`${GOOGLE_CALENDAR_API}/calendars/${this.calendarId}`)
      await this.log('TEST_CONNECTION', 'SUCCESS')
      return true
    } catch (error) {
      await this.log('TEST_CONNECTION', 'FAILED', null, (error as Error).message)
      return false
    }
  }

  async createEvent(event: CalendarEvent): Promise<string> {
    const startTime = Date.now()
    try {
      const googleEvent = this.mapToGoogleEvent(event)
      
      const response = await this.request<GoogleCalendarEvent>(
        `${GOOGLE_CALENDAR_API}/calendars/${this.calendarId}/events?sendUpdates=all`,
        {
          method: 'POST',
          body: JSON.stringify(googleEvent),
        }
      )

      await this.log('CREATE_EVENT', 'SUCCESS', { eventId: response.id }, undefined, Date.now() - startTime)
      return response.id
    } catch (error) {
      await this.log('CREATE_EVENT', 'FAILED', event, (error as Error).message, Date.now() - startTime)
      throw error
    }
  }

  async updateEvent(id: string, event: Partial<CalendarEvent>): Promise<void> {
    const startTime = Date.now()
    try {
      const googleEvent = this.mapToGoogleEvent(event as CalendarEvent)
      
      await this.request(
        `${GOOGLE_CALENDAR_API}/calendars/${this.calendarId}/events/${id}?sendUpdates=all`,
        {
          method: 'PATCH',
          body: JSON.stringify(googleEvent),
        }
      )

      await this.log('UPDATE_EVENT', 'SUCCESS', { eventId: id }, undefined, Date.now() - startTime)
    } catch (error) {
      await this.log('UPDATE_EVENT', 'FAILED', { id, ...event }, (error as Error).message, Date.now() - startTime)
      throw error
    }
  }

  async deleteEvent(id: string): Promise<void> {
    const startTime = Date.now()
    try {
      await this.request(
        `${GOOGLE_CALENDAR_API}/calendars/${this.calendarId}/events/${id}?sendUpdates=all`,
        { method: 'DELETE' }
      )
      await this.log('UPDATE_EVENT', 'SUCCESS', { eventId: id, action: 'delete' }, undefined, Date.now() - startTime)
    } catch (error) {
      await this.log('UPDATE_EVENT', 'FAILED', { eventId: id, action: 'delete' }, (error as Error).message, Date.now() - startTime)
      throw error
    }
  }

  async getEvent(id: string): Promise<CalendarEvent | null> {
    try {
      const response = await this.request<GoogleCalendarEvent>(
        `${GOOGLE_CALENDAR_API}/calendars/${this.calendarId}/events/${id}`
      )
      return this.mapFromGoogleEvent(response)
    } catch (error) {
      if ((error as Error).message.includes('404')) {
        return null
      }
      throw error
    }
  }

  async listEvents(timeMin: Date, timeMax: Date): Promise<CalendarEvent[]> {
    const url = new URL(`${GOOGLE_CALENDAR_API}/calendars/${this.calendarId}/events`)
    url.searchParams.set('timeMin', timeMin.toISOString())
    url.searchParams.set('timeMax', timeMax.toISOString())
    url.searchParams.set('singleEvents', 'true')
    url.searchParams.set('orderBy', 'startTime')

    const response = await this.request<{ items: GoogleCalendarEvent[] }>(url.toString())
    return response.items.map(e => this.mapFromGoogleEvent(e))
  }

  async getAvailableSlots(date: Date, durationMinutes: number): Promise<{ start: Date; end: Date }[]> {
    const startOfDay = new Date(date)
    startOfDay.setHours(9, 0, 0, 0) // Start at 9 AM
    
    const endOfDay = new Date(date)
    endOfDay.setHours(18, 0, 0, 0) // End at 6 PM

    // Get busy times
    const response = await this.request<FreeBusyResponse>(
      `${GOOGLE_CALENDAR_API}/freeBusy`,
      {
        method: 'POST',
        body: JSON.stringify({
          timeMin: startOfDay.toISOString(),
          timeMax: endOfDay.toISOString(),
          items: [{ id: this.calendarId }],
        }),
      }
    )

    const busyTimes = response.calendars[this.calendarId]?.busy || []

    // Calculate available slots
    const slots: { start: Date; end: Date }[] = []
    let currentTime = startOfDay.getTime()
    const slotDuration = durationMinutes * 60 * 1000

    for (const busy of busyTimes) {
      const busyStart = new Date(busy.start).getTime()
      const busyEnd = new Date(busy.end).getTime()

      // Add slots before this busy period
      while (currentTime + slotDuration <= busyStart) {
        slots.push({
          start: new Date(currentTime),
          end: new Date(currentTime + slotDuration),
        })
        currentTime += slotDuration
      }

      // Move past the busy period
      if (currentTime < busyEnd) {
        currentTime = busyEnd
      }
    }

    // Add remaining slots after last busy period
    while (currentTime + slotDuration <= endOfDay.getTime()) {
      slots.push({
        start: new Date(currentTime),
        end: new Date(currentTime + slotDuration),
      })
      currentTime += slotDuration
    }

    return slots
  }

  async refreshToken(): Promise<boolean> {
    if (!this.credentials.refreshToken) {
      throw new Error('No refresh token available')
    }

    try {
      const clientId = process.env.GOOGLE_CLIENT_ID
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET

      const response = await fetch('https://oauth2.googleapis.com/token', {
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

  private mapToGoogleEvent(event: Partial<CalendarEvent>): Partial<GoogleCalendarEvent> {
    const googleEvent: Partial<GoogleCalendarEvent> = {}
    
    if (event.title) googleEvent.summary = event.title
    if (event.description) googleEvent.description = event.description
    if (event.location) googleEvent.location = event.location
    
    if (event.startTime) {
      googleEvent.start = {
        dateTime: event.startTime.toISOString(),
        timeZone: 'America/Sao_Paulo',
      }
    }
    
    if (event.endTime) {
      googleEvent.end = {
        dateTime: event.endTime.toISOString(),
        timeZone: 'America/Sao_Paulo',
      }
    }
    
    if (event.attendees) {
      googleEvent.attendees = event.attendees.map(a => ({
        email: a.email,
        displayName: a.name,
      }))
    }

    if (event.reminders) {
      googleEvent.reminders = {
        useDefault: false,
        overrides: event.reminders.map(r => ({
          method: r.method,
          minutes: r.minutes,
        })),
      }
    }
    
    return googleEvent
  }

  private mapFromGoogleEvent(event: GoogleCalendarEvent): CalendarEvent {
    return {
      id: event.id,
      title: event.summary,
      description: event.description,
      startTime: new Date(event.start.dateTime || event.start.date!),
      endTime: new Date(event.end.dateTime || event.end.date!),
      location: event.location,
      attendees: event.attendees?.map(a => ({
        email: a.email,
        name: a.displayName,
      })),
    }
  }
}

// OAuth helpers for Google Calendar
export function getGoogleAuthUrl(state: string, redirectUri: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
  ]
  
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId!)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', scopes.join(' '))
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', state)
  
  return url.toString()
}

export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  const response = await fetch('https://oauth2.googleapis.com/token', {
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
