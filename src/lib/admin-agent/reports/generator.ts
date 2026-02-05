/**
 * Report Generator for Admin Agent
 * 
 * Generates daily and weekly reports with bot health metrics,
 * alert summaries, and performance analytics.
 */

import { prisma } from '@/lib/prisma'
import type { BotHealthStatus, AdminAlertSeverity, AdminAlertType } from '@prisma/client'

// ============================================================================
// Types
// ============================================================================

export interface HealthMetricsSummary {
  totalChecks: number
  healthyCount: number
  degradedCount: number
  unhealthyCount: number
  deadCount: number
  healthPercentage: number
  avgLatencyMs: number | null
  avgMemoryMb: number | null
  avgCpuPercent: number | null
  totalErrors: number
  totalSuccesses: number
}

export interface AlertSummary {
  total: number
  bySeverity: Record<AdminAlertSeverity, number>
  byType: Record<AdminAlertType, number>
  openCount: number
  resolvedCount: number
  acknowledgedCount: number
}

export interface BotReportData {
  botId: string
  botName: string
  metrics: HealthMetricsSummary
  alerts: AlertSummary
  uptimePercentage: number
  lastStatus: BotHealthStatus | null
  lastCheckedAt: Date | null
}

export interface ReportData {
  tenantId: string
  tenantName: string | null
  periodStart: Date
  periodEnd: Date
  periodType: 'daily' | 'weekly'
  generatedAt: Date
  
  // Overall metrics
  overallHealth: HealthMetricsSummary
  overallAlerts: AlertSummary
  
  // Per-bot breakdown
  bots: BotReportData[]
  
  // Highlights
  topIssues: Array<{
    botName: string
    issue: string
    count: number
  }>
  recommendations: string[]
}

export interface CSVExportOptions {
  includeHeaders?: boolean
  delimiter?: string
  dateFormat?: 'iso' | 'locale'
}

// ============================================================================
// Helper Functions
// ============================================================================

function getDateRange(type: 'daily' | 'weekly'): { start: Date; end: Date } {
  const end = new Date()
  const start = new Date()
  
  if (type === 'daily') {
    start.setDate(start.getDate() - 1)
  } else {
    start.setDate(start.getDate() - 7)
  }
  
  return { start, end }
}

async function getHealthMetrics(
  adminAgentId: string,
  botId: string | null,
  startDate: Date,
  endDate: Date
): Promise<HealthMetricsSummary> {
  const where = {
    adminAgentId,
    checkedAt: { gte: startDate, lte: endDate },
    ...(botId && { botId })
  }

  const [logs, aggregations] = await Promise.all([
    prisma.botHealthLog.findMany({
      where,
      select: {
        status: true,
        latencyMs: true,
        memoryMb: true,
        cpuPercent: true,
        errorCount: true,
        successCount: true
      }
    }),
    prisma.botHealthLog.aggregate({
      where,
      _avg: {
        latencyMs: true,
        memoryMb: true,
        cpuPercent: true
      },
      _sum: {
        errorCount: true,
        successCount: true
      },
      _count: true
    })
  ])

  const statusCounts = logs.reduce(
    (acc, log) => {
      acc[log.status] = (acc[log.status] || 0) + 1
      return acc
    },
    {} as Record<BotHealthStatus, number>
  )

  const totalChecks = aggregations._count
  const healthyCount = statusCounts.HEALTHY || 0
  const healthPercentage = totalChecks > 0 
    ? Math.round((healthyCount / totalChecks) * 100) 
    : 0

  return {
    totalChecks,
    healthyCount,
    degradedCount: statusCounts.DEGRADED || 0,
    unhealthyCount: statusCounts.UNHEALTHY || 0,
    deadCount: statusCounts.DEAD || 0,
    healthPercentage,
    avgLatencyMs: aggregations._avg.latencyMs 
      ? Math.round(aggregations._avg.latencyMs) 
      : null,
    avgMemoryMb: aggregations._avg.memoryMb 
      ? Math.round(aggregations._avg.memoryMb) 
      : null,
    avgCpuPercent: aggregations._avg.cpuPercent 
      ? Math.round(aggregations._avg.cpuPercent * 100) / 100 
      : null,
    totalErrors: aggregations._sum.errorCount || 0,
    totalSuccesses: aggregations._sum.successCount || 0
  }
}

