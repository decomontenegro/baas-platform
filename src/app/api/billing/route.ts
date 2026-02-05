import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { successResponse, errorResponse, requireAuth } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { getUsageSummary, getLimitWarnings } from '@/lib/billing/limits'
import { getPlan, type PlanId } from '@/lib/billing/plans'

/**
 * GET /api/billing
 * Returns current billing status (plan, subscription, usage summary)
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireAuth(request)

    // Get subscription
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
      select: {
        plan: true,
        status: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        maxChannels: true,
        maxMessages: true,
        maxBots: true,
        maxUsers: true,
        maxStorage: true,
        hasAnalytics: true,
        hasApiAccess: true,
        hasPrioritySupport: true,
        hasCustomBranding: true,
      },
    })

    // Get plan details
    const planId = (subscription?.plan as PlanId) || 'FREE'
    const plan = getPlan(planId)

    // Get usage summary
    const usage = await getUsageSummary(tenantId)

    // Get warnings
    const warnings = await getLimitWarnings(tenantId)

    // Calculate days remaining in period
    const now = new Date()
    const periodEnd = subscription?.currentPeriodEnd || new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

    return successResponse({
      plan: {
        id: planId,
        name: plan.name,
        price: plan.price,
        features: plan.features,
      },
      subscription: {
        status: subscription?.status || 'ACTIVE',
        currentPeriodStart: subscription?.currentPeriodStart,
        currentPeriodEnd: subscription?.currentPeriodEnd,
        cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
        daysRemaining,
      },
      limits: {
        maxChannels: subscription?.maxChannels ?? plan.maxChannels,
        maxMessages: subscription?.maxMessages ?? plan.maxMessages,
        maxBots: subscription?.maxBots ?? plan.maxBots,
        maxUsers: subscription?.maxUsers ?? plan.maxUsers,
        maxStorage: subscription?.maxStorage ?? plan.maxStorage,
        hasAnalytics: subscription?.hasAnalytics ?? plan.hasAnalytics,
        hasApiAccess: subscription?.hasApiAccess ?? plan.hasApiAccess,
        hasPrioritySupport: subscription?.hasPrioritySupport ?? plan.hasPrioritySupport,
        hasCustomBranding: subscription?.hasCustomBranding ?? plan.hasCustomBranding,
      },
      usage,
      warnings,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error fetching billing status:', error)
    return errorResponse('Erro ao buscar status de billing', 500)
  }
}
