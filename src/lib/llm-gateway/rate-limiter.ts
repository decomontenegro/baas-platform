/**
 * LLM Gateway - Rate Limiter
 * 
 * Controla o rate limiting por tenant, agent e provider.
 * Usa LLMRateLimitEntry para persistência de janelas de tempo.
 * 
 * @see /docs/LLM-GATEWAY.md#5-rate-limiting--circuit-breaker
 */

import { prisma } from '@/lib/prisma'

// ============================================
// Default Limits
// ============================================

export const DEFAULT_LIMITS = {
  tenant: {
    requestsPerMinute: 100,
    tokensPerMinute: 100_000,
    requestsPerDay: 5_000,
  },
  agent: {
    requestsPerMinute: 20,
    tokensPerMinute: 50_000,
  },
  provider: {
    maxConcurrency: 5,
    requestsPerMinute: 60,
  },
} as const

// ============================================
// Types
// ============================================

export interface RateLimitResult {
  allowed: boolean
  reason?: string
  retryAfter?: number // seconds
  remaining?: {
    requests: number
    tokens: number
  }
}

export interface QuotaInfo {
  daily: {
    used: number
    limit: number | null
    remaining: number | null
    percentUsed: number | null
  }
  monthly: {
    used: number
    limit: number | null
    remaining: number | null
    percentUsed: number | null
  }
  minuteWindow: {
    requests: number
    tokens: number
    requestsLimit: number
    tokensLimit: number
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Gera a chave para rate limit entry
 */
function getRateLimitKey(type: 'tenant' | 'agent' | 'provider', id: string): string {
  return `${type}:${id}`
}

/**
 * Retorna o início do dia atual (meia-noite UTC)
 */
function getDayStart(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/**
 * Retorna o início do mês atual
 */
function getMonthStart(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

/**
 * Retorna os segundos até meia-noite UTC
 */
function getSecondsUntilMidnight(): number {
  const now = new Date()
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return Math.ceil((tomorrow.getTime() - now.getTime()) / 1000)
}

/**
 * Retorna ou cria uma entrada de rate limit para a janela de minuto atual
 */
async function getOrCreateRateLimitEntry(
  key: string,
  windowDurationMs: number = 60_000
): Promise<{ requestCount: number; tokenCount: number; isNew: boolean }> {
  const now = new Date()
  const windowStart = new Date(Math.floor(now.getTime() / windowDurationMs) * windowDurationMs)
  const windowEnd = new Date(windowStart.getTime() + windowDurationMs)

  // Tentar encontrar entrada existente na janela atual
  const existing = await prisma.lLMRateLimitEntry.findUnique({
    where: { key },
  })

  // Se existe e está na janela atual, retorna
  if (existing && existing.windowStart.getTime() === windowStart.getTime()) {
    return {
      requestCount: existing.requestCount,
      tokenCount: existing.tokenCount,
      isNew: false,
    }
  }

  // Se existe mas é de uma janela antiga, atualiza
  if (existing) {
    await prisma.lLMRateLimitEntry.update({
      where: { key },
      data: {
        windowStart,
        windowEnd,
        requestCount: 0,
        tokenCount: 0,
        blocked: false,
        blockedUntil: null,
      },
    })
    return { requestCount: 0, tokenCount: 0, isNew: true }
  }

  // Criar nova entrada
  await prisma.lLMRateLimitEntry.create({
    data: {
      key,
      windowStart,
      windowEnd,
      requestCount: 0,
      tokenCount: 0,
    },
  })

  return { requestCount: 0, tokenCount: 0, isNew: true }
}

// ============================================
// Main Functions
// ============================================

/**
 * Verifica se uma requisição é permitida com base nos rate limits
 * 
 * @param tenantId - ID do tenant
 * @param agentId - ID do agente (opcional)
 * @returns RateLimitResult indicando se a requisição é permitida
 */
export async function checkRateLimit(
  tenantId: string,
  agentId?: string
): Promise<RateLimitResult> {
  // 1. Verificar budget diário do tenant
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      dailyLimit: true,
      monthlyBudget: true,
      llmSuspended: true,
    },
  })

  if (!tenant) {
    return {
      allowed: false,
      reason: 'Tenant not found',
    }
  }

  // 1a. Verificar se tenant está suspenso
  if (tenant.llmSuspended) {
    return {
      allowed: false,
      reason: 'LLM access suspended - budget exceeded',
      retryAfter: getSecondsUntilMidnight(),
    }
  }

  // 2. Verificar uso diário contra dailyLimit
  if (tenant.dailyLimit) {
    const dayStart = getDayStart()
    const dailyUsage = await prisma.lLMUsage.aggregate({
      where: {
        tenantId,
        createdAt: { gte: dayStart },
      },
      _sum: { cost: true },
    })

    const usedToday = dailyUsage._sum.cost ?? 0
    if (usedToday >= tenant.dailyLimit) {
      return {
        allowed: false,
        reason: `Daily budget limit exceeded ($${usedToday.toFixed(2)} / $${tenant.dailyLimit.toFixed(2)})`,
        retryAfter: getSecondsUntilMidnight(),
      }
    }
  }

  // 3. Verificar uso mensal contra monthlyBudget
  if (tenant.monthlyBudget) {
    const monthStart = getMonthStart()
    const monthlyUsage = await prisma.lLMUsage.aggregate({
      where: {
        tenantId,
        createdAt: { gte: monthStart },
      },
      _sum: { cost: true },
    })

    const usedThisMonth = monthlyUsage._sum.cost ?? 0
    if (usedThisMonth >= tenant.monthlyBudget) {
      // Calcular segundos até o próximo mês
      const now = new Date()
      const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
      const retryAfter = Math.ceil((nextMonth.getTime() - now.getTime()) / 1000)

      return {
        allowed: false,
        reason: `Monthly budget limit exceeded ($${usedThisMonth.toFixed(2)} / $${tenant.monthlyBudget.toFixed(2)})`,
        retryAfter,
      }
    }
  }

  // 4. Verificar rate limit por minuto do tenant
  const tenantKey = getRateLimitKey('tenant', tenantId)
  const tenantEntry = await getOrCreateRateLimitEntry(tenantKey)
  
  const tenantLimits = DEFAULT_LIMITS.tenant
  
  if (tenantEntry.requestCount >= tenantLimits.requestsPerMinute) {
    return {
      allowed: false,
      reason: `Tenant rate limit exceeded (${tenantEntry.requestCount}/${tenantLimits.requestsPerMinute} requests/min)`,
      retryAfter: 60,
      remaining: {
        requests: 0,
        tokens: Math.max(0, tenantLimits.tokensPerMinute - tenantEntry.tokenCount),
      },
    }
  }

  if (tenantEntry.tokenCount >= tenantLimits.tokensPerMinute) {
    return {
      allowed: false,
      reason: `Tenant token limit exceeded (${tenantEntry.tokenCount}/${tenantLimits.tokensPerMinute} tokens/min)`,
      retryAfter: 60,
      remaining: {
        requests: Math.max(0, tenantLimits.requestsPerMinute - tenantEntry.requestCount),
        tokens: 0,
      },
    }
  }

  // 5. Verificar rate limit do agente (se especificado)
  if (agentId) {
    const agentKey = getRateLimitKey('agent', agentId)
    const agentEntry = await getOrCreateRateLimitEntry(agentKey)
    
    const agentLimits = DEFAULT_LIMITS.agent
    
    if (agentEntry.requestCount >= agentLimits.requestsPerMinute) {
      return {
        allowed: false,
        reason: `Agent rate limit exceeded (${agentEntry.requestCount}/${agentLimits.requestsPerMinute} requests/min)`,
        retryAfter: 60,
        remaining: {
          requests: 0,
          tokens: Math.max(0, agentLimits.tokensPerMinute - agentEntry.tokenCount),
        },
      }
    }

    if (agentEntry.tokenCount >= agentLimits.tokensPerMinute) {
      return {
        allowed: false,
        reason: `Agent token limit exceeded (${agentEntry.tokenCount}/${agentLimits.tokensPerMinute} tokens/min)`,
        retryAfter: 60,
        remaining: {
          requests: Math.max(0, agentLimits.requestsPerMinute - agentEntry.requestCount),
          tokens: 0,
        },
      }
    }
  }

  // 6. Tudo OK - retornar remaining
  const remainingRequests = tenantLimits.requestsPerMinute - tenantEntry.requestCount - 1
  const remainingTokens = tenantLimits.tokensPerMinute - tenantEntry.tokenCount

  return {
    allowed: true,
    remaining: {
      requests: Math.max(0, remainingRequests),
      tokens: Math.max(0, remainingTokens),
    },
  }
}

/**
 * Incrementa os contadores de uso após uma requisição bem-sucedida
 * 
 * @param tenantId - ID do tenant
 * @param agentId - ID do agente (opcional)
 * @param tokens - Número de tokens consumidos
 */
export async function incrementUsage(
  tenantId: string,
  agentId: string | undefined,
  tokens: number
): Promise<void> {
  const now = new Date()
  const windowDurationMs = 60_000
  const windowStart = new Date(Math.floor(now.getTime() / windowDurationMs) * windowDurationMs)
  const windowEnd = new Date(windowStart.getTime() + windowDurationMs)

  // Incrementar contador do tenant
  const tenantKey = getRateLimitKey('tenant', tenantId)
  await prisma.lLMRateLimitEntry.upsert({
    where: { key: tenantKey },
    update: {
      requestCount: { increment: 1 },
      tokenCount: { increment: tokens },
      // Reset se janela mudou
      windowStart,
      windowEnd,
    },
    create: {
      key: tenantKey,
      requestCount: 1,
      tokenCount: tokens,
      windowStart,
      windowEnd,
    },
  })

  // Incrementar contador do agente (se especificado)
  if (agentId) {
    const agentKey = getRateLimitKey('agent', agentId)
    await prisma.lLMRateLimitEntry.upsert({
      where: { key: agentKey },
      update: {
        requestCount: { increment: 1 },
        tokenCount: { increment: tokens },
        windowStart,
        windowEnd,
      },
      create: {
        key: agentKey,
        requestCount: 1,
        tokenCount: tokens,
        windowStart,
        windowEnd,
      },
    })
  }
}

/**
 * Retorna informações sobre a quota restante de um tenant
 * 
 * @param tenantId - ID do tenant
 * @returns QuotaInfo com detalhes de uso diário, mensal e da janela de minuto
 */
export async function getRemainingQuota(tenantId: string): Promise<QuotaInfo> {
  // Buscar tenant com limites
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      dailyLimit: true,
      monthlyBudget: true,
    },
  })

  const dayStart = getDayStart()
  const monthStart = getMonthStart()

  // Agregar uso diário
  const dailyUsage = await prisma.lLMUsage.aggregate({
    where: {
      tenantId,
      createdAt: { gte: dayStart },
    },
    _sum: { cost: true },
  })

  // Agregar uso mensal
  const monthlyUsage = await prisma.lLMUsage.aggregate({
    where: {
      tenantId,
      createdAt: { gte: monthStart },
    },
    _sum: { cost: true },
  })

  // Buscar rate limit entry atual
  const tenantKey = getRateLimitKey('tenant', tenantId)
  const rateLimitEntry = await getOrCreateRateLimitEntry(tenantKey)

  const dailyUsed = dailyUsage._sum.cost ?? 0
  const monthlyUsed = monthlyUsage._sum.cost ?? 0
  const dailyLimit = tenant?.dailyLimit ?? null
  const monthlyLimit = tenant?.monthlyBudget ?? null

  return {
    daily: {
      used: dailyUsed,
      limit: dailyLimit,
      remaining: dailyLimit ? Math.max(0, dailyLimit - dailyUsed) : null,
      percentUsed: dailyLimit ? (dailyUsed / dailyLimit) * 100 : null,
    },
    monthly: {
      used: monthlyUsed,
      limit: monthlyLimit,
      remaining: monthlyLimit ? Math.max(0, monthlyLimit - monthlyUsed) : null,
      percentUsed: monthlyLimit ? (monthlyUsed / monthlyLimit) * 100 : null,
    },
    minuteWindow: {
      requests: rateLimitEntry.requestCount,
      tokens: rateLimitEntry.tokenCount,
      requestsLimit: DEFAULT_LIMITS.tenant.requestsPerMinute,
      tokensLimit: DEFAULT_LIMITS.tenant.tokensPerMinute,
    },
  }
}

