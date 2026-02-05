/**
 * LLM Gateway API Client
 * Helper functions to interact with the LLM Gateway API endpoints
 */

import type { Alert, AlertStatus, ProviderStatus } from "@/components/llm"

// ============================================================================
// Types
// ============================================================================

export interface UsageSummary {
  totalTokens: number
  inputTokens: number
  outputTokens: number
  totalCost: number
  requestCount: number
  errorCount: number
  avgLatencyMs: number
  period: "day" | "week" | "month" | "year"
  startDate: string
  endDate: string
  byProvider: ProviderUsage[]
  byModel: ModelUsage[]
}

export interface ProviderUsage {
  provider: string
  tokens: number
  cost: number
  requests: number
  errors: number
}

export interface ModelUsage {
  model: string
  provider: string
  tokens: number
  inputTokens: number
  outputTokens: number
  cost: number
  requests: number
}

export interface UsageHistoryPoint {
  date: string
  tokens: number
  inputTokens: number
  outputTokens: number
  cost: number
  requests: number
}

export interface Provider {
  id: string
  name: string
  slug: string
  status: ProviderStatus
  isEnabled: boolean
  models: ProviderModel[]
  config: ProviderConfig
  usage?: {
    tokens: number
    cost: number
    requests: number
  }
  health?: {
    latencyMs: number
    uptime: number
    lastCheck: string
  }
}

export interface ProviderModel {
  id: string
  name: string
  contextWindow: number
  maxOutput: number
  inputPricePerMillion: number
  outputPricePerMillion: number
  capabilities: string[]
  isEnabled: boolean
}

export interface ProviderConfig {
  apiKeySet: boolean
  baseUrl?: string
  timeout?: number
  maxRetries?: number
  rateLimits?: {
    requestsPerMinute?: number
    tokensPerMinute?: number
  }
}

export interface AlertFilters {
  status?: AlertStatus | AlertStatus[]
  severity?: string | string[]
  type?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}

export interface AlertsResponse {
  alerts: Alert[]
  total: number
  hasMore: boolean
}

export interface BudgetSettings {
  monthlyLimit: number
  warningThreshold: number
  criticalThreshold: number
  autoDisable: boolean
  notifications: {
    email: boolean
    webhook: boolean
    inApp: boolean
  }
}

export interface GatewaySettings {
  defaultProvider: string
  defaultModel: string
  fallbackEnabled: boolean
  fallbackProviders: string[]
  cacheEnabled: boolean
  cacheTtlSeconds: number
  loggingLevel: "none" | "basic" | "full"
  budgets: BudgetSettings
}

// ============================================================================
// API Client
// ============================================================================

const API_BASE = "/api/llm-gateway"

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${endpoint}`
  
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }))
    throw new Error(error.message || `API error: ${response.status}`)
  }

  return response.json()
}

// ============================================================================
// Usage API
// ============================================================================

/**
 * Get usage summary for a given period
 */
export async function getUsageSummary(
  period: "day" | "week" | "month" | "year" = "month"
): Promise<UsageSummary> {
  return fetchApi<UsageSummary>(`/usage/summary?period=${period}`)
}

/**
 * Get usage history for charting
 */
export async function getUsageHistory(
  days: number = 30
): Promise<UsageHistoryPoint[]> {
  return fetchApi<UsageHistoryPoint[]>(`/usage/history?days=${days}`)
}

/**
 * Get usage breakdown by provider or model
 */
export async function getUsageBreakdown(
  groupBy: "provider" | "model" = "provider",
  period: "day" | "week" | "month" = "month"
): Promise<ProviderUsage[] | ModelUsage[]> {
  return fetchApi(`/usage/breakdown?groupBy=${groupBy}&period=${period}`)
}

// ============================================================================
// Providers API
// ============================================================================

/**
 * Get all configured providers
 */
export async function getProviders(): Promise<Provider[]> {
  return fetchApi<Provider[]>("/providers")
}

/**
 * Get a single provider by ID
 */
export async function getProvider(id: string): Promise<Provider> {
  return fetchApi<Provider>(`/providers/${id}`)
}

/**
 * Update provider configuration
 */
export async function updateProvider(
  id: string,
  config: Partial<ProviderConfig>
): Promise<Provider> {
  return fetchApi<Provider>(`/providers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(config),
  })
}

