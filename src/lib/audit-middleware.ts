/**
 * Audit Middleware
 * 
 * Utilities for automatic audit logging in API routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import audit, { type AuditAction, type AuditResource } from './audit';

// ============================================================================
// TYPES
// ============================================================================

type AsyncHandler<T = unknown> = (
  req: NextRequest,
  context?: { params?: Record<string, string | Promise<Record<string, string>>> }
) => Promise<NextResponse<T>>;

interface AuditOptions {
  action: AuditAction;
  resource: AuditResource;
  getResourceId?: (req: NextRequest, context?: unknown) => string | undefined;
  getMetadata?: (req: NextRequest, body?: unknown, response?: unknown) => Record<string, unknown>;
  logOnSuccess?: boolean;
  logOnFailure?: boolean;
}

// ============================================================================
// WITH AUDIT WRAPPER
// ============================================================================

/**
 * Wraps an API handler with automatic audit logging.
 * 
 * @example
 * export const DELETE = withAudit(
 *   async (req) => {
 *     // ... handler logic
 *     return NextResponse.json({ success: true });
 *   },
 *   {
 *     action: 'user.deleted',
 *     resource: 'user',
 *     getResourceId: (req) => req.nextUrl.searchParams.get('id') || undefined,
 *   }
 * );
 */
export function withAudit<T>(
  handler: AsyncHandler<T>,
  options: AuditOptions
): AsyncHandler<T> {
  return async (req: NextRequest, context?: unknown) => {
    const startTime = Date.now();
    let body: unknown = null;
    let response: NextResponse<T> | null = null;
    let error: Error | null = null;

    try {
      // Parse body if needed
      const contentType = req.headers.get('content-type');
      if (contentType?.includes('application/json') && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
        try {
          body = await req.clone().json();
        } catch {
          // Body not JSON
        }
      }

      // Execute handler
      response = await handler(req, context as { params?: Record<string, string | Promise<Record<string, string>>> });
    } catch (err) {
      error = err as Error;
      throw err;
    } finally {
      const session = await getServerSession(authOptions);
      const tenantId = req.headers.get('x-tenant-id') || 
                       req.nextUrl.searchParams.get('tenantId') ||
                       null;

      const isSuccess = response?.status && response.status >= 200 && response.status < 300;
      const shouldLog = (isSuccess && options.logOnSuccess !== false) ||
                        (!isSuccess && options.logOnFailure !== false);

      if (shouldLog) {
        try {
          const resourceId = options.getResourceId?.(req, context);
          const metadata = options.getMetadata?.(req, body, response) || {};

          await audit.log({
            tenantId,
            userId: session?.user?.id || null,
            action: options.action,
            resource: options.resource,
            resourceId,
            metadata: {
              ...metadata,
              success: isSuccess,
              statusCode: response?.status,
              durationMs: Date.now() - startTime,
              method: req.method,
              path: req.nextUrl.pathname,
              ...(error && { error: error.message }),
            },
          });
        } catch (logError) {
          console.error('[Audit Middleware] Failed to log:', logError);
        }
      }
    }

    return response!;
  };
}

// ============================================================================
// AUDIT HELPERS FOR COMMON PATTERNS
// ============================================================================

/**
 * Log authentication events
 */
export async function logAuthEvent(
  action: 'auth.login' | 'auth.logout' | 'auth.failed',
  email: string,
  userId?: string | null,
  tenantId?: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  await audit.log({
    tenantId: tenantId || null,
    userId: userId || null,
    action,
    resource: 'user',
    metadata: {
      email,
      ...metadata,
    },
  });
}

/**
 * Log resource creation
 */
export async function logCreate<T extends Record<string, unknown>>(
  userId: string,
  tenantId: string,
  resource: AuditResource,
  resourceId: string,
  data: T
): Promise<void> {
  const action = `${resource}.created` as AuditAction;
  
  await audit.log({
    tenantId,
    userId,
    action,
    resource,
    resourceId,
    newValue: data,
  });
}

/**
 * Log resource update with diff
 */
export async function logUpdate<T extends Record<string, unknown>>(
  userId: string,
  tenantId: string,
  resource: AuditResource,
  resourceId: string,
  oldData: T,
  newData: T
): Promise<void> {
  const action = `${resource}.updated` as AuditAction;
  const diff = audit.diffObjects(
    oldData as Record<string, unknown>,
    newData as Record<string, unknown>
  );
  
  await audit.log({
    tenantId,
    userId,
    action,
    resource,
    resourceId,
    oldValue: diff.old,
    newValue: diff.new,
  });
}

/**
 * Log resource deletion
 */
export async function logDelete(
  userId: string,
  tenantId: string,
  resource: AuditResource,
  resourceId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const action = `${resource}.deleted` as AuditAction;
  
  await audit.log({
    tenantId,
    userId,
    action,
    resource,
    resourceId,
    metadata,
  });
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  withAudit,
  logAuthEvent,
  logCreate,
  logUpdate,
  logDelete,
};
