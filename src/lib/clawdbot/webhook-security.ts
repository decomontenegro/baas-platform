/**
 * Webhook Security Module
 * 
 * Provides secure webhook signature verification with:
 * - HMAC-SHA256 signature validation
 * - Timing-safe comparison to prevent timing attacks
 * - Timestamp validation to prevent replay attacks
 * - Optional source IP validation
 */

import crypto from 'crypto';

// ============================================
// Configuration
// ============================================

/** Maximum age of webhook requests in milliseconds (5 minutes) */
const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000;

/** Known Clawdbot Gateway IP addresses (for optional IP validation) */
const CLAWDBOT_ALLOWED_IPS = new Set([
  // Add Clawdbot Gateway IPs here when deploying to production
  // '1.2.3.4',
  // '5.6.7.8',
]);

/** Environment variable to enable strict IP validation */
const STRICT_IP_VALIDATION = process.env.CLAWDBOT_STRICT_IP_VALIDATION === 'true';

// ============================================
// Types
// ============================================

export interface WebhookVerificationResult {
  valid: boolean;
  error?: WebhookSecurityError;
}

export interface WebhookSecurityError {
  code: WebhookErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type WebhookErrorCode =
  | 'MISSING_SIGNATURE'
  | 'INVALID_SIGNATURE_FORMAT'
  | 'SIGNATURE_MISMATCH'
  | 'MISSING_TIMESTAMP'
  | 'INVALID_TIMESTAMP'
  | 'TIMESTAMP_EXPIRED'
  | 'TIMESTAMP_FUTURE'
  | 'INVALID_SOURCE_IP'
  | 'MISSING_SECRET';

export interface WebhookVerificationOptions {
  /** Skip timestamp validation (not recommended for production) */
  skipTimestampValidation?: boolean;
  /** Custom max age for timestamp in milliseconds */
  maxTimestampAgeMs?: number;
  /** Skip IP validation even if configured */
  skipIpValidation?: boolean;
  /** Additional allowed IPs for this request */
  additionalAllowedIps?: string[];
}

// ============================================
// Core Functions
// ============================================

/**
 * Verify webhook signature using HMAC-SHA256
 * 
 * @param payload - Raw request body as string
 * @param signature - Signature from x-clawdbot-signature header (format: "sha256=<hex>")
 * @param secret - Webhook secret for this organization
 * @param options - Optional verification options
 * @returns Verification result with error details if invalid
 * 
 * @example
 * ```ts
 * const result = verifyWebhookSignature(rawBody, signature, secret);
 * if (!result.valid) {
 *   console.error('Webhook verification failed:', result.error);
 *   return new Response('Unauthorized', { status: 401 });
 * }
 * ```
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string,
  options: WebhookVerificationOptions = {}
): WebhookVerificationResult {
  // Check for missing secret
  if (!secret) {
    return {
      valid: false,
      error: {
        code: 'MISSING_SECRET',
        message: 'Webhook secret is not configured',
      },
    };
  }

  // Check for missing signature
  if (!signature) {
    return {
      valid: false,
      error: {
        code: 'MISSING_SIGNATURE',
        message: 'Missing x-clawdbot-signature header',
      },
    };
  }

  // Parse signature format (expected: "sha256=<hex>")
  const signatureParts = signature.split('=');
  if (signatureParts.length !== 2 || signatureParts[0] !== 'sha256') {
    return {
      valid: false,
      error: {
        code: 'INVALID_SIGNATURE_FORMAT',
        message: 'Invalid signature format. Expected: sha256=<hex>',
        details: { received: signature.substring(0, 50) },
      },
    };
  }

  const receivedHash = signatureParts[1];

  // Compute expected signature
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  // Timing-safe comparison
  if (!timingSafeEqual(receivedHash, expectedHash)) {
    return {
      valid: false,
      error: {
        code: 'SIGNATURE_MISMATCH',
        message: 'Webhook signature verification failed',
      },
    };
  }

  return { valid: true };
}

/**
 * Verify webhook timestamp to prevent replay attacks
 * 
 * @param timestamp - Unix timestamp (seconds or milliseconds)
 * @param options - Verification options
 * @returns Verification result
 */
export function verifyWebhookTimestamp(
  timestamp: number | string | undefined,
  options: WebhookVerificationOptions = {}
): WebhookVerificationResult {
  if (options.skipTimestampValidation) {
    return { valid: true };
  }

  // Check for missing timestamp
  if (timestamp === undefined || timestamp === null) {
    return {
      valid: false,
      error: {
        code: 'MISSING_TIMESTAMP',
        message: 'Missing timestamp in webhook payload',
      },
    };
  }

  // Parse timestamp
  let timestampMs: number;
  if (typeof timestamp === 'string') {
    timestampMs = parseInt(timestamp, 10);
  } else {
    timestampMs = timestamp;
  }

  // Handle seconds vs milliseconds (if timestamp is too small, it's probably seconds)
  if (timestampMs < 1e12) {
    timestampMs *= 1000;
  }

  if (isNaN(timestampMs)) {
    return {
      valid: false,
      error: {
        code: 'INVALID_TIMESTAMP',
        message: 'Invalid timestamp format',
        details: { received: timestamp },
      },
    };
  }

  const now = Date.now();
  const maxAge = options.maxTimestampAgeMs ?? MAX_TIMESTAMP_AGE_MS;
  const age = now - timestampMs;

  // Check if timestamp is too old
  if (age > maxAge) {
    return {
      valid: false,
      error: {
        code: 'TIMESTAMP_EXPIRED',
        message: `Webhook timestamp is too old (${Math.round(age / 1000)}s > ${maxAge / 1000}s max)`,
        details: {
          timestampMs,
          nowMs: now,
          ageMs: age,
          maxAgeMs: maxAge,
        },
      },
    };
  }

  // Check if timestamp is in the future (with small tolerance for clock skew)
  const clockSkewTolerance = 60 * 1000; // 1 minute
  if (timestampMs > now + clockSkewTolerance) {
    return {
      valid: false,
      error: {
        code: 'TIMESTAMP_FUTURE',
        message: 'Webhook timestamp is in the future',
        details: {
          timestampMs,
          nowMs: now,
          differenceMs: timestampMs - now,
        },
      },
    };
  }

  return { valid: true };
}

/**
 * Verify the source IP of the webhook request
 * 
 * @param sourceIp - IP address from request
 * @param options - Verification options
 * @returns Verification result
 */
export function verifySourceIp(
  sourceIp: string | undefined,
  options: WebhookVerificationOptions = {}
): WebhookVerificationResult {
  // Skip if validation is disabled or no IPs are configured
  if (options.skipIpValidation || (!STRICT_IP_VALIDATION && CLAWDBOT_ALLOWED_IPS.size === 0)) {
    return { valid: true };
  }

  if (!sourceIp) {
    // If strict mode is enabled, require IP
    if (STRICT_IP_VALIDATION) {
      return {
        valid: false,
        error: {
          code: 'INVALID_SOURCE_IP',
          message: 'Unable to determine source IP',
        },
      };
    }
    return { valid: true };
  }

  // Build allowed IPs set
  const allowedIps = new Set(CLAWDBOT_ALLOWED_IPS);
  if (options.additionalAllowedIps) {
    options.additionalAllowedIps.forEach(ip => allowedIps.add(ip));
  }

  // Add IPs from environment variable
  const envIps = process.env.CLAWDBOT_ALLOWED_IPS;
  if (envIps) {
    envIps.split(',').map(ip => ip.trim()).filter(Boolean).forEach(ip => allowedIps.add(ip));
  }

  // Skip if no IPs to validate against
  if (allowedIps.size === 0) {
    return { valid: true };
  }

  // Normalize IP (handle IPv6-mapped IPv4)
  const normalizedIp = normalizeIp(sourceIp);

  if (!allowedIps.has(normalizedIp)) {
    return {
      valid: false,
      error: {
        code: 'INVALID_SOURCE_IP',
        message: 'Request from unauthorized IP address',
        details: {
          sourceIp: normalizedIp,
          // Don't expose allowed IPs in error
        },
      },
    };
  }

  return { valid: true };
}

/**
 * Full webhook verification combining all checks
 * 
 * @param payload - Raw request body
 * @param signature - Signature header value
 * @param secret - Webhook secret
 * @param timestamp - Timestamp from payload
 * @param sourceIp - Source IP of request (optional)
 * @param options - Verification options
 * @returns Verification result
 */
export function verifyWebhook(
  payload: string,
  signature: string | null,
  secret: string,
  timestamp?: number,
  sourceIp?: string,
  options: WebhookVerificationOptions = {}
): WebhookVerificationResult {
  // 1. Verify signature
  const signatureResult = verifyWebhookSignature(payload, signature, secret, options);
  if (!signatureResult.valid) {
    return signatureResult;
  }

  // 2. Verify timestamp
  const timestampResult = verifyWebhookTimestamp(timestamp, options);
  if (!timestampResult.valid) {
    return timestampResult;
  }

  // 3. Verify source IP (optional)
  const ipResult = verifySourceIp(sourceIp, options);
  if (!ipResult.valid) {
    return ipResult;
  }

  return { valid: true };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  // Ensure same length to prevent length-based timing attacks
  if (a.length !== b.length) {
    // Still perform comparison to maintain constant time
    const dummyB = 'x'.repeat(a.length);
    crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(dummyB, 'utf8'));
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(a, 'utf8'),
      Buffer.from(b, 'utf8')
    );
  } catch {
    return false;
  }
}

