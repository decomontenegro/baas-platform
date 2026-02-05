/**
 * Analytics Calculator
 * Calculates derived metrics from aggregated stats
 */

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export interface OverviewMetrics {
  period: { start: Date; end: Date }
  messages: {
    total: number
    incoming: number
    outgoing: number
    growth: number // percentage vs previous period
  }
  conversations: {
    started: number
    ended: number
    ongoing: number
  }
  channels: {
    total: number
    active: number
    byType: Record<string, number>
  }
  performance: {
    avgResponseTimeMs: number | null
    p50ResponseTimeMs: number | null
    p95ResponseTimeMs: number | null
    p99ResponseTimeMs: number | null
    resolutionRate: number // % resolved without handoff
    errorRate: number
  }
  costs: {
    total: number
    tokensIn: number
    tokensOut: number
    currency: string
    perMessage: number | null
  }
  satisfaction: {
    positive: number
    negative: number
    score: number | null // 0-100
  }
  uniqueUsers: number
}

export interface TrendData {
  date: string
  messagesIn: number
  messagesOut: number
  cost: number
  avgResponseTimeMs: number | null
  uniqueUsers: number
}

export interface ChannelBreakdown {
  channelId: string
  channelName: string
  channelType: string
  messagesIn: number
  messagesOut: number
  cost: number
  avgResponseTimeMs: number | null
  percentage: number
}

export interface PeakHoursData {
  hour: number
  messages: number
  label: string
}

export interface CostBreakdown {
  byChannel: Array<{ name: string; cost: number; percentage: number }>
  byModel: Array<{ model: string; tokensIn: number; tokensOut: number; cost: number }>
  estimatedSavings: number
}

const HUMAN_COST_PER_MESSAGE = 2.50 // Estimated cost of human support per message (BRL)

/**
 * Get overview metrics for a tenant
 */
