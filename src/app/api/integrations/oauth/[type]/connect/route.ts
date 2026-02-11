// POST /api/integrations/[type]/connect - Start OAuth flow for integration
// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { INTEGRATIONS_REGISTRY } from '@/lib/integrations/types'
import { getHubSpotAuthUrl } from '@/lib/integrations/hubspot'
import { getGoogleAuthUrl } from '@/lib/integrations/google-calendar'
import { getZendeskAuthUrl } from '@/lib/integrations/zendesk'
import { getNotionAuthUrl } from '@/lib/integrations/notion'
import type { IntegrationType } from '@prisma/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { type } = await params
    const body = await request.json()
    const { workspaceId, config } = body

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
    }

    // Verify integration type
    const integrationInfo = INTEGRATIONS_REGISTRY[type as IntegrationType]
    if (!integrationInfo) {
      return NextResponse.json({ error: 'Invalid integration type' }, { status: 400 })
    }

    // Verify user has access to workspace
    const workspace = await prisma.Workspace.findFirst({
      where: {
        id: workspaceId,
        tenant: {
          memberships: {
            some: { userId: session.user.id, status: 'ACTIVE' },
          },
        },
        deletedAt: null,
      },
    })

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Check if integration already exists
    let integration = await prisma.integration.findFirst({
      where: {
        workspaceId,
        type: type as IntegrationType,
        deletedAt: null,
      },
    })

    // Generate OAuth state
    const state = JSON.stringify({
      integrationId: integration?.id,
      workspaceId,
      type,
      timestamp: Date.now(),
      nonce: crypto.randomUUID(),
    })

    const encodedState = Buffer.from(state).toString('base64url')

    // Create or update integration with pending status
    if (integration) {
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          oauthState: encodedState,
          status: 'PENDING',
          config: { ...(integration.config as object), ...config },
        },
      })
    } else {
      integration = await prisma.integration.create({
        data: {
          workspaceId,
          type: type as IntegrationType,
          name: integrationInfo.name,
          config: config || {},
          status: 'PENDING',
          oauthState: encodedState,
        },
      })
    }

    // Log OAuth start
    await prisma.integrationLog.create({
      data: {
        integrationId: integration.id,
        action: 'OAUTH_START',
        status: 'PENDING',
      },
    })

    // Get base URL for redirect
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const redirectUri = `${baseUrl}/api/integrations/${type}/callback`

    // Generate OAuth URL based on integration type
    let authUrl: string

    switch (type) {
      case 'CRM_HUBSPOT':
        authUrl = getHubSpotAuthUrl(encodedState, redirectUri)
        break

      case 'CALENDAR_GOOGLE':
      case 'STORAGE_GOOGLE_DRIVE':
        authUrl = getGoogleAuthUrl(encodedState, redirectUri)
        break

      case 'HELPDESK_ZENDESK':
        const subdomain = config?.subdomain
        if (!subdomain) {
          return NextResponse.json({ error: 'Zendesk subdomain is required' }, { status: 400 })
        }
        authUrl = getZendeskAuthUrl(subdomain, encodedState, redirectUri)
        break

      case 'STORAGE_NOTION':
        authUrl = getNotionAuthUrl(encodedState, redirectUri)
        break

      case 'CRM_PIPEDRIVE':
        authUrl = `https://oauth.pipedrive.com/oauth/authorize?client_id=${process.env.PIPEDRIVE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodedState}`
        break

      case 'CRM_RDSTATION':
        authUrl = `https://app.rdstation.com.br/api/oauth/authorize?client_id=${process.env.RDSTATION_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodedState}`
        break

      case 'HELPDESK_INTERCOM':
        authUrl = `https://app.intercom.com/oauth?client_id=${process.env.INTERCOM_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodedState}`
        break

      case 'HELPDESK_FRESHDESK':
        // Freshdesk uses API key, not OAuth
        return NextResponse.json({ 
          error: 'Freshdesk uses API key authentication, not OAuth',
          configRequired: ['domain', 'apiKey'],
        }, { status: 400 })

      default:
        // For integrations without OAuth
        if (!integrationInfo.oauthRequired) {
          return NextResponse.json({ 
            error: 'This integration does not require OAuth',
            configRequired: integrationInfo.configFields?.filter(f => f.required).map(f => f.key),
          }, { status: 400 })
        }
        return NextResponse.json({ error: 'OAuth not implemented for this integration' }, { status: 501 })
    }

    return NextResponse.json({
      authUrl,
      integrationId: integration.id,
      state: encodedState,
    })

  } catch (error) {
    console.error('Error starting OAuth:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
