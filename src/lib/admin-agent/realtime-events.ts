/**
 * Admin Agent - Realtime Events Service
 * 
 * Provides real-time event emission and subscription for the Admin Agent.
 * Uses EventEmitter pattern for in-process pub/sub.
 */

import { EventEmitter } from 'events'
import { BotHealthStatus } from '@prisma/client'

// ============================================================================
// Event Types
// ============================================================================

export type RealtimeEventType = 
  | 'health_update'
  | 'alert_created'
  | 'bot_status_change'

export interface HealthUpdateEvent {
  type: 'health_update'
  timestamp: Date
  data: {
    botId: string
    tenantId: string
    previousStatus: BotHealthStatus
    currentStatus: BotHealthStatus
    latencyMs?: number
    memoryMb?: number
    message?: string
  }
}

export interface AlertCreatedEvent {
  type: 'alert_created'
  timestamp: Date
  data: {
    alertId: string
    tenantId: string
    botId?: string
    severity: 'INFO' | 'WARNING' | 'CRITICAL'
    title: string
    description: string
  }
}

export interface BotStatusChangeEvent {
  type: 'bot_status_change'
  timestamp: Date
  data: {
    botId: string
    tenantId: string
    previousEnabled: boolean
    currentEnabled: boolean
    changedBy?: string
    reason?: string
  }
}

export type RealtimeEvent = 
  | HealthUpdateEvent 
  | AlertCreatedEvent 
  | BotStatusChangeEvent

export type EventCallback = (event: RealtimeEvent) => void | Promise<void>

// ============================================================================
// Event Emitter Singleton
// ============================================================================

class RealtimeEventEmitter extends EventEmitter {
  private static instance: RealtimeEventEmitter
  private tenantSubscriptions: Map<string, Set<EventCallback>> = new Map()
  private globalSubscriptions: Set<EventCallback> = new Set()

  private constructor() {
    super()
    // Increase max listeners to handle many subscribers
    this.setMaxListeners(100)
  }

  static getInstance(): RealtimeEventEmitter {
    if (!RealtimeEventEmitter.instance) {
      RealtimeEventEmitter.instance = new RealtimeEventEmitter()
    }
    return RealtimeEventEmitter.instance
  }

  /**
   * Subscribe to all events globally
   */
  subscribeGlobal(callback: EventCallback): () => void {
    this.globalSubscriptions.add(callback)
    
    // Return unsubscribe function
    return () => {
      this.globalSubscriptions.delete(callback)
    }
  }

  /**
   * Subscribe to events for a specific tenant
   */
  subscribeTenant(tenantId: string, callback: EventCallback): () => void {
    if (!this.tenantSubscriptions.has(tenantId)) {
      this.tenantSubscriptions.set(tenantId, new Set())
    }
    this.tenantSubscriptions.get(tenantId)!.add(callback)
    
    // Return unsubscribe function
    return () => {
      const subs = this.tenantSubscriptions.get(tenantId)
      if (subs) {
        subs.delete(callback)
        if (subs.size === 0) {
          this.tenantSubscriptions.delete(tenantId)
        }
      }
    }
  }

  /**
   * Emit event to global subscribers and tenant-specific subscribers
   */
  async emitRealtimeEvent(event: RealtimeEvent): Promise<void> {
    // Extract tenantId from event data
    const tenantId = 'tenantId' in event.data ? event.data.tenantId : undefined

    // Notify global subscribers
    const globalPromises = Array.from(this.globalSubscriptions).map(async (callback) => {
      try {
        await callback(event)
      } catch (error) {
        console.error('[RealtimeEvents] Error in global subscriber:', error)
      }
    })

    // Notify tenant-specific subscribers
    const tenantPromises: Promise<void>[] = []
    if (tenantId) {
      const tenantSubs = this.tenantSubscriptions.get(tenantId)
      if (tenantSubs) {
        for (const callback of tenantSubs) {
          tenantPromises.push(
            (async () => {
              try {
                await callback(event)
              } catch (error) {
                console.error(`[RealtimeEvents] Error in tenant ${tenantId} subscriber:`, error)
              }
            })()
          )
        }
      }
    }

    // Also emit on the EventEmitter for any native listeners
    this.emit(event.type, event)
    this.emit('*', event) // Wildcard for all events

    // Wait for all callbacks to complete
    await Promise.all([...globalPromises, ...tenantPromises])
  }

