/**
 * Plan definitions and limits
 * Centralized configuration for all billing plans
 */

export type PlanId = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE'

export interface PlanLimits {
  maxChannels: number      // grupos WhatsApp
  maxMessages: number      // mensagens por mês
  maxBots: number
  maxUsers: number
  maxStorage: number       // MB
  hasAnalytics: boolean
  hasApiAccess: boolean
  hasPrioritySupport: boolean
  hasCustomBranding: boolean
}

export interface PlanDetails extends PlanLimits {
  id: PlanId
  name: string
  description: string
  price: number            // R$/mês (0 = free)
  stripePriceId?: string
  popular?: boolean
  features: string[]
}

// Plan configurations
export const PLANS: Record<PlanId, PlanDetails> = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    description: 'Para começar e testar a plataforma',
    price: 0,
    maxChannels: 1,
    maxMessages: 500,
    maxBots: 1,
    maxUsers: 1,
    maxStorage: 100,
    hasAnalytics: false,
    hasApiAccess: false,
    hasPrioritySupport: false,
    hasCustomBranding: false,
    features: [
      '1 grupo WhatsApp',
      '500 mensagens/mês',
      '1 bot configurado',
      'Templates básicos',
      'Suporte por email',
    ],
  },
  STARTER: {
    id: 'STARTER',
    name: 'Starter',
    description: 'Para pequenos negócios',
    price: 49,
    stripePriceId: process.env.STRIPE_PRICE_STARTER,
    maxChannels: 5,
    maxMessages: 5000,
    maxBots: 3,
    maxUsers: 3,
    maxStorage: 500,
    hasAnalytics: false,
    hasApiAccess: false,
    hasPrioritySupport: false,
    hasCustomBranding: false,
    features: [
      '5 grupos WhatsApp',
      '5.000 mensagens/mês',
      '3 bots configurados',
      'Knowledge base (500 MB)',
      'Integrações básicas',
      'Suporte por chat',
    ],
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    description: 'Para empresas em crescimento',
    price: 149,
    stripePriceId: process.env.STRIPE_PRICE_PRO,
    popular: true,
    maxChannels: 20,
    maxMessages: 25000,
    maxBots: 10,
    maxUsers: 10,
    maxStorage: 2000,
    hasAnalytics: true,
    hasApiAccess: true,
    hasPrioritySupport: false,
    hasCustomBranding: false,
    features: [
      '20 grupos WhatsApp',
      '25.000 mensagens/mês',
      '10 bots configurados',
      'Knowledge base (2 GB)',
      'Analytics completo',
      'API access',
      'Todas integrações',
      'Suporte prioritário',
    ],
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'Para grandes operações',
    price: -1, // custom pricing
    maxChannels: -1, // unlimited
    maxMessages: -1, // unlimited
    maxBots: -1, // unlimited
    maxUsers: -1, // unlimited
    maxStorage: -1, // unlimited
    hasAnalytics: true,
    hasApiAccess: true,
    hasPrioritySupport: true,
    hasCustomBranding: true,
    features: [
      'Grupos ilimitados',
      'Mensagens ilimitadas',
      'Bots ilimitados',
      'Storage ilimitado',
      'SLA garantido',
      'Suporte dedicado',
      'White-label',
      'Onboarding personalizado',
      'Customizações sob demanda',
    ],
  },
}

// Get plan by ID
export function getPlan(planId: PlanId): PlanDetails {
  return PLANS[planId] || PLANS.FREE
}

// Check if a limit is unlimited (-1)
export function isUnlimited(value: number): boolean {
  return value === -1
}

// Format limit for display
export function formatLimit(value: number, singular: string, plural: string): string {
  if (isUnlimited(value)) return `${plural} ilimitados`
  return `${value} ${value === 1 ? singular : plural}`
}

// Get upgrade path
export function getUpgradePath(currentPlan: PlanId): PlanId | null {
  const order: PlanId[] = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE']
  const currentIndex = order.indexOf(currentPlan)
  if (currentIndex < order.length - 1) {
    return order[currentIndex + 1]
  }
  return null
}

// Get downgrade path
export function getDowngradePath(currentPlan: PlanId): PlanId | null {
  const order: PlanId[] = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE']
  const currentIndex = order.indexOf(currentPlan)
  if (currentIndex > 0) {
    return order[currentIndex - 1]
  }
  return null
}
