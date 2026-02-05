// GET /api/integrations - List all integrations (available and connected)
// Force dynamic rendering
export const dynamic = 'force-dynamic'
// POST /api/integrations - Create/connect a new integration

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { INTEGRATIONS_REGISTRY, type IntegrationInfo } from '@/lib/integrations/types'
import type { IntegrationType, IntegrationStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
    }

    // Verify user has access to workspace
    const workspace = await prisma.workspace.findFirst({
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

    // Get connected integrations
    const connectedIntegrations = await prisma.integration.findMany({
      where: {
        workspaceId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Build response with available and connected integrations
    const integrations: {
      type: IntegrationType
      info: IntegrationInfo
      connected: boolean
      connection?: {
        id: string
        name: string
        status: IntegrationStatus
        lastSyncAt: Date | null
        statusMessage: string | null
      }
    }[] = []

    for (const [type, info] of Object.entries(INTEGRATIONS_REGISTRY)) {
      const connection = connectedIntegrations.find(i => i.type === type)
      
      integrations.push({
        type: type as IntegrationType,
        info,
        connected: !!connection,
        connection: connection ? {
          id: connection.id,
          name: connection.name,
          status: connection.status,
          lastSyncAt: connection.lastSyncAt,
          statusMessage: connection.statusMessage,
        } : undefined,
      })
    }

    // Group by category
    const grouped = integrations.reduce((acc, integration) => {
      const category = integration.info.category
      if (!acc[category]) acc[category] = []
      acc[category].push(integration)
      return acc
    }, {} as Record<string, typeof integrations>)

    return NextResponse.json({
      integrations,
      grouped,
      stats: {
        total: integrations.length,
        connected: connectedIntegrations.length,
        active: connectedIntegrations.filter(i => i.status === 'ACTIVE').length,
        error: connectedIntegrations.filter(i => i.status === 'ERROR').length,
      },
    })
  } catch (error) {
    console.error('Error fetching integrations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { workspaceId, type, name, config } = body

    if (!workspaceId || !type) {
      return NextResponse.json({ error: 'workspaceId and type are required' }, { status: 400 })
    }

    // Verify integration type is valid
    if (!INTEGRATIONS_REGISTRY[type as IntegrationType]) {
      return NextResponse.json({ error: 'Invalid integration type' }, { status: 400 })
    }

    // Verify user has access to workspace
    const workspace = await prisma.workspace.findFirst({
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
    const existing = await prisma.integration.findFirst({
      where: {
        workspaceId,
        type: type as IntegrationType,
        deletedAt: null,
      },
    })

    if (existing) {
      return NextResponse.json({ error: 'Integration already exists' }, { status: 409 })
    }

    const integrationInfo = INTEGRATIONS_REGISTRY[type as IntegrationType]

    // For non-OAuth integrations, create directly
    if (!integrationInfo.oauthRequired) {
      const integration = await prisma.integration.create({
        data: {
          workspaceId,
          type: type as IntegrationType,
          name: name || integrationInfo.name,
          config: config || {},
          credentials: config?.credentials || {},
          status: 'ACTIVE',
        },
      })

      // Log the connection
      await prisma.integrationLog.create({
        data: {
          integrationId: integration.id,
          action: 'CONNECT',
          status: 'SUCCESS',
          data: { method: 'api_key' },
        },
      })

      return NextResponse.json({ integration }, { status: 201 })
    }

    // For OAuth integrations, create with PENDING status
    const integration = await prisma.integration.create({
      data: {
        workspaceId,
        type: type as IntegrationType,
        name: name || integrationInfo.name,
        config: config || {},
        status: 'PENDING',
        oauthState: crypto.randomUUID(),
      },
    })

    return NextResponse.json({ 
      integration,
      requiresOAuth: true,
      message: 'Integration created. Complete OAuth to activate.',
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating integration:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
