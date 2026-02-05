import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import {
  successResponse,
  errorResponse,
  requireAuth,
  getDateRangeParams,
} from '@/lib/api-utils'
import { getOverviewMetrics } from '@/lib/analytics'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/analytics/overview
 * Returns general dashboard metrics (messages, channels, costs, performance)
 * Query params: start, end (ISO date strings)
 */
export async function GET(request: NextRequest) {
  try {
    const orgId = await requireAuth(request)
    const searchParams = request.nextUrl.searchParams
    const { start, end } = getDateRangeParams(searchParams)

    // Validate date range
    if (start > end) {
      return errorResponse('Data inicial não pode ser maior que a final')
    }

    const maxRange = 365 * 24 * 60 * 60 * 1000 // 1 year
    if (end.getTime() - start.getTime() > maxRange) {
      return errorResponse('Período máximo é de 1 ano')
    }

    // Get tenant from membership
    const membership = await prisma.membership.findFirst({
      where: {
        userId: orgId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: { tenantId: true },
    })

    if (!membership) {
      return errorResponse('Tenant não encontrado', 404)
    }

    // Get real metrics from database
    const overview = await getOverviewMetrics(membership.tenantId, start, end)

    const response = {
      organizationId: orgId,
      tenantId: membership.tenantId,
      ...overview,
      generatedAt: new Date(),
    }

    return successResponse(response)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error fetching analytics overview:', error)
    return errorResponse('Erro ao buscar analytics', 500)
  }
}
