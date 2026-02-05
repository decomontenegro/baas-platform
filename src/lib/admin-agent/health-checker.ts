/**
 * Admin Agent - Health Checker Service
 * 
 * Monitors all bots for a tenant and performs auto-healing actions
 */

import { prisma } from '@/lib/prisma'
import { BotHealthStatus, AdminAlertType, AdminAlertSeverity } from '@prisma/client'

interface HealthCheckResult {
  botId: string
  status: BotHealthStatus
  latencyMs?: number
  memoryMb?: number
  error?: string
  action?: string
  actionResult?: string
}

/**
 * Check health of a single bot
 */
export async function checkBotHealth(botId: string): Promise<HealthCheckResult> {
  const startTime = Date.now()
  
  try {
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      include: { tenant: true }
    })
    
    if (!bot) {
      return {
        botId,
        status: 'DEAD',
        error: 'Bot not found'
      }
    }
    
    // TODO: Actually ping the bot's Clawdbot instance
    // For now, we just check if it exists and is enabled
    
    const latencyMs = Date.now() - startTime
    
    // Determine status based on metrics
    let status: BotHealthStatus = 'HEALTHY'
    
    if (latencyMs > 5000) {
      status = 'DEGRADED'
    }
    
    if (!bot.isEnabled) {
      status = 'DEAD'
    }
    
    return {
      botId,
      status,
      latencyMs
    }
  } catch (error) {
    return {
      botId,
      status: 'UNHEALTHY',
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs: Date.now() - startTime
    }
  }
}

/**
 * Check health of all bots for a tenant
 */
export async function checkAllBotsHealth(tenantId: string): Promise<HealthCheckResult[]> {
  const bots = await prisma.bot.findMany({
    where: { tenantId, deletedAt: null }
  })
  
  const results = await Promise.all(
    bots.map(bot => checkBotHealth(bot.id))
  )
  
  return results
}

/**
 * Log health check result
 */
export async function logHealthCheck(
  adminAgentId: string,
  result: HealthCheckResult
): Promise<void> {
  await prisma.botHealthLog.create({
    data: {
      adminAgentId,
      botId: result.botId,
      status: result.status,
      latencyMs: result.latencyMs,
      error: result.error,
      action: result.action,
      actionResult: result.actionResult
    }
  })
}

/**
 * Create alert for unhealthy bot
 */
export async function createAlert(
  adminAgentId: string,
  botId: string,
  type: AdminAlertType,
  severity: AdminAlertSeverity,
  title: string,
  message: string
): Promise<void> {
  await prisma.adminAlert.create({
    data: {
      adminAgentId,
      botId,
      type,
      severity,
      title,
      message
    }
  })
}

/**
 * Attempt to restart a bot
 */
export async function attemptBotRestart(botId: string): Promise<boolean> {
  try {
    // TODO: Integrate with Clawdbot restart mechanism
    // For now, just toggle the bot off and on
    
    await prisma.bot.update({
      where: { id: botId },
      data: { isEnabled: false }
    })
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    await prisma.bot.update({
      where: { id: botId },
      data: { isEnabled: true }
    })
    
    return true
  } catch (error) {
    console.error('Failed to restart bot:', error)
    return false
  }
}

/**
 * Run full health check cycle for a tenant
 */
export async function runHealthCheckCycle(tenantId: string): Promise<{
  healthy: number
  degraded: number
  unhealthy: number
  dead: number
  actions: string[]
}> {
  const adminAgent = await prisma.adminAgent.findUnique({
    where: { tenantId }
  })
  
  if (!adminAgent || adminAgent.status !== 'ACTIVE') {
    return { healthy: 0, degraded: 0, unhealthy: 0, dead: 0, actions: [] }
  }
  
  const results = await checkAllBotsHealth(tenantId)
  const actions: string[] = []
  
  let healthy = 0, degraded = 0, unhealthy = 0, dead = 0
  
  for (const result of results) {
    // Log the health check
    await logHealthCheck(adminAgent.id, result)
    
    // Count by status
    switch (result.status) {
      case 'HEALTHY': healthy++; break
      case 'DEGRADED': degraded++; break
      case 'UNHEALTHY': unhealthy++; break
      case 'DEAD': dead++; break
    }
    
    // Take action if needed
    if (result.status === 'UNHEALTHY' || result.status === 'DEAD') {
      if (adminAgent.autoRestartEnabled) {
        const restarted = await attemptBotRestart(result.botId)
        actions.push(`Attempted restart of bot ${result.botId}: ${restarted ? 'success' : 'failed'}`)
        
        if (!restarted) {
          // Create alert
          await createAlert(
            adminAgent.id,
            result.botId,
            'BOT_DOWN',
            'CRITICAL',
            'Bot não responde',
            `O bot ${result.botId} não está respondendo e a tentativa de reinício falhou.`
          )
        }
      }
    }
    
    if (result.status === 'DEGRADED') {
      await createAlert(
        adminAgent.id,
        result.botId,
        'BOT_SLOW',
        'WARNING',
        'Bot com lentidão',
        `O bot ${result.botId} está respondendo lentamente (${result.latencyMs}ms).`
      )
    }
  }
  
  return { healthy, degraded, unhealthy, dead, actions }
}

/**
 * Get recent health summary for dashboard
 */
export async function getHealthSummary(tenantId: string): Promise<{
  totalBots: number
  healthyBots: number
  degradedBots: number
  unhealthyBots: number
  recentAlerts: number
  lastCheck: Date | null
}> {
  const adminAgent = await prisma.adminAgent.findUnique({
    where: { tenantId }
  })
  
  if (!adminAgent) {
    return {
      totalBots: 0,
      healthyBots: 0,
      degradedBots: 0,
      unhealthyBots: 0,
      recentAlerts: 0,
      lastCheck: null
    }
  }
  
  // Get latest health status for each bot
  const latestHealthLogs = await prisma.botHealthLog.findMany({
    where: { adminAgentId: adminAgent.id },
    orderBy: { checkedAt: 'desc' },
    distinct: ['botId'],
    take: 100
  })
  
  const totalBots = latestHealthLogs.length
  const healthyBots = latestHealthLogs.filter(l => l.status === 'HEALTHY').length
  const degradedBots = latestHealthLogs.filter(l => l.status === 'DEGRADED').length
  const unhealthyBots = latestHealthLogs.filter(l => 
    l.status === 'UNHEALTHY' || l.status === 'DEAD'
  ).length
  
  // Count recent alerts (last 24h)
  const recentAlerts = await prisma.adminAlert.count({
    where: {
      adminAgentId: adminAgent.id,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      status: 'OPEN'
    }
  })
  
  const lastLog = latestHealthLogs[0]
  
  return {
    totalBots,
    healthyBots,
    degradedBots,
    unhealthyBots,
    recentAlerts,
    lastCheck: lastLog?.checkedAt || null
  }
}
