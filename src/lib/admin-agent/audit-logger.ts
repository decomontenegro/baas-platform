/**
 * Admin Agent - Audit Logger Service
 * 
 * Provides comprehensive audit logging for all admin actions.
 * Logs are permanent (no soft delete) for compliance.
 */

import { prisma } from '@/lib/prisma'
import type { AuditLog, Prisma } from '@prisma/client'

// ============================================================================
// Types
// ============================================================================

export interface AuditActionDetails {
  tenantId?: string
  resource: string
  resourceId?: string
  oldData?: Record<string, unknown>
  newData?: Record<string, unknown>
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

export interface AuditLogFilters {
  userId?: string
  action?: string
  resource?: string
  resourceId?: string
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}

export interface FormattedAuditEntry {
  id: string
  timestamp: string
  actor: string
  action: string
  resource: string
  summary: string
  details?: string
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Log an action to the audit trail
 * 
 * @param action - The action being performed (e.g., 'bot.create', 'config.update')
 * @param userId - The ID of the user performing the action (null for system actions)
 * @param details - Additional details about the action
 * @returns The created audit log entry
 * 
 * @example
 * await logAction('bot.restart', userId, {
 *   tenantId: tenant.id,
 *   resource: 'bot',
 *   resourceId: botId,
 *   metadata: { reason: 'auto-heal', previousStatus: 'UNHEALTHY' }
 * })
 */
export async function logAction(
  action: string,
  userId: string | null,
  details: AuditActionDetails
): Promise<AuditLog> {
  const auditLog = await prisma.auditLog.create({
    data: {
      action,
      userId,
      tenantId: details.tenantId,
      resource: details.resource,
      resourceId: details.resourceId,
      oldData: details.oldData as Prisma.InputJsonValue,
      newData: details.newData as Prisma.InputJsonValue,
      metadata: (details.metadata ?? {}) as Prisma.InputJsonValue,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent
    }
  })

  return auditLog
}

/**
 * Get audit logs for a tenant with optional filters
 * 
 * @param tenantId - The tenant ID to fetch logs for
 * @param filters - Optional filters to apply
 * @returns Array of audit log entries
 * 
 * @example
 * const logs = await getAuditLog(tenantId, {
 *   action: 'bot.restart',
 *   startDate: new Date('2024-01-01'),
 *   limit: 50
 * })
 */
export async function getAuditLog(
  tenantId: string,
  filters: AuditLogFilters = {}
): Promise<AuditLog[]> {
  const {
    userId,
    action,
    resource,
    resourceId,
    startDate,
    endDate,
    limit = 100,
    offset = 0
  } = filters

  const where: Prisma.AuditLogWhereInput = {
    tenantId,
    ...(userId && { userId }),
    ...(action && { action }),
    ...(resource && { resource }),
    ...(resourceId && { resourceId }),
    ...(startDate || endDate ? {
      createdAt: {
        ...(startDate && { gte: startDate }),
        ...(endDate && { lte: endDate })
      }
    } : {})
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  })