/**
 * Enable or disable a provider
 */
export async function toggleProvider(
  id: string,
  enabled: boolean
): Promise<Provider> {
  return fetchApi<Provider>(`/providers/${id}/toggle`, {
    method: "POST",
    body: JSON.stringify({ enabled }),
  })
}

/**
 * Test provider connection
 */
export async function testProvider(id: string): Promise<{
  success: boolean
  latencyMs: number
  error?: string
}> {
  return fetchApi(`/providers/${id}/test`, { method: "POST" })
}

// ============================================================================
// Alerts API
// ============================================================================

/**
 * Get alerts with optional filters
 */
export async function getAlerts(filters?: AlertFilters): Promise<AlertsResponse> {
  const params = new URLSearchParams()
  
  if (filters) {
    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
      statuses.forEach(s => params.append("status", s))
    }
    if (filters.severity) {
      const severities = Array.isArray(filters.severity) ? filters.severity : [filters.severity]
      severities.forEach(s => params.append("severity", s))
    }
    if (filters.type) params.set("type", filters.type)
    if (filters.startDate) params.set("startDate", filters.startDate)
    if (filters.endDate) params.set("endDate", filters.endDate)
    if (filters.limit) params.set("limit", filters.limit.toString())
    if (filters.offset) params.set("offset", filters.offset.toString())
  }

  const queryString = params.toString()
  return fetchApi<AlertsResponse>(`/alerts${queryString ? `?${queryString}` : ""}`)
}

/**
 * Get active alerts count
 */
export async function getActiveAlertsCount(): Promise<{
  total: number
  critical: number
  warning: number
  info: number
}> {
  return fetchApi("/alerts/count")
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(id: string): Promise<Alert> {
  return fetchApi<Alert>(`/alerts/${id}/acknowledge`, {
    method: "POST",
  })
}

/**
 * Resolve an alert
 */
export async function resolveAlert(id: string): Promise<Alert> {
  return fetchApi<Alert>(`/alerts/${id}/resolve`, {
    method: "POST",
  })
}

/**
 * Dismiss an alert
 */
export async function dismissAlert(id: string): Promise<Alert> {
  return fetchApi<Alert>(`/alerts/${id}/dismiss`, {
    method: "POST",
  })
}

/**
 * Bulk acknowledge alerts
 */
export async function bulkAcknowledgeAlerts(ids: string[]): Promise<{ count: number }> {
  return fetchApi("/alerts/bulk/acknowledge", {
    method: "POST",
    body: JSON.stringify({ ids }),
  })
}

// ============================================================================
// Settings API
// ============================================================================

/**
 * Get gateway settings
 */
export async function getSettings(): Promise<GatewaySettings> {
  return fetchApi<GatewaySettings>("/settings")
}

/**
 * Update gateway settings
 */
export async function updateSettings(
  settings: Partial<GatewaySettings>
): Promise<GatewaySettings> {
  return fetchApi<GatewaySettings>("/settings", {
    method: "PATCH",
    body: JSON.stringify(settings),
  })
}

/**
 * Update budget settings
 */
export async function updateBudgetSettings(
  budgets: Partial<BudgetSettings>
): Promise<BudgetSettings> {
  return fetchApi<BudgetSettings>("/settings/budgets", {
    method: "PATCH",
    body: JSON.stringify(budgets),
  })
}

// ============================================================================
// React Query Keys (for cache management)
// ============================================================================

export const llmGatewayKeys = {
  all: ["llm-gateway"] as const,
  usage: () => [...llmGatewayKeys.all, "usage"] as const,
  usageSummary: (period: string) => [...llmGatewayKeys.usage(), "summary", period] as const,
  usageHistory: (days: number) => [...llmGatewayKeys.usage(), "history", days] as const,
  providers: () => [...llmGatewayKeys.all, "providers"] as const,
  provider: (id: string) => [...llmGatewayKeys.providers(), id] as const,
  alerts: () => [...llmGatewayKeys.all, "alerts"] as const,
  alertsList: (filters?: AlertFilters) => [...llmGatewayKeys.alerts(), filters] as const,
  alertsCount: () => [...llmGatewayKeys.alerts(), "count"] as const,
  settings: () => [...llmGatewayKeys.all, "settings"] as const,
}
