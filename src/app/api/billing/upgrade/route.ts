import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { successResponse, errorResponse, requireAuth } from '@/lib/api-utils'
import { createCheckoutSession } from '@/lib/billing/stripe'
import { getPlan, type PlanId, PLANS } from '@/lib/billing/plans'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/billing/upgrade
 * Creates a Stripe checkout session for plan upgrade
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireAuth(request)
    const body = await request.json()
    
    const { planId } = body as { planId: PlanId }

    // Validate plan
    if (!planId || !PLANS[planId]) {
      return errorResponse('Plano inválido', 400)
    }

    const plan = getPlan(planId)

    // Enterprise needs custom handling
    if (planId === 'ENTERPRISE') {
      return successResponse({
        requiresContact: true,
        message: 'Entre em contato conosco para o plano Enterprise',
        contactEmail: 'enterprise@baas.com',
      })
    }

    // Free plan doesn't need checkout
    if (planId === 'FREE') {
      return errorResponse('Use o portal de billing para fazer downgrade', 400)
    }

    // Get user email for Stripe
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        users: {
          where: { role: 'OWNER' },
          take: 1,
          select: { email: true },
        },
      },
    })

    const email = tenant?.users[0]?.email
    if (!email) {
      return errorResponse('Email do proprietário não encontrado', 400)
    }

    // Create checkout session
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const successUrl = `${baseUrl}/billing?success=true&plan=${planId}`
    const cancelUrl = `${baseUrl}/billing?canceled=true`

    const session = await createCheckoutSession(
      tenantId,
      planId,
      successUrl,
      cancelUrl,
      email
    )

    return successResponse({
      sessionId: session.sessionId,
      checkoutUrl: session.url,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error creating checkout session:', error)
    return errorResponse('Erro ao criar sessão de pagamento', 500)
  }
}

/**
 * GET /api/billing/upgrade
 * Returns available plans for upgrade
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireAuth(request)

    // Get current subscription
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
      select: { plan: true },
    })

    const currentPlan = (subscription?.plan as PlanId) || 'FREE'

    // Get all plans with upgrade/downgrade info
    const plans = Object.values(PLANS).map(plan => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      formattedPrice: plan.price === 0 
        ? 'Grátis' 
        : plan.price === -1 
          ? 'Sob consulta' 
          : `R$ ${plan.price}/mês`,
      features: plan.features,
      popular: plan.popular || false,
      isCurrent: plan.id === currentPlan,
      isUpgrade: getPlanOrder(plan.id) > getPlanOrder(currentPlan),
      isDowngrade: getPlanOrder(plan.id) < getPlanOrder(currentPlan),
      limits: {
        maxChannels: plan.maxChannels,
        maxMessages: plan.maxMessages,
        maxBots: plan.maxBots,
        maxUsers: plan.maxUsers,
        maxStorage: plan.maxStorage,
      },
    }))

    return successResponse({
      currentPlan,
      plans,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error fetching plans:', error)
    return errorResponse('Erro ao buscar planos', 500)
  }
}

function getPlanOrder(planId: PlanId): number {
  const order: Record<PlanId, number> = {
    FREE: 0,
    STARTER: 1,
    PRO: 2,
    ENTERPRISE: 3,
  }
  return order[planId] ?? 0
}
