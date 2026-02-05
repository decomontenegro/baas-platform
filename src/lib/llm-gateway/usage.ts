/**
 * LLM Gateway - Usage Analytics & Aggregation Functions
 *
 * Provides comprehensive usage tracking, cost analysis, and analytics
 * for multi-tenant LLM consumption monitoring.
 */

import { prisma } from '@/lib/prisma'

// =============================================================================
// Types & Interfaces
// =============================================================================

export type UsagePeriod = 'day' | 'week' | 'month'

export interface UsageSummary {
  totalCost: number
  totalTokens: number
  totalRequests: number
  avgLatencyMs: number
  successRate: number
  inputTokens: number
  outputTokens: number
  topAgents: { id: string; name: string; cost: number; requests: number }[]
  topModels: { model: string; cost: number; requests: number; tokens: number }[]
  period: {
    start: Date
    end: Date
  }
  budget?: {
    monthlyLimit: number | null
    dailyLimit: number | null
    currentUsage: number
    percentUsed: number
    projectedMonthEnd: number
  }
}

export interface AgentUsage {
  agentId: string
  agentName: string
  agentRole: string | null
  agentAvatar: string | null
  totalCost: number
  totalTokens: number
  totalRequests: number
  inputTokens: number
  outputTokens: number
  avgLatencyMs: number
  successRate: number
  percentOfTotal: number
}

export interface ModelUsage {
  model: string
  totalCost: number
  totalTokens: number
  totalRequests: number
  inputTokens: number
  outputTokens: number
  avgLatencyMs: number
  successRate: number
  percentOfTotal: number
}

export interface ProviderUsage {
  providerId: string
  providerName: string
  providerType: string
  totalCost: number
  totalTokens: number
  totalRequests: number
  avgLatencyMs: number
  successRate: number
  percentOfTotal: number
}

export interface DailyUsage {
  date: string
  cost: number
  tokens: number
  requests: number
  inputTokens: number
  outputTokens: number
  avgLatencyMs: number | null
  successRate: number
}

export interface HourlyUsage {
  hour: string
  cost: number
  tokens: number
  requests: number
}

// =============================================================================
// Helper Functions
// =============================================================================

function getPeriodDates(period: UsagePeriod): { start: Date; end: Date } {
  const now = new Date()
  const end = new Date(now)
  let start: Date

  switch (period) {
    case 'day':
      start = new Date(now)
      start.setHours(0, 0, 0, 0)
      break
    case 'week':
      start = new Date(now)
      start.setDate(start.getDate() - 7)
      start.setHours(0, 0, 0, 0)
      break
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      start.setHours(0, 0, 0, 0)
      break
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1)
  }

  return { start, end }
}

function calculateProjectedMonthEnd(
  currentUsage: number,
  daysElapsed: number,
  daysInMonth: number
): number {
  if (daysElapsed === 0) return currentUsage
  const dailyAverage = currentUsage / daysElapsed
  return dailyAverage * daysInMonth
}

// =============================================================================
// Main Usage Functions
// =============================================================================

/**
 * Get comprehensive usage summary for a tenant
 */
