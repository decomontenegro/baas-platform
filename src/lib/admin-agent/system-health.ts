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
  system: {
    nodeVersion: string
    platform: string
    pid: number
    environment: string
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
 * Check Anthropic Claude API
 */
async function checkAnthropicApi(): Promise<DependencyHealth> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      name: 'Anthropic Claude',
      status: 'degraded',
      latencyMs: 0,
      message: 'API key not configured',
      lastCheck: new Date()
    }
  }

  const start = Date.now()
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }]
      })
    })

    clearTimeout(timeout)
    const latency = Date.now() - start

    return {
      name: 'Anthropic Claude',
      status: response.ok ? (latency > 3000 ? 'degraded' : 'healthy') : 'degraded',
      latencyMs: latency,
      message: response.ok ? undefined : `HTTP ${response.status}`,
      lastCheck: new Date()
    }
  } catch (error) {
    return {
      name: 'Anthropic Claude',
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Request failed',
      lastCheck: new Date()
    }
  }
}

/**
 * Check OpenAI API
 */
async function checkOpenAiApi(): Promise<DependencyHealth> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      name: 'OpenAI',
      status: 'degraded',
      latencyMs: 0,
      message: 'API key not configured',
      lastCheck: new Date()
    }
  }

  const start = Date.now()
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    })

    clearTimeout(timeout)
    const latency = Date.now() - start

    return {
      name: 'OpenAI',
      status: response.ok ? (latency > 3000 ? 'degraded' : 'healthy') : 'degraded',
      latencyMs: latency,
      message: response.ok ? undefined : `HTTP ${response.status}`,
      lastCheck: new Date()
    }
  } catch (error) {
    return {
      name: 'OpenAI',
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Request failed',
      lastCheck: new Date()
    }
  }
}

/**
 * Check disk space
 */
async function checkDiskSpace(): Promise<DependencyHealth> {
  try {
    const fs = require('fs').promises
    const stats = await fs.statfs('.')
    
    const totalBytes = stats.blocks * stats.bsize
    const freeBytes = stats.bavail * stats.bsize
    const usedBytes = totalBytes - freeBytes
    const usedPercent = Math.round((usedBytes / totalBytes) * 100)
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    if (usedPercent > 95) status = 'unhealthy'
    else if (usedPercent > 85) status = 'degraded'
    
    return {
      name: 'Disk Space',
      status,
      latencyMs: 0,
      message: `${usedPercent}% used`,
      lastCheck: new Date()
    }
  } catch (error) {
    return {
      name: 'Disk Space',
      status: 'degraded',
      latencyMs: 0,
      message: 'Unable to check disk space',
      lastCheck: new Date()
    }
  }
}

/**
 * Get memory usage (Node.js process)
 */
function getMemoryUsage(): { used: number; total: number; percent: number } {
  const usage = process.memoryUsage()
  const usedHeap = usage.heapUsed
  const totalHeap = usage.heapTotal
  
  // Use RSS (Resident Set Size) as a more accurate representation
  const rss = usage.rss
  const usedMB = Math.round(rss / 1024 / 1024)
  const heapMB = Math.round(totalHeap / 1024 / 1024)
  
  // Calculate percentage based on heap usage vs total heap
  const heapPercent = Math.round((usedHeap / totalHeap) * 100)
  
  return {
    used: usedMB, // RSS in MB (actual memory used by process)
    total: heapMB, // Heap total in MB
    percent: Math.min(heapPercent, 100) // Ensure it never exceeds 100%
  }
}

/**
 * Get process uptime
 */
function getUptime(): number {
  return Math.round(process.uptime())
}

/**
 * Get system information
 */
function getSystemInfo() {
  return {
    nodeVersion: process.version,
    platform: `${process.platform} ${process.arch}`,
    pid: process.pid,
    environment: process.env.NODE_ENV || 'development'
  }
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
    checkDiskSpace(),
    checkAnthropicApi(),
    checkOpenAiApi(),
    // Add more checks as needed:
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
    system: getSystemInfo(),
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
