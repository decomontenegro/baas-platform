export type CostMode = 'turbo' | 'intelligent' | 'economic'

export interface CostModeConfig {
  mode: CostMode
  modelRouting: {
    simple: string
    medium: string
    complex: string
  }
  rateLimits: {
    apiCallDelayMs: number
    searchDelayMs: number
    maxSearchesPerBatch: number
    batchCooldownMs: number
  }
  budgetAlerts: {
    warningThreshold: number
    dailyLimitUsd: number
    monthlyLimitUsd: number
  }
  optimizeSessionHistory: boolean
}

export const COST_MODE_PRESETS: Record<CostMode, CostModeConfig> = {
  turbo: {
    mode: 'turbo',
    modelRouting: {
      simple: 'anthropic/claude-opus-4',
      medium: 'anthropic/claude-opus-4',
      complex: 'anthropic/claude-opus-4',
    },
    rateLimits: {
      apiCallDelayMs: 0,
      searchDelayMs: 0,
      maxSearchesPerBatch: 0, // no limit
      batchCooldownMs: 0,
    },
    budgetAlerts: {
      warningThreshold: 0.9,
      dailyLimitUsd: 50,
      monthlyLimitUsd: 500,
    },
    optimizeSessionHistory: false,
  },
  intelligent: {
    mode: 'intelligent',
    modelRouting: {
      simple: 'anthropic/claude-3-haiku',
      medium: 'anthropic/claude-sonnet-4',
      complex: 'anthropic/claude-opus-4',
    },
    rateLimits: {
      apiCallDelayMs: 5000,
      searchDelayMs: 10000,
      maxSearchesPerBatch: 5,
      batchCooldownMs: 120000,
    },
    budgetAlerts: {
      warningThreshold: 0.75,
      dailyLimitUsd: 10,
      monthlyLimitUsd: 100,
    },
    optimizeSessionHistory: false, // NÃO mexe na memória
  },
  economic: {
    mode: 'economic',
    modelRouting: {
      simple: 'ollama/llama3',
      medium: 'anthropic/claude-3-haiku',
      complex: 'anthropic/claude-sonnet-4',
    },
    rateLimits: {
      apiCallDelayMs: 10000,
      searchDelayMs: 15000,
      maxSearchesPerBatch: 3,
      batchCooldownMs: 180000,
    },
    budgetAlerts: {
      warningThreshold: 0.5,
      dailyLimitUsd: 5,
      monthlyLimitUsd: 50,
    },
    optimizeSessionHistory: true, // comprime contexto
  },
}

export const COST_MODE_INFO: Record<CostMode, {
  name: string
  emoji: string
  description: string
  estimate: string
  warning?: string
}> = {
  turbo: {
    name: 'Turbo',
    emoji: '🚀',
    description: 'Máxima performance. Sempre usa o melhor modelo disponível.',
    estimate: '$50-200/mês',
  },
  intelligent: {
    name: 'Inteligente',
    emoji: '🧠',
    description: 'Otimiza custos automaticamente. Preserva memória completa.',
    estimate: '$10-50/mês',
  },
  economic: {
    name: 'Econômico',
    emoji: '💰',
    description: 'Máxima economia. Pode comprimir histórico de conversas.',
    estimate: '$5-20/mês',
    warning: '⚠️ Pode afetar a memória de longo prazo do agente.',
  },
}
