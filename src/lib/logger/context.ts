/**
 * Request Context Management using AsyncLocalStorage
 * 
 * Provides automatic context propagation for request-scoped data
 * like requestId, tenantId, userId across async boundaries.
 */

import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

// ============================================
// Types
// ============================================

export interface RequestContext {
  /** Unique identifier for this request (UUID v4) */
  requestId: string;
  
  /** Tenant ID for multi-tenant context */
  tenantId?: string;
  
  /** User ID for authenticated requests */
  userId?: string;
  
  /** Session ID for tracking user sessions */
  sessionId?: string;
  
  /** Trace ID for distributed tracing (e.g., OpenTelemetry) */
  traceId?: string;
  
  /** Span ID for distributed tracing */
  spanId?: string;
  
  /** Request start time for duration calculation */
  startTime: number;
  
  /** HTTP method */
  method?: string;
  
  /** Request path */
  path?: string;
  
  /** User agent string */
  userAgent?: string;
  
  /** Client IP address */
  ip?: string;
}

// ============================================
// AsyncLocalStorage Instance
// ============================================

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

// ============================================
// Context Management Functions
// ============================================

/**
 * Get the current request context
 * Returns undefined values if called outside of a request context
 */
export function getRequestContext(): Partial<RequestContext> {
  return asyncLocalStorage.getStore() || {};
}

/**
 * Get a specific field from the request context
 */
export function getContextValue<K extends keyof RequestContext>(key: K): RequestContext[K] | undefined {
  const context = asyncLocalStorage.getStore();
  return context?.[key];
}

/**
 * Get the current request ID (or generate one if not in context)
 */
export function getRequestId(): string {
  return getContextValue('requestId') || randomUUID();
}

/**
 * Get the current tenant ID
 */
export function getTenantId(): string | undefined {
  return getContextValue('tenantId');
}

/**
 * Get the current user ID
 */
export function getUserId(): string | undefined {
  return getContextValue('userId');
}

/**
 * Set/update the request context (merges with existing)
 */
export function setRequestContext(updates: Partial<RequestContext>): void {
  const current = asyncLocalStorage.getStore();
  if (current) {
    Object.assign(current, updates);
  }
}

/**
 * Run a function with a specific request context
 * All async operations within will have access to this context
 */
export function runWithContext<T>(
  context: Partial<RequestContext>,
  fn: () => T
): T {
  const fullContext: RequestContext = {
    requestId: randomUUID(),
    startTime: Date.now(),
    ...context,
  };
  
  return asyncLocalStorage.run(fullContext, fn);
}

/**
 * Run an async function with a specific request context
 */
export async function runWithContextAsync<T>(
  context: Partial<RequestContext>,
  fn: () => Promise<T>
): Promise<T> {
  const fullContext: RequestContext = {
    requestId: randomUUID(),
    startTime: Date.now(),
    ...context,
  };
  
  return asyncLocalStorage.run(fullContext, fn);
}

/**
 * Create a new context with a generated request ID
 */
export function createRequestContext(
  options: Omit<Partial<RequestContext>, 'requestId' | 'startTime'> = {}
): RequestContext {
  return {
    requestId: randomUUID(),
    startTime: Date.now(),
    ...options,
  };
}

// ============================================
// Context Extraction Helpers
// ============================================

/**
 * Extract context from request headers
 */
export function extractContextFromHeaders(headers: Headers | Record<string, string | string[] | undefined>): Partial<RequestContext> {
  const getHeader = (name: string): string | undefined => {
    if (headers instanceof Headers) {
      return headers.get(name) || undefined;
    }
    const value = headers[name];
    return Array.isArray(value) ? value[0] : value;
  };

  return {
    requestId: getHeader('x-request-id') || getHeader('x-correlation-id') || randomUUID(),
    traceId: getHeader('x-trace-id') || getHeader('traceparent')?.split('-')[1],
    spanId: getHeader('x-span-id'),
    tenantId: getHeader('x-tenant-id'),
    userId: getHeader('x-user-id'),
    userAgent: getHeader('user-agent'),
    ip: getHeader('x-forwarded-for')?.split(',')[0]?.trim() || getHeader('x-real-ip'),
  };
}

/**
 * Extract context from a NextAuth session
 */
export function extractContextFromSession(session: { user?: { id?: string; tenantId?: string } } | null): Partial<RequestContext> {
  if (!session?.user) return {};
  
  return {
    userId: session.user.id,
    tenantId: session.user.tenantId,
  };
}

// ============================================
// Response Header Helpers
// ============================================

/**
 * Get headers to add to response for tracing
 */
export function getResponseHeaders(): Record<string, string> {
  const context = asyncLocalStorage.getStore();
  if (!context) return {};

  const headers: Record<string, string> = {};
  
  if (context.requestId) {
    headers['x-request-id'] = context.requestId;
  }
  
  if (context.traceId) {
    headers['x-trace-id'] = context.traceId;
  }

  return headers;
}

// ============================================
// Duration Helpers
// ============================================

/**
 * Get the duration since request start in milliseconds
 */
export function getRequestDuration(): number {
  const startTime = getContextValue('startTime');
  if (!startTime) return 0;
  return Date.now() - startTime;
}

// ============================================
// Middleware Helper
// ============================================

export interface ContextMiddlewareOptions {
  /** Extract tenant ID from request */
  getTenantId?: (req: Request) => string | undefined;
  
  /** Extract user ID from request */
  getUserId?: (req: Request) => string | undefined;
  
  /** Additional context extractor */
  getExtraContext?: (req: Request) => Partial<RequestContext>;
}

/**
 * Create context for a Next.js API route or middleware
 */
export function createNextContext(
  request: Request,
  options?: ContextMiddlewareOptions
): RequestContext {
  const url = new URL(request.url);
  const headerContext = extractContextFromHeaders(request.headers);
  
  return {
    requestId: headerContext.requestId || randomUUID(),
    startTime: Date.now(),
    method: request.method,
    path: url.pathname,
    ...headerContext,
    tenantId: options?.getTenantId?.(request) || headerContext.tenantId,
    userId: options?.getUserId?.(request) || headerContext.userId,
    ...options?.getExtraContext?.(request),
  };
}
