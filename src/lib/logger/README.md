# Structured Logging System

Fast, structured JSON logging for BaaS Dashboard using [Pino](https://github.com/pinojs/pino).

## Features

- 🚀 **Fast** - Pino is one of the fastest Node.js loggers
- 📊 **Structured** - JSON output for easy parsing and analysis
- 🔗 **Request Correlation** - Automatic requestId propagation via AsyncLocalStorage
- 👤 **Context Injection** - Automatic tenantId, userId injection
- 📝 **Audit Logging** - Specialized audit trail for compliance
- 🎯 **Module Loggers** - Pre-configured loggers for different modules
- 🌐 **External Transports** - Ready for Axiom, Logtail, Datadog

## Quick Start

```typescript
import { logger } from '@/lib/logger';

// Simple logging
logger.info('Server started');
logger.error({ err: error }, 'Something went wrong');

// With context
logger.info({ userId: '123', action: 'login' }, 'User logged in');
```

## Log Levels

| Level | When to use |
|-------|-------------|
| `trace` | Very detailed debugging (rarely used in production) |
| `debug` | Development debugging information |
| `info` | Normal operational messages |
| `warn` | Warning conditions, potential issues |
| `error` | Error conditions, failures |
| `fatal` | Critical errors, application crash |

## Module Loggers

Pre-configured loggers for different parts of the application:

```typescript
import { 
  apiLogger, 
  dbLogger, 
  authLogger, 
  webhookLogger, 
  clawdbotLogger,
  billingLogger 
} from '@/lib/logger';

apiLogger.info({ endpoint: '/users' }, 'Request received');
authLogger.warn({ email }, 'Failed login attempt');
dbLogger.error({ err, query }, 'Database query failed');
```

## Request Context

Automatic context propagation across async boundaries:

```typescript
import { runWithContext, getRequestContext } from '@/lib/logger';

// In middleware
runWithContext({ requestId, tenantId, userId }, () => {
  // All logs within this context will include requestId, tenantId, userId
  logger.info('Processing request'); // Includes context automatically
});

// Access context anywhere
const { requestId } = getRequestContext();
```

## Audit Logging

For compliance and security tracking:

```typescript
import { audit, auditSuccess, auditLogin } from '@/lib/logger/audit';

// Login audit
auditLogin({ userId: '123', email: 'user@example.com' }, true);

// Resource changes
auditSuccess('channel.config.change', actor, target, {
  changes: { before: oldConfig, after: newConfig }
});

// Full audit event
audit({
  action: 'user.role.change',
  actor: { userId: adminId, email: adminEmail },
  target: { type: 'user', id: targetUserId },
  outcome: 'success',
  changes: { before: { role: 'member' }, after: { role: 'admin' } },
});
```

## Timing/Performance

Measure operation duration:

```typescript
import { startTiming } from '@/lib/logger';

const timing = startTiming('database-query', { table: 'users' });
// ... perform operation
timing.end({ rowCount: 42 }); // Logs duration automatically
```

## Configuration

Environment variables:

```bash
# Log level (trace, debug, info, warn, error, fatal)
LOG_LEVEL=info

# Output format (json for production, pretty for development)
LOG_FORMAT=json

# External transports
AXIOM_TOKEN=xxx
AXIOM_DATASET=baas-logs

LOGTAIL_TOKEN=xxx

DATADOG_API_KEY=xxx
DATADOG_SITE=datadoghq.com
```

## Output Examples

### Development (pretty)
```
12:34:56.789 INFO  [api] Request received
                   endpoint="/users"
                   method="GET"
                   requestId="abc-123"
```

### Production (JSON)
```json
{
  "level": "info",
  "time": "2024-01-15T12:34:56.789Z",
  "msg": "Request received",
  "module": "api",
  "endpoint": "/users",
  "method": "GET",
  "requestId": "abc-123",
  "tenantId": "tenant-456",
  "env": "production",
  "service": "baas-dashboard"
}
```

## Migration from console.log

Replace:
```typescript
// Before
console.log('User logged in:', userId);
console.error('Error:', error);

// After
import { logger } from '@/lib/logger';
logger.info({ userId }, 'User logged in');
logger.error({ err: error }, 'Operation failed');
```

## Files

- `index.ts` - Main logger, module loggers, helpers
- `context.ts` - AsyncLocalStorage for request context
- `audit.ts` - Audit logging for compliance
- `transports.ts` - External service transports (Axiom, Logtail, Datadog)
