/**
 * Stripe integration for billing
 */

import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { getPlan, type PlanId } from './plans'

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
})

// Webhook signing secret
export const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''

/**
 * Create or get Stripe customer for a tenant
 */
export async function getOrCreateCustomer(
  tenantId: string,
  email: string,
  name?: string
): Promise<string> {
  // Check if customer already exists
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { stripeCustomerId: true },
  })

  if (subscription?.stripeCustomerId) {
    return subscription.stripeCustomerId
  }

  // Get tenant info
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, slug: true },
  })

  // Create Stripe customer
  const customer = await stripe.customers.create({
    email,
    name: name || tenant?.name,
    metadata: {
      tenantId,
      tenantSlug: tenant?.slug || '',
    },
  })

  // Store customer ID
  await prisma.subscription.upsert({
    where: { tenantId },
    create: {
      tenantId,
      stripeCustomerId: customer.id,
      plan: 'FREE',
    },
    update: {
      stripeCustomerId: customer.id,
    },
  })

  return customer.id
}

/**
 * Create a checkout session for plan upgrade
 */
export async function createCheckoutSession(
  tenantId: string,
  planId: PlanId,
  successUrl: string,
  cancelUrl: string,
  customerEmail: string
): Promise<{ sessionId: string; url: string }> {
  const plan = getPlan(planId)
  
  if (!plan.stripePriceId) {
    throw new Error(`Plan ${planId} does not have a Stripe price configured`)
  }

  // Get or create customer
  const customerId = await getOrCreateCustomer(tenantId, customerEmail)

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card', 'boleto'],
    line_items: [
      {
        price: plan.stripePriceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      tenantId,
      planId,
    },
    subscription_data: {
      metadata: {
        tenantId,
        planId,
      },
    },
    locale: 'pt-BR',
    allow_promotion_codes: true,
  })

  return {
    sessionId: session.id,
    url: session.url || '',
  }
}

/**
 * Create a billing portal session
 */
export async function createPortalSession(
  tenantId: string,
  returnUrl: string
): Promise<{ url: string }> {
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { stripeCustomerId: true },
  })

  if (!subscription?.stripeCustomerId) {
    throw new Error('No Stripe customer found for this tenant')
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: returnUrl,
  })

  return { url: session.url }
}

/**
 * Handle Stripe webhook events
 */
export async function handleWebhookEvent(
  body: string,
  signature: string
): Promise<{ received: boolean; type: string }> {
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    throw new Error(`Webhook signature verification failed: ${err}`)
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session)
      break

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object as Stripe.Subscription)
      break

    case 'customer.subscription.deleted':
      await handleSubscriptionCancelled(event.data.object as Stripe.Subscription)
      break

    case 'invoice.paid':
      await handleInvoicePaid(event.data.object as Stripe.Invoice)
      break

    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.Invoice)
      break

    default:
      console.log(`Unhandled event type: ${event.type}`)
  }

  return { received: true, type: event.type }
}

/**
 * Handle successful checkout
 */
async function handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
  const tenantId = session.metadata?.tenantId
  const planId = session.metadata?.planId as PlanId

  if (!tenantId || !planId) {
    console.error('Missing metadata in checkout session')
    return
  }

  // Subscription update will be handled by customer.subscription.updated event
  console.log(`Checkout completed for tenant ${tenantId}, plan ${planId}`)
}

