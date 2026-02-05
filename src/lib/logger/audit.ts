/**
 * Audit Logger for BaaS Dashboard
 * 
 * Specialized logger for audit events that tracks:
 * - WHO performed the action
 * - WHAT action was performed
 * - WHEN it happened
 * - WHERE it happened (resource, endpoint)
 * - OUTCOME (success/failure, before/after state)
 */

import { createNamedLogger, LogContext } from './index';
import { getRequestContext } from './context';

// ============================================
// Types
// ============================================

export type AuditAction =
  // Authentication
  | 'auth.login'
  | 'auth.logout'
  | 'auth.login.failed'
  | 'auth.password.change'
  | 'auth.mfa.enable'
  | 'auth.mfa.disable'
  | 'auth.session.revoke'
  
  // User Management
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'user.invite'
  | 'user.role.change'
  
  // Tenant/Organization
  | 'tenant.create'
  | 'tenant.update'
  | 'tenant.delete'
  | 'tenant.member.add'
  | 'tenant.member.remove'
  | 'tenant.member.role.change'
  
  // Channels (WhatsApp groups, etc.)
  | 'channel.create'
  | 'channel.update'
  | 'channel.delete'
  | 'channel.enable'
  | 'channel.disable'
  | 'channel.config.change'
  
  // Personalities/Bots
  | 'personality.create'
  | 'personality.update'
  | 'personality.delete'
  | 'personality.publish'
  
  // API Keys
  | 'apikey.create'
  | 'apikey.revoke'
  | 'apikey.rotate'
  
  // Billing
  | 'billing.plan.change'
  | 'billing.payment.success'
  | 'billing.payment.failed'
  | 'billing.invoice.created'
  
  // Webhooks
  | 'webhook.create'
  | 'webhook.update'
  | 'webhook.delete'
  
  // Data Operations
  | 'data.export'
  | 'data.import'
  | 'data.delete'
  
  // Settings
  | 'settings.update'
  
  // Generic
  | 'resource.create'
  | 'resource.update'
  | 'resource.delete';

export type AuditOutcome = 'success' | 'failure' | 'denied' | 'error';

export interface AuditActor {
  /** User ID who performed the action */
  userId?: string;
  
  /** User email */
  email?: string;
  
  /** User name */
  name?: string;
  
  /** IP address */
  ip?: string;
  
  /** User agent */
  userAgent?: string;
  
  /** Session ID */
  sessionId?: string;
  
  /** API Key ID (for automated actions) */
  apiKeyId?: string;
  
  /** System action (no human actor) */
  system?: boolean;
}

export interface AuditTarget {
  /** Resource type (user, channel, tenant, etc.) */
  type: string;
  
  /** Resource ID */
  id: string;
  
  /** Resource name for display */
  name?: string;
  
  /** Parent resource (e.g., tenant for a channel) */
  parent?: {
    type: string;
    id: string;
    name?: string;
  };
}

export interface AuditEvent {
  /** What action was performed */
  action: AuditAction;
  
  /** WHO performed it */
  actor: AuditActor;
  
  /** WHAT resource was affected */
  target?: AuditTarget;
  
  /** WHEN it happened (ISO timestamp) */
  timestamp: string;
  
  /** WHERE in the app (endpoint, component) */
  source?: string;
  
  /** OUTCOME of the action */
  outcome: AuditOutcome;
  
  /** Error message if outcome is failure/error */
  error?: string;
  
  /** Changes made (before/after for updates) */
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    fields?: string[];
  };
  
  /** Additional context */
  metadata?: Record<string, unknown>;
  
  /** Tenant context */
  tenantId?: string;
  
  /** Request ID for correlation */
  requestId?: string;
  
  /** Reason for the action (if provided) */
  reason?: string;
}

// ============================================
// Audit Logger
// ============================================

const auditLogger = createNamedLogger('audit');

/**
 * Log an audit event
 */
export function audit(event: Omit<AuditEvent, 'timestamp' | 'requestId'> & { timestamp?: string; requestId?: string }): void {
  const context = getRequestContext();
  
  const fullEvent: AuditEvent = {
    ...event,
    timestamp: event.timestamp || new Date().toISOString(),
    requestId: event.requestId || context.requestId,
    tenantId: event.tenantId || context.tenantId,
    actor: {
      ...event.actor,
      userId: event.actor.userId || context.userId,
      ip: event.actor.ip || context.ip,
      userAgent: event.actor.userAgent || context.userAgent,
      sessionId: event.actor.sessionId || context.sessionId,
    },
  };

  // Log at appropriate level based on outcome
  switch (fullEvent.outcome) {
    case 'error':
      auditLogger.error({ audit: fullEvent }, formatAuditMessage(fullEvent));
      break;
    case 'denied':
      auditLogger.warn({ audit: fullEvent }, formatAuditMessage(fullEvent));
      break;
    case 'failure':
      auditLogger.warn({ audit: fullEvent }, formatAuditMessage(fullEvent));
      break;
    default:
      auditLogger.info({ audit: fullEvent }, formatAuditMessage(fullEvent));
  }
}