async function getAlertSummary(
  adminAgentId: string,
  botId: string | null,
  startDate: Date,
  endDate: Date
): Promise<AlertSummary> {
  const where = {
    adminAgentId,
    createdAt: { gte: startDate, lte: endDate },
    ...(botId && { botId })
  }

  const alerts = await prisma.adminAlert.findMany({
    where,
    select: {
      type: true,
      severity: true,
      status: true
    }
  })

  const bySeverity = alerts.reduce(
    (acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1
      return acc
    },
    {} as Record<AdminAlertSeverity, number>
  )

  const byType = alerts.reduce(
    (acc, alert) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1
      return acc
    },
    {} as Record<AdminAlertType, number>
  )

  return {
    total: alerts.length,
    bySeverity: {
      INFO: bySeverity.INFO || 0,
      WARNING: bySeverity.WARNING || 0,
      ERROR: bySeverity.ERROR || 0,
      CRITICAL: bySeverity.CRITICAL || 0
    },
    byType: {
      BOT_DOWN: byType.BOT_DOWN || 0,
      BOT_SLOW: byType.BOT_SLOW || 0,
      BOT_ERRORS: byType.BOT_ERRORS || 0,
      BOT_RESTARTED: byType.BOT_RESTARTED || 0,
      CONFIG_INVALID: byType.CONFIG_INVALID || 0,
      CONFIG_ROLLED_BACK: byType.CONFIG_ROLLED_BACK || 0,
      MEMORY_HIGH: byType.MEMORY_HIGH || 0,
      QUOTA_WARNING: byType.QUOTA_WARNING || 0,
      QUOTA_EXCEEDED: byType.QUOTA_EXCEEDED || 0,
      SECURITY_ALERT: byType.SECURITY_ALERT || 0,
      CUSTOM: byType.CUSTOM || 0
    },
    openCount: alerts.filter(a => a.status === 'OPEN').length,
    resolvedCount: alerts.filter(a => a.status === 'RESOLVED').length,
    acknowledgedCount: alerts.filter(a => a.status === 'ACKNOWLEDGED').length
  }
}

function calculateUptimePercentage(metrics: HealthMetricsSummary): number {
  if (metrics.totalChecks === 0) return 100
  
  const upChecks = metrics.healthyCount + metrics.degradedCount
  return Math.round((upChecks / metrics.totalChecks) * 100 * 100) / 100
}

function generateRecommendations(report: Omit<ReportData, 'recommendations'>): string[] {
  const recommendations: string[] = []
  
  // Check overall health
  if (report.overallHealth.healthPercentage < 95) {
    recommendations.push(
      `Health está em ${report.overallHealth.healthPercentage}%. Investigar bots com problemas frequentes.`
    )
  }
  
  // Check for high error rates
  const errorRate = report.overallHealth.totalChecks > 0
    ? (report.overallHealth.totalErrors / report.overallHealth.totalChecks) * 100
    : 0
  if (errorRate > 5) {
    recommendations.push(
      `Taxa de erro de ${errorRate.toFixed(1)}% está acima do ideal. Revisar logs de erro.`
    )
  }
  
  // Check latency
  if (report.overallHealth.avgLatencyMs && report.overallHealth.avgLatencyMs > 1000) {
    recommendations.push(
      `Latência média de ${report.overallHealth.avgLatencyMs}ms está alta. Considerar otimizações.`
    )
  }
  
  // Check critical alerts
  if (report.overallAlerts.bySeverity.CRITICAL > 0) {
    recommendations.push(
      `${report.overallAlerts.bySeverity.CRITICAL} alertas críticos no período. Priorizar resolução.`
    )
  }
  
  // Check bots with low uptime
  const lowUptimeBots = report.bots.filter(b => b.uptimePercentage < 95)
  if (lowUptimeBots.length > 0) {
    recommendations.push(
      `${lowUptimeBots.length} bot(s) com uptime abaixo de 95%: ${lowUptimeBots.map(b => b.botName).join(', ')}`
    )
  }
  
  // Memory warnings
  if (report.overallHealth.avgMemoryMb && report.overallHealth.avgMemoryMb > 512) {
    recommendations.push(
      `Uso médio de memória (${report.overallHealth.avgMemoryMb}MB) está elevado. Monitorar vazamentos.`
    )
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Sistema operando dentro dos parâmetros normais. Nenhuma ação necessária.')
  }
  
  return recommendations
}

