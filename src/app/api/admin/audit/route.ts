import { NextRequest, NextResponse } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAuditLog, countAuditLogs, formatAuditEntry } from '@/lib/admin-agent/audit-logger'

/**
 * GET /api/admin/audit
 * List audit logs with filters and pagination
 * 
 * Query params:
 * - userId: Filter by user ID
 * - action: Filter by action (e.g., 'bot.create', 'config.update')
 * - resource: Filter by resource type (e.g., 'bot', 'config')
 * - dateFrom: Filter from date (ISO string)
 * - dateTo: Filter to date (ISO string)
 * - page: Page number (1-indexed, default: 1)
 * - limit: Items per page (default: 50, max: 100)
 * - format: Response format ('raw' | 'formatted', default: 'raw')
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

    // Parse query params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || undefined
    const action = searchParams.get('action') || undefined
    const resource = searchParams.get('resource') || undefined
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const format = searchParams.get('format') || 'raw'

    // Build filters
    const filters = {
      userId,
      action,
      resource,
      startDate: dateFrom ? new Date(dateFrom) : undefined,
      endDate: dateTo ? new Date(dateTo) : undefined,
      limit,
      offset: (page - 1) * limit
    }

    // Fetch logs and count in parallel
    const [logs, total] = await Promise.all([
      getAuditLog(user.tenantId, filters),
      countAuditLogs(user.tenantId, {
        userId,
        action,
        resource,
        startDate: filters.startDate,
        endDate: filters.endDate
      })
    ])

    // Format response
    const data = format === 'formatted' 
      ? logs.map(formatAuditEntry)
      : logs

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}