/**
 * Verifica se um provider está no limite de capacidade
 * 
 * @param providerId - ID do provider
 * @returns true se o provider está no limite de concorrência ou rate limit
 */
export async function isProviderAtCapacity(providerId: string): Promise<boolean> {
  // Buscar provider com seus limites
  const provider = await prisma.lLMProvider.findUnique({
    where: { id: providerId },
    select: {
      rateLimit: true,
      concurrency: true,
      status: true,
    },
  })

  if (!provider) {
    return true // Provider não existe, considerar como "at capacity"
  }

  // Se provider não está ACTIVE ou DEGRADED, está indisponível
  if (provider.status !== 'ACTIVE' && provider.status !== 'DEGRADED') {
    return true
  }

  // Verificar rate limit do provider
  const providerKey = getRateLimitKey('provider', providerId)
  const entry = await getOrCreateRateLimitEntry(providerKey)

  const providerRateLimit = provider.rateLimit || DEFAULT_LIMITS.provider.requestsPerMinute
  
  if (entry.requestCount >= providerRateLimit) {
    return true
  }

  // Verificar concorrência atual (requests nos últimos 30 segundos como proxy)
  const thirtySecondsAgo = new Date(Date.now() - 30_000)
  const recentRequests = await prisma.lLMUsage.count({
    where: {
      providerId,
      createdAt: { gte: thirtySecondsAgo },
      success: true,
    },
  })

  const maxConcurrency = provider.concurrency || DEFAULT_LIMITS.provider.maxConcurrency
  
  // Se tem muitos requests recentes, considerar como potencialmente em alta carga
  if (recentRequests >= maxConcurrency * 2) {
    return true
  }

  return false
}

