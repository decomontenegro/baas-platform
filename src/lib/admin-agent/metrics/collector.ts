/**
 * Admin Agent - Metrics Collector Service
 * 
 * Collects, aggregates, and summarizes bot metrics for monitoring
 */

import { prisma } from '@/lib/prisma'

// ============================================================================
// Types
// ============================================================================

export interface BotMetrics {
  botId: string
  botName: string
  uptime: {
    percentage: number
    totalSeconds: number
    downtimeSeconds: number
  }
  responseTime: {
    avgMs: number
    minMs: number
    maxMs: number
    p95Ms: number
  }
  errorRate: {
    percentage: number
    totalRequests: number
    failedRequests: number
  }
  collectedAt: Date
}

export interface AggregatedMetrics {
  period: MetricsPeriod
  startDate: Date
  endDate: Date
  botCount: number
  metrics: {
    avgUptime: number
    avgResponseTime: number
    avgErrorRate: number
    totalRequests: number
    totalErrors: number
  }
  botMetrics: BotMetrics[]
}

export interface MetricsSummary {
  tenantId: string
  totalBots: number
  activeBots: number
  overallHealth: 'healthy' | 'degraded' | 'critical'
  aggregated: {
    avgUptime: number
    avgResponseTime: number
    avgErrorRate: number
  }
  topPerformers: Array<{ botId: string; botName: string; score: number }>
  needsAttention: Array<{ botId: string; botName: string; issue: string }>
  lastUpdated: Date
}

export type MetricsPeriod = 'hour' | 'day' | 'week' | 'month'

interface HealthLogEntry {
  status: string
  latencyMs: number | null
  checkedAt: Date
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate percentile from sorted array
 */
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

/**
 * Get date range for a given period
 */
function getPeriodRange(period: MetricsPeriod): { start: Date; end: Date } {
  const end = new Date()
  const start = new Date()
  
  switch (period) {
    case 'hour':
      start.setHours(start.getHours() - 1)
      break
    case 'day':
      start.setDate(start.getDate() - 1)
      break
    case 'week':
      start.setDate(start.getDate() - 7)
      break
    case 'month':
      start.setMonth(start.getMonth() - 1)
      break
  }
  
  return { start, end }
}

/**
 * Calculate uptime from health logs
 */
function calculateUptime(
  healthLogs: HealthLogEntry[],
  periodMs: number
): BotMetrics['uptime'] {
  if (healthLogs.length === 0) {
    return { percentage: 0, totalSeconds: 0, downtimeSeconds: 0 }
  }
  
  const totalSeconds = Math.floor(periodMs / 1000)
  const healthyStatuses = ['HEALTHY', 'DEGRADED']
  
  // Count healthy vs unhealthy checks
  const healthyChecks = healthLogs.filter(log => 
    healthyStatuses.includes(log.status)
  ).length
  
  const percentage = (healthyChecks / healthLogs.length) * 100
  const downtimeSeconds = Math.floor(totalSeconds * (1 - percentage / 100))
  
  return {
    percentage: Math.round(percentage * 100) / 100,
    totalSeconds,
    downtimeSeconds
  }
}

/**
 * Calculate response time metrics from health logs
 */
function calculateResponseTime(
  healthLogs: HealthLogEntry[]
): BotMetrics['responseTime'] {
  const latencies = healthLogs
    .filter(log => log.latencyMs !== null)
    .map(log => log.latencyMs as number)
  
  if (latencies.length === 0) {
    return { avgMs: 0, minMs: 0, maxMs: 0, p95Ms: 0 }
  }
  
  const sum = latencies.reduce((a, b) => a + b, 0)
  
  return {
    avgMs: Math.round(sum / latencies.length),
    minMs: Math.min(...latencies),
    maxMs: Math.max(...latencies),
    p95Ms: percentile(latencies, 95)
  }
}

/**
 * Calculate error rate from health logs
 */
function calculateErrorRate(
  healthLogs: HealthLogEntry[]
): BotMetrics['errorRate'] {
  if (healthLogs.length === 0) {
    return { percentage: 0, totalRequests: 0, failedRequests: 0 }
  }
  
  const errorStatuses = ['UNHEALTHY', 'DEAD']
  const failedRequests = healthLogs.filter(log => 
    errorStatuses.includes(log.status)
  ).length
  
  const percentage = (failedRequests / healthLogs.length) * 100
  
  return {
    percentage: Math.round(percentage * 100) / 100,
    totalRequests: healthLogs.length,
    failedRequests
  }
}

/**
 * Calculate bot health score (0-100)
 */
function calculateHealthScore(metrics: BotMetrics): number {
  // Weights: uptime 40%, response time 30%, error rate 30%
  const uptimeScore = metrics.uptime.percentage
  
  // Response time score: 0ms = 100, 5000ms+ = 0
  const responseTimeScore = Math.max(0, 100 - (metrics.responseTime.avgMs / 50))
  
  // Error rate score: 0% = 100, 100% = 0
  const errorScore = 100 - metrics.errorRate.percentage
  
  const score = (uptimeScore * 0.4) + (responseTimeScore * 0.3) + (errorScore * 0.3)
  return Math.round(score * 100) / 100
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Collect metrics for a single bot
 * 
 * @param botId - The bot ID to collect metrics for
 * @param period - Time period for metrics (default: 'day')
 * @returns Bot metrics including uptime, response time, and error rate
 */
export async function collectBotMetrics(
  botId: string,
  period: MetricsPeriod = 'day'
): Promise<BotMetrics | null> {
  const { start, end } = getPeriodRange(period)
  const periodMs = end.getTime() - start.getTime()
  
  // Get bot info
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    select: { id: true, name: true, tenantId: true }
  })
  
