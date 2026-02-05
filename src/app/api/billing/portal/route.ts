import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { successResponse, errorResponse, requireAuth } from '@/lib/api-utils'
import { createPortalSession } from '@/lib/billing/stripe'

/**
 * POST /api/billing/portal
 * Creates a Stripe billing portal session
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireAuth(request)

    // Get return URL
    const body = await request.json().catch(() => ({}))
    const returnUrl = body.returnUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/billing`

    const session = await createPortalSession(tenantId, returnUrl)

    return successResponse({
      portalUrl: session.url,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    if (error instanceof Error && error.message.includes('No Stripe customer')) {
      return errorResponse('Nenhuma assinatura ativa encontrada', 400)
    }
    console.error('Error creating portal session:', error)
    return errorResponse('Erro ao abrir portal de billing', 500)
  }
}