/**
 * Incrementa o contador de requests do provider
 * Usado pelo router ao enviar requisição
 * 
 * @param providerId - ID do provider
 */
export async function incrementProviderUsage(providerId: string): Promise<void> {
  const now = new Date()
  const windowDurationMs = 60_000
  const windowStart = new Date(Math.floor(now.getTime() / windowDurationMs) * windowDurationMs)
  const windowEnd = new Date(windowStart.getTime() + windowDurationMs)

  const providerKey = getRateLimitKey('provider', providerId)
  
  await prisma.lLMRateLimitEntry.upsert({
    where: { key: providerKey },
    update: {
      requestCount: { increment: 1 },
      windowStart,
      windowEnd,
    },
    create: {
      key: providerKey,
      requestCount: 1,
      tokenCount: 0,
      windowStart,
      windowEnd,
    },
  })
}

/**
 * Limpa entradas de rate limit expiradas
 * Deve ser chamado periodicamente (cron job ou background task)
 * 
 * @returns Número de entradas removidas
 */
export async function cleanupExpiredEntries(): Promise<number> {
  const now = new Date()
  
  // Deletar entradas com windowEnd no passado (mais de 5 minutos atrás para segurança)
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60_000)
  
  const result = await prisma.lLMRateLimitEntry.deleteMany({
    where: {
      windowEnd: { lt: fiveMinutesAgo },
    },
  })

  return result.count
}

