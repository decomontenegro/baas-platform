// GET /api/integrations/[type]/callback - OAuth callback handler
// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exchangeHubSpotCode } from '@/lib/integrations/hubspot'
import { exchangeGoogleCode } from '@/lib/integrations/google-calendar'
import { exchangeZendeskCode } from '@/lib/integrations/zendesk'
import { exchangeNotionCode } from '@/lib/integrations/notion'
import type { IntegrationType } from '@prisma/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params
  const { searchParams } = new URL(request.url)
  
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Get base URL for redirect
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const dashboardUrl = `${baseUrl}/integrations`

  // Handle OAuth error
  if (error) {
    console.error('OAuth error:', error, errorDescription)
    return NextResponse.redirect(
      `${dashboardUrl}?error=${encodeURIComponent(errorDescription || error)}&type=${type}`
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${dashboardUrl}?error=${encodeURIComponent('Missing code or state')}&type=${type}`
    )
  }

  try {
    // Decode state
    const stateData = JSON.parse(Buffer.from(state, 'base64url').toString())
    const { workspaceId, integrationId } = stateData

    // Verify state matches integration
    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        workspaceId,
        type: type as IntegrationType,
        oauthState: state,
        deletedAt: null,
      },
    })

    if (!integration) {
      return NextResponse.redirect(
        `${dashboardUrl}?error=${encodeURIComponent('Invalid state or integration not found')}&type=${type}`
      )
    }

    // Check state timestamp (expire after 10 minutes)
    if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
      await prisma.integrationLog.create({
        data: {
          integrationId: integration.id,
          action: 'OAUTH_CALLBACK',
          status: 'FAILED',
          error: 'OAuth state expired',
        },
      })
      return NextResponse.redirect(
        `${dashboardUrl}?error=${encodeURIComponent('OAuth session expired. Please try again.')}&type=${type}`
      )
    }

    const redirectUri = `${baseUrl}/api/integrations/${type}/callback`
    let credentials: Record<string, any> = {}
    let additionalConfig: Record<string, any> = {}

    // Exchange code for tokens based on integration type
    switch (type) {
      case 'CRM_HUBSPOT': {
        const tokens = await exchangeHubSpotCode(code, redirectUri)
        credentials = {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: Date.now() + tokens.expiresIn * 1000,
        }
        break
      }

      case 'CALENDAR_GOOGLE':
      case 'STORAGE_GOOGLE_DRIVE': {
        const tokens = await exchangeGoogleCode(code, redirectUri)
        credentials = {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: Date.now() + tokens.expiresIn * 1000,
        }
        break
      }

      case 'HELPDESK_ZENDESK': {
        const subdomain = (integration.config as any)?.subdomain
        if (!subdomain) {
          throw new Error('Zendesk subdomain not configured')
        }
        const tokens = await exchangeZendeskCode(subdomain, code, redirectUri)
        credentials = {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresIn ? Date.now() + tokens.expiresIn * 1000 : undefined,
        }
        break
      }

      case 'STORAGE_NOTION': {
        const notionData = await exchangeNotionCode(code, redirectUri)
        credentials = {
          accessToken: notionData.accessToken,
          botId: notionData.botId,
        }
        additionalConfig = {
          workspaceId: notionData.workspaceId,
          workspaceName: notionData.workspaceName,
        }
        break
      }

      case 'CRM_PIPEDRIVE': {
        const response = await fetch('https://oauth.pipedrive.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            client_id: process.env.PIPEDRIVE_CLIENT_ID!,
            client_secret: process.env.PIPEDRIVE_CLIENT_SECRET!,
          }),
        })
        if (!response.ok) throw new Error('Pipedrive OAuth failed')
        const data = await response.json()
        credentials = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + data.expires_in * 1000,
          apiDomain: data.api_domain,
        }
        break
      }

      case 'CRM_RDSTATION': {
        const response = await fetch('https://api.rd.services/auth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: process.env.RDSTATION_CLIENT_ID,
            client_secret: process.env.RDSTATION_CLIENT_SECRET,
            code,
          }),
        })
        if (!response.ok) throw new Error('RD Station OAuth failed')
        const data = await response.json()
        credentials = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + data.expires_in * 1000,
        }
        break
      }

      case 'HELPDESK_INTERCOM': {
        const response = await fetch('https://api.intercom.io/auth/eagle/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: process.env.INTERCOM_CLIENT_ID,
            client_secret: process.env.INTERCOM_CLIENT_SECRET,
            code,
          }),
        })
        if (!response.ok) throw new Error('Intercom OAuth failed')
        const data = await response.json()
        credentials = {
          accessToken: data.access_token,
        }
        break
      }

      default:
        throw new Error(`OAuth callback not implemented for ${type}`)
    }

    // Update integration with credentials
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        credentials,
        config: {
          ...(integration.config as object),
          ...additionalConfig,
        },
        status: 'ACTIVE',
        oauthState: null,
        statusMessage: null,
      },
    })

    // Log successful OAuth
    await prisma.integrationLog.create({
      data: {
        integrationId: integration.id,
        action: 'OAUTH_CALLBACK',
        status: 'SUCCESS',
        data: { type },
      },
    })

    // Redirect to dashboard with success
    return NextResponse.redirect(
      `${dashboardUrl}?success=true&type=${type}&name=${encodeURIComponent(integration.name)}`
    )

  } catch (error) {
    console.error('OAuth callback error:', error)
    
    // Try to log the error
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64url').toString())
      if (stateData.integrationId) {
        await prisma.integrationLog.create({
          data: {
            integrationId: stateData.integrationId,
            action: 'OAUTH_CALLBACK',
            status: 'FAILED',
            error: (error as Error).message,
          },
        })

        await prisma.integration.update({
          where: { id: stateData.integrationId },
          data: {
            status: 'ERROR',
            statusMessage: (error as Error).message,
          },
        })
      }
    } catch {}

    return NextResponse.redirect(
      `${dashboardUrl}?error=${encodeURIComponent((error as Error).message)}&type=${type}`
    )
  }
}
