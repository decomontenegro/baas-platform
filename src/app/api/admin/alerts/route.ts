import { NextRequest, NextResponse } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/alerts
 * Get alerts for the admin agent
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

    if (!user?.tenant?.adminAgent) {
      return NextResponse.json({ alerts: [], total: 0 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'OPEN'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where = {
      adminAgentId: user.Tenant.adminAgent.id,
      ...(status !== 'all' && { status: status as any })
    }

    const [alerts, total] = await Promise.all([
      prisma.adminAlert.findMany({
        where,
        include: { bot: { select: { id: true, name: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.adminAlert.count({ where })
    ])

    return NextResponse.json({ alerts, total })
  } catch (error) {
    console.error('Error fetching alerts:', error)
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/alerts
 * Update alert status (acknowledge, resolve, ignore)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { alertId, action, resolution } = body

    if (!alertId || !action) {
      return NextResponse.json(
        { error: 'alertId and action are required' },
        { status: 400 }
      )
    }

    const alert = await prisma.adminAlert.findUnique({
      where: { id: alertId },
      include: { adminAgent: { include: { Tenant: true } } }
    })

    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    // Verify user has access to this tenant
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (user?.tenantId !== alert.adminAgent.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let updateData: any = {}

    switch (action) {
      case 'acknowledge':
        updateData = {
          status: 'ACKNOWLEDGED',
          acknowledged: true,
          acknowledgedAt: new Date(),
          acknowledgedBy: session.user.id
        }
        break
      case 'resolve':
        updateData = {
          status: 'RESOLVED',
          resolvedAt: new Date(),
          resolvedBy: session.user.id,
          resolution: resolution || 'Resolvido manualmente'
        }
        break
      case 'ignore':
        updateData = {
          status: 'IGNORED',
          resolvedAt: new Date(),
          resolvedBy: session.user.id,
          resolution: resolution || 'Ignorado'
        }
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const updated = await prisma.adminAlert.update({
      where: { id: alertId },
      data: updateData
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating alert:', error)
    return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 })
  }
}