export async function getOverviewMetrics(
  tenantId: string,
  start: Date,
  end: Date
): Promise<OverviewMetrics> {
  // Get daily stats for the period
  const stats = await prisma.dailyStats.findMany({
    where: {
      tenantId,
      date: { gte: start, lte: end },
      channelId: null, // Tenant-level stats only
    },
  })

  // Calculate totals
  const totals = stats.reduce(
    (acc, s) => ({
      messagesIn: acc.messagesIn + s.messagesIn,
      messagesOut: acc.messagesOut + s.messagesOut,
      conversationsStarted: acc.conversationsStarted + s.conversationsStarted,
      conversationsEnded: acc.conversationsEnded + s.conversationsEnded,
      handoffRequests: acc.handoffRequests + s.handoffRequests,
      errorCount: acc.errorCount + s.errorCount,
      feedbackPositive: acc.feedbackPositive + s.feedbackPositive,
      feedbackNegative: acc.feedbackNegative + s.feedbackNegative,
      tokensIn: acc.tokensIn + s.tokensIn,
      tokensOut: acc.tokensOut + s.tokensOut,
      cost: acc.cost + Number(s.cost),
      uniqueUsers: acc.uniqueUsers + s.uniqueUsers,
    }),
    {
      messagesIn: 0,
      messagesOut: 0,
      conversationsStarted: 0,
      conversationsEnded: 0,
      handoffRequests: 0,
      errorCount: 0,
      feedbackPositive: 0,
      feedbackNegative: 0,
      tokensIn: 0,
      tokensOut: 0,
      cost: 0,
      uniqueUsers: 0,
    }
  )

  // Calculate weighted average response times
  const responseTimes = stats.filter((s) => s.avgResponseTimeMs !== null)
  const avgResponseTimeMs = responseTimes.length > 0
    ? Math.round(
        responseTimes.reduce((sum, s) => sum + (s.avgResponseTimeMs ?? 0) * s.messagesOut, 0) /
        responseTimes.reduce((sum, s) => sum + s.messagesOut, 0)
      )
    : null

  // Get percentiles from the most recent day with data
  const latestStats = stats.filter((s) => s.p50ResponseTimeMs !== null).sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  )[0]

  // Calculate previous period for growth comparison
  const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const previousStart = new Date(start)
  previousStart.setDate(previousStart.getDate() - periodDays)
  const previousEnd = new Date(start)
  previousEnd.setDate(previousEnd.getDate() - 1)

  const previousStats = await prisma.dailyStats.findMany({
    where: {
      tenantId,
      date: { gte: previousStart, lte: previousEnd },
      channelId: null,
    },
  })

  const previousTotal = previousStats.reduce((sum, s) => sum + s.messagesIn + s.messagesOut, 0)
  const currentTotal = totals.messagesIn + totals.messagesOut
  const growth = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0

  // Get channel stats
  const channels = await prisma.channel.findMany({
    where: {
      workspace: { tenantId, deletedAt: null },
      deletedAt: null,
    },
    select: { id: true, type: true, status: true },
  })

  const channelsByType: Record<string, number> = {}
  let activeChannels = 0
  for (const ch of channels) {
    channelsByType[ch.type] = (channelsByType[ch.type] || 0) + 1
    if (ch.status === 'CONNECTED') activeChannels++
  }

  // Calculate derived metrics
  const totalMessages = totals.messagesIn + totals.messagesOut
  const totalConversations = totals.conversationsStarted
  const resolutionRate = totalConversations > 0
    ? ((totalConversations - totals.handoffRequests) / totalConversations) * 100
    : 100
  const errorRate = totalMessages > 0
    ? (totals.errorCount / totalMessages) * 100
    : 0
  const totalFeedback = totals.feedbackPositive + totals.feedbackNegative
  const satisfactionScore = totalFeedback > 0
    ? (totals.feedbackPositive / totalFeedback) * 100
    : null

  return {
    period: { start, end },
    messages: {
      total: totalMessages,
      incoming: totals.messagesIn,
      outgoing: totals.messagesOut,
      growth: Math.round(growth * 10) / 10,
    },
    conversations: {
      started: totals.conversationsStarted,
      ended: totals.conversationsEnded,
      ongoing: totals.conversationsStarted - totals.conversationsEnded,
    },
    channels: {
      total: channels.length,
      active: activeChannels,
      byType: channelsByType,
    },
    performance: {
      avgResponseTimeMs,
      p50ResponseTimeMs: latestStats?.p50ResponseTimeMs ?? null,
      p95ResponseTimeMs: latestStats?.p95ResponseTimeMs ?? null,
      p99ResponseTimeMs: latestStats?.p99ResponseTimeMs ?? null,
      resolutionRate: Math.round(resolutionRate * 10) / 10,
      errorRate: Math.round(errorRate * 100) / 100,
    },
    costs: {
      total: Math.round(totals.cost * 100) / 100,
      tokensIn: totals.tokensIn,
      tokensOut: totals.tokensOut,
      currency: 'USD',
      perMessage: totalMessages > 0
        ? Math.round((totals.cost / totalMessages) * 10000) / 10000
        : null,
    },
    satisfaction: {
      positive: totals.feedbackPositive,
      negative: totals.feedbackNegative,
      score: satisfactionScore !== null ? Math.round(satisfactionScore) : null,
    },
    uniqueUsers: totals.uniqueUsers,
  }
}

/**
 * Get trend data for charts
 */
export async function getTrendData(
  tenantId: string,
  start: Date,
  end: Date,
  channelId?: string
): Promise<TrendData[]> {
  const where: Prisma.DailyStatsWhereInput = {
    tenantId,
    date: { gte: start, lte: end },
  }
  
  if (channelId) {
    where.channelId = channelId
  } else {
    where.channelId = null // Tenant-level only
  }

  const stats = await prisma.dailyStats.findMany({
    where,
    orderBy: { date: 'asc' },
  })

  return stats.map((s) => ({
    date: s.date.toISOString().split('T')[0],
    messagesIn: s.messagesIn,
    messagesOut: s.messagesOut,
    cost: Number(s.cost),
    avgResponseTimeMs: s.avgResponseTimeMs,
    uniqueUsers: s.uniqueUsers,
  }))
}

/**
 * Get channel breakdown
 */
