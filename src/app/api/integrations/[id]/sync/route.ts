// POST /api/integrations/[id]/sync - Force sync/test integration
// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createIntegration } from '@/lib/integrations/factory'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const { testOnly } = body

    const integration = await prisma.integration.findFirst({
      where: {
        id,
        workspace: {
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

    const handler = createIntegration(integration)
    const startTime = Date.now()

    // Test connection
    const connectionOk = await handler.testConnection()

    if (!connectionOk) {
      await prisma.integration.update({
        where: { id },
        data: {
          status: 'ERROR',
          statusMessage: 'Connection test failed',
          lastErrorAt: new Date(),
        },
      })

      return NextResponse.json({
        success: false,
        error: 'Connection test failed',
        duration: Date.now() - startTime,
      }, { status: 400 })
    }

    // If only testing, return here
    if (testOnly) {
      await prisma.integration.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          statusMessage: null,
        },
      })

      return NextResponse.json({
        success: true,
        testOnly: true,
        duration: Date.now() - startTime,
      })
    }

    // Full sync (if supported)
    let syncResult = null
    try {
      syncResult = await handler.sync()
    } catch (error) {
      // Sync not implemented for this integration, that's ok
      if (!(error as Error).message.includes('not implemented')) {
        throw error
      }
    }

    // Update integration status
    await prisma.integration.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        statusMessage: null,
        lastSyncAt: new Date(),
        lastSyncData: syncResult,
      },
    })

    return NextResponse.json({
      success: true,
      syncResult,
      duration: Date.now() - startTime,
    })

  } catch (error) {
    console.error('Error syncing integration:', error)

    // Try to update integration status
    try {
      const { id } = await params
      await prisma.integration.update({
        where: { id },
        data: {
          status: 'ERROR',
          statusMessage: (error as Error).message,
          lastErrorAt: new Date(),
        },
      })
    } catch {}

    return NextResponse.json({ 
      error: (error as Error).message || 'Sync failed',
    }, { status: 500 })
  }
}