function getTopIssues(
  bots: BotReportData[]
): Array<{ botName: string; issue: string; count: number }> {
  const issues: Array<{ botName: string; issue: string; count: number }> = []
  
  for (const bot of bots) {
    // Add issues based on alerts
    if (bot.alerts.byType.BOT_DOWN > 0) {
      issues.push({ botName: bot.botName, issue: 'Bot inativo', count: bot.alerts.byType.BOT_DOWN })
    }
    if (bot.alerts.byType.BOT_ERRORS > 0) {
      issues.push({ botName: bot.botName, issue: 'Erros frequentes', count: bot.alerts.byType.BOT_ERRORS })
    }
    if (bot.alerts.byType.BOT_SLOW > 0) {
      issues.push({ botName: bot.botName, issue: 'Resposta lenta', count: bot.alerts.byType.BOT_SLOW })
    }
    if (bot.alerts.byType.MEMORY_HIGH > 0) {
      issues.push({ botName: bot.botName, issue: 'Memória alta', count: bot.alerts.byType.MEMORY_HIGH })
    }
  }
  
  // Sort by count descending and take top 5
  return issues
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Generate a daily report for a tenant
 */
export async function generateDailyReport(tenantId: string): Promise<ReportData> {
  const { start, end } = getDateRange('daily')
  
  // Get admin agent for tenant
  const adminAgent = await prisma.adminAgent.findFirst({
    where: { tenantId },
    include: {
      tenant: { select: { name: true } },
      bots: { select: { id: true, name: true } }
    }
  })
  
  if (!adminAgent) {
    throw new Error(`AdminAgent not found for tenant ${tenantId}`)
  }
  
  // Get metrics for all bots
  const botReports: BotReportData[] = await Promise.all(
    adminAgent.bots.map(async (bot) => {
      const [metrics, alerts, lastLog] = await Promise.all([
        getHealthMetrics(adminAgent.id, bot.id, start, end),
        getAlertSummary(adminAgent.id, bot.id, start, end),
        prisma.botHealthLog.findFirst({
          where: { adminAgentId: adminAgent.id, botId: bot.id },
          orderBy: { checkedAt: 'desc' },
          select: { status: true, checkedAt: true }
        })
      ])
      
      return {
        botId: bot.id,
        botName: bot.name,
        metrics,
        alerts,
        uptimePercentage: calculateUptimePercentage(metrics),
        lastStatus: lastLog?.status || null,
        lastCheckedAt: lastLog?.checkedAt || null
      }
    })
  )
  
  // Get overall metrics
  const [overallHealth, overallAlerts] = await Promise.all([
    getHealthMetrics(adminAgent.id, null, start, end),
    getAlertSummary(adminAgent.id, null, start, end)
  ])
  
  const partialReport = {
    tenantId,
    tenantName: adminAgent.tenant.name,
    periodStart: start,
    periodEnd: end,
    periodType: 'daily' as const,
    generatedAt: new Date(),
    overallHealth,
    overallAlerts,
    bots: botReports,
    topIssues: getTopIssues(botReports)
  }
  
  return {
    ...partialReport,
    recommendations: generateRecommendations(partialReport)
  }
}

/**
 * Generate a weekly report for a tenant
 */
export async function generateWeeklyReport(tenantId: string): Promise<ReportData> {
  const { start, end } = getDateRange('weekly')
  
  // Get admin agent for tenant
  const adminAgent = await prisma.adminAgent.findFirst({
    where: { tenantId },
    include: {
      tenant: { select: { name: true } },
      bots: { select: { id: true, name: true } }
    }
  })
  
  if (!adminAgent) {
    throw new Error(`AdminAgent not found for tenant ${tenantId}`)
  }
  
  // Get metrics for all bots
  const botReports: BotReportData[] = await Promise.all(
    adminAgent.bots.map(async (bot) => {
      const [metrics, alerts, lastLog] = await Promise.all([
        getHealthMetrics(adminAgent.id, bot.id, start, end),
        getAlertSummary(adminAgent.id, bot.id, start, end),
        prisma.botHealthLog.findFirst({
          where: { adminAgentId: adminAgent.id, botId: bot.id },
          orderBy: { checkedAt: 'desc' },
          select: { status: true, checkedAt: true }
        })
      ])
      
      return {
        botId: bot.id,
        botName: bot.name,
        metrics,
        alerts,
        uptimePercentage: calculateUptimePercentage(metrics),
        lastStatus: lastLog?.status || null,
        lastCheckedAt: lastLog?.checkedAt || null
      }
    })
  )
  
  // Get overall metrics
  const [overallHealth, overallAlerts] = await Promise.all([
    getHealthMetrics(adminAgent.id, null, start, end),
    getAlertSummary(adminAgent.id, null, start, end)
  ])
  
  const partialReport = {
    tenantId,
    tenantName: adminAgent.tenant.name,
    periodStart: start,
    periodEnd: end,
    periodType: 'weekly' as const,
    generatedAt: new Date(),
    overallHealth,
    overallAlerts,
    bots: botReports,
    topIssues: getTopIssues(botReports)
  }
  
  return {
    ...partialReport,
    recommendations: generateRecommendations(partialReport)
  }
}

/**
 * Export report data to CSV format
 */
export function exportToCSV(
  data: ReportData,
  options: CSVExportOptions = {}
): string {
  const {
    includeHeaders = true,
    delimiter = ',',
    dateFormat = 'iso'
  } = options
  
  const formatDate = (date: Date | null): string => {
    if (!date) return ''
    return dateFormat === 'iso' 
      ? date.toISOString() 
      : date.toLocaleString('pt-BR')
  }
  
  const escapeCSV = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return ''
    const str = String(value)
    if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }
  
  const lines: string[] = []
  
  // Header
  if (includeHeaders) {
    lines.push([
      'Bot Name',
      'Bot ID',
      'Health %',
      'Uptime %',
      'Total Checks',
      'Healthy',
      'Degraded',
      'Unhealthy',
      'Dead',
      'Avg Latency (ms)',
      'Avg Memory (MB)',
      'Avg CPU %',
      'Total Errors',
      'Total Successes',
      'Critical Alerts',
      'Error Alerts',
      'Warning Alerts',
      'Info Alerts',
      'Last Status',
      'Last Checked'
    ].join(delimiter))
  }
  
  // Data rows
  for (const bot of data.bots) {
    lines.push([
      escapeCSV(bot.botName),
      escapeCSV(bot.botId),
      escapeCSV(bot.metrics.healthPercentage),
      escapeCSV(bot.uptimePercentage),
      escapeCSV(bot.metrics.totalChecks),
      escapeCSV(bot.metrics.healthyCount),
      escapeCSV(bot.metrics.degradedCount),
      escapeCSV(bot.metrics.unhealthyCount),
      escapeCSV(bot.metrics.deadCount),
      escapeCSV(bot.metrics.avgLatencyMs),
      escapeCSV(bot.metrics.avgMemoryMb),
      escapeCSV(bot.metrics.avgCpuPercent),
      escapeCSV(bot.metrics.totalErrors),
      escapeCSV(bot.metrics.totalSuccesses),
      escapeCSV(bot.alerts.bySeverity.CRITICAL),
      escapeCSV(bot.alerts.bySeverity.ERROR),
      escapeCSV(bot.alerts.bySeverity.WARNING),
      escapeCSV(bot.alerts.bySeverity.INFO),
      escapeCSV(bot.lastStatus),
      escapeCSV(formatDate(bot.lastCheckedAt))
    ].join(delimiter))
  }
  
  return lines.join('\n')
}

