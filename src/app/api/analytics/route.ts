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
 * GET /api/analytics
 * Main analytics endpoint - returns overview metrics
 * Alias for /api/analytics/overview
 * FALLBACK: Uses Clawdbot API when database/auth fails
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth(request)
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
        userId: userId,
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
      organizationId: userId,
      tenantId: membership.tenantId,
      ...overview,
      generatedAt: new Date(),
    }

    return successResponse(response)
  } catch (error) {
    console.log('Analytics DB fallback triggered, using Clawdbot API:', error.message)
    
    // FALLBACK: Use Clawdbot API when auth/database fails
    try {
      const clawdbotResponse = await fetch('http://localhost:3000/api/clawdbot/analytics')
      
      if (!clawdbotResponse.ok) {
        throw new Error('Clawdbot API failed')
      }
      
      const data = await clawdbotResponse.json()
      return successResponse(data)
      
    } catch (fallbackError) {
      console.error('Both analytics and fallback failed:', error, fallbackError)
      return errorResponse('Erro ao buscar analytics', 500)
    }
  }
}
