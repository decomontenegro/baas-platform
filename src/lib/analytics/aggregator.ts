/**
 * Analytics Aggregator
 * Aggregates raw events into daily/hourly stats
 */

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

/**
 * Aggregate events for a specific date into DailyStats
 */
export async function aggregateDailyStats(
  tenantId: string,
  date: Date,
  options?: { workspaceId?: string; channelId?: string }
): Promise<void> {
  const startOfDay = new Date(date)
  startOfDay.setUTCHours(0, 0, 0, 0)
  
  const endOfDay = new Date(startOfDay)
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1)

  // Build where clause
  const where: Prisma.AnalyticsEventWhereInput = {
    tenantId,
    timestamp: {
      gte: startOfDay,
      lt: endOfDay,
    },
  }
  
  if (options?.workspaceId) {
    where.workspaceId = options.workspaceId
  }
  if (options?.channelId) {
    where.channelId = options.channelId
  }

  // Get all events for the period
  const events = await prisma.analyticsEvent.findMany({
    where,
    select: {
      eventType: true,
      responseTimeMs: true,
      tokensIn: true,
      tokensOut: true,
      cost: true,
      timestamp: true,
      data: true,
    },
  })

  if (events.length === 0) {
    return // No events to aggregate
  }

  // Count by event type
  const counts = {
    messagesIn: 0,
    messagesOut: 0,
    conversationsStarted: 0,
    conversationsEnded: 0,
    handoffRequests: 0,
    handoffCompleted: 0,
    errorCount: 0,
    feedbackPositive: 0,
    feedbackNegative: 0,
  }

  // Collect response times for percentile calculation
  const responseTimes: number[] = []
  
  // Collect tokens and costs
  let totalTokensIn = 0
  let totalTokensOut = 0
  let totalCost = 0

  // Track unique users
  const uniqueUserIds = new Set<string>()

  // Track hourly message counts for peak hour
  const hourlyMessages: Record<number, number> = {}

  for (const event of events) {
    const hour = event.timestamp.getUTCHours()
    hourlyMessages[hour] = (hourlyMessages[hour] || 0) + 1

    // Extract userId from data if present
    const data = event.data as Record<string, unknown>
    if (data?.userId && typeof data.userId === 'string') {
      uniqueUserIds.add(data.userId)
    }

    switch (event.eventType) {
      case 'MESSAGE_IN':
        counts.messagesIn++
        break
      case 'MESSAGE_OUT':
        counts.messagesOut++
        if (event.responseTimeMs) {
          responseTimes.push(event.responseTimeMs)
        }
        if (event.tokensIn) totalTokensIn += event.tokensIn
        if (event.tokensOut) totalTokensOut += event.tokensOut
        if (event.cost) totalCost += Number(event.cost)
        break
      case 'CONVERSATION_START':
        counts.conversationsStarted++
        break
      case 'CONVERSATION_END':
        counts.conversationsEnded++
        break
      case 'HANDOFF_REQUESTED':
        counts.handoffRequests++
        break
      case 'HANDOFF_COMPLETED':
        counts.handoffCompleted++
        break
      case 'ERROR':
        counts.errorCount++
        break
      case 'FEEDBACK_POSITIVE':
        counts.feedbackPositive++
        break
      case 'FEEDBACK_NEGATIVE':
        counts.feedbackNegative++
        break
      case 'SPECIALIST_INVOKED':
        if (event.tokensIn) totalTokensIn += event.tokensIn
        if (event.tokensOut) totalTokensOut += event.tokensOut
        if (event.cost) totalCost += Number(event.cost)
        break
    }
  }

  // Calculate response time percentiles
  responseTimes.sort((a, b) => a - b)
  const avgResponseTimeMs = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : null
  const p50ResponseTimeMs = getPercentile(responseTimes, 50)
  const p95ResponseTimeMs = getPercentile(responseTimes, 95)
  const p99ResponseTimeMs = getPercentile(responseTimes, 99)

  // Find peak hour
  let peakHour: number | null = null
  let peakHourMessages: number | null = null
  for (const [hour, count] of Object.entries(hourlyMessages)) {
    if (peakHourMessages === null || count > peakHourMessages) {
      peakHour = parseInt(hour)
      peakHourMessages = count
    }
  }

  // Upsert daily stats
  // Note: For composite unique keys with nullable fields, we need to use the actual null value
  const whereKey = {
    tenantId,
    workspaceId: options?.workspaceId ?? null as string | null,
    channelId: options?.channelId ?? null as string | null,
    date: startOfDay,
  }
  
  await prisma.dailyStats.upsert({
    where: {
      tenantId_workspaceId_channelId_date: whereKey,
    },
    create: {
      tenantId,
      workspaceId: options?.workspaceId,
      channelId: options?.channelId,
      date: startOfDay,
      ...counts,
      avgResponseTimeMs,
      p50ResponseTimeMs,
      p95ResponseTimeMs,
      p99ResponseTimeMs,
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
      cost: totalCost,
      uniqueUsers: uniqueUserIds.size,
      peakHour,
      peakHourMessages,
    },
    update: {
      ...counts,
      avgResponseTimeMs,
      p50ResponseTimeMs,
      p95ResponseTimeMs,
      p99ResponseTimeMs,
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
      cost: totalCost,
      uniqueUsers: uniqueUserIds.size,
      peakHour,
      peakHourMessages,
      updatedAt: new Date(),
    },
  })
}

