/**
 * LLM Gateway - Types
 * Tipos compartilhados entre os módulos do gateway
 */

import type { LLMProvider, ProviderStatus, LLMRequestType, Tenant, TenantAgent } from '@prisma/client';

// ============================================
// Provider Types
// ============================================

export interface RouteResult {
  provider: LLMProvider;
  reason: string;
}

export interface ProviderHealth {
  providerId: string;
  status: ProviderStatus;
  isAvailable: boolean;
  currentLoad: number; // percentage
  errorRate: number; // percentage
  avgLatencyMs: number;
}

// ============================================
// Request/Response Types
// ============================================

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface CompletionRequest {
  tenantId: string;
  agentId?: string;
  messages: Message[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  channel?: string;
  groupId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface CompletionResponse {
  id: string;
  model: string;
  provider: string;
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
  };
  latencyMs: number;
}

// ============================================
// Usage Tracking Types
// ============================================

export interface UsageRecord {
  tenantId: string;
  agentId?: string;
  providerId: string;
  model: string;
  requestType?: LLMRequestType;
  inputTokens: number;
  outputTokens: number;
  latencyMs?: number;
  channel?: string;
  groupId?: string;
  sessionId?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  avgLatencyMs: number;
  successRate: number;
  byModel: Record<string, { requests: number; tokens: number; cost: number }>;
  byAgent: Record<string, { requests: number; tokens: number; cost: number }>;
  byChannel: Record<string, { requests: number; tokens: number; cost: number }>;
  byDay: Array<{ date: string; requests: number; tokens: number; cost: number }>;
}

// ============================================
// Rate Limiting Types
// ============================================

export interface RateLimitConfig {
  tenant: {
    requestsPerMinute: number;
    tokensPerMinute: number;
    requestsPerDay: number;
    tokensPerDay: number;
  };
  agent: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  provider: {
    maxConcurrency: number;
    requestsPerMinute: number;
  };
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfter?: number; // seconds
  current?: {
    requests: number;
    tokens: number;
  };
  limit?: {
    requests: number;
    tokens: number;
  };
}

// ============================================
// Circuit Breaker Types
// ============================================

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Blocked, no requests
  HALF_OPEN = 'HALF_OPEN' // Testing recovery
}

export interface CircuitBreakerConfig {
  failureThreshold: number;    // Failures to open
  successThreshold: number;    // Successes to close
  halfOpenTimeout: number;     // ms before testing
  openTimeout: number;         // ms before half-open
  monitoringPeriod: number;    // Window for failure count
}

export interface CircuitStatus {
  providerId: string;
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure?: Date;
  lastSuccess?: Date;
  openedAt?: Date;
  nextRetryAt?: Date;
}

// ============================================
// Alert Types
// ============================================

export interface AlertData {
  type: 'BUDGET_WARNING' | 'BUDGET_CRITICAL' | 'BUDGET_EXCEEDED' | 'DAILY_WARNING' | 'DAILY_EXCEEDED' | 'PROVIDER_ERROR' | 'RATE_LIMIT';
  threshold: number;
  currentUsage: number;
  limitValue: number;
  percentUsed: number;
  message: string;
}

// ============================================
// Gateway Options
// ============================================

export interface GatewayOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  retries?: number;
  preferProvider?: string;
}