  if (!bot) {
    return null
  }
  
  // Get admin agent for this tenant
  const adminAgent = await prisma.adminAgent.findUnique({
    where: { tenantId: bot.tenantId }
  })
  
  if (!adminAgent) {
    return null
  }
  
  // Fetch health logs for the period
  const healthLogs = await prisma.botHealthLog.findMany({
    where: {
      botId,
      adminAgentId: adminAgent.id,
      checkedAt: {
        gte: start,
        lte: end
      }
    },
    select: {
      status: true,
      latencyMs: true,
      checkedAt: true
    },
    orderBy: { checkedAt: 'asc' }
  })
  
  return {
    botId: bot.id,
    botName: bot.name,
    uptime: calculateUptime(healthLogs, periodMs),
    responseTime: calculateResponseTime(healthLogs),
    errorRate: calculateErrorRate(healthLogs),
    collectedAt: new Date()
  }
}

/**
 * Aggregate metrics for multiple bots over a period
 * 
 * @param botIds - Array of bot IDs to aggregate
 * @param period - Time period for aggregation
 * @returns Aggregated metrics for all bots
 */
export async function aggregateMetrics(
  botIds: string[],
  period: MetricsPeriod = 'day'
): Promise<AggregatedMetrics> {
  const { start, end } = getPeriodRange(period)
  
  // Collect metrics for all bots
  const metricsPromises = botIds.map(id => collectBotMetrics(id, period))
  const metricsResults = await Promise.all(metricsPromises)
  
  // Filter out nulls (bots not found)
  const botMetrics = metricsResults.filter((m): m is BotMetrics => m !== null)
  
  if (botMetrics.length === 0) {
    return {
      period,
      startDate: start,
      endDate: end,
      botCount: 0,
      metrics: {
        avgUptime: 0,
        avgResponseTime: 0,
        avgErrorRate: 0,
        totalRequests: 0,
        totalErrors: 0
      },
      botMetrics: []
    }
  }
  
  // Calculate aggregated metrics
  const totalUptime = botMetrics.reduce((sum, m) => sum + m.uptime.percentage, 0)
  const totalResponseTime = botMetrics.reduce((sum, m) => sum + m.responseTime.avgMs, 0)
  const totalErrorRate = botMetrics.reduce((sum, m) => sum + m.errorRate.percentage, 0)
  const totalRequests = botMetrics.reduce((sum, m) => sum + m.errorRate.totalRequests, 0)
  const totalErrors = botMetrics.reduce((sum, m) => sum + m.errorRate.failedRequests, 0)
  
  return {
    period,
    startDate: start,
    endDate: end,
    botCount: botMetrics.length,
    metrics: {
      avgUptime: Math.round((totalUptime / botMetrics.length) * 100) / 100,
      avgResponseTime: Math.round(totalResponseTime / botMetrics.length),
      avgErrorRate: Math.round((totalErrorRate / botMetrics.length) * 100) / 100,
      totalRequests,
      totalErrors
    },
    botMetrics
  }
}

/**
 * Get comprehensive metrics summary for a tenant
 * 
 * @param tenantId - The tenant ID to get summary for
 * @returns Metrics summary including overall health, top performers, and issues
 */