/**
 * Reseta os contadores de rate limit para um tenant
 * Útil para desbloqueio manual por admin
 * 
 * @param tenantId - ID do tenant
 */
export async function resetTenantRateLimit(tenantId: string): Promise<void> {
  await prisma.lLMRateLimitEntry.deleteMany({
    where: {
      key: { startsWith: `tenant:${tenantId}` },
    },
  })

  // Também desbloquear se estava suspenso
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { llmSuspended: false },
  })
}

/**
 * Verifica e atualiza status de suspensão do tenant baseado no uso
 * Chamado após cada requisição ou periodicamente
 * 
 * @param tenantId - ID do tenant
 * @returns true se o tenant foi suspenso
 */
export async function checkAndUpdateSuspension(tenantId: string): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      dailyLimit: true,
      monthlyBudget: true,
      llmSuspended: true,
    },
  })

  if (!tenant) return false
  if (tenant.llmSuspended) return true

  // Verificar se excedeu budget mensal
  if (tenant.monthlyBudget) {
    const monthStart = getMonthStart()
    const monthlyUsage = await prisma.lLMUsage.aggregate({
      where: {
        tenantId,
        createdAt: { gte: monthStart },
      },
      _sum: { cost: true },
    })

    if ((monthlyUsage._sum.cost ?? 0) >= tenant.monthlyBudget) {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { llmSuspended: true },
      })
      return true
    }
  }

  return false
}

// ============================================
// In-Memory State (for concurrency tracking)
// ============================================

// Track active requests per provider (for concurrency limiting)
const activeRequestsByProvider = new Map<string, number>()

/**
 * Incrementa o contador de requisições ativas para um provider
 * Usado para controle de concorrência em tempo real
 * 
 * @param providerId - ID do provider
 */
export function incrementActiveRequests(providerId: string): void {
  const current = activeRequestsByProvider.get(providerId) || 0
  activeRequestsByProvider.set(providerId, current + 1)
}

