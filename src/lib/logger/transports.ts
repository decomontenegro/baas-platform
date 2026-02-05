/**
 * Log Transports Configuration
 * 
 * Configurable transports for sending logs to external services:
 * - Axiom
 * - Logtail (Better Stack)
 * - Datadog
 * - Custom HTTP endpoints
 * 
 * Note: These are prepared but not active by default.
 * Enable by setting the appropriate environment variables.
 */

import type { Level } from 'pino';

// ============================================
// Transport Types
// ============================================

export type TransportType = 'axiom' | 'logtail' | 'datadog' | 'http' | 'console';

export interface TransportConfig {
  type: TransportType;
  enabled: boolean;
  level?: Level;
  options?: Record<string, unknown>;
}

export interface AxiomConfig extends TransportConfig {
  type: 'axiom';
  options: {
    dataset: string;
    token: string;
    orgId?: string;
  };
}

export interface LogtailConfig extends TransportConfig {
  type: 'logtail';
  options: {
    token: string;
    endpoint?: string;
  };
}

export interface DatadogConfig extends TransportConfig {
  type: 'datadog';
  options: {
    apiKey: string;
    site?: string; // datadoghq.com, datadoghq.eu, etc.
    service?: string;
    source?: string;
    tags?: string[];
  };
}

export interface HttpConfig extends TransportConfig {
  type: 'http';
  options: {
    url: string;
    method?: 'POST' | 'PUT';
    headers?: Record<string, string>;
    batchSize?: number;
    flushIntervalMs?: number;
  };
}

// ============================================
// Environment Configuration
// ============================================

/**
 * Get transport configuration from environment variables
 */
export function getTransportConfigs(): TransportConfig[] {
  const configs: TransportConfig[] = [];

  // Axiom
  if (process.env.AXIOM_TOKEN && process.env.AXIOM_DATASET) {
    configs.push({
      type: 'axiom',
      enabled: true,
      options: {
        token: process.env.AXIOM_TOKEN,
        dataset: process.env.AXIOM_DATASET,
        orgId: process.env.AXIOM_ORG_ID,
      },
    } as AxiomConfig);
  }

  // Logtail (Better Stack)
  if (process.env.LOGTAIL_TOKEN) {
    configs.push({
      type: 'logtail',
      enabled: true,
      options: {
        token: process.env.LOGTAIL_TOKEN,
        endpoint: process.env.LOGTAIL_ENDPOINT,
      },
    } as LogtailConfig);
  }

  // Datadog
  if (process.env.DATADOG_API_KEY) {
    configs.push({
      type: 'datadog',
      enabled: true,
      options: {
        apiKey: process.env.DATADOG_API_KEY,
        site: process.env.DATADOG_SITE || 'datadoghq.com',
        service: process.env.DATADOG_SERVICE || 'baas-dashboard',
        source: 'nodejs',
        tags: process.env.DATADOG_TAGS?.split(',') || [],
      },
    } as DatadogConfig);
  }

  // Custom HTTP
  if (process.env.LOG_HTTP_URL) {
    configs.push({
      type: 'http',
      enabled: true,
      options: {
        url: process.env.LOG_HTTP_URL,
        method: (process.env.LOG_HTTP_METHOD as 'POST' | 'PUT') || 'POST',
        headers: process.env.LOG_HTTP_HEADERS ? JSON.parse(process.env.LOG_HTTP_HEADERS) : {},
        batchSize: parseInt(process.env.LOG_HTTP_BATCH_SIZE || '100', 10),
        flushIntervalMs: parseInt(process.env.LOG_HTTP_FLUSH_MS || '5000', 10),
      },
    } as HttpConfig);
  }

  return configs;
}

// ============================================
// Pino Transport Configuration
// ============================================

/**
 * Get pino transport targets for external services
 * Use with pino's `transport` option
 */