/**
 * Format audit event into a human-readable message
 */
function formatAuditMessage(event: AuditEvent): string {
  const actor = event.actor.email || event.actor.userId || (event.actor.system ? 'SYSTEM' : 'UNKNOWN');
  const target = event.target ? `${event.target.type}:${event.target.id}` : '';
  const outcome = event.outcome.toUpperCase();
  
  let message = `[AUDIT] ${event.action} by ${actor}`;
  if (target) message += ` on ${target}`;
  message += ` - ${outcome}`;
  if (event.error) message += `: ${event.error}`;
  
  return message;
}

// ============================================
// Convenience Functions
// ============================================

/**
 * Log a successful action
 */
export function auditSuccess(
  action: AuditAction,
  actor: AuditActor,
  target?: AuditTarget,
  options?: {
    changes?: AuditEvent['changes'];
    metadata?: Record<string, unknown>;
    reason?: string;
    source?: string;
  }
): void {
  audit({
    action,
    actor,
    target,
    outcome: 'success',
    ...options,
  });
}

/**
 * Log a failed action
 */
export function auditFailure(
  action: AuditAction,
  actor: AuditActor,
  error: string | Error,
  target?: AuditTarget,
  options?: {
    metadata?: Record<string, unknown>;
    source?: string;
  }
): void {
  audit({
    action,
    actor,
    target,
    outcome: 'failure',
    error: error instanceof Error ? error.message : error,
    ...options,
  });
}

/**
 * Log a denied action (authorization failure)
 */
export function auditDenied(
  action: AuditAction,
  actor: AuditActor,
  target?: AuditTarget,
  reason?: string,
  options?: {
    metadata?: Record<string, unknown>;
    source?: string;
  }
): void {
  audit({
    action,
    actor,
    target,
    outcome: 'denied',
    reason: reason || 'Permission denied',
    ...options,
  });
}

// ============================================
// Authentication Audit Helpers
// ============================================

export function auditLogin(actor: AuditActor, success: boolean, error?: string): void {
  audit({
    action: success ? 'auth.login' : 'auth.login.failed',
    actor,
    outcome: success ? 'success' : 'failure',
    error,
    source: 'auth',
  });
}

export function auditLogout(actor: AuditActor): void {
  audit({
    action: 'auth.logout',
    actor,
    outcome: 'success',
    source: 'auth',
  });
}

// ============================================
// Resource Audit Helpers
// ============================================

/**
 * Log a resource creation
 */
export function auditCreate(
  resourceType: string,
  resourceId: string,
  actor: AuditActor,
  data?: Record<string, unknown>
): void {
  audit({
    action: 'resource.create',
    actor,
    target: { type: resourceType, id: resourceId },
    outcome: 'success',
    changes: data ? { after: data } : undefined,
  });
}

/**
 * Log a resource update
 */
export function auditUpdate(
  resourceType: string,
  resourceId: string,
  actor: AuditActor,
  changes: { before?: Record<string, unknown>; after?: Record<string, unknown>; fields?: string[] }
): void {
  audit({
    action: 'resource.update',
    actor,
    target: { type: resourceType, id: resourceId },
    outcome: 'success',
    changes,
  });
}

/**
 * Log a resource deletion
 */
export function auditDelete(
  resourceType: string,
  resourceId: string,
  actor: AuditActor,
  reason?: string
): void {
  audit({
    action: 'resource.delete',
    actor,
    target: { type: resourceType, id: resourceId },
    outcome: 'success',
    reason,
  });
}

// ============================================
// Channel-specific Audit Helpers
// ============================================

export function auditChannelConfigChange(
  channelId: string,
  channelName: string,
  actor: AuditActor,
  changes: { before?: Record<string, unknown>; after?: Record<string, unknown>; fields?: string[] }
): void {
  audit({
    action: 'channel.config.change',
    actor,
    target: { type: 'channel', id: channelId, name: channelName },
    outcome: 'success',
    changes,
  });
}

// ============================================
// Export Types
// ============================================

export type { LogContext };
