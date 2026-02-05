import type {
  Personality,
  Feature,
  Specialist,
  AnalyticsOverview,
  UsageReport,
  BillingStatus,
} from '@/types/api'

// Mock Personalities (templates)
export const personalityTemplates: Personality[] = [
  {
    id: 'pers_template_support',
    name: 'Suporte ao Cliente',
    description: 'Personalidade focada em atendimento ao cliente, resolução de problemas e satisfação.',
    systemPrompt: 'Você é um assistente de suporte ao cliente amigável e eficiente. Ajude os usuários a resolver seus problemas de forma clara e empática. Sempre confirme que o problema foi resolvido antes de encerrar.',
    tone: 'professional',
    language: 'pt-BR',
    isTemplate: true,
    isCustom: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'pers_template_sales',
    name: 'Vendas Consultivas',
    description: 'Personalidade para vendas, focada em entender necessidades e apresentar soluções.',
    systemPrompt: 'Você é um consultor de vendas experiente. Faça perguntas para entender as necessidades do cliente, apresente soluções relevantes e ajude na tomada de decisão. Seja persuasivo mas não agressivo.',
    tone: 'friendly',
    language: 'pt-BR',
    isTemplate: true,
    isCustom: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'pers_template_tech',
    name: 'Suporte Técnico',
    description: 'Personalidade técnica para troubleshooting e documentação.',
    systemPrompt: 'Você é um especialista técnico. Forneça instruções precisas e detalhadas. Use terminologia técnica quando apropriado, mas explique conceitos complexos de forma acessível. Sempre inclua passos numerados em suas instruções.',
    tone: 'technical',
    language: 'pt-BR',
    isTemplate: true,
    isCustom: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
]

// Mock custom personalities storage (in-memory)
export const customPersonalities: Map<string, Personality> = new Map()

// Mock Features
export const features: Feature[] = [
  {
    id: 'feat_ai_chat',
    name: 'Chat com IA',
    key: 'ai_chat',
    description: 'Respostas automáticas usando inteligência artificial',
    category: 'ai',
    enabled: true,
    tier: 'free',
  },
  {
    id: 'feat_multi_channel',
    name: 'Multi-Canal',
    key: 'multi_channel',
    description: 'Conecte WhatsApp, Telegram, Discord e mais',
    category: 'integration',
    enabled: true,
    tier: 'pro',
  },
  {
    id: 'feat_analytics',
    name: 'Analytics Avançado',
    key: 'advanced_analytics',
    description: 'Métricas detalhadas e relatórios personalizados',
    category: 'analytics',
    enabled: false,
    tier: 'pro',
  },
  {
    id: 'feat_webhooks',
    name: 'Webhooks',
    key: 'webhooks',
    description: 'Integração via webhooks para eventos em tempo real',
    category: 'integration',
    enabled: true,
    tier: 'free',
  },
  {
    id: 'feat_custom_personality',
    name: 'Personalities Customizadas',
    key: 'custom_personalities',
    description: 'Crie e customize personalities para seu bot',
    category: 'ai',
    enabled: true,
    tier: 'pro',
  },
  {
    id: 'feat_specialists',
    name: 'Especialistas IA',
    key: 'ai_specialists',
    description: 'Especialistas configuráveis para diferentes domínios',
    category: 'ai',
    enabled: false,
    tier: 'enterprise',
  },
  {
    id: 'feat_automation',
    name: 'Automações',
    key: 'automations',
    description: 'Fluxos automatizados baseados em gatilhos',
    category: 'automation',
    enabled: false,
    tier: 'pro',
  },
  {
    id: 'feat_api_access',
    name: 'Acesso à API',
    key: 'api_access',
    description: 'Acesso completo à API REST',
    category: 'core',
    enabled: true,
    tier: 'free',
  },
]

// Mock feature states per org (in-memory)
export const featureStates: Map<string, Map<string, boolean>> = new Map()

// Mock Specialists (templates)
export const specialistTemplates: Specialist[] = [
  {
    id: 'spec_template_legal',
    name: 'Consultor Jurídico',
    description: 'Especialista em questões legais e compliance',
    expertise: ['contratos', 'compliance', 'LGPD', 'direito empresarial'],
    systemPrompt: 'Você é um consultor jurídico especializado. Forneça orientações gerais sobre questões legais, sempre ressaltando que não substitui um advogado. Cite legislação relevante quando aplicável.',
    model: 'claude-3-opus',
    maxTokens: 4096,
    temperature: 0.3,
    isTemplate: true,
    isCustom: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'spec_template_finance',
    name: 'Analista Financeiro',
    description: 'Especialista em finanças e investimentos',
    expertise: ['investimentos', 'análise financeira', 'planejamento', 'mercado'],
    systemPrompt: 'Você é um analista financeiro experiente. Ajude com análises, planejamento financeiro e educação sobre investimentos. Sempre mencione que não é uma recomendação de investimento específica.',
    model: 'claude-3-sonnet',
    maxTokens: 2048,
    temperature: 0.5,
    isTemplate: true,
    isCustom: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'spec_template_hr',
    name: 'Consultor de RH',
    description: 'Especialista em recursos humanos e gestão de pessoas',
    expertise: ['recrutamento', 'gestão de pessoas', 'cultura', 'treinamento'],
    systemPrompt: 'Você é um consultor de RH experiente. Ajude com questões de gestão de pessoas, recrutamento, cultura organizacional e desenvolvimento profissional.',
    model: 'claude-3-sonnet',
    maxTokens: 2048,
    temperature: 0.6,
    isTemplate: true,
    isCustom: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
]

// Mock custom specialists storage (in-memory)
export const customSpecialists: Map<string, Specialist> = new Map()

// Mock Analytics Overview
export function getMockAnalyticsOverview(): AnalyticsOverview {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  return {
    period: {
      start: thirtyDaysAgo,
      end: now,
    },
    messages: {
      total: 15420,
      incoming: 8234,
      outgoing: 7186,
      growth: 12.5,
    },
    channels: {
      total: 5,
      active: 4,
      byType: {
        whatsapp: 2,
        telegram: 1,
        discord: 1,
        web: 1,
      },
    },
    costs: {
      total: 145.80,
      breakdown: {
        ai: 98.50,
        messaging: 32.30,
        storage: 15.00,
      },
      currency: 'USD',
    },
    performance: {
      avgResponseTime: 1.2,
      successRate: 98.5,
      errorRate: 1.5,
    },
  }
}

// Mock Usage Report
export function getMockUsageReport(start: Date, end: Date, granularity: 'hour' | 'day' | 'week' | 'month' = 'day'): UsageReport {
  const metrics = []
  const current = new Date(start)

  while (current <= end) {
    metrics.push({
      date: current.toISOString().split('T')[0],
      messages: Math.floor(Math.random() * 500) + 100,
      tokensUsed: Math.floor(Math.random() * 50000) + 10000,
      apiCalls: Math.floor(Math.random() * 200) + 50,
      cost: parseFloat((Math.random() * 10 + 2).toFixed(2)),
    })

    if (granularity === 'hour') {
      current.setHours(current.getHours() + 1)
    } else if (granularity === 'day') {
      current.setDate(current.getDate() + 1)
    } else if (granularity === 'week') {
      current.setDate(current.getDate() + 7)
    } else {
      current.setMonth(current.getMonth() + 1)
    }
  }

  const totals = metrics.reduce(
    (acc, m) => ({
      messages: acc.messages + m.messages,
      tokensUsed: acc.tokensUsed + m.tokensUsed,
      apiCalls: acc.apiCalls + m.apiCalls,
      cost: acc.cost + m.cost,
    }),
    { messages: 0, tokensUsed: 0, apiCalls: 0, cost: 0 }
  )

  return {
    period: { start, end, granularity },
    metrics,
    totals: {
      ...totals,
      cost: parseFloat(totals.cost.toFixed(2)),
    },
    topChannels: [
      { channelId: 'ch_wa_1', channelName: 'WhatsApp Principal', messages: 5420, percentage: 45 },
      { channelId: 'ch_tg_1', channelName: 'Telegram Suporte', messages: 3200, percentage: 27 },
      { channelId: 'ch_dc_1', channelName: 'Discord Comunidade', messages: 2100, percentage: 18 },
      { channelId: 'ch_web_1', channelName: 'Chat Web', messages: 1200, percentage: 10 },
    ],
    topPersonalities: [
      { personalityId: 'pers_template_support', personalityName: 'Suporte ao Cliente', uses: 8500, percentage: 55 },
      { personalityId: 'pers_template_sales', personalityName: 'Vendas Consultivas', uses: 4200, percentage: 27 },
      { personalityId: 'pers_template_tech', personalityName: 'Suporte Técnico', uses: 2720, percentage: 18 },
    ],
  }
}

// Mock Billing Status
export function getMockBillingStatus(): BillingStatus {
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  return {
    plan: {
      id: 'plan_pro_monthly',
      name: 'Pro',
      tier: 'pro',
      price: 49.00,
      billingCycle: 'monthly',
    },
    credits: {
      total: 100000,
      used: 67500,
      remaining: 32500,
      resetDate,
    },
    usage: {
      currentPeriod: {
        start: periodStart,
        end: periodEnd,
      },
      messages: {
        used: 15420,
        limit: 50000,
      },
      aiTokens: {
        used: 2450000,
        limit: 5000000,
      },
      storage: {
        usedBytes: 1073741824, // 1 GB
        limitBytes: 10737418240, // 10 GB
      },
    },
    nextInvoice: {
      date: resetDate,
      amount: 49.00,
      currency: 'USD',
    },
  }
}
