/**
 * System Health Check
 * 
 * Comprehensive health check for all system dependencies
 * Used by Admin Agent and /api/health endpoint
 */

import { prisma } from '@/lib/prisma'

export interface DependencyHealth {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  latencyMs: number
  message?: string
  lastCheck: Date
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: Date
  uptime: number
  dependencies: DependencyHealth[]
  memory: {
    used: number
    total: number
    percent: number
  }
  version: string
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<DependencyHealth> {
  const start = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return {
      name: 'PostgreSQL',
      status: 'healthy',
      latencyMs: Date.now() - start,
      lastCheck: new Date()
    }
  } catch (error) {
    return {
      name: 'PostgreSQL',
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Connection failed',
      lastCheck: new Date()
    }
  }
}

/**
 * Check external API (optional, e.g., OpenAI)
 */
async function checkExternalApi(
  name: string,
  url: string,
  timeoutMs: number = 5000
): Promise<DependencyHealth> {
  const start = Date.now()
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal
    })
    
    clearTimeout(timeout)
    const latency = Date.now() - start
    
    return {
      name,
      status: response.ok ? (latency > 2000 ? 'degraded' : 'healthy') : 'degraded',
      latencyMs: latency,
      message: response.ok ? undefined : `HTTP ${response.status}`,
      lastCheck: new Date()
    }
  } catch (error) {
    return {
      name,
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Request failed',
      lastCheck: new Date()
    }
  }
}

/**
 * Get memory usage (Node.js process)
 */
function getMemoryUsage(): { used: number; total: number; percent: number } {
  const usage = process.memoryUsage()
  const totalHeap = usage.heapTotal
  const usedHeap = usage.heapUsed
  
  return {
    used: Math.round(usedHeap / 1024 / 1024), // MB
    total: Math.round(totalHeap / 1024 / 1024), // MB
    percent: Math.round((usedHeap / totalHeap) * 100)
  }
}

/**
 * Get process uptime
 */
function getUptime(): number {
  return Math.round(process.uptime())
}

/**
 * Check critical environment variables
 */
function checkEnvVars(): DependencyHealth {
  const criticalVars = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
  ]
  
  const recommendedVars = [
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'RESEND_API_KEY',
  ]
  
  const missingCritical = criticalVars.filter(v => !process.env[v])
  const missingRecommended = recommendedVars.filter(v => !process.env[v])
  
  if (missingCritical.length > 0) {
    return {
      name: 'Environment',
      status: 'unhealthy',
      latencyMs: 0,
      message: `Missing critical: ${missingCritical.join(', ')}`,
      lastCheck: new Date()
    }
  }
  
  if (missingRecommended.length > 0) {
    return {
      name: 'Environment',
      status: 'degraded',
      latencyMs: 0,
      message: `Missing optional: ${missingRecommended.join(', ')}`,
      lastCheck: new Date()
    }
  }
  
  return {
    name: 'Environment',
    status: 'healthy',
    latencyMs: 0,
    lastCheck: new Date()
  }
}

/**
 * Run comprehensive system health check
 */
export async function checkSystemHealth(): Promise<SystemHealth> {
  const timestamp = new Date()
  
  // Check all dependencies in parallel
  const dependencyChecks = await Promise.all([
    checkDatabase(),
    Promise.resolve(checkEnvVars()),
    // Add more dependency checks as needed:
    // checkExternalApi('OpenAI', 'https://api.openai.com/v1/models'),
    // checkExternalApi('Stripe', 'https://api.stripe.com/v1'),
  ])
  
  // Determine overall status
  const hasUnhealthy = dependencyChecks.some(d => d.status === 'unhealthy')
  const hasDegraded = dependencyChecks.some(d => d.status === 'degraded')
  
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  if (hasUnhealthy) overallStatus = 'unhealthy'
  else if (hasDegraded) overallStatus = 'degraded'
  
  // Check memory (warn if > 80%)
  const memory = getMemoryUsage()
  if (memory.percent > 90) overallStatus = 'unhealthy'
  else if (memory.percent > 80 && overallStatus === 'healthy') overallStatus = 'degraded'
  
  return {
    status: overallStatus,
    timestamp,
    uptime: getUptime(),
    dependencies: dependencyChecks,
    memory,
    version: process.env.npm_package_version || '0.1.0'
  }
}

/**
 * Quick health check (just status, no details)
 */
export async function quickHealthCheck(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch {
    return false
  }
}

/**
 * Format health check for display
 */
export function formatHealthReport(health: SystemHealth): string {
  const statusEmoji = {
    healthy: '✅',
    degraded: '⚠️',
    unhealthy: '❌'
  }
  
  const lines = [
    `${statusEmoji[health.status]} Sistema: ${health.status.toUpperCase()}`,
    `📊 Uptime: ${Math.floor(health.uptime / 60)}m ${health.uptime % 60}s`,
    `💾 Memória: ${health.memory.used}MB / ${health.memory.total}MB (${health.memory.percent}%)`,
    '',
    '**Dependências:**'
  ]
  
  for (const dep of health.dependencies) {
    const emoji = statusEmoji[dep.status]
    lines.push(`${emoji} ${dep.name}: ${dep.latencyMs}ms ${dep.message ? `(${dep.message})` : ''}`)
  }
  
  return lines.join('\n')
}