export function getPinoTransports(): object | undefined {
  const configs = getTransportConfigs();
  
  if (configs.length === 0) {
    return undefined;
  }

  const targets: Array<{
    target: string;
    level?: string;
    options: Record<string, unknown>;
  }> = [];

  for (const config of configs) {
    if (!config.enabled) continue;

    switch (config.type) {
      case 'axiom':
        // Note: Requires @axiomhq/pino package
        targets.push({
          target: '@axiomhq/pino',
          level: config.level,
          options: {
            dataset: (config as AxiomConfig).options.dataset,
            token: (config as AxiomConfig).options.token,
            orgId: (config as AxiomConfig).options.orgId,
          },
        });
        break;

      case 'logtail':
        // Note: Requires @logtail/pino package
        targets.push({
          target: '@logtail/pino',
          level: config.level,
          options: {
            sourceToken: (config as LogtailConfig).options.token,
          },
        });
        break;

      case 'datadog':
        // Note: Requires pino-datadog package
        targets.push({
          target: 'pino-datadog-transport',
          level: config.level,
          options: {
            apiKey: (config as DatadogConfig).options.apiKey,
            ddtags: (config as DatadogConfig).options.tags?.join(','),
            ddsource: (config as DatadogConfig).options.source,
            service: (config as DatadogConfig).options.service,
            site: (config as DatadogConfig).options.site,
          },
        });
        break;

      case 'http':
        // Use pino-http-send for generic HTTP
        targets.push({
          target: 'pino-http-send',
          level: config.level,
          options: {
            url: (config as HttpConfig).options.url,
            method: (config as HttpConfig).options.method,
            headers: (config as HttpConfig).options.headers,
            batchSize: (config as HttpConfig).options.batchSize,
            interval: (config as HttpConfig).options.flushIntervalMs,
          },
        });
        break;
    }
  }

  if (targets.length === 0) {
    return undefined;
  }

  // For single target, return directly
  if (targets.length === 1) {
    return {
      target: targets[0].target,
      level: targets[0].level,
      options: targets[0].options,
    };
  }

  // For multiple targets, use pino.transport with targets array
  return {
    targets,
  };
}

// ============================================
// Manual Transport Functions
// ============================================

/**
 * Send logs to Axiom directly (without pino transport)
 * Useful for batch sending or when transport is not available
 */
export async function sendToAxiom(
  logs: Record<string, unknown>[],
  config: AxiomConfig['options']
): Promise<void> {
  const url = `https://api.axiom.co/v1/datasets/${config.dataset}/ingest`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.token}`,
      ...(config.orgId ? { 'X-Axiom-Org-Id': config.orgId } : {}),
    },
    body: JSON.stringify(logs),
  });

  if (!response.ok) {
    throw new Error(`Axiom ingest failed: ${response.status} ${await response.text()}`);
  }
}

/**
 * Send logs to Logtail directly
 */
export async function sendToLogtail(
  logs: Record<string, unknown>[],
  config: LogtailConfig['options']
): Promise<void> {
  const url = config.endpoint || 'https://in.logs.betterstack.com';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.token}`,
    },
    body: JSON.stringify(logs),
  });

  if (!response.ok) {
    throw new Error(`Logtail ingest failed: ${response.status} ${await response.text()}`);
  }
}

/**
 * Send logs to Datadog directly
 */
export async function sendToDatadog(
  logs: Record<string, unknown>[],
  config: DatadogConfig['options']
): Promise<void> {
  const site = config.site || 'datadoghq.com';
  const url = `https://http-intake.logs.${site}/api/v2/logs`;
  
  // Format logs for Datadog
  const formattedLogs = logs.map(log => ({
    ...log,
    ddsource: config.source || 'nodejs',
    ddtags: config.tags?.join(',') || '',
    service: config.service || 'baas-dashboard',
  }));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DD-API-KEY': config.apiKey,
    },
    body: JSON.stringify(formattedLogs),
  });

  if (!response.ok) {
    throw new Error(`Datadog ingest failed: ${response.status} ${await response.text()}`);
  }
}

// ============================================
// Environment Variables Documentation
// ============================================

/**
 * Environment variables for log transports:
 * 
 * Axiom:
 *   AXIOM_TOKEN=xxx
 *   AXIOM_DATASET=baas-logs
 *   AXIOM_ORG_ID=xxx (optional)
 * 
 * Logtail (Better Stack):
 *   LOGTAIL_TOKEN=xxx
 *   LOGTAIL_ENDPOINT=xxx (optional, defaults to Better Stack)
 * 
 * Datadog:
 *   DATADOG_API_KEY=xxx
 *   DATADOG_SITE=datadoghq.com (optional)
 *   DATADOG_SERVICE=baas-dashboard (optional)
 *   DATADOG_TAGS=env:prod,version:1.0 (optional)
 * 
 * Custom HTTP:
 *   LOG_HTTP_URL=https://your-log-endpoint.com/ingest
 *   LOG_HTTP_METHOD=POST (optional)
 *   LOG_HTTP_HEADERS={"Authorization":"Bearer xxx"} (optional, JSON)
 *   LOG_HTTP_BATCH_SIZE=100 (optional)
 *   LOG_HTTP_FLUSH_MS=5000 (optional)
 */