export async function getChannelBreakdown(
  tenantId: string,
  start: Date,
  end: Date
): Promise<ChannelBreakdown[]> {
  // Get channel-level stats
  const stats = await prisma.dailyStats.findMany({
    where: {
      tenantId,
      date: { gte: start, lte: end },
      channelId: { not: null },
    },
  })

  // Get channel info
  const channelIds = [...new Set(stats.map((s) => s.channelId!).filter(Boolean))]
  const channels = await prisma.channel.findMany({
    where: { id: { in: channelIds } },
    select: { id: true, name: true, type: true },
  })
  const channelMap = new Map(channels.map((c) => [c.id, c]))

  // Aggregate by channel
  const channelStats = new Map<string, {
    messagesIn: number
    messagesOut: number
    cost: number
    responseTimes: number[]
    weights: number[]
  }>()

  for (const s of stats) {
    if (!s.channelId) continue
    const existing = channelStats.get(s.channelId) || {
      messagesIn: 0,
      messagesOut: 0,
      cost: 0,
      responseTimes: [],
      weights: [],
    }
    existing.messagesIn += s.messagesIn
    existing.messagesOut += s.messagesOut
    existing.cost += Number(s.cost)
    if (s.avgResponseTimeMs !== null) {
      existing.responseTimes.push(s.avgResponseTimeMs)
      existing.weights.push(s.messagesOut)
    }
    channelStats.set(s.channelId, existing)
  }

  // Calculate total for percentages
  let totalMessages = 0
  for (const cs of channelStats.values()) {
    totalMessages += cs.messagesIn + cs.messagesOut
  }

  // Build result
  const result: ChannelBreakdown[] = []
  for (const [channelId, cs] of channelStats.entries()) {
    const channel = channelMap.get(channelId)
    if (!channel) continue

    // Weighted average response time
    let avgResponseTimeMs: number | null = null
    if (cs.responseTimes.length > 0) {
      const totalWeight = cs.weights.reduce((a, b) => a + b, 0)
      if (totalWeight > 0) {
        avgResponseTimeMs = Math.round(
          cs.responseTimes.reduce((sum, rt, i) => sum + rt * cs.weights[i], 0) / totalWeight
        )
      }
    }

    result.push({
      channelId,
      channelName: channel.name,
      channelType: channel.type,
      messagesIn: cs.messagesIn,
      messagesOut: cs.messagesOut,
      cost: Math.round(cs.cost * 100) / 100,
      avgResponseTimeMs,
      percentage: totalMessages > 0
        ? Math.round(((cs.messagesIn + cs.messagesOut) / totalMessages) * 1000) / 10
        : 0,
    })
  }

  // Sort by total messages descending
  result.sort((a, b) => (b.messagesIn + b.messagesOut) - (a.messagesIn + a.messagesOut))

  return result
}

/**
 * Get peak hours distribution
 */
export async function getPeakHours(
  tenantId: string,
  start: Date,
  end: Date
): Promise<PeakHoursData[]> {
  // Use hourly stats for more granular data
  const hourlyStats = await prisma.hourlyStats.findMany({
    where: {
      tenantId,
      hour: { gte: start, lte: end },
      channelId: null, // Tenant level
    },
  })

  // Aggregate by hour of day
  const hourlyTotals: Record<number, number> = {}
  for (let h = 0; h < 24; h++) {
    hourlyTotals[h] = 0
  }

  for (const hs of hourlyStats) {
    const hour = hs.hour.getUTCHours()
    hourlyTotals[hour] += hs.messagesIn + hs.messagesOut
  }

  // Format result
  return Object.entries(hourlyTotals).map(([hour, messages]) => ({
    hour: parseInt(hour),
    messages,
    label: `${hour.padStart(2, '0')}:00`,
  }))
}

/**
 * Get cost breakdown
 */