/**
 * Decrementa o contador de requisições ativas para um provider
 * Chamar sempre no finally do request
 * 
 * @param providerId - ID do provider
 */
export function decrementActiveRequests(providerId: string): void {
  const current = activeRequestsByProvider.get(providerId) || 0
  activeRequestsByProvider.set(providerId, Math.max(0, current - 1))
}

/**
 * Retorna o número de requisições ativas para um provider
 * 
 * @param providerId - ID do provider
 * @returns Número de requisições ativas
 */
export function getActiveRequestCount(providerId: string): number {
  return activeRequestsByProvider.get(providerId) || 0
}

/**
 * Verifica se um provider tem capacidade para mais requisições
 * Wrapper para isProviderAtCapacity com verificação de concorrência em memória
 * 
 * @param providerId - ID do provider
 * @returns true se o provider pode aceitar mais requisições
 */
export async function checkProviderCapacity(providerId: string): Promise<boolean> {
  // Verificar concorrência em memória
  const activeCount = getActiveRequestCount(providerId)
  if (activeCount >= DEFAULT_LIMITS.provider.maxConcurrency) {
    return false
  }

  // Verificar via banco de dados
  const atCapacity = await isProviderAtCapacity(providerId)
  return !atCapacity
}

/**
 * Verifica rate limit com persistência no banco de dados
 * Alias para checkRateLimit para compatibilidade com o index
 * 
 * @param tenantId - ID do tenant
 * @param agentId - ID do agente (opcional)
 * @returns RateLimitResult
 */
export async function checkRateLimitPersistent(
  tenantId: string,
  agentId?: string
): Promise<RateLimitResult> {
  return checkRateLimit(tenantId, agentId)
}

/**
 * Atualiza o contador de tokens para um rate limit entry
 * Usado após receber resposta completa com contagem exata de tokens
 * 
 * @param tenantId - ID do tenant
 * @param agentId - ID do agente (opcional)
 * @param tokens - Número de tokens a adicionar
 */
export async function updateTokenCount(
  tenantId: string,
  agentId: string | undefined,
  tokens: number
): Promise<void> {
  const now = new Date()
  const windowDurationMs = 60_000
  const windowStart = new Date(Math.floor(now.getTime() / windowDurationMs) * windowDurationMs)
  const windowEnd = new Date(windowStart.getTime() + windowDurationMs)

  // Atualizar contador do tenant
  const tenantKey = getRateLimitKey('tenant', tenantId)
  await prisma.lLMRateLimitEntry.upsert({
    where: { key: tenantKey },
    update: {
      tokenCount: { increment: tokens },
    },
    create: {
      key: tenantKey,
      requestCount: 0,
      tokenCount: tokens,
      windowStart,
      windowEnd,
    },
  })

  // Atualizar contador do agente (se especificado)
  if (agentId) {
    const agentKey = getRateLimitKey('agent', agentId)
    await prisma.lLMRateLimitEntry.upsert({
      where: { key: agentKey },
      update: {
        tokenCount: { increment: tokens },
      },
      create: {
        key: agentKey,
        requestCount: 0,
        tokenCount: tokens,
        windowStart,
        windowEnd,
      },
    })
  }
}

/**
 * Retorna configuração de rate limit para um tenant
 * Combina limites default com customizações do tenant
 * 
 * @param tenantId - ID do tenant
 * @returns Configuração de rate limit
 */
export async function getTenantRateLimitConfig(tenantId: string): Promise<{
  requestsPerMinute: number
  tokensPerMinute: number
  requestsPerDay: number
  dailyBudget: number | null
  monthlyBudget: number | null
}> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      dailyLimit: true,
      monthlyBudget: true,
      settings: true,
    },
  })

  // Tentar extrair limites customizados de settings
  const settings = (tenant?.settings as Record<string, unknown>) || {}
  const rateLimits = (settings.rateLimits as Record<string, number>) || {}

  return {
    requestsPerMinute: rateLimits.requestsPerMinute || DEFAULT_LIMITS.tenant.requestsPerMinute,
    tokensPerMinute: rateLimits.tokensPerMinute || DEFAULT_LIMITS.tenant.tokensPerMinute,
    requestsPerDay: rateLimits.requestsPerDay || DEFAULT_LIMITS.tenant.requestsPerDay,
    dailyBudget: tenant?.dailyLimit ?? null,
    monthlyBudget: tenant?.monthlyBudget ?? null,
  }
}