/**
 * Normalize IP address (handle IPv6-mapped IPv4)
 */
function normalizeIp(ip: string): string {
  // Handle IPv6-mapped IPv4 addresses (::ffff:192.168.1.1)
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  return ip;
}

/**
 * Generate a cryptographically secure webhook secret
 * 
 * @param bytes - Number of random bytes (default: 32)
 * @returns Hex-encoded secret
 */
export function generateWebhookSecret(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Create a signature for outgoing webhooks (for testing or if BaaS sends webhooks)
 * 
 * @param payload - Request body
 * @param secret - Webhook secret
 * @returns Signature in format "sha256=<hex>"
 */
export function createWebhookSignature(payload: string, secret: string): string {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
  
  return `sha256=${hash}`;
}

// ============================================
// Logging Helpers
// ============================================

// Import logger - use dynamic import to avoid circular dependencies
let _webhookSecurityLogger: any = null;

async function getLogger() {
  if (!_webhookSecurityLogger) {
    const { webhookLogger } = await import('@/lib/logger');
    _webhookSecurityLogger = webhookLogger.child({ component: 'webhook-security' });
  }
  return _webhookSecurityLogger;
}

/**
 * Log webhook security event (for monitoring and alerting)
 */
export function logWebhookSecurityEvent(
  eventType: 'success' | 'failure',
  error?: WebhookSecurityError,
  metadata?: Record<string, unknown>
): void {
  const logData = {
    type: 'webhook_security',
    eventType,
    error: error ? {
      code: error.code,
      message: error.message,
      // Don't log sensitive details
    } : undefined,
    ...metadata,
  };

  // Use async logging but don't wait for it
  getLogger().then(logger => {
    if (eventType === 'failure') {
      logger.warn(logData, 'Webhook security event: failure');
    } else {
      logger.debug(logData, 'Webhook security event: success');
    }
  }).catch(() => {
    // Fallback to console if logger fails to load
    if (eventType === 'failure') {
      console.warn('[WEBHOOK_SECURITY]', JSON.stringify(logData));
    }
  });
}