export async function getCostBreakdown(
  tenantId: string,
  start: Date,
  end: Date
): Promise<CostBreakdown> {
  // Get channel breakdown for cost by channel
  const channelBreakdown = await getChannelBreakdown(tenantId, start, end)
  const totalCost = channelBreakdown.reduce((sum, c) => sum + c.cost, 0)
  
  const byChannel = channelBreakdown.map((c) => ({
    name: c.channelName,
    cost: c.cost,
    percentage: totalCost > 0 ? Math.round((c.cost / totalCost) * 1000) / 10 : 0,
  }))

  // Get model breakdown from raw events (last 7 days only for performance)
  const modelStart = new Date(end)
  modelStart.setDate(modelStart.getDate() - 7)
  
  const modelStats = await prisma.analyticsEvent.groupBy({
    by: ['model'],
    where: {
      tenantId,
      timestamp: { gte: modelStart, lte: end },
      model: { not: null },
    },
    _sum: {
      tokensIn: true,
      tokensOut: true,
      cost: true,
    },
  })

  const byModel = modelStats
    .filter((m) => m.model !== null)
    .map((m) => ({
      model: m.model!,
      tokensIn: m._sum.tokensIn ?? 0,
      tokensOut: m._sum.tokensOut ?? 0,
      cost: Number(m._sum.cost ?? 0),
    }))
    .sort((a, b) => b.cost - a.cost)

  // Calculate estimated savings vs human support
  const overview = await getOverviewMetrics(tenantId, start, end)
  const humanCost = overview.messages.outgoing * HUMAN_COST_PER_MESSAGE
  const estimatedSavings = Math.max(0, humanCost - overview.costs.total)

  return {
    byChannel,
    byModel,
    estimatedSavings: Math.round(estimatedSavings * 100) / 100,
  }
}

/**
 * Get usage summary (tokens, API calls, etc.)
 */
export async function getUsageSummary(
  tenantId: string,
  start: Date,
  end: Date
): Promise<{
  totalTokens: number
  tokensIn: number
  tokensOut: number
  totalCost: number
  avgCostPerDay: number
  projectedMonthlyCost: number
}> {
  const overview = await getOverviewMetrics(tenantId, start, end)
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  const avgCostPerDay = overview.costs.total / days
  const projectedMonthlyCost = avgCostPerDay * 30

  return {
    totalTokens: overview.costs.tokensIn + overview.costs.tokensOut,
    tokensIn: overview.costs.tokensIn,
    tokensOut: overview.costs.tokensOut,
    totalCost: overview.costs.total,
    avgCostPerDay: Math.round(avgCostPerDay * 100) / 100,
    projectedMonthlyCost: Math.round(projectedMonthlyCost * 100) / 100,
  }
}

/**
 * Export analytics data as CSV
 */
export async function exportAnalyticsCSV(
  tenantId: string,
  start: Date,
  end: Date
): Promise<string> {
  const stats = await prisma.dailyStats.findMany({
    where: {
      tenantId,
      date: { gte: start, lte: end },
    },
    orderBy: { date: 'asc' },
  })

  // CSV header
  const headers = [
    'date',
    'workspace_id',
    'channel_id',
    'messages_in',
    'messages_out',
    'conversations_started',
    'conversations_ended',
    'avg_response_time_ms',
    'p50_response_time_ms',
    'p95_response_time_ms',
    'handoff_requests',
    'handoff_completed',
    'error_count',
    'feedback_positive',
    'feedback_negative',
    'tokens_in',
    'tokens_out',
    'cost_usd',
    'unique_users',
    'peak_hour',
  ].join(',')

  // CSV rows
  const rows = stats.map((s) => [
    s.date.toISOString().split('T')[0],
    s.workspaceId || '',
    s.channelId || '',
    s.messagesIn,
    s.messagesOut,
    s.conversationsStarted,
    s.conversationsEnded,
    s.avgResponseTimeMs ?? '',
    s.p50ResponseTimeMs ?? '',
    s.p95ResponseTimeMs ?? '',
    s.handoffRequests,
    s.handoffCompleted,
    s.errorCount,
    s.feedbackPositive,
    s.feedbackNegative,
    s.tokensIn,
    s.tokensOut,
    Number(s.cost).toFixed(6),
    s.uniqueUsers,
    s.peakHour ?? '',
  ].join(','))

  return [headers, ...rows].join('\n')
}