  return logs
}

/**
 * Format an audit log entry for display
 * 
 * @param entry - The audit log entry to format
 * @returns A formatted, human-readable audit entry
 * 
 * @example
 * const formatted = formatAuditEntry(log)
 * console.log(formatted.summary) // "João criou bot 'Atendimento'"
 */
export function formatAuditEntry(
  entry: AuditLog & { user?: { name: string | null; email: string } | null }
): FormattedAuditEntry {
  const timestamp = entry.createdAt.toISOString()
  const actor = entry.user?.name || entry.user?.email || 'Sistema'
  
  // Parse action into verb
  const actionVerbs: Record<string, string> = {
    'create': 'criou',
    'update': 'atualizou',
    'delete': 'removeu',
    'restart': 'reiniciou',
    'enable': 'ativou',
    'disable': 'desativou',
    'login': 'fez login',
    'logout': 'fez logout',
    'invite': 'convidou',
    'accept': 'aceitou',
    'reject': 'rejeitou',
    'rollback': 'reverteu',
    'restore': 'restaurou',
    'validate': 'validou',
    'access': 'acessou'
  }

  const resourceLabels: Record<string, string> = {
    'bot': 'bot',
    'tenant': 'tenant',
    'user': 'usuário',
    'config': 'configuração',
    'channel': 'canal',
    'invite': 'convite',
    'emergency_access': 'acesso emergencial',
    'admin_agent': 'admin agent'
  }

  // Extract action parts (e.g., 'bot.create' -> ['bot', 'create'])
  const [resourcePart, actionPart] = entry.action.includes('.')
    ? entry.action.split('.')
    : [entry.resource, entry.action]

  const verb = actionVerbs[actionPart] || actionPart
  const resourceLabel = resourceLabels[resourcePart] || resourcePart

  // Build summary
  let summary = `${actor} ${verb} ${resourceLabel}`
  
  // Add resource identifier if available
  const metadata = entry.metadata as Record<string, unknown> | null
  const resourceName = metadata?.name || metadata?.resourceName || entry.resourceId
  if (resourceName) {
    summary += ` '${resourceName}'`
  }

  // Build details string
  let details: string | undefined
  
  if (entry.oldData || entry.newData) {
    const changes: string[] = []
    
    const oldData = entry.oldData as Record<string, unknown> | null
    const newData = entry.newData as Record<string, unknown> | null
    
    if (oldData && newData) {
      // Show what changed
      for (const key of Object.keys(newData)) {
        if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
          changes.push(`${key}: ${formatValue(oldData[key])} → ${formatValue(newData[key])}`)
        }
      }
    } else if (newData) {
      // Show new values
      for (const [key, value] of Object.entries(newData)) {
        changes.push(`${key}: ${formatValue(value)}`)
      }
    }
    
    if (changes.length > 0) {
      details = changes.join('\n')
    }
  }

  return {
    id: entry.id,
    timestamp,
    actor,
    action: entry.action,
    resource: entry.resource,
    summary,
    details
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format a value for display in audit details
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '(vazio)'
  }
  
  if (typeof value === 'boolean') {
    return value ? 'sim' : 'não'
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  
  return String(value)
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Log a system action (no user associated)
 */
export async function logSystemAction(
  action: string,
  details: AuditActionDetails
): Promise<AuditLog> {
  return logAction(action, null, {
    ...details,
    metadata: {
      ...details.metadata,
      isSystemAction: true
    }
  })
}

/**
 * Log a bot-related action
 */
export async function logBotAction(
  action: 'create' | 'update' | 'delete' | 'restart' | 'enable' | 'disable',
  userId: string | null,
  botId: string,
  tenantId: string,
  details?: Partial<AuditActionDetails>
): Promise<AuditLog> {
  return logAction(`bot.${action}`, userId, {
    tenantId,
    resource: 'bot',
    resourceId: botId,
    ...details
  })
}

/**
 * Log a config-related action
 */
export async function logConfigAction(
  action: 'update' | 'rollback' | 'validate',
  userId: string | null,
  configId: string,
  tenantId: string,
  details?: Partial<AuditActionDetails>
): Promise<AuditLog> {
  return logAction(`config.${action}`, userId, {
    tenantId,
    resource: 'config',
    resourceId: configId,
    ...details
  })
}

/**
 * Get formatted audit log for display
 */
export async function getFormattedAuditLog(
  tenantId: string,
  filters: AuditLogFilters = {}
): Promise<FormattedAuditEntry[]> {
  const logs = await getAuditLog(tenantId, filters)
  return logs.map(formatAuditEntry)
}

/**
 * Count audit logs matching filters
 */
export async function countAuditLogs(
  tenantId: string,
  filters: Omit<AuditLogFilters, 'limit' | 'offset'> = {}
): Promise<number> {
  const { userId, action, resource, resourceId, startDate, endDate } = filters

  const where: Prisma.AuditLogWhereInput = {
    tenantId,
    ...(userId && { userId }),
    ...(action && { action }),
    ...(resource && { resource }),
    ...(resourceId && { resourceId }),
    ...(startDate || endDate ? {
      createdAt: {
        ...(startDate && { gte: startDate }),
        ...(endDate && { lte: endDate })
      }
    } : {})
  }

  return prisma.auditLog.count({ where })
}
