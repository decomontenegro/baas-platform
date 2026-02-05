// API Types for BaaS Dashboard

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Personalities
export interface Personality {
  id: string
  name: string
  description: string
  systemPrompt: string
  tone: 'professional' | 'friendly' | 'casual' | 'formal' | 'technical'
  language: string
  isTemplate: boolean
  isCustom: boolean
  organizationId?: string
  createdAt: Date
  updatedAt: Date
  metadata?: Record<string, unknown>
}

export interface CreatePersonalityInput {
  name: string
  description: string
  systemPrompt: string
  tone: Personality['tone']
  language?: string
  metadata?: Record<string, unknown>
}

export interface UpdatePersonalityInput {
  name?: string
  description?: string
  systemPrompt?: string
  tone?: Personality['tone']
  language?: string
  metadata?: Record<string, unknown>
}

export interface PersonalityPreviewInput {
  message: string
  context?: string[]
}

export interface PersonalityPreviewResponse {
  response: string
  personality: Pick<Personality, 'id' | 'name' | 'tone'>
  tokensUsed: number
  latencyMs: number
}

// Features
export interface Feature {
  id: string
  name: string
  key: string
  description: string
  category: 'core' | 'ai' | 'integration' | 'analytics' | 'automation'
  enabled: boolean
  tier: 'free' | 'pro' | 'enterprise'
  config?: Record<string, unknown>
}

export interface FeatureUpdateInput {
  key: string
  enabled: boolean
  config?: Record<string, unknown>
}

// Specialists
export interface Specialist {
  id: string
  name: string
  description: string
  expertise: string[]
  systemPrompt: string
  model: string
  maxTokens: number
  temperature: number
  isTemplate: boolean
  isCustom: boolean
  organizationId?: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateSpecialistInput {
  name: string
  description: string
  expertise: string[]
  systemPrompt: string
  model?: string
  maxTokens?: number
  temperature?: number
}

// Analytics
export interface AnalyticsOverview {
  period: {
    start: Date
    end: Date
  }
  messages: {
    total: number
    incoming: number
    outgoing: number
    growth: number // percentage
  }
  channels: {
    total: number
    active: number
    byType: Record<string, number>
  }
  costs: {
    total: number
    breakdown: {
      ai: number
      messaging: number
      storage: number
    }
    currency: string
  }
  performance: {
    avgResponseTime: number
    successRate: number
    errorRate: number
  }
}

export interface UsageMetric {
  date: string
  messages: number
  tokensUsed: number
  apiCalls: number
  cost: number
}

export interface UsageReport {
  period: {
    start: Date
    end: Date
    granularity: 'hour' | 'day' | 'week' | 'month'
  }
  metrics: UsageMetric[]
  totals: {
    messages: number
    tokensUsed: number
    apiCalls: number
    cost: number
  }
  topChannels: Array<{
    channelId: string
    channelName: string
    messages: number
    percentage: number
  }>
  topPersonalities: Array<{
    personalityId: string
    personalityName: string
    uses: number
    percentage: number
  }>
}

// Billing
export interface BillingStatus {
  plan: {
    id: string
    name: string
    tier: 'free' | 'pro' | 'enterprise'
    price: number
    billingCycle: 'monthly' | 'yearly'
  }
  credits: {
    total: number
    used: number
    remaining: number
    resetDate: Date
  }
  usage: {
    currentPeriod: {
      start: Date
      end: Date
    }
    messages: {
      used: number
      limit: number
    }
    aiTokens: {
      used: number
      limit: number
    }
    storage: {
      usedBytes: number
      limitBytes: number
    }
  }
  nextInvoice?: {
    date: Date
    amount: number
    currency: string
  }
}
