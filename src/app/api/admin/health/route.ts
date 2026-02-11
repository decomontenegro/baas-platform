import { NextRequest, NextResponse } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHealthSummary, runHealthCheckCycle } from '@/lib/admin-agent/health-checker'

/**
 * GET /api/admin/health
 * Get health summary for all bots
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's tenant
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { Tenant: true }
    })

    if (!user?.tenantId) {
      return NextResponse.json(
        { error: 'No tenant found' },
        { status: 404 }
      )
    }

    const summary = await getHealthSummary(user.tenantId)

    return NextResponse.json(summary)
  } catch (error) {
    console.error('Error fetching health summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch health summary' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/health
 * Trigger a health check cycle
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's tenant
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { Tenant: true }
    })

    if (!user?.tenantId) {
      return NextResponse.json(
        { error: 'No tenant found' },
        { status: 404 }
      )
    }

    // Run health check
    const result = await runHealthCheckCycle(user.tenantId)

    return NextResponse.json({
      message: 'Health check completed',
      ...result
    })
  } catch (error) {
    console.error('Error running health check:', error)
    return NextResponse.json(
      { error: 'Failed to run health check' },
      { status: 500 }
    )
  }
}
