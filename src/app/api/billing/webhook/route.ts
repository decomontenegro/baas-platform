import { NextRequest, NextResponse } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { handleWebhookEvent } from '@/lib/billing/stripe'

/**
 * POST /api/billing/webhook
 * Stripe webhook handler
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      )
    }

    const result = await handleWebhookEvent(body, signature)

    return NextResponse.json({ received: true, type: result.type })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook processing failed' },
      { status: 400 }
    )
  }
}


// App Router automatically handles raw body when using request.text()
