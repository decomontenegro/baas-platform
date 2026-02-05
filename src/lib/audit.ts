/**
 * Audit Log Library
 * 
 * Centralized audit logging for compliance and security.
 * All significant actions are logged with full context.
 */

import { prisma } from './prisma';
import { headers } from 'next/headers';

// ============================================================================
// TYPES
// ============================================================================

export type AuditAction =
  // Authentication
  | 'auth.login'
  | 'auth.logout'
  | 'auth.failed'
  | 'auth.password_changed'
  | 'auth.mfa_enabled'
  | 'auth.mfa_disabled'
  // Users
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.restored'
  // Team
  | 'team.invited'
  | 'team.joined'
  | 'team.removed'
  | 'team.role_changed'
  | 'team.permissions_changed'
  // Bots
  | 'bot.created'
  | 'bot.updated'
  | 'bot.deleted'
  | 'bot.activated'
  | 'bot.deactivated'
  // Channels
  | 'channel.created'
  | 'channel.connected'
  | 'channel.disconnected'
  | 'channel.deleted'
  | 'channel.config_changed'
  // Knowledge Base
  | 'knowledge.created'
  | 'knowledge.uploaded'
  | 'knowledge.deleted'
  | 'knowledge.updated'
  // Settings
  | 'settings.changed'
  | 'settings.api_key_created'
  | 'settings.api_key_revoked'
  | 'settings.webhook_created'
  | 'settings.webhook_deleted'
  // Billing
  | 'billing.upgraded'
  | 'billing.downgraded'
  | 'billing.payment'
  | 'billing.payment_failed'
  | 'billing.cancelled'
  // Data/LGPD
  | 'data.exported'
  | 'data.deleted'
  | 'data.anonymized'
  | 'gdpr.request_created'
  | 'gdpr.request_completed'
  // Security Alerts
  | 'security.multiple_login_failures'
  | 'security.new_ip_detected'
  | 'security.bulk_action'
  | 'security.permission_escalation'
  | 'security.suspicious_activity';

export type AuditResource =
  | 'user'
  | 'team'
  | 'tenant'
  | 'bot'
  | 'channel'
  | 'knowledge'
  | 'document'
  | 'settings'
  | 'api_key'
  | 'webhook'
  | 'subscription'
  | 'invoice'
  | 'conversation'
  | 'message'
  | 'gdpr_request';

