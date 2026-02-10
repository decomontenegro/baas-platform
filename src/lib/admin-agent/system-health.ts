/**
 * System Health Check
 * 
 * Comprehensive health check for all system dependencies
 * Used by Admin Agent and /api/health endpoint
 */

import { prisma } from '@/lib/prisma'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

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
 * Check disk space (via df command or fallback)
 */
async function checkDiskSpace(): Promise<DependencyHealth> {
  const start = Date.now()
  try {
    // Use child_process to run df command
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)
    
    const { stdout } = await execAsync('df -h / | tail -1')
    const parts = stdout.trim().split(/\s+/)
    const usePercent = parseInt(parts[4]?.replace('%', '') || '0')
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    let message: string | undefined
    
    if (usePercent > 95) {
      status = 'unhealthy'
      message = `Critical: ${usePercent}% used`
    } else if (usePercent > 85) {
      status = 'degraded'
      message = `Warning: ${usePercent}% used`
    } else {
      message = `${usePercent}% used`
    }
    
    return {
      name: 'Disk Space',
      status,
      latencyMs: Date.now() - start,
      message,
      lastCheck: new Date()
    }
  } catch (error) {
    return {
      name: 'Disk Space',
      status: 'degraded',
      latencyMs: Date.now() - start,
      message: 'Unable to check disk space',
      lastCheck: new Date()
    }
  }
}

/**
 * Check file system write permissions
 */
async function checkFileSystem(): Promise<DependencyHealth> {
  const start = Date.now()
  const testFile = join(tmpdir(), `.health-check-${Date.now()}`)
  
  try {
    // Test write
    await fs.writeFile(testFile, 'health-check')
    // Test read
    await fs.readFile(testFile)
    // Cleanup
    await fs.unlink(testFile)
    
    return {
      name: 'File System',
      status: 'healthy',
      latencyMs: Date.now() - start,
      lastCheck: new Date()
    }
  } catch (error) {
    return {
      name: 'File System',
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Write failed',
      lastCheck: new Date()
    }
  }
}

/**
 * Check LLM API availability (lightweight ping)
 */
async function checkLLMApi(
  name: string,
  apiKey: string | undefined,
  testUrl: string
): Promise<DependencyHealth> {
  const start = Date.now()
  
  if (!apiKey) {
    return {
      name,
      status: 'degraded',
      latencyMs: 0,
      message: 'API key not configured',
      lastCheck: new Date()
    }
  }
  
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'x-api-key': apiKey, // For Anthropic
        'anthropic-version': '2023-06-01'
      },
      signal: controller.signal
    })
    
    clearTimeout(timeout)
    const latency = Date.now() - start
    
    // 401/403 means API is reachable but key might be invalid
    // We still consider it "reachable" for health purposes
    const isReachable = response.status < 500
    
    return {
      name,
      status: isReachable ? (latency > 3000 ? 'degraded' : 'healthy') : 'unhealthy',
      latencyMs: latency,
      message: response.ok ? undefined : `HTTP ${response.status}`,
      lastCheck: new Date()
    }
  } catch (error) {
    return {
      name,
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Connection failed',
      lastCheck: new Date()
    }
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
    checkFileSystem(),
    // LLM API checks (only if keys are configured)
    checkLLMApi(
      'Anthropic Claude',
      process.env.ANTHROPIC_API_KEY,
      'https://api.anthropic.com/v1/messages'
    ),
    checkLLMApi(
      'OpenAI',
      process.env.OPENAI_API_KEY,
      'https://api.openai.com/v1/models'
    ),
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