/**
 * Handle subscription creation or update
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
  const tenantId = subscription.metadata?.tenantId
  const planId = (subscription.metadata?.planId as PlanId) || 'STARTER'

  if (!tenantId) {
    console.error('Missing tenantId in subscription metadata')
    return
  }

  const plan = getPlan(planId)

  // Update subscription in database
  await prisma.subscription.upsert({
    where: { tenantId },
    create: {
      tenantId,
      plan: planId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      stripePriceId: subscription.items.data[0]?.price.id,
      status: mapStripeStatus(subscription.status),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      // Set plan limits
      maxChannels: plan.maxChannels,
      maxMessages: plan.maxMessages,
      maxBots: plan.maxBots,
      maxUsers: plan.maxUsers,
      maxStorage: plan.maxStorage,
      hasAnalytics: plan.hasAnalytics,
      hasApiAccess: plan.hasApiAccess,
      hasPrioritySupport: plan.hasPrioritySupport,
      hasCustomBranding: plan.hasCustomBranding,
    },
    update: {
      plan: planId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0]?.price.id,
      status: mapStripeStatus(subscription.status),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      // Update plan limits
      maxChannels: plan.maxChannels,
      maxMessages: plan.maxMessages,
      maxBots: plan.maxBots,
      maxUsers: plan.maxUsers,
      maxStorage: plan.maxStorage,
      hasAnalytics: plan.hasAnalytics,
      hasApiAccess: plan.hasApiAccess,
      hasPrioritySupport: plan.hasPrioritySupport,
      hasCustomBranding: plan.hasCustomBranding,
    },
  })

  // Update tenant plan
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { plan: planId },
  })
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCancelled(subscription: Stripe.Subscription): Promise<void> {
  const tenantId = subscription.metadata?.tenantId

  if (!tenantId) {
    console.error('Missing tenantId in subscription metadata')
    return
  }

  // Downgrade to free plan
  const freePlan = getPlan('FREE')

  await prisma.subscription.update({
    where: { tenantId },
    data: {
      plan: 'FREE',
      status: 'CANCELLED',
      stripeSubscriptionId: null,
      stripePriceId: null,
      // Reset to free limits
      maxChannels: freePlan.maxChannels,
      maxMessages: freePlan.maxMessages,
      maxBots: freePlan.maxBots,
      maxUsers: freePlan.maxUsers,
      maxStorage: freePlan.maxStorage,
      hasAnalytics: false,
      hasApiAccess: false,
      hasPrioritySupport: false,
      hasCustomBranding: false,
    },
  })

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { plan: 'FREE' },
  })
}

/**
 * Handle paid invoice
 */
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string

  // Find tenant by customer ID
  const subscription = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
    select: { tenantId: true },
  })

  if (!subscription) {
    console.error('No subscription found for customer:', customerId)
    return
  }

  // Create invoice record
  await prisma.invoice.create({
    data: {
      tenantId: subscription.tenantId,
      stripeInvoiceId: invoice.id,
      stripePaymentIntentId: invoice.payment_intent as string,
      amount: (invoice.amount_paid || 0) / 100, // Convert from cents
      currency: invoice.currency.toUpperCase(),
      status: 'PAID',
      paidAt: new Date(),
      periodStart: new Date((invoice.period_start || 0) * 1000),
      periodEnd: new Date((invoice.period_end || 0) * 1000),
      invoiceUrl: invoice.hosted_invoice_url || undefined,
      description: invoice.description || `Fatura ${invoice.number}`,
    },
  })
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string

  // Find tenant by customer ID
  const subscription = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
    select: { tenantId: true },
  })

  if (!subscription) {
    console.error('No subscription found for customer:', customerId)
    return
  }

  // Update subscription status
  await prisma.subscription.update({
    where: { tenantId: subscription.tenantId },
    data: { status: 'PAST_DUE' },
  })

  // Create failed invoice record
  await prisma.invoice.create({
    data: {
      tenantId: subscription.tenantId,
      stripeInvoiceId: invoice.id,
      amount: (invoice.amount_due || 0) / 100,
      currency: invoice.currency.toUpperCase(),
      status: 'FAILED',
      periodStart: new Date((invoice.period_start || 0) * 1000),
      periodEnd: new Date((invoice.period_end || 0) * 1000),
      description: `Fatura ${invoice.number} - Pagamento falhou`,
    },
  })

  // TODO: Send notification to tenant about failed payment
}

/**
 * Get invoices for a tenant
 */
export async function getInvoices(
  tenantId: string,
  limit: number = 10
): Promise<Array<{
  id: string
  amount: number
  currency: string
  status: string
  paidAt: Date | null
  periodStart: Date
  periodEnd: Date
  invoiceUrl: string | null
}>> {
  const invoices = await prisma.invoice.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      paidAt: true,
      periodStart: true,
      periodEnd: true,
      invoiceUrl: true,
    },
  })

  return invoices.map(inv => ({
    ...inv,
    amount: Number(inv.amount),
  }))
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(
  tenantId: string,
  cancelImmediately: boolean = false
): Promise<void> {
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { stripeSubscriptionId: true },
  })

  if (!subscription?.stripeSubscriptionId) {
    throw new Error('No active subscription to cancel')
  }

  if (cancelImmediately) {
    await stripe.subscriptions.cancel(subscription.stripeSubscriptionId)
  } else {
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    })

    await prisma.subscription.update({
      where: { tenantId },
      data: { cancelAtPeriodEnd: true },
    })
  }
}

/**
 * Map Stripe subscription status to our status
 */
function mapStripeStatus(status: Stripe.Subscription.Status): 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'PAUSED' | 'TRIAL' {
  switch (status) {
    case 'active':
      return 'ACTIVE'
    case 'past_due':
      return 'PAST_DUE'
    case 'canceled':
    case 'unpaid':
      return 'CANCELLED'
    case 'paused':
      return 'PAUSED'
    case 'trialing':
      return 'TRIAL'
    default:
      return 'ACTIVE'
  }
}

export { stripe }