export interface AuditLogData {
  tenantId?: string | null;
  userId?: string | null;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditLogEntry {
  id: string;
  tenantId: string | null;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  oldData: unknown;
  newData: unknown;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  user?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
}

// ============================================================================
// MAIN LOGGING FUNCTION
// ============================================================================

/**
 * Log an audit event
 * 
 * @param data - Audit log data
 * @returns The created audit log entry
 * 
 * @example
 * await audit.log({
 *   tenantId: 'tenant123',
 *   userId: 'user456',
 *   action: 'user.updated',
 *   resource: 'user',
 *   resourceId: 'user789',
 *   oldValue: { name: 'John' },
 *   newValue: { name: 'John Doe' },
 * });
 */
export async function log(data: AuditLogData): Promise<AuditLogEntry> {
  // Try to get request context if not provided
  let ipAddress = data.ipAddress;
  let userAgent = data.userAgent;

  if (!ipAddress || !userAgent) {
    try {
      const headersList = await headers();
      ipAddress = ipAddress || 
        headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        headersList.get('x-real-ip') ||
        null;
      userAgent = userAgent || headersList.get('user-agent') || null;
    } catch {
      // Headers not available (e.g., in background job)
    }
  }

  const entry = await prisma.auditLog.create({
    data: {
      tenantId: data.tenantId || null,
      userId: data.userId || null,
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId || null,
      oldData: data.oldValue || null,
      newData: data.newValue || null,
      metadata: data.metadata || {},
      ipAddress,
      userAgent,
    },
  });

  // Check for security alerts
  await checkSecurityAlerts(data);

  return entry as AuditLogEntry;
}

// ============================================================================
// SECURITY ALERT DETECTION
// ============================================================================

const LOGIN_FAILURE_THRESHOLD = 5;
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const BULK_ACTION_THRESHOLD = 10;
const BULK_ACTION_WINDOW_MS = 60 * 1000; // 1 minute

async function checkSecurityAlerts(data: AuditLogData): Promise<void> {
  // Check for multiple login failures
  if (data.action === 'auth.failed' && data.metadata?.email) {
    const windowStart = new Date(Date.now() - LOGIN_FAILURE_WINDOW_MS);
    
    const failureCount = await prisma.auditLog.count({
      where: {
        action: 'auth.failed',
        createdAt: { gte: windowStart },
        metadata: {
          path: ['email'],
          equals: data.metadata.email,
        },
      },
    });

    if (failureCount >= LOGIN_FAILURE_THRESHOLD) {
      await log({
        tenantId: data.tenantId,
        userId: null,
        action: 'security.multiple_login_failures',
        resource: 'user',
        metadata: {
          email: data.metadata.email,
          failureCount,
          windowMinutes: LOGIN_FAILURE_WINDOW_MS / 60000,
        },
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      });
    }
  }

  // Check for new IP detection
  if (data.action === 'auth.login' && data.userId && data.ipAddress) {
    const knownIp = await prisma.auditLog.findFirst({
      where: {
        userId: data.userId,
        action: 'auth.login',
        ipAddress: data.ipAddress,
        createdAt: {
          lt: new Date(Date.now() - 1000), // Exclude current login
        },
      },
    });

    if (!knownIp) {
      await log({
        tenantId: data.tenantId,
        userId: data.userId,
        action: 'security.new_ip_detected',
        resource: 'user',
        metadata: {
          newIpAddress: data.ipAddress,
          isFirstLogin: true,
        },
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      });
    }
  }

  // Check for bulk actions (mass delete, export)
  if (data.action.includes('.deleted') || data.action === 'data.exported') {
    const windowStart = new Date(Date.now() - BULK_ACTION_WINDOW_MS);
    
    const actionCount = await prisma.auditLog.count({
      where: {
        userId: data.userId,
        action: data.action,
        createdAt: { gte: windowStart },
      },
    });

    if (actionCount >= BULK_ACTION_THRESHOLD) {
      await log({
        tenantId: data.tenantId,
        userId: data.userId,
        action: 'security.bulk_action',
        resource: data.resource,
        metadata: {
          actionType: data.action,
          actionCount,
          windowSeconds: BULK_ACTION_WINDOW_MS / 1000,
        },
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      });
    }
  }

  // Check for permission escalation
  if (data.action === 'team.role_changed' || data.action === 'team.permissions_changed') {
    const oldRole = (data.oldValue as Record<string, unknown>)?.role;
    const newRole = (data.newValue as Record<string, unknown>)?.role;
    
    const roleHierarchy = ['VIEWER', 'OPERATOR', 'MANAGER', 'ADMIN', 'OWNER'];
    const oldIndex = roleHierarchy.indexOf(oldRole as string);
    const newIndex = roleHierarchy.indexOf(newRole as string);

    if (newIndex > oldIndex && newIndex >= roleHierarchy.indexOf('ADMIN')) {
      await log({
        tenantId: data.tenantId,
        userId: data.userId,
        action: 'security.permission_escalation',
        resource: 'team',
        resourceId: data.resourceId,
        metadata: {
          targetUserId: data.resourceId,
          fromRole: oldRole,
          toRole: newRole,
          changedBy: data.userId,
        },
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      });
    }
  }
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

export interface AuditLogFilters {
  tenantId?: string;
  userId?: string;
  action?: string | string[];
  resource?: string | string[];
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  ipAddress?: string;
}

export interface PaginatedAuditLogs {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Query audit logs with filters and pagination
 */
export async function query(
  filters: AuditLogFilters,
  page = 1,
  pageSize = 50
): Promise<PaginatedAuditLogs> {
  const where: Record<string, unknown> = {};

  if (filters.tenantId) {
    where.tenantId = filters.tenantId;
  }

  if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.action) {
    where.action = Array.isArray(filters.action) 
      ? { in: filters.action }
      : filters.action;
  }

  if (filters.resource) {
    where.resource = Array.isArray(filters.resource)
      ? { in: filters.resource }
      : filters.resource;
  }

  if (filters.resourceId) {
    where.resourceId = filters.resourceId;
  }

  if (filters.ipAddress) {
    where.ipAddress = filters.ipAddress;
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {
      ...(filters.startDate && { gte: filters.startDate }),
      ...(filters.endDate && { lte: filters.endDate }),
    };
  }

  // Search in action and resource
  if (filters.search) {
    where.OR = [
      { action: { contains: filters.search, mode: 'insensitive' } },
      { resource: { contains: filters.search, mode: 'insensitive' } },
      { resourceId: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs: logs as AuditLogEntry[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Get a single audit log entry by ID
 */
export async function getById(id: string): Promise<AuditLogEntry | null> {
  const log = await prisma.auditLog.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  return log as AuditLogEntry | null;
}

/**
 * Get audit logs for a specific resource
 */
export async function getResourceHistory(
  resource: AuditResource,
  resourceId: string,
  limit = 50
): Promise<AuditLogEntry[]> {
  const logs = await prisma.auditLog.findMany({
    where: {
      resource,
      resourceId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return logs as AuditLogEntry[];
}

/**
 * Get user activity summary
 */
export async function getUserActivity(
  userId: string,
  tenantId?: string,
  days = 30
): Promise<{
  totalActions: number;
  actionsByType: Record<string, number>;
  recentActions: AuditLogEntry[];
  ipAddresses: string[];
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const where = {
    userId,
    createdAt: { gte: startDate },
    ...(tenantId && { tenantId }),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const actionsByType: Record<string, number> = {};
  const ipSet = new Set<string>();

  logs.forEach((log) => {
    actionsByType[log.action] = (actionsByType[log.action] || 0) + 1;
    if (log.ipAddress) ipSet.add(log.ipAddress);
  });

  return {
    totalActions: total,
    actionsByType,
    recentActions: logs.slice(0, 20) as AuditLogEntry[],
    ipAddresses: Array.from(ipSet),
  };
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Export audit logs to CSV format
 */
export async function exportToCsv(
  filters: AuditLogFilters,
  maxRecords = 10000
): Promise<string> {
  const where: Record<string, unknown> = {};

  if (filters.tenantId) where.tenantId = filters.tenantId;
  if (filters.userId) where.userId = filters.userId;
  if (filters.action) where.action = Array.isArray(filters.action) 
    ? { in: filters.action } 
    : filters.action;
  if (filters.resource) where.resource = Array.isArray(filters.resource)
    ? { in: filters.resource }
    : filters.resource;
  if (filters.startDate || filters.endDate) {
    where.createdAt = {
      ...(filters.startDate && { gte: filters.startDate }),
      ...(filters.endDate && { lte: filters.endDate }),
    };
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: maxRecords,
  });

  // CSV headers
  const headers = [
    'ID',
    'Timestamp',
    'User Email',
    'User Name',
    'Action',
    'Resource',
    'Resource ID',
    'IP Address',
    'User Agent',
    'Old Value',
    'New Value',
    'Metadata',
  ];

  const rows = logs.map((log) => [
    log.id,
    log.createdAt.toISOString(),
    log.user?.email || '',
    log.user?.name || '',
    log.action,
    log.resource,
    log.resourceId || '',
    log.ipAddress || '',
    log.userAgent || '',
    log.oldData ? JSON.stringify(log.oldData) : '',
    log.newData ? JSON.stringify(log.newData) : '',
    JSON.stringify(log.metadata),
  ]);

  // Escape CSV values
  const escapeCsv = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\n');

  return csvContent;
}

// ============================================================================
// RETENTION & ARCHIVAL
// ============================================================================

/**
 * Get logs that are ready for archival (older than 90 days)
 */
export async function getLogsForArchival(
  tenantId: string,
  batchSize = 1000
): Promise<AuditLogEntry[]> {
  const archiveDate = new Date();
  archiveDate.setDate(archiveDate.getDate() - 90);

  const logs = await prisma.auditLog.findMany({
    where: {
      tenantId,
      createdAt: { lt: archiveDate },
    },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
  });

  return logs as AuditLogEntry[];
}

/**
 * Archive old logs to cold storage
 * This should be called by a scheduled job
 */
export async function archiveOldLogs(
  tenantId: string,
  archiveToUrl: string,
  batchSize = 1000
): Promise<{ archivedCount: number; archiveUrl: string }> {
  const logs = await getLogsForArchival(tenantId, batchSize);
  
  if (logs.length === 0) {
    return { archivedCount: 0, archiveUrl: '' };
  }

  // Here you would implement the actual archival logic:
  // 1. Upload logs to S3/GCS cold storage
  // 2. Delete archived logs from the database
  // 
  // For now, we just return the count
  // In production, implement the actual upload:
  //
  // const archiveData = JSON.stringify(logs);
  // await uploadToS3(archiveToUrl, archiveData);
  // await prisma.auditLog.deleteMany({
  //   where: { id: { in: logs.map(l => l.id) } },
  // });

  return {
    archivedCount: logs.length,
    archiveUrl: `${archiveToUrl}/${tenantId}/${new Date().toISOString()}.json`,
  };
}

/**
 * Get retention statistics for a tenant
 */
export async function getRetentionStats(tenantId: string): Promise<{
  totalLogs: number;
  logsLast30Days: number;
  logsLast90Days: number;
  oldestLog: Date | null;
  newestLog: Date | null;
  storageEstimateKb: number;
}> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [
    totalLogs,
    logsLast30Days,
    logsLast90Days,
    oldestLog,
    newestLog,
  ] = await Promise.all([
    prisma.auditLog.count({ where: { tenantId } }),
    prisma.auditLog.count({ where: { tenantId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.auditLog.count({ where: { tenantId, createdAt: { gte: ninetyDaysAgo } } }),
    prisma.auditLog.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' } }),
    prisma.auditLog.findFirst({ where: { tenantId }, orderBy: { createdAt: 'desc' } }),
  ]);

  // Rough estimate: ~500 bytes per log entry
  const storageEstimateKb = Math.round((totalLogs * 500) / 1024);

  return {
    totalLogs,
    logsLast30Days,
    logsLast90Days,
    oldestLog: oldestLog?.createdAt || null,
    newestLog: newestLog?.createdAt || null,
    storageEstimateKb,
  };
}

// ============================================================================
// SECURITY ALERT QUERIES
// ============================================================================

/**
 * Get recent security alerts for a tenant
 */
export async function getSecurityAlerts(
  tenantId: string,
  days = 7,
  limit = 50
): Promise<AuditLogEntry[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const logs = await prisma.auditLog.findMany({
    where: {
      tenantId,
      action: {
        startsWith: 'security.',
      },
      createdAt: { gte: startDate },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return logs as AuditLogEntry[];
}

// ============================================================================
// CONVENIENCE HELPERS
// ============================================================================

/**
 * Log a user action with automatic context extraction
 */
export async function logUserAction(
  userId: string,
  tenantId: string | null,
  action: AuditAction,
  resource: AuditResource,
  resourceId?: string,
  changes?: { old?: Record<string, unknown>; new?: Record<string, unknown> },
  metadata?: Record<string, unknown>
): Promise<AuditLogEntry> {
  return log({
    userId,
    tenantId,
    action,
    resource,
    resourceId,
    oldValue: changes?.old,
    newValue: changes?.new,
    metadata,
  });
}

/**
 * Compare two objects and return the differences
 */
export function diffObjects(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  sensitiveFields: string[] = ['password', 'secret', 'token', 'apiKey']
): { old: Record<string, unknown>; new: Record<string, unknown> } {
  const old: Record<string, unknown> = {};
  const changed: Record<string, unknown> = {};

  // Find changed and removed fields
  for (const key of Object.keys(oldObj)) {
    if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
      if (sensitiveFields.includes(key)) {
        old[key] = '[REDACTED]';
        if (key in newObj) changed[key] = '[REDACTED]';
      } else {
        old[key] = oldObj[key];
        if (key in newObj) changed[key] = newObj[key];
      }
    }
  }

  // Find new fields
  for (const key of Object.keys(newObj)) {
    if (!(key in oldObj)) {
      if (sensitiveFields.includes(key)) {
        changed[key] = '[REDACTED]';
      } else {
        changed[key] = newObj[key];
      }
    }
  }

  return { old, new: changed };
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

const audit = {
  log,
  query,
  getById,
  getResourceHistory,
  getUserActivity,
  exportToCsv,
  getLogsForArchival,
  archiveOldLogs,
  getRetentionStats,
  getSecurityAlerts,
  logUserAction,
  diffObjects,
};

export default audit;
