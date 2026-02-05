/**
 * Webhook Notifier for Admin Agent
 * 
 * Sends notifications via HTTP webhooks with:
 * - Custom headers support
 * - Retry with exponential backoff
 * - Configurable timeout
 * - Standardized payload format
 */

// ============================================================================
// Types
// ============================================================================

export interface WebhookPayload {
  timestamp: string;
  alert: {
    type: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    title: string;
    message: string;
  };
  metadata: Record<string, unknown>;
  source?: string;
}

export interface WebhookOptions {
  /** Custom HTTP headers */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds (default: 10000) */
  timeoutMs?: number;
  /** Number of retry attempts (default: 3) */
  retries?: number;
  /** Initial delay between retries in ms (default: 1000) */
  retryDelayMs?: number;
  /** Maximum delay between retries in ms (default: 30000) */
  maxRetryDelayMs?: number;
  /** HTTP method (default: POST) */
  method?: 'POST' | 'PUT' | 'PATCH';
}

export interface WebhookResult {
  success: boolean;
  statusCode?: number;
  attempts: number;
  responseBody?: string;
  error?: string;
  durationMs: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_OPTIONS: Required<Omit<WebhookOptions, 'headers'>> & { headers: Record<string, string> } = {
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'BaaS-AdminAgent/1.0',
  },
  timeoutMs: 10000,
  retries: 3,
  retryDelayMs: 1000,
  maxRetryDelayMs: 30000,
  method: 'POST',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate exponential backoff delay
 */
function calculateBackoff(attempt: number, baseDelay: number, maxDelay: number): number {
  const delay = baseDelay * Math.pow(2, attempt);
  // Add jitter (±10%) to prevent thundering herd
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.min(delay + jitter, maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable (network errors, 5xx, 429)
 */
function isRetryable(statusCode?: number, error?: Error): boolean {
  // Network errors are retryable
  if (error && !statusCode) {
    const retryableErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', 'UND_ERR_CONNECT_TIMEOUT'];
    return retryableErrors.some(code => error.message.includes(code));
  }
  
  // 5xx and 429 (rate limit) are retryable
  if (statusCode) {
    return statusCode >= 500 || statusCode === 429;
  }
  
  return false;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Create a standardized webhook payload
 */
export function createPayload(
  type: string,
  severity: WebhookPayload['alert']['severity'],
  title: string,
  message: string,
  metadata: Record<string, unknown> = {},
  source: string = 'admin-agent'
): WebhookPayload {
  return {
    timestamp: new Date().toISOString(),
    alert: {
      type,
      severity,
      title,
      message,
    },
    metadata,
    source,
  };
}

/**
 * Send a webhook notification
 * 
 * @param url - Target webhook URL
 * @param payload - Data to send
 * @param options - Configuration options
 * @returns Result with success status and details
 * 
 * @example
 * ```ts
 * const result = await sendWebhook(
 *   'https://hooks.example.com/webhook',
 *   createPayload('health_check', 'warning', 'High Memory Usage', 'Memory at 85%', { memoryPercent: 85 }),
 *   { headers: { 'X-API-Key': 'secret' }, retries: 5 }
 * );
 * ```
 */
export async function sendWebhook(
  url: string,
  payload: WebhookPayload | Record<string, unknown>,
  options: WebhookOptions = {}
): Promise<WebhookResult> {
  const startTime = Date.now();
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options,
    headers: { ...DEFAULT_OPTIONS.headers, ...options.headers },
  };
  
  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    return {
      success: false,
      attempts: 0,
      error: `Invalid webhook URL: ${url}`,
      durationMs: Date.now() - startTime,
    };
  }
  
  const body = JSON.stringify(payload);
  let lastError: Error | undefined;
  let lastStatusCode: number | undefined;
  let lastResponseBody: string | undefined;
  
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    // Wait before retry (skip first attempt)
    if (attempt > 0) {
      const delay = calculateBackoff(attempt - 1, opts.retryDelayMs, opts.maxRetryDelayMs);
      await sleep(delay);
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs);
      
      const response = await fetch(url, {
        method: opts.method,
        headers: opts.headers,
        body,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      lastStatusCode = response.status;
      
      try {
        lastResponseBody = await response.text();
      } catch {
        lastResponseBody = undefined;
      }
      
      // Success: 2xx status codes
      if (response.ok) {
        return {
          success: true,
          statusCode: response.status,
          attempts: attempt + 1,
          responseBody: lastResponseBody,
          durationMs: Date.now() - startTime,
        };
      }
      
      // Non-retryable error
      if (!isRetryable(response.status)) {
        return {
          success: false,
          statusCode: response.status,
          attempts: attempt + 1,
          responseBody: lastResponseBody,
          error: `HTTP ${response.status}: ${response.statusText}`,
          durationMs: Date.now() - startTime,
        };
      }
      
      // Retryable error - continue loop
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      lastStatusCode = undefined;
      
      // Abort error (timeout)
      if (lastError.name === 'AbortError') {
        lastError = new Error(`Request timeout after ${opts.timeoutMs}ms`);
      }
      
      // Non-retryable network error
      if (!isRetryable(undefined, lastError)) {
        return {
          success: false,
          attempts: attempt + 1,
          error: lastError.message,
          durationMs: Date.now() - startTime,
        };
      }
    }
  }
  
  // All retries exhausted
  return {
    success: false,
    statusCode: lastStatusCode,
    attempts: opts.retries + 1,
    responseBody: lastResponseBody,
    error: lastError?.message || 'Unknown error after all retries',
    durationMs: Date.now() - startTime,
  };
}

/**
 * Send multiple webhooks in parallel
 * 
 * @param webhooks - Array of webhook configurations
 * @returns Results for each webhook
 */
export async function sendWebhookBatch(
  webhooks: Array<{
    url: string;
    payload: WebhookPayload | Record<string, unknown>;
    options?: WebhookOptions;
  }>
): Promise<WebhookResult[]> {
  return Promise.all(
    webhooks.map(({ url, payload, options }) => sendWebhook(url, payload, options))
  );
}

/**
 * Create a pre-configured webhook sender
 * 
 * @param baseUrl - Default webhook URL
 * @param defaultOptions - Default options for all requests
 * @returns Configured send function
 * 
 * @example
 * ```ts
 * const slack = createWebhookSender('https://hooks.slack.com/...', {
 *   headers: { 'X-Custom': 'value' }
 * });
 * await slack({ text: 'Hello!' });
 * ```
 */
export function createWebhookSender(
  baseUrl: string,
  defaultOptions: WebhookOptions = {}
) {
  return async (
    payload: WebhookPayload | Record<string, unknown>,
    overrideOptions?: WebhookOptions
  ): Promise<WebhookResult> => {
    return sendWebhook(baseUrl, payload, { ...defaultOptions, ...overrideOptions });
  };
}