/**
 * Format report data for display (text/markdown format)
 */
export function formatReportData(report: ReportData): string {
  const formatDate = (date: Date) => date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  })
  
  const periodLabel = report.periodType === 'daily' ? 'Diário' : 'Semanal'
  
  let output = `
# Relatório ${periodLabel} - ${report.tenantName || report.tenantId}

**Período:** ${formatDate(report.periodStart)} até ${formatDate(report.periodEnd)}
**Gerado em:** ${formatDate(report.generatedAt)}

---

## 📊 Resumo Geral

| Métrica | Valor |
|---------|-------|
| Health Geral | ${report.overallHealth.healthPercentage}% |
| Total de Verificações | ${report.overallHealth.totalChecks} |
| Checks Saudáveis | ${report.overallHealth.healthyCount} |
| Checks com Problemas | ${report.overallHealth.unhealthyCount + report.overallHealth.deadCount} |
| Latência Média | ${report.overallHealth.avgLatencyMs ?? 'N/A'} ms |
| Memória Média | ${report.overallHealth.avgMemoryMb ?? 'N/A'} MB |
| CPU Médio | ${report.overallHealth.avgCpuPercent ?? 'N/A'}% |

## 🚨 Alertas

| Severidade | Quantidade |
|------------|------------|
| 🔴 Crítico | ${report.overallAlerts.bySeverity.CRITICAL} |
| 🟠 Erro | ${report.overallAlerts.bySeverity.ERROR} |
| 🟡 Aviso | ${report.overallAlerts.bySeverity.WARNING} |
| 🔵 Info | ${report.overallAlerts.bySeverity.INFO} |

**Status:** ${report.overallAlerts.openCount} abertos | ${report.overallAlerts.acknowledgedCount} reconhecidos | ${report.overallAlerts.resolvedCount} resolvidos

## 🤖 Detalhes por Bot

`
  
  for (const bot of report.bots) {
    const statusEmoji = bot.lastStatus === 'HEALTHY' ? '✅' 
      : bot.lastStatus === 'DEGRADED' ? '⚠️'
      : bot.lastStatus === 'UNHEALTHY' ? '❌'
      : bot.lastStatus === 'DEAD' ? '💀'
      : '❓'
    
    output += `
### ${statusEmoji} ${bot.botName}

- **Uptime:** ${bot.uptimePercentage}%
- **Health:** ${bot.metrics.healthPercentage}%
- **Latência:** ${bot.metrics.avgLatencyMs ?? 'N/A'} ms
- **Alertas:** ${bot.alerts.total} (${bot.alerts.bySeverity.CRITICAL} críticos)
- **Último Status:** ${bot.lastStatus || 'N/A'}
`
  }
  
  if (report.topIssues.length > 0) {
    output += `
## ⚠️ Principais Problemas

`
    for (const issue of report.topIssues) {
      output += `- **${issue.botName}:** ${issue.issue} (${issue.count}x)\n`
    }
  }
  
  output += `
## 💡 Recomendações

`
  for (const rec of report.recommendations) {
    output += `- ${rec}\n`
  }
  
  return output.trim()
}
