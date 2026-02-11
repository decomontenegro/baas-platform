import { NextRequest, NextResponse } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const setupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  alertEmail: z.string().email().optional().nullable(),
  alertWhatsApp: z.string().optional().nullable(),
  alertWebhook: z.string().url().optional().nullable(),
  healthCheckEnabled: z.boolean().optional(),
  healthCheckIntervalMs: z.number().min(60000).max(3600000).optional(), // 1min to 1hour
  autoRestartEnabled: z.boolean().optional(),
  autoRollbackEnabled: z.boolean().optional()
})

/**
 * GET /api/admin/setup
 * Get admin agent configuration
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { Tenant: { include: { adminAgent: true } } }
    })

    if (!user?.tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    return NextResponse.json({
      configured: !!user.Tenant?.adminAgent,
      adminAgent: user.Tenant?.adminAgent || null
    })
  } catch (error) {
    console.error('Error fetching admin agent:', error)
    return NextResponse.json({ error: 'Failed to fetch admin agent' }, { status: 500 })
  }
}

/**
 * POST /api/admin/setup
 * Create or update admin agent
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { Tenant: { include: { adminAgent: true } } }
    })

    if (!user?.tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    const body = await request.json()
    const validation = setupSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      )
    }

    const data = validation.data

    let adminAgent

    if (user.Tenant?.adminAgent) {
      // Update existing
      adminAgent = await prisma.adminAgent.update({
        where: { tenantId: user.tenantId },
        data: {
          ...data,
          updatedAt: new Date()
        }
      })
    } else {
      // Create new
      adminAgent = await prisma.adminAgent.create({
        data: {
          tenantId: user.tenantId,
          name: data.name || 'Admin Agent',
          alertEmail: data.alertEmail,
          alertWhatsApp: data.alertWhatsApp,
          alertWebhook: data.alertWebhook,
          healthCheckEnabled: data.healthCheckEnabled ?? true,
          healthCheckIntervalMs: data.healthCheckIntervalMs ?? 300000,
          autoRestartEnabled: data.autoRestartEnabled ?? true,
          autoRollbackEnabled: data.autoRollbackEnabled ?? true
        }
      })
    }

    return NextResponse.json({
      message: user.Tenant?.adminAgent ? 'Admin agent updated' : 'Admin agent created',
      adminAgent
    })
  } catch (error) {
    console.error('Error setting up admin agent:', error)
    return NextResponse.json({ error: 'Failed to setup admin agent' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/setup
 * Disable admin agent
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user?.tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    await prisma.adminAgent.update({
      where: { tenantId: user.tenantId },
      data: { status: 'DISABLED' }
    })

    return NextResponse.json({ message: 'Admin agent disabled' })
  } catch (error) {
    console.error('Error disabling admin agent:', error)
    return NextResponse.json({ error: 'Failed to disable admin agent' }, { status: 500 })
  }
}
