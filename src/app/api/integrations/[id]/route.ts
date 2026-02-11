// GET /api/integrations/[id] - Get integration details
// Force dynamic rendering
export const dynamic = 'force-dynamic'
// PATCH /api/integrations/[id] - Update integration config
// DELETE /api/integrations/[id] - Disconnect/delete integration

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createIntegration } from '@/lib/integrations/factory'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const integration = await prisma.integration.findFirst({
      where: {
        id,
        Workspace: {
          tenant: {
            memberships: {
              some: { userId: session.user.id, status: 'ACTIVE' },
            },
          },
        },
        deletedAt: null,
      },
      include: {
        logs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    // Don't expose credentials
    const { credentials, ...safeIntegration } = integration

    return NextResponse.json({
      integration: safeIntegration,
      hasCredentials: Object.keys(credentials as object || {}).length > 0,
    })
  } catch (error) {
    console.error('Error fetching integration:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, config, syncEnabled, syncInterval } = body

    const integration = await prisma.integration.findFirst({
      where: {
        id,
        Workspace: {
          tenant: {
            memberships: {
              some: { userId: session.user.id, status: 'ACTIVE' },
            },
          },
        },
        deletedAt: null,
      },
    })

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    const updatedIntegration = await prisma.integration.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(config && { 
          config: { ...(integration.config as object), ...config } 
        }),
        ...(syncEnabled !== undefined && { syncEnabled }),
        ...(syncInterval && { syncInterval }),
      },
    })

    // Log the update
    await prisma.integrationLog.create({
      data: {
        integrationId: id,
        action: 'SYNC', // Using SYNC as generic update action
        status: 'SUCCESS',
        data: { updated: Object.keys(body) },
      },
    })

    const { credentials, ...safeIntegration } = updatedIntegration

    return NextResponse.json({ integration: safeIntegration })
  } catch (error) {
    console.error('Error updating integration:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const integration = await prisma.integration.findFirst({
      where: {
        id,
        Workspace: {
          tenant: {
            memberships: {
              some: { userId: session.user.id, status: 'ACTIVE' },
            },
          },
        },
        deletedAt: null,
      },
    })

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    // Log the disconnection before deleting
    await prisma.integrationLog.create({
      data: {
        integrationId: id,
        action: 'DISCONNECT',
        status: 'SUCCESS',
        data: { 
          type: integration.type,
          name: integration.name,
          disconnectedBy: session.user.id,
        },
      },
    })

    // Soft delete the integration
    await prisma.integration.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: session.user.id,
        status: 'INACTIVE',
        credentials: {}, // Clear credentials
      },
    })

    return NextResponse.json({ 
      success: true,
      message: 'Integration disconnected successfully',
    })
  } catch (error) {
    console.error('Error deleting integration:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
