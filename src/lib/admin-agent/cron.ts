/**
 * Admin Agent - Cron Service
 * 
 * Automated health check scheduler for all tenants
 * Runs every 5 minutes (configurable)
 */

import cron, { ScheduledTask } from 'node-cron'
import { prisma } from '@/lib/prisma'
import { runHealthCheckCycle } from './health-checker'

// Store the cron task reference
let healthCheckTask: ScheduledTask | null = null

// Cron state
let isRunning = false
let lastRunAt: Date | null = null
let lastRunResults: CronRunResult[] = []

export interface CronRunResult {
  tenantId: string
  tenantSlug: string
  healthy: number
  degraded: number
  unhealthy: number
  dead: number
  actions: string[]
  durationMs: number
  error?: string
}

export interface CronStatus {
  isRunning: boolean
  lastRunAt: Date | null
  lastRunResults: CronRunResult[]
  schedule: string
}

// Default schedule: every 5 minutes
const DEFAULT_SCHEDULE = '*/5 * * * *'

/**
 * Run health checks for all active tenants
 */
export async function runAllTenantsHealthCheck(): Promise<CronRunResult[]> {
  const startTime = Date.now()
  const results: CronRunResult[] = []

  try {
    // Get all tenants with active AdminAgent
    const adminAgents = await prisma.adminAgent.findMany({
      where: {
        status: 'ACTIVE',
        healthCheckEnabled: true,
        tenant: {
          status: 'ACTIVE',
          deletedAt: null
        }
      },
      include: {
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true
          }
        }
      }
    })

    console.log(`[Cron] Starting health check for ${adminAgents.length} tenants`)

    // Run health check for each tenant
    for (const adminAgent of adminAgents) {
      const tenantStartTime = Date.now()
      
      try {
        const result = await runHealthCheckCycle(adminAgent.tenantId)
        
        results.push({
          tenantId: adminAgent.tenantId,
          tenantSlug: adminAgent.tenant.slug,
          healthy: result.healthy,
          degraded: result.degraded,
          unhealthy: result.unhealthy,
          dead: result.dead,
          actions: result.actions,
          durationMs: Date.now() - tenantStartTime
        })

        console.log(
          `[Cron] Tenant ${adminAgent.tenant.slug}: ` +
          `H=${result.healthy} D=${result.degraded} U=${result.unhealthy} X=${result.dead} ` +
          `(${Date.now() - tenantStartTime}ms)`
        )
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[Cron] Error checking tenant ${adminAgent.tenant.slug}:`, errorMessage)
        
        results.push({
          tenantId: adminAgent.tenantId,
          tenantSlug: adminAgent.tenant.slug,
          healthy: 0,
          degraded: 0,
          unhealthy: 0,
          dead: 0,
          actions: [],
          durationMs: Date.now() - tenantStartTime,
          error: errorMessage
        })
      }
    }

    console.log(`[Cron] Completed health check cycle in ${Date.now() - startTime}ms`)
  } catch (error) {
    console.error('[Cron] Fatal error in health check cycle:', error)
  }

  // Update state
  lastRunAt = new Date()
  lastRunResults = results

  return results
}

/**
 * Start the cron job
 */
export function startCron(schedule: string = DEFAULT_SCHEDULE): boolean {
  if (healthCheckTask) {
    console.log('[Cron] Already running, stopping first...')
    stopCron()
  }

  try {
    // Validate cron expression
    if (!cron.validate(schedule)) {
      console.error('[Cron] Invalid cron expression:', schedule)
      return false
    }

    healthCheckTask = cron.schedule(schedule, async () => {
      if (isRunning) {
        console.log('[Cron] Skipping - previous run still in progress')
        return
      }

      isRunning = true
      try {
        await runAllTenantsHealthCheck()
      } finally {
        isRunning = false
      }
    }, {
      scheduled: true,
      timezone: 'America/Sao_Paulo'
    })

    console.log(`[Cron] Started health check scheduler with schedule: ${schedule}`)
    return true
  } catch (error) {
    console.error('[Cron] Failed to start:', error)
    return false
  }
}

/**
 * Stop the cron job
 */
export function stopCron(): boolean {
  if (!healthCheckTask) {
    console.log('[Cron] No active task to stop')
    return false
  }

  try {
    healthCheckTask.stop()
    healthCheckTask = null
    console.log('[Cron] Stopped health check scheduler')
    return true
  } catch (error) {
    console.error('[Cron] Failed to stop:', error)
    return false
  }
}

/**
 * Get current cron status
 */
export function getCronStatus(): CronStatus {
  return {
    isRunning: healthCheckTask !== null,
    lastRunAt,
    lastRunResults,
    schedule: DEFAULT_SCHEDULE
  }
}

/**
 * Trigger a manual run (for testing or immediate check)
 */
export async function triggerManualRun(): Promise<CronRunResult[]> {
  if (isRunning) {
    throw new Error('Health check already in progress')
  }

  isRunning = true
  try {
    return await runAllTenantsHealthCheck()
  } finally {
    isRunning = false
  }
}

/**
 * Check if cron is currently executing
 */
export function isExecuting(): boolean {
  return isRunning
}