export async function getMetricsSummary(tenantId: string): Promise<MetricsSummary> {
  // Get all bots for tenant
  const bots = await prisma.bot.findMany({
    where: { 
      tenantId, 
      deletedAt: null 
    },
    select: { id: true, name: true, isEnabled: true }
  })
  
  const totalBots = bots.length
  const activeBots = bots.filter(b => b.isEnabled).length
  
  if (totalBots === 0) {
    return {
      tenantId,
      totalBots: 0,
      activeBots: 0,
      overallHealth: 'healthy',
      aggregated: {
        avgUptime: 0,
        avgResponseTime: 0,
        avgErrorRate: 0
      },
      topPerformers: [],
      needsAttention: [],
      lastUpdated: new Date()
    }
  }
  
  // Get aggregated metrics for all bots
  const botIds = bots.map(b => b.id)
  const aggregated = await aggregateMetrics(botIds, 'day')
  
  // Calculate scores and categorize bots
  const botScores = aggregated.botMetrics.map(m => ({
    botId: m.botId,
    botName: m.botName,
    score: calculateHealthScore(m),
    metrics: m
  }))
  
  // Sort by score descending
  botScores.sort((a, b) => b.score - a.score)
  
  // Top 3 performers
  const topPerformers = botScores
    .slice(0, 3)
    .map(b => ({ botId: b.botId, botName: b.botName, score: b.score }))
  
  // Bots needing attention (score < 70 or specific issues)
  const needsAttention: MetricsSummary['needsAttention'] = []
  
  for (const bot of botScores) {
    const issues: string[] = []
    
    if (bot.metrics.uptime.percentage < 95) {
      issues.push(`Uptime baixo: ${bot.metrics.uptime.percentage}%`)
    }
    if (bot.metrics.responseTime.avgMs > 3000) {
      issues.push(`Resposta lenta: ${bot.metrics.responseTime.avgMs}ms`)
    }
    if (bot.metrics.errorRate.percentage > 5) {
      issues.push(`Taxa de erro alta: ${bot.metrics.errorRate.percentage}%`)
    }
    
    if (issues.length > 0) {
      needsAttention.push({
        botId: bot.botId,
        botName: bot.botName,
        issue: issues.join('; ')
      })
    }
  }
  
  // Determine overall health
  let overallHealth: MetricsSummary['overallHealth'] = 'healthy'
  
  if (aggregated.metrics.avgUptime < 90 || aggregated.metrics.avgErrorRate > 10) {
    overallHealth = 'critical'
  } else if (aggregated.metrics.avgUptime < 99 || aggregated.metrics.avgErrorRate > 2) {
    overallHealth = 'degraded'
  }
  
  return {
    tenantId,
    totalBots,
    activeBots,
    overallHealth,
    aggregated: {
      avgUptime: aggregated.metrics.avgUptime,
      avgResponseTime: aggregated.metrics.avgResponseTime,
      avgErrorRate: aggregated.metrics.avgErrorRate
    },
    topPerformers,
    needsAttention,
    lastUpdated: new Date()
  }
}

/**
 * Format metrics summary for display
 */
export function formatMetricsSummary(summary: MetricsSummary): string {
  const healthEmoji = {
    healthy: '✅',
    degraded: '⚠️',
    critical: '❌'
  }
  
  const lines = [
    `${healthEmoji[summary.overallHealth]} **Saúde Geral:** ${summary.overallHealth.toUpperCase()}`,
    `📊 **Bots:** ${summary.activeBots}/${summary.totalBots} ativos`,
    '',
    '**Métricas Agregadas (24h):**',
    `• Uptime médio: ${summary.aggregated.avgUptime}%`,
    `• Tempo de resposta: ${summary.aggregated.avgResponseTime}ms`,
    `• Taxa de erro: ${summary.aggregated.avgErrorRate}%`
  ]
  
  if (summary.topPerformers.length > 0) {
    lines.push('', '🏆 **Top Performers:**')
    summary.topPerformers.forEach((bot, i) => {
      lines.push(`${i + 1}. ${bot.botName} (${bot.score} pts)`)
    })
  }
  
  if (summary.needsAttention.length > 0) {
    lines.push('', '⚠️ **Precisa de Atenção:**')
    summary.needsAttention.forEach(bot => {
      lines.push(`• ${bot.botName}: ${bot.issue}`)
    })
  }
  
  return lines.join('\n')
}
