/**
 * Structured Logging System for BaaS Dashboard
 * 
 * Uses pino for fast JSON logging with automatic context injection.
 * - Pretty print in development
 * - JSON output in production
 * - Request correlation via requestId
 * - Tenant/user context when available
 */

import pino, { Logger, LoggerOptions, Level } from 'pino';
import { getRequestContext } from './context';

// ============================================
// Configuration
// ============================================

const LOG_LEVEL = (process.env.LOG_LEVEL || 'info') as Level;
const LOG_FORMAT = process.env.LOG_FORMAT || (process.env.NODE_ENV === 'production' ? 'json' : 'pretty');
const IS_BROWSER = typeof window !== 'undefined';

// ============================================
// Logger Options
// ============================================

function getLoggerOptions(): LoggerOptions {
  const baseOptions: LoggerOptions = {
    level: LOG_LEVEL,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
      bindings: (bindings) => ({
        pid: bindings.pid,
        host: bindings.hostname,
        service: 'baas-dashboard',
      }),
    },
    base: {
      env: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '0.1.0',
    },
  };

  // Browser logging (minimal)
  if (IS_BROWSER) {
    return {
      ...baseOptions,
      browser: {
        asObject: true,
        serialize: true,
      },
    };
  }

  // Pretty print for development
  if (LOG_FORMAT === 'pretty') {
    return {
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname,env,version,service',
          messageFormat: '{msg}',
          errorLikeObjectKeys: ['err', 'error'],
        },
      },
    };
  }

  return baseOptions;
}

// ============================================
// Base Logger Instance
// ============================================

const baseLogger: Logger = pino(getLoggerOptions());

// ============================================
// Contextual Logger
// ============================================

export interface LogContext {
  requestId?: string;
  tenantId?: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  spanId?: string;
  [key: string]: unknown;
}

/**
 * Creates a child logger with automatic request context injection
 */
function createContextualLogger(context?: LogContext): Logger {
  const requestContext = getRequestContext();
  
  const mergedContext: LogContext = {
    ...requestContext,
    ...context,
  };

  // Filter out undefined values
  const cleanContext = Object.fromEntries(
    Object.entries(mergedContext).filter(([_, v]) => v !== undefined)
  );

  if (Object.keys(cleanContext).length === 0) {
    return baseLogger;
  }

  return baseLogger.child(cleanContext);
}

// ============================================
// Main Logger API
// ============================================

export interface StructuredLogger {
  trace: (obj: object | string, msg?: string) => void;
  debug: (obj: object | string, msg?: string) => void;
  info: (obj: object | string, msg?: string) => void;
  warn: (obj: object | string, msg?: string) => void;
  error: (obj: object | string, msg?: string) => void;
  fatal: (obj: object | string, msg?: string) => void;
  child: (context: LogContext) => StructuredLogger;
  withContext: (context: LogContext) => StructuredLogger;
}

function normalizeLogArgs(obj: object | string, msg?: string): [object, string] {
  if (typeof obj === 'string') {
    return [{}, obj];
  }
  return [obj, msg || ''];
}

function createLogger(context?: LogContext): StructuredLogger {
  const pinoLogger = createContextualLogger(context);

  const logger: StructuredLogger = {
    trace: (obj, msg) => {
      const [o, m] = normalizeLogArgs(obj, msg);
      pinoLogger.trace(o, m);
    },
    debug: (obj, msg) => {
      const [o, m] = normalizeLogArgs(obj, msg);
      pinoLogger.debug(o, m);
    },
    info: (obj, msg) => {
      const [o, m] = normalizeLogArgs(obj, msg);
      pinoLogger.info(o, m);
    },
    warn: (obj, msg) => {
      const [o, m] = normalizeLogArgs(obj, msg);
      pinoLogger.warn(o, m);
    },
    error: (obj, msg) => {
      const [o, m] = normalizeLogArgs(obj, msg);
      pinoLogger.error(o, m);
    },
    fatal: (obj, msg) => {
      const [o, m] = normalizeLogArgs(obj, msg);
      pinoLogger.fatal(o, m);
    },
    child: (childContext) => createLogger({ ...context, ...childContext }),
    withContext: (newContext) => createLogger({ ...context, ...newContext }),
  };

  return logger;
}

// ============================================
// Default Logger Instance
// ============================================

export const logger = createLogger();

// ============================================
// Named Loggers for Different Modules
// ============================================

/**
 * Create a named logger for a specific module
 */
export function createNamedLogger(module: string, context?: LogContext): StructuredLogger {
  return createLogger({ module, ...context });
}

// Pre-configured module loggers
export const apiLogger = createNamedLogger('api');
export const dbLogger = createNamedLogger('db');
export const authLogger = createNamedLogger('auth');
export const webhookLogger = createNamedLogger('webhook');
export const clawdbotLogger = createNamedLogger('clawdbot');
export const billingLogger = createNamedLogger('billing');

// ============================================
// Error Logging Helpers
// ============================================

export interface ErrorLogContext extends LogContext {
  err?: Error;
  error?: Error;
  stack?: string;
  code?: string;
  statusCode?: number;
}

/**
 * Log an error with full context
 */
export function logError(
  error: Error | unknown,
  message: string,
  context?: Omit<ErrorLogContext, 'err'>
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  
  logger.error({
    err,
    stack: err.stack,
    code: (err as any).code,
    ...context,
  }, message);
}

/**
 * Log an API error with request context
 */
export function logApiError(
  error: Error | unknown,
  context: {
    method?: string;
    path?: string;
    statusCode?: number;
    [key: string]: unknown;
  }
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  
  apiLogger.error({
    err,
    stack: err.stack,
    ...context,
  }, `API Error: ${err.message}`);
}

// ============================================
// Performance Logging
// ============================================

export interface TimingLogger {
  end: (additionalContext?: object) => number;
}

/**
 * Create a timing logger for measuring operation duration
 */
export function startTiming(operation: string, context?: Partial<LogContext>): TimingLogger {
  const startTime = performance.now();
  const log = createLogger(context);
  
  log.debug({ operation }, `Starting: ${operation}`);

  return {
    end: (additionalContext?: object) => {
      const duration = Math.round(performance.now() - startTime);
      log.info({
        operation,
        durationMs: duration,
        ...additionalContext,
      }, `Completed: ${operation} (${duration}ms)`);
      return duration;
    },
  };
}

// ============================================
// Request Logging
// ============================================

export interface RequestLogData {
  method: string;
  path: string;
  query?: Record<string, string>;
  userAgent?: string;
  ip?: string;
  contentLength?: number;
}

export interface ResponseLogData {
  statusCode: number;
  durationMs: number;
  contentLength?: number;
}

/**
 * Log an incoming HTTP request
 */
export function logRequest(data: RequestLogData, context?: Partial<LogContext>): void {
  const log = createLogger(context as LogContext);
  log.info({
    type: 'request',
    ...data,
  }, `${data.method} ${data.path}`);
}

/**
 * Log an HTTP response
 */
export function logResponse(data: ResponseLogData, context?: Partial<LogContext>): void {
  const log = createLogger(context as LogContext);
  const level = data.statusCode >= 500 ? 'error' : data.statusCode >= 400 ? 'warn' : 'info';
  
  log[level]({
    type: 'response',
    ...data,
  }, `Response ${data.statusCode} (${data.durationMs}ms)`);
}

// ============================================
// Exports
// ============================================

export { getRequestContext, setRequestContext, runWithContext } from './context';
export type { RequestContext } from './context';

// Default export
export default logger;
