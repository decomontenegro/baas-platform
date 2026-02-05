#!/usr/bin/env npx tsx
/**
 * Analytics Aggregation Cron Job
 * 
 * Run daily at midnight to aggregate raw events into daily stats
 * and clean up old data.
 * 
 * Usage:
 *   npx tsx scripts/aggregate-analytics.ts
 * 
 * Cron example (midnight UTC):
 *   0 0 * * * cd /path/to/baas-app && npx tsx scripts/aggregate-analytics.ts >> /var/log/baas/analytics.log 2>&1
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Configuration
const RAW_EVENTS_RETENTION_DAYS = 90
const HOURLY_STATS_RETENTION_DAYS = 30

async function aggregateDailyStats(
  tenantId: string,
  date: Date,
  options?: { workspaceId?: string; channelId?: string }
): Promise<void> {
  const startOfDay = new Date(date)
  startOfDay.setUTCHours(0, 0, 0, 0)
  
  const endOfDay = new Date(startOfDay)
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1)

  // Build where clause
  const where: Record<string, unknown> = {
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
  await prisma.dailyStats.upsert({
    where: {
      tenantId_workspaceId_channelId_date: {
        tenantId,
        workspaceId: options?.workspaceId ?? null,
        channelId: options?.channelId ?? null,
        date: startOfDay,
      },
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

function getPercentile(sortedArray: number[], percentile: number): number | null {
  if (sortedArray.length === 0) return null
  
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1
  return sortedArray[Math.max(0, index)]
}

async function aggregateYesterdayForAllTenants(): Promise<void> {
  const yesterday = new Date()
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  yesterday.setUTCHours(0, 0, 0, 0)

  // Get all active tenants
  const tenants = await prisma.tenant.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    select: { id: true, name: true },
  })

  console.log(`[Analytics] Aggregating stats for ${tenants.length} tenants...`)
  console.log(`[Analytics] Date: ${yesterday.toISOString().split('T')[0]}`)

  let successCount = 0
  let errorCount = 0

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
        select: { id: true, workspaceId: true, name: true },
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

      console.log(`[Analytics] ✓ ${tenant.name} (${tenant.id}): ${channels.length} channels`)
      successCount++
    } catch (error) {
      console.error(`[Analytics] ✗ ${tenant.name} (${tenant.id}):`, error)
      errorCount++
    }
  }

  console.log(`[Analytics] Completed: ${successCount} success, ${errorCount} errors`)
}

async function cleanupOldEvents(retentionDays: number): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - retentionDays)

  const result = await prisma.analyticsEvent.deleteMany({
    where: {
      timestamp: {
        lt: cutoffDate,
      },
    },
  })

  return result.count
}

async function cleanupOldHourlyStats(retentionDays: number): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - retentionDays)

  const result = await prisma.hourlyStats.deleteMany({
    where: {
      hour: {
        lt: cutoffDate,
      },
    },
  })

  return result.count
}

async function main() {
  console.log('='.repeat(60))
  console.log(`[Analytics] Starting aggregation job at ${new Date().toISOString()}`)
  console.log('='.repeat(60))

  try {
    // 1. Aggregate yesterday's stats
    await aggregateYesterdayForAllTenants()

    // 2. Cleanup old raw events
    console.log(`\n[Analytics] Cleaning up events older than ${RAW_EVENTS_RETENTION_DAYS} days...`)
    const deletedEvents = await cleanupOldEvents(RAW_EVENTS_RETENTION_DAYS)
    console.log(`[Analytics] Deleted ${deletedEvents} old events`)

    // 3. Cleanup old hourly stats
    console.log(`\n[Analytics] Cleaning up hourly stats older than ${HOURLY_STATS_RETENTION_DAYS} days...`)
    const deletedHourly = await cleanupOldHourlyStats(HOURLY_STATS_RETENTION_DAYS)
    console.log(`[Analytics] Deleted ${deletedHourly} old hourly stats`)

    console.log('\n' + '='.repeat(60))
    console.log(`[Analytics] Job completed successfully at ${new Date().toISOString()}`)
    console.log('='.repeat(60))
  } catch (error) {
    console.error('\n[Analytics] Job failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