export async function getUsageSummary(
  tenantId: string,
  period: UsagePeriod = 'month'
): Promise<UsageSummary> {
  const { start, end } = getPeriodDates(period)

  // Get tenant for budget info
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      monthlyBudget: true,
      dailyLimit: true,
    },
  })

  // Main aggregation
  const totals = await prisma.lLMUsage.aggregate({
    where: {
      tenantId,
      createdAt: { gte: start, lte: end },
    },
    _count: true,
    _sum: {
      totalTokens: true,
      inputTokens: true,
      outputTokens: true,
      cost: true,
      latencyMs: true,
    },
    _avg: {
      latencyMs: true,
    },
  })

  // Success count
  const successCount = await prisma.lLMUsage.count({
    where: {
      tenantId,
      createdAt: { gte: start, lte: end },
      success: true,
    },
  })

  // Top agents (with names from TenantAgent)
  const agentUsage = await prisma.lLMUsage.groupBy({
    by: ['agentId'],
    where: {
      tenantId,
      createdAt: { gte: start, lte: end },
      agentId: { not: null },
    },
    _count: true,
    _sum: { cost: true },
    orderBy: { _sum: { cost: 'desc' } },
    take: 5,
  })

  // Fetch agent names
  const agentIds = agentUsage.map((a) => a.agentId).filter(Boolean) as string[]
  const agents = await prisma.tenantAgent.findMany({
    where: { id: { in: agentIds } },
    select: { id: true, name: true },
  })
  const agentMap = new Map<string, string>(agents.map((a) => [a.id, a.name]))

  const topAgents = agentUsage.map((a) => ({
    id: a.agentId || 'unknown',
    name: agentMap.get(a.agentId || '') || 'Unknown Agent',
    cost: a._sum.cost || 0,
    requests: a._count,
  }))

  // Top models
  const modelUsage = await prisma.lLMUsage.groupBy({
    by: ['model'],
    where: {
      tenantId,
      createdAt: { gte: start, lte: end },
    },
    _count: true,
    _sum: { cost: true, totalTokens: true },
    orderBy: { _sum: { cost: 'desc' } },
    take: 5,
  })

  const topModels = modelUsage.map((m) => ({
    model: m.model,
    cost: m._sum.cost || 0,
    requests: m._count,
    tokens: m._sum.totalTokens || 0,
  }))

  // Calculate budget info
  let budget: UsageSummary['budget'] = undefined
  const currentUsage = totals._sum.cost || 0

  if (tenant?.monthlyBudget || tenant?.dailyLimit) {
    const now = new Date()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const daysElapsed = now.getDate()

    budget = {
      monthlyLimit: tenant.monthlyBudget,
      dailyLimit: tenant.dailyLimit,
      currentUsage,
      percentUsed: tenant.monthlyBudget ? (currentUsage / tenant.monthlyBudget) * 100 : 0,
      projectedMonthEnd: calculateProjectedMonthEnd(currentUsage, daysElapsed, daysInMonth),
    }
  }

  return {
    totalCost: totals._sum.cost || 0,
    totalTokens: totals._sum.totalTokens || 0,
    totalRequests: totals._count,
    avgLatencyMs: Math.round(totals._avg.latencyMs || 0),
    successRate: totals._count > 0 ? (successCount / totals._count) * 100 : 100,
    inputTokens: totals._sum.inputTokens || 0,
    outputTokens: totals._sum.outputTokens || 0,
    topAgents,
    topModels,
    period: { start, end },
    budget,
  }
}

/**
 * Get usage breakdown by agent
 */
export async function getUsageByAgent(
  tenantId: string,
  period: UsagePeriod = 'month'
): Promise<AgentUsage[]> {
  const { start, end } = getPeriodDates(period)

  // Get total for percentage calculation
  const totalUsage = await prisma.lLMUsage.aggregate({
    where: {
      tenantId,
      createdAt: { gte: start, lte: end },
    },
    _sum: { cost: true },
  })
  const totalCost = totalUsage._sum.cost || 1 // Avoid division by zero

  // Group by agent
  const agentUsage = await prisma.lLMUsage.groupBy({
    by: ['agentId'],
    where: {
      tenantId,
      createdAt: { gte: start, lte: end },
    },
    _count: true,
    _sum: {
      cost: true,
      totalTokens: true,
      inputTokens: true,
      outputTokens: true,
      latencyMs: true,
    },
    _avg: {
      latencyMs: true,
    },
    orderBy: { _sum: { cost: 'desc' } },
  })

  // Get success counts per agent
  const successCounts = await prisma.lLMUsage.groupBy({
    by: ['agentId'],
    where: {
      tenantId,
      createdAt: { gte: start, lte: end },
      success: true,
    },
    _count: true,
  })
  const successMap = new Map(successCounts.map((s) => [s.agentId, s._count]))

  // Fetch agent details
  const agentIds = agentUsage.map((a) => a.agentId).filter(Boolean) as string[]
  const agents = await prisma.tenantAgent.findMany({
    where: { id: { in: agentIds } },
    select: { id: true, name: true, role: true, avatar: true },
  })
  type AgentInfo = { id: string; name: string; role: string | null; avatar: string | null }
  const agentMap = new Map<string, AgentInfo>(agents.map((a) => [a.id, a]))

  return agentUsage.map((a) => {
    const agent = agentMap.get(a.agentId || '')
    const successfulRequests = successMap.get(a.agentId) || 0

    return {
      agentId: a.agentId || 'unknown',
      agentName: agent?.name || 'Unknown Agent',
      agentRole: agent?.role || null,
      agentAvatar: agent?.avatar || null,
      totalCost: a._sum.cost || 0,
      totalTokens: a._sum.totalTokens || 0,
      totalRequests: a._count,
      inputTokens: a._sum.inputTokens || 0,
      outputTokens: a._sum.outputTokens || 0,
      avgLatencyMs: Math.round(a._avg.latencyMs || 0),
      successRate: a._count > 0 ? (successfulRequests / a._count) * 100 : 100,
      percentOfTotal: ((a._sum.cost || 0) / totalCost) * 100,
    }
  })
}

/**
 * Get usage breakdown by model
 */