/**
 * Aggregate events for a specific hour into HourlyStats
 */
export async function aggregateHourlyStats(
  tenantId: string,
  hour: Date,
  options?: { workspaceId?: string; channelId?: string }
): Promise<void> {
  const startOfHour = new Date(hour)
  startOfHour.setUTCMinutes(0, 0, 0)
  
  const endOfHour = new Date(startOfHour)
  endOfHour.setUTCHours(endOfHour.getUTCHours() + 1)

  // Build where clause
  const where: Prisma.AnalyticsEventWhereInput = {
    tenantId,
    timestamp: {
      gte: startOfHour,
      lt: endOfHour,
    },
  }
  
  if (options?.workspaceId) {
    where.workspaceId = options.workspaceId
  }
  if (options?.channelId) {
    where.channelId = options.channelId
  }

  // Aggregate events
  const aggregation = await prisma.analyticsEvent.groupBy({
    by: ['eventType'],
    where,
    _count: true,
    _avg: {
      responseTimeMs: true,
    },
    _sum: {
      cost: true,
    },
  })

  let messagesIn = 0
  let messagesOut = 0
  let errorCount = 0
  let avgResponseTimeMs: number | null = null
  let totalCost = 0

  for (const row of aggregation) {
    switch (row.eventType) {
      case 'MESSAGE_IN':
        messagesIn = row._count
        break
      case 'MESSAGE_OUT':
        messagesOut = row._count
        avgResponseTimeMs = row._avg.responseTimeMs ? Math.round(row._avg.responseTimeMs) : null
        totalCost += Number(row._sum.cost ?? 0)
        break
      case 'ERROR':
        errorCount = row._count
        break
    }
  }

  if (messagesIn === 0 && messagesOut === 0 && errorCount === 0) {
    return // No significant events
  }

  const hourlyWhereKey = {
    tenantId,
    workspaceId: options?.workspaceId ?? null as string | null,
    channelId: options?.channelId ?? null as string | null,
    hour: startOfHour,
  }
  
  await prisma.hourlyStats.upsert({
    where: {
      tenantId_workspaceId_channelId_hour: hourlyWhereKey,
    },
    create: {
      tenantId,
      workspaceId: options?.workspaceId,
      channelId: options?.channelId,
      hour: startOfHour,
      messagesIn,
      messagesOut,
      errorCount,
      avgResponseTimeMs,
      cost: totalCost,
    },
    update: {
      messagesIn,
      messagesOut,
      errorCount,
      avgResponseTimeMs,
      cost: totalCost,
    },
  })
}

/**
 * Aggregate all tenants for yesterday
 * Typically run as a cron job at midnight
 */
export async function aggregateYesterdayForAllTenants(): Promise<void> {
  const yesterday = new Date()
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  yesterday.setUTCHours(0, 0, 0, 0)

  // Get all active tenants
  const tenants = await prisma.tenant.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    select: { id: true },
  })

  console.log(`[Analytics] Aggregating stats for ${tenants.length} tenants...`)

  for (const tenant of tenants) {
    try {
      // Get all channels for this tenant
      const channels = await prisma.channel.findMany({
        where: {
          workspace: {
            tenantId: tenant.id,
            deletedAt: null,
          },
          deletedAt: null,
        },
        select: { id: true, workspaceId: true },
      })

      // Aggregate per channel
      for (const channel of channels) {
        await aggregateDailyStats(tenant.id, yesterday, {
          workspaceId: channel.workspaceId,
          channelId: channel.id,
        })
      }

      // Aggregate tenant-level (no channel filter)
      await aggregateDailyStats(tenant.id, yesterday)

      console.log(`[Analytics] Completed aggregation for tenant ${tenant.id}`)
    } catch (error) {
      console.error(`[Analytics] Failed to aggregate for tenant ${tenant.id}:`, error)
    }
  }
}

/**
 * Clean up old raw events (older than retention period)
 * Default: 90 days
 */
export async function cleanupOldEvents(retentionDays: number = 90): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - retentionDays)

  const result = await prisma.analyticsEvent.deleteMany({
    where: {
      timestamp: {
        lt: cutoffDate,
      },
    },
  })

  console.log(`[Analytics] Cleaned up ${result.count} events older than ${retentionDays} days`)
  return result.count
}

/**
 * Clean up old hourly stats (older than 30 days)
 * Daily stats are kept longer
 */
export async function cleanupOldHourlyStats(retentionDays: number = 30): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - retentionDays)

  const result = await prisma.hourlyStats.deleteMany({
    where: {
      hour: {
        lt: cutoffDate,
      },
    },
  })

  console.log(`[Analytics] Cleaned up ${result.count} hourly stats older than ${retentionDays} days`)
  return result.count
}

// Helper function to calculate percentile
function getPercentile(sortedArray: number[], percentile: number): number | null {
  if (sortedArray.length === 0) return null
  
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1
  return sortedArray[Math.max(0, index)]
}