  /**
   * Get subscription stats (for debugging/monitoring)
   */
  getStats(): { globalCount: number; tenantCounts: Record<string, number> } {
    const tenantCounts: Record<string, number> = {}
    for (const [tenantId, subs] of this.tenantSubscriptions) {
      tenantCounts[tenantId] = subs.size
    }
    return {
      globalCount: this.globalSubscriptions.size,
      tenantCounts
    }
  }
}

// ============================================================================
// Public API
// ============================================================================

const emitter = RealtimeEventEmitter.getInstance()

/**
 * Emit a realtime event
 * 
 * @example
 * await emitEvent('health_update', {
 *   botId: 'bot-123',
 *   tenantId: 'tenant-456',
 *   previousStatus: 'HEALTHY',
 *   currentStatus: 'DEGRADED',
 *   latencyMs: 5500
 * })
 */
export async function emitEvent<T extends RealtimeEventType>(
  type: T,
  data: Extract<RealtimeEvent, { type: T }>['data']
): Promise<void> {
  const event = {
    type,
    timestamp: new Date(),
    data
  } as RealtimeEvent

  await emitter.emitRealtimeEvent(event)
}

/**
 * Subscribe to all realtime events
 * 
 * @returns Unsubscribe function
 * 
 * @example
 * const unsubscribe = subscribeToEvents((event) => {
 *   console.log('Event received:', event.type, event.data)
 * })
 * 
 * // Later: cleanup
 * unsubscribe()
 */
export function subscribeToEvents(callback: EventCallback): () => void {
  return emitter.subscribeGlobal(callback)
}

/**
 * Subscribe to events for a specific tenant only
 * 
 * @returns Unsubscribe function
 * 
 * @example
 * const unsubscribe = subscribeToTenantEvents('tenant-123', (event) => {
 *   console.log('Tenant event:', event)
 * })
 */
export function subscribeToTenantEvents(
  tenantId: string, 
  callback: EventCallback
): () => void {
  return emitter.subscribeTenant(tenantId, callback)
}

/**
 * Broadcast an event to all subscribers of a specific tenant
 * 
 * @example
 * await broadcastToTenant('tenant-123', {
 *   type: 'alert_created',
 *   timestamp: new Date(),
 *   data: {
 *     alertId: 'alert-789',
 *     tenantId: 'tenant-123',
 *     severity: 'WARNING',
 *     title: 'High latency detected',
 *     description: 'Bot response time > 5s'
 *   }
 * })
 */
export async function broadcastToTenant(
  tenantId: string,
  event: RealtimeEvent
): Promise<void> {
  // Ensure the tenantId in the event matches
  if ('tenantId' in event.data && event.data.tenantId !== tenantId) {
    console.warn(
      `[RealtimeEvents] Mismatched tenantId in broadcastToTenant: ` +
      `expected ${tenantId}, got ${event.data.tenantId}`
    )
  }

  await emitter.emitRealtimeEvent(event)
}

// ============================================================================
// Convenience Functions for Common Events
// ============================================================================

/**
 * Emit a health update event
 */
export async function emitHealthUpdate(
  botId: string,
  tenantId: string,
  previousStatus: BotHealthStatus,
  currentStatus: BotHealthStatus,
  options?: { latencyMs?: number; memoryMb?: number; message?: string }
): Promise<void> {
  await emitEvent('health_update', {
    botId,
    tenantId,
    previousStatus,
    currentStatus,
    ...options
  })
}

/**
 * Emit an alert created event
 */
export async function emitAlertCreated(
  alertId: string,
  tenantId: string,
  severity: 'INFO' | 'WARNING' | 'CRITICAL',
  title: string,
  description: string,
  botId?: string
): Promise<void> {
  await emitEvent('alert_created', {
    alertId,
    tenantId,
    botId,
    severity,
    title,
    description
  })
}

/**
 * Emit a bot status change event
 */
export async function emitBotStatusChange(
  botId: string,
  tenantId: string,
  previousEnabled: boolean,
  currentEnabled: boolean,
  options?: { changedBy?: string; reason?: string }
): Promise<void> {
  await emitEvent('bot_status_change', {
    botId,
    tenantId,
    previousEnabled,
    currentEnabled,
    ...options
  })
}

// ============================================================================
// Native EventEmitter Access (for advanced usage)
// ============================================================================

/**
 * Get the underlying EventEmitter instance for native event handling
 * 
 * @example
 * const ee = getEventEmitter()
 * ee.on('health_update', (event) => { ... })
 * ee.on('*', (event) => { ... }) // All events
 */
export function getEventEmitter(): EventEmitter {
  return emitter
}

/**
 * Get subscription statistics
 */
export function getSubscriptionStats() {
  return emitter.getStats()
}