export async function getUsageByModel(
  tenantId: string,
  period: UsagePeriod = 'month'
): Promise<ModelUsage[]> {
  const { start, end } = getPeriodDates(period)

  // Get total for percentage calculation
  const totalUsage = await prisma.lLMUsage.aggregate({
    where: {
      tenantId,
      createdAt: { gte: start, lte: end },
    },
    _sum: { cost: true },
  })
  const totalCost = totalUsage._sum.cost || 1

  // Group by model
  const modelUsage = await prisma.lLMUsage.groupBy({
    by: ['model'],
    where: {
      tenantId,
      createdAt: { gte: start, lte: end },
    },
    _count: true,
    _sum: {
      cost: true,
      totalTokens: true,
      inputTokens: true,
      outputTokens: true,
    },
    _avg: {
      latencyMs: true,
    },
    orderBy: { _sum: { cost: 'desc' } },
  })

  // Get success counts per model
  const successCounts = await prisma.lLMUsage.groupBy({
    by: ['model'],
    where: {
      tenantId,
      createdAt: { gte: start, lte: end },
      success: true,
    },
    _count: true,
  })
  const successMap = new Map(successCounts.map((s) => [s.model, s._count]))

  return modelUsage.map((m) => {
    const successfulRequests = successMap.get(m.model) || 0

    return {
      model: m.model,
      totalCost: m._sum.cost || 0,
      totalTokens: m._sum.totalTokens || 0,
      totalRequests: m._count,
      inputTokens: m._sum.inputTokens || 0,
      outputTokens: m._sum.outputTokens || 0,
      avgLatencyMs: Math.round(m._avg.latencyMs || 0),
      successRate: m._count > 0 ? (successfulRequests / m._count) * 100 : 100,
      percentOfTotal: ((m._sum.cost || 0) / totalCost) * 100,
    }
  })
}

/**
 * Get usage breakdown by provider
 */
export async function getUsageByProvider(
  tenantId: string,
  period: UsagePeriod = 'month'
): Promise<ProviderUsage[]> {
  const { start, end } = getPeriodDates(period)

  // Get total for percentage calculation
  const totalUsage = await prisma.lLMUsage.aggregate({
    where: {
      tenantId,
      createdAt: { gte: start, lte: end },
    },
    _sum: { cost: true },
  })
  const totalCost = totalUsage._sum.cost || 1

  // Group by provider
  const providerUsage = await prisma.lLMUsage.groupBy({
    by: ['providerId'],
    where: {
      tenantId,
      createdAt: { gte: start, lte: end },
    },
    _count: true,
    _sum: {
      cost: true,
      totalTokens: true,
    },
    _avg: {
      latencyMs: true,
    },
    orderBy: { _sum: { cost: 'desc' } },
  })

  // Get success counts per provider
  const successCounts = await prisma.lLMUsage.groupBy({
    by: ['providerId'],
    where: {
      tenantId,
      createdAt: { gte: start, lte: end },
      success: true,
    },
    _count: true,
  })
  const successMap = new Map(successCounts.map((s) => [s.providerId, s._count]))

  // Fetch provider details
  const providerIds = providerUsage.map((p) => p.providerId)
  const providers = await prisma.lLMProvider.findMany({
    where: { id: { in: providerIds } },
    select: { id: true, name: true, type: true },
  })
  type ProviderInfo = { id: string; name: string; type: string }
  const providerMap = new Map<string, ProviderInfo>(providers.map((p) => [p.id, p]))

  return providerUsage.map((p) => {
    const provider = providerMap.get(p.providerId)
    const successfulRequests = successMap.get(p.providerId) || 0

    return {
      providerId: p.providerId,
      providerName: provider?.name || 'Unknown Provider',
      providerType: provider?.type || 'UNKNOWN',
      totalCost: p._sum.cost || 0,
      totalTokens: p._sum.totalTokens || 0,
      totalRequests: p._count,
      avgLatencyMs: Math.round(p._avg.latencyMs || 0),
      successRate: p._count > 0 ? (successfulRequests / p._count) * 100 : 100,
      percentOfTotal: ((p._sum.cost || 0) / totalCost) * 100,
    }
  })
}

/**
 * Get daily usage history for charts
 */
export async function getUsageHistory(
  tenantId: string,
  days: number = 30
): Promise<DailyUsage[]> {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)
  start.setHours(0, 0, 0, 0)

  // Using raw query for proper date grouping
  const dailyData = await prisma.$queryRaw<
    Array<{
      date: Date
      cost: number
      tokens: bigint
      requests: bigint
      input_tokens: bigint
      output_tokens: bigint
      avg_latency: number | null
      success_count: bigint
    }>
  >`
    SELECT 
      DATE("createdAt") as date,
      COALESCE(SUM(cost), 0) as cost,
      COALESCE(SUM("totalTokens"), 0) as tokens,
      COUNT(*) as requests,
      COALESCE(SUM("inputTokens"), 0) as input_tokens,
      COALESCE(SUM("outputTokens"), 0) as output_tokens,
      AVG("latencyMs") as avg_latency,
      SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as success_count
    FROM "LLMUsage"
    WHERE "tenantId" = ${tenantId}
      AND "createdAt" >= ${start}
      AND "createdAt" <= ${end}
    GROUP BY DATE("createdAt")
    ORDER BY date ASC
  `

  // Fill in missing days with zero values
  const result: DailyUsage[] = []
  type DailyDataRow = typeof dailyData[number]
  const dataMap = new Map<string, DailyDataRow>(
    dailyData.map((d) => [d.date.toISOString().split('T')[0], d])
  )

  for (let i = 0; i <= days; i++) {
    const date = new Date(start)
    date.setDate(date.getDate() + i)
    const dateStr = date.toISOString().split('T')[0]
    const dayData = dataMap.get(dateStr)

    if (dayData) {
      const requests = Number(dayData.requests)
      const successCount = Number(dayData.success_count)

      result.push({
        date: dateStr,
        cost: Number(dayData.cost),
        tokens: Number(dayData.tokens),
        requests,
        inputTokens: Number(dayData.input_tokens),
        outputTokens: Number(dayData.output_tokens),
        avgLatencyMs: dayData.avg_latency ? Math.round(dayData.avg_latency) : null,
        successRate: requests > 0 ? (successCount / requests) * 100 : 100,
      })
    } else {
      result.push({
        date: dateStr,
        cost: 0,
        tokens: 0,
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        avgLatencyMs: null,
        successRate: 100,
      })
    }
  }

  return result
}

/**
 * Get hourly usage for today (useful for real-time monitoring)
 */
export async function getHourlyUsageToday(tenantId: string): Promise<HourlyUsage[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const hourlyData = await prisma.$queryRaw<
    Array<{
      hour: number
      cost: number
      tokens: bigint
      requests: bigint
    }>
  >`
    SELECT 
      EXTRACT(HOUR FROM "createdAt") as hour,
      COALESCE(SUM(cost), 0) as cost,
      COALESCE(SUM("totalTokens"), 0) as tokens,
      COUNT(*) as requests
    FROM "LLMUsage"
    WHERE "tenantId" = ${tenantId}
      AND "createdAt" >= ${today}
    GROUP BY EXTRACT(HOUR FROM "createdAt")
    ORDER BY hour ASC
  `

  // Fill in all 24 hours
  const result: HourlyUsage[] = []
  type HourlyDataRow = typeof hourlyData[number]
  const dataMap = new Map<number, HourlyDataRow>(hourlyData.map((d) => [Number(d.hour), d]))

  const currentHour = new Date().getHours()
  for (let h = 0; h <= currentHour; h++) {
    const hourData = dataMap.get(h)
    const hourStr = `${h.toString().padStart(2, '0')}:00`

    if (hourData) {
      result.push({
        hour: hourStr,
        cost: Number(hourData.cost),
        tokens: Number(hourData.tokens),
        requests: Number(hourData.requests),
      })
    } else {
      result.push({
        hour: hourStr,
        cost: 0,
        tokens: 0,
        requests: 0,
      })
    }
  }

  return result
}

/**
 * Get current month's daily breakdown (for budget tracking)
 */
export async function getCurrentMonthUsage(tenantId: string): Promise<{
  daily: DailyUsage[]
  totalCost: number
  daysRemaining: number
  averageDailyCost: number
  projectedTotal: number
}> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysElapsed = now.getDate()
  const daysRemaining = daysInMonth - daysElapsed

  const daily = await getUsageHistory(tenantId, daysElapsed)
  const totalCost = daily.reduce((sum, d) => sum + d.cost, 0)
  const averageDailyCost = daysElapsed > 0 ? totalCost / daysElapsed : 0
  const projectedTotal = averageDailyCost * daysInMonth

  return {
    daily,
    totalCost,
    daysRemaining,
    averageDailyCost,
    projectedTotal,
  }
}

/**
 * Get real-time stats (last 5 minutes)
 */
export async function getRealTimeStats(tenantId: string): Promise<{
  requestsLast5Min: number
  tokensLast5Min: number
  costLast5Min: number
  errorCount: number
}> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

  const stats = await prisma.lLMUsage.aggregate({
    where: {
      tenantId,
      createdAt: { gte: fiveMinutesAgo },
    },
    _count: true,
    _sum: {
      totalTokens: true,
      cost: true,
    },
  })

  const errorCount = await prisma.lLMUsage.count({
    where: {
      tenantId,
      createdAt: { gte: fiveMinutesAgo },
      success: false,
    },
  })

  return {
    requestsLast5Min: stats._count,
    tokensLast5Min: stats._sum.totalTokens || 0,
    costLast5Min: stats._sum.cost || 0,
    errorCount,
  }
}
